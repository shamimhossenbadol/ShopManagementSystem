'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import {
  Building2,
  Plus,
  DollarSign,
  Check,
  AlertCircle,
  Search,
  X,
  History,
} from 'lucide-react';

export default function SuppliersPage() {
  const { formatCurrency, settings } = useSettings();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [statement, setStatement] = useState<any[]>([]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  // Forms
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethodId, setPayMethodId] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [supForm, setSupForm] = useState({
    name: '',
    companyName: '',
    vatNumber: '',
    phone: '',
    email: '',
    address: '',
    openingBalance: 0,
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadSuppliers = async () => {
    const res = await apiRequest('/ledgers/suppliers');
    if (res.success && res.data) setSuppliers(res.data);
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const openStatement = async (s: any) => {
    setSelectedSupplier(s);
    setPayAmount(Number(s.current_payable || 0));
    const res = await apiRequest(`/ledgers/suppliers/${s.id}/statement`);
    if (res.success && res.data) setStatement(res.data);
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const res = await apiRequest('/ledgers/suppliers', {
      method: 'POST',
      body: JSON.stringify(supForm),
    });

    setLoading(false);
    if (res.success) {
      setIsAddModalOpen(false);
      setSupForm({ name: '', companyName: '', vatNumber: '', phone: '', email: '', address: '', openingBalance: 0 });
      loadSuppliers();
    } else {
      setErrorMsg(res.message || 'Failed to create supplier profile.');
    }
  };

  const handlePaySupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const res = await apiRequest('/ledgers/suppliers/pay', {
      method: 'POST',
      body: JSON.stringify({
        supplierId: selectedSupplier.id,
        amount: Number(payAmount),
        paymentMethodId: Number(payMethodId),
        notes,
      }),
    });

    setLoading(false);

    if (res.success) {
      setIsPayModalOpen(false);
      loadSuppliers();
      openStatement({ ...selectedSupplier, current_payable: res.data.newBalance });
    } else {
      setErrorMsg(res.message || 'Payment recording failed.');
    }
  };

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.company_name && s.company_name.toLowerCase().includes(search.toLowerCase())) ||
      (s.phone && s.phone.includes(search))
  );

  const totalPayables = suppliers.reduce((sum, s) => sum + Number(s.current_payable || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Supplier Directory & Accounts Payable</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage vendor accounts, Saudi tax ID numbers, statements, and bill payments.
          </p>
        </div>
        <button
          onClick={() => {
            setErrorMsg(null);
            setIsAddModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition"
        >
          <Plus className="h-4 w-4" />
          Add New Supplier
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-400">Total Accounts Payable (Supplier Due)</div>
          <div className="mt-2 font-mono text-2xl font-black text-amber-600 dark:text-amber-400">{formatCurrency(totalPayables)}</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{suppliers.filter((s) => Number(s.current_payable) > 0).length} Suppliers with pending bills</div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-400">Active Vendor Directory</div>
          <div className="mt-2 font-mono text-2xl font-black text-slate-900 dark:text-white">{suppliers.length} Suppliers</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Authorized procurement partners</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search suppliers by name, company, or phone..."
          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 pl-10 pr-4 text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Suppliers List Table */}
        <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-[10px] font-bold uppercase text-slate-400">
                <tr>
                  <th className="py-3 px-4">Supplier Name</th>
                  <th className="py-3 px-4">Company / Tax ID</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4 text-right">Accounts Payable</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">No suppliers registered.</td>
                  </tr>
                ) : (
                  filtered.map((s) => {
                    const pay = Number(s.current_payable || 0);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{s.name}</td>
                        <td className="py-3.5 px-4">
                          <div className="text-slate-700 dark:text-slate-300 font-semibold">{s.company_name || 'Vendor'}</div>
                          <div className="font-mono text-[10px] text-slate-400">VAT: {s.vat_number || 'Unregistered'}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400">{s.phone || 'N/A'}</td>
                        <td className={`py-3.5 px-4 text-right font-mono font-bold ${pay > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                          {formatCurrency(pay)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => openStatement(s)}
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

        {/* Statement & Pay Bill Panel */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {selectedSupplier ? selectedSupplier.name : 'Select Supplier'}
            </h2>
            {selectedSupplier && Number(selectedSupplier.current_payable) > 0 && (
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setIsPayModalOpen(true);
                }}
                className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition"
              >
                <DollarSign className="h-3.5 w-3.5" />
                Pay Bill
              </button>
            )}
          </div>

          {!selectedSupplier ? (
            <div className="py-12 text-center text-xs text-slate-400">Click "Statement / Pay" on any supplier to inspect bills.</div>
          ) : (
            <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 text-center border border-amber-100 dark:border-amber-900/40 mb-3">
                <div className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">Current Balance Payable</div>
                <div className="font-mono text-2xl font-black text-amber-900 dark:text-amber-200">{formatCurrency(selectedSupplier.current_payable || 0)}</div>
              </div>

              {statement.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No ledger entries recorded.</p>
              ) : (
                statement.map((st) => (
                  <div key={st.id} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {st.type}
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {Number(st.credit) > 0 ? `+${formatCurrency(st.credit)}` : `-${formatCurrency(st.debit)}`}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 font-medium">{st.notes}</div>
                    <div className="text-[9px] text-slate-400 mt-1 flex justify-between">
                      <span>Balance: {formatCurrency(st.balance)}</span>
                      <span>{new Date(st.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Supplier Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                Register New Supplier
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

            <form onSubmit={handleCreateSupplier} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Contact / Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={supForm.name}
                  onChange={(e) => setSupForm({ ...supForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. Al-Watania Food Supplies"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Company Name</label>
                  <input
                    type="text"
                    value={supForm.companyName}
                    onChange={(e) => setSupForm({ ...supForm, companyName: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. Al-Watania Trading Co."
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Saudi VAT Number</label>
                  <input
                    type="text"
                    value={supForm.vatNumber}
                    onChange={(e) => setSupForm({ ...supForm, vatNumber: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                    placeholder="300XXXXXXXXXXXX"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Phone</label>
                  <input
                    type="text"
                    value={supForm.phone}
                    onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                    placeholder="+966 11 000 0000"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Opening Balance Due</label>
                  <input
                    type="number"
                    step="0.01"
                    value={supForm.openingBalance}
                    onChange={(e) => setSupForm({ ...supForm, openingBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Office / Warehouse Address</label>
                <input
                  type="text"
                  value={supForm.address}
                  onChange={(e) => setSupForm({ ...supForm, address: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. Industrial Area 2, Riyadh"
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
                  {loading ? 'Saving...' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Supplier Bill Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <h2 className="text-base font-bold mb-1">Pay Supplier Bill</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{selectedSupplier?.name}</p>

            {errorMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 p-2.5 text-xs text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                <AlertCircle className="h-4 w-4" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handlePaySupplier} className="space-y-3 text-xs">
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
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Payment Source</label>
                <select
                  value={payMethodId}
                  onChange={(e) => setPayMethodId(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none font-semibold"
                >
                  <option value={1}>Cash Drawer (Till Outflow)</option>
                  <option value={2}>Bank Transfer / Cheque</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Reference Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. Paid against supplier invoice #4821"
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
                  {loading ? 'Recording...' : 'Confirm Supplier Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
