import { FastifyInstance } from 'fastify';
import { query } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { round2 } from '../../utils/financial.js';

export async function reportRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRole(['manager']));

  // Helper to format date in Riyadh timezone
  const getRiyadhDateStr = (date: Date) => {
    return date.toLocaleString('en-US', { timeZone: 'Asia/Riyadh', hour12: false });
  };
  
  const pad = (n: number) => n.toString().padStart(2, '0');

  // GET /api/v1/reports/dashboard - Master KPI Summary
  fastify.get('/dashboard', async (request, reply) => {
    // Determine business day start based on shop_closing_hour
    const settingRes = await query(
      `SELECT setting_value FROM settings WHERE setting_key = 'shop_closing_hour'`
    );
    const closingHourStr = settingRes.rows[0]?.setting_value || '00:00';
    const [closeHour, closeMin] = closingHourStr.split(':').map((v: string) => parseInt(v, 10) || 0);

    const now = new Date();
    // Get current time in Riyadh
    const riyadhDateStr = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
    
    let baseDate = new Date(riyadhDateStr.getFullYear(), riyadhDateStr.getMonth(), riyadhDateStr.getDate(), closeHour, closeMin, 0, 0);
    if (riyadhDateStr.getHours() < closeHour || (riyadhDateStr.getHours() === closeHour && riyadhDateStr.getMinutes() < closeMin)) {
      baseDate.setDate(baseDate.getDate() - 1);
    }
    
    const businessDayStart = `${baseDate.getFullYear()}-${pad(baseDate.getMonth() + 1)}-${pad(baseDate.getDate())}T${pad(baseDate.getHours())}:${pad(baseDate.getMinutes())}:00+03:00`;

    // 1. Today's Sales & Financial Metrics
    const todayRes = await query(`
      SELECT 
        COALESCE(COUNT(id), 0) as total_invoices,
        COALESCE(SUM(grand_total), 0) as gross_sales,
        COALESCE(SUM(subtotal), 0) as net_sales,
        COALESCE(SUM(total_tax), 0) as vat_collected,
        COALESCE(SUM(paid_amount), 0) as cash_collected,
        COALESCE(SUM(due_amount), 0) as credit_sales
      FROM sales
      WHERE created_at >= $1 AND sale_status = 'completed'
    `, [businessDayStart]);

    // Today's COGS (Cost of goods sold from sale_items)
    const cogsRes = await query(`
      SELECT COALESCE(SUM(si.unit_cost * si.quantity), 0) as cogs
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.created_at >= $1 AND s.sale_status = 'completed'
    `, [businessDayStart]);

    // Today's Sales Returns
    const todayRetRes = await query(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as gross_returns,
        COALESCE(SUM(total_amount - tax_amount), 0) as net_returns,
        COALESCE(SUM(tax_amount), 0) as tax_returned
      FROM sales_returns
      WHERE created_at >= $1
    `, [businessDayStart]);

    // Today's Returned COGS
    const todayRetCogsRes = await query(`
      SELECT COALESCE(SUM(sri.quantity * si.unit_cost), 0) as returned_cogs
      FROM sales_return_items sri
      JOIN sale_items si ON sri.sale_item_id = si.id
      JOIN sales_returns sr ON sri.return_id = sr.id
      WHERE sr.created_at >= $1 AND sri.restocked = TRUE
    `, [businessDayStart]);

    // Today's Operating Expenses
    const expRes = await query(`
      SELECT COALESCE(SUM(amount), 0) as today_expenses
      FROM expenses WHERE created_at >= $1
    `, [businessDayStart]);

    const grossSales = round2(Number(todayRes.rows[0].gross_sales) - Number(todayRetRes.rows[0].gross_returns));
    const netSales = round2(Number(todayRes.rows[0].net_sales) - Number(todayRetRes.rows[0].net_returns));
    const rawCogs = Number(cogsRes.rows[0].cogs);
    const returnedCogs = Number(todayRetCogsRes.rows[0].returned_cogs);
    const cogs = round2(Math.max(0, rawCogs - returnedCogs));
    const expenses = Number(expRes.rows[0].today_expenses);
    const grossProfit = round2(netSales - cogs);
    const netProfit = round2(grossProfit - expenses);

    // 2. Inventory Stats
    const invRes = await query(`
      SELECT 
        COUNT(p.id) as total_products,
        COUNT(p.id) FILTER (WHERE COALESCE(sm.current_stock, 0) <= 0) as out_of_stock_count,
        COUNT(p.id) FILTER (WHERE COALESCE(sm.current_stock, 0) > 0 AND COALESCE(sm.current_stock, 0) <= p.min_stock_level) as low_stock_count,
        COALESCE(SUM(COALESCE(sm.current_stock, 0) * p.cost_price), 0) as total_stock_valuation
      FROM products p
      LEFT JOIN (
        SELECT product_id, SUM(quantity) as current_stock 
        FROM stock_movements GROUP BY product_id
      ) sm ON sm.product_id = p.id
      WHERE p.is_active = TRUE
    `);

    // 3. Receivables & Payables
    const recRes = await query(`
      SELECT COALESCE(SUM(balance), 0) as customer_receivables 
      FROM (SELECT DISTINCT ON (customer_id) balance FROM customer_ledger ORDER BY customer_id, id DESC) sub
    `);

    const payRes = await query(`
      SELECT COALESCE(SUM(balance), 0) as supplier_payables 
      FROM (SELECT DISTINCT ON (supplier_id) balance FROM supplier_ledger ORDER BY supplier_id, id DESC) sub
    `);

    // 4. Sales 7-Day Trend (Use Riyadh time for dates)
    const trendRes = await query(`
      SELECT 
        TO_CHAR(d.date, 'Dy (DD/MM)') as day_label,
        COALESCE(SUM(s.grand_total), 0) as total_sales,
        COALESCE(COUNT(s.id), 0) as invoice_count
      FROM (
        SELECT generate_series((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Riyadh')::date - INTERVAL '6 days', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Riyadh')::date, '1 day'::interval)::date as date
      ) d
      LEFT JOIN sales s ON DATE(s.created_at AT TIME ZONE 'Asia/Riyadh') = d.date AND s.sale_status = 'completed'
      GROUP BY d.date ORDER BY d.date ASC
    `);

    // 5. Payment Methods Breakdown
    const payMethodRes = await query(`
      SELECT pm.name as label, COALESCE(SUM(sp.amount), 0) as amount
      FROM payment_methods pm
      LEFT JOIN sale_payments sp ON sp.payment_method_id = pm.id
      GROUP BY pm.name
    `);

    // 6. Top Selling Products
    const topProdRes = await query(`
      SELECT si.product_name, SUM(si.quantity) as total_qty, SUM(si.subtotal) as total_revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.sale_status = 'completed'
      GROUP BY si.product_name ORDER BY total_qty DESC LIMIT 5
    `);

    return reply.send({
      success: true,
      data: {
        today: {
          invoices: Number(todayRes.rows[0].total_invoices),
          grossSales,
          netSales: Number(todayRes.rows[0].net_sales),
          vatCollected: Number(todayRes.rows[0].vat_collected),
          cashCollected: Number(todayRes.rows[0].cash_collected),
          creditSales: Number(todayRes.rows[0].credit_sales),
          cogs,
          grossProfit,
          expenses,
          netProfit,
        },
        inventory: {
          totalProducts: Number(invRes.rows[0].total_products),
          outOfStock: Number(invRes.rows[0].out_of_stock_count),
          lowStock: Number(invRes.rows[0].low_stock_count),
          valuation: round2(Number(invRes.rows[0].total_stock_valuation)),
        },
        balances: {
          customerReceivables: round2(Number(recRes.rows[0].customer_receivables)),
          supplierPayables: round2(Number(payRes.rows[0].supplier_payables)),
        },
        charts: {
          salesTrend: trendRes.rows,
          paymentDistribution: payMethodRes.rows,
        },
        topProducts: topProdRes.rows,
      },
    });
  });

  // GET /api/v1/reports/vat - Saudi ZATCA Tax Filing Report
  fastify.get('/vat', async (request, reply) => {
    const { start_date, end_date } = request.query as any;
    
    // Get first day of current month in Riyadh timezone
    const nowRiyadh = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
    const defaultStart = `${nowRiyadh.getFullYear()}-${pad(nowRiyadh.getMonth() + 1)}-01T00:00:00+03:00`;
    
    const start = start_date ? `${start_date}T00:00:00+03:00` : defaultStart;
    const end = end_date ? `${end_date}T23:59:59+03:00` : `${nowRiyadh.getFullYear()}-${pad(nowRiyadh.getMonth() + 1)}-${pad(nowRiyadh.getDate())}T23:59:59+03:00`;

    // Output VAT (Sales)
    const salesTaxRes = await query(
      `SELECT 
        COALESCE(COUNT(id), 0) as invoice_count,
        COALESCE(SUM(subtotal), 0) as taxable_sales,
        COALESCE(SUM(total_tax), 0) as output_vat,
        COALESCE(SUM(grand_total), 0) as total_sales
       FROM sales
       WHERE created_at >= $1 AND created_at <= $2 AND sale_status = 'completed'`,
      [start, end]
    );

    // Output VAT from Sales Returns (Tax Reversal)
    const retTaxRes = await query(
      `SELECT 
        COALESCE(SUM(total_amount - tax_amount), 0) as returned_taxable,
        COALESCE(SUM(tax_amount), 0) as returned_vat
       FROM sales_returns
       WHERE created_at >= $1 AND created_at <= $2`,
      [start, end]
    );

    // Input VAT (Purchases)
    const purTaxRes = await query(
      `SELECT 
        COALESCE(COUNT(id), 0) as purchase_count,
        COALESCE(SUM(subtotal), 0) as taxable_purchases,
        COALESCE(SUM(total_tax), 0) as input_vat,
        COALESCE(SUM(grand_total), 0) as total_purchases
       FROM purchases
       WHERE created_at >= $1 AND created_at <= $2 AND status = 'received'`,
      [start, end]
    );

    // Input VAT from Purchase Returns (Tax Reversal)
    const purRetTaxRes = await query(
      `SELECT 
        COALESCE(SUM(pri.subtotal), 0) as returned_purchases,
        COALESCE(SUM(pri.tax_amount), 0) as returned_purchase_vat
       FROM purchase_return_items pri
       JOIN purchase_returns pr ON pr.id = pri.return_id
       WHERE pr.created_at >= $1 AND pr.created_at <= $2`,
      [start, end]
    );

    const grossOutputVat = Number(salesTaxRes.rows[0].output_vat);
    const returnedVat = Number(retTaxRes.rows[0].returned_vat);
    const netOutputVat = round2(grossOutputVat - returnedVat);
    const grossInputVat = Number(purTaxRes.rows[0].input_vat);
    const returnedPurchaseVat = Number(purRetTaxRes.rows[0].returned_purchase_vat);
    const inputVat = round2(Math.max(0, grossInputVat - returnedPurchaseVat));
    const netVatPayable = round2(netOutputVat - inputVat);

    return reply.send({
      success: true,
      data: {
        period: { start, end },
        sales: {
          invoiceCount: Number(salesTaxRes.rows[0].invoice_count),
          taxableAmount: round2(Number(salesTaxRes.rows[0].taxable_sales) - Number(retTaxRes.rows[0].returned_taxable)),
          grossOutputVat: round2(grossOutputVat),
          returnedVat: round2(returnedVat),
          outputVat: netOutputVat,
          totalWithVat: round2(Number(salesTaxRes.rows[0].total_sales)),
        },
        purchases: {
          purchaseCount: Number(purTaxRes.rows[0].purchase_count),
          taxableAmount: round2(Math.max(0, Number(purTaxRes.rows[0].taxable_purchases) - Number(purRetTaxRes.rows[0].returned_purchases))),
          grossInputVat: round2(grossInputVat),
          returnedPurchaseVat: round2(returnedPurchaseVat),
          inputVat: inputVat,
          totalWithVat: round2(Number(purTaxRes.rows[0].total_purchases)),
        },
        netVatPayable: netVatPayable,
      },
    });
  });

  // GET /api/v1/reports/pnl - Comprehensive Profit & Loss Statement
  fastify.get('/pnl', async (request, reply) => {
    const { start_date, end_date } = request.query as any;
    const nowRiyadh = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
    const defaultStart = `${nowRiyadh.getFullYear()}-${pad(nowRiyadh.getMonth() + 1)}-01T00:00:00+03:00`;
    
    const start = start_date ? `${start_date}T00:00:00+03:00` : defaultStart;
    const end = end_date ? `${end_date}T23:59:59+03:00` : `${nowRiyadh.getFullYear()}-${pad(nowRiyadh.getMonth() + 1)}-${pad(nowRiyadh.getDate())}T23:59:59+03:00`;

    // 1. Sales Revenue
    const salesRes = await query(
      `SELECT 
        COALESCE(SUM(grand_total), 0) as gross_revenue,
        COALESCE(SUM(subtotal), 0) as taxable_revenue,
        COALESCE(SUM(total_discount), 0) as total_discounts
       FROM sales 
       WHERE created_at >= $1 AND created_at <= $2 AND sale_status = 'completed'`,
      [start, end]
    );

    // 2. Returns
    const retRes = await query(
      `SELECT 
        COALESCE(SUM(total_amount), 0) as total_returns,
        COALESCE(SUM(total_amount - tax_amount), 0) as taxable_returns
       FROM sales_returns 
       WHERE created_at >= $1 AND created_at <= $2`,
      [start, end]
    );

    // 3. COGS & Returned COGS
    const cogsRes = await query(
      `SELECT COALESCE(SUM(si.unit_cost * si.quantity), 0) as cogs
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.created_at >= $1 AND s.created_at <= $2 AND s.sale_status = 'completed'`,
      [start, end]
    );

    const retCogsRes = await query(
      `SELECT COALESCE(SUM(sri.quantity * si.unit_cost), 0) as returned_cogs
       FROM sales_return_items sri
       JOIN sale_items si ON sri.sale_item_id = si.id
       JOIN sales_returns sr ON sri.return_id = sr.id
       WHERE sr.created_at >= $1 AND sr.created_at <= $2 AND sri.restocked = TRUE`,
      [start, end]
    );

    // 4. Expenses by category
    const expRes = await query(
      `SELECT ec.name as category_name, COALESCE(SUM(e.amount), 0) as total_amount
       FROM expenses e
       JOIN expense_categories ec ON ec.id = e.category_id
       WHERE e.date >= $1::date AND e.date <= $2::date
       GROUP BY ec.name ORDER BY total_amount DESC`,
      [start.substring(0, 10), end.substring(0, 10)]
    );

    const grossRevenue = Number(salesRes.rows[0].gross_revenue);
    const taxableRevenue = Number(salesRes.rows[0].taxable_revenue);
    const returns = Number(retRes.rows[0].total_returns);
    const taxableReturns = Number(retRes.rows[0].taxable_returns);
    const discounts = Number(salesRes.rows[0].total_discounts);
    const netRevenue = round2(taxableRevenue - taxableReturns);
    const rawCogs = Number(cogsRes.rows[0].cogs);
    const returnedCogs = Number(retCogsRes.rows[0].returned_cogs);
    const cogs = round2(Math.max(0, rawCogs - returnedCogs));
    const grossProfit = round2(netRevenue - cogs);
    const grossMarginPercent = netRevenue > 0 ? round2((grossProfit / netRevenue) * 100) : 0;

    const totalOperatingExpenses = round2(expRes.rows.reduce((sum, e) => sum + Number(e.total_amount), 0));
    const netOperatingProfit = round2(grossProfit - totalOperatingExpenses);
    const netProfitMarginPercent = netRevenue > 0 ? round2((netOperatingProfit / netRevenue) * 100) : 0;

    return reply.send({
      success: true,
      data: {
        period: { start, end },
        revenue: {
          grossRevenue,
          returns,
          discounts,
          netRevenue,
        },
        costOfGoodsSold: cogs,
        grossProfit,
        grossMarginPercent,
        operatingExpenses: {
          breakdown: expRes.rows,
          total: totalOperatingExpenses,
        },
        netOperatingProfit,
        netProfitMarginPercent,
      },
    });
  });

  // GET /api/v1/reports/inventory-valuation - Valuation by Category
  fastify.get('/inventory-valuation', async (request, reply) => {
    const res = await query(`
      SELECT 
        c.name as category_name,
        COUNT(p.id) as item_count,
        COALESCE(SUM(COALESCE(sm.current_stock, 0)), 0) as total_units,
        COALESCE(SUM(COALESCE(sm.current_stock, 0) * p.cost_price), 0) as total_cost_value,
        COALESCE(SUM(COALESCE(sm.current_stock, 0) * p.selling_price), 0) as total_retail_value
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
      LEFT JOIN (
        SELECT product_id, SUM(quantity) as current_stock 
        FROM stock_movements GROUP BY product_id
      ) sm ON sm.product_id = p.id
      GROUP BY c.name
      ORDER BY total_cost_value DESC
    `);

    const totalCost = round2(res.rows.reduce((s, r) => s + Number(r.total_cost_value), 0));
    const totalRetail = round2(res.rows.reduce((s, r) => s + Number(r.total_retail_value), 0));

    return reply.send({
      success: true,
      data: {
        categories: res.rows,
        summary: {
          totalCostValue: totalCost,
          totalRetailValue: totalRetail,
          potentialGrossMargin: round2(totalRetail - totalCost),
        },
      },
    });
  });

  // GET /api/v1/reports/sales-summary - Sales breakdown by user & category
  fastify.get('/sales-summary', async (request, reply) => {
    const { start_date, end_date } = request.query as any;
    const nowRiyadh = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
    const defaultStart = `${nowRiyadh.getFullYear()}-${pad(nowRiyadh.getMonth() + 1)}-01T00:00:00+03:00`;
    
    const start = start_date ? `${start_date}T00:00:00+03:00` : defaultStart;
    const end = end_date ? `${end_date}T23:59:59+03:00` : `${nowRiyadh.getFullYear()}-${pad(nowRiyadh.getMonth() + 1)}-${pad(nowRiyadh.getDate())}T23:59:59+03:00`;

    const byUserRes = await query(
      `SELECT u.full_name as cashier_name, COUNT(s.id) as invoice_count, COALESCE(SUM(s.grand_total), 0) as total_sales
       FROM users u
       LEFT JOIN sales s ON s.user_id = u.id AND s.sale_status = 'completed' AND s.created_at >= $1 AND s.created_at <= $2
       GROUP BY u.full_name ORDER BY total_sales DESC`,
      [start, end]
    );

    const byCategoryRes = await query(
      `SELECT c.name as category_name, SUM(si.quantity) as total_quantity, SUM(si.subtotal) as total_revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id AND s.sale_status = 'completed' AND s.created_at >= $1 AND s.created_at <= $2
       JOIN products p ON p.id = si.product_id
       JOIN categories c ON c.id = p.category_id
       GROUP BY c.name ORDER BY total_revenue DESC`,
      [start, end]
    );

    return reply.send({
      success: true,
      data: {
        byUser: byUserRes.rows,
        byCategory: byCategoryRes.rows,
      },
    });
  });
}
