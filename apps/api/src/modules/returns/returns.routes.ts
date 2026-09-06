import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { authenticate } from '../../middleware/auth.js';
import { round2 } from '../../utils/financial.js';

const returnItemSchema = z.object({
  saleItemId: z.coerce.number(),
  productId: z.coerce.number(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().positive(),
  taxAmount: z.coerce.number().min(0),
  subtotal: z.coerce.number().positive(),
  restocked: z.boolean().default(true),
});

const createSalesReturnSchema = z.object({
  saleId: z.coerce.number(),
  refundMethodId: z.coerce.number().default(1),
  reason: z.string().min(3),
  items: z.array(returnItemSchema).min(1),
  managerPin: z.string().optional().nullable(),
});

export async function returnRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // POST /api/v1/returns/sales - Process customer sales return
  fastify.post('/sales', async (request, reply) => {
    const parsed = createSalesReturnSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid return data.',
        errors: parsed.error.format(),
      });
    }

    const { saleId, refundMethodId, reason, items, managerPin } = parsed.data;
    const isManager = request.user!.role === 'manager';

    // If Sales Executive, verify Manager PIN
    if (!isManager) {
      if (!managerPin) {
        return reply.status(403).send({ success: false, message: 'Manager PIN authorization is required for returns.' });
      }
      const candidates = await query(
        `SELECT id, pin_code FROM users WHERE role = 'manager' AND pin_code IS NOT NULL AND is_active = TRUE`
      );
      let authorized = false;
      for (const mgr of candidates.rows) {
        if (!mgr.pin_code) continue;
        const isHashed = mgr.pin_code.startsWith('$2');
        const match = isHashed ? await bcrypt.compare(managerPin, mgr.pin_code) : mgr.pin_code === managerPin;
        if (match) {
          authorized = true;
          break;
        }
      }
      if (!authorized) {
        return reply.status(401).send({ success: false, message: 'Invalid Manager PIN code.' });
      }
    }

    try {
      const result = await withTransaction(async (client) => {
        // Fetch original sale
        const saleRes = await client.query(`SELECT id, reference_no, customer_id, due_amount FROM sales WHERE id = $1`, [saleId]);
        if (saleRes.rows.length === 0) throw new Error('Original sale not found.');

        const sale = saleRes.rows[0];
        const customerId = sale.customer_id;
        const totalAmount = round2(items.reduce((sum, i) => sum + i.subtotal, 0));
        const totalTax = round2(items.reduce((sum, i) => sum + i.taxAmount, 0));
        const ref = `RET-${Date.now()}`;

        // 1. Insert into sales_returns
        const retRes = await client.query(
          `INSERT INTO sales_returns (reference_no, sale_id, customer_id, user_id, total_amount, tax_amount, refund_method_id, reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [ref, saleId, customerId, request.user!.id, totalAmount, totalTax, refundMethodId, reason]
        );
        const retId = retRes.rows[0].id;

        // 2. Insert items & handle inventory restock
        for (const item of items) {
          await client.query(
            `INSERT INTO sales_return_items (return_id, sale_item_id, product_id, quantity, unit_price, tax_amount, subtotal, restocked)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [retId, item.saleItemId, item.productId, item.quantity, item.unitPrice, item.taxAmount, item.subtotal, item.restocked]
          );

          if (item.restocked) {
            // Restore inventory (Inflow) & increment products.current_stock
            await client.query(
              `UPDATE products SET current_stock = current_stock + $1, updated_at = NOW() WHERE id = $2`,
              [item.quantity, item.productId]
            );

            const prodRes = await client.query(`SELECT cost_price FROM products WHERE id = $1`, [item.productId]);
            const cost = prodRes.rows[0]?.cost_price || 0;

            await client.query(
              `INSERT INTO stock_movements (product_id, quantity, type, reference_id, reference_type, unit_cost, user_id, notes)
               VALUES ($1, $2, 'return_in', $3, 'sales_return', $4, $5, $6)`,
              [item.productId, item.quantity, retId, cost, request.user!.id, `Sales Return: ${ref}`]
            );
          } else {
            // Log as damaged
            await client.query(
              `INSERT INTO stock_movements (product_id, quantity, type, reference_id, reference_type, unit_cost, user_id, notes)
               VALUES ($1, 0, 'damage', $2, 'sales_return_damage', 0, $3, $4)`,
              [item.productId, retId, request.user!.id, `Damaged Return (Written-off): ${ref}`]
            );
          }
        }

        // 3. Deduct from active cash session if refunded in cash
        const isCashRes = await client.query(`SELECT is_cash FROM payment_methods WHERE id = $1`, [refundMethodId]);
        if (isCashRes.rows[0]?.is_cash) {
          const sessionRes = await client.query(
            `SELECT id FROM cash_sessions WHERE user_id = $1 AND status = 'open' LIMIT 1`,
            [request.user!.id]
          );
          if (sessionRes.rows.length > 0) {
            await client.query(
              `INSERT INTO cash_movements (session_id, type, amount, source, reference_id, description)
               VALUES ($1, 'cash_out', $2, 'refund', $3, $4)`,
              [sessionRes.rows[0].id, totalAmount, retId, `Cash Refund for Return ${ref}`]
            );
          }
        }

        // 4. Audit Log
        await client.query(
          `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
           VALUES ($1, 'SALES_RETURN_PROCESSED', 'sales_returns', $2, $3)`,
          [request.user!.id, retId, JSON.stringify({ referenceNo: ref, totalAmount, originalSaleRef: sale.reference_no, reason })]
        );

        return retRes.rows[0];
      });

      return reply.status(201).send({
        success: true,
        message: 'Sales return processed and inventory adjusted.',
        data: result,
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });

  // GET /api/v1/returns/sales - List sales returns
  fastify.get('/sales', async (request, reply) => {
    const res = await query(
      `SELECT sr.*, s.reference_no as sale_ref, u.full_name as user_name, pm.name as refund_method,
              c.name as customer_name
       FROM sales_returns sr
       JOIN sales s ON s.id = sr.sale_id
       JOIN users u ON u.id = sr.user_id
       LEFT JOIN customers c ON c.id = sr.customer_id
       JOIN payment_methods pm ON pm.id = sr.refund_method_id
       ORDER BY sr.created_at DESC LIMIT 100`
    );
    return reply.send({ success: true, data: res.rows });
  });

  // GET /api/v1/returns/sales/:id - Details of a sales return
  fastify.get('/sales/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const retRes = await query(
      `SELECT sr.*, s.reference_no as sale_ref, u.full_name as user_name, pm.name as refund_method,
              c.name as customer_name
       FROM sales_returns sr
       JOIN sales s ON s.id = sr.sale_id
       JOIN users u ON u.id = sr.user_id
       LEFT JOIN customers c ON c.id = sr.customer_id
       JOIN payment_methods pm ON pm.id = sr.refund_method_id
       WHERE sr.id = $1`,
      [Number(id)]
    );

    if (retRes.rows.length === 0) return reply.status(404).send({ success: false, message: 'Return not found.' });

    const itemsRes = await query(
      `SELECT sri.*, p.name as product_name, p.sku
       FROM sales_return_items sri
       JOIN products p ON p.id = sri.product_id
       WHERE sri.return_id = $1`,
      [Number(id)]
    );

    return reply.send({
      success: true,
      data: {
        returnRecord: retRes.rows[0],
        items: itemsRes.rows,
      },
    });
  });
}
