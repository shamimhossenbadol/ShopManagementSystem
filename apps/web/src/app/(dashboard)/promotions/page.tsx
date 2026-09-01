'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import {
  Percent,
  Plus,
  Trash2,
  Calendar,
  Tag,
  Package,
  Gift,
  CheckCircle,
} from 'lucide-react';

export default function PromotionsPage() {
  const { formatCurrency } = useSettings();
  const [promotions, setPromotions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [promoForm, setPromoForm] = useState({
    name: '',
    type: 'buy_x_get_y' as 'buy_x_get_y' | 'bundle_price' | 'percentage_discount' | 'fixed_discount',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    is_active: true,
    rules: [
      {
        buy_product_id: '',
        buy_quantity: 2,
        get_product_id: '',
        get_quantity: 1,
        bundle_price: 0,
        discount_percentage: 0,
        discount_amount: 0,
      },
    ],
  });

  const loadPromotions = async () => {
    setLoading(true);
    const res = await apiRequest('/promotions');
    if (res.success && res.data) {
      setPromotions(res.data);
    }
    setLoading(false);
  };

  const loadProducts = async () => {
    const res = await apiRequest('/products');
    if (res.success && res.data) {
      setProducts(res.data);
    }
  };

  useEffect(() => {
    loadPromotions();
    loadProducts();
  }, []);

  const handleCreatePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/promotions', {
      method: 'POST',
      body: JSON.stringify(promoForm),
    });

    if (res.success) {
      setIsModalOpen(false);
      loadPromotions();
    }
  };

  const handleDeletePromotion = async (id: number) => {
    if (!confirm('Are you sure you want to delete this promotion?')) return;
    await apiRequest(`/promotions/${id}`, { method: 'DELETE' });
    loadPromotions();
  };

  const handleToggleActive = async (id: number, currentStatus: boolean) => {
    await apiRequest(`/promotions/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: !currentStatus }),
    });
    loadPromotions();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Promotions & Multi-Buy Deals Engine
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Supermarket promotional rules: Buy X Get Y Free, bundle price packs, and category discounts.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500 transition"
        >
          <Plus className="h-4 w-4" />
          Create New Promotion
        </button>
      </div>

      {/* Promotions List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">Loading active promotions...</div>
        ) : promotions.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">
            No promotions active. Create your first promotional deal above.
          </div>
        ) : (
          promotions.map((promo) => (
            <div
              key={promo.id}
              className={`flex flex-col justify-between rounded-2xl border p-5 transition ${
                promo.is_active
                  ? 'border-blue-200 dark:border-blue-900/50 bg-white dark:bg-slate-900 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-[10px] font-extrabold uppercase">
                    {promo.type.replace(/_/g, ' ')}
                  </span>
                  <button
                    onClick={() => handleToggleActive(promo.id, promo.is_active)}
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      promo.is_active
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-500/10 text-slate-500'
                    }`}
                  >
                    {promo.is_active ? 'Active' : 'Disabled'}
                  </button>
                </div>

                <h3 className="mt-2.5 text-base font-bold text-slate-900 dark:text-white">{promo.name}</h3>

                {/* Rules Display */}
                <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {promo.rules?.map((rule: any) => (
                    <div key={rule.id} className="rounded-xl bg-slate-50 dark:bg-slate-950 p-2.5 border border-slate-100 dark:border-slate-800">
                      {promo.type === 'buy_x_get_y' && (
                        <p>
                          Buy <strong>{rule.buy_quantity}x</strong> {rule.buy_product_name || 'Item'}, Get{' '}
                          <strong className="text-emerald-500">{rule.get_quantity}x</strong>{' '}
                          {rule.get_product_name || 'Same Item'} Free
                        </p>
                      )}
                      {promo.type === 'bundle_price' && (
                        <p>
                          Buy <strong>{rule.buy_quantity}x</strong> {rule.buy_product_name || 'Item'} Bundle for{' '}
                          <strong className="text-blue-500">{formatCurrency(rule.bundle_price)}</strong>
                        </p>
                      )}
                      {promo.type === 'percentage_discount' && (
                        <p>
                          Get <strong className="text-amber-500">{rule.discount_percentage}% OFF</strong> on{' '}
                          {rule.buy_product_name || 'Selected Items'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {new Date(promo.start_date).toLocaleDateString()} - {new Date(promo.end_date).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={() => handleDeletePromotion(promo.id)}
                  className="p-1 text-slate-400 hover:text-rose-500"
                  title="Delete Promotion"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Promotion Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <h2 className="text-base font-bold mb-4 flex items-center gap-2">
              <Gift className="h-4 w-4 text-blue-500" />
              Create Supermarket Deal / Promotion
            </h2>
            <form onSubmit={handleCreatePromotion} className="space-y-4 text-xs">
              <div>
                <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Promotion Title *</label>
                <input
                  type="text"
                  required
                  value={promoForm.name}
                  onChange={(e) => setPromoForm({ ...promoForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. Buy 2 Almarai Milk Get 1 Free"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Deal Type *</label>
                  <select
                    value={promoForm.type}
                    onChange={(e) => setPromoForm({ ...promoForm, type: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none font-semibold"
                  >
                    <option value="buy_x_get_y">Buy X Get Y Free</option>
                    <option value="bundle_price">Quantity Bundle Pricing</option>
                    <option value="percentage_discount">Percentage Discount</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Applies To Product *</label>
                  <select
                    required
                    value={promoForm.rules[0].buy_product_id}
                    onChange={(e) => {
                      const newRules = [...promoForm.rules];
                      newRules[0].buy_product_id = e.target.value;
                      setPromoForm({ ...promoForm, rules: newRules });
                    }}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none font-semibold"
                  >
                    <option value="">-- Choose Product --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {promoForm.type === 'buy_x_get_y' && (
                <div className="grid grid-cols-2 gap-3 bg-blue-50/50 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-100 dark:border-blue-900/40">
                  <div>
                    <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Buy Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={promoForm.rules[0].buy_quantity}
                      onChange={(e) => {
                        const newRules = [...promoForm.rules];
                        newRules[0].buy_quantity = parseFloat(e.target.value) || 1;
                        setPromoForm({ ...promoForm, rules: newRules });
                      }}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Get Free Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={promoForm.rules[0].get_quantity}
                      onChange={(e) => {
                        const newRules = [...promoForm.rules];
                        newRules[0].get_quantity = parseFloat(e.target.value) || 1;
                        setPromoForm({ ...promoForm, rules: newRules });
                      }}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2 font-mono"
                    />
                  </div>
                </div>
              )}

              {promoForm.type === 'bundle_price' && (
                <div className="grid grid-cols-2 gap-3 bg-blue-50/50 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-100 dark:border-blue-900/40">
                  <div>
                    <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Bundle Quantity *</label>
                    <input
                      type="number"
                      min="2"
                      required
                      value={promoForm.rules[0].buy_quantity}
                      onChange={(e) => {
                        const newRules = [...promoForm.rules];
                        newRules[0].buy_quantity = parseFloat(e.target.value) || 2;
                        setPromoForm({ ...promoForm, rules: newRules });
                      }}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Bundle Total Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={promoForm.rules[0].bundle_price}
                      onChange={(e) => {
                        const newRules = [...promoForm.rules];
                        newRules[0].bundle_price = parseFloat(e.target.value) || 0;
                        setPromoForm({ ...promoForm, rules: newRules });
                      }}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2 font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={promoForm.start_date}
                    onChange={(e) => setPromoForm({ ...promoForm, start_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">End Date *</label>
                  <input
                    type="date"
                    required
                    value={promoForm.end_date}
                    onChange={(e) => setPromoForm({ ...promoForm, end_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-white"
                >
                  Launch Promotion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
