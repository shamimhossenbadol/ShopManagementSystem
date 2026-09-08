'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { printZReportDirectly } from './printZReport';
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

function formatHumanDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const y = parts[0];
      const m = months[parseInt(parts[1], 10) - 1] || parts[1];
      const d = parts[2].padStart(2, '0');
      return `${d} ${m} ${y}`;
    }
  } catch {}
  return dateStr || '';
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

  // Export Daily or Range Business Records as CSV (Executive Financial Audit Ledger)
  const handleExportCSV = () => {
    const sessions = dailyData?.staffSessions?.length ? dailyData.staffSessions : allShifts;
    if (!sessions || !sessions.length) {
      alert('No staff session records found for the selected period.');
      return;
    }

    const isRange = startDate !== endDate;
    const formattedStartDate = formatHumanDate(startDate);
    const formattedEndDate = formatHumanDate(endDate);
    const periodLabel = isRange ? `${formattedStartDate} to ${formattedEndDate}` : formattedStartDate;

    const shopName = settings?.shop_name_en || settings?.shop_name_ar || 'AL-NOOR SUPERMARKET & HYPERMARKET';
    const vatNumber = settings?.shop_vat_number || settings?.vat_number || '300123456700003';
    const crNumber = settings?.shop_cr_number || settings?.cr_number || '1010123456';
    const phone = settings?.shop_phone || settings?.phone || '+966 11 456 7890';
    const address = settings?.shop_address || settings?.address || 'Riyadh, Saudi Arabia';

    const closedCount = sessions.filter((s: any) => s.status === 'closed').length;
    const activeCount = sessions.filter((s: any) => s.status !== 'closed').length;

    // Aggregate key indicators
    const { totals } = dailyData || {};
    const totalGrossRevenue = Number(totals?.totalGrossSales || sessions.reduce((sum: number, s: any) => sum + Number(s.grossSales || 0), 0));
    const totalVatCollected = Number(totals?.totalTaxCollected || sessions.reduce((sum: number, s: any) => sum + Number(s.totalTaxCollected || 0), 0)) ||
      Number(((totalGrossRevenue * 15) / 115).toFixed(2));
    const totalNetRevenue = Math.max(0, totalGrossRevenue - totalVatCollected);
    const totalCashSales = Number(totals?.totalCashSales || sessions.reduce((sum: number, s: any) => sum + Number(s.cashSales || 0), 0));
    const totalCardSales = Number(totals?.totalCardSales || sessions.reduce((sum: number, s: any) => sum + Number(s.cardSales || 0), 0));
    const totalInvoicesCount = Number(totals?.totalInvoices || sessions.reduce((sum: number, s: any) => sum + Number(s.invoicesCount || 0), 0));
    const totalCashRefunds = Number(totals?.totalCashRefunds || sessions.reduce((sum: number, s: any) => sum + Number(s.cashRefunds || 0), 0));
    const totalCashExpenses = Number(totals?.totalCashExpenses || sessions.reduce((sum: number, s: any) => sum + Number(s.cashExpenses || 0), 0));
    // Physical Cash Drawer Metrics (STRICTLY SEPARATED)
    const totalOpeningCashFloat = Number(totals?.totalOpeningFloat || sessions.reduce((sum: number, s: any) => sum + Number(s.openingFloat || s.opening_balance || 0), 0));
    const totalExpectedCash = Number(totals?.expectedCashInDrawers || sessions.reduce((sum: number, s: any) => sum + Number(s.expectedCash || s.expected_balance || 0), 0));
    const totalCountedCash = Number(totals?.totalCountedCash || sessions.filter((s: any) => s.status === 'closed').reduce((sum: number, s: any) => sum + Number(s.countedCash || s.closing_balance || 0), 0));
    const totalCashVariance = Number(totals?.totalDiscrepancy || sessions.filter((s: any) => s.status === 'closed').reduce((sum: number, s: any) => sum + Number(s.difference || s.cashDifference || 0), 0));

    // Electronic Card Terminal Metrics (STRICTLY SEPARATED)
    const totalOpeningCardFloat = Number(totals?.totalOpeningCardFloat || sessions.reduce((sum: number, s: any) => sum + Number(s.openingCardFloat || s.opening_card_balance || 0), 0));
    const totalExpectedCard = Number(totals?.expectedCardTotal || sessions.reduce((sum: number, s: any) => {
      const cardFloat = Number(s.openingCardFloat ?? s.opening_card_balance ?? 0);
      const cardSales = Number(s.cardSales ?? 0);
      return sum + (s.terminalCardExpected !== undefined && s.terminalCardExpected !== null ? Number(s.terminalCardExpected) : (cardFloat + cardSales));
    }, 0));
    const totalCountedCard = Number(totals?.totalCountedCard || sessions.filter((s: any) => s.status === 'closed').reduce((sum: number, s: any) => sum + Number(s.terminalCardTotal ?? s.countedCard ?? 0), 0));
    const totalCardVariance = Number(totals?.totalCardDiscrepancy || sessions.filter((s: any) => s.status === 'closed').reduce((sum: number, s: any) => sum + Number(s.terminalCardDiscrepancy ?? s.cardDifference ?? 0), 0));

    // Combined Store Audit Totals (Total Section Concept)
    const totalCombinedFloats = totalOpeningCashFloat + totalOpeningCardFloat;
    const totalCombinedExpected = totalExpectedCash + totalExpectedCard;
    const totalCombinedCounted = totalCountedCash + totalCountedCard;
    const totalNetVariance = totalCashVariance + totalCardVariance;

    const cashSharePct = totalGrossRevenue > 0 ? ((totalCashSales / totalGrossRevenue) * 100).toFixed(1) : '0.0';
    const cardSharePct = totalGrossRevenue > 0 ? ((totalCardSales / totalGrossRevenue) * 100).toFixed(1) : '0.0';
    const avgBasket = totalInvoicesCount > 0 ? (totalGrossRevenue / totalInvoicesCount).toFixed(2) : '0.00';

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    // 1. Business & Store Identification Block
    const metaBlock = [
      ['REPORT TITLE', escapeCSV('OFFICIAL POINT OF SALE CASH DRAWER & FINANCIAL AUDIT LEDGER')],
      ['COMPANY / SHOP NAME', escapeCSV(shopName)],
      ['VAT REGISTRATION NUMBER', escapeCSV(vatNumber)],
      ['COMMERCIAL REGISTRATION (CR)', escapeCSV(crNumber)],
      ['STORE ADDRESS', escapeCSV(address)],
      ['STORE PHONE', escapeCSV(phone)],
      ['AUDIT PERIOD', escapeCSV(periodLabel)],
      ['AUDIT SCOPE', escapeCSV(isRange ? 'Consolidated Period Records' : 'Daily Shift Settlement Records')],
      ['GENERATED TIMESTAMP', escapeCSV(new Date().toLocaleString())],
      ['BASE CURRENCY', escapeCSV('SAR (Saudi Riyal)')],
    ];

    // 2. Executive Financial KPI Summary (Structured into Cash, Card, and Total Audit Sections)
    const summaryKPIs = [
      ['', ''],
      ['--- EXECUTIVE FINANCIAL AUDIT SUMMARY (KPIS) ---', ''],
      ['FINANCIAL METRIC', 'AMOUNT (SAR) / METRIC VALUE', 'BUSINESS BENCHMARK / AUDIT NOTE'],
      ['Total Register Shifts', `${sessions.length} Shifts`, `${closedCount} Closed & Settled, ${activeCount} Live / Active`],
      ['Total Customer Invoices / Transactions', `${totalInvoicesCount} Invoices`, 'Completed Point of Sale customer bills'],
      ['Gross Revenue (VAT Inclusive)', totalGrossRevenue.toFixed(2), 'Total customer sales billing value (Cash + Card)'],
      ['Net Taxable Revenue (Excl. VAT)', totalNetRevenue.toFixed(2), 'Gross sales minus 15% VAT component'],
      ['Total VAT Collected (15% Standard Rate)', totalVatCollected.toFixed(2), '15% ZATCA tax collected on behalf of authority'],
      ['Average Basket / Ticket Size', avgBasket, 'Average customer spend per invoice'],
      ['Direct Physical Cash Sales', totalCashSales.toFixed(2), `${cashSharePct}% of total gross revenue`],
      ['Electronic Card (Mada) Sales', totalCardSales.toFixed(2), `${cardSharePct}% of total gross revenue`],
      ['Cash Customer Refunds (Outflow)', totalCashRefunds.toFixed(2), 'Deductions from cash drawer for returned merchandise'],
      ['Cash Operating Expenses (Outflow)', totalCashExpenses.toFixed(2), 'Authorized store payouts from drawer'],
      ['', ''],
      ['--- 1. PHYSICAL CASH DRAWER RECONCILIATION ---', ''],
      ['Opening Cash Float', totalOpeningCashFloat.toFixed(2), 'Starting physical drawer float across counters'],
      ['Direct Physical Cash Sales', totalCashSales.toFixed(2), 'Cash received in register tills'],
      ['Cash Deductions (Refunds + Expenses)', (totalCashRefunds + totalCashExpenses).toFixed(2), 'Cash paid out of till'],
      ['Expected Cash in Drawers', totalExpectedCash.toFixed(2), 'Cash Float + Cash Sales - Cash Deductions'],
      ['Actual Counted Cash', totalCountedCash.toFixed(2), 'Physical cash counted upon register closure'],
      ['Cash Drawer Variance', totalCashVariance.toFixed(2), Math.abs(totalCashVariance) < 0.01 ? 'BALANCED (100% Reconciliation)' : (totalCashVariance > 0 ? 'OVERAGE (Surplus Cash in Drawer)' : 'SHORTAGE (Deficit in Drawer)')],
      ['', ''],
      ['--- 2. ELECTRONIC CARD TERMINAL SETTLEMENT ---', ''],
      ['Opening Card Float', totalOpeningCardFloat.toFixed(2), 'Initial electronic card terminal float / balance'],
      ['Terminal Card Sales', totalCardSales.toFixed(2), 'Sum of electronic card batch transactions'],
      ['Expected Electronic Card Total', totalExpectedCard.toFixed(2), 'Opening Card Float + Terminal Card Sales'],
      ['Actual Settled Card Terminals', totalCountedCard.toFixed(2), 'Bank POS terminal settlement batch slips'],
      ['Card Terminal Variance', totalCardVariance.toFixed(2), Math.abs(totalCardVariance) < 0.01 ? 'BALANCED (100% Reconciliation)' : (totalCardVariance > 0 ? 'CARD SURPLUS' : 'CARD DISCREPANCY DETECTED')],
      ['', ''],
      ['--- 3. TOTAL SHIFT AUDIT SETTLEMENT (TOTAL SECTION) ---', ''],
      ['Total Combined Opening Floats', totalCombinedFloats.toFixed(2), 'Cash Float + Card Float'],
      ['Total Combined Expected Settlements', totalCombinedExpected.toFixed(2), 'Expected Cash in Till + Expected Card Settlements'],
      ['Total Combined Counted & Settled', totalCombinedCounted.toFixed(2), 'Counted Physical Cash + Settled Terminal Slips'],
      ['NET STORE AUDIT DISCREPANCY', totalNetVariance.toFixed(2), Math.abs(totalNetVariance) < 0.01 ? 'PERFECT RECONCILIATION (100% MATCH)' : (totalNetVariance > 0 ? 'NET STORE SURPLUS' : 'NET STORE DEFICIT')],
      ['', ''],
      ['--- DETAILED REGISTER SHIFT AUDIT LEDGER ---', ''],
    ];

    // 3. Detailed Tabular Columns
    const tableHeaders = [
      'Shift Sequence',
      'Shift Session ID',
      'Terminal / Register',
      'Cashier Name',
      'Username',
      'Operator Role',
      'Shift Status',
      'Shift Opened At',
      'Shift Closed At',
      'Shift Duration',
      'Opening Cash Float (SAR)',
      'Opening Card Float (SAR)',
      'Total Invoices',
      'Gross Sales Incl. VAT (SAR)',
      'Net Sales Excl. VAT (SAR)',
      'VAT Collected 15% (SAR)',
      'Cash Sales (SAR)',
      'Card Sales (SAR)',
      'Cash Tender %',
      'Card Tender %',
      'Average Ticket (SAR)',
      'Customer Cash Refunds (SAR)',
      'Cash Operating Expenses (SAR)',
      'Net Cash Flow (SAR)',
      'Expected Cash In Drawer (SAR)',
      'Actual Counted Cash (SAR)',
      'Cash Variance (SAR)',
      'Cash Drawer Audit Status',
      'Expected Card Total (SAR)',
      'Actual Settled Card (SAR)',
      'Card Variance (SAR)',
      'Card Terminal Audit Status',
      'Net Shift Variance (SAR)',
      'Shift Reconciliation Result',
      'Closing Note / Cashier Audit Remarks',
    ];

    const tableRows = sessions.map((s: any) => {
      const gross = Number(s.grossSales || 0);
      const vat = Number(s.totalTaxCollected || 0) || Number(((gross * 15) / 115).toFixed(2));
      const net = Math.max(0, gross - vat);
      const cash = Number(s.cashSales || 0);
      const card = Number(s.cardSales || 0);
      const invoices = Number(s.invoicesCount || 0);
      const refunds = Number(s.cashRefunds || 0);
      const expenses = Number(s.cashExpenses || 0);
      const netCashFlow = cash - refunds - expenses;

      const cashPct = gross > 0 ? `${((cash / gross) * 100).toFixed(1)}%` : '0.0%';
      const cardPct = gross > 0 ? `${((card / gross) * 100).toFixed(1)}%` : '0.0%';
      const ticket = invoices > 0 ? (gross / invoices).toFixed(2) : '0.00';

      const isClosed = s.status === 'closed';
      const cashDiff = isClosed ? Number(s.difference ?? s.cashDifference ?? 0) : 0;
      const cardDiff = isClosed ? Number(s.terminalCardDiscrepancy ?? s.cardDifference ?? 0) : 0;
      const netShiftDiff = cashDiff + cardDiff;

      const cashStatus = !isClosed ? 'ACTIVE / IN PROGRESS' : Math.abs(cashDiff) < 0.01 ? 'BALANCED' : cashDiff > 0 ? 'OVERAGE' : 'SHORTAGE';
      const cardStatus = !isClosed ? 'ACTIVE / IN PROGRESS' : Math.abs(cardDiff) < 0.01 ? 'BALANCED' : 'DISCREPANCY';
      const auditResult = !isClosed ? 'ACTIVE REGISTER' : Math.abs(netShiftDiff) < 0.01 ? 'BALANCED (100%)' : 'VARIANCE DETECTED';

      const cleanName = (s.userName || 'Cashier')
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/@\w+/g, '')
        .trim();

      return [
        escapeCSV(s.sequenceNumber ? `Shift #${s.sequenceNumber}` : `Shift #${s.id}`),
        s.id,
        escapeCSV(s.terminalName || 'Terminal-01'),
        escapeCSV(cleanName),
        escapeCSV(s.username || ''),
        escapeCSV(s.userRole || 'cashier'),
        escapeCSV(isClosed ? 'CLOSED' : 'ACTIVE'),
        escapeCSV(s.openedAt ? new Date(s.openedAt).toLocaleString() : ''),
        escapeCSV(s.closedAt ? new Date(s.closedAt).toLocaleString() : 'ACTIVE / LIVE'),
        escapeCSV(computeDuration(s.openedAt, s.closedAt)),
        Number(s.openingFloat || s.opening_balance || 0).toFixed(2),
        Number(s.openingCardFloat || s.opening_card_balance || 0).toFixed(2),
        invoices,
        gross.toFixed(2),
        net.toFixed(2),
        vat.toFixed(2),
        cash.toFixed(2),
        card.toFixed(2),
        escapeCSV(cashPct),
        escapeCSV(cardPct),
        ticket,
        refunds.toFixed(2),
        expenses.toFixed(2),
        netCashFlow.toFixed(2),
        Number(s.expectedCash || s.expected_balance || 0).toFixed(2),
        isClosed ? Number(s.countedCash || s.closing_balance || 0).toFixed(2) : 'UNCOUNTED',
        cashDiff.toFixed(2),
        escapeCSV(cashStatus),
        Number(s.terminalCardExpected !== undefined && s.terminalCardExpected !== null ? s.terminalCardExpected : ((Number(s.openingCardFloat || s.opening_card_balance || 0)) + card)).toFixed(2),
        isClosed ? Number(s.terminalCardTotal ?? s.countedCard ?? 0).toFixed(2) : 'UNCOUNTED',
        cardDiff.toFixed(2),
        escapeCSV(cardStatus),
        netShiftDiff.toFixed(2),
        escapeCSV(auditResult),
        escapeCSV(s.closingNote || ''),
      ];
    });

    const csvLines = [
      ...metaBlock.map(row => row.join(',')),
      ...summaryKPIs.map(row => row.join(',')),
      tableHeaders.join(','),
      ...tableRows.map(row => row.join(',')),
    ];

    const csvContent = '\uFEFF' + csvLines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = isRange
      ? `POS_Cash_Audit_${startDate}_to_${endDate}.csv`
      : `POS_Cash_Audit_${startDate}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print Consolidated Z-Report for selected Date or Range directly to native printer (Excluding Active Sessions)
  const handleOpenConsolidatedZReport = () => {
    const isRange = startDate !== endDate;
    const formattedStartDate = formatHumanDate(startDate);
    const formattedEndDate = formatHumanDate(endDate);
    const periodLabel = isRange ? `${formattedStartDate} - ${formattedEndDate}` : formattedStartDate;

    // Filter strictly for CLOSED sessions only - active sessions must not be included
    const allSessions = dailyData?.staffSessions || allShifts || [];
    const closedSessions = allSessions.filter((s: any) => s.status === 'closed');

    if (closedSessions.length === 0) {
      alert('No closed register shifts found for the selected period. Active shifts are not included.');
      return;
    }

    const totalOpeningFloat = closedSessions.reduce((sum: number, s: any) => sum + Number(s.openingFloat || s.opening_balance || 0), 0);
    const totalOpeningCardFloat = closedSessions.reduce((sum: number, s: any) => sum + Number(s.openingCardFloat || s.opening_card_balance || 0), 0);
    const totalGrossSales = closedSessions.reduce((sum: number, s: any) => sum + Number(s.grossSales || 0), 0);
    const totalCashSales = closedSessions.reduce((sum: number, s: any) => sum + Number(s.cashSales || 0), 0);
    const totalCardSales = closedSessions.reduce((sum: number, s: any) => sum + Number(s.cardSales || 0), 0);
    const totalInvoices = closedSessions.reduce((sum: number, s: any) => sum + Number(s.invoicesCount || 0), 0);
    const totalTaxCollected = closedSessions.reduce((sum: number, s: any) => sum + Number(s.totalTaxCollected || 0), 0) ||
      (Number(dailyData?.totals?.totalTaxCollected || 0) > 0 && closedSessions.length === allSessions.length
        ? Number(dailyData?.totals?.totalTaxCollected)
        : Number(((totalGrossSales * 15) / 115).toFixed(2)));
    const totalCashRefunds = closedSessions.reduce((sum: number, s: any) => sum + Number(s.cashRefunds || 0), 0);
    const totalCashExpenses = closedSessions.reduce((sum: number, s: any) => sum + Number(s.cashExpenses || 0), 0);
    const expectedCashInDrawers = closedSessions.reduce((sum: number, s: any) => sum + Number(s.expectedCash || s.expected_balance || 0), 0);
    const totalCountedCash = closedSessions.reduce((sum: number, s: any) => sum + Number(s.countedCash || s.closing_balance || 0), 0);
    const totalDiscrepancy = closedSessions.reduce((sum: number, s: any) => sum + Number(s.difference || s.cashDifference || 0), 0);
    const expectedCard = closedSessions.reduce((sum: number, s: any) => sum + Number(s.terminalCardExpected ?? s.expectedCard ?? s.cardSales ?? 0), 0);
    const actualCard = closedSessions.reduce((sum: number, s: any) => sum + Number(s.terminalCardTotal ?? s.countedCard ?? s.cardSales ?? 0), 0);
    const cardVariance = closedSessions.reduce((sum: number, s: any) => sum + Number(s.terminalCardDiscrepancy ?? s.cardDifference ?? 0), 0);

    printZReportDirectly(
      {
        isRange: true,
        periodLabel,
        sessionId: periodLabel,
        cashierName: 'Consolidated Store Ledger',
        totalShifts: closedSessions.length,
        openingFloat: totalOpeningFloat,
        openingCardFloat: totalOpeningCardFloat,
        grossSales: totalGrossSales,
        cashSales: totalCashSales,
        cardSales: totalCardSales,
        vatCollected: totalTaxCollected,
        invoicesCount: totalInvoices,
        cashRefunds: totalCashRefunds,
        cashExpenses: totalCashExpenses,
        expectedCash: expectedCashInDrawers,
        actualCash: totalCountedCash,
        cashVariance: totalDiscrepancy,
        expectedCard,
        actualCard,
        cardVariance,
      },
      settings,
      formatCurrency,
      formatDateTime
    );
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

      {/* 3. Store Financial Matrix (5 Structured Audit Matrix Cards) */}
      {(() => {
        // 1. Opening Floats
        const openCash = Number(totals?.totalOpeningFloat || 0);
        const openCard = Number(totals?.totalOpeningCardFloat || 0);
        const openTotal = openCash + openCard;

        // 2. Sales Inflows
        const cashSales = Number(totals?.totalCashSales || 0);
        const cardSales = Number(totals?.totalCardSales || 0);
        const grossSales = Number(totals?.totalGrossSales || (cashSales + cardSales));
        const cashInflowPct = grossSales > 0 ? ((cashSales / grossSales) * 100).toFixed(0) : '0';
        const cardInflowPct = grossSales > 0 ? ((cardSales / grossSales) * 100).toFixed(0) : '0';

        // 3. Refunds & Out
        const cashOut = Number((totals?.totalCashRefunds || 0) + (totals?.totalCashExpenses || 0));
        const cardOut = Number(totals?.totalCardRefunds || 0);
        const totalOut = cashOut + cardOut;

        // 4. Expected
        const expectedCash = Number(totals?.expectedCashInDrawers || 0);
        const expectedCard = Number(totals?.expectedCardTotal || (openCard + cardSales));
        const totalExpected = expectedCash + expectedCard;

        // 5. Counted & Diff
        const countedCash = Number(totals?.totalCountedCash || 0);
        const countedCard = Number(totals?.totalCountedCard || 0);
        const cashDiff = Number(totals?.totalDiscrepancy || 0);
        const cardDiff = Number(totals?.totalCardDiscrepancy || 0);
        const netDiff = Number(totals?.netTotalDiscrepancy ?? (cashDiff + cardDiff));
        const isDiffBalanced = Math.abs(netDiff) < 0.01;

        return (
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* 1. Opening FLOATS */}
              <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#0B0F17] p-3.5 shadow-sm space-y-2.5 hover:border-slate-300 dark:hover:border-neutral-700 transition-all">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-neutral-800/80">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    1. Opening Floats
                  </span>
                  <Banknote className="h-4 w-4 text-blue-500" />
                </div>

                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-neutral-400 font-sans text-xs font-medium">Cash:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(openCash)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-neutral-400 font-sans text-xs font-medium">Card:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(openCard)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80 dark:border-neutral-800 flex items-center justify-between font-mono">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total:</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {formatCurrency(openTotal)}
                  </span>
                </div>
              </div>

              {/* 2. CASH INFLOWS */}
              <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#0B0F17] p-3.5 shadow-sm space-y-2.5 hover:border-slate-300 dark:hover:border-neutral-700 transition-all">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-neutral-800/80">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    2. Cash Inflows
                  </span>
                  <Coins className="h-4 w-4 text-emerald-500" />
                </div>

                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-neutral-400 font-sans text-xs font-medium">Cash:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(cashSales)} <span className="text-[10px] text-slate-400 font-normal">({cashInflowPct}%)</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-neutral-400 font-sans text-xs font-medium">Card:</span>
                    <span className="font-bold text-sky-600 dark:text-sky-400">
                      {formatCurrency(cardSales)} <span className="text-[10px] text-slate-400 font-normal">({cardInflowPct}%)</span>
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80 dark:border-neutral-800 flex items-center justify-between font-mono">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total:</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {formatCurrency(grossSales)}
                  </span>
                </div>
              </div>

              {/* 3. REFUNDS & OUT */}
              <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#0B0F17] p-3.5 shadow-sm space-y-2.5 hover:border-slate-300 dark:hover:border-neutral-700 transition-all">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-neutral-800/80">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    3. Refunds & Out
                  </span>
                  <ArrowDownLeft className="h-4 w-4 text-amber-500" />
                </div>

                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-neutral-400 font-sans text-xs font-medium">Cash:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(cashOut)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-neutral-400 font-sans text-xs font-medium">Card:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(cardOut)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80 dark:border-neutral-800 flex items-center justify-between font-mono">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total:</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {formatCurrency(totalOut)}
                  </span>
                </div>
              </div>

              {/* 4. EXPECTED */}
              <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 p-3.5 shadow-sm space-y-2.5 hover:border-blue-300 dark:hover:border-blue-800 transition-all">
                <div className="flex items-center justify-between pb-2 border-b border-blue-100 dark:border-blue-900/50">
                  <span className="text-[11px] font-black uppercase tracking-wider text-blue-700 dark:text-sky-400">
                    4. Expected
                  </span>
                  <Layers className="h-4 w-4 text-blue-600 dark:text-sky-400" />
                </div>

                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700/80 dark:text-sky-400/80 font-sans text-xs font-medium">Cash:</span>
                    <span className="font-bold text-blue-900 dark:text-sky-200">
                      {formatCurrency(expectedCash)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700/80 dark:text-sky-400/80 font-sans text-xs font-medium">Card:</span>
                    <span className="font-bold text-blue-900 dark:text-sky-200">
                      {formatCurrency(expectedCard)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-blue-200/80 dark:border-blue-900/60 flex items-center justify-between font-mono">
                  <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-sky-400 tracking-wider">Total:</span>
                  <span className="text-sm font-black text-blue-950 dark:text-white">
                    {formatCurrency(totalExpected)}
                  </span>
                </div>
              </div>

              {/* 5. COUNTED */}
              <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#0B0F17] p-3.5 shadow-sm space-y-2.5 hover:border-slate-300 dark:hover:border-neutral-700 transition-all">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-neutral-800/80">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    5. Counted
                  </span>
                  <ShieldAlert
                    className={`h-4 w-4 ${
                      isDiffBalanced ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  />
                </div>

                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-neutral-400 font-sans text-xs font-medium">Cash:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(countedCash)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-neutral-400 font-sans text-xs font-medium">Card:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(countedCard)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80 dark:border-neutral-800 flex items-center justify-between font-mono">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Diff:</span>
                  <span
                    className={`text-sm font-black ${
                      isDiffBalanced
                        ? 'text-emerald-500 font-bold'
                        : netDiff > 0
                        ? 'text-sky-500 font-bold'
                        : 'text-rose-500 font-bold'
                    }`}
                  >
                    {netDiff > 0 ? '+' : ''}
                    {formatCurrency(netDiff)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
          showCloseButton={false}
          maxWidth="4xl"
          footer={
            <div className="flex w-full items-center justify-between">
              {selectedShiftDetails?.session?.status === 'closed' ? (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    if (selectedShiftDetails?.session) {
                      const s = selectedShiftDetails.session;
                      printZReportDirectly(
                        {
                          sessionId: s.sequence_number ? `#${s.sequence_number}` : `#${s.id}`,
                          shiftSequence: s.sequence_number || s.id,
                          cashierName: s.user_name || 'Cashier',
                          cashierUsername: s.username,
                          cashierRole: s.user_role,
                          status: s.status,
                          openedAt: s.opened_at,
                          closedAt: s.closed_at,
                          duration: computeDuration(s.opened_at, s.closed_at),
                          openingFloat: Number(s.openingBalance ?? s.opening_balance ?? 0),
                          openingCardFloat: Number(s.openingCardBalance ?? s.opening_card_balance ?? 0),
                          grossSales: Number(s.grossSales ?? ((s.cashSales || 0) + (s.cardSales || 0))),
                          cashSales: Number(s.cashSales || 0),
                          cardSales: Number(s.cardSales || 0),
                          vatCollected: Number(s.totalTaxCollected || 0),
                          invoicesCount: Number(s.invoicesCount ?? selectedShiftDetails.invoices?.length ?? 0),
                          cashRefunds: Number(s.cashRefunds || 0),
                          cashExpenses: Number(s.cashExpenses || 0),
                          manualCashIns: Number(s.manualCashIns || 0),
                          expectedCash: Number(s.expectedCash ?? s.expected_balance ?? 0),
                          actualCash: Number(s.closing_balance || 0),
                          cashVariance: Number(s.cashDifference ?? s.difference ?? 0),
                          expectedCard: Number(s.expectedCard ?? s.terminal_card_expected ?? s.cardSales ?? 0),
                          actualCard: Number(s.countedCard ?? s.terminal_card_total ?? s.cardSales ?? 0),
                          cardVariance: Number(s.cardDifference ?? s.terminal_card_discrepancy ?? 0),
                          forceClosedByName: s.forceClosedByName || s.force_closed_by_name,
                        },
                        settings,
                        formatCurrency,
                        formatDateTime
                      );
                    }
                  }}
                  leftIcon={<Printer className="h-4 w-4" />}
                  className="h-10 min-h-[40px] max-h-[40px]"
                >
                  Print Shift Z-Report
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 px-3 py-2 rounded-xl">
                  <Clock className="h-4 w-4 shrink-0 text-amber-500" />
                  <span>Z-Report available after shift closing</span>
                </div>
              )}
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
          ) : (() => {
            const s = selectedShiftDetails.session;
            const invList: ShiftInvoice[] = selectedShiftDetails.invoices || [];
            const isOpen = s.status === 'open';
            const totalItemsSold = invList.reduce((sum, inv) => sum + Number(inv.totalItems || 0), 0);
            const netSales = invList.reduce((sum, inv) => sum + Number(inv.subtotal || 0), 0) ||
              ((Number(s.grossSales || 0)) - (Number(s.totalTaxCollected || 0)));
            const cashDiff = Number(s.difference || 0);
            const cardDiff = Number(s.terminal_card_discrepancy || 0);
            const isCashBalanced = Math.abs(cashDiff) < 0.01;
            const isCardBalanced = Math.abs(cardDiff) < 0.01;
            const expectedCash = s.expectedCash ?? s.expected_balance ?? 0;
            const expectedCard = s.expectedCard ?? s.terminal_card_expected ?? ((s.opening_card_balance || 0) + (s.cardSales || 0));
            const cashDeductions = (Number(s.cashRefunds || 0)) + (Number(s.cashExpenses || 0));

            return (
              <div className="space-y-5 text-xs">
                {/* 1. Shift Reconciliation: 2 High-Yield Business Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* CARD 1: Sales & Revenue Breakdown */}
                  <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-[#0B0F17] shadow-sm flex flex-col space-y-3.5">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-neutral-800/80">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shadow-sm">
                          <Receipt className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white block">
                            Sales & Revenue Matrix
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {invList.length} {invList.length === 1 ? 'Invoice' : 'Invoices'} • {totalItemsSold} Items Sold
                          </span>
                        </div>
                      </div>

                      {isOpen ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Live</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 border border-slate-200 dark:border-neutral-700">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Settled</span>
                        </div>
                      )}
                    </div>

                    {/* Primary Hero: Total Sales Highlight */}
                    <div className="mt-1 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-950/40 dark:to-transparent p-3.5 rounded-xl border border-emerald-500/20 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] uppercase font-black text-emerald-700 dark:text-emerald-400 tracking-wider">
                        TOTAL SALES (VAT INCLUSIVE)
                      </span>
                      <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight mt-0.5">
                        {formatCurrency(s.grossSales || 0)}
                      </div>
                    </div>

                    {/* 4-KPI Grid */}
                    <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#121620] border border-slate-200/60 dark:border-neutral-800/80">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Cash Sells</span>
                        <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
                          {formatCurrency(s.cashSales || 0)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">
                          {s.grossSales > 0 ? `${Math.round(((s.cashSales || 0) / s.grossSales) * 100)}% of revenue` : '0%'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#121620] border border-slate-200/60 dark:border-neutral-800/80">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Card (Mada) Sells</span>
                        <span className="text-sm font-black text-sky-600 dark:text-sky-400 mt-0.5 block">
                          {formatCurrency(s.cardSales || 0)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">
                          {s.grossSales > 0 ? `${Math.round(((s.cardSales || 0) / s.grossSales) * 100)}% of revenue` : '0%'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#121620] border border-slate-200/60 dark:border-neutral-800/80">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Net Sells (Excl. VAT)</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                          {formatCurrency(netSales)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#121620] border border-slate-200/60 dark:border-neutral-800/80">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">VAT Collected (15%)</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                          {formatCurrency(s.totalTaxCollected || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CARD 2: Cash & Card Drawer Settlement Reconciliation */}
                  <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-[#0B0F17] shadow-sm flex flex-col space-y-3.5">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-neutral-800/80">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-sky-400 flex items-center justify-center font-bold shadow-sm">
                          <Banknote className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white block">
                            Cash & Card Reconciliation
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Dual Floats, Settlements & Variances
                          </span>
                        </div>
                      </div>

                      {isOpen ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Live</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 border border-slate-200 dark:border-neutral-700">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Settled</span>
                        </div>
                      )}
                    </div>

                    {/* Structured Comparison Table: Cash vs Card */}
                    <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-neutral-800">
                      <table className="w-full text-xs font-mono">
                        <thead className="bg-slate-50 dark:bg-[#121620] text-slate-500 font-bold border-b border-slate-200/80 dark:border-neutral-800">
                          <tr>
                            <th className="p-2 text-left font-sans text-[10px] uppercase tracking-wider text-slate-400">Reconciliation Stage</th>
                            <th className="p-2 text-right text-emerald-600 dark:text-emerald-400 text-[11px]">Cash Drawer</th>
                            <th className="p-2 text-right text-sky-600 dark:text-sky-400 text-[11px]">Card Terminal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80 text-[11px]">
                          <tr className="hover:bg-slate-50/50 dark:hover:bg-neutral-800/30">
                            <td className="p-2 font-sans text-slate-600 dark:text-neutral-400 font-medium">Opening Float</td>
                            <td className="p-2 text-right font-bold text-slate-800 dark:text-slate-200">
                              {formatCurrency(s.opening_balance || 0)}
                            </td>
                            <td className="p-2 text-right font-bold text-slate-800 dark:text-slate-200">
                              {formatCurrency(s.opening_card_balance || 0)}
                            </td>
                          </tr>

                          <tr className="hover:bg-slate-50/50 dark:hover:bg-neutral-800/30">
                            <td className="p-2 font-sans text-slate-600 dark:text-neutral-400 font-medium">Sales Inflow</td>
                            <td className="p-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                              +{formatCurrency(s.cashSales || 0)}
                            </td>
                            <td className="p-2 text-right font-semibold text-sky-600 dark:text-sky-400">
                              +{formatCurrency(s.cardSales || 0)}
                            </td>
                          </tr>

                          <tr className="hover:bg-slate-50/50 dark:hover:bg-neutral-800/30">
                            <td className="p-2 font-sans text-slate-600 dark:text-neutral-400 font-medium">Operating Deductions</td>
                            <td className="p-2 text-right font-semibold text-amber-600 dark:text-amber-400">
                              {cashDeductions > 0 ? `-${formatCurrency(cashDeductions)}` : '0.00 SAR'}
                            </td>
                            <td className="p-2 text-right text-slate-400">—</td>
                          </tr>

                          {/* Expected Highlight Row */}
                          <tr className="bg-blue-50/50 dark:bg-blue-950/20 font-bold border-t border-slate-200/80 dark:border-neutral-800">
                            <td className="p-2 font-sans text-blue-700 dark:text-sky-300 font-bold">Expected Amount</td>
                            <td className="p-2 text-right font-black text-blue-700 dark:text-sky-400 text-xs">
                              {formatCurrency(expectedCash)}
                            </td>
                            <td className="p-2 text-right font-black text-sky-600 dark:text-sky-300 text-xs">
                              {formatCurrency(expectedCard)}
                            </td>
                          </tr>

                          {/* Counted Row */}
                          <tr className="hover:bg-slate-50/50 dark:hover:bg-neutral-800/30 font-semibold">
                            <td className="p-2 font-sans text-slate-700 dark:text-slate-300 font-bold">Counted / Slip Total</td>
                            <td className="p-2 text-right font-black text-slate-900 dark:text-white">
                              {isOpen ? 'Active Counter' : formatCurrency(s.closing_balance || 0)}
                            </td>
                            <td className="p-2 text-right font-black text-slate-900 dark:text-white">
                              {isOpen ? 'Active Counter' : formatCurrency(s.terminal_card_total || 0)}
                            </td>
                          </tr>

                          {/* Variance Row */}
                          <tr className="bg-slate-50/80 dark:bg-[#121620] font-bold">
                            <td className="p-2 font-sans text-slate-600 dark:text-neutral-400">Audit Variance</td>
                            <td className="p-2 text-right">
                              {isOpen ? (
                                <span className="text-slate-400 font-normal">Pending Close</span>
                              ) : isCashBalanced ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓ Balanced</span>
                              ) : (
                                <span className={cashDiff > 0 ? 'text-amber-600 font-black' : 'text-rose-600 font-black'}>
                                  {cashDiff > 0 ? '+' : ''}{formatCurrency(cashDiff)}
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-right">
                              {isOpen ? (
                                <span className="text-slate-400 font-normal">Pending Close</span>
                              ) : isCardBalanced ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓ Balanced</span>
                              ) : (
                                <span className="text-rose-600 font-black">
                                  {cardDiff > 0 ? '+' : ''}{formatCurrency(cardDiff)}
                                </span>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
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
                        const cashPaid = inv.payments && inv.payments.length > 0
                          ? inv.payments.filter((p) => p.isCash).reduce((sum, p) => sum + Number(p.amount || 0), 0)
                          : Number(inv.paidAmount || 0);
                        const cardPaid = inv.payments && inv.payments.length > 0
                          ? inv.payments.filter((p) => !p.isCash).reduce((sum, p) => sum + Number(p.amount || 0), 0)
                          : 0;

                        const cleanCustomer = (inv.customerName || 'Walk-in Customer')
                          .replace(/\s*\(General Account\)/gi, '')
                          .trim() || 'Walk-in Customer';

                        return (
                          <div
                            key={inv.id}
                            className="rounded-xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-[#0B0F17] p-3.5 shadow-sm hover:border-slate-300 dark:hover:border-neutral-700 transition-all space-y-2.5"
                          >
                            <div
                              onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                              className="flex items-center justify-between cursor-pointer select-none gap-3"
                            >
                              {/* 1. Left: Icon + Invoice ID & Customer Name */}
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-neutral-800 flex items-center justify-center text-slate-600 dark:text-neutral-400 shrink-0">
                                  <Receipt className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-mono font-black text-sm text-slate-900 dark:text-white truncate">
                                    {inv.invoiceNo}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-neutral-400 font-medium truncate font-sans">
                                    {cleanCustomer}
                                  </div>
                                </div>
                              </div>

                              {/* 2. Center: Timestamp */}
                              <div className="flex items-center justify-center font-mono text-xs text-slate-500 dark:text-neutral-400 gap-1.5 px-2 shrink-0">
                                <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="whitespace-nowrap">{formatTimeWithSeconds(inv.createdAt)}</span>
                              </div>

                              {/* 3. Right: Amount details for Cash & Card vertically */}
                              <div className="flex items-center gap-3 shrink-0">
                                <div className="flex flex-col items-end justify-center font-mono text-[11px] leading-tight">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] uppercase font-sans font-semibold text-slate-400">Cash:</span>
                                    <span className={`font-bold ${cashPaid > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                      {formatCurrency(cashPaid)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] uppercase font-sans font-semibold text-slate-400">Card:</span>
                                    <span className={`font-bold ${cardPaid > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400'}`}>
                                      {formatCurrency(cardPaid)}
                                    </span>
                                  </div>
                                </div>

                                {/* Current Amount & Items */}
                                <div className="text-right font-mono pl-3 border-l border-slate-100 dark:border-neutral-800">
                                  <div className="font-black text-sm text-slate-900 dark:text-white">
                                    {formatCurrency(inv.grandTotal)}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-sans">
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
                                  {Number(inv.totalDiscount) > 0 && (
                                    <div>
                                      <span className="text-slate-400">Discount:</span>{' '}
                                      <span className="font-bold text-amber-600">-{formatCurrency(inv.totalDiscount)}</span>
                                    </div>
                                  )}
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
                                No movements recorded for this shift.
                              </p>
                              <p className="text-[11px] mt-0.5 text-slate-400">
                                Inflow, outflow, card and cash settlement movements will appear here.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          selectedShiftDetails.movements?.map((m: any) => {
                            const isCard = m.type === 'card_in' || String(m.source || '').includes('card');
                            const isOut = m.type === 'cash_out' || m.source === 'refund' || m.source === 'expense';
                            const isCashIn = !isCard && !isOut;

                            // Source Label: always clean, no hyphens or underscores
                            let sourceDisplay = m.source_label;
                            if (!sourceDisplay) {
                              const s = String(m.source || '').toLowerCase().replace(/[-_]/g, ' ');
                              if (s.includes('card')) {
                                sourceDisplay = 'Sell by card payment';
                              } else if (s.includes('sale') || s.includes('cash') || isCashIn) {
                                if (s.includes('opening') || s.includes('float')) {
                                  sourceDisplay = 'Opening Float';
                                } else {
                                  sourceDisplay = 'Sell by cash payment';
                                }
                              } else if (s.includes('expense')) {
                                sourceDisplay = 'Cash Expense';
                              } else if (s.includes('refund')) {
                                sourceDisplay = 'Cash Refund';
                              } else if (s.includes('deposit')) {
                                sourceDisplay = 'Manual Deposit';
                              } else if (s.includes('withdraw')) {
                                sourceDisplay = 'Manual Withdrawal';
                              } else {
                                sourceDisplay = 'Sell by cash payment';
                              }
                            } else {
                              sourceDisplay = sourceDisplay.replace(/[-_]/g, ' ');
                            }

                            // Clean description: omit '-' or '—'
                            const cleanDesc = m.description && m.description !== '—' && m.description !== '-'
                              ? m.description
                              : '';

                            return (
                              <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors">
                                <td className="p-2.5 text-slate-400 font-mono">{formatTimeWithSeconds(m.created_at)}</td>
                                <td className="p-2.5">
                                  {isCard ? (
                                    <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60">
                                      CARD IN
                                    </span>
                                  ) : isCashIn ? (
                                    <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                                      CASH IN
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200">
                                      CASH OUT
                                    </span>
                                  )}
                                </td>
                                <td className="p-2.5 text-slate-800 dark:text-slate-200 font-sans font-semibold">
                                  {sourceDisplay}
                                </td>
                                <td className="p-2.5 text-slate-500 dark:text-neutral-400 font-sans text-xs">
                                  {cleanDesc}
                                </td>
                                <td className="p-2.5 text-right font-bold font-mono">
                                  <span className={isCard ? 'text-sky-600 dark:text-sky-400' : isCashIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}>
                                    {formatCurrency(Math.abs(Number(m.amount || 0)))}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
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
          );
        })()}
      </Modal>
      )}
    </div>
  );
}
