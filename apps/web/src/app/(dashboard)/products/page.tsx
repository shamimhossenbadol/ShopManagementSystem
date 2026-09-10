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
import { ProductImportModal } from '@/components/products/ProductImportModal';
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
  Download,
  FileJson,
  Image as ImageIcon,
  Sparkles,
  Layers,
  Filter,
} from 'lucide-react';

function ProductThumbnail({ src, alt }: { src?: string | null; alt: string }) {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [src]);

  if (!src || error) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700">
        <Package className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700">
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        onError={() => setError(true)}
      />
    </div>
  );
}

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
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

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
    taxType: 'inclusive',
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
    if (categories.length === 0 || units.length === 0 || taxRates.length === 0) {
      loadData();
    }
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
      taxType: 'inclusive',
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
    setImagePreview(p.image_url || p.images?.[0]?.file_path || null);
    setImageFile(null);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    if (!form.name || !form.name.trim()) {
      setErrorMsg('Product Name is required.');
      return;
    }
    if (!form.sku || !form.sku.trim()) {
      setErrorMsg('SKU Code is required.');
      return;
    }
    if (Number(form.sellingPrice) < 0 || isNaN(Number(form.sellingPrice))) {
      setErrorMsg('Selling Price cannot be negative.');
      return;
    }
    if (Number(form.costPrice) < 0 || isNaN(Number(form.costPrice))) {
      setErrorMsg('Cost Price cannot be negative.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const endpoint = isEditMode && editingId ? `/products/${editingId}` : '/products';
    const method = isEditMode ? 'PUT' : 'POST';

    const res = await apiRequest(endpoint, {
      method,
      body: JSON.stringify({
        ...form,
        name: form.name.trim(),
        sku: form.sku.trim(),
        barcode: form.barcode?.trim() || null,
        pluCode: form.pluCode?.trim() || null,
        costPrice: Number(form.costPrice) || 0,
        wholesalePrice: form.wholesalePrice ? Number(form.wholesalePrice) : null,
        sellingPrice: Number(form.sellingPrice) || 0,
        minStockLevel: Number(form.minStockLevel) || 0,
        initialStock: Number(form.initialStock) || 0,
        packagingMultiplier: Number(form.packagingMultiplier) || 1.0,
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
      let detailedMsg = res.message || 'Failed to save product.';
      if (res.errors) {
        const fieldErrors = Object.entries(res.errors)
          .filter(([k]) => k !== '_errors')
          .map(([field, err]: any) => `${field}: ${Array.isArray(err?._errors) ? err._errors.join(', ') : err}`)
          .join('; ');
        if (fieldErrors) detailedMsg += ` (${fieldErrors})`;
      }
      setErrorMsg(detailedMsg);
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
      if (res.data?.id) {
        setForm((prev) => ({ ...prev, categoryId: res.data.id }));
      }
      loadData();
    }
  };

  const handleExportJson = async () => {
    setExportLoading(true);
    try {
      const res = await apiRequest('/products/export');
      let exportPayload: any = null;

      if (res.success && res.products) {
        exportPayload = res;
      } else {
        exportPayload = {
          meta: {
            exportedAt: new Date().toISOString(),
            totalProducts: products.length,
            version: '1.0',
          },
          products: products.map((p) => ({
            sku: p.sku,
            name: p.name,
            barcode: p.barcode || null,
            pluCode: p.plu_code || null,
            description: p.description || null,
            category: p.category_name || 'General',
            categoryId: p.category_id,
            unit: p.unit_name || 'Piece',
            unitId: p.unit_id,
            packagingMultiplier: Number(p.packaging_multiplier || 1.0),
            taxRatePercent: Number(p.tax_rate || 15.0),
            taxRateId: p.tax_rate_id,
            taxType: p.tax_type || 'exclusive',
            costPrice: Number(p.cost_price || 0),
            wholesalePrice: p.wholesale_price ? Number(p.wholesale_price) : null,
            sellingPrice: Number(p.selling_price || 0),
            currentStock: Number(p.current_stock || 0),
            minStockLevel: Number(p.min_stock_level || 5),
            hasExpiry: Boolean(p.has_expiry),
            isWeighable: Boolean(p.is_weighable),
            isQuickPlu: Boolean(p.is_quick_plu),
            isActive: Boolean(p.is_active),
          })),
        };
      }

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `shop-products-catalog-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export products error:', err);
    } finally {
      setExportLoading(false);
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
          catalogProducts={products}
        />
      )}

      {/* Create / Edit Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        icon={<Package className="h-5 w-5" />}
        title={isEditMode ? 'Edit Product Master SKU' : 'Register New Product SKU'}
        subtitle="Manage pricing, units, barcodes, and inventory"
        maxWidth="3xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-rose-600 dark:text-rose-400 font-medium truncate max-w-sm">
              {errorMsg && <span>⚠️ {errorMsg}</span>}
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="product-form"
                variant="primary"
                isLoading={loading}
                onClick={handleSubmit}
              >
                {isEditMode ? 'Save Changes' : 'Create Product SKU'}
              </Button>
            </div>
          </div>
        }
      >
        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form id="product-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Identity & Basic Info */}
          <div className="flex items-start gap-3">
            {/* Compact Image Upload Tile */}
            <div className="space-y-1.5 shrink-0">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Image
              </label>
              <div className="relative group">
                <label
                  title={imagePreview ? 'Click to change image' : 'Upload product image'}
                  className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer overflow-hidden transition group-hover:border-blue-500"
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Product"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Upload className="h-4 w-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-sky-400 transition" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>
                {imagePreview && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setImagePreview(null);
                      setImageFile(null);
                    }}
                    title="Remove image"
                    className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white shadow hover:bg-rose-600 transition"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Product Name */}
            <div className="flex-1 min-w-0">
              <Input
                label="Product Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="e.g. Almarai Fresh Milk Full Fat 2L"
              />
            </div>

            {/* SKU Code */}
            <div className="w-36 sm:w-48 shrink-0 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  SKU Code <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, sku: `SKU-${Date.now().toString().slice(-6)}` })}
                  className="text-[11px] font-bold text-blue-700 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  Auto
                </button>
              </div>
              <Input
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
                label="Cost Price"
                type="number"
                step="0.0001"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div>
              <Input
                label="Selling Price"
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
          <div className={`grid grid-cols-1 gap-3 items-start ${isEditMode ? 'sm:grid-cols-3' : 'sm:grid-cols-2 md:grid-cols-4'}`}>
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
            <div className="w-full space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Batch & Expiry
              </label>
              <label
                className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition cursor-pointer select-none ${
                  form.hasExpiry
                    ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 dark:border-blue-500 shadow-sm'
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className={`h-4 w-4 shrink-0 ${form.hasExpiry ? 'text-blue-600 dark:text-sky-400' : 'text-slate-400'}`} />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate leading-5">
                    Track Expiry
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={form.hasExpiry}
                  onChange={(e) => setForm({ ...form, hasExpiry: e.target.checked })}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer ml-2"
                />
              </label>
            </div>
          </div>
        </form>
      </Modal>

      {/* Quick Category Creation Modal (Overlaid on top of Product Modal) */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        zIndex={60}
        icon={<FolderPlus className="h-5 w-5" />}
        title="Add Product Category"
        subtitle="Create a new catalog category"
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
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <Input
            label="Category Name"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            required
            placeholder="e.g. Dairy & Eggs, Fresh Bakery, Cold Beverages"
            autoFocus
          />
        </form>
      </Modal>

      {/* JSON Import Modal */}
      <ProductImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => loadData()}
      />

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            Product Master Catalog
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage products, pricing, inventory, and barcodes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setIsImportModalOpen(true)}
            leftIcon={<Upload className="h-4 w-4" />}
            title="Batch import or update products from a JSON file"
          >
            Import JSON
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={handleExportJson}
            isLoading={exportLoading}
            leftIcon={<Download className="h-4 w-4" />}
            title="Export full catalog records as JSON"
          >
            Export JSON
          </Button>
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-2xl bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by SKU, product name, barcode, or PLU..."
            className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-9 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div className="w-full sm:w-56 shrink-0 relative">
          <select
            value={selectedCat || ''}
            onChange={(e) => setSelectedCat(e.target.value ? parseInt(e.target.value) : null)}
            className="h-10 w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-3.5 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none cursor-pointer transition"
          >
            <option value="">All Categories ({products.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Filter className="h-3.5 w-3.5 opacity-60" />
          </div>
        </div>

        {/* Stock Status Filter Pills */}
        <div className="flex items-center gap-1 shrink-0 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl h-10 border border-slate-200/60 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setStockFilter('all')}
            className={`h-full rounded-lg px-3.5 text-xs font-bold whitespace-nowrap transition flex items-center justify-center ${
              stockFilter === 'all'
                ? 'bg-blue-700 text-white shadow-sm dark:bg-sky-500 dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Stock
          </button>
          <button
            type="button"
            onClick={() => setStockFilter('low')}
            className={`h-full rounded-lg px-3.5 text-xs font-bold whitespace-nowrap transition flex items-center justify-center ${
              stockFilter === 'low'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Low Stock
          </button>
          <button
            type="button"
            onClick={() => setStockFilter('out')}
            className={`h-full rounded-lg px-3.5 text-xs font-bold whitespace-nowrap transition flex items-center justify-center ${
              stockFilter === 'out'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
            accessor: (p) => {
              const imageSrc = p.image_url || p.images?.[0]?.file_path || p.primary_image;
              return (
                <div className="flex items-center gap-3">
                  <ProductThumbnail src={imageSrc} alt={p.name} />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white line-clamp-1">{p.name}</div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                      <span>{p.sku}</span>
                      {p.barcode && <span>• {p.barcode}</span>}
                      {p.plu_code && <span>• {p.plu_code}</span>}
                    </div>
                  </div>
                </div>
              );
            },
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
            header: 'Cost Price',
            align: 'right',
            accessor: (p) => (
              <span className="font-mono font-bold text-slate-500">
                {formatCurrency(p.cost_price)}
              </span>
            ),
          },
          {
            header: 'Selling Price',
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
