'use client';

import React, { useState, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { apiRequest } from '@/lib/api';
import {
  Upload,
  Download,
  FileJson,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';

interface ProductImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedPreviewItem {
  sku: string;
  name: string;
  category?: string;
  sellingPrice?: number;
  costPrice?: number;
  initialStock?: number;
  isValid: boolean;
  error?: string;
}

export const ProductImportModal: React.FC<ProductImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawProducts, setRawProducts] = useState<any[]>([]);
  const [previewItems, setPreviewItems] = useState<ParsedPreviewItem[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [conflictMode, setConflictMode] = useState<'upsert' | 'skip'>('upsert');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    errors: string[];
  } | null>(null);

  const resetState = () => {
    setFileName(null);
    setRawProducts([]);
    setPreviewItems([]);
    setValidationErrors([]);
    setErrorMsg(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const processJsonText = (text: string, name: string) => {
    setErrorMsg(null);
    setImportResult(null);
    try {
      const parsed = JSON.parse(text);
      let items: any[] = [];

      if (Array.isArray(parsed)) {
        items = parsed;
      } else if (parsed && Array.isArray(parsed.products)) {
        items = parsed.products;
      } else {
        setErrorMsg('Invalid JSON structure. Expected a JSON array of products or an object with a "products" array.');
        return;
      }

      if (items.length === 0) {
        setErrorMsg('The selected JSON file contains an empty product list.');
        return;
      }

      const errors: string[] = [];
      const previews: ParsedPreviewItem[] = [];

      items.forEach((item, idx) => {
        const rowNum = idx + 1;
        const sku = String(item.sku || '').trim();
        const prodName = String(item.name || '').trim();
        let isValid = true;
        let itemErr = '';

        if (!sku) {
          isValid = false;
          itemErr = `Item #${rowNum}: Missing SKU`;
          errors.push(itemErr);
        } else if (!prodName) {
          isValid = false;
          itemErr = `Item #${rowNum} (SKU: ${sku}): Missing Product Name`;
          errors.push(itemErr);
        }

        if (idx < 8) {
          previews.push({
            sku: sku || '—',
            name: prodName || '—',
            category: item.category || item.categoryName || item.category_name || 'General',
            sellingPrice: Number(item.sellingPrice ?? item.selling_price ?? 0),
            costPrice: Number(item.costPrice ?? item.cost_price ?? 0),
            initialStock: Number(item.initialStock ?? item.initial_stock ?? item.currentStock ?? item.current_stock ?? 0),
            isValid,
            error: itemErr,
          });
        }
      });

      setFileName(name);
      setRawProducts(items);
      setPreviewItems(previews);
      setValidationErrors(errors);
    } catch (e: any) {
      setErrorMsg(`Failed to parse JSON file: ${e.message || 'Syntax error'}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processJsonText(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      setErrorMsg('Please drop a valid .json file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processJsonText(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleDownloadSample = () => {
    const sample = {
      meta: {
        description: 'Sample JSON format for importing products into Al-Noor Shop Management System',
        version: '1.0',
      },
      products: [
        {
          sku: 'SMPL-001',
          name: 'Almarai Fresh Milk Full Fat 2L',
          barcode: '6281007010015',
          pluCode: '',
          category: 'Dairy & Beverages',
          unit: 'Piece',
          costPrice: 8.5,
          sellingPrice: 11.0,
          wholesalePrice: 10.0,
          minStockLevel: 10,
          initialStock: 48,
          taxRatePercent: 15.0,
          taxType: 'exclusive',
          hasExpiry: true,
          isWeighable: false,
          isQuickPlu: false,
        },
        {
          sku: 'SMPL-002',
          name: 'Fresh Red Apples Royal Gala (Scale PLU)',
          barcode: '200012301250',
          pluCode: '102',
          category: 'Fresh Produce & Fruits',
          unit: 'Kilogram',
          costPrice: 5.0,
          sellingPrice: 7.95,
          minStockLevel: 20,
          initialStock: 100,
          taxRatePercent: 0,
          taxType: 'exclusive',
          hasExpiry: true,
          isWeighable: true,
          isQuickPlu: true,
        },
        {
          sku: 'SMPL-003',
          name: 'Basmati White Rice 5KG Bag',
          barcode: '6282001099882',
          category: 'Groceries & Staples',
          unit: 'Piece',
          costPrice: 28.0,
          sellingPrice: 35.0,
          minStockLevel: 5,
          initialStock: 25,
          taxRatePercent: 15.0,
          taxType: 'exclusive',
          hasExpiry: false,
          isWeighable: false,
          isQuickPlu: false,
        },
      ],
    };

    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-product-import-template.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (rawProducts.length === 0) {
      setErrorMsg('Please select a JSON file containing products.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const res = await apiRequest('/products/import', {
      method: 'POST',
      body: JSON.stringify({
        products: rawProducts,
        conflictMode,
      }),
    });

    setLoading(false);

    if (res.success) {
      setImportResult({
        createdCount: res.data?.createdCount || 0,
        updatedCount: res.data?.updatedCount || 0,
        skippedCount: res.data?.skippedCount || 0,
        errors: res.data?.errors || [],
      });
      onSuccess();
    } else {
      setErrorMsg(res.message || 'Failed to import products.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      icon={<Upload className="h-5 w-5" />}
      title="Import Products Catalog from JSON"
      subtitle="Batch create or update product SKUs from a JSON data file"
      maxWidth="3xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadSample}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-sky-400 dark:hover:text-sky-300 inline-flex items-center gap-1.5 transition"
            >
              <Download className="h-3.5 w-3.5" />
              Download Sample JSON Template
            </button>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Button variant="secondary" onClick={handleClose}>
              {importResult ? 'Close' : 'Cancel'}
            </Button>
            {!importResult && (
              <Button
                variant="primary"
                isLoading={loading}
                disabled={rawProducts.length === 0}
                onClick={handleImport}
                leftIcon={<Upload className="h-4 w-4" />}
              >
                Start Import ({rawProducts.length} Items)
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Error Notification */}
        {errorMsg && (
          <div className="flex items-center gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3.5 text-xs text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success Screen */}
        {importResult ? (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-6 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 shadow-inner">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                JSON Import Process Completed
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                The product catalog has been successfully updated with the imported records.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-2">
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 p-3">
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {importResult.createdCount}
                </div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                  New SKUs Created
                </div>
              </div>
              <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 p-3">
                <div className="text-xl font-black text-blue-600 dark:text-sky-400">
                  {importResult.updatedCount}
                </div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                  SKUs Updated
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                <div className="text-xl font-black text-slate-600 dark:text-slate-400">
                  {importResult.skippedCount}
                </div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                  SKUs Skipped
                </div>
              </div>
            </div>

            {importResult.errors && importResult.errors.length > 0 && (
              <div className="text-left rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3 text-xs text-amber-800 dark:text-amber-300 mt-3 max-h-32 overflow-y-auto">
                <div className="font-bold mb-1">Warnings ({importResult.errors.length}):</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {importResult.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* File Drop Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 transition cursor-pointer select-none ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850/50 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-sky-400 border border-blue-100 dark:border-blue-900/40 mb-2.5">
                <FileJson className="h-6 w-6" />
              </div>

              {fileName ? (
                <div className="text-center">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Selected File:
                  </span>{' '}
                  <span className="text-xs font-mono font-bold text-blue-600 dark:text-sky-400">
                    {fileName}
                  </span>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Click or drag another .json file here to replace
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Click to browse or drop your <span className="font-mono text-blue-600 dark:text-sky-400">.json</span> file here
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Accepts exported JSON catalogs or standard array payloads up to 2,000 products
                  </p>
                </div>
              )}
            </div>

            {/* Validation & Overview Header */}
            {rawProducts.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-600 dark:text-sky-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Total Products in File: {rawProducts.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {validationErrors.length === 0 ? (
                      <Badge variant="success">All Valid ({rawProducts.length})</Badge>
                    ) : (
                      <>
                        <Badge variant="success">
                          {rawProducts.length - validationErrors.length} Valid
                        </Badge>
                        <Badge variant="danger">
                          {validationErrors.length} Invalid
                        </Badge>
                      </>
                    )}
                  </div>
                </div>

                {/* Conflict Strategy Selector */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-2">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                    Conflict Resolution (When SKU already exists):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs transition ${
                        conflictMode === 'upsert'
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-sky-300 font-semibold shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
                      }`}
                    >
                      <input
                        type="radio"
                        name="conflictMode"
                        value="upsert"
                        checked={conflictMode === 'upsert'}
                        onChange={() => setConflictMode('upsert')}
                        className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <div className="font-bold">Update Existing & Add New (Upsert)</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          Overwrites pricing, category & specs for matching SKUs
                        </div>
                      </div>
                    </label>

                    <label
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs transition ${
                        conflictMode === 'skip'
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-sky-300 font-semibold shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
                      }`}
                    >
                      <input
                        type="radio"
                        name="conflictMode"
                        value="skip"
                        checked={conflictMode === 'skip'}
                        onChange={() => setConflictMode('skip')}
                        className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <div className="font-bold">Skip Existing (Insert New Only)</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          Preserves all current products and only registers new SKUs
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Preview Table */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                    <span className="font-semibold">Sample Data Preview (First {previewItems.length} rows):</span>
                    <span>Showing top items</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="px-3 py-2 font-semibold">SKU Code</th>
                          <th className="px-3 py-2 font-semibold">Product Name</th>
                          <th className="px-3 py-2 font-semibold">Category</th>
                          <th className="px-3 py-2 font-semibold text-right">Cost Price</th>
                          <th className="px-3 py-2 font-semibold text-right">Selling Price</th>
                          <th className="px-3 py-2 font-semibold text-right">Stock</th>
                          <th className="px-3 py-2 font-semibold text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {previewItems.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="px-3 py-2 font-mono font-bold text-slate-900 dark:text-white">
                              {p.sku}
                            </td>
                            <td className="px-3 py-2 max-w-[180px] truncate font-medium">
                              {p.name}
                            </td>
                            <td className="px-3 py-2 text-slate-500">
                              {p.category}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-500">
                              {p.costPrice?.toFixed(2) ?? '0.00'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-blue-600 dark:text-sky-400">
                              {p.sellingPrice?.toFixed(2) ?? '0.00'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                              {p.initialStock ?? 0}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {p.isValid ? (
                                <Badge variant="success">Valid</Badge>
                              ) : (
                                <Badge variant="danger" title={p.error}>Error</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
