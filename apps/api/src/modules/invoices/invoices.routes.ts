import { FastifyInstance } from 'fastify';
import { query } from '../../db/pool.js';
import { authenticate } from '../../middleware/auth.js';

export async function invoiceRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/v1/invoices/:invoiceNo - Get complete invoice & receipt payload
  fastify.get('/:invoiceNo', async (request, reply) => {
    const { invoiceNo } = request.params as { invoiceNo: string };

    const invRes = await query(
      `SELECT 
        i.id as invoice_id, i.invoice_no, i.uuid, i.qr_data, i.created_at,
        s.id as sale_id, s.reference_no, s.subtotal, s.total_discount, s.invoice_discount, s.total_tax,
        s.grand_total, s.paid_amount, s.due_amount, s.payment_status,
        c.name as customer_name, c.phone as customer_phone, c.vat_number as customer_vat,
        u.full_name as cashier_name
       FROM invoices i
       JOIN sales s ON s.id = i.sale_id
       LEFT JOIN customers c ON c.id = s.customer_id
       LEFT JOIN users u ON u.id = s.user_id
       WHERE i.invoice_no = $1 OR s.reference_no = $1`,
      [invoiceNo]
    );

    if (invRes.rows.length === 0) {
      return reply.status(404).send({ success: false, message: 'Invoice not found.' });
    }

    const invoice = invRes.rows[0];

    const itemsRes = await query(
      `SELECT id, product_name, sku, quantity, unit_price, discount, tax_rate, tax_amount, subtotal
       FROM sale_items WHERE sale_id = $1`,
      [invoice.sale_id]
    );

    const paymentsRes = await query(
      `SELECT sp.amount, pm.name as payment_method, pm.code as payment_code
       FROM sale_payments sp
       JOIN payment_methods pm ON pm.id = sp.payment_method_id
       WHERE sp.sale_id = $1`,
      [invoice.sale_id]
    );

    // Fetch store settings for receipt header and branding
    const setRes = await query(`SELECT setting_key, setting_value FROM settings`);
    const settings = Object.fromEntries(setRes.rows.map((r) => [r.setting_key, r.setting_value]));

    return reply.send({
      success: true,
      data: {
        invoice,
        items: itemsRes.rows,
        payments: paymentsRes.rows,
        store: {
          nameEn: settings.shop_name_en || settings.shop_name || 'Sell & Inventory',
          nameAr: settings.shop_name_ar || 'Sell & Inventory POS',
          vatNumber: settings.shop_vat_number || '300123456700003',
          crNumber: settings.shop_cr_number || '1010123456',
          address: settings.shop_address || 'King Fahd Road, Riyadh, Saudi Arabia',
          phone: settings.shop_phone || '+966 11 456 7890',
          logoPath: settings.shop_logo_path || '',
          receiptHeader: settings.receipt_header || 'Simplified Tax Invoice',
          receiptFooter: settings.receipt_footer || 'Thank you for shopping with us! Return within 7 days.',
          currencySymbol: settings.currency_symbol || 'SAR',
        },
      },
    });
  });

  // POST /api/v1/invoices/:invoiceNo/escpos - Raw ESC/POS thermal receipt binary/hex payload
  fastify.post('/:invoiceNo/escpos', async (request, reply) => {
    const { invoiceNo } = request.params as { invoiceNo: string };

    const invRes = await query(
      `SELECT i.*, s.reference_no, s.subtotal, s.total_tax, s.grand_total, s.paid_amount, s.due_amount,
              u.full_name as cashier_name
       FROM invoices i
       JOIN sales s ON s.id = i.sale_id
       LEFT JOIN users u ON u.id = s.user_id
       WHERE i.invoice_no = $1 OR s.reference_no = $1`,
      [invoiceNo]
    );

    if (invRes.rows.length === 0) {
      return reply.status(404).send({ success: false, message: 'Invoice not found.' });
    }

    const invoice = invRes.rows[0];
    const itemsRes = await query(`SELECT * FROM sale_items WHERE sale_id = $1`, [invoice.sale_id]);

    const setRes = await query(`SELECT setting_key, setting_value FROM settings`);
    const settings = Object.fromEntries(setRes.rows.map((r) => [r.setting_key, r.setting_value]));

    // ESC/POS Commands:
    // ESC @ : Initialize
    // ESC a 1 : Center Align
    // ESC a 0 : Left Align
    // GS V 66 0 : Cut Paper
    // ESC p 0 25 250 : Drawer Kick Pulse
    const ESC = '\x1B';
    const GS = '\x1D';

    let receipt = '';
    receipt += `${ESC}@`; // Init
    receipt += `${ESC}a\x01`; // Center
    receipt += `${settings.shop_name_en || 'AL-NOOR SUPER MARKET'}\n`;
    receipt += `VAT: ${settings.shop_vat_number || '300123456700003'} | CR: ${settings.shop_cr_number || '1010123456'}\n`;
    receipt += `Simplified Tax Invoice\n`;
    receipt += `------------------------------------------------\n`;
    receipt += `${ESC}a\x00`; // Left
    receipt += `Invoice No: ${invoice.invoice_no}\n`;
    receipt += `Date: ${new Date(invoice.created_at).toLocaleString()}\n`;
    receipt += `Cashier: ${invoice.cashier_name || 'Staff'}\n`;
    receipt += `------------------------------------------------\n`;
    receipt += `Item              Qty    Price     Tax     Total\n`;
    receipt += `------------------------------------------------\n`;

    for (const it of itemsRes.rows) {
      const name = (it.product_name || '').slice(0, 16).padEnd(16);
      const qty = String(it.quantity).padStart(5);
      const price = Number(it.unit_price).toFixed(2).padStart(8);
      const tax = Number(it.tax_amount).toFixed(2).padStart(7);
      const sub = Number(it.subtotal).toFixed(2).padStart(8);
      receipt += `${name} ${qty} ${price} ${tax} ${sub}\n`;
    }

    receipt += `------------------------------------------------\n`;
    receipt += `Subtotal (Taxable):     SAR ${Number(invoice.subtotal).toFixed(2)}\n`;
    receipt += `VAT (15%):              SAR ${Number(invoice.total_tax).toFixed(2)}\n`;
    receipt += `GRAND TOTAL:            SAR ${Number(invoice.grand_total).toFixed(2)}\n`;
    receipt += `Paid Amount:            SAR ${Number(invoice.paid_amount).toFixed(2)}\n`;
    if (Number(invoice.due_amount) > 0) {
      receipt += `Due Balance:            SAR ${Number(invoice.due_amount).toFixed(2)}\n`;
    }
    receipt += `------------------------------------------------\n`;
    receipt += `${ESC}a\x01`; // Center
    receipt += `${settings.receipt_footer || 'Thank you for shopping with us!'}\n\n`;

    // Drawer kick pulse
    if (settings.cash_drawer_auto_kick === 'true') {
      receipt += `${ESC}p\x00\x19\xFA`;
    }

    // Cut paper
    receipt += `${GS}V\x42\x00`;

    return reply.send({
      success: true,
      rawEscPosBase64: Buffer.from(receipt, 'utf8').toString('base64'),
      qrData: invoice.qr_data,
    });
  });

  // POST /api/v1/invoices/drawer-kick - Manual cash drawer pulse
  fastify.post('/drawer-kick', async (request, reply) => {
    const ESC = '\x1B';
    const drawerPulse = `${ESC}p\x00\x19\xFA`;
    return reply.send({
      success: true,
      drawerPulseBase64: Buffer.from(drawerPulse, 'utf8').toString('base64'),
      message: 'Cash drawer kick pulse signal generated.',
    });
  });
}
