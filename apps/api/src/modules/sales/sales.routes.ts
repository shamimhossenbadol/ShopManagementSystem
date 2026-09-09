import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { calculateLineVat, round2 } from '../../utils/financial.js';
import { generateZatcaTLVQR, generateInvoiceHash } from '../../utils/zatca.js';

const saleItemSchema = z.object({
  productId: z.coerce.number(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().positive(),
  discount: z.coerce.number().min(0).default(0),
});

const salePaymentSchema = z.object({
  paymentMethodId: z.coerce.number(),
  amount: z.coerce.number().positive(),
  referenceNote: z.string().optional().nullable(),
});

const createSaleSchema = z.object({
  customerId: z.coerce.number().optional().nullable(),
  items: z.array(saleItemSchema).min(1, 'Cart cannot be empty.'),
  payments: z.array(salePaymentSchema).default([]),
  invoiceDiscount: z.coerce.number().min(0).default(0),
  invoiceDiscountType: z.enum(['fixed', 'percentage']).default('fixed'),
  idempotencyKey: z.string().optional().nullable(),
});

const voidSaleSchema = z.object({
  reason: z.string().min(3),
});

export async function salesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // POST /api/v1/sales - Atomic POS Checkout
  fastify.post('/', { preHandler: [requireRole(['sales_executive'])] }, async (request, reply) => {
    const parsed = createSaleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid sales data.',
        errors: parsed.error.format(),
      });
    }

    const { customerId, items, payments, invoiceDiscount, invoiceDiscountType, idempotencyKey } = parsed.data;

    // Idempotency Check: if idempotency key was previously processed, return existing sale
    if (idempotencyKey) {
      const existingSaleRes = await query(
        `SELECT s.*, i.invoice_no, i.qr_data, i.uuid
         FROM sales s
         LEFT JOIN invoices i ON i.sale_id = s.id
         WHERE s.idempotency_key = $1`,
        [idempotencyKey]
      );
      if (existingSaleRes.rows.length > 0) {
        return reply.status(200).send({
          success: true,
          isDuplicateRetry: true,
          message: 'Sale already processed (Idempotent response).',
          data: {
            sale: existingSaleRes.rows[0],
            invoice: {
              invoice_no: existingSaleRes.rows[0].invoice_no,
              qr_data: existingSaleRes.rows[0].qr_data,
              uuid: existingSaleRes.rows[0].uuid,
            },
          },
        });
      }
    }

    try {
      const checkoutResult = await withTransaction(async (client) => {
        // 1. Check active cash session for cashier
        const sessionRes = await client.query(
          `SELECT id FROM cash_sessions WHERE user_id = $1 AND status = 'open' LIMIT 1`,
          [request.user!.id]
        );
        const activeSessionId = sessionRes.rows.length > 0 ? sessionRes.rows[0].id : null;

        // 2. Fetch products and lock rows for atomic stock check
        const productIds = items.map((i) => i.productId);
        const prodRes = await client.query(
          `SELECT p.id, p.sku, p.name, p.cost_price, p.tax_type, p.has_expiry, p.current_stock, t.rate as tax_rate
           FROM products p
           LEFT JOIN tax_rates t ON p.tax_rate_id = t.id
           WHERE p.id = ANY($1::int[]) AND p.is_active = TRUE AND p.is_deleted = FALSE
           FOR UPDATE OF p`,
          [productIds]
        );

        const prodMap = new Map(prodRes.rows.map((p) => [p.id, p]));

        // Check if negative stock is permitted in settings
        const settingRes = await client.query(
          `SELECT setting_value FROM settings WHERE setting_key = 'allow_negative_stock'`
        );
        const allowNegativeStock = settingRes.rows[0]?.setting_value === 'true';

        // Calculate Gross Subtotal for proportional discount distribution
        let grossSubtotal = 0;
        for (const item of items) {
          grossSubtotal += item.unitPrice * item.quantity;
        }

        let computedInvoiceDiscount = invoiceDiscount;
        if (invoiceDiscountType === 'percentage' && grossSubtotal > 0) {
          computedInvoiceDiscount = (grossSubtotal * invoiceDiscount) / 100;
        }
        computedInvoiceDiscount = Math.min(computedInvoiceDiscount, grossSubtotal);

        let subtotal = 0;
        let totalTax = 0;
        let totalItemsCount = 0;
        const processedItems: any[] = [];

        for (const item of items) {
          const product = prodMap.get(item.productId);
          if (!product) {
            throw new Error(`Product with ID ${item.productId} is unavailable.`);
          }

          const currentStock = Number(product.current_stock);
          if (!allowNegativeStock && currentStock < item.quantity) {
            throw new Error(
              `Insufficient stock for "${product.name}". Available: ${currentStock}, Requested: ${item.quantity}.`
            );
          }

          const lineGross = item.unitPrice * item.quantity;
          // Proportional general invoice discount allocated to this line
          const allocatedDiscount =
            grossSubtotal > 0
              ? (computedInvoiceDiscount * lineGross) / grossSubtotal
              : 0;

          const totalLineDiscount = round2(item.discount + allocatedDiscount);
          const isInclusive = product.tax_type === 'inclusive';
          const taxRate = Number(product.tax_rate || 15.00);

          const vatCalc = calculateLineVat(
            item.unitPrice,
            item.quantity,
            taxRate,
            isInclusive,
            totalLineDiscount
          );

          subtotal += vatCalc.taxableAmount;
          totalTax += vatCalc.taxAmount;
          totalItemsCount += item.quantity;

          processedItems.push({
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unitCost: product.cost_price,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            netUnitPrice: vatCalc.netUnitPrice,
            discount: totalLineDiscount,
            discountType: 'fixed',
            discountValue: item.discount,
            taxRate: taxRate,
            taxType: product.tax_type,
            taxAmount: vatCalc.taxAmount,
            subtotal: vatCalc.lineTotal,
            hasExpiry: product.has_expiry,
          });
        }

        const grandTotal = round2(subtotal + totalTax);
        const totalPaid = round2(payments.reduce((sum, p) => sum + p.amount, 0));
        const changeAmount = round2(Math.max(0, totalPaid - grandTotal));
        let dueAmount = round2(Math.max(0, grandTotal - totalPaid));

        // Precision tolerance: If payment is within 0.05 SAR (rounding halalas), consider fully paid
        if (dueAmount <= 0.05) {
          dueAmount = 0;
        }

        const paymentStatus = dueAmount === 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';

        // Strict Production Rule: Walk-in customers cannot have Customer Due / Credit
        if (dueAmount > 0 && (!customerId || Number(customerId) === 1)) {
          throw new Error(`Customer Due is not permitted for Walk-in Customer. Outstanding: ${dueAmount.toFixed(2)} SAR. Full payment is required.`);
        }

        if (payments.length === 0 && (!customerId || Number(customerId) === 1)) {
          throw new Error('At least one payment method is required for Walk-in Customer.');
        }

        // 3. Generate sequential reference & invoice numbers
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 7).replace('-', '');
        const countRes = await client.query(`SELECT COUNT(id) + 1 as next_seq FROM sales`);
        const nextSeq = String(countRes.rows[0].next_seq).padStart(5, '0');
        const saleRef = `SAL-${dateStr}-${nextSeq}`;
        const invoiceNo = `INV-${dateStr}-${nextSeq}`;

        const saleInsert = await client.query(
          `INSERT INTO sales (
            reference_no, user_id, customer_id, session_id, total_items, subtotal,
            total_discount, invoice_discount, invoice_discount_type,
            total_tax, grand_total, paid_amount, due_amount,
            payment_status, sale_status, idempotency_key
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'completed', $15)
           RETURNING *`,
          [
            saleRef,
            request.user!.id,
            customerId || 1, // Default Walk-in
            activeSessionId,
            totalItemsCount,
            round2(subtotal),
            round2(computedInvoiceDiscount),
            round2(invoiceDiscount),
            invoiceDiscountType,
            round2(totalTax),
            grandTotal,
            round2(Math.min(grandTotal, totalPaid)),
            dueAmount,
            paymentStatus,
            idempotencyKey || null,
          ]
        );

        const sale = saleInsert.rows[0];

        // 4. Insert sale items, update products.current_stock, record stock_movements & FEFO batch consumption
        for (const item of processedItems) {
          await client.query(
            `INSERT INTO sale_items (
              sale_id, product_id, product_name, sku, unit_cost, unit_price,
              quantity, net_unit_price, discount, discount_type, discount_value,
              tax_rate, tax_type, tax_amount, subtotal
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
              sale.id,
              item.productId,
              item.productName,
              item.sku,
              item.unitCost,
              item.unitPrice,
              item.quantity,
              item.netUnitPrice,
              item.discount,
              item.discountType,
              item.discountValue,
              item.taxRate,
              item.taxType,
              item.taxAmount,
              item.subtotal,
            ]
          );

          // Atomically decrement products.current_stock
          await client.query(
            `UPDATE products SET current_stock = current_stock - $1, updated_at = NOW() WHERE id = $2`,
            [item.quantity, item.productId]
          );

          // Record stock movement (outflow)
          await client.query(
            `INSERT INTO stock_movements (
              product_id, quantity, type, reference_id, reference_type, unit_cost, user_id, notes
             ) VALUES ($1, $2, 'sale', $3, 'sale', $4, $5, $6)`,
            [
              item.productId,
              -item.quantity,
              sale.id,
              item.unitCost,
              request.user!.id,
              `Sale Ref: ${saleRef}`,
            ]
          );

          // FEFO Batch Consumption (if perishable item)
          if (item.hasExpiry) {
            let remainingToDeduct = item.quantity;
            const batchesRes = await client.query(
              `SELECT id, current_quantity FROM product_batches 
               WHERE product_id = $1 AND is_active = TRUE AND current_quantity > 0 
               ORDER BY expiry_date ASC FOR UPDATE`,
              [item.productId]
            );

            for (const batch of batchesRes.rows) {
              if (remainingToDeduct <= 0) break;
              const batchQty = Number(batch.current_quantity);
              const deduct = Math.min(batchQty, remainingToDeduct);
              await client.query(
                `UPDATE product_batches SET current_quantity = current_quantity - $1 WHERE id = $2`,
                [deduct, batch.id]
              );
              remainingToDeduct -= deduct;
            }
          }
        }

        // 5. Record Payments & Till Cash Movements
        for (const payment of payments) {
          await client.query(
            `INSERT INTO sale_payments (sale_id, payment_method_id, amount, reference_note, created_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [sale.id, payment.paymentMethodId, payment.amount, payment.referenceNote || null, request.user!.id]
          );

          // If Cash, update active cash session
          const isCashRes = await client.query(
            `SELECT is_cash FROM payment_methods WHERE id = $1`,
            [payment.paymentMethodId]
          );
          if (isCashRes.rows[0]?.is_cash && activeSessionId) {
            const netCashIn = round2(Math.min(payment.amount, grandTotal));
            await client.query(
              `INSERT INTO cash_movements (session_id, type, amount, source, reference_id, description)
               VALUES ($1, 'cash_in', $2, 'sale', $3, $4)`,
              [activeSessionId, netCashIn, sale.id, `POS Sale ${saleRef}`]
            );
          }
        }

        // 6. Record Customer Ledger if due applied
        if (dueAmount > 0 && customerId && Number(customerId) !== 1) {
          const custRes = await client.query(
            `SELECT id, name, credit_limit, is_active FROM customers WHERE id = $1`,
            [customerId]
          );
          if (custRes.rows.length === 0 || !custRes.rows[0].is_active) {
            throw new Error('Selected customer account is inactive or not found.');
          }
          const cust = custRes.rows[0];

          const balRes = await client.query(
            `SELECT COALESCE(balance, 0) as last_bal FROM customer_ledger 
             WHERE customer_id = $1 ORDER BY id DESC LIMIT 1`,
            [customerId]
          );
          const lastBal = Number(balRes.rows[0]?.last_bal || 0);
          const newBal = round2(lastBal + dueAmount);
          const creditLimit = Number(cust.credit_limit || 0);

          if (creditLimit > 0 && newBal > creditLimit) {
            throw new Error(
              `Credit limit exceeded for "${cust.name}". Limit: SAR ${creditLimit.toFixed(2)}, Current Due: SAR ${lastBal.toFixed(2)}, New Balance: SAR ${newBal.toFixed(2)}.`
            );
          }

          await client.query(
            `INSERT INTO customer_ledger (customer_id, user_id, type, reference_id, debit, credit, balance, notes)
             VALUES ($1, $2, 'invoice', $3, $4, 0, $5, $6)`,
            [customerId, request.user!.id, sale.id, dueAmount, newBal, `Unpaid balance from POS ${saleRef}`]
          );
        }

        // 7. ZATCA Compliance: Generate TLV QR & Hash Chain
        const storeSettingsRes = await client.query(
          `SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('shop_name_en', 'shop_name', 'shop_vat_number', 'vat_number')`
        );
        const settingsMap = Object.fromEntries(storeSettingsRes.rows.map((r) => [r.setting_key, r.setting_value]));

        const sellerName = settingsMap.shop_name_en || settingsMap.shop_name || process.env.SHOP_NAME || 'Sell & Inventory';
        const vatNumber = settingsMap.vat_number || settingsMap.shop_vat_number || process.env.SHOP_VAT_NUMBER || '300123456700003';

        const prevHashRes = await client.query(
          `SELECT invoice_hash FROM invoices ORDER BY id DESC LIMIT 1`
        );
        const previousHash = prevHashRes.rows[0]?.invoice_hash || '0';
        const timestampIso = now.toISOString();

        const qrData = generateZatcaTLVQR(
          sellerName,
          vatNumber,
          timestampIso,
          grandTotal.toFixed(2),
          totalTax.toFixed(2)
        );

        const currentHash = generateInvoiceHash(invoiceNo, previousHash, grandTotal, timestampIso);

        const invoiceInsert = await client.query(
          `INSERT INTO invoices (
            sale_id, invoice_no, previous_invoice_hash, invoice_hash, qr_data, einvoice_status
           ) VALUES ($1, $2, $3, $4, $5, 'generated')
           RETURNING *`,
          [sale.id, invoiceNo, previousHash, currentHash, qrData]
        );

        return {
          sale,
          items: processedItems,
          payments,
          tenderedAmount: totalPaid,
          changeAmount,
          invoice: invoiceInsert.rows[0],
          qrData,
        };
      });

      return reply.status(201).send({
        success: true,
        message: 'Sale finalized successfully.',
        data: checkoutResult,
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        message: err.message || 'Failed to process sale.',
      });
    }
  });

  // GET /api/v1/sales - Sales history
  fastify.get('/', async (request, reply) => {
    const isManager = request.user!.role === 'manager';
    let sql = `
      SELECT 
        s.id, s.reference_no, s.grand_total, s.paid_amount, s.due_amount,
        s.payment_status, s.sale_status, s.created_at,
        c.name as customer_name,
        u.full_name as cashier_name,
        i.invoice_no
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN invoices i ON i.sale_id = s.id
    `;

    const params: any[] = [];
    if (!isManager) {
      params.push(request.user!.id);
      sql += ` WHERE s.user_id = $1`;
    }

    sql += ` ORDER BY s.created_at DESC LIMIT 100`;
    const res = await query(sql, params);
    return reply.send({ success: true, data: res.rows });
  });

  // GET /api/v1/sales/:id - Sale details with items and payments
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const saleRes = await query(
      `SELECT s.*, c.name as customer_name, c.phone as customer_phone,
              u.full_name as cashier_name, i.invoice_no, i.qr_data, i.uuid
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN invoices i ON i.sale_id = s.id
       WHERE s.id = $1`,
      [Number(id)]
    );

    if (saleRes.rows.length === 0) {
      return reply.status(404).send({ success: false, message: 'Sale not found.' });
    }

    const itemsRes = await query(`SELECT * FROM sale_items WHERE sale_id = $1`, [Number(id)]);
    const payRes = await query(
      `SELECT sp.*, pm.name as payment_method_name 
       FROM sale_payments sp
       JOIN payment_methods pm ON pm.id = sp.payment_method_id
       WHERE sp.sale_id = $1`,
      [Number(id)]
    );

    return reply.send({
      success: true,
      data: {
        sale: saleRes.rows[0],
        items: itemsRes.rows,
        payments: payRes.rows,
      },
    });
  });

  // POST /api/v1/sales/void/:id - Void Sale (Manager only)
  fastify.post('/void/:id', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = voidSaleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: 'Void reason is required.' });
    }

    try {
      const result = await withTransaction(async (client) => {
        const sRes = await client.query(`SELECT * FROM sales WHERE id = $1 FOR UPDATE`, [Number(id)]);
        if (sRes.rows.length === 0) throw new Error('Sale not found.');
        const sale = sRes.rows[0];

        if (sale.sale_status === 'voided') {
          throw new Error('Sale is already voided.');
        }

        // 1. Mark sale as voided
        await client.query(`UPDATE sales SET sale_status = 'voided', updated_at = NOW() WHERE id = $1`, [sale.id]);

        // 2. Restore stock
        const itemsRes = await client.query(`SELECT product_id, quantity, unit_cost FROM sale_items WHERE sale_id = $1`, [sale.id]);
        for (const item of itemsRes.rows) {
          // Increment products.current_stock
          await client.query(
            `UPDATE products SET current_stock = current_stock + $1, updated_at = NOW() WHERE id = $2`,
            [item.quantity, item.product_id]
          );

          await client.query(
            `INSERT INTO stock_movements (product_id, quantity, type, reference_id, reference_type, unit_cost, user_id, notes)
             VALUES ($1, $2, 'adjustment', $3, 'sale_void', $4, $5, $6)`,
            [
              item.product_id,
              item.quantity, // Positive restoration
              sale.id,
              item.unit_cost,
              request.user!.id,
              `Void Sale: ${sale.reference_no} - ${parsed.data.reason}`,
            ]
          );
        }

        // 3. Reverse customer credit ledger if due amount existed
        if (Number(sale.due_amount) > 0 && sale.customer_id && sale.customer_id !== 1) {
          const balRes = await client.query(
            `SELECT COALESCE(balance, 0) as last_bal FROM customer_ledger 
             WHERE customer_id = $1 ORDER BY id DESC LIMIT 1`,
            [sale.customer_id]
          );
          const lastBal = Number(balRes.rows[0]?.last_bal || 0);
          const newBal = round2(lastBal - Number(sale.due_amount));

          await client.query(
            `INSERT INTO customer_ledger (customer_id, user_id, type, reference_id, debit, credit, balance, notes)
             VALUES ($1, $2, 'adjustment', $3, 0, $4, $5, $6)`,
            [sale.customer_id, request.user!.id, sale.id, sale.due_amount, newBal, `Void Sale Reversal: ${sale.reference_no}`]
          );
        }

        // 4. Audit Log
        await client.query(
          `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
           VALUES ($1, 'SALE_VOIDED', 'sales', $2, $3)`,
          [request.user!.id, sale.id, JSON.stringify({ referenceNo: sale.reference_no, reason: parsed.data.reason })]
        );

        return { saleId: sale.id, referenceNo: sale.reference_no, status: 'voided' };
      });

      return reply.send({ success: true, message: 'Sale voided and stock restored.', data: result });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  });

  // POST /api/v1/sales/hold - Hold cart
  fastify.post('/hold', async (request, reply) => {
    const { customerId, items, holdNote } = request.body as any;
    const ref = `HOLD-${Date.now()}`;

    const res = await withTransaction(async (client) => {
      const h = await client.query(
        `INSERT INTO held_sales (reference_no, user_id, customer_id, hold_note)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [ref, request.user!.id, customerId || null, holdNote || 'Suspended cart']
      );
      const heldId = h.rows[0].id;

      for (const item of items) {
        await client.query(
          `INSERT INTO held_sale_items (held_sale_id, product_id, quantity, unit_price, discount)
           VALUES ($1, $2, $3, $4, $5)`,
          [heldId, item.productId, item.quantity, item.unitPrice, item.discount || 0]
        );
      }
      return h.rows[0];
    });

    return reply.send({ success: true, message: 'Sale held successfully.', data: res });
  });

  // GET /api/v1/sales/hold - List held carts for current user
  fastify.get('/hold', async (request, reply) => {
    const res = await query(
      `SELECT h.*, 
       COALESCE(
         json_agg(
           json_build_object(
             'id', hi.id,
             'productId', hi.product_id,
             'quantity', hi.quantity,
             'unitPrice', hi.unit_price,
             'discount', hi.discount,
             'name', p.name,
             'sku', p.sku,
             'barcode', p.barcode,
             'taxRate', COALESCE(t.rate, 15),
             'isTaxInclusive', p.tax_type = 'inclusive',
             'stock', p.current_stock
           )
         ) FILTER (WHERE hi.id IS NOT NULL), '[]'
       ) as items,
       COUNT(hi.id) as item_count,
       u.full_name as user_name, c.name as customer_name
       FROM held_sales h
       LEFT JOIN held_sale_items hi ON hi.held_sale_id = h.id
       LEFT JOIN products p ON p.id = hi.product_id
       LEFT JOIN tax_rates t ON t.id = p.tax_rate_id
       LEFT JOIN users u ON h.user_id = u.id
       LEFT JOIN customers c ON c.id = h.customer_id
       WHERE h.user_id = $1
       GROUP BY h.id, u.full_name, c.name ORDER BY h.created_at DESC`,
      [request.user!.id]
    );
    return reply.send({ success: true, data: res.rows });
  });

  // GET /api/v1/sales/hold/:id - Retrieve specific held cart with items
  fastify.get('/hold/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const hRes = await query(`SELECT * FROM held_sales WHERE id = $1`, [Number(id)]);
    if (hRes.rows.length === 0) {
      return reply.status(404).send({ success: false, message: 'Held cart not found.' });
    }

    const itemsRes = await query(
      `SELECT hi.*, p.name, p.sku, p.barcode, p.selling_price, p.tax_type, p.current_stock, t.rate as tax_rate
       FROM held_sale_items hi
       JOIN products p ON p.id = hi.product_id
       LEFT JOIN tax_rates t ON t.id = p.tax_rate_id
       WHERE hi.held_sale_id = $1`,
      [Number(id)]
    );

    return reply.send({
      success: true,
      data: {
        heldSale: hRes.rows[0],
        items: itemsRes.rows,
      },
    });
  });

  // DELETE /api/v1/sales/hold/:id - Remove held cart after resuming
  fastify.delete('/hold/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await query(`DELETE FROM held_sales WHERE id = $1 AND (user_id = $2 OR $3 = 'manager')`, [
      Number(id),
      request.user!.id,
      request.user!.role,
    ]);
    return reply.send({ success: true, message: 'Held cart cleared.' });
  });
}
