# Enterprise Design System: Supermarket POS & Inventory Management System

## 1. Design Philosophy & Vision

The system is built as an ultra-premium, high-velocity retail operating environment engineered for long-shift reliability, maximum legibility, and sub-second transaction throughput.

### Core Tenets
1. **Long-Shift Eye Ergonomics & Global UI Zoom Scaling**: Cashiers and managers operate the system 10–14 hours daily. The system provides a global font scaling engine (`90%` Compact, `100%` Standard, `110%` Comfortable, `120%` Large, `130%` Touch XL) to eliminate eye strain.
2. **Multi-Currency Architecture**: Default is Saudi Riyal (`SAR`), but the system is never hardcoded to a single currency. The manager can configure any ISO currency code (e.g. `USD`, `BDT`, `EUR`, `AED`, `QAR`, `GBP`), custom symbol position (`before` / `after`), decimal places (`0`, `2`, `3`), and separators.
3. **100% Manager Customizable**: Every aspect—from store branding, receipt headers, tax labels, dynamic VAT rates, POS density, hardware beeps, RJ11 drawer kick, and scale prefixes—is editable in the UI by the manager.
4. **Clean International English**: 100% professional English navigation, labels, receipts, validation alerts, and metadata. No broken question marks or foreign language clutter.
5. **High-Contrast Dark & Light Mode**: WCAG AAA compliant dual-mode palette with glassmorphism, instant switching, and zero layout shift.

---

## 2. Global UI Font Scaling & Zoom System

The whole application responds dynamically to the manager or cashier's chosen UI scale.

| Scale Mode | Factor | Base Root Font | Target Device / Use Case |
| :--- | :--- | :--- | :--- |
| **90% Compact** | `0.90` | `14.4px` | High-resolution 4K/QHD manager multi-window monitors |
| **100% Standard** | `1.00` | `16.0px` | Standard 1080p desktop POS displays |
| **110% Comfort** | `1.10` | `17.6px` | Recommended for long retail shifts (high legibility) |
| **120% Large** | `1.20` | `19.2px` | Large POS displays and distance viewing |
| **130% Touch XL** | `1.30` | `20.8px` | 15" / 17" all-in-one touch screens for finger-tapping |

### Implementation Mechanism
- Managed via `useSettings()` hook and stored in `localStorage.getItem('app_font_scale')`.
- Injected directly onto the root document element:
  ```css
  :root {
    --app-font-scale: 1.1;
    font-size: 17.6px;
  }
  ```
- Hotkeys and header quick-toggles (`ZoomIn`, `ZoomOut`, `Scale Pills`) allow instant adjustments without page reloads.

---

## 3. Dynamic Multi-Currency Architecture

Financial calculations and UI displays adapt dynamically to store settings.

### Formatting Engine Formula
```typescript
function formatCurrency(amount: number, settings: ShopSettings): string {
  const symbol = settings.currency_symbol || 'SAR';
  const position = settings.currency_symbol_position || 'after'; // 'before' | 'after'
  const decimals = parseInt(settings.currency_decimals || '2', 10);
  const thouSep = settings.thousands_separator || ',';
  const decSep = settings.decimal_separator || '.';

  const parts = Number(amount || 0).toFixed(decimals).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thouSep);
  const decimalPart = parts.length > 1 ? `${decSep}${parts[1]}` : '';
  const formatted = `${integerPart}${decimalPart}`;

  return position === 'before' ? `${symbol} ${formatted}` : `${formatted} ${symbol}`;
}
```

### Supported Currency Presets
- **SAR (Saudi Riyal)**: `100.00 SAR` (Default)
- **USD (US Dollar)**: `$ 100.00`
- **BDT (Bangladeshi Taka)**: `100.00 ৳`
- **EUR (Euro)**: `100.00 €`
- **AED (UAE Dirham)**: `100.00 AED`
- **QAR (Qatari Riyal)**: `100.00 QAR`
- **GBP (British Pound)**: `£ 100.00`

---

## 4. Color Palette & Dual-Theme Tokens

| Token | Light Mode Value | Dark Mode Value | Usage / Semantic Meaning |
| :--- | :--- | :--- | :--- |
| `--shop-primary` | `#2563eb` (Blue 600) | `#38bdf8` (Sky 400) | Primary actions, checkout, active tabs |
| `--shop-success` | `#059669` (Emerald 600) | `#34d399` (Emerald 400) | Completed sales, positive balance, in-stock |
| `--shop-danger` | `#dc2626` (Red 600) | `#f87171` (Red 400) | Voids, refunds, out-of-stock, overdue |
| `--shop-warning` | `#d97706` (Amber 600) | `#fbbf24` (Amber 400) | Held orders, low stock (< 5), expiring stock |
| `--shop-info` | `#0891b2` (Cyan 600) | `#38bdf8` (Cyan 400) | Output VAT, audit metadata, badges |
| `--shop-bg` | `#f1f5f9` (Slate 100) | `#0b0f19` (Deep Navy) | App background canvas |
| `--shop-surface` | `#ffffff` (Pure White) | `#1e293b` (Slate 800) | Cards, panels, dropdowns, tables |
| `--shop-border` | `#e2e8f0` (Slate 200) | `#334155` (Slate 700) | Dividers, card outlines, input borders |
| `--shop-text` | `#0f172a` (Slate 900) | `#f8fafc` (Slate 50) | High-contrast body typography |
| `--shop-text-muted`| `#64748b` (Slate 500) | `#94a3b8` (Slate 400) | Secondary metadata, SKUs, timestamps |

---

## 5. Complete Manager Customization Matrix

The system provides complete configuration control under **Settings & System Customizer**:

```
[System Settings]
├── 1. Shop Profile & Branding
│   ├── Primary English Store Name (e.g., AL-NOOR SUPERMARKET & HYPERMARKET)
│   ├── Secondary POS Sub-Header (e.g., AL-NOOR RETAIL POS)
│   ├── Commercial Registration (CR) Number
│   ├── 15-Digit VAT Identification Number
│   ├── Contact Phone & Official Email
│   ├── Store Physical Address
│   ├── Receipt Top Greeting Message
│   └── Receipt Return Policy & Footer Note
├── 2. Dynamic VAT & Tax Rates
│   ├── Active Tax Rates (0%, 5%, 15%, Custom %)
│   ├── Default POS Checkout Tax Rate
│   ├── Pricing Mode (Tax-Inclusive vs Tax-Exclusive)
│   └── Display Label on Receipts (e.g., "VAT (15%)")
├── 3. Currency & Locale
│   ├── Currency ISO Code (SAR, USD, BDT, EUR, etc.)
│   ├── Custom Display Symbol
│   ├── Symbol Position (Before Amount vs After Amount)
│   ├── Decimal Precision (2 Decimals vs 3 Decimals)
│   ├── Decimal Separator (. or ,)
│   ├── Thousands Grouping Separator (Comma, Dot, Space)
│   └── System Timezone & Date Display Format
├── 4. Theme & Appearance
│   ├── Global UI Text Size / Scale Zoom (90%, 100%, 110%, 120%, 130%)
│   ├── Day / Night Theme (Light Mode, Dark Mode, Auto System)
│   ├── Brand Accent Color Swatches (#2563eb, #059669, #4f46e5, #7c3aed, #d97706)
│   └── POS Layout Density (Comfortable Touch vs Compact Keyboard)
└── 5. POS & Hardware Peripheral Controls
    ├── Weighing Scale Barcode Prefixes (20, 21, 28, 29)
    ├── Quick Cash Tender Presets (50, 100, 200, 500)
    ├── Auto Cash Drawer Kick Pulse (RJ11)
    └── Barcode Scanner Audio Beep Feedback
```

---

## 6. Real-Time Dashboard KPI Specifications

The 8 core business metrics calculated in real-time on the manager dashboard:

1. **Today Gross Sales**: Total invoice amount before returns/discounts with transaction counter and percentage delta.
2. **Net Store Profit**: Gross sales minus COGS (Weighted Average Cost) and recorded operating expenses.
3. **Output VAT (15%)**: Tax liability extracted from taxable base ready for ZATCA declaration.
4. **Inventory Valuation**: Current physical warehouse & shelf stock valued at WAC cost price.
5. **Customer Receivables**: Outstanding balances owed by credit customers.
6. **Supplier Payables**: Accounts payable due to vendors and distributors.
7. **Stock Alerts**: Count of products at or below minimum threshold (< 5) or out-of-stock.
8. **Cash Drawer Tender**: Active register cash count matching float and cash transactions.

---

## 7. High-Speed POS Terminal Specifications

- **Scan Engine**: Hardware barcode reader integration with automatic carriage return handling and sub-100ms cart injection.
- **Produce PLU Fast Grid**: Touch-optimized tiles with high-res photos for items without physical barcodes (Bananas, Tomatoes, Bread).
- **Line Manipulations**: Inline quantity increment/decrement (`+` / `−`), line discounts, and single-click removal.
- **Tender & Change Engine**: Quick tender buttons (`Exact`, `50`, `100`, `200`, `500 SAR`) with live customer change display.
- **ZATCA Thermal Receipt**: Scalable TLV QR code vector generator and ESC/POS 80mm thermal receipt layout.
