# Component Library & Design System: Supermarket POS & Inventory Management System

## Document Role & Precedence

This is the shared visual and interaction contract for the application. `Instructions.md` is the single source of truth for scope and business rules; `SystemDesign.md` is the implementation guide. This document defines how approved behaviour is presented through reusable components. It never changes permissions, financial calculations, legal content, or workflow rules.

Every page and component must use the tokens, components, states, and content rules below. Do not create page-specific variants unless this library is updated first.

## 1. Design Philosophy & Vision

The system is built as an ultra-premium, high-velocity retail operating environment engineered for long-shift reliability, maximum legibility, and sub-second transaction throughput.

### Core Tenets
1. **Long-Shift Eye Ergonomics & Focused UI Scaling**: Cashiers and managers operate the system 10–14 hours daily. The system supports exactly two global UI scales: `100% Standard` (default) and `110% Comfortable`.
2. **Currency-Safe Architecture**: Saudi Riyal (`SAR`) is the shop's legal operating currency by default. The display layer supports ISO currency formatting for future use, but a posted invoice always stores its currency code, precision, symbol convention, tax mode, and shop identity as immutable snapshots. Currency changes are effective-dated and cannot rewrite issued documents.
3. **Governed Manager Customization**: Managers can customize branding, receipt templates, POS density, hardware beeps, drawer behaviour, and scale prefixes. Financial, legal, and security settings (VAT profile, invoice sequence, ZATCA identity, currency, negative-stock policy, and printer endpoints) require Manager re-authentication, an audit reason, and an effective date where applicable.
4. **Clean International English**: Use professional, plain English. Every visible label must earn its space: retain names, values, field labels, errors, and legal information; remove duplicate headings, decorative labels, verbose instructions, and repeated status text.
5. **High-Contrast Dark & Light Mode**: Dual-mode palettes are tested at every supported zoom level. Critical text and controls meet WCAG AA at minimum; text advertised as AAA must pass a documented contrast test against its actual surface. Status is never communicated by color alone.

---

## 2. Global UI Font Scaling & Zoom System

The whole application responds dynamically to the manager or cashier's chosen UI scale.

| Scale Mode | Factor | Base Root Font | Target Device / Use Case |
| :--- | :--- | :--- | :--- |
| **100% Standard** | `1.00` | `16.0px` | Standard 1080p desktop POS displays |
| **110% Comfort** | `1.10` | `17.6px` | Recommended for long retail shifts (high legibility) |

### Implementation Mechanism
- A user may keep a local accessibility preference in `localStorage.getItem('app_font_scale')`; the shop default comes from the server-side settings profile. Apply the selected scale before interactive hydration to avoid a visible layout jump.
- Injected directly onto the root document element:
  ```css
  :root {
    --app-font-scale: 1.1;
    font-size: 17.6px;
  }
  ```
- Use one compact Settings control (or a small two-option popover) to switch scale without a page reload. Do not expose zoom hotkeys or a row of persistent scale pills in the application header.

---

## 3. Dynamic Multi-Currency Architecture

Financial calculations and UI displays adapt dynamically to store settings.

### Formatting Engine Formula
```typescript
import Decimal from 'decimal.js';

function formatCurrency(amount: Decimal.Value, settings: ShopSettings): string {
  const symbol = settings.currency_symbol || 'SAR';
  const position = settings.currency_symbol_position || 'after'; // 'before' | 'after'
  const decimals = parseInt(settings.currency_decimals || '2', 10);
  const thouSep = settings.thousands_separator || ',';
  const decSep = settings.decimal_separator || '.';

  // API money values are decimal strings. Never convert them through Number.
  const rounded = new Decimal(amount ?? '0').toDecimalPlaces(
    decimals,
    Decimal.ROUND_HALF_UP,
  );
  const parts = rounded.toFixed(decimals).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thouSep);
  const decimalPart = parts.length > 1 ? `${decSep}${parts[1]}` : '';
  const formatted = `${integerPart}${decimalPart}`;

  return position === 'before' ? `${symbol} ${formatted}` : `${formatted} ${symbol}`;
}
```

This utility is presentation-only. It must receive an invoice or report's persisted currency snapshot rather than today's mutable shop setting.

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
| `--shop-primary` | `#1e40af` (Blue 800) | `#7dd3fc` (Sky 300) | Primary actions, checkout, active tabs |
| `--shop-success` | `#065f46` (Emerald 800) | `#6ee7b7` (Emerald 300) | Completed sales, positive balance, in-stock |
| `--shop-danger` | `#991b1b` (Red 800) | `#fca5a5` (Red 300) | Voids, refunds, out-of-stock, overdue |
| `--shop-warning` | `#92400e` (Amber 800) | `#fde68a` (Amber 200) | Held orders, low stock (< 5), expiring stock |
| `--shop-info` | `#155e75` (Cyan 800) | `#a5f3fc` (Cyan 200) | Output VAT, audit metadata, badges |
| `--shop-bg` | `#f1f5f9` (Slate 100) | `#0b0f19` (Deep Navy) | App background canvas |
| `--shop-surface` | `#ffffff` (Pure White) | `#1e293b` (Slate 800) | Cards, panels, dropdowns, tables |
| `--shop-border` | `#e2e8f0` (Slate 200) | `#334155` (Slate 700) | Dividers, card outlines, input borders |
| `--shop-text` | `#0f172a` (Slate 900) | `#f8fafc` (Slate 50) | High-contrast body typography |
| `--shop-text-muted`| `#445366` (Charcoal Slate) | `#cbd5e1` (Slate 300) | Secondary metadata, SKUs, timestamps |

Use these semantic colors for icons, borders, and badges only in combination with a label, icon shape, or text state (for example, `Overdue`, not a red dot alone). Automated visual regression and contrast tests must cover each token on every declared background.

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
│   ├── Global UI Scale (100% Standard, 110% Comfortable)
│   ├── Theme (Light Mode, Dark Mode)
│   ├── Brand Accent Color Swatches (#2563eb, #059669, #4f46e5, #7c3aed, #d97706)
│   └── POS Layout Density (Comfortable Touch vs Compact Keyboard)
└── 5. POS & Hardware Peripheral Controls
    ├── Weighing Scale Barcode Prefixes (20, 21, 28, 29)
    ├── Quick Cash Tender Presets (50, 100, 200, 500)
    ├── Auto Cash Drawer Kick Pulse (RJ11)
    └── Barcode Scanner Audio Beep Feedback
```

### Configuration Governance

Settings are classified as **appearance**, **operational**, or **legal/financial**. Appearance settings apply immediately. Operational settings require a confirmation and audit reason. Legal/financial settings create a versioned, effective-dated configuration record, require Manager step-up authentication, and are blocked while an affected cash shift is open. No setting update can change an already-issued invoice, receipt, payment, audit entry, or tax report.

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

---

## 8. Foundation Tokens & Layout Rules

### Spacing, Shape & Typography

| Token | Value at 100% | Usage |
| :--- | :--- | :--- |
| `--space-1` | `4px` | Icon gaps, compact inline spacing |
| `--space-2` | `8px` | Field/control internal gaps |
| `--space-3` | `12px` | Related controls and card padding on compact surfaces |
| `--space-4` | `16px` | Default card padding and form row gap |
| `--space-5` | `24px` | Section separation |
| `--space-6` | `32px` | Page-section separation |
| `--radius-control` | `8px` | Buttons, fields, chips, toggles |
| `--radius-surface` | `12px` | Cards, panels, dialogs |

- Define all component dimensions in `rem` or token-based CSS so both 100% and 110% scales work without a second component variant.
- Use one typeface family with tabular numerals for prices, quantities, invoice numbers, and tables. Body text is `1rem`; supporting text is no smaller than `0.875rem` at 100%.
- Use sentence case: `Add product`, not `ADD PRODUCT`. Use a single page title and no decorative subtitle unless it communicates an action or constraint.
- Use surfaces sparingly. A page background plus one level of cards/panels is sufficient; avoid cards nested inside cards without a functional reason.

### Responsive Layout

- Desktop/back-office pages use a responsive 12-column grid with a max readable content width. Related filters and actions share a single toolbar.
- POS uses a stable two-pane layout on wide screens: catalog on the left and cart on the right. On constrained screens, the cart becomes a deliberate full-height panel; it never compresses quantity, price, or Pay controls below usable size.
- Minimum interactive target: `40px` at 100% for standard controls and `48px` for POS/touch controls. Spacing and target size scale naturally to 110%.
- Do not rely on hover for a required action. Keyboard focus and touch states are mandatory.

---

## 9. Component Library

### Buttons

| Variant | Use | Rules |
| :--- | :--- | :--- |
| **Primary** | One dominant action in a region: `Save`, `Pay`, `Complete sale` | Solid primary token; one primary button per dialog/footer/toolbar where practical. |
| **Secondary** | Important alternative: `Hold sale`, `Print`, `Add payment` | Surface/background treatment with visible border. |
| **Ghost** | Low-emphasis inline actions: `Cancel`, `View details` | No border until hover/focus; never use for destructive confirmation. |
| **Danger** | Confirmed destructive/corrective action: `Remove`, `Issue credit note` | Red token; require a confirmation or Manager approval where business rules require it. |
| **Icon button** | A universally understood repeated action in a dense row | Tooltip and accessible name are required. Use only for search, clear, print, edit, or remove—not as the only wording for a critical action. |
| **PWA Install Button** | Prompts Windows/Chromium desktop app installation (`InstallPwaButton`) | Displayed on Login screen; automatically hides when running in standalone window mode. |

- Standard buttons use a `40px` minimum height; POS buttons use `48px`. Button text is an imperative verb plus object when needed: `Add product`, `Close shift`.
- Disabled buttons explain the reason through concise adjacent helper text only when it is not obvious, for example `Open a shift to take payment`.
- A loading button keeps its label and replaces only the leading icon with a spinner; do not change `Save` to a vague `Loading` label.

### Fields & Input Controls

| Component | Appearance & behaviour |
| :--- | :--- |
| **Text / number field** | Label above the field, value-aligned left except numerical money/quantity fields align right. Use a visible required indicator only when a field is required; avoid marking every field. |
| **Search field** | Search icon, concise placeholder such as `Search products`, clear button only when non-empty, and no redundant `Search` label when its accessible name is present. |
| **Select / combobox** | Use select for a short fixed set; searchable combobox for products, customers, suppliers, and large catalogues. Show the selected value, not a repeated label inside the control. |
| **Date / time field** | Use the locale display format while preserving ISO API values. Show a calendar trigger and clear validation for invalid ranges. |
| **Money / quantity field** | Use decimal string input, suffix/prefix from the persisted display context, tabular numerals, and never coerce through JavaScript `number`. |
| **Textarea** | Reserve for reason, notes, and receipt text. Auto-grow to a sensible maximum; do not use for short values. |

- A field label is required except where the control is self-evident and has an accessible name, such as the global product search. Placeholder text never replaces a required field label.
- Show helper text only for a format, business constraint, or error. Errors sit directly below the affected field, describe the correction, and use an icon/text in addition to color.
- Forms use one column by default. Two columns are allowed only for short, related fields such as `First name / Last name` or `Amount / Payment method`.

### Choice Controls

| Component | Use | Visual rule |
| :--- | :--- | :--- |
| **Radio group** | Choose exactly one from 2–5 mutually exclusive options, such as tax mode or refund destination. | Group label is visible; each option has label plus a one-line description only if options are otherwise ambiguous. |
| **Segmented control** | Immediate view/mode change with 2–3 short options, such as `Light / Dark` or `List / Grid`. | Use only when changing selection has no destructive side effect; selected state has color, shape, and text-weight difference. |
| **Checkbox** | Independent yes/no choice, acknowledgement, or multi-select. | Label appears to the right; the full label row is clickable. Do not use a checkbox for a mutually exclusive choice. |
| **Switch** | Immediate saved preference, such as barcode beep. | Label clearly states the enabled result: `Play scan sound`. Do not use for settings requiring confirmation or an effective date. |

### Chips, Badges & Status

- **Chips** represent removable filters or compact selected values, for example `Dairy ×`. They are not buttons disguised as tags.
- **Badges** communicate short status only: `Paid`, `Held`, `Low stock`, `Expired`. Keep one status badge per row unless two independent statuses are essential.
- Status always combines semantic color with text and, where useful, an icon. Do not repeat the same status in a badge, table cell, card header, and toast.

### Cards, Lists & Tables

- **Metric card:** label, prominent value, optional compact comparison. It has no secondary call-to-action; clicking the card is allowed only when a clear destination exists.
- **Standard card:** optional title, actions aligned top-right, concise body, and a consistent `--radius-surface` border/surface. Never put a title inside a title-only card.
- **Data table:** sticky header for long lists, column-aligned tabular figures, right-aligned money/quantity values, row action menu at the end, and responsive column priority. Avoid vertical gridlines unless they materially improve scanning.
- **Mobile/constrained list:** replace a wide table with a product/document list item showing name, one supporting line, amount/status, and an overflow menu. Preserve access to the full detail view.

### Product List, Product Item & POS Tile

- **Product list item:** primary name, optional brand/SKU on one muted line, current selling price, stock state, and thumbnail only when it improves recognition. Cost price is never rendered for Sales Executive users.
- **Product table row:** name with thumbnail, SKU/barcode as muted metadata, selling price, stock, status, and compact actions. Do not repeat the product category unless it is an active decision field.
- **POS product tile:** image or restrained category fallback, 1–2 line product name, selling price, and an unavailable overlay for inactive/out-of-stock items. It has a `48px`-minimum touch target and does not expose cost, margin, or dense metadata.
- **Cart line:** product name, selected quantity/unit, unit/line price, promotion/discount summary only when applied, inline quantity controls, and remove action. Avoid a separate `Item`, `Qty`, and `Price` label on every cart row.

### Forms, Dialogs & Feedback

- **Form shell:** page title, optional one-sentence purpose, grouped fields, a single sticky action bar for long forms, and `Cancel` + primary save action. Do not place a Save button in every card.
- **Confirmation dialog:** concise title naming the consequence, one or two sentences of impact, safe action first, destructive action second. Never use vague labels such as `Yes` or `Proceed`.
- **Drawer / side panel:** use for view/edit context that benefits from keeping the list visible; use a dialog for focused confirmation or short workflow.
- **Toast:** confirms a completed non-critical action or transient failure. It does not replace field errors, legal-document status, cash discrepancy, or stock validation messages.
- **Empty state:** one plain-language explanation and one relevant primary action. No decorative illustration is required in operational POS workflows.

---

## 10. Page Composition Patterns

| Page type | Required composition | Avoid |
| :--- | :--- | :--- |
| **Dashboard** | One page title, date context, KPI grid, one or two decision-useful charts, alerts, recent activity | A card for every number, duplicate totals, decorative charts |
| **Catalogue / inventory list** | Title, one toolbar containing search/filter/actions, result table or list, pagination | Separate search cards, repeated filters, per-row persistent labels |
| **Product form** | Clear identity section, pricing/tax, stock/unit, optional batches/images, one action bar | Exposing cost to restricted roles, long explanatory copy, unrelated settings |
| **Purchase / return** | Source document context, editable lines, running totals, documented reason when required, confirmation | Free-form totals, hidden tax effects, irreversible action without review |
| **POS** | Quiet header, product/search area, persistent cart, visible total, one dominant Pay action | Dashboard metrics, crowded navigation, multiple competing primary actions |
| **Settings** | Grouped navigation, concise descriptions only for impactful settings, version/effective-date context for governed values | A single endless form, duplicate Save buttons, exposing sensitive values by default |

---

## 11. Finalized Screen & Component Specifications (Production Locked)

> [!IMPORTANT]
> The visual presentation, styling tokens, responsive layouts, and interaction flows for the **Login Page**, **POS Terminal**, **Cash Drawer Shift**, **Product Catalog**, and **Label Printing** are **final, approved, and production-locked**.

### 11.1 Finalized Login Screen & POS Occupied Takeover Modal
- **Canvas**: Fullscreen Slate-950 canvas with ambient `bg-blue-600/15` and `bg-sky-500/10` radial blurs.
- **Glassmorphic Card**: 420px maximum width, `bg-slate-900/90`, `backdrop-blur-2xl`, `border-slate-800/80`, `shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)]`.
- **Header**: Store gradient icon badge (`from-blue-700 to-sky-500`), uppercase Shop Name (`text-base font-black`), subtitle "Point of Sale & Retail Management".
- **Dual Mode Role Switcher Tabs**:
  - Segmented switcher with Slate-950 background and Slate-800 border.
  - "Sales Executive" tab with `KeyRound` icon; "Manager" tab with `ShieldCheck` icon.
  - Active tab highlighted with blue gradient and drop-shadow (`from-blue-700 to-blue-600`).
- **Sales Executive 5-Digit PIN Input**:
  - 5 discrete square monospace input boxes (`h-14 w-14`, `rounded-xl`, `font-mono text-2xl font-black`).
  - Active digit receives sky-blue tint (`bg-blue-950/30 text-sky-400 border-blue-500 ring-2 ring-blue-500/30`).
  - Automatic focus on 1st digit box upon mount or tab switch.
  - Auto-advance on valid character; Backspace clearing and retreating; Clipboard paste splitting across all 5 boxes.
  - Zero-click auto-authentication triggered immediately on the 5th digit.
  - Error state triggers red ring (`border-rose-500 ring-rose-500/30`) and 500ms shake bounce animation.
- **Manager Form**:
  - Icon-prefixed input fields for Username (`User`) and Password (`Lock`).
  - Full-width gradient action button: "Sign In to Manager Portal" with `ArrowRight` icon.
- **POS Occupied Takeover Modal (`Modal maxWidth="md"`)**:
  - Title banner with active operator avatar and pulsating emerald live indicator (`animate-ping bg-emerald-400`).
  - Cashier Details: Operator Full Name, Username, Role badge (`Sales Executive` vs `Manager`).
  - Shift Metric Grid (4 cards): Started Time, Elapsed Duration, Sales Count, Live Drawer Cash.
  - Action Footer:
    - Secondary "Cancel" button (ghost/outline).
    - Primary "Take Over POS Terminal" button (solid blue gradient) initiating force-takeover shift closure.

### 11.2 Finalized POS Terminal & Checkout Flow
- **Layout Structure**: Single-screen, zero-scroll 2-column responsive layout with Fullscreen mode toggle (`Maximize` / `Minimize`).
- **Header Bar**:
  - Store brand icon and name.
  - Till status badge: "Shift Active" (`bg-emerald-500/10 text-emerald-400`) or "No Shift Open" (`bg-amber-500/10 text-amber-400`).
  - Operator identity pill with role and current shift sequence number.
  - Live AST digital clock (`Asia/Riyadh`) and shift elapsed timer.
  - Quick utility controls: Theme toggle (`Sun` / `Moon`), Font Scale toggle (`100%` / `110%`), and Fullscreen trigger.
- **Left Panel: Catalog, Produce Touch Grid & Fast PLU**:
  - Search field with `F2` keyboard shortcut pill.
  - Category horizontal filter pills with active selection pill.
  - Sorting pill bar: `Fast Moving` (default flame icon), `A-Z`, `Price Low-High`, `Price High-Low`.
  - Produce Quick PLU grid: High-visibility colorful icon tiles for non-barcoded fresh items (Bananas, Tomatoes, Cucumbers, Bakery items).
  - Product Cards: Crisp item name, SKU, price tag with SAR currency symbol, and color-coded stock level chip.
- **Right Panel: Cart & Financial Summary**:
  - Walk-in / Customer selector dropdown.
  - Cart line items list:
    - Product name, SKU / barcode, unit price.
    - Inline stepper controls: decrement (`Minus`), decimal quantity input for scale items, increment (`Plus`), and delete (`Trash2`).
    - Line discount tag and 15% VAT indicator badge.
    - Computed line subtotal.
  - Financial Summary Dock:
    - Subtotal (taxable base).
    - Total discounts applied.
    - Included VAT (15%).
    - Net Grand Total in prominent bold numerals (`text-2xl font-black text-white`).
  - Transaction Action Row:
    - `Hold (F4)`: Suspends current cart with optional note.
    - `Recall (F7)`: Opens held orders drawer.
    - `Clear`: Empties active cart.
    - `PAY / TENDER (F9)`: Opens the Tender Modal.
- **Tender Modal (`TenderModal`)**:
  - Payment Method switcher tabs: `Cash`, `Mada / Card`, `Split Tender`.
  - Quick Cash Presets: `Exact`, `50 SAR`, `100 SAR`, `200 SAR`, `500 SAR`.
  - Interactive touch keypad for fast cashier tender entry.
  - Change Due calculation: Real-time green callout showing change to return; blocks checkout if tender is insufficient.
  - Action button: "Complete Sale & Print Receipt" invoking silent ESC/POS 80mm thermal receipt generator.

### 11.3 Finalized Cash Drawer Shift & Reconciliation (`/cash`)
- **Till Occupancy Banner**: Real-time status card showing current till state (Active / Closed), operator name, shift sequence number, and elapsed time.
- **Daily Business Performance Strip**: Metric cards calculating gross sales, cash sales, card sales, expenses, and current drawer cash balance within the configured `shop_closing_hour` window.
- **Shift Opening Modal**:
  - Input fields for Cash Opening Float and Card Opening Float.
  - Suggested carry-forward card from previous shift closure.
  - Integrated touch number pad for physical till counting.
  - Opening variance/adjustment notes with reason logging.
- **Shift Closing & Blind Count Modal**:
  - Blind Physical Cash Count: Cashier inputs counted drawer cash without seeing expected numbers.
  - Card Settlement Slip Entry: Cashier inputs bank card terminal batch total.
  - Live Discrepancy Reconciliation: Calculates Cash Overage/Shortage and Card Discrepancy.
  - Closing adjustment ledger input for declared cashier explanations.
  - Action: "Close Shift & Print Z-Report".
- **Chronological Shifts Audit Table**:
  - Columns: Sequence #, Operator, Opened At, Closed At, Opening Float, Counted Cash, Card Total, Discrepancy, Status, and Actions.
  - Row Actions:
    - **Inspect (`FolderOpen`)**: Opens shift inspection slide-over with full breakdown of invoices, items sold, and payment methods.
    - **Print Z-Report (`Printer`)**: Instantly renders and prints certified 80mm thermal Z-Report via `printZReportDirectly`.
    - **Force Close (`ShieldAlert`)**: Manager-only action to close an abandoned shift with mandatory reason logging.

### 11.4 Finalized Product Catalog View (`/products`)
- **Toolbar & Filter Bar**:
  - Search input covering Name, SKU, Barcode, and PLU.
  - Category selector dropdown with product count indicators.
  - Filter Tabs: `All Products`, `Low Stock`, `Out of Stock`, `Perishables & Batches`.
  - Primary button: `+ Add Product` (Manager only).
- **Master Catalog Data Table**:
  - Columns: Product (thumbnail + name), SKU / Barcode, Category & Brand, Produce Scale / PLU badge, Stock Level (emerald/amber/rose pill), Base Cost (Manager only), Selling Price, and Actions.
  - Row Action Menu:
    - `Edit`: Opens Add/Edit Product Modal.
    - `Print Barcode Label`: Opens the Barcode Label Generator Modal pre-loaded with this product.
    - `Delete`: Soft-deletes product with confirmation safety gate.
- **Add / Edit Product Modal**:
  - Tabbed or structured form:
    - **Identity**: Name, SKU, Barcode, Category (with inline `+ Add Category` modal), Brand, Unit.
    - **Pricing**: Cost Price (WAC), Selling Price, Tax Rate, Tax Type (Inclusive/Exclusive).
    - **Super Shop Settings**: `is_weighable` toggle, `plu_code`, `is_quick_plu` toggle, `has_expiry` toggle.
    - **Media**: Drag-and-drop image upload with live client preview and thumbnail generation.

### 11.5 Finalized Barcode Label Generator Modal (`BarcodeLabelModal`)
- **Layout Architecture**: 2-column modal layout (`Modal maxWidth="4xl"`):
  - **Left Column: Live Thermal Sticker Preview**:
    - Scaled live sticker container matching chosen physical label dimensions.
    - Dynamic rendering of Store Name, Product Name, crisp vector SVG barcode, barcode numeric digits, formatted price, VAT badge, and SKU.
    - Updates in real-time as sliders and switches are toggled.
  - **Right Column: Hardware & Customization Controls**:
    - **Label Size Selector**: Dropdown supporting:
      1. `50mm × 25mm` (Standard Shelf / Sticker)
      2. `40mm × 30mm` (Compact Price Tag)
      3. `50mm × 30mm` (Retail Tag with Header)
      4. `38mm × 25mm` (Small / Pharmacy Tag)
      5. `60mm × 40mm` (Large / Carton Label)
    - **Print Copies Counter**: Number stepper automatically defaulted to product's `current_stock`.
    - **6 Modular Visual Toggles (2×3 Grid)**:
      1. `Show Title`
      2. `Show Barcode Number`
      3. `Show Shop Name`
      4. `Show Price`
      5. `Show VAT Badge`
      6. `Show SKU`
    - **3 Real-Time Fine-Tuning Sliders**:
      - `Title Font Size`: Range 8px to 18px (default 10px).
      - `Barcode Height`: Range 16px to 70px (default 30px).
      - `Barcode Width / Density`: Range 0.8 to 2.2 module width (default 1.35).
    - **Print Action Button**: Full-width button with `Printer` icon invoking browser print dialog with roll-fed thermal CSS rules.
- **Thermal Print Stylesheet (`@media print`)**:
  - Strict millimeter page sizing (`@page { size: 50mm 25mm; margin: 0; }`).
  - Hides modal backdrop, buttons, controls, and surrounding UI.
  - Roll-separated label output (`page-break-after: always; break-inside: avoid;`).

---

## 12. Interaction, Accessibility & Quality Gates

- Focus rings use the primary token and remain visible in both themes. Keyboard order follows the visual order; Escape closes non-destructive overlays; Enter submits only when focus/context makes it safe.
- Respect `prefers-reduced-motion`. Motion is limited to 150–200ms feedback transitions and never delays scanning, checkout, printing, or shift close.
- Every component has default, hover, focus-visible, active, disabled, loading, empty, error, and dark-theme coverage as relevant.
- Test the component library at both permitted scales (100% and 110%), in Light and Dark themes, with long English product names, large currency values, validation errors, and permission-restricted content.
- Component stories/tests must cover semantic markup, accessible names, contrast, keyboard operation, and visual regression. A page is not complete until it uses shared components rather than custom one-off styling.
