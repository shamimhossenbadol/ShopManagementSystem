'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import {
  Boxes,
  Plus,
  Minus,
  History,
  AlertCircle,
  Check,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';

export default function InventoryPage() {
  const { formatCurrency, settings } = useSettings();
  const [stockList, setStockList] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isMovementDrawerOpen, setIsMovementDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low_stock' | 'out_of_stock'>('all');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [adjustForm, setAdjustForm] = useState({
    productId: 0,
    type: 'addition',
    quantity: 1,
    reason: 'Physical inventory recount',
    notes: '',
  });

  const loadStock = async () => {
    const res = await apiRequest('/inventory/stock');
    if (res.success && res.data) setStockList(res.data);
  };

  useEffect(() => {
    loadStock();
  }, []);

  const openMovements = async (p: any) => {
    setSelectedProduct(p);
    setIsMovementDrawerOpen(true);
    const res = await apiRequest(`/inventory/movements/${p.id}`);
    if (res.success && res.data) setMovements(res.data);
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const res = await apiRequest('/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify({
        ...adjustForm,
        productId: Number(adjustForm.productId),
        quantity: Number(adjustForm.quantity),
      }),
    });

    setLoading(false);

    if (res.success) {
      setIsAdjustOpen(false);
      loadStock();
      if (selectedProduct && selectedProduct.id === Number(adjustForm.productId)) {
        openMovements(selectedProduct);
      }
    } else {
      setErrorMsg(res.message || 'Failed to adjust stock.');
    }
  };

  const filtered = stockList.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search));
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'low_stock'
        ? p.stock_status === 'low_stock'
        : p.stock_status === 'out_of_stock';
    return matchesSearch && matchesStatus;
  });

  const totalValuation = stockList.reduce((sum, p) => sum + Number(p.stock_valuation || 0), 0);
  const lowStockCount = stockList.filter((p) => p.stock_status === 'low_stock').length;
  const outOfStockCount = stockList.filter((p) => p.stock_status === 'out_of_stock').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Inventory & Stock Movement Ledger
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time immutable stock ledger, physical audits, and manual adjustment logs.
          </p>
        </div>
        <button
          onClick={() => {
            setErrorMsg(null);
            setIsAdjustOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-amber-500/20 hover:bg-amber-500 transition"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Record Stock Adjustment
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-400">Total Inventory Valuation (WAC)</div>
          <div className="mt-2 font-mono text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(totalValuation)}</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{stockList.length} Active Catalog Items</div>
        </div>

        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-5 shadow-sm">
          <div className="text-xs font-bold uppercase text-amber-800 dark:text-amber-300">Low Stock Threshold Items</div>
          <div className="mt-2 font-mono text-2xl font-black text-amber-900 dark:text-amber-300">{lowStockCount} Products</div>
          <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">Reorder recommended soon</div>
        </div>

        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 p-5 shadow-sm">
          <div className="text-xs font-bold uppercase text-rose-800 dark:text-rose-300">Out of Stock Items</div>
          <div className="mt-2 font-mono text-2xl font-black text-rose-900 dark:text-rose-300">{outOfStockCount} Products</div>
          <div className="mt-1 text-xs text-rose-700 dark:text-rose-400">Immediate purchase required</div>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stock by name, SKU, or barcode..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 pl-10 pr-4 text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded-xl px-4 py-2 font-semibold transition ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            All Stock ({stockList.length})
          </button>
          <button
            onClick={() => setStatusFilter('low_stock')}
            className={`rounded-xl px-4 py-2 font-semibold transition ${
              statusFilter === 'low_stock'
                ? 'bg-amber-600 text-white shadow'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            Low Stock ({lowStockCount})
          </button>
          <button
            onClick={() => setStatusFilter('out_of_stock')}
            className={`rounded-xl px-4 py-2 font-semibold transition ${
              statusFilter === 'out_of_stock'
                ? 'bg-rose-600 text-white shadow'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            Out of Stock ({outOfStockCount})
          </button>
        </div>
      </div>

      {/* Stock Overview Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-[10px] font-bold uppercase text-slate-400">
              <tr>
                <th className="py-3 px-4">SKU & Item Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Cost Price (WAC)</th>
                <th className="py-3 px-4 text-center">Current Stock</th>
                <th className="py-3 px-4 text-right">Total Valuation</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">No stock records found matching filter.</td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const stock = Number(p.current_stock || 0);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{p.name}</div>
                        <div className="font-mono text-[10px] text-slate-400">{p.sku}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{p.category_name || 'General'}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-500">{formatCurrency(p.cost_price || 0)}</td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-900 dark:text-white">
                        {stock} {p.unit_short}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(p.stock_valuation || 0)}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            stock > p.min_stock_level
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                              : stock > 0
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {stock > p.min_stock_level ? 'In Stock' : stock > 0 ? 'Low Stock' : 'Out of Stock'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openMovements(p)}
                          className="flex items-center gap-1 ml-auto rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition"
                        >
                          <History className="h-3 w-3" />
                          Ledger History
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movement Ledger Drawer / Modal */}
      {isMovementDrawerOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg h-[90vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl flex flex-col text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <History className="h-4 w-4 text-blue-500" />
                  Audit Trail: {selectedProduct.name}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">SKU: {selectedProduct.sku} • Current Stock: {selectedProduct.current_stock}</p>
              </div>
              <button onClick={() => setIsMovementDrawerOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {movements.length === 0 ? (
                <p className="text-xs text-slate-400 py-12 text-center">No movement transactions logged for this SKU.</p>
              ) : (
                movements.map((m) => (
                  <div key={m.id} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {m.type}
                      </span>
                      <span className={`font-mono font-black text-sm ${Number(m.quantity) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {Number(m.quantity) > 0 ? `+${m.quantity}` : m.quantity}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-700 dark:text-slate-300 mt-2 font-medium">{m.notes || 'Transaction ledger entry'}</div>
                    <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                      <span>By: {m.user_name}</span>
                      <span>{new Date(m.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setIsMovementDrawerOpen(false)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Stock Adjustment Modal */}
      {isAdjustOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <h2 className="text-lg font-bold mb-2">Record Physical Stock Adjustment</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Atomic stock ledger adjustment with mandatory audit explanation.</p>

            {errorMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 p-2.5 text-xs text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                <AlertCircle className="h-4 w-4" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleAdjust} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Select Product *</label>
                <select
                  required
                  value={adjustForm.productId}
                  onChange={(e) => setAdjustForm({ ...adjustForm, productId: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none font-semibold"
                >
                  <option value={0}>Choose a product...</option>
                  {stockList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Current Stock: {p.current_stock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Direction *</label>
                  <select
                    value={adjustForm.type}
                    onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none font-semibold"
                  >
                    <option value="addition">+ Increase (Found / Recount)</option>
                    <option value="subtraction">- Decrease (Shrinkage / Damage)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={adjustForm.quantity}
                    onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseFloat(e.target.value) || 1 })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Reason for Adjustment *</label>
                <input
                  type="text"
                  required
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. Physical recount variance, damaged packaging"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Additional Notes</label>
                <textarea
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Optional audit context"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAdjustOpen(false)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || adjustForm.productId === 0}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-5 py-2 font-bold text-white hover:bg-amber-500 disabled:opacity-40"
                >
                  <Check className="h-4 w-4" />
                  {loading ? 'Submitting...' : 'Apply Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
