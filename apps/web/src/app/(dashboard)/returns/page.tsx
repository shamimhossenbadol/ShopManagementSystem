'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import {
  RotateCcw,
  Search,
  Check,
  AlertCircle,
  Plus,
  ArrowRight,
  ShieldCheck,
  X,
} from 'lucide-react';

export default function ReturnsPage() {
  const { formatCurrency, settings } = useSettings();
  const [salesReturns, setSalesReturns] = useState<any[]>([]);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);

  // Lookup state
  const [searchInvoiceNo, setSearchInvoiceNo] = useState('');
  const [foundSale, setFoundSale] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [refundMethodId, setRefundMethodId] = useState<number>(1);
  const [reason, setReason] = useState('Customer changed mind / Defective item');
  const [managerPin, setManagerPin] = useState('');

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    const res = await apiRequest('/returns/sales');
    if (res.success && res.data) setSalesReturns(res.data);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearchSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setErrorMsg(null);
    setFoundSale(null);

    const res = await apiRequest(`/invoices/${encodeURIComponent(searchInvoiceNo.trim())}`);
    setSearching(false);

    if (res.success && res.data) {
      setFoundSale(res.data);
      setReturnItems(
        res.data.items.map((i: any) => ({
          saleItemId: i.id,
          productId: i.product_id || 1,
          productName: i.product_name,
          sku: i.sku,
          maxQty: Number(i.quantity),
          returnQty: 0,
          unitPrice: Number(i.unit_price),
          taxAmount: Number(i.tax_amount) / Number(i.quantity),
          restocked: true,
        }))
      );
    } else {
      setErrorMsg(res.message || 'Original invoice not found.');
    }
  };

  const updateItemQty = (idx: number, qty: number) => {
    const updated = [...returnItems];
    const max = updated[idx].maxQty;
    updated[idx].returnQty = Math.max(0, Math.min(max, qty));
    setReturnItems(updated);
  };

  const updateItemRestock = (idx: number, restocked: boolean) => {
    const updated = [...returnItems];
    updated[idx].restocked = restocked;
    setReturnItems(updated);
  };

  const calculateReturnTotal = () => {
    return returnItems.reduce((sum, i) => sum + i.returnQty * i.unitPrice, 0);
  };

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const itemsToReturn = returnItems
      .filter((i) => i.returnQty > 0)
      .map((i) => ({
        saleItemId: i.saleItemId,
        productId: i.productId,
        quantity: i.returnQty,
        unitPrice: i.unitPrice,
        taxAmount: i.taxAmount * i.returnQty,
        subtotal: i.returnQty * i.unitPrice,
        restocked: i.restocked,
      }));

    if (itemsToReturn.length === 0) {
      setLoading(false);
      setErrorMsg('Please enter a return quantity for at least one item.');
      return;
    }

    const res = await apiRequest('/returns/sales', {
      method: 'POST',
      body: JSON.stringify({
        saleId: foundSale.sale.id,
        refundMethodId: Number(refundMethodId),
        reason,
        items: itemsToReturn,
        managerPin: managerPin || undefined,
      }),
    });

    setLoading(false);

    if (res.success) {
      setSuccessMsg('Sales return processed successfully and inventory adjusted.');
      setIsProcessModalOpen(false);
      setFoundSale(null);
      setSearchInvoiceNo('');
      loadData();
    } else {
      setErrorMsg(res.message || 'Return processing failed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Returns Management</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Customer sales returns, restocking, damaged write-offs, and VAT reversals.
          </p>
        </div>
        <button
          onClick={() => {
            setErrorMsg(null);
            setSuccessMsg(null);
            setFoundSale(null);
            setIsProcessModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-500/20 hover:bg-rose-500 transition"
        >
          <RotateCcw className="h-4 w-4" />
          Process Sales Return
        </button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
          <Check className="h-4 w-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Returns History Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-[10px] font-bold uppercase text-slate-400">
              <tr>
                <th className="py-3 px-4">Return Ref / Date</th>
                <th className="py-3 px-4">Original Sale Ref</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Refund Tender</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Processed By</th>
                <th className="py-3 px-4 text-right">Refund Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {salesReturns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">No return transactions logged yet.</td>
                </tr>
              ) : (
                salesReturns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-slate-900 dark:text-white">{r.reference_no}</div>
                      <div className="text-[10px] text-slate-400">{new Date(r.created_at).toLocaleString()}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">{r.sale_ref}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">{r.customer_name || 'Walk-in Customer'}</td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{r.refund_method}</td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">{r.reason}</td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">{r.user_name}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">{formatCurrency(r.total_amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Process Sales Return Modal */}
      {isProcessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-slate-900 dark:text-white">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-rose-500" />
                Process Customer Sales Return
              </h2>
              <button onClick={() => setIsProcessModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 p-2.5 text-xs text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                <AlertCircle className="h-4 w-4" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Step 1: Look up Sale */}
            <form onSubmit={handleSearchSale} className="flex gap-2 mb-4">
              <input
                type="text"
                required
                value={searchInvoiceNo}
                onChange={(e) => setSearchInvoiceNo(e.target.value)}
                placeholder="Enter Invoice No or Sale Ref (e.g. INV-202608-00001)..."
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs font-mono focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={searching}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md"
              >
                {searching ? 'Finding...' : 'Find Invoice'}
              </button>
            </form>

            {/* Step 2: Select Items to Return */}
            {foundSale && (
              <form onSubmit={handleProcessReturn} className="space-y-4 text-xs border-t border-slate-100 dark:border-slate-800 pt-4">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex justify-between font-bold text-slate-900 dark:text-white">
                    <span>Invoice: {foundSale.invoice.invoice_no}</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">{formatCurrency(foundSale.sale.grand_total)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Customer: {foundSale.invoice.customer_name || 'Walk-in'} • Date: {new Date(foundSale.invoice.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-2">Select Items & Quantities to Return:</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {returnItems.map((item, idx) => (
                      <div key={idx} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                        <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                          <span>{item.productName}</span>
                          <span className="font-mono text-slate-600 dark:text-slate-400">{formatCurrency(item.unitPrice)} each</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 items-center">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Return Qty (Max: {item.maxQty})</label>
                            <input
                              type="number"
                              min="0"
                              max={item.maxQty}
                              value={item.returnQty}
                              onChange={(e) => updateItemQty(idx, parseInt(e.target.value) || 0)}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-1.5 font-mono text-xs focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Disposition</label>
                            <select
                              value={item.restocked ? 'restock' : 'damage'}
                              onChange={(e) => updateItemRestock(idx, e.target.value === 'restock')}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-1.5 text-xs focus:border-blue-500 focus:outline-none font-semibold"
                            >
                              <option value="restock">Restock to Inventory</option>
                              <option value="damage">Damaged (Write-off)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Refund Total Callout */}
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 border border-rose-100 dark:border-rose-900/40 flex justify-between items-center">
                  <span className="font-bold text-rose-800 dark:text-rose-300">Total Refund Amount:</span>
                  <span className="font-mono text-xl font-black text-rose-900 dark:text-rose-200">{formatCurrency(calculateReturnTotal())}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Refund Tender</label>
                    <select
                      value={refundMethodId}
                      onChange={(e) => setRefundMethodId(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none font-semibold"
                    >
                      <option value={1}>Cash Drawer (Till Refund)</option>
                      <option value={2}>Bank Transfer / Mada Card</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Manager PIN Code (if Cashier)</label>
                    <input
                      type="password"
                      maxLength={6}
                      value={managerPin}
                      onChange={(e) => setManagerPin(e.target.value)}
                      placeholder="Manager PIN (e.g. 1234)"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Reason for Return *</label>
                  <input
                    type="text"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. Defective packaging / Expiry"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsProcessModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || calculateReturnTotal() === 0}
                    className="flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold shadow-md disabled:opacity-40"
                  >
                    <Check className="h-4 w-4" />
                    {loading ? 'Processing Return...' : 'Confirm Return & Refund'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
