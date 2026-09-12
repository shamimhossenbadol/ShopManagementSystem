import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { calculateWeightedAverageCost, round2 } from '../../utils/financial.js';

const purchaseItemSchema = z.object({
  productId: z.coerce.number(),
  netUnitCost: z.coerce.number().positive(),
  quantity: z.coerce.number().positive(),
  taxRate: z.coerce.number().min(0).default(15.00),
  batchNumber: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
});

const createPurchaseSchema = z.object({
  supplierId: z.coerce.number(),
  supplierInvoiceNo: z.string().optional().nullable(),
  items: z.array(purchaseItemSchema).min(1, 'At least one item required in purchase.'),
  shippingCost: z.coerce.number().min(0).default(0),
  paidAmount: z.coerce.number().min(0).default(0),
  paymentMethodId: z.coerce.number().default(1),
});

const purchaseReturnSchema = z.object({
  purchaseId: z.coerce.number(),
  supplierId: z.coerce.number(),
  reason: z.string().min(3),
  items: z.array(
    z.object({
      purchaseItemId: z.coerce.number(),
      productId: z.coerce.number(),
      quantity: z.coerce.number().positive(),
      unitCost: z.coerce.number().positive(),
    })
  ).min(1),
});

export async function purchaseRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRole(['manager']));

  // GET /api/v1/purchases - List purchases
  fastify.get('/', async (request, reply) => {
    const res = await query(
      `SELECT 
        p.id, p.reference_no, p.supplier_invoice_no, p.grand_total,
        p.paid_amount, p.due_amount, p.payment_status, p.status,
        p.created_at, p.received_at, s.name as supplier_name, u.full_name as user_name
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       LEFT JOIN users u ON p.user_id = u.id
       ORDER BY p.created_at DESC LIMIT 100`
    );
    return reply.send({ success: true, data: res.rows });
  });

  // GET /api/v1/purchases/:id - Single purchase with items
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const pRes = await query(
      `SELECT p.*, s.name as supplier_name, s.company_name, s.vat_number as supplier_vat,
              u.full_name as created_by_name
       FROM purchases p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       LEFT JOIN users u ON u.id = p.user_id
       WHERE p.id = $1`,
      [Number(id)]
    );

    if (pRes.rows.length === 0) {
      return reply.status(404).send({ success: false, message: 'Purchase not found.' });
    }

    const itemsRes = await query(
      `SELECT pi.*, pr.name as product_name, pr.sku, pr.barcode, u.short_name as unit_short
       FROM purchase_items pi
       JOIN products pr ON pr.id = pi.product_id
       LEFT JOIN units u ON u.id = pr.unit_id
       WHERE pi.purchase_id = $1`,
      [Number(id)]
    );

    const payRes = await query(
      `SELECT pp.*, pm.name as payment_method_name 
       FROM purchase_payments pp
       JOIN payment_methods pm ON pm.id = pp.payment_method_id
       WHERE pp.purchase_id = $1`,
      [Number(id)]
    );

    return reply.send({
      success: true,
      data: {
        purchase: pRes.rows[0],
        items: itemsRes.rows,
        payments: payRes.rows,
      },
    });
  });

  // POST /api/v1/purchases - Receive Goods, update stock, and recalculate WAC
  fastify.post('/', async (request, reply) => {
    const parsed = createPurchaseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid purchase data.',
        errors: parsed.error.format(),
      });
    }

    const { supplierId, supplierInvoiceNo, items, shippingCost, paidAmount, paymentMethodId } = parsed.data;

    try {
      const result = await withTransaction(async (client) => {
        let subtotal = 0;
        let totalTax = 0;

        for (const item of items) {
          const itemSubtotal = item.netUnitCost * item.quantity;
          const itemTax = itemSubtotal * (item.taxRate / 100);
          subtotal += itemSubtotal;
          totalTax += itemTax;
        }

        const grandTotal = round2(subtotal + totalTax + shippingCost);
        const dueAmount = round2(Math.max(0, grandTotal - paidAmount));
        const paymentStatus = dueAmount === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

        const now = new Date();
        const dateStr = now.toISOString().slice(0, 7).replace('-', '');
        const countRes = await client.query(`SELECT COUNT(id) + 1 as next_seq FROM purchases`);
        const nextSeq = String(countRes.rows[0].next_seq).padStart(5, '0');
        const ref = `PUR-${dateStr}-${nextSeq}`;

        // 1. Insert purchase record
        const pRes = await client.query(
          `INSERT INTO purchases (
            reference_no, supplier_invoice_no, supplier_id, user_id, status,
            payment_status, subtotal, total_tax, shipping_cost, grand_total,
            paid_amount, due_amount, received_at
           ) VALUES ($1, $2, $3, $4, 'received', $5, $6, $7, $8, $9, $10, $11, NOW())
           RETURNING *`,
          [
            ref,
            supplierInvoiceNo || null,
            supplierId,
            request.user!.id,
            paymentStatus,
            round2(subtotal),
            round2(totalTax),
            round2(shippingCost),
            grandTotal,
            round2(paidAmount),
            dueAmount,
          ]
        );

        const purchase = pRes.rows[0];

        // 2. Process items, add stock movements, update WAC and create batches
        for (const item of items) {
          const itemSubtotal = round2(item.netUnitCost * item.quantity);
          const itemTax = round2(itemSubtotal * (item.taxRate / 100));

          const piRes = await client.query(
            `INSERT INTO purchase_items (purchase_id, product_id, net_unit_cost, quantity, tax_rate, tax_amount, subtotal)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [purchase.id, item.productId, item.netUnitCost, item.quantity, item.taxRate, itemTax, itemSubtotal + itemTax]
          );
          const purchaseItemId = piRes.rows[0].id;

          // Get current stock & WAC cost with row lock
          const prodRes = await client.query(
            `SELECT cost_price, current_stock, has_expiry
             FROM products WHERE id = $1 FOR UPDATE`,
            [item.productId]
          );

          const curStock = Number(prodRes.rows[0]?.current_stock || 0);
          const curWac = Number(prodRes.rows[0]?.cost_price || 0);

          // Calculate new WAC
          const newWac = calculateWeightedAverageCost(curStock, curWac, item.quantity, item.netUnitCost);

          // Update product WAC cost price and increment current_stock
          await client.query(
            `UPDATE products 
             SET cost_price = $1, current_stock = current_stock + $2, updated_at = NOW() 
             WHERE id = $3`,
            [newWac, item.quantity, item.productId]
          );

          // Insert stock movement (Inflow)
          await client.query(
            `INSERT INTO stock_movements (product_id, quantity, type, reference_id, reference_type, unit_cost, user_id, notes)
             VALUES ($1, $2, 'purchase', $3, 'purchase', $4, $5, $6)`,
            [item.productId, item.quantity, purchase.id, item.netUnitCost, request.user!.id, `Purchase: ${ref}`]
          );

          // If expiry or batch provided, insert into product_batches
          if (item.expiryDate || item.batchNumber) {
            const batchNo = item.batchNumber || `BATCH-${Date.now().toString().slice(-6)}`;
            const expiry = item.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

            await client.query(
              `INSERT INTO product_batches (product_id, batch_number, expiry_date, purchase_item_id, initial_quantity, current_quantity)
               VALUES ($1, $2, $3, $4, $5, $5)`,
              [item.productId, batchNo, expiry, purchaseItemId, item.quantity]
            );

            await client.query(`UPDATE products SET has_expiry = TRUE WHERE id = $1`, [item.productId]);
          }
        }

        // 3. Record supplier ledger
        const supBalRes = await client.query(
          `SELECT COALESCE(balance, 0) as last_bal FROM supplier_ledger 
           WHERE supplier_id = $1 ORDER BY id DESC LIMIT 1`,
          [supplierId]
        );
        const lastSupBal = Number(supBalRes.rows[0]?.last_bal || 0);
        const newSupBal = round2(lastSupBal + dueAmount);

        await client.query(
          `INSERT INTO supplier_ledger (supplier_id, user_id, type, reference_id, debit, credit, balance, notes)
           VALUES ($1, $2, 'bill', $3, 0, $4, $5, $6)`,
          [supplierId, request.user!.id, purchase.id, grandTotal, newSupBal, `Purchase Bill ${ref}`]
        );

        // 4. Record immediate payment if applied
        if (paidAmount > 0) {
          await client.query(
            `INSERT INTO purchase_payments (purchase_id, payment_method_id, amount, created_by)
             VALUES ($1, $2, $3, $4)`,
            [purchase.id, paymentMethodId, paidAmount, request.user!.id]
          );

          // If paid from cash drawer, record cash outflow
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
                [sessionRes.rows[0].id, paidAmount, purchase.id, `Supplier Payment for ${ref}`]
              );
            }
          }
        }

        // 5. Audit Log
        await client.query(
          `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
           VALUES ($1, 'PURCHASE_RECEIVED', 'purchases', $2, $3)`,
          [request.user!.id, purchase.id, JSON.stringify({ referenceNo: ref, grandTotal, supplierId })]
        );

        return purchase;
      });

      return reply.status(201).send({
        success: true,
        message: 'Purchase received, stock incremented, batches created, and WAC cost updated.',
        data: result,
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });

  // POST /api/v1/purchases/return - Return Goods to Supplier
  fastify.post('/return', async (request, reply) => {
    const parsed = purchaseReturnSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: 'Invalid purchase return data.' });
    }

    const { purchaseId, supplierId, reason, items } = parsed.data;

    try {
      const result = await withTransaction(async (client) => {
        const totalReturnAmount = round2(items.reduce((s, i) => s + i.quantity * i.unitCost, 0));
        const ref = `PRET-${Date.now()}`;

        // 1. Insert into purchase_returns
        const retRes = await client.query(
          `INSERT INTO purchase_returns (reference_no, purchase_id, supplier_id, user_id, total_amount, reason)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [ref, purchaseId, supplierId, request.user!.id, totalReturnAmount, reason]
        );
        const returnId = retRes.rows[0].id;

        // 2. Insert items & decrease products.current_stock
        for (const item of items) {
          const subtotal = round2(item.quantity * item.unitCost);
          await client.query(
            `INSERT INTO purchase_return_items (return_id, purchase_item_id, product_id, quantity, unit_cost, subtotal)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [returnId, item.purchaseItemId, item.productId, item.quantity, item.unitCost, subtotal]
          );

          // Decrement current_stock
          await client.query(
            `UPDATE products SET current_stock = current_stock - $1, updated_at = NOW() WHERE id = $2`,
            [item.quantity, item.productId]
          );

          // Stock movement outflow
          await client.query(
            `INSERT INTO stock_movements (product_id, quantity, type, reference_id, reference_type, unit_cost, user_id, notes)
             VALUES ($1, $2, 'return_out', $3, 'purchase_return', $4, $5, $6)`,
            [item.productId, -item.quantity, returnId, item.unitCost, request.user!.id, `Supplier Return: ${ref}`]
          );
        }

        // 3. Credit supplier ledger
        const supBalRes = await client.query(
          `SELECT COALESCE(balance, 0) as last_bal FROM supplier_ledger 
           WHERE supplier_id = $1 ORDER BY id DESC LIMIT 1`,
          [supplierId]
        );
        const lastBal = Number(supBalRes.rows[0]?.last_bal || 0);
        const newBal = round2(lastBal - totalReturnAmount);

        await client.query(
          `INSERT INTO supplier_ledger (supplier_id, user_id, type, reference_id, debit, credit, balance, notes)
           VALUES ($1, $2, 'return', $3, $4, 0, $5, $6)`,
          [supplierId, request.user!.id, returnId, totalReturnAmount, newBal, `Purchase Return ${ref}`]
        );

        // 4. Audit Log
        await client.query(
          `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
           VALUES ($1, 'PURCHASE_RETURN', 'purchase_returns', $2, $3)`,
          [request.user!.id, returnId, JSON.stringify({ referenceNo: ref, totalAmount: totalReturnAmount, supplierId })]
        );

        return retRes.rows[0];
      });

      return reply.status(201).send({
        success: true,
        message: 'Supplier return processed and inventory deducted.',
        data: result,
      });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });
}
