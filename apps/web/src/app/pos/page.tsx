'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import TenderModal from '@/components/pos/TenderModal';
import ReceiptModal from '@/components/pos/ReceiptModal';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  PauseCircle,
  FolderOpen,
  RotateCcw,
  Zap,
  Store,
  LogOut,
  LayoutDashboard,
  User,
  UserPlus,
  AlertCircle,
  Clock,
  Banknote,
  Check,
  Grid,
  ListFilter,
  Percent,
  Tag,
} from 'lucide-react';

interface CartItem {
  productId: number;
  name: string;
  sku: string;
  barcode?: string;
  pluCode?: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  taxRate: number;
  isTaxInclusive: boolean;
  stock: number;
  isWeighable?: boolean;
}

export default function PosTerminalPage() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { settings, formatCurrency } = useSettings();

  const [products, setProducts] = useState<any[]>([]);
  const [quickPluProducts, setQuickPluProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<number>(1); // Default Walk-in
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'catalog' | 'produce'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [invoiceDiscount, setInvoiceDiscount] = useState<number>(0);
  const [invoiceDiscountType, setInvoiceDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [user, setUser] = useState<any>(null);
  const [activeShift, setActiveShift] = useState<any>(null);

  // Modals
  const [isTenderOpen, setIsTenderOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isOpenShiftModal, setIsOpenShiftModal] = useState(false);
  const [heldSalesList, setHeldSalesList] = useState<any[]>([]);
  const [completedSaleData, setCompletedSaleData] = useState<any>(null);
  const [loadingPay, setLoadingPay] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Forms
  const [openingFloat, setOpeningFloat] = useState<number>(100);
  const [newCustForm, setNewCustForm] = useState({ name: '', phone: '', creditLimit: 1000 });

  // Clock
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          timeZone: settings.timezone || 'Asia/Riyadh',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' AST'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [settings.timezone]);

  // Load User, Products, Categories, Customers & Cash Session
  const loadData = async () => {
    const userRes = await apiRequest('/auth/me');
    if (userRes.success && userRes.data?.user) {
      setUser(userRes.data.user);
      setActiveShift(userRes.data.activeShift);
      if (!userRes.data.activeShift) {
        setIsOpenShiftModal(true);
      }
    } else {
      router.replace('/login');
      return;
    }

    const prodRes = await apiRequest('/products');
    if (prodRes.success && prodRes.data) {
      setProducts(prodRes.data);
    }

    const pluRes = await apiRequest('/products/quick-plu');
    if (pluRes.success && pluRes.data) {
      setQuickPluProducts(pluRes.data);
    }

    const catRes = await apiRequest('/products/categories');
    if (catRes.success && catRes.data) {
      setCategories(catRes.data);
    }

    const custRes = await apiRequest('/ledgers/customers');
    if (custRes.success && custRes.data) {
      setCustomers(custRes.data);
    }
  };

  useEffect(() => {
    loadData();
  }, [router]);

  // Hardware Barcode Scanner Listener
  useBarcodeScanner({
    enableAudioBeep: settings.barcode_audio_beep !== 'false',
    onScan: async (barcode) => {
      setErrorMsg(null);
      const res = await apiRequest(`/products/scan/${barcode}`);
      if (res.success && res.data) {
        const itemQty = res.scannedQuantity || 1.0;
        addToCart(res.data, itemQty);
      } else {
        setErrorMsg(`Item with barcode ${barcode} not found.`);
      }
    },
  });

  // Global Keyboard Shortcuts (F2 search, F3 produce grid, F4 hold, F7 retrieve, F9/Space pay, Esc cancel)
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('catalog');
        searchInputRef.current?.focus();
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActiveTab((prev) => (prev === 'produce' ? 'catalog' : 'produce'));
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleHoldCart();
      } else if (e.key === 'F7') {
        e.preventDefault();
        openHeldModal();
      } else if (e.key === 'F9' || (e.code === 'Space' && e.ctrlKey)) {
        e.preventDefault();
        if (cart.length > 0) setIsTenderOpen(true);
      } else if (e.key === 'Escape') {
        setIsTenderOpen(false);
        setIsReceiptOpen(false);
        setIsHeldModalOpen(false);
        setIsAddCustomerOpen(false);
        setIsOpenShiftModal(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [cart]);

  // Add Item to Cart
  const addToCart = (product: any, qtyToAdd: number = 1) => {
    setErrorMsg(null);
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: Math.round((i.quantity + qtyToAdd) * 1000) / 1000 }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          pluCode: product.plu_code,
          unitPrice: Number(product.selling_price),
          quantity: qtyToAdd,
          discount: 0,
          taxRate: Number(product.tax_rate || 15.0),
          isTaxInclusive: product.tax_type === 'inclusive',
          stock: Number(product.current_stock || 0),
          isWeighable: product.is_weighable,
        },
      ];
    });
  };

  // Adjust Quantity
  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const step = item.isWeighable ? 0.25 : 1;
            const newQty = Math.round((item.quantity + delta * step) * 1000) / 1000;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Adjust Item Discount
  const updateItemDiscount = (productId: number, discount: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, discount: Math.max(0, discount) } : item
      )
    );
  };

  // Remove Item
  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  // Clear Cart
  const clearCart = () => {
    setCart([]);
    setInvoiceDiscount(0);
    setErrorMsg(null);
  };

  // Hold Cart (F4)
  const handleHoldCart = async () => {
    if (cart.length === 0) return;
    const res = await apiRequest('/sales/hold', {
      method: 'POST',
      body: JSON.stringify({
        customerId: selectedCustomer,
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount,
        })),
      }),
    });
    if (res.success) {
      clearCart();
      setErrorMsg(null);
    }
  };

  // Retrieve Held Sales (F7)
  const openHeldModal = async () => {
    const res = await apiRequest('/sales/hold');
    if (res.success && res.data) {
      setHeldSalesList(res.data);
      setIsHeldModalOpen(true);
    }
  };

  const resumeHeldSale = async (heldSaleId: number) => {
    const res = await apiRequest(`/sales/hold/${heldSaleId}`);
    if (res.success && res.data) {
      const { heldSale, items } = res.data;
      if (heldSale.customer_id) setSelectedCustomer(heldSale.customer_id);

      const loadedItems: CartItem[] = items.map((i: any) => ({
        productId: i.product_id,
        name: i.name,
        sku: i.sku,
        barcode: i.barcode,
        pluCode: i.plu_code,
        unitPrice: Number(i.unit_price),
        quantity: Number(i.quantity),
        discount: Number(i.discount || 0),
        taxRate: Number(i.tax_rate || 15.0),
        isTaxInclusive: i.tax_type === 'inclusive',
        stock: Number(i.current_stock || 0),
      }));

      setCart(loadedItems);
      await apiRequest(`/sales/hold/${heldSaleId}`, { method: 'DELETE' });
      setIsHeldModalOpen(false);
    }
  };

  // Quick Customer Registration
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/ledgers/customers', {
      method: 'POST',
      body: JSON.stringify(newCustForm),
    });
    if (res.success && res.data) {
      setCustomers((prev) => [res.data, ...prev]);
      setSelectedCustomer(res.data.id);
      setIsAddCustomerOpen(false);
      setNewCustForm({ name: '', phone: '', creditLimit: 1000 });
    } else {
      setErrorMsg(res.message || 'Failed to create customer.');
    }
  };

  // Open Shift Action
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/cash/open', {
      method: 'POST',
      body: JSON.stringify({ openingBalance: Number(openingFloat) }),
    });
    if (res.success) {
      setActiveShift(res.data);
      setIsOpenShiftModal(false);
    } else {
      setErrorMsg(res.message || 'Failed to open shift.');
    }
  };

  // Calculate Totals with Proportional Invoice Discounts
  const calculateCartTotals = () => {
    let rawGrossSubtotal = 0;
    cart.forEach((item) => {
      rawGrossSubtotal += item.unitPrice * item.quantity;
    });

    let computedDiscount = invoiceDiscount;
    if (invoiceDiscountType === 'percentage' && rawGrossSubtotal > 0) {
      computedDiscount = (rawGrossSubtotal * invoiceDiscount) / 100;
    }
    computedDiscount = Math.min(computedDiscount, rawGrossSubtotal);

    let subtotal = 0;
    let totalTax = 0;
    let grandTotal = 0;

    cart.forEach((item) => {
      const lineGross = item.unitPrice * item.quantity;
      const allocatedGeneralDiscount =
        rawGrossSubtotal > 0 ? (computedDiscount * lineGross) / rawGrossSubtotal : 0;
      const totalLineDiscount = item.discount + allocatedGeneralDiscount;

      const rateFactor = item.taxRate / 100;
      if (item.isTaxInclusive) {
        const discountedGross = Math.max(0, lineGross - totalLineDiscount);
        const taxable = discountedGross / (1 + rateFactor);
        const tax = discountedGross - taxable;
        subtotal += taxable;
        totalTax += tax;
        grandTotal += discountedGross;
      } else {
        const discountedTaxable = Math.max(0, lineGross - totalLineDiscount);
        const tax = discountedTaxable * rateFactor;
        subtotal += discountedTaxable;
        totalTax += tax;
        grandTotal += discountedTaxable + tax;
      }
    });

    return {
      rawGrossSubtotal,
      computedDiscount,
      subtotal,
      totalTax,
      grandTotal,
    };
  };

  const { computedDiscount, subtotal, totalTax, grandTotal } = calculateCartTotals();

  // Finalize Sale
  const handleFinalizeSale = async (payments: Array<{ paymentMethodId: number; amount: number }>) => {
    setLoadingPay(true);
    setErrorMsg(null);

    const payload = {
      customerId: selectedCustomer,
      items: cart.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
      })),
      payments,
      invoiceDiscount: invoiceDiscount,
      invoiceDiscountType: invoiceDiscountType,
      idempotencyKey: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };

    const res = await apiRequest('/sales', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setLoadingPay(false);

    if (res.success && res.data) {
      setCompletedSaleData(res.data);
      setIsTenderOpen(false);
      setIsReceiptOpen(true);
      clearCart();
      loadData();
    } else {
      setErrorMsg(res.message || 'Sale checkout failed.');
    }
  };

  // Filter products by category and search
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory ? p.category_id === selectedCategory : true;
    const matchesSearch = searchQuery
      ? p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery)) ||
        (p.plu_code && p.plu_code.includes(searchQuery))
      : true;
    return matchesCat && matchesSearch;
  });

  const handleLogout = async () => {
    await apiRequest('/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* LEFT AREA: Catalog & Produce Grid (65% width) */}
      <div className="flex flex-1 flex-col overflow-hidden border-r border-slate-800">
        {/* Top Header Bar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide uppercase">
                {settings.shop_name_en || 'AL-NOOR SUPERMARKET & HYPERMARKET'}
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{settings.shop_name_ar || 'AL-NOOR RETAIL POS'}</span>
                <span>•</span>
                <span className="text-emerald-400 font-semibold">{settings.tax_label || '15% VAT Active'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Shift & Time Widget */}
            <div className="hidden md:flex items-center gap-3 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs">
              <div className="flex items-center gap-1 text-slate-300 font-mono">
                <Clock className="h-3.5 w-3.5 text-blue-400" />
                <span>{currentTime}</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Banknote className="h-3.5 w-3.5 text-emerald-400" />
                <span>
                  Shift:{' '}
                  {activeShift ? (
                    <strong className="text-emerald-400">Active</strong>
                  ) : (
                    <strong className="text-amber-400">Closed</strong>
                  )}
                </span>
              </div>
            </div>

            {user?.role === 'manager' && (
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3.5 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 transition"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Back-Office
              </button>
            )}

            <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
              <User className="h-3.5 w-3.5 text-slate-400" />
              <span>{user?.fullName || 'Cashier'}</span>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* View Mode Tabs (F2 Catalog vs F3 Produce PLU Grid) & Search Bar */}
        <div className="border-b border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center gap-3">
            {/* View Switcher Tabs */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-bold">
              <button
                onClick={() => setActiveTab('catalog')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'catalog'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ListFilter className="h-3.5 w-3.5" />
                Catalog (F2)
              </button>
              <button
                onClick={() => setActiveTab('produce')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'produce'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Grid className="h-3.5 w-3.5" />
                Produce & Bakery PLU (F3)
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Scan barcode or search name / SKU / PLU (F2)..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Category Chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`rounded-full px-3.5 py-1 font-semibold transition ${
                selectedCategory === null ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All Items ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-full px-3.5 py-1 font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Product Grid Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'produce' ? (
            /* FAST PRODUCE & PLU GRID */
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Grid className="h-4 w-4" />
                  Produce, Fruits, Veggies & Bakery Fast Touch Grid
                </h3>
                <span className="text-[11px] text-slate-400">Click item to add 1 kg or unit</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {quickPluProducts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => addToCart(p, 1.0)}
                    className="flex flex-col justify-between rounded-2xl border border-emerald-900/40 bg-gradient-to-b from-slate-900 to-slate-950 p-4 shadow-sm hover:border-emerald-500 hover:shadow-lg transition cursor-pointer active:scale-95"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
                          PLU #{p.plu_code || p.sku}
                        </span>
                        <span className="text-[10px] text-slate-400">{p.unit_short || 'kg'}</span>
                      </div>
                      <h4 className="mt-2 text-sm font-bold text-white line-clamp-2">{p.name}</h4>
                    </div>
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800">
                      <span className="font-mono text-sm font-black text-emerald-400">{formatCurrency(p.selling_price)}</span>
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600/30 text-emerald-400 font-bold">
                        +
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* STANDARD CATALOG GRID */
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {filteredProducts.map((p) => {
                const stock = Number(p.current_stock || 0);
                const isOut = stock <= 0;
                return (
                  <div
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className={`group relative flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 shadow-sm transition hover:border-blue-500 hover:shadow-lg cursor-pointer active:scale-98 ${
                      isOut ? 'opacity-60' : ''
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="text-[10px] font-mono text-slate-400">{p.sku}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                            stock > 5
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : stock > 0
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {stock > 0 ? `${stock} in stock` : 'Out of stock'}
                        </span>
                      </div>
                      <h3 className="mt-1 text-sm font-semibold text-slate-100 line-clamp-2">{p.name}</h3>
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <span className="font-mono text-sm font-extrabold text-blue-400">{formatCurrency(p.selling_price)}</span>
                      <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT AREA: Cart & Payment (35% width) */}
      <div className="flex w-[390px] flex-col bg-slate-900 border-l border-slate-800 xl:w-[430px]">
        {/* Cart Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5 bg-slate-900/90">
          <div className="flex items-center gap-2 font-bold text-white">
            <ShoppingCart className="h-5 w-5 text-blue-500" />
            <span>Active Cart ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300">
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* Customer Selector */}
        <div className="border-b border-slate-800 bg-slate-950/60 p-3 flex items-center gap-2">
          <div className="flex-1">
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2 px-3 text-xs text-white focus:border-blue-500 focus:outline-none"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {Number(c.current_due) > 0 ? `(Due: ${formatCurrency(c.current_due)})` : ''}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setIsAddCustomerOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-blue-600 hover:text-white transition"
            title="Register Customer"
          >
            <UserPlus className="h-4 w-4" />
          </button>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
              <ShoppingCart className="h-12 w-12 stroke-[1.2] mb-3 text-slate-600" />
              <p className="text-sm font-medium">Cart is currently empty</p>
              <p className="text-xs text-slate-600 mt-1">Scan a barcode or click a product to begin</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.productId}
                className="flex flex-col rounded-xl bg-slate-950 p-3 border border-slate-800 gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-2">
                    <div className="text-xs font-bold text-slate-100 line-clamp-1">{item.name}</div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {formatCurrency(item.unitPrice)} x {item.quantity}
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-10 text-center font-mono text-xs font-bold text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="ml-1 p-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Line Discount Input */}
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-900 text-[11px]">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Item Discount:
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.discount || ''}
                      onChange={(e) => updateItemDiscount(item.productId, parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-16 rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 text-right font-mono text-xs text-emerald-400 focus:outline-none"
                    />
                    <span className="text-slate-400">{settings.currency_symbol || 'SAR'}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Invoice Discount & Cart Financial Summary */}
        <div className="border-t border-slate-800 bg-slate-950 p-4 space-y-3">
          {/* General Invoice Discount Input */}
          <div className="flex items-center justify-between rounded-xl bg-slate-900/80 p-2 border border-slate-800 text-xs">
            <span className="text-slate-400 flex items-center gap-1.5 font-semibold">
              <Percent className="h-3.5 w-3.5 text-amber-400" /> Invoice Discount:
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                step="0.01"
                value={invoiceDiscount || ''}
                onChange={(e) => setInvoiceDiscount(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-16 rounded-lg bg-slate-950 border border-slate-700 px-2 py-1 text-right font-mono text-xs text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setInvoiceDiscountType((prev) => (prev === 'fixed' ? 'percentage' : 'fixed'))}
                className="rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-bold text-blue-400 hover:bg-slate-700"
              >
                {invoiceDiscountType === 'percentage' ? '%' : settings.currency_symbol || 'SAR'}
              </button>
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Subtotal (Taxable)</span>
              <span className="font-mono text-slate-200">{formatCurrency(subtotal)}</span>
            </div>
            {computedDiscount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Total Discount</span>
                <span className="font-mono">-{formatCurrency(computedDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>{settings.tax_label || 'Saudi VAT (15%)'}</span>
              <span className="font-mono text-slate-200">{formatCurrency(totalTax)}</span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-slate-800 text-base font-extrabold text-white">
              <span>TOTAL DUE</span>
              <span className="font-mono text-2xl text-blue-400">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              onClick={handleHoldCart}
              disabled={cart.length === 0}
              className="flex items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-40"
              title="Hold Sale (F4)"
            >
              <PauseCircle className="h-3.5 w-3.5 text-amber-400" />
              Hold (F4)
            </button>
            <button
              onClick={openHeldModal}
              className="flex items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700"
              title="Retrieve Held (F7)"
            >
              <FolderOpen className="h-3.5 w-3.5 text-blue-400" />
              Held (F7)
            </button>
            <button
              onClick={() => router.push('/returns')}
              className="flex items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700"
            >
              <RotateCcw className="h-3.5 w-3.5 text-rose-400" />
              Returns
            </button>
          </div>

          {/* Large Green Pay Button */}
          <button
            onClick={() => setIsTenderOpen(true)}
            disabled={cart.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 text-base font-black text-white shadow-xl shadow-emerald-600/30 hover:bg-emerald-500 disabled:opacity-40 transition"
          >
            <Zap className="h-5 w-5 fill-white" />
            PAY NOW ({formatCurrency(grandTotal)})
          </button>
        </div>
      </div>

      {/* Tender Modal */}
      {isTenderOpen && (
        <TenderModal
          totalAmount={grandTotal}
          onConfirm={handleFinalizeSale}
          onClose={() => setIsTenderOpen(false)}
          loading={loadingPay}
        />
      )}

      {/* Receipt Modal */}
      {isReceiptOpen && completedSaleData && (
        <ReceiptModal
          data={completedSaleData}
          onClose={() => {
            setIsReceiptOpen(false);
            setCompletedSaleData(null);
          }}
        />
      )}

      {/* Held Sales Modal (F7) */}
      {isHeldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-white">
            <h2 className="text-base font-bold mb-3 flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-blue-400" />
              Retrieve Suspended Sales
            </h2>
            {heldSalesList.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No suspended carts available.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {heldSalesList.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl"
                  >
                    <div>
                      <div className="text-xs font-bold text-blue-400 font-mono">{h.reference_no}</div>
                      <div className="text-[10px] text-slate-400">
                        {h.customer_name || 'Walk-in'} • {h.item_count} items
                      </div>
                    </div>
                    <button
                      onClick={() => resumeHeldSale(h.id)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold text-white transition"
                    >
                      Resume
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setIsHeldModalOpen(false)}
                className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-800"
              >
                Close (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Customer Modal */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-white">
            <h2 className="text-base font-bold mb-3 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-blue-400" />
              Quick Register Customer
            </h2>
            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 font-bold text-slate-300">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={newCustForm.name}
                  onChange={(e) => setNewCustForm({ ...newCustForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. Mohammed Al-Otaibi"
                />
              </div>
              <div>
                <label className="block mb-1 font-bold text-slate-300">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={newCustForm.phone}
                  onChange={(e) => setNewCustForm({ ...newCustForm, phone: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. +966 50 123 4567"
                />
              </div>
              <div>
                <label className="block mb-1 font-bold text-slate-300">Credit Limit ({settings.currency_symbol || 'SAR'})</label>
                <input
                  type="number"
                  value={newCustForm.creditLimit}
                  onChange={(e) =>
                    setNewCustForm({ ...newCustForm, creditLimit: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="px-4 py-2 border border-slate-700 rounded-xl hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold"
                >
                  Register Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Open Shift Modal */}
      {isOpenShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-white">
            <h2 className="text-base font-bold mb-2 flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-400" />
              Open Cash Register Shift
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Enter starting cash float in the register to begin transactions.
            </p>
            <form onSubmit={handleOpenShift} className="space-y-4 text-xs">
              <div>
                <label className="block mb-1 font-bold text-slate-300">Opening Cash Float ({settings.currency_symbol || 'SAR'}) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-lg font-mono font-bold text-emerald-400 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500 transition"
              >
                <Check className="h-4 w-4" />
                Start Cash Register Shift
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
