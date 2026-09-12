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

export interface QuickPreset {
  amount: number;
  type: 'less' | 'exact' | 'large';
}

/**
 * Generates 3 clean, proportional amounts strictly less than the exact total
 */
function get3LessAmounts(exact: number): number[] {
  if (exact <= 1) return [0.25, 0.5, 0.75];

  let step = 1;
  if (exact >= 1000) step = 100;
  else if (exact >= 200) step = 50;
  else if (exact >= 50) step = 10;
  else if (exact >= 10) step = 5;
  else if (exact >= 3) step = 1;
  else step = 0.25;

  const raw25 = Math.round((exact * 0.25) / step) * step;
  const raw50 = Math.round((exact * 0.5) / step) * step;
  const raw75 = Math.round((exact * 0.75) / step) * step;

  const candidates = new Set<number>();
  if (raw25 > 0 && raw25 < exact) candidates.add(raw25);
  if (raw50 > 0 && raw50 < exact) candidates.add(raw50);
  if (raw75 > 0 && raw75 < exact) candidates.add(raw75);

  const saudiBanknotes = [5, 10, 20, 50, 100, 200, 500];
  for (const n of saudiBanknotes) {
    if (n < exact) candidates.add(n);
  }

  const sorted = Array.from(candidates).filter((n) => n < exact && n > 0).sort((a, b) => a - b);

  if (sorted.length >= 3) {
    const idx1 = Math.min(sorted.length - 3, Math.floor(sorted.length * 0.25));
    const idx2 = Math.min(sorted.length - 2, Math.max(idx1 + 1, Math.floor(sorted.length * 0.6)));
    const idx3 = sorted.length - 1;
    return [sorted[idx1], sorted[idx2], sorted[idx3]];
  }

  const v3 = Math.max(0.01, Math.round(exact * 0.75 * 100) / 100);
  const v2 = Math.max(0.01, Math.round(exact * 0.5 * 100) / 100);
  const v1 = Math.max(0.01, Math.round(exact * 0.25 * 100) / 100);
  return [v1, v2, v3];
}

/**
 * Generates 4 clean, ascending amounts strictly greater than the exact total
 */
function get4LargeAmounts(exact: number): number[] {
  const presets = new Set<number>();
  const saudiBanknotes = [5, 10, 20, 50, 100, 200, 500];

  for (const note of saudiBanknotes) {
    if (note > exact) presets.add(note);
  }

  if (exact < 50) {
    const next5 = Math.ceil((exact + 0.01) / 5) * 5;
    if (next5 > exact) presets.add(next5);
    const next10 = Math.ceil((exact + 0.01) / 10) * 10;
    if (next10 > exact) presets.add(next10);
    const next20 = Math.ceil((exact + 0.01) / 20) * 20;
    if (next20 > exact) presets.add(next20);
    const next50 = Math.ceil((exact + 0.01) / 50) * 50;
    if (next50 > exact) presets.add(next50);
  } else if (exact < 100) {
    const next10 = Math.ceil((exact + 0.01) / 10) * 10;
    if (next10 > exact) presets.add(next10);
    const next50 = Math.ceil((exact + 0.01) / 50) * 50;
    if (next50 > exact) presets.add(next50);
    const next100 = Math.ceil((exact + 0.01) / 100) * 100;
    if (next100 > exact) presets.add(next100);
  } else if (exact < 500) {
    const next50 = Math.ceil((exact + 0.01) / 50) * 50;
    if (next50 > exact) presets.add(next50);
    const next100 = Math.ceil((exact + 0.01) / 100) * 100;
    if (next100 > exact) presets.add(next100);
    const next200 = Math.ceil((exact + 0.01) / 200) * 200;
    if (next200 > exact) presets.add(next200);
    const next500 = Math.ceil((exact + 0.01) / 500) * 500;
    if (next500 > exact) presets.add(next500);
  } else {
    const next100 = Math.ceil((exact + 0.01) / 100) * 100;
    if (next100 > exact) presets.add(next100);
    const next500 = Math.ceil((exact + 0.01) / 500) * 500;
    if (next500 > exact) presets.add(next500);
    const next1000 = Math.ceil((exact + 0.01) / 1000) * 1000;
    if (next1000 > exact) presets.add(next1000);
  }

  const sortedHigher = Array.from(presets)
    .filter((v) => v > exact)
    .sort((a, b) => a - b);

  const additional: number[] = [];
  for (const v of sortedHigher) {
    if (!additional.includes(v)) {
      additional.push(v);
      if (additional.length === 4) break;
    }
  }

  let step = exact >= 500 ? 500 : exact >= 100 ? 100 : exact >= 20 ? 50 : 10;
  let candidate = (additional.length > 0 ? additional[additional.length - 1] : Math.ceil(exact)) + step;
  while (additional.length < 4) {
    candidate = Math.ceil(candidate / step) * step;
    if (!additional.includes(candidate) && candidate > exact) {
      additional.push(candidate);
    }
    candidate += step;
  }

  return additional.slice(0, 4);
}

/**
 * Smart Saudi Riyal note & round-figure presets generator
 * Guarantees exactly 8 presets: 3 less, 1 exact, and 4 large
 */
function getSmart8Presets(total: number): QuickPreset[] {
  if (total <= 0) {
    return [
      { amount: 1, type: 'less' },
      { amount: 2, type: 'less' },
      { amount: 5, type: 'less' },
      { amount: 10, type: 'exact' },
      { amount: 20, type: 'large' },
      { amount: 50, type: 'large' },
      { amount: 100, type: 'large' },
      { amount: 200, type: 'large' },
    ];
  }
  const exact = Math.round(total * 100) / 100;
  const less = get3LessAmounts(exact);
  const large = get4LargeAmounts(exact);

  return [
    ...less.map((amt) => ({ amount: amt, type: 'less' as const })),
    { amount: exact, type: 'exact' as const },
    ...large.map((amt) => ({ amount: amt, type: 'large' as const })),
  ];
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

  // Payment states - initialized from manager setting (default: card)
  const defaultMethod = (settings.pos_default_payment_method as 'cash' | 'card' | 'split') || 'card';
  const [activeMethod, setActiveMethod] = useState<'cash' | 'card' | 'split' | 'credit'>(defaultMethod);
  const [cashAmount, setCashAmount] = useState<number>(() => {
    if (defaultMethod === 'card') return 0;
    if (defaultMethod === 'split') return Math.round((totalAmount / 2) * 100) / 100;
    return totalAmount;
  });
  const [cardAmount, setCardAmount] = useState<number>(() => {
    if (defaultMethod === 'card') return totalAmount;
    if (defaultMethod === 'split') {
      const half = Math.round((totalAmount / 2) * 100) / 100;
      return Math.round((totalAmount - half) * 100) / 100;
    }
    return 0;
  });

  // Refs for auto-focusing
  const cashInputRef = useRef<HTMLInputElement>(null);
  const cardInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Synchronize payment method from settings and amount on mount or settings change
  useEffect(() => {
    const def = (settings.pos_default_payment_method as 'cash' | 'card' | 'split') || 'card';
    setActiveMethod(def);
    if (def === 'card') {
      setCashAmount(0);
      setCardAmount(totalAmount);
    } else if (def === 'cash') {
      setCashAmount(totalAmount);
      setCardAmount(0);
    } else if (def === 'split') {
      const half = Math.round((totalAmount / 2) * 100) / 100;
      setCashAmount(half);
      setCardAmount(Math.round((totalAmount - half) * 100) / 100);
    }
  }, [settings.pos_default_payment_method, totalAmount]);

  // Auto-focus input when activeMethod changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeMethod === 'card' && cardInputRef.current) {
        cardInputRef.current.focus();
        cardInputRef.current.select();
      } else if (cashInputRef.current && (activeMethod === 'cash' || activeMethod === 'split')) {
        cashInputRef.current.focus();
        cashInputRef.current.select();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [activeMethod]);

  // When switching to search view, focus search input
  useEffect(() => {
    if (isSearchingCustomer) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isSearchingCustomer]);

  // Customer search with debounce & initial load
  useEffect(() => {
    if (!isSearchingCustomer) return;
    const q = searchQuery.trim();

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const url = q ? `/ledgers/customers?search=${encodeURIComponent(q)}` : `/ledgers/customers`;
        const res = await apiRequest(url);
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
    }, q ? 200 : 0);

    return () => clearTimeout(timer);
  }, [searchQuery, isSearchingCustomer]);

  // Quick preset values based on total (3 less, 1 exact, 4 large)
  const smartPresets = getSmart8Presets(totalAmount);

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
      setTimeout(() => {
        cashInputRef.current?.focus();
        cashInputRef.current?.select();
      }, 50);
    } else if (m === 'card') {
      setCashAmount(0);
      setCardAmount(totalAmount);
      setTimeout(() => {
        cardInputRef.current?.focus();
        cardInputRef.current?.select();
      }, 50);
    } else if (m === 'credit') {
      setCashAmount(0);
      setCardAmount(0);
    } else {
      // Split mode: always 50/50 default
      const half = Math.round((totalAmount / 2) * 100) / 100;
      setCashAmount(half);
      setCardAmount(Math.round((totalAmount - half) * 100) / 100);
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
    if (cashInputRef.current) {
      cashInputRef.current.focus();
    }
  };

  const handleQuickCard = (amt: number) => {
    setActiveMethod('card');
    setCardAmount(amt);
    setCashAmount(0);
    if (cardInputRef.current) {
      cardInputRef.current.focus();
    }
  };

  // Synchronized Split mode adjustments (maintain full payment policy at all times)
  const handleSplitCashChange = (val: number) => {
    setCashAmount(val);
    const remainder = Math.max(0, Math.round((totalAmount - val) * 100) / 100);
    setCardAmount(remainder);
  };

  const handleSplitCardChange = (val: number) => {
    setCardAmount(val);
    const remainder = Math.max(0, Math.round((totalAmount - val) * 100) / 100);
    setCashAmount(remainder);
  };

  // Calculations
  const numCash = Number(cashAmount || 0);
  const numCard = Number(cardAmount || 0);

  let totalTendered = 0;
  if (activeMethod === 'cash') {
    totalTendered = numCash;
  } else if (activeMethod === 'card') {
    totalTendered = numCard;
  } else if (activeMethod === 'split') {
    totalTendered = numCash + numCard;
  } else if (activeMethod === 'credit') {
    // In 100% credit (Customer Due), customer pays 0 upfront; full bill is due
    totalTendered = 0;
  }

  const changeDue =
    activeMethod === 'cash'
      ? Math.max(0, Math.round((numCash - totalAmount) * 100) / 100)
      : activeMethod === 'card'
      ? Math.max(0, Math.round((numCard - totalAmount) * 100) / 100)
      : activeMethod === 'split'
      ? Math.max(0, Math.round((numCash + numCard - totalAmount) * 100) / 100)
      : 0;

  const roundedTotal = Math.round(totalAmount * 100) / 100;
  const remainingDue =
    activeMethod === 'credit'
      ? roundedTotal
      : Math.max(0, Math.round((roundedTotal - totalTendered) * 100) / 100);

  // Credit limit checks for registered customers (remaining due booked to customer ledger)
  const currentDueNum = Number(selectedCustomer.current_due || 0);
  const creditLimitNum = Number(selectedCustomer.credit_limit || 1000);
  const dueToBook = !selectedCustomer.isWalkIn ? remainingDue : 0;
  const projectedDue = currentDueNum + dueToBook;
  const isCreditLimitExceeded =
    !selectedCustomer.isWalkIn && creditLimitNum > 0 && projectedDue > creditLimitNum;

  // Validation: Can cashier submit?
  const canSubmit = () => {
    if (loading) return false;
    if (activeMethod === 'cash') {
      if (selectedCustomer.isWalkIn) {
        return numCash >= roundedTotal - 0.01;
      }
      // Registered customer: partial payment allowed, remaining booked to due
      return numCash >= 0 && !isCreditLimitExceeded;
    }
    if (activeMethod === 'card') {
      if (selectedCustomer.isWalkIn) {
        return numCard >= roundedTotal - 0.01;
      }
      // Registered customer: partial payment allowed, remaining booked to due
      return numCard >= 0 && !isCreditLimitExceeded;
    }
    if (activeMethod === 'credit') {
      return !selectedCustomer.isWalkIn && !isCreditLimitExceeded;
    }
    if (activeMethod === 'split') {
      // Split method requires 100% full payment for BOTH walk-in and registered customers
      return Math.abs(numCash + numCard - roundedTotal) <= 0.02;
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
      if (numCash > 0) {
        payments.push({ paymentMethodId: 1, amount: numCash });
      }
    } else if (activeMethod === 'card') {
      if (numCard > 0) {
        payments.push({ paymentMethodId: 2, amount: numCard });
      }
    } else if (activeMethod === 'split') {
      if (numCash > 0) {
        payments.push({ paymentMethodId: 1, amount: numCash });
      }
      if (numCard > 0) {
        payments.push({ paymentMethodId: 2, amount: numCard });
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

            {/* Inline Customer Registration Panel */}
            {isRegistering && (
              <form
                onSubmit={handleRegisterCustomer}
                className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-3"
              >
                {regError && (
                  <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-[11px] font-medium">
                    {regError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Faisal Al-Harbi"
                      value={regForm.name}
                      onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:border-blue-600 dark:focus:border-sky-500 focus:outline-none h-10 shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Mobile *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="0501234567"
                      value={regForm.phone}
                      onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:border-blue-600 dark:focus:border-sky-500 focus:outline-none h-10 shadow-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsRegistering(false)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    size="sm"
                    variant="primary"
                    isLoading={regLoading}
                    className="rounded-xl text-xs py-1.5 px-4"
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
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3 space-y-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">
                      Cash Received ({settings.currency_symbol || 'SAR'})
                    </label>
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
                </div>

                {/* Quick Presets: 3 less, 1 exact, 4 large */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {smartPresets.map((preset) => {
                    const isExact = preset.type === 'exact';
                    const isLess = preset.type === 'less';
                    const isCurrent = Math.abs(preset.amount - numCash) < 0.01;
                    const isDisabled = selectedCustomer.isWalkIn && isLess;

                    return (
                      <button
                        key={`cash-${preset.type}-${preset.amount}`}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleQuickCash(preset.amount)}
                        title={
                          isDisabled
                            ? 'Walk-in customer requires full payment'
                            : isLess
                            ? 'Partial payment (remaining will add to Customer Due)'
                            : undefined
                        }
                        className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-black transition shadow-xs ${
                          isDisabled
                            ? 'opacity-35 cursor-not-allowed bg-slate-100 dark:bg-slate-800/40 text-slate-400 border border-dashed border-slate-300 dark:border-slate-700'
                            : isCurrent
                            ? 'bg-blue-600 dark:bg-sky-500 text-white shadow-sm'
                            : isExact
                            ? 'border border-emerald-500 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
                            : isLess
                            ? 'border border-amber-300 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                            : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:border-blue-500 dark:hover:border-sky-400'
                        }`}
                      >
                        {isExact ? `Exact (${preset.amount})` : `${preset.amount}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Card Only Mode */}
            {activeMethod === 'card' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3 space-y-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">
                      Mada / Card Amount ({settings.currency_symbol || 'SAR'})
                    </label>
                  </div>

                  <div className="relative">
                    <input
                      ref={cardInputRef}
                      type="number"
                      step="0.01"
                      min="0"
                      value={cardAmount === 0 ? '' : cardAmount}
                      onChange={(e) => setCardAmount(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full rounded-xl border-2 border-blue-500/60 focus:border-blue-600 dark:border-sky-500/60 dark:focus:border-sky-400 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-xl font-black text-slate-900 dark:text-white focus:outline-none shadow-xs"
                    />
                    <div className="absolute right-3 top-2.5 text-xs font-black uppercase text-slate-400">
                      {settings.currency_symbol || 'SAR'}
                    </div>
                  </div>
                </div>

                {/* Quick Presets: 3 less, 1 exact, 4 large */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {smartPresets.map((preset) => {
                    const isExact = preset.type === 'exact';
                    const isLess = preset.type === 'less';
                    const isCurrent = Math.abs(preset.amount - numCard) < 0.01;
                    const isDisabled = selectedCustomer.isWalkIn && isLess;

                    return (
                      <button
                        key={`card-${preset.type}-${preset.amount}`}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleQuickCard(preset.amount)}
                        title={
                          isDisabled
                            ? 'Walk-in customer requires full payment'
                            : isLess
                            ? 'Partial payment (remaining will add to Customer Due)'
                            : undefined
                        }
                        className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-black transition shadow-xs ${
                          isDisabled
                            ? 'opacity-35 cursor-not-allowed bg-slate-100 dark:bg-slate-800/40 text-slate-400 border border-dashed border-slate-300 dark:border-slate-700'
                            : isCurrent
                            ? 'bg-blue-600 dark:bg-sky-500 text-white shadow-sm'
                            : isExact
                            ? 'border border-emerald-500 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
                            : isLess
                            ? 'border border-amber-300 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                            : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:border-blue-500 dark:hover:border-sky-400'
                        }`}
                      >
                        {isExact ? `Exact (${preset.amount})` : `${preset.amount}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Split Tender Mode (50/50 synchronized, full payment enforced) */}
            {activeMethod === 'split' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Cash Split Field */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-black uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <Banknote className="h-3.5 w-3.5" />
                      <span>Cash Amount ({settings.currency_symbol || 'SAR'})</span>
                    </label>
                    <div className="relative">
                      <input
                        ref={cashInputRef}
                        type="number"
                        step="0.01"
                        min="0"
                        value={cashAmount === 0 ? '' : cashAmount}
                        onChange={(e) => handleSplitCashChange(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full rounded-xl border-2 border-emerald-500/60 focus:border-emerald-600 dark:border-emerald-500/60 dark:focus:border-emerald-400 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-lg font-black text-slate-900 dark:text-white focus:outline-none shadow-xs"
                      />
                      <div className="absolute right-3 top-2.5 text-xs font-black uppercase text-slate-400">
                        {settings.currency_symbol || 'SAR'}
                      </div>
                    </div>
                  </div>

                  {/* Card Split Field */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-black uppercase text-blue-700 dark:text-sky-400 flex items-center gap-1">
                      <CreditCard className="h-3.5 w-3.5" />
                      <span>Mada / Card Amount ({settings.currency_symbol || 'SAR'})</span>
                    </label>
                    <div className="relative">
                      <input
                        ref={cardInputRef}
                        type="number"
                        step="0.01"
                        min="0"
                        value={cardAmount === 0 ? '' : cardAmount}
                        onChange={(e) => handleSplitCardChange(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full rounded-xl border-2 border-blue-500/60 focus:border-blue-600 dark:border-sky-500/60 dark:focus:border-sky-400 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-lg font-black text-slate-900 dark:text-white focus:outline-none shadow-xs"
                      />
                      <div className="absolute right-3 top-2.5 text-xs font-black uppercase text-slate-400">
                        {settings.currency_symbol || 'SAR'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simple centered text label without box or icon */}
                <div className="text-center text-[11px] font-medium text-slate-500 dark:text-slate-400 pt-0.5">
                  Full payment required across Cash and Card
                </div>
              </div>
            )}

            {/* 4. Customer Due Details (when 100% credit) */}
            {activeMethod === 'credit' && (
              <div className="rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 p-3 border border-amber-200 dark:border-amber-900/80 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                <div>
                  <div className="font-extrabold flex items-center gap-1.5 text-xs">
                    <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span>Customer Ledger Credit Sale</span>
                  </div>
                  <p className="text-[11px] leading-relaxed mt-1">
                    Entire amount of <strong>{formatCurrency(totalAmount)}</strong> will be booked to the customer ledger of{' '}
                    <span className="font-black text-slate-900 dark:text-white underline">{selectedCustomer.name}</span>.
                  </p>
                </div>

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
                    ? !selectedCustomer.isWalkIn
                      ? isCreditLimitExceeded
                        ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800'
                        : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800'
                      : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800'
                    : 'bg-emerald-50/50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60'
                }`}
              >
                <div
                  className={`text-[10px] font-extrabold uppercase tracking-wider ${
                    remainingDue > 0.01
                      ? !selectedCustomer.isWalkIn
                        ? isCreditLimitExceeded
                          ? 'text-rose-800 dark:text-rose-300'
                          : 'text-amber-800 dark:text-amber-300'
                        : 'text-amber-800 dark:text-amber-300'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {remainingDue > 0.01
                    ? !selectedCustomer.isWalkIn
                      ? 'Customer Due'
                      : 'Remaining Due'
                    : 'Payment Status'}
                </div>
                <div
                  className={`font-mono text-xl sm:text-2xl font-black mt-0.5 ${
                    remainingDue > 0.01
                      ? !selectedCustomer.isWalkIn
                        ? isCreditLimitExceeded
                          ? 'text-rose-950 dark:text-rose-200'
                          : 'text-amber-950 dark:text-amber-200'
                        : 'text-amber-950 dark:text-amber-200'
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
                {!selectedCustomer.isWalkIn && remainingDue > 0.01 && (
                  <div
                    className={`text-[10px] font-bold mt-0.5 truncate ${
                      isCreditLimitExceeded
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {isCreditLimitExceeded
                      ? `Exceeds limit (${formatCurrency(creditLimitNum)})`
                      : `New Due: ${formatCurrency(projectedDue)}`}
                  </div>
                )}
              </div>
            </div>
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

      {/* Modern Customer Search & Selection Dialog */}
      {isSearchingCustomer && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 p-3 sm:p-5 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50/80 dark:bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 dark:bg-sky-500 text-white shadow-xs">
                  <Search className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">
                    Select Customer
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Search customer account or register new
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSearchingCustomer(false);
                  setSearchQuery('');
                }}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by customer name, phone, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 pl-9 pr-8 py-2 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-600 dark:focus:border-sky-500 focus:outline-none shadow-xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Informative Customer List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 divide-y-0">
              {isSearching ? (
                <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-sky-400" />
                  <span>Searching customers...</span>
                </div>
              ) : searchResults.length > 0 ? (
                <>
                  <div className="flex items-center justify-between px-1 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <span>Customer &bull; {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}</span>
                    <span>Due / Limit</span>
                  </div>
                  {searchResults.map((cust) => {
                    const due = Number(cust.current_due || 0);
                    const limit = Number(cust.credit_limit || 0);
                    const isSelected = selectedCustomer.id === cust.id;

                    return (
                      <div
                        key={cust.id}
                        onClick={() => {
                          setSelectedCustomer(cust);
                          onCustomerChange?.(cust);
                          setIsSearchingCustomer(false);
                          setSearchQuery('');
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/80 dark:bg-sky-950/50 shadow-xs'
                            : 'border-slate-200/80 dark:border-slate-800/80 hover:border-blue-300 dark:hover:border-sky-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                              isSelected
                                ? 'bg-blue-600 text-white dark:bg-sky-500'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <UserCheck className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {cust.name}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {cust.phone ? (
                                <span className="flex items-center gap-0.5">
                                  <Phone className="h-2.5 w-2.5" />
                                  <span>{cust.phone}</span>
                                </span>
                              ) : null}
                              {cust.email ? (
                                <span className="flex items-center gap-0.5 truncate max-w-[120px]">
                                  <Mail className="h-2.5 w-2.5" />
                                  <span className="truncate">{cust.email}</span>
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div
                            className={`font-mono text-xs font-black ${
                              due > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {formatCurrency(due)}
                          </div>
                          <div className="text-[9px] text-slate-400 mt-0.5 font-medium">
                            Limit: {formatCurrency(limit || 1000)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="py-8 text-center text-xs text-slate-500 space-y-2">
                  <p>No customer found matching &quot;{searchQuery}&quot;.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSearchingCustomer(false);
                      setIsRegistering(true);
                      setRegForm((prev) => ({ ...prev, name: searchQuery }));
                    }}
                    className="inline-flex items-center gap-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Register New Customer</span>
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-2.5 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(DEFAULT_WALK_IN);
                  onCustomerChange?.(DEFAULT_WALK_IN);
                  if (activeMethod === 'credit') {
                    handleSelectMethod('cash');
                  }
                  setIsSearchingCustomer(false);
                  setSearchQuery('');
                }}
                className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset to Walk-in</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSearchingCustomer(false);
                  setIsRegistering(true);
                  setRegForm((prev) => ({ ...prev, name: searchQuery }));
                }}
                className="flex items-center gap-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-[11px] font-bold shadow-xs transition"
              >
                <UserPlus className="h-3 w-3" />
                <span>+ Register New</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
