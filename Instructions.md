# Production Master Instructions: Shop & Inventory Management System

## 1. Project Context & Objectives

Design and architect a modern, production-ready Inventory Management + POS + Sales Management system for a single retail shop in Saudi Arabia. The system will be operated by only two fixed users: Manager and Sales Executive. There are NO branches, NO multi-company requirements, and NO warehouse network. Do not introduce unnecessary enterprise complexity.

The primary users are Bangladeshi shop employees working in Saudi Arabia, but ALL application navigation, labels, buttons, menus, forms, validation messages, and system terminology MUST be in clear professional ENGLISH. 

The system must be robust, reliable, easy to use, fast, audit-friendly, VAT/tax-ready, and suitable for real daily retail business operations.

### Documentation Authority

This document is the **single source of truth** for product scope, business rules, financial behaviour, security, data retention, and non-functional requirements. `SystemDesign.md` is the implementation guide and must reflect these requirements without redefining or weakening them. `DesignSystem.md` is the component-library contract for visual consistency; it must follow the product and access rules defined here. Where documents conflict, this file wins and the conflicting guide must be corrected before implementation.

**Core Objectives:**
- Accurate inventory tracking
- Fast POS processing
- Financial correctness and auditability
- Reliability (local-first architecture)
- Excellent UX with premium UI and animations

---

## 2. Technology Stack  

**Frontend:**
- Next.js (App Router preferred)
- React
- TypeScript
- Framer Motion (for premium micro-animations)
- Tailwind CSS

**Backend:**
- Node.js
- TypeScript
- Fastify or Express
- Zod (Schema-based runtime validation)

**Database & ORM:**
- PostgreSQL (Two-database architecture)
- Prisma or Drizzle ORM

**Media Processing:**
- Sharp (for image resizing and optimization)

**Deployment:**
- Docker and Docker Compose (Local/self-hosted environment)

---

## 3. User Roles & Permissions (RBAC)

Only two roles exist, with strict server-side authorization. Never rely only on hiding UI buttons.

### MANAGER (Full Access)
The Manager has complete control over the system.
**Can Do:**
- View the comprehensive dashboard
- Manage products (Create, Read, Update, Delete)
- Manage product categories and brands
- Manage suppliers and customers
- Create, modify, and delete purchases
- Manage inventory (view stock, perform manual adjustments)
- View all sales and transactions
- Cancel unissued sale drafts and issue post-sale credit/debit notes (with audit trail)
- Process sales and purchase returns
- Manage operating expenses
- Record customer and supplier payments
- View sensitive financial reports (Profit, COGS, VAT)
- View complete audit logs
- Manage Sales Executive access and permissions
- Configure shop, system, and tax/VAT settings
- Perform manual backup and restore operations

### SALES EXECUTIVE (Restricted Access)
The Sales Executive is restricted to operational tasks.
**Can Do:**
- Access and use the POS terminal
- Search products and scan barcodes
- Create sales transactions (Walk-in or registered customers)
- Receive payments from customers
- Generate and print invoices
- View permitted sales history (e.g., own sales for the day)
- Process permitted returns
- View product availability/stock levels
- View basic customer information

**MUST NOT Do:**
- Change purchase prices or historical selling prices
- Change system VAT/tax configuration
- Perform unrestricted/manual stock adjustments
- Delete products, categories, or financial records
- Modify historical transactions directly
- View sensitive profit, margin, or financial reports
- Manage system users or permissions
- Change critical system settings
- Delete or modify audit records

---

## 4. Application Modules

The system is organized into the following cohesive modules:
1. Dashboard (Real-time KPIs, Sales & Financial Analytics)
2. POS / Counter Sales (High-Speed Scanning, Split Pay, Quick Produce Grid)
3. Invoices & Receipts (ZATCA TLV QR, 80mm Thermal, A4 PDF)
4. Products & Catalog (Multi-image, Barcode generator, Packaging Units)
5. Batches & Expiry (Perishables tracking, FEFO, Expiry alerts)
6. Promotions & Deals (Buy X Get Y, Quantity Bundles, Time-based discounts)
7. Inventory (Stock Movement Ledger, Fast Stock Lookup, Audited Adjustments)
8. Purchases & Procurement (Receiving, Supplier Invoices, WAC Costing)
9. Suppliers (Accounts Payable & Vendor Ledger)
10. Customers (CRM, Credit Accounts & Accounts Receivable Ledger)
11. Expenses (Operating & Petty Cash management)
12. Returns (Sales & Purchase Returns with net discount recalculation)
13. Payments & Shift Registers (Float, Blind counts, Mada terminal reconciliation)
14. Reports & Analytics (P&L, ZATCA VAT, Inventory Valuation, Expiring Stock)
15. Audit Logs (Immutable security and transaction log)
16. System Settings & Customization (Shop profile, Dynamic Tax Rates, Currency, Hardware, Themes)
17. User & Permission Management (Manager vs Sales Executive RBAC)

---

## 5. Dashboard

The manager dashboard must calculate real-time metrics based on transactional data.

### TODAY'S METRICS
- **Total sales:** Number of items sold today
- **Gross sales:** Total monetary value before discounts/tax
- **Discounts:** Total discounts applied today
- **Returns:** Value of returned items today
- **Net sales:** Gross sales minus returns and discounts
- **Cost of goods sold (COGS):** Direct cost of products sold today
- **Gross profit:** Net sales minus COGS
- **Expenses:** Total operating expenses recorded today
- **Net profit:** Gross profit minus expenses
- **VAT collected:** Output VAT collected on sales today
- **VAT paid/input VAT:** Input VAT paid on purchases today
- **Net VAT position:** VAT collected minus VAT paid
- **Cash sales:** Value of sales paid in cash
- **Credit sales:** Value of sales put on customer accounts
- **Number of invoices:** Total invoices generated today

### INVENTORY & EXPIRY METRICS
- **Total products:** Count of distinct product SKUs
- **Total stock quantity:** Sum of all physical units in store
- **Total inventory value:** Value of current stock at purchase price
- **Low-stock products:** Products below minimum threshold
- **Out-of-stock products:** Products with zero stock
- **Expiring soon products:** Perishable items expiring in 7 / 15 / 30 days
- **Fast-moving products:** Top selling products by volume
- **Slow-moving products:** Products with no sales in 30+ days
- **Dead stock:** Products with no sales in 90+ days

### RECEIVABLES / PAYABLES
- **Customer outstanding:** Total money owed by customers
- **Supplier outstanding:** Total money owed to suppliers

### BUSINESS INSIGHTS
- **Today's sales vs previous day:** Percentage growth/decline
- **Monthly sales trend:** Line chart of daily sales for the current month
- **Top-selling products:** Bar chart of top 5 products
- **Top product categories:** Pie chart of sales by category
- **Recent transactions:** Feed of the last 10 activities

---

## 6. Product Management & Super Shop Extensions

Every product MUST support an image upload pipeline, barcode label generation, packaging conversions, batch/expiry capability, and variable-weight scale compatibility. Inventory is stored in a product's immutable **base unit** (for example, pieces or kilograms); purchase and sale package quantities are converted to that base unit and both quantities are retained on the source line for auditability.

### Image Pipeline Specifications:
- **Storage:** Host filesystem at `./data/uploads/products/` (persisted via Docker bind mount).
- **Processing:** Use Sharp. Generate a primary resized image (max 800x800) and a thumbnail (200x200).
- **Format:** Convert to WebP or optimized JPEG.
- **Serving:** Serve via a fast static file route (`/static/images/products/...` or `/api/v1/uploads/...`).
- **Data Model:** Products can have multiple images with one marked as primary (`product_images` table).
- **UI:** Show product images in POS product cards, catalog lists, and printed invoices.

### Barcode Label Generation & Printing:
- System provides a **Thermal Barcode Label Generator** (CODE128 standard).
- Allows printing sticky shelf/product labels formatted for 50x25mm and 40x30mm thermal label printers (e.g., Xprinter / Zebra).
- Label includes: Shop Name, Product Name, Selling Price (formatted in active currency with VAT indicator), Barcode vector, and SKU.

### Super Shop Extensions:
1. **Variable-Weight / Scale Barcode Parsing (Produce Weighing Scales):**
   - Built-in parser for weighing scale barcodes (EAN-13 prefixes `20`, `21`, `28`, `29`).
   - Format configurable in Settings: `PP IIIII WWWWW C` (Prefix 2-digits, Item PLU 5-digits, Weight in grams 5-digits, Checksum).
   - When scanned, automatically detects the item and populates the cart with exact fractional weight (e.g., `1.450 kg`).
2. **Batch & Expiry Date Management (Perishables Tracking):**
   - Products can be flagged as `has_expiry = true` (dairy, meats, bread, packaged grocery).
   - Purchase receiving captures Batch Number and Expiry Date.
   - POS follows FEFO (First Expired, First Out) deduction order.
   - Automated Manager notification for stock expiring within configured days (e.g., 7/15/30 days).
3. **Quick Keys / PLU Touch Grid (Loose Produce & Bakery):**
   - Products can be assigned to a "Fast PLU / Favorites" grid in the POS.
   - Allows instant one-touch addition of loose fruits, vegetables, and bakery items without barcodes.
4. **Promotion & Multi-Buy Engine:**
   - Supports promotional rules:
     - **Buy X Get Y Free** (e.g., Buy 2 get 1 free).
     - **Quantity Bundle Pricing** (e.g., 1 for 12 SAR, 3 for 30 SAR).
     - **Category/Cart Percentage Discount** during active campaign dates.

### Product Field List:
- **Product ID:** Internal auto-increment/UUID.
- **Product Name:** String, required.
- **SKU:** String, unique, required.
- **Barcode:** String, unique, optional.
- **PLU Code:** String/Number for scale lookup, optional.
- **Category ID:** Foreign key.
- **Brand ID:** Foreign key.
- **Unit ID:** Foreign key (e.g., Piece, Box, Kilogram, Gram, Liter).
- **Packaging Conversions:** A dedicated conversion definition with purchase/sale unit, base unit, multiplier, active status, and effective date. A product-level default multiplier is insufficient when the shop buys cartons but sells pieces or uses multiple pack sizes.
- **Cost Price (WAC):** Decimal(15,4), strict precision. Recalculated upon PO receipt.
- **Selling Price:** Decimal(15,4), strict precision.
- **Wholesale Price:** Decimal(15,4), optional.
- **Tax Rate ID & Tax Type:** Standard 15%, Zero-rated, or Exempt; Inclusive or Exclusive.
- **Min Stock Level:** Decimal(10,2) default 5.00.
- **Current Stock:** `DECIMAL(18,3)` in the product's base unit (or canonical integer grams/millilitres for variable-weight goods). It is a denormalized cached stock balance updated atomically alongside ledger inserts for instant POS queries.
- **Has Expiry / Perishable Flag:** Boolean.
- **Is Weighable / Scale Item:** Boolean.
- **Is Featured / Quick PLU Key:** Boolean.
- **Active/Inactive Status:** Boolean.
- **Created Date / Updated Date:** Timestamps.

Do not allow uncontrolled modification of historical purchase/sale prices. Current transactions capture the price at the time of the transaction.

---

## 7. Inventory System (Stock Ledger & Performance)

Use a strict **STOCK LEDGER / STOCK MOVEMENT** architecture. The system uses **perpetual weighted-average cost (WAC)**; FIFO is not in scope. Every stock movement has a source document, an idempotency/correlation key, and—when a product is batch-managed—a batch reference.
- The `products.current_stock` column is maintained atomically inside the same database transaction that records the movement.
- High-speed POS operations query `products.current_stock` directly (sub-millisecond indexed response).
- Full auditability is guaranteed by the append-only `stock_movements` ledger table.

### Movement Types:
- **Opening Stock:** Initial inventory load.
- **Purchase:** Stock increase from a supplier purchase.
- **Sale:** Stock decrease from a customer sale.
- **Customer Return:** Stock increase from a customer sales return.
- **Supplier Return:** Stock decrease from returning items to a supplier.
- **Damage:** Stock decrease due to damaged goods.
- **Loss:** Stock decrease due to theft or loss.
- **Stock Adjustment Increase:** Manual positive correction.
- **Stock Adjustment Decrease:** Manual negative correction.

### Stock Ledger Record:
- `id`: BIGSERIAL PRIMARY KEY
- `product_id`: INT REFERENCES products(id)
- `batch_id`: INT NULL REFERENCES product_batches(id). Required for batch-managed goods.
- `quantity_base`: DECIMAL(18,3) (Positive for IN, Negative for OUT, in the product base unit)
- `type`: Enum (movement types)
- `reference_id`: INT (sale_id, purchase_id, return_id)
- `reference_type`: VARCHAR(30) (sale, purchase, sales_return, purchase_return, adjustment — discriminator for tracing movements to source documents)
- `unit_cost`: DECIMAL(15,4) (Valuation at movement timestamp)
- `user_id`: INT REFERENCES users(id)
- `notes`: TEXT (Mandatory reason required for manual adjustments)
- `created_at`: TIMESTAMPTZ

For every sale of a batch-managed product, persist `sale_item_batch_allocations` (sale item, batch, base quantity, COGS unit cost). FEFO is performed while rows are locked, excluding expired and quarantined batches. A customer return either restores its original allocation to saleable stock or records a non-saleable damaged-return disposition with a separate write-off trail; it must never silently lose batch provenance.

Calculations must be concurrency-safe using `SELECT ... FOR UPDATE` row-level locking during checkout to completely prevent race conditions and overselling.

**Stock Reconciliation Job:** A nightly background job must compare `products.current_stock` against `SUM(quantity_base) FROM stock_movements WHERE product_id = ?` for every active product and repeat the check per batch. Any discrepancy is flagged via a Manager notification and logged. The job does NOT auto-correct — the Manager decides whether to issue a manual stock adjustment.

---

## 8. POS & Login UI Specifications (Production Final Design)

> [!IMPORTANT]
> **Production UI Finalization Contract**: The visual design, layouts, animations, and component structure of the **Login Screen (`/login`)** and **POS Terminal (`/pos`)** are **final, approved, and strictly locked**. No modifications to their visual design or styling should be made.

### 8.1 Finalized Login Screen Architecture
- **Theme & Atmosphere**: Ultra-premium Slate-950 dark background with subtle ambient blue/sky radial glow blurs.
- **Glassmorphism Card**: 420px max-width, 110% scale card with `backdrop-blur-2xl`, subtle border, shop brand header with Store icon and subtitle.
- **Dual Mode Role Tabs**:
  1. **Sales Executive (5-Digit Instant PIN)**:
     - Monospace PIN digit input boxes with active glow, backspace navigation, paste handling, and shake animation on failure.
     - **Zero-Click Auto-Authentication**: Automatically fires authentication upon entry of the 5th digit without needing a submit button.
     - Strict numeric input with `inputMode="numeric"` and `pattern="[0-9]*"`.
     - **Routes Directly to POS Terminal (`/pos`)** under the `sales_executive` operational role.
  2. **Store Manager (Credential Form)**:
     - Username and Password fields with standard spacious layout.
     - Gradient action button: "Sign In to Manager Portal".
     - **Routes Directly to Manager Portal & Dashboard (`/dashboard`)** with full management capabilities.
- **Strict Route Protection**: Unauthenticated direct access to any protected route (`/pos`, `/dashboard`, `/cash`, etc.) is immediately redirected to `/login` with an authentication loading gate.

### 8.2 Zero-Privilege POS & Manager Cashier Identity Architecture
> [!IMPORTANT]
> **Manager Never Operates POS Under Manager Role**:
> 1. To preserve financial audit integrity and separation of concerns, the POS counter operates under a **Zero-Privilege POS Principle**.
> 2. A Manager cannot ring up sales or operate a till under the unrestricted `manager` role.
> 3. To operate a POS terminal, the Manager **must log in via their 5-digit PIN as a Sales Executive**.
> 4. The resulting POS session is issued with effective role `sales_executive` and is treated **identically to any other Sales Executive session**:
>    - A dedicated physical cash drawer shift is registered in `cash_sessions`.
>    - All sales, receipts, and line-item taxes commit under their cashier till context.
>    - At shift conclusion, the Manager performs a blind physical cash count, card terminal batch settlement entry, and generates the certified shift Z-Report.
>    - If a user logged in with manager password navigates to `/pos`, the terminal enforces PIN verification to activate the Sales Executive till session.

### 8.3 Finalized POS Terminal Architecture
- **Dense High-Volume Layout**: Designed for single-screen checkout without scrolling.
  - **Left Header**: Shop branding, Sales Executive badge, Terminal ID, Live AST clock, and active session timer.
  - **Left Catalog Grid**: Fast-moving items priority sort, search filter (F2), visual barcode & PLU produce badges, category chips, unit price tags, and inventory stock indicators.
  - **Right Cart Panel**: Customer selector, cart item cards with fractional/integer quantity steppers (+ / -), item discounts, tax badges, line totals, and instant remove.
  - **Bottom Financial Bar**: Gross Subtotal, Promo/Item Discount, 15% Included VAT, Net Grand Total, and primary action buttons (`Hold (F4)`, `Recall (F7)`, `Clear`, `PAY (F9)`).
- **Produce Scale Barcode Parser**: Ingests prefix 20-29 barcodes to extract item PLU and fractional weight.
- **Hardware Integration**: Instant audio beep feedback on scan, ESC/POS 80mm receipt generator with ZATCA Phase-1 TLV QR code, and optional RJ11 cash drawer pulse.

### 8.4 POS Keyboard Shortcuts:
- `F2`: Focus Barcode Search / Scanner Input
- `F4`: Hold / Suspend Current Order
- `F7`: Retrieve Parked / Held Sales
- `F8`: Manual Cash Drawer Pulse Kick (Audited)
- `F9` / `Ctrl+Space`: Open Payment / Tender Modal
- `Enter` (in Payment Modal): Finalize Sale & Print Receipt
- `ESC`: Close active modals / clear search

---

## 9. Daily Shop Closing Hour, Multi-Terminal Cash Drawer & Reconciliation

### 9.1 Daily Business Day Architecture & Shop Closing Hour
Retail supermarkets frequently operate across midnight. The system utilizes a customizable **Daily Shop Closing Hour** (`shop_closing_hour`, default `00:00` / 12:00 AM) configured by the Manager in Settings.

For any business date $D$ and closing hour $H_{\text{close}}$ (HH:MM):
$$\text{Business Day Start} = D\text{ at }H_{\text{close}}$$
$$\text{Business Day End} = (D + 1\text{ day})\text{ at }H_{\text{close}}$$

- When $H_{\text{close}} = \text{'00:00'}$, the business day corresponds to 00:00:00 to 23:59:59.999.
- When $H_{\text{close}} = \text{'02:00'}$, transactions occurring between 00:00:00 and 01:59:59 belong to the previous calendar day's business records.
- All Dashboard KPIs, Sales Trends, VAT reports, and Cash Drawer shift summaries cycle dynamically according to this business day window.

### 9.2 Cash Drawer Calculation & Reconciliation Model
In store operations:

1. **Per-Shift Cash Drawer Formula**:
   $$\text{Expected Cash} = \text{Opening Float} + \text{Cash Sales} - \text{Cash Returns} - \text{Cash Deductions/Expenses} + \text{Cash In (excluding float)}$$
   *Note on Ledger Precision*: When recording an opening float into the `cash_movements` ledger as an initial `cash_in`, the operational expected cash calculation must never double-count the float. The formula strictly evaluates $\text{Opening Float} + \text{Operational Net Cash Flow}$.

2. **Dual Floats & Electronic Card Settlement**:
   - Both **Cash Drawer Float** (`opening_balance`) and **Card Float** (`opening_card_balance`) are tracked upon shift opening.
   - At shift close:
     $$\text{Terminal Card Expected} = \sum \text{Mada/Credit Card payments during shift}$$
   - Cashiers reconcile by printing the bank POS card machine batch settlement slip and entering the slip total (`terminal_card_total`). Discrepancy is $\text{terminal\_card\_total} - \text{terminal\_card\_expected}$. Electronic card balances settle with the bank, while drawer cash carries forward to the next session.

3. **Single POS Counter Architecture (Single-Terminal)**:
   - The shop operates a single physical checkout counter. There are NO multiple terminals and NO Terminal IDs.
   - Exactly one POS counter session may be active globally (`uq_single_open_cash_session`).
   - Sessions are linked sequentially via `sequence_number` and `previous_session_id`.
   - The verified closing cash and card totals of the preceding shift automatically serve as suggested carry-forward balances for the incoming shift.

4. **POS Operator Takeover Protocol**:
   - If a cashier attempts to log in via 5-digit PIN while another cashier's session remains open, the system responds with `POS_OCCUPIED` and presents an interactive takeover confirmation showing the active operator's identity, elapsed shift time, and live drawer cash.
   - Upon confirming takeover, the displaced session is automatically closed with `close_type = 'takeover'`, its POS session token is revoked via WebSocket broadcast (`SESSION_SUPERSEDED`), and the incoming cashier activates their shift.

5. **Discrepancy Adjustments Ledger (`session_adjustments`)**:
   - Cashiers can record declared explanations for variances during shift opening and closing.
   - Adjustments are persisted in the append-only `session_adjustments` ledger with a database trigger prohibiting mutations or deletions (`trg_session_adjustments_no_update_delete`).

6. **Manager Cash Oversight Center (`/cash`)**:
   - In accordance with Section 8.2 (Zero-Privilege POS), the Manager does not open, operate, or terminate cashier tills from the Manager Portal. POS sessions must be closed directly at the checkout counter.
   - The `/cash` section provides managerial oversight: real-time till occupancy, store-wide daily business metrics, timeline-based chronological shift audit trails, and deep inspection modal with dynamic invoice-level view (including all sales, payments, and line items).
   - Managers can export daily business day records as **CSV** or print the consolidated **Daily Z-Report** with a single click. All toolbar buttons and controls maintain a strict uniform height (`h-10`).

---

## 10. Invoice System

### Invoice Field List:
- **Invoice Number:** Sequential, formatted string (e.g., `INV-2026-0001`).
- **Invoice Date/Time:** Timestamp (stored in UTC, rendered in `Asia/Riyadh` AST).
- **Shop Information:** Name, Address, CR Number, VAT Number.
- **Customer Information:** Name, Phone, VAT Number (for B2B simplified/tax invoices).
- **Seller/User ID:** Foreign key.
- **Product Line Items:** Array of objects (Product ID, Name, SKU, Qty, Unit Price, Line Discount, Net Unit Price, Taxable Amount, VAT Rate, VAT Amount, Line Total).
- **Subtotal (Gross):** Decimal(15,4).
- **Total Invoice Discount:** Decimal(15,4).
- **Total Taxable Amount (Net):** Decimal(15,4).
- **Total VAT:** Decimal(15,4).
- **Grand Total (SAR):** Decimal(15,4) -> Rounded to 2 decimal places (`Half-Up`).
- **Paid Amount:** Decimal(15,4).
- **Due Amount:** Decimal(15,4).
- **Payment Methods Used:** Array of { payment_method_id, amount, reference }.
- **Legal Snapshot:** Invoice type/subtype, seller/buyer legal fields, currency snapshot, configuration version, issue sequence/counter, previous hash reference, canonical document payload, and lifecycle/audit status.

### Invoice Discount Distribution & Rounding:
The tax engine must first determine whether each line's entered price is tax-exclusive or tax-inclusive. It distributes an invoice discount proportionally over the post-item-discount line amount, at four-decimal internal precision. Any final halalah residual is assigned deterministically (largest remainder, then stable line-ID order) and stored as `rounding_adjustment`; the sum of persisted lines must always equal the persisted invoice total.

For a tax-exclusive line, after discounts:
$$\text{Taxable}_i = \text{ExclusiveLineAmount}_i - \text{Discount}_i$$
$$\text{VAT}_i = \text{Taxable}_i \times \left( \frac{\text{VAT Rate}_i}{100} \right)$$

For a tax-inclusive line, after discounts:
$$\text{GrossAfterDiscount}_i = \text{InclusiveLineAmount}_i - \text{Discount}_i$$
$$\text{Taxable}_i = \frac{\text{GrossAfterDiscount}_i}{1 + \frac{\text{VAT Rate}_i}{100}}$$
$$\text{VAT}_i = \text{GrossAfterDiscount}_i - \text{Taxable}_i$$

Persist the entered price, tax mode, allocated discounts, taxable amount, VAT amount, rounded amount, and promotion source on every line. Cover mixed standard, zero-rated, and exempt baskets with golden test cases.

### Partial Return Discount Adjustment:
When a customer returns a single item from a multi-item discounted sale, the refund is calculated on the **net allocated amount** ($\text{Taxable}_i + \text{VAT}_i$) that the customer actually paid for that specific item, preventing financial over-refunds.

### 80mm Thermal Receipt Layout (ASCII):
```text
========================================
             MY SHOP NAME
         Riyadh, Saudi Arabia
         CR: 1010123456 | VAT: 300123456789012
========================================
Inv No: INV-2026-0001
Date  : 2026-08-30 14:20:00 AST
Cashier: Ahmed
Customer: Walk-in
========================================
Item          Qty    Price     Total
----------------------------------------
Product A       1    100.00   100.00
Product B       2     75.00   150.00
----------------------------------------
Subtotal (Gross)          :   250.00
Invoice Discount          :    10.00
Taxable Subtotal          :   240.00
VAT (15% Standard Rate)   :    36.00
----------------------------------------
GRAND TOTAL (SAR)         :   276.00
========================================
Paid (Mada / Card)        :   276.00
Due Amount                :     0.00
========================================
         [ ZATCA TLV QR CODE ]
         (Scan via ZATCA App)
========================================
     Thank you for your business!
========================================
```

---

## 11. VAT/Tax Architecture & Financial Precision (Saudi Arabia)

### Strict Financial Precision & Rounding Policy:
1. **Internal Storage:** All financial calculations, unit prices, costs, and ledgers use `DECIMAL(15,4)` in PostgreSQL. NEVER use JavaScript IEEE-754 binary floating-point numbers.
2. **Rounding Rule:** Standard **Round Half-Up** to 2 decimal places for all customer-facing invoices, receipts, and ledger balances. Line items are calculated at 4 decimal precision and summed before final rounding to avoid 1-halala cumulative rounding errors.
3. **VAT Configuration:**
   - **Input VAT:** VAT paid on purchases from suppliers (claimable tax).
   - **Output VAT:** VAT collected on sales to customers (payable tax).
   - **Tax-exclusive Formula:**
     $$\text{Tax Amount} = \text{Taxable Amount} \times \left( \frac{\text{VAT Rate}}{100} \right)$$
     $$\text{Total} = \text{Taxable Amount} + \text{Tax Amount}$$
   - **Tax-inclusive Formula:**
     $$\text{Base Price} = \frac{\text{Gross Price}}{1 + \left( \frac{\text{VAT Rate}}{100} \right)}$$
     $$\text{Tax Amount} = \text{Gross Price} - \text{Base Price}$$
4. **Historical Immutability:** Store all tax values (rate and calculated amounts) at the transaction row level so changes to system configuration do not modify historical invoices.

---

## 12. E-Invoicing Readiness (ZATCA)

ZATCA is a legal-compliance workstream, not a future placeholder. Before go-live, validate the shop's taxpayer obligations and current technical rules with a Saudi tax/legal specialist and the current ZATCA developer materials.

The document model must support tax invoices, simplified tax invoices, and their credit/debit notes. An issued document is immutable: a draft may be cancelled, but a post-issue correction, return, or price change creates a linked credit/debit note rather than editing or deleting the invoice.

Required persisted data includes:
- **UUID and invoice counter:** Unique per issued document and sequence scope.
- **Canonical UBL/XML payload and human-readable rendering:** Generated from the same immutable source, retained with validation results and archival filename.
- **Cryptographic fields:** Previous invoice hash, invoice hash, signature/cryptographic-stamp artefacts where applicable, QR payload, and certificate/key reference (never the private key itself).
- **Lifecycle:** Draft, issued, reported, cleared, rejected, credit/debit-note-issued; each transition has timestamp, correlation ID, request/response metadata, and retry policy.
- **Legal snapshots:** Seller, buyer, VAT registrations, invoice type/subtype, currency, tax fields, and configuration version.

The five-field TLV QR is only a Phase-1-sized QR encoder; it does not implement integration-phase signing, XML validation, clearance/reporting, or ZATCA acceptance. Use the official rules and SDK in release validation. English remains the application language, but legal invoice/receipt templates must support Arabic alongside English wherever the current regulation requires it.

---

## 13. Purchase Management

### Purchase Record Fields:
- **Purchase ID:** UUID.
- **Supplier ID:** Foreign key.
- **Supplier Invoice Number:** String (from the supplier's paper receipt).
- **Purchase Date:** Date.
- **Line Items:** Array (Product, Qty, Purchase Price, Discount, Taxable Amount, VAT, Total).
- **Subtotal:** Decimal.
- **Discount:** Decimal.
- **Taxable Amount:** Decimal.
- **VAT Amount:** Decimal.
- **Grand Total:** Decimal.
- **Amount Paid:** Decimal.
- **Amount Due:** Decimal.
- **Payment Method:** Enum.
- **Created By:** User ID.

Purchases must trigger atomic inventory increases. For WAC, each receipt line records the base quantity and an **effective net unit cost**: item cost after discounts plus its deterministic allocation of freight/other landed costs; recoverable input VAT is not added to inventory cost. Supplier returns remove the original source cost/batch where known, never an arbitrary current selling price.

---

## 14. Supplier Management

**Profile:** Name, Phone, Email, Address, Tax/VAT number, Notes, Status.
**Supplier Ledger:** Tracks Purchases (increases due), Payments (decreases due), Returns (decreases due), and Current Outstanding Balance.

---

## 15. Customer Management & Credit/Due

**Profile:** Name, Phone, Email, Address, Tax/VAT number.
Do not force creation for cash sales (use Walk-in).

**Customer Ledger & Credit Example:**
1. Invoice #101 created for `1000 SAR`. Customer pays `600 SAR` cash.
   - Ledger: Invoice +1000, Payment -600. Current Due: `400 SAR`.
2. Customer returns a `100 SAR` item.
   - Ledger: Return -100. Current Due: `300 SAR`.
3. Customer makes a payment of `300 SAR`.
   - Ledger: Payment -300. Current Due: `0 SAR`.

---

## 16. Returns (Sales & Purchase)

**Sales Return:** Link to original invoice, select products, set returned quantity, condition, and reason. Prevent a total return quantity greater than the original sold quantity across all prior returns. Process refunds through one or more refund allocations (cash/card/bank/customer credit), preserving the original terminal reference where a card refund is used. The return issues the linked legal credit note, reverses VAT, and restores only saleable goods to the original batch; damaged goods use a non-saleable disposition and documented write-off.
**Purchase Return:** Link to original purchase, select items. Decrease inventory, adjust supplier balance, and adjust VAT input.

---

## 17. Expense Management

Track shop operating expenses (Rent, Electricity, Internet, Salary, Maintenance).
**Fields:** Expense ID, Category, Amount, VAT (if applicable), Date, Payment Method, Description, Receipt Attachment URL, Created By.
These deduct from Gross Profit to calculate Net Profit.

---

## 18. Profit Calculation & COGS

Use **perpetual Weighted Average Cost (WAC)** consistently for inventory valuation and COGS. The COGS cost is snapshotted on each sale line and batch allocation. Customer returns reverse that original cost; stock adjustments and damage require a documented valuation policy and Manager reason.
- Net Sales = Gross Sales - Returns - Discounts.
- COGS = Total cost of the items sold during the period (based on purchase prices).
- Gross Profit = Net Sales - COGS.
- Net Profit = Gross Profit - Operating Expenses.

---

## 19. Cash Management

Cash register/session tracking is mandatory for every POS register that accepts cash or card. A register cannot have more than one open shift, and all tender, change, cash in/out, expense, refund, and terminal settlement entries are tied to its session. The server computes expected amounts; the blind-count screen may not reveal them before submission.
**Example Session:**
- `09:00 AM`: Session Open. Opening Cash: `1000 SAR`.
- During day: Cash Sales `+5000 SAR`, Cash Expenses `-300 SAR`, Cash Refunds `-200 SAR`.
- Expected Closing Cash: `1000 + 5000 - 300 - 200 = 5500 SAR`.
- `09:00 PM`: Session Close. Actual Cash Counted: `5480 SAR`.
- Difference: `-20 SAR` (Cash Shortage). Requires reason/notes.

---

## 20. Reports

### SALES REPORTS
- Daily/Weekly/Monthly Sales Summary
- Sales by Date Range (Custom)
- Sales by Product/Category
- Sales by User (Cashier performance)
- Sales by Customer
- Sales by Payment Method

### INVENTORY REPORTS
- Current Stock & Valuation
- Stock Movement History
- Low Stock / Out of Stock
- Fast-Moving / Slow-Moving / Dead Stock

### PURCHASE & SUPPLIER REPORTS
- Purchase Summary by Date
- Purchases by Supplier
- Supplier Payables & Aging

### FINANCIAL & CASH REPORTS
- Profit & Loss Statement (Revenue, COGS, Gross/Net Profit, Expenses)
- Customer Receivables & Aging
- Daily Cash Register Summary

### VAT REPORTS
- Output VAT (Sales)
- Input VAT (Purchases)
- VAT Summary for Filing Period (Taxable sales, Exempt sales, Net VAT position)

---

## 21. Audit Logging

Robust, append-only system enforced at the database level—not merely by hidden UI controls. The application role cannot update or delete audit rows; privileged maintenance access is segregated, logged, and break-glass controlled.
**Audited Actions:** Login, Logout, Product Create/Update, Price Change, Purchase Create, Sale Create, Invoice Void, Sale/Purchase Return, Stock Adjustment, Expense Create, Customer/Supplier Payment, System Setting/Permission Change.
**Audit Fields:** Record ID, nullable User ID (to retain failed login attempts), Action Type, Entity Name (e.g., 'Product'), Entity ID, Previous Value (JSON), New Value (JSON), Timestamp, mandatory reason for controlled actions, IP Address/Device Info, request/correlation ID, and actor/session context. Never write passwords, PINs, tokens, or plaintext card data to audit payloads.

---

### 22. Multi-Terminal LAN Architecture & WebSocket State Catchup

Multiple devices connect via shop WiFi to the main Server PC (running Docker Compose behind an Nginx Reverse Proxy).

**Topology Diagram:**
```text
[ WiFi Router (192.168.1.1) ]
      |
      +--- [ Server PC (Nginx :80 -> Next.js :3000 | Fastify :5000 | Postgres :5432) ] (IP: 192.168.1.100)
      |
      +--- [ POS Terminal 1 (Browser) ] (IP: 192.168.1.101)
      |
      +--- [ POS Tablet 2 (Browser) ]   (IP: 192.168.1.102)
      |
      +--- [ Manager Laptop (Browser) ] (IP: 192.168.1.103)
```

**Real-Time WebSocket Events:**
- `STOCK_UPDATED`: Broadcasts product ID, delta quantity, and new `current_stock` when any terminal completes a sale, purchase, or adjustment.
- `NEW_SALE`: Live sales event updating the Manager Dashboard KPIs and shift totals.
- `CASH_DRAWER_EVENT`: Manual drawer kick or float addition notification.
- `SYSTEM_ALERT`: Broadcasts low stock warnings, backup failure alerts, or power recovery notices.

Events are written to a transactional outbox in the same database transaction as the source change, then published only after commit. Each event has a monotonic sequence number, so missed events can be detected and replayed safely.

**State Catchup & WiFi Reconnection Protocol:**
If a tablet or counter PC temporarily loses WiFi connection:
1. The WebSocket client automatically attempts reconnection with exponential backoff (1s, 2s, 5s, 10s max).
2. Upon reconnecting, the POS client immediately calls `GET /api/v1/inventory/stock-snapshot?after=<last_event_sequence>`.
3. The server responds with ordered deltas or a mandatory full snapshot if the cursor has expired. The client refreshes its display, but checkout always performs the authoritative server-side locked stock check.

---

## 23. Data Persistence & Docker Strategy

ALL business data is persisted outside containers. The production baseline is a Linux server with an encrypted ext4 data disk; Docker Desktop/Windows bind mounts are UAT/development only because the database must not depend on desktop virtualization or NTFS file semantics in production. No data lives exclusively inside container layers:
- Primary PostgreSQL live data: `./data/postgres_live/`
- Recovery DB standby data: `./data/postgres_recovery/`
- Product Images & Attachments: `./data/uploads/`
- Encrypted Backup Snapshots: `./backups/`
- Application & Nginx Access Logs: `./data/logs/` (with 14-day automatic rotation)

Deleting, recreating, or rebuilding Docker containers (`docker compose down && docker compose up --build`) results in **ZERO DATA LOSS**.

---

## 24. Two-Database Backup, Encryption & Automated Test Restoration

**Architecture (LIVE DATA != BACKUP DATA):**
- **Live DB (DB1):** Primary PostgreSQL 16+ instance executing real-time POS and inventory transactions.
- **Recovery Sandbox DB (DB2):** Isolated PostgreSQL instance used specifically for automated test restores. It is not high availability because it shares the local server failure domain.

The business defines and tests an explicit Recovery Point Objective (RPO) and Recovery Time Objective (RTO). A UPS provides graceful shutdown time; the local vault, WAL archive, and off-site object storage are separate failure domains.

**Automated Backup & Test Restore Process:**
1. **Scheduled Snapshot:** Node.js backup worker triggers `pg_dump -Fc -Z 9` at 01:00 AM AST.
2. **Encryption:** Dump is encrypted locally with **AES-256-GCM** using the shop's master key, producing a `.enc` snapshot and `.sha256` checksum.
3. **Automated Test Restore Verification:**
   - Worker decrypts and loads the dump into `postgres_recovery` (DB2).
   - Runs schema migration validation, integrity checks, key report total checks, batch-stock reconciliation, and sampled document rendering—not only table/row counts.
   - Logs result into `backup_logs`: `verification_status = 'verified'` or `'failed'`, with `verified_at` and `restored_row_count`.
4. **Non-blocking Cloud Upload:** Transmits verified encrypted snapshot to AWS S3 / Cloudflare R2 if internet is available; queues safely if offline.

**Retention Policy:** Daily (14 backups), Weekly (8 backups), Monthly (12 backups).

**Filesystem Backup:** In addition to database dumps, the backup worker must archive `./data/uploads/` (product images, expense attachments) into the encrypted backup artifact. Restore procedures must restore both the database and uploaded files.

**Encryption Key Security:** Every AES-256-GCM artifact has a unique nonce and stored authentication tag. The runtime key is loaded through a protected deployment secret; a recovery copy is printed on paper and stored in the shop's physical safe. Never store the recovery key with backup artifacts. Without the key, encrypted backups are irrecoverable.

---

## 25. Disaster Recovery Playbook

| Failure Scenario | Safeguard / Recovery Procedure |
| --- | --- |
| 1. Internet unavailable | Core POS operates normally (Local-first). Sync pauses. |
| 2. Node.js crashes | Docker `restart: always` brings it back instantly. |
| 3. PostgreSQL crashes | Docker restarts it; Postgres performs internal WAL crash recovery. |
| 4. Server PC crashes | Reboot PC; `start-shop.bat` auto-starts containers. |
| 5. Server SSD fails | Rebuild server; pull latest AES encrypted backup from S3, run restore script. |
| 6. Database corruption | Drop live DB, restore from the last hourly/daily verified local backup. |
| 7. Accidental record deletion | Soft-deletion prevents permanent loss. Manager restores from UI. |
| 8. Incorrect stock adjust | Audit log tracks user/time. Issue a reverse stock adjustment. |
| 9. Power failure | PC reboots. Docker auto-starts. Unfinished DB transactions are automatically rolled back by Postgres. |
| 10. Backup upload fails | Worker logs error, alerts manager, retries on next cron tick. |
| 11. Remote S3 unavailable | Local backups continue safely until S3 returns. |
| 12. Router failure | Replace router, assign same static IP to Server PC, terminals reconnect. |

---

## 26. Security & Reverse Proxy

**Security Checklist:**
- **Nginx Reverse Proxy:** Unified entry point on port 80/443. Eliminates CORS issues across shop LAN, handles WebSocket connection upgrades (`proxy_set_header Upgrade $http_upgrade`), and proxies `/api` and `/` cleanly.
- **Password Hashing:** Argon2 or bcrypt with high work factor (cost 12).
- **Sessions & CSRF:** Use short-lived, revocable server-side sessions or rotated JWTs in `HttpOnly`, `Secure`, `SameSite=Strict` cookies. Enforce HTTPS on the LAN. Protect every cookie-authenticated mutation with Origin/Referer validation plus a synchronizer or double-submit CSRF token; `X-Requested-With` is not CSRF protection.
- **PIN Authorization:** Store Manager PINs only as Argon2 hashes. A 4-6 digit Manager PIN is used only as a short-lived, single-use step-up approval for sales returns, draft cancellation, price override, and drawer kick. Five failed attempts trigger a 10-minute lockout; PINs and approval tokens never enter logs.
- **Hardware Gateway:** A receipt-print request contains an authorized issued-document ID, not arbitrary ESC/POS bytes. Drawer kicks require a verified Manager approval or an approved cash-sale event. USB-attached printers require a trusted local print agent; server-attached/network printers use an allow-listed register configuration.
- **Rate Limiting:** Fastify `@fastify/rate-limit` restricting auth endpoints (max 10 req/min per IP).
- **Parameterized SQL:** Parameterized SQL queries (ORM) to prevent SQL Injection.
- **Server-side RBAC:** Authorization middleware checked on EVERY endpoint.
- **Sanitization:** Strict runtime validation using Zod schemas.
- **Docker Log Rotation:** Enforced `max-size: "50m"` and `max-file: "5"` in Docker compose to prevent disk exhaustion.

---

## 27. Offline-First Operations

The core application operates primarily locally. Internet is ONLY required for remote backups, external API integrations, or remote manager access (if configured via VPN/Tunnel). Local authentication, database access, POS, inventory, and reporting must operate with no internet connection.

The central LAN server remains authoritative. If a browser loses WiFi/server connectivity, it may retain and display a cart but must enter reconnect/read-only mode and cannot finalize, print, or queue a sale. A future terminal-offline mode requires a separately designed encrypted local queue, conflict rules, payment constraints, and reconciliation workflow; it is not implied by browser caching.

---

## 28. Performance

- **Database:** Ensure indexes on foreign keys, frequently searched text (SKU, Name), and timestamp columns used in reporting.
- **Queries:** Strictly avoid N+1 query problems. Use joins or batched queries.
- **UI:** Debounced search inputs (300ms). Pagination for tables with > 50 rows.
- **POS:** Must respond instantly. Cache static product data (prices, names) locally in the browser/React state during the active POS session, refreshing asynchronously.

---

## 29. Error Handling

Errors must be precise and user-friendly. 
- Validation errors map to specific form fields.
- Transaction errors ("Insufficient stock for Product A") shown as clear toasts.
- Network/Connectivity errors clearly state "Trying to reconnect...".
Use structured JSON logging (Winston/Pino) on the backend for debugging.

---

## 30. Premium UI & Animations

Utilize **Framer Motion** for a premium feel:
- **Page Transitions:** `fadeInUp` (200ms) when navigating modules.
- **Card Entrance:** Staggered `fadeIn` for dashboard metrics and product grids.
- **Modals:** `scaleIn` (0.95 -> 1.0) with a subtle backdrop blur.
- **Number Counters:** Animated count-up for dashboard KPIs (e.g., 0 to 5,000 SAR).
- **Charts:** Smooth entrance animations for bars and lines.
- **Loading:** Shimmering skeleton pulse instead of generic spinners.
- **Toasts:** Slide-in from bottom right.
Animations must be professional, snappy (150-300ms), and never delay user workflows.

---

## 31. Day/Night Theme & UI Customization

Full dark and light mode support with high-contrast optimization for retail counter environments:
- **Theme Modes:** Light and Dark only. The selected theme persists per user and applies before interactive hydration, with no layout shift. System-auto mode is not included.
- **UI Scale:** Only `100% Standard` (default) and `110% Comfortable` are supported. All components must remain legible, keyboard-usable, and touch-safe at both scales.
- **Theme Palette:** Uses semantic design tokens defined in `DesignSystem.md`; components never use one-off page colors or assume a light background.
- **Visual Restraint:** Each page shows only labels that add meaning. Prefer a strong page title, clear field labels, concise helper/error text, and contextual icons/tooltips over repeated headings, duplicate legends, decorative badges, or instructional paragraphs.
- **POS Density:** A single comfortable density is the default; compact layouts may rearrange grids for constrained screens but may not reduce touch targets or text below the design-system minimum.

---

## 32. Real-Time Notifications

Global UI notification center (bell icon) alerting the Manager to:
- Products falling below minimum stock threshold.
- Products expiring within 7, 15, or 30 days.
- Unusually large single sales (e.g., > 10,000 SAR).
- Cash drawer closing with discrepancies > 50 SAR.
- Automated backup job failures or pending cloud sync.
- High disk usage or DB health warnings.

---

## 33. Search & UX

- **Global Search:** Shortcut (Ctrl+K) to open a command palette for searching Products, Customers, Invoices, and navigating the app.
- **UX Principles:** Minimal clicks. Confirm destructive actions via dialog. Provide clear success feedback. Handle empty states gracefully with illustrations and "Create New" CTAs.

---

## 34. Complete UI-Driven Customization & Settings Management

Managers can manage settings through a clean UI without code modifications or server restarts. Appearance settings apply immediately; operational settings require confirmation and an audit reason; legal/financial/security settings require Manager step-up authentication, a reason, versioning, and an effective date. They never alter already-issued invoices, payments, ledgers, or tax reports.

### 1. Shop Profile & Branding Settings:
- **Shop Name:** English and Arabic business names.
- **Legal Identifiers:** Commercial Registration (CR) Number, VAT Registration Number.
- **Contact & Address:** Street, City, State, Country, Phone Numbers, Email, Postal Code.
- **Shop Logo:** Drag-and-drop image uploader (WebP/PNG) displayed on the top navigation bar and receipts.
- **Receipt Customization:** Customizable header greeting, footer return policy text (e.g., "Goods returned within 7 days with invoice"), social handles/QR link.

### 2. Dynamic VAT / Tax Configuration:
- **Tax Rates CRUD:** Ability to create and activate effective-dated tax rates (e.g., 15.00% Standard, 5.00%, 0.00% Zero-Rated, Exempt). A rate used in historical documents is retired, not overwritten or deleted.
- **Default Tax Rate:** Selectable fallback tax rate for new products.
- **Tax Calculation Mode:** System-wide or per-item default for Tax Inclusive (price includes VAT) vs Tax Exclusive (VAT added at checkout).
- **Tax Labels:** Customizable tax identification names (e.g., "VAT", "Tax", "ضريبة القيمة المضافة").

### 3. Currency, Numbers & Regional Locale:
- **Currency Code:** SAR is the legal shop currency by default. A future change is a legal/financial configuration version with explicit business approval; every posted document retains its original currency snapshot.
- **Currency Symbol:** Configurable symbol or abbreviation (e.g., `SAR`, `ر.س`, `$`, `৳`, `€`).
- **Currency Symbol Position:** `Before Amount` ($ 100.00) or `After Amount` (100.00 SAR).
- **Decimal Precision:** Configurable 2 or 3 decimal places for customer display (internal calculations strictly retain 4 decimals).
- **Number Separators:** Decimal separator (`.` or `,`) and thousand grouping separator (`,`, `.`, space, or none).
- **Timezone & Date Format:** Application-level timezone dropdown (default `Asia/Riyadh`) and date format picker (`YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`).

### 4. POS & Peripheral Hardware Settings:
- **Produce Scale Barcode Config:** Variable-weight barcode prefix (e.g., `20`, `21`), PLU length, and decimal divisor.
- **Receipt Printing Mode:** Direct ESC/POS thermal printing (raw network/USB) vs Browser Print Dialog.
- **Cash Drawer Kick:** Auto-pulse RJ11 drawer kick on cash sale completion (Enabled/Disabled).
- **Barcode Scanner Audio:** Beep sound effect on successful product scan (Enabled/Disabled).
- **Negative Stock Policy:** Default deny. Any temporary Manager-authorized override is a per-transaction exception with a reason and audit record, never a silent global toggle during an open shift.
- **Quick Tender Presets:** Configurable 5 quick cash amount buttons in payment modal.

---

## 35. Database Design

**Core Entities (35+):**
1. `users` (with `user_role_enum`: manager, sales_executive).
2. `products`, `categories`, `brands`, `units`, `tax_rates`, `product_images`.
3. `product_batches`, `sale_item_batch_allocations`, and package/unit conversion definitions (batch provenance, FEFO, expiry, base-unit quantities, and COGS allocations).
4. `promotions`, `promotion_rules` (Buy X Get Y, bundle discounts, date ranges).
5. `suppliers`, `customers`.
6. `registers`, `cash_sessions`, `sales`, `sale_items`, `sale_payments`, and refund allocations.
7. `purchases`, `purchase_items`, `purchase_payments`.
8. `stock_movements`, `stock_adjustments`.
9. `sales_returns`, `sales_return_items`.
10. `purchase_returns`, `purchase_return_items`.
11. `expenses`, `expense_categories`.
12. `invoices` (includes ZATCA extensibility fields: UUID, hash, QR, UBL XML).
13. `customer_ledger`, `supplier_ledger`.
14. `cash_movements`, card terminal settlement records, and cash-count records.
15. `held_sales`, `held_sale_items`.
16. `payment_methods`.
17. `audit_logs`, versioned settings/history, transactional outbox events, `backup_logs`, and `notifications`.

Relationships must enforce referential integrity. Use strict internal auto-increment IDs. Apply soft deletes (boolean flag `is_deleted`, `deleted_at`, `deleted_by`) only to master data that may be retired. Finalized sales, purchases, invoices, returns, ledgers, payments, movements, cash sessions, and audit rows are never soft- or hard-deleted; their corrections are compensating documents. Use `ON DELETE RESTRICT` on all financial and inventory child tables to prevent accidental destruction of transaction history.

---

## 36. Transaction Architecture

**Idempotent & Atomic:** 
Example: When processing a SALE:
`BEGIN;` -> Lock register, products, and FEFO batches in a stable order -> Re-price and calculate tax server-side -> Insert Sale, immutable line snapshots, payments, and batch allocations -> Insert Stock/Cash/Ledger movements -> Generate legal document payload -> Insert audit/outbox events -> `COMMIT;`
If *any* step fails (e.g., stock constraint violated), issue `ROLLBACK;`. The system must never be in a state where a sale exists without its corresponding stock deduction.

**Idempotency:** Every sale and purchase transaction includes a client-generated `idempotency_key` (UUID) scoped to its endpoint and actor/register. The server stores a request fingerprint and final response under a UNIQUE constraint; a retry with the same key and different payload is rejected. This prevents duplicate documents and double charges after a POS timeout.

---

## 37. API Design

**Core RESTful Endpoints (Subset of 30+):**
- `POST /api/v1/auth/login`, `POST /api/v1/auth/logout` (Public)
- `GET /api/v1/users/me` (All)
- `GET /api/v1/products`, `POST /api/v1/products` (Manager), `PUT /api/v1/products/:id` (Manager)
- `GET /api/v1/products/search` (All)
- `POST /api/v1/images/upload` (Manager)
- `GET /api/v1/categories`, `POST /api/v1/categories` (Manager)
- `POST /api/v1/sales` (All - wrapped in DB transaction)
- `GET /api/v1/sales/:id` (All for own, Manager for all)
- `POST /api/v1/sales/:id/cancel-draft` (Manager; draft only)
- `POST /api/v1/invoices/:id/credit-notes` (Manager / time-bound Manager approval)
- `GET /api/v1/inventory/movements` (Manager)
- `POST /api/v1/inventory/adjust` (Manager)
- `GET /api/v1/customers`, `POST /api/v1/customers` (All)
- `GET /api/v1/customers/:id/ledger` (Manager)
- `POST /api/v1/purchases` (Manager)
- `POST /api/v1/registers/:id/shifts/open`, `POST /api/v1/registers/:id/shifts/:shiftId/close` (authorized register user)
- `GET /api/v1/reports/dashboard` (Manager)
- `GET /api/v1/reports/sales` (Manager)
- `GET /api/v1/system/health` (Manager)

---

## 38. Code Quality

- Write maintainable, production-grade code.
- Avoid "any" type abuse in TypeScript.
- No direct SQL scattered throughout UI components.
- Centralize error handling through middleware.
- Do not copy-paste logic; create reusable services (e.g., `InventoryService`, `TaxService`).
- Use a decimal library at every TypeScript money boundary; APIs serialize monetary values as strings, never JSON numbers.
- Generate legal document XML/PDF, tax, inventory, and promotion decisions only on the server from persisted snapshots.
- Lint with ESLint and format with Prettier.

---

## 39. Frontend Architecture

- **Next.js App Router:** Use Server Components where appropriate for data fetching, and Client Components for interactivity (POS, Forms).
- **State Management:** React Context or Zustand for local state (like the POS cart). Server state managed via React Query or SWR.
- **Component Library:** Headless UI (Radix or similar) styled with Tailwind CSS.
- **Visual Contract:** Implement only the shared primitives and patterns defined in `DesignSystem.md`. Pages compose these components instead of introducing page-specific button, field, card, chip, table, form, or product-tile styles.

---

## 40. Backend Architecture

- **Controller-Service-Repository Pattern:**
  - *Controllers:* Handle HTTP req/res and Zod validation.
  - *Services:* Execute complex business rules (e.g., completing a sale).
  - *Repositories/ORM:* Handle DB queries.
- **Background Workers:** Cron jobs (e.g., node-cron) for executing backups and generating heavy monthly reports without blocking the main event loop.

---

## 41. Configuration & Environment

- Environment variables strictly managed via `.env`.
- Variables required: `DATABASE_URL`, `SESSION_SECRET`, `CSRF_SECRET`, `PORT`, `BACKUP_DIR`, `BACKUP_ENCRYPTION_KEY`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_ENDPOINT`.
- Provide a detailed `.env.example` file. 

---

## 42. Deployment (Docker Compose)

`docker-compose.yml` defining 5 production services:
1. `postgres_live`: PostgreSQL 16 primary database (Port 5432, bound to localhost only).
2. `postgres_recovery`: PostgreSQL 16 recovery sandbox (Port 5433, bound to localhost only).
3. `api`: Node.js Fastify API server (Port 5000, internal).
4. `web`: Next.js frontend application (Port 3000, internal).
5. `nginx`: Nginx 1.25 reverse proxy — single LAN entry point (Port 80). Routes `/` to web, `/api/` to api, `/ws/` for WebSocket upgrades, `/uploads/` for static product images.
All host data persisted via bind mounts to `./data/` directories. All services set `restart: always` with health checks.

---

## 43. Non-Technical User Experience

The Manager should not touch the command line. Production runs as a managed Linux appliance/service, not a desktop Docker installation.
- Provide an admin-safe local launcher for UAT and a production service installer that verifies storage, Docker health, migrations, backups, and the UPS state. The user-facing address is the Nginx HTTPS endpoint, never the internal Next.js port.
- Provide a guarded stop procedure that warns if a register is open and never deletes bind-mounted data.
- Dashboard UI includes a System Health widget: DB Status (Green), Disk Space (e.g., "45% used"), Last Backup ("2 hours ago - Success").

---

## 44. Business Rules

1. Cannot sell inactive products.
2. Cannot purchase inactive products unless overridden by Manager.
3. Cannot sell beyond available stock. A Manager may grant a single documented exception only where the configured policy explicitly permits it.
4. Cannot modify or void a finalized invoice directly; a post-issue correction uses the linked credit/debit-note workflow.
5. Cannot delete completed sales entirely from the database.
6. Returns must reference the original transaction ID where applicable.
7. ALL stock changes must create a non-zero stock movement record, linked to its source and batch when batch-managed.
8. ALL financial payments must create a ledger record.
9. Tax rates must be preserved at the transaction level.
10. Historical invoices must remain static even if current product prices change.
11. Only Manager can perform manual ledger/financial corrections.
12. Every manual stock or ledger correction requires a mandatory text reason and generates an audit log.
13. A return may not exceed the original sold quantity after prior returns, and a batch-managed return retains the original batch allocation.
14. A cash/card sale requires an open register shift; expected till totals are server-derived.
15. Posted financial, inventory, audit, and legal document records are corrected only by compensating records.

---

## 45. Testing Strategy

- **Migration Tests:** Start a clean PostgreSQL 16 instance and run every migration, seed, rollback policy, and extension check in CI.
- **Unit Tests:** Golden tax/discount fixtures for inclusive and exclusive VAT, mixed tax categories, deterministic rounding residues, promotions, WAC, returns, and scale quantities.
- **Integration Tests:** Test the full Sale transaction API (rollback on error, idempotent retry, duplicate-payload rejection, and two-terminal oversell race).
- **Database Tests:** Verify constraints, immutability controls, batch allocation reconciliation, open-shift uniqueness, and soft-delete restrictions.
- **E2E Tests:** Cover scan -> cart -> payment -> legal document -> receipt; loss of LAN; manager approval; split-tender return; and blind shift close.
- **Recovery & Compliance Tests:** Restore a fresh sandbox including uploads, reconcile key reports, and run the current ZATCA SDK/specification validation before release and after any relevant upgrade.

---

## 46. Implementation Phases

**Phase 1: Foundation**
- Project structure, Linux deployment baseline, clean migration CI, governed settings, Auth/session/CSRF system, and base UI layout.
**Phase 2: Core Entities**
- Users, Products (w/ Image upload), Categories, Brands, Suppliers, Customers.
**Phase 3: Inventory & Purchasing**
- Base-unit conversions, batch allocations/FEFO, WAC policy, stock ledger logic, manual adjustments, and receiving workflows.
**Phase 4: Sales & POS**
- Fast POS UI, register shifts, cart logic, payment processing, server tax calculation, immutable invoices, and print-agent/network-printer integration.
**Phase 5: Financials & Ledger**
- Credit/debit-note returns, customer/supplier ledgers, expenses, cash drawer controls, card settlement, and reconciliation.
**Phase 6: Reporting & Analytics**
- Real-time Dashboard, Profit calculations, Sales/VAT/Inventory reports with PDF/CSV export.
**Phase 7: System & Security**
- Database-enforced audit logs, outbox/event recovery, verified backup/restore, WAL archive, off-site sync, System health UI, and ZATCA compliance validation.
**Phase 8: Polish & Launch**
- Framer Motion animations, Dark mode, Performance tuning, E2E testing, Packaging `.bat` scripts.

---

## 47. What NOT to Include

Do NOT add unnecessary complexity:
- Multi-branch/Multi-store syncing.
- Multi-company/Enterprise accounting.
- Complex warehouse bin/location tracking.
- HR, Payroll, or employee management.
- Manufacturing/BOM (Bill of Materials).
- Full accounting ERP features (Journal entries, trial balance).
- CRM automation, Loyalty/Points programs.
- E-commerce frontend.

---

## 48. Final Quality Requirements

**DATA CORRECTNESS > FINANCIAL ACCURACY > SECURITY > RELIABILITY > USABILITY > PERFORMANCE > VISUAL POLISH**

This is a **REAL BUSINESS SYSTEM**. Treat it as mission-critical software handling real money and real inventory. The final system should be simple enough for a non-technical sales employee to learn in 10 minutes, but powerful enough for a manager to confidently audit their entire business health.

*Note: Where specific Saudi VAT/ZATCA regulations are referenced, implement the technical capability but explicitly mark the tax logic as "requires validation against current Saudi regulations" prior to production use.*
