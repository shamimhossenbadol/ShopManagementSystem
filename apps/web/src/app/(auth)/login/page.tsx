'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { Store, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { settings } = useSettings();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    setLoading(false);

    if (res.success && res.data?.user) {
      if (res.data.user.role === 'manager') {
        router.push('/dashboard');
      } else {
        router.push('/pos');
      }
    } else {
      setError(res.message || 'Login failed.');
    }
  };

  const setDemoUser = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 shadow-2xl text-slate-900 dark:text-white transition-colors">
        {/* Shop Logo & Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
            <Store className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            {settings.shop_name_en || 'AL-NOOR SUPERMARKET & HYPERMARKET'}
          </h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
            {settings.shop_name_ar || 'AL-NOOR RETAIL POS'} • POS & Inventory Suite (KSA)
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 pl-10 pr-4 text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                placeholder="Enter username"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 pl-10 pr-4 text-xs font-mono text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                placeholder="Enter password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Sign In to Super Shop'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Quick Demo Credentials */}
        <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-6">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">
            Quick Demo Accounts
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDemoUser('admin', 'admin123')}
              className="rounded-xl border border-purple-200 dark:border-purple-900/40 bg-purple-50 dark:bg-purple-950/30 p-2.5 text-left text-xs text-purple-900 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition"
            >
              <div className="font-bold">Manager</div>
              <div className="text-[11px] text-purple-600 dark:text-purple-400 font-mono">admin / admin123</div>
            </button>
            <button
              type="button"
              onClick={() => setDemoUser('cashier1', 'sales123')}
              className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/30 p-2.5 text-left text-xs text-blue-900 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
            >
              <div className="font-bold">Cashier (POS)</div>
              <div className="text-[11px] text-blue-600 dark:text-blue-400 font-mono">cashier1 / sales123</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
