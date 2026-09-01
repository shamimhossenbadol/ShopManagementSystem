import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';

const batchCreateSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  batch_number: z.string().min(1, 'Batch number is required'),
  expiry_date: z.string().min(1, 'Expiry date is required'),
  cost_price: z.coerce.number().min(0).default(0),
  quantity: z.coerce.number().min(0.01),
});

export async function batchRoutes(fastify: FastifyInstance) {
  // GET /api/v1/batches - List all active batches with optional product_id filter
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const { product_id, status } = request.query as any;

    let sql = `
      SELECT b.*, p.name as product_name, p.sku, p.barcode,
             ROUND(b.expiry_date - CURRENT_DATE) as days_to_expiry
      FROM product_batches b
      JOIN products p ON p.id = b.product_id
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
              ROUND(b.expiry_date - CURRENT_DATE) as days_to_expiry
       FROM product_batches b
       JOIN products p ON p.id = b.product_id
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

  // POST /api/v1/batches - Manual Batch creation / entry (Manager only)
  fastify.post('/', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const parsed = batchCreateSchema.parse(request.body);

    const res = await query(
      `INSERT INTO product_batches (product_id, batch_number, expiry_date, cost_price, initial_quantity, current_quantity)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING *`,
      [parsed.product_id, parsed.batch_number, parsed.expiry_date, parsed.cost_price, parsed.quantity]
    );

    // Update product perishable flag if not already set
    await query(`UPDATE products SET has_expiry = TRUE WHERE id = $1`, [parsed.product_id]);

    return reply.status(201).send({ success: true, data: res.rows[0] });
  });
}
