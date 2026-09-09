'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiRequest, notifyAuthLogout } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { useSessionSync } from '@/hooks/useSessionSync';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import TenderModal from '@/components/pos/TenderModal';
import { printThermalReceipt } from '@/components/pos/ReceiptModal';
import { Button, IconButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  PauseCircle,
  FolderOpen,
  Store,
  LogOut,
  LayoutDashboard,
  User,
  AlertCircle,
  Clock,
  Sun,
  Moon,
  CreditCard,
  Package,
  ArrowUpDown,
  ArrowRight,
  X,
  Zap,
  Tag,
  Flame,
  ArrowDownAZ,
  ArrowDown10,
  ArrowUp10,
  Maximize,
  Minimize,
  FileText,
  Banknote,
  Receipt,
  Play,
  CheckCircle2,
  Lock,
  Printer,
  KeyRound,
} from 'lucide-react';

interface CartItem {
  productId: number;
  name: string;
  sku: string;
  barcode?: string;
  pluCode?: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  taxRate: number;
  isTaxInclusive: boolean;
  stock: number;
  unitName?: string;
  imageUrl?: string;
}

export default function PosTerminalPage() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const {
    settings,
    formatCurrency,
    formatTime,
    formatDateTime,
    theme,
    toggleTheme,
    fontSizeScale,
    setFontSizeScale,
  } = useSettings();

  const [authChecking, setAuthChecking] = useState(true);

  // Real-Time Multi-Device Session Invalidation Listener
  useSessionSync();
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'fast_moving' | 'name' | 'price_asc' | 'price_desc'>('fast_moving');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<any>(null);
  const [activeShift, setActiveShift] = useState<any>(null);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Modals
  const [isTenderOpen, setIsTenderOpen] = useState(false);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);
  const [isOpenShiftModal, setIsOpenShiftModal] = useState(false);
  const [isSessionSummaryOpen, setIsSessionSummaryOpen] = useState(false);

  const [heldSalesList, setHeldSalesList] = useState<any[]>([]);
  const [completedSaleData, setCompletedSaleData] = useState<any>(null);
  const [sessionSummaryData, setSessionSummaryData] = useState<any>(null);
  const [loadingPay, setLoadingPay] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Forms
  const [openingFloat, setOpeningFloat] = useState<number>(150);
  const openingFloatInputRef = useRef<HTMLInputElement>(null);
  const [openingCardFloat, setOpeningCardFloat] = useState<number>(0);
  const openingCardInputRef = useRef<HTMLInputElement>(null);
  const [activeOpeningField, setActiveOpeningField] = useState<'cash' | 'card'>('cash');
  const [closingCountedCash, setClosingCountedCash] = useState<number | string>('');
  const [closingNote, setClosingNote] = useState<string>('');
  const [isEndingShift, setIsEndingShift] = useState(false);

  // Carry-forward state
  const [carryForwardData, setCarryForwardData] = useState<any>(null);
  const [loadingCarryForward, setLoadingCarryForward] = useState(false);
  
  // Opening adjustment state (for discrepancies when opening shift)
  const [openingAdjustments, setOpeningAdjustments] = useState<Array<{ amount: number; description: string }>>([]);
  const [newOpeningAdjAmount, setNewOpeningAdjAmount] = useState<number | string>('');
  const [newOpeningAdjDesc, setNewOpeningAdjDesc] = useState('');
  
  // Closing adjustment state (for discrepancies when closing shift)
  const [closingAdjustments, setClosingAdjustments] = useState<Array<{ amount: number; description: string }>>([]);
  const [newClosingAdjAmount, setNewClosingAdjAmount] = useState<number | string>('');
  const [newClosingAdjDesc, setNewClosingAdjDesc] = useState('');
  const [closingCardTotal, setClosingCardTotal] = useState<number | string>('');
  const closingCashInputRef = useRef<HTMLInputElement>(null);
  const closingCardInputRef = useRef<HTMLInputElement>(null);
  const [activeClosingField, setActiveClosingField] = useState<'cash' | 'card'>('cash');

  // Auto-focus opening float input when shift modal opens
  useEffect(() => {
    if (isOpenShiftModal) {
      const timer = setTimeout(() => {
        openingFloatInputRef.current?.focus();
        openingFloatInputRef.current?.select();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpenShiftModal]);

  // Auto-focus closing cash in drawer input when session summary modal opens
  useEffect(() => {
    if (isSessionSummaryOpen) {
      setActiveClosingField('cash');
      const timer = setTimeout(() => {
        closingCashInputRef.current?.focus();
        closingCashInputRef.current?.select();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isSessionSummaryOpen]);

  // Multi-Window Single Active Session: Listen for Cross-Tab Logout/Termination Events
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && window.BroadcastChannel) {
      channel = new BroadcastChannel('shop_pos_auth_sync');
      channel.onmessage = (event) => {
        if (event.data?.type === 'AUTH_LOGOUT') {
          window.location.replace('/login?logout=true');
        }
      };
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'shop_auth_sync_logout') {
        window.location.replace('/login?logout=true');
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Manager PIN Unlock State (Fallback only)
  const [isManagerPinUnlockOpen, setIsManagerPinUnlockOpen] = useState(false);
  const [managerUnlockPin, setManagerUnlockPin] = useState('');
  const [managerPinError, setManagerPinError] = useState<string | null>(null);
  const [managerPinLoading, setManagerPinLoading] = useState(false);

  // Synchronized Live Clock & Session Duration
  const [currentTime, setCurrentTime] = useState<string>('');
  const [sessionDuration, setSessionDuration] = useState<string>('00:00:00');

  const formatTwoWords = (name?: string) => {
    if (!name) return 'Cashier';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).join(' ');
  };

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(formatTime(new Date()));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [formatTime]);

  // Session elapsed timer calculation
  useEffect(() => {
    if (!activeShift?.opened_at) {
      setSessionDuration('00:00:00');
      return;
    }

    const startMs = new Date(activeShift.opened_at).getTime();
    const updateSession = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      const hrs = Math.floor(elapsed / 3600).toString().padStart(2, '0');
      const mins = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
      const secs = (elapsed % 60).toString().padStart(2, '0');
      setSessionDuration(`${hrs}:${mins}:${secs}`);
    };

    updateSession();
    const interval = setInterval(updateSession, 1000);
    return () => clearInterval(interval);
  }, [activeShift?.opened_at]);

  // Fullscreen Listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };


  // Load User, Products & Shift Data with strict Auth Guard
  const loadData = async () => {
    setAuthChecking(true);
    const userRes = await apiRequest('/auth/me');
    if (userRes.success && userRes.data?.user) {
      // Zero-Privilege POS Rule: Manager cannot operate POS under Manager role.
      // Must verify PIN to activate Sales Executive session.
      if (userRes.data.user.role === 'manager') {
        setUser(userRes.data.user);
        setAuthChecking(false);
        setIsManagerPinUnlockOpen(true);
        return;
      }

      setUser(userRes.data.user);
      setActiveShift(userRes.data.activeShift);
      setAuthChecking(false);
      if (!userRes.data.activeShift) {
        // Load carry-forward data for the new session
        setLoadingCarryForward(true);
        const cfRes = await apiRequest('/cash/carry-forward');
        if (cfRes.success && cfRes.data) {
          setCarryForwardData(cfRes.data);
          if (cfRes.data.carryForwardBalance > 0) {
            setOpeningFloat(cfRes.data.carryForwardBalance);
          }
          if (cfRes.data.carryForwardCardBalance > 0) {
            setOpeningCardFloat(cfRes.data.carryForwardCardBalance);
          }
        }
        setLoadingCarryForward(false);
        setIsOpenShiftModal(true);
      }
    } else {
      // Unauthenticated -> Redirect immediately to login
      window.location.replace('/login');
      return;
    }

    const prodRes = await apiRequest('/products');
    if (prodRes.success && prodRes.data) {
      setProducts(prodRes.data);
    }
  };

  // Submit Manager PIN to activate Sales Executive POS Session
  const handleManagerPinSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!managerUnlockPin || managerUnlockPin.length !== 5) {
      setManagerPinError('Please enter a valid 5-digit PIN.');
      return;
    }

    setManagerPinLoading(true);
    setManagerPinError(null);

    const res = await apiRequest('/auth/switch-to-pos', {
      method: 'POST',
      body: JSON.stringify({ pin: managerUnlockPin }),
    });

    setManagerPinLoading(false);

    if (res.success && res.data?.user) {
      setIsManagerPinUnlockOpen(false);
      setManagerUnlockPin('');
      loadData();
    } else {
      setManagerPinError(res.message || 'Invalid PIN code. Please try again.');
    }
  };

  useEffect(() => {
    loadData();
  }, [router]);

  // Hardware Barcode Scanner Listener
  useBarcodeScanner({
    enableAudioBeep: settings.barcode_audio_beep !== 'false',
    onScan: async (barcode) => {
      setErrorMsg(null);
      const res = await apiRequest(`/products/scan/${barcode}`);
      if (res.success && res.data) {
        const itemQty = res.scannedQuantity || 1.0;
        addToCart(res.data, itemQty);
      } else {
        setErrorMsg(`Item with barcode "${barcode}" not found in catalog.`);
      }
    },
  });

  // Global Keyboard Shortcuts (F2 search, F4 park, F7 recall, F9/Space tender, Esc cancel)
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleHoldCart();
      } else if (e.key === 'F7') {
        e.preventDefault();
        openHeldModal();
      } else if (e.key === 'F9' || (e.code === 'Space' && e.ctrlKey)) {
        e.preventDefault();
        if (cart.length > 0) setIsTenderOpen(true);
      } else if (e.key === 'Escape') {
        setIsTenderOpen(false);
        setIsHeldModalOpen(false);
        setIsOpenShiftModal(false);
        setIsSessionSummaryOpen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [cart]);

  // Open Shift Summary Modal before logging out
  const handleOpenLogoutSummary = async () => {
    const res = await apiRequest('/cash/session-summary');
    if (res.success && res.data) {
      setSessionSummaryData(res.data);
      const expectedCash = res.data.expectedCashInDrawer ?? 
        (Number(res.data.session?.opening_balance || activeShift?.opening_balance || 0) + Number(res.data.cashSales || 0));
      const expectedCard = res.data.expectedCardInTerminal ?? 
        (Number(res.data.session?.opening_card_balance || activeShift?.opening_card_balance || 0) + Number(res.data.cardSales || 0));

      setClosingCountedCash(expectedCash !== undefined ? String(expectedCash) : '');
      setClosingCardTotal(expectedCard !== undefined ? String(expectedCard) : '');
      setClosingAdjustments([]);
      setNewClosingAdjAmount('');
      setNewClosingAdjDesc('');
    }
    setActiveClosingField('cash');
    setIsSessionSummaryOpen(true);
    setTimeout(() => {
      closingCashInputRef.current?.focus();
      closingCashInputRef.current?.select();
    }, 100);
  };

  // Format Shift Started timestamp like "13 Jun 12:25 PM"
  const formatShiftStarted = (date: Date | string | number | undefined | null): string => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    try {
      const day = d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: settings.timezone || 'Asia/Riyadh' });
      const month = d.toLocaleDateString('en-GB', { month: 'short', timeZone: settings.timezone || 'Asia/Riyadh' });
      const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: settings.timezone || 'Asia/Riyadh' })
        .replace(/\u202f/g, ' ');
      return `${day} ${month} ${time}`;
    } catch {
      return d.toLocaleString();
    }
  };

  // Helper to add declared discrepancy adjustment (supports both cash & card)
  const handleAddClosingAdjustment = () => {
    let rawNum = Math.abs(Number(newClosingAdjAmount));
    if (!rawNum || rawNum <= 0 || !newClosingAdjDesc.trim()) return;

    // Remaining discrepancy before this adjustment
    const expectedCash = Number(
      sessionSummaryData?.expectedCashInDrawer ??
      (Number(sessionSummaryData?.session?.opening_balance || activeShift?.opening_balance || 0) +
        Number(sessionSummaryData?.cashSales || 0))
    );
    const expectedCard = Number(
      sessionSummaryData?.expectedCardInTerminal ??
      (Number(sessionSummaryData?.session?.opening_card_balance || activeShift?.opening_card_balance || 0) +
        Number(sessionSummaryData?.cardSales || 0))
    );
    const countedCash = closingCountedCash !== '' ? Number(closingCountedCash) : expectedCash;
    const countedCard = closingCardTotal !== '' ? Number(closingCardTotal) : expectedCard;

    const cashDiff = countedCash - expectedCash;
    const cardDiff = countedCard - expectedCard;
    const totalDiff = Math.round((Math.abs(cashDiff) + Math.abs(cardDiff)) * 100) / 100;

    const currentDeclared = Math.round(
      closingAdjustments.reduce((sum, adj) => sum + Math.abs(Number(adj.amount || 0)), 0) * 100
    ) / 100;
    const rem = Math.max(0, Math.round((totalDiff - currentDeclared) * 100) / 100);

    // Never allow entering larger than the remaining discrepancy
    if (rawNum > rem) {
      rawNum = rem;
    }
    if (rawNum <= 0) return;

    // Sign matches the direction of the net discrepancy
    const netDiff = cashDiff + cardDiff;
    const sign = netDiff < 0 ? -1 : 1;
    const signedAmount = Math.round(rawNum * sign * 100) / 100;

    setClosingAdjustments((prev) => [
      ...prev,
      {
        amount: signedAmount,
        description: newClosingAdjDesc.trim(),
      },
    ]);
    setNewClosingAdjAmount('');
    setNewClosingAdjDesc('');
  };

  // Perform Shift Closing and Logout with full reconciliation
  const handleFinalizeShiftAndLogout = async (redirectToManager: boolean = false) => {
    setIsEndingShift(true);
    setErrorMsg(null);
    try {
      // 1. Close cash session with adjustments
      const closeRes = await apiRequest('/cash/close', {
        method: 'POST',
        body: JSON.stringify({
          actualClosingBalance: Number(closingCountedCash) || 0,
          terminalCardTotal: Number(closingCardTotal) || Number(sessionSummaryData?.cardSales) || 0,
          closingNote: closingNote || (redirectToManager ? 'Shift ended to return to Manager login' : 'Regular POS Shift Close'),
          adjustments: closingAdjustments.length > 0 ? closingAdjustments : undefined,
        }),
      });

      if (!closeRes.success && closeRes.message && !closeRes.message.includes('No active shift found')) {
        setErrorMsg(closeRes.message || 'Failed to close shift settlement.');
        setIsEndingShift(false);
        return;
      }

      // 2. Invalidate server auth cookie & session
      await apiRequest('/auth/logout', { method: 'POST' });

      // 3. Clean up client storage and redirect
      notifyAuthLogout('MANUAL_LOGOUT');
      document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0;';
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}

      if (redirectToManager) {
        window.location.replace('/login?role=manager&logout=true');
      } else {
        window.location.replace('/login?logout=true');
      }
    } catch (err: any) {
      console.error('Shift close / logout error:', err);
      setErrorMsg(err?.message || 'Error occurred during shift settlement logout.');
      setIsEndingShift(false);
    }
  };

  // Direct Print 80mm Cashier Shift X-Report (Standard Professional Thermal Format)
  const handlePrintSessionSummary = () => {
    const formatReportDate = (date: Date | string | number | undefined | null): string => {
      if (!date) return 'N/A';
      const d = new Date(date);
      if (isNaN(d.getTime())) return 'N/A';
      try {
        const tz = settings.timezone || 'Asia/Riyadh';
        const day = d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: tz });
        const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: tz });
        const timeParts = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz })
          .replace(/\u202f/g, ' ')
          .trim();
        const time = timeParts.replace(/\s+(AM|PM)/i, '$1');
        return `${day} ${month}, ${time}`;
      } catch {
        const day = d.getDate();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const mon = months[d.getMonth()];
        let h = d.getHours();
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        const min = d.getMinutes().toString().padStart(2, '0');
        return `${day} ${mon}, ${h}:${min}${ampm}`;
      }
    };

    const shopName = settings.shop_name_en || settings.shop_name || settings.shop_name_ar || 'AL-NOOR SUPERMARKET';
    const shopAddress = settings.shop_address || '';
    const shopPhone = settings.shop_phone || '';
    const cashierName = formatTwoWords(user?.fullName || user?.full_name || user?.username);
    const terminalName = sessionSummaryData?.session?.terminal_name || activeShift?.terminal_name || 'Terminal-01';
    const openedAt = formatReportDate(activeShift?.opened_at || sessionSummaryData?.session?.opened_at);
    const printTime = formatReportDate(new Date());

    const openingCash = Number(sessionSummaryData?.session?.opening_balance || activeShift?.opening_balance || 0);
    const openingCard = Number(sessionSummaryData?.session?.opening_card_balance || activeShift?.opening_card_balance || 0);
    const invoicesCount = sessionSummaryData?.invoicesCount ?? 0;
    const grossSales = Number(sessionSummaryData?.totalGrossSales ?? 0);
    const cashSales = Number(sessionSummaryData?.cashSales ?? 0);
    const cardSales = Number(sessionSummaryData?.cardSales ?? 0);
    const cashRefunds = Number(sessionSummaryData?.cashRefunds ?? 0);
    const cashExpenses = Number(sessionSummaryData?.cashExpenses ?? 0);

    const expectedCash = Number(
      sessionSummaryData?.expectedCashInDrawer ??
      (openingCash + cashSales - cashRefunds - cashExpenses)
    );
    const expectedCard = Number(
      sessionSummaryData?.expectedCardInTerminal ??
      (openingCard + cardSales)
    );

    const countedCash = closingCountedCash !== '' ? Number(closingCountedCash) : expectedCash;
    const countedCard = closingCardTotal !== '' ? Number(closingCardTotal) : expectedCard;

    const cashDiff = Math.round((countedCash - expectedCash) * 100) / 100;
    const cardDiff = Math.round((countedCard - expectedCard) * 100) / 100;
    const totalDiff = Math.round((Math.abs(cashDiff) + Math.abs(cardDiff)) * 100) / 100;

    const printContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Shift_XReport_${terminalName}</title>
    <style>
      @page {
        size: 80mm auto;
        margin: 0;
      }
      html, body {
        margin: 0;
        padding: 0;
        background-color: #ffffff;
        color: #000000;
        font-family: 'Courier New', Courier, monospace;
        font-size: 12px;
        line-height: 1.35;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .receipt {
        width: 76mm;
        margin: 0 auto;
        padding: 4mm 2mm;
        box-sizing: border-box;
      }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .bold { font-weight: 900; }
      .title { font-size: 15px; font-weight: 900; letter-spacing: -0.02em; }
      .divider { border-top: 1px dashed #000000; margin: 6px 0; }
      .double-divider { border-top: 1.5px solid #000000; border-bottom: 1.5px solid #000000; height: 2px; margin: 7px 0; }
      .row { display: flex; justify-content: space-between; align-items: baseline; margin: 2.5px 0; font-size: 12px; }
      .row-bold { display: flex; justify-content: space-between; align-items: baseline; margin: 3px 0; font-weight: 900; font-size: 12.5px; }
      .section-header { font-weight: 900; font-size: 11px; text-transform: uppercase; margin: 5px 0 2px; text-align: center; letter-spacing: 0.5px; }
      .signatures { margin-top: 18px; font-size: 11px; }
      .sig-line { margin-top: 22px; border-top: 1px solid #000; padding-top: 3px; }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="text-center">
        <div class="title">${shopName}</div>
        ${shopAddress ? `<div style="font-size: 10px; margin-top: 2px;">${shopAddress}</div>` : ''}
        ${shopPhone ? `<div style="font-size: 10px;">Tel: ${shopPhone}</div>` : ''}
        <div class="divider"></div>
        <div class="bold" style="font-size: 13px; letter-spacing: 0.5px;">*** CASHIER SHIFT X-REPORT ***</div>
      </div>

      <div class="divider"></div>
      <div class="row"><span>Cashier:</span><span class="bold">${cashierName}</span></div>
      <div class="row"><span>Shift Opened:</span><span>${openedAt}</span></div>
      <div class="row"><span>Report Printed:</span><span>${printTime}</span></div>
      <div class="row"><span>Shift Duration:</span><span class="bold">${sessionDuration}</span></div>

      <div class="divider"></div>
      <div class="section-header">--- OPENING FLOATS ---</div>
      <div class="row"><span>Opening Cash Float:</span><span class="bold">${formatCurrency(openingCash)}</span></div>
      <div class="row"><span>Opening Card Float:</span><span class="bold">${formatCurrency(openingCard)}</span></div>

      <div class="divider"></div>
      <div class="section-header">--- SHIFT SALES ---</div>
      <div class="row"><span>Invoices Processed:</span><span class="bold">${invoicesCount}</span></div>
      <div class="row"><span>Cash Received:</span><span class="bold">${formatCurrency(cashSales)}</span></div>
      <div class="row"><span>Mada / Card Sales:</span><span class="bold">${formatCurrency(cardSales)}</span></div>
      ${cashRefunds > 0 ? `<div class="row"><span>Cash Refunds:</span><span class="bold">-${formatCurrency(cashRefunds)}</span></div>` : ''}
      ${cashExpenses > 0 ? `<div class="row"><span>Cash Expenses:</span><span class="bold">-${formatCurrency(cashExpenses)}</span></div>` : ''}
      <div class="row-bold"><span>TOTAL GROSS SALES:</span><span class="bold">${formatCurrency(grossSales)}</span></div>

      <div class="divider"></div>
      <div class="section-header">--- SHIFT RECONCILIATION ---</div>
      <div class="row"><span>Expected Cash in Drawer:</span><span class="bold">${formatCurrency(expectedCash)}</span></div>
      <div class="row"><span>Counted Cash in Drawer:</span><span class="bold">${formatCurrency(countedCash)}</span></div>
      <div class="row" style="font-size: 11px;">
        <span>Cash Difference:</span>
        <span class="bold">${cashDiff === 0 ? '0.00 SAR (BALANCED)' : `${cashDiff > 0 ? '+' : ''}${cashDiff.toFixed(2)} SAR (${cashDiff > 0 ? 'OVERAGE' : 'SHORTAGE'})`}</span>
      </div>
      <div style="margin: 4px 0;"></div>
      <div class="row"><span>Expected Cash in Card:</span><span class="bold">${formatCurrency(expectedCard)}</span></div>
      <div class="row"><span>Counted Cash in Card:</span><span class="bold">${formatCurrency(countedCard)}</span></div>
      <div class="row" style="font-size: 11px;">
        <span>Card Difference:</span>
        <span class="bold">${cardDiff === 0 ? '0.00 SAR (BALANCED)' : `${cardDiff > 0 ? '+' : ''}${cardDiff.toFixed(2)} SAR (${cardDiff > 0 ? 'OVERAGE' : 'SHORTAGE'})`}</span>
      </div>

      ${closingAdjustments.length > 0 ? `
        <div class="divider"></div>
        <div class="section-header">--- DECLARED ADJUSTMENTS ---</div>
        ${closingAdjustments.map((adj) => `
          <div class="row" style="font-size: 11px;">
            <span>${adj.description}:</span>
            <span class="bold">${Number(adj.amount) > 0 ? '+' : ''}${Number(adj.amount).toFixed(2)} SAR</span>
          </div>
        `).join('')}
      ` : ''}

      <div class="double-divider"></div>
      <div class="text-center bold" style="font-size: 11.5px; margin: 4px 0;">
        ${totalDiff < 0.01 
          ? '*** DRAWER & CARD: BALANCED ***' 
          : closingAdjustments.length > 0 
          ? '*** DISCREPANCY RECONCILED ***' 
          : `*** FLOAT DISCREPANCY: ${totalDiff.toFixed(2)} SAR ***`}
      </div>
      <div class="double-divider"></div>

      <div class="signatures">
        <div class="row">
          <div style="width: 46%;">
            <div class="sig-line text-center">Cashier Signature</div>
          </div>
          <div style="width: 46%;">
            <div class="sig-line text-center">Manager Signature</div>
          </div>
        </div>
      </div>

      <div class="text-center" style="margin-top: 14px; font-size: 10px; color: #333;">
        *** END OF SHIFT REPORT ***
      </div>
    </div>
  </body>
</html>`;

    // Direct Print via hidden iframe (no preview window or extra click required)
    let printFrame = document.getElementById('shift-summary-print-frame') as HTMLIFrameElement | null;
    if (!printFrame) {
      printFrame = document.createElement('iframe');
      printFrame.id = 'shift-summary-print-frame';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);
    }

    const doc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (doc) {
      doc.open();
      doc.write(printContent);
      doc.close();
      setTimeout(() => {
        printFrame?.contentWindow?.focus();
        printFrame?.contentWindow?.print();
      }, 150);
    }
  };

  // Add Item to Cart (Strict Real-Time Stock Checking Enforced)
  const addToCart = (product: any, qtyToAdd: number = 1) => {
    setErrorMsg(null);
    const availableStock = Number(product.current_stock ?? product.stock ?? 0);

    // 1. Block out-of-stock items completely
    if (availableStock <= 0) {
      setErrorMsg(`"${product.name}" is out of stock (0 available). Cannot add to cart.`);
      return;
    }

    // 2. Check if product already exists in cart and enforce cumulative stock limit
    const existing = cart.find((i) => i.productId === product.id);
    const currentQty = existing ? existing.quantity : 0;
    const requestedQty = Math.round((currentQty + qtyToAdd) * 1000) / 1000;

    if (requestedQty > availableStock) {
      const remaining = Math.max(0, availableStock - currentQty);
      if (remaining === 0) {
        setErrorMsg(`Maximum stock reached for "${product.name}" (${availableStock} in stock, ${currentQty} already in cart).`);
      } else {
        setErrorMsg(`Cannot add ${qtyToAdd} more. Only ${remaining} more unit(s) of "${product.name}" available (${availableStock} total in stock).`);
      }
      return;
    }

    setCart((prev) => {
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: requestedQty }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          pluCode: product.plu_code,
          unitPrice: Number(product.selling_price),
          quantity: qtyToAdd,
          discount: 0,
          taxRate: Number(product.tax_rate || 15.0),
          isTaxInclusive: product.tax_type === 'inclusive',
          stock: availableStock,
          unitName: product.unit_short || product.unit_name || 'pcs',
          imageUrl: product.image_url,
        },
      ];
    });
  };

  // Adjust Quantity (Strict Stock Checking Enforced)
  const updateQuantity = (productId: number, delta: number) => {
    setErrorMsg(null);
    const item = cart.find((i) => i.productId === productId);
    if (!item) return;

    if (delta > 0) {
      const nextQty = Math.round((item.quantity + delta) * 1000) / 1000;
      if (nextQty > item.stock) {
        setErrorMsg(`Maximum available stock reached for "${item.name}" (${item.stock} in stock).`);
        return;
      }
    }

    setCart((prev) =>
      prev
        .map((i) => {
          if (i.productId === productId) {
            const newQty = Math.round((i.quantity + delta) * 1000) / 1000;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Remove Item
  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  // Clear Cart
  const clearCart = () => {
    if (cart.length === 0) return;
    if (confirm('Are you sure you want to clear the active shopping cart?')) {
      setCart([]);
      setErrorMsg(null);
    }
  };

  // Fetch Held Sales for the Current User (Server-Side + Local Storage Fallback)
  const fetchHeldSales = async () => {
    try {
      const res = await apiRequest('/sales/hold');
      if (res.success && Array.isArray(res.data)) {
        const currentUserId = user?.id;
        const serverHeld = res.data
          .filter((h: any) => !h.user_id || !currentUserId || Number(h.user_id) === Number(currentUserId))
          .map((h: any) => ({
            id: h.id,
            reference: h.reference_no,
            timestamp: h.created_at,
            userId: h.user_id,
            cart: (h.items || []).map((i: any) => ({
              productId: i.productId || i.product_id,
              name: i.name,
              sku: i.sku,
              barcode: i.barcode,
              unitPrice: Number(i.unitPrice || i.unit_price),
              quantity: Number(i.quantity),
              discount: Number(i.discount || 0),
              taxRate: Number(i.taxRate || 15),
              isTaxInclusive: Boolean(i.isTaxInclusive),
              stock: Number(i.stock || 0),
            })),
            isServer: true,
          }));
        setHeldSalesList(serverHeld);
        return serverHeld;
      }
    } catch (err) {
      console.warn('Failed to load server held sales, loading local', err);
    }

    const currentUserId = user?.id;
    const list = (JSON.parse(localStorage.getItem('pos_held_sales') || '[]') as any[])
      .filter((h: any) => !h.userId || !currentUserId || Number(h.userId) === Number(currentUserId));
    setHeldSalesList(list);
    return list;
  };

  // Park / Hold Cart (Quietly holds cart and updates count without toast message)
  const handleHoldCart = async () => {
    if (cart.length === 0) return;
    const holdRef = `HOLD-${Date.now().toString().slice(-4)}`;

    try {
      const res = await apiRequest('/sales/hold', {
        method: 'POST',
        body: JSON.stringify({
          customerId: 1,
          holdNote: 'Parked Sale',
          items: cart.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount || 0,
          })),
        }),
      });

      if (res.success) {
        setCart([]);
        setErrorMsg(null);
        await fetchHeldSales();
        return;
      }
    } catch (err) {
      console.warn('Server hold failed, using local storage fallback', err);
    }

    const held = {
      reference: holdRef,
      timestamp: new Date().toISOString(),
      userId: user?.id,
      cart,
    };
    const currentList = JSON.parse(localStorage.getItem('pos_held_sales') || '[]');
    currentList.push(held);
    localStorage.setItem('pos_held_sales', JSON.stringify(currentList));
    setCart([]);
    setErrorMsg(null);
    await fetchHeldSales();
  };

  // Open Held Modal (Fetches Server-Side + Local Carts for current user)
  const openHeldModal = async () => {
    await fetchHeldSales();
    setIsHeldModalOpen(true);
  };

  // Resume Held Sale
  const resumeHeldSale = async (index: number) => {
    const item = heldSalesList[index];
    if (item) {
      setCart(item.cart);
      if (item.isServer && item.id) {
        await apiRequest(`/sales/hold/${item.id}`, { method: 'DELETE' }).catch(() => {});
      }
      const updated = heldSalesList.filter((_, idx) => idx !== index);
      localStorage.setItem('pos_held_sales', JSON.stringify(updated.filter((h: any) => !h.isServer)));
      setHeldSalesList(updated);
      setIsHeldModalOpen(false);
      fetchHeldSales();
    }
  };

  // Delete / Discard Held Sale
  const deleteHeldSale = async (index: number) => {
    const item = heldSalesList[index];
    if (item?.isServer && item.id) {
      await apiRequest(`/sales/hold/${item.id}`, { method: 'DELETE' }).catch(() => {});
    }
    const updated = heldSalesList.filter((_, idx) => idx !== index);
    localStorage.setItem('pos_held_sales', JSON.stringify(updated.filter((h: any) => !h.isServer)));
    setHeldSalesList(updated);
    fetchHeldSales();
  };

  // Open Shift with carry-forward and adjustments
  const handleOpenShift = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    const res = await apiRequest('/cash/open', {
      method: 'POST',
      body: JSON.stringify({
        openingBalance: Number(openingFloat) || 0,
        openingCardBalance: Number(openingCardFloat) || 0,
        adjustments: openingAdjustments.length > 0 ? openingAdjustments : undefined,
      }),
    });
    if (res.success && res.data) {
      setActiveShift(res.data);
      setIsOpenShiftModal(false);
      setErrorMsg(null);
      setOpeningAdjustments([]);
      setNewOpeningAdjAmount('');
      setNewOpeningAdjDesc('');
      setOpeningCardFloat(0);
      setActiveOpeningField('cash');
    } else {
      setErrorMsg(res.message || 'Failed to open shift.');
    }
  };

  // Financial Calculations (15% Taxable / Output VAT)
  const calculateTotals = () => {
    let grossTotal = 0;
    let totalTax = 0;

    cart.forEach((item) => {
      const lineNet = item.unitPrice * item.quantity;
      if (item.isTaxInclusive) {
        const taxable = lineNet / (1 + item.taxRate / 100);
        const tax = lineNet - taxable;
        totalTax += tax;
        grossTotal += taxable;
      } else {
        const tax = lineNet * (item.taxRate / 100);
        totalTax += tax;
        grossTotal += lineNet;
      }
    });

    const roundedSubtotal = Math.round(grossTotal * 100) / 100;
    const roundedTax = Math.round(totalTax * 100) / 100;
    const grandTotal = Math.round((roundedSubtotal + roundedTax) * 100) / 100;

    return {
      subtotal: roundedSubtotal,
      totalTax: roundedTax,
      grandTotal,
      totalItems: cart.length,
      totalUnits: cart.reduce((sum, i) => sum + i.quantity, 0),
    };
  };

  const totals = calculateTotals();

  // Real-time stock synchronization across tabs & terminals
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('shop_stock_sync');
      channel.onmessage = (event) => {
        if (event.data?.type === 'STOCK_UPDATED') {
          apiRequest('/products').then((res) => {
            if (res.success && res.data) setProducts(res.data);
          });
        }
      };
      return () => {
        channel.close();
      };
    }
  }, []);

  // Load user's parked sales carts on session start
  useEffect(() => {
    if (user?.id) {
      fetchHeldSales();
    }
  }, [user?.id]);


  // Finalize Sale Checkout
  const handleFinalizeSale = async (
    payments: Array<{ paymentMethodId: number; amount: number; reference?: string }>,
    customerId: number = 1
  ) => {
    if (!activeShift) {
      setIsOpenShiftModal(true);
      return;
    }

    setLoadingPay(true);
    setErrorMsg(null);

    const salePayload = {
      customerId: customerId || 1, // Walk-in customer default or registered customer
      items: cart.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: 0,
        taxRate: i.taxRate,
        isTaxInclusive: i.isTaxInclusive,
      })),
      invoiceDiscount: 0,
      invoiceDiscountType: 'fixed',
      payments,
    };

    const res = await apiRequest('/sales', {
      method: 'POST',
      body: JSON.stringify(salePayload),
    });

    setLoadingPay(false);

    if (res.success && res.data) {
      // 1. Immediately decrement sold items in local state for instantaneous zero-latency UI update
      setProducts((prev) =>
        prev.map((p) => {
          const sold = cart.find((c) => c.productId === p.id);
          if (!sold) return p;
          const remaining = Math.max(0, Number(p.current_stock || 0) - sold.quantity);
          return {
            ...p,
            current_stock: remaining,
            stock: remaining,
          };
        })
      );

      // 2. Broadcast instant stock sync to other windows/tabs (Inventory, Products, other terminals)
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const channel = new BroadcastChannel('shop_stock_sync');
          channel.postMessage({ type: 'STOCK_UPDATED' });
          channel.close();
        } catch (e) {
          console.warn('BroadcastChannel error:', e);
        }
      }

      // 3. Background fresh products fetch to align exact state
      apiRequest('/products').then((prodRes) => {
        if (prodRes.success && prodRes.data) {
          setProducts(prodRes.data);
        }
      });

      const paidSum = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const saleGrand = Number(res.data?.sale?.grand_total ?? totals.grandTotal);
      const receiptPayload = {
        sale: res.data.sale,
        items: res.data.items || cart,
        payments: res.data.payments || payments || [],
        tenderedAmount: res.data.tenderedAmount ?? paidSum,
        changeAmount: res.data.changeAmount ?? Math.max(0, Math.round((paidSum - saleGrand) * 100) / 100),
        invoice: res.data.invoice,
        qrData: res.data.qrData,
        cashierName: formatTwoWords(user?.fullName || user?.full_name || user?.username),
      };

      setCompletedSaleData(receiptPayload);
      setIsTenderOpen(false);
      setCart([]);

      // Directly open native printer dialog (no preview dialog)
      printThermalReceipt(receiptPayload, settings);
    } else {
      setErrorMsg(res.message || 'Sale checkout failed.');
    }
  };

  // Filter & Sort All Products
  const filteredAndSortedProducts = useMemo(() => {
    let result = products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const matchName = p.name?.toLowerCase().includes(q);
      const matchSku = p.sku?.toLowerCase().includes(q);
      const matchBarcode = p.barcode?.toLowerCase().includes(q);
      const matchPlu = p.plu_code?.toLowerCase().includes(q);
      return matchName || matchSku || matchBarcode || matchPlu;
    });

    const getFastMovingScore = (p: any) => {
      const name = (p.name || '').toLowerCase();
      if (name.includes('milk') || name.includes('laban')) return 100;
      if (name.includes('pepsi') || name.includes('7-up') || name.includes('water')) return 95;
      if (name.includes('banana') || name.includes('tomato') || name.includes('bread')) return 90;
      if (name.includes('rice') || name.includes('oil') || name.includes('sugar')) return 85;
      if (name.includes('tea') || name.includes('coffee') || name.includes('lays')) return 80;
      if (p.is_quick_plu) return 75;
      return 50;
    };

    result.sort((a, b) => {
      if (sortBy === 'fast_moving') {
        const scoreA = getFastMovingScore(a);
        const scoreB = getFastMovingScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.id - b.id;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'price_asc') {
        return Number(a.selling_price) - Number(b.selling_price);
      }
      if (sortBy === 'price_desc') {
        return Number(b.selling_price) - Number(a.selling_price);
      }
      return 0;
    });

    return result;
  }, [products, searchQuery, sortBy]);

  if (authChecking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center space-y-3">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-500 border-r-transparent"></div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Verifying Cashier Session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 select-none">
      {/* Tender Modal */}
      {isTenderOpen && (
        <TenderModal
          totalAmount={totals.grandTotal}
          onConfirm={(payments, custId) => handleFinalizeSale(payments, custId)}
          onClose={() => setIsTenderOpen(false)}
          loading={loadingPay}
        />
      )}

      {/* Premium End-of-Shift / Session Summary Modal (X-Report) */}
      {(() => {
        const sessionExpectedCash = Number(
          sessionSummaryData?.expectedCashInDrawer ??
          (Number(sessionSummaryData?.session?.opening_balance || activeShift?.opening_balance || 0) +
            Number(sessionSummaryData?.cashSales || 0))
        );
        const sessionExpectedCard = Number(
          sessionSummaryData?.expectedCardInTerminal ??
          (Number(sessionSummaryData?.session?.opening_card_balance || activeShift?.opening_card_balance || 0) +
            Number(sessionSummaryData?.cardSales || 0))
        );

        const countedCashNum = closingCountedCash !== '' ? Number(closingCountedCash) : null;
        const countedCardNum = closingCardTotal !== '' ? Number(closingCardTotal) : 0;

        const cashDiff = countedCashNum !== null ? Math.round((countedCashNum - sessionExpectedCash) * 100) / 100 : 0;
        const cardDiff = Math.round((countedCardNum - sessionExpectedCard) * 100) / 100;

        const totalDiscrepancy = Math.round((Math.abs(cashDiff) + Math.abs(cardDiff)) * 100) / 100;
        const hasDiscrepancy = countedCashNum !== null && totalDiscrepancy >= 0.01;

        const totalDeclaredAdjustments = Math.round(
          closingAdjustments.reduce((sum, adj) => sum + Math.abs(Number(adj.amount || 0)), 0) * 100
        ) / 100;

        const remainingDiscrepancy = Math.max(0, Math.round((totalDiscrepancy - totalDeclaredAdjustments) * 100) / 100);
        const isDiscrepancyFullyDeclared = Math.abs(totalDiscrepancy - totalDeclaredAdjustments) < 0.01;
        const maxAllowedDiscrepancy = remainingDiscrepancy;

        const canEndShift =
          countedCashNum !== null &&
          (!hasDiscrepancy || isDiscrepancyFullyDeclared) &&
          !isEndingShift;

        return (
          <Modal
            isOpen={isSessionSummaryOpen}
            onClose={() => !isEndingShift && setIsSessionSummaryOpen(false)}
            maxWidth="xl"
            showCloseButton={false}
            footer={
              <div className="flex w-full flex-row items-center justify-between gap-2.5">
                <button
                  type="button"
                  disabled={isEndingShift}
                  onClick={() => setIsSessionSummaryOpen(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition uppercase whitespace-nowrap"
                >
                  Back to POS
                </button>
                <div className="flex flex-row items-center gap-2">
                  <button
                    type="button"
                    disabled={!canEndShift}
                    onClick={handlePrintSessionSummary}
                    title={
                      !countedCashNum && countedCashNum !== 0
                        ? 'Please enter Cash in Drawer to print report'
                        : hasDiscrepancy && !isDiscrepancyFullyDeclared
                        ? `Declare remaining ${remainingDiscrepancy > 0 ? '+' : ''}${remainingDiscrepancy.toFixed(2)} SAR to print report`
                        : undefined
                    }
                    className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-bold shadow-xs transition uppercase whitespace-nowrap ${
                      canEndShift
                        ? 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <Printer className={`h-4 w-4 ${canEndShift ? 'text-blue-600 dark:text-sky-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span>Print X-Report</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canEndShift}
                    onClick={() => handleFinalizeShiftAndLogout(false)}
                    title={
                      !countedCashNum && countedCashNum !== 0
                        ? 'Please enter Cash in Drawer to exit'
                        : hasDiscrepancy && !isDiscrepancyFullyDeclared
                        ? `Declare remaining ${remainingDiscrepancy > 0 ? '+' : ''}${remainingDiscrepancy.toFixed(2)} SAR to exit`
                        : undefined
                    }
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-sm transition whitespace-nowrap ${
                      canEndShift
                        ? 'bg-rose-600 hover:bg-rose-500 cursor-pointer'
                        : 'bg-slate-400 dark:bg-slate-700 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>
                      {isEndingShift
                        ? 'Closing Shift...'
                        : hasDiscrepancy && !isDiscrepancyFullyDeclared
                        ? `Declare ${remainingDiscrepancy > 0 ? '+' : ''}${remainingDiscrepancy.toFixed(2)} SAR to Exit`
                        : 'End Shift & Logout'}
                    </span>
                  </button>
                </div>
              </div>
            }
          >
            <div
              className="space-y-3.5 text-xs transition-transform"
              style={{ zoom: fontSizeScale === '110%' || fontSizeScale === '1.1' ? 1.05 : 1 }}
            >
              {/* User Details & Opening Floats Compact Header Banner */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 dark:bg-sky-500 text-white shadow-md">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {formatTwoWords(user?.fullName || user?.full_name || user?.username)}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      <Clock className="h-3 w-3 inline shrink-0" />
                      <span>{sessionDuration}</span>
                    </div>
                  </div>
                </div>

                {/* Right side: Opening Cash Float & Opening Card Float */}
                <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 px-3 py-1.5 text-right shadow-xs">
                    <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-end gap-1">
                      <Banknote className="h-3 w-3 text-emerald-500" />
                      <span>Opening Cash</span>
                    </div>
                    <div className="font-mono text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5">
                      {formatCurrency(sessionSummaryData?.session?.opening_balance || activeShift?.opening_balance || 0)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 px-3 py-1.5 text-right shadow-xs">
                    <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-end gap-1">
                      <CreditCard className="h-3 w-3 text-purple-500" />
                      <span>Opening Card</span>
                    </div>
                    <div className="font-mono text-xs sm:text-sm font-black text-purple-600 dark:text-purple-400 mt-0.5">
                      {formatCurrency(sessionSummaryData?.session?.opening_card_balance || activeShift?.opening_card_balance || 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3-Column Grid Financial Breakdown (Compact & Balanced) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {/* Invoices Processed */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 sm:p-3 shadow-xs">
                  <div className="text-[10px] font-bold uppercase text-slate-400 truncate">Invoices Processed</div>
                  <div className="font-mono text-sm sm:text-base font-black text-blue-600 dark:text-sky-400 mt-1 truncate">
                    {sessionSummaryData?.invoicesCount ?? 0} Sales
                  </div>
                </div>

                {/* Cash Received */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 sm:p-3 shadow-xs">
                  <div className="text-[10px] font-bold uppercase text-slate-400 truncate">Cash Received</div>
                  <div className="font-mono text-sm sm:text-base font-black text-slate-900 dark:text-white mt-1 truncate">
                    {formatCurrency(sessionSummaryData?.cashSales ?? 0)}
                  </div>
                </div>

                {/* Mada / Card Sales */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 sm:p-3 shadow-xs">
                  <div className="text-[10px] font-bold uppercase text-slate-400 truncate">Mada / Card Sales</div>
                  <div className="font-mono text-sm sm:text-base font-black text-slate-900 dark:text-white mt-1 truncate">
                    {formatCurrency(sessionSummaryData?.cardSales ?? 0)}
                  </div>
                </div>

                {/* Total Gross Sales */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 sm:p-3 shadow-xs">
                  <div className="text-[10px] font-bold uppercase text-slate-400 truncate">Total Gross Sales</div>
                  <div className="font-mono text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                    {formatCurrency(sessionSummaryData?.totalGrossSales ?? 0)}
                  </div>
                </div>

                {/* Cash in Drawer - Highlighted Blue Accent */}
                <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 p-2.5 sm:p-3 shadow-xs">
                  <div className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 truncate flex items-center gap-1">
                    <Banknote className="h-3 w-3" />
                    <span>Cash in Drawer</span>
                  </div>
                  <div className="font-mono text-sm sm:text-base font-black text-blue-700 dark:text-sky-300 mt-1 truncate">
                    {formatCurrency(sessionExpectedCash)}
                  </div>
                </div>

                {/* Cash in Card - Highlighted Purple Accent */}
                <div className="rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/30 p-2.5 sm:p-3 shadow-xs">
                  <div className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400 truncate flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    <span>Cash in Card</span>
                  </div>
                  <div className="font-mono text-sm sm:text-base font-black text-purple-700 dark:text-purple-300 mt-1 truncate">
                    {formatCurrency(sessionExpectedCard)}
                  </div>
                </div>
              </div>

              {/* Verified Cash (Drawer & CARD) */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Verified Cash (Drawer &amp; CARD)</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Banknote className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Cash in Drawer</span>
                    </label>
                    <div className={`relative flex items-center rounded-xl border-2 transition px-3 py-2 ${
                      activeClosingField === 'cash'
                        ? 'border-emerald-500 ring-2 ring-emerald-500/15 bg-emerald-50/30 dark:bg-emerald-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90'
                    }`}>
                      <input
                        ref={closingCashInputRef}
                        type="number"
                        step="0.01"
                        min="0"
                        autoFocus
                        value={closingCountedCash}
                        onChange={(e) => setClosingCountedCash(e.target.value)}
                        onFocus={() => setActiveClosingField('cash')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (canEndShift) {
                              handleFinalizeShiftAndLogout(false);
                            } else {
                              closingCardInputRef.current?.focus();
                              closingCardInputRef.current?.select();
                            }
                          }
                        }}
                        placeholder="0.00"
                        className="w-full bg-transparent font-mono text-base font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                      />
                      <span className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400 pl-1 select-none whitespace-nowrap">SAR</span>
                    </div>
                    <p className="font-mono text-[10px] text-slate-400 text-center">
                      {Number(closingCountedCash || 0).toFixed(2)}/{sessionExpectedCash.toFixed(2)} SAR
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <CreditCard className="h-3.5 w-3.5 text-purple-500" />
                      <span>Cash in Card</span>
                    </label>
                    <div className={`relative flex items-center rounded-xl border-2 transition px-3 py-2 ${
                      activeClosingField === 'card'
                        ? 'border-purple-500 ring-2 ring-purple-500/15 bg-purple-50/30 dark:bg-purple-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90'
                    }`}>
                      <input
                        ref={closingCardInputRef}
                        type="number"
                        step="0.01"
                        min="0"
                        value={closingCardTotal}
                        onChange={(e) => setClosingCardTotal(e.target.value)}
                        onFocus={() => setActiveClosingField('card')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (canEndShift) {
                              handleFinalizeShiftAndLogout(false);
                            }
                          }
                        }}
                        placeholder="0.00"
                        className="w-full bg-transparent font-mono text-base font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                      />
                      <span className="font-mono text-[10px] font-bold text-purple-600 dark:text-purple-400 pl-1 select-none whitespace-nowrap">SAR</span>
                    </div>
                    <p className="font-mono text-[10px] text-slate-400 text-center">
                      {Number(closingCardTotal || 0).toFixed(2)}/{sessionExpectedCard.toFixed(2)} SAR
                    </p>
                  </div>
                </div>
              </div>

              {/* Strict Float Discrepancy Reconciliation (matches opening shift dialog) */}
              {hasDiscrepancy && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/40 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 dark:text-amber-200">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Float Discrepancy</span>
                    </div>
                    <span className={`font-mono text-[11px] font-black px-2.5 py-0.5 rounded-md ${
                      isDiscrepancyFullyDeclared
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {totalDeclaredAdjustments.toFixed(2)}/{totalDiscrepancy.toFixed(2)} SAR
                    </span>
                  </div>

                  {/* Adjustment Entry */}
                  <div className="space-y-1.5">
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={maxAllowedDiscrepancy}
                        disabled={maxAllowedDiscrepancy <= 0}
                        value={newClosingAdjAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setNewClosingAdjAmount('');
                            return;
                          }
                          const num = parseFloat(val);
                          if (!isNaN(num)) {
                            if (num > maxAllowedDiscrepancy) {
                              setNewClosingAdjAmount(maxAllowedDiscrepancy > 0 ? String(maxAllowedDiscrepancy) : '');
                            } else if (num < 0) {
                              setNewClosingAdjAmount('0');
                            } else {
                              setNewClosingAdjAmount(val);
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddClosingAdjustment();
                          }
                        }}
                        placeholder={`Max ${maxAllowedDiscrepancy.toFixed(2)}`}
                        className="w-24 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 font-mono text-[11px] font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                      <input
                        type="text"
                        value={newClosingAdjDesc}
                        onChange={(e) => setNewClosingAdjDesc(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddClosingAdjustment();
                          }
                        }}
                        placeholder="Reason"
                        className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        disabled={
                          !newClosingAdjAmount ||
                          Number(newClosingAdjAmount) <= 0 ||
                          Number(newClosingAdjAmount) > maxAllowedDiscrepancy + 0.001 ||
                          !newClosingAdjDesc.trim()
                        }
                        onClick={handleAddClosingAdjustment}
                        className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white px-2.5 py-1 text-[11px] font-bold transition"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {closingAdjustments.length > 0 && (
                      <div className="space-y-0.5">
                        {closingAdjustments.map((adj, idx) => (
                          <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-mono font-bold ${adj.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {adj.amount > 0 ? '+' : ''}{adj.amount.toFixed(2)} SAR
                              </span>
                              <span className="text-slate-500 dark:text-slate-400 text-[10px]">{adj.description}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setClosingAdjustments((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-slate-400 hover:text-rose-500 transition"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* Premium & Informative Parked Orders Modal (2-Column Grid Style) */}
      <Modal
        isOpen={isHeldModalOpen}
        onClose={() => setIsHeldModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <PauseCircle className="h-5 w-5 text-amber-500" />
            <span>Parked Orders ({heldSalesList.length})</span>
          </div>
        }
        subtitle="Manage and resume parked customer sales carts"
        maxWidth="2xl"
      >
        <div className="max-h-[65vh] overflow-y-auto pr-1">
          {heldSalesList.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <FolderOpen className="h-6 w-6 opacity-60" />
              </div>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No Parked Orders in Drawer</p>
              <p className="text-[11px] text-slate-400">Press F4 or click Hold on any active cart to park an order</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {heldSalesList.map((h, idx) => {
                const orderTotal = h.cart.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0);
                const totalUnits = h.cart.reduce((s: number, i: any) => s + i.quantity, 0);

                return (
                  <div
                    key={idx}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-3 transition hover:border-blue-500 dark:hover:border-sky-500"
                  >
                    {/* Top Row: Ref, Timestamp & Amount */}
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-lg bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 font-mono text-[11px] font-black text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
                          {h.reference}
                        </span>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3 inline text-slate-400" />
                          <span>{new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-mono text-xs font-black text-blue-700 dark:text-sky-400">
                          {formatCurrency(orderTotal)}
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Items List */}
                    <div className="space-y-1 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-100 dark:border-slate-850 text-xs min-h-[64px]">
                      <div className="text-[9px] font-bold text-slate-400 uppercase flex justify-between">
                        <span>{h.cart.length} lines • {totalUnits} items</span>
                      </div>
                      <div className="space-y-0.5 max-h-20 overflow-y-auto pr-0.5">
                        {h.cart.map((item: any, itemIdx: number) => (
                          <div key={itemIdx} className="flex justify-between items-center text-[10px]">
                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                              {item.quantity}× {item.name}
                            </span>
                            <span className="font-mono text-slate-500 dark:text-slate-400">
                              {formatCurrency(item.unitPrice * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex items-center justify-between pt-1 gap-2">
                      <button
                        type="button"
                        onClick={() => deleteHeldSale(idx)}
                        className="flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Discard</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => resumeHeldSale(idx)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 dark:bg-sky-500 dark:hover:bg-sky-400 px-3 py-1.5 text-xs font-bold text-white dark:text-slate-950 shadow-sm transition"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Resume (F7)</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Manager Sales Executive PIN Verification Modal */}
      <Modal
        isOpen={isManagerPinUnlockOpen}
        onClose={() => router.push('/dashboard')}
        showCloseButton={false}
        title={
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-blue-600 dark:text-sky-400" />
            <span>Sales Executive Till Verification</span>
          </div>
        }
        subtitle="Managers must authenticate with their 5-digit PIN to operate the POS terminal as a Sales Executive"
        maxWidth="sm"
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => router.push('/dashboard')}
            >
              Back to Dashboard
            </Button>
            <Button
              variant="primary"
              size="md"
              isLoading={managerPinLoading}
              onClick={() => handleManagerPinSubmit()}
            >
              Verify PIN & Open Till
            </Button>
          </div>
        }
      >
        <form onSubmit={handleManagerPinSubmit} className="space-y-4">
          {managerPinError && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{managerPinError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Enter Your 5-Digit PIN Code *
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={5}
              autoFocus
              value={managerUnlockPin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 5);
                setManagerUnlockPin(val);
                if (val.length === 5) {
                  setManagerPinError(null);
                }
              }}
              placeholder="•••••"
              className="w-full text-center font-mono text-3xl font-black tracking-[0.5em] py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-400 text-center mt-2">
              Zero-Privilege POS: This session will operate with Sales Executive till permissions
            </p>
          </div>
        </form>
      </Modal>

      {/* Open Cash Shift Modal with Carry-Forward (Premium Dual-Balance) */}
      <Modal
        isOpen={isOpenShiftModal}
        onClose={() => {}}
        showCloseButton={false}
        maxWidth="md"
        className="scale-105 sm:scale-110 origin-center my-auto transition-transform"
        bodyClassName="p-0"
      >
        {(() => {
          // --- Computed values for the opening shift modal ---
          const expectedCash = carryForwardData?.carryForwardBalance ?? 0;
          const expectedCard = carryForwardData?.carryForwardCardBalance ?? 0;
          const actualCash = Number(openingFloat) || 0;
          const actualCard = Number(openingCardFloat) || 0;
          const cashDiff = actualCash - expectedCash;
          const cardDiff = actualCard - expectedCard;
          const totalDiscrepancy = Math.abs(cashDiff) + Math.abs(cardDiff);
          const hasDiscrepancy = carryForwardData?.hasLastSession && totalDiscrepancy > 0.009;
          const adjSum = openingAdjustments.reduce((s, a) => s + Math.abs(a.amount), 0);
          const isReconciled = Math.abs(adjSum - totalDiscrepancy) < 0.01;
          const remainingDiscrepancy = Math.max(0, Math.round((totalDiscrepancy - adjSum) * 100) / 100);
          const canSubmit = !hasDiscrepancy || isReconciled;

          // Sanitize cashier name: strip "(Manager)", "(Cashier)" etc.
          const sanitizeName = (n: string) => n?.replace(/\s*\(.*?\)\s*/g, '').trim() || n;

          // Custom timestamp format: "14 Jun, 02:40 PM"
          const formatCarryDate = (d: string | Date) => {
            const dt = new Date(d);
            if (isNaN(dt.getTime())) return '';
            const day = dt.getDate().toString().padStart(2, '0');
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const mon = months[dt.getMonth()];
            let h = dt.getHours();
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            const min = dt.getMinutes().toString().padStart(2, '0');
            return `${day} ${mon}, ${h.toString().padStart(2, '0')}:${min} ${ampm}`;
          };

          // Dynamic quick amount presets based on active field's expected value (always exactly 6 amounts)
          const computeQuickAmounts = (expected: number): number[] => {
            if (expected <= 0) return [50, 100, 200, 300, 500, 1000];
            const base = Math.round(expected);
            const candidates = new Set<number>();
            const steps = [50, 100, 200, 500];
            for (const s of steps) {
              const lower = Math.floor(base / s) * s;
              const upper = lower + s;
              if (lower > 0) candidates.add(lower);
              if (upper > 0) candidates.add(upper);
            }
            candidates.add(Math.round(base / 10) * 10);
            candidates.add(Math.round(base / 50) * 50);
            candidates.add(base);
            [50, 100, 200, 500, 1000, 2000].forEach(n => candidates.add(n));
            const arr = Array.from(candidates)
              .filter(v => v > 0)
              .sort((a, b) => a - b);
            const baseIdx = arr.indexOf(base);
            let start = Math.max(0, baseIdx - 2);
            if (start + 6 > arr.length) start = Math.max(0, arr.length - 6);
            return arr.slice(start, start + 6);
          };

          const activeExpected = activeOpeningField === 'cash' ? expectedCash : expectedCard;
          const quickAmounts = computeQuickAmounts(activeExpected);
          const activeValue = activeOpeningField === 'cash' ? openingFloat : openingCardFloat;
          const setActiveValue = activeOpeningField === 'cash' ? setOpeningFloat : setOpeningCardFloat;
          const activeRef = activeOpeningField === 'cash' ? openingFloatInputRef : openingCardInputRef;

          return (
            <form onSubmit={handleOpenShift} className="p-4 sm:p-5 space-y-3">
              {/* Premium Compact Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <Banknote className="h-4.5 w-4.5" />
                  </div>
                  <div className="space-y-0">
                    <h3 className="text-sm font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                      {carryForwardData?.hasLastSession ? 'Opening Cash Count' : 'Opening Cash Float'}
                    </h3>
                    <p className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 leading-tight">
                      {carryForwardData?.hasLastSession 
                        ? `Carried over from ${sanitizeName(carryForwardData.lastClosedBy)}`
                        : 'Count physical cash in till drawer to begin'}
                    </p>
                  </div>
                </div>
                {/* Blinking dot only — no "Live Till" text */}
                <div className="relative flex h-3.5 w-3.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900 rounded-xl text-xs">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Carry-Forward Info Card (Compact) */}
              {carryForwardData?.hasLastSession && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Expected Carry-Forward</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-300">
                        <Banknote className="inline h-3 w-3 mr-0.5 -mt-0.5" />{expectedCash.toFixed(2)}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">|</span>
                      <span className="font-mono text-[11px] font-bold text-purple-600 dark:text-purple-300">
                        <CreditCard className="inline h-3 w-3 mr-0.5 -mt-0.5" />{expectedCard.toFixed(2)}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">SAR</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400">
                    <span>Previous Cashier: <strong className="text-slate-700 dark:text-slate-200">{sanitizeName(carryForwardData.lastClosedBy)}</strong></span>
                    <span>{carryForwardData.lastClosedAt ? formatCarryDate(carryForwardData.lastClosedAt) : ''}</span>
                  </div>
                </div>
              )}

              {/* Dual Balance Inputs */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Cash Input */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                      <Banknote className="h-3 w-3 text-emerald-500" />
                      {carryForwardData?.hasLastSession ? 'Cash in Drawer' : 'Starting Cash'}
                    </span>
                  </div>
                  <div className={`relative flex items-center rounded-xl border-2 transition px-3 py-2 ${
                    activeOpeningField === 'cash'
                      ? 'border-emerald-500 ring-2 ring-emerald-500/15 bg-emerald-50/30 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90'
                  }`}>
                    <input
                      ref={openingFloatInputRef}
                      type="number"
                      step="0.01"
                      min="0"
                      autoFocus
                      value={openingFloat === 0 ? '' : openingFloat}
                      onChange={(e) => setOpeningFloat(parseFloat(e.target.value) || 0)}
                      onFocus={() => setActiveOpeningField('cash')}
                      placeholder="0.00"
                      className="w-full bg-transparent font-mono text-xl font-black text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:outline-none"
                    />
                    <span className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400 pl-1 select-none whitespace-nowrap">SAR</span>
                  </div>
                  {carryForwardData?.hasLastSession && (
                    <p className="font-mono text-[10px] text-slate-400 text-center">
                      {actualCash.toFixed(2)}/{expectedCash.toFixed(2)} SAR
                    </p>
                  )}
                </div>

                {/* Card Input */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                      <CreditCard className="h-3 w-3 text-purple-500" />
                      Card Balance
                    </span>
                  </div>
                  <div className={`relative flex items-center rounded-xl border-2 transition px-3 py-2 ${
                    activeOpeningField === 'card'
                      ? 'border-purple-500 ring-2 ring-purple-500/15 bg-purple-50/30 dark:bg-purple-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90'
                  }`}>
                    <input
                      ref={openingCardInputRef}
                      type="number"
                      step="0.01"
                      min="0"
                      value={openingCardFloat === 0 ? '' : openingCardFloat}
                      onChange={(e) => setOpeningCardFloat(parseFloat(e.target.value) || 0)}
                      onFocus={() => setActiveOpeningField('card')}
                      placeholder="0.00"
                      className="w-full bg-transparent font-mono text-xl font-black text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:outline-none"
                    />
                    <span className="font-mono text-[10px] font-bold text-purple-600 dark:text-purple-400 pl-1 select-none whitespace-nowrap">SAR</span>
                  </div>
                  {carryForwardData?.hasLastSession && (
                    <p className="font-mono text-[10px] text-slate-400 text-center">
                      {actualCard.toFixed(2)}/{expectedCard.toFixed(2)} SAR
                    </p>
                  )}
                </div>
              </div>

              {/* 6 Quick Amount Presets (Always 6 amounts, no label) */}
              <div className="grid grid-cols-6 gap-1.5">
                {quickAmounts.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setActiveValue(amt);
                      activeRef.current?.focus();
                    }}
                    className={`rounded-lg border py-2 font-mono text-xs font-bold transition ${
                      Number(activeValue) === amt
                        ? activeOpeningField === 'cash'
                          ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/20'
                          : 'border-purple-500 bg-purple-500 text-white shadow-sm shadow-purple-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {amt}
                  </button>
                ))}
              </div>

              {/* Strict Float Discrepancy Reconciliation */}
              {hasDiscrepancy && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/40 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 dark:text-amber-200">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Float Discrepancy</span>
                    </div>
                    <span className={`font-mono text-[11px] font-black px-2.5 py-0.5 rounded-md ${
                      isReconciled
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {adjSum.toFixed(2)}/{totalDiscrepancy.toFixed(2)} SAR
                    </span>
                  </div>

                  {/* Adjustment Entry */}
                  <div className="space-y-1.5">
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={remainingDiscrepancy}
                        disabled={remainingDiscrepancy <= 0}
                        value={newOpeningAdjAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setNewOpeningAdjAmount('');
                            return;
                          }
                          const num = parseFloat(val);
                          if (!isNaN(num)) {
                            if (num > remainingDiscrepancy) {
                              setNewOpeningAdjAmount(remainingDiscrepancy);
                            } else if (num < 0) {
                              setNewOpeningAdjAmount(0);
                            } else {
                              setNewOpeningAdjAmount(val);
                            }
                          }
                        }}
                        placeholder={`Max ${remainingDiscrepancy.toFixed(2)}`}
                        className="w-24 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 font-mono text-[11px] font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                      <input
                        type="text"
                        value={newOpeningAdjDesc}
                        onChange={(e) => setNewOpeningAdjDesc(e.target.value)}
                        placeholder="Reason"
                        className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        disabled={!newOpeningAdjAmount || Number(newOpeningAdjAmount) <= 0 || Number(newOpeningAdjAmount) > remainingDiscrepancy + 0.001 || !newOpeningAdjDesc.trim()}
                        onClick={() => {
                          const amt = Number(newOpeningAdjAmount);
                          if (amt > 0 && amt <= remainingDiscrepancy + 0.001 && newOpeningAdjDesc.trim()) {
                            setOpeningAdjustments(prev => [...prev, {
                              amount: Math.min(amt, remainingDiscrepancy),
                              description: newOpeningAdjDesc.trim(),
                            }]);
                            setNewOpeningAdjAmount('');
                            setNewOpeningAdjDesc('');
                          }
                        }}
                        className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white px-2.5 py-1 text-[11px] font-bold transition"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>


                    {openingAdjustments.length > 0 && (
                      <div className="space-y-0.5">
                        {openingAdjustments.map((adj, idx) => (
                          <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-mono font-bold ${adj.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {adj.amount > 0 ? '+' : ''}{adj.amount.toFixed(2)} SAR
                              </span>
                              <span className="text-slate-500 dark:text-slate-400 text-[10px]">{adj.description}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setOpeningAdjustments(prev => prev.filter((_, i) => i !== idx))}
                              className="text-slate-400 hover:text-rose-500 transition"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Open Shift Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={!canSubmit}
                className={`w-full font-black uppercase tracking-wider text-xs h-11 rounded-xl transition ${
                  canSubmit
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25'
                    : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                }`}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                {hasDiscrepancy && !isReconciled
                  ? `Reconcile ${(totalDiscrepancy - adjSum).toFixed(2)} SAR to Continue`
                  : 'Open Shift & Start POS'}
              </Button>
            </form>
          );
        })()}
      </Modal>

      {/* LEFT PANE: PRODUCT CATALOG & SEARCH GRID */}
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-100 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800">
        {/* Uniform Height Top Header Bar (h-14 / 56px) */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 shadow-sm">
          {/* Left: Brand, Store Name & POS Till / Float Info */}
          <div className="flex items-center gap-3">
            <Link
              href="/pos"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 dark:bg-sky-500 text-white dark:text-slate-950 shadow-md transition hover:scale-105"
            >
              <Store className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">
                  {settings.shop_name_en || 'AL-NOOR SUPERMARKET'}
                </span>
              </div>
              <div
                className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[220px] sm:max-w-xs mt-0.5"
                title={settings.shop_address || 'King Fahd Road, Riyadh, Saudi Arabia'}
              >
                {settings.shop_address || 'King Fahd Road, Riyadh, Saudi Arabia'}
              </div>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Direct Reprint Last Receipt (Native Printer) */}
            {completedSaleData && (
              <button
                type="button"
                onClick={() => printThermalReceipt(completedSaleData, settings)}
                title="Reprint Last Invoice Directly to Native Printer"
                className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-blue-500 dark:hover:border-sky-400 transition"
              >
                <Printer className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" />
                <span className="hidden xl:inline text-[11px]">Reprint Last</span>
              </button>
            )}

            {/* Fullscreen Toggle Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-500 dark:hover:border-sky-400 transition"
            >
              {isFullscreen ? <Minimize className="h-4 w-4 text-sky-500" /> : <Maximize className="h-4 w-4" />}
            </button>

            {/* Font Scaling 100% / 110% Switcher */}
            <div className="flex h-9 items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px] font-bold font-mono">
              <button
                type="button"
                onClick={() => setFontSizeScale('100%')}
                className={`h-full rounded-lg px-2.5 transition flex items-center justify-center ${
                  fontSizeScale === '100%' || fontSizeScale === '1.0'
                    ? 'bg-blue-700 text-white shadow-sm dark:bg-sky-500 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                100%
              </button>
              <button
                type="button"
                onClick={() => setFontSizeScale('110%')}
                className={`h-full rounded-lg px-2.5 transition flex items-center justify-center ${
                  fontSizeScale === '110%' || fontSizeScale === '1.1'
                    ? 'bg-blue-700 text-white shadow-sm dark:bg-sky-500 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                110%
              </button>
            </div>

            {/* Theme Switcher Button */}
            <button
              type="button"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-500 dark:hover:border-sky-400 transition"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
            </button>

            {/* Live Clock Badge */}
            <div className="hidden md:flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200">
              <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" />
              <span>{currentTime || '00:00:00'}</span>
            </div>

            {/* Cashier Profile Badge: Name, Shift Start & Duration, Role */}
            <div className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs shadow-sm">
              <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <div className="flex flex-col text-left justify-center">
                <span className="font-bold text-slate-900 dark:text-slate-100 text-[11px] leading-tight truncate max-w-[120px]">
                  {formatTwoWords(user?.fullName || user?.full_name || user?.username)}
                </span>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 leading-tight mt-0.5">
                  <Clock className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                  <span>{sessionDuration}</span>
                </span>
              </div>
              <span className="rounded bg-blue-100 dark:bg-sky-950 px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase text-blue-800 dark:text-sky-300 ml-1 shrink-0">
                {user?.actualRole === 'manager' ? 'Manager Shift' : 'Cashier'}
              </span>
            </div>

            {/* Logout / Shift Summary Button */}
            <button
              type="button"
              title="Session Summary & Lock / Log Out"
              onClick={handleOpenLogoutSummary}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Error / Alert Banner */}
        {errorMsg && (
          <div className="flex items-center justify-between bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-bold shadow-md animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="p-0.5 hover:bg-amber-600 rounded">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Search Box & Sorting Toolbar */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-wrap sm:flex-nowrap items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Scan barcode gun or search product name / SKU / PLU (F2)..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 pl-10 pr-16 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 dark:focus:border-sky-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition shadow-inner"
            />
            <div className="absolute right-3 top-2.5 flex items-center gap-1">
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <span className="rounded bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-500 dark:text-slate-400">
                  F2
                </span>
              )}
            </div>
          </div>

          {/* Premium Sorting Pills with Perfect Contrast */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setSortBy('fast_moving')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                sortBy === 'fast_moving'
                  ? 'bg-blue-700 text-white shadow-md dark:bg-sky-500 dark:text-slate-950'
                  : 'border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              <span>Top Moving</span>
            </button>

            <button
              onClick={() => setSortBy('name')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                sortBy === 'name'
                  ? 'bg-blue-700 text-white shadow-md dark:bg-sky-500 dark:text-slate-950'
                  : 'border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <ArrowDownAZ className="h-3.5 w-3.5" />
              <span>Name</span>
            </button>

            <button
              onClick={() => setSortBy(sortBy === 'price_asc' ? 'price_desc' : 'price_asc')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                sortBy.startsWith('price')
                  ? 'bg-blue-700 text-white shadow-md dark:bg-sky-500 dark:text-slate-950'
                  : 'border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {sortBy === 'price_desc' ? (
                <ArrowDown10 className="h-3.5 w-3.5" />
              ) : (
                <ArrowUp10 className="h-3.5 w-3.5" />
              )}
              <span>Price</span>
            </button>
          </div>
        </div>

        {/* Product Catalog Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {filteredAndSortedProducts.map((p) => {
              const stockVal = Number(p.current_stock ?? 100);
              const isOutOfStock = stockVal <= 0;
              const unitLabel = p.unit_short || p.unit_name || 'pcs';

              return (
                <button
                  key={p.id}
                  disabled={isOutOfStock}
                  onClick={() => addToCart(p, 1)}
                  className={`group relative flex flex-col justify-between rounded-2xl border p-3 text-left shadow-sm transition-all duration-200 ${
                    isOutOfStock
                      ? 'border-rose-200 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/20 opacity-50 cursor-not-allowed'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-sky-400 hover:-translate-y-1 hover:shadow-lg'
                  }`}
                >
                  {/* Image Container with Fallback */}
                  <div className="relative mb-2.5 h-28 w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-108"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                          const parent = (e.target as HTMLElement).parentElement;
                          if (parent) {
                            const fallback = document.createElement('div');
                            fallback.className = 'flex flex-col items-center justify-center text-slate-400';
                            fallback.innerHTML = '<span class="text-[9px] font-bold">No Image</span>';
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <Package className="h-8 w-8 stroke-1 opacity-50" />
                        <span className="text-[9px] font-bold mt-1 text-slate-400">No Image</span>
                      </div>
                    )}

                    {/* Stock Badge (Top-Right) */}
                    <div className="absolute top-2 right-2">
                      {isOutOfStock ? (
                        <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[8px] font-black text-white uppercase shadow-sm">
                          Out of Stock
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-900/80 backdrop-blur-sm px-2 py-0.5 font-mono text-[9px] font-bold text-white shadow-sm">
                          {stockVal.toFixed(0)} {unitLabel}
                        </span>
                      )}
                    </div>

                    {/* PLU Badge (Bottom-Left) */}
                    {p.plu_code && (
                      <div className="absolute bottom-2 left-2">
                        <span className="rounded bg-amber-500/90 text-slate-950 px-1.5 py-0.5 font-mono text-[9px] font-black shadow-sm">
                          PLU {p.plu_code}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Product Code / SKU Search Slug */}
                  <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">
                    <Tag className="h-3 w-3" />
                    <span>{p.sku || p.barcode || 'N/A'}</span>
                  </div>

                  {/* Product Title */}
                  <div className="font-bold text-xs text-slate-900 dark:text-white line-clamp-2 leading-snug mt-0.5">
                    {p.name}
                  </div>

                  {/* Price & Unit Row */}
                  <div className="flex items-baseline justify-between w-full mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="font-mono text-sm font-black text-blue-700 dark:text-sky-400">
                      {formatCurrency(p.selling_price)}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-medium">
                      / {unitLabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT PANE: ULTRA-PREMIUM WIDE SHOPPING CART (w-[460px]) */}
      <div className="flex w-[460px] shrink-0 flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl transition-colors">
        {/* Cart Header */}
        <div className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-blue-700 dark:text-sky-400" />
            <span className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight">
              Active Cart
            </span>
            <span className="rounded-full bg-blue-100 dark:bg-sky-950 px-2.5 py-0.5 font-mono text-[11px] font-black text-blue-700 dark:text-sky-300">
              {totals.totalUnits} items
            </span>
          </div>

          {/* Premium Clear Cart Button */}
          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 px-2.5 py-1 rounded-lg transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear Cart</span>
            </button>
          )}
        </div>

        {/* Dynamic Cart Item Rows (Compact Gap) */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 p-3">
          {cart.length === 0 ? (
            <div className="flex h-72 flex-col items-center justify-center text-center text-slate-400 space-y-2.5">
              <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 p-4">
                <ShoppingCart className="h-10 w-10 text-slate-400 opacity-60" />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Cart is Empty</p>
              <p className="text-xs text-slate-400 max-w-[220px]">
                Click items on the left catalog or scan barcode gun to add items
              </p>
            </div>
          ) : (
            cart.map((item) => {
              const lineTotal = item.unitPrice * item.quantity;
              return (
                <div
                  key={item.productId}
                  className="py-2 flex items-center justify-between gap-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 px-2 rounded-xl transition"
                >
                  {/* Left: Name and Price / Unit */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white truncate text-xs leading-snug">
                      {item.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {formatCurrency(item.unitPrice)} / {item.unitName || 'unit'}
                    </div>
                  </div>

                  {/* Right: Stepper, Line Total, Remove */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    {/* Qty Stepper */}
                    <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-0.5 shadow-sm">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, -1)}
                        className="h-6 w-6 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="font-mono text-xs font-black min-w-[28px] text-center px-1 text-slate-900 dark:text-white">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, 1)}
                        className="h-6 w-6 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Bold Line Total */}
                    <div className="font-mono text-xs font-black text-slate-900 dark:text-white min-w-[70px] text-right">
                      {formatCurrency(lineTotal)}
                    </div>

                    {/* Delete Item */}
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.productId)}
                      className="text-slate-400 hover:text-rose-600 transition p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Calculation Summary & Centered Pay Now Button per DesignSystem.md */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-3">
          {/* Subtotal & 15% Output VAT Breakdown Card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2 text-xs shadow-sm">
            <div className="flex justify-between text-slate-500 dark:text-slate-400 font-medium">
              <span>Subtotal (Taxable Base):</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                {formatCurrency(totals.subtotal)}
              </span>
            </div>

            <div className="flex justify-between text-slate-500 dark:text-slate-400 font-medium">
              <span>{settings.tax_label || 'Output VAT (15%)'}:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                {formatCurrency(totals.totalTax)}
              </span>
            </div>

            {/* Total Due */}
            <div className="flex items-baseline justify-between border-t border-slate-100 dark:border-slate-800 pt-2 font-black">
              <span className="text-xs uppercase tracking-tight text-slate-900 dark:text-white">
                TOTAL DUE:
              </span>
              <span className="font-mono text-2xl text-blue-700 dark:text-sky-400">
                {formatCurrency(totals.grandTotal)}
              </span>
            </div>
          </div>

          {/* PAY NOW Button matching DesignSystem.md (Center aligned with F9 shortcut) */}
          <button
            type="button"
            id="btn-pay-now"
            disabled={cart.length === 0}
            onClick={() => setIsTenderOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed py-3.5 px-4 font-bold text-white shadow-md shadow-emerald-700/20 transition duration-150 text-sm"
          >
            <Zap className="h-4 w-4 fill-current text-amber-300" />
            <span className="font-black uppercase tracking-wider">
              PAY NOW ({formatCurrency(totals.grandTotal)})
            </span>
            <span className="rounded bg-black/25 px-2 py-0.5 font-mono text-xs font-black ms-1">
              F9
            </span>
          </button>

          {/* Park / Parked Orders Secondary Actions */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={handleHoldCart}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 py-2 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 disabled:opacity-50 transition"
            >
              <PauseCircle className="h-4 w-4" />
              <span>Hold (F4)</span>
            </button>

            <button
              type="button"
              onClick={openHeldModal}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 py-2 text-xs font-bold transition"
            >
              <FolderOpen className="h-4 w-4 text-blue-600 dark:text-sky-400" />
              <span>Parked ({heldSalesList.length}) (F7)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
