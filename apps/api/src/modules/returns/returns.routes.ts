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

const purchaseReturnItemSchema = z.object({
  purchaseItemId: z.coerce.number(),
  productId: z.coerce.number(),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().min(0),
});

const createPurchaseReturnSchema = z.object({
  purchaseId: z.coerce.number(),
  reason: z.string().min(3),
  items: z.array(purchaseReturnItemSchema).min(1),
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

    const { saleId, refundMethodId, reason, items } = parsed.data;

    try {
      const result = await withTransaction(async (client) => {
        // Fetch original sale
        const saleRes = await client.query(`SELECT id, reference_no, customer_id, due_amount, created_at FROM sales WHERE id = $1`, [saleId]);
        if (saleRes.rows.length === 0) throw new Error('Original sale not found.');

        const sale = saleRes.rows[0];

        // 1. Check Return Policy Validity Deadline
        const policySetRes = await client.query(`SELECT setting_value FROM settings WHERE setting_key = 'return_policy_days'`);
        const returnPolicyDays = parseInt(policySetRes.rows[0]?.setting_value || '7', 10);
        const saleCreatedAt = new Date(sale.created_at);
        const daysSinceSale = (Date.now() - saleCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceSale > returnPolicyDays) {
          throw new Error(
            `Return policy expired. This invoice was issued ${Math.floor(daysSinceSale)} days ago (store return policy deadline is ${returnPolicyDays} days).`
          );
        }

        // 2. Validate Cumulative Return Quantities against previous returns
        for (const item of items) {
          const itemCheckRes = await client.query(
            `SELECT si.quantity, si.product_name, COALESCE(SUM(sri.quantity), 0) as already_returned
             FROM sale_items si
             LEFT JOIN sales_return_items sri ON sri.sale_item_id = si.id
             WHERE si.id = $1 AND si.sale_id = $2
             GROUP BY si.id, si.quantity, si.product_name`,
            [item.saleItemId, saleId]
          );

          if (itemCheckRes.rows.length === 0) {
            throw new Error(`Sale item #${item.saleItemId} does not belong to this invoice.`);
          }

          const originalQty = parseFloat(itemCheckRes.rows[0].quantity);
          const alreadyReturned = parseFloat(itemCheckRes.rows[0].already_returned);
          const returnable = Math.max(0, originalQty - alreadyReturned);

          if (item.quantity > returnable + 0.0001) {
            throw new Error(
              `Cannot return ${item.quantity} unit(s) of "${itemCheckRes.rows[0].product_name}". Maximum returnable quantity remaining is ${returnable} (Purchased: ${originalQty}, Previously Returned: ${alreadyReturned}).`
            );
          }
        }

        const customerId = sale.customer_id;
        const totalAmount = round2(items.reduce((sum, i) => sum + i.subtotal, 0));
        const totalTax = round2(items.reduce((sum, i) => sum + i.taxAmount, 0));
        const ref = `RET-${Date.now()}`;

        // 3. Verify Active Drawer & Balance Sufficiency for Cash Refunds
        const pmRes = await client.query(`SELECT is_cash, code FROM payment_methods WHERE id = $1`, [refundMethodId]);
        const pm = pmRes.rows[0];

        const openSessionRes = await client.query(`SELECT id, opening_balance FROM cash_sessions WHERE status = 'open' LIMIT 1`);
        const openSession = openSessionRes.rows[0] || null;

        if (pm?.is_cash) {
          if (!openSession) {
            throw new Error('No active cash drawer session is open. Please open a shift at the counter before issuing cash refunds.');
          }

          const movRes = await client.query(
            `SELECT COALESCE(SUM(CASE WHEN type = 'cash_in' AND source != 'opening_float' THEN amount WHEN type = 'cash_out' THEN -amount ELSE 0 END), 0) as net_flow
             FROM cash_movements WHERE session_id = $1`,
            [openSession.id]
          );
          const currentDrawerCash = round2(Number(openSession.opening_balance || 0) + Number(movRes.rows[0]?.net_flow || 0));

          if (totalAmount > currentDrawerCash) {
            throw new Error(
              `Insufficient cash in till drawer. Refund requires ${totalAmount.toFixed(2)} SAR, but current drawer balance is only ${currentDrawerCash.toFixed(2)} SAR.`
            );
          }
        }

        // 4. Insert into sales_returns
        const retRes = await client.query(
          `INSERT INTO sales_returns (reference_no, sale_id, customer_id, user_id, total_amount, tax_amount, refund_method_id, reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [ref, saleId, customerId, request.user!.id, totalAmount, totalTax, refundMethodId, reason]
        );
        const retId = retRes.rows[0].id;

        // 5. Insert items & handle inventory restock
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

        // 6. Record Cash Movement / Customer Credit / Card Refund
        if (pm?.is_cash && openSession) {
          await client.query(
            `INSERT INTO cash_movements (session_id, type, amount, source, reference_id, description)
             VALUES ($1, 'cash_out', $2, 'refund', $3, $4)`,
            [openSession.id, totalAmount, retId, `Cash Refund for Return ${ref}`]
          );
        } else if (pm?.code === 'customer_credit' && customerId) {
          const lastBalRes = await client.query(
            `SELECT balance FROM customer_ledger WHERE customer_id = $1 ORDER BY id DESC LIMIT 1`,
            [customerId]
          );
          const lastBal = lastBalRes.rows.length > 0 ? parseFloat(lastBalRes.rows[0].balance) : 0;
          const newBal = round2(lastBal - totalAmount); // Credit reduces customer receivable
          
          await client.query(
            `INSERT INTO customer_ledger (customer_id, user_id, type, reference_id, debit, credit, balance, notes)
             VALUES ($1, $2, 'return', $3, 0, $4, $5, $6)`,
            [customerId, request.user!.id, retId, totalAmount, newBal, `Return refund - ${ref}`]
          );
        }

        const refundDest = pm?.is_cash ? 'cash' : (pm?.code === 'customer_credit' ? 'customer_credit' : 'card');

        await client.query(
          `INSERT INTO sales_return_refunds (sales_return_id, destination, payment_method_id, cash_session_id, amount, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [retId, refundDest, refundMethodId, openSession?.id || null, totalAmount, request.user!.id]
        );

        if (sale.due_amount && parseFloat(sale.due_amount) > 0) {
          const reduceAmount = Math.min(parseFloat(sale.due_amount), totalAmount);
          await client.query(
            `UPDATE sales SET due_amount = GREATEST(0, due_amount - $1),
             payment_status = CASE WHEN (due_amount - $1) <= 0.001 THEN 'paid'::payment_status_enum ELSE 'partial'::payment_status_enum END
             WHERE id = $2`,
            [reduceAmount, saleId]
          );
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

  // POST /api/v1/returns/purchases - Process purchase return to supplier
  fastify.post('/purchases', async (request, reply) => {
    const parsed = createPurchaseReturnSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid return data.',
        errors: parsed.error.format(),
      });
    }

    const { purchaseId, reason, items } = parsed.data;

    try {
      const result = await withTransaction(async (client) => {
        const purchRes = await client.query(
          `SELECT id, reference_no, supplier_id, status FROM purchases WHERE id = $1`,
          [purchaseId]
        );
        if (purchRes.rows.length === 0) throw new Error('Original purchase not found.');
        const purchase = purchRes.rows[0];
        if (purchase.status !== 'received') throw new Error('Can only return received purchases.');

        const supplierId = purchase.supplier_id;
        let totalAmount = 0;
        const processedItems = [];

        for (const item of items) {
          const returnableRes = await client.query(
            `SELECT pi.quantity as original_qty,
                    COALESCE(SUM(pri.quantity), 0) as previously_returned
             FROM purchase_items pi
             LEFT JOIN purchase_return_items pri ON pri.purchase_item_id = pi.id
             WHERE pi.id = $1
             GROUP BY pi.quantity`,
            [item.purchaseItemId]
          );
          if (returnableRes.rows.length === 0) throw new Error(`Purchase item ${item.purchaseItemId} not found.`);

          const returnable = returnableRes.rows[0];
          const maxReturnable = Number(returnable.original_qty) - Number(returnable.previously_returned);
          if (item.quantity > maxReturnable) {
            throw new Error(`Cannot return ${item.quantity} units of item ${item.purchaseItemId}. Maximum returnable: ${maxReturnable}`);
          }

          const itemTotal = round2(item.quantity * item.unitCost);
          totalAmount = round2(totalAmount + itemTotal);

          processedItems.push({
            ...item,
            subtotal: itemTotal,
          });
        }

        const ref = `PRET-${Date.now()}`;

        // 1. Insert into purchase_returns
        const retRes = await client.query(
          `INSERT INTO purchase_returns (reference_no, purchase_id, supplier_id, user_id, total_amount, reason)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [ref, purchaseId, supplierId, request.user!.id, totalAmount, reason]
        );
        const retId = retRes.rows[0].id;

        // 2. Insert items & handle inventory deduction in base units
        for (const item of processedItems) {
          const prodRes = await client.query(
            `SELECT packaging_multiplier FROM products WHERE id = $1 FOR UPDATE`,
            [item.productId]
          );
          const packagingMultiplier = Number(prodRes.rows[0]?.packaging_multiplier || 1);
          const baseQuantity = item.quantity * packagingMultiplier;

          await client.query(
            `INSERT INTO purchase_return_items (return_id, purchase_item_id, product_id, quantity, unit_cost, subtotal)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [retId, item.purchaseItemId, item.productId, item.quantity, item.unitCost, item.subtotal]
          );

          await client.query(
            `UPDATE products SET current_stock = current_stock - $1, updated_at = NOW() WHERE id = $2`,
            [baseQuantity, item.productId]
          );

          await client.query(
            `INSERT INTO stock_movements (product_id, quantity, type, reference_id, reference_type, unit_cost, user_id, notes)
             VALUES ($1, $2, 'purchase_return', $3, 'purchase_return', $4, $5, $6)`,
            [item.productId, -baseQuantity, retId, item.unitCost, request.user!.id, `Purchase Return: ${ref}`]
          );
        }

        // 3. Supplier Ledger (Debit reduces payable)
        if (supplierId) {
          await client.query(`SELECT id FROM suppliers WHERE id = $1 FOR UPDATE`, [supplierId]);
          const lastBalRes = await client.query(
            `SELECT balance FROM supplier_ledger WHERE supplier_id = $1 ORDER BY id DESC LIMIT 1`,
            [supplierId]
          );
          const lastBal = lastBalRes.rows.length > 0 ? parseFloat(lastBalRes.rows[0].balance) : 0;
          const newBal = round2(lastBal - totalAmount);

          await client.query(
            `INSERT INTO supplier_ledger (supplier_id, user_id, type, reference_id, debit, credit, balance, notes)
             VALUES ($1, $2, 'return', $3, $4, 0, $5, $6)`,
            [supplierId, request.user!.id, retId, totalAmount, newBal, `Purchase Return - ${ref}`]
          );
        }

        // 4. Audit Log
        await client.query(
          `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
           VALUES ($1, 'PURCHASE_RETURN_PROCESSED', 'purchase_returns', $2, $3)`,
          [request.user!.id, retId, JSON.stringify({ referenceNo: ref, totalAmount, originalPurchaseRef: purchase.reference_no, reason })]
        );

        return retRes.rows[0];
      });

      return reply.status(201).send({
        success: true,
        message: 'Purchase return processed and inventory adjusted.',
        data: result,
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });

  // GET /api/v1/returns/purchases - List purchase returns
  fastify.get('/purchases', async (request, reply) => {
    const res = await query(
      `SELECT pr.*, p.reference_no as purchase_ref, u.full_name as user_name, s.name as supplier_name
       FROM purchase_returns pr
       JOIN purchases p ON p.id = pr.purchase_id
       JOIN users u ON u.id = pr.user_id
       LEFT JOIN suppliers s ON s.id = pr.supplier_id
       ORDER BY pr.created_at DESC LIMIT 100`
    );
    return reply.send({ success: true, data: res.rows });
  });
}
