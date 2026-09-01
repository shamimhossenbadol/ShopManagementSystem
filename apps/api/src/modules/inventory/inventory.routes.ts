import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';

const adjustStockSchema = z.object({
  productId: z.coerce.number(),
  type: z.enum(['addition', 'subtraction']),
  quantity: z.coerce.number().positive(),
  reason: z.string().min(3),
  notes: z.string().optional().nullable(),
});

export async function inventoryRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/v1/inventory/stock - All stock levels
  fastify.get('/stock', async (request, reply) => {
    const isManager = request.user!.role === 'manager';
    const { status, category_id } = request.query as any;

    let sql = `
      SELECT 
        p.id, p.sku, p.barcode, p.plu_code, p.name,
        p.category_id, c.name as category_name,
        p.unit_id, u.name as unit_name, u.short_name as unit_short,
        ${isManager ? 'p.cost_price,' : ''}
        p.selling_price,
        p.min_stock_level,
        p.current_stock,
        p.has_expiry,
        p.is_weighable,
        ${isManager ? 'p.current_stock * p.cost_price as stock_valuation,' : ''}
        CASE 
          WHEN p.current_stock <= 0 THEN 'out_of_stock'
          WHEN p.current_stock <= p.min_stock_level THEN 'low_stock'
          ELSE 'in_stock'
        END as stock_status
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN units u ON p.unit_id = u.id
       WHERE p.is_active = TRUE AND p.is_deleted = FALSE
    `;

    const params: any[] = [];
    if (category_id) {
      params.push(Number(category_id));
      sql += ` AND p.category_id = $${params.length}`;
    }

    if (status === 'low_stock') {
      sql += ` AND p.current_stock > 0 AND p.current_stock <= p.min_stock_level`;
    } else if (status === 'out_of_stock') {
      sql += ` AND p.current_stock <= 0`;
    }

    sql += ` ORDER BY p.current_stock ASC, p.name ASC`;

    const res = await query(sql, params);
    return reply.send({ success: true, data: res.rows });
  });

  // GET /api/v1/inventory/stock-snapshot - Delta sync for reconnected POS terminals
  fastify.get('/stock-snapshot', async (request, reply) => {
    const { since } = request.query as any;
    let sql = `
      SELECT id, sku, barcode, current_stock, selling_price, is_active, updated_at
      FROM products
      WHERE is_deleted = FALSE
    `;
    const params: any[] = [];
    if (since) {
      params.push(since);
      sql += ` AND updated_at >= $1`;
    }

    const res = await query(sql, params);
    return reply.send({
      success: true,
      timestamp: new Date().toISOString(),
      deltaCount: res.rows.length,
      data: res.rows,
    });
  });

  // GET /api/v1/inventory/movements - Recent movement history
  fastify.get('/movements', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const { product_id, type, limit = 100 } = request.query as any;

    let sql = `
      SELECT sm.*, p.name as product_name, p.sku, u.full_name as user_name
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      LEFT JOIN users u ON u.id = sm.user_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (product_id) {
      params.push(Number(product_id));
      sql += ` AND sm.product_id = $${params.length}`;
    }
    if (type) {
      params.push(type);
      sql += ` AND sm.type = $${params.length}`;
    }

    params.push(Number(limit));
    sql += ` ORDER BY sm.created_at DESC LIMIT $${params.length}`;

    const res = await query(sql, params);
    return reply.send({ success: true, data: res.rows });
  });

  // GET /api/v1/inventory/movements/:productId - History for specific product
  fastify.get('/movements/:productId', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const { productId } = request.params as { productId: string };

    const res = await query(
      `SELECT 
        sm.id, sm.quantity, sm.type, sm.reference_type, sm.unit_cost, sm.notes, sm.created_at,
        u.full_name as user_name
       FROM stock_movements sm
       LEFT JOIN users u ON sm.user_id = u.id
       WHERE sm.product_id = $1
       ORDER BY sm.created_at DESC LIMIT 100`,
      [Number(productId)]
    );

    return reply.send({ success: true, data: res.rows });
  });

  // POST /api/v1/inventory/adjust - Manual adjustment with audit trail (Manager only)
  fastify.post('/adjust', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const parsed = adjustStockSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid adjustment data.',
        errors: parsed.error.format(),
      });
    }

    const { productId, type, quantity, reason, notes } = parsed.data;

    try {
      const result = await withTransaction(async (client) => {
        // 1. Get current stock with row lock
        const prodRes = await client.query(
          `SELECT id, name, cost_price, current_stock
           FROM products WHERE id = $1 FOR UPDATE`,
          [productId]
        );

        if (prodRes.rows.length === 0) {
          throw new Error('Product not found.');
        }

        const product = prodRes.rows[0];
        const beforeQty = Number(product.current_stock);
        const delta = type === 'addition' ? quantity : -quantity;
        const afterQty = beforeQty + delta;

        if (afterQty < 0) {
          throw new Error(`Cannot subtract ${quantity}. Current stock is only ${beforeQty}.`);
        }

        const referenceNo = `ADJ-${Date.now()}`;

        // 2. Insert stock adjustment log
        const adjRes = await client.query(
          `INSERT INTO stock_adjustments (
            reference_no, user_id, product_id, type, quantity, before_quantity, after_quantity, reason, notes
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [referenceNo, request.user!.id, productId, type, quantity, beforeQty, afterQty, reason, notes || null]
        );

        // 3. Update products.current_stock
        await client.query(
          `UPDATE products SET current_stock = $1, updated_at = NOW() WHERE id = $2`,
          [afterQty, productId]
        );

        // 4. Insert into stock_movements ledger
        await client.query(
          `INSERT INTO stock_movements (
            product_id, quantity, type, reference_id, reference_type, unit_cost, user_id, notes
           ) VALUES ($1, $2, 'adjustment', $3, 'stock_adjustment', $4, $5, $6)`,
          [productId, delta, adjRes.rows[0].id, product.cost_price, request.user!.id, `Adjustment: ${reason}`]
        );

        // 5. Record in audit_logs
        await client.query(
          `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, old_values, new_values)
           VALUES ($1, 'STOCK_ADJUSTMENT', 'products', $2, $3, $4)`,
          [
            request.user!.id,
            productId,
            JSON.stringify({ stock: beforeQty }),
            JSON.stringify({ stock: afterQty, reason, adjustmentId: adjRes.rows[0].id }),
          ]
        );

        return {
          adjustment: adjRes.rows[0],
          newStock: afterQty,
        };
      });

      return reply.status(201).send({
        success: true,
        message: 'Stock adjusted successfully.',
        data: result,
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });
}
