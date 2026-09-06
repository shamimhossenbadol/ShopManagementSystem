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
  Boxes,
  Plus,
  Minus,
  History,
  AlertCircle,
  Check,
  Search,
  SlidersHorizontal,
  X,
  ShieldCheck,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';

export default function InventoryPage() {
  const { formatCurrency, settings } = useSettings();
  const [stockList, setStockList] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isMovementDrawerOpen, setIsMovementDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low_stock' | 'out_of_stock'>('all');

  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [adjustForm, setAdjustForm] = useState({
    productId: 0,
    type: 'addition',
    quantity: 1,
    reason: 'Physical inventory recount',
    notes: '',
  });

  const loadStock = async () => {
    setTableLoading(true);
    const res = await apiRequest('/inventory/stock');
    if (res.success && res.data) setStockList(res.data);
    setTableLoading(false);
  };

  useEffect(() => {
    loadStock();

    // Instant real-time stock sync when POS sales complete
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('shop_stock_sync');
      channel.onmessage = (event) => {
        if (event.data?.type === 'STOCK_UPDATED') {
          loadStock();
        }
      };
      return () => {
        channel.close();
      };
    }
  }, []);

  const openMovements = async (p: any) => {
    setSelectedProduct(p);
    setIsMovementDrawerOpen(true);
    const res = await apiRequest(`/inventory/movements/${p.id}`);
    if (res.success && res.data) setMovements(res.data);
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const res = await apiRequest('/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify({
        ...adjustForm,
        productId: Number(adjustForm.productId),
        quantity: Number(adjustForm.quantity),
      }),
    });

    setLoading(false);

    if (res.success) {
      setIsAdjustOpen(false);
      loadStock();
      if (selectedProduct && selectedProduct.id === Number(adjustForm.productId)) {
        openMovements(selectedProduct);
      }
    } else {
      setErrorMsg(res.message || 'Failed to adjust stock.');
    }
  };

  const filtered = stockList.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search));
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'low_stock'
        ? p.stock_status === 'low_stock'
        : p.stock_status === 'out_of_stock';
    return matchesSearch && matchesStatus;
  });

  const totalValuation = stockList.reduce((sum, p) => sum + Number(p.stock_valuation || 0), 0);
  const lowStockCount = stockList.filter((p) => p.stock_status === 'low_stock').length;
  const outOfStockCount = stockList.filter((p) => p.stock_status === 'out_of_stock').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            Inventory & Stock Movement Ledger
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time immutable stock ledger, physical audits, and manual adjustment logs.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setErrorMsg(null);
            setIsAdjustOpen(true);
          }}
          leftIcon={<SlidersHorizontal className="h-4 w-4" />}
        >
          Record Stock Adjustment
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total Inventory Valuation (WAC)"
          value={formatCurrency(totalValuation)}
          subValue={`${stockList.length} Active Catalog SKUs`}
          icon={<Boxes className="h-5 w-5" />}
          variant="primary"
        />

        <MetricCard
          label="Low Stock Alert SKUs"
          value={lowStockCount}
          subValue="Below Minimum Threshold"
          icon={<AlertCircle className="h-5 w-5" />}
          variant="warning"
          onClick={() => setStatusFilter('low_stock')}
        />

        <MetricCard
          label="Out of Stock SKUs"
          value={outOfStockCount}
          subValue="Immediate Procurement Needed"
          icon={<AlertCircle className="h-5 w-5" />}
          variant="danger"
          onClick={() => setStatusFilter('out_of_stock')}
        />
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stock by name, SKU, or barcode..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2 pl-10 pr-4 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition ${
              statusFilter === 'all'
                ? 'bg-blue-700 text-white shadow-sm dark:bg-sky-500 dark:text-slate-950'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            All Stock ({stockList.length})
          </button>
          <button
            onClick={() => setStatusFilter('low_stock')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition ${
              statusFilter === 'low_stock'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            Low Stock ({lowStockCount})
          </button>
          <button
            onClick={() => setStatusFilter('out_of_stock')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition ${
              statusFilter === 'out_of_stock'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            Out of Stock ({outOfStockCount})
          </button>
        </div>
      </div>

      {/* Stock Overview DataTable */}
      <DataTable
        isLoading={tableLoading}
        data={filtered}
        keyExtractor={(p) => p.id}
        emptyMessage="No inventory stock records found matching filter."
        columns={[
          {
            header: 'SKU & Product Name',
            accessor: (p) => (
              <div>
                <div className="font-bold text-slate-900 dark:text-white line-clamp-1">{p.name}</div>
                <div className="font-mono text-[11px] text-slate-400">SKU: {p.sku}</div>
              </div>
            ),
          },
          {
            header: 'Category',
            accessor: (p) => (
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                {p.category_name || 'General'}
              </span>
            ),
          },
          {
            header: 'Cost Price (WAC)',
            align: 'right',
            accessor: (p) => (
              <span className="font-mono text-slate-500">
                {formatCurrency(p.cost_price || 0)}
              </span>
            ),
          },
          {
            header: 'Current Stock',
            align: 'center',
            accessor: (p) => (
              <span className="font-mono font-black text-slate-900 dark:text-white">
                {p.current_stock} {p.unit_short}
              </span>
            ),
          },
          {
            header: 'Valuation',
            align: 'right',
            accessor: (p) => (
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {formatCurrency(p.stock_valuation || 0)}
              </span>
            ),
          },
          {
            header: 'Status',
            align: 'center',
            accessor: (p) => {
              const stock = Number(p.current_stock || 0);
              const min = Number(p.min_stock_level || 5);
              if (stock <= 0) return <Badge variant="danger">Out of Stock</Badge>;
              if (stock <= min) return <Badge variant="warning">Low Stock</Badge>;
              return <Badge variant="success">In Stock</Badge>;
            },
          },
          {
            header: 'Action',
            align: 'right',
            accessor: (p) => (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openMovements(p)}
                leftIcon={<History className="h-3.5 w-3.5" />}
              >
                Ledger History
              </Button>
            ),
          },
        ]}
      />

      {/* Movement Ledger Modal */}
      {isMovementDrawerOpen && selectedProduct && (
        <Modal
          isOpen={isMovementDrawerOpen}
          onClose={() => setIsMovementDrawerOpen(false)}
          title={
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-700 dark:text-sky-400" />
              <span>Stock Movement Audit: {selectedProduct.name}</span>
            </div>
          }
          subtitle={`SKU: ${selectedProduct.sku} • Current Stock: ${selectedProduct.current_stock} ${selectedProduct.unit_short}`}
          maxWidth="2xl"
          footer={
            <Button variant="secondary" onClick={() => setIsMovementDrawerOpen(false)}>
              Close Audit Trail
            </Button>
          }
        >
          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto">
            {movements.length === 0 ? (
              <p className="text-xs text-slate-400 py-12 text-center font-medium">
                No stock movement transactions logged for this SKU.
              </p>
            ) : (
              movements.map((m) => {
                const isPositive = Number(m.quantity) > 0;
                return (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-4 text-xs space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Badge variant={isPositive ? 'success' : 'danger'}>
                          {m.type.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                        <span className="font-mono text-[11px] text-slate-400">
                          {new Date(m.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div
                        className={`font-mono font-black text-sm flex items-center gap-1 ${
                          isPositive
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-700 dark:text-red-400'
                        }`}
                      >
                        {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                        <span>{isPositive ? `+${m.quantity}` : m.quantity}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      {m.notes || 'Transaction movement entry'}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span>Logged By: {m.user_name || 'System Admin'}</span>
                      <span>Unit Cost Basis: {formatCurrency(m.unit_cost || selectedProduct.cost_price)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Modal>
      )}

      {/* Manual Stock Adjustment Modal */}
      {isAdjustOpen && (
        <Modal
          isOpen={isAdjustOpen}
          onClose={() => setIsAdjustOpen(false)}
          title={
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-amber-500" />
              <span>Record Physical Stock Adjustment</span>
            </div>
          }
          subtitle="Atomic inventory correction with mandatory audit reason"
          maxWidth="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsAdjustOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                isLoading={loading}
                disabled={adjustForm.productId === 0}
                onClick={handleAdjust}
              >
                Apply Adjustment
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

          <form onSubmit={handleAdjust} className="space-y-4">
            <Select
              label="Select Product SKU *"
              required
              value={adjustForm.productId}
              onChange={(e) => setAdjustForm({ ...adjustForm, productId: Number(e.target.value) })}
            >
              <option value={0}>-- Choose product --</option>
              {stockList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Current Stock: {p.current_stock} {p.unit_short})
                </option>
              ))}
            </Select>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Adjustment Direction *"
                value={adjustForm.type}
                onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value as any })}
              >
                <option value="addition">+ Increase (Found / Recount)</option>
                <option value="subtraction">- Decrease (Shrinkage / Damage)</option>
              </Select>

              <Input
                label="Quantity Adjust (Base Units) *"
                type="number"
                min="1"
                required
                value={adjustForm.quantity}
                onChange={(e) =>
                  setAdjustForm({ ...adjustForm, quantity: parseFloat(e.target.value) || 1 })
                }
              />
            </div>

            <Input
              label="Reason for Adjustment *"
              required
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
              placeholder="e.g. Physical recount variance, damaged packaging"
            />

            <Textarea
              label="Additional Audit Context (Optional)"
              value={adjustForm.notes}
              onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
              placeholder="Detailed notes for the audit ledger"
              rows={2}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
