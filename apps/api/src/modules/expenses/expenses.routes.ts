import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';

const expenseSchema = z.object({
  categoryId: z.number(),
  amount: z.number().positive(),
  taxAmount: z.number().min(0).default(0),
  date: z.string(),
  paymentMethodId: z.number().default(1),
  note: z.string().optional().nullable(),
});

const categorySchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
});

export async function expenseRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/v1/expenses - List expenses
  fastify.get('/', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const { start_date, end_date, category_id } = request.query as any;

    let sql = `
      SELECT 
        e.*, ec.name as category_name, pm.name as payment_method, u.full_name as created_by
      FROM expenses e
      JOIN expense_categories ec ON ec.id = e.category_id
      JOIN payment_methods pm ON pm.id = e.payment_method_id
      JOIN users u ON u.id = e.user_id
      WHERE 1=1
    `;

    const params: any[] = [];
    if (start_date) {
      params.push(start_date);
      sql += ` AND e.date >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date);
      sql += ` AND e.date <= $${params.length}`;
    }
    if (category_id) {
      params.push(Number(category_id));
      sql += ` AND e.category_id = $${params.length}`;
    }

    sql += ` ORDER BY e.date DESC, e.created_at DESC LIMIT 200`;
    const res = await query(sql, params);
    return reply.send({ success: true, data: res.rows });
  });

  // POST /api/v1/expenses - Add Expense
  fastify.post('/', async (request, reply) => {
    const parsed = expenseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: 'Invalid expense data.' });
    }

    const { categoryId, amount, taxAmount, date, paymentMethodId, note } = parsed.data;
    const ref = `EXP-${Date.now()}`;

    try {
      const expense = await withTransaction(async (client) => {
        const res = await client.query(
          `INSERT INTO expenses (reference_no, category_id, user_id, amount, tax_amount, date, payment_method_id, note)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [ref, categoryId, request.user!.id, amount, taxAmount, date, paymentMethodId, note || null]
        );
        const exp = res.rows[0];

        // If Cash, update active cash session
        const isCashRes = await client.query(`SELECT is_cash FROM payment_methods WHERE id = $1`, [paymentMethodId]);
        if (isCashRes.rows[0]?.is_cash) {
          const sessionRes = await client.query(
            `SELECT id FROM cash_sessions WHERE user_id = $1 AND status = 'open' LIMIT 1`,
            [request.user!.id]
          );
          if (sessionRes.rows.length > 0) {
            await client.query(
              `INSERT INTO cash_movements (session_id, type, amount, source, reference_id, description)
               VALUES ($1, 'cash_out', $2, 'expense', $3, $4)`,
              [sessionRes.rows[0].id, amount, exp.id, `Expense: ${note || ref}`]
            );
          }
        }

        // Audit Log
        await client.query(
          `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
           VALUES ($1, 'EXPENSE_RECORDED', 'expenses', $2, $3)`,
          [request.user!.id, exp.id, JSON.stringify({ referenceNo: ref, amount, categoryId, note })]
        );

        return exp;
      });

      return reply.status(201).send({ success: true, message: 'Expense recorded.', data: expense });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });

  // GET /api/v1/expenses/categories
  fastify.get('/categories', async (request, reply) => {
    const res = await query(
      `SELECT ec.*, COUNT(e.id) as expense_count, COALESCE(SUM(e.amount), 0) as total_spent
       FROM expense_categories ec
       LEFT JOIN expenses e ON e.category_id = ec.id
       WHERE ec.is_active = TRUE
       GROUP BY ec.id ORDER BY ec.name ASC`
    );
    return reply.send({ success: true, data: res.rows });
  });

  // POST /api/v1/expenses/categories (Manager only)
  fastify.post('/categories', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const parsed = categorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: 'Category name required.' });
    }

    const res = await query(
      `INSERT INTO expense_categories (name, description) VALUES ($1, $2) RETURNING *`,
      [parsed.data.name, parsed.data.description || null]
    );

    return reply.status(201).send({ success: true, message: 'Category created.', data: res.rows[0] });
  });
}
