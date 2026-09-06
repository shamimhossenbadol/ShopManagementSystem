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
  Users,
  DollarSign,
  History,
  AlertCircle,
  Check,
  Search,
  UserPlus,
  Edit2,
  X,
  FileText,
  Phone,
  Mail,
  ShieldCheck,
  ArrowDownRight,
  ArrowUpRight,
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
  const [tableLoading, setTableLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadCustomers = async () => {
    setTableLoading(true);
    const res = await apiRequest('/ledgers/customers');
    if (res.success && res.data) setCustomers(res.data);
    setTableLoading(false);
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
      setCustForm({
        name: '',
        phone: '',
        email: '',
        vatNumber: '',
        address: '',
        creditLimit: 1000,
        openingBalance: 0,
      });
      loadCustomers();
    } else {
      setErrorMsg(res.message || 'Failed to create customer profile.');
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
      setErrorMsg(res.message || 'Payment collection recording failed.');
    }
  };

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search))
  );

  const totalDueReceivables = customers.reduce((sum, c) => sum + Number(c.current_due || 0), 0);
  const pendingDueCount = customers.filter((c) => Number(c.current_due) > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            Customer Directory & Credit (Due)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track accounts receivable, credit accounts, credit limits, statements, and collect payments.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setErrorMsg(null);
            setIsAddModalOpen(true);
          }}
          leftIcon={<UserPlus className="h-4 w-4" />}
        >
          Add New Customer
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricCard
          label="Total Accounts Receivable (Customer Due)"
          value={formatCurrency(totalDueReceivables)}
          subValue={`${pendingDueCount} Customers with Pending Balances`}
          icon={<DollarSign className="h-5 w-5" />}
          variant="warning"
        />

        <MetricCard
          label="Registered Customer Profiles"
          value={`${customers.length} Profiles`}
          subValue="Active CRM Registry"
          icon={<Users className="h-5 w-5" />}
          variant="primary"
        />
      </div>

      {/* Main Grid: Customer Table + Live Statement Drawer */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Customers List (2 Cols) */}
        <div className="lg:col-span-2 space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers by name or phone..."
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          <DataTable
            isLoading={tableLoading}
            data={filtered}
            keyExtractor={(c) => c.id}
            emptyMessage="No customers found in CRM directory."
            columns={[
              {
                header: 'Customer Name',
                accessor: (c) => (
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{c.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {c.phone ? `Phone: ${c.phone}` : 'Walk-in'} {c.vat_number ? `• VAT: ${c.vat_number}` : ''}
                    </div>
                  </div>
                ),
              },
              {
                header: 'Credit Limit',
                align: 'right',
                accessor: (c) => (
                  <span className="font-mono text-slate-500">
                    {formatCurrency(c.credit_limit || 0)}
                  </span>
                ),
              },
              {
                header: 'Outstanding Due',
                align: 'right',
                accessor: (c) => {
                  const due = Number(c.current_due || 0);
                  return (
                    <span
                      className={`font-mono font-bold ${
                        due > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
                      }`}
                    >
                      {formatCurrency(due)}
                    </span>
                  );
                },
              },
              {
                header: 'Action',
                align: 'right',
                accessor: (c) => (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openStatement(c)}
                    leftIcon={<FileText className="h-3.5 w-3.5" />}
                  >
                    Statement / Pay
                  </Button>
                ),
              },
            ]}
          />
        </div>

        {/* Selected Customer Statement Panel (1 Col) */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white truncate">
                  {selectedCust ? selectedCust.name : 'Customer Credit Statement'}
                </h2>
                {selectedCust && (
                  <p className="text-[11px] text-slate-400 font-mono">
                    {selectedCust.phone || 'Walk-in'}
                  </p>
                )}
              </div>
              {selectedCust && Number(selectedCust.current_due) > 0 && (
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => {
                    setErrorMsg(null);
                    setIsPayModalOpen(true);
                  }}
                  leftIcon={<DollarSign className="h-3.5 w-3.5" />}
                >
                  Collect Due
                </Button>
              )}
            </div>

            {!selectedCust ? (
              <div className="py-16 text-center text-xs text-slate-400 font-medium">
                Click "Statement / Pay" on any customer to inspect credit statement & collect payments.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Balance Callout */}
                <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 text-center border border-amber-200 dark:border-amber-900/40">
                  <div className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300">
                    Total Outstanding Due
                  </div>
                  <div className="mt-1 font-mono text-2xl font-black text-amber-950 dark:text-amber-100">
                    {formatCurrency(selectedCust.current_due || 0)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Credit Limit: {formatCurrency(selectedCust.credit_limit || 0)}
                  </div>
                </div>

                {/* Ledger Transactions */}
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {statement.length === 0 ? (
                    <p className="text-xs text-slate-400 py-8 text-center font-medium">
                      No statement transactions logged for this customer.
                    </p>
                  ) : (
                    statement.map((st) => (
                      <div
                        key={st.id}
                        className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 text-xs space-y-1"
                      >
                        <div className="flex justify-between items-center">
                          <Badge variant={st.type === 'invoice' ? 'warning' : 'success'}>
                            {st.type?.toUpperCase()}
                          </Badge>
                          <span
                            className={`font-mono font-bold ${
                              st.type === 'invoice'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {st.type === 'invoice' ? `+${formatCurrency(st.debit)}` : `-${formatCurrency(st.credit)}`}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                          {st.notes || 'Customer statement entry'}
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

      {/* Add Customer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-700 dark:text-sky-400" />
            <span>Register New Customer CRM Profile</span>
          </div>
        }
        subtitle="Create customer account with credit limits and B2B VAT registration"
        maxWidth="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" isLoading={loading} onClick={handleCreateCustomer}>
              Save Customer
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

        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Customer Full Name *"
              required
              value={custForm.name}
              onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
              placeholder="e.g. Tariq Al-Otaibi"
            />
            <Input
              label="Contact Phone *"
              required
              value={custForm.phone}
              onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
              placeholder="e.g. +966 50 123 4567"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="VAT Identification Number (B2B Invoices)"
              value={custForm.vatNumber}
              onChange={(e) => setCustForm({ ...custForm, vatNumber: e.target.value })}
              placeholder="300998877600003"
            />
            <Input
              label="Credit Limit (SAR)"
              type="number"
              step="0.01"
              value={custForm.creditLimit}
              onChange={(e) =>
                setCustForm({ ...custForm, creditLimit: parseFloat(e.target.value) || 0 })
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Email Address"
              type="email"
              value={custForm.email}
              onChange={(e) => setCustForm({ ...custForm, email: e.target.value })}
              placeholder="customer@email.com"
            />
            <Input
              label="Opening Due Balance (SAR)"
              type="number"
              step="0.01"
              value={custForm.openingBalance}
              onChange={(e) =>
                setCustForm({ ...custForm, openingBalance: parseFloat(e.target.value) || 0 })
              }
            />
          </div>

          <Textarea
            label="Physical Billing Address"
            value={custForm.address}
            onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
            placeholder="Olaya Street, Riyadh, Saudi Arabia"
            rows={2}
          />
        </form>
      </Modal>

      {/* Collect Due Payment Modal */}
      {isPayModalOpen && selectedCust && (
        <Modal
          isOpen={isPayModalOpen}
          onClose={() => setIsPayModalOpen(false)}
          title={
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span>Collect Customer Outstanding Due Payment</span>
            </div>
          }
          subtitle={`Customer: ${selectedCust.name} (Current Due: ${formatCurrency(selectedCust.current_due)})`}
          maxWidth="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsPayModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="success" isLoading={loading} onClick={handlePayDue}>
                Confirm Collection ({formatCurrency(payAmount)})
              </Button>
            </>
          }
        >
          <form onSubmit={handlePayDue} className="space-y-4">
            <Input
              label="Collected Amount (SAR) *"
              type="number"
              step="0.01"
              required
              value={payAmount}
              onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
              className="font-mono text-xl font-bold"
            />

            <Select
              label="Payment Inflow Method *"
              value={payMethodId}
              onChange={(e) => setPayMethodId(parseInt(e.target.value))}
            >
              <option value={1}>Cash Drawer (Register Inflow)</option>
              <option value={2}>Mada / Visa Card</option>
              <option value={3}>Bank Direct Transfer</option>
            </Select>

            <Textarea
              label="Payment Notes / Receipt Ref"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Received partial cash against due balance"
              rows={2}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
