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
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  current_due?: number | string;
  credit_limit?: number | string;
  isWalkIn?: boolean;
}

export const DEFAULT_WALK_IN: Customer = {
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
  initialCustomer?: Customer;
  onCustomerChange?: (customer: Customer) => void;
  onConfirm: (
    payments: Array<{ paymentMethodId: number; amount: number; reference?: string }>,
    customerId?: number,
    customer?: Customer
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

  // Standard Saudi Banknotes
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
  initialCustomer,
  onCustomerChange,
  onConfirm,
  onClose,
  loading,
}: TenderModalProps) {
  const { settings, formatCurrency, fontSizeScale } = useSettings();

  // Active customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>(initialCustomer || DEFAULT_WALK_IN);

  useEffect(() => {
    if (initialCustomer) {
      setSelectedCustomer(initialCustomer);
    }
  }, [initialCustomer]);
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
  const cardInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initial auto-focus on cash tender received input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (cashInputRef.current && (activeMethod === 'cash' || activeMethod === 'split')) {
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
      setTimeout(() => {
        cardInputRef.current?.focus();
        cardInputRef.current?.select();
      }, 50);
    } else if (m === 'credit') {
      setCashAmount(0);
      setCardAmount(0);
      setSplitDueAmount(totalAmount);
    } else {
      // Split mode: Keep existing cashAmount if already specified, fill remainder to card
      const currentCash = Number(cashAmount || 0);
      if (currentCash > 0 && currentCash < totalAmount) {
        setCardAmount(Math.round((totalAmount - currentCash) * 100) / 100);
      } else {
        const half = Math.round((totalAmount / 2) * 100) / 100;
        setCashAmount(half);
        setCardAmount(Math.round((totalAmount - half) * 100) / 100);
      }
      setSplitDueAmount(0);
      setTimeout(() => {
        cashInputRef.current?.focus();
        cashInputRef.current?.select();
      }, 50);
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

  const changeDue =
    activeMethod === 'cash'
      ? Math.max(0, Math.round((numCash - totalAmount) * 100) / 100)
      : activeMethod === 'split'
      ? Math.max(0, Math.round((numCash + numCard - totalAmount) * 100) / 100)
      : 0;

  const roundedTotal = Math.round(totalAmount * 100) / 100;
  const remainingDue = Math.max(0, Math.round((roundedTotal - totalTendered) * 100) / 100);

  // Credit limit checks for registered customers
  const currentDueNum = Number(selectedCustomer.current_due || 0);
  const creditLimitNum = Number(selectedCustomer.credit_limit || 1000);
  const projectedDue =
    activeMethod === 'credit'
      ? currentDueNum + roundedTotal
      : activeMethod === 'split'
      ? currentDueNum + numDue
      : currentDueNum;
  const isCreditLimitExceeded =
    !selectedCustomer.isWalkIn && creditLimitNum > 0 && projectedDue > creditLimitNum;

  // Validation: Can cashier submit?
  const canSubmit = () => {
    if (loading) return false;
    if (activeMethod === 'cash') {
      return numCash >= roundedTotal - 0.01;
    }
    if (activeMethod === 'card') {
      return numCard >= roundedTotal - 0.01;
    }
    if (activeMethod === 'credit') {
      return !selectedCustomer.isWalkIn && !isCreditLimitExceeded;
    }
    if (activeMethod === 'split') {
      if (selectedCustomer.isWalkIn) {
        return numCash + numCard >= roundedTotal - 0.01;
      }
      return numCash + numCard + numDue >= roundedTotal - 0.01 && !isCreditLimitExceeded;
    }
    return false;
  };

  // Keyboard shortcut handler (Enter to commit, Esc to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSearchingCustomer) {
          setIsSearchingCustomer(false);
        } else if (isRegistering) {
          setIsRegistering(false);
        } else {
          onClose();
        }
      } else if (e.key === 'Enter' && !isSearchingCustomer && !isRegistering) {
        if (canSubmit() && !loading) {
          e.preventDefault();
          executeCommit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    canSubmit,
    loading,
    isSearchingCustomer,
    isRegistering,
    activeMethod,
    numCash,
    numCard,
    selectedCustomer,
  ]);

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
        onCustomerChange?.(newCust);
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
  const executeCommit = () => {
    if (!canSubmit()) return;

    const payments: Array<{ paymentMethodId: number; amount: number; reference?: string }> = [];

    if (activeMethod === 'cash') {
      payments.push({ paymentMethodId: 1, amount: numCash });
    } else if (activeMethod === 'card') {
      payments.push({ paymentMethodId: 2, amount: roundedTotal, reference: cardRef || undefined });
    } else if (activeMethod === 'split') {
      if (numCash > 0) {
        payments.push({ paymentMethodId: 1, amount: numCash });
      }
      if (numCard > 0) {
        payments.push({ paymentMethodId: 2, amount: numCard, reference: cardRef || undefined });
      }
    } else if (activeMethod === 'credit') {
      // 100% Credit sale: payments is empty [], whole amount is due_amount
    }

    onConfirm(payments, selectedCustomer.id, selectedCustomer);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeCommit();
  };

  // Helper to quickly fill remainder to card in split mode
  const handleFillCardRemainder = () => {
    const remainder = Math.max(0, Math.round((totalAmount - numCash) * 100) / 100);
    setCardAmount(remainder);
    setSplitDueAmount(0);
  };

  // Helper to quickly fill remainder to cash in split mode
  const handleFillCashRemainder = () => {
    const remainder = Math.max(0, Math.round((totalAmount - numCard) * 100) / 100);
    setCashAmount(remainder);
    setSplitDueAmount(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-2.5 sm:p-4 backdrop-blur-md overflow-y-auto">
      <div
        className="relative w-full max-w-lg my-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 transition-all duration-200"
        style={{ zoom: fontSizeScale === '110%' || fontSizeScale === '1.1' ? 1.05 : 1 }}
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50/80 dark:bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 dark:bg-sky-500 text-white shadow-sm">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
                Payment & Split Tender
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                POS Settlement &bull; Press Enter to Commit
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          {/* Customer Selection Banner */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/60 p-2.5 transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                    selectedCustomer.isWalkIn
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {selectedCustomer.isWalkIn ? <Users className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black uppercase text-slate-900 dark:text-white truncate">
                      {selectedCustomer.name}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[9px] font-extrabold uppercase ${
                        selectedCustomer.isWalkIn
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {selectedCustomer.isWalkIn ? 'Walk-in' : 'Account'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {selectedCustomer.isWalkIn ? (
                      'Retail Walk-in (Customer Due Disabled)'
                    ) : (
                      <span>
                        Due: {formatCurrency(Number(selectedCustomer.current_due || 0))} &bull; Limit:{' '}
                        {formatCurrency(Number(selectedCustomer.credit_limit || 0))}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {selectedCustomer.isWalkIn ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchingCustomer(true);
                        setIsRegistering(false);
                      }}
                      className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs transition"
                    >
                      <Search className="h-3 w-3 text-blue-600 dark:text-sky-400" />
                      <span>Search</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegistering(true);
                        setIsSearchingCustomer(false);
                      }}
                      className="flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-500 dark:bg-sky-600 text-white px-2 py-1 text-[11px] font-bold shadow-xs transition"
                    >
                      <UserPlus className="h-3 w-3" />
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
                      className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs transition"
                    >
                      <Search className="h-3 w-3 text-blue-600 dark:text-sky-400" />
                      <span>Change</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(DEFAULT_WALK_IN);
                        onCustomerChange?.(DEFAULT_WALK_IN);
                        if (activeMethod === 'credit') {
                          handleSelectMethod('cash');
                        }
                      }}
                      className="flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 px-2 py-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition"
                      title="Reset to Walk-in Customer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Walk-in</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Inline Customer Search Panel */}
            {isSearchingCustomer && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search customer by name or phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-600 dark:focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSearchingCustomer(false);
                      setSearchQuery('');
                    }}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>

                {/* Results dropdown */}
                {isSearching ? (
                  <div className="py-2 text-center text-xs text-slate-400">Searching customers...</div>
                ) : searchResults.length > 0 ? (
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {searchResults.map((cust) => (
                      <div
                        key={cust.id}
                        onClick={() => {
                          setSelectedCustomer(cust);
                          onCustomerChange?.(cust);
                          setIsSearchingCustomer(false);
                          setSearchQuery('');
                        }}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-sky-950/40 cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-sky-800 transition text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{cust.name}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            Phone: {cust.phone || 'N/A'}
                          </div>
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
                  <div className="py-2 text-center text-xs text-slate-500">
                    No customers found.
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegistering(true);
                        setIsSearchingCustomer(false);
                        setRegForm((prev) => ({ ...prev, name: searchQuery }));
                      }}
                      className="ml-1.5 font-bold text-blue-600 dark:text-sky-400 hover:underline"
                    >
                      Register New?
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {/* Inline Customer Registration Panel */}
            {isRegistering && (
              <form
                onSubmit={handleRegisterCustomer}
                className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-blue-700 dark:text-sky-400 flex items-center gap-1">
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Quick Customer Registration</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsRegistering(false)}
                    className="text-[11px] font-bold text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>

                {regError && (
                  <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-[11px] font-medium">
                    {regError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Faisal Al-Harbi"
                      value={regForm.name}
                      onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-900 dark:text-white focus:border-blue-600 dark:focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">
                      Mobile *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="0501234567"
                      value={regForm.phone}
                      onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-900 dark:text-white focus:border-blue-600 dark:focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-1.5 pt-1">
                  <Button
                    type="submit"
                    size="sm"
                    variant="primary"
                    isLoading={regLoading}
                    className="rounded-xl text-xs py-1 px-3"
                  >
                    Save & Select
                  </Button>
                </div>
              </form>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Compact Total Payable Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 dark:from-sky-600 dark:via-blue-700 dark:to-indigo-800 px-4 py-2.5 text-center text-white shadow-md shadow-blue-500/15">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-blue-100">
                Total Payable (Inc. 15% VAT)
              </div>
              <div className="font-mono text-2xl sm:text-3xl font-black tracking-tight mt-0.5">
                {formatCurrency(totalAmount)}
              </div>
            </div>

            {/* Payment Method 4-Tab Bar */}
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectMethod('cash')}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 border font-bold text-xs transition ${
                  activeMethod === 'cash'
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm dark:bg-sky-500 dark:text-slate-950 dark:border-sky-500'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Banknote className="h-4 w-4" />
                <span className="text-[11px]">Cash</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectMethod('card')}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 border font-bold text-xs transition ${
                  activeMethod === 'card'
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm dark:bg-sky-500 dark:text-slate-950 dark:border-sky-500'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <CreditCard className="h-4 w-4" />
                <span className="text-[11px]">Mada / Card</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectMethod('split')}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 border font-bold text-xs transition ${
                  activeMethod === 'split'
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm dark:bg-sky-500 dark:text-slate-950 dark:border-sky-500'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Building className="h-4 w-4" />
                <span className="text-[11px]">Split Tender</span>
              </button>

              <button
                type="button"
                disabled={selectedCustomer.isWalkIn}
                onClick={() => handleSelectMethod('credit')}
                title={
                  selectedCustomer.isWalkIn
                    ? 'Customer Due requires a registered customer account'
                    : 'Charge full bill to customer account'
                }
                className={`relative flex flex-col items-center justify-center gap-1 rounded-xl p-2 border font-bold text-xs transition ${
                  selectedCustomer.isWalkIn
                    ? 'opacity-40 cursor-not-allowed border-dashed border-slate-300 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/30 text-slate-400'
                    : activeMethod === 'credit'
                    ? 'border-amber-600 bg-amber-600 text-white shadow-sm dark:bg-amber-500 dark:text-slate-950 dark:border-amber-500'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                }`}
              >
                {selectedCustomer.isWalkIn ? <Lock className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                <span className="text-[11px]">Customer Due</span>
              </button>
            </div>

            {/* Method Specific Panels */}

            {/* 1. Cash Only Mode */}
            {activeMethod === 'cash' && (
              <div className="space-y-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">
                    Cash Received ({settings.currency_symbol || 'SAR'})
                  </label>
                  <span className="text-[10px] font-bold text-blue-600 dark:text-sky-400">
                    Auto-focused &bull; Type amount or click banknote
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
                    className="w-full rounded-xl border-2 border-blue-500/60 focus:border-blue-600 dark:border-sky-500/60 dark:focus:border-sky-400 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-xl font-black text-slate-900 dark:text-white focus:outline-none shadow-xs"
                  />
                  <div className="absolute right-3 top-2.5 text-xs font-black uppercase text-slate-400">
                    {settings.currency_symbol || 'SAR'}
                  </div>
                </div>

                {/* Smart Saudi Riyal note presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase mr-1">Banknotes:</span>
                  {smartPresets.map((amt) => {
                    const isExact = Math.abs(amt - totalAmount) < 0.01;
                    const isCurrent = Math.abs(amt - numCash) < 0.01;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleQuickCash(amt)}
                        className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-black transition shadow-xs ${
                          isCurrent
                            ? 'bg-blue-600 dark:bg-sky-500 text-white'
                            : isExact
                            ? 'border border-emerald-500 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
                            : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:border-blue-500 dark:hover:border-sky-400'
                        }`}
                      >
                        {isExact ? `Exact (${amt})` : `${amt}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Card Only Mode */}
            {activeMethod === 'card' && (
              <div className="space-y-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Mada / Card Amount ({settings.currency_symbol || 'SAR'})
                    </label>
                    <input
                      ref={cardInputRef}
                      type="number"
                      step="0.01"
                      min="0"
                      value={cardAmount === 0 ? '' : cardAmount}
                      onChange={(e) => setCardAmount(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-lg font-black text-slate-900 dark:text-white focus:border-blue-600 dark:focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      POS Approval Ref (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MADA-88192"
                      value={cardRef}
                      onChange={(e) => setCardRef(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:border-blue-600 dark:focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>Full {formatCurrency(totalAmount)} will be routed to electronic card payment.</span>
                </div>
              </div>
            )}

            {/* 3. Split Tender Mode (Premium & Compact Two-Column Layout) */}
            {activeMethod === 'split' && (
              <div className="space-y-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3">
                {/* Visual Split Distribution Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
                    <span>Cash: {formatCurrency(numCash)}</span>
                    <span>Card: {formatCurrency(numCard)}</span>
                    {!selectedCustomer.isWalkIn && numDue > 0 && (
                      <span>Due: {formatCurrency(numDue)}</span>
                    )}
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                    <div
                      style={{ width: `${Math.min(100, (numCash / totalAmount) * 100)}%` }}
                      className="bg-emerald-500 transition-all duration-300"
                    />
                    <div
                      style={{ width: `${Math.min(100, (numCard / totalAmount) * 100)}%` }}
                      className="bg-blue-600 dark:bg-sky-500 transition-all duration-300"
                    />
                    {!selectedCustomer.isWalkIn && (
                      <div
                        style={{ width: `${Math.min(100, (numDue / totalAmount) * 100)}%` }}
                        className="bg-amber-500 transition-all duration-300"
                      />
                    )}
                  </div>
                </div>

                {/* 2-Column Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Cash Split Field */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <Banknote className="h-3.5 w-3.5" />
                        <span>Cash Amount</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleFillCashRemainder}
                        className="text-[10px] font-bold text-blue-600 dark:text-sky-400 hover:underline"
                      >
                        Fill Remainder
                      </button>
                    </div>
                    <input
                      ref={cashInputRef}
                      type="number"
                      step="0.01"
                      min="0"
                      value={cashAmount === 0 ? '' : cashAmount}
                      onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono text-base font-black text-slate-900 dark:text-white focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Card Split Field */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase text-blue-700 dark:text-sky-400 flex items-center gap-1">
                        <CreditCard className="h-3.5 w-3.5" />
                        <span>Mada / Card Amount</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleFillCardRemainder}
                        className="text-[10px] font-bold text-blue-600 dark:text-sky-400 hover:underline"
                      >
                        Fill Remainder
                      </button>
                    </div>
                    <input
                      ref={cardInputRef}
                      type="number"
                      step="0.01"
                      min="0"
                      value={cardAmount === 0 ? '' : cardAmount}
                      onChange={(e) => setCardAmount(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono text-base font-black text-slate-900 dark:text-white focus:border-blue-600 dark:focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Optional Card Ref & Due Allocation */}
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-0.5">
                  <input
                    type="text"
                    placeholder="POS Approval Ref (Optional)"
                    value={cardRef}
                    onChange={(e) => setCardRef(e.target.value)}
                    className="w-full sm:w-1/2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                  />
                  {!selectedCustomer.isWalkIn && remainingDue > 0 && (
                    <button
                      type="button"
                      onClick={() => setSplitDueAmount(remainingDue)}
                      className="w-full sm:w-1/2 flex items-center justify-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 text-xs font-bold shadow-xs transition"
                    >
                      <Users className="h-3 w-3" />
                      <span>Allocate {formatCurrency(remainingDue)} to Due</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 4. Customer Due Details (when 100% credit) */}
            {activeMethod === 'credit' && (
              <div className="rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 p-3 border border-amber-200 dark:border-amber-900/80 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                <div className="font-extrabold flex items-center gap-1.5 text-xs">
                  <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span>Customer Ledger Credit Sale</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Entire amount of <strong>{formatCurrency(totalAmount)}</strong> will be booked to the customer ledger of{' '}
                  <span className="font-black text-slate-900 dark:text-white underline">{selectedCustomer.name}</span>.
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-amber-200/60 dark:border-amber-900/60 font-mono text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-amber-700 dark:text-amber-400 block font-sans">
                      Current Due:
                    </span>
                    <span className="font-black">{formatCurrency(currentDueNum)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-amber-700 dark:text-amber-400 block font-sans">
                      New Due:
                    </span>
                    <span
                      className={`font-black ${
                        isCreditLimitExceeded
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {formatCurrency(projectedDue)}
                    </span>
                  </div>
                </div>

                {isCreditLimitExceeded && (
                  <div className="flex items-center gap-1 text-rose-700 dark:text-rose-300 font-bold pt-0.5 text-[11px]">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                    <span>Exceeds customer credit limit of {formatCurrency(creditLimitNum)}!</span>
                  </div>
                )}
              </div>
            )}

            {/* Real-time Change or Balance Indicator */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Change Return */}
              <div
                className={`rounded-2xl p-2.5 text-center border transition-all ${
                  changeDue > 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800'
                    : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="text-[10px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300 tracking-wider">
                  Change Return
                </div>
                <div className="font-mono text-xl sm:text-2xl font-black text-emerald-950 dark:text-emerald-200 mt-0.5">
                  {formatCurrency(changeDue)}
                </div>
              </div>

              {/* Balance Due */}
              <div
                className={`rounded-2xl p-2.5 text-center border transition-all ${
                  remainingDue > 0
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800'
                    : 'bg-emerald-50/50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60'
                }`}
              >
                <div
                  className={`text-[10px] font-extrabold uppercase tracking-wider ${
                    remainingDue > 0.01
                      ? 'text-amber-800 dark:text-amber-300'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {remainingDue > 0.01 ? 'Remaining Due' : 'Payment Status'}
                </div>
                <div
                  className={`font-mono text-xl sm:text-2xl font-black mt-0.5 ${
                    remainingDue > 0.01
                      ? 'text-amber-950 dark:text-amber-200'
                      : 'text-emerald-700 dark:text-emerald-300 text-sm sm:text-base flex items-center justify-center gap-1 pt-1'
                  }`}
                >
                  {remainingDue > 0.01 ? (
                    formatCurrency(remainingDue)
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span>PAID IN FULL</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Walk-in warning if tendered is less than total */}
            {selectedCustomer.isWalkIn && remainingDue > 0.01 && (
              <div className="flex items-center gap-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-2 border border-rose-200 dark:border-rose-900 text-[11px] text-rose-700 dark:text-rose-300 font-medium">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>Walk-in Customer requires full payment ({formatCurrency(remainingDue)} remaining).</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="w-1/3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 py-3 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition uppercase tracking-wider"
              >
                Cancel (Esc)
              </button>

              <button
                type="submit"
                disabled={!canSubmit()}
                className={`w-2/3 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-black text-white uppercase tracking-wider shadow-md transition ${
                  canSubmit()
                    ? 'bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] cursor-pointer shadow-emerald-700/20'
                    : 'bg-slate-400 dark:bg-slate-700 opacity-60 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <Zap className="h-4 w-4 fill-current text-amber-300" />
                    <span>Commit Sale ({formatCurrency(totalAmount)})</span>
                    <span className="rounded bg-black/25 px-1.5 py-0.2 font-mono text-[10px] font-black ms-1">
                      Enter
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
