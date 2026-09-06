'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { Button, IconButton } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { MetricCard } from '@/components/ui/MetricCard';
import {
  FileSpreadsheet,
  Receipt,
  DollarSign,
  Boxes,
  Users,
  Printer,
  Calendar,
  Filter,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ShieldCheck,
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
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            Financial & Tax Reports
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Saudi ZATCA 15% VAT filing returns, Income statement (P&L), and perpetual WAC inventory valuation.
          </p>
        </div>
        <Button
          variant="secondary"
          size="md"
          onClick={() => window.print()}
          leftIcon={<Printer className="h-4 w-4" />}
        >
          Print Official Statement
        </Button>
      </div>

      {/* Tabs & Date Range Filter Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        {/* Tab Pills */}
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { id: 'vat', label: `Saudi VAT Return (${settings.tax_label || '15%'})`, icon: Receipt },
            { id: 'pnl', label: 'Profit & Loss (P&L)', icon: DollarSign },
            { id: 'inventory', label: 'Inventory Valuation', icon: Boxes },
            { id: 'sales', label: 'Cashier & Category Sales', icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 font-bold transition ${
                  isActive
                    ? 'bg-blue-700 text-white shadow-sm dark:bg-sky-500 dark:text-slate-950'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Date Range Picker */}
        {activeTab !== 'inventory' && (
          <div className="flex items-center gap-2 text-xs rounded-2xl bg-white dark:bg-slate-900 p-1.5 border border-slate-200 dark:border-slate-800">
            <Calendar className="h-4 w-4 text-slate-400 ml-2" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-xl bg-slate-50 dark:bg-slate-950 p-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white border-0 focus:ring-0"
            />
            <span className="text-slate-400 font-bold">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-xl bg-slate-50 dark:bg-slate-950 p-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white border-0 focus:ring-0"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-xs text-slate-400 font-semibold">
          Computing statement calculations...
        </div>
      ) : (
        <div id="printable-report">
          {/* TAB 1: VAT RETURN */}
          {activeTab === 'vat' && vatData && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6 gap-2">
                  <div>
                    <h2 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white">
                      ZATCA VAT Declaration Summary (15%)
                    </h2>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Filing Period: {startDate} to {endDate}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <div className="text-xs uppercase font-bold text-slate-400">Net Tax Payable to ZATCA</div>
                    <div className="font-mono text-3xl font-black text-blue-700 dark:text-sky-400">
                      {formatCurrency(vatData.netVatPayable)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Sales Output VAT */}
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-850 p-5 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                    <h3 className="font-bold uppercase tracking-wider text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                      1. Output VAT (Taxable Sales)
                    </h3>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Total Taxable Sales (Subtotal):</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(vatData.sales.taxableAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Gross Output VAT (15%):</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(vatData.sales.grossOutputVat)}
                      </span>
                    </div>
                    <div className="flex justify-between text-red-600 dark:text-red-400">
                      <span>Less: Sales Return Credit Notes:</span>
                      <span className="font-mono font-bold">- {formatCurrency(vatData.sales.returnedVat)}</span>
                    </div>
                    <div className="flex justify-between pt-3 border-t border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white text-sm">
                      <span>Net Output VAT Collected:</span>
                      <span className="font-mono text-blue-700 dark:text-sky-400">
                        {formatCurrency(vatData.sales.outputVat)}
                      </span>
                    </div>
                  </div>

                  {/* Purchases Input VAT */}
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-850 p-5 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                    <h3 className="font-bold uppercase tracking-wider text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                      2. Input VAT (Procurement & Purchases)
                    </h3>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Total Taxable Purchases:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(vatData.purchases.taxableAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Eligible Input VAT (15%):</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(vatData.purchases.inputVat)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-3 border-t border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white text-sm">
                      <span>Total Input Tax Credit:</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(vatData.purchases.inputVat)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: P&L */}
          {activeTab === 'pnl' && pnlData && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
                  <h2 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white">
                    Income Statement (Profit & Loss)
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Period: {startDate} to {endDate}
                  </p>
                </div>

                <div className="space-y-6 text-xs font-mono">
                  {/* Revenue */}
                  <div className="space-y-2">
                    <div className="font-sans font-black uppercase text-[11px] text-slate-400">
                      1. Revenue & Sales Inflow
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <span className="font-sans text-slate-700 dark:text-slate-300">Gross Sales Volume</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatCurrency(pnlData.revenue.grossRevenue)}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2 text-red-600 dark:text-red-400">
                      <span className="font-sans">Less: Sales Returns & Refunds</span>
                      <span>- {formatCurrency(pnlData.revenue.returns)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2 font-bold text-slate-900 dark:text-white">
                      <span className="font-sans">Net Sales Revenue</span>
                      <span>{formatCurrency(pnlData.revenue.netRevenue)}</span>
                    </div>
                  </div>

                  {/* COGS & Gross Profit */}
                  <div className="space-y-2">
                    <div className="font-sans font-black uppercase text-[11px] text-slate-400">
                      2. Cost of Goods Sold (Perpetual WAC Basis)
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2 text-red-600 dark:text-red-400">
                      <span className="font-sans">COGS (Inventory Acquisition Cost)</span>
                      <span>- {formatCurrency(pnlData.costOfGoodsSold)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2 font-bold text-blue-700 dark:text-sky-400 text-sm">
                      <span className="font-sans">GROSS PROFIT MARGIN ({pnlData.grossMarginPercent}%)</span>
                      <span>{formatCurrency(pnlData.grossProfit)}</span>
                    </div>
                  </div>

                  {/* Operating Expenses */}
                  <div className="space-y-2">
                    <div className="font-sans font-black uppercase text-[11px] text-slate-400">
                      3. Operational Overhead Expenses
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2 text-red-600 dark:text-red-400">
                      <span className="font-sans">Total Operating Expenses (Rent, Utilities, Staff)</span>
                      <span>- {formatCurrency(pnlData.operatingExpenses)}</span>
                    </div>
                  </div>

                  {/* Net Operating Profit */}
                  <div className="rounded-2xl bg-blue-50 dark:bg-sky-950/40 p-4 border border-blue-200 dark:border-sky-900/40 flex justify-between items-center text-sm font-black">
                    <span className="font-sans uppercase text-blue-950 dark:text-sky-200">
                      NET OPERATING PROFIT (EBIT)
                    </span>
                    <span className="font-mono text-xl text-blue-700 dark:text-sky-400">
                      {formatCurrency(pnlData.netProfit)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INVENTORY VALUATION */}
          {activeTab === 'inventory' && invData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MetricCard
                  label="Total Stock Valuation (WAC Cost)"
                  value={formatCurrency(invData.totalValuation)}
                  subValue="Asset Book Value"
                  icon={<Boxes className="h-5 w-5" />}
                  variant="primary"
                />
                <MetricCard
                  label="Retail Value (Selling Price)"
                  value={formatCurrency(invData.totalRetailValue)}
                  subValue="Expected Sales Realization"
                  icon={<DollarSign className="h-5 w-5" />}
                  variant="success"
                />
              </div>

              <DataTable
                data={invData.items || []}
                keyExtractor={(it: any) => it.id}
                emptyMessage="No inventory items to evaluate."
                columns={[
                  {
                    header: 'Product Name / SKU',
                    accessor: (it: any) => (
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{it.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">SKU: {it.sku}</div>
                      </div>
                    ),
                  },
                  {
                    header: 'Category',
                    accessor: (it: any) => <span>{it.category_name || 'General'}</span>,
                  },
                  {
                    header: 'Current Stock',
                    align: 'center',
                    accessor: (it: any) => (
                      <span className="font-mono font-bold">{it.current_stock}</span>
                    ),
                  },
                  {
                    header: 'WAC Cost',
                    align: 'right',
                    accessor: (it: any) => (
                      <span className="font-mono">{formatCurrency(it.cost_price)}</span>
                    ),
                  },
                  {
                    header: 'Valuation',
                    align: 'right',
                    accessor: (it: any) => (
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(it.valuation)}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          )}

          {/* TAB 4: SALES BY CASHIER & CAT */}
          {activeTab === 'sales' && salesData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cashier Performance */}
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
                  <h3 className="font-bold uppercase text-xs tracking-wider text-slate-900 dark:text-white">
                    Cashier Performance Leaderboard
                  </h3>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {salesData.cashiers?.map((c: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center py-2.5 text-xs">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{c.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{c.invoiceCount} Invoices</div>
                        </div>
                        <div className="font-mono font-bold text-blue-700 dark:text-sky-400">
                          {formatCurrency(c.totalSales)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Category Breakdown */}
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
                  <h3 className="font-bold uppercase text-xs tracking-wider text-slate-900 dark:text-white">
                    Category Sales Breakdown
                  </h3>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {salesData.categories?.map((cat: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center py-2.5 text-xs">
                        <div className="font-bold text-slate-900 dark:text-white">{cat.name}</div>
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          {formatCurrency(cat.totalSales)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
