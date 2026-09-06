'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { Button, IconButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { MetricCard } from '@/components/ui/MetricCard';
import {
  Banknote,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Plus,
  Check,
  AlertCircle,
  History,
  CreditCard,
  Receipt,
  ArrowRight,
  ShieldAlert,
  Download,
  Calendar,
  Layers,
  FileSpreadsheet,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Monitor,
  User,
  Filter,
  RefreshCw,
  XCircle,
} from 'lucide-react';

export default function CashSessionsPage() {
  const { formatCurrency, formatDateTime, formatTime, settings } = useSettings();

  // Tab View Controller: 'daily' vs 'all_sessions' vs 'timeline'
  const [activeTab, setActiveTab] = useState<'daily' | 'all_sessions' | 'timeline'>('daily');

  // Date selection for Daily Business Day records
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [dailyData, setDailyData] = useState<any>(null);
  const [activeUserShift, setActiveUserShift] = useState<any>(null);

  // All Sessions History State
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [allSessionsLoading, setAllSessionsLoading] = useState(false);
  const [sessionStatusFilter, setSessionStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [staffUserFilter, setStaffUserFilter] = useState<string>('all');
  const [staffList, setStaffList] = useState<any[]>([]);

  // Session Timeline State
  const [timelineSessions, setTimelineSessions] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelinePagination, setTimelinePagination] = useState<any>(null);
  const [timelineSummary, setTimelineSummary] = useState<any>(null);
  const [timelineStartDate, setTimelineStartDate] = useState('');
  const [timelineEndDate, setTimelineEndDate] = useState('');
  const [timelineUserId, setTimelineUserId] = useState('');
  const [expandedTimelineSession, setExpandedTimelineSession] = useState<number | null>(null);
  const [timelineSessionDetail, setTimelineSessionDetail] = useState<any>(null);

  // Force Close Shift (Manager action)
  const [forceCloseModalOpen, setForceCloseModalOpen] = useState(false);
  const [forceCloseSession, setForceCloseSession] = useState<any>(null);
  const [forceCloseNote, setForceCloseNote] = useState('');

  // Modals
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isZReportModalOpen, setIsZReportModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedSessionDetails, setSelectedSessionDetails] = useState<any>(null);
  const [zReportData, setZReportData] = useState<any>(null);

  // Forms
  const [openingFloat, setOpeningFloat] = useState<number>(100);
  const [actualClosingCash, setActualClosingCash] = useState<number>(0);
  const [actualCardTotal, setActualCardTotal] = useState<number>(0);
  const [closingNote, setClosingNote] = useState('');

  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async (dateParam?: string) => {
    setTableLoading(true);
    const dateToFetch = dateParam || selectedDate;

    // Fetch daily consolidated summary
    const dailyRes = await apiRequest(`/cash/daily-summary?date=${dateToFetch}`);
    if (dailyRes.success && dailyRes.data) {
      setDailyData(dailyRes.data);
    }

    // Fetch current user live status
    const statusRes = await apiRequest('/cash/status');
    if (statusRes.success && statusRes.data) {
      setActiveUserShift(statusRes.data);
      if (statusRes.data.hasActiveShift) {
        setActualClosingCash(statusRes.data.liveExpectedCash || 0);
        setActualCardTotal(statusRes.data.liveCardTotal || 0);
      }
    }

    setTableLoading(false);
  };

  const loadAllSessions = async () => {
    setAllSessionsLoading(true);
    let url = `/cash/sessions?status=${sessionStatusFilter}`;
    if (staffUserFilter !== 'all') {
      url += `&userId=${staffUserFilter}`;
    }
    const res = await apiRequest(url);
    if (res.success && res.data) {
      setAllSessions(res.data);
    }
    setAllSessionsLoading(false);
  };

  const loadTimeline = async () => {
    setTimelineLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(timelinePage));
    params.set('limit', '15');
    if (timelineStartDate) params.set('startDate', timelineStartDate);
    if (timelineEndDate) params.set('endDate', timelineEndDate);
    if (timelineUserId) params.set('userId', timelineUserId);
    
    const res = await apiRequest(`/cash/session-timeline?${params.toString()}`);
    if (res.success && res.data) {
      setTimelineSessions(res.data.sessions || []);
      setTimelinePagination(res.data.pagination || null);
      setTimelineSummary(res.data.summary || null);
    }
    setTimelineLoading(false);
  };

  const loadTimelineSessionDetail = async (sessionId: number) => {
    if (expandedTimelineSession === sessionId) {
      setExpandedTimelineSession(null);
      setTimelineSessionDetail(null);
      return;
    }
    setExpandedTimelineSession(sessionId);
    const res = await apiRequest(`/cash/sessions/${sessionId}`);
    if (res.success && res.data) {
      setTimelineSessionDetail(res.data);
    }
  };

  const loadStaffList = async () => {
    const res = await apiRequest('/auth/staff-list');
    if (res.success && res.data) {
      setStaffList(res.data);
    }
  };

  useEffect(() => {
    loadData(selectedDate);
    loadStaffList();
  }, [selectedDate]);

  useEffect(() => {
    if (activeTab === 'all_sessions') {
      loadAllSessions();
    }
  }, [activeTab, sessionStatusFilter, staffUserFilter]);

  useEffect(() => {
    if (activeTab === 'timeline') {
      loadTimeline();
    }
  }, [activeTab, timelinePage, timelineStartDate, timelineEndDate, timelineUserId]);

  const handleForceClose = async () => {
    if (!forceCloseSession) return;
    setLoading(true);
    const res = await apiRequest(`/cash/sessions/${forceCloseSession.id}/force-close`, {
      method: 'POST',
      body: JSON.stringify({ note: forceCloseNote }),
    });
    setLoading(false);
    if (res.success) {
      setForceCloseModalOpen(false);
      setForceCloseSession(null);
      setForceCloseNote('');
      loadData();
      loadAllSessions();
    } else {
      setErrorMsg(res.message || 'Failed to force close session.');
    }
  };

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const res = await apiRequest('/cash/open', {
      method: 'POST',
      body: JSON.stringify({
        openingBalance: Number(openingFloat),
      }),
    });

    setLoading(false);

    if (res.success) {
      setIsOpenModalOpen(false);
      loadData();
    } else {
      setErrorMsg(res.message || 'Failed to open cash shift.');
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const res = await apiRequest('/cash/close', {
      method: 'POST',
      body: JSON.stringify({
        actualClosingBalance: Number(actualClosingCash),
        terminalCardTotal: Number(actualCardTotal),
        closingNote,
      }),
    });

    setLoading(false);

    if (res.success && res.data?.zReport) {
      setIsCloseModalOpen(false);
      setZReportData(res.data.zReport);
      setIsZReportModalOpen(true);
      loadData();
    } else {
      setErrorMsg(res.message || 'Failed to close shift.');
    }
  };

  const openSessionDetails = async (session: any) => {
    const res = await apiRequest(`/cash/sessions/${session.id}`);
    if (res.success && res.data) {
      setSelectedSessionDetails(res.data);
      setIsDetailModalOpen(true);
    }
  };

  // Manager Export: Download Daily CSV
  const handleExportCSV = () => {
    if (!dailyData || !dailyData.staffSessions?.length) {
      alert('No staff session records found for the selected business day.');
      return;
    }

    const headers = [
      'Shift ID',
      'Terminal',
      'Staff Name',
      'Username',
      'Role',
      'Status',
      'Opened At',
      'Closed At',
      'Opening Float (SAR)',
      'Invoices Count',
      'Gross Sales (SAR)',
      'Cash Sales (SAR)',
      'Card Sales (SAR)',
      'Refunds (SAR)',
      'Expenses (SAR)',
      'Expected Cash (SAR)',
      'Counted Cash (SAR)',
      'Cash Variance (SAR)',
      'Card Expected (SAR)',
      'Card Settled (SAR)',
      'Card Variance (SAR)',
      'Closing Note',
    ];

    const rows = dailyData.staffSessions.map((s: any) => [
      s.id,
      `"${s.terminalName || 'Terminal-01'}"`,
      `"${s.userName || ''}"`,
      `"${s.username || ''}"`,
      `"${s.userRole || ''}"`,
      s.status,
      `"${s.openedAt ? new Date(s.openedAt).toLocaleString() : ''}"`,
      `"${s.closedAt ? new Date(s.closedAt).toLocaleString() : 'LIVE OPEN'}"`,
      s.openingFloat.toFixed(2),
      s.invoicesCount,
      s.grossSales.toFixed(2),
      s.cashSales.toFixed(2),
      s.cardSales.toFixed(2),
      s.cashRefunds.toFixed(2),
      s.cashExpenses.toFixed(2),
      s.expectedCash.toFixed(2),
      s.countedCash.toFixed(2),
      s.difference.toFixed(2),
      s.terminalCardExpected.toFixed(2),
      s.terminalCardTotal.toFixed(2),
      s.terminalCardDiscrepancy.toFixed(2),
      `"${s.closingNote || ''}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e: any[]) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Cash_Drawer_Records_${dailyData.businessDate || selectedDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const { totals, staffSessions, closingHour, businessDate } = dailyData || {};
  const hasUserActiveShift = activeUserShift?.hasActiveShift;

  return (
    <div className="space-y-6">
      {/* Header & Date Controller */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
              Daily Cash Drawer & Register Center
            </h1>
            <Badge variant="primary" className="font-mono text-[11px]">
              Closing Hour: {closingHour || settings.shop_closing_hour || '00:00'} (12 AM)
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Single counter cash drawer tracking, daily staff shifts, float reconciliation, Mada card settlements, and manager audit records.
          </p>
        </div>

        {/* Action Controls & Date Picker */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 shadow-sm">
            <Calendar className="h-4 w-4 text-slate-400 mr-2" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="ml-2 text-[11px] font-bold text-blue-600 dark:text-sky-400 hover:underline"
            >
              Today
            </button>
          </div>

          <Button
            variant="secondary"
            size="md"
            onClick={handleExportCSV}
            leftIcon={<Download className="h-4 w-4" />}
          >
            Export Daily CSV
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              setZReportData({
                sessionId: `DAILY-${businessDate || selectedDate}`,
                terminalName: 'Main Counter',
                cashierName: 'Consolidated Daily Store Report',
                openedAt: dailyData?.startTime,
                closedAt: dailyData?.endTime,
                openingFloat: totals?.totalOpeningFloat || 0,
                grossSales: totals?.totalGrossSales || 0,
                cashSales: totals?.totalCashSales || 0,
                cardSales: totals?.totalCardSales || 0,
                vatCollected: totals?.totalTaxCollected || 0,
                expectedCash: totals?.expectedCashInDrawers || 0,
                actualCash: totals?.totalCountedCash || 0,
                cashVariance: totals?.totalDiscrepancy || 0,
              });
              setIsZReportModalOpen(true);
            }}
            leftIcon={<Printer className="h-4 w-4" />}
          >
            Daily Z-Report
          </Button>

          {!hasUserActiveShift ? (
            <Button
              variant="success"
              size="md"
              onClick={() => {
                setErrorMsg(null);
                setIsOpenModalOpen(true);
              }}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Open Cash Shift
            </Button>
          ) : (
            <Button
              variant="danger"
              size="md"
              onClick={() => {
                setErrorMsg(null);
                setIsCloseModalOpen(true);
              }}
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
            >
              End My Shift
            </Button>
          )}
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('daily')}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'daily'
              ? 'border-blue-600 text-blue-600 dark:text-sky-400 dark:border-sky-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Daily Cash Drawer Matrix ({businessDate || selectedDate})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('all_sessions')}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'all_sessions'
              ? 'border-blue-600 text-blue-600 dark:text-sky-400 dark:border-sky-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <History className="h-4 w-4" />
          <span>All Sales Executive & Manager Sessions History</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'timeline'
              ? 'border-blue-600 text-blue-600 dark:text-sky-400 dark:border-sky-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Session Timeline</span>
        </button>
      </div>

      {/* TAB 1: DAILY CASH DRAWER & REGISTER CENTER */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          {/* Store Consolidated Daily Data Matrix */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-400">Total Opening Floats</span>
                <Banknote className="h-4 w-4 text-blue-500" />
              </div>
              <div className="mt-2 font-mono text-lg font-black text-slate-900 dark:text-white">
                {formatCurrency(totals?.totalOpeningFloat || 0)}
              </div>
              <div className="mt-1 text-[10px] text-slate-400">All registered drawers</div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-400">Store Cash Sales</span>
                <Coins className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 font-mono text-lg font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totals?.totalCashSales || 0)}
              </div>
              <div className="mt-1 text-[10px] text-slate-400">Physical Cash Inflows</div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-400">Terminal Card Sales</span>
                <CreditCard className="h-4 w-4 text-sky-500" />
              </div>
              <div className="mt-2 font-mono text-lg font-black text-sky-600 dark:text-sky-400">
                {formatCurrency(totals?.totalCardSales || 0)}
              </div>
              <div className="mt-1 text-[10px] text-slate-400">Mada & Electronic POS</div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-400">Refunds & Expenses</span>
                <ArrowDownLeft className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mt-2 font-mono text-lg font-black text-amber-600 dark:text-amber-400">
                {formatCurrency((totals?.totalCashRefunds || 0) + (totals?.totalCashExpenses || 0))}
              </div>
              <div className="mt-1 text-[10px] text-slate-400">Cash Deductions Out</div>
            </div>

            <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-blue-700 dark:text-sky-400">Expected in Drawers</span>
                <Layers className="h-4 w-4 text-blue-600 dark:text-sky-400" />
              </div>
              <div className="mt-2 font-mono text-lg font-black text-blue-900 dark:text-sky-300">
                {formatCurrency(totals?.expectedCashInDrawers || 0)}
              </div>
              <div className="mt-1 text-[10px] text-blue-600/70 dark:text-sky-400/70">Float + In - Out</div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-400">Counted / Discrepancy</span>
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

          {/* Staff Shifts & Multi-Terminal Records Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <Monitor className="h-4 w-4 text-blue-600 dark:text-sky-400" />
                Staff Register Shifts for Business Day ({businessDate || selectedDate})
              </h2>
              <div className="text-xs text-slate-400 font-medium">
                {staffSessions?.length || 0} Shift Session{staffSessions?.length === 1 ? '' : 's'} Logged
              </div>
            </div>

            <DataTable<any>
              isLoading={tableLoading}
              data={staffSessions || []}
              keyExtractor={(s: any) => s.id}
              emptyMessage="No staff register sessions recorded for this business day."
              columns={[
                {
                  header: 'Staff Cashier',
                  accessor: (s: any) => (
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 dark:text-white">{s.userName}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        @{s.username} • {s.userRole?.toUpperCase()}
                      </div>
                    </div>
                  ),
                },
                {
                  header: 'Shift Timing',
                  accessor: (s) => (
                    <div className="text-[11px] font-mono text-slate-500">
                      <div>Opened: {formatTime(s.openedAt)}</div>
                      <div>
                        Closed: {s.closedAt ? formatTime(s.closedAt) : (
                          <span className="text-emerald-600 font-bold">● Active Now</span>
                        )}
                      </div>
                    </div>
                  ),
                },
                {
                  header: 'Opening Float',
                  align: 'right',
                  accessor: (s) => (
                    <span className="font-mono text-slate-600 dark:text-slate-300">
                      {formatCurrency(s.openingFloat)}
                    </span>
                  ),
                },
                {
                  header: 'Sales (Invoices)',
                  align: 'right',
                  accessor: (s) => (
                    <div>
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(s.grossSales)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {s.invoicesCount} Invoices
                      </div>
                    </div>
                  ),
                },
                {
                  header: 'Cash Sales',
                  align: 'right',
                  accessor: (s) => (
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(s.cashSales)}
                    </span>
                  ),
                },
                {
                  header: 'Card Sales',
                  align: 'right',
                  accessor: (s) => (
                    <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                      {formatCurrency(s.cardSales)}
                    </span>
                  ),
                },
                {
                  header: 'Expected Cash',
                  align: 'right',
                  accessor: (s) => (
                    <span className="font-mono font-black text-slate-900 dark:text-white">
                      {formatCurrency(s.expectedCash)}
                    </span>
                  ),
                },
                {
                  header: 'Counted Cash',
                  align: 'right',
                  accessor: (s) => (
                    <span className="font-mono font-bold text-blue-700 dark:text-sky-400">
                      {s.status === 'closed' ? formatCurrency(s.countedCash) : '—'}
                    </span>
                  ),
                },
                {
                  header: 'Discrepancy',
                  align: 'center',
                  accessor: (s) => {
                    if (s.status === 'open') {
                      return <Badge variant="primary">LIVE OPEN</Badge>;
                    }
                    const diff = Number(s.difference || 0);
                    const isBalanced = Math.abs(diff) < 0.01;
                    return (
                      <Badge variant={isBalanced ? 'success' : diff > 0 ? 'warning' : 'danger'}>
                        {isBalanced
                          ? 'BALANCED'
                          : `${diff > 0 ? '+' : ''}${formatCurrency(diff)}`}
                      </Badge>
                    );
                  },
                },
                {
                  header: 'Actions',
                  align: 'right',
                  accessor: (s) => (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openSessionDetails(s)}
                        className="text-xs"
                      >
                        Movements
                      </Button>
                      <IconButton
                        title="Print Shift Z-Report"
                        icon={<Printer className="h-4 w-4" />}
                        size="sm"
                        onClick={() => {
                          setZReportData({
                            sessionId: s.id,
                            terminalName: s.terminalName || 'Terminal-01',
                            cashierName: s.userName,
                            openedAt: s.openedAt,
                            closedAt: s.closedAt || new Date().toISOString(),
                            openingFloat: s.openingFloat,
                            grossSales: s.grossSales,
                            cashSales: s.cashSales,
                            cardSales: s.cardSales,
                            vatCollected: s.grossSales * 0.1304,
                            expectedCash: s.expectedCash,
                            actualCash: s.countedCash,
                            cashVariance: s.difference,
                          });
                          setIsZReportModalOpen(true);
                        }}
                      />
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </div>
      )}

      {/* TAB 2: ALL SESSIONS HISTORY (Manager visibility of all sessions including own) */}
      {activeTab === 'all_sessions' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                <Filter className="h-4 w-4" />
                <span>Filters:</span>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
                {(['all', 'open', 'closed'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setSessionStatusFilter(status)}
                    className={`rounded-lg px-3 py-1 font-bold capitalize transition-all ${
                      sessionStatusFilter === status
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-sky-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {status === 'all' ? 'All Shifts' : status === 'open' ? 'Live Open' : 'Closed'}
                  </button>
                ))}
              </div>

              {/* Staff Member Selector */}
              <select
                value={staffUserFilter}
                onChange={(e) => setStaffUserFilter(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">All Cashiers & Managers</option>
                {staffList.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} (@{user.username} - {user.role?.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2">
              <span className="text-xs text-slate-400 font-medium">
                {allSessions.length} Shift Session{allSessions.length === 1 ? '' : 's'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadAllSessions()}
                leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${allSessionsLoading ? 'animate-spin' : ''}`} />}
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* All Sessions Table */}
          <DataTable<any>
            isLoading={allSessionsLoading}
            data={allSessions}
            keyExtractor={(s: any) => s.id}
            emptyMessage="No register shifts found matching your filter criteria."
            columns={[
              {
                header: 'Shift ID',
                accessor: (s: any) => (
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
                        #{s.id}
                      </span>
                    </div>
                  </div>
                ),
              },
              {
                header: 'Cashier / Executive',
                accessor: (s: any) => (
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 dark:text-white">{s.userName}</span>
                      <Badge
                        variant={
                          s.userRole === 'manager'
                            ? 'warning'
                            : s.userRole === 'admin'
                            ? 'primary'
                            : 'neutral'
                        }
                        className="text-[10px] font-mono uppercase"
                      >
                        {s.userRole}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      @{s.username}
                    </div>
                  </div>
                ),
              },
              {
                header: 'Joined / Started',
                accessor: (s: any) => (
                  <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                    {formatDateTime(s.openedAt)}
                  </div>
                ),
              },
              {
                header: 'Logout / Closed',
                accessor: (s: any) => (
                  <div className="text-[11px] font-mono">
                    {s.status === 'open' ? (
                      <Badge variant="primary" className="animate-pulse">● Live Active</Badge>
                    ) : (
                      <span className="text-slate-600 dark:text-slate-300">
                        {s.closedAt ? formatDateTime(s.closedAt) : '—'}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                header: 'Opening Float',
                align: 'right',
                accessor: (s: any) => (
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {formatCurrency(s.openingFloat)}
                  </span>
                ),
              },
              {
                header: 'Sales (Invoices)',
                align: 'right',
                accessor: (s: any) => (
                  <div>
                    <div className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(s.grossSales)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {s.invoicesCount} Invoices
                    </div>
                  </div>
                ),
              },
              {
                header: 'Cash / Card',
                align: 'right',
                accessor: (s: any) => (
                  <div className="text-[11px] font-mono text-right">
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold">
                      Cash: {formatCurrency(s.cashSales)}
                    </div>
                    <div className="text-sky-600 dark:text-sky-400 font-bold">
                      Card: {formatCurrency(s.cardSales)}
                    </div>
                  </div>
                ),
              },
              {
                header: 'Expected Cash',
                align: 'right',
                accessor: (s: any) => (
                  <span className="font-mono font-black text-slate-900 dark:text-white">
                    {formatCurrency(s.expectedCash)}
                  </span>
                ),
              },
              {
                header: 'Counted Cash',
                align: 'right',
                accessor: (s: any) => (
                  <span className="font-mono font-bold text-blue-700 dark:text-sky-400">
                    {s.status === 'closed' ? formatCurrency(s.countedCash) : '—'}
                  </span>
                ),
              },
              {
                header: 'Discrepancy',
                align: 'center',
                accessor: (s: any) => {
                  if (s.status === 'open') {
                    return <Badge variant="primary">LIVE OPEN</Badge>;
                  }
                  const diff = Number(s.difference || 0);
                  const isBalanced = Math.abs(diff) < 0.01;
                  return (
                    <Badge variant={isBalanced ? 'success' : diff > 0 ? 'warning' : 'danger'}>
                      {isBalanced
                        ? 'BALANCED'
                        : `${diff > 0 ? '+' : ''}${formatCurrency(diff)}`}
                    </Badge>
                  );
                },
              },
              {
                header: 'Actions',
                align: 'right',
                accessor: (s: any) => (
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openSessionDetails(s)}
                      className="text-xs"
                    >
                      Movements
                    </Button>
                    <IconButton
                      title="Print Shift Z-Report"
                      icon={<Printer className="h-4 w-4" />}
                      size="sm"
                      onClick={() => {
                        setZReportData({
                          sessionId: s.id,
                          terminalName: s.terminalName || 'Terminal-01',
                          cashierName: s.userName,
                          openedAt: s.openedAt,
                          closedAt: s.closedAt || new Date().toISOString(),
                          openingFloat: s.openingFloat,
                          grossSales: s.grossSales,
                          cashSales: s.cashSales,
                          cardSales: s.cardSales,
                          vatCollected: s.grossSales * 0.1304,
                          expectedCash: s.expectedCash,
                          actualCash: s.countedCash,
                          cashVariance: s.difference,
                        });
                        setIsZReportModalOpen(true);
                      }}
                    />
                    {s.status === 'open' && (
                      <IconButton
                        title="Force Close Abandoned Shift"
                        icon={<XCircle className="h-4 w-4 text-rose-600" />}
                        size="sm"
                        onClick={() => {
                          setForceCloseSession(s);
                          setForceCloseNote('');
                          setForceCloseModalOpen(true);
                        }}
                      />
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* TAB 3: SESSION TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          {timelineSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                <div className="text-[10px] font-bold uppercase text-slate-400">Total Sessions</div>
                <div className="font-mono text-2xl font-black text-slate-900 dark:text-white mt-1">{timelineSummary.totalSessions}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                <div className="text-[10px] font-bold uppercase text-slate-400">Net Discrepancy</div>
                <div className={`font-mono text-2xl font-black mt-1 ${Number(timelineSummary.totalDiscrepancy) === 0 ? 'text-emerald-600' : Number(timelineSummary.totalDiscrepancy) > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {Number(timelineSummary.totalDiscrepancy) > 0 ? '+' : ''}{formatCurrency(timelineSummary.totalDiscrepancy)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                <div className="text-[10px] font-bold uppercase text-slate-400">Current Cash in Drawer</div>
                <div className="font-mono text-2xl font-black text-blue-600 dark:text-sky-400 mt-1">{formatCurrency(timelineSummary.currentCashInDrawer)}</div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Start Date</label>
              <input type="date" value={timelineStartDate} onChange={(e) => { setTimelineStartDate(e.target.value); setTimelinePage(1); }}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">End Date</label>
              <input type="date" value={timelineEndDate} onChange={(e) => { setTimelineEndDate(e.target.value); setTimelinePage(1); }}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Staff Member</label>
              <select value={timelineUserId} onChange={(e) => { setTimelineUserId(e.target.value); setTimelinePage(1); }}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500">
                <option value="">All Staff</option>
                {staffList.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name || user.username}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={() => { setTimelineStartDate(''); setTimelineEndDate(''); setTimelineUserId(''); setTimelinePage(1); }}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
              Clear Filters
            </button>
          </div>

          {/* Timeline */}
          {timelineLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : timelineSessions.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-4xl mb-2">📊</div>
              <div className="font-bold">No sessions found</div>
              <div className="text-xs mt-1">Try adjusting your date range or filters</div>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical Timeline Line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-800" />

              <div className="space-y-6">
                {timelineSessions.map((session: any, index: number) => {
                  const isExpanded = expandedTimelineSession === session.id;
                  const diffStatus = session.difference === 0 ? 'balanced' : session.difference > 0 ? 'overage' : 'shortage';
                  const duration = session.closedAt 
                    ? (() => {
                        const ms = new Date(session.closedAt).getTime() - new Date(session.openedAt).getTime();
                        const hrs = Math.floor(ms / 3600000);
                        const mins = Math.floor((ms % 3600000) / 60000);
                        return `${hrs}h ${mins}m`;
                      })()
                    : 'Active';

                  return (
                    <div key={session.id} className="relative pl-14">
                      {/* Timeline Node */}
                      <div className={`absolute left-4 top-4 h-5 w-5 rounded-full border-2 flex items-center justify-center z-10 ${
                        session.status === 'open'
                          ? 'bg-emerald-500 border-emerald-300 dark:border-emerald-700'
                          : session.closeType === 'takeover' || session.closeType === 'force_closed'
                          ? 'bg-amber-500 border-amber-300 dark:border-amber-700'
                          : 'bg-blue-500 border-blue-300 dark:border-blue-700'
                      }`}>
                        <span className="h-2 w-2 rounded-full bg-white" />
                      </div>

                      {/* Carry-Forward Arrow (between sessions) */}
                      {index < timelineSessions.length - 1 && (
                        <div className="absolute left-0 -bottom-3 w-14 flex items-center justify-center">
                          <div className="text-[9px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded z-10">
                            ↓ {formatCurrency(session.closingBalance || session.expectedBalance)}
                          </div>
                        </div>
                      )}

                      {/* Session Card */}
                      <div 
                        className={`rounded-2xl border bg-white dark:bg-slate-900 shadow-sm cursor-pointer transition-all hover:shadow-md ${
                          session.status === 'open'
                            ? 'border-emerald-300 dark:border-emerald-800'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                        onClick={() => loadTimelineSessionDetail(session.id)}
                      >
                        {/* Session Header */}
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-slate-900 dark:text-white">
                                  Session #{session.sequenceNumber || session.id}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                                  session.status === 'open'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : session.closeType === 'takeover'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : session.closeType === 'force_closed'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                }`}>
                                  {session.status === 'open' ? 'Active' : session.closeType === 'takeover' ? 'Takeover' : session.closeType === 'force_closed' ? 'Force Closed' : 'Closed'}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] font-bold text-slate-400">{duration}</div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-lg bg-blue-600/10 dark:bg-sky-500/10 flex items-center justify-center text-blue-600 dark:text-sky-400 font-black text-xs">
                                {(session.user?.fullName || session.userName || 'U')[0]}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-900 dark:text-white">{session.user?.fullName || session.userName}</div>
                                <div className="text-[10px] text-slate-400 font-mono">@{session.user?.username || session.username}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-slate-500 font-mono">
                                {new Date(session.openedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {new Date(session.openedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                {session.closedAt && ` → ${new Date(session.closedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`}
                              </div>
                            </div>
                          </div>

                          {/* Financial Summary Row */}
                          <div className="grid grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <div>
                              <div className="text-[9px] font-bold uppercase text-slate-400">Opening</div>
                              <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">{formatCurrency(session.openingBalance || session.openingFloat)}</div>
                            </div>
                            <div>
                              <div className="text-[9px] font-bold uppercase text-slate-400">Sales</div>
                              <div className="font-mono text-xs font-bold text-emerald-600">{formatCurrency(session.grossSales)}</div>
                              <div className="text-[9px] text-slate-400">{session.salesCount || session.invoicesCount} inv</div>
                            </div>
                            <div>
                              <div className="text-[9px] font-bold uppercase text-slate-400">Expected</div>
                              <div className="font-mono text-xs font-bold text-blue-600 dark:text-sky-400">{formatCurrency(session.expectedBalance || session.expectedCash)}</div>
                            </div>
                            <div>
                              <div className="text-[9px] font-bold uppercase text-slate-400">Diff</div>
                              <div className={`font-mono text-xs font-black ${
                                diffStatus === 'balanced' ? 'text-emerald-600' : diffStatus === 'overage' ? 'text-emerald-600' : 'text-rose-600'
                              }`}>
                                {session.status === 'closed' ? (
                                  <span>{session.difference > 0 ? '+' : ''}{formatCurrency(session.difference)}</span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </div>
                              {session.status === 'closed' && (
                                <div className={`text-[8px] font-bold uppercase ${
                                  diffStatus === 'balanced' ? 'text-emerald-500' : diffStatus === 'overage' ? 'text-emerald-500' : 'text-rose-500'
                                }`}>
                                  {diffStatus === 'balanced' ? '✓ OK' : diffStatus === 'overage' ? 'OVER' : 'SHORT'}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Force Close Info */}
                          {(session.closeType === 'takeover' || session.closeType === 'force_closed') && (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                              <AlertCircle className="h-3 w-3" />
                              <span>{session.closeType === 'takeover' ? 'Taken over' : 'Force-closed'} by {session.forceClosedBy || 'Manager'}</span>
                            </div>
                          )}
                        </div>

                        {/* Expanded Detail (Adjustments & Movements) */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 dark:border-slate-800 p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/50 rounded-b-2xl">
                            {/* Carry-forward info */}
                            {session.carryForwardBalance > 0 && (
                              <div className="text-[11px] text-slate-500">
                                Carry-forward from previous: <span className="font-bold font-mono text-slate-700 dark:text-slate-300">{formatCurrency(session.carryForwardBalance)}</span>
                              </div>
                            )}

                            {/* Cash breakdown */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2">
                                <div className="text-[9px] font-bold uppercase text-slate-400">Cash Sales</div>
                                <div className="font-mono text-xs font-bold text-emerald-600">+{formatCurrency(session.cashSales)}</div>
                              </div>
                              <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2">
                                <div className="text-[9px] font-bold uppercase text-slate-400">Card Sales</div>
                                <div className="font-mono text-xs font-bold text-blue-600 dark:text-sky-400">+{formatCurrency(session.cardSales)}</div>
                              </div>
                              <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2">
                                <div className="text-[9px] font-bold uppercase text-slate-400">Refunds</div>
                                <div className="font-mono text-xs font-bold text-rose-600">-{formatCurrency(session.cashRefunds)}</div>
                              </div>
                              <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2">
                                <div className="text-[9px] font-bold uppercase text-slate-400">Expenses</div>
                                <div className="font-mono text-xs font-bold text-rose-600">-{formatCurrency(session.cashExpenses)}</div>
                              </div>
                            </div>

                            {/* Opening Adjustments */}
                            {session.openingAdjustments?.length > 0 && (
                              <div>
                                <div className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 mb-1">Opening Adjustments</div>
                                <div className="space-y-1">
                                  {session.openingAdjustments.map((adj: any) => (
                                    <div key={adj.id} className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30 px-3 py-1.5 text-[11px]">
                                      <span className="text-slate-600 dark:text-slate-400">{adj.description}</span>
                                      <span className={`font-mono font-bold ${Number(adj.amount) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        {Number(adj.amount) > 0 ? '+' : ''}{formatCurrency(adj.amount)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Closing Adjustments */}
                            {session.closingAdjustments?.length > 0 && (
                              <div>
                                <div className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 mb-1">Closing Adjustments</div>
                                <div className="space-y-1">
                                  {session.closingAdjustments.map((adj: any) => (
                                    <div key={adj.id} className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30 px-3 py-1.5 text-[11px]">
                                      <span className="text-slate-600 dark:text-slate-400">{adj.description}</span>
                                      <span className={`font-mono font-bold ${Number(adj.amount) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        {Number(adj.amount) > 0 ? '+' : ''}{formatCurrency(adj.amount)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Closing Note */}
                            {session.closingNote && (
                              <div className="text-[11px] text-slate-500 italic">
                                Note: "{session.closingNote}"
                              </div>
                            )}

                            {/* Cash Movements (from detail API) */}
                            {timelineSessionDetail?.movements?.length > 0 && expandedTimelineSession === session.id && (
                              <div>
                                <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Cash Movements ({timelineSessionDetail.movements.length})</div>
                                <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-slate-200 dark:border-slate-800 p-2 bg-white dark:bg-slate-900">
                                  {timelineSessionDetail.movements.map((mov: any) => (
                                    <div key={mov.id} className="flex items-center justify-between text-[10px] py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                      <div className="flex items-center gap-2">
                                        <span className={`font-mono font-bold ${mov.type === 'cash_in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                          {mov.type === 'cash_in' ? '+' : '-'}{formatCurrency(Number(mov.amount))}
                                        </span>
                                        <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-500">
                                          {mov.source}
                                        </span>
                                      </div>
                                      <span className="text-slate-400 font-mono">
                                        {new Date(mov.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="text-[10px] text-center text-slate-400 italic">
                              All transactions are immutable and cannot be modified
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {timelinePagination && timelinePagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    disabled={timelinePage <= 1}
                    onClick={() => setTimelinePage(p => Math.max(1, p - 1))}
                    className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-mono text-slate-500">
                    Page {timelinePagination.page} of {timelinePagination.totalPages}
                  </span>
                  <button
                    disabled={timelinePage >= timelinePagination.totalPages}
                    onClick={() => setTimelinePage(p => p + 1)}
                    className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Open Cash Shift Modal */}
      <Modal
        isOpen={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
        title="Open Cash Shift"
        subtitle="Specify initial physical cash float for the till"
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsOpenModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" isLoading={loading} onClick={handleOpenShift}>
              Authorize & Open Drawer
            </Button>
          </>
        }
      >
        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleOpenShift} className="space-y-4">
          <Input
            label="Physical Opening Cash Float (SAR) *"
            type="number"
            step="0.01"
            min="0"
            required
            autoFocus
            value={openingFloat}
            onChange={(e) => setOpeningFloat(parseFloat(e.target.value) || 0)}
            className="font-mono text-xl font-bold"
            helperText="Count physical banknotes and coins placed in the till"
          />
        </form>
      </Modal>

      {/* End Shift & Blind Count Modal */}
      <Modal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        title="Blind Cash Count & Shift Close"
        subtitle="Count physical currency in drawer and input card settlement slip total"
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCloseModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={loading} onClick={handleCloseShift}>
              Confirm Count & End Shift
            </Button>
          </>
        }
      >
        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleCloseShift} className="space-y-4">
          <Input
            label="Actual Physical Counted Cash (SAR) *"
            type="number"
            step="0.01"
            required
            value={actualClosingCash}
            onChange={(e) => setActualClosingCash(parseFloat(e.target.value) || 0)}
            className="font-mono text-xl font-bold"
            helperText="Count all physical bills and coins in the cash drawer"
          />

          <Input
            label="Terminal Batch Settlement Total (Mada / Card) *"
            type="number"
            step="0.01"
            required
            value={actualCardTotal}
            onChange={(e) => setActualCardTotal(parseFloat(e.target.value) || 0)}
            className="font-mono text-xl font-bold"
            helperText="Printed batch total from bank POS card machine"
          />

          <Textarea
            label="Shift Notes / Discrepancy Reason"
            value={closingNote}
            onChange={(e) => setClosingNote(e.target.value)}
            placeholder="e.g. 5 SAR change roundoff variance"
            rows={2}
          />
        </form>
      </Modal>

      {/* Shift Detailed Cash Movements Modal */}
      {isDetailModalOpen && selectedSessionDetails && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Shift Movements Breakdown (ID #${selectedSessionDetails.session?.id})`}
          subtitle={`Cashier: ${selectedSessionDetails.session?.user_name}`}
          maxWidth="lg"
          footer={
            <Button variant="secondary" onClick={() => setIsDetailModalOpen(false)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-850 rounded-xl font-mono text-xs">
              <div>
                <span className="text-slate-400">Opening Float:</span>{' '}
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatCurrency(selectedSessionDetails.session?.opening_balance)}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Expected Cash:</span>{' '}
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatCurrency(selectedSessionDetails.session?.expected_balance)}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Counted Cash:</span>{' '}
                <span className="font-bold text-blue-600 dark:text-sky-400">
                  {formatCurrency(selectedSessionDetails.session?.closing_balance)}
                </span>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Time</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-left">Source / Reason</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {selectedSessionDetails.movements?.map((m: any) => (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-2 text-slate-400">
                        {new Date(m.created_at).toLocaleTimeString()}
                      </td>
                      <td className="p-2">
                        <Badge variant={m.type === 'cash_in' ? 'success' : 'danger'}>
                          {m.type.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-2 text-slate-700 dark:text-slate-300">
                        {m.description || m.source}
                      </td>
                      <td className="p-2 text-right font-bold">
                        <span className={m.type === 'cash_in' ? 'text-emerald-600' : 'text-rose-600'}>
                          {m.type === 'cash_in' ? '+' : '-'}
                          {formatCurrency(m.amount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {/* Force Close Modal for Manager */}
      {forceCloseModalOpen && forceCloseSession && (
        <Modal
          isOpen={forceCloseModalOpen}
          onClose={() => setForceCloseModalOpen(false)}
          title={`Force Close Register Shift #${forceCloseSession.id}`}
          subtitle={`Cashier: ${forceCloseSession.userName} (@${forceCloseSession.username})`}
          maxWidth="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setForceCloseModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" isLoading={loading} onClick={handleForceClose}>
                Confirm Force Close
              </Button>
            </>
          }
        >
          {errorMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300">
              <p className="font-bold">⚠️ Manager Audit Warning:</p>
              <p className="mt-1">
                Force closing ends this shift immediately using system expected cash as the closing balance. Use this when a cashier left without closing their shift.
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Opening Float:</span>
                <span className="font-bold">{formatCurrency(forceCloseSession.openingFloat)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Gross Sales:</span>
                <span className="font-bold">{formatCurrency(forceCloseSession.grossSales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expected Cash in Drawer:</span>
                <span className="font-black text-blue-600 dark:text-sky-400">
                  {formatCurrency(forceCloseSession.expectedCash)}
                </span>
              </div>
            </div>

            <Textarea
              label="Manager Closure Reason / Audit Note *"
              required
              value={forceCloseNote}
              onChange={(e) => setForceCloseNote(e.target.value)}
              placeholder="e.g. Cashier left without closing drawer; verified by Manager."
              rows={3}
            />
          </div>
        </Modal>
      )}

      {/* Official Z-Report Modal */}
      {isZReportModalOpen && zReportData && (
        <Modal
          isOpen={isZReportModalOpen}
          onClose={() => setIsZReportModalOpen(false)}
          title="Official Register Z-Report Certificate"
          subtitle="Consolidated cash drawer settlement and audit record"
          maxWidth="xl"
          footer={
            <div className="flex w-full items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">Standard Certificate Mode</span>
              <Button
                variant="primary"
                onClick={() => window.print()}
                leftIcon={<Printer className="h-4 w-4" />}
              >
                Print / Save PDF
              </Button>
            </div>
          }
        >
          <div
            id="printable-report"
            className="p-6 sm:p-8 bg-white text-black font-mono text-sm sm:text-base space-y-4 border border-slate-300 rounded-2xl shadow-md leading-relaxed min-h-[500px]"
          >
            <div className="text-center border-b-2 border-black pb-4">
              <h3 className="font-black text-xl uppercase tracking-wider text-black">
                {settings.shop_name_en || 'AL-NOOR SUPERMARKET & HYPERMARKET'}
              </h3>
              <p className="text-xs sm:text-sm font-black uppercase tracking-widest mt-1 text-slate-800">
                OFFICIAL REGISTER Z-REPORT: {zReportData.sessionId}
              </p>
              <div className="mt-2 text-xs sm:text-sm text-slate-700 space-y-0.5">
                <p>Register: <span className="font-bold">Main Cash Counter</span></p>
                <p>Audited Staff: <span className="font-bold">{zReportData.cashierName}</span></p>
                {zReportData.openedAt && (
                  <p>
                    Shift Period: {formatDateTime(zReportData.openedAt)} —{' '}
                    {formatDateTime(zReportData.closedAt)}
                  </p>
                )}
                <p>Printed: {formatDateTime(new Date())}</p>
              </div>
            </div>

            <div className="space-y-2.5 py-4 border-b-2 border-dashed border-black/40 text-sm">
              <div className="flex justify-between">
                <span>Opening Cash Float:</span>
                <span className="font-bold">{formatCurrency(zReportData.openingFloat)}</span>
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

            <div className="space-y-2.5 py-4 border-b-2 border-dashed border-black/40 bg-slate-50 p-4 rounded-xl text-sm">
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

            <div className="text-center pt-4 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">Certified Audit Record • Point of Sale Ledger</p>
              <p className="font-mono text-[10px] text-slate-400">HASH: SHA256-REGISTER-CLOSURE-VERIFIED</p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
