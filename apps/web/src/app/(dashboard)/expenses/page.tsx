'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import {
  ReceiptText,
  Plus,
  Check,
  AlertCircle,
  Calendar,
  FolderPlus,
  X,
} from 'lucide-react';

export default function ExpensesPage() {
  const { formatCurrency, settings } = useSettings();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    categoryId: 1,
    amount: 0,
    taxAmount: 0,
    date: new Date().toISOString().slice(0, 10),
    paymentMethodId: 1,
    note: '',
  });

  const loadData = async () => {
    const res = await apiRequest('/expenses');
    if (res.success && res.data) setExpenses(res.data);

    const catRes = await apiRequest('/expenses/categories');
    if (catRes.success && catRes.data) {
      setCategories(catRes.data);
      if (catRes.data.length > 0) setForm((prev) => ({ ...prev, categoryId: catRes.data[0].id }));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const res = await apiRequest('/expenses', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
        taxAmount: Number(form.taxAmount),
        categoryId: Number(form.categoryId),
        paymentMethodId: Number(form.paymentMethodId),
      }),
    });

    setLoading(false);

    if (res.success) {
      setIsAddModalOpen(false);
      setForm({
        categoryId: categories[0]?.id || 1,
        amount: 0,
        taxAmount: 0,
        date: new Date().toISOString().slice(0, 10),
        paymentMethodId: 1,
        note: '',
      });
      loadData();
    } else {
      setErrorMsg(res.message || 'Failed to record expense.');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/expenses/categories', {
      method: 'POST',
      body: JSON.stringify({ name: newCatName }),
    });
    if (res.success) {
      setNewCatName('');
      setIsCatModalOpen(false);
      loadData();
    }
  };

  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Operating Expenses Tracker</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Record overhead, rent, utility bills, packaging, and staff costs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCatModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm"
          >
            <FolderPlus className="h-4 w-4 text-slate-500" />
            Add Category
          </button>
          <button
            onClick={() => {
              setErrorMsg(null);
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition"
          >
            <Plus className="h-4 w-4" />
            Record New Expense
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-400">Total Operating Expenses Logged</div>
          <div className="mt-2 font-mono text-2xl font-black text-rose-600 dark:text-rose-400">{formatCurrency(totalSpent)}</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{expenses.length} Total Expense Vouchers</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-400">Active Expense Categories</div>
          <div className="mt-2 font-mono text-2xl font-black text-slate-900 dark:text-white">{categories.length} Categories</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Rent, Electricity, Telecom, Supplies</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-400">Cash Drawer Deduction Impact</div>
          <div className="mt-2 font-mono text-2xl font-black text-slate-900 dark:text-white">
            {formatCurrency(expenses.filter((e) => e.payment_method?.toLowerCase().includes('cash')).reduce((s, e) => s + Number(e.amount), 0))}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Paid directly from register till</div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-[10px] font-bold uppercase text-slate-400">
              <tr>
                <th className="py-3 px-4">Reference / Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Created By</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">No operational expenses logged yet.</td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-slate-900 dark:text-white">{e.reference_no}</div>
                      <div className="text-[10px] text-slate-400">{e.date}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {e.category_name}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{e.payment_method}</td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium">{e.note || 'Operational expense'}</td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">{e.created_by}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">{formatCurrency(e.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-blue-500" />
                Record Operational Expense
              </h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 p-2.5 text-xs text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                <AlertCircle className="h-4 w-4" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateExpense} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Category *</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none font-semibold"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Date *</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Expense Amount ({settings.currency_symbol || 'SAR'}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono text-base font-bold text-rose-600 dark:text-rose-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Payment Method</label>
                  <select
                    value={form.paymentMethodId}
                    onChange={(e) => setForm({ ...form, paymentMethodId: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none font-semibold"
                  >
                    <option value={1}>Cash Drawer (Till Outflow)</option>
                    <option value={2}>Bank Transfer / Mada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Description / Reason</label>
                <textarea
                  rows={2}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. Electricity bill for shop (Mewar)"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {loading ? 'Recording...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <h2 className="text-base font-bold mb-3 flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-blue-500" />
              Add Expense Category
            </h2>
            <form onSubmit={handleCreateCategory} className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Category Name *</label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. Store Maintenance"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
