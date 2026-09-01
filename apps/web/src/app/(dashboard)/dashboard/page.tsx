'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import {
  TrendingUp,
  Receipt,
  Boxes,
  AlertTriangle,
  Users,
  Building2,
  DollarSign,
  ShoppingCart,
  PackagePlus,
  Truck,
  ReceiptText,
  Database,
  Flame,
  Calendar,
  Percent,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { formatCurrency, settings } = useSettings();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const res = await apiRequest('/reports/dashboard');
      if (res.success && res.data) {
        setData(res.data);
      }
      setLoading(false);
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center text-slate-500 text-xs font-semibold animate-pulse">
          Loading Live Super Shop Analytics...
        </div>
      </div>
    );
  }

  const { today, inventory, balances, charts, topProducts } = data || {};
  const maxTrend = Math.max(...(charts?.salesTrend?.map((t: any) => Number(t.total_sales)) || [100]), 100);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl bg-blue-600 p-6 text-white shadow-lg shadow-blue-600/20">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">
            {settings.shop_name_en || 'AL-NOOR SUPERMARKET & HYPERMARKET'}
          </h1>
          <p className="text-xs text-blue-100 mt-1">
            Real-time daily operations, profit calculations, inventory health, and ZATCA compliance (KSA).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/pos')}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-xs font-black text-white shadow-md transition"
          >
            <ShoppingCart className="h-4 w-4" />
            Launch POS Terminal
          </button>
          <span className="hidden md:inline-block rounded-xl bg-blue-700/60 border border-blue-400/30 px-3 py-2 text-xs font-bold text-white font-mono">
            {settings.timezone || 'Asia/Riyadh'}
          </span>
        </div>
      </div>

      {/* Quick Actions Shortcuts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <button
          onClick={() => router.push('/pos')}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:border-blue-500 hover:text-blue-600 transition"
        >
          <ShoppingCart className="h-4 w-4 text-blue-600" />
          POS Counter
        </button>
        <button
          onClick={() => router.push('/products')}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:border-blue-500 hover:text-blue-600 transition"
        >
          <PackagePlus className="h-4 w-4 text-purple-600" />
          Catalog
        </button>
        <button
          onClick={() => router.push('/batches')}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:border-blue-500 hover:text-blue-600 transition"
        >
          <Calendar className="h-4 w-4 text-amber-500" />
          Batches & Expiry
        </button>
        <button
          onClick={() => router.push('/promotions')}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:border-blue-500 hover:text-blue-600 transition"
        >
          <Percent className="h-4 w-4 text-emerald-500" />
          Deals Engine
        </button>
        <button
          onClick={() => router.push('/purchases')}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:border-blue-500 hover:text-blue-600 transition"
        >
          <Truck className="h-4 w-4 text-cyan-600" />
          Purchases
        </button>
        <button
          onClick={() => router.push('/settings')}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:border-blue-500 hover:text-blue-600 transition"
        >
          <Database className="h-4 w-4 text-rose-500" />
          Customizer
        </button>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Today Gross Sales */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Today's Gross Sales</span>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-2 text-blue-600 dark:text-blue-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 font-mono text-2xl font-black text-slate-900 dark:text-white">
            {formatCurrency(today?.grossSales || 0)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Receipt className="h-3.5 w-3.5" />
            <span>{today?.invoices || 0} Invoices Finalized</span>
          </div>
        </div>

        {/* Today's Net Profit */}
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-emerald-800 dark:text-emerald-300">Today's Net Profit</span>
            <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/40 p-2 text-emerald-700 dark:text-emerald-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 font-mono text-2xl font-black text-emerald-900 dark:text-emerald-300">
            {formatCurrency(today?.netProfit || 0)}
          </div>
          <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
            Gross Margin: {formatCurrency(today?.grossProfit || 0)}
          </div>
        </div>

        {/* VAT Collected */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Output VAT Collected</span>
            <div className="rounded-xl bg-purple-50 dark:bg-purple-950/40 p-2 text-purple-600 dark:text-purple-400">
              <Receipt className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 font-mono text-2xl font-black text-slate-900 dark:text-white">
            {formatCurrency(today?.vatCollected || 0)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Saudi ZATCA Output Tax</div>
        </div>

        {/* Stock Valuation */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Stock Valuation (WAC)</span>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-2 text-amber-600 dark:text-amber-400">
              <Boxes className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 font-mono text-2xl font-black text-slate-900 dark:text-white">
            {formatCurrency(inventory?.valuation || 0)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{inventory?.totalProducts || 0} Total Active SKUs</div>
        </div>
      </div>

      {/* Secondary Status & Balances Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Customer Receivables */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 dark:bg-blue-950/50 p-2.5 text-blue-700 dark:text-blue-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Customer Due Balance (Receivables)</div>
              <div className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                {formatCurrency(balances?.customerReceivables || 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Supplier Payables */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 dark:bg-amber-950/50 p-2.5 text-amber-700 dark:text-amber-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Supplier Due Balance (Payables)</div>
              <div className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                {formatCurrency(balances?.supplierPayables || 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-rose-100 dark:bg-rose-900/50 p-2.5 text-rose-700 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-rose-800 dark:text-rose-300">Low Stock / Out of Stock SKUs</div>
              <div className="font-mono text-lg font-bold text-rose-900 dark:text-rose-300">
                {inventory?.lowStock || 0} Low / {inventory?.outOfStock || 0} Out
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Grid: 7-Day Trend + Top Selling Products */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 7-Day Sales Trend (2 Cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center justify-between">
            <span>7-Day Sales Performance</span>
            <span className="text-xs text-slate-400 font-normal">Volume & Transactions</span>
          </h2>
          <div className="h-52 flex items-end justify-between gap-3 pt-6">
            {charts?.salesTrend?.map((t: any, idx: number) => {
              const heightPct = Math.max(8, Math.round((Number(t.total_sales) / maxTrend) * 100));
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition">
                    {formatCurrency(t.total_sales)}
                  </div>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className="w-full rounded-t-xl bg-blue-600 hover:bg-blue-500 transition-all duration-300 shadow-sm"
                  />
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">{t.day_label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Selling Products (1 Col) */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-500" />
            Top Selling Products
          </h2>
          <div className="space-y-3">
            {topProducts?.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No sales registered today yet.</p>
            ) : (
              topProducts?.map((p: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 text-xs">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white line-clamp-1">{p.product_name}</div>
                    <div className="text-[10px] text-slate-400">{p.total_qty} units sold</div>
                  </div>
                  <div className="font-mono font-bold text-blue-600 dark:text-blue-400">{formatCurrency(p.total_revenue)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* P&L Breakdown Summary Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Today's Profit & Loss Breakdown</h2>
        <div className="space-y-3 font-mono text-sm">
          <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <span className="text-slate-600 dark:text-slate-400 font-sans">Gross Sales Revenue:</span>
            <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(today?.grossSales || 0)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2 text-rose-600 dark:text-rose-400">
            <span className="text-slate-600 dark:text-slate-400 font-sans">Less: Cost of Goods Sold (COGS based on WAC):</span>
            <span>- {formatCurrency(today?.cogs || 0)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2 font-bold text-slate-900 dark:text-white">
            <span className="font-sans">Gross Profit Margin:</span>
            <span>{formatCurrency(today?.grossProfit || 0)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2 text-rose-600 dark:text-rose-400">
            <span className="text-slate-600 dark:text-slate-400 font-sans">Less: Operating Expenses (Petty cash & bills):</span>
            <span>- {formatCurrency(today?.expenses || 0)}</span>
          </div>
          <div className="flex justify-between pt-1 text-lg font-black text-emerald-600 dark:text-emerald-400">
            <span className="font-sans">NET STORE PROFIT:</span>
            <span>{formatCurrency(today?.netProfit || 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
