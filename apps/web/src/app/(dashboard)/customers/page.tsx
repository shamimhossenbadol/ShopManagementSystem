'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import {
  Users,
  DollarSign,
  History,
  AlertCircle,
  Check,
  Search,
  UserPlus,
  Edit2,
  X,
} from 'lucide-react';

export default function CustomersPage() {
  const { formatCurrency, settings } = useSettings();
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCust, setSelectedCust] = useState<any>(null);
  const [statement, setStatement] = useState<any[]>([]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  // Forms
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethodId, setPayMethodId] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [custForm, setCustForm] = useState({
    name: '',
    phone: '',
    email: '',
    vatNumber: '',
    address: '',
    creditLimit: 1000,
    openingBalance: 0,
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadCustomers = async () => {
    const res = await apiRequest('/ledgers/customers');
    if (res.success && res.data) setCustomers(res.data);
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const openStatement = async (c: any) => {
    setSelectedCust(c);
    setPayAmount(Number(c.current_due || 0));
    const res = await apiRequest(`/ledgers/customers/${c.id}/statement`);
    if (res.success && res.data) setStatement(res.data);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const res = await apiRequest('/ledgers/customers', {
      method: 'POST',
      body: JSON.stringify(custForm),
    });

    setLoading(false);
    if (res.success) {
      setIsAddModalOpen(false);
      setCustForm({ name: '', phone: '', email: '', vatNumber: '', address: '', creditLimit: 1000, openingBalance: 0 });
      loadCustomers();
    } else {
      setErrorMsg(res.message || 'Failed to create customer.');
    }
  };

  const handlePayDue = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const res = await apiRequest('/ledgers/customers/pay', {
      method: 'POST',
      body: JSON.stringify({
        customerId: selectedCust.id,
        amount: Number(payAmount),
        paymentMethodId: Number(payMethodId),
        notes,
      }),
    });

    setLoading(false);

    if (res.success) {
      setIsPayModalOpen(false);
      loadCustomers();
      openStatement({ ...selectedCust, current_due: res.data.newBalance });
    } else {
      setErrorMsg(res.message || 'Payment recording failed.');
    }
  };

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search))
  );

  const totalDueReceivables = customers.reduce((sum, c) => sum + Number(c.current_due || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Customer Directory & Credit (Due)</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track accounts receivable, credit limits, statements, and collect payments.
          </p>
        </div>
        <button
          onClick={() => {
            setErrorMsg(null);
            setIsAddModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition"
        >
          <UserPlus className="h-4 w-4" />
          Add New Customer
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-400">Total Outstanding Receivables (Customer Due)</div>
          <div className="mt-2 font-mono text-2xl font-black text-amber-600 dark:text-amber-400">{formatCurrency(totalDueReceivables)}</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{customers.filter((c) => Number(c.current_due) > 0).length} Customers with pending balance</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-400">Registered Profiles</div>
          <div className="mt-2 font-mono text-2xl font-black text-slate-900 dark:text-white">{customers.length} Customers</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Includes Walk-in counter accounts</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers by name or phone number..."
          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 pl-10 pr-4 text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Customer Directory Table */}
        <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-[10px] font-bold uppercase text-slate-400">
                <tr>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4 text-right">Credit Limit</th>
                  <th className="py-3 px-4 text-right">Outstanding Due</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">No customers found.</td>
                  </tr>
                ) : (
                  filtered.map((c) => {
                    const due = Number(c.current_due || 0);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{c.name}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400">{c.phone}</td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-500 dark:text-slate-400">{formatCurrency(c.credit_limit || 0)}</td>
                        <td className={`py-3.5 px-4 text-right font-mono font-bold ${due > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                          {formatCurrency(due)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => openStatement(c)}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition"
                          >
                            Statement / Pay
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

        {/* Statement & Action Panel */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {selectedCust ? selectedCust.name : 'Select Customer'}
            </h2>
            {selectedCust && Number(selectedCust.current_due) > 0 && (
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setIsPayModalOpen(true);
                }}
                className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition"
              >
                <DollarSign className="h-3.5 w-3.5" />
                Collect Due
              </button>
            )}
          </div>

          {!selectedCust ? (
            <div className="py-12 text-center text-xs text-slate-400">Click "Statement / Pay" on any customer to inspect credit history.</div>
          ) : (
            <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 text-center border border-amber-100 dark:border-amber-900/40 mb-3">
                <div className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">Total Outstanding Due</div>
                <div className="font-mono text-2xl font-black text-amber-900 dark:text-amber-200">{formatCurrency(selectedCust.current_due || 0)}</div>
                <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">Limit: {formatCurrency(selectedCust.credit_limit || 0)}</div>
              </div>

              {statement.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No ledger entries recorded.</p>
              ) : (
                statement.map((s) => (
                  <div key={s.id} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {s.type}
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {Number(s.debit) > 0 ? `+${formatCurrency(s.debit)}` : `-${formatCurrency(s.credit)}`}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 font-medium">{s.notes}</div>
                    <div className="text-[9px] text-slate-400 mt-1 flex justify-between">
                      <span>Balance: {formatCurrency(s.balance)}</span>
                      <span>{new Date(s.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-blue-500" />
                Register New Customer
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

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={custForm.name}
                  onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. Tariq Al-Ghamdi"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={custForm.phone}
                    onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. +966 50 123 4567"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Credit Limit ({settings.currency_symbol || 'SAR'})</label>
                  <input
                    type="number"
                    value={custForm.creditLimit}
                    onChange={(e) => setCustForm({ ...custForm, creditLimit: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Physical Address / City</label>
                <input
                  type="text"
                  value={custForm.address}
                  onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. Olaya District, Riyadh"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Opening Balance</label>
                <input
                  type="number"
                  step="0.01"
                  value={custForm.openingBalance}
                  onChange={(e) => setCustForm({ ...custForm, openingBalance: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
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
                  {loading ? 'Saving...' : 'Register Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collect Due Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <h2 className="text-base font-bold mb-1">Collect Customer Due Payment</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{selectedCust?.name}</p>

            {errorMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 p-2.5 text-xs text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                <AlertCircle className="h-4 w-4" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handlePayDue} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Payment Amount ({settings.currency_symbol || 'SAR'}) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono text-base font-bold text-emerald-600 dark:text-emerald-400 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Payment Destination</label>
                <select
                  value={payMethodId}
                  onChange={(e) => setPayMethodId(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none font-semibold"
                >
                  <option value={1}>Cash Drawer (Till Inflow)</option>
                  <option value={2}>Bank Transfer / Mada</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Reference Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. Paid in cash at front counter"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {loading ? 'Recording...' : 'Confirm Due Collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
