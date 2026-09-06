'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Package, ShoppingCart, Users, Truck, LayoutDashboard, Settings, FileText, ArrowRight, X } from 'lucide-react';
import { apiRequest } from '@/lib/api';

export interface GlobalSearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchPalette: React.FC<GlobalSearchPaletteProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ products: any[]; customers: any[] }>({ products: [], customers: [] });
  const [loading, setLoading] = useState(false);

  const quickNav = [
    { label: 'POS Terminal', href: '/pos', icon: ShoppingCart, category: 'App Navigation' },
    { label: 'Manager Dashboard', href: '/dashboard', icon: LayoutDashboard, category: 'App Navigation' },
    { label: 'Product Catalog', href: '/products', icon: Package, category: 'App Navigation' },
    { label: 'Purchases & Stock Receipts', href: '/purchases', icon: Truck, category: 'App Navigation' },
    { label: 'Customer Due Accounts', href: '/customers', icon: Users, category: 'App Navigation' },
    { label: 'Financial & VAT Reports', href: '/reports', icon: FileText, category: 'App Navigation' },
    { label: 'System Customizer & Settings', href: '/settings', icon: Settings, category: 'App Navigation' },
  ];

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults({ products: [], customers: [] });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ products: [], customers: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const prodRes = await apiRequest(`/products?search=${encodeURIComponent(query)}`);
        const custRes = await apiRequest(`/ledgers/customers?search=${encodeURIComponent(query)}`);
        setResults({
          products: prodRes.success ? (prodRes.data || []).slice(0, 5) : [],
          customers: custRes.success ? (custRes.data || []).slice(0, 5) : [],
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const navigateTo = (href: string) => {
    onClose();
    router.push(href);
  };

  const filteredNav = quickNav.filter((n) => n.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-10 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 px-4 py-3.5">
          <Search className="h-5 w-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search anything (Products, SKU, Customers, Navigation, Settings)..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
          <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-500">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="py-6 text-center text-xs text-slate-400 animate-pulse">
              Searching catalogue and records...
            </div>
          )}

          {/* Quick Navigation Items */}
          {filteredNav.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
                Quick Navigation
              </div>
              <div className="space-y-1">
                {filteredNav.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => navigateTo(item.href)}
                      className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-sky-950/30 hover:text-blue-600 dark:hover:text-sky-400 transition group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-sky-400" />
                        <span>{item.label}</span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Products Results */}
          {results.products.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
                Products & Catalog
              </div>
              <div className="space-y-1">
                {results.products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigateTo('/products')}
                    className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-sky-950/30 transition group"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">{p.name}</div>
                      <div className="text-[11px] text-slate-400">SKU: {p.sku} | Barcode: {p.barcode || 'N/A'}</div>
                    </div>
                    <div className="font-mono font-bold text-blue-600 dark:text-sky-400">
                      {p.selling_price} SAR
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Customers Results */}
          {results.customers.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
                Customers & Credit Accounts
              </div>
              <div className="space-y-1">
                {results.customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigateTo('/customers')}
                    className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-sky-950/30 transition group"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">{c.name}</div>
                      <div className="text-[11px] text-slate-400">Phone: {c.phone || 'N/A'}</div>
                    </div>
                    <div className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
                      Due: {c.current_balance || '0.00'} SAR
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
