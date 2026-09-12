'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import {
  Store,
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  Loader2,
  Delete,
  Eye,
  EyeOff,
  PowerOff,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { InstallPwaButton } from '@/components/ui/InstallPwaButton';

export default function LoginPage() {
  const router = useRouter();
  const { settings } = useSettings();

  const [activeTab, setActiveTab] = useState<'sales_executive' | 'manager'>('sales_executive');

  // 5-Digit PIN State (Sales Executive)
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '', '']);
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Manager Password Form State
  const [managerUsername, setManagerUsername] = useState('admin');
  const [managerPassword, setManagerPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  // Pending credentials for takeover
  const [pendingCredentials, setPendingCredentials] = useState<{
    pin?: string;
    username?: string;
    password?: string;
    fullName?: string;
  } | null>(null);

  // POS Occupied - Another cashier is using the POS
  const [isPosOccupiedOpen, setIsPosOccupiedOpen] = useState(false);
  const [posOccupiedData, setPosOccupiedData] = useState<{
    activeOperator?: {
      userId: number;
      fullName: string;
      username: string;
      role?: string;
      openedAt: string;
      salesCount: number;
      totalSales: number;
      cashInDrawer?: number;
    };
  } | null>(null);
  const [isTakingOver, setIsTakingOver] = useState(false);

  // Cleanse residual auth token upon landing on login screen
  useEffect(() => {
    try {
      localStorage.removeItem('auth_token');
    } catch {}
  }, []);

  // Check URL query parameters for default tab
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') || params.get('role');
      if (tabParam === 'manager') {
        setActiveTab('manager');
      }
    }
  }, []);

  // Auto-focus inputs on tab change
  useEffect(() => {
    setError(null);
    if (activeTab === 'sales_executive') {
      setPinDigits(['', '', '', '', '']);
      setTimeout(() => {
        pinInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [activeTab]);

  // Global physical keyboard listener for Sales Executive PIN
  useEffect(() => {
    if (activeTab !== 'sales_executive') return;
    const handlePhysicalKeys = (e: KeyboardEvent) => {
      if (isPosOccupiedOpen || loading) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleNumpadDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleNumpadBackspace();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        handleNumpadClear();
      }
    };
    window.addEventListener('keydown', handlePhysicalKeys);
    return () => window.removeEventListener('keydown', handlePhysicalKeys);
  }, [activeTab, isPosOccupiedOpen, loading, pinDigits]);

  // Submit Sales Executive 5-Digit PIN
  const submitPin = async (fullPin: string) => {
    setError(null);
    setLoading(true);

    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ pin: fullPin, sessionType: 'pos', forceLogin: true }),
    });

    if (res.success && res.data?.user) {
      if (res.data.token) {
        try {
          localStorage.setItem('auth_token', res.data.token);
        } catch {}
      }
      window.location.replace('/pos');
    } else if (res.code === 'POS_OCCUPIED' || res.requiresTakeover) {
      setLoading(false);
      setPosOccupiedData(res.data || null);
      setPendingCredentials({ pin: fullPin });
      setIsPosOccupiedOpen(true);
    } else {
      setLoading(false);
      setError(res.message || 'Wrong PIN code. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPinDigits(['', '', '', '', '']);
      setTimeout(() => {
        pinInputRefs.current[0]?.focus();
      }, 50);
    }
  };

  // Handle Sales Executive PIN input
  const handleDigitChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned && value !== '') return;

    const char = cleaned.slice(-1);
    const newDigits = [...pinDigits];
    newDigits[index] = char;
    setPinDigits(newDigits);

    if (char && index < 4) {
      pinInputRefs.current[index + 1]?.focus();
    }

    const fullPin = newDigits.join('');
    if (fullPin.length === 5 && !newDigits.includes('')) {
      submitPin(fullPin);
    }
  };

  // Handle KeyDown Navigation
  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!pinDigits[index] && index > 0) {
        const newDigits = [...pinDigits];
        newDigits[index - 1] = '';
        setPinDigits(newDigits);
        pinInputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...pinDigits];
        newDigits[index] = '';
        setPinDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 4) {
      pinInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle Paste
  const handleDigitPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 5);
    if (!pasted) return;

    const newDigits = ['', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setPinDigits(newDigits);
    if (pasted.length === 5) {
      submitPin(pasted);
    } else {
      pinInputRefs.current[pasted.length]?.focus();
    }
  };

  // Touch Screen Numpad Handlers
  const handleNumpadDigit = (digit: string) => {
    if (loading) return;
    const firstEmptyIndex = pinDigits.findIndex((d) => d === '');
    if (firstEmptyIndex === -1) return;
    const newDigits = [...pinDigits];
    newDigits[firstEmptyIndex] = digit;
    setPinDigits(newDigits);

    if (firstEmptyIndex < 4) {
      pinInputRefs.current[firstEmptyIndex + 1]?.focus();
    }

    const fullPin = newDigits.join('');
    if (fullPin.length === 5 && !newDigits.includes('')) {
      submitPin(fullPin);
    }
  };

  const handleNumpadClear = () => {
    if (loading) return;
    setPinDigits(['', '', '', '', '']);
    setError(null);
    pinInputRefs.current[0]?.focus();
  };

  const handleNumpadBackspace = () => {
    if (loading) return;
    const lastFilledIndex = [...pinDigits].reverse().findIndex((d) => d !== '');
    if (lastFilledIndex !== -1) {
      const actualIndex = 4 - lastFilledIndex;
      const newDigits = [...pinDigits];
      newDigits[actualIndex] = '';
      setPinDigits(newDigits);
      pinInputRefs.current[actualIndex]?.focus();
    }
  };

  // Manager Password Login
  const handleManagerLogin = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!managerUsername || !managerPassword) {
      setError('Please enter both username and password.');
      return;
    }

    setError(null);
    setLoading(true);

    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: managerUsername,
        password: managerPassword,
        sessionType: 'dashboard',
      }),
    });

    setLoading(false);

    if (res.success && res.data?.user) {
      if (res.data.token) {
        try {
          localStorage.setItem('auth_token', res.data.token);
        } catch {}
      }
      window.location.replace('/dashboard');
    } else {
      setError(res.message || 'Invalid manager username or password.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  // POS Takeover
  const handlePosTakeover = async () => {
    if (!pendingCredentials?.pin) return;
    setIsTakingOver(true);
    setError(null);

    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        pin: pendingCredentials.pin,
        forceLogin: true,
        forceTakeover: true,
        sessionType: 'pos',
      }),
    });

    setIsTakingOver(false);
    if (res.success && res.data?.user) {
      if (res.data.token) {
        try {
          localStorage.setItem('auth_token', res.data.token);
        } catch {}
      }
      setIsPosOccupiedOpen(false);
      window.location.replace('/pos');
    } else {
      setError(res.message || 'Failed to take over the POS terminal.');
    }
  };

  const handleCancelPosTakeover = () => {
    setIsPosOccupiedOpen(false);
    setPosOccupiedData(null);
    setPendingCredentials(null);
    setPinDigits(['', '', '', '', '']);
    setIsTakingOver(false);
    setTimeout(() => {
      pinInputRefs.current[0]?.focus();
    }, 50);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 relative overflow-hidden select-none">
      {/* Background Glows */}
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

      {/* Main Glassmorphism Card */}
      <div className="relative z-10 w-full max-w-[440px] rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-slate-800/80 p-5 sm:p-7 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] text-white transition-all duration-300 ease-in-out">
        {/* Brand Header */}
        <div className="mb-5 text-center space-y-2">
          <div className="mx-auto flex h-13 w-13 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-700 to-sky-500 text-white shadow-lg shadow-blue-600/25 ring-4 ring-blue-500/10 transition-transform duration-300 hover:scale-105">
            <Store className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <div>
            <h1 className="text-base font-black uppercase tracking-tight text-white">
              {settings.shop_name_en || 'AL-NOOR SUPERMARKET'}
            </h1>
            <p className="text-[12px] font-medium text-slate-400 mt-0.5">
              Point of Sale & Retail Management
            </p>
          </div>
        </div>

        {/* Session Notice */}
        {sessionNotice && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <span>{sessionNotice}</span>
          </div>
        )}

        {/* Role Switcher Tabs */}
        <div className="mb-5 flex rounded-xl bg-slate-950/90 p-1.5 border border-slate-800/80 shadow-inner w-full">
          <button
            type="button"
            onClick={() => setActiveTab('sales_executive')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'sales_executive'
                ? 'bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            <span>Sales Executive</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('manager')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'manager'
                ? 'bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Manager</span>
          </button>
        </div>

        {/* Content Container */}
        <div className="transition-all duration-300 ease-in-out w-full">
          {/* TAB 1: SALES EXECUTIVE PIN */}
          {activeTab === 'sales_executive' && (
            <div className="py-1 animate-fade-in text-center space-y-3.5 w-full">
              {/* 5 PIN Boxes - Full Available Width */}
              <div
                className={`w-full grid grid-cols-5 gap-2.5 sm:gap-3 transition-transform ${
                  shake ? 'animate-bounce' : ''
                }`}
                onPaste={handleDigitPaste}
              >
                {[0, 1, 2, 3, 4].map((idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      pinInputRefs.current[idx] = el;
                    }}
                    type="password"
                    inputMode="none"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={pinDigits[idx]}
                    disabled={loading}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                    className={`h-14 sm:h-16 w-full rounded-xl border bg-slate-950/90 text-center font-mono text-2xl sm:text-3xl font-black text-white focus:outline-none transition-all duration-200 shadow-inner ${
                      error
                        ? 'border-rose-500 ring-2 ring-rose-500/30'
                        : pinDigits[idx]
                        ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-950/30 text-sky-400'
                        : 'border-slate-800 hover:border-slate-600'
                    }`}
                  />
                ))}
              </div>

              {/* Status / Error */}
              {loading ? (
                <div className="flex items-center justify-center gap-2 text-xs text-sky-400 font-bold py-1 animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                  <span>Auto-authenticating user...</span>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400 font-bold py-0.5 animate-fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 font-medium py-0.5">
                  Type on keyboard or tap 5-digit PIN
                </p>
              )}

              {/* On-Screen Touch Numpad - Full Available Width */}
              <div className="pt-1 w-full grid grid-cols-3 gap-2 sm:gap-2.5 select-none">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={loading}
                    onClick={() => handleNumpadDigit(String(n))}
                    className="h-12 sm:h-14 w-full rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-blue-600 active:text-white border border-slate-700/60 text-slate-100 font-mono text-xl sm:text-2xl font-bold transition shadow-sm flex items-center justify-center disabled:opacity-50"
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleNumpadClear}
                  className="h-12 sm:h-14 w-full rounded-xl bg-slate-800/50 hover:bg-slate-700 active:bg-slate-600 border border-slate-700/60 text-rose-400 hover:text-rose-300 font-bold text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center disabled:opacity-50"
                  title="Clear PIN"
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleNumpadDigit('0')}
                  className="h-12 sm:h-14 w-full rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-blue-600 active:text-white border border-slate-700/60 text-slate-100 font-mono text-xl sm:text-2xl font-bold transition shadow-sm flex items-center justify-center disabled:opacity-50"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleNumpadBackspace}
                  className="h-12 sm:h-14 w-full rounded-xl bg-slate-800/50 hover:bg-slate-700 active:bg-slate-600 border border-slate-700/60 text-amber-400 hover:text-amber-300 transition shadow-sm flex items-center justify-center disabled:opacity-50"
                  title="Backspace"
                >
                  <Delete className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: MANAGER (Username & Password Only) */}
          {activeTab === 'manager' && (
            <form onSubmit={handleManagerLogin} className="space-y-4 animate-fade-in py-1 w-full">
              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-950/60 p-3 text-xs text-rose-300 border border-rose-900 animate-fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Username Input */}
              <div className="relative">
                <User className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={managerUsername}
                  onChange={(e) => setManagerUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/90 py-3 pl-11 pr-4 text-xs font-semibold text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none shadow-inner transition"
                />
              </div>

              {/* Password Input */}
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  value={managerPassword}
                  onChange={(e) => setManagerPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/90 py-3 pl-11 pr-11 text-xs font-semibold text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none shadow-inner transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Sign In Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={loading}
                  className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 shadow-lg shadow-blue-700/30 transition duration-200"
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Sign In to Manager Portal
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Windows PWA Install Button */}
      <div className="relative z-10 mt-4 flex justify-center">
        <InstallPwaButton />
      </div>

      {/* POS Occupied Takeover Dialog */}
      <Modal
        isOpen={isPosOccupiedOpen}
        onClose={handleCancelPosTakeover}
        maxWidth="md"
        showCloseButton={true}
        title={
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/10 dark:bg-sky-500/10 text-blue-600 dark:text-sky-400 font-black shrink-0 ring-4 ring-blue-500/10">
              <User className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-slate-900 dark:text-white leading-none">
                  {posOccupiedData?.activeOperator?.fullName || 'Active Staff'}
                </span>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                {posOccupiedData?.activeOperator?.role === 'manager' ? 'Manager' : 'Sales Executive'}
              </div>
            </div>
          </div>
        }
        footer={
          <div className="flex w-full gap-2.5 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-1/3 font-bold uppercase tracking-wider text-xs border-slate-300 dark:border-slate-700"
              onClick={handleCancelPosTakeover}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              className="w-2/3 font-bold uppercase tracking-wider text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20"
              isLoading={isTakingOver}
              onClick={handlePosTakeover}
              rightIcon={<PowerOff className="h-4 w-4" />}
            >
              Force Close & Take Over
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-1 text-xs text-slate-700 dark:text-slate-300">
          {/* 4 Shift Stats Cards */}
          {posOccupiedData?.activeOperator && (
            <div className="grid grid-cols-2 gap-3">
              {/* 1. Shift Started */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 shadow-sm">
                <div className="text-[10px] font-bold uppercase text-slate-400">Shift Started</div>
                <div className="font-mono text-xs font-bold text-slate-900 dark:text-white mt-1">
                  {new Date(posOccupiedData.activeOperator.openedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </div>
              </div>

              {/* 2. Shift Sales */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 shadow-sm">
                <div className="text-[10px] font-bold uppercase text-slate-400">Shift Sales</div>
                <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {Number(posOccupiedData.activeOperator.totalSales || 0).toFixed(2)} SAR
                </div>
              </div>

              {/* 3. Total Invoices */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 shadow-sm">
                <div className="text-[10px] font-bold uppercase text-slate-400">Total Invoices</div>
                <div className="font-mono text-xs font-bold text-blue-600 dark:text-sky-400 mt-1">
                  {posOccupiedData.activeOperator.salesCount || 0} Invoices
                </div>
              </div>

              {/* 4. Cash in Drawer */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 shadow-sm">
                <div className="text-[10px] font-bold uppercase text-slate-400">Cash in Drawer</div>
                <div className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {Number(posOccupiedData.activeOperator.cashInDrawer || 0).toFixed(2)} SAR
                </div>
              </div>
            </div>
          )}

          {/* Takeover Notice Card */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/30 p-3.5 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <PowerOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Shift Takeover Notice</span>
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              Only one cashier can operate the terminal. Clicking <strong>Force Close & Take Over</strong> will close <span className="font-bold text-slate-900 dark:text-white">{posOccupiedData?.activeOperator?.fullName || 'the cashier'}</span>&apos;s shift and automatically carry forward the drawer balance ({Number(posOccupiedData?.activeOperator?.cashInDrawer || 0).toFixed(2)} SAR) to your new session.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-950/60 p-3 text-xs text-rose-300 border border-rose-900 animate-fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
