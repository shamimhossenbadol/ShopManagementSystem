# Production Master Instructions: Shop & Inventory Management System

## 1. Project Context & Objectives

Design and architect a modern, production-ready Inventory Management + POS + Sales Management system for a single retail shop in Saudi Arabia. The system will be operated by only two fixed users: Manager and Sales Executive. There are NO branches, NO multi-company requirements, and NO warehouse network. Do not introduce unnecessary enterprise complexity.

The primary users are Bangladeshi shop employees working in Saudi Arabia, but ALL application navigation, labels, buttons, menus, forms, validation messages, and system terminology MUST be in clear professional ENGLISH. 

The system must be robust, reliable, easy to use, fast, audit-friendly, VAT/tax-ready, and suitable for real daily retail business operations.

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
- Cancel/void sales (with audit trail)
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

Every product MUST support an image upload pipeline, barcode label generation, packaging conversions, batch/expiry capability, and variable-weight scale compatibility.

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
- **Packaging Multiplier:** Decimal(10,2) default 1.00 (e.g. 1 Box = 24 Pieces for buying in bulk and selling in singles).
- **Cost Price (WAC):** Decimal(15,4), strict precision. Recalculated upon PO receipt.
- **Selling Price:** Decimal(15,4), strict precision.
- **Wholesale Price:** Decimal(15,4), optional.
- **Tax Rate ID & Tax Type:** Standard 15%, Zero-rated, or Exempt; Inclusive or Exclusive.
- **Min Stock Level:** Decimal(10,2) default 5.00.
- **Current Stock:** Decimal(10,2) - Denormalized cached stock balance updated atomically within DB transactions alongside ledger inserts for instant POS queries.
- **Has Expiry / Perishable Flag:** Boolean.
- **Is Weighable / Scale Item:** Boolean.
- **Is Featured / Quick PLU Key:** Boolean.
- **Active/Inactive Status:** Boolean.
- **Created Date / Updated Date:** Timestamps.

Do not allow uncontrolled modification of historical purchase/sale prices. Current transactions capture the price at the time of the transaction.

---

## 7. Inventory System (Stock Ledger & Performance)

Use a strict **STOCK LEDGER / STOCK MOVEMENT** architecture. 
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
- `quantity`: DECIMAL(10,2) (Positive for IN, Negative for OUT)
- `type`: Enum (movement types)
- `reference_id`: INT (sale_id, purchase_id, return_id)
- `reference_type`: VARCHAR(30) (sale, purchase, sales_return, purchase_return, adjustment — discriminator for tracing movements to source documents)
- `unit_cost`: DECIMAL(15,4) (Valuation at movement timestamp)
- `user_id`: INT REFERENCES users(id)
- `notes`: TEXT (Mandatory reason required for manual adjustments)
- `created_at`: TIMESTAMPTZ

Calculations must be concurrency-safe using `SELECT ... FOR UPDATE` row-level locking during checkout to completely prevent race conditions and overselling.

**Stock Reconciliation Job:** A nightly background job must compare `products.current_stock` against `SUM(quantity) FROM stock_movements WHERE product_id = ?` for every active product. Any discrepancy is flagged via a Manager notification and logged. The job does NOT auto-correct — the Manager decides whether to issue a manual stock adjustment.

---

## 8. POS / Sales (Super Shop Optimized)

The POS interface must be blazingly fast, optimized for daily high-volume retail and grocery counter use.

### Features:
- Barcode scanner input capture (`keydown` listener with 50ms buffer timeout + scan audio beep feedback)
- Produce scale barcode parser (auto-extracts item PLU and fractional weight from prefixes 20-29)
- Fast PLU / Favorites Produce Grid (visual touchscreen tiles for loose fruits, vegetables & bakery)
- Rapid product search (Name, SKU, Barcode, PLU)
- Shopping cart with fractional/integer quantity steppers (+ / -)
- Remove item from cart with swipe/delete key
- Multi-buy & promotional discount engine (auto-applied in cart)
- Apply item-level discount (Fixed amount or Percentage)
- Apply invoice-level discount (Proportionally distributed across line items)
- Walk-in customer (default) or registered customer selection with quick add
- Automatic real-time VAT/tax calculation (inclusive/exclusive support with dynamic rates)
- Multiple payment methods support (Cash, Mada, Credit/Debit Card, Bank Transfer, Split Tender)
- Quick cash tender buttons (configurable: Exact, 50, 100, 200, 500)
- Paid amount vs Due amount calculation
- Change amount calculation for cash payments
- Hold/suspend multiple sales with notes and one-click resume
- Cancel/clear cart with confirmation
- Complete sale with atomic commit, direct ESC/POS thermal printing, and optional RJ11 cash drawer kick

### POS Keyboard Shortcuts:
- `F2`: Focus Barcode Search / Scanner Input
- `F3`: Switch to Quick PLU Produce Grid
- `F4`: Hold Current Sale
- `F7`: Retrieve Held Sales
- `F8`: Open Cash Drawer / Manual Kick (audited)
- `F9` / `Space`: Open Payment Modal
- `Enter` (in Payment Modal): Finalize Sale & Silent Print
- `ESC`: Clear search or close modal
- `F12`: Toggle Fullscreen POS Kiosk Mode

### POS Layout Concept (ASCII):
```text
+-------------------------------------------------------------+
| Header: User, Sync Status, Theme Toggle, Clock, Shift: SAR  |
+-------------------------+-----------------------------------+
| Product Catalog / PLU   | Current Cart                      |
| [All] [Produce] [Dairy] | Customer: [Walk-in]      [Change] |
|                         | --------------------------------- |
| [Produce Grid / Items]  | 1.45kg Fresh Tomatoes     11.60   |
| [Item 1] [Item 2]       | 2x Almarai Milk 2L        23.00   |
| [Item 3] [Item 4]       | 1x Pepsi Can 330ml         3.00   |
|                         | --------------------------------- |
| Search: [_________]     | Subtotal:                 37.60   |
|                         | Promo / Item Discount:     0.00   |
|                         | VAT (15% Included):        4.90   |
| [⚡ Quick Produce Grid] | --------------------------------- |
|                         | TOTAL:                    37.60   |
|                         | [Hold (F4)] [Clear] [ PAY (F9) ]  |
+-------------------------+-----------------------------------+
```

---

## 9. Payment Methods & Daily Card Terminal Reconciliation

Configurable payment methods:
- **Cash** (Integrated into Cash Register Shift drawer movements)
- **Mada / Visa / MasterCard** (Card terminal integration)
- **Bank Transfer** (Direct shop account)
- **Digital Wallet** (STC Pay / Apple Pay)

### Mada / Card Terminal Daily Reconciliation:
In Saudi retail shops, card payments are processed on a physical bank terminal (e.g., Geidea / Network International). At the end of every cashier shift:
1. The Cashier prints the **Terminal Batch Settlement Slip** from the physical POS card machine.
2. During the "Close Cash Register Shift" screen, the Cashier enters:
   - Counted Physical Cash: `SAR 3,450.00`
   - Terminal Settled Card Total: `SAR 4,120.00`
3. The system compares recorded card sales vs physical settlement slip and flags any discrepancy immediately in the **Z-Report**.

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

### Invoice Discount Distribution Formula (ZATCA Compliant):
When an invoice-level discount ($D_{\text{inv}}$) is applied:
1. Proportional discount per line item $i$:
   $$\text{Discount}_i = D_{\text{inv}} \times \left( \frac{\text{Line Gross Total}_i}{\text{Invoice Gross Subtotal}} \right)$$
2. Net Taxable Amount per line item $i$:
   $$\text{Taxable}_i = (\text{Quantity}_i \times \text{Unit Price}_i) - \text{Item Discount}_i - \text{Discount}_i$$
3. Line VAT is computed on the post-discount taxable amount:
   $$\text{VAT}_i = \text{Taxable}_i \times \left( \frac{\text{VAT Rate}_i}{100} \right)$$
This guarantees mathematical accuracy across mixed tax categories (15% standard, 0% zero-rated, and exempt items).

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

Architect transactions to allow future ZATCA Phase 1 & 2 compliance.
Required extensibility fields:
- **UUID:** v4 UUID for the invoice.
- **Invoice Hash:** Cryptographic hash of the invoice data.
- **QR Code Data:** Base64 encoded TLV (Tag-Length-Value) structure.
- **XML Representation:** Placeholder for UBL 2.1 XML format.
- **Submission Status:** Enum (Draft, Reported, Cleared, Failed).
- **External Reference ID:** For API integrations.
- **Error Response Log:** For tracking ZATCA API rejections.

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

Purchases must trigger atomical inventory increases.

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

**Sales Return:** Link to original invoice, select products, set returned qty and reason. Process refunds (cash/card or adjust customer balance). Must automatically increase inventory and adjust VAT output.
**Purchase Return:** Link to original purchase, select items. Decrease inventory, adjust supplier balance, and adjust VAT input.

---

## 17. Expense Management

Track shop operating expenses (Rent, Electricity, Internet, Salary, Maintenance).
**Fields:** Expense ID, Category, Amount, VAT (if applicable), Date, Payment Method, Description, Receipt Attachment URL, Created By.
These deduct from Gross Profit to calculate Net Profit.

---

## 18. Profit Calculation & COGS

Use **Weighted Average Cost** (or FIFO) for inventory valuation.
- Net Sales = Gross Sales - Returns - Discounts.
- COGS = Total cost of the items sold during the period (based on purchase prices).
- Gross Profit = Net Sales - COGS.
- Net Profit = Gross Profit - Operating Expenses.

---

## 19. Cash Management

Optional daily cash register/session tracking.
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

Robust, read-only system.
**Audited Actions:** Login, Logout, Product Create/Update, Price Change, Purchase Create, Sale Create, Invoice Void, Sale/Purchase Return, Stock Adjustment, Expense Create, Customer/Supplier Payment, System Setting/Permission Change.
**Audit Fields:** Record ID, User ID, Action Type, Entity Name (e.g., 'Product'), Entity ID, Previous Value (JSON), New Value (JSON), Timestamp, Reason/Notes, IP Address/Device Info.

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

**State Catchup & WiFi Reconnection Protocol:**
If a tablet or counter PC temporarily loses WiFi connection:
1. The WebSocket client automatically attempts reconnection with exponential backoff (1s, 2s, 5s, 10s max).
2. Upon reconnecting, the POS client immediately calls `GET /api/v1/inventory/stock-snapshot?since=<last_event_timestamp>`.
3. The server responds with delta changes, and the client synchronizes local cart stock validation rules before allowing checkout.

---

## 23. Data Persistence & Docker Strategy

ALL business data is strictly persisted on the HOST filesystem using Docker bind mounts. No data lives exclusively inside container volumes:
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
- **Recovery Sandbox DB (DB2):** Standby PostgreSQL instance used specifically for automated test restores.

**Automated Backup & Test Restore Process:**
1. **Scheduled Snapshot:** Node.js backup worker triggers `pg_dump -Fc -Z 9` at 01:00 AM AST.
2. **Encryption:** Dump is encrypted locally with **AES-256-GCM** using the shop's master key, producing a `.enc` snapshot and `.sha256` checksum.
3. **Automated Test Restore Verification:**
   - Worker decrypts and loads the dump into `postgres_recovery` (DB2).
   - Runs verification query: checks table existence, schema validity, and verifies row counts match DB1.
   - Logs result into `backup_logs`: `verification_status = 'verified'` or `'failed'`, with `verified_at` and `restored_row_count`.
4. **Non-blocking Cloud Upload:** Transmits verified encrypted snapshot to AWS S3 / Cloudflare R2 if internet is available; queues safely if offline.

**Retention Policy:** Daily (14 backups), Weekly (8 backups), Monthly (12 backups).

**Filesystem Backup:** In addition to database dumps, the backup worker must archive `./data/uploads/` (product images, expense attachments) into the encrypted backup artifact. Restore procedures must restore both the database and uploaded files.

**Encryption Key Security:** The `BACKUP_ENCRYPTION_KEY` must be printed on paper and stored in the shop's physical safe. The encryption key must NEVER be stored in the same location as the encrypted backup files. Without this key, encrypted backups are irrecoverable.

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
- **Session Tokens:** JWT stored in `HttpOnly`, `SameSite=Strict` cookies. Enable `Secure` flag only if HTTPS is configured via a local TLS certificate. For CSRF protection, all mutating API requests must include an `X-Requested-With: XMLHttpRequest` header validated server-side.
- **PIN Authorization:** 4-6 digit Manager PIN required for sales returns, voids, and cash drawer kicks. 5 failed PIN attempts triggers a 10-minute lockout.
- **Rate Limiting:** Fastify `@fastify/rate-limit` restricting auth endpoints (max 10 req/min per IP).
- **Parameterized SQL:** Parameterized SQL queries (ORM) to prevent SQL Injection.
- **Server-side RBAC:** Authorization middleware checked on EVERY endpoint.
- **Sanitization:** Strict runtime validation using Zod schemas.
- **Docker Log Rotation:** Enforced `max-size: "50m"` and `max-file: "5"` in Docker compose to prevent disk exhaustion.

---

## 27. Offline-First Operations

The core application operates primarily locally. Internet is ONLY required for remote backups, external API integrations, or remote manager access (if configured via VPN/Tunnel). Local authentication, database access, POS, inventory, and reporting must operate flawlessly with no internet connection.

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
- **Theme Modes:** Light, Dark, and System Default with instantaneous switching and local storage persistence.
- **Theme Palette:** Built using Tailwind CSS dark variants (`dark:bg-slate-900`, `dark:text-white`, `dark:border-slate-700`).
- **Accent Color Themes:** Configurable primary brand color presets in Settings (Brand Blue, Emerald Green, Indigo, Violet, Amber, Slate).
- **POS Density Modes:** Normal Comfortable view vs Compact High-Density Grid for small counter monitors.

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

EVERY system parameter MUST be fully editable by the Manager via a clean UI Settings panel without code modifications or server restarts:

### 1. Shop Profile & Branding Settings:
- **Shop Name:** English and Arabic business names.
- **Legal Identifiers:** Commercial Registration (CR) Number, VAT Registration Number.
- **Contact & Address:** Street, City, State, Country, Phone Numbers, Email, Postal Code.
- **Shop Logo:** Drag-and-drop image uploader (WebP/PNG) displayed on the top navigation bar and receipts.
- **Receipt Customization:** Customizable header greeting, footer return policy text (e.g., "Goods returned within 7 days with invoice"), social handles/QR link.

### 2. Dynamic VAT / Tax Configuration:
- **Tax Rates CRUD:** Ability to create, update, and toggle active tax rates (e.g., 15.00% Standard, 5.00%, 0.00% Zero-Rated, Exempt).
- **Default Tax Rate:** Selectable fallback tax rate for new products.
- **Tax Calculation Mode:** System-wide or per-item default for Tax Inclusive (price includes VAT) vs Tax Exclusive (VAT added at checkout).
- **Tax Labels:** Customizable tax identification names (e.g., "VAT", "Tax", "ضريبة القيمة المضافة").

### 3. Currency, Numbers & Regional Locale:
- **Currency Code:** Configurable (e.g., `SAR`, `USD`, `BDT`, `EUR`, `AED`, `GBP`).
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
- **Negative Stock Policy:** Allow or disallow checkout when physical stock is zero.
- **Quick Tender Presets:** Configurable 5 quick cash amount buttons in payment modal.

---

## 35. Database Design

**Core Entities (35+):**
1. `users` (with `user_role_enum`: manager, sales_executive).
2. `products`, `categories`, `brands`, `units`, `tax_rates`, `product_images`.
3. `product_batches` (batch number, expiry date, purchase cost, current batch quantity).
4. `promotions`, `promotion_rules` (Buy X Get Y, bundle discounts, date ranges).
5. `suppliers`, `customers`.
6. `sales`, `sale_items`, `sale_payments`.
7. `purchases`, `purchase_items`, `purchase_payments`.
8. `stock_movements`, `stock_adjustments`.
9. `sales_returns`, `sales_return_items`.
10. `purchase_returns`, `purchase_return_items`.
11. `expenses`, `expense_categories`.
12. `invoices` (includes ZATCA extensibility fields: UUID, hash, QR, UBL XML).
13. `customer_ledger`, `supplier_ledger`.
14. `cash_sessions`, `cash_movements`.
15. `held_sales`, `held_sale_items`.
16. `payment_methods`.
17. `audit_logs`, `settings`, `backup_logs`, `notifications`.

Relationships must enforce referential integrity. Use strict internal auto-increment IDs. Apply soft deletes (boolean flag `is_deleted`) on core business entities (products, categories, brands, suppliers, customers, sales, purchases) to preserve historical links. Use `ON DELETE RESTRICT` on all financial child tables to prevent accidental destruction of transaction history.

---

## 36. Transaction Architecture

**Idempotent & Atomic:** 
Example: When processing a SALE:
`BEGIN;` -> Insert Sale -> Insert Sale Items -> Calculate Tax -> Record Payment -> Insert Stock Movements -> Update Customer Ledger -> `COMMIT;`
If *any* step fails (e.g., stock constraint violated), issue `ROLLBACK;`. The system must never be in a state where a sale exists without its corresponding stock deduction.

**Idempotency:** Every sale and purchase transaction must include a client-generated `idempotency_key` (UUID). The server enforces a UNIQUE constraint on this key. If a network timeout causes a retry, the server returns the existing transaction instead of creating a duplicate. This prevents double-charges on POS terminal retries.

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
- `POST /api/v1/sales/:id/void` (Manager)
- `GET /api/v1/inventory/movements` (Manager)
- `POST /api/v1/inventory/adjust` (Manager)
- `GET /api/v1/customers`, `POST /api/v1/customers` (All)
- `GET /api/v1/customers/:id/ledger` (Manager)
- `POST /api/v1/purchases` (Manager)
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
- Lint with ESLint and format with Prettier.

---

## 39. Frontend Architecture

- **Next.js App Router:** Use Server Components where appropriate for data fetching, and Client Components for interactivity (POS, Forms).
- **State Management:** React Context or Zustand for local state (like the POS cart). Server state managed via React Query or SWR.
- **Component Library:** Headless UI (Radix or similar) styled with Tailwind CSS.

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
- Variables required: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `BACKUP_DIR`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_ENDPOINT`.
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

The Manager should not touch the command line.
- Provide `start-shop.bat`: Checks requirements, creates folders, runs `docker-compose up -d`, waits for API health check (`/api/system/health`), and opens the default browser to `http://localhost:3000`.
- Provide `stop-shop.bat`: Runs `docker-compose down`.
- Dashboard UI includes a System Health widget: DB Status (Green), Disk Space (e.g., "45% used"), Last Backup ("2 hours ago - Success").

---

## 44. Business Rules

1. Cannot sell inactive products.
2. Cannot purchase inactive products unless overridden by Manager.
3. Cannot sell beyond available stock unless negative stock explicitly enabled in settings.
4. Cannot modify finalized invoices directly (must void/return).
5. Cannot delete completed sales entirely from the database.
6. Returns must reference the original transaction ID where applicable.
7. ALL stock changes must create a stock movement record.
8. ALL financial payments must create a ledger record.
9. Tax rates must be preserved at the transaction level.
10. Historical invoices must remain static even if current product prices change.
11. Only Manager can perform manual ledger/financial corrections.
12. Every manual stock or ledger correction requires a mandatory text reason and generates an audit log.

---

## 45. Testing Strategy

- **Unit Tests:** Jest/Vitest for testing Tax calculations, discount logic, profit formulas, and stock arithmetic.
- **Integration Tests:** Test the full Sale transaction API (ensure rollback on error).
- **Database Tests:** Verify constraints (e.g., unique SKUs).
- **E2E Tests:** Cypress/Playwright covering the primary POS workflow (Scan -> Cart -> Pay -> Invoice).
- **Recovery Tests:** Manually verify that backup restoration yields a working database.

---

## 46. Implementation Phases

**Phase 1: Foundation**
- Project structure, Docker setup, Next.js init, DB schema design, Auth system, Base UI layout.
**Phase 2: Core Entities**
- Users, Products (w/ Image upload), Categories, Brands, Suppliers, Customers.
**Phase 3: Inventory & Purchasing**
- Stock ledger logic, Manual adjustments, Purchase workflows (Increases inventory).
**Phase 4: Sales & POS**
- Fast POS UI, Cart logic, Payment processing, Invoice generation, Tax calculation.
**Phase 5: Financials & Ledger**
- Returns (Sales/Purchase), Customer/Supplier ledgers, Expenses, Cash drawer management.
**Phase 6: Reporting & Analytics**
- Real-time Dashboard, Profit calculations, Sales/VAT/Inventory reports with PDF/CSV export.
**Phase 7: System & Security**
- Audit logs, Two-Database Backup script, Background workers, S3 sync, System health UI.
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
