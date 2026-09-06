'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { Button, IconButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { MetricCard } from '@/components/ui/MetricCard';
import {
  ReceiptText,
  Plus,
  Check,
  AlertCircle,
  Calendar,
  FolderPlus,
  X,
  DollarSign,
  TrendingDown,
  Tag,
  Search,
} from 'lucide-react';

export default function ExpensesPage() {
  const { formatCurrency, settings } = useSettings();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(true);
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
    setTableLoading(true);
    const res = await apiRequest('/expenses');
    if (res.success && res.data) setExpenses(res.data);

    const catRes = await apiRequest('/expenses/categories');
    if (catRes.success && catRes.data) {
      setCategories(catRes.data);
      if (catRes.data.length > 0) setForm((prev) => ({ ...prev, categoryId: catRes.data[0].id }));
    }
    setTableLoading(false);
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
      setErrorMsg(res.message || 'Failed to record expense voucher.');
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
  const cashSpent = expenses
    .filter((e) => e.payment_method?.toLowerCase().includes('cash'))
    .reduce((s, e) => s + Number(e.amount), 0);

  const filteredExpenses = expenses.filter((e) => {
    return (
      e.reference_no?.toLowerCase().includes(search.toLowerCase()) ||
      e.category_name?.toLowerCase().includes(search.toLowerCase()) ||
      (e.note && e.note.toLowerCase().includes(search.toLowerCase()))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            Operating Expenses Tracker
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Record shop overhead, store rent, electricity bills, internet, petty cash, and staff costs.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setIsCatModalOpen(true)}
            leftIcon={<FolderPlus className="h-4 w-4" />}
          >
            Add Category
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setErrorMsg(null);
              setIsAddModalOpen(true);
            }}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Record Expense Voucher
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total Operating Expenses Logged"
          value={formatCurrency(totalSpent)}
          subValue={`${expenses.length} Expense Vouchers Recorded`}
          icon={<TrendingDown className="h-5 w-5" />}
          variant="danger"
        />

        <MetricCard
          label="Cash Drawer Till Deductions"
          value={formatCurrency(cashSpent)}
          subValue="Paid Directly from Shift Float"
          icon={<DollarSign className="h-5 w-5" />}
          variant="warning"
        />

        <MetricCard
          label="Expense Categories"
          value={`${categories.length} Categories`}
          subValue="Rent, Utility Bills, Petty Cash, Supplies"
          icon={<Tag className="h-5 w-5" />}
          variant="default"
        />
      </div>

      {/* Search Toolbar */}
      <div className="flex items-center rounded-2xl bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by expense voucher #, category, or note..."
            className="text-xs"
          />
        </div>
      </div>

      {/* Expenses Master DataTable */}
      <DataTable
        isLoading={tableLoading}
        data={filteredExpenses}
        keyExtractor={(e) => e.id}
        emptyMessage="No operational expense vouchers logged yet."
        columns={[
          {
            header: 'Voucher Ref / Date',
            accessor: (e) => (
              <div>
                <div className="font-mono font-bold text-slate-900 dark:text-white">
                  {e.reference_no}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {new Date(e.date).toLocaleDateString('en-GB')}
                </div>
              </div>
            ),
          },
          {
            header: 'Category',
            accessor: (e) => (
              <Badge variant="primary">{e.category_name}</Badge>
            ),
          },
          {
            header: 'Payment Method',
            accessor: (e) => (
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {e.payment_method}
              </span>
            ),
          },
          {
            header: 'Description / Note',
            accessor: (e) => (
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {e.note || 'Operational shop expense'}
              </span>
            ),
          },
          {
            header: 'Logged By',
            accessor: (e) => (
              <span className="text-slate-500 font-mono text-[11px]">{e.created_by}</span>
            ),
          },
          {
            header: 'Amount (SAR)',
            align: 'right',
            accessor: (e) => (
              <span className="font-mono font-bold text-red-600 dark:text-red-400">
                {formatCurrency(e.amount)}
              </span>
            ),
          },
        ]}
      />

      {/* Record Expense Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-blue-700 dark:text-sky-400" />
            <span>Record Shop Expense Voucher</span>
          </div>
        }
        subtitle="Deducts from store profit margin and records register outflow if cash"
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" isLoading={loading} onClick={handleCreateExpense}>
              Save Expense Voucher
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

        <form onSubmit={handleCreateExpense} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Expense Category *"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>

            <Input
              label="Expense Date *"
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Total Expense Amount (SAR) *"
              type="number"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
              className="font-mono text-lg font-bold"
            />

            <Select
              label="Payment Source *"
              value={form.paymentMethodId}
              onChange={(e) => setForm({ ...form, paymentMethodId: Number(e.target.value) })}
            >
              <option value={1}>Cash Till (Register Float)</option>
              <option value={2}>Bank Account / Wire</option>
              <option value={3}>Company Card</option>
            </Select>
          </div>

          <Textarea
            label="Expense Purpose / Voucher Notes *"
            required
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="e.g. Monthly internet subscription (STC Fiber), Store cleaning supplies"
            rows={2}
          />
        </form>
      </Modal>

      {/* Add Category Modal */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title="Add Expense Category"
        subtitle="Create a new expense grouping category"
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCatModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateCategory}>
              Save Category
            </Button>
          </>
        }
      >
        <Input
          label="Category Name *"
          required
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          placeholder="e.g. Electricity, Maintenance, Rent"
        />
      </Modal>
    </div>
  );
}
