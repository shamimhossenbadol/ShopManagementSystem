'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
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
  ZoomIn,
  ZoomOut,
  Sliders,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'POS Terminal', href: '/pos', icon: ShoppingCart },
  { label: 'Products', href: '/products', icon: Package },
  { label: 'Batches & Expiry', href: '/batches', icon: CalendarDays },
  { label: 'Promotions & Deals', href: '/promotions', icon: Percent },
  { label: 'Inventory & Stock', href: '/inventory', icon: Boxes },
  { label: 'Purchases', href: '/purchases', icon: Truck },
  { label: 'Customers & Due', href: '/customers', icon: Users },
  { label: 'Suppliers & Payables', href: '/suppliers', icon: Building2 },
  { label: 'Expenses', href: '/expenses', icon: ReceiptText },
  { label: 'Returns', href: '/returns', icon: RotateCcw },
  { label: 'Cash Drawer Shifts', href: '/cash', icon: Banknote },
  { label: 'Financial & VAT Reports', href: '/reports', icon: FileSpreadsheet },
  { label: 'Audit Logs', href: '/audit-logs', icon: ShieldAlert },
  { label: 'Staff Management', href: '/users', icon: UserCog },
  { label: 'System Customizer & Settings', href: '/settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const { settings, theme, toggleTheme, fontSizeScale, setFontSizeScale } = useSettings();

  useEffect(() => {
    async function checkAuth() {
      const res = await apiRequest('/auth/me');
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        if (res.data.user.role !== 'manager' && pathname !== '/pos' && pathname !== '/cash') {
          router.replace('/pos');
        }
      } else {
        router.replace('/login');
      }
    }
    checkAuth();
  }, [router, pathname]);

  const handleLogout = async () => {
    await apiRequest('/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const handleFontZoom = (delta: number) => {
    const scales = ['90%', '100%', '110%', '120%', '130%'];
    const currentIndex = scales.indexOf(fontSizeScale || '100%');
    const newIndex = Math.max(0, Math.min(scales.length - 1, currentIndex + delta));
    setFontSizeScale(scales[newIndex]);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Sidebar Navigation */}
      <aside className="flex w-64 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20">
              <Store className="h-5 w-5" />
            </div>
            <div className="overflow-hidden">
              <h1 className="text-xs font-black tracking-wide text-slate-900 dark:text-white uppercase truncate">
                {settings.shop_name_en || 'AL-NOOR SUPERMARKET & HYPERMARKET'}
              </h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold truncate">
                {settings.shop_name_ar || 'AL-NOOR RETAIL POS'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Accessibility & Theme Toolbar */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 px-4 py-2">
          {/* UI Zoom Controls */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Scale:</span>
            <button
              onClick={() => handleFontZoom(-1)}
              title="Decrease Font Size (Zoom Out)"
              className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 transition"
            >
              <ZoomOut className="h-3 w-3" />
            </button>
            <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 min-w-[32px] text-center">
              {fontSizeScale || '100%'}
            </span>
            <button
              onClick={() => handleFontZoom(1)}
              title="Increase Font Size (Zoom In)"
              className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 transition"
            >
              <ZoomIn className="h-3 w-3" />
            </button>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[10px]">Light</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-[10px]">Dark</span>
              </>
            )}
          </button>
        </div>

        {/* Links Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Logout */}
        <div className="border-t border-slate-100 dark:border-slate-800 p-4">
          <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-bold shadow-sm">
              {user?.fullName?.charAt(0) || 'M'}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">{user?.fullName || 'Manager'}</div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase">{user?.role?.replace('_', ' ') || 'Admin'}</div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 transition"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
