'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { Button, IconButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { MetricCard } from '@/components/ui/MetricCard';
import {
  CalendarDays,
  AlertTriangle,
  Clock,
  Plus,
  Search,
  Package,
  Layers,
  CheckCircle,
  ShieldAlert,
  Archive,
} from 'lucide-react';

export default function BatchesPage() {
  const { formatCurrency } = useSettings();
  const [batches, setBatches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [batchForm, setBatchForm] = useState({
    product_id: '',
    batch_number: '',
    expiry_date: '',
    cost_price: 0,
    quantity: 10,
  });

  const loadBatches = async () => {
    setLoading(true);
    let url = '/batches';
    if (filterStatus === 'expired') url += '?status=expired';
    if (filterStatus === 'expiring_soon') url += '?status=expiring_soon';

    const res = await apiRequest(url);
    if (res.success && res.data) {
      setBatches(res.data);
    }
    setLoading(false);
  };

  const loadProducts = async () => {
    const res = await apiRequest('/products');
    if (res.success && res.data) {
      setProducts(res.data);
    }
  };

  useEffect(() => {
    loadBatches();
    loadProducts();
  }, [filterStatus]);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/batches', {
      method: 'POST',
      body: JSON.stringify(batchForm),
    });
    if (res.success) {
      setIsModalOpen(false);
      setBatchForm({ product_id: '', batch_number: '', expiry_date: '', cost_price: 0, quantity: 10 });
      loadBatches();
    }
  };

  const expiringCount = batches.filter((b) => Number(b.days_to_expiry) >= 0 && Number(b.days_to_expiry) <= 30).length;
  const expiredCount = batches.filter((b) => Number(b.days_to_expiry) < 0).length;

  const filteredBatches = batches.filter((b) => {
    return (
      b.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.batch_number?.toLowerCase().includes(search.toLowerCase()) ||
      b.sku?.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Add Batch Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-700 dark:text-sky-400" />
            <span>Add Perishable Batch & Expiry Entry</span>
          </div>
        }
        subtitle="Register perishable stock receiving with FEFO tracking"
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateBatch}>
              Save Batch
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateBatch} className="space-y-4">
          <Select
            label="Perishable Product *"
            required
            value={batchForm.product_id}
            onChange={(e) => setBatchForm({ ...batchForm, product_id: e.target.value })}
          >
            <option value="">-- Choose Product --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </Select>

          <Input
            label="Batch / Lot Number *"
            required
            value={batchForm.batch_number}
            onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })}
            placeholder="e.g. BATCH-2026-09-A"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Expiration Date *"
              type="date"
              required
              value={batchForm.expiry_date}
              onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })}
            />

            <Input
              label="Batch Quantity (Base Units) *"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={batchForm.quantity}
              onChange={(e) => setBatchForm({ ...batchForm, quantity: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <Input
            label="Unit Cost Price (SAR)"
            type="number"
            step="0.0001"
            value={batchForm.cost_price}
            onChange={(e) => setBatchForm({ ...batchForm, cost_price: parseFloat(e.target.value) || 0 })}
          />
        </form>
      </Modal>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            Batches & Perishable Expiry Tracker
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            FEFO (First-Expired, First-Out) inventory allocation, perishable batch tracking, and automated expiration warnings.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsModalOpen(true)}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Add Batch Entry
        </Button>
      </div>

      {/* KPI Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Total Active Batches"
          value={batches.length}
          subValue="FEFO Tracking Active"
          icon={<Layers className="h-5 w-5" />}
          variant="default"
        />

        <MetricCard
          label="Expiring Soon (30 Days)"
          value={expiringCount}
          subValue="Manager Alert"
          icon={<AlertTriangle className="h-5 w-5" />}
          variant="warning"
          onClick={() => setFilterStatus('expiring_soon')}
        />

        <MetricCard
          label="Expired Batches"
          value={expiredCount}
          subValue="Quarantine & Write-Off"
          icon={<ShieldAlert className="h-5 w-5" />}
          variant="danger"
          onClick={() => setFilterStatus('expired')}
        />
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by batch, product name, or SKU..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2 pl-10 pr-4 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'all', label: 'All Batches' },
            { id: 'expiring_soon', label: 'Expiring in 30 Days' },
            { id: 'expired', label: 'Expired Batches' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition ${
                filterStatus === tab.id
                  ? 'bg-blue-700 text-white shadow-sm dark:bg-sky-500 dark:text-slate-950'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Batches Master DataTable */}
      <DataTable
        isLoading={loading}
        data={filteredBatches}
        keyExtractor={(b) => b.id}
        emptyMessage="No batch or perishable expiry records found."
        columns={[
          {
            header: 'Batch Number',
            accessor: (b) => (
              <span className="font-mono font-bold text-blue-700 dark:text-sky-400">
                {b.batch_number}
              </span>
            ),
          },
          {
            header: 'Product Name / SKU',
            accessor: (b) => (
              <div>
                <div className="font-bold text-slate-900 dark:text-white line-clamp-1">{b.product_name}</div>
                <div className="text-[11px] text-slate-400 font-mono">SKU: {b.sku}</div>
              </div>
            ),
          },
          {
            header: 'Expiration Date',
            accessor: (b) => (
              <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {new Date(b.expiry_date).toLocaleDateString('en-GB')}
              </div>
            ),
          },
          {
            header: 'Days Left (FEFO)',
            accessor: (b) => {
              const days = Number(b.days_to_expiry);
              if (days < 0) {
                return (
                  <span className="font-bold text-red-600 dark:text-red-400">
                    Expired ({Math.abs(days)}d ago)
                  </span>
                );
              }
              if (days <= 30) {
                return (
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {days} days remaining
                  </span>
                );
              }
              return (
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {days} days safe
                </span>
              );
            },
          },
          {
            header: 'Current Stock',
            align: 'right',
            accessor: (b) => (
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {Number(b.current_quantity).toFixed(2)}
              </span>
            ),
          },
          {
            header: 'Cost Price',
            align: 'right',
            accessor: (b) => (
              <span className="font-mono text-slate-500">
                {formatCurrency(b.cost_price)}
              </span>
            ),
          },
          {
            header: 'Status',
            align: 'center',
            accessor: (b) => {
              const days = Number(b.days_to_expiry);
              if (days < 0) return <Badge variant="danger">Expired</Badge>;
              if (days <= 30) return <Badge variant="warning">Expiring Soon</Badge>;
              return <Badge variant="success">Active</Badge>;
            },
          },
        ]}
      />
    </div>
  );
}
