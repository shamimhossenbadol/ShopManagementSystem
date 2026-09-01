import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';

const promoCreateSchema = z.object({
  name: z.string().min(1, 'Promotion name is required'),
  type: z.enum(['buy_x_get_y', 'bundle_price', 'percentage_discount', 'fixed_discount']),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  is_active: z.boolean().default(true),
  rules: z.array(
    z.object({
      buy_product_id: z.coerce.number().int().optional(),
      buy_quantity: z.coerce.number().min(1).default(1),
      get_product_id: z.coerce.number().int().optional(),
      get_quantity: z.coerce.number().min(0).default(0),
      bundle_price: z.coerce.number().min(0).optional(),
      discount_percentage: z.coerce.number().min(0).max(100).optional(),
      discount_amount: z.coerce.number().min(0).optional(),
    })
  ).min(1, 'At least one rule is required'),
});

export async function promotionRoutes(fastify: FastifyInstance) {
  // GET /api/v1/promotions - List all active/current promotions
  fastify.get('/', async (request, reply) => {
    const promoRes = await query(
      `SELECT * FROM promotions ORDER BY is_active DESC, created_at DESC`
    );

    const promotions = promoRes.rows;
    for (const promo of promotions) {
      const rulesRes = await query(
        `SELECT r.*, 
                bp.name as buy_product_name, bp.sku as buy_product_sku,
                gp.name as get_product_name, gp.sku as get_product_sku
         FROM promotion_rules r
         LEFT JOIN products bp ON bp.id = r.buy_product_id
         LEFT JOIN products gp ON gp.id = r.get_product_id
         WHERE r.promotion_id = $1`,
        [promo.id]
      );
      promo.rules = rulesRes.rows;
    }

    return reply.send({ success: true, data: promotions });
  });

  // POST /api/v1/promotions - Create new promotion (Manager only)
  fastify.post('/', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const parsed = promoCreateSchema.parse(request.body);

    const promoInsert = await query(
      `INSERT INTO promotions (name, type, start_date, end_date, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [parsed.name, parsed.type, parsed.start_date, parsed.end_date, parsed.is_active]
    );
    const promotion = promoInsert.rows[0];

    for (const rule of parsed.rules) {
      await query(
        `INSERT INTO promotion_rules (promotion_id, buy_product_id, buy_quantity, get_product_id, get_quantity, bundle_price, discount_percentage, discount_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          promotion.id,
          rule.buy_product_id || null,
          rule.buy_quantity,
          rule.get_product_id || null,
          rule.get_quantity,
          rule.bundle_price || null,
          rule.discount_percentage || null,
          rule.discount_amount || null,
        ]
      );
    }

    return reply.status(201).send({ success: true, data: promotion });
  });

  // PUT /api/v1/promotions/:id - Toggle or update promotion status
  fastify.put('/:id', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { is_active } = request.body as { is_active: boolean };

    const res = await query(
      `UPDATE promotions SET is_active = $1 WHERE id = $2 RETURNING *`,
      [is_active, Number(id)]
    );

    if (res.rows.length === 0) {
      return reply.status(404).send({ success: false, message: 'Promotion not found' });
    }

    return reply.send({ success: true, data: res.rows[0] });
  });

  // DELETE /api/v1/promotions/:id (Manager only)
  fastify.delete('/:id', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await query(`DELETE FROM promotions WHERE id = $1`, [Number(id)]);
    return reply.send({ success: true, message: 'Promotion deleted successfully' });
  });
}
