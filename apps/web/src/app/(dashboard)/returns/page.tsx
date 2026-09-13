'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { Button, IconButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { MetricCard } from '@/components/ui/MetricCard';
import {
  RotateCcw,
  Search,
  Check,
  AlertCircle,
  Plus,
  ArrowRight,
  ShieldCheck,
  X,
  FileText,
  KeyRound,
  DollarSign,
  Package,
} from 'lucide-react';

export default function ReturnsPage() {
  const { formatCurrency, settings } = useSettings();
  const [salesReturns, setSalesReturns] = useState<any[]>([]);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);

  // Lookup & Return workflow state
  const [searchInvoiceNo, setSearchInvoiceNo] = useState('');
  const [foundSale, setFoundSale] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [refundMethodId, setRefundMethodId] = useState<number>(1);
  const [reason, setReason] = useState('Customer changed mind / Defective item');

  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

  const loadData = async () => {
    setTableLoading(true);
    const [retRes, pmRes] = await Promise.all([
      apiRequest('/returns/sales'),
      apiRequest('/settings/payment-methods'),
    ]);
    if (retRes.success && retRes.data) setSalesReturns(retRes.data);
    if (pmRes.success && pmRes.data) setPaymentMethods(pmRes.data);
    
    // Set default refund method if none selected
    if (pmRes.success && pmRes.data && pmRes.data.length > 0) {
      setRefundMethodId(pmRes.data.find((pm: any) => pm.is_cash)?.id || pmRes.data[0].id);
    }
    
    setTableLoading(false);
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
      const items = (res.data.items || []).map((i: any) => {
        const originalQty = Number(i.quantity);
        const alreadyReturned = Number(i.already_returned_qty || 0);
        const maxQty = Math.max(0, Number(i.returnable_quantity ?? (originalQty - alreadyReturned)));
        return {
          saleItemId: i.id,
          productId: i.product_id || i.productId || 1,
          productName: i.product_name,
          sku: i.sku,
          originalQty,
          alreadyReturned,
          maxQty,
          returnQty: 0,
          unitPrice: Number(i.unit_price),
          taxAmount: originalQty > 0 ? Number(i.tax_amount) / originalQty : 0,
          restocked: true,
        };
      });
      setReturnItems(items);

      if (res.data.returnPolicy && !res.data.returnPolicy.isReturnEligible) {
        setErrorMsg(
          `Return window expired: This invoice was issued ${res.data.returnPolicy.daysSinceSale} days ago (store return policy deadline is ${res.data.returnPolicy.policyDays} days).`
        );
      } else if (items.every((it: any) => it.maxQty === 0)) {
        setErrorMsg('All items from this invoice have already been returned in full.');
      }
    } else {
      setErrorMsg(res.message || 'Original sales invoice not found in records.');
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

    try {
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
        setErrorMsg('Please specify a return quantity for at least one line item.');
        return;
      }

      const saleId = foundSale?.sale?.id || foundSale?.invoice?.sale_id;
      if (!saleId) {
        setErrorMsg('Invalid invoice reference: could not resolve original sale ID.');
        return;
      }

      const res = await apiRequest('/returns/sales', {
        method: 'POST',
        body: JSON.stringify({
          saleId: Number(saleId),
          refundMethodId: Number(refundMethodId),
          reason,
          items: itemsToReturn,
        }),
      });

      if (res.success) {
        setSuccessMsg('Sales return processed successfully! Credit note issued and stock adjusted.');
        setIsProcessModalOpen(false);
        setFoundSale(null);
        setSearchInvoiceNo('');
        loadData();
      } else {
        setErrorMsg(res.message || 'Return processing failed.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An unexpected error occurred while processing return.');
    } finally {
      setLoading(false);
    }
  };

  const totalRefundAmount = salesReturns.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            Returns & Credit Notes Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Customer sales returns, restocking, damaged write-offs, credit notes, and VAT reversals.
          </p>
        </div>
        <Button
          variant="danger"
          size="md"
          onClick={() => {
            setErrorMsg(null);
            setSuccessMsg(null);
            setFoundSale(null);
            setIsProcessModalOpen(true);
          }}
          leftIcon={<RotateCcw className="h-4 w-4" />}
        >
          Process Sales Return
        </Button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-4 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
          <Check className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricCard
          label="Total Returns Value Issued"
          value={formatCurrency(totalRefundAmount)}
          subValue={`${salesReturns.length} Return Credit Notes Logged`}
          icon={<RotateCcw className="h-5 w-5" />}
          variant="danger"
        />

        <MetricCard
          label="Restocked vs Damaged Adjustments"
          value={`${salesReturns.length} Transactions`}
          subValue="Direct Cashier & Manager Return Processing"
          icon={<ShieldCheck className="h-5 w-5" />}
          variant="default"
        />
      </div>

      {/* Returns History DataTable */}
      <DataTable
        isLoading={tableLoading}
        data={salesReturns}
        keyExtractor={(r) => r.id}
        emptyMessage="No sales return transactions logged yet."
        columns={[
          {
            header: 'Return Reference / Date',
            accessor: (r) => (
              <div>
                <div className="font-mono font-bold text-slate-900 dark:text-white">
                  {r.reference_no}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {new Date(r.created_at).toLocaleDateString('en-GB')} {new Date(r.created_at).toLocaleTimeString()}
                </div>
              </div>
            ),
          },
          {
            header: 'Original Sale Ref',
            accessor: (r) => (
              <span className="font-mono font-bold text-blue-700 dark:text-sky-400">
                {r.sale_ref}
              </span>
            ),
          },
          {
            header: 'Customer',
            accessor: (r) => (
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {r.customer_name || 'Walk-in Customer'}
              </span>
            ),
          },
          {
            header: 'Refund Method',
            accessor: (r) => (
              <Badge variant="primary">{r.refund_method?.toUpperCase()}</Badge>
            ),
          },
          {
            header: 'Return Reason',
            accessor: (r) => (
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {r.reason}
              </span>
            ),
          },
          {
            header: 'Processed By',
            accessor: (r) => (
              <span className="font-mono text-[11px] text-slate-500">{r.user_name}</span>
            ),
          },
          {
            header: 'Refund Total',
            align: 'right',
            accessor: (r) => (
              <span className="font-mono font-bold text-red-600 dark:text-red-400">
                {formatCurrency(r.total_amount)}
              </span>
            ),
          },
        ]}
      />

      {/* Process Sales Return Modal */}
      <Modal
        isOpen={isProcessModalOpen}
        onClose={() => setIsProcessModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-red-600 dark:text-red-400" />
            <span>Process Customer Sales Return & Credit Note</span>
          </div>
        }
        subtitle="Reverse VAT and restore saleable goods to original batch allocation"
        maxWidth="4xl"
        footer={
          foundSale ? (
            <>
              <Button variant="secondary" onClick={() => setIsProcessModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                isLoading={loading}
                disabled={calculateReturnTotal() === 0 || (foundSale?.returnPolicy && !foundSale.returnPolicy.isReturnEligible)}
                onClick={handleProcessReturn}
              >
                Confirm Refund ({formatCurrency(calculateReturnTotal())})
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setIsProcessModalOpen(false)}>
              Close
            </Button>
          )
        }
      >
        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 1: Search Sale Invoice */}
        <form onSubmit={handleSearchSale} className="flex items-center gap-2 mb-4">
          <div className="flex-1 min-w-0">
            <Input
              value={searchInvoiceNo}
              onChange={(e) => setSearchInvoiceNo(e.target.value)}
              required
              placeholder="Enter Invoice No or Sale Ref (e.g. INV-202609-0001)..."
              className="font-mono text-xs"
            />
          </div>
          <Button
            type="submit"
            isLoading={searching}
            variant="primary"
            className="shrink-0 whitespace-nowrap px-4"
            leftIcon={<Search className="h-4 w-4 shrink-0" />}
          >
            Find Invoice
          </Button>
        </form>

        {/* Step 2: Select Items to Return */}
        {foundSale && (
          <div className="space-y-4 text-xs">
            <div className="rounded-2xl bg-blue-50 dark:bg-sky-950/40 p-3.5 border border-blue-200 dark:border-sky-900/40 flex justify-between items-center">
              <div>
                <span className="font-bold text-blue-950 dark:text-sky-200">
                  Invoice #{foundSale.invoice?.invoice_no || foundSale.sale?.reference_no}
                </span>
                <p className="text-[11px] text-slate-500">
                  Original Total: {formatCurrency(foundSale.sale?.grand_total || foundSale.invoice?.grand_total || 0)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {foundSale.returnPolicy?.isReturnEligible ? (
                  <Badge variant="success">Policy Valid ({foundSale.returnPolicy.daysSinceSale}/{foundSale.returnPolicy.policyDays}d)</Badge>
                ) : foundSale.returnPolicy ? (
                  <Badge variant="danger">Policy Expired ({foundSale.returnPolicy.daysSinceSale}d &gt; {foundSale.returnPolicy.policyDays}d)</Badge>
                ) : (
                  <Badge variant="primary">Verified</Badge>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-850 text-slate-400 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3 text-right">Sold Price</th>
                    <th className="py-2.5 px-3 text-center">Returned / Purchased</th>
                    <th className="py-2.5 px-3 text-center">Return Qty</th>
                    <th className="py-2.5 px-3 text-center">Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {returnItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        {item.productName}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                          {item.alreadyReturned}/{item.originalQty}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          max={item.maxQty}
                          disabled={item.maxQty <= 0 || (foundSale?.returnPolicy && !foundSale.returnPolicy.isReturnEligible)}
                          step="1"
                          value={item.returnQty}
                          onChange={(e) => updateItemQty(idx, parseFloat(e.target.value) || 0)}
                          className="w-16 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-1 text-center font-mono font-bold disabled:opacity-40"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <select
                          value={item.restocked ? 'restock' : 'damage'}
                          onChange={(e) => updateItemRestock(idx, e.target.value === 'restock')}
                          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-1 text-xs font-semibold"
                        >
                          <option value="restock">Restock to Batch</option>
                          <option value="damage">Damaged Write-off</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Refund Tender & Return Reason */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
              <Select
                label="Refund Destination Tender *"
                value={refundMethodId}
                onChange={(e) => setRefundMethodId(parseInt(e.target.value))}
              >
                {paymentMethods.filter((pm: any) => pm.is_cash || pm.name?.toLowerCase().includes('card') || pm.name?.toLowerCase().includes('mada')).map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name} {pm.is_cash ? '(from Till Drawer)' : '(Card Reversal)'}
                  </option>
                ))}
              </Select>

              <Input
                label="Return Reason *"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for return"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
