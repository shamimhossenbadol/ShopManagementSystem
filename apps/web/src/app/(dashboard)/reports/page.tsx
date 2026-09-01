'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import {
  FileSpreadsheet,
  Receipt,
  DollarSign,
  Boxes,
  Users,
  Printer,
  Calendar,
  Filter,
} from 'lucide-react';

export default function ReportsPage() {
  const { formatCurrency, settings } = useSettings();
  const [activeTab, setActiveTab] = useState<'vat' | 'pnl' | 'inventory' | 'sales'>('vat');

  // Date filters
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  // Report Data States
  const [vatData, setVatData] = useState<any>(null);
  const [pnlData, setPnlData] = useState<any>(null);
  const [invData, setInvData] = useState<any>(null);
  const [salesData, setSalesData] = useState<any>(null);

  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    setLoading(true);

    if (activeTab === 'vat') {
      const res = await apiRequest(`/reports/vat?start_date=${startDate}&end_date=${endDate}T23:59:59`);
      if (res.success && res.data) setVatData(res.data);
    } else if (activeTab === 'pnl') {
      const res = await apiRequest(`/reports/pnl?start_date=${startDate}&end_date=${endDate}T23:59:59`);
      if (res.success && res.data) setPnlData(res.data);
    } else if (activeTab === 'inventory') {
      const res = await apiRequest('/reports/inventory-valuation');
      if (res.success && res.data) setInvData(res.data);
    } else if (activeTab === 'sales') {
      const res = await apiRequest(`/reports/sales-summary?start_date=${startDate}&end_date=${endDate}T23:59:59`);
      if (res.success && res.data) setSalesData(res.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadReport();
  }, [activeTab, startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Financial & Tax Reports</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Saudi ZATCA 15% VAT filing, Profit & Loss statements, and inventory valuation.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          <Printer className="h-4 w-4 text-slate-500" />
          Print Official Report
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => setActiveTab('vat')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 font-bold transition ${
              activeTab === 'vat'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            <Receipt className="h-4 w-4" />
            Saudi VAT Return ({settings.tax_label || '15%'})
          </button>
          <button
            onClick={() => setActiveTab('pnl')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 font-bold transition ${
              activeTab === 'pnl'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            <DollarSign className="h-4 w-4" />
            Profit & Loss (P&L)
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 font-bold transition ${
              activeTab === 'inventory'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            <Boxes className="h-4 w-4" />
            Inventory Valuation
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 font-bold transition ${
              activeTab === 'sales'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            <Users className="h-4 w-4" />
            Sales by Cashier & Cat
          </button>
        </div>

        {/* Date Filter Range */}
        {activeTab !== 'inventory' && (
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 text-xs font-mono text-slate-900 dark:text-white"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 text-xs font-mono text-slate-900 dark:text-white"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-xs text-slate-400">Computing statement figures...</div>
      ) : (
        <>
          {/* TAB 1: VAT RETURN */}
          {activeTab === 'vat' && vatData && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4 gap-2">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">ZATCA VAT Declaration Summary (15%)</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Period: {startDate} to {endDate}</p>
                  </div>
                  <div className="sm:text-right">
                    <div className="text-xs uppercase font-bold text-slate-400">Net Tax Payable / (Refundable)</div>
                    <div className="font-mono text-2xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(vatData.netVatPayable)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Sales Output VAT */}
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-4 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                    <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">1. Output VAT (Taxable Sales)</h3>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Total Taxable Sales (Subtotal):</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(vatData.sales.taxableAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Gross Output VAT (15%):</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(vatData.sales.grossOutputVat)}</span>
                    </div>
                    <div className="flex justify-between text-rose-600 dark:text-rose-400">
                      <span>Less: Sales Return VAT Reversal:</span>
                      <span className="font-mono">- {formatCurrency(vatData.sales.returnedVat)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white">
                      <span>Net Output VAT Collected:</span>
                      <span className="font-mono text-blue-600 dark:text-blue-400">{formatCurrency(vatData.sales.outputVat)}</span>
                    </div>
                  </div>

                  {/* Purchases Input VAT */}
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-4 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                    <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">2. Input VAT (Procurement & Purchases)</h3>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Total Taxable Purchases:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(vatData.purchases.taxableAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Eligible Input VAT (15%):</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(vatData.purchases.inputVat)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white">
                      <span>Total Input Tax Credit:</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(vatData.purchases.inputVat)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: P&L */}
          {activeTab === 'pnl' && pnlData && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Income Statement (Profit & Loss)</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Period: {startDate} to {endDate}</p>
                </div>

                <div className="space-y-4 text-xs font-mono">
                  {/* Revenue */}
                  <div>
                    <div className="font-sans font-bold text-slate-900 dark:text-white mb-2 uppercase text-[11px] text-slate-400">Revenue & Inflow</div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                      <span className="font-sans text-slate-700 dark:text-slate-300">Gross Sales Volume</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(pnlData.revenue.grossRevenue)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 text-rose-600 dark:text-rose-400">
                      <span className="font-sans">Less: Sales Returns & Refunds</span>
                      <span>- {formatCurrency(pnlData.revenue.returns)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 font-bold text-slate-900 dark:text-white">
                      <span className="font-sans">Net Sales Revenue</span>
                      <span>{formatCurrency(pnlData.revenue.netRevenue)}</span>
                    </div>
                  </div>

                  {/* COGS & Gross Profit */}
                  <div>
                    <div className="font-sans font-bold text-slate-900 dark:text-white mb-2 uppercase text-[11px] text-slate-400">Cost of Goods Sold (WAC)</div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 text-rose-600 dark:text-rose-400">
                      <span className="font-sans">Cost of Goods Sold (Inventory Acquisition Cost)</span>
                      <span>- {formatCurrency(pnlData.costOfGoodsSold)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 font-bold text-blue-600 dark:text-blue-400 text-sm">
                      <span className="font-sans">GROSS PROFIT MARGIN ({pnlData.grossMarginPercent}%)</span>
                      <span>{formatCurrency(pnlData.grossProfit)}</span>
                    </div>
                  </div>

                  {/* Operating Expenses */}
                  <div>
                    <div className="font-sans font-bold text-slate-900 dark:text-white mb-2 uppercase text-[11px] text-slate-400">Operating Expenses (Overhead)</div>
                    {pnlData.operatingExpenses.breakdown.map((exp: any, idx: number) => (
                      <div key={idx} className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 text-slate-600 dark:text-slate-400">
                        <span className="font-sans">{exp.category_name}</span>
                        <span>- {formatCurrency(exp.total_amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 font-bold text-rose-600 dark:text-rose-400">
                      <span className="font-sans">Total Operating Expenses</span>
                      <span>- {formatCurrency(pnlData.operatingExpenses.total)}</span>
                    </div>
                  </div>

                  {/* Net Operating Profit */}
                  <div className="pt-2 border-t-2 border-slate-900 dark:border-slate-700 flex justify-between items-baseline text-base font-black text-emerald-600 dark:text-emerald-400">
                    <span className="font-sans">NET OPERATING PROFIT ({pnlData.netProfitMarginPercent}%)</span>
                    <span className="text-xl">{formatCurrency(pnlData.netOperatingProfit)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INVENTORY VALUATION */}
          {activeTab === 'inventory' && invData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                  <div className="text-xs font-bold uppercase text-slate-400">Total Asset Cost (WAC)</div>
                  <div className="mt-2 font-mono text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(invData.summary.totalCostValue)}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Warehouse inventory at acquisition cost</div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                  <div className="text-xs font-bold uppercase text-slate-400">Total Retail Value</div>
                  <div className="mt-2 font-mono text-2xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(invData.summary.totalRetailValue)}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Projected shelf retail value</div>
                </div>
                <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 shadow-sm">
                  <div className="text-xs font-bold uppercase text-emerald-800 dark:text-emerald-300">Potential Gross Margin</div>
                  <div className="mt-2 font-mono text-2xl font-black text-emerald-900 dark:text-emerald-300">{formatCurrency(invData.summary.potentialGrossMargin)}</div>
                  <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">Projected markup profit</div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-[10px] font-bold uppercase text-slate-400">
                      <tr>
                        <th className="p-4">Category</th>
                        <th className="p-4 text-center">SKUs</th>
                        <th className="p-4 text-center">Total Units</th>
                        <th className="p-4 text-right">Cost Valuation (WAC)</th>
                        <th className="p-4 text-right">Retail Valuation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {invData.categories.map((c: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                          <td className="p-4 font-bold text-slate-900 dark:text-white">{c.category_name}</td>
                          <td className="p-4 text-center font-mono">{c.item_count}</td>
                          <td className="p-4 text-center font-mono">{c.total_units}</td>
                          <td className="p-4 text-right font-mono text-slate-900 dark:text-white">{formatCurrency(c.total_cost_value)}</td>
                          <td className="p-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">{formatCurrency(c.total_retail_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SALES SUMMARY */}
          {activeTab === 'sales' && salesData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* By Cashier */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Sales Performance by Cashier</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                      <tr>
                        <th className="pb-2">Cashier</th>
                        <th className="pb-2 text-center">Invoices</th>
                        <th className="pb-2 text-right">Volume</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {salesData.byUser.map((u: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                          <td className="py-2.5 font-bold text-slate-900 dark:text-white">{u.cashier_name}</td>
                          <td className="py-2.5 text-center font-mono">{u.invoice_count}</td>
                          <td className="py-2.5 text-right font-mono font-bold text-blue-600 dark:text-blue-400">{formatCurrency(u.total_sales)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* By Category */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Sales Breakdown by Product Category</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                      <tr>
                        <th className="pb-2">Category</th>
                        <th className="pb-2 text-center">Quantity Sold</th>
                        <th className="pb-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {salesData.byCategory.map((cat: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                          <td className="py-2.5 font-bold text-slate-900 dark:text-white">{cat.category_name}</td>
                          <td className="py-2.5 text-center font-mono">{cat.total_quantity}</td>
                          <td className="py-2.5 text-right font-mono font-bold text-blue-600 dark:text-blue-400">{formatCurrency(cat.total_revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
