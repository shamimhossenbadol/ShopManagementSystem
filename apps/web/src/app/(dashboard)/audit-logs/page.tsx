'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import {
  ShieldAlert,
  Search,
  Calendar,
  User,
  Activity,
  Code2,
  X,
} from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [searchAction, setSearchAction] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    let url = '/settings/audit-logs';
    if (searchAction) url += `?action=${encodeURIComponent(searchAction)}`;
    const res = await apiRequest(url);
    if (res.success && res.data) setLogs(res.data);
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, [searchAction]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Immutable Audit Trail</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tamper-evident logs of all transactional and administrative system events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <Activity className="h-3.5 w-3.5" />
            Append-Only Active
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchAction}
          onChange={(e) => setSearchAction(e.target.value)}
          placeholder="Filter by action (e.g. SALE_COMPLETED, VOID, STOCK_ADJUSTMENT)..."
          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 pl-10 pr-4 text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Audit Logs Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-[10px] font-bold uppercase text-slate-400">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Staff User</th>
                <th className="py-3 px-4">Action Event</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 font-sans">No audit events found.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="py-3.5 px-4 font-sans">
                      <span className="font-bold text-slate-900 dark:text-white">{log.user_name}</span>{' '}
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold">({log.user_role})</span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-blue-600 dark:text-blue-400">
                      <span className="rounded bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 border border-blue-100 dark:border-blue-900/50">{log.action}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {log.entity_table} #{log.entity_id}
                    </td>
                    <td className="py-3.5 px-4 text-right font-sans">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        <Code2 className="h-3 w-3 inline mr-1" />
                        Inspect Payload
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Payload Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-blue-500" />
                  Audit Event: {selectedLog.action}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">By {selectedLog.user_name} on {new Date(selectedLog.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {selectedLog.old_values && (
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Previous Values (Before Change):</label>
                  <pre className="p-3 bg-slate-950 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800">
                    {JSON.stringify(selectedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Committed Values (After Change):</label>
                <pre className="p-3 bg-slate-950 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800">
                  {JSON.stringify(selectedLog.new_values, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800 mt-4">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
