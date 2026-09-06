'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { apiRequest } from '@/lib/api';
import {
  CreditCard,
  Banknote,
  Building,
  Users,
  X,
  Check,
  ArrowRight,
  Search,
  UserPlus,
  UserCheck,
  AlertCircle,
  RotateCcw,
  Lock,
  Sparkles,
  Phone,
  Mail,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  current_due?: number | string;
  credit_limit?: number | string;
  isWalkIn?: boolean;
}

const DEFAULT_WALK_IN: Customer = {
  id: 1,
  name: 'Walk-in Customer',
  phone: '0000000000',
  current_due: 0,
  credit_limit: 0,
  isWalkIn: true,
};

interface TenderModalProps {
  totalAmount: number;
  customerName?: string;
  onConfirm: (
    payments: Array<{ paymentMethodId: number; amount: number; reference?: string }>,
    customerId?: number
  ) => void;
  onClose: () => void;
  loading: boolean;
}

/**
 * Smart Saudi Riyal note & round-figure presets generator
 * E.g., for 73 SAR -> [73, 75, 80, 100, 200, 500]
 */
function getSmartSaudiPresets(total: number): number[] {
  if (total <= 0) return [10, 20, 50, 100, 200, 500];
  const presets = new Set<number>();

  const exact = Math.round(total * 100) / 100;
  presets.add(exact);

  // Next multiple of 5
  const next5 = Math.ceil(total / 5) * 5;
  if (next5 > total) presets.add(next5);

  // Next multiple of 10
  const next10 = Math.ceil(total / 10) * 10;
  if (next10 > total) presets.add(next10);

  // Standard Saudi Denominations
  const saudiBanknotes = [5, 10, 20, 50, 100, 200, 500];
  for (const note of saudiBanknotes) {
    if (note > total) {
      presets.add(note);
    }
  }

  // Multiples for bills larger than 500
  if (total >= 500) {
    const next100 = Math.ceil(total / 100) * 100;
    if (next100 > total) presets.add(next100);
    const next500 = Math.ceil(total / 500) * 500;
    if (next500 > total) presets.add(next500);
  }

  return Array.from(presets)
    .filter((v) => v >= total)
    .sort((a, b) => a - b)
    .slice(0, 6);
}

export default function TenderModal({
  totalAmount,
  onConfirm,
  onClose,
  loading,
}: TenderModalProps) {
  const { settings, formatCurrency } = useSettings();

  // Active customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>(DEFAULT_WALK_IN);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Inline registration state
  const [isRegistering, setIsRegistering] = useState(false);
  const [regForm, setRegForm] = useState({
    name: '',
    phone: '',
    email: '',
    creditLimit: 1000,
  });
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Payment states
  const [activeMethod, setActiveMethod] = useState<'cash' | 'card' | 'split' | 'credit'>('cash');
  const [cashAmount, setCashAmount] = useState<number>(totalAmount);
  const [cardAmount, setCardAmount] = useState<number>(0);
  const [splitDueAmount, setSplitDueAmount] = useState<number>(0);
  const [cardRef, setCardRef] = useState<string>('');

  // Refs for auto-focusing
  const cashInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initial auto-focus on the cash tender received input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (cashInputRef.current && activeMethod === 'cash') {
        cashInputRef.current.focus();
        cashInputRef.current.select();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // When switching to search view, focus search input
  useEffect(() => {
    if (isSearchingCustomer) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isSearchingCustomer]);

  // Customer search with debounce
  useEffect(() => {
    if (!isSearchingCustomer) return;
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiRequest(`/ledgers/customers?search=${encodeURIComponent(q)}`);
        if (res.success && Array.isArray(res.data)) {
          // Filter out default walk-in from search list
          setSearchResults(
            res.data.filter((c: any) => c.id !== 1).map((c: any) => ({
              ...c,
              isWalkIn: false,
            }))
          );
        }
      } catch (err) {
        console.error('Customer search failed', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, isSearchingCustomer]);

  // Quick preset values based on total
  const smartPresets = getSmartSaudiPresets(totalAmount);

  // Method switcher
  const handleSelectMethod = (m: 'cash' | 'card' | 'split' | 'credit') => {
    // Customer Due gating: only registered customers can use Customer Due
    if (m === 'credit' && selectedCustomer.isWalkIn) {
      return;
    }

    setActiveMethod(m);
    if (m === 'cash') {
      setCashAmount(totalAmount);
      setCardAmount(0);
      setSplitDueAmount(0);
      setTimeout(() => {
        cashInputRef.current?.focus();
        cashInputRef.current?.select();
      }, 50);
    } else if (m === 'card') {
      setCashAmount(0);
      setCardAmount(totalAmount);
      setSplitDueAmount(0);
    } else if (m === 'credit') {
      setCashAmount(0);
      setCardAmount(0);
      setSplitDueAmount(totalAmount);
    } else {
      // Split default: half cash, half card
      const half = Math.floor(totalAmount / 2);
      setCashAmount(half);
      setCardAmount(totalAmount - half);
      setSplitDueAmount(0);
    }
  };

  const handleQuickCash = (amt: number) => {
    setActiveMethod('cash');
    setCashAmount(amt);
    setCardAmount(0);
    setSplitDueAmount(0);
    if (cashInputRef.current) {
      cashInputRef.current.focus();
    }
  };

  // Calculations
  const numCash = Number(cashAmount || 0);
  const numCard = Number(cardAmount || 0);
  const numDue = selectedCustomer.isWalkIn ? 0 : Number(splitDueAmount || 0);

  let totalTendered = 0;
  if (activeMethod === 'cash') {
    totalTendered = numCash;
  } else if (activeMethod === 'card') {
    totalTendered = numCard;
  } else if (activeMethod === 'split') {
    totalTendered = numCash + numCard + numDue;
  } else if (activeMethod === 'credit') {
    totalTendered = totalAmount;
  }

  const changeDue = Math.max(0, (activeMethod === 'cash' ? numCash : numCash + numCard) - totalAmount);
  const remainingDue = Math.max(0, totalAmount - totalTendered);

  // Credit limit checks for registered customers
  const currentDueNum = Number(selectedCustomer.current_due || 0);
  const creditLimitNum = Number(selectedCustomer.credit_limit || 1000);
  const projectedDue =
    activeMethod === 'credit'
      ? currentDueNum + totalAmount
      : activeMethod === 'split'
      ? currentDueNum + numDue
      : currentDueNum;
  const isCreditLimitExceeded = !selectedCustomer.isWalkIn && creditLimitNum > 0 && projectedDue > creditLimitNum;

  // Validation: Can cashier submit?
  const canSubmit = () => {
    if (loading) return false;
    if (activeMethod === 'cash') {
      return numCash >= totalAmount;
    }
    if (activeMethod === 'card') {
      return numCard >= totalAmount;
    }
    if (activeMethod === 'credit') {
      return !selectedCustomer.isWalkIn && !isCreditLimitExceeded;
    }
    if (activeMethod === 'split') {
      if (selectedCustomer.isWalkIn) {
        return numCash + numCard >= totalAmount;
      }
      return numCash + numCard + numDue >= totalAmount && !isCreditLimitExceeded;
    }
    return false;
  };

  // Inline Customer Registration Submit
  const handleRegisterCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.name.trim() || !regForm.phone.trim()) {
      setRegError('Customer Name and Phone Number are required.');
      return;
    }

    setRegLoading(true);
    setRegError(null);

    try {
      const res = await apiRequest('/ledgers/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: regForm.name.trim(),
          phone: regForm.phone.trim(),
          email: regForm.email.trim() || null,
          creditLimit: Number(regForm.creditLimit || 1000),
          openingBalance: 0,
        }),
      });

      if (res.success && res.data) {
        const newCust: Customer = {
          id: res.data.id,
          name: res.data.name,
          phone: res.data.phone,
          email: res.data.email,
          current_due: 0,
          credit_limit: res.data.credit_limit || regForm.creditLimit,
          isWalkIn: false,
        };
        setSelectedCustomer(newCust);
        setIsRegistering(false);
        setIsSearchingCustomer(false);
        setRegForm({ name: '', phone: '', email: '', creditLimit: 1000 });
      } else {
        setRegError(res.message || 'Failed to register customer.');
      }
    } catch (err: any) {
      setRegError(err.message || 'Network error while registering customer.');
    } finally {
      setRegLoading(false);
    }
  };

  // Finalize Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit()) return;

    const payments: Array<{ paymentMethodId: number; amount: number; reference?: string }> = [];

    if (activeMethod === 'cash') {
      // Net cash collected into drawer
      payments.push({ paymentMethodId: 1, amount: totalAmount });
    } else if (activeMethod === 'card') {
      payments.push({ paymentMethodId: 2, amount: totalAmount, reference: cardRef || undefined });
    } else if (activeMethod === 'split') {
      if (numCash > 0) {
        payments.push({ paymentMethodId: 1, amount: numCash });
      }
      if (numCard > 0) {
        payments.push({ paymentMethodId: 2, amount: numCard, reference: cardRef || undefined });
      }
      // Customer Due balance is not a payment row; server calculates due_amount = grand_total - sum(payments)
    } else if (activeMethod === 'credit') {
      // 100% Credit sale: payments is empty [], whole amount is due_amount
    }

    onConfirm(payments, selectedCustomer.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 sm:p-4 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl my-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 transition-all duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 dark:bg-sky-600 text-white shadow-md shadow-blue-500/20">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">
                POS Payment & Split Tender
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fast Checkout & Official ZATCA Invoicing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Customer Selection Banner / Controls */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${
                    selectedCustomer.isWalkIn
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {selectedCustomer.isWalkIn ? <Users className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-slate-900 dark:text-white">
                      {selectedCustomer.name}
                    </span>
                    {selectedCustomer.isWalkIn ? (
                      <span className="rounded-md bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                        Walk-in
                      </span>
                    ) : (
                      <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 uppercase">
                        Registered Account
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-3">
                    {selectedCustomer.isWalkIn ? (
                      <span>Retail Cash/Card (Customer Due Disabled)</span>
                    ) : (
                      <>
                        <span>Tel: {selectedCustomer.phone}</span>
                        <span>
                          Current Due:{' '}
                          <strong className={Number(selectedCustomer.current_due) > 0 ? 'text-rose-600 dark:text-rose-400' : ''}>
                            {formatCurrency(Number(selectedCustomer.current_due || 0))}
                          </strong>
                        </span>
                        <span>Limit: {formatCurrency(Number(selectedCustomer.credit_limit || 0))}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                {selectedCustomer.isWalkIn ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchingCustomer(true);
                        setIsRegistering(false);
                      }}
                      className="flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm transition"
                    >
                      <Search className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" />
                      <span>Search</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegistering(true);
                        setIsSearchingCustomer(false);
                      }}
                      className="flex items-center gap-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 text-xs font-bold shadow-sm transition"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>+ Register</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchingCustomer(true);
                        setIsRegistering(false);
                      }}
                      className="flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm transition"
                    >
                      <Search className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" />
                      <span>Change</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(DEFAULT_WALK_IN);
                        if (activeMethod === 'credit') {
                          handleSelectMethod('cash');
                        }
                      }}
                      className="flex items-center gap-1 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 px-2 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition"
                      title="Reset to Walk-in Customer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Walk-in</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Inline Customer Search Panel */}
            {isSearchingCustomer && (
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search by customer name or phone number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSearchingCustomer(false);
                      setSearchQuery('');
                    }}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>

                {/* Results dropdown */}
                {isSearching ? (
                  <div className="py-3 text-center text-xs text-slate-400">Searching customers...</div>
                ) : searchResults.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {searchResults.map((cust) => (
                      <div
                        key={cust.id}
                        onClick={() => {
                          setSelectedCustomer(cust);
                          setIsSearchingCustomer(false);
                          setSearchQuery('');
                        }}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-sky-950/40 cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-sky-900 transition text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{cust.name}</div>
                          <div className="text-[11px] text-slate-500">Phone: {cust.phone || 'N/A'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            Due: {formatCurrency(Number(cust.current_due || 0))}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Limit: {formatCurrency(Number(cust.credit_limit || 1000))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : searchQuery.trim().length > 0 ? (
                  <div className="py-2.5 text-center text-xs text-slate-500">
                    No registered customers found matching "{searchQuery}".
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegistering(true);
                        setIsSearchingCustomer(false);
                        setRegForm((prev) => ({ ...prev, name: searchQuery }));
                      }}
                      className="ml-2 font-bold text-blue-600 dark:text-sky-400 hover:underline"
                    >
                      Register Profile?
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {/* Inline Customer Registration Panel */}
            {isRegistering && (
              <form
                onSubmit={handleRegisterCustomer}
                className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-blue-700 dark:text-sky-400 flex items-center gap-1.5">
                    <UserPlus className="h-4 w-4" />
                    <span>Quick Customer Account Registration</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsRegistering(false)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>

                {regError && (
                  <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium">
                    {regError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Faisal Al-Harbi"
                      value={regForm.name}
                      onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Mobile Phone Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 0501234567"
                      value={regForm.phone}
                      onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. customer@domain.sa"
                      value={regForm.email}
                      onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Credit Limit ({settings.currency_symbol || 'SAR'})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={regForm.creditLimit}
                      onChange={(e) => setRegForm({ ...regForm, creditLimit: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="submit"
                    size="sm"
                    variant="primary"
                    isLoading={regLoading}
                    className="rounded-xl text-xs"
                  >
                    Save & Select Customer
                  </Button>
                </div>
              </form>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Total Payable Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-center text-white shadow-lg shadow-blue-500/20">
              <div className="text-xs font-extrabold uppercase tracking-widest text-blue-100">
                Total Bill Payable (Inc. 15% VAT)
              </div>
              <div className="mt-1 font-mono text-3xl md:text-4xl font-black tracking-tight">
                {formatCurrency(totalAmount)}
              </div>
            </div>

            {/* Payment Method Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleSelectMethod('cash')}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl p-3 border font-bold text-xs transition ${
                  activeMethod === 'cash'
                    ? 'border-blue-600 bg-blue-600 text-white shadow-md dark:bg-sky-500 dark:text-slate-950 dark:border-sky-500'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Banknote className="h-5 w-5" />
                <span>Cash</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectMethod('card')}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl p-3 border font-bold text-xs transition ${
                  activeMethod === 'card'
                    ? 'border-blue-600 bg-blue-600 text-white shadow-md dark:bg-sky-500 dark:text-slate-950 dark:border-sky-500'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <CreditCard className="h-5 w-5" />
                <span>Mada / Card</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectMethod('split')}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl p-3 border font-bold text-xs transition ${
                  activeMethod === 'split'
                    ? 'border-blue-600 bg-blue-600 text-white shadow-md dark:bg-sky-500 dark:text-slate-950 dark:border-sky-500'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Building className="h-5 w-5" />
                <span>Split Tender</span>
              </button>

              {/* Customer Due Tab: Gated for registered customers only */}
              <button
                type="button"
                disabled={selectedCustomer.isWalkIn}
                onClick={() => handleSelectMethod('credit')}
                title={
                  selectedCustomer.isWalkIn
                    ? 'Customer Due (Credit) requires a registered customer account'
                    : 'Charge full bill to customer account'
                }
                className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl p-3 border font-bold text-xs transition ${
                  selectedCustomer.isWalkIn
                    ? 'opacity-40 cursor-not-allowed border-dashed border-slate-300 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/30 text-slate-400'
                    : activeMethod === 'credit'
                    ? 'border-amber-600 bg-amber-600 text-white shadow-md dark:bg-amber-500 dark:text-slate-950 dark:border-amber-500'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                }`}
              >
                {selectedCustomer.isWalkIn ? <Lock className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                <span>Customer Due</span>
              </button>
            </div>

            {/* Method Specific Inputs */}

            {/* 1. Cash Tender Received Field & Saudi Riyal Presets */}
            {(activeMethod === 'cash' || activeMethod === 'split') && (
              <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300">
                    Cash Tender Received ({settings.currency_symbol || 'SAR'})
                  </label>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-sky-400">
                    Auto-focused &bull; Type or click preset
                  </span>
                </div>

                <div className="relative">
                  <input
                    ref={cashInputRef}
                    type="number"
                    step="0.01"
                    min="0"
                    value={cashAmount === 0 ? '' : cashAmount}
                    onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full rounded-2xl border-2 border-blue-500/50 focus:border-blue-600 dark:border-sky-500/50 dark:focus:border-sky-400 bg-white dark:bg-slate-950 p-3.5 font-mono text-2xl font-black text-slate-900 dark:text-white focus:outline-none shadow-inner"
                  />
                  <div className="absolute right-3.5 top-4 text-xs font-black uppercase text-slate-400">
                    {settings.currency_symbol || 'SAR'}
                  </div>
                </div>

                {/* Smart Saudi Riyal note & round figure presets */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>Quick Saudi Banknotes & Round Riyals</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {smartPresets.map((amt) => {
                      const isExact = Math.abs(amt - totalAmount) < 0.01;
                      const isCurrent = Math.abs(amt - numCash) < 0.01;
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => handleQuickCash(amt)}
                          className={`rounded-xl px-3 py-1.5 font-mono text-xs font-black transition shadow-sm ${
                            isCurrent
                              ? 'bg-blue-600 dark:bg-sky-500 text-white'
                              : isExact
                              ? 'border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
                              : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:border-blue-500 dark:hover:border-sky-400'
                          }`}
                        >
                          {isExact ? `Exact (${amt})` : `${amt} SAR`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Card / Mada Inputs */}
            {(activeMethod === 'card' || activeMethod === 'split') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Card / Mada Amount ({settings.currency_symbol || 'SAR'})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cardAmount === 0 ? '' : cardAmount}
                    onChange={(e) => setCardAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 font-mono text-xl font-black text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    POS Approval Ref (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MADA-88192"
                    value={cardRef}
                    onChange={(e) => setCardRef(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-xs font-semibold text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* 3. Customer Due Details (when 100% credit) */}
            {activeMethod === 'credit' && (
              <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                <div className="font-extrabold flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <span>Customer Account Ledger Credit Sale</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Full balance of <strong>{formatCurrency(totalAmount)}</strong> will be charged to the customer ledger of{' '}
                  <span className="font-black text-slate-950 dark:text-white underline">{selectedCustomer.name}</span>.
                </p>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-200/60 dark:border-amber-900/60 font-mono text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-amber-700 dark:text-amber-400 block font-sans">
                      Current Due:
                    </span>
                    <span className="font-black">{formatCurrency(currentDueNum)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-amber-700 dark:text-amber-400 block font-sans">
                      New Due After Sale:
                    </span>
                    <span
                      className={`font-black ${
                        isCreditLimitExceeded ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {formatCurrency(projectedDue)}
                    </span>
                  </div>
                </div>

                {isCreditLimitExceeded && (
                  <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 font-bold pt-1">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>Warning: This sale will exceed customer credit limit of {formatCurrency(creditLimitNum)}!</span>
                  </div>
                )}
              </div>
            )}

            {/* 4. Split Mode Customer Due Allocation (if registered customer) */}
            {activeMethod === 'split' && !selectedCustomer.isWalkIn && remainingDue > 0 && (
              <div className="rounded-2xl border border-blue-200 dark:border-sky-900 bg-blue-50/50 dark:bg-sky-950/30 p-3.5 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-blue-900 dark:text-sky-200">
                    Remaining Unpaid: {formatCurrency(remainingDue)}
                  </div>
                  <div className="text-[11px] text-blue-700 dark:text-sky-300">
                    Can allocate remainder to {selectedCustomer.name}'s customer due.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSplitDueAmount(remainingDue)}
                  className="shrink-0 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-xs font-bold shadow-sm transition"
                >
                  Allocate to Due
                </button>
              </div>
            )}

            {/* Real-time Change or Balance Indicator */}
            <div className="grid grid-cols-2 gap-3">
              <div
                className={`rounded-2xl p-3.5 text-center border transition-all ${
                  changeDue > 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800'
                    : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="text-[11px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300 tracking-wider">
                  Change Return
                </div>
                <div className="font-mono text-2xl md:text-3xl font-black text-emerald-950 dark:text-emerald-200 mt-0.5">
                  {formatCurrency(changeDue)}
                </div>
              </div>

              <div
                className={`rounded-2xl p-3.5 text-center border transition-all ${
                  remainingDue > 0
                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800'
                    : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="text-[11px] font-extrabold uppercase text-amber-800 dark:text-amber-300 tracking-wider">
                  Balance Due
                </div>
                <div className="font-mono text-2xl md:text-3xl font-black text-amber-950 dark:text-amber-200 mt-0.5">
                  {formatCurrency(remainingDue)}
                </div>
              </div>
            </div>

            {/* Walk-in warning if tendered is less than total */}
            {selectedCustomer.isWalkIn && remainingDue > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-2.5 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Walk-in Customer cannot have unpaid due balance. Full payment required.</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="w-1/3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 py-3.5 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition uppercase tracking-wider"
              >
                Cancel
              </button>

              <Button
                type="submit"
                disabled={!canSubmit()}
                isLoading={loading}
                variant="success"
                size="pos"
                className="w-2/3 rounded-2xl shadow-lg shadow-emerald-500/20"
                rightIcon={<ArrowRight className="h-5 w-5" />}
              >
                {loading
                  ? 'Finalizing...'
                  : `Commit Sale (${formatCurrency(totalAmount)})`}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
