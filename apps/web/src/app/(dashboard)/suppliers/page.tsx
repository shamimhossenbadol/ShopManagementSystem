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
  Building2,
  Plus,
  DollarSign,
  Check,
  AlertCircle,
  Search,
  X,
  History,
  FileText,
  Phone,
  Mail,
  Receipt,
  ArrowDownRight,
  ArrowUpRight,
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
  const [tableLoading, setTableLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadSuppliers = async () => {
    setTableLoading(true);
    const res = await apiRequest('/ledgers/suppliers');
    if (res.success && res.data) setSuppliers(res.data);
    setTableLoading(false);
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
      setSupForm({
        name: '',
        companyName: '',
        vatNumber: '',
        phone: '',
        email: '',
        address: '',
        openingBalance: 0,
      });
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
  const pendingCount = suppliers.filter((s) => Number(s.current_payable) > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            Suppliers & Accounts Payable
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage vendor profiles, Saudi VAT registration numbers, statement ledgers, and bill settlements.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setErrorMsg(null);
            setIsAddModalOpen(true);
          }}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Add New Supplier
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricCard
          label="Total Accounts Payable (Supplier Debt)"
          value={formatCurrency(totalPayables)}
          subValue={`${pendingCount} Suppliers with Outstanding Balances`}
          icon={<Building2 className="h-5 w-5" />}
          variant="warning"
        />

        <MetricCard
          label="Active Vendor Directory"
          value={`${suppliers.length} Suppliers`}
          subValue="Registered Trade Partners"
          icon={<Receipt className="h-5 w-5" />}
          variant="primary"
        />
      </div>

      {/* Main Grid: Supplier Table + Live Statement Drawer */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Suppliers List (2 Cols) */}
        <div className="lg:col-span-2 space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search suppliers by name, company, or phone..."
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          <DataTable
            isLoading={tableLoading}
            data={filtered}
            keyExtractor={(s) => s.id}
            emptyMessage="No suppliers registered in directory."
            columns={[
              {
                header: 'Supplier Name / Company',
                accessor: (s) => (
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{s.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {s.company_name || 'Vendor'} {s.vat_number ? `• VAT: ${s.vat_number}` : ''}
                    </div>
                  </div>
                ),
              },
              {
                header: 'Contact Phone',
                accessor: (s) => (
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {s.phone || 'N/A'}
                  </span>
                ),
              },
              {
                header: 'Accounts Payable',
                align: 'right',
                accessor: (s) => {
                  const pay = Number(s.current_payable || 0);
                  return (
                    <span
                      className={`font-mono font-bold ${
                        pay > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
                      }`}
                    >
                      {formatCurrency(pay)}
                    </span>
                  );
                },
              },
              {
                header: 'Action',
                align: 'right',
                accessor: (s) => (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openStatement(s)}
                    leftIcon={<FileText className="h-3.5 w-3.5" />}
                  >
                    Statement / Pay
                  </Button>
                ),
              },
            ]}
          />
        </div>

        {/* Selected Supplier Statement Panel (1 Col) */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white truncate">
                  {selectedSupplier ? selectedSupplier.name : 'Vendor Ledger Statement'}
                </h2>
                {selectedSupplier && (
                  <p className="text-[11px] text-slate-400 font-mono">
                    {selectedSupplier.phone || 'No phone'}
                  </p>
                )}
              </div>
              {selectedSupplier && Number(selectedSupplier.current_payable) > 0 && (
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => {
                    setErrorMsg(null);
                    setIsPayModalOpen(true);
                  }}
                  leftIcon={<DollarSign className="h-3.5 w-3.5" />}
                >
                  Pay Bill
                </Button>
              )}
            </div>

            {!selectedSupplier ? (
              <div className="py-16 text-center text-xs text-slate-400 font-medium">
                Click "Statement / Pay" on any supplier to inspect account ledger & make settlements.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Balance Callout */}
                <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 text-center border border-amber-200 dark:border-amber-900/40">
                  <div className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300">
                    Outstanding Payable Due
                  </div>
                  <div className="mt-1 font-mono text-2xl font-black text-amber-950 dark:text-amber-100">
                    {formatCurrency(selectedSupplier.current_payable || 0)}
                  </div>
                </div>

                {/* Ledger Transactions */}
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {statement.length === 0 ? (
                    <p className="text-xs text-slate-400 py-8 text-center font-medium">
                      No ledger transactions logged for this vendor.
                    </p>
                  ) : (
                    statement.map((st) => (
                      <div
                        key={st.id}
                        className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 text-xs space-y-1"
                      >
                        <div className="flex justify-between items-center">
                          <Badge variant={st.type === 'bill' ? 'warning' : 'success'}>
                            {st.type?.toUpperCase()}
                          </Badge>
                          <span
                            className={`font-mono font-bold ${
                              st.type === 'bill'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {st.type === 'bill' ? `+${formatCurrency(st.credit)}` : `-${formatCurrency(st.debit)}`}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                          {st.notes || 'Vendor ledger entry'}
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100 dark:border-slate-800">
                          <span>Balance: {formatCurrency(st.balance)}</span>
                          <span>{new Date(st.created_at).toLocaleDateString('en-GB')}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Supplier Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-700 dark:text-sky-400" />
            <span>Register New Supplier Profile</span>
          </div>
        }
        subtitle="Maintain vendor contacts and Saudi VAT registration information"
        maxWidth="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" isLoading={loading} onClick={handleCreateSupplier}>
              Save Supplier Profile
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

        <form onSubmit={handleCreateSupplier} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Supplier / Contact Name *"
              required
              value={supForm.name}
              onChange={(e) => setSupForm({ ...supForm, name: e.target.value })}
              placeholder="e.g. Almarai Distribution Co."
            />
            <Input
              label="Company Name"
              value={supForm.companyName}
              onChange={(e) => setSupForm({ ...supForm, companyName: e.target.value })}
              placeholder="e.g. Almarai Food Trading LLC"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="VAT Identification Number (15 Digits)"
              value={supForm.vatNumber}
              onChange={(e) => setSupForm({ ...supForm, vatNumber: e.target.value })}
              placeholder="300123456700003"
            />
            <Input
              label="Contact Phone"
              value={supForm.phone}
              onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })}
              placeholder="+966 11 123 4567"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Email Address"
              type="email"
              value={supForm.email}
              onChange={(e) => setSupForm({ ...supForm, email: e.target.value })}
              placeholder="orders@almarai.com"
            />
            <Input
              label="Opening Due Balance (SAR)"
              type="number"
              step="0.01"
              value={supForm.openingBalance}
              onChange={(e) =>
                setSupForm({ ...supForm, openingBalance: parseFloat(e.target.value) || 0 })
              }
            />
          </div>

          <Textarea
            label="Physical Warehouse Address"
            value={supForm.address}
            onChange={(e) => setSupForm({ ...supForm, address: e.target.value })}
            placeholder="Industrial Area 2, Riyadh, Saudi Arabia"
            rows={2}
          />
        </form>
      </Modal>

      {/* Pay Supplier Bill Modal */}
      {isPayModalOpen && selectedSupplier && (
        <Modal
          isOpen={isPayModalOpen}
          onClose={() => setIsPayModalOpen(false)}
          title={
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span>Record Supplier Bill Settlement</span>
            </div>
          }
          subtitle={`Vendor: ${selectedSupplier.name} (Current Payable: ${formatCurrency(selectedSupplier.current_payable)})`}
          maxWidth="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsPayModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="success" isLoading={loading} onClick={handlePaySupplier}>
                Confirm Settlement ({formatCurrency(payAmount)})
              </Button>
            </>
          }
        >
          <form onSubmit={handlePaySupplier} className="space-y-4">
            <Input
              label="Settlement Payment Amount (SAR) *"
              type="number"
              step="0.01"
              required
              value={payAmount}
              onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
              className="font-mono text-xl font-bold"
            />

            <Select
              label="Payment Outflow Method *"
              value={payMethodId}
              onChange={(e) => setPayMethodId(parseInt(e.target.value))}
            >
              <option value={1}>Cash Drawer (Outflow)</option>
              <option value={2}>Bank Direct Transfer</option>
              <option value={3}>Cheque Payment</option>
            </Select>

            <Textarea
              label="Payment Notes / Cheque #"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Settled against invoice #88492 via bank wire"
              rows={2}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
