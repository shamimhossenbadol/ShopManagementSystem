'use client';

import { useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { CreditCard, Banknote, X, Check } from 'lucide-react';

interface TenderModalProps {
  totalAmount: number;
  onConfirm: (payments: Array<{ paymentMethodId: number; amount: number }>) => void;
  onClose: () => void;
  loading: boolean;
}

export default function TenderModal({ totalAmount, onConfirm, onClose, loading }: TenderModalProps) {
  const { settings, formatCurrency } = useSettings();
  const [cashAmount, setCashAmount] = useState<number>(totalAmount);
  const [cardAmount, setCardAmount] = useState<number>(0);
  const [activeMethod, setActiveMethod] = useState<'cash' | 'card' | 'split'>('cash');

  const totalTendered = Number(cashAmount || 0) + Number(cardAmount || 0);
  const changeDue = Math.max(0, totalTendered - totalAmount);
  const remainingDue = Math.max(0, totalAmount - totalTendered);

  // Parse quick presets from settings (e.g. "50,100,200,500")
  const quickPresets = (settings.quick_tender_presets || '50,100,200,500')
    .split(',')
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n));

  const handleSelectMethod = (m: 'cash' | 'card' | 'split') => {
    setActiveMethod(m);
    if (m === 'cash') {
      setCashAmount(totalAmount);
      setCardAmount(0);
    } else if (m === 'card') {
      setCashAmount(0);
      setCardAmount(totalAmount);
    } else {
      setCashAmount(Math.floor(totalAmount / 2));
      setCardAmount(totalAmount - Math.floor(totalAmount / 2));
    }
  };

  const handleQuickCash = (amount: number) => {
    setActiveMethod('cash');
    setCashAmount(amount);
    setCardAmount(0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payments: Array<{ paymentMethodId: number; amount: number }> = [];

    if (cashAmount > 0) {
      payments.push({ paymentMethodId: 1, amount: Number(cashAmount) });
    }
    if (cardAmount > 0) {
      payments.push({ paymentMethodId: 2, amount: Number(cardAmount) });
    }

    if (payments.length === 0) {
      payments.push({ paymentMethodId: 1, amount: totalAmount });
    }

    onConfirm(payments);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Payment & Tender</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Select payment mode and enter received amount</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Total Due Callout */}
          <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-4 text-center border border-blue-100 dark:border-blue-900/50">
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total Due</div>
            <div className="font-mono text-3xl font-extrabold text-blue-900 dark:text-blue-200">{formatCurrency(totalAmount)}</div>
          </div>

          {/* Payment Method Selector Tabs */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleSelectMethod('cash')}
              className={`flex items-center justify-center gap-2 rounded-xl p-3 border font-semibold text-sm transition ${
                activeMethod === 'cash'
                  ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750'
              }`}
            >
              <Banknote className="h-4 w-4" />
              Cash Only
            </button>
            <button
              type="button"
              onClick={() => handleSelectMethod('card')}
              className={`flex items-center justify-center gap-2 rounded-xl p-3 border font-semibold text-sm transition ${
                activeMethod === 'card'
                  ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              Mada / Card
            </button>
            <button
              type="button"
              onClick={() => handleSelectMethod('split')}
              className={`flex items-center justify-center gap-2 rounded-xl p-3 border font-semibold text-sm transition ${
                activeMethod === 'split'
                  ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750'
              }`}
            >
              Split Payment
            </button>
          </div>

          {/* Amount Inputs */}
          {activeMethod !== 'card' && (
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Cash Received ({settings.currency_symbol || 'SAR'})</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cashAmount}
                onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 font-mono text-lg font-bold text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
              />
              {/* Quick Cash Buttons */}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickCash(totalAmount)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Exact ({formatCurrency(totalAmount)})
                </button>
                {quickPresets.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleQuickCash(amt)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-1 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    {formatCurrency(amt)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeMethod !== 'cash' && (
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Card / Mada Amount ({settings.currency_symbol || 'SAR'})</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cardAmount}
                onChange={(e) => setCardAmount(parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 font-mono text-lg font-bold text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
              />
            </div>
          )}

          {/* Change or Due Indicator */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3 text-center border border-emerald-100 dark:border-emerald-900/50">
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Change Returned</div>
              <div className="font-mono text-xl font-bold text-emerald-900 dark:text-emerald-200">{formatCurrency(changeDue)}</div>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-center border border-amber-100 dark:border-amber-900/50">
              <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">Remaining Due</div>
              <div className="font-mono text-xl font-bold text-amber-900 dark:text-amber-200">{formatCurrency(remainingDue)}</div>
            </div>
          </div>

          {/* Finalize Button */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-base font-extrabold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 disabled:opacity-50 transition"
          >
            <Check className="h-5 w-5" />
            {loading ? 'Processing Sale...' : `Finalize & Print Receipt (${formatCurrency(totalAmount)})`}
          </button>
        </form>
      </div>
    </div>
  );
}
