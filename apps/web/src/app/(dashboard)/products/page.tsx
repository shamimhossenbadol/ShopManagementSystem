'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
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
} from 'lucide-react';

export default function ProductsPage() {
  const { formatCurrency, settings } = useSettings();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<number | null>(null);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<any>(null);
  const [barcodeCount, setBarcodeCount] = useState<number>(4);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Image Upload state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<{ name: string; dataUrl: string; mimeType: string } | null>(null);

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

  const [loading, setLoading] = useState(false);
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
    const res = await apiRequest('/products');
    if (res.success && res.data) setProducts(res.data);

    const catRes = await apiRequest('/products/categories');
    if (catRes.success && catRes.data) setCategories(catRes.data);

    const unitRes = await apiRequest('/products/units');
    if (unitRes.success && unitRes.data) setUnits(unitRes.data);

    const taxRes = await apiRequest('/settings/tax-rates');
    if (taxRes.success && taxRes.data) setTaxRates(taxRes.data);
  };

  useEffect(() => {
    loadData();
  }, []);

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
    if (!confirm('Are you sure you want to deactivate this product?')) return;
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
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Product Master Catalog</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage SKUs, barcodes, scale PLUs, perishable flags, cost prices (WAC), selling prices, and shelf labels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm"
          >
            <FolderPlus className="h-4 w-4 text-slate-500" />
            Add Category
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition"
          >
            <Plus className="h-4 w-4" />
            Add New Product
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name, SKU, barcode, or PLU..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 pl-10 pr-4 text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto text-xs">
          <button
            onClick={() => setSelectedCat(null)}
            className={`rounded-xl px-3.5 py-2 font-semibold transition ${
              selectedCat === null
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            All Categories ({products.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(c.id)}
              className={`rounded-xl px-3.5 py-2 font-semibold whitespace-nowrap transition ${
                selectedCat === c.id
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-[10px] font-bold uppercase text-slate-400">
              <tr>
                <th className="py-3 px-4">SKU / PLU / Barcode</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Cost Price (WAC)</th>
                <th className="py-3 px-4 text-right">Selling Price</th>
                <th className="py-3 px-4 text-center">Stock Level</th>
                <th className="py-3 px-4 text-center">Attributes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No products found matching search criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const stock = Number(p.current_stock || 0);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-bold text-slate-900 dark:text-white">{p.sku}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                          <span>{p.barcode || 'No barcode'}</span>
                          {p.plu_code && <span className="font-bold text-emerald-500">PLU: {p.plu_code}</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          {p.images?.[0]?.file_path ? (
                            <img
                              src={p.images[0].file_path}
                              alt={p.name}
                              className="h-8 w-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200 dark:border-slate-700">
                              <Package className="h-4 w-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">{p.name}</div>
                            {p.description && <div className="text-[10px] text-slate-400 line-clamp-1">{p.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">{p.category_name || 'General'}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                        {p.cost_price !== undefined ? formatCurrency(p.cost_price) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(p.selling_price)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            stock > p.min_stock_level
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                              : stock > 0
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {stock} {p.unit_short || 'pcs'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex justify-center gap-1">
                          {p.has_expiry && (
                            <span className="p-1 rounded bg-amber-500/10 text-amber-500" title="Perishable / Expiry Tracking">
                              <Calendar className="h-3.5 w-3.5" />
                            </span>
                          )}
                          {p.is_weighable && (
                            <span className="p-1 rounded bg-emerald-500/10 text-emerald-500" title="Variable-Weight Scale Item">
                              <Scale className="h-3.5 w-3.5" />
                            </span>
                          )}
                          {p.is_quick_plu && (
                            <span className="p-1 rounded bg-blue-500/10 text-blue-500" title="Quick Produce Touch Grid Item">
                              <Grid className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1">
                        <button
                          onClick={() => openBarcodePrint(p)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700"
                          title="Print Barcode Tag"
                        >
                          <Barcode className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(p)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600"
                          title="Edit Product"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeactivate(p.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600"
                          title="Deactivate Product"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-slate-900 dark:text-white">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold">
                {isEditMode ? `Edit Product: ${form.name}` : 'Add New Product Master'}
              </h2>
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

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. Fresh Red Apple 1kg"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">SKU (Stock Keeping Unit) *</label>
                  <input
                    type="text"
                    required
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. FRU-APP-001"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Barcode / EAN-13</label>
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. 6281007001015"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Scale PLU Code</label>
                  <input
                    type="text"
                    value={form.pluCode}
                    onChange={(e) => setForm({ ...form, pluCode: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. 1042"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Category</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none font-semibold"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Unit of Measure</label>
                  <select
                    value={form.unitId}
                    onChange={(e) => setForm({ ...form, unitId: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none font-semibold"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.short_name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Attributes (Perishable, Weighable, Quick PLU) */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.hasExpiry}
                    onChange={(e) => setForm({ ...form, hasExpiry: e.target.checked })}
                    className="h-4 w-4 rounded text-blue-600"
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-300">Has Expiration / Perishable</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isWeighable}
                    onChange={(e) => setForm({ ...form, isWeighable: e.target.checked })}
                    className="h-4 w-4 rounded text-blue-600"
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-300">Weighable Item</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isQuickPlu}
                    onChange={(e) => setForm({ ...form, isQuickPlu: e.target.checked })}
                    className="h-4 w-4 rounded text-blue-600"
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-300">POS Quick Produce Grid</span>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Cost Price ({settings.currency_symbol || 'SAR'}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Selling Price ({settings.currency_symbol || 'SAR'}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.sellingPrice}
                    onChange={(e) => setForm({ ...form, sellingPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Wholesale Price</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.wholesalePrice || ''}
                    onChange={(e) => setForm({ ...form, wholesalePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Tax Rate</label>
                  <select
                    value={form.taxRateId}
                    onChange={(e) => setForm({ ...form, taxRateId: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none font-semibold"
                  >
                    {taxRates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({Number(t.rate)}%)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Min Stock Alert Threshold</label>
                  <input
                    type="number"
                    value={form.minStockLevel}
                    onChange={(e) => setForm({ ...form, minStockLevel: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {!isEditMode && (
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Initial Stock Quantity</label>
                  <input
                    type="number"
                    value={form.initialStock}
                    onChange={(e) => setForm({ ...form, initialStock: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Product Image Upload Component */}
              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Product Image (Max 5MB • JPG/PNG/WebP)</label>
                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  {imagePreview ? (
                    <div className="relative h-20 w-20 rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                      <img src={imagePreview} alt="Product preview" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null);
                          setImageFile(null);
                        }}
                        className="absolute top-1 right-1 rounded-full bg-rose-600 p-1 text-white hover:bg-rose-700 shadow"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-20 w-20 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 shrink-0 bg-white dark:bg-slate-900">
                      <ImageIcon className="h-6 w-6" />
                      <span className="text-[9px] mt-1">No Image</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      id="product-image-input"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <label
                      htmlFor="product-image-input"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer shadow-sm"
                    >
                      <Upload className="h-4 w-4 text-blue-500" />
                      Choose Product Image...
                    </label>
                    <p className="text-[10px] text-slate-400 mt-1">Auto-optimized for POS touch tiles and thermal barcode labels.</p>
                  </div>
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
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-500"
                >
                  <Check className="h-4 w-4" />
                  {loading ? 'Saving...' : isEditMode ? 'Update Product' : 'Save Product Master'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Tag Print Modal */}
      {isBarcodeModalOpen && barcodeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Barcode className="h-5 w-5 text-blue-500" />
                Print Shelf Barcode Labels
              </h2>
              <button onClick={() => setIsBarcodeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Number of Tags</label>
              <input
                type="number"
                min="1"
                max="24"
                value={barcodeCount}
                onChange={(e) => setBarcodeCount(parseInt(e.target.value) || 1)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 text-xs font-mono"
              />
            </div>

            {/* Printable Tags Preview */}
            <div id="printable-barcodes" className="border border-dashed border-slate-300 dark:border-slate-700 p-4 rounded-xl grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950">
              {Array.from({ length: barcodeCount }).map((_, idx) => (
                <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-lg text-center font-mono">
                  <div className="text-[11px] font-bold text-slate-900 dark:text-white truncate">{barcodeProduct.name}</div>
                  <div className="text-[9px] text-slate-500">{barcodeProduct.sku}</div>
                  <div className="my-1 text-xs tracking-widest font-black text-slate-800 dark:text-slate-200">
                    |||| || ||||| ||| ||
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">{barcodeProduct.barcode || barcodeProduct.sku}</div>
                  <div className="text-xs font-black text-blue-600 dark:text-blue-400 mt-1">{formatCurrency(barcodeProduct.selling_price)}</div>
                  <div className="text-[8px] text-slate-400">{settings.tax_label || 'Inc 15% VAT'}</div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsBarcodeModalOpen(false)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md"
              >
                <Printer className="h-4 w-4" />
                Print Labels
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <h2 className="text-base font-bold mb-3 flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-blue-500" />
              Add New Category
            </h2>
            <form onSubmit={handleCreateCategory} className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Category Name *</label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. Frozen Foods"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
