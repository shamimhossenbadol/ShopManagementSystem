'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { apiRequest, notifyAuthLogout } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { useSessionSync } from '@/hooks/useSessionSync';
import { GlobalSearchPalette } from '@/components/ui/GlobalSearchPalette';
import SwitchToPosModal from '@/components/dashboard/SwitchToPosModal';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  CalendarDays,
  Percent,
  Boxes,
  Truck,
  Users,
  Building2,
  ReceiptText,
  RotateCcw,
  Banknote,
  FileSpreadsheet,
  ShieldAlert,
  UserCog,
  Settings,
  LogOut,
  Store,
  Moon,
  Sun,
  Search,
  Clock,
  Circle,
  Menu,
  X,
  Type,
} from 'lucide-react';

interface NavGroup {
  groupName: string;
  items: {
    label: string;
    href: string;
    icon: any;
    badge?: string;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupName: 'Operations',
    items: [
      { label: 'POS Terminal', href: '/pos', icon: ShoppingCart },
      { label: 'Manager Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Cash Drawer Shifts', href: '/cash', icon: Banknote },
      { label: 'Returns & Credit Notes', href: '/returns', icon: RotateCcw },
    ],
  },
  {
    groupName: 'Catalog & Deals',
    items: [
      { label: 'Product Catalog', href: '/products', icon: Package },
      { label: 'Batches & Expiry', href: '/batches', icon: CalendarDays },
      { label: 'Promotions & Deals', href: '/promotions', icon: Percent },
      { label: 'Inventory & Stock Ledger', href: '/inventory', icon: Boxes },
    ],
  },
  {
    groupName: 'Procurement & Relations',
    items: [
      { label: 'Purchases & Receiving', href: '/purchases', icon: Truck },
      { label: 'Suppliers & Payables', href: '/suppliers', icon: Building2 },
      { label: 'Customers & CRM Due', href: '/customers', icon: Users },
      { label: 'Operating Expenses', href: '/expenses', icon: ReceiptText },
    ],
  },
  {
    groupName: 'Reports & Governance',
    items: [
      { label: 'Financial & VAT Reports', href: '/reports', icon: FileSpreadsheet },
      { label: 'Audit Security Logs', href: '/audit-logs', icon: ShieldAlert },
      { label: 'Staff Management', href: '/users', icon: UserCog },
      { label: 'System Customizer', href: '/settings', icon: Settings },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [activeShift, setActiveShift] = useState<any>(null);

  // Real-Time Multi-Device Session Invalidation Listener
  useSessionSync();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSwitchToPosOpen, setIsSwitchToPosOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const { settings, theme, toggleTheme, fontSizeScale, setFontSizeScale, formatTime } = useSettings();

  // Clock
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(formatTime(new Date()));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [formatTime]);

  // Auth & Permissions check
  useEffect(() => {
    async function checkAuth() {
      const res = await apiRequest('/auth/me');
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        setActiveShift(res.data.activeShift);
        if (res.data.user.role !== 'manager' && pathname !== '/pos' && pathname !== '/cash') {
          router.replace('/pos');
        }
      } else {
        router.replace('/login');
      }
    }
    checkAuth();
  }, [router, pathname]);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    notifyAuthLogout('MANUAL_LOGOUT');
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0;';
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('/login?logout=true');
  };

  const toggleScale = () => {
    const nextScale = fontSizeScale === '110%' ? '100%' : '110%';
    setFontSizeScale(nextScale);
  };

  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center space-y-3">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Authenticating Session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Global Search Palette (Ctrl+K) */}
      <GlobalSearchPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4">
          <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-700 dark:bg-sky-500 text-white dark:text-slate-950 font-bold shadow-md">
              <Store className="h-5 w-5" />
            </div>
            <div className="overflow-hidden">
              <h1 className="text-xs font-black tracking-tight text-slate-900 dark:text-white uppercase truncate">
                {settings.shop_name_en || 'AL-NOOR SUPERMARKET'}
              </h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold truncate">
                {settings.shop_name_ar || 'AL-NOOR RETAIL POS'}
              </p>
            </div>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Categorized Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {NAV_GROUPS.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              <div className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {group.groupName}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(e) => {
                      setMobileMenuOpen(false);
                      if (item.href === '/pos' && user?.role === 'manager') {
                        e.preventDefault();
                        setIsSwitchToPosOpen(true);
                      }
                    }}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-blue-700 text-white font-bold shadow-sm dark:bg-sky-500 dark:text-slate-950'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-current' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-sky-950 dark:text-sky-300 font-bold">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Profile & Logout Section */}
        <div className="border-t border-slate-100 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-white dark:bg-slate-800/80 p-2 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-700 dark:bg-sky-500 text-white dark:text-slate-950 text-xs font-bold">
                {user?.fullName?.charAt(0) || 'M'}
              </div>
              <div className="overflow-hidden">
                <div className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                  {user?.fullName || 'Manager'}
                </div>
                <div className="text-[10px] text-blue-600 dark:text-sky-400 font-bold uppercase">
                  {user?.role?.replace('_', ' ') || 'Manager'}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main App Container */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-6 shadow-sm z-10">
          {/* Left: Mobile Menu Toggle & Global Search Trigger */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:text-slate-700 rounded-xl border border-slate-200 dark:border-slate-700"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Quick Command Palette Button */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:border-blue-500 hover:text-slate-700 dark:hover:text-slate-200 transition sm:w-64"
            >
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline">Search (Products, SKU, Pages)...</span>
              <span className="sm:hidden">Search...</span>
              <span className="ml-auto hidden rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-400 sm:inline">
                Ctrl+K
              </span>
            </button>
          </div>

          {/* Right Controls: Shift Status, AST Clock, UI Scale, Theme Toggle, POS CTA */}
          <div className="flex items-center gap-2.5">
            {/* Shift Status Indicator */}
            {activeShift ? (
              <Link
                href="/cash"
                className="hidden sm:flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition"
              >
                <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500 animate-pulse" />
                <span>Shift #{activeShift.id} Active</span>
              </Link>
            ) : (
              <Link
                href="/cash"
                className="hidden sm:flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition"
              >
                <Circle className="h-2 w-2 fill-amber-500 text-amber-500" />
                <span>No Open Shift</span>
              </Link>
            )}

            {/* AST Real-time Clock */}
            <div className="hidden md:flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
              <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" />
              <span>{currentTime || '00:00:00'} AST</span>
            </div>

            {/* UI Font Scale Switcher (100% Standard / 110% Comfortable) */}
            <button
              onClick={toggleScale}
              title={`Toggle UI Scale (${fontSizeScale || '100%'} currently)`}
              className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <Type className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" />
              <span className="font-mono text-[11px]">{fontSizeScale || '100%'}</span>
            </button>

            {/* Theme Toggle (Light / Dark) */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-blue-600" />
              )}
            </button>

            {/* POS Fast Terminal Launcher */}
            <button
              type="button"
              onClick={() => {
                if (user?.role === 'manager') {
                  setIsSwitchToPosOpen(true);
                } else {
                  router.push('/pos');
                }
              }}
              className="flex items-center gap-1.5 rounded-xl bg-blue-700 dark:bg-sky-500 hover:bg-blue-800 dark:hover:bg-sky-400 px-3.5 py-1.5 text-xs font-bold text-white dark:text-slate-950 shadow-sm transition"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">POS Terminal</span>
            </button>
          </div>
        </header>

        {/* Scrollable Page Canvas */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      {/* Manager -> POS Role Demotion Warning Modal */}
      <SwitchToPosModal
        isOpen={isSwitchToPosOpen}
        onClose={() => setIsSwitchToPosOpen(false)}
      />
    </div>
  );
}
