'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import {
  CalendarDays,
  AlertTriangle,
  Clock,
  Plus,
  Search,
  Package,
  Layers,
  CheckCircle,
} from 'lucide-react';

export default function BatchesPage() {
  const { formatCurrency } = useSettings();
  const [batches, setBatches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Product Batches & Perishable Expiry Tracker
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            FEFO (First-Expired, First-Out) inventory dispatch and expiration date alerts (7, 15, 30 days).
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500 transition"
        >
          <Plus className="h-4 w-4" />
          Add Batch / Expiry Entry
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { id: 'all', label: 'All Active Batches' },
          { id: 'expiring_soon', label: '⚠️ Expiring in 30 Days' },
          { id: 'expired', label: '🛑 Expired Batches' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              filterStatus === tab.id
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Batches Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-400 font-bold uppercase text-[10px]">
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">SKU / Barcode</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Days Left</th>
                <th className="py-3 px-4 text-right">Current Qty</th>
                <th className="py-3 px-4 text-right">Cost Price</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading batch records...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No batch records found.
                  </td>
                </tr>
              ) : (
                batches.map((b) => {
                  const days = Number(b.days_to_expiry);
                  const isExpired = days < 0;
                  const isSoon = days >= 0 && days <= 30;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">{b.batch_number}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">{b.product_name}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">{b.sku}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {new Date(b.expiry_date).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 font-bold">
                        {isExpired ? (
                          <span className="text-rose-500">Expired ({Math.abs(days)}d ago)</span>
                        ) : isSoon ? (
                          <span className="text-amber-500">{days} days remaining</span>
                        ) : (
                          <span className="text-emerald-500">{days} days</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {b.current_quantity}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                        {formatCurrency(b.cost_price)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            isExpired
                              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                              : isSoon
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          }`}
                        >
                          {isExpired ? 'EXPIRED' : isSoon ? 'EXPIRING SOON' : 'ACTIVE'}
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

      {/* New Batch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <h2 className="text-base font-bold mb-4 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-500" />
              Add New Product Batch & Expiry
            </h2>
            <form onSubmit={handleCreateBatch} className="space-y-4 text-xs">
              <div>
                <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Select Product *</label>
                <select
                  required
                  value={batchForm.product_id}
                  onChange={(e) => setBatchForm({ ...batchForm, product_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none font-semibold"
                >
                  <option value="">-- Choose Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Batch Number *</label>
                <input
                  type="text"
                  required
                  value={batchForm.batch_number}
                  onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. BATCH-2026-08-01"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Expiration Date *</label>
                  <input
                    type="date"
                    required
                    value={batchForm.expiry_date}
                    onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Batch Quantity *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={batchForm.quantity}
                    onChange={(e) => setBatchForm({ ...batchForm, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Unit Cost Price</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={batchForm.cost_price}
                  onChange={(e) => setBatchForm({ ...batchForm, cost_price: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-white"
                >
                  Save Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
