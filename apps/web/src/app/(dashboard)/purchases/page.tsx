'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import {
  Truck,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Eye,
  X,
  Building2,
  Calendar,
} from 'lucide-react';

interface PurchaseItemRow {
  productId: number;
  netUnitCost: number;
  quantity: number;
  taxRate: number;
  batchNumber?: string;
  expiryDate?: string;
}

export default function PurchasesPage() {
  const { formatCurrency, settings } = useSettings();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedPurchaseDetail, setSelectedPurchaseDetail] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    supplierId: 1,
    supplierInvoiceNo: '',
    shippingCost: 0,
    paidAmount: 0,
    paymentMethodId: 1,
  });

  const [itemRows, setItemRows] = useState<PurchaseItemRow[]>([
    { productId: 1, netUnitCost: 10, quantity: 10, taxRate: 15.0 },
  ]);

  const loadData = async () => {
    const res = await apiRequest('/purchases');
    if (res.success && res.data) setPurchases(res.data);

    const supRes = await apiRequest('/ledgers/suppliers');
    if (supRes.success && supRes.data) setSuppliers(supRes.data);

    const prodRes = await apiRequest('/products');
    if (prodRes.success && prodRes.data) {
      setProducts(prodRes.data);
      if (prodRes.data.length > 0 && itemRows[0].productId === 1) {
        setItemRows([
          {
            productId: prodRes.data[0].id,
            netUnitCost: Number(prodRes.data[0].cost_price || 10),
            quantity: 10,
            taxRate: 15.0,
          },
        ]);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setForm({
      supplierId: suppliers[0]?.id || 1,
      supplierInvoiceNo: '',
      shippingCost: 0,
      paidAmount: 0,
      paymentMethodId: 1,
    });
    setItemRows([
      {
        productId: products[0]?.id || 1,
        netUnitCost: Number(products[0]?.cost_price || 10),
        quantity: 10,
        taxRate: 15.0,
      },
    ]);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const addItemRow = () => {
    setItemRows([
      ...itemRows,
      {
        productId: products[0]?.id || 1,
        netUnitCost: Number(products[0]?.cost_price || 10),
        quantity: 1,
        taxRate: 15.0,
      },
    ]);
  };

  const removeItemRow = (idx: number) => {
    if (itemRows.length > 1) {
      setItemRows(itemRows.filter((_, i) => i !== idx));
    }
  };

  const updateRow = (idx: number, field: keyof PurchaseItemRow, value: any) => {
    const updated = [...itemRows];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'productId') {
      const prod = products.find((p) => p.id === Number(value));
      if (prod) {
        updated[idx].netUnitCost = Number(prod.cost_price || 10);
      }
    }
    setItemRows(updated);
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let tax = 0;
    itemRows.forEach((r) => {
      const itemSub = r.netUnitCost * r.quantity;
      const itemTax = itemSub * (r.taxRate / 100);
      subtotal += itemSub;
      tax += itemTax;
    });
    const grandTotal = subtotal + tax + Number(form.shippingCost || 0);
    return { subtotal, tax, grandTotal };
  };

  const { subtotal, tax, grandTotal } = calculateTotals();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const res = await apiRequest('/purchases', {
      method: 'POST',
      body: JSON.stringify({
        supplierId: Number(form.supplierId),
        supplierInvoiceNo: form.supplierInvoiceNo,
        items: itemRows.map((r) => ({
          productId: Number(r.productId),
          netUnitCost: Number(r.netUnitCost),
          quantity: Number(r.quantity),
          taxRate: Number(r.taxRate),
          batchNumber: r.batchNumber,
          expiryDate: r.expiryDate,
        })),
        shippingCost: Number(form.shippingCost),
        paidAmount: Number(form.paidAmount),
        paymentMethodId: Number(form.paymentMethodId),
      }),
    });

    setLoading(false);

    if (res.success) {
      setIsModalOpen(false);
      loadData();
    } else {
      setErrorMsg(res.message || 'Failed to record purchase.');
    }
  };

  const openDetail = async (p: any) => {
    const res = await apiRequest(`/purchases/${p.id}`);
    if (res.success && res.data) {
      setSelectedPurchaseDetail(res.data);
      setIsDetailModalOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Procurement & Purchases</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Receive supplier shipments, update inventory, create batch FEFO records, and recalculate WAC cost.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition"
        >
          <Plus className="h-4 w-4" />
          Receive New Purchase Order
        </button>
      </div>

      {/* Purchases List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-[10px] font-bold uppercase text-slate-400">
              <tr>
                <th className="py-3 px-4">Reference / Date</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-right">Paid Amount</th>
                <th className="py-3 px-4 text-right">Due Amount</th>
                <th className="py-3 px-4 text-center">Payment Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">No purchase records registered yet.</td>
                </tr>
              ) : (
                purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-slate-900 dark:text-white">{p.reference_no}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(p.created_at).toLocaleDateString('en-GB')} • Inv: {p.supplier_invoice_no || 'N/A'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">{p.supplier_name}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(p.grand_total)}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(p.paid_amount)}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-amber-600 dark:text-amber-400">{formatCurrency(p.due_amount)}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          p.payment_status === 'paid'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            : p.payment_status === 'partial'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {p.payment_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => openDetail(p)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Eye className="h-3 w-3 inline mr-1" />
                        Voucher
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receive Purchase Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-slate-900 dark:text-white">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold">Receive Supplier Goods & Restock</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Atomic stock increment and WAC cost recalculation</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 p-2.5 text-xs text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                <AlertCircle className="h-4 w-4" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Supplier *</label>
                  <select
                    value={form.supplierId}
                    onChange={(e) => setForm({ ...form, supplierId: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none font-semibold"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.company_name || 'Vendor'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Supplier Invoice No</label>
                  <input
                    type="text"
                    value={form.supplierInvoiceNo}
                    onChange={(e) => setForm({ ...form, supplierInvoiceNo: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. SUP-INV-9942"
                  />
                </div>
              </div>

              {/* Items Line Grid */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-950/60 space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Shipment Items ({itemRows.length})</span>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Another Item
                  </button>
                </div>

                {itemRows.map((row, idx) => {
                  const currentProd = products.find((p) => p.id === Number(row.productId));
                  return (
                    <div key={idx} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-6">
                          <label className="block text-[10px] text-slate-400 mb-0.5">Product SKU</label>
                          <select
                            value={row.productId}
                            onChange={(e) => updateRow(idx, 'productId', Number(e.target.value))}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-1.5 text-xs focus:border-blue-500 focus:outline-none font-semibold"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-3">
                          <label className="block text-[10px] text-slate-400 mb-0.5">Net Cost ({settings.currency_symbol || 'SAR'})</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.netUnitCost}
                            onChange={(e) => updateRow(idx, 'netUnitCost', parseFloat(e.target.value) || 0)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-1.5 text-xs font-mono focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] text-slate-400 mb-0.5">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={(e) => updateRow(idx, 'quantity', parseFloat(e.target.value) || 1)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-1.5 text-xs font-mono focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div className="col-span-1 text-center pt-3">
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            disabled={itemRows.length === 1}
                            className="text-slate-400 hover:text-rose-500 disabled:opacity-30"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Optional Batch Entry for Perishables */}
                      {currentProd?.has_expiry && (
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                          <div>
                            <label className="block text-[10px] text-amber-500 font-bold mb-0.5">Batch Number</label>
                            <input
                              type="text"
                              value={row.batchNumber || ''}
                              onChange={(e) => updateRow(idx, 'batchNumber', e.target.value)}
                              placeholder="e.g. B-001"
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-1 text-[11px] font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-amber-500 font-bold mb-0.5">Expiry Date</label>
                            <input
                              type="date"
                              value={row.expiryDate || ''}
                              onChange={(e) => updateRow(idx, 'expiryDate', e.target.value)}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-1 text-[11px] font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Financial Calculation Summary */}
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-4 border border-blue-100 dark:border-blue-900/40 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Taxable Subtotal:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{settings.tax_label || 'Input VAT (15%)'}:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between items-baseline pt-1 border-t border-blue-200 dark:border-blue-900 text-sm font-black text-blue-900 dark:text-blue-200">
                  <span>GRAND TOTAL:</span>
                  <span className="font-mono text-lg">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              {/* Immediate Payment Input */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Immediate Paid Amount ({settings.currency_symbol || 'SAR'})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.paidAmount}
                    onChange={(e) => setForm({ ...form, paidAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Payment Source</label>
                  <select
                    value={form.paymentMethodId}
                    onChange={(e) => setForm({ ...form, paymentMethodId: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none font-semibold"
                  >
                    <option value={1}>Cash Drawer (Till Outflow)</option>
                    <option value={2}>Bank Transfer / Card</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {loading ? 'Processing Shipment...' : 'Confirm Goods Received'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Purchase Detail Voucher Modal */}
      {isDetailModalOpen && selectedPurchaseDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold">
                  Purchase Voucher: {selectedPurchaseDetail.purchase.reference_no}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Supplier: {selectedPurchaseDetail.purchase.supplier_name} • Inv: {selectedPurchaseDetail.purchase.supplier_invoice_no || 'N/A'}
                </p>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs mb-4">
              <table className="w-full text-left">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                  <tr>
                    <th className="py-1">Item</th>
                    <th className="py-1 text-right">Net Cost</th>
                    <th className="py-1 text-center">Qty</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedPurchaseDetail.items.map((item: any) => (
                    <tr key={item.id}>
                      <td className="py-2 font-bold text-slate-800 dark:text-slate-200">{item.product_name} ({item.sku})</td>
                      <td className="py-2 text-right font-mono">{formatCurrency(item.net_unit_cost)}</td>
                      <td className="py-2 text-center font-mono">{item.quantity}</td>
                      <td className="py-2 text-right font-mono font-bold">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-2 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="font-sans text-slate-500 dark:text-slate-400">Grand Total:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(selectedPurchaseDetail.purchase.grand_total)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span className="font-sans text-slate-500 dark:text-slate-400">Paid Amount:</span>
                  <span>{formatCurrency(selectedPurchaseDetail.purchase.paid_amount)}</span>
                </div>
                <div className="flex justify-between text-amber-600 dark:text-amber-400 font-bold">
                  <span className="font-sans text-slate-500 dark:text-slate-400">Due Amount (Accounts Payable):</span>
                  <span>{formatCurrency(selectedPurchaseDetail.purchase.due_amount)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
