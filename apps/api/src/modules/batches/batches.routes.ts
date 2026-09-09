import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';

const batchCreateSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  batch_number: z.string().min(1, 'Batch number is required'),
  expiry_date: z.string().min(1, 'Expiry date is required'),
  cost_price: z.coerce.number().min(0).default(0),
  quantity: z.coerce.number().min(0.01),
  purchase_id: z.coerce.number().int().positive().optional().nullable(),
});

export async function batchRoutes(fastify: FastifyInstance) {
  // GET /api/v1/batches - List all active batches with optional product_id filter
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const { product_id, status } = request.query as any;

    let sql = `
      SELECT b.*, p.name as product_name, p.sku, p.barcode,
             po.reference_no as purchase_ref_no,
             ROUND(b.expiry_date - CURRENT_DATE) as days_to_expiry
      FROM product_batches b
      JOIN products p ON p.id = b.product_id
      LEFT JOIN purchases po ON po.id = b.purchase_id
      WHERE b.is_active = TRUE
    `;
    const params: any[] = [];

    if (product_id) {
      params.push(Number(product_id));
      sql += ` AND b.product_id = $${params.length}`;
    }

    if (status === 'expired') {
      sql += ` AND b.expiry_date < CURRENT_DATE`;
    } else if (status === 'expiring_soon') {
      sql += ` AND b.expiry_date >= CURRENT_DATE AND b.expiry_date <= CURRENT_DATE + INTERVAL '30 days'`;
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
      `SELECT b.*, p.name as product_name, p.sku, p.barcode,
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

  // POST /api/v1/batches - Manual Batch creation / entry with atomic stock synchronization (Manager only)
  fastify.post('/', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const parsed = batchCreateSchema.parse(request.body);

    try {
      const result = await withTransaction(async (client) => {
        const res = await client.query(
          `INSERT INTO product_batches (product_id, batch_number, expiry_date, cost_price, initial_quantity, current_quantity, purchase_id)
           VALUES ($1, $2, $3, $4, $5, $5, $6)
           RETURNING *`,
          [
            parsed.product_id,
            parsed.batch_number,
            parsed.expiry_date,
            parsed.cost_price,
            parsed.quantity,
            parsed.purchase_id || null,
          ]
        );

        const batch = res.rows[0];

        // Synchronize products current_stock and perishable flag
        await client.query(
          `UPDATE products 
           SET has_expiry = TRUE, current_stock = current_stock + $1, updated_at = NOW() 
           WHERE id = $2`,
          [parsed.quantity, parsed.product_id]
        );

        // Record stock movement (inflow)
        await client.query(
          `INSERT INTO stock_movements (
            product_id, quantity, type, reference_id, reference_type, unit_cost, user_id, notes
           ) VALUES ($1, $2, 'opening', $3, 'batch_manual_entry', $4, $5, $6)`,
          [
            parsed.product_id,
            parsed.quantity,
            batch.id,
            parsed.cost_price,
            request.user!.id,
            `Manual Batch Creation: ${parsed.batch_number}`,
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
    const { reason = 'Disposal of expired/damaged batch' } = (request.body as any) || {};

    try {
      const result = await withTransaction(async (client) => {
        const batchRes = await client.query(
          `SELECT b.*, p.name as product_name, p.current_stock
           FROM product_batches b
           JOIN products p ON p.id = b.product_id
           WHERE b.id = $1 FOR UPDATE OF b, p`,
          [Number(id)]
        );

        if (batchRes.rows.length === 0) {
          throw new Error('Batch not found.');
        }

        const batch = batchRes.rows[0];
        const qtyToDispose = Number(batch.current_quantity);

        if (qtyToDispose <= 0) {
          throw new Error('Batch has no remaining stock to write off.');
        }

        // 1. Deplete batch quantity & deactivate
        await client.query(
          `UPDATE product_batches SET current_quantity = 0, is_active = FALSE, updated_at = NOW() WHERE id = $1`,
          [batch.id]
        );

        // 2. Decrement products.current_stock
        await client.query(
          `UPDATE products SET current_stock = GREATEST(0, current_stock - $1), updated_at = NOW() WHERE id = $2`,
          [qtyToDispose, batch.product_id]
        );

        // 3. Record stock movement (Damage/Loss write-off)
        const moveRes = await client.query(
          `INSERT INTO stock_movements (
            product_id, quantity, type, reference_id, reference_type, unit_cost, user_id, notes
           ) VALUES ($1, $2, 'damage', $3, 'batch_write_off', $4, $5, $6)
           RETURNING *`,
          [
            batch.product_id,
            -qtyToDispose,
            batch.id,
            batch.cost_price,
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
            JSON.stringify({ quantity: qtyToDispose, batch_number: batch.batch_number }),
            JSON.stringify({ quantity: 0, reason, movementId: moveRes.rows[0].id }),
          ]
        );

        return {
          batchId: batch.id,
          batchNumber: batch.batch_number,
          disposedQuantity: qtyToDispose,
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

