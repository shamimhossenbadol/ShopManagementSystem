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
  batchNumber?: string;
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
            Receive supplier shipments, update atomic inventory, create batch FEFO records, and recalculate WAC cost.
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openDetail(p)}
                leftIcon={<Eye className="h-3.5 w-3.5" />}
              >
                Inspect
              </Button>
            ),
          },
        ]}
      />

      {/* Receive Purchase Order Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-700 dark:text-sky-400" />
            <span>Receive Supplier Purchase Order</span>
          </div>
        }
        subtitle="Increases atomic inventory and recalculates Perpetual Weighted Average Cost (WAC)"
        maxWidth="4xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" isLoading={loading} onClick={handleCreate}>
              Confirm Receipt ({formatCurrency(grandTotal)})
            </Button>
          </>
        }
      >
        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Supplier Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Supplier / Vendor *"
              required
              value={form.supplierId}
              onChange={(e) => setForm({ ...form, supplierId: parseInt(e.target.value) })}
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.company_name || 'Vendor'})
                </option>
              ))}
            </Select>

            <Input
              label="Supplier Physical Invoice Number"
              value={form.supplierInvoiceNo}
              onChange={(e) => setForm({ ...form, supplierInvoiceNo: e.target.value })}
              placeholder="e.g. SINV-88402"
            />
          </div>

          {/* Line Items Builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Purchased Shipment Items
              </label>
              <Button size="sm" variant="secondary" onClick={addItemRow} leftIcon={<Plus className="h-3.5 w-3.5" />}>
                Add Line Item
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {itemRows.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 text-xs items-center"
                >
                  <div className="col-span-12 sm:col-span-4">
                    <Select
                      value={row.productId}
                      onChange={(e) => updateRow(idx, 'productId', parseInt(e.target.value))}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="col-span-6 sm:col-span-2">
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder="Unit Cost"
                      value={row.netUnitCost}
                      onChange={(e) => updateRow(idx, 'netUnitCost', parseFloat(e.target.value) || 0)}
                      rightAddon="SAR"
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-2">
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      placeholder="Quantity"
                      value={row.quantity}
                      onChange={(e) => updateRow(idx, 'quantity', parseFloat(e.target.value) || 1)}
                    />
                  </div>

                  <div className="col-span-10 sm:col-span-3">
                    <Input
                      type="text"
                      placeholder="Batch # (Optional)"
                      value={row.batchNumber || ''}
                      onChange={(e) => updateRow(idx, 'batchNumber', e.target.value)}
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                    <IconButton
                      title="Remove Row"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      variant="danger"
                      size="sm"
                      onClick={() => removeItemRow(idx)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment & Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-blue-50/50 dark:bg-sky-950/20 border border-blue-200 dark:border-sky-900/40">
            <div>
              <Input
                label="Freight / Landed Cost (SAR)"
                type="number"
                step="0.01"
                value={form.shippingCost}
                onChange={(e) => setForm({ ...form, shippingCost: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Input
                label="Amount Paid at Receiving (SAR)"
                type="number"
                step="0.01"
                value={form.paidAmount}
                onChange={(e) => setForm({ ...form, paidAmount: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Select
                label="Payment Method"
                value={form.paymentMethodId}
                onChange={(e) => setForm({ ...form, paymentMethodId: parseInt(e.target.value) })}
              >
                <option value={1}>Cash (Drawer Outflow)</option>
                <option value={2}>Bank Transfer</option>
                <option value={3}>Cheque / Mada</option>
              </Select>
            </div>
          </div>

          {/* Financial Recalculation Preview */}
          <div className="flex justify-between items-center p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-mono">
            <span>Taxable Subtotal: {formatCurrency(subtotal)}</span>
            <span>VAT (15%): {formatCurrency(tax)}</span>
            <span className="font-bold text-sm text-blue-700 dark:text-sky-400">
              Grand Total: {formatCurrency(grandTotal)}
            </span>
          </div>
        </form>
      </Modal>

      {/* Inspect Purchase Order Modal */}
      {isDetailModalOpen && selectedPurchaseDetail && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-700 dark:text-sky-400" />
              <span>Purchase Order Details: {selectedPurchaseDetail.purchase?.reference_no}</span>
            </div>
          }
          subtitle={`Supplier: ${selectedPurchaseDetail.purchase?.supplier_name} • Invoice: ${selectedPurchaseDetail.purchase?.supplier_invoice_no || 'N/A'}`}
          maxWidth="2xl"
          footer={
            <Button variant="secondary" onClick={() => setIsDetailModalOpen(false)}>
              Close
            </Button>
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
    </div>
  );
}
