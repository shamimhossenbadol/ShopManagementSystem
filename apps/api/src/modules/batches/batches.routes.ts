import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';

const batchCreateSchema = z.object({
  product_id: z.coerce.number().int().positive('Product is required'),
  batch_number: z.string().min(1, 'Batch number is required'),
  expiry_date: z.string().min(1, 'Expiry date is required'),
  quantity: z.coerce.number().min(0.01, 'Quantity must be greater than 0'),
  purchase_id: z.coerce.number().int().positive().optional().nullable(),
});

/**
 * Automatically purges and writes off all expired batches across the inventory.
 * Deducts the expired units from products.current_stock and logs damage stock movements.
 */
export async function autoRemoveExpiredBatches(executor: { query: Function }, userId: number) {
  const expiredRes = await executor.query(
    `SELECT b.*, p.name as product_name, p.cost_price as product_cost_price, p.current_stock
     FROM product_batches b
     JOIN products p ON p.id = b.product_id
     WHERE b.is_active = TRUE
       AND b.current_quantity > 0
       AND b.expiry_date < CURRENT_DATE
     FOR UPDATE OF b, p`
  );

  const processed = [];

  for (const batch of expiredRes.rows) {
    const qtyToDeduct = Number(batch.current_quantity);
    if (qtyToDeduct <= 0) continue;

    // 1. Deplete batch & mark inactive
    await executor.query(
      `UPDATE product_batches 
       SET current_quantity = 0, is_active = FALSE, updated_at = NOW() 
       WHERE id = $1`,
      [batch.id]
    );

    // 2. Decrement products.current_stock
    await executor.query(
      `UPDATE products 
       SET current_stock = GREATEST(0, current_stock - $1), updated_at = NOW() 
       WHERE id = $2`,
      [qtyToDeduct, batch.product_id]
    );

    // 3. Check if any active batches remain for this product
    const activeCheck = await executor.query(
      `SELECT id FROM product_batches 
       WHERE product_id = $1 AND is_active = TRUE AND current_quantity > 0 
       LIMIT 1`,
      [batch.product_id]
    );
    if (activeCheck.rows.length === 0) {
      await executor.query(
        `UPDATE products SET has_expiry = FALSE, updated_at = NOW() WHERE id = $1`,
        [batch.product_id]
      );
    }

    // 4. Record damage/expired stock movement
    const unitCost = Number(batch.product_cost_price || 0);
    const moveRes = await executor.query(
      `INSERT INTO stock_movements (
        product_id, quantity, type, reference_id, reference_type, unit_cost, user_id, notes
       ) VALUES ($1, $2, 'damage', $3, 'auto_expiry_removal', $4, $5, $6)
       RETURNING id`,
      [
        batch.product_id,
        -qtyToDeduct,
        batch.id,
        unitCost,
        userId,
        `Auto-removed expired stock: Batch ${batch.batch_number} (expired on ${batch.expiry_date})`,
      ]
    );

    // 5. Audit Log
    await executor.query(
      `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, old_values, new_values)
       VALUES ($1, 'BATCH_AUTO_EXPIRED_REMOVAL', 'product_batches', $2, $3, $4)`,
      [
        userId,
        batch.id,
        JSON.stringify({ current_quantity: qtyToDeduct, batch_number: batch.batch_number, expiry_date: batch.expiry_date }),
        JSON.stringify({ current_quantity: 0, removed_units: qtyToDeduct, movement_id: moveRes.rows[0]?.id }),
      ]
    );

    processed.push({
      batchId: batch.id,
      batchNumber: batch.batch_number,
      productId: batch.product_id,
      productName: batch.product_name,
      removedUnits: qtyToDeduct,
    });
  }

  return processed;
}

export async function batchRoutes(fastify: FastifyInstance) {
  // GET /api/v1/batches - List all active batches with auto-expiry removal
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const { product_id, status } = request.query as any;

    // Automatically remove expired units from stock before listing
    try {
      await withTransaction(async (client) => {
        await autoRemoveExpiredBatches(client, request.user!.id);
      });
    } catch (e) {
      fastify.log.error(e, 'Failed to run automated expired batch removal');
    }

    let sql = `
      SELECT b.id, b.product_id, b.batch_number, b.expiry_date, b.purchase_id,
             b.purchase_item_id, b.initial_quantity, b.current_quantity, b.is_active,
             b.created_at, b.updated_at,
             p.name as product_name, p.sku, p.barcode, p.current_stock as product_current_stock,
             po.reference_no as purchase_ref_no,
             ROUND(b.expiry_date - CURRENT_DATE) as days_to_expiry
      FROM product_batches b
      JOIN products p ON p.id = b.product_id
      LEFT JOIN purchases po ON po.id = b.purchase_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (product_id) {
      params.push(Number(product_id));
      sql += ` AND b.product_id = $${params.length}`;
    }

    if (status === 'expired') {
      sql += ` AND b.expiry_date < CURRENT_DATE`;
    } else if (status === 'expiring_soon') {
      sql += ` AND b.expiry_date >= CURRENT_DATE AND b.expiry_date <= CURRENT_DATE + INTERVAL '30 days' AND b.current_quantity > 0`;
    } else if (status === 'depleted') {
      sql += ` AND b.current_quantity <= 0`;
    }

    sql += ` ORDER BY b.expiry_date ASC, b.id ASC`;
    const res = await query(sql, params);
    return reply.send({ success: true, data: res.rows });
  });

  // GET /api/v1/batches/expiring - Expiring batches alert (7/15/30 days)
  fastify.get('/expiring', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const { days = 30 } = request.query as any;
    const thresholdDays = Number(days);

    const res = await query(
      `SELECT b.id, b.product_id, b.batch_number, b.expiry_date, b.purchase_id,
              b.purchase_item_id, b.initial_quantity, b.current_quantity, b.is_active,
              b.created_at, b.updated_at,
              p.name as product_name, p.sku, p.barcode,
              po.reference_no as purchase_ref_no,
              ROUND(b.expiry_date - CURRENT_DATE) as days_to_expiry
       FROM product_batches b
       JOIN products p ON p.id = b.product_id
       LEFT JOIN purchases po ON po.id = b.purchase_id
       WHERE b.is_active = TRUE
         AND b.current_quantity > 0
         AND b.expiry_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL
       ORDER BY b.expiry_date ASC`,
      [thresholdDays]
    );

    return reply.send({
      success: true,
      count: res.rows.length,
      thresholdDays,
      data: res.rows,
    });
  });

  // POST /api/v1/batches/auto-remove-expired - Trigger automated removal of all expired batch units
  fastify.post('/auto-remove-expired', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    try {
      const removed = await withTransaction(async (client) => {
        return await autoRemoveExpiredBatches(client, request.user!.id);
      });

      return reply.send({
        success: true,
        message: `Processed expired batches: ${removed.length} batch(es) automatically removed from stock.`,
        data: removed,
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });

  // POST /api/v1/batches - Manual Batch creation / Expiry declaration
  // Strictly validates against current stock, does NOT inflate current_stock, and has no cost_price.
  fastify.post('/', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const parsed = batchCreateSchema.parse(request.body);

    try {
      const result = await withTransaction(async (client) => {
        // Lock product row to prevent race conditions
        const prodRes = await client.query(
          `SELECT id, name, current_stock, cost_price 
           FROM products 
           WHERE id = $1 AND is_active = TRUE AND is_deleted = FALSE 
           FOR UPDATE`,
          [parsed.product_id]
        );

        if (prodRes.rows.length === 0) {
          throw new Error('Product not found or inactive.');
        }

        const product = prodRes.rows[0];
        const currentStock = Number(product.current_stock);

        if (currentStock <= 0) {
          throw new Error(
            `Product "${product.name}" has no stock available (${currentStock} units). Cannot declare batch.`
          );
        }

        // Sum existing active batched units for this product
        const batchedRes = await client.query(
          `SELECT COALESCE(SUM(current_quantity), 0) as total_batched
           FROM product_batches
           WHERE product_id = $1 AND is_active = TRUE AND current_quantity > 0`,
          [parsed.product_id]
        );
        const totalBatched = Number(batchedRes.rows[0].total_batched);
        const availableToBatch = Math.max(0, currentStock - totalBatched);

        if (parsed.quantity > currentStock) {
          throw new Error(
            `Batch quantity (${parsed.quantity}) cannot exceed product current stock (${currentStock} units).`
          );
        }

        if (parsed.quantity > availableToBatch) {
          throw new Error(
            `Batch quantity (${parsed.quantity}) exceeds available unallocated stock (${availableToBatch} units). Total stock is ${currentStock}, with ${totalBatched} units already allocated to active batches.`
          );
        }

        // Insert batch without cost_price
        const res = await client.query(
          `INSERT INTO product_batches (product_id, batch_number, expiry_date, initial_quantity, current_quantity, purchase_id)
           VALUES ($1, $2, $3, $4, $4, $5)
           RETURNING *`,
          [
            parsed.product_id,
            parsed.batch_number,
            parsed.expiry_date,
            parsed.quantity,
            parsed.purchase_id || null,
          ]
        );

        const batch = res.rows[0];

        // Synchronize product perishable flag ONLY - DO NOT INCREASE current_stock!
        await client.query(
          `UPDATE products 
           SET has_expiry = TRUE, updated_at = NOW() 
           WHERE id = $1`,
          [parsed.product_id]
        );

        // Audit Log entry for batch declaration
        await client.query(
          `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, old_values, new_values)
           VALUES ($1, 'BATCH_CREATED', 'product_batches', $2, NULL, $3)`,
          [
            request.user!.id,
            batch.id,
            JSON.stringify({
              batch_number: parsed.batch_number,
              product_id: parsed.product_id,
              expiry_date: parsed.expiry_date,
              quantity: parsed.quantity,
              purchase_id: parsed.purchase_id || null,
            }),
          ]
        );

        return batch;
      });

      return reply.status(201).send({ success: true, data: result });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });

  // POST /api/v1/batches/:id/write-off - Write off / dispose expired or damaged batch
  fastify.post('/:id/write-off', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason = 'Disposal of expired/damaged batch', quantity } = (request.body as any) || {};

    try {
      const result = await withTransaction(async (client) => {
        const batchRes = await client.query(
          `SELECT b.*, p.name as product_name, p.cost_price as product_cost_price, p.current_stock
           FROM product_batches b
           JOIN products p ON p.id = b.product_id
           WHERE b.id = $1 FOR UPDATE OF b, p`,
          [Number(id)]
        );

        if (batchRes.rows.length === 0) {
          throw new Error('Batch not found.');
        }

        const batch = batchRes.rows[0];
        const currentBatchQty = Number(batch.current_quantity);

        if (currentBatchQty <= 0) {
          throw new Error('Batch has no remaining stock to write off.');
        }

        const qtyToDispose = quantity ? Math.min(Number(quantity), currentBatchQty) : currentBatchQty;
        if (qtyToDispose <= 0) {
          throw new Error('Quantity to write off must be greater than 0.');
        }

        const remainingQty = currentBatchQty - qtyToDispose;
        const isActive = remainingQty > 0;

        // 1. Deplete batch quantity & deactivate if fully disposed
        await client.query(
          `UPDATE product_batches 
           SET current_quantity = $1, is_active = $2, updated_at = NOW() 
           WHERE id = $3`,
          [remainingQty, isActive, batch.id]
        );

        // 2. Decrement products.current_stock
        await client.query(
          `UPDATE products 
           SET current_stock = GREATEST(0, current_stock - $1), updated_at = NOW() 
           WHERE id = $2`,
          [qtyToDispose, batch.product_id]
        );

        // Synchronize has_expiry: if no active batches remain with stock, set has_expiry = FALSE
        const activeCheck = await client.query(
          `SELECT id FROM product_batches 
           WHERE product_id = $1 AND is_active = TRUE AND current_quantity > 0 
           LIMIT 1`,
          [batch.product_id]
        );
        if (activeCheck.rows.length === 0) {
          await client.query(
            `UPDATE products SET has_expiry = FALSE, updated_at = NOW() WHERE id = $1`,
            [batch.product_id]
          );
        }

        // 3. Record stock movement (Damage/Loss write-off)
        const unitCost = Number(batch.product_cost_price || 0);
        const moveRes = await client.query(
          `INSERT INTO stock_movements (
            product_id, quantity, type, reference_id, reference_type, unit_cost, user_id, notes
           ) VALUES ($1, $2, 'damage', $3, 'batch_write_off', $4, $5, $6)
           RETURNING id`,
          [
            batch.product_id,
            -qtyToDispose,
            batch.id,
            unitCost,
            request.user!.id,
            `Write-off batch ${batch.batch_number}: ${reason}`,
          ]
        );

        // 4. Audit Log
        await client.query(
          `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, old_values, new_values)
           VALUES ($1, 'BATCH_WRITE_OFF', 'product_batches', $2, $3, $4)`,
          [
            request.user!.id,
            batch.id,
            JSON.stringify({ quantity: currentBatchQty, batch_number: batch.batch_number }),
            JSON.stringify({ disposed_quantity: qtyToDispose, remaining_quantity: remainingQty, reason, movementId: moveRes.rows[0]?.id }),
          ]
        );

        return {
          batchId: batch.id,
          batchNumber: batch.batch_number,
          disposedQuantity: qtyToDispose,
          remainingQuantity: remainingQty,
          productId: batch.product_id,
          productName: batch.product_name,
        };
      });

      return reply.send({
        success: true,
        message: `Batch "${result.batchNumber}" successfully written off (${result.disposedQuantity} units).`,
        data: result,
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });
}

