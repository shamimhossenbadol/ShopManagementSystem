import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';

const taxRateSchema = z.object({
  name: z.string().min(1, 'Tax rate name is required'),
  rate: z.coerce.number().min(0).max(100),
  is_active: z.boolean().default(true),
  is_default: z.boolean().default(false),
});

export async function settingsRoutes(fastify: FastifyInstance) {
  // GET /api/v1/settings - Get settings map (grouped or flat)
  fastify.get('/', async (request, reply) => {
    const res = await query(
      `SELECT setting_key, setting_group, setting_value, description, is_public FROM settings ORDER BY setting_group, setting_key`
    );
    const settingsMap: Record<string, string> = {};
    const groupedMap: Record<string, Record<string, string>> = {};

    for (const row of res.rows) {
      settingsMap[row.setting_key] = row.setting_value;
      if (!groupedMap[row.setting_group]) {
        groupedMap[row.setting_group] = {};
      }
      groupedMap[row.setting_group][row.setting_key] = row.setting_value;
    }
    return reply.send({ success: true, data: settingsMap, grouped: groupedMap });
  });

  // PUT /api/v1/settings - Batch update settings (Manager only)
  fastify.put('/', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const updates = request.body as Record<string, any>;

    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined && val !== null) {
        await query(
          `INSERT INTO settings (setting_key, setting_value, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_at = NOW()`,
          [key, String(val)]
        );
      }
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
       VALUES ($1, 'SETTINGS_UPDATED', 'settings', 1, $2)`,
      [request.user!.id, JSON.stringify(updates)]
    );

    return reply.send({ success: true, message: 'Settings updated successfully.' });
  });

  // PUT /api/v1/settings/group/:group - Update by setting group
  fastify.put('/group/:group', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const { group } = request.params as { group: string };
    const updates = request.body as Record<string, any>;

    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined && val !== null) {
        await query(
          `INSERT INTO settings (setting_key, setting_group, setting_value, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (setting_key) DO UPDATE SET setting_value = $3, setting_group = $2, updated_at = NOW()`,
          [key, group, String(val)]
        );
      }
    }

    return reply.send({ success: true, message: `Group '${group}' settings updated.` });
  });

  // --- DYNAMIC TAX RATES CRUD ---

  // GET /api/v1/settings/tax-rates
  fastify.get('/tax-rates', async (request, reply) => {
    const res = await query(`SELECT * FROM tax_rates ORDER BY id ASC`);
    return reply.send({ success: true, data: res.rows });
  });

  // POST /api/v1/settings/tax-rates (Manager only)
  fastify.post('/tax-rates', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const parsed = taxRateSchema.parse(request.body);

    if (parsed.is_default) {
      await query(`UPDATE tax_rates SET is_default = FALSE`);
    }

    const res = await query(
      `INSERT INTO tax_rates (name, rate, is_active, is_default)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [parsed.name, parsed.rate, parsed.is_active, parsed.is_default]
    );

    return reply.status(201).send({ success: true, data: res.rows[0] });
  });

  // PUT /api/v1/settings/tax-rates/:id (Manager only)
  fastify.put('/tax-rates/:id', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = taxRateSchema.partial().parse(request.body);

    if (parsed.is_default) {
      await query(`UPDATE tax_rates SET is_default = FALSE WHERE id != $1`, [Number(id)]);
    }

    const current = await query(`SELECT * FROM tax_rates WHERE id = $1`, [Number(id)]);
    if (current.rows.length === 0) {
      return reply.status(404).send({ success: false, message: 'Tax rate not found' });
    }

    const updated = {
      name: parsed.name ?? current.rows[0].name,
      rate: parsed.rate ?? current.rows[0].rate,
      is_active: parsed.is_active ?? current.rows[0].is_active,
      is_default: parsed.is_default ?? current.rows[0].is_default,
    };

    const res = await query(
      `UPDATE tax_rates
       SET name = $1, rate = $2, is_active = $3, is_default = $4
       WHERE id = $5
       RETURNING *`,
      [updated.name, updated.rate, updated.is_active, updated.is_default, Number(id)]
    );

    return reply.send({ success: true, data: res.rows[0] });
  });

  // GET /api/v1/settings/audit-logs - Manager audit trail
  fastify.get('/audit-logs', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const { action, user_id, start_date, end_date } = request.query as any;

    let sql = `
      SELECT a.*, u.full_name as user_name, u.username, u.role as user_role
      FROM audit_logs a
      JOIN users u ON u.id = a.user_id
      WHERE 1=1
    `;

    const params: any[] = [];
    if (action) {
      params.push(`%${action}%`);
      sql += ` AND a.action ILIKE $${params.length}`;
    }
    if (user_id) {
      params.push(Number(user_id));
      sql += ` AND a.user_id = $${params.length}`;
    }
    if (start_date) {
      params.push(start_date);
      sql += ` AND a.created_at >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date);
      sql += ` AND a.created_at <= $${params.length}`;
    }

    sql += ` ORDER BY a.created_at DESC LIMIT 200`;
    const res = await query(sql, params);
    return reply.send({ success: true, data: res.rows });
  });

  // POST /api/v1/settings/seed-demo - Feed realistic supermarket dummy products, suppliers, customers, and batches
  fastify.post('/seed-demo', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    try {
      const { runDemoSeed } = await import('../../scripts/seed_demo.js');
      await runDemoSeed();

      await query(
        `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
         VALUES ($1, 'DEMO_DATASET_SEEDED', 'system', 1, $2)`,
        [request.user!.id, JSON.stringify({ message: 'Realistic supermarket demo products, suppliers, customers, and batches seeded.' })]
      );

      return reply.send({
        success: true,
        message: 'Successfully seeded 37+ realistic products, 7 major suppliers, 6 customers, 8 batches, and promotions!',
      });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        success: false,
        message: `Failed to seed demo data: ${err.message}`,
      });
    }
  });

  // POST /api/v1/settings/reset-database - Remove all transactional data and users except manager
  fastify.post('/reset-database', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    try {
      await query(`
        TRUNCATE TABLE 
            sales_return_items,
            sales_returns,
            purchase_return_items,
            purchase_returns,
            held_sale_items,
            held_sales,
            sale_payments,
            sale_items,
            invoices,
            sales,
            purchase_payments,
            purchase_items,
            purchases,
            stock_adjustments,
            stock_movements,
            session_adjustments,
            cash_movements,
            cash_sessions,
            product_batches,
            product_images,
            promotion_rules,
            promotions,
            products,
            brands,
            suppliers,
            expenses,
            customer_ledger,
            supplier_ledger,
            audit_logs,
            notifications,
            backup_logs
        CASCADE;

        DELETE FROM customers WHERE id != 1;
        DELETE FROM users WHERE role != 'manager';

        INSERT INTO users (id, role, username, email, password_hash, full_name, phone, pin_code, is_active) VALUES
        (1, 'manager', 'admin', 'manager@alnoorshop.com', '$2b$10$M2nH3FzA144Zi1/O0LErb.5evVVJj11reUN1yFO2aARRwQLCKFZtu', 'Shamim Hossen (Manager)', '+966501234567', '12345', TRUE)
        ON CONFLICT (id) DO UPDATE SET 
            role = 'manager',
            is_active = TRUE,
            current_session_id = NULL,
            current_pos_session_id = NULL;

        SELECT setval('products_id_seq', 1, false);
        SELECT setval('sales_id_seq', 1, false);
        SELECT setval('purchases_id_seq', 1, false);
        SELECT setval('suppliers_id_seq', 1, false);
        SELECT setval('cash_sessions_id_seq', 1, false);
        SELECT setval('customers_id_seq', 1, true);
      `);

      return reply.send({
        success: true,
        message: 'All transactional data, products, suppliers, customers, and non-manager users have been removed.',
      });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        success: false,
        message: `Failed to reset database: ${err.message}`,
      });
    }
  });
}
