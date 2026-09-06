'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { Button, IconButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { BarcodeLabelModal } from '@/components/ui/BarcodeLabelModal';
import { DataTable } from '@/components/ui/DataTable';
import {
  Package,
  Plus,
  Search,
  Check,
  AlertCircle,
  Edit2,
  Trash2,
  Barcode,
  Printer,
  FolderPlus,
  X,
  Scale,
  Calendar,
  Grid,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Layers,
  Filter,
} from 'lucide-react';

export default function ProductsPage() {
  const { formatCurrency, settings } = useSettings();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out' | 'perishable'>('all');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<any>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Image Upload state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<{ name: string; dataUrl: string; mimeType: string } | null>(null);

  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    pluCode: '',
    categoryId: 1,
    unitId: 1,
    packagingMultiplier: 1.0,
    taxRateId: 1,
    costPrice: 0,
    wholesalePrice: 0,
    sellingPrice: 0,
    minStockLevel: 5,
    initialStock: 0,
    hasExpiry: false,
    isWeighable: false,
    isQuickPlu: false,
    taxType: 'exclusive',
  });

  const loadData = async () => {
    setDataLoading(true);
    const res = await apiRequest('/products');
    if (res.success && res.data) setProducts(res.data);

    const catRes = await apiRequest('/products/categories');
    if (catRes.success && catRes.data) setCategories(catRes.data);

    const unitRes = await apiRequest('/products/units');
    if (unitRes.success && unitRes.data) setUnits(unitRes.data);

    const taxRes = await apiRequest('/settings/tax-rates');
    if (taxRes.success && taxRes.data) setTaxRates(taxRes.data);

    setDataLoading(false);
  };

  useEffect(() => {
    loadData();

    // Instant real-time product & stock sync when POS sales complete
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('shop_stock_sync');
      channel.onmessage = (event) => {
        if (event.data?.type === 'STOCK_UPDATED') {
          loadData();
        }
      };
      return () => {
        channel.close();
      };
    }
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image file size exceeds 5MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImageFile({ name: file.name, dataUrl, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const openCreate = () => {
    setIsEditMode(false);
    setEditingId(null);
    setForm({
      name: '',
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      barcode: '',
      pluCode: '',
      categoryId: categories[0]?.id || 1,
      unitId: units[0]?.id || 1,
      packagingMultiplier: 1.0,
      taxRateId: taxRates.find((t) => t.is_default)?.id || taxRates[0]?.id || 1,
      costPrice: 0,
      wholesalePrice: 0,
      sellingPrice: 0,
      minStockLevel: 5,
      initialStock: 0,
      hasExpiry: false,
      isWeighable: false,
      isQuickPlu: false,
      taxType: 'exclusive',
    });
    setImagePreview(null);
    setImageFile(null);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEdit = (p: any) => {
    setIsEditMode(true);
    setEditingId(p.id);
    setForm({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || '',
      pluCode: p.plu_code || '',
      categoryId: p.category_id || 1,
      unitId: p.unit_id || 1,
      packagingMultiplier: Number(p.packaging_multiplier || 1.0),
      taxRateId: p.tax_rate_id || 1,
      costPrice: Number(p.cost_price || 0),
      wholesalePrice: Number(p.wholesale_price || 0),
      sellingPrice: Number(p.selling_price || 0),
      minStockLevel: Number(p.min_stock_level || 5),
      initialStock: 0,
      hasExpiry: p.has_expiry || false,
      isWeighable: p.is_weighable || false,
      isQuickPlu: p.is_quick_plu || false,
      taxType: p.tax_type || 'exclusive',
    });
    setImagePreview(p.images?.[0]?.file_path || null);
    setImageFile(null);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const endpoint = isEditMode && editingId ? `/products/${editingId}` : '/products';
    const method = isEditMode ? 'PUT' : 'POST';

    const res = await apiRequest(endpoint, {
      method,
      body: JSON.stringify({
        ...form,
        costPrice: Number(form.costPrice),
        wholesalePrice: form.wholesalePrice ? Number(form.wholesalePrice) : null,
        sellingPrice: Number(form.sellingPrice),
        minStockLevel: Number(form.minStockLevel),
        initialStock: Number(form.initialStock),
        packagingMultiplier: Number(form.packagingMultiplier),
      }),
    });

    if (res.success) {
      const prodId = isEditMode && editingId ? editingId : res.data?.id;
      if (prodId && imageFile) {
        await apiRequest(`/products/${prodId}/images`, {
          method: 'POST',
          body: JSON.stringify({
            fileName: imageFile.name,
            dataUrl: imageFile.dataUrl,
            mimeType: imageFile.mimeType,
            isPrimary: true,
          }),
        });
      }
      setIsModalOpen(false);
      setImagePreview(null);
      setImageFile(null);
      loadData();
    } else {
      setErrorMsg(res.message || 'Failed to save product.');
    }

    setLoading(false);
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm('Are you sure you want to deactivate this product SKU?')) return;
    const res = await apiRequest(`/products/${id}`, { method: 'DELETE' });
    if (res.success) loadData();
  };

  const openBarcodePrint = (p: any) => {
    setBarcodeProduct(p);
    setIsBarcodeModalOpen(true);
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/products/categories', {
      method: 'POST',
      body: JSON.stringify({ name: newCatName }),
    });
    if (res.success) {
      setNewCatName('');
      setIsCategoryModalOpen(false);
      loadData();
    }
  };

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search)) ||
      (p.plu_code && p.plu_code.includes(search));

    const matchesCat = selectedCat ? p.category_id === selectedCat : true;

    let matchesStock = true;
    if (stockFilter === 'low') {
      matchesStock = Number(p.current_stock) > 0 && Number(p.current_stock) <= Number(p.min_stock_level || 5);
    } else if (stockFilter === 'out') {
      matchesStock = Number(p.current_stock) <= 0;
    } else if (stockFilter === 'perishable') {
      matchesStock = p.has_expiry === true;
    }

    return matchesSearch && matchesCat && matchesStock;
  });

  return (
    <div className="space-y-6">
      {/* Thermal Barcode Generator Modal */}
      {isBarcodeModalOpen && barcodeProduct && (
        <BarcodeLabelModal
          isOpen={isBarcodeModalOpen}
          onClose={() => setIsBarcodeModalOpen(false)}
          product={barcodeProduct}
        />
      )}

      {/* Quick Category Creation Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Add Product Category"
        subtitle="Create a new grouping category for the master catalog"
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCategoryModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateCategory}>
              Create Category
            </Button>
          </>
        }
      >
        <Input
          label="Category Name"
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          required
          placeholder="e.g. Dairy & Eggs, Fresh Bakery, Cold Beverages"
        />
      </Modal>

      {/* Create / Edit Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-700 dark:text-sky-400" />
            <span>{isEditMode ? 'Edit Product Master SKU' : 'Register New Product SKU'}</span>
          </div>
        }
        subtitle="Maintain unit conversions, pricing, WAC cost basis, and barcode identifiers"
        maxWidth="3xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" isLoading={loading} onClick={handleSubmit}>
              {isEditMode ? 'Save Changes' : 'Create Product SKU'}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Identity & Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Input
                label="Product Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="e.g. Almarai Fresh Milk Full Fat 2L"
              />
            </div>
            <div>
              <Input
                label="SKU Code"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                required
                placeholder="SKU-10029"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Input
                label="Barcode (EAN-13 / UPC / Code128)"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                placeholder="6281007001234"
              />
            </div>
            <div>
              <Input
                label="Produce Scale PLU Code"
                value={form.pluCode}
                onChange={(e) => setForm({ ...form, pluCode: e.target.value })}
                placeholder="e.g. 1042"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Category
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="text-[11px] font-bold text-blue-700 dark:text-sky-400 hover:underline"
                >
                  + New
                </button>
              </div>
              <Select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: parseInt(e.target.value) })}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Pricing & VAT */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
            <div>
              <Input
                label="Cost Price (WAC)"
                type="number"
                step="0.0001"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: parseFloat(e.target.value) || 0 })}
                required
                helperText="Perpetual weighted average"
              />
            </div>
            <div>
              <Input
                label="Selling Price (SAR)"
                type="number"
                step="0.01"
                value={form.sellingPrice}
                onChange={(e) => setForm({ ...form, sellingPrice: parseFloat(e.target.value) || 0 })}
                required
                className="font-bold text-blue-700 dark:text-sky-400"
              />
            </div>
            <div>
              <Select
                label="Tax Rate"
                value={form.taxRateId}
                onChange={(e) => setForm({ ...form, taxRateId: parseInt(e.target.value) })}
              >
                {taxRates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.rate}%)
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Select
                label="Tax Mode"
                value={form.taxType}
                onChange={(e) => setForm({ ...form, taxType: e.target.value })}
              >
                <option value="exclusive">Tax-Exclusive (VAT added)</option>
                <option value="inclusive">Tax-Inclusive (Price has VAT)</option>
              </Select>
            </div>
          </div>

          {/* Stock & Unit Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Select
                label="Base Inventory Unit"
                value={form.unitId}
                onChange={(e) => setForm({ ...form, unitId: parseInt(e.target.value) })}
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.short_name})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Input
                label="Min Stock Warning Level"
                type="number"
                step="1"
                value={form.minStockLevel}
                onChange={(e) => setForm({ ...form, minStockLevel: parseFloat(e.target.value) || 0 })}
              />
            </div>
            {!isEditMode && (
              <div>
                <Input
                  label="Initial Opening Stock"
                  type="number"
                  step="1"
                  value={form.initialStock}
                  onChange={(e) => setForm({ ...form, initialStock: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}
          </div>

          {/* Super Shop Capability Flags */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
              <input
                type="checkbox"
                checked={form.hasExpiry}
                onChange={(e) => setForm({ ...form, hasExpiry: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="font-bold text-slate-900 dark:text-white">Batch & Expiry</div>
                <div className="text-[10px] text-slate-400">Track perishable dates</div>
              </div>
            </label>

            <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
              <input
                type="checkbox"
                checked={form.isWeighable}
                onChange={(e) => setForm({ ...form, isWeighable: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="font-bold text-slate-900 dark:text-white">Scale Variable Weight</div>
                <div className="text-[10px] text-slate-400">Prefix 20-29 barcode support</div>
              </div>
            </label>

            <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
              <input
                type="checkbox"
                checked={form.isQuickPlu}
                onChange={(e) => setForm({ ...form, isQuickPlu: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="font-bold text-slate-900 dark:text-white">Quick PLU Grid</div>
                <div className="text-[10px] text-slate-400">Touch tile on POS screen</div>
              </div>
            </label>
          </div>

          {/* Image Upload Input */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Product Image (WebP / PNG / JPG)
            </label>
            <div className="flex items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition">
                <Upload className="h-4 w-4 text-blue-600 dark:text-sky-400" />
                <span>Choose Image</span>
                <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
              </label>
              {imagePreview && (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-900">
                  <img src={imagePreview} alt="Preview" className="h-10 w-10 rounded-lg object-cover" />
                  <span className="text-[11px] font-mono text-slate-500 pr-2">Selected</span>
                </div>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            Product Master Catalog
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage SKUs, barcodes, scale PLUs, perishable flags, cost prices (WAC), selling prices, and thermal shelf labels.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            size="md"
            onClick={openCreate}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Add Product SKU
          </Button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 rounded-2xl bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by SKU, product name, barcode, or PLU..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2 pl-10 pr-4 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Category Filter */}
        <div className="w-full sm:w-56">
          <select
            value={selectedCat || ''}
            onChange={(e) => setSelectedCat(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="">All Categories ({products.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Stock Status Filter Pills */}
        <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setStockFilter('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap transition ${
              stockFilter === 'all'
                ? 'bg-blue-700 text-white shadow-sm dark:bg-sky-500 dark:text-slate-950'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            All Stock
          </button>
          <button
            onClick={() => setStockFilter('low')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap transition ${
              stockFilter === 'low'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            Low Stock
          </button>
          <button
            onClick={() => setStockFilter('out')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap transition ${
              stockFilter === 'out'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            Out of Stock
          </button>
        </div>
      </div>

      {/* Products Master DataTable */}
      <DataTable
        isLoading={dataLoading}
        data={filtered}
        keyExtractor={(p) => p.id}
        emptyMessage="No products match your filter criteria."
        columns={[
          {
            header: 'Product Name / Identifiers',
            accessor: (p) => (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold overflow-hidden border border-slate-200 dark:border-slate-700">
                  {p.images?.[0]?.file_path ? (
                    <img src={p.images[0].file_path} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-white line-clamp-1">{p.name}</div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                    <span>SKU: {p.sku}</span>
                    {p.barcode && <span>• Barcode: {p.barcode}</span>}
                    {p.plu_code && <span>• PLU: {p.plu_code}</span>}
                  </div>
                </div>
              </div>
            ),
          },
          {
            header: 'Category & Unit',
            accessor: (p) => (
              <div>
                <div className="font-semibold text-slate-700 dark:text-slate-300">
                  {p.category_name || 'General'}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Base: {p.unit_name || 'Piece'}
                </div>
              </div>
            ),
          },
          {
            header: 'Stock Status',
            accessor: (p) => {
              const stock = Number(p.current_stock || 0);
              const min = Number(p.min_stock_level || 5);
              if (stock <= 0) {
                return <Badge variant="danger">Out of Stock (0)</Badge>;
              }
              if (stock <= min) {
                return (
                  <Badge variant="warning">
                    Low Stock ({stock.toFixed(0)})
                  </Badge>
                );
              }
              return (
                <Badge variant="success">
                  In Stock ({stock.toFixed(0)})
                </Badge>
              );
            },
          },
          {
            header: 'Cost Price (WAC)',
            align: 'right',
            accessor: (p) => (
              <span className="font-mono font-bold text-slate-500">
                {formatCurrency(p.cost_price)}
              </span>
            ),
          },
          {
            header: 'Selling Price (SAR)',
            align: 'right',
            accessor: (p) => (
              <div>
                <div className="font-mono font-bold text-blue-700 dark:text-sky-400">
                  {formatCurrency(p.selling_price)}
                </div>
                <div className="text-[10px] text-slate-400 font-semibold">
                  {p.tax_type === 'inclusive' ? 'Inc VAT' : 'Ex VAT'}
                </div>
              </div>
            ),
          },
          {
            header: 'Actions',
            align: 'right',
            accessor: (p) => (
              <div className="flex items-center justify-end gap-1.5">
                <IconButton
                  title="Generate Thermal Barcode Label"
                  icon={<Barcode className="h-4 w-4" />}
                  size="sm"
                  onClick={() => openBarcodePrint(p)}
                />
                <IconButton
                  title="Edit Product Master"
                  icon={<Edit2 className="h-4 w-4" />}
                  size="sm"
                  onClick={() => openEdit(p)}
                />
                <IconButton
                  title="Deactivate SKU"
                  icon={<Trash2 className="h-4 w-4" />}
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeactivate(p.id)}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
