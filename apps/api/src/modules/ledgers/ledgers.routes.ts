import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { round2 } from '../../utils/financial.js';

const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  creditLimit: z.number().min(0).default(1000),
  openingBalance: z.number().min(0).default(0),
});

const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(5).optional(),
  email: z.string().email().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  creditLimit: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

const supplierSchema = z.object({
  name: z.string().min(1),
  companyName: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  openingBalance: z.number().min(0).default(0),
});

const updateSupplierSchema = z.object({
  name: z.string().min(1).optional(),
  companyName: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const customerPaymentSchema = z.object({
  customerId: z.number(),
  amount: z.number().positive(),
  paymentMethodId: z.number().default(1),
  notes: z.string().optional().nullable(),
});

const supplierPaymentSchema = z.object({
  supplierId: z.number(),
  amount: z.number().positive(),
  paymentMethodId: z.number().default(1),
  notes: z.string().optional().nullable(),
});

export async function ledgerRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // ==========================================
  // CUSTOMER ROUTES
  // ==========================================

  // GET /api/v1/ledgers/customers - List customers with due balance
  fastify.get('/customers', async (request, reply) => {
    const { search } = request.query as any;

    let sql = `
      SELECT 
        c.id, c.name, c.phone, c.email, c.vat_number, c.credit_limit, c.loyalty_points, c.is_active,
        COALESCE((SELECT balance FROM customer_ledger WHERE customer_id = c.id ORDER BY id DESC LIMIT 1), 0) as current_due
      FROM customers c
      WHERE c.is_active = TRUE
    `;

    const params: any[] = [];
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (c.name ILIKE $1 OR c.phone ILIKE $1)`;
    }

    sql += ` ORDER BY current_due DESC, c.name ASC`;
    const res = await query(sql, params);
    return reply.send({ success: true, data: res.rows });
  });

  // POST /api/v1/ledgers/customers - Create Customer
  fastify.post('/customers', async (request, reply) => {
    const parsed = customerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid customer data.',
        errors: parsed.error.format(),
      });
    }

    const data = parsed.data;

    // Check unique phone if not walk-in
    if (data.phone !== '0000000000') {
      const exist = await query(`SELECT id FROM customers WHERE phone = $1`, [data.phone]);
      if (exist.rows.length > 0) {
        return reply.status(400).send({ success: false, message: 'Phone number already registered.' });
      }
    }

    const customer = await withTransaction(async (client) => {
      const cRes = await client.query(
        `INSERT INTO customers (name, phone, email, vat_number, address, credit_limit, opening_balance)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [data.name, data.phone, data.email || null, data.vatNumber || null, data.address || null, data.creditLimit, data.openingBalance]
      );

      const cust = cRes.rows[0];

      if (data.openingBalance > 0) {
        await client.query(
          `INSERT INTO customer_ledger (customer_id, user_id, type, debit, credit, balance, notes)
           VALUES ($1, $2, 'invoice', $3, 0, $3, 'Opening balance')`,
          [cust.id, request.user!.id, data.openingBalance]
        );
      }

      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
         VALUES ($1, 'CUSTOMER_CREATED', 'customers', $2, $3)`,
        [request.user!.id, cust.id, JSON.stringify({ name: cust.name, phone: cust.phone })]
      );

      return cust;
    });

    return reply.status(201).send({ success: true, message: 'Customer registered.', data: customer });
  });

  // PUT /api/v1/ledgers/customers/:id - Update Customer
  fastify.put('/customers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateCustomerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: 'Invalid customer update.' });
    }

    const curRes = await query(`SELECT * FROM customers WHERE id = $1`, [Number(id)]);
    if (curRes.rows.length === 0) return reply.status(404).send({ success: false, message: 'Customer not found.' });
    const cur = curRes.rows[0];
    const data = parsed.data;

    const res = await query(
      `UPDATE customers SET
        name = $1, phone = $2, email = $3, vat_number = $4, address = $5,
        credit_limit = $6, is_active = $7, updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [
        data.name ?? cur.name,
        data.phone ?? cur.phone,
        data.email !== undefined ? data.email : cur.email,
        data.vatNumber !== undefined ? data.vatNumber : cur.vat_number,
        data.address !== undefined ? data.address : cur.address,
        data.creditLimit ?? cur.credit_limit,
        data.isActive ?? cur.is_active,
        Number(id),
      ]
    );

    return reply.send({ success: true, message: 'Customer updated.', data: res.rows[0] });
  });

  // GET /api/v1/ledgers/customers/:id/statement - Customer Ledger Statement
  fastify.get('/customers/:id/statement', async (request, reply) => {
    const { id } = request.params as { id: string };
    const res = await query(
      `SELECT cl.*, u.full_name as created_by
       FROM customer_ledger cl
       LEFT JOIN users u ON u.id = cl.user_id
       WHERE cl.customer_id = $1
       ORDER BY cl.created_at ASC`,
      [Number(id)]
    );
    return reply.send({ success: true, data: res.rows });
  });

  // POST /api/v1/ledgers/customers/pay - Receive Customer Due Payment
  fastify.post('/customers/pay', async (request, reply) => {
    const parsed = customerPaymentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: 'Invalid payment data.' });
    }

    const { customerId, amount, paymentMethodId, notes } = parsed.data;

    try {
      const result = await withTransaction(async (client) => {
        const balRes = await client.query(
          `SELECT COALESCE(balance, 0) as last_bal FROM customer_ledger 
           WHERE customer_id = $1 ORDER BY id DESC LIMIT 1`,
          [customerId]
        );
        const lastBal = Number(balRes.rows[0]?.last_bal || 0);
        const newBal = round2(lastBal - amount);

        // 1. Insert into customer_ledger (Credit)
        const ledRes = await client.query(
          `INSERT INTO customer_ledger (customer_id, user_id, type, debit, credit, balance, notes)
           VALUES ($1, $2, 'payment', 0, $3, $4, $5) RETURNING *`,
          [customerId, request.user!.id, amount, newBal, notes || 'Customer Due Collection']
        );

        // 2. If Cash, update active cash session
        const isCashRes = await client.query(`SELECT is_cash FROM payment_methods WHERE id = $1`, [paymentMethodId]);
        if (isCashRes.rows[0]?.is_cash) {
          const sessionRes = await client.query(
            `SELECT id FROM cash_sessions WHERE user_id = $1 AND status = 'open' LIMIT 1`,
            [request.user!.id]
          );
          if (sessionRes.rows.length > 0) {
            await client.query(
              `INSERT INTO cash_movements (session_id, type, amount, source, reference_id, description)
               VALUES ($1, 'cash_in', $2, 'sale', $3, $4)`,
              [sessionRes.rows[0].id, amount, customerId, `Due Payment Collection`]
            );
          }
        }

        // 3. Audit Log
        await client.query(
          `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
           VALUES ($1, 'CUSTOMER_DUE_COLLECTED', 'customer_ledger', $2, $3)`,
          [request.user!.id, customerId, JSON.stringify({ amount, newBalance: newBal, notes })]
        );

        return { ledgerEntry: ledRes.rows[0], newBalance: newBal };
      });

      return reply.status(201).send({
        success: true,
        message: 'Customer payment received and balance updated.',
        data: result,
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });

  // ==========================================
  // SUPPLIER ROUTES
  // ==========================================

  // GET /api/v1/ledgers/suppliers - List suppliers with payables
  fastify.get('/suppliers', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const { search } = request.query as any;

    let sql = `
      SELECT 
        s.id, s.name, s.company_name, s.phone, s.email, s.vat_number, s.address, s.is_active,
        COALESCE((SELECT balance FROM supplier_ledger WHERE supplier_id = s.id ORDER BY id DESC LIMIT 1), 0) as current_payable
      FROM suppliers s
      WHERE s.is_active = TRUE
    `;

    const params: any[] = [];
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (s.name ILIKE $1 OR s.company_name ILIKE $1 OR s.phone ILIKE $1)`;
    }

    sql += ` ORDER BY current_payable DESC, s.name ASC`;
    const res = await query(sql, params);
    return reply.send({ success: true, data: res.rows });
  });

  // POST /api/v1/ledgers/suppliers - Create Supplier (Manager only)
  fastify.post('/suppliers', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const parsed = supplierSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid supplier data.',
        errors: parsed.error.format(),
      });
    }

    const data = parsed.data;

    const supplier = await withTransaction(async (client) => {
      const sRes = await client.query(
        `INSERT INTO suppliers (name, company_name, vat_number, email, phone, address, opening_balance)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [data.name, data.companyName || null, data.vatNumber || null, data.email || null, data.phone || null, data.address || null, data.openingBalance]
      );

      const sup = sRes.rows[0];

      if (data.openingBalance > 0) {
        await client.query(
          `INSERT INTO supplier_ledger (supplier_id, user_id, type, debit, credit, balance, notes)
           VALUES ($1, $2, 'bill', 0, $3, $3, 'Opening balance payable')`,
          [sup.id, request.user!.id, data.openingBalance]
        );
      }

      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
         VALUES ($1, 'SUPPLIER_CREATED', 'suppliers', $2, $3)`,
        [request.user!.id, sup.id, JSON.stringify({ name: sup.name, companyName: sup.company_name })]
      );

      return sup;
    });

    return reply.status(201).send({ success: true, message: 'Supplier profile created.', data: supplier });
  });

  // PUT /api/v1/ledgers/suppliers/:id - Update Supplier (Manager only)
  fastify.put('/suppliers/:id', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateSupplierSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: 'Invalid supplier update.' });
    }

    const curRes = await query(`SELECT * FROM suppliers WHERE id = $1`, [Number(id)]);
    if (curRes.rows.length === 0) return reply.status(404).send({ success: false, message: 'Supplier not found.' });
    const cur = curRes.rows[0];
    const data = parsed.data;

    const res = await query(
      `UPDATE suppliers SET
        name = $1, company_name = $2, vat_number = $3, email = $4, phone = $5,
        address = $6, is_active = $7, updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [
        data.name ?? cur.name,
        data.companyName !== undefined ? data.companyName : cur.company_name,
        data.vatNumber !== undefined ? data.vatNumber : cur.vat_number,
        data.email !== undefined ? data.email : cur.email,
        data.phone !== undefined ? data.phone : cur.phone,
        data.address !== undefined ? data.address : cur.address,
        data.isActive ?? cur.is_active,
        Number(id),
      ]
    );

    return reply.send({ success: true, message: 'Supplier updated.', data: res.rows[0] });
  });

  // GET /api/v1/ledgers/suppliers/:id/statement - Supplier Ledger Statement (Manager only)
  fastify.get('/suppliers/:id/statement', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const res = await query(
      `SELECT sl.*, u.full_name as created_by
       FROM supplier_ledger sl
       LEFT JOIN users u ON u.id = sl.user_id
       WHERE sl.supplier_id = $1
       ORDER BY sl.created_at ASC`,
      [Number(id)]
    );
    return reply.send({ success: true, data: res.rows });
  });

  // POST /api/v1/ledgers/suppliers/pay - Pay Supplier Bill (Manager only)
  fastify.post('/suppliers/pay', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const parsed = supplierPaymentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: 'Invalid payment data.' });
    }

    const { supplierId, amount, paymentMethodId, notes } = parsed.data;

    try {
      const result = await withTransaction(async (client) => {
        const balRes = await client.query(
          `SELECT COALESCE(balance, 0) as last_bal FROM supplier_ledger 
           WHERE supplier_id = $1 ORDER BY id DESC LIMIT 1`,
          [supplierId]
        );
        const lastBal = Number(balRes.rows[0]?.last_bal || 0);
        const newBal = round2(lastBal - amount);

        // 1. Insert into supplier_ledger (Debit)
        const ledRes = await client.query(
          `INSERT INTO supplier_ledger (supplier_id, user_id, type, debit, credit, balance, notes)
           VALUES ($1, $2, 'payment', $3, 0, $4, $5) RETURNING *`,
          [supplierId, request.user!.id, amount, newBal, notes || 'Supplier Bill Payment']
        );

        // 2. If Cash, update active cash session (outflow)
        const isCashRes = await client.query(`SELECT is_cash FROM payment_methods WHERE id = $1`, [paymentMethodId]);
        if (isCashRes.rows[0]?.is_cash) {
          const sessionRes = await client.query(
            `SELECT id FROM cash_sessions WHERE user_id = $1 AND status = 'open' LIMIT 1`,
            [request.user!.id]
          );
          if (sessionRes.rows.length > 0) {
            await client.query(
              `INSERT INTO cash_movements (session_id, type, amount, source, reference_id, description)
               VALUES ($1, 'cash_out', $2, 'manual_withdrawal', $3, $4)`,
              [sessionRes.rows[0].id, amount, supplierId, `Supplier Bill Payment: ${notes || ''}`]
            );
          }
        }

        // 3. Audit Log
        await client.query(
          `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
           VALUES ($1, 'SUPPLIER_BILL_PAID', 'supplier_ledger', $2, $3)`,
          [request.user!.id, supplierId, JSON.stringify({ amount, newBalance: newBal, notes })]
        );

        return { ledgerEntry: ledRes.rows[0], newBalance: newBal };
      });

      return reply.status(201).send({
        success: true,
        message: 'Supplier payment recorded and balance updated.',
        data: result,
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });
}
