'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { Button, IconButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { MetricCard } from '@/components/ui/MetricCard';
import {
  ShieldAlert,
  Search,
  Calendar,
  User,
  Activity,
  Code2,
  X,
  ShieldCheck,
  Lock,
  FileCode,
  Sparkles,
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
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            Immutable Security Audit Trail
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Tamper-evident logs of all financial transactions, stock adjustments, price overrides, and administrative events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success">APPEND-ONLY SECURE</Badge>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total System Audit Events"
          value={`${logs.length} Records`}
          subValue="Permanent Write-Once Store"
          icon={<ShieldCheck className="h-5 w-5" />}
          variant="primary"
        />

        <MetricCard
          label="Tamper-Evident Ledger"
          value="100% Verified"
          subValue="Cryptographic Traceability"
          icon={<Lock className="h-5 w-5" />}
          variant="success"
        />

        <MetricCard
          label="Monitored Entities"
          value="14 Tables"
          subValue="Sales, Stock, Cash, Auth"
          icon={<Activity className="h-5 w-5" />}
          variant="default"
        />
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center rounded-2xl bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Input
            type="text"
            value={searchAction}
            onChange={(e) => setSearchAction(e.target.value)}
            placeholder="Filter by action (e.g. SALE_COMPLETED, VOID, STOCK_ADJUSTMENT)..."
            className="text-xs font-mono"
          />
        </div>
      </div>

      {/* Audit Logs DataTable */}
      <DataTable
        isLoading={loading}
        data={logs}
        keyExtractor={(l) => l.id}
        emptyMessage="No audit trail events found."
        columns={[
          {
            header: 'Timestamp',
            accessor: (log) => (
              <span className="font-mono text-slate-500 text-[11px]">
                {new Date(log.created_at).toLocaleString()}
              </span>
            ),
          },
          {
            header: 'Staff User & Role',
            accessor: (log) => (
              <div>
                <span className="font-bold text-slate-900 dark:text-white">{log.user_name}</span>
                <span className="ml-2 font-mono text-[10px] text-blue-700 dark:text-sky-400 uppercase font-bold">
                  ({log.user_role})
                </span>
              </div>
            ),
          },
          {
            header: 'Action Event',
            accessor: (log) => (
              <Badge variant="primary">{log.action}</Badge>
            ),
          },
          {
            header: 'Target Entity',
            accessor: (log) => (
              <span className="font-mono text-slate-600 dark:text-slate-300">
                {log.entity_table} #{log.entity_id}
              </span>
            ),
          },
          {
            header: 'Payload Details',
            align: 'right',
            accessor: (log) => (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedLog(log)}
                leftIcon={<Code2 className="h-3.5 w-3.5" />}
              >
                Inspect Payload
              </Button>
            ),
          },
        ]}
      />

      {/* JSON Payload Inspector Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-blue-700 dark:text-sky-400" />
              <span>Audit Event Payload: {selectedLog.action}</span>
            </div>
          }
          subtitle={`By ${selectedLog.user_name} on ${new Date(selectedLog.created_at).toLocaleString()}`}
          maxWidth="2xl"
          footer={
            <Button variant="secondary" onClick={() => setSelectedLog(null)}>
              Close Inspector
            </Button>
          }
        >
          <div className="space-y-4 text-xs">
            {selectedLog.old_values && (
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5 uppercase text-[10px] tracking-wider">
                  Previous Snapshot (Before Change):
                </label>
                <pre className="p-4 bg-slate-950 text-slate-200 rounded-2xl font-mono text-[11px] overflow-x-auto border border-slate-800">
                  {JSON.stringify(selectedLog.old_values, null, 2)}
                </pre>
              </div>
            )}

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5 uppercase text-[10px] tracking-wider">
                Committed Snapshot (After Change):
              </label>
              <pre className="p-4 bg-slate-950 text-emerald-400 rounded-2xl font-mono text-[11px] overflow-x-auto border border-slate-800">
                {JSON.stringify(selectedLog.new_values, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
