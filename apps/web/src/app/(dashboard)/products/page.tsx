'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { Button, IconButton } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { BarcodeLabelModal } from '@/components/ui/BarcodeLabelModal';
import { ProductImportModal } from '@/components/products/ProductImportModal';
import { ProductFormModal } from '@/components/products/ProductFormModal';
import { DataTable } from '@/components/ui/DataTable';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Barcode,
  Upload,
  Download,
  X,
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
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out' | 'perishable'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [scannerStatus, setScannerStatus] = useState<string | null>(null);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<any>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const handleBarcodeLookup = async (code: string) => {
    const clean = code.trim();
    if (!clean) return;
    setSearch(clean);
    setCurrentPage(1);

    const cleanLower = clean.toLowerCase();
    const localMatch = products.some(
      (p) =>
        (p.barcode && p.barcode.trim().toLowerCase() === cleanLower) ||
        (p.sku && p.sku.trim().toLowerCase() === cleanLower) ||
        (p.plu_code && p.plu_code.trim().toLowerCase() === cleanLower)
    );

    if (!localMatch) {
      try {
        const res = await apiRequest(`/products/scan/${encodeURIComponent(clean)}`);
        if (res.success && res.data) {
          setProducts((prev) => {
            const exists = prev.some((p) => p.id === res.data.id);
            if (exists) return prev;
            return [res.data, ...prev];
          });
          if (res.isScaleBarcode && res.data.plu_code) {
            setSearch(res.data.plu_code);
          }
        }
      } catch (err) {
        console.error('Barcode server lookup failed:', err);
      }
    }
  };

  useBarcodeScanner({
    enableAudioBeep: settings.barcode_audio_beep !== 'false',
    onScan: (scannedBarcode) => {
      // Ignore background scanner events when any modal dialog is active
      if (isModalOpen || isBarcodeModalOpen || isImportModalOpen) {
        return;
      }
      const clean = scannedBarcode.trim();
      if (!clean) return;

      handleBarcodeLookup(clean);
      setScannerStatus(`Scanned: ${clean}`);
      setTimeout(() => setScannerStatus(null), 3000);
    },
  });

  const loadData = async () => {
    setDataLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        apiRequest('/products?limit=all'),
        apiRequest('/products/categories'),
      ]);

      if (prodRes.success && prodRes.data) {
        setProducts(prodRes.data);
      }
      if (catRes.success && catRes.data) {
        setCategories(catRes.data);
      }
    } catch (err) {
      console.error('Failed to load products data:', err);
    } finally {
      setDataLoading(false);
    }
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

  const openCreate = () => {
    setIsEditMode(false);
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const openEdit = (p: any) => {
    setIsEditMode(true);
    setEditingProduct(p);
    setIsModalOpen(true);
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

  // Dynamic stock counting for tab titles, dynamically reflecting selected category
  const stockCounts = useMemo(() => {
    let all = 0;
    let low = 0;
    let out = 0;
    let perishable = 0;

    for (const p of products) {
      if (selectedCat && p.category_id !== selectedCat) continue;
      all++;
      const stock = Number(p.current_stock || 0);
      const min = Number(p.min_stock_level || 5);
      if (stock <= 0) {
        out++;
      } else if (stock <= min) {
        low++;
      }
      if (p.has_expiry) {
        perishable++;
      }
    }
    return { all, low, out, perishable };
  }, [products, selectedCat]);

  // In-memory instant filtering across the entire catalog
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesSearch =
        !query ||
        (p.name && p.name.toLowerCase().includes(query)) ||
        (p.sku && p.sku.toLowerCase().includes(query)) ||
        (p.barcode && p.barcode.toLowerCase().includes(query)) ||
        (p.plu_code && p.plu_code.toLowerCase().includes(query)) ||
        (p.category_name && p.category_name.toLowerCase().includes(query)) ||
        (p.brand_name && p.brand_name.toLowerCase().includes(query));

      const matchesCat = selectedCat ? p.category_id === selectedCat : true;

      let matchesStock = true;
      if (stockFilter === 'low') {
        matchesStock = Number(p.current_stock) > 0 && Number(p.current_stock) <= Number(p.min_stock_level || 5);
      } else if (stockFilter === 'out') {
        matchesStock = Number(p.current_stock) <= 0;
      } else if (stockFilter === 'perishable') {
        matchesStock = Boolean(p.has_expiry);
      }

      return matchesSearch && matchesCat && matchesStock;
    });
  }, [products, search, selectedCat, stockFilter]);

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
      <ProductFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProduct(null);
        }}
        onSuccess={() => {
          loadData();
        }}
        isEditMode={isEditMode}
        productToEdit={editingProduct}
      />

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
            Manage products, pricing, inventory, and barcodes across {products.length} catalog items.
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

      {/* Filters & Tabs Toolbar */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 rounded-2xl bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Left: Search & Category Dropdown */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 min-w-0">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleBarcodeLookup(search);
                }
              }}
              placeholder="Search by SKU, product name, barcode, or PLU..."
              className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-28 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {scannerStatus ? (
                <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md animate-pulse">
                  {scannerStatus}
                </span>
              ) : (
                <span className="hidden sm:flex items-center gap-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/60 px-1.5 py-0.5 rounded-md">
                  <Barcode className="h-3 w-3" /> Scan Ready
                </span>
              )}
              {search && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    setSearch('');
                    setCurrentPage(1);
                    searchInputRef.current?.focus();
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                  title="Clear filter"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Category Filter */}
          <div className="w-full sm:w-56 shrink-0 relative">
            <select
              value={selectedCat || ''}
              onChange={(e) => {
                setSelectedCat(e.target.value ? parseInt(e.target.value, 10) : null);
                setCurrentPage(1);
              }}
              className="h-10 w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-3.5 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none cursor-pointer transition"
            >
              <option value="">All Categories ({products.length})</option>
              {categories.map((c) => {
                const catCount = products.filter((p) => p.category_id === c.id).length;
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({catCount})
                  </option>
                );
              })}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Filter className="h-3.5 w-3.5 opacity-60" />
            </div>
          </div>
        </div>

        {/* Right: Stock Status Filter Tabs with Dynamic Counting Labels */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0 shrink-0">
          {[
            {
              id: 'all' as const,
              label: 'All Stock',
              count: stockCounts.all,
              activeClass: 'bg-blue-700 text-white shadow-sm dark:bg-sky-500 dark:text-slate-950',
              badgeActive: 'bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950',
              badgeInactive: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
            },
            {
              id: 'low' as const,
              label: 'Low Stock',
              count: stockCounts.low,
              activeClass: 'bg-amber-600 text-white shadow-sm',
              badgeActive: 'bg-white/20 text-white',
              badgeInactive:
                stockCounts.low > 0
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 font-bold'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
            },
            {
              id: 'out' as const,
              label: 'Out of Stock',
              count: stockCounts.out,
              activeClass: 'bg-red-600 text-white shadow-sm',
              badgeActive: 'bg-white/20 text-white',
              badgeInactive:
                stockCounts.out > 0
                  ? 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-400 font-bold'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
            },
            {
              id: 'perishable' as const,
              label: 'Perishable',
              count: stockCounts.perishable,
              activeClass: 'bg-purple-600 text-white shadow-sm',
              badgeActive: 'bg-white/20 text-white',
              badgeInactive:
                stockCounts.perishable > 0
                  ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-bold'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
            },
          ].map((tab) => {
            const isActive = stockFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStockFilter(tab.id);
                  setCurrentPage(1);
                }}
                className={`h-10 rounded-xl px-3.5 text-xs font-bold whitespace-nowrap transition flex items-center justify-center gap-1.5 shrink-0 ${
                  isActive
                    ? tab.activeClass
                    : 'bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md transition ${
                    isActive ? tab.badgeActive : tab.badgeInactive
                  }`}
                >
                  ({tab.count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Products Master DataTable with Full Catalog Pagination */}
      <DataTable
        isLoading={dataLoading}
        data={filtered}
        keyExtractor={(p) => p.id}
        emptyMessage="No products match your filter criteria."
        pagination={{
          pageSize: 50,
          pageSizeOptions: [25, 50, 100, 250, 'all'],
          currentPage,
          onPageChange: (p) => setCurrentPage(p),
        }}
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
              const unitShort = p.unit_short || p.unit_name || '';
              const isDecimal = Boolean(p.allow_decimal) || stock % 1 !== 0;
              const formattedQty = isDecimal ? stock.toFixed(2) : stock.toFixed(0);
              const qtyDisplay = unitShort ? `${formattedQty} ${unitShort}` : formattedQty;

              if (stock <= 0) {
                return <Badge variant="danger">Out of Stock (0)</Badge>;
              }
              if (stock <= min) {
                return (
                  <Badge variant="warning">
                    Low Stock ({qtyDisplay})
                  </Badge>
                );
              }
              return (
                <Badge variant="success">
                  In Stock ({qtyDisplay})
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
