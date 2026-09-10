'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { MetricCard } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  TrendingUp,
  Receipt,
  Boxes,
  AlertTriangle,
  Users,
  Building2,
  DollarSign,
  Flame,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { formatCurrency } = useSettings();
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
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent dark:border-sky-400 dark:border-t-transparent" />
        <div className="text-xs font-bold text-slate-500 animate-pulse">
          Computing Real-time Super Shop Financials...
        </div>
      </div>
    );
  }

  const { today, inventory, balances, charts, topProducts } = data || {};
  const maxTrend = Math.max(
    ...(charts?.salesTrend?.map((t: any) => Number(t.total_sales)) || [100]),
    100
  );

  return (
    <div className="space-y-6">
      {/* 8 Core Real-time KPI Matrix */}
      <div>
        <div className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 px-1">
          Real-Time Operational KPIs
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Today Gross Sales */}
          <MetricCard
            label="Today Gross Sales"
            value={formatCurrency(today?.grossSales || 0)}
            subValue={`${today?.invoices || 0} Invoices Issued`}
            icon={<TrendingUp className="h-5 w-5" />}
            variant="primary"
            trend={{ value: '+12.4%', isPositive: true }}
            onClick={() => router.push('/reports')}
          />

          {/* 2. Today Net Store Profit */}
          <MetricCard
            label="Today Net Store Profit"
            value={formatCurrency(today?.netProfit || 0)}
            subValue={`Gross Margin: ${formatCurrency(today?.grossProfit || 0)}`}
            icon={<DollarSign className="h-5 w-5" />}
            variant="success"
            onClick={() => router.push('/reports')}
          />

          {/* 3. Output VAT (15%) */}
          <MetricCard
            label="Output VAT Collected"
            value={formatCurrency(today?.vatCollected || 0)}
            subValue="ZATCA Standard Rate (15%)"
            icon={<Receipt className="h-5 w-5" />}
            variant="info"
            onClick={() => router.push('/reports')}
          />

          {/* 4. Inventory Valuation (WAC) */}
          <MetricCard
            label="Inventory Valuation"
            value={formatCurrency(inventory?.valuation || 0)}
            subValue={`${inventory?.totalProducts || 0} Total Active SKUs`}
            icon={<Boxes className="h-5 w-5" />}
            variant="warning"
            onClick={() => router.push('/inventory')}
          />

          {/* 5. Customer Receivables */}
          <MetricCard
            label="Customer Receivables"
            value={formatCurrency(balances?.customerReceivables || 0)}
            subValue="Outstanding Credit Debt"
            icon={<Users className="h-5 w-5" />}
            variant="default"
            onClick={() => router.push('/customers')}
          />

          {/* 6. Supplier Payables */}
          <MetricCard
            label="Supplier Payables"
            value={formatCurrency(balances?.supplierPayables || 0)}
            subValue="Accounts Payable Debt"
            icon={<Building2 className="h-5 w-5" />}
            variant="default"
            onClick={() => router.push('/suppliers')}
          />

          {/* 7. Stock Alerts */}
          <MetricCard
            label="Stock Health Alerts"
            value={`${inventory?.lowStock || 0} Low / ${inventory?.outOfStock || 0} Out`}
            subValue="Reorder Required"
            icon={<AlertTriangle className="h-5 w-5" />}
            variant="danger"
            onClick={() => router.push('/inventory')}
          />

          {/* 8. Cash Drawer Tender */}
          <MetricCard
            label="Cash Register Tender"
            value={formatCurrency(balances?.cashDrawer || 0)}
            subValue="Active Shift Cash Float"
            icon={<ShieldCheck className="h-5 w-5" />}
            variant="default"
            onClick={() => router.push('/cash')}
          />
        </div>
      </div>

      {/* Visual Analytics Grid: 7-Day Trend + Top Selling Products Leaderboard */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 7-Day Sales Trend (2 Cols) */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
                7-Day Sales Revenue & Volume Trend
              </h2>
              <p className="text-xs text-slate-400 font-medium">Daily gross turnover with peak highlights</p>
            </div>
            <Badge variant="primary" icon={<TrendingUp className="h-3 w-3" />}>
              Live Stream
            </Badge>
          </div>

          <div className="h-56 flex items-end justify-between gap-3 pt-6">
            {charts?.salesTrend?.map((t: any, idx: number) => {
              const heightPct = Math.max(10, Math.round((Number(t.total_sales) / maxTrend) * 100));
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                    {formatCurrency(t.total_sales)}
                  </div>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className="w-full rounded-t-xl bg-blue-700 hover:bg-blue-600 dark:bg-sky-500 dark:hover:bg-sky-400 transition-all duration-300 shadow-sm"
                  />
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {t.day_label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Selling Products Leaderboard (1 Col) */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-500" />
              <span>Top Fast-Moving SKUs</span>
            </h2>
            <span className="text-[11px] font-bold text-slate-400">Today</span>
          </div>

          <div className="space-y-3">
            {topProducts?.length === 0 ? (
              <p className="text-xs text-slate-400 py-12 text-center font-medium">
                No transactions completed today yet.
              </p>
            ) : (
              topProducts?.map((p: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 font-mono font-black text-slate-700 dark:text-slate-300 text-[11px]">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white line-clamp-1">{p.product_name}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{p.total_qty} units sold</div>
                    </div>
                  </div>
                  <div className="font-mono font-bold text-blue-700 dark:text-sky-400">
                    {formatCurrency(p.total_revenue)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Real-time P&L Statement Card */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white">
              Today's Profit & Loss Financial Breakdown (WAC)
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              Calculated dynamically from transactional line-item cost snapshots and operating expenses
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push('/reports')}
            rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
          >
            Full P&L Report
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Gross Sales</div>
            <div className="mt-2 font-mono text-xl font-black text-slate-900 dark:text-white">
              {formatCurrency(today?.grossSales || 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Total revenue collected</div>
          </div>

          <div className="rounded-2xl bg-red-50/60 dark:bg-red-950/30 p-4 border border-red-200 dark:border-red-900/40">
            <div className="text-xs font-bold text-red-800 dark:text-red-300 uppercase">Less: COGS (WAC)</div>
            <div className="mt-2 font-mono text-xl font-black text-red-900 dark:text-red-300">
              - {formatCurrency(today?.cogs || 0)}
            </div>
            <div className="text-[11px] text-red-700/70 dark:text-red-400 mt-1">Direct product acquisition cost</div>
          </div>

          <div className="rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 p-4 border border-amber-200 dark:border-amber-900/40">
            <div className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase">Less: Expenses</div>
            <div className="mt-2 font-mono text-xl font-black text-amber-900 dark:text-amber-300">
              - {formatCurrency(today?.expenses || 0)}
            </div>
            <div className="text-[11px] text-amber-700/70 dark:text-amber-400 mt-1">Petty cash & operating bills</div>
          </div>

          <div className="rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/50 p-4 border border-emerald-300 dark:border-emerald-800">
            <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">Net Store Profit</div>
            <div className="mt-2 font-mono text-2xl font-black text-emerald-900 dark:text-emerald-300">
              {formatCurrency(today?.netProfit || 0)}
            </div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-bold">
              Net Margin: {today?.grossSales > 0 ? ((today.netProfit / today.grossSales) * 100).toFixed(1) : '0.0'}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
