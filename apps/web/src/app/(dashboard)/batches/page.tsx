'use client';

import { useState, useEffect, useRef } from 'react';
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
  ArrowRight,
  Trash2,
  Info,
  AlertCircle,
} from 'lucide-react';

export default function BatchesPage() {
  const { formatCurrency } = useSettings();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const getTodayDateStr = () => new Date().toISOString().slice(0, 10);

  const formatDisplayDate = (isoDate: string) => {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length < 3) return isoDate;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return isoDate;
    const d = new Date(year, month - 1, day);
    if (isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

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
    expiry_date: getTodayDateStr(),
    quantity: 1,
  });

  const openAddBatchModal = () => {
    setBatchForm({
      product_id: '',
      purchase_id: '',
      batch_number: generateBatchNumber(),
      expiry_date: getTodayDateStr(),
      quantity: 1,
    });
    setProductSearch('');
    setIsProductSearchOpen(false);
    setPurchaseSearch('');
    setIsPurchaseSearchOpen(false);
    setFormError(null);
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

  const selectedProduct = products.find((p) => String(p.id) === String(batchForm.product_id));
  const productCurrentStock = Number(selectedProduct?.current_stock || 0);
  const alreadyBatchedQty = batches
    .filter(
      (b) =>
        Number(b.product_id) === Number(batchForm.product_id) &&
        b.is_active &&
        Number(b.current_quantity) > 0
    )
    .reduce((sum, b) => sum + Number(b.current_quantity), 0);
  const availableToBatch = Math.max(0, productCurrentStock - alreadyBatchedQty);

  // Custom modern dialog states
  const [writeOffTarget, setWriteOffTarget] = useState<any | null>(null);
  const [writeOffReason, setWriteOffReason] = useState('');
  const [isWriteOffLoading, setIsWriteOffLoading] = useState(false);

  const [isAutoRemoveOpen, setIsAutoRemoveOpen] = useState(false);
  const [isAutoRemoveLoading, setIsAutoRemoveLoading] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 6000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!batchForm.product_id || !batchForm.batch_number || !batchForm.expiry_date) {
      setFormError('Please select a perishable product and expiration date.');
      return;
    }

    if (batchForm.quantity <= 0) {
      setFormError('Batch quantity must be greater than 0.');
      return;
    }

    if (batchForm.quantity > availableToBatch) {
      setFormError(`Batch quantity cannot exceed available stock (${availableToBatch.toFixed(2)} units).`);
      return;
    }

    const payload = {
      product_id: Number(batchForm.product_id),
      batch_number: batchForm.batch_number,
      expiry_date: batchForm.expiry_date,
      quantity: Number(batchForm.quantity),
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
        expiry_date: getTodayDateStr(),
        quantity: 1,
      });
      setProductSearch('');
      setIsProductSearchOpen(false);
      setFeedback({
        type: 'success',
        title: 'Batch Entry Registered',
        message: `Batch "${payload.batch_number}" (${payload.quantity} units) is now active for FEFO tracking.`,
      });
      loadBatches();
      loadProducts();
    } else {
      setFormError(res.message || 'Failed to create batch.');
    }
  };

  const openWriteOffDialog = (batch: any) => {
    const isExpired = Number(batch.days_to_expiry) < 0;
    setWriteOffTarget(batch);
    setWriteOffReason(
      isExpired
        ? 'Disposal of expired inventory via Batches Management'
        : 'Damaged or compromised stock write-off'
    );
  };

  const executeWriteOff = async () => {
    if (!writeOffTarget) return;
    setIsWriteOffLoading(true);
    const target = writeOffTarget;
    const res = await apiRequest(`/batches/${target.id}/write-off`, {
      method: 'POST',
      body: JSON.stringify({
        reason: writeOffReason.trim() || 'Manual stock write-off',
      }),
    });
    setIsWriteOffLoading(false);
    setWriteOffTarget(null);

    if (res.success) {
      setFeedback({
        type: 'success',
        title: 'Stock Removed Successfully',
        message: res.message || `Batch "${target.batch_number}" stock was deducted and written off.`,
      });
      loadBatches();
      loadProducts();
    } else {
      setFeedback({
        type: 'error',
        title: 'Write-Off Failed',
        message: res.message || 'Failed to write off batch stock.',
      });
    }
  };

  const executeAutoRemoveExpired = async () => {
    setIsAutoRemoveLoading(true);
    const res = await apiRequest('/batches/auto-remove-expired', {
      method: 'POST',
    });
    setIsAutoRemoveLoading(false);
    setIsAutoRemoveOpen(false);

    if (res.success) {
      const count = res.data?.length || 0;
      setFeedback({
        type: 'success',
        title: 'Expired Stock Purged',
        message: res.message || `${count} expired batch(es) successfully removed from inventory.`,
      });
      loadBatches();
      loadProducts();
    } else {
      setFeedback({
        type: 'error',
        title: 'Auto-Removal Failed',
        message: res.message || 'Could not auto-remove expired batches.',
      });
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
              disabled={
                !batchForm.product_id ||
                !batchForm.batch_number ||
                !batchForm.expiry_date ||
                Number(batchForm.quantity) <= 0 ||
                Number(batchForm.quantity) > availableToBatch ||
                availableToBatch <= 0
              }
              onClick={handleCreateBatch}
            >
              Save Batch
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateBatch} className="space-y-4">
          {formError && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl border border-red-200 bg-red-50/90 dark:border-red-900/50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <div className="flex-1 font-medium">{formError}</div>
              <button
                type="button"
                onClick={() => setFormError(null)}
                className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Optimized Searchable Product Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Perishable Product <span className="text-red-500">*</span>
            </label>

            {selectedProduct ? (
              <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
                <div className="flex items-center justify-between">
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
                      {[selectedProduct.sku, selectedProduct.barcode].filter(Boolean).join(' • ')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBatchForm({ ...batchForm, product_id: '', quantity: 1 });
                      setProductSearch('');
                      setIsProductSearchOpen(true);
                    }}
                    title="Deselect product"
                    className="ml-3 shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Stock allocation info */}
                <div className="flex items-center gap-3 pt-1 border-t border-blue-200/60 dark:border-blue-900/40 text-xs">
                  <div className="text-slate-600 dark:text-slate-300">
                    Current Stock: <span className="font-mono font-bold text-slate-900 dark:text-white">{productCurrentStock.toFixed(2)}</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">
                    Active Batched: <span className="font-mono font-bold text-blue-700 dark:text-sky-400">{alreadyBatchedQty.toFixed(2)}</span>
                  </div>
                  <div className={`font-semibold ${availableToBatch > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    Available to Batch: <span className="font-mono font-bold">{availableToBatch.toFixed(2)}</span>
                  </div>
                </div>

                {availableToBatch <= 0 && (
                  <div className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded-lg border border-red-200 dark:border-red-900/50">
                    All stock for this product is already assigned to active batches.
                  </div>
                )}
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
                        filteredProducts.slice(0, 40).map((p) => {
                          const pStock = Number(p.current_stock || 0);
                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                setBatchForm((prev) => ({
                                  ...prev,
                                  product_id: String(p.id),
                                  quantity: pStock > 0 ? 1 : 0,
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
                                  {[p.sku, p.barcode, `Stock: ${pStock}`].filter(Boolean).join(' • ')}
                                </div>
                              </div>
                            </div>
                          );
                        })
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
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Batch Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                readOnly
                value={batchForm.batch_number}
                className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/70 px-3.5 font-mono text-xs font-bold text-slate-700 dark:text-slate-300 cursor-not-allowed select-all focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Purchase ID
              </label>

              {batchForm.purchase_id ? (
                <div className="flex items-center justify-between h-10 px-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20">
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
                      className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-8 font-mono text-xs font-semibold text-slate-900 dark:text-white placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:focus:border-sky-400 dark:focus:ring-sky-400/20 focus:outline-none transition"
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

          {/* Expiry Date & Batch Quantity in a Clean Single Row with matching h-10 height */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Expiration Date <span className="text-red-500">*</span>
              </label>
              <div
                onClick={() => {
                  try {
                    dateInputRef.current?.showPicker();
                  } catch {
                    dateInputRef.current?.focus();
                  }
                }}
                className="relative flex items-center h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer transition hover:border-slate-400 dark:hover:border-slate-600 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 dark:focus-within:border-sky-400 dark:focus-within:ring-sky-400/20"
              >
                <input
                  type="text"
                  readOnly
                  value={formatDisplayDate(batchForm.expiry_date)}
                  placeholder="Select expiration date"
                  className="h-full w-full bg-transparent pl-3.5 pr-10 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer select-none focus:outline-none"
                />
                <input
                  ref={dateInputRef}
                  type="date"
                  required
                  value={batchForm.expiry_date}
                  onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })}
                  className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
                  tabIndex={-1}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center">
                  <CalendarDays className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Batch Quantity (Units) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={availableToBatch > 0 ? availableToBatch : undefined}
                required
                value={batchForm.quantity || ''}
                onChange={(e) => setBatchForm({ ...batchForm, quantity: parseFloat(e.target.value) || 0 })}
                placeholder="Enter quantity"
                className={`h-10 w-full rounded-xl border bg-white dark:bg-slate-900 px-3.5 text-xs font-semibold text-slate-900 dark:text-white transition focus:outline-none focus:ring-2 ${
                  selectedProduct && Number(batchForm.quantity) > availableToBatch
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-blue-600/20 dark:focus:border-sky-400 dark:focus:ring-sky-400/20'
                }`}
              />
              {selectedProduct && Number(batchForm.quantity) > availableToBatch && (
                <p className="mt-1 text-[11px] font-medium text-red-600 dark:text-red-400">
                  Cannot exceed available stock ({availableToBatch.toFixed(2)})
                </p>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* Feedback Toast Banner */}
      {feedback && (
        <div
          className={`flex items-start justify-between gap-3 p-4 rounded-xl border shadow-sm transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-200'
              : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
            )}
            <div>
              <p className="text-sm font-bold">{feedback.title}</p>
              <p className="text-xs mt-0.5 opacity-90">{feedback.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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

        <div className="flex items-center gap-2">
          {expiredCount > 0 && (
            <Button
              variant="danger"
              size="md"
              onClick={() => setIsAutoRemoveOpen(true)}
              leftIcon={<ShieldAlert className="h-4 w-4" />}
            >
              Auto-Remove Expired Stock ({expiredCount})
            </Button>
          )}
          <Button
            variant="primary"
            size="md"
            onClick={openAddBatchModal}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Add Batch Entry
          </Button>
        </div>
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
          {
            header: 'Actions',
            align: 'right',
            accessor: (b) => {
              if (Number(b.current_quantity || 0) <= 0) return null;
              const isExpired = Number(b.days_to_expiry) < 0;
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openWriteOffDialog(b);
                  }}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold shadow-xs transition-colors cursor-pointer ${
                    isExpired
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200'
                  }`}
                  title={isExpired ? 'Remove expired stock from inventory' : 'Write off damaged batch'}
                >
                  {isExpired ? 'Remove Expired' : 'Write Off'}
                </button>
              );
            },
          },
        ]}
      />

      {/* Custom Confirmation Modal: Write Off / Remove Expired Batch */}
      <Modal
        isOpen={Boolean(writeOffTarget)}
        onClose={() => {
          if (!isWriteOffLoading) setWriteOffTarget(null);
        }}
        icon={
          writeOffTarget && Number(writeOffTarget.days_to_expiry) < 0 ? (
            <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          )
        }
        title={
          writeOffTarget && Number(writeOffTarget.days_to_expiry) < 0
            ? 'Confirm Expired Stock Removal'
            : 'Confirm Batch Stock Write-Off'
        }
        subtitle="Review action details and inventory impact"
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <Button
              variant="secondary"
              disabled={isWriteOffLoading}
              onClick={() => setWriteOffTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={isWriteOffLoading}
              isLoading={isWriteOffLoading}
              onClick={executeWriteOff}
            >
              Confirm & Deduct Stock
            </Button>
          </div>
        }
      >
        {writeOffTarget && (
          <div className="space-y-4">
            {/* Action Box */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Package className="h-3.5 w-3.5" />
                <span>Action Target</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Product:</span>{' '}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {writeOffTarget.product_name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Batch #:</span>{' '}
                  <span className="font-mono font-bold text-blue-600 dark:text-sky-400">
                    {writeOffTarget.batch_number}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Expiry Date:</span>{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatDisplayDate(writeOffTarget.expiry_date)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Quantity to Deduct:</span>{' '}
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                    {Number(writeOffTarget.current_quantity).toFixed(2)} units
                  </span>
                </div>
              </div>
            </div>

            {/* System Reaction Breakdown */}
            <div className="rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>System Reaction</span>
              </div>
              <ul className="text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-rose-600 dark:text-rose-400 shrink-0">•</span>
                  <span>Deducts <strong className="font-mono font-bold text-rose-600 dark:text-rose-400">{Number(writeOffTarget.current_quantity).toFixed(2)} units</strong> directly from product stock.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-rose-600 dark:text-rose-400 shrink-0">•</span>
                  <span>Sets the batch&apos;s remaining quantity to <strong className="font-mono">0.00</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-rose-600 dark:text-rose-400 shrink-0">•</span>
                  <span>Marks the batch as inactive/depleted.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-rose-600 dark:text-rose-400 shrink-0">•</span>
                  <span>Records a damage movement in the inventory ledger.</span>
                </li>
              </ul>
            </div>

            {/* Reason input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Disposal / Write-Off Note
              </label>
              <Input
                type="text"
                value={writeOffReason}
                onChange={(e) => setWriteOffReason(e.target.value)}
                placeholder="Specify reason (e.g. Expired disposal, leakage, broken)"
                className="w-full text-xs"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Custom Confirmation Modal: Auto-Remove All Expired */}
      <Modal
        isOpen={isAutoRemoveOpen}
        onClose={() => {
          if (!isAutoRemoveLoading) setIsAutoRemoveOpen(false);
        }}
        icon={<ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
        title="Auto-Remove All Expired Stock"
        subtitle="Review action details and inventory impact"
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <Button
              variant="secondary"
              disabled={isAutoRemoveLoading}
              onClick={() => setIsAutoRemoveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={isAutoRemoveLoading}
              isLoading={isAutoRemoveLoading}
              onClick={executeAutoRemoveExpired}
            >
              Purge {expiredCount} Expired {expiredCount === 1 ? 'Batch' : 'Batches'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Action Box */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              <span>Action Scope</span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              Scanning has identified{' '}
              <strong className="text-rose-600 dark:text-rose-400 font-mono text-sm">{expiredCount}</strong> expired batch(es) holding a total of{' '}
              <strong className="text-rose-600 dark:text-rose-400 font-mono text-sm">{expiredUnits.toFixed(2)} units</strong> ready for removal.
            </p>
          </div>

          {/* System Reaction Breakdown */}
          <div className="rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>System Reaction</span>
            </div>
            <ul className="text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
              <li className="flex items-start gap-2">
                <span className="font-bold text-rose-600 dark:text-rose-400 shrink-0">•</span>
                <span>Deducts <strong className="font-mono font-bold text-rose-600 dark:text-rose-400">{expiredUnits.toFixed(2)} units</strong> directly from product stock.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-rose-600 dark:text-rose-400 shrink-0">•</span>
                <span>Sets remaining quantity to <strong className="font-mono">0.00</strong> across all {expiredCount} expired batches.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-rose-600 dark:text-rose-400 shrink-0">•</span>
                <span>Marks all expired batches as inactive/depleted.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-rose-600 dark:text-rose-400 shrink-0">•</span>
                <span>Records damage movements in the inventory ledger.</span>
              </li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
}
