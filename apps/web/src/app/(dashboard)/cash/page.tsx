'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import {
  Banknote,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Plus,
  Check,
  AlertCircle,
  X,
  History,
  CreditCard,
} from 'lucide-react';

export default function CashSessionsPage() {
  const { formatCurrency, settings } = useSettings();
  const [shiftData, setShiftData] = useState<any>(null);
  const [historySessions, setHistorySessions] = useState<any[]>([]);

  // Modals
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isZReportModalOpen, setIsZReportModalOpen] = useState(false);
  const [zReportData, setZReportData] = useState<any>(null);

  // Forms
  const [openingFloat, setOpeningFloat] = useState<number>(100);
  const [actualClosingCash, setActualClosingCash] = useState<number>(0);
  const [actualCardTotal, setActualCardTotal] = useState<number>(0);
  const [closingNote, setClosingNote] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    const statusRes = await apiRequest('/cash/status');
    if (statusRes.success && statusRes.data) {
      setShiftData(statusRes.data);
      if (statusRes.data.hasActiveShift) {
        setActualClosingCash(statusRes.data.liveExpectedCash);
      }
    }

    const histRes = await apiRequest('/cash/sessions');
    if (histRes.success && histRes.data) {
      setHistorySessions(histRes.data);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const res = await apiRequest('/cash/open', {
      method: 'POST',
      body: JSON.stringify({ openingBalance: Number(openingFloat) }),
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
        actualCardTotal: Number(actualCardTotal),
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

  const { hasActiveShift, session, liveExpectedCash } = shiftData || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Cash Drawer Shifts & Z-Reports</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Monitor cash register flows, reconcile float, Mada POS card terminals, and audit blind closing counts.
          </p>
        </div>
        <div>
          {!hasActiveShift ? (
            <button
              onClick={() => {
                setErrorMsg(null);
                setIsOpenModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 transition"
            >
              <Plus className="h-4 w-4" />
              Open Cash Shift
            </button>
          ) : (
            <button
              onClick={() => {
                setErrorMsg(null);
                setIsCloseModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-500/20 hover:bg-rose-500 transition"
            >
              <CheckCircle2 className="h-4 w-4" />
              End Shift & Print Z-Report
            </button>
          )}
        </div>
      </div>

      {/* Active Shift Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Current Shift Status</h2>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              hasActiveShift
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {hasActiveShift ? '● Active Cash Session' : '● Register Closed'}
          </span>
        </div>

        {hasActiveShift ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Opening Float</div>
              <div className="mt-1 font-mono text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(session.opening_balance)}</div>
              <div className="mt-1 text-[11px] text-slate-400">Opened: {new Date(session.opened_at).toLocaleTimeString()}</div>
            </div>

            <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 p-4">
              <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">Live Expected Cash in Drawer</div>
              <div className="mt-1 font-mono text-2xl font-black text-blue-900 dark:text-blue-200">{formatCurrency(liveExpectedCash || 0)}</div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Float + Cash Sales - Refunds - Expenses</div>
            </div>

            <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Ready for Closing</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Perform physical blind count before submitting closing figures.</div>
              </div>
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setIsCloseModalOpen(true);
                }}
                className="mt-3 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md transition"
              >
                Perform Blind Count
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-8 text-center">
            <Clock className="h-10 w-10 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No Active Cash Shift</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Open a cash shift float to begin sales transactions on the POS counter.</p>
          </div>
        )}
      </div>

      {/* Historical Sessions Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-xs text-slate-700 dark:text-slate-300">
          Historical Shift Sessions & Audits
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-[10px] font-bold uppercase text-slate-400">
              <tr>
                <th className="py-3 px-4">Cashier</th>
                <th className="py-3 px-4">Opened At</th>
                <th className="py-3 px-4">Closed At</th>
                <th className="py-3 px-4 text-right">Opening Float</th>
                <th className="py-3 px-4 text-right">Expected Cash</th>
                <th className="py-3 px-4 text-right">Actual Count</th>
                <th className="py-3 px-4 text-center">Discrepancy Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {historySessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">No completed shift sessions logged yet.</td>
                </tr>
              ) : (
                historySessions.map((s) => {
                  const diff = Number(s.difference || 0);
                  const isBalanced = Math.abs(diff) < 0.01;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{s.user_name}</td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">{new Date(s.opened_at).toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">{s.closed_at ? new Date(s.closed_at).toLocaleString() : 'Active'}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(s.opening_balance)}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(s.expected_balance)}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">{formatCurrency(s.closing_balance)}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isBalanced
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                              : diff > 0
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isBalanced ? 'Balanced' : diff > 0 ? `+${formatCurrency(diff)} Overage` : `${formatCurrency(diff)} Shortage`}
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

      {/* Open Shift Modal */}
      {isOpenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Banknote className="h-4 w-4 text-emerald-500" />
                Open Cash Drawer Shift
              </h2>
              <button onClick={() => setIsOpenModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 p-2.5 text-xs text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                <AlertCircle className="h-4 w-4" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleOpenShift} className="space-y-4 text-xs">
              <div>
                <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Opening Float Amount ({settings.currency_symbol || 'SAR'}) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOpenModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-md disabled:opacity-50"
                >
                  {loading ? 'Opening...' : 'Confirm Open'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Shift (Blind Count) Modal */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-rose-500" />
                End Cash Shift & Blind Reconciliation
              </h2>
              <button onClick={() => setIsCloseModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 p-2.5 text-xs text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                <AlertCircle className="h-4 w-4" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCloseShift} className="space-y-4 text-xs">
              <div>
                <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Actual Counted Cash in Drawer ({settings.currency_symbol || 'SAR'}) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={actualClosingCash}
                  onChange={(e) => setActualClosingCash(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-lg font-mono font-bold text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">Physical count of all banknotes and coins in till.</p>
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Mada / Card Terminal Settlement Slip Total</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={actualCardTotal}
                  onChange={(e) => setActualCardTotal(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-sm font-mono font-bold text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Closing Notes</label>
                <textarea
                  rows={2}
                  value={closingNote}
                  onChange={(e) => setClosingNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Optional note for shift closure"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCloseModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold shadow-md disabled:opacity-50"
                >
                  {loading ? 'Closing...' : 'Close Shift & Generate Z-Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Z-Report Modal */}
      {isZReportModalOpen && zReportData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl max-h-[90vh] overflow-y-auto font-mono text-xs text-slate-900 dark:text-white">
            <div className="text-center pb-3 border-b border-dashed border-slate-300 dark:border-slate-700 mb-3">
              <h2 className="text-base font-bold uppercase">{settings.shop_name_en || 'AL-NOOR SUPER MARKET'}</h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Z-REPORT SHIFT RECONCILIATION</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Shift #{zReportData.shiftId} • Cashier: {zReportData.cashierName}</p>
            </div>

            <div className="space-y-1.5 border-b border-dashed border-slate-300 dark:border-slate-700 pb-3 mb-3">
              <div className="flex justify-between">
                <span>Opened At:</span>
                <span>{new Date(zReportData.openedAt).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Closed At:</span>
                <span>{new Date(zReportData.closedAt).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between pt-1 font-bold">
                <span>Opening Float:</span>
                <span>{formatCurrency(zReportData.openingFloat)}</span>
              </div>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>(+) Cash Sales:</span>
                <span>+{formatCurrency(zReportData.cashSales)}</span>
              </div>
              <div className="flex justify-between text-rose-600 dark:text-rose-400">
                <span>(-) Cash Refunds:</span>
                <span>-{formatCurrency(zReportData.cashRefunds)}</span>
              </div>
              <div className="flex justify-between text-rose-600 dark:text-rose-400">
                <span>(-) Cash Expenses:</span>
                <span>-{formatCurrency(zReportData.cashExpenses)}</span>
              </div>
            </div>

            <div className="space-y-1.5 border-b border-dashed border-slate-300 dark:border-slate-700 pb-3 mb-3 font-bold text-sm">
              <div className="flex justify-between">
                <span>Expected Cash:</span>
                <span>{formatCurrency(zReportData.expectedCash)}</span>
              </div>
              <div className="flex justify-between text-blue-600 dark:text-blue-400">
                <span>Actual Count:</span>
                <span>{formatCurrency(zReportData.actualCountedCash)}</span>
              </div>
              <div
                className={`flex justify-between text-sm ${
                  zReportData.difference === 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : zReportData.difference > 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                <span>Discrepancy:</span>
                <span>{formatCurrency(zReportData.difference)} ({zReportData.status})</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsZReportModalOpen(false)}
                className="w-1/2 py-2 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Close (Esc)
              </button>
              <button
                onClick={() => window.print()}
                className="w-1/2 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                Print Z-Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
