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
import {
  CalendarDays,
  AlertTriangle,
  Clock,
  Plus,
  Search,
  Package,
  Layers,
  CheckCircle,
  ShieldAlert,
  Archive,
  X,
  RotateCw,
  Truck,
  ChevronDown,
} from 'lucide-react';

export default function BatchesPage() {
  const { formatCurrency } = useSettings();
  const [batches, setBatches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const generateBatchNumber = () => {
    const today = new Date();
    const ymd = today.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `BATCH-${ymd}-${rand}`;
  };

  const [productSearch, setProductSearch] = useState('');
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [isPurchaseSearchOpen, setIsPurchaseSearchOpen] = useState(false);

  const [batchForm, setBatchForm] = useState({
    product_id: '',
    purchase_id: '',
    batch_number: generateBatchNumber(),
    expiry_date: '',
    cost_price: 0,
    quantity: 10,
  });

  const openAddBatchModal = () => {
    setBatchForm({
      product_id: '',
      purchase_id: '',
      batch_number: generateBatchNumber(),
      expiry_date: '',
      cost_price: 0,
      quantity: 10,
    });
    setProductSearch('');
    setIsProductSearchOpen(false);
    setPurchaseSearch('');
    setIsPurchaseSearchOpen(false);
    setIsModalOpen(true);
  };

  const loadBatches = async () => {
    setLoading(true);
    const res = await apiRequest('/batches');
    if (res.success && res.data) {
      setBatches(res.data);
    }
    setLoading(false);
  };

  const loadProducts = async () => {
    const res = await apiRequest('/products');
    if (res.success && res.data) {
      setProducts(res.data);
    }
  };

  const loadPurchases = async () => {
    const res = await apiRequest('/purchases');
    if (res.success && res.data) {
      setPurchases(res.data);
    }
  };

  useEffect(() => {
    loadBatches();
    loadProducts();
    loadPurchases();
  }, []);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchForm.product_id || !batchForm.batch_number || !batchForm.expiry_date) return;
    const payload = {
      ...batchForm,
      purchase_id: batchForm.purchase_id ? Number(batchForm.purchase_id) : undefined,
    };
    const res = await apiRequest('/batches', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.success) {
      setIsModalOpen(false);
      setBatchForm({
        product_id: '',
        purchase_id: '',
        batch_number: generateBatchNumber(),
        expiry_date: '',
        cost_price: 0,
        quantity: 10,
      });
      setProductSearch('');
      setIsProductSearchOpen(false);
      loadBatches();
    }
  };

  // In-stock batches vs depleted (sold out) batches
  const activeStockBatches = batches.filter((b) => Number(b.current_quantity || 0) > 0);
  const depletedBatches = batches.filter((b) => Number(b.current_quantity || 0) <= 0);

  const expiringCount = activeStockBatches.filter((b) => Number(b.days_to_expiry) >= 0 && Number(b.days_to_expiry) <= 30).length;
  const expiredCount = activeStockBatches.filter((b) => Number(b.days_to_expiry) < 0).length;

  const totalUnits = activeStockBatches.reduce((sum, b) => sum + Number(b.current_quantity || 0), 0);
  const expiringUnits = activeStockBatches
    .filter((b) => Number(b.days_to_expiry) >= 0 && Number(b.days_to_expiry) <= 30)
    .reduce((sum, b) => sum + Number(b.current_quantity || 0), 0);
  const expiredUnits = activeStockBatches
    .filter((b) => Number(b.days_to_expiry) < 0)
    .reduce((sum, b) => sum + Number(b.current_quantity || 0), 0);

  const selectedProduct = products.find((p) => String(p.id) === String(batchForm.product_id));
  const filteredProducts = products.filter((p) => {
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  });

  const selectedPurchase = purchases.find((po) => String(po.id) === String(batchForm.purchase_id));
  const filteredPurchases = purchases.filter((po) => {
    if (!purchaseSearch.trim()) return true;
    const q = purchaseSearch.toLowerCase();
    return (
      String(po.id).includes(q) ||
      po.reference_no?.toLowerCase().includes(q) ||
      po.supplier_name?.toLowerCase().includes(q)
    );
  });

  const filteredBatches = batches.filter((b) => {
    const qty = Number(b.current_quantity || 0);
    const isDepleted = qty <= 0;

    if (filterStatus === 'depleted') {
      if (!isDepleted) return false;
    } else {
      // Exclude depleted batches from 'all', 'expiring_soon', and 'expired'
      if (isDepleted) return false;

      const days = Number(b.days_to_expiry);
      if (filterStatus === 'expired' && days >= 0) return false;
      if (filterStatus === 'expiring_soon' && (days < 0 || days > 30)) return false;
    }

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.product_name?.toLowerCase().includes(q) ||
      b.batch_number?.toLowerCase().includes(q) ||
      b.sku?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Add Batch Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        icon={<CalendarDays className="h-5 w-5" />}
        title="Add Perishable Batch & Expiry Entry"
        subtitle="Record perishable receiving & FEFO batch expiry."
        maxWidth="xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!batchForm.product_id || !batchForm.batch_number || !batchForm.expiry_date}
              onClick={handleCreateBatch}
            >
              Save Batch
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateBatch} className="space-y-4">
          {/* Optimized Searchable Product Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Perishable Product <span className="text-red-500">*</span>
            </label>

            {selectedProduct ? (
              <div className="flex items-center justify-between p-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {selectedProduct.name}
                    </span>
                    {selectedProduct.has_expiry && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                        Perishable
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono truncate">
                    {[
                      selectedProduct.sku,
                      selectedProduct.barcode,
                      Number(selectedProduct.cost_price || 0) > 0
                        ? formatCurrency(Number(selectedProduct.cost_price))
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBatchForm({ ...batchForm, product_id: '' });
                    setProductSearch('');
                    setIsProductSearchOpen(true);
                  }}
                  title="Deselect product"
                  className="ml-3 shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setIsProductSearchOpen(true);
                    }}
                    onFocus={() => setIsProductSearchOpen(true)}
                    placeholder="Search by product name, SKU, or barcode..."
                    className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-8 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => setProductSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {isProductSearchOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setIsProductSearchOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-xl">
                      {filteredProducts.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400">
                          No matching products found.
                        </div>
                      ) : (
                        filteredProducts.slice(0, 40).map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              const cost = Number(p.cost_price ?? p.costPrice ?? 0);
                              setBatchForm((prev) => ({
                                ...prev,
                                product_id: String(p.id),
                                cost_price: cost > 0 ? cost : prev.cost_price,
                              }));
                              setIsProductSearchOpen(false);
                            }}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer transition"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                {p.name}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono truncate">
                                {[
                                  p.sku,
                                  p.barcode,
                                  Number(p.cost_price || 0) > 0 ? formatCurrency(Number(p.cost_price)) : null,
                                ]
                                  .filter(Boolean)
                                  .join(' • ')}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Batch Number & Purchase ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Batch Number <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  title="Generate new batch number"
                  onClick={() =>
                    setBatchForm((prev) => ({ ...prev, batch_number: generateBatchNumber() }))
                  }
                  className="rounded-lg p-1 text-slate-400 hover:text-blue-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                type="text"
                required
                value={batchForm.batch_number}
                onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })}
                placeholder="e.g. BATCH-20260909-A7K2"
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 font-mono text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Purchase ID
                </label>
              </div>

              {batchForm.purchase_id ? (
                <div className="flex items-center justify-between h-10 px-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20">
                  <span className="font-mono font-bold text-xs text-blue-700 dark:text-sky-300 truncate">
                    {selectedPurchase?.reference_no || `#${batchForm.purchase_id}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setBatchForm({ ...batchForm, purchase_id: '' });
                      setPurchaseSearch('');
                      setIsPurchaseSearchOpen(true);
                    }}
                    title="Clear purchase ID"
                    className="ml-2 rounded-lg p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={purchaseSearch}
                      onChange={(e) => {
                        setPurchaseSearch(e.target.value);
                        setIsPurchaseSearchOpen(true);
                      }}
                      onFocus={() => setIsPurchaseSearchOpen(true)}
                      placeholder="e.g: PUR-202609-00005"
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-8 font-mono text-xs font-semibold text-slate-900 dark:text-white placeholder:font-sans placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
                    />
                    {purchaseSearch && (
                      <button
                        type="button"
                        onClick={() => setPurchaseSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {isPurchaseSearchOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setIsPurchaseSearchOpen(false)}
                      />
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-xl">
                        {filteredPurchases.length === 0 ? (
                          <div className="p-2.5 text-center text-xs text-slate-400">
                            No matching purchase ID found.
                          </div>
                        ) : (
                          filteredPurchases.slice(0, 30).map((po) => (
                            <div
                              key={po.id}
                              onClick={() => {
                                setBatchForm((prev) => ({
                                  ...prev,
                                  purchase_id: String(po.id),
                                }));
                                setIsPurchaseSearchOpen(false);
                              }}
                              className="flex items-center justify-between p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer transition"
                            >
                              <span className="font-mono font-bold text-xs text-blue-700 dark:text-sky-400">
                                {po.reference_no || `#${po.id}`}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Lower Row: Compact Date Picker on Left & Vertical Quantity/Price on Right */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
            {/* Left: Compact Date Picker */}
            <div className="sm:col-span-7 flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" />
                  Expiration Date <span className="text-red-500">*</span>
                </label>

                {/* Real-time Shelf Life Status Badge */}
                {batchForm.expiry_date && (() => {
                  const diffDays = Math.ceil(
                    (new Date(batchForm.expiry_date).getTime() - new Date().setHours(0, 0, 0, 0)) /
                      (1000 * 60 * 60 * 24)
                  );
                  if (diffDays < 0) {
                    return (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300 border border-red-200 dark:border-red-900/60">
                        Expired ({Math.abs(diffDays)}d)
                      </span>
                    );
                  }
                  if (diffDays <= 30) {
                    return (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
                        Soon ({diffDays}d)
                      </span>
                    );
                  }
                  return (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
                      Safe ({diffDays}d)
                    </span>
                  );
                })()}
              </div>

              <input
                type="date"
                required
                value={batchForm.expiry_date}
                onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })}
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-semibold text-slate-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
              />

              {/* Quick Shelf-Life Expiry Presets */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {[
                  { label: '+7d', days: 7 },
                  { label: '+30d', days: 30 },
                  { label: '+90d', days: 90 },
                  { label: '+180d', days: 180 },
                  { label: '+1y', days: 365 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      const target = new Date();
                      target.setDate(target.getDate() + preset.days);
                      setBatchForm((prev) => ({
                        ...prev,
                        expiry_date: target.toISOString().slice(0, 10),
                      }));
                    }}
                    className="rounded-lg bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600 dark:hover:text-sky-400 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 transition"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Quantity & Price Stacked Vertically */}
            <div className="sm:col-span-5 flex flex-col justify-between gap-2.5">
              <Input
                label="Batch Quantity (Units) *"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={batchForm.quantity}
                onChange={(e) => setBatchForm({ ...batchForm, quantity: parseFloat(e.target.value) || 0 })}
              />

              <Input
                label="Unit Cost Price (SAR)"
                type="number"
                step="0.0001"
                value={batchForm.cost_price}
                onChange={(e) => setBatchForm({ ...batchForm, cost_price: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            Batches & Perishable Expiry Tracker
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            FEFO inventory allocation, batch tracking & expiration alerts.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={openAddBatchModal}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Add Batch Entry
        </Button>
      </div>

      {/* Premium Compact KPI Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card 1: Total Active Batches */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/30 dark:from-blue-950/20 dark:via-slate-900 dark:to-indigo-950/10 p-3.5 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Active Batches
            </span>
            <div className="rounded-xl p-2 bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-600/20 ring-2 ring-blue-500/10">
              <Layers className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {activeStockBatches.length}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {activeStockBatches.length === 1 ? 'batch' : 'batches'}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
            <span className="text-slate-500 dark:text-slate-400 font-medium truncate flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 animate-pulse" />
              FEFO Tracking Active
            </span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
              {totalUnits.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} units
            </span>
          </div>
        </div>

        {/* Card 2: Expiring Soon */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-200/70 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/50 via-white to-orange-50/30 dark:from-amber-950/20 dark:via-slate-900 dark:to-orange-950/10 p-3.5 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Expiring Soon (30 Days)
            </span>
            <div className="rounded-xl p-2 bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm shadow-amber-500/20 ring-2 ring-amber-500/10">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-black tracking-tight text-amber-950 dark:text-amber-200">
              {expiringCount}
            </span>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {expiringCount === 1 ? 'batch' : 'batches'}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between pt-2 border-t border-amber-100/70 dark:border-amber-900/30 text-[11px]">
            <span className="text-amber-700 dark:text-amber-400 font-medium truncate flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Priority Rotation
            </span>
            <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
              {expiringUnits.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} units
            </span>
          </div>
        </div>

        {/* Card 3: Expired Batches */}
        <div className="relative overflow-hidden rounded-2xl border border-red-200/70 dark:border-red-900/40 bg-gradient-to-br from-red-50/50 via-white to-rose-50/30 dark:from-red-950/20 dark:via-slate-900 dark:to-rose-950/10 p-3.5 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
              Expired Batches
            </span>
            <div className="rounded-xl p-2 bg-gradient-to-br from-red-600 to-rose-600 text-white shadow-sm shadow-red-600/20 ring-2 ring-red-500/10">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-black tracking-tight text-red-950 dark:text-red-200">
              {expiredCount}
            </span>
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">
              {expiredCount === 1 ? 'batch' : 'batches'}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between pt-2 border-t border-red-100/70 dark:border-red-900/30 text-[11px]">
            <span className="text-red-700 dark:text-red-400 font-medium truncate flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" />
              Quarantine & Write-Off
            </span>
            <span className="font-mono font-bold text-red-700 dark:text-red-300">
              {expiredUnits.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} units
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar - All items with unified matching height (h-10) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 min-w-0 sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by batch, product name, or SKU..."
            className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-9 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Tabs - Matching exact h-10 height */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'all', label: 'All Batches', count: activeStockBatches.length },
            { id: 'expiring_soon', label: 'Expiring in 30 Days', count: expiringCount },
            { id: 'expired', label: 'Expired Batches', count: expiredCount },
            { id: 'depleted', label: 'Depleted', count: depletedBatches.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`h-10 rounded-xl px-4 text-xs font-bold whitespace-nowrap transition flex items-center justify-center gap-2 shrink-0 ${
                filterStatus === tab.id
                  ? 'bg-blue-700 text-white shadow-sm dark:bg-sky-500 dark:text-slate-950'
                  : 'bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md transition ${
                  filterStatus === tab.id
                    ? 'bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Batches Master DataTable */}
      <DataTable
        isLoading={loading}
        data={filteredBatches}
        keyExtractor={(b) => b.id}
        emptyMessage="No batch or perishable expiry records found."
        columns={[
          {
            header: 'Batch Number',
            accessor: (b) => (
              <div>
                <span className="font-mono font-bold text-blue-700 dark:text-sky-400">
                  {b.batch_number}
                </span>
                {b.purchase_ref_no ? (
                  <div className="text-[11px] text-slate-400 font-mono">
                    PO: {b.purchase_ref_no}
                  </div>
                ) : b.purchase_id ? (
                  <div className="text-[11px] text-slate-400 font-mono">
                    PO: #{b.purchase_id}
                  </div>
                ) : null}
              </div>
            ),
          },
          {
            header: 'Product Name / SKU',
            accessor: (b) => (
              <div>
                <div className="font-bold text-slate-900 dark:text-white line-clamp-1">{b.product_name}</div>
                <div className="text-[11px] text-slate-400 font-mono">SKU: {b.sku}</div>
              </div>
            ),
          },
          {
            header: 'Expiration Date',
            accessor: (b) => (
              <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {new Date(b.expiry_date).toLocaleDateString('en-GB')}
              </div>
            ),
          },
          {
            header: 'Days Left (FEFO)',
            accessor: (b) => {
              const days = Number(b.days_to_expiry);
              if (days < 0) {
                return (
                  <span className="font-bold text-red-600 dark:text-red-400">
                    Expired ({Math.abs(days)}d ago)
                  </span>
                );
              }
              if (days <= 30) {
                return (
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {days} days remaining
                  </span>
                );
              }
              return (
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {days} days safe
                </span>
              );
            },
          },
          {
            header: 'Current Stock',
            align: 'right',
            accessor: (b) => (
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {Number(b.current_quantity).toFixed(2)}
              </span>
            ),
          },
          {
            header: 'Cost Price',
            align: 'right',
            accessor: (b) => (
              <span className="font-mono text-slate-500">
                {formatCurrency(b.cost_price)}
              </span>
            ),
          },
          {
            header: 'Status',
            align: 'center',
            accessor: (b) => {
              if (Number(b.current_quantity || 0) <= 0) {
                return <Badge variant="neutral">Depleted</Badge>;
              }
              const days = Number(b.days_to_expiry);
              if (days < 0) return <Badge variant="danger">Expired</Badge>;
              if (days <= 30) return <Badge variant="warning">Expiring Soon</Badge>;
              return <Badge variant="success">Active</Badge>;
            },
          },
        ]}
      />
    </div>
  );
}
