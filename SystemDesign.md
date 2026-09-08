# Comprehensive System Design Document: Retail Shop Management System

**Platform Architecture:** Node.js (Backend) | Next.js & React (Frontend) | PostgreSQL (Database)  
**Target Market:** Saudi Arabia (KSA)  
**User Base:** Bangladeshi Shop Workforce (English UI)  
**Deployment Model:** Local-First / Shop LAN Server with Two-Database Automated Cloud Backup  

---

## Document Role & Precedence

`Instructions.md` is the authoritative product specification and single source of truth. This document translates those requirements into implementation guidance, database structures, API contracts, operational procedures, and testable acceptance criteria. It must not introduce a conflicting business rule, permission, financial calculation, or scope expansion. `DesignSystem.md` defines the shared UI component contract; implementation uses it rather than inventing page-specific controls.

When this document conflicts with `Instructions.md`, implementation must follow `Instructions.md` and this guide must be updated in the same change. If a UI decision conflicts with either document, `DesignSystem.md` must be updated after the authoritative requirement is resolved.

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
* **Currency:** Saudi Riyal (`SAR`), formatted to 2 decimal places. Financial storage strictly uses `DECIMAL(15,4)` and APIs send money as decimal strings. Each issued document snapshots its currency, precision, tax mode, and legal seller profile; later settings changes cannot alter it.
* **Language & Interface:** Application navigation, forms, validation, and reports use clear professional English tailored to Bangladeshi expatriate retail staff. Legal invoice/credit-note renderings support Arabic alongside English where required by the current ZATCA rules.
* **Timezone:** Arab Standard Time (`Asia/Riyadh` / UTC+3). Database stores timestamps in UTC (ISO 8601); UI renders local AST time.

### 4. Architectural Priorities
1. **Data Correctness:** Zero orphan records, transaction atomicity, foreign-key integrity.
2. **Financial Precision:** Exact decimal arithmetic without JavaScript or database floating-point approximations.
3. **Inventory Integrity:** Immutable stock ledger where every unit change is recorded as a movement.
4. **Local-First LAN Operation:** Core POS, sales, inventory, and reporting work seamlessly inside the shop LAN without an active internet connection.
5. **Verified Disaster Recovery:** Local primary database for live operations, an isolated restore-testing database, encrypted off-site backups, and tested recovery objectives. The restore database is not high availability because it shares the local server failure domain.
6. **Auditability:** Complete, unalterable audit trail recording every state change and user action.
7. **Usability & POS Speed:** Sub-second barcode lookup, rapid cart manipulation, and single-click receipt generation.

---

## B. User Roles & Permissions Matrix (RBAC)

The application enforces server-side Role-Based Access Control on every API route and database query. Frontend route guards and UI masking complement backend security.

```mermaid
flowchart TD
    Req[Incoming API Request] --> Auth[Revocable Session & Cookie Authentication]
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
| | `sales.cancel_draft` | Yes | No | Only an unissued draft may be cancelled |
| | `invoices.issue_credit_note` | Yes | With Approval | Post-issue correction/return creates a linked credit note |
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
Production runs on a managed Linux server with an encrypted ext4 data disk. Docker Desktop/Windows bind mounts are UAT/development-only; PostgreSQL must not rely on desktop virtualization or NTFS semantics in production.

Host-managed data paths (data survives ordinary Docker operations):
├── ./data/postgres_live/      → PostgreSQL primary data
├── ./data/postgres_recovery/  → Recovery database data  
├── ./data/uploads/products/   → Product images
└── ./backups/                 → Encrypted backup snapshots

Safe operations (data preserved):
✅ docker compose down
✅ docker compose up --build
✅ docker compose down && docker compose up
✅ docker system prune (only when no persistent host path is selected for deletion)
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
- A transactional outbox is inserted in the same transaction as a sale/purchase/adjustment. A worker publishes its events only after commit.
- When a sale completes, broadcast stock changes to all connected terminals using a monotonic event sequence.
- **Event types:** `STOCK_UPDATE`, `SALE_COMPLETED`, `LOW_STOCK_ALERT`, `CASH_SESSION_UPDATE`
- **Connection management:** auto-reconnect with exponential backoff; a reconnect uses its last event sequence and performs a full snapshot when the cursor has expired.

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
| - WAL archiving enabled to a separate local vault for point-in-time recovery  |
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
| - Restore-testing sandbox only    |   | - Off-site disaster protection        |
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
* Encrypted locally using **AES-256-GCM** with a fresh nonce per artifact and a persisted authentication tag, using a dedicated shop master key.
* A companion `.sha256` checksum file is generated for cryptographic tamper-detection.
* **Encryption Key Security:** The runtime key is a protected deployment secret; a recovery copy is printed on paper and stored in a physical safe. Never store a recovery key with encrypted artifacts. Loss of the key means complete loss of backup restorability.

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
| **Database Corruption** | WAL archive plus verified encrypted snapshots in local vault. | Maintenance-only restore workflow selects a verified recovery point, restores to a clean target, runs integrity/report checks, and requires Manager confirmation before cutover. |
| **Server Hardware / SSD Loss**| Remote encrypted cloud backups stored in Cloudflare R2 / S3. | Setup new PC $\rightarrow$ install Docker $\rightarrow$ pull remote backup $\rightarrow$ decrypt & execute `pg_restore`. |
| **Accidental Stock Mismatch** | Full `audit_logs` and `stock_movements` ledger trail. | Run Stock Audit Report $\rightarrow$ identify delta $\rightarrow$ post Stock Adjustment with reference. |

---

## F. Detailed User Flows

### 1. Zero-Privilege POS Authentication & Sales Executive Till Model

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Staff / Manager
    participant Login as Login Screen (/login)
    participant POS as Next.js POS UI (/pos)
    participant API as Fastify Backend
    participant DB as PostgreSQL (DB 1)

    Note over Staff,API: ZERO-PRIVILEGE POS: Manager never operates POS under Manager role
    Staff->>Login: Enter 5-Digit PIN (Zero-Click)
    Login->>API: POST /api/v1/auth/login { pin: "12345" }
    API->>DB: Query User by pin_code & verify is_active
    DB-->>API: User record (id, role='manager', full_name)
    API->>API: Sign JWT with effective role='sales_executive', actualRole='manager'
    API-->>Login: 200 OK + JWT Token + Cookie
    Login->>POS: Redirect to /pos (as Sales Executive Cashier)
    POS->>API: GET /api/v1/auth/me
    API-->>POS: Effective Role='sales_executive', Active Shift Status
    alt No active cash drawer shift
        POS->>Staff: Prompt Starting Float & Terminal Name
        Staff->>POS: Enter Float (e.g. SAR 150.00) + Terminal "Terminal-01"
        POS->>API: POST /api/v1/cash/open
        API->>DB: INSERT INTO cash_sessions (status='open', user_id, opening_balance)
        DB-->>API: Shift Registered
    end
```

### 2. POS Counter Sale & Split Payment Flow
```mermaid
sequenceDiagram
    autonumber
    actor Exec as Sales Executive (Cashier)
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
    API->>DB: Lock register, products, and FEFO batches in stable ID order
    API->>DB: Re-price server-side; verify sufficient base-unit stock and non-expired batch quantities
    API->>DB: INSERT INTO sales (reference_no, subtotal, tax, grand_total, status)
    API->>DB: INSERT INTO sale_items (immutable prices, tax snapshots, rounding, promotion source)
    API->>DB: INSERT INTO sale_item_batch_allocations (batch, base_quantity, original_cogs)
    API->>DB: INSERT INTO sale_payments (payment_method_id, amount)
    API->>DB: INSERT INTO stock_movements (type='sale', batch_id, quantity_base = -qty, unit_cost)
    API->>DB: INSERT INTO customer_ledger (if credit/due applied)
    API->>DB: INSERT INTO cash_movements (if cash received into active session)
    API->>DB: INSERT INTO invoices (immutable legal payload, lifecycle, hashes, QR)
    API->>DB: INSERT INTO audit_logs and transactional_outbox (action='SALE_CREATE')
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
        API->>DB: INSERT INTO purchase_items (base_qty, net_unit_cost, allocated_landed_cost, tax)
        API->>DB: INSERT INTO product_batches where required (expiry, base_qty, effective_cost)
        API->>DB: INSERT INTO stock_movements (type='purchase', batch_id, quantity_base = +qty, unit_cost)
        API->>DB: SELECT cost_price, current_stock FROM products WHERE id = ? FOR UPDATE
        API->>API: Calculate New WAC from prior value plus receipt effective cost; recoverable VAT excluded
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
        API->>DB: INSERT INTO stock_movements (type='sales_return_restock', original_batch, quantity_base = +qty)
    else Item is Damaged
        API->>DB: INSERT INTO damaged-return disposition and valuation write-off (no saleable-stock increase)
    end
    API->>DB: INSERT INTO refund allocations, cash_movements (if cash) OR customer_ledger (credit)
    API->>DB: INSERT INTO linked credit note and immutable audit/outbox events
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
    UI->>Cashier: Prompt for Physical Cash Blind Count without displaying expected totals
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
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. ENUMS
CREATE TYPE user_role_enum AS ENUM ('manager', 'sales_executive');
CREATE TYPE tax_type_enum AS ENUM ('inclusive', 'exclusive');
CREATE TYPE payment_status_enum AS ENUM ('paid', 'partial', 'unpaid');
CREATE TYPE sale_status_enum AS ENUM ('draft', 'completed', 'cancelled');
CREATE TYPE purchase_status_enum AS ENUM ('pending', 'ordered', 'received', 'cancelled');
CREATE TYPE stock_movement_type_enum AS ENUM (
    'opening', 'purchase', 'sale', 'sales_return_restock', 'purchase_return',
    'adjustment_in', 'adjustment_out', 'damage', 'loss'
);
CREATE TYPE stock_adjustment_type_enum AS ENUM ('addition', 'subtraction');
CREATE TYPE customer_ledger_type_enum AS ENUM ('invoice', 'payment', 'return', 'adjustment');
CREATE TYPE supplier_ledger_type_enum AS ENUM ('bill', 'payment', 'return', 'adjustment');
CREATE TYPE cash_session_status_enum AS ENUM ('open', 'closed');
CREATE TYPE cash_movement_type_enum AS ENUM ('cash_in', 'cash_out');
CREATE TYPE cash_movement_source_enum AS ENUM (
    'opening_float', 'sale', 'expense', 'refund', 'manual_deposit', 'manual_withdrawal'
);
CREATE TYPE invoice_document_type_enum AS ENUM ('tax_invoice', 'simplified_tax_invoice', 'credit_note', 'debit_note');
CREATE TYPE einvoice_status_enum AS ENUM ('draft', 'issued', 'reported', 'cleared', 'rejected', 'failed');
CREATE TYPE submission_status_enum AS ENUM ('not_required', 'pending', 'submitted', 'accepted', 'rejected');
CREATE TYPE refund_destination_enum AS ENUM ('cash', 'card', 'bank', 'customer_credit');

-- 2. USERS & ROLES
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    role user_role_enum NOT NULL DEFAULT 'sales_executive',
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    pin_hash VARCHAR(255), -- Argon2 hash; PIN values are never stored in plaintext
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
    rate DECIMAL(5,2) NOT NULL DEFAULT 15.00 CHECK (rate >= 0 AND rate <= 100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tax_rates (name, rate, is_active, is_default)
VALUES ('Standard VAT 15%', 15.00, TRUE, TRUE);

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
    packaging_multiplier DECIMAL(18,6) NOT NULL DEFAULT 1.000000 CHECK (packaging_multiplier > 0), -- legacy/default conversion only
    tax_rate_id INT NOT NULL REFERENCES tax_rates(id),
    tax_type tax_type_enum NOT NULL DEFAULT 'exclusive',
    cost_price DECIMAL(15,4) NOT NULL DEFAULT 0.0000, -- Weighted Average Cost
    wholesale_price DECIMAL(15,4),
    selling_price DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    current_stock DECIMAL(18,3) NOT NULL DEFAULT 0.000, -- Base-unit atomic cache for POS lookup
    min_stock_level DECIMAL(18,3) NOT NULL DEFAULT 5.000 CHECK (min_stock_level >= 0),
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
CREATE UNIQUE INDEX uq_products_plu_active ON products(plu_code) WHERE plu_code IS NOT NULL AND NOT is_deleted;

CREATE TABLE product_unit_conversions (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    unit_id INT NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    base_unit_id INT NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    multiplier_to_base DECIMAL(18,6) NOT NULL CHECK (multiplier_to_base > 0),
    is_purchase_unit BOOLEAN NOT NULL DEFAULT FALSE,
    is_sale_unit BOOLEAN NOT NULL DEFAULT FALSE,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (effective_to IS NULL OR effective_to > effective_from)
);

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
CREATE UNIQUE INDEX uq_product_images_primary ON product_images(product_id) WHERE is_primary;

-- 3.2 PRODUCT BATCHES (PERISHABLES & EXPIRY TRACKING)
CREATE TABLE product_batches (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_number VARCHAR(100) NOT NULL,
    expiry_date DATE NOT NULL,
    purchase_item_id INT, -- FK is added after purchase_items is created below
    cost_price DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    initial_quantity DECIMAL(18,3) NOT NULL CHECK (initial_quantity >= 0),
    current_quantity DECIMAL(18,3) NOT NULL CHECK (current_quantity >= 0),
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
    promotion_id INT NOT NULL REFERENCES promotions(id) ON DELETE RESTRICT,
    buy_product_id INT REFERENCES products(id),
    buy_quantity DECIMAL(18,3) NOT NULL DEFAULT 1.000,
    get_product_id INT REFERENCES products(id),
    get_quantity DECIMAL(18,3) NOT NULL DEFAULT 0.000,
    bundle_price DECIMAL(15,4),
    discount_percentage DECIMAL(5,2),
    discount_amount DECIMAL(15,4)
);
CREATE INDEX idx_promotion_rules_promotion ON promotion_rules(promotion_id);

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

CREATE TABLE registers (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    printer_mode VARCHAR(20) NOT NULL DEFAULT 'browser' CHECK (printer_mode IN ('browser', 'local_agent', 'network')),
    printer_endpoint VARCHAR(255),
    card_terminal_name VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cash_sessions (
    id SERIAL PRIMARY KEY,
    register_id INT REFERENCES registers(id) ON DELETE RESTRICT,
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
    closing_note TEXT,
    terminal_name VARCHAR(100) DEFAULT 'Terminal-01',
    sequence_number INT,
    previous_session_id INT REFERENCES cash_sessions(id),
    carry_forward_balance DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    close_type VARCHAR(20) DEFAULT 'normal', -- 'normal', 'takeover', 'force_closed'
    force_closed_by INT REFERENCES users(id),
    force_close_reason TEXT,
    opening_card_balance DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    carry_forward_card_balance DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Enforce single open POS session globally
CREATE UNIQUE INDEX IF NOT EXISTS uq_single_open_cash_session ON cash_sessions ((1)) WHERE status = 'open';

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

-- Discrepancy Adjustments Ledger (Immutable)
CREATE TABLE IF NOT EXISTS session_adjustments (
    id BIGSERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES cash_sessions(id) ON DELETE RESTRICT,
    adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('opening', 'closing')),
    amount DECIMAL(15,4) NOT NULL,
    description TEXT NOT NULL,
    created_by INT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_session_adjustments_session ON session_adjustments(session_id);

-- 6. SALES & POS CORE
CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    reference_no VARCHAR(50) UNIQUE NOT NULL, -- e.g. SAL-202608-0001
    user_id INT NOT NULL REFERENCES users(id),
    cash_session_id INT NOT NULL REFERENCES cash_sessions(id) ON DELETE RESTRICT,
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
    idempotency_key UUID NOT NULL,
    request_fingerprint CHAR(64) NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_sales_idempotency_scope ON sales(user_id, cash_session_id, idempotency_key);
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
    quantity DECIMAL(18,3) NOT NULL CHECK (quantity > 0),
    base_quantity DECIMAL(18,3) NOT NULL CHECK (base_quantity > 0),
    net_unit_price DECIMAL(15,4) NOT NULL,
    discount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    discount_type VARCHAR(10) NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage')),
    discount_value DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    tax_rate DECIMAL(5,2) NOT NULL,
    tax_type VARCHAR(10) NOT NULL DEFAULT 'exclusive' CHECK (tax_type IN ('inclusive', 'exclusive')),
    tax_amount DECIMAL(15,4) NOT NULL,
    allocated_invoice_discount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    rounding_adjustment DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    promotion_id INT REFERENCES promotions(id) ON DELETE RESTRICT,
    subtotal DECIMAL(15,4) NOT NULL
);

CREATE TABLE sale_item_batch_allocations (
    id BIGSERIAL PRIMARY KEY,
    sale_item_id INT NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
    batch_id INT NOT NULL REFERENCES product_batches(id) ON DELETE RESTRICT,
    quantity_base DECIMAL(18,3) NOT NULL CHECK (quantity_base > 0),
    unit_cost DECIMAL(15,4) NOT NULL CHECK (unit_cost >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sale_item_id, batch_id)
);

CREATE TABLE sale_payments (
    id SERIAL PRIMARY KEY,
    sale_id INT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    payment_method_id INT NOT NULL REFERENCES payment_methods(id),
    amount DECIMAL(15,4) NOT NULL,
    terminal_reference VARCHAR(255),
    created_by INT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. INVOICING & ZATCA COMPLIANCE
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    sale_id INT REFERENCES sales(id) ON DELETE RESTRICT,
    invoice_no VARCHAR(50) UNIQUE NOT NULL, -- e.g. INV-202608-0001
    uuid UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    document_type invoice_document_type_enum NOT NULL,
    parent_invoice_id INT REFERENCES invoices(id) ON DELETE RESTRICT,
    invoice_counter BIGINT NOT NULL CHECK (invoice_counter > 0),
    previous_invoice_hash VARCHAR(255),
    invoice_hash VARCHAR(255),
    qr_data TEXT, -- Base64 TLV; document-type-specific requiredness is validated in service/SDK
    ubl_xml TEXT NOT NULL,
    human_readable_payload JSONB NOT NULL,
    legal_snapshot JSONB NOT NULL,
    configuration_version INT NOT NULL,
    certificate_reference VARCHAR(255),
    einvoice_status einvoice_status_enum NOT NULL DEFAULT 'draft',
    submission_status submission_status_enum NOT NULL DEFAULT 'not_required',
    issued_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((einvoice_status = 'draft') OR issued_at IS NOT NULL)
);
CREATE INDEX idx_invoices_no ON invoices(invoice_no);
CREATE UNIQUE INDEX uq_invoice_per_sale ON invoices(sale_id)
    WHERE sale_id IS NOT NULL AND document_type IN ('tax_invoice', 'simplified_tax_invoice');
CREATE UNIQUE INDEX uq_invoices_counter_scope ON invoices(document_type, invoice_counter);

CREATE TABLE invoice_submission_attempts (
    id BIGSERIAL PRIMARY KEY,
    invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    correlation_id UUID NOT NULL,
    operation VARCHAR(30) NOT NULL,
    request_metadata JSONB,
    response_metadata JSONB,
    status submission_status_enum NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. INVENTORY LEDGER & STOCK MOVEMENTS
CREATE TABLE stock_movements (
    id BIGSERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id),
    batch_id INT REFERENCES product_batches(id) ON DELETE RESTRICT,
    quantity_base DECIMAL(18,3) NOT NULL CHECK (quantity_base <> 0), -- Positive for IN, Negative for OUT
    type stock_movement_type_enum NOT NULL,
    reference_id INT, -- Links to sale_id, purchase_id, etc.
    reference_type VARCHAR(30),
    unit_cost DECIMAL(15,4) NOT NULL CHECK (unit_cost >= 0), -- Value at movement timestamp
    user_id INT NOT NULL REFERENCES users(id),
    notes TEXT,
    correlation_id UUID NOT NULL,
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
    quantity DECIMAL(18,3) NOT NULL CHECK (quantity > 0),
    before_quantity DECIMAL(18,3) NOT NULL,
    after_quantity DECIMAL(18,3) NOT NULL,
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
    idempotency_key UUID NOT NULL,
    request_fingerprint CHAR(64) NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_purchases_idempotency_scope ON purchases(user_id, idempotency_key);

CREATE TABLE purchase_items (
    id SERIAL PRIMARY KEY,
    purchase_id INT NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
    product_id INT NOT NULL REFERENCES products(id),
    net_unit_cost DECIMAL(15,4) NOT NULL,
    quantity DECIMAL(18,3) NOT NULL CHECK (quantity > 0), -- entered transaction quantity
    base_quantity DECIMAL(18,3) NOT NULL CHECK (base_quantity > 0),
    discount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    allocated_landed_cost DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    effective_net_unit_cost DECIMAL(15,4) NOT NULL CHECK (effective_net_unit_cost >= 0),
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

-- This FK is intentionally added after purchase_items so a clean schema migration succeeds.
ALTER TABLE product_batches
    ADD CONSTRAINT fk_product_batches_purchase_item
    FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id) ON DELETE RESTRICT;

-- 10. RETURNS
CREATE TABLE sales_returns (
    id SERIAL PRIMARY KEY,
    reference_no VARCHAR(50) UNIQUE NOT NULL,
    sale_id INT NOT NULL REFERENCES sales(id),
    customer_id INT REFERENCES customers(id),
    user_id INT NOT NULL REFERENCES users(id),
    total_amount DECIMAL(15,4) NOT NULL,
    tax_amount DECIMAL(15,4) NOT NULL,
    credit_note_invoice_id INT UNIQUE REFERENCES invoices(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sales_return_items (
    id SERIAL PRIMARY KEY,
    return_id INT NOT NULL REFERENCES sales_returns(id) ON DELETE RESTRICT,
    sale_item_id INT NOT NULL REFERENCES sale_items(id),
    product_id INT NOT NULL REFERENCES products(id),
    quantity DECIMAL(18,3) NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(15,4) NOT NULL,
    tax_amount DECIMAL(15,4) NOT NULL,
    allocated_discount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    subtotal DECIMAL(15,4) NOT NULL,
    restocked BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE sales_return_refunds (
    id SERIAL PRIMARY KEY,
    sales_return_id INT NOT NULL REFERENCES sales_returns(id) ON DELETE RESTRICT,
    destination refund_destination_enum NOT NULL,
    payment_method_id INT REFERENCES payment_methods(id) ON DELETE RESTRICT,
    cash_session_id INT REFERENCES cash_sessions(id) ON DELETE RESTRICT,
    amount DECIMAL(15,4) NOT NULL CHECK (amount > 0),
    original_terminal_reference VARCHAR(255),
    created_by INT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((destination = 'customer_credit') = (payment_method_id IS NULL))
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
    return_id INT NOT NULL REFERENCES purchase_returns(id) ON DELETE RESTRICT,
    purchase_item_id INT NOT NULL REFERENCES purchase_items(id),
    product_id INT NOT NULL REFERENCES products(id),
    quantity DECIMAL(18,3) NOT NULL CHECK (quantity > 0),
    base_quantity DECIMAL(18,3) NOT NULL CHECK (base_quantity > 0),
    unit_cost DECIMAL(15,4) NOT NULL,
    tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    subtotal DECIMAL(15,4) NOT NULL
);

-- 11. FINANCIAL LEDGERS
-- Ledger writes lock the owning customer/supplier row. `balance` is a verified
-- balance-after snapshot for fast reads; reports can recompute it from append-only entries.
CREATE TABLE customer_ledger (
    id BIGSERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id),
    user_id INT NOT NULL REFERENCES users(id),
    type customer_ledger_type_enum NOT NULL,
    reference_id INT, -- sale_id, return_id, etc.
    debit DECIMAL(15,4) NOT NULL DEFAULT 0.0000 CHECK (debit >= 0), -- Increases Receivable
    credit DECIMAL(15,4) NOT NULL DEFAULT 0.0000 CHECK (credit >= 0), -- Decreases Receivable
    balance DECIMAL(15,4) NOT NULL, -- Running Balance
    CHECK ((debit = 0) <> (credit = 0)),
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
    debit DECIMAL(15,4) NOT NULL DEFAULT 0.0000 CHECK (debit >= 0), -- Decreases Payable
    credit DECIMAL(15,4) NOT NULL DEFAULT 0.0000 CHECK (credit >= 0), -- Increases Payable
    balance DECIMAL(15,4) NOT NULL, -- Running Balance
    CHECK ((debit = 0) <> (credit = 0)),
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
    quantity DECIMAL(18,3) NOT NULL CHECK (quantity > 0),
    base_quantity DECIMAL(18,3) NOT NULL CHECK (base_quantity > 0),
    unit_price DECIMAL(15,4) NOT NULL,
    discount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    tax_rate DECIMAL(5,2),
    tax_type VARCHAR(10) DEFAULT 'exclusive'
);

-- 14. AUDIT TRAIL, SETTINGS & BACKUP METADATA
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id), -- nullable for failed/unauthenticated login events
    action VARCHAR(50) NOT NULL,
    entity_table VARCHAR(50) NOT NULL,
    entity_id INT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    reason TEXT,
    correlation_id UUID,
    previous_entry_hash CHAR(64),
    entry_hash CHAR(64) NOT NULL,
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
    version INT NOT NULL DEFAULT 1,
    effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    requires_step_up BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by INT REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE settings_history (
    id BIGSERIAL PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT NOT NULL,
    version INT NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL,
    changed_by INT NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (setting_key, version)
);

-- DEFAULT SETTINGS SEED (EVERY ASPECT IS DYNAMICALLY CUSTOMIZABLE)
-- 1. Shop Profile
INSERT INTO settings (setting_key, setting_group, setting_value, description, is_public) VALUES
('shop_name_en', 'shop', 'AL-NOOR SUPERMARKET & HYPERMARKET', 'Shop Primary Name', true),
('shop_name_ar', 'shop', 'متجر النور', 'Shop Arabic Legal Name', true),
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
('theme_mode_default', 'theme', 'light', 'Default Theme: light or dark', true),
('theme_accent_color', 'theme', '#1e40af', 'Primary Brand Accent Color Hex', true),
('ui_font_scale', 'theme', '100%', 'Global UI Scale: 100% Standard or 110% Comfortable', true),
('pos_density_mode', 'theme', 'comfortable', 'POS Screen Density: comfortable or compact', true);

-- 5. POS & Peripheral Hardware
INSERT INTO settings (setting_key, setting_group, setting_value, description, is_public) VALUES
('scale_barcode_prefix', 'hardware', '20,21,28,29', 'Comma-separated weighing scale prefixes', true),
('scale_barcode_format', 'hardware', 'EAN13_WEIGHT_5_DIGIT', 'Scale Barcode Encoding Spec', true),
('direct_escpos_print', 'hardware', 'false', 'Enable trusted local-agent or allow-listed network printing', true),
('escpos_printer_ip', 'hardware', '192.168.1.200', 'Raw ESC/POS Printer IP Address', false),
('cash_drawer_auto_kick', 'hardware', 'true', 'Auto-pulse drawer kick on cash sale', true),
('barcode_audio_beep', 'hardware', 'true', 'Play audio beep on successful barcode scan', true),
('allow_manager_negative_stock_exception', 'pos', 'false', 'Allow documented per-sale Manager exception only', false),
('quick_tender_presets', 'pos', '50,100,200,500', 'Quick cash payment preset values', true);

UPDATE settings
SET requires_step_up = TRUE
WHERE setting_key IN (
    'shop_vat_number', 'shop_cr_number', 'default_tax_rate_id', 'tax_calculation_mode',
    'currency_code', 'currency_decimals', 'timezone', 'allow_manager_negative_stock_exception',
    'escpos_printer_ip'
);

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

-- An outbox row is inserted in the same transaction as its source change and
-- published only after commit. sequence_no is the reconnect cursor for clients.
CREATE TABLE outbox_events (
    sequence_no BIGSERIAL PRIMARY KEY,
    topic VARCHAR(80) NOT NULL,
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id INT NOT NULL,
    payload JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    publish_attempts INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_outbox_unpublished ON outbox_events(sequence_no) WHERE published_at IS NULL;

-- ADDITIONAL PERFORMANCE INDEXES
CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sales_user ON sales(user_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_stock_movements_created ON stock_movements(created_at);
CREATE INDEX idx_stock_movements_ref ON stock_movements(reference_id, reference_type);

-- Migration tests must verify these triggers execute under the application's DB role.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sales_updated_at BEFORE UPDATE ON sales
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_purchases_updated_at BEFORE UPDATE ON purchases
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_no_update_delete
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

-- The production application role must not own audit_logs and must not have UPDATE/DELETE grants.
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;
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
- Weight-embedded barcodes (`20 IIIII WWWWW C`): extracts 5-digit PLU and converts 5-digit weight (e.g. `01450` = `1.450 kg`) into the product base unit without reducing precision.
- Price-embedded barcodes (`21 IIIII PPPPP C`): extracts 5-digit PLU and calculates quantity based on product unit selling price.

### 3. Notification System Architecture
- Notification triggers: low stock, batch expiring within threshold, backup failure, large sale, cash discrepancy
- Source transactions insert an `outbox_events` row atomically. A publisher retries after failures and clients reconnect by `sequence_no`, receiving a complete snapshot when their cursor is no longer retained.

### 4. UI Component Library Implementation

`DesignSystem.md` is implemented as a shared frontend component library, not a visual reference to copy manually. The web application provides tokenized primitives for Button, IconButton, Field, SearchField, MoneyField, Select/Combobox, RadioGroup, Checkbox, Switch, Chip, Badge, Card, Table, ProductListItem, ProductTile, CartLine, FormShell, Dialog, Drawer, Toast, EmptyState, and page toolbar.

- Every component consumes semantic light/dark tokens. Page modules compose these components and may not introduce one-off colors, control shapes, field behaviour, or action variants.
- `ThemeProvider` supports exactly `light` and `dark`; it applies the selected per-user preference before hydration. There is no system-auto theme mode.
- `UiScaleProvider` supports exactly `100%` and `110%`, with `100%` as the default. Token/rem-based sizing makes both scales automatic; no per-page zoom CSS is permitted.
- Field components serialize money and quantity as decimal strings, preserve labels/accessibility semantics, and render server-returned validation errors beside the affected control.
- Permission-aware presentation occurs in the server/API response first. For example, Sales Executive product responses omit cost/margin fields; the UI never receives and merely hides them.
- Component stories and visual regression tests cover Light/Dark themes, both allowed scales, focus/keyboard states, long product names, large amounts, validation errors, and restricted-role views.

---

## I. REST API Architecture & Endpoints

The backend is built with **Node.js & Fastify / TypeScript**, strict runtime validation using **Zod**, and standard JSON responses. Production performance targets are measured on the shop's actual server: barcode lookup p95 under 100 ms on the LAN and checkout p95 under 500 ms under the tested concurrent-terminal load. Do not claim a generic requests-per-second figure without a reproducible load test.

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
| `POST` | `/api/v1/auth/login` | Authenticate and establish a revocable HTTP-only session | Public |
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
| `GET` | `/api/v1/batches` | List inventory batches, expiry and quarantine state | Manager |
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
| `POST` | `/api/v1/sales/:id/cancel-draft`| Cancel an unissued draft with reason | Manager |
| `POST` | `/api/v1/sales/hold` | Save current cart state to held sales | All |
| `GET` | `/api/v1/sales/hold` | Retrieve active held sales | All |
| `DELETE`| `/api/v1/sales/hold/:id`| Release / delete held sale | All |
| **Invoices & Hardware** | | | |
| `GET` | `/api/v1/invoices/:id` | Get authorized invoice/credit-note data + QR | Owner/Manager |
| `GET` | `/api/v1/invoices/:id/pdf` | Render authorized 80mm / A4 legal document | Owner/Manager |
| `POST` | `/api/v1/invoices/:id/credit-notes` | Issue linked credit note from validated return/correction | Manager / approved Executive |
| `POST` | `/api/v1/hardware/print-receipt`| Print an authorized issued-document ID through the configured register | Owner/Manager |
| `POST` | `/api/v1/hardware/drawer-kick` | Audited, step-up-authorized RJ11 drawer kick | Manager approval |
| **Returns** | | | |
| `POST` | `/api/v1/returns/sales` | Process customer sales return & refund | Manager / Exec (PIN) |
| `GET` | `/api/v1/returns/sales` | List sales return records | All |
| `POST` | `/api/v1/returns/purchases` | Return goods to vendor | Manager |
| `GET` | `/api/v1/returns/purchases` | List purchase return records | All |
| **Procurement** | | | |
| `GET` | `/api/v1/purchases` | List purchase orders & receipts | Manager |
| `POST` | `/api/v1/purchases` | Receive goods, update WAC & payables | Manager |
| `GET` | `/api/v1/purchases/:id` | Purchase breakdown | Manager |
| `POST` | `/api/v1/purchases/:id/cancel-draft` | Cancel an unreceived purchase draft | Manager |
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
| `POST` | `/api/v1/registers/:id/shifts/open` | Open register shift with float balance | Authorized register user |
| `POST` | `/api/v1/registers/:id/shifts/:shiftId/close` | Submit blind count, terminal slip total & close the shift | Shift owner / Manager |
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
Saudi VAT standard rate is configurable and must be verified against current Saudi requirements before release. All monetary values are calculated in `DECIMAL(15,4)` (and in TypeScript via a decimal library), then rounded using **Round Half-Up** to the document display precision. API monetary values are serialized as decimal strings, never JavaScript numbers.

#### A. Tax Exclusive (VAT added on top)
$$\text{Tax Amount} = \text{Taxable Amount} \times \left(\frac{\text{Tax Rate}}{100}\right)$$
$$\text{Line Total} = \text{Taxable Amount} + \text{Tax Amount}$$

#### B. Tax Inclusive (VAT extracted from gross price)
$$\text{Base Price} = \frac{\text{Gross Price}}{1 + \frac{\text{Tax Rate}}{100}}$$
$$\text{Tax Amount} = \text{Gross Price} - \text{Base Price}$$
$$\text{Line Total} = \text{Quantity} \times \text{Gross Price}$$

#### C. Proportional Invoice Discount Allocation & Reconciliation
When a general invoice discount $D_{\text{inv}}$ is applied, allocate it against each line's post-item-discount amount at four-decimal precision:
$$\text{Allocated Discount}_i = D_{\text{inv}} \times \left( \frac{\text{Line Amount After Item Discount}_i}{\sum \text{Line Amount After Item Discount}} \right)$$

Then calculate tax according to the line's tax mode. For inclusive prices, first remove VAT from the discounted gross amount:
$$\text{Net Taxable}_i = \frac{\text{Gross After Discount}_i}{1 + \frac{\text{Tax Rate}_i}{100}}$$
$$\text{Line VAT}_i = \text{Gross After Discount}_i - \text{Net Taxable}_i$$

For exclusive prices, calculate VAT from the discounted net amount. Finally assign any display-rounding residual using largest remainder and stable line-ID order, persist `rounding_adjustment`, and assert that the sum of line totals exactly equals the document grand total.

### 2. Perpetual Weighted Average Cost (WAC) Recalculation
The product cost price (`cost_price`) is recalculated only on a locked stock receipt using base-unit quantities. `Effective Receipt Unit Cost` includes allocated landed cost and excludes recoverable input VAT:
$$\text{New WAC} = \frac{(\text{Current Stock} \times \text{Current WAC}) + (\text{Received Base Qty} \times \text{Effective Receipt Unit Cost})}{\text{Current Stock} + \text{Received Base Qty}}$$
If `Current_Stock + Received_Base_Qty = 0`, retain existing `cost_price` unchanged.

Sale lines retain the WAC at time of sale. Customer returns reverse that recorded cost; supplier returns use the original receipt/batch cost where available. Damage and manual adjustments follow documented valuation policies and never silently rewrite historical COGS.

### 3. Stock Reconciliation Background Job
A scheduled background job runs nightly to compare `products.current_stock` against `SUM(quantity_base) FROM stock_movements` and also reconciles each batch balance. Any detected mismatch triggers a high-priority system notification to the Manager; it never auto-corrects stock.

### 4. Phase-1-Size ZATCA TLV QR Encoder (TypeScript Implementation)
This helper creates only the five visible TLV fields. It is not an integration-phase implementation: it does not create canonical signed UBL, a cryptographic stamp, certificate lifecycle, hash chain, clearance/reporting request, response persistence, or official acceptance. The production document service must validate against the current ZATCA specification and SDK.
```typescript
export function generatePhase1ZatcaTlvQr(
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
├── docker/
│   ├── nginx.conf                   # TLS/LAN reverse-proxy and WebSocket routing
│   └── postgres.conf                # WAL archive and production PostgreSQL settings
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
│   │   │   ├── config/             # DB connection, session secrets, env loader
│   │   │   ├── modules/            # Domain modules
│   │   │   │   ├── auth/           # Login, revocable sessions, password verification
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
│       │   ├── components/         # Shared DesignSystem.md component library
│       │   │   ├── pos/            # Product grid, cart panel, tender modal
│       │   │   ├── ui/             # Buttons, fields, choices, chips, cards, tables, dialogs, feedback
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
      - ./docker/postgres.conf:/etc/postgresql/postgresql.conf:ro
      - ./backups/wal:/var/lib/postgresql/wal-archive
    command: ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]
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
      SESSION_SECRET: ${SESSION_SECRET}
      CSRF_SECRET: ${CSRF_SECRET}
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
    networks:
      - shop_network

  # 5. Single TLS/LAN entry point. API and web containers are not exposed directly.
  nginx:
    image: nginx:1.27-alpine
    container_name: shop_nginx
    restart: always
    depends_on:
      web:
        condition: service_started
      api:
        condition: service_healthy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./data/uploads:/srv/uploads:ro
      - ./data/tls:/etc/nginx/tls:ro
    networks:
      - shop_network
```

---

## M. 8-Phase Implementation Roadmap

* **Phase 1: Environment & Foundation Setup (Week 1)**
  * Scaffold the monorepo, Linux deployment baseline, and Nginx TLS entry point.
  * Execute PostgreSQL migrations from a clean database in CI; seed tax rates and the initial Manager only through a secure bootstrap flow.
  * Implement revocable sessions, CSRF protection, RBAC middleware, and Manager step-up approvals.
* **Phase 2: Master Data & Catalog (Week 2)**
  * Build Categories, Brands, Units of Measure, Tax Rates, and Products CRUD.
  * Integrate hardware barcode scanner listener (`keydown` detection with buffer timing).
* **Phase 3: Inventory Movement Ledger & Procurement (Week 3)**
  * Implement immutable `stock_movements`, base-unit conversions, batch allocation, FEFO, and reconciliation.
  * Build receiving with locked perpetual WAC recalculation, landed-cost allocation, and batch/expiry capture.
  * Implement manual Stock Adjustments with mandatory audit reason logging.
* **Phase 4: Fast-Action POS Counter & Invoicing (Week 4-5)**
  * Develop POS counter interface: 48px search, product card grid, responsive cart panel.
  * Implement split-tender payment modal (Cash, Mada, Card, Split).
  * Build atomic checkout with stable-order register/product/batch locks, idempotency fingerprints, and transactional outbox events.
  * Implement immutable legal documents, Phase-1-sized TLV QR output, bilingual templates, and trusted print-agent/network-printer integration.
* **Phase 5: Returns, Ledgers & Cash Shifts (Week 6)**
  * Build Sales Returns with original allocation linkage, refund allocations, restock/damage routing, and credit notes.
  * Build Customer Credit (Receivable) and Supplier (Payable) double-entry ledgers.
  * Build Cash Register shift management (Open float, Blind count closing, Z-Report).
* **Phase 6: Financial Reports & Manager Dashboard (Week 7)**
  * Implement Manager Dashboard with KPI cards, sales trends, and profit margins.
  * Build P&L statement, Inventory Valuation report, and ZATCA VAT filing summary.
* **Phase 7: Two-Database Backup & Disaster Recovery (Week 8)**
  * Implement automated snapshots and WAL archive with AES-256-GCM nonce/tag handling.
  * Implement sandbox test restoration, integrity/report checks, and uploaded-file recovery verification.
  * Implement non-blocking remote sync to AWS S3 / Cloudflare R2.
* **Phase 8: UAT, Hardening & Local Shop Deployment (Week 9)**
  * Conduct barcode scanner stress testing ($>500$ scans/hr), inclusive/exclusive VAT golden tests, two-terminal oversell tests, and idempotent timeout tests.
  * Conduct simulated LAN outage, power-failure, and full off-site restore drills; validate ZATCA documents against the current SDK/specification.
  * Deploy the Compose stack onto the managed on-premise Linux server with UPS and off-site backup monitoring.
