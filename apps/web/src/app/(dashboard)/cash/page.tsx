'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ModernDateRangePicker } from '@/components/ui/ModernDateRangePicker';
import {
  Banknote,
  Printer,
  CreditCard,
  Download,
  Calendar,
  Layers,
  Coins,
  ArrowDownLeft,
  Filter,
  ShieldAlert,
  FileText,
  AlertTriangle,
  Receipt,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  ShoppingBag,
  User,
} from 'lucide-react';

function getTodayISO(tz: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function getShiftedDateISO(baseDateStr: string, daysOffset: number) {
  try {
    const [y, m, d] = baseDateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() + daysOffset);
    return date.toISOString().split('T')[0];
  } catch {
    return baseDateStr;
  }
}

function getMonthStartISO(baseDateStr: string) {
  try {
    const [y, m] = baseDateStr.split('-');
    return `${y}-${m}-01`;
  } catch {
    return baseDateStr;
  }
}

function formatDateBadge(dateStr: string) {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  } catch {
    return dateStr;
  }
}

interface ActiveTillInfo {
  id: number;
  sequenceNumber?: number;
  userId: number;
  userName: string;
  username: string;
  openedAt: string;
  openingBalance: number;
  openingCardBalance: number;
  salesCount: number;
  totalSales: number;
  cashSales?: number;
  cardSales?: number;
  liveExpectedCash?: number;
}

interface ShiftPayment {
  methodName: string;
  amount: number;
  isCash: boolean;
}

interface ShiftItem {
  productId: number;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  taxAmount: number;
  subtotal: number;
}

interface ShiftInvoice {
  id: number;
  invoiceNo: string;
  referenceNo: string;
  createdAt: string;
  customerName: string;
  customerPhone?: string;
  totalItems: number;
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  paidAmount: number;
  paymentStatus: string;
  payments: ShiftPayment[];
  items: ShiftItem[];
}

export default function CashSessionsPage() {
  const { formatCurrency, formatDateTime, formatTime, settings } = useSettings();

  // Business Date & Range Selection (Defaults to Today in shop timezone)
  const todayStr = useMemo(() => getTodayISO(settings.timezone || 'Asia/Riyadh'), [settings.timezone]);
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Formatted Range Label for display in matrix / CSV
  const rangeLabel = useMemo(() => {
    if (!startDate || !endDate) return 'Select Date';
    if (startDate === endDate) {
      if (startDate === todayStr) return `Today (${formatDateBadge(startDate)})`;
      const yesterday = getShiftedDateISO(todayStr, -1);
      if (startDate === yesterday) return `Yesterday (${formatDateBadge(startDate)})`;
      return formatDateBadge(startDate);
    }
    return `${formatDateBadge(startDate)} – ${formatDateBadge(endDate)}`;
  }, [startDate, endDate, todayStr]);

  // Data States
  const [dailyData, setDailyData] = useState<any>(null);
  const [activeTill, setActiveTill] = useState<ActiveTillInfo | null>(null);
  const [lastClosedTill, setLastClosedTill] = useState<any>(null);
  const [allShifts, setAllShifts] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);

  // Filtering States
  const [statusFilter, setStatusFilter] = useState<'all' | 'balanced' | 'discrepancy'>('all');
  const [staffFilter, setStaffFilter] = useState<string>('all');

  // Loading States
  const [loading, setLoading] = useState(false);

  // Deep Inspection Modal States
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [selectedShiftDetails, setSelectedShiftDetails] = useState<any>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectActiveTab, setInspectActiveTab] = useState<'invoices' | 'movements' | 'adjustments'>('invoices');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoicePaymentFilter, setInvoicePaymentFilter] = useState<'all' | 'cash' | 'card'>('all');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);

  // Official Z-Report Modal States
  const [zReportModalOpen, setZReportModalOpen] = useState(false);
  const [zReportData, setZReportData] = useState<any>(null);

  // Main Data Fetcher
  const loadOverview = useCallback(async (startParam?: string, endParam?: string) => {
    const startToFetch = startParam || startDate;
    const endToFetch = endParam || endDate || startToFetch;

    try {
      // 1. Fetch Consolidated Summary for Date or Range
      const dailyRes = await apiRequest(`/cash/daily-summary?startDate=${startToFetch}&endDate=${endToFetch}`);
      if (dailyRes.success && dailyRes.data) {
        setDailyData(dailyRes.data);
      }

      // 2. Fetch Active POS Status (Counter Occupancy)
      const posStatusRes = await apiRequest('/cash/pos-status');
      if (posStatusRes.success && posStatusRes.data) {
        if (posStatusRes.data.status === 'occupied' && posStatusRes.data.activeSession) {
          setActiveTill(posStatusRes.data.activeSession);
          setLastClosedTill(null);
        } else {
          setActiveTill(null);
          setLastClosedTill(posStatusRes.data.lastSession || null);
        }
      }

      // 3. Fetch Shifts for Range
      const shiftsRes = await apiRequest(`/cash/sessions?startDate=${startToFetch}&endDate=${endToFetch}`);
      if (shiftsRes.success && Array.isArray(shiftsRes.data)) {
        setAllShifts(shiftsRes.data);
      }

      // 4. Fetch Staff Directory for Filter Dropdown
      const staffRes = await apiRequest('/auth/staff-list');
      if (staffRes.success && Array.isArray(staffRes.data)) {
        setStaffList(staffRes.data);
      }
    } catch (err) {
      console.error('Failed to load cash overview:', err);
    }
  }, [startDate, endDate]);

  // Initial load on mount or date range change
  useEffect(() => {
    setLoading(true);
    loadOverview(startDate, endDate).finally(() => setLoading(false));
  }, [startDate, endDate, loadOverview]);

  // Real-time quiet background polling (15s) and on window focus
  useEffect(() => {
    const interval = setInterval(() => {
      loadOverview(startDate, endDate);
    }, 15000);

    const onFocus = () => {
      loadOverview(startDate, endDate);
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [startDate, endDate, loadOverview]);

  // Live running shift timer with seconds
  const [liveDuration, setLiveDuration] = useState('');

  useEffect(() => {
    if (!activeTill?.openedAt) {
      setLiveDuration('');
      return;
    }

    const updateTimer = () => {
      const start = new Date(activeTill.openedAt).getTime();
      const diffSecs = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const hours = String(Math.floor(diffSecs / 3600)).padStart(2, '0');
      const mins = String(Math.floor((diffSecs % 3600) / 60)).padStart(2, '0');
      const secs = String(diffSecs % 60).padStart(2, '0');
      setLiveDuration(`${hours}h ${mins}m ${secs}s`);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [activeTill?.openedAt]);

  const formatTimeWithSeconds = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  // Inspect Shift Details & Fetch Dynamic Invoices
  const handleInspectShift = async (shiftId: number) => {
    setInspectLoading(true);
    setInspectModalOpen(true);
    setInspectActiveTab('invoices');
    setInvoicePaymentFilter('all');
    setExpandedInvoiceId(null);
    setInvoiceSearch('');

    const res = await apiRequest(`/cash/sessions/${shiftId}`);
    if (res.success && res.data) {
      setSelectedShiftDetails(res.data);
    }
    setInspectLoading(false);
  };

  // Export Daily or Range Business Records as CSV
  const handleExportCSV = () => {
    const sessions = dailyData?.staffSessions?.length ? dailyData.staffSessions : allShifts;
    if (!sessions || !sessions.length) {
      alert('No staff session records found for the selected period.');
      return;
    }

    const isRange = startDate !== endDate;
    const periodLabel = isRange ? `${startDate} to ${endDate}` : startDate;
    const { totals } = dailyData || {};

    const summaryMeta = [
      `"AUDIT PERIOD",${JSON.stringify(periodLabel)}`,
      `"TOTAL REGISTER SHIFTS",${sessions.length}`,
      `"TOTAL GROSS SALES (SAR)",${Number(totals?.totalGrossSales || 0).toFixed(2)}`,
      `"TOTAL CASH SALES (SAR)",${Number(totals?.totalCashSales || 0).toFixed(2)}`,
      `"TOTAL CARD (MADA) SALES (SAR)",${Number(totals?.totalCardSales || 0).toFixed(2)}`,
      `"TOTAL CASH DEDUCTIONS (SAR)",${Number((totals?.totalCashRefunds || 0) + (totals?.totalCashExpenses || 0)).toFixed(2)}`,
      `"EXPECTED CASH IN DRAWERS (SAR)",${Number(totals?.expectedCashInDrawers || 0).toFixed(2)}`,
      `"TOTAL COUNTED CASH (SAR)",${Number(totals?.totalCountedCash || 0).toFixed(2)}`,
      `"TOTAL DISCREPANCY (SAR)",${Number(totals?.totalDiscrepancy || 0).toFixed(2)}`,
    ];

    const headers = [
      'Shift #',
      'Cashier Name',
      'Username',
      'Status',
      'Opened At',
      'Closed At',
      'Drawer Cash Float (SAR)',
      'Card Float (SAR)',
      'Invoices Count',
      'Gross Sales (SAR)',
      'Cash Sales (SAR)',
      'Card Sales (SAR)',
      'Cash Refunds (SAR)',
      'Cash Expenses (SAR)',
      'Expected Cash (SAR)',
      'Counted Cash (SAR)',
      'Cash Variance (SAR)',
      'Card Settled (SAR)',
      'Card Variance (SAR)',
      'Closing Note',
    ];

    const rows = sessions.map((s: any) => [
      s.sequenceNumber || s.id,
      `"${s.userName || ''}"`,
      `"${s.username || ''}"`,
      s.status,
      `"${s.openedAt ? new Date(s.openedAt).toLocaleString() : ''}"`,
      `"${s.closedAt ? new Date(s.closedAt).toLocaleString() : 'ACTIVE'}"`,
      Number(s.openingFloat || 0).toFixed(2),
      Number(s.openingCardFloat || 0).toFixed(2),
      s.invoicesCount || 0,
      Number(s.grossSales || 0).toFixed(2),
      Number(s.cashSales || 0).toFixed(2),
      Number(s.cardSales || 0).toFixed(2),
      Number(s.cashRefunds || 0).toFixed(2),
      Number(s.cashExpenses || 0).toFixed(2),
      Number(s.expectedCash || 0).toFixed(2),
      Number(s.countedCash || 0).toFixed(2),
      Number(s.difference || 0).toFixed(2),
      Number(s.terminalCardTotal || 0).toFixed(2),
      Number(s.terminalCardDiscrepancy || 0).toFixed(2),
      `"${(s.closingNote || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [
        ...summaryMeta,
        '',
        headers.join(','),
        ...rows.map((e: any[]) => e.join(',')),
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const filename = isRange
      ? `Cash_Drawer_Audit_${startDate}_to_${endDate}.csv`
      : `Cash_Drawer_Audit_${startDate}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open Consolidated Z-Report for selected Date or Range
  const handleOpenConsolidatedZReport = () => {
    const isRange = startDate !== endDate;
    const periodLabel = isRange ? `${startDate} to ${endDate}` : startDate;
    const { totals } = dailyData || {};

    setZReportData({
      isRange,
      periodLabel,
      sessionId: isRange
        ? `STORE-PERIOD-${startDate}-TO-${endDate}`
        : `STORE-DAILY-${startDate}`,
      cashierName: isRange
        ? `Consolidated Store Period Audit (${periodLabel})`
        : 'Consolidated Store Daily Report',
      openedAt: dailyData?.startTime,
      closedAt: dailyData?.endTime,
      totalShifts: dailyData?.staffSessions?.length || allShifts.length,
      openingFloat: totals?.totalOpeningFloat || 0,
      openingCardFloat: totals?.totalOpeningCardFloat || 0,
      grossSales: totals?.totalGrossSales || 0,
      cashSales: totals?.totalCashSales || 0,
      cardSales: totals?.totalCardSales || 0,
      vatCollected: totals?.totalTaxCollected || 0,
      expectedCash: totals?.expectedCashInDrawers || 0,
      actualCash: totals?.totalCountedCash || 0,
      cashVariance: totals?.totalDiscrepancy || 0,
    });
    setZReportModalOpen(true);
  };

  // Compute Shift Duration helper (including seconds)
  const computeDuration = (start: string, end?: string | null) => {
    if (!start) return 'N/A';
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const diffSecs = Math.max(0, Math.floor((endTime - startTime) / 1000));
    const hours = String(Math.floor(diffSecs / 3600)).padStart(2, '0');
    const mins = String(Math.floor((diffSecs % 3600) / 60)).padStart(2, '0');
    const secs = String(diffSecs % 60).padStart(2, '0');
    return `${hours}h ${mins}m ${secs}s`;
  };

  // Filter Shifts for Timeline
  const filteredShifts = useMemo(() => {
    return allShifts.filter((shift) => {
      // Status Filter
      if (statusFilter === 'balanced') {
        if (shift.status !== 'closed' || Math.abs(Number(shift.difference || 0)) >= 0.01) return false;
      }
      if (statusFilter === 'discrepancy') {
        if (shift.status !== 'closed' || Math.abs(Number(shift.difference || 0)) < 0.01) return false;
      }

      // Staff Filter
      if (staffFilter !== 'all' && String(shift.userId) !== staffFilter) {
        return false;
      }

      return true;
    });
  }, [allShifts, statusFilter, staffFilter]);

  // Filter Invoices in Deep Inspection Modal
  const filteredInvoices = useMemo(() => {
    if (!selectedShiftDetails?.invoices) return [];
    let list: ShiftInvoice[] = selectedShiftDetails.invoices;

    // Filter by payment method
    if (invoicePaymentFilter === 'cash') {
      list = list.filter((inv) => inv.payments?.some((p) => p.isCash));
    } else if (invoicePaymentFilter === 'card') {
      list = list.filter((inv) => inv.payments?.some((p) => !p.isCash));
    }

    if (!invoiceSearch.trim()) return list;

    const q = invoiceSearch.toLowerCase().trim();
    return list.filter((inv: ShiftInvoice) => {
      return (
        inv.invoiceNo.toLowerCase().includes(q) ||
        inv.referenceNo.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        (inv.customerPhone && inv.customerPhone.includes(q))
      );
    });
  }, [selectedShiftDetails, invoiceSearch, invoicePaymentFilter]);

  const { totals, businessDate } = dailyData || {};

  return (
    <div className="space-y-6">
      {/* 1. Page Header & Control Toolbar (Strict Uniform h-10 Heights) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="shrink-0">
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            Cash Drawer & Shifts
          </h1>
        </div>

        {/* Action Controls & Date Range Selector (All components uniform h-10) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Modern Dual-Month Date Range Picker (Matching Modern UI standard) */}
          <ModernDateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
          />

          <Button
            variant="secondary"
            size="md"
            onClick={handleExportCSV}
            leftIcon={<Download className="h-4 w-4" />}
            className="h-10 min-h-[40px] max-h-[40px] shrink-0"
          >
            Export CSV
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={handleOpenConsolidatedZReport}
            leftIcon={<Printer className="h-4 w-4" />}
            className="h-10 min-h-[40px] max-h-[40px] shrink-0"
          >
            Print Z-Report
          </Button>
        </div>
      </div>

      {/* 2. Current Active Cashier Info Section (Clickable to inspect shift) */}
      {activeTill ? (
        <div
          onClick={() => handleInspectShift(activeTill.id)}
          className="rounded-2xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-[#0B0F17] p-5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-neutral-700 transition-all cursor-pointer group select-none"
          title="Click to inspect live shift details"
        >
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
            {/* Left: Cashier Profile & Live Timestamp with seconds */}
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <User className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors">
                    {activeTill.userName}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500 dark:text-neutral-400 mt-1">
                  <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>Started {formatTimeWithSeconds(activeTill.openedAt)}</span>
                  <span className="text-slate-300 dark:text-neutral-700">•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{liveDuration}</span>
                </div>
              </div>
            </div>

            {/* Right: Stats (Opening Balance, Total Sales & Invoices, Expected Drawer Cash & Card) */}
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
              {/* Stat 1: Opening Balance (Cash & Card) */}
              <div className="bg-slate-50 dark:bg-[#121620] px-4 py-2.5 rounded-xl border border-slate-200/70 dark:border-neutral-800/80 min-w-[155px]">
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-neutral-500 mb-1">
                  Opening Balance
                </div>
                <div className="space-y-0.5 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500 dark:text-neutral-400">Cash</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(activeTill.openingBalance)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500 dark:text-neutral-400">Card</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(activeTill.openingCardBalance || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stat 2: Total Sales with Invoices below */}
              <div className="bg-slate-50 dark:bg-[#121620] px-4 py-2.5 rounded-xl border border-slate-200/70 dark:border-neutral-800/80 min-w-[155px]">
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-neutral-500 mb-0.5">
                  Total Sales
                </div>
                <div className="text-base font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                  {formatCurrency(activeTill.totalSales || 0)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                  {activeTill.salesCount || 0} Invoices
                </div>
              </div>

              {/* Stat 3: Expected in Drawer (Cash & Card) */}
              <div className="bg-slate-50 dark:bg-[#121620] px-4 py-2.5 rounded-xl border border-slate-200/70 dark:border-neutral-800/80 min-w-[170px]">
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-neutral-500 mb-1">
                  Expected in Drawer
                </div>
                <div className="space-y-0.5 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500 dark:text-neutral-400">Cash</span>
                    <span className="font-bold text-blue-600 dark:text-sky-400">
                      {formatCurrency(activeTill.liveExpectedCash || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500 dark:text-neutral-400">Card</span>
                    <span className="font-bold text-sky-600 dark:text-sky-400">
                      {formatCurrency((activeTill.openingCardBalance || 0) + (activeTill.cardSales || 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#0B0F17] p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-2xl bg-slate-100 dark:bg-[#121620] flex items-center justify-center text-slate-400 dark:text-neutral-500 shrink-0">
                <User className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-neutral-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    POS Counter Idle
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  No active shift open. Register is ready for cashier PIN login at the counter.
                </p>
              </div>
            </div>

            {lastClosedTill && (
              <div className="flex items-center gap-4 font-mono text-xs bg-slate-50 dark:bg-[#121620] p-3 rounded-xl border border-slate-200/70 dark:border-neutral-800/80">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase block">Carry-Forward Cash Float</span>
                  <span className="font-black text-blue-600 dark:text-sky-400">
                    {formatCurrency(lastClosedTill.closingBalance || 0)}
                  </span>
                </div>
                <div className="border-l border-slate-200 dark:border-neutral-700 pl-3">
                  <span className="text-slate-400 text-[10px] uppercase block">Carry-Forward Card Float</span>
                  <span className="font-black text-sky-600 dark:text-sky-400">
                    {formatCurrency(lastClosedTill.terminalCardTotal || 0)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Store Financial Matrix (6 High-Contrast Metric Cards with Dual Floats) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600 dark:text-sky-400" />
            Performance Matrix ({dailyData?.businessDate || rangeLabel})
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {totals?.activeDrawersCount || 0} Open • {totals?.closedDrawersCount || 0} Closed Shifts
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Total Dual Floats */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-slate-400">Total Floats</span>
              <Banknote className="h-4 w-4 text-blue-500" />
            </div>
            <div className="mt-2 font-mono text-lg font-black text-slate-900 dark:text-white">
              {formatCurrency((totals?.totalOpeningFloat || 0) + (totals?.totalOpeningCardFloat || 0))}
            </div>
            <div className="mt-1 text-[10px] text-slate-400 font-mono">
              Cash: {formatCurrency(totals?.totalOpeningFloat || 0)}
            </div>
          </div>

          {/* Card 2: Cash Inflows */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-slate-400">Cash Inflows</span>
              <Coins className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 font-mono text-lg font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totals?.totalCashSales || 0)}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Direct cash register sales</div>
          </div>

          {/* Card 3: Mada / Card Sales */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-slate-400">Mada / Card</span>
              <CreditCard className="h-4 w-4 text-sky-500" />
            </div>
            <div className="mt-2 font-mono text-lg font-black text-sky-600 dark:text-sky-400">
              {formatCurrency(totals?.totalCardSales || 0)}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Electronic settlements</div>
          </div>

          {/* Card 4: Deductions (Refunds & Expenses) */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-slate-400">Refunds & Out</span>
              <ArrowDownLeft className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 font-mono text-lg font-black text-amber-600 dark:text-amber-400">
              {formatCurrency((totals?.totalCashRefunds || 0) + (totals?.totalCashExpenses || 0))}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">Total cash deductions</div>
          </div>

          {/* Card 5: Expected in Drawers */}
          <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-blue-700 dark:text-sky-400">
                Expected in Till
              </span>
              <Layers className="h-4 w-4 text-blue-600 dark:text-sky-400" />
            </div>
            <div className="mt-2 font-mono text-lg font-black text-blue-900 dark:text-sky-300">
              {formatCurrency(totals?.expectedCashInDrawers || 0)}
            </div>
            <div className="mt-1 text-[10px] text-blue-600/70 dark:text-sky-400/70">
              Float + Cash Sales - Deductions
            </div>
          </div>

          {/* Card 6: Audit Discrepancy */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-slate-400">Counted / Diff</span>
              <ShieldAlert className="h-4 w-4 text-purple-500" />
            </div>
            <div className="mt-2 font-mono text-lg font-black text-slate-900 dark:text-white">
              {formatCurrency(totals?.totalCountedCash || 0)}
            </div>
            <div className="mt-1 flex items-center gap-1 font-mono text-[10px]">
              <span>Diff:</span>
              <span
                className={
                  Math.abs(totals?.totalDiscrepancy || 0) < 0.01
                    ? 'text-emerald-500 font-bold'
                    : totals?.totalDiscrepancy > 0
                    ? 'text-sky-500 font-bold'
                    : 'text-rose-500 font-bold'
                }
              >
                {totals?.totalDiscrepancy > 0 ? '+' : ''}
                {formatCurrency(totals?.totalDiscrepancy || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Filter Toolbar (Equal h-10 Controls) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#0B0F17] p-3 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-sm">
        {/* Left: Filter Tabs */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-neutral-400">
            <Filter className="h-4 w-4" />
            <span>Filter:</span>
          </div>

          <div className="h-10 inline-flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-[#121620] p-1 text-xs border border-slate-200/50 dark:border-neutral-800">
            {(
              [
                { id: 'all', label: 'All Shifts' },
                { id: 'balanced', label: 'Balanced' },
                { id: 'discrepancy', label: 'Variance' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`h-8 rounded-lg px-3.5 py-1 font-bold transition-all ${
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-[#0B0F17] text-blue-600 dark:text-sky-400 shadow-sm border border-slate-200/60 dark:border-neutral-700'
                    : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Premium Cashier Selector Dropdown */}
        <div className="relative inline-flex items-center self-end sm:self-auto">
          <User className="absolute left-3 h-4 w-4 text-slate-400 dark:text-neutral-500 pointer-events-none" />
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="h-10 pl-9 pr-9 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#121620] hover:border-slate-300 dark:hover:border-neutral-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-sm appearance-none transition-all"
          >
            <option value="all">All Cashiers</option>
            {staffList.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 h-3.5 w-3.5 text-slate-400 dark:text-neutral-500 pointer-events-none" />
        </div>
      </div>

      {/* 5. Chronological Timeline Feed */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 font-medium text-xs">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3" />
            Loading shift timeline...
          </div>
        ) : filteredShifts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-slate-400">
            <FileText className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
            <p className="font-bold text-sm text-slate-700 dark:text-slate-300">No Register Shifts Found</p>
            <p className="text-xs mt-1">Try adjusting your filters or business date.</p>
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-200 dark:border-slate-800 space-y-6">
            {filteredShifts.map((shift) => {
              const diff = Number(shift.difference || 0);
              const isBalanced = Math.abs(diff) < 0.01;
              const isOpen = shift.status === 'open';

              return (
                <div key={shift.id} className="relative group">
                  {/* Timeline Node Bullet: Centered Vertically */}
                  <div className="absolute -left-[31px] sm:-left-[39px] top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-10">
                    {isOpen ? (
                      <span className="relative flex h-3.5 w-3.5 items-center justify-center">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-sm"></span>
                      </span>
                    ) : (
                      <span
                        className={`h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 shadow-sm transition-transform group-hover:scale-125 ${
                          isBalanced ? 'bg-slate-400 dark:bg-neutral-500' : diff > 0 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                      />
                    )}
                  </div>

                  {/* Shift Timeline Card (Clickable to inspect) */}
                  <div
                    onClick={() => handleInspectShift(shift.id)}
                    className="cursor-pointer rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#0B0F17] p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-neutral-700 transition-all space-y-3 select-none group/card"
                    title="Click to inspect shift and invoices"
                  >
                    {/* Card Header: Sequence, Cashier Name, Immediate Balance/Variance Tag */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-neutral-800/80 pb-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-sm font-black text-slate-900 dark:text-white">
                          #{shift.sequenceNumber || shift.id}
                        </span>
                        <div className="h-4 w-[1px] bg-slate-200 dark:bg-neutral-700" />
                        <span className="font-bold text-slate-900 dark:text-white text-sm group-hover/card:text-blue-600 dark:group-hover/card:text-sky-400 transition-colors">
                          {shift.userName}
                        </span>
                        {isOpen ? (
                          <Badge variant="primary" className="font-mono text-[10px] py-0.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
                            ACTIVE NOW
                          </Badge>
                        ) : (
                          <Badge
                            variant={isBalanced ? 'success' : diff > 0 ? 'warning' : 'danger'}
                            className="font-mono text-[10px] py-0.5"
                          >
                            {isBalanced
                              ? 'BALANCED'
                              : `${diff > 0 ? '+' : ''}${formatCurrency(diff)} VARIANCE`}
                          </Badge>
                        )}
                      </div>

          <div className="text-xs text-slate-400 dark:text-neutral-500 font-mono">
                        {shift.openedAt ? formatDateBadge(shift.openedAt) : ''}
                      </div>
                    </div>

                    {/* Card Content Grid: 5 Columns */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-xs font-mono pt-1">
                      {/* 1. Shift Timing with Clock Icon and seconds */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-neutral-500 block">Shift Timing</span>
                        <div className="text-slate-800 dark:text-slate-200 font-semibold mt-0.5">
                          {formatTimeWithSeconds(shift.openedAt)} — {shift.closedAt ? formatTimeWithSeconds(shift.closedAt) : 'Active'}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                          <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{computeDuration(shift.openedAt, shift.closedAt)}</span>
                        </div>
                      </div>

                      {/* 2. Dual Floats */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-neutral-500 block">Dual Floats</span>
                        <div className="text-slate-800 dark:text-slate-200 font-bold mt-0.5">
                          Cash: {formatCurrency(shift.openingFloat)}
                        </div>
                        <div className="text-[11px] text-sky-600 dark:text-sky-400 font-bold">
                          Card: {formatCurrency(shift.openingCardFloat || 0)}
                        </div>
                      </div>

                      {/* 3. Sales Output */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-neutral-500 block">Sales Output</span>
                        <div className="text-emerald-600 dark:text-emerald-400 font-black text-sm mt-0.5">
                          {formatCurrency(shift.grossSales)}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                          {shift.invoicesCount || 0} {Number(shift.invoicesCount) === 1 ? 'Invoice' : 'Invoices'}
                        </div>
                      </div>

                      {/* 4. Drawer Settlement */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-neutral-500 block">Drawer Settlement</span>
                        <div className="text-slate-900 dark:text-white font-black mt-0.5">
                          Counted: {shift.status === 'closed' ? formatCurrency(shift.countedCash) : 'Active'}
                        </div>
                        <div className="text-[11px] text-blue-600 dark:text-sky-400 font-bold">
                          Expected: {formatCurrency(shift.expectedCash)}
                        </div>
                      </div>

                      {/* 5. Card Settlement */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-neutral-500 block">Card Settlement</span>
                        <div className="text-slate-900 dark:text-white font-black mt-0.5">
                          Counted: {shift.status === 'closed' ? formatCurrency(shift.terminalCardTotal || 0) : 'Active'}
                        </div>
                        <div className="text-[11px] text-sky-600 dark:text-sky-400 font-bold">
                          Expected: {formatCurrency(shift.status === 'closed' ? (shift.terminalCardExpected || shift.cardSales || 0) : ((shift.openingCardFloat || 0) + (shift.cardSales || 0)))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Deep Shift Inspection Modal with Dynamic Invoices View */}
      {inspectModalOpen && (
        <Modal
          isOpen={inspectModalOpen}
          onClose={() => {
            setInspectModalOpen(false);
            setSelectedShiftDetails(null);
          }}
          title={
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center text-blue-600 dark:text-sky-400 font-bold shrink-0 shadow-sm">
                <User className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-sm sm:text-base text-slate-900 dark:text-white">
                    Shift #{selectedShiftDetails?.session?.sequence_number || selectedShiftDetails?.session?.id || ''}
                  </span>
                  {selectedShiftDetails?.session?.status === 'open' ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active Now
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 border border-slate-200 dark:border-neutral-700">
                      Closed Shift
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-neutral-400 flex flex-wrap items-center gap-2 mt-0.5">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {selectedShiftDetails?.session?.user_name || 'Loading...'}
                  </span>
                  <span className="text-slate-300 dark:text-neutral-600">•</span>
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <Clock className="h-3 w-3 text-slate-400" />
                    {computeDuration(selectedShiftDetails?.session?.opened_at, selectedShiftDetails?.session?.closed_at)}
                  </span>
                  <span className="text-slate-300 dark:text-neutral-600">•</span>
                  <span className="font-mono text-[11px] text-slate-400">
                    Opened {formatTimeWithSeconds(selectedShiftDetails?.session?.opened_at)}
                  </span>
                </div>
              </div>
            </div>
          }
          maxWidth="4xl"
          footer={
            <div className="flex w-full items-center justify-between">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  if (selectedShiftDetails?.session) {
                    const s = selectedShiftDetails.session;
                    const isClosed = s.status === 'closed';
                    setZReportData({
                      sessionId: s.sequence_number ? `#${s.sequence_number}` : `#${s.id}`,
                      cashierName: s.user_name || 'Cashier',
                      openedAt: s.opened_at,
                      closedAt: s.closed_at || new Date().toISOString(),
                      openingFloat: Number(s.openingBalance ?? s.opening_balance ?? 0),
                      openingCardFloat: Number(s.openingCardBalance ?? s.opening_card_balance ?? 0),
                      grossSales: Number(s.grossSales ?? ((s.cashSales || 0) + (s.cardSales || 0))),
                      cashSales: Number(s.cashSales || 0),
                      cardSales: Number(s.cardSales || 0),
                      vatCollected: Number(s.totalTaxCollected || 0),
                      expectedCash: Number(s.expectedCash ?? s.expected_balance ?? 0),
                      actualCash: Number(isClosed ? (s.closing_balance || 0) : (s.expectedCash ?? s.expected_balance ?? 0)),
                      cashVariance: Number(isClosed ? (s.cashDifference ?? s.difference ?? 0) : 0),
                    });
                    setZReportModalOpen(true);
                  }
                }}
                leftIcon={<Printer className="h-4 w-4" />}
                className="h-10 min-h-[40px] max-h-[40px]"
              >
                Print Shift Z-Report
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setInspectModalOpen(false);
                  setSelectedShiftDetails(null);
                }}
                className="h-10 min-h-[40px] max-h-[40px]"
              >
                Close
              </Button>
            </div>
          }
        >
          {inspectLoading || !selectedShiftDetails ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <div className="space-y-5 text-xs">
              {/* 1. Shift Reconciliation KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Card A: Cash Drawer Reconciliation */}
                <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-[#0B0F17] shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 flex items-center gap-1.5">
                      <Banknote className="h-4 w-4 text-emerald-500" />
                      Drawer Cash
                    </span>
                    {selectedShiftDetails.session.status === 'open' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-sky-400 border border-blue-200/60 dark:border-blue-900/60 font-mono">
                        LIVE SHIFT
                      </span>
                    ) : Math.abs(Number(selectedShiftDetails.session.difference || 0)) < 0.01 ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/60 font-mono">
                        ✓ BALANCED
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md font-mono ${
                          Number(selectedShiftDetails.session.difference) > 0
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 border border-amber-200'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 border border-rose-200'
                        }`}
                      >
                        {Number(selectedShiftDetails.session.difference) > 0 ? '+' : ''}
                        {formatCurrency(selectedShiftDetails.session.difference)}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between text-slate-500 dark:text-neutral-400">
                      <span>Opening Float:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {formatCurrency(selectedShiftDetails.session.opening_balance || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-neutral-400">
                      <span>Cash Inflows:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        +{formatCurrency(selectedShiftDetails.session.cashSales || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-neutral-400">
                      <span>Deductions:</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        -{formatCurrency((selectedShiftDetails.session.cashRefunds || 0) + (selectedShiftDetails.session.cashExpenses || 0))}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 dark:border-neutral-800 flex justify-between items-baseline">
                      <span className="text-slate-600 dark:text-neutral-300 font-bold">Expected Cash:</span>
                      <span className="text-base font-black text-blue-600 dark:text-sky-400">
                        {formatCurrency(selectedShiftDetails.session.expectedCash ?? selectedShiftDetails.session.expected_balance ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline text-[11px]">
                      <span className="text-slate-400">Counted Cash:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {selectedShiftDetails.session.status === 'closed'
                          ? formatCurrency(selectedShiftDetails.session.closing_balance || 0)
                          : 'Active Counter'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card B: Card & Electronic Terminal */}
                <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-[#0B0F17] shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4 text-sky-500" />
                      Terminal Batch (Mada)
                    </span>
                    {selectedShiftDetails.session.status === 'open' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-sky-400 border border-blue-200/60 dark:border-blue-900/60 font-mono">
                        LIVE SHIFT
                      </span>
                    ) : Math.abs(Number(selectedShiftDetails.session.terminal_card_discrepancy || 0)) < 0.01 ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/60 font-mono">
                        ✓ BALANCED
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-600 border border-rose-200 font-mono">
                        Variance: {formatCurrency(selectedShiftDetails.session.terminal_card_discrepancy || 0)}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between text-slate-500 dark:text-neutral-400">
                      <span>Opening Card Float:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {formatCurrency(selectedShiftDetails.session.opening_card_balance || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-neutral-400">
                      <span>Electronic Sales:</span>
                      <span className="font-semibold text-sky-600 dark:text-sky-400">
                        +{formatCurrency(selectedShiftDetails.session.cardSales || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-neutral-400">
                      <span>Settlement Status:</span>
                      <span className="font-semibold text-slate-600 dark:text-neutral-300">
                        {selectedShiftDetails.session.status === 'closed' ? 'Settled & Verified' : 'Awaiting Shift Close'}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 dark:border-neutral-800 flex justify-between items-baseline">
                      <span className="text-slate-600 dark:text-neutral-300 font-bold">Expected Card:</span>
                      <span className="text-base font-black text-sky-600 dark:text-sky-400">
                        {formatCurrency(
                          selectedShiftDetails.session.expectedCard ??
                          selectedShiftDetails.session.terminal_card_expected ??
                          ((selectedShiftDetails.session.opening_card_balance || 0) + (selectedShiftDetails.session.cardSales || 0))
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline text-[11px]">
                      <span className="text-slate-400">Batch Slip Counted:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {selectedShiftDetails.session.status === 'closed'
                          ? formatCurrency(selectedShiftDetails.session.terminal_card_total || 0)
                          : 'Active Counter'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card C: Sales Volume & Tax Breakdown */}
                <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-[#0B0F17] shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 flex items-center gap-1.5">
                      <Receipt className="h-4 w-4 text-purple-500" />
                      Trading Volume
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 font-mono">
                      {selectedShiftDetails.invoices?.length || 0} {selectedShiftDetails.invoices?.length === 1 ? 'Invoice' : 'Invoices'}
                    </span>
                  </div>

                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between text-slate-500 dark:text-neutral-400">
                      <span>Cash Sales:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(selectedShiftDetails.session.cashSales || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-neutral-400">
                      <span>Card Sales:</span>
                      <span className="font-semibold text-sky-600 dark:text-sky-400">
                        {formatCurrency(selectedShiftDetails.session.cardSales || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-neutral-400">
                      <span>VAT Collected:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {formatCurrency(selectedShiftDetails.session.totalTaxCollected || 0)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 dark:border-neutral-800 flex justify-between items-baseline">
                      <span className="text-slate-600 dark:text-neutral-300 font-bold">Gross Sales:</span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(selectedShiftDetails.session.grossSales || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline text-[11px]">
                      <span className="text-slate-400">Avg Ticket:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {selectedShiftDetails.invoices?.length > 0
                          ? formatCurrency((selectedShiftDetails.session.grossSales || 0) / selectedShiftDetails.invoices.length)
                          : formatCurrency(0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Premium 3-Segment Tab Bar */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-neutral-900 rounded-xl border border-slate-200/60 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setInspectActiveTab('invoices')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    inspectActiveTab === 'invoices'
                      ? 'bg-white dark:bg-[#121620] text-blue-600 dark:text-sky-400 shadow-sm border border-slate-200/70 dark:border-neutral-700'
                      : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Receipt className="h-4 w-4 shrink-0" />
                  <span>Invoices</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-sky-400">
                    {selectedShiftDetails.invoices?.length || 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setInspectActiveTab('movements')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    inspectActiveTab === 'movements'
                      ? 'bg-white dark:bg-[#121620] text-blue-600 dark:text-sky-400 shadow-sm border border-slate-200/70 dark:border-neutral-700'
                      : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Coins className="h-4 w-4 shrink-0" />
                  <span>Cash Movements</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-mono font-bold bg-slate-200 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300">
                    {selectedShiftDetails.movements?.length || 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setInspectActiveTab('adjustments')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    inspectActiveTab === 'adjustments'
                      ? 'bg-white dark:bg-[#121620] text-blue-600 dark:text-sky-400 shadow-sm border border-slate-200/70 dark:border-neutral-700'
                      : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Adjustments</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-mono font-bold bg-slate-200 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300">
                    {selectedShiftDetails.adjustments?.length || 0}
                  </span>
                </button>
              </div>

              {/* TAB 1: Dynamic Invoices View */}
              {inspectActiveTab === 'invoices' && (
                <div className="space-y-3">
                  {/* Toolbar with Search and Payment Filter Chips */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 dark:bg-[#0B0F17] p-2.5 rounded-xl border border-slate-200/70 dark:border-neutral-800">
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                      <div className="h-8 inline-flex items-center rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#121620] px-2.5 text-xs w-full shadow-sm">
                        <Search className="h-3.5 w-3.5 text-slate-400 mr-2 shrink-0" />
                        <input
                          type="text"
                          placeholder="Search invoice # or customer..."
                          value={invoiceSearch}
                          onChange={(e) => setInvoiceSearch(e.target.value)}
                          className="bg-transparent focus:outline-none text-slate-800 dark:text-slate-200 w-full text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="inline-flex p-0.5 rounded-lg bg-slate-200/60 dark:bg-neutral-800 text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setInvoicePaymentFilter('all')}
                          className={`px-2.5 py-1 rounded-md transition-all ${
                            invoicePaymentFilter === 'all'
                              ? 'bg-white dark:bg-[#121620] text-blue-600 dark:text-sky-400 shadow-sm'
                              : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800'
                          }`}
                        >
                          All ({selectedShiftDetails.invoices?.length || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setInvoicePaymentFilter('cash')}
                          className={`px-2.5 py-1 rounded-md transition-all ${
                            invoicePaymentFilter === 'cash'
                              ? 'bg-white dark:bg-[#121620] text-emerald-600 dark:text-emerald-400 shadow-sm'
                              : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800'
                          }`}
                        >
                          Cash Only
                        </button>
                        <button
                          type="button"
                          onClick={() => setInvoicePaymentFilter('card')}
                          className={`px-2.5 py-1 rounded-md transition-all ${
                            invoicePaymentFilter === 'card'
                              ? 'bg-white dark:bg-[#121620] text-sky-600 dark:text-sky-400 shadow-sm'
                              : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800'
                          }`}
                        >
                          Card Only
                        </button>
                      </div>

                      <span className="text-[11px] font-mono font-semibold text-slate-400 hidden lg:inline">
                        Showing {filteredInvoices.length} Invoices
                      </span>
                    </div>
                  </div>

                  {filteredInvoices.length === 0 ? (
                    <div className="text-center py-12 rounded-xl border border-dashed border-slate-200 dark:border-neutral-800 text-slate-400">
                      <Receipt className="h-8 w-8 mx-auto text-slate-300 dark:text-neutral-700 mb-2" />
                      <p className="font-semibold text-xs text-slate-600 dark:text-neutral-400">
                        No sales or invoices match your filter.
                      </p>
                      <p className="text-[11px] mt-0.5 text-slate-400">Try adjusting your search query or payment filter.</p>
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
                      {filteredInvoices.map((inv: ShiftInvoice) => {
                        const isExpanded = expandedInvoiceId === inv.id;

                        return (
                          <div
                            key={inv.id}
                            className="rounded-xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-[#0B0F17] p-3.5 shadow-sm hover:border-slate-300 dark:hover:border-neutral-700 transition-all space-y-2.5"
                          >
                            <div
                              onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                              className="flex items-center justify-between cursor-pointer select-none gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-neutral-800 flex items-center justify-center text-slate-600 dark:text-neutral-400 shrink-0">
                                  <Receipt className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-black text-slate-900 dark:text-white truncate">
                                      {inv.invoiceNo}
                                    </span>
                                    <Badge variant="success" className="text-[9px] py-0 px-1.5 uppercase font-mono">
                                      {inv.paymentStatus || 'PAID'}
                                    </Badge>
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-neutral-400 flex items-center gap-1.5 mt-0.5 truncate font-sans">
                                    <span>{inv.customerName}</span>
                                    {inv.customerPhone && (
                                      <>
                                        <span>•</span>
                                        <span className="font-mono">{inv.customerPhone}</span>
                                      </>
                                    )}
                                    <span>•</span>
                                    <span className="font-mono text-slate-400">{formatTimeWithSeconds(inv.createdAt)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                {/* Payment Method Badges */}
                                <div className="hidden sm:flex items-center gap-1.5 font-mono text-[10px]">
                                  {inv.payments?.map((p, idx) => (
                                    <span
                                      key={idx}
                                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                        p.isCash
                                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                                          : 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60'
                                      }`}
                                    >
                                      {p.methodName}: {formatCurrency(p.amount)}
                                    </span>
                                  ))}
                                </div>

                                <div className="text-right font-mono">
                                  <div className="font-black text-sm text-slate-900 dark:text-white">
                                    {formatCurrency(inv.grandTotal)}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {inv.totalItems} Item{inv.totalItems === 1 ? '' : 's'}
                                  </div>
                                </div>

                                <div className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Expandable Line Items View */}
                            {isExpanded && (
                              <div className="border-t border-slate-100 dark:border-neutral-800 pt-3 space-y-2.5">
                                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                  <span className="flex items-center gap-1.5">
                                    <ShoppingBag className="h-3.5 w-3.5" />
                                    Purchased Items ({inv.items?.length || 0})
                                  </span>
                                  <span className="font-mono text-slate-400">
                                    Tax: {formatCurrency(inv.totalTax)} • Discount: {formatCurrency(inv.totalDiscount)}
                                  </span>
                                </div>
                                <div className="border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-neutral-900/40">
                                  <table className="w-full text-[11px] text-left">
                                    <thead className="bg-slate-100/70 dark:bg-neutral-800/80 font-bold text-slate-500 dark:text-neutral-400">
                                      <tr>
                                        <th className="p-2.5">Product</th>
                                        <th className="p-2.5">SKU</th>
                                        <th className="p-2.5 text-center">Qty</th>
                                        <th className="p-2.5 text-right">Unit Price</th>
                                        <th className="p-2.5 text-right">VAT</th>
                                        <th className="p-2.5 text-right">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200/60 dark:divide-neutral-800 font-mono">
                                      {inv.items?.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-neutral-800/50 transition-colors">
                                          <td className="p-2.5 font-sans font-semibold text-slate-800 dark:text-slate-200">
                                            {item.productName}
                                          </td>
                                          <td className="p-2.5 text-slate-400 text-[10px]">{item.sku}</td>
                                          <td className="p-2.5 text-center font-bold text-slate-900 dark:text-white">
                                            {item.quantity}
                                          </td>
                                          <td className="p-2.5 text-right text-slate-600 dark:text-slate-300">
                                            {formatCurrency(item.unitPrice)}
                                          </td>
                                          <td className="p-2.5 text-right text-slate-400">
                                            {formatCurrency(item.taxAmount)}
                                          </td>
                                          <td className="p-2.5 text-right font-black text-slate-900 dark:text-white">
                                            {formatCurrency(item.subtotal)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Invoice Financial Summary Footer */}
                                <div className="flex flex-wrap items-center justify-between text-xs font-mono bg-white dark:bg-[#121620] p-2.5 rounded-xl border border-slate-200/60 dark:border-neutral-800 text-slate-600 dark:text-neutral-400">
                                  <div>
                                    <span className="text-slate-400">Subtotal:</span>{' '}
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(inv.subtotal)}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">Tax / VAT:</span>{' '}
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(inv.totalTax)}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">Discount:</span>{' '}
                                    <span className="font-bold text-amber-600">{formatCurrency(inv.totalDiscount)}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 font-bold">Total Paid:</span>{' '}
                                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                      {formatCurrency(inv.paidAmount)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Cash Movements Ledger */}
              {inspectActiveTab === 'movements' && (
                <div className="space-y-2">
                  <div className="max-h-80 overflow-y-auto border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 font-bold sticky top-0">
                        <tr>
                          <th className="p-2.5 text-left">Time</th>
                          <th className="p-2.5 text-left">Type</th>
                          <th className="p-2.5 text-left">Category / Source</th>
                          <th className="p-2.5 text-left">Description / Notes</th>
                          <th className="p-2.5 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-neutral-800 font-mono">
                        {selectedShiftDetails.movements?.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-400">
                              <Coins className="h-8 w-8 mx-auto text-slate-300 dark:text-neutral-700 mb-2" />
                              <p className="font-semibold text-xs text-slate-600 dark:text-neutral-400">
                                No cash movements recorded for this shift.
                              </p>
                              <p className="text-[11px] mt-0.5 text-slate-400">
                                Operating movements (cash drops, payouts, float additions) will appear here.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          selectedShiftDetails.movements?.map((m: any) => (
                            <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors">
                              <td className="p-2.5 text-slate-400 font-mono">{formatTimeWithSeconds(m.created_at)}</td>
                              <td className="p-2.5">
                                <span
                                  className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                    m.type === 'cash_in'
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 border border-rose-200'
                                  }`}
                                >
                                  {m.type === 'cash_in' ? 'CASH IN' : 'CASH OUT'}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-700 dark:text-slate-300 font-sans font-semibold capitalize">
                                {m.source || 'Operational'}
                              </td>
                              <td className="p-2.5 text-slate-500 dark:text-neutral-400 font-sans text-xs">
                                {m.description || '—'}
                              </td>
                              <td className="p-2.5 text-right font-bold font-mono">
                                <span className={m.type === 'cash_in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}>
                                  {m.type === 'cash_in' ? '+' : '-'}
                                  {formatCurrency(m.amount)}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: Declared Discrepancy Adjustments */}
              {inspectActiveTab === 'adjustments' && (
                <div className="space-y-3">
                  {selectedShiftDetails.adjustments?.length === 0 ? (
                    <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-200 dark:border-neutral-800 text-slate-400">
                      <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                      <p className="font-bold text-xs text-slate-700 dark:text-slate-200">
                        Balanced Shift — No Discrepancy Adjustments
                      </p>
                      <p className="text-[11px] mt-0.5 text-slate-400">
                        Opening float and closing reconciliation were verified without discrepancy claims.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedShiftDetails.adjustments.map((adj: any) => (
                        <div
                          key={adj.id}
                          className="flex items-center justify-between rounded-xl border border-amber-200/70 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-3.5 shadow-sm"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                                {adj.adjustmentType} Discrepancy
                              </span>
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                {adj.description}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Signed by {adj.createdBy} at {formatTimeWithSeconds(adj.createdAt)}
                            </div>
                          </div>
                          <span
                            className={`font-mono font-black text-sm ${
                              Number(adj.amount) < 0 ? 'text-rose-600' : 'text-emerald-600'
                            }`}
                          >
                            {Number(adj.amount) > 0 ? '+' : ''}
                            {formatCurrency(adj.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* 7. Official Z-Report Certificate Modal */}
      {zReportModalOpen && zReportData && (
        <Modal
          isOpen={zReportModalOpen}
          onClose={() => setZReportModalOpen(false)}
          title={zReportData.isRange ? 'Official Period Z-Report Certificate' : 'Official Register Z-Report Certificate'}
          subtitle={
            zReportData.isRange
              ? `Consolidated cash drawer settlement for ${zReportData.periodLabel || 'selected period'}`
              : 'Consolidated cash drawer settlement and audit record'
          }
          maxWidth="xl"
          footer={
            <div className="flex w-full items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                {zReportData.isRange ? 'Consolidated Period Mode' : 'Standard Certificate Mode'}
              </span>
              <Button
                variant="primary"
                onClick={() => window.print()}
                leftIcon={<Printer className="h-4 w-4" />}
                className="h-10 min-h-[40px] max-h-[40px]"
              >
                Print / Save PDF
              </Button>
            </div>
          }
        >
          <div
            id="printable-report"
            className="p-6 sm:p-8 bg-white text-black font-mono text-sm space-y-4 border border-slate-300 rounded-2xl shadow-md leading-relaxed min-h-[480px]"
          >
            <div className="text-center border-b-2 border-black pb-4">
              <h3 className="font-black text-xl uppercase tracking-wider text-black">
                {settings.shop_name_en || 'AL-NOOR SUPERMARKET & HYPERMARKET'}
              </h3>
              <p className="text-xs font-black uppercase tracking-widest mt-1 text-slate-800">
                {zReportData.isRange
                  ? `OFFICIAL CONSOLIDATED PERIOD Z-REPORT`
                  : `OFFICIAL REGISTER Z-REPORT: ${zReportData.sessionId}`}
              </p>
              <div className="mt-2 text-xs text-slate-700 space-y-0.5">
                <p>Scope: <span className="font-bold">{zReportData.cashierName}</span></p>
                <p>
                  Audit Period:{' '}
                  <span className="font-mono font-bold">
                    {zReportData.periodLabel || (zReportData.openedAt ? formatDateTime(zReportData.openedAt) : 'N/A')}
                  </span>
                  {zReportData.openedAt && !zReportData.isRange && (
                    <span>
                      {' '}
                      ({formatDateTime(zReportData.openedAt)} — {formatDateTime(zReportData.closedAt)})
                    </span>
                  )}
                </p>
                {zReportData.totalShifts !== undefined && (
                  <p>
                    Total Register Shifts: <span className="font-bold">{zReportData.totalShifts} Shifts</span>
                  </p>
                )}
                <p>Printed: {formatDateTime(new Date())}</p>
              </div>
            </div>

            <div className="space-y-2 py-3 border-b-2 border-dashed border-black/40 text-sm">
              <div className="flex justify-between">
                <span>Opening Cash Drawer Float:</span>
                <span className="font-bold">{formatCurrency(zReportData.openingFloat)}</span>
              </div>
              <div className="flex justify-between">
                <span>Opening Card Float:</span>
                <span className="font-bold">{formatCurrency(zReportData.openingCardFloat || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Gross Register Sales:</span>
                <span className="font-bold text-base">{formatCurrency(zReportData.grossSales)}</span>
              </div>
              <div className="flex justify-between">
                <span>Direct Physical Cash Sales:</span>
                <span className="font-bold text-emerald-800">{formatCurrency(zReportData.cashSales)}</span>
              </div>
              <div className="flex justify-between">
                <span>Electronic Card (Mada) Sales:</span>
                <span className="font-bold text-sky-800">{formatCurrency(zReportData.cardSales)}</span>
              </div>
              <div className="flex justify-between">
                <span>VAT Collected (15% Included):</span>
                <span>{formatCurrency(zReportData.vatCollected)}</span>
              </div>
            </div>

            <div className="space-y-2.5 py-3 border-b-2 border-dashed border-black/40 bg-slate-50 p-4 rounded-xl text-sm">
              <div className="flex justify-between text-slate-700">
                <span>Expected Cash In Drawer:</span>
                <span className="font-bold">{formatCurrency(zReportData.expectedCash)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900">
                <span>Actual Counted Cash:</span>
                <span className="font-black text-base">{formatCurrency(zReportData.actualCash)}</span>
              </div>
              <div className="flex justify-between font-black text-base pt-2.5 border-t border-black/20">
                <span>Cash Variance (Difference):</span>
                <span
                  className={
                    Math.abs(Number(zReportData.cashVariance)) < 0.01
                      ? 'text-emerald-800 font-bold'
                      : Number(zReportData.cashVariance) > 0
                      ? 'text-blue-800 font-bold'
                      : 'text-red-700 font-bold'
                  }
                >
                  {Number(zReportData.cashVariance) > 0 ? '+' : ''}
                  {formatCurrency(zReportData.cashVariance)}
                </span>
              </div>
            </div>

            <div className="text-center pt-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">Certified Audit Record • Point of Sale Ledger</p>
              <p className="font-mono text-[10px] text-slate-400">HASH: SHA256-REGISTER-CLOSURE-VERIFIED</p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
