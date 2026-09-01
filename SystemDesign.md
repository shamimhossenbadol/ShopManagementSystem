# Comprehensive System Design Document: Retail Shop Management System

**Platform Architecture:** Node.js (Backend) | Next.js & React (Frontend) | PostgreSQL (Database)  
**Target Market:** Saudi Arabia (KSA)  
**User Base:** Bangladeshi Shop Workforce (English UI)  
**Deployment Model:** Local-First / Shop LAN Server with Two-Database Automated Cloud Backup  

---

## A. Product & System Overview

### 1. System Purpose
A modern, production-grade Inventory Management, Point of Sale (POS), Procurement, and Sales Management software application engineered specifically for a single retail shop in Saudi Arabia. The system guarantees mathematical and financial accuracy, local LAN operation resilience, automated disaster recovery, and compliance with Saudi tax/ZATCA e-invoicing standards without unnecessary multi-branch or ERP complexity.

### 2. Target Users & Operating Model
The system is operated by two strictly partitioned user roles:
1. **Manager:** Shop owner / lead administrator with full operational, financial, pricing, purchasing, user management, and reporting control.
2. **Sales Executive:** Cashier / sales assistant handling counter sales, barcode scanning, customer selection, and permitted return workflows.

### 3. Localization, Currency & Environment
* **Location:** Kingdom of Saudi Arabia (KSA).
* **Currency:** Saudi Riyal (`SAR`), formatted to 2 decimal places. Financial storage strictly uses `DECIMAL(15,4)`.
* **Language & Interface:** 100% English navigation, forms, validation, receipts, and reports tailored with simple, unambiguous terminology and intuitive icons for Bangladeshi expatriate retail staff.
* **Timezone:** Arab Standard Time (`Asia/Riyadh` / UTC+3). Database stores timestamps in UTC (ISO 8601); UI renders local AST time.

### 4. Architectural Priorities
1. **Data Correctness:** Zero orphan records, transaction atomicity, foreign-key integrity.
2. **Financial Precision:** Exact decimal arithmetic without JavaScript or database floating-point approximations.
3. **Inventory Integrity:** Immutable stock ledger where every unit change is recorded as a movement.
4. **Local-First LAN Operation:** Core POS, sales, inventory, and reporting work seamlessly inside the shop LAN without an active internet connection.
5. **Two-Database Disaster Recovery:** Local primary database for live operations; independent secondary recovery database and automated encrypted remote backups.
6. **Auditability:** Complete, unalterable audit trail recording every state change and user action.
7. **Usability & POS Speed:** Sub-second barcode lookup, rapid cart manipulation, and single-click receipt generation.

---

## B. User Roles & Permissions Matrix (RBAC)

The application enforces server-side Role-Based Access Control on every API route and database query. Frontend route guards and UI masking complement backend security.

```mermaid
flowchart TD
    Req[Incoming API Request] --> Auth[JWT & Cookie Authentication]
    Auth --> Session[Resolve User & Role]
    Session --> Guard{Role Authorized?}
    Guard -- No --> Res403[403 Forbidden Response]
    Guard -- Yes --> Service[Execute Domain Logic]
```

### Role Permissions Matrix

| Module | Permission Name | Manager | Sales Executive | Operational Rules |
| :--- | :--- | :---: | :---: | :--- |
| **Dashboard** | `dashboard.view_all` | Yes | No | Full revenue, net profit, margin & tax cards |
| | `dashboard.view_restricted` | No | Yes | Shift sales, personal invoices, cash drawer status |
| **Products** | `products.manage` | Yes | No | Create, edit, delete, alter cost/selling prices |
| | `products.view_cost_price`| Yes | No | **STRICTLY BLOCKED** for Sales Executive |
| | `products.search_lookup` | Yes | Yes | Name, SKU, Barcode search & stock availability |
| **Inventory** | `inventory.manage` | Yes | No | View full stock ledger, valuation & cost basis |
| | `inventory.adjust` | Yes | No | Manual adjustment with mandatory reason & audit log |
| **Purchases** | `purchases.manage` | Yes | No | Create POs, receive goods, update supplier debts |
| **Suppliers** | `suppliers.manage` | Yes | No | Vendor directory, terms, accounts payable ledger |
| **Customers** | `customers.manage` | Yes | View/Create | Executive can register walk-in & view contacts |
| | `customers.view_ledger` | Yes | No | Credit history & debt collection ledger |
| **Sales / POS**| `pos.use_terminal` | Yes | Yes | Scan barcodes, cart management, apply discounts |
| | `sales.view_history` | All | Own Shift Only | View completed sales and print receipts |
| | `sales.void_cancel` | Yes | No | Same-day void requires Manager credential |
| **Returns** | `returns.process_sales` | Yes | With Approval | Sales return requires Manager PIN / approval token |
| | `returns.process_purchases`| Yes | No | Return goods to vendor & reduce accounts payable |
| **Expenses** | `expenses.manage` | Yes | Petty Cash Only | Cash drawer petty expenses logged against shift |
| **Reports** | `reports.view_financial` | Yes | No | P&L, VAT filing report, cash flow, margins |
| **System** | `audit.view_logs` | Yes | No | Immutable system audit log inspection |
| | `settings.manage` | Yes | No | Tax rates, shop info, receipt templates |
| | `backup.manage` | Yes | No | Trigger backup, view backup health, test restore |

### Explicit Sales Executive Restrictions
1. Must NEVER view or edit the product cost price (`cost_price`).
2. Must NEVER view shop profit margins, gross/net profit, or aggregated VAT liabilities.
3. Must NEVER access supplier pricing, purchase orders, or accounts payable.
4. Must NEVER delete or retroactively alter historical invoices or stock ledger entries.
5. Must NEVER perform manual stock adjustments without Manager authorization.

---

## C. System Architecture & Local LAN Topology

The entire operational stack runs on-premise on the shop's primary local server. POS terminals (cashier desktop, tablet) connect over the shop's secure Local Area Network (LAN).

```mermaid
graph TB
    subgraph Shop LAN Environment
        Term1[Cashier Counter PC<br/>Chrome / Edge]
        Term2[Manager Desktop / Laptop<br/>Browser]
        Term3[Floor Tablet<br/>Barcode Scanner]
        
        Router((Shop LAN Router / Switch<br/>192.168.1.x))
        
        Term1 --> Router
        Term2 --> Router
        Term3 --> Router
        
        subgraph Shop Primary Server
            Nginx[Local Reverse Proxy / Nginx<br/>Port 80 / 443 (Self-Signed SSL)]
            NextApp[Next.js App Server<br/>Port 3000]
            NodeAPI[Node.js Fastify API Server<br/>Port 5000]
            
            DB1[(DATABASE 1<br/>Primary Live PostgreSQL<br/>Port 5432 - Localhost only)]
            BackupWorker[Automated Backup Worker<br/>Node.js / Cron]
            LocalStore[(Local Encrypted<br/>Backup Storage)]
            DB2[(DATABASE 2<br/>Secondary Recovery PostgreSQL<br/>Port 5433 - Isolated)]
            
            Router --> Nginx
            Nginx --> NextApp
            Nginx --> NodeAPI
            NextApp --> NodeAPI
            NodeAPI --> DB1
            
            BackupWorker -.->|Periodic pg_dump| DB1
            BackupWorker -->|Store AES-256 Dumps| LocalStore
            BackupWorker -.->|Automated Test Restore| DB2
        end
    end
    
    subgraph External Cloud (When Internet Available)
        CloudStore[(Encrypted Remote Cloud Storage<br/>AWS S3 / Cloudflare R2)]
        BackupWorker -.->|Async Non-blocking Upload| CloudStore
    end
```

### Data Persistence Guarantee

```
Host Bind Mounts (Data survives ALL Docker operations):
├── ./data/postgres_live/      → PostgreSQL primary data
├── ./data/postgres_recovery/  → Recovery database data  
├── ./data/uploads/products/   → Product images
└── ./backups/                 → Encrypted backup snapshots

Safe operations (data preserved):
✅ docker compose down
✅ docker compose up --build
✅ docker compose down && docker compose up
✅ docker system prune
✅ Rebuild containers
✅ Update container images

DANGEROUS (data loss):
❌ Manually deleting ./data/ directory
❌ Formatting the host drive
```

---

## D. Multi-Terminal Real-Time Architecture

The system employs a real-time event-driven architecture to keep all connected POS terminals and managerial dashboards synchronized instantly.

- **WebSocket/SSE server** for real-time stock updates
- When a sale completes, broadcast stock changes to all connected terminals
- **Event types:** `STOCK_UPDATE`, `SALE_COMPLETED`, `LOW_STOCK_ALERT`, `CASH_SESSION_UPDATE`
- **Connection management:** auto-reconnect with exponential backoff

```mermaid
sequenceDiagram
    participant Terminal1 as POS Terminal 1
    participant Terminal2 as POS Terminal 2
    participant API as API Server (WS/SSE)
    participant DB as Database

    Terminal1->>API: Process Sale
    API->>DB: Commit Transaction
    DB-->>API: Success
    API->>Terminal1: Sale Completed Response
    API->>Terminal2: Broadcast STOCK_UPDATE
    Terminal2->>Terminal2: Update local state
```

---

## E. Two-Database & Disaster Recovery Strategy

The system strictly adheres to the rule: **LIVE DATA $\neq$ BACKUP DATA**.

```
+-------------------------------------------------------------------------------+
| PRIMARY LIVE DATABASE (DB 1)                                                  |
| - High-performance local PostgreSQL 16+ instance                              |
| - Dedicated to real-time counter sales, inventory locks, and queries          |
| - WAL archiving enabled for point-in-time recovery                            |
+---------------------------------------+---------------------------------------+
                                        |
               Automated Daily/Weekly   | `pg_dump -Fc` + AES-256-GCM
               Scheduled Worker         v
+-------------------------------------------------------------------------------+
| LOCAL ENCRYPTED BACKUP VAULT                                                  |
| - Stored on an independent physical disk partition                            |
| - SHA-256 integrity checksum verification per snapshot file                   |
| - Configurable Retention: 14 Daily, 8 Weekly, 12 Monthly                      |
+-------------------+---------------------------------------+-------------------+
                    |                                       |
    Periodic Test   | Verification          Asynchronous    | Non-Blocking Sync
    Restore Job     v                       Worker (Online) v
+-----------------------------------+   +---------------------------------------+
| SECONDARY RECOVERY DB (DB 2)      |   | REMOTE CLOUD OBJECT STORAGE           |
| - Standby PostgreSQL instance     |   | - AWS S3 / Cloudflare R2              |
| - Restores snapshot in sandbox    |   | - Off-site disaster protection        |
| - Verifies schema & row counts    |   | - Unaffected by local hardware fire   |
+-----------------------------------+   +---------------------------------------+
```

### 1. Retention Policy
* **Daily Snapshots:** Created at 01:00 AM AST daily; retained for **14 days**.
* **Weekly Archives:** Created every Friday night; retained for **8 weeks**.
* **Monthly Archives:** Created on the 1st of each month; retained for **12 months**.

### 2. Backup Encryption & Verification
* Every snapshot is dumped using PostgreSQL custom format (`pg_dump -Fc -Z 9`).
* The `./data/uploads/` directory is archived and bundled alongside the database snapshot into the final backup artifact.
* Encrypted locally using **AES-256-GCM** with a dedicated shop master key.
* A companion `.sha256` checksum file is generated for cryptographic tamper-detection.
* **Encryption Key Security:** The `BACKUP_ENCRYPTION_KEY` MUST be printed on paper and stored in a physical safe on-premises. Loss of this key means complete loss of backup restorability.

### 3. Non-Blocking Cloud Sync
* If the internet is offline, backups accumulate in the local vault without throwing application errors or interrupting POS sales.
* Once network connectivity resumes, the backup worker queues and transmits pending bundles to AWS S3 / Cloudflare R2 using exponential backoff retry.
* The Manager Dashboard displays real-time backup health:
  * Green: Last successful backup $< 24$ hours ago.
  * Amber: Last successful local backup $< 48$ hours; cloud sync pending.
  * Red Alert: Backup failed or $> 48$ hours overdue.

### 4. Disaster Recovery Playbook
| Failure Scenario | Automated Safeguard | Manager Recovery Procedure |
| :--- | :--- | :--- |
| **Sudden Power Outage** | PostgreSQL write-ahead logs (WAL) ensure atomic crash recovery. | Turn on server; Docker automatically restarts containers; WAL auto-replays. |
| **Database Corruption** | Daily encrypted snapshots available in local vault. | Click "Restore from Snapshot" in System Settings $\rightarrow$ selects verified dump $\rightarrow$ restores DB1. |
| **Server Hardware / SSD Loss**| Remote encrypted cloud backups stored in Cloudflare R2 / S3. | Setup new PC $\rightarrow$ install Docker $\rightarrow$ pull remote backup $\rightarrow$ decrypt & execute `pg_restore`. |
| **Accidental Stock Mismatch** | Full `audit_logs` and `stock_movements` ledger trail. | Run Stock Audit Report $\rightarrow$ identify delta $\rightarrow$ post Stock Adjustment with reference. |

---

## F. Detailed User Flows

### 1. POS Counter Sale & Split Payment Flow
```mermaid
sequenceDiagram
    autonumber
    actor Exec as Sales Executive
    participant POS as Next.js POS UI
    participant API as Fastify Backend
    participant DB as PostgreSQL (DB 1)
    
    Exec->>POS: Scan Barcode / Search Item
    POS->>API: GET /api/v1/products/scan/:barcode
    API->>DB: Query Product & Current Computed Stock
    DB-->>API: Product details + Available Stock
    API-->>POS: Return Item JSON
    POS->>POS: Add to Cart & Calculate VAT (Inclusive/Exclusive)
    
    Exec->>POS: Select Customer (or Walk-in) & Click Pay
    Exec->>POS: Enter Tender (e.g. SAR 100 Cash + SAR 150 Mada Card)
    POS->>API: POST /api/v1/sales (Payload with Idempotency Key)
    
    rect rgb(240, 248, 255)
    Note over API,DB: ATOMIC DATABASE TRANSACTION (BEGIN)
    API->>DB: SELECT stock FROM products WHERE id IN (...) FOR UPDATE
    API->>DB: Verify Sufficient Stock (Throw if stock < qty & negative_stock=false)
    API->>DB: INSERT INTO sales (reference_no, subtotal, tax, grand_total, status)
    API->>DB: INSERT INTO sale_items (prices, quantities, tax_rate, tax_amount)
    API->>DB: INSERT INTO sale_payments (payment_method_id, amount)
    API->>DB: INSERT INTO stock_movements (type='sale', qty = -qty, unit_cost)
    API->>DB: INSERT INTO customer_ledger (if credit/due applied)
    API->>DB: INSERT INTO cash_movements (if cash received into active session)
    API->>DB: INSERT INTO invoices (uuid, invoice_no, zatca_hash, qr_data)
    API->>DB: INSERT INTO audit_logs (action='SALE_CREATE')
    API->>DB: COMMIT TRANSACTION
    end
    
    DB-->>API: Transaction Committed Successfully
    API-->>POS: 201 Created (Invoice UUID, QR Code, Receipt Payload)
    POS->>Exec: Print 80mm Thermal Receipt + Open Cash Drawer
    POS->>POS: Reset Cart for Next Customer
```

### 2. Purchase Order Procurement & WAC Cost Recalculation Flow
```mermaid
sequenceDiagram
    autonumber
    actor Mgr as Manager
    participant UI as Next.js Purchases UI
    participant API as Fastify Backend
    participant DB as PostgreSQL (DB 1)
    
    Mgr->>UI: Create Purchase Order (Select Supplier, Items, Qty, Purchase Cost)
    UI->>API: POST /api/v1/purchases
    API->>DB: INSERT INTO purchases (status='received')
    
    rect rgb(240, 255, 240)
    Note over API,DB: ATOMIC TRANSACTION & WAC UPDATE
    loop For each purchase item
        API->>DB: INSERT INTO purchase_items (product_id, qty, net_unit_cost, tax)
        API->>DB: INSERT INTO stock_movements (type='purchase', qty = +qty, unit_cost)
        API->>DB: SELECT cost_price, computed_stock FROM products WHERE id = ? FOR UPDATE
        API->>API: Calculate New WAC = ((OldStock * OldWAC) + (NewQty * NewCost)) / (OldStock + NewQty)
        API->>DB: UPDATE products SET cost_price = New_WAC WHERE id = ?
    end
    API->>DB: INSERT INTO supplier_ledger (type='bill', credit=grand_total)
    API->>DB: INSERT INTO audit_logs (action='PURCHASE_RECEIVE')
    API->>DB: COMMIT
    end
    
    API-->>UI: 201 Created (Stock & WAC Cost Updated)
```

### 3. Sales Return & Restock Flow
```mermaid
sequenceDiagram
    autonumber
    actor Exec as Cashier / Manager
    participant POS as Next.js Returns UI
    participant API as Fastify Backend
    participant DB as PostgreSQL (DB 1)
    
    Exec->>POS: Enter Invoice Number (e.g. INV-202608-00042)
    POS->>API: GET /api/v1/invoices/:invoice_no
    API->>DB: Fetch original sale items and previously returned quantities
    DB-->>API: Invoice details
    API-->>POS: Render returnable items list
    
    Exec->>POS: Select Items to return, quantities, condition (Restock vs Damaged)
    Exec->>POS: Provide Manager PIN authorization
    POS->>API: POST /api/v1/returns/sales
    
    rect rgb(255, 245, 245)
    Note over API,DB: ATOMIC TRANSACTION
    API->>DB: INSERT INTO sales_returns (sale_id, refund_amount, tax_reversed)
    API->>DB: INSERT INTO sales_return_items (item_id, qty, restocked)
    alt Item is Restocked
        API->>DB: INSERT INTO stock_movements (type='return_in', qty = +qty)
    else Item is Damaged
        API->>DB: INSERT INTO stock_movements (type='damage', qty = 0)
    end
    API->>DB: INSERT INTO cash_movements (cash_out from till) OR customer_ledger (credit)
    API->>DB: INSERT INTO audit_logs (action='SALE_RETURN')
    API->>DB: COMMIT
    end
    
    API-->>POS: Return Processed Successfully + Print Credit Note / Return Receipt
```

### 4. Cash Register Shift Closing & Blind Count Flow
```mermaid
sequenceDiagram
    autonumber
    actor Cashier as Sales Executive / Manager
    participant UI as Next.js Cashier UI
    participant API as Fastify Backend
    participant DB as PostgreSQL (DB 1)
    
    Cashier->>UI: Click "Close Cash Register Shift"
    UI->>Cashier: Prompt for Physical Cash Blind Count (Count banknotes & coins)
    Cashier->>UI: Enter Actual Counted Cash (e.g. SAR 3,450.00)
    UI->>API: POST /api/v1/cash/close
    
    API->>DB: Calculate Expected = OpeningFloat + CashSales + CashIn - CashOut - CashRefunds
    API->>API: Calculate Discrepancy = Actual - Expected
    API->>DB: UPDATE cash_sessions SET closing_balance=Actual, expected_balance=Expected, difference=Discrepancy, status='closed', closed_at=NOW()
    API->>DB: INSERT INTO audit_logs (action='CASH_SESSION_CLOSE', discrepancy=Discrepancy)
    
    API-->>UI: Return Shift Summary & Z-Report
    UI->>Cashier: Render Z-Report (Summary of Cash, Card, VAT collected, Overage/Shortage)
```

---

## G. Complete PostgreSQL 16+ Database Schema (DDL)

All financial fields use `DECIMAL(15,4)` to prevent IEEE-754 floating-point inaccuracies. Referential integrity, unique constraints, and updated-at triggers are enforced natively in PostgreSQL.

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS
CREATE TYPE user_role_enum AS ENUM ('manager', 'sales_executive');
CREATE TYPE tax_type_enum AS ENUM ('inclusive', 'exclusive');
CREATE TYPE payment_status_enum AS ENUM ('paid', 'partial', 'unpaid');
CREATE TYPE sale_status_enum AS ENUM ('completed', 'voided', 'draft');
CREATE TYPE purchase_status_enum AS ENUM ('pending', 'ordered', 'received', 'cancelled');
CREATE TYPE stock_movement_type_enum AS ENUM (
    'opening', 'purchase', 'sale', 'return_in', 'return_out', 'adjustment', 'damage', 'loss'
);
CREATE TYPE stock_adjustment_type_enum AS ENUM ('addition', 'subtraction');
CREATE TYPE customer_ledger_type_enum AS ENUM ('invoice', 'payment', 'return', 'adjustment');
CREATE TYPE supplier_ledger_type_enum AS ENUM ('bill', 'payment', 'return', 'adjustment');
CREATE TYPE cash_session_status_enum AS ENUM ('open', 'closed');
CREATE TYPE cash_movement_type_enum AS ENUM ('cash_in', 'cash_out');
CREATE TYPE cash_movement_source_enum AS ENUM (
    'opening_float', 'sale', 'expense', 'refund', 'manual_deposit', 'manual_withdrawal'
);
CREATE TYPE einvoice_status_enum AS ENUM ('pending', 'generated', 'failed');
CREATE TYPE submission_status_enum AS ENUM ('not_submitted', 'submitted', 'accepted', 'rejected');

-- 2. USERS & ROLES
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    role user_role_enum NOT NULL DEFAULT 'sales_executive',
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    pin_code VARCHAR(10), -- For fast POS switch & return approvals
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    pin_failed_attempts INT NOT NULL DEFAULT 0,
    pin_locked_until TIMESTAMPTZ,
    login_failed_attempts INT NOT NULL DEFAULT 0,
    login_locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PRODUCT CATALOG MASTER
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id INT REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE units (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL, -- e.g. Piece, Box, Kilogram
    short_name VARCHAR(10) NOT NULL, -- e.g. pcs, box, kg
    allow_decimal BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE tax_rates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL, -- e.g. Standard VAT 15%, Zero-Rated 0%, Exempt 0%
    rate DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    barcode VARCHAR(100) UNIQUE,
    plu_code VARCHAR(20), -- Produce scale PLU (e.g. 1042 for Bananas)
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id INT REFERENCES categories(id) ON DELETE SET NULL,
    brand_id INT REFERENCES brands(id) ON DELETE SET NULL,
    unit_id INT NOT NULL REFERENCES units(id),
    packaging_multiplier DECIMAL(10,2) NOT NULL DEFAULT 1.00, -- e.g. Box of 24 = 24.00, piece = 1.00
    tax_rate_id INT NOT NULL REFERENCES tax_rates(id),
    tax_type tax_type_enum NOT NULL DEFAULT 'exclusive',
    cost_price DECIMAL(15,4) NOT NULL DEFAULT 0.0000, -- Weighted Average Cost
    wholesale_price DECIMAL(15,4),
    selling_price DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    current_stock DECIMAL(10,2) NOT NULL DEFAULT 0.00, -- Denormalized atomic cache for sub-ms POS lookup
    min_stock_level DECIMAL(10,2) NOT NULL DEFAULT 5.00,
    has_expiry BOOLEAN NOT NULL DEFAULT FALSE, -- Perishable flag
    is_weighable BOOLEAN NOT NULL DEFAULT FALSE, -- Variable-weight scale item
    is_quick_plu BOOLEAN NOT NULL DEFAULT FALSE, -- Appears on POS quick produce touch grid
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_plu ON products(plu_code);
CREATE INDEX idx_products_stock ON products(current_stock);
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('english', name));

-- 3.1 PRODUCT IMAGES
CREATE TABLE product_images (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    width INT,
    height INT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    uploaded_by INT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_product_images_product ON product_images(product_id);

-- 3.2 PRODUCT BATCHES (PERISHABLES & EXPIRY TRACKING)
CREATE TABLE product_batches (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_number VARCHAR(100) NOT NULL,
    expiry_date DATE NOT NULL,
    purchase_item_id INT REFERENCES purchase_items(id),
    cost_price DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    initial_quantity DECIMAL(10,2) NOT NULL,
    current_quantity DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_product_batches_expiry ON product_batches(product_id, expiry_date);

-- 3.3 PROMOTIONS & DEALS ENGINE
CREATE TYPE promotion_type_enum AS ENUM ('buy_x_get_y', 'bundle_price', 'percentage_discount', 'fixed_discount');

CREATE TABLE promotions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    type promotion_type_enum NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE promotion_rules (
    id SERIAL PRIMARY KEY,
    promotion_id INT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    buy_product_id INT REFERENCES products(id),
    buy_quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    get_product_id INT REFERENCES products(id),
    get_quantity DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    bundle_price DECIMAL(15,4),
    discount_percentage DECIMAL(5,2),
    discount_amount DECIMAL(15,4)
);
CREATE INDEX idx_product_images_product ON product_images(product_id);

-- 4. CUSTOMERS & SUPPLIERS
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    company_name VARCHAR(150),
    vat_number VARCHAR(50),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    opening_balance DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(100),
    vat_number VARCHAR(50), -- For B2B Invoices
    address TEXT,
    credit_limit DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    opening_balance DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_customers_phone ON customers(phone);

-- 5. PAYMENT METHODS & CASH REGISTERS
CREATE TABLE payment_methods (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL, -- Cash, Mada / Visa, Bank Transfer
    code VARCHAR(20) UNIQUE NOT NULL, -- cash, card, bank, wallet
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_cash BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE cash_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    status cash_session_status_enum NOT NULL DEFAULT 'open',
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    opening_balance DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    closing_balance DECIMAL(15,4) NOT NULL DEFAULT 0.0000, -- Physical Counted Cash
    expected_balance DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    difference DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    terminal_card_total DECIMAL(15,4) NOT NULL DEFAULT 0.0000, -- Mada terminal batch slip total
    terminal_card_expected DECIMAL(15,4) NOT NULL DEFAULT 0.0000, -- System recorded card sales
    terminal_card_discrepancy DECIMAL(15,4) NOT NULL DEFAULT 0.0000, -- Settlement discrepancy
    closing_note TEXT
);

CREATE TABLE cash_movements (
    id BIGSERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
    type cash_movement_type_enum NOT NULL,
    amount DECIMAL(15,4) NOT NULL,
    source cash_movement_source_enum NOT NULL,
    reference_id INT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. SALES & POS CORE
CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    reference_no VARCHAR(50) UNIQUE NOT NULL, -- e.g. SAL-202608-0001
    user_id INT NOT NULL REFERENCES users(id),
    customer_id INT REFERENCES customers(id),
    total_items INT NOT NULL,
    subtotal DECIMAL(15,4) NOT NULL,
    total_discount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    total_tax DECIMAL(15,4) NOT NULL,
    grand_total DECIMAL(15,4) NOT NULL,
    paid_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    due_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    payment_status payment_status_enum NOT NULL DEFAULT 'paid',
    sale_status sale_status_enum NOT NULL DEFAULT 'completed',
    invoice_discount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    invoice_discount_type VARCHAR(10) NOT NULL DEFAULT 'fixed' CHECK (invoice_discount_type IN ('fixed', 'percentage')),
    idempotency_key UUID UNIQUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sales_reference ON sales(reference_no);
CREATE INDEX idx_sales_created_at ON sales(created_at);

CREATE TABLE sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    product_id INT NOT NULL REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL, -- Historical snapshot
    sku VARCHAR(50) NOT NULL,
    unit_cost DECIMAL(15,4) NOT NULL, -- WAC at time of sale for COGS
    unit_price DECIMAL(15,4) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    net_unit_price DECIMAL(15,4) NOT NULL,
    discount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    discount_type VARCHAR(10) NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage')),
    discount_value DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    tax_rate DECIMAL(5,2) NOT NULL,
    tax_type VARCHAR(10) NOT NULL DEFAULT 'exclusive' CHECK (tax_type IN ('inclusive', 'exclusive')),
    tax_amount DECIMAL(15,4) NOT NULL,
    subtotal DECIMAL(15,4) NOT NULL
);

CREATE TABLE sale_payments (
    id SERIAL PRIMARY KEY,
    sale_id INT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    payment_method_id INT NOT NULL REFERENCES payment_methods(id),
    amount DECIMAL(15,4) NOT NULL,
    reference_note VARCHAR(255),
    created_by INT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. INVOICING & ZATCA COMPLIANCE
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    sale_id INT UNIQUE NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    invoice_no VARCHAR(50) UNIQUE NOT NULL, -- e.g. INV-202608-0001
    uuid UUID NOT NULL DEFAULT uuid_generate_v4(),
    previous_invoice_hash VARCHAR(255) NOT NULL,
    invoice_hash VARCHAR(255) NOT NULL,
    qr_data TEXT NOT NULL, -- Base64 encoded TLV format
    ubl_xml TEXT,
    einvoice_status einvoice_status_enum NOT NULL DEFAULT 'generated',
    submission_status submission_status_enum NOT NULL DEFAULT 'not_submitted',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_invoices_no ON invoices(invoice_no);

-- 8. INVENTORY LEDGER & STOCK MOVEMENTS
CREATE TABLE stock_movements (
    id BIGSERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id),
    quantity DECIMAL(10,2) NOT NULL, -- Positive for IN, Negative for OUT
    type stock_movement_type_enum NOT NULL,
    reference_id INT, -- Links to sale_id, purchase_id, etc.
    reference_type VARCHAR(30),
    unit_cost DECIMAL(15,4) NOT NULL, -- Value at movement timestamp
    user_id INT NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(type);

CREATE TABLE stock_adjustments (
    id SERIAL PRIMARY KEY,
    reference_no VARCHAR(50) UNIQUE NOT NULL,
    user_id INT NOT NULL REFERENCES users(id),
    product_id INT NOT NULL REFERENCES products(id),
    type stock_adjustment_type_enum NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    before_quantity DECIMAL(10,2) NOT NULL,
    after_quantity DECIMAL(10,2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. PURCHASES (PROCUREMENT)
CREATE TABLE purchases (
    id SERIAL PRIMARY KEY,
    reference_no VARCHAR(50) UNIQUE NOT NULL,
    supplier_invoice_no VARCHAR(100),
    supplier_id INT NOT NULL REFERENCES suppliers(id),
    user_id INT NOT NULL REFERENCES users(id),
    status purchase_status_enum NOT NULL DEFAULT 'received',
    payment_status payment_status_enum NOT NULL DEFAULT 'paid',
    subtotal DECIMAL(15,4) NOT NULL,
    total_tax DECIMAL(15,4) NOT NULL,
    shipping_cost DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    grand_total DECIMAL(15,4) NOT NULL,
    paid_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    due_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    total_discount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    idempotency_key UUID UNIQUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_items (
    id SERIAL PRIMARY KEY,
    purchase_id INT NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
    product_id INT NOT NULL REFERENCES products(id),
    net_unit_cost DECIMAL(15,4) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    discount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    tax_rate DECIMAL(5,2) NOT NULL,
    tax_type VARCHAR(10) NOT NULL DEFAULT 'exclusive' CHECK (tax_type IN ('inclusive', 'exclusive')),
    tax_amount DECIMAL(15,4) NOT NULL,
    subtotal DECIMAL(15,4) NOT NULL
);

CREATE TABLE purchase_payments (
    id SERIAL PRIMARY KEY,
    purchase_id INT NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
    payment_method_id INT NOT NULL REFERENCES payment_methods(id),
    amount DECIMAL(15,4) NOT NULL,
    reference_note VARCHAR(255),
    created_by INT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. RETURNS
CREATE TABLE sales_returns (
    id SERIAL PRIMARY KEY,
    reference_no VARCHAR(50) UNIQUE NOT NULL,
    sale_id INT NOT NULL REFERENCES sales(id),
    customer_id INT REFERENCES customers(id),
    user_id INT NOT NULL REFERENCES users(id),
    total_amount DECIMAL(15,4) NOT NULL,
    tax_amount DECIMAL(15,4) NOT NULL,
    refund_method_id INT NOT NULL REFERENCES payment_methods(id),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sales_return_items (
    id SERIAL PRIMARY KEY,
    return_id INT NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
    sale_item_id INT NOT NULL REFERENCES sale_items(id),
    product_id INT NOT NULL REFERENCES products(id),
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(15,4) NOT NULL,
    tax_amount DECIMAL(15,4) NOT NULL,
    allocated_discount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    subtotal DECIMAL(15,4) NOT NULL,
    restocked BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE purchase_returns (
    id SERIAL PRIMARY KEY,
    reference_no VARCHAR(50) UNIQUE NOT NULL,
    purchase_id INT NOT NULL REFERENCES purchases(id),
    supplier_id INT NOT NULL REFERENCES suppliers(id),
    user_id INT NOT NULL REFERENCES users(id),
    total_amount DECIMAL(15,4) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_return_items (
    id SERIAL PRIMARY KEY,
    return_id INT NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
    purchase_item_id INT NOT NULL REFERENCES purchase_items(id),
    product_id INT NOT NULL REFERENCES products(id),
    quantity DECIMAL(10,2) NOT NULL,
    unit_cost DECIMAL(15,4) NOT NULL,
    tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    subtotal DECIMAL(15,4) NOT NULL
);

-- 11. FINANCIAL LEDGERS
CREATE TABLE customer_ledger (
    id BIGSERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id),
    user_id INT NOT NULL REFERENCES users(id),
    type customer_ledger_type_enum NOT NULL,
    reference_id INT, -- sale_id, return_id, etc.
    debit DECIMAL(15,4) NOT NULL DEFAULT 0.0000, -- Increases Receivable
    credit DECIMAL(15,4) NOT NULL DEFAULT 0.0000, -- Decreases Receivable
    balance DECIMAL(15,4) NOT NULL, -- Running Balance
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_customer_ledger ON customer_ledger(customer_id);

CREATE TABLE supplier_ledger (
    id BIGSERIAL PRIMARY KEY,
    supplier_id INT NOT NULL REFERENCES suppliers(id),
    user_id INT NOT NULL REFERENCES users(id),
    type supplier_ledger_type_enum NOT NULL,
    reference_id INT,
    debit DECIMAL(15,4) NOT NULL DEFAULT 0.0000, -- Decreases Payable
    credit DECIMAL(15,4) NOT NULL DEFAULT 0.0000, -- Increases Payable
    balance DECIMAL(15,4) NOT NULL, -- Running Balance
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_supplier_ledger ON supplier_ledger(supplier_id);

-- 12. OPERATIONAL EXPENSES
CREATE TABLE expense_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    reference_no VARCHAR(50) UNIQUE NOT NULL,
    category_id INT NOT NULL REFERENCES expense_categories(id),
    user_id INT NOT NULL REFERENCES users(id),
    amount DECIMAL(15,4) NOT NULL,
    tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    date DATE NOT NULL,
    payment_method_id INT NOT NULL REFERENCES payment_methods(id),
    note TEXT,
    attachment_path VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. HELD SALES (POS SUSPEND/RESUME)
CREATE TABLE held_sales (
    id SERIAL PRIMARY KEY,
    reference_no VARCHAR(50) UNIQUE NOT NULL,
    user_id INT NOT NULL REFERENCES users(id),
    customer_id INT REFERENCES customers(id),
    hold_note VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE held_sale_items (
    id SERIAL PRIMARY KEY,
    held_sale_id INT NOT NULL REFERENCES held_sales(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id),
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(15,4) NOT NULL,
    discount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    tax_rate DECIMAL(5,2),
    tax_type VARCHAR(10) DEFAULT 'exclusive'
);

-- 14. AUDIT TRAIL, SETTINGS & BACKUP METADATA
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    entity_table VARCHAR(50) NOT NULL,
    entity_id INT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_table, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

CREATE TABLE settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_group VARCHAR(50) NOT NULL DEFAULT 'general', -- 'shop', 'tax', 'currency', 'theme', 'hardware', 'pos'
    setting_value TEXT NOT NULL,
    description VARCHAR(255),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DEFAULT SETTINGS SEED (EVERY ASPECT IS DYNAMICALLY CUSTOMIZABLE)
-- 1. Shop Profile
INSERT INTO settings (setting_key, setting_group, setting_value, description, is_public) VALUES
('shop_name_en', 'shop', 'AL-NOOR SUPERMARKET & HYPERMARKET', 'Shop Primary Name', true),
('shop_name_ar', 'shop', 'AL-NOOR RETAIL POS', 'Shop Secondary / POS Name', true),
('shop_cr_number', 'shop', '1010123456', 'Commercial Registration Number', true),
('shop_vat_number', 'shop', '300123456700003', 'VAT / Tax Registration Number', true),
('shop_phone', 'shop', '+966 11 456 7890', 'Shop Contact Phone', true),
('shop_email', 'shop', 'info@alnoorshop.com', 'Shop Email Address', true),
('shop_address', 'shop', 'King Fahd Road, Riyadh, Saudi Arabia', 'Shop Physical Address', true),
('shop_logo_path', 'shop', '/uploads/branding/logo.webp', 'Shop Brand Logo', true),
('receipt_header', 'shop', 'Welcome to Al-Noor Supermarket', 'Receipt Top Header Message', true),
('receipt_footer', 'shop', 'Thank you for shopping with us! Return within 7 days with receipt.', 'Receipt Bottom Note', true);

-- 2. Tax & VAT
INSERT INTO settings (setting_key, setting_group, setting_value, description, is_public) VALUES
('default_tax_rate_id', 'tax', '1', 'Default Tax Rate ID for new products', false),
('tax_calculation_mode', 'tax', 'inclusive', 'Default POS Price Mode (inclusive or exclusive)', true),
('tax_label', 'tax', 'VAT (15%)', 'Tax Label displayed on Invoices', true);

-- 3. Currency, Format & Regional Locale
INSERT INTO settings (setting_key, setting_group, setting_value, description, is_public) VALUES
('currency_code', 'currency', 'SAR', 'Active Currency ISO Code', true),
('currency_symbol', 'currency', 'SAR', 'Currency Symbol or Abbreviation', true),
('currency_symbol_position', 'currency', 'after', 'Symbol Position: before or after', true),
('currency_decimals', 'currency', '2', 'Display Decimals (2 or 3)', true),
('decimal_separator', 'currency', '.', 'Decimal Separator Char', true),
('thousands_separator', 'currency', ',', 'Thousands Grouping Char', true),
('timezone', 'currency', 'Asia/Riyadh', 'System Standard Timezone', true),
('date_format', 'currency', 'YYYY-MM-DD', 'Display Date Format', true);

-- 4. UI Theme & Appearance
INSERT INTO settings (setting_key, setting_group, setting_value, description, is_public) VALUES
('theme_mode_default', 'theme', 'system', 'Default Theme: light, dark, or system', true),
('theme_accent_color', 'theme', '#2563eb', 'Primary Brand Accent Color Hex', true),
('ui_font_scale', 'theme', '100%', 'Global UI Zoom & Font Scale: 90%, 100%, 110%, 120%, 130%', true),
('pos_density_mode', 'theme', 'comfortable', 'POS Screen Density: comfortable or compact', true);

-- 5. POS & Peripheral Hardware
INSERT INTO settings (setting_key, setting_group, setting_value, description, is_public) VALUES
('scale_barcode_prefix', 'hardware', '20,21,28,29', 'Comma-separated weighing scale prefixes', true),
('scale_barcode_format', 'hardware', 'EAN13_WEIGHT_5_DIGIT', 'Scale Barcode Encoding Spec', true),
('direct_escpos_print', 'hardware', 'false', 'Enable direct raw network/USB thermal printing', true),
('escpos_printer_ip', 'hardware', '192.168.1.200', 'Raw ESC/POS Printer IP Address', false),
('cash_drawer_auto_kick', 'hardware', 'true', 'Auto-pulse drawer kick on cash sale', true),
('barcode_audio_beep', 'hardware', 'true', 'Play audio beep on successful barcode scan', true),
('allow_negative_stock', 'pos', 'false', 'Allow selling below zero stock', false),
('quick_tender_presets', 'pos', '50,100,200,500', 'Quick cash payment preset values', true);

CREATE TABLE backup_logs (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,
    backup_type VARCHAR(20) NOT NULL, -- daily, weekly, monthly, manual
    local_status VARCHAR(20) NOT NULL DEFAULT 'completed',
    verification_status VARCHAR(20) NOT NULL DEFAULT 'unverified', -- verified, failed, unverified
    verified_at TIMESTAMPTZ,
    restored_row_count INT,
    remote_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    remote_url VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. NOTIFICATIONS
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    reference_type VARCHAR(50),
    reference_id INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- ADDITIONAL PERFORMANCE INDEXES
CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sales_user ON sales(user_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_stock_movements_created ON stock_movements(created_at);
CREATE INDEX idx_stock_movements_ref ON stock_movements(reference_id, reference_type);
```

---

## H. Architectural Sub-Systems

### 1. Product Images Architecture
- Upload via `multipart/form-data` to `POST /api/v1/products/:id/images`
- Server validates: max 5MB, JPG/PNG/WebP only
- Sharp processes: resize to 800x800 max, generate 200x200 thumbnail
- Save to `./data/uploads/products/{product_id}/{uuid}.webp`
- Save thumbnail to `./data/uploads/products/{product_id}/thumb_{uuid}.webp`
- Record in `product_images` table
- Serve via `GET /api/v1/uploads/products/:productId/:filename` (static file serving)

### 2. Super Shop Produce Scale & Barcode Decoding
- Weight-embedded barcodes (`20 IIIII WWWWW C`): extracts 5-digit PLU and converts 5-digit weight (e.g. `01450` = `1.450 kg`).
- Price-embedded barcodes (`21 IIIII PPPPP C`): extracts 5-digit PLU and calculates quantity based on product unit selling price.

### 3. Notification System Architecture
- Notification triggers: low stock, batch expiring within threshold, backup failure, large sale, cash discrepancy

---

## I. REST API Architecture & Endpoints

The backend is built with **Node.js & Fastify / TypeScript**, providing blazing performance ($>30,000$ req/sec throughput for POS counter speed), strict runtime validation using **Zod**, and standard JSON responses.

### 1. Standard Response Envelope
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
  timestamp: string;
}
```

### 2. Complete API Endpoint Matrix

| Method | Endpoint | Description | Role Required |
| :--- | :--- | :--- | :--- |
| **Auth** | | | |
| `POST` | `/api/v1/auth/login` | Authenticate & issue JWT in HTTP-only cookie | Public |
| `POST` | `/api/v1/auth/logout` | Clear auth token cookie | All |
| `GET` | `/api/v1/auth/me` | Fetch active profile, role & shift session | All |
| **Products & Catalog** | | | |
| `GET` | `/api/v1/products` | Paginated product search & catalog | All |
| `GET` | `/api/v1/products/scan/:barcode` | High-speed barcode/scale barcode scanner endpoint | All |
| `GET` | `/api/v1/products/quick-plu` | Fast PLU produce list for touchscreen grid | All |
| `POST` | `/api/v1/products` | Create new product | Manager |
| `PUT` | `/api/v1/products/:id` | Update product details / selling price | Manager |
| `DELETE`| `/api/v1/products/:id` | Deactivate / soft-delete product | Manager |
| `POST` | `/api/v1/products/:id/images` | Upload product image | Manager |
| `DELETE`| `/api/v1/products/:id/images/:imageId` | Delete product image | Manager |
| `PUT` | `/api/v1/products/:id/images/:imageId/primary` | Set primary image | Manager |
| `GET` | `/api/v1/uploads/products/:productId/:filename` | Serve product image | All |
| `GET` | `/api/v1/categories` | List categories | All |
| `POST` | `/api/v1/categories` | Create category | Manager |
| `GET` | `/api/v1/brands` | List brands | All |
| `GET` | `/api/v1/units` | List units of measure | All |
| `GET` | `/api/v1/tax-rates` | List all tax rates | All |
| `POST` | `/api/v1/tax-rates` | Create/Update dynamic tax rate | Manager |
| `GET` | `/api/v1/inventory/stock` | View cached & computed stock levels | All |
| `GET` | `/api/v1/inventory/stock-snapshot` | Delta sync for reconnected offline POS terminals | All |
| `GET` | `/api/v1/inventory/movements/:id` | Complete movement history for SKU | Manager |
| `POST` | `/api/v1/inventory/adjust` | Record manual adjustment with reason | Manager |
| `GET` | `/api/v1/products/barcode-label/:id` | Generate CODE128 thermal sticker label | Manager |
| **Batches & Expiry (Perishables)** | | | |
| `GET` | `/api/v1/batches` | List inventory batches by product | All |
| `GET` | `/api/v1/batches/expiring` | Expiring items alert (7/15/30 days) | Manager |
| **Promotions & Deals** | | | |
| `GET` | `/api/v1/promotions` | List active promotions & bundle rules | All |
| `POST` | `/api/v1/promotions` | Create promotional campaign | Manager |
| `PUT` | `/api/v1/promotions/:id` | Update / toggle promotion status | Manager |
| `DELETE`| `/api/v1/promotions/:id` | Remove promotion | Manager |
| **Sales & POS** | | | |
| `POST` | `/api/v1/sales` | Finalize POS transaction with payments | All |
| `GET` | `/api/v1/sales` | List sales history (Sales Exec: Own only) | All |
| `GET` | `/api/v1/sales/:id` | Retrieve sale breakdown & invoice | All |
| `POST` | `/api/v1/sales/:id/void`| Same-day transaction void with reason | Manager |
| `POST` | `/api/v1/sales/hold` | Save current cart state to held sales | All |
| `GET` | `/api/v1/sales/hold` | Retrieve active held sales | All |
| `DELETE`| `/api/v1/sales/hold/:id`| Release / delete held sale | All |
| **Invoices & Hardware** | | | |
| `GET` | `/api/v1/invoices/:id` | Get invoice data + ZATCA QR TLV string | All |
| `GET` | `/api/v1/invoices/:id/pdf` | Render printable 80mm / A4 PDF invoice | All |
| `POST` | `/api/v1/hardware/print-receipt`| Send ESC/POS raw thermal print payload | All |
| `POST` | `/api/v1/hardware/drawer-kick` | Send RJ11 drawer kick pulse (audited) | All |
| **Returns** | | | |
| `POST` | `/api/v1/returns/sales` | Process customer sales return & refund | Manager / Exec (PIN) |
| `GET` | `/api/v1/returns/sales` | List sales return records | All |
| `POST` | `/api/v1/returns/purchases` | Return goods to vendor | Manager |
| `GET` | `/api/v1/returns/purchases` | List purchase return records | All |
| **Procurement** | | | |
| `GET` | `/api/v1/purchases` | List purchase orders & receipts | Manager |
| `POST` | `/api/v1/purchases` | Receive goods, update WAC & payables | Manager |
| `GET` | `/api/v1/purchases/:id` | Purchase breakdown | Manager |
| `POST` | `/api/v1/purchases/:id/void` | Void purchase order | Manager |
| **People (CRM & Vendors)** | | | |
| `GET` | `/api/v1/customers` | Search customer directory | All |
| `POST` | `/api/v1/customers` | Register customer | All |
| `GET` | `/api/v1/customers/:id/ledger` | View customer credit/debit history | Manager |
| `POST` | `/api/v1/customers/:id/pay` | Record customer credit payment | Manager |
| `GET` | `/api/v1/suppliers` | List suppliers & outstanding balances | Manager |
| `POST` | `/api/v1/suppliers` | Register supplier | Manager |
| `GET` | `/api/v1/suppliers/:id/ledger` | View accounts payable ledger | Manager |
| `POST` | `/api/v1/suppliers/:id/pay` | Record payment to supplier | Manager |
| **Cash Registers & Expenses** | | | |
| `POST` | `/api/v1/cash/open` | Open cashier shift with float balance | All |
| `POST` | `/api/v1/cash/close` | Submit blind cash count, Mada card terminal slip total & close shift | All |
| `GET` | `/api/v1/cash/status` | Current active shift status | All |
| `GET` | `/api/v1/expenses` | List operational expenses | Manager |
| `POST` | `/api/v1/expenses` | Record expense (Till vs Bank) | Manager |
| **Reports, Analytics & WS** | | | |
| `GET` | `/api/v1/reports/dashboard` | Aggregated KPI stats & charts | Manager |
| `GET` | `/api/v1/reports/sales` | Sales breakdown by date, product, user | Manager |
| `GET` | `/api/v1/reports/profit` | P&L Statement (Revenue - COGS - Expenses) | Manager |
| `GET` | `/api/v1/reports/inventory`| Stock valuation based on WAC | Manager |
| `GET` | `/api/v1/reports/vat` | Saudi ZATCA Input vs Output VAT filing | Manager |
| `GET` | `/api/v1/reports/export/:type` | Export report (PDF/CSV/Excel) | Manager |
| `GET` | `/api/v1/ws/events` | WebSocket/SSE real-time events | All |
| **Settings & Customization Management** | | | |
| `GET` | `/api/v1/settings` | Retrieve all public settings | All |
| `GET` | `/api/v1/settings/all` | Retrieve all settings including private | Manager |
| `PUT` | `/api/v1/settings/group/:group` | Batch update settings by group (shop/tax/currency/theme/hardware) | Manager |
| `PUT` | `/api/v1/settings` | Update single setting key/value | Manager |
| `POST` | `/api/v1/settings/logo` | Upload custom shop logo | Manager |
| **System, Maintenance & Notifications** | | | |
| `GET` | `/api/v1/health` | System health check and uptime | Public |
| `GET` | `/api/v1/audit-logs` | Immutable audit log trail | Manager |
| `GET` | `/api/v1/backup/status` | Current backup health, verification & log history | Manager |
| `POST` | `/api/v1/backup/trigger` | Trigger immediate snapshot & upload | Manager |
| `POST` | `/api/v1/backup/verify` | Trigger automated sandbox test restore against DB2 | Manager |
| `GET` | `/api/v1/notifications` | Get user notifications | All |
| `PUT` | `/api/v1/notifications/:id/read` | Mark notification read | All |

---

## J. Core Business Logic & Financial Formulas

### 1. Saudi VAT Calculation Engine & Rounding Policy
Saudi VAT standard rate is 15.00%. All monetary values are calculated in `DECIMAL(15,4)` and rounded using **Round Half-Up** to 2 decimal places:

#### A. Tax Exclusive (VAT added on top)
$$\text{Tax Amount} = \text{Taxable Amount} \times \left(\frac{\text{Tax Rate}}{100}\right)$$
$$\text{Line Total} = \text{Taxable Amount} + \text{Tax Amount}$$

#### B. Tax Inclusive (VAT extracted from gross price)
$$\text{Base Price} = \frac{\text{Gross Price}}{1 + \frac{\text{Tax Rate}}{100}}$$
$$\text{Tax Amount} = \text{Gross Price} - \text{Base Price}$$
$$\text{Line Total} = \text{Quantity} \times \text{Gross Price}$$

#### C. Proportional Invoice Discount Allocation (ZATCA Compliant)
When a general invoice discount $D_{\text{inv}}$ is applied:
$$\text{Allocated Discount}_i = D_{\text{inv}} \times \left( \frac{\text{Gross Total}_i}{\sum \text{Gross Total}} \right)$$
$$\text{Net Taxable}_i = \text{Gross Total}_i - \text{Item Discount}_i - \text{Allocated Discount}_i$$
$$\text{Line VAT}_i = \text{Net Taxable}_i \times \left( \frac{\text{Tax Rate}_i}{100} \right)$$

### 2. Weighted Average Cost (WAC) Recalculation
The product cost price (`cost_price`) is recalculated *strictly* upon receiving inventory from a Purchase Order:
$$\text{New WAC} = \frac{(\text{Current Stock} \times \text{Current WAC}) + (\text{Received Qty} \times \text{Purchase Net Unit Cost})}{\text{Current Stock} + \text{Received Qty}}$$
If `Current_Stock + Received_Qty = 0`, retain existing `cost_price` unchanged.

### 3. Stock Reconciliation Background Job
A scheduled background job runs nightly to compare `products.current_stock` against `SUM(quantity) FROM stock_movements`. Any detected mismatch triggers a high-priority system notification to the Manager.

### 4. ZATCA E-Invoicing TLV QR Code Encoder (TypeScript Implementation)
```typescript
export function generateZatcaTLVQR(
  sellerName: string,
  vatNumber: string,
  timestampIso: string,
  invoiceTotal: string,
  vatTotal: string
): string {
  const getTLVBuffer = (tag: number, value: string): Buffer => {
    const valueBuffer = Buffer.from(value, 'utf8');
    const tagBuffer = Buffer.from([tag]);
    const lengthBuffer = Buffer.from([valueBuffer.length]);
    return Buffer.concat([tagBuffer, lengthBuffer, valueBuffer]);
  };

  const tlvParts = [
    getTLVBuffer(1, sellerName),
    getTLVBuffer(2, vatNumber),
    getTLVBuffer(3, timestampIso),
    getTLVBuffer(4, invoiceTotal),
    getTLVBuffer(5, vatTotal),
  ];

  return Buffer.concat(tlvParts).toString('base64');
}
```

---

## K. Project Directory Structure (Node.js + Next.js Monorepo)

```text
e:/ShopManagement/
├── docker-compose.yml              # Local production orchestrator
├── .env.example                    # Template environment variables
├── package.json                    # Monorepo workspaces root
│
├── data/                           # Local host bind mounts
│   ├── postgres_live/              # Primary DB storage
│   ├── postgres_recovery/          # Secondary DB storage
│   └── uploads/                    
│       └── products/               # Product images
│
├── apps/
│   ├── api/                        # Node.js Fastify Backend API
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── config/             # DB connection, JWT secrets, env loader
│   │   │   ├── modules/            # Domain modules
│   │   │   │   ├── auth/           # Login, JWT, password verification
│   │   │   │   ├── products/       # Master catalog, barcode scan
│   │   │   │   ├── inventory/      # Stock movement ledger, adjustments
│   │   │   │   ├── sales/          # POS counter, cart, atomic checkout
│   │   │   │   ├── purchases/      # POs, receiving, WAC costing
│   │   │   │   ├── invoices/       # ZATCA TLV QR, PDF templates
│   │   │   │   ├── returns/        # Sales & purchase returns
│   │   │   │   ├── ledgers/        # Customer & supplier double-entry
│   │   │   │   ├── cash/           # Shifts, opening float, blind count
│   │   │   │   ├── reports/        # P&L, VAT filing, inventory valuation
│   │   │   │   ├── backup/         # Snapshot worker, encryption, S3 sync
│   │   │   │   ├── notifications/  # WebSocket/SSE, Notification models
│   │   │   │   └── uploads/        # Sharp image processing
│   │   │   ├── middleware/         # RBAC guard, error handler, rate limit
│   │   │   ├── db/                 # PostgreSQL pool, Prisma/Drizzle schema
│   │   │   └── server.ts           # Fastify entrypoint
│   │   └── package.json
│   │
│   └── web/                        # Next.js 14/15 Frontend (App Router)
│       ├── Dockerfile
│       ├── src/
│       │   ├── app/                # App Router pages
│       │   │   ├── (auth)/login/   # Login screen
│       │   │   ├── (dashboard)/    # Back-office management
│       │   │   │   ├── dashboard/  # KPI metrics & graphs
│       │   │   │   ├── products/   # Master catalog CRUD
│       │   │   │   ├── inventory/  # Ledger & adjustments
│       │   │   │   ├── purchases/  # Procurement
│       │   │   │   ├── customers/  # CRM & due ledgers
│       │   │   │   ├── suppliers/  # Vendors & payables
│       │   │   │   ├── expenses/   # Operational expenses
│       │   │   │   ├── reports/    # Financial & VAT reports
│       │   │   │   └── settings/   # Shop info, tax & backup controls
│       │   │   └── pos/            # Fast-action POS terminal screen
│       │   ├── components/         # Reusable UI components
│       │   │   ├── pos/            # Product grid, cart panel, tender modal
│       │   │   ├── ui/             # Buttons, inputs, modals, badges
│       │   │   ├── charts/         # ApexCharts wrappers
│       │   │   └── images/         # Image uploaders, galleries
│       │   ├── hooks/              # Barcode scanner listener, cart store
│       │   │   ├── useWebSocket.ts
│       │   │   └── useNotifications.ts
│       │   ├── lib/                # API client, SAR currency formatters
│       │   └── styles/             # Tailwind CSS tokens
│       └── package.json
│
└── backups/                        # Local automated snapshot vault
```

---

## L. Docker & Docker Compose Deployment Configuration

```yaml
version: '3.8'

networks:
  shop_network:
    driver: bridge

services:
  # 1. Primary Live PostgreSQL Database
  postgres_live:
    image: postgres:16-alpine
    container_name: shop_postgres_live
    restart: always
    environment:
      POSTGRES_DB: shop_live_db
      POSTGRES_USER: shop_admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - ./data/postgres_live:/var/lib/postgresql/data
      - ./docker/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "127.0.0.1:5432:5432" # Bound locally; not exposed to network
    networks:
      - shop_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shop_admin -d shop_live_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  # 2. Secondary Recovery PostgreSQL Database
  postgres_recovery:
    image: postgres:16-alpine
    container_name: shop_postgres_recovery
    restart: always
    environment:
      POSTGRES_DB: shop_recovery_db
      POSTGRES_USER: recovery_admin
      POSTGRES_PASSWORD: ${RECOVERY_DB_PASSWORD}
    volumes:
      - ./data/postgres_recovery:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5433:5432"
    networks:
      - shop_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U recovery_admin -d shop_recovery_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  # 3. Node.js Fastify API Backend
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    container_name: shop_api
    restart: always
    depends_on:
      postgres_live:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://shop_admin:${DB_PASSWORD}@postgres_live:5432/shop_live_db
      JWT_SECRET: ${JWT_SECRET}
      BACKUP_ENCRYPTION_KEY: ${BACKUP_ENCRYPTION_KEY}
      S3_BUCKET: ${S3_BUCKET}
      S3_ACCESS_KEY: ${S3_ACCESS_KEY}
      S3_SECRET_KEY: ${S3_SECRET_KEY}
    volumes:
      - ./backups:/backups
      - ./data/uploads:/app/uploads
    networks:
      - shop_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/v1/health"]
      interval: 15s
      timeout: 5s
      retries: 3

  # 4. Next.js Web Frontend
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    container_name: shop_web
    restart: always
    depends_on:
      api:
        condition: service_healthy
    ports:
      - "80:3000" # Serves POS counter and back-office across shop LAN
    networks:
      - shop_network
```

---

## M. 8-Phase Implementation Roadmap

* **Phase 1: Environment & Foundation Setup (Week 1)**
  * Scaffolding Monorepo with Next.js, Node.js Fastify, and PostgreSQL.
  * Execute PostgreSQL DDL migrations and seed default Admin/Manager account.
  * Implement JWT authentication, HTTP-only session cookies, and RBAC middleware.
* **Phase 2: Master Data & Catalog (Week 2)**
  * Build Categories, Brands, Units of Measure, Tax Rates, and Products CRUD.
  * Integrate hardware barcode scanner listener (`keydown` detection with buffer timing).
* **Phase 3: Inventory Movement Ledger & Procurement (Week 3)**
  * Implement immutable `stock_movements` ledger engine.
  * Build Purchase Order receiving with automatic Weighted Average Cost (WAC) recalculation.
  * Implement manual Stock Adjustments with mandatory audit reason logging.
* **Phase 4: Fast-Action POS Counter & Invoicing (Week 4-5)**
  * Develop POS counter interface: 48px search, product card grid, responsive cart panel.
  * Implement split-tender payment modal (Cash, Mada, Card, Split).
  * Build atomic checkout transaction with `SELECT ... FOR UPDATE` locking.
  * Implement ZATCA Phase 1 TLV QR Code generation and 80mm thermal receipt printing.
* **Phase 5: Returns, Ledgers & Cash Shifts (Week 6)**
  * Build Sales Returns (with original invoice linkage and restock/damage routing).
  * Build Customer Credit (Receivable) and Supplier (Payable) double-entry ledgers.
  * Build Cash Register shift management (Open float, Blind count closing, Z-Report).
* **Phase 6: Financial Reports & Manager Dashboard (Week 7)**
  * Implement Manager Dashboard with KPI cards, sales trends, and profit margins.
  * Build P&L statement, Inventory Valuation report, and ZATCA VAT filing summary.
* **Phase 7: Two-Database Backup & Disaster Recovery (Week 8)**
  * Implement automated daily snapshot worker with AES-256-GCM encryption.
  * Implement sandbox test restoration into Secondary Recovery PostgreSQL.
  * Implement non-blocking remote sync to AWS S3 / Cloudflare R2.
* **Phase 8: UAT, Hardening & Local Shop Deployment (Week 9)**
  * Conduct barcode scanner stress testing ($>500$ scans/hr).
  * Conduct simulated network outage and power failure recovery drills.
  * Deploy Docker Compose stack onto shop on-premise server.
