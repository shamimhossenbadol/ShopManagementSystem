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
  Truck,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Eye,
  X,
  Building2,
  Calendar,
  DollarSign,
  Printer,
  Package,
} from 'lucide-react';

interface PurchaseItemRow {
  productId: number;
  netUnitCost: number;
  quantity: number;
  taxRate: number;
  expiryDate?: string;
}

export default function PurchasesPage() {
  const { formatCurrency, settings } = useSettings();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedPurchaseDetail, setSelectedPurchaseDetail] = useState<any>(null);

  // Settle Bill Payment State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedPurchaseForPay, setSelectedPurchaseForPay] = useState<any>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethodId, setPayMethodId] = useState<number>(1);
  const [payNotes, setPayNotes] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payErrorMsg, setPayErrorMsg] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(true);
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
    setTableLoading(true);
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
    setTableLoading(false);
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
    setItemRows((prev) => [
      ...prev,
      {
        productId: products[0]?.id || 1,
        netUnitCost: Number(products[0]?.cost_price || 10),
        quantity: 1,
        taxRate: 15.0,
      },
    ]);
  };

  const removeItemRow = (idx: number) => {
    setItemRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  };

  const updateRow = (idx: number, field: keyof PurchaseItemRow, value: any) => {
    setItemRows((prev) => {
      const updated = [...prev];
      if (!updated[idx]) return prev;
      updated[idx] = { ...updated[idx], [field]: value };
      if (field === 'productId') {
        const prod = products.find((p) => p.id === Number(value));
        if (prod) {
          updated[idx].netUnitCost = Number(prod.cost_price || 10);
        }
      }
      return updated;
    });
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let tax = 0;
    itemRows.forEach((r) => {
      const itemSub = Number(r.netUnitCost || 0) * Number(r.quantity || 0);
      const itemTax = itemSub * (Number(r.taxRate || 0) / 100);
      subtotal += itemSub;
      tax += itemTax;
    });
    const grandTotal = subtotal + tax + Number(form.shippingCost || 0);
    return { subtotal, tax, grandTotal };
  };

  const { subtotal, tax, grandTotal } = calculateTotals();

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.supplierId) {
      setErrorMsg('Please select a supplier.');
      return;
    }
    if (itemRows.length === 0) {
      setErrorMsg('Please add at least one line item.');
      return;
    }
    for (let i = 0; i < itemRows.length; i++) {
      const item = itemRows[i];
      if (!item.productId) {
        setErrorMsg(`Line item #${i + 1} has no product selected.`);
        return;
      }
      if (!item.quantity || item.quantity <= 0) {
        setErrorMsg(`Line item #${i + 1} must have a quantity of at least 1.`);
        return;
      }
      if (item.netUnitCost < 0) {
        setErrorMsg(`Line item #${i + 1} unit cost cannot be negative.`);
        return;
      }
    }

    if (Number(form.paidAmount || 0) > grandTotal) {
      setErrorMsg(
        `Amount Paid at Receipt (${formatCurrency(form.paidAmount)}) cannot be greater than the Grand Total (${formatCurrency(grandTotal)}).`
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const res = await apiRequest('/purchases', {
      method: 'POST',
      body: JSON.stringify({
        supplierId: Number(form.supplierId),
        supplierInvoiceNo: form.supplierInvoiceNo?.trim() || undefined,
        items: itemRows.map((r) => ({
          productId: Number(r.productId),
          netUnitCost: Number(r.netUnitCost),
          quantity: Number(r.quantity),
          taxRate: Number(r.taxRate),
          expiryDate: r.expiryDate || undefined,
        })),
        shippingCost: Number(form.shippingCost || 0),
        paidAmount: Number(form.paidAmount || 0),
        paymentMethodId: Number(form.paymentMethodId || 1),
      }),
    });

    setLoading(false);

    if (res.success) {
      setIsModalOpen(false);
      loadData();
    } else {
      setErrorMsg(res.message || 'Failed to record purchase order receipt.');
    }
  };

  const openDetail = async (p: any) => {
    const res = await apiRequest(`/purchases/${p.id}`);
    if (res.success && res.data) {
      setSelectedPurchaseDetail(res.data);
      setIsDetailModalOpen(true);
    }
  };

  const openPayModal = (purchase: any) => {
    setSelectedPurchaseForPay(purchase);
    setPayAmount(Number(purchase.due_amount || 0));
    setPayMethodId(1);
    setPayNotes(`Bill settlement for ${purchase.reference_no}`);
    setPayErrorMsg(null);
    setIsPayModalOpen(true);
  };

  const handlePayPurchase = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedPurchaseForPay) return;
    if (payAmount <= 0) {
      setPayErrorMsg('Settlement amount must be greater than 0.');
      return;
    }
    setPayLoading(true);
    setPayErrorMsg(null);

    const res = await apiRequest('/ledgers/suppliers/pay', {
      method: 'POST',
      body: JSON.stringify({
        supplierId: selectedPurchaseForPay.supplier_id,
        purchaseId: selectedPurchaseForPay.id,
        amount: Number(payAmount),
        paymentMethodId: Number(payMethodId),
        notes: payNotes || `Settlement for ${selectedPurchaseForPay.reference_no}`,
      }),
    });

    setPayLoading(false);

    if (res.success) {
      setIsPayModalOpen(false);
      setIsDetailModalOpen(false);
      loadData();
    } else {
      setPayErrorMsg(res.message || 'Failed to record supplier payment.');
    }
  };

  const totalPurchasesAmount = purchases.reduce((sum, p) => sum + Number(p.grand_total || 0), 0);
  const totalPaidAmount = purchases.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0);
  const totalDueAmount = purchases.reduce((sum, p) => sum + Number(p.due_amount || 0), 0);

  const filteredPurchases = purchases.filter((p) => {
    return (
      p.reference_no?.toLowerCase().includes(search.toLowerCase()) ||
      p.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
      (p.supplier_invoice_no && p.supplier_invoice_no.toLowerCase().includes(search.toLowerCase()))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            Procurement & Purchase Orders
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Receive supplier shipments, update atomic inventory, and recalculate WAC cost.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={openCreate}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Receive Purchase Order
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total Procurement Spend"
          value={formatCurrency(totalPurchasesAmount)}
          subValue={`${purchases.length} Purchase Invoices`}
          icon={<Truck className="h-5 w-5" />}
          variant="primary"
        />

        <MetricCard
          label="Supplier Paid Amount"
          value={formatCurrency(totalPaidAmount)}
          subValue="Settled Vendor Cash"
          icon={<DollarSign className="h-5 w-5" />}
          variant="success"
        />

        <MetricCard
          label="Supplier Due (Accounts Payable)"
          value={formatCurrency(totalDueAmount)}
          subValue="Outstanding Vendor Debt"
          icon={<Building2 className="h-5 w-5" />}
          variant="warning"
        />
      </div>

      {/* Search Toolbar */}
      <div className="flex items-center rounded-2xl bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by purchase reference, supplier, or invoice #..."
            className="text-xs"
          />
        </div>
      </div>

      {/* Purchases Master DataTable */}
      <DataTable
        isLoading={tableLoading}
        data={filteredPurchases}
        keyExtractor={(p) => p.id}
        emptyMessage="No procurement purchase orders found."
        columns={[
          {
            header: 'Reference & Date',
            accessor: (p) => (
              <div>
                <div className="font-mono font-bold text-blue-700 dark:text-sky-400">
                  {p.reference_no}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {new Date(p.created_at).toLocaleDateString('en-GB')} • Inv: {p.supplier_invoice_no || 'N/A'}
                </div>
              </div>
            ),
          },
          {
            header: 'Supplier',
            accessor: (p) => (
              <span className="font-bold text-slate-900 dark:text-white">
                {p.supplier_name}
              </span>
            ),
          },
          {
            header: 'Grand Total',
            align: 'right',
            accessor: (p) => (
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {formatCurrency(p.grand_total)}
              </span>
            ),
          },
          {
            header: 'Paid Amount',
            align: 'right',
            accessor: (p) => (
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                {formatCurrency(p.paid_amount)}
              </span>
            ),
          },
          {
            header: 'Due Amount',
            align: 'right',
            accessor: (p) => (
              <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold">
                {formatCurrency(p.due_amount)}
              </span>
            ),
          },
          {
            header: 'Payment Status',
            align: 'center',
            accessor: (p) => (
              <Badge
                variant={
                  p.payment_status === 'paid'
                    ? 'success'
                    : p.payment_status === 'partial'
                    ? 'warning'
                    : 'danger'
                }
              >
                {p.payment_status?.toUpperCase()}
              </Badge>
            ),
          },
          {
            header: 'Action',
            align: 'right',
            accessor: (p) => (
              <div className="flex items-center justify-end gap-1.5">
                {Number(p.due_amount) > 0 && (
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => openPayModal(p)}
                    leftIcon={<DollarSign className="h-3.5 w-3.5" />}
                  >
                    Settle
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openDetail(p)}
                  leftIcon={<Eye className="h-3.5 w-3.5" />}
                >
                  Inspect
                </Button>
              </div>
            ),
          },
        ]}
      />

      {/* Receive Purchase Order Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        icon={<Truck className="h-5 w-5 text-blue-600 dark:text-sky-400" />}
        title="Receive Purchase Order"
        subtitle="Record inventory shipment and update stock"
        maxWidth="4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-slate-500">
              <span>
                Items: <strong className="text-slate-900 dark:text-white">{itemRows.length}</strong>
              </span>
              <span>
                Total Units:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {itemRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" size="sm" isLoading={loading} onClick={() => handleCreate()}>
                Confirm Receipt ({formatCurrency(grandTotal)})
              </Button>
            </div>
          </div>
        }
      >
        {errorMsg && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-2.5 text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-3">
          {/* Top Section: Supplier, Invoice No, Payment Method in 1 Compact Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800">
            <Select
              label="Supplier / Vendor"
              required
              value={form.supplierId}
              onChange={(e) => setForm({ ...form, supplierId: parseInt(e.target.value) })}
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.company_name ? `(${s.company_name})` : ''}
                </option>
              ))}
            </Select>

            <Input
              label="Supplier Invoice #"
              value={form.supplierInvoiceNo}
              onChange={(e) => setForm({ ...form, supplierInvoiceNo: e.target.value })}
              placeholder="e.g. SINV-88402"
            />

            <Select
              label="Payment Outflow Method"
              value={form.paymentMethodId}
              onChange={(e) => setForm({ ...form, paymentMethodId: parseInt(e.target.value) })}
            >
              <option value={1}>Cash Drawer (Outflow)</option>
              <option value={2}>Bank Direct Transfer</option>
              <option value={3}>Cheque / Electronic</option>
            </Select>
          </div>

          {/* Line Items Table: Modern Dense Spreadsheet Style */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Shipment Items
                </span>
                <Badge variant="neutral" size="sm">
                  {itemRows.length} {itemRows.length === 1 ? 'item' : 'items'}
                </Badge>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={addItemRow}
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                className="h-7 text-xs px-2.5"
              >
                Add Line Item
              </Button>
            </div>

            <div className="max-h-56 overflow-y-auto overflow-x-auto divide-y divide-slate-100 dark:divide-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 dark:bg-slate-850/90 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 text-[11px]">
                  <tr>
                    <th className="py-2 px-2.5 w-8 text-center text-slate-400">#</th>
                    <th className="py-2 px-2.5 min-w-[200px]">Product / Item</th>
                    <th className="py-2 px-2.5 w-28 text-right">Cost (SAR)</th>
                    <th className="py-2 px-2.5 w-24 text-center">Qty</th>
                    <th className="py-2 px-2.5 w-28 text-right">Total (Incl. VAT)</th>
                    <th className="py-2 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {itemRows.map((row, idx) => {
                    const lineSub = Number(row.netUnitCost || 0) * Number(row.quantity || 0);
                    const lineTotal = lineSub * (1 + Number(row.taxRate || 15) / 100);
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                        <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-2">
                          <select
                            value={row.productId}
                            onChange={(e) => updateRow(idx, 'productId', parseInt(e.target.value))}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 px-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-sky-400"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.sku ? `(${p.sku})` : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={row.netUnitCost}
                            onChange={(e) => updateRow(idx, 'netUnitCost', parseFloat(e.target.value) || 0)}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 px-2 text-xs font-mono text-right text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-sky-400"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            placeholder="1"
                            value={row.quantity}
                            onChange={(e) => updateRow(idx, 'quantity', parseFloat(e.target.value) || 1)}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 px-2 text-xs font-mono text-center font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-sky-400"
                          />
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatCurrency(lineTotal)}
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <button
                            type="button"
                            title="Delete Item"
                            onClick={() => removeItemRow(idx)}
                            disabled={itemRows.length <= 1}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Grid: Shipping/Payment on left + Compact Financial Summary on right */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            {/* Left: Shipping and Settlement */}
            <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800">
              <Input
                label="Freight / Shipping (SAR)"
                type="number"
                step="0.01"
                min="0"
                value={form.shippingCost}
                onChange={(e) => setForm({ ...form, shippingCost: parseFloat(e.target.value) || 0 })}
              />
              <Input
                label="Amount Paid at Receipt (SAR)"
                type="number"
                step="0.01"
                min="0"
                max={grandTotal}
                value={form.paidAmount}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setForm({ ...form, paidAmount: Math.min(val, grandTotal) });
                }}
                error={
                  form.paidAmount > grandTotal
                    ? `Cannot exceed Grand Total (${formatCurrency(grandTotal)})`
                    : undefined
                }
              />
            </div>

            {/* Right: Clean Financial Summary */}
            <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-sky-950/20 border border-blue-200 dark:border-sky-900/40 text-xs font-mono space-y-1">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal (Excl. VAT):</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>VAT (15%):</span>
                <span>+{formatCurrency(tax)}</span>
              </div>
              {Number(form.shippingCost) > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Freight:</span>
                  <span>+{formatCurrency(form.shippingCost)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-blue-200 dark:border-sky-900/60 font-bold text-sm text-slate-900 dark:text-white">
                <span>Grand Total:</span>
                <span className="text-blue-700 dark:text-sky-400">{formatCurrency(grandTotal)}</span>
              </div>
              <div className="flex justify-between text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                <span>Payable Remaining:</span>
                <span>{formatCurrency(Math.max(0, grandTotal - Number(form.paidAmount || 0)))}</span>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* Inspect Purchase Order Modal */}
      {isDetailModalOpen && selectedPurchaseDetail && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          icon={<Truck className="h-5 w-5 text-blue-600 dark:text-sky-400" />}
          title={`Purchase Order: ${selectedPurchaseDetail.purchase?.reference_no}`}
          subtitle={`Supplier: ${selectedPurchaseDetail.purchase?.supplier_name} • Invoice: ${selectedPurchaseDetail.purchase?.supplier_invoice_no || 'N/A'}`}
          maxWidth="2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              {Number(selectedPurchaseDetail.purchase?.due_amount) > 0 ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    openPayModal(selectedPurchaseDetail.purchase);
                  }}
                  leftIcon={<DollarSign className="h-4 w-4" />}
                >
                  Settle Due Balance ({formatCurrency(selectedPurchaseDetail.purchase?.due_amount)})
                </Button>
              ) : (
                <div />
              )}
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-850">
              <div>
                <div className="text-slate-400">Total Items:</div>
                <div className="font-mono font-bold text-slate-900 dark:text-white">
                  {selectedPurchaseDetail.items?.length || 0}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Grand Total:</div>
                <div className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatCurrency(selectedPurchaseDetail.purchase?.grand_total)}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Amount Paid:</div>
                <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(selectedPurchaseDetail.purchase?.paid_amount)}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Balance Due:</div>
                <div className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(selectedPurchaseDetail.purchase?.due_amount)}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-850 text-slate-400 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Item</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Cost</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedPurchaseDetail.items?.map((it: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">{it.product_name}</td>
                      <td className="py-2 px-3 text-center font-mono">{it.quantity}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatCurrency(it.unit_cost)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{formatCurrency(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {/* Settle Purchase Due Modal */}
      {isPayModalOpen && selectedPurchaseForPay && (
        <Modal
          isOpen={isPayModalOpen}
          onClose={() => setIsPayModalOpen(false)}
          icon={<DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          title={`Settle Bill: ${selectedPurchaseForPay.reference_no}`}
          subtitle={`Supplier: ${selectedPurchaseForPay.supplier_name || 'Vendor'} • Outstanding Due: ${formatCurrency(selectedPurchaseForPay.due_amount)}`}
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsPayModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={payLoading}
                onClick={handlePayPurchase}
                leftIcon={<Check className="h-4 w-4" />}
              >
                Confirm Payment ({formatCurrency(payAmount)})
              </Button>
            </div>
          }
        >
          {payErrorMsg && (
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-2.5 text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{payErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handlePayPurchase} className="space-y-3">
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex justify-between items-center text-xs">
              <span className="font-semibold text-amber-900 dark:text-amber-200">Current Purchase Due</span>
              <span className="font-mono font-bold text-sm text-amber-700 dark:text-amber-400">
                {formatCurrency(selectedPurchaseForPay.due_amount)}
              </span>
            </div>

            <Input
              label="Settlement Amount (SAR)"
              type="number"
              step="0.01"
              min="0.01"
              max={Number(selectedPurchaseForPay.due_amount)}
              required
              value={payAmount}
              onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
              className="font-mono text-base font-bold"
            />

            <Select
              label="Payment Outflow Method"
              required
              value={payMethodId}
              onChange={(e) => setPayMethodId(parseInt(e.target.value))}
            >
              <option value={1}>Cash Drawer (Outflow)</option>
              <option value={2}>Bank Direct Transfer</option>
              <option value={3}>Cheque Payment</option>
            </Select>

            <Input
              label="Payment Notes / Reference #"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder="e.g. Paid via bank transfer / cheque"
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
