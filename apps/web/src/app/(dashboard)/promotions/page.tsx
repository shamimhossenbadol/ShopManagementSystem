'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { Button, IconButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { MetricCard } from '@/components/ui/MetricCard';
import {
  Percent,
  Plus,
  Trash2,
  Calendar,
  Tag,
  Package,
  Gift,
  CheckCircle,
  Sparkles,
  ShoppingBag,
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
    if (!confirm('Are you sure you want to delete this promotional deal?')) return;
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

  const activeCount = promotions.filter((p) => p.is_active).length;

  return (
    <div className="space-y-6">
      {/* Create Promotion Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-blue-700 dark:text-sky-400" />
            <span>Create Supermarket Promotional Deal</span>
          </div>
        }
        subtitle="Configure automated promotional rules calculated in POS shopping carts"
        maxWidth="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreatePromotion}>
              Launch Promotion
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreatePromotion} className="space-y-4">
          <Input
            label="Promotion Name *"
            required
            value={promoForm.name}
            onChange={(e) => setPromoForm({ ...promoForm, name: e.target.value })}
            placeholder="e.g. Buy 2 Almarai Milk Get 1 Free"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Promotional Mechanism *"
              value={promoForm.type}
              onChange={(e) => setPromoForm({ ...promoForm, type: e.target.value as any })}
            >
              <option value="buy_x_get_y">Buy X Get Y Free</option>
              <option value="bundle_price">Quantity Bundle Pricing (e.g. 3 for 10 SAR)</option>
              <option value="percentage_discount">Item Percentage Discount (% OFF)</option>
            </Select>

            <Select
              label="Target Product SKU *"
              required
              value={promoForm.rules[0].buy_product_id}
              onChange={(e) => {
                const newRules = [...promoForm.rules];
                newRules[0].buy_product_id = e.target.value;
                setPromoForm({ ...promoForm, rules: newRules });
              }}
            >
              <option value="">-- Choose Product --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </Select>
          </div>

          {/* Dynamic Rule Form Based on Type */}
          {promoForm.type === 'buy_x_get_y' && (
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-900/40">
              <Input
                label="Buy Quantity *"
                type="number"
                min="1"
                required
                value={promoForm.rules[0].buy_quantity}
                onChange={(e) => {
                  const newRules = [...promoForm.rules];
                  newRules[0].buy_quantity = parseFloat(e.target.value) || 1;
                  setPromoForm({ ...promoForm, rules: newRules });
                }}
              />
              <Input
                label="Get Free Quantity *"
                type="number"
                min="1"
                required
                value={promoForm.rules[0].get_quantity}
                onChange={(e) => {
                  const newRules = [...promoForm.rules];
                  newRules[0].get_quantity = parseFloat(e.target.value) || 1;
                  setPromoForm({ ...promoForm, rules: newRules });
                }}
              />
            </div>
          )}

          {promoForm.type === 'bundle_price' && (
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-900/40">
              <Input
                label="Bundle Quantity *"
                type="number"
                min="2"
                required
                value={promoForm.rules[0].buy_quantity}
                onChange={(e) => {
                  const newRules = [...promoForm.rules];
                  newRules[0].buy_quantity = parseFloat(e.target.value) || 2;
                  setPromoForm({ ...promoForm, rules: newRules });
                }}
              />
              <Input
                label="Bundle Package Price (SAR) *"
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
              />
            </div>
          )}

          {promoForm.type === 'percentage_discount' && (
            <div className="rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-900/40">
              <Input
                label="Percentage Discount (% OFF) *"
                type="number"
                step="0.1"
                min="1"
                max="99"
                required
                value={promoForm.rules[0].discount_percentage}
                onChange={(e) => {
                  const newRules = [...promoForm.rules];
                  newRules[0].discount_percentage = parseFloat(e.target.value) || 0;
                  setPromoForm({ ...promoForm, rules: newRules });
                }}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Campaign Start Date *"
              type="date"
              required
              value={promoForm.start_date}
              onChange={(e) => setPromoForm({ ...promoForm, start_date: e.target.value })}
            />
            <Input
              label="Campaign End Date *"
              type="date"
              required
              value={promoForm.end_date}
              onChange={(e) => setPromoForm({ ...promoForm, end_date: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            Promotions & Multi-Buy Deals Engine
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Supermarket promotional rules: Buy X Get Y Free, quantity bundle price packs, and percentage discounts.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsModalOpen(true)}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Create New Promotion
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Active Campaigns"
          value={activeCount}
          subValue="Live on POS Register"
          icon={<Sparkles className="h-5 w-5" />}
          variant="success"
        />

        <MetricCard
          label="Total Promotional Deals"
          value={promotions.length}
          subValue="Configured Campaigns"
          icon={<Gift className="h-5 w-5" />}
          variant="primary"
        />

        <MetricCard
          label="Multi-Buy Rules"
          value={promotions.reduce((sum, p) => sum + (p.rules?.length || 0), 0)}
          subValue="Auto Cart Engine"
          icon={<ShoppingBag className="h-5 w-5" />}
          variant="info"
        />
      </div>

      {/* Promotions Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">
            Loading active promotional campaigns...
          </div>
        ) : promotions.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">
            No promotional deals active. Click "Create New Promotion" above.
          </div>
        ) : (
          promotions.map((promo) => (
            <div
              key={promo.id}
              className={`flex flex-col justify-between rounded-3xl border p-5 transition ${
                promo.is_active
                  ? 'border-blue-200 dark:border-blue-900/50 bg-white dark:bg-slate-900 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="primary">{promo.type.replace(/_/g, ' ').toUpperCase()}</Badge>

                  <button
                    onClick={() => handleToggleActive(promo.id, promo.is_active)}
                    className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition ${
                      promo.is_active
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {promo.is_active ? 'Active' : 'Disabled'}
                  </button>
                </div>

                <h3 className="mt-3 text-base font-black text-slate-900 dark:text-white line-clamp-1">
                  {promo.name}
                </h3>

                {/* Rules Display */}
                <div className="mt-3 space-y-2 text-xs">
                  {promo.rules?.map((rule: any) => (
                    <div
                      key={rule.id}
                      className="rounded-2xl bg-slate-50 dark:bg-slate-850 p-3 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      {promo.type === 'buy_x_get_y' && (
                        <p>
                          Buy <strong>{rule.buy_quantity}x</strong> {rule.buy_product_name || 'Item'}, Get{' '}
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            {rule.get_quantity}x FREE
                          </strong>
                        </p>
                      )}
                      {promo.type === 'bundle_price' && (
                        <p>
                          Buy <strong>{rule.buy_quantity}x</strong> {rule.buy_product_name || 'Item'} Bundle for{' '}
                          <strong className="text-blue-600 dark:text-sky-400">
                            {formatCurrency(rule.bundle_price)}
                          </strong>
                        </p>
                      )}
                      {promo.type === 'percentage_discount' && (
                        <p>
                          Get{' '}
                          <strong className="text-amber-600 dark:text-amber-400">
                            {rule.discount_percentage}% OFF
                          </strong>{' '}
                          on {rule.buy_product_name || 'Selected Item'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5 font-mono">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {new Date(promo.start_date).toLocaleDateString('en-GB')} -{' '}
                    {new Date(promo.end_date).toLocaleDateString('en-GB')}
                  </span>
                </div>
                <IconButton
                  title="Delete Campaign"
                  variant="danger"
                  size="sm"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={() => handleDeletePromotion(promo.id)}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
