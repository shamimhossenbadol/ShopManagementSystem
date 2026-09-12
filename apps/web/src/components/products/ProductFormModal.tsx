'use client';

import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  Package,
  Upload,
  X,
  FolderPlus,
  AlertCircle,
} from 'lucide-react';

const generateSku = () => {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(100 + Math.random() * 900);
  return `SKU-${ts}${rand}`;
};

export interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (product: any) => void;
  initialBarcode?: string;
  isEditMode?: boolean;
  productToEdit?: any;
}

export function ProductFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialBarcode = '',
  isEditMode = false,
  productToEdit = null,
}: ProductFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State - exactly matching Manager Product Master SKU form
  const [form, setForm] = useState({
    name: '',
    sku: generateSku(),
    barcode: '',
    pluCode: '',
    categoryId: 1,
    unitId: 1,
    packagingMultiplier: 1.0,
    taxRateId: 1,
    costPrice: 0,
    wholesalePrice: 0,
    sellingPrice: '' as any,
    minStockLevel: 5,
    initialStock: 10000,
    hasExpiry: false,
    isWeighable: false,
    isQuickPlu: false,
    taxType: 'inclusive',
  });

  // Image Upload State
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<{ name: string; dataUrl: string; mimeType: string } | null>(null);

  // Dropdowns Metadata
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);

  // Submodal for inline category creation
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catLoading, setCatLoading] = useState(false);

  const loadDropdowns = async () => {
    try {
      const [catRes, unitRes, taxRes] = await Promise.all([
        apiRequest('/products/categories'),
        apiRequest('/products/units'),
        apiRequest('/settings/tax-rates'),
      ]);

      if (catRes.success && Array.isArray(catRes.data)) {
        setCategories(catRes.data);
      }
      if (unitRes.success && Array.isArray(unitRes.data)) {
        setUnits(unitRes.data);
      }
      if (taxRes.success && Array.isArray(taxRes.data)) {
        setTaxRates(taxRes.data);
      }
    } catch (err) {
      console.error('Failed loading product form metadata', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDropdowns();
      setErrorMsg(null);

      if (isEditMode && productToEdit) {
        setForm({
          name: productToEdit.name || '',
          sku: productToEdit.sku || `SKU-${Date.now().toString().slice(-6)}`,
          barcode: productToEdit.barcode || '',
          pluCode: productToEdit.plu_code || '',
          categoryId: productToEdit.category_id || 1,
          unitId: productToEdit.unit_id || 1,
          packagingMultiplier: Number(productToEdit.packaging_multiplier || 1.0),
          taxRateId: productToEdit.tax_rate_id || 1,
          costPrice: Number(productToEdit.cost_price || 0),
          wholesalePrice: Number(productToEdit.wholesale_price || 0),
          sellingPrice: productToEdit.selling_price !== undefined && productToEdit.selling_price !== null ? productToEdit.selling_price : '',
          minStockLevel: Number(productToEdit.min_stock_level || 5),
          initialStock: 0,
          hasExpiry: Boolean(productToEdit.has_expiry),
          isWeighable: Boolean(productToEdit.is_weighable),
          isQuickPlu: Boolean(productToEdit.is_quick_plu),
          taxType: productToEdit.tax_type || 'inclusive',
        });
        setImagePreview(productToEdit.image_url || productToEdit.images?.[0]?.file_path || null);
        setImageFile(null);
      } else {
        // Create Mode
        setForm({
          name: '',
          sku: generateSku(),
          barcode: initialBarcode || '',
          pluCode: '',
          categoryId: categories[0]?.id || 1,
          unitId: units[0]?.id || 1,
          packagingMultiplier: 1.0,
          taxRateId: taxRates.find((t) => t.is_default)?.id || taxRates[0]?.id || 1,
          costPrice: 0,
          wholesalePrice: 0,
          sellingPrice: '' as any,
          minStockLevel: 5,
          initialStock: 10000,
          hasExpiry: false,
          isWeighable: false,
          isQuickPlu: false,
          taxType: 'inclusive',
        });
        setImagePreview(null);
        setImageFile(null);
      }
    }
  }, [isOpen, isEditMode, productToEdit, initialBarcode]);

  // Sync categoryId and taxRateId once dropdowns resolve if defaults were empty
  useEffect(() => {
    if (!isEditMode && isOpen) {
      if (categories.length > 0 && (!form.categoryId || form.categoryId === 1)) {
        setForm((prev) => ({ ...prev, categoryId: categories[0].id }));
      }
      if (units.length > 0 && (!form.unitId || form.unitId === 1)) {
        setForm((prev) => ({ ...prev, unitId: units[0].id }));
      }
      if (taxRates.length > 0) {
        const defTax = taxRates.find((t) => t.is_default) || taxRates[0];
        if (defTax) {
          setForm((prev) => ({ ...prev, taxRateId: defTax.id }));
        }
      }
    }
  }, [categories, units, taxRates, isOpen, isEditMode]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WebP, GIF).');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image file size exceeds 5MB limit.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImageFile({ name: file.name, dataUrl, mimeType: file.type });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCatLoading(true);

    const res = await apiRequest('/products/categories', {
      method: 'POST',
      body: JSON.stringify({ name: newCatName.trim() }),
    });

    setCatLoading(false);
    if (res.success && res.data) {
      setCategories((prev) => [...prev, res.data]);
      setForm((prev) => ({ ...prev, categoryId: res.data.id }));
      setNewCatName('');
      setIsCategoryModalOpen(false);
    } else {
      alert(res.message || 'Failed to create category');
    }
  };


  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    if (!form.name || !form.name.trim()) {
      setErrorMsg('Product Name is mandatory.');
      return;
    }
    if (!form.sku || !form.sku.trim()) {
      setErrorMsg('SKU Code is mandatory.');
      return;
    }
    // Strict Mandatory Barcode Check
    if (!form.barcode || !form.barcode.trim()) {
      setErrorMsg('Barcode is mandatory.');
      return;
    }
    // Strict Mandatory Selling Price Check
    if (form.sellingPrice === '' || form.sellingPrice === null || form.sellingPrice === undefined || Number(form.sellingPrice) <= 0 || isNaN(Number(form.sellingPrice))) {
      setErrorMsg('Selling Price is mandatory.');
      return;
    }
    if (Number(form.costPrice) < 0 || isNaN(Number(form.costPrice))) {
      setErrorMsg('Cost Price cannot be negative.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const endpoint = isEditMode && productToEdit?.id ? `/products/${productToEdit.id}` : '/products';
    const method = isEditMode ? 'PUT' : 'POST';

    const res = await apiRequest(endpoint, {
      method,
      body: JSON.stringify({
        ...form,
        name: form.name.trim(),
        sku: form.sku.trim(),
        barcode: form.barcode.trim(),
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
      const prodId = isEditMode && productToEdit?.id ? productToEdit.id : res.data?.id;
      let finalProduct = res.data;

      // Upload image if selected
      if (prodId && imageFile) {
        try {
          const imgRes = await apiRequest(`/products/${prodId}/images`, {
            method: 'POST',
            body: JSON.stringify({
              fileName: imageFile.name,
              dataUrl: imageFile.dataUrl,
              mimeType: imageFile.mimeType,
              isPrimary: true,
            }),
          });
          if (imgRes.success && imgRes.data?.file_path) {
            finalProduct = { ...finalProduct, image_url: imgRes.data.file_path };
          }
        } catch (imgErr) {
          console.warn('Image upload deferred:', imgErr);
        }
      }

      setLoading(false);
      onSuccess(finalProduct);
      onClose();
    } else {
      setLoading(false);
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
  };

  return (
    <>
      {/* Exact UI Design matching Manager Product Master SKU Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => !loading && onClose()}
        icon={<Package className="h-5 w-5" />}
        title={isEditMode ? 'Edit Product Master SKU' : 'Register New Product SKU'}
        subtitle="Manage pricing, units, barcodes, and inventory"
        maxWidth="3xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium truncate max-w-sm sm:max-w-md">
              {errorMsg && (
                <>
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                  <span className="truncate">{errorMsg}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <Button variant="secondary" onClick={() => !loading && onClose()}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="product-master-form"
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
        <form id="product-master-form" onSubmit={handleSubmit} className="space-y-4">
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
                    accept="image/png, image/jpeg, image/webp, image/gif, .png, .jpg, .jpeg, .webp, .gif"
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

            {/* SKU Code (Auto-generated & Read-only) */}
            <div className="w-36 sm:w-48 shrink-0 space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                SKU Code <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">(Auto)</span>
              </label>
              <Input
                value={form.sku}
                readOnly
                tabIndex={-1}
                className="bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 cursor-not-allowed select-all font-mono font-bold"
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
                required
                placeholder="6281007001234"
                className="font-mono font-bold"
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
                min="0.01"
                value={form.sellingPrice}
                onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                required
                placeholder="0.00"
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
          <div className={`grid grid-cols-1 gap-3 items-start ${isEditMode ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
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
            <Button variant="primary" onClick={handleCreateCategory} isLoading={catLoading}>
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
    </>
  );
}

export default ProductFormModal;
