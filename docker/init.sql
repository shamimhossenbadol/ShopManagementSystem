-- ====================================================================
-- RETAIL SHOP MANAGEMENT SYSTEM - POSTGRESQL 16+ DATABASE SCHEMA
-- ====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('manager', 'sales_executive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE tax_type_enum AS ENUM ('inclusive', 'exclusive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_enum AS ENUM ('paid', 'partial', 'unpaid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE sale_status_enum AS ENUM ('completed', 'voided', 'draft');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE purchase_status_enum AS ENUM ('pending', 'ordered', 'received', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE stock_movement_type_enum AS ENUM (
        'opening', 'purchase', 'sale', 'return_in', 'return_out', 'adjustment', 'damage', 'loss'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE stock_adjustment_type_enum AS ENUM ('addition', 'subtraction');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE customer_ledger_type_enum AS ENUM ('invoice', 'payment', 'return', 'adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE supplier_ledger_type_enum AS ENUM ('bill', 'payment', 'return', 'adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE cash_session_status_enum AS ENUM ('open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE cash_movement_type_enum AS ENUM ('cash_in', 'cash_out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE cash_movement_source_enum AS ENUM (
        'opening_float', 'sale', 'expense', 'refund', 'manual_deposit', 'manual_withdrawal'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE einvoice_status_enum AS ENUM ('pending', 'generated', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE submission_status_enum AS ENUM ('not_submitted', 'submitted', 'accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. USERS & ROLES
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    role user_role_enum NOT NULL DEFAULT 'sales_executive',
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    pin_code VARCHAR(10), -- Quick authorization PIN
    pin_failed_attempts INT NOT NULL DEFAULT 0,
    pin_locked_until TIMESTAMPTZ,
    login_failed_attempts INT NOT NULL DEFAULT 0,
    login_locked_until TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PRODUCT CATALOG MASTER
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id INT REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS units (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    short_name VARCHAR(10) NOT NULL,
    allow_decimal BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS tax_rates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    rate DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    barcode VARCHAR(100) UNIQUE,
    plu_code VARCHAR(20), -- Produce scale PLU (e.g. 1042)
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id INT REFERENCES categories(id) ON DELETE SET NULL,
    brand_id INT REFERENCES brands(id) ON DELETE SET NULL,
    unit_id INT NOT NULL REFERENCES units(id),
    packaging_multiplier DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    tax_rate_id INT NOT NULL REFERENCES tax_rates(id),
    tax_type tax_type_enum NOT NULL DEFAULT 'exclusive',
    cost_price DECIMAL(15,4) NOT NULL DEFAULT 0.0000, -- Weighted Average Cost
    wholesale_price DECIMAL(15,4),
    selling_price DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    current_stock DECIMAL(10,2) NOT NULL DEFAULT 0.00, -- Denormalized atomic cache
    min_stock_level DECIMAL(10,2) NOT NULL DEFAULT 5.00,
    has_expiry BOOLEAN NOT NULL DEFAULT FALSE, -- Perishable flag
    is_weighable BOOLEAN NOT NULL DEFAULT FALSE, -- Variable-weight scale item
    is_quick_plu BOOLEAN NOT NULL DEFAULT FALSE, -- Fast PLU produce grid item
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_plu ON products(plu_code);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(current_stock);

CREATE TABLE IF NOT EXISTS product_images (
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

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);

-- 3.1 PRODUCT BATCHES (PERISHABLES & EXPIRY TRACKING)
CREATE TABLE IF NOT EXISTS product_batches (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_number VARCHAR(100) NOT NULL,
    expiry_date DATE NOT NULL,
    purchase_item_id INT,
    cost_price DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    initial_quantity DECIMAL(10,2) NOT NULL,
    current_quantity DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_batches_expiry ON product_batches(product_id, expiry_date);

-- 3.2 PROMOTIONS & DEALS ENGINE
DO $$ BEGIN
    CREATE TYPE promotion_type_enum AS ENUM ('buy_x_get_y', 'bundle_price', 'percentage_discount', 'fixed_discount');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS promotions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    type promotion_type_enum NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promotion_rules (
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

-- 4. CUSTOMERS & SUPPLIERS
CREATE TABLE IF NOT EXISTS suppliers (
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

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(100),
    vat_number VARCHAR(50),
    address TEXT,
    credit_limit DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    opening_balance DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- 5. PAYMENT METHODS & CASH REGISTERS
CREATE TABLE IF NOT EXISTS payment_methods (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_cash BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cash_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    status cash_session_status_enum NOT NULL DEFAULT 'open',
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    opening_balance DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    closing_balance DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    expected_balance DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    difference DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    terminal_card_total DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    terminal_card_expected DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    terminal_card_discrepancy DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    closing_note TEXT
);

CREATE TABLE IF NOT EXISTS cash_movements (
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
CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    reference_no VARCHAR(50) UNIQUE NOT NULL,
    user_id INT NOT NULL REFERENCES users(id),
    customer_id INT REFERENCES customers(id),
    total_items INT NOT NULL,
    subtotal DECIMAL(15,4) NOT NULL,
    total_discount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    invoice_discount DECIMAL(15,4) NOT NULL DEFAULT 0.0000, -- Original invoice-level discount input
    invoice_discount_type VARCHAR(10) NOT NULL DEFAULT 'fixed' CHECK (invoice_discount_type IN ('fixed', 'percentage')),
    total_tax DECIMAL(15,4) NOT NULL,
    grand_total DECIMAL(15,4) NOT NULL,
    paid_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    due_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    payment_status payment_status_enum NOT NULL DEFAULT 'paid',
    sale_status sale_status_enum NOT NULL DEFAULT 'completed',
    idempotency_key UUID UNIQUE, -- Client-generated key to prevent duplicate POS transactions
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_reference ON sales(reference_no);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);

CREATE TABLE IF NOT EXISTS sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    product_id INT NOT NULL REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    unit_cost DECIMAL(15,4) NOT NULL,
    unit_price DECIMAL(15,4) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    net_unit_price DECIMAL(15,4) NOT NULL,
    discount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    discount_type VARCHAR(10) NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage')),
    discount_value DECIMAL(15,4) NOT NULL DEFAULT 0.0000, -- Original input value before computation
    tax_rate DECIMAL(5,2) NOT NULL,
    tax_type VARCHAR(10) NOT NULL DEFAULT 'exclusive' CHECK (tax_type IN ('inclusive', 'exclusive')),
    tax_amount DECIMAL(15,4) NOT NULL,
    subtotal DECIMAL(15,4) NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_payments (
    id SERIAL PRIMARY KEY,
    sale_id INT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    payment_method_id INT NOT NULL REFERENCES payment_methods(id),
    amount DECIMAL(15,4) NOT NULL,
    reference_note VARCHAR(255),
    created_by INT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. INVOICING & ZATCA COMPLIANCE
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    sale_id INT UNIQUE NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    invoice_no VARCHAR(50) UNIQUE NOT NULL,
    uuid UUID NOT NULL DEFAULT uuid_generate_v4(),
    previous_invoice_hash VARCHAR(255) NOT NULL DEFAULT '0',
    invoice_hash VARCHAR(255) NOT NULL,
    qr_data TEXT NOT NULL,
    ubl_xml TEXT,
    einvoice_status einvoice_status_enum NOT NULL DEFAULT 'generated',
    submission_status submission_status_enum NOT NULL DEFAULT 'not_submitted',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_no ON invoices(invoice_no);

-- 8. INVENTORY LEDGER & STOCK MOVEMENTS
CREATE TABLE IF NOT EXISTS stock_movements (
    id BIGSERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id),
    quantity DECIMAL(10,2) NOT NULL,
    type stock_movement_type_enum NOT NULL,
    reference_id INT,
    reference_type VARCHAR(30), -- sale, purchase, sales_return, purchase_return, adjustment
    unit_cost DECIMAL(15,4) NOT NULL,
    user_id INT NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(type);

CREATE TABLE IF NOT EXISTS stock_adjustments (
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
CREATE TABLE IF NOT EXISTS purchases (
    id SERIAL PRIMARY KEY,
    reference_no VARCHAR(50) UNIQUE NOT NULL,
    supplier_invoice_no VARCHAR(100),
    supplier_id INT NOT NULL REFERENCES suppliers(id),
    user_id INT NOT NULL REFERENCES users(id),
    status purchase_status_enum NOT NULL DEFAULT 'received',
    payment_status payment_status_enum NOT NULL DEFAULT 'paid',
    subtotal DECIMAL(15,4) NOT NULL,
    total_discount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    total_tax DECIMAL(15,4) NOT NULL,
    shipping_cost DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    grand_total DECIMAL(15,4) NOT NULL,
    paid_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    due_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    idempotency_key UUID UNIQUE, -- Prevents duplicate purchase entries
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id SERIAL PRIMARY KEY,
    purchase_id INT NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
    product_id INT NOT NULL REFERENCES products(id),
    net_unit_cost DECIMAL(15,4) NOT NULL,
    discount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    quantity DECIMAL(10,2) NOT NULL,
    tax_rate DECIMAL(5,2) NOT NULL,
    tax_type VARCHAR(10) NOT NULL DEFAULT 'exclusive' CHECK (tax_type IN ('inclusive', 'exclusive')),
    tax_amount DECIMAL(15,4) NOT NULL,
    subtotal DECIMAL(15,4) NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_payments (
    id SERIAL PRIMARY KEY,
    purchase_id INT NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
    payment_method_id INT NOT NULL REFERENCES payment_methods(id),
    amount DECIMAL(15,4) NOT NULL,
    reference_note VARCHAR(255),
    created_by INT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. RETURNS
CREATE TABLE IF NOT EXISTS sales_returns (
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

CREATE TABLE IF NOT EXISTS sales_return_items (
    id SERIAL PRIMARY KEY,
    return_id INT NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
    sale_item_id INT NOT NULL REFERENCES sale_items(id),
    product_id INT NOT NULL REFERENCES products(id),
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(15,4) NOT NULL,
    tax_amount DECIMAL(15,4) NOT NULL,
    subtotal DECIMAL(15,4) NOT NULL,
    allocated_discount DECIMAL(15,4) NOT NULL DEFAULT 0.0000, -- Proportional discount from original sale
    restocked BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS purchase_returns (
    id SERIAL PRIMARY KEY,
    reference_no VARCHAR(50) UNIQUE NOT NULL,
    purchase_id INT NOT NULL REFERENCES purchases(id),
    supplier_id INT NOT NULL REFERENCES suppliers(id),
    user_id INT NOT NULL REFERENCES users(id),
    total_amount DECIMAL(15,4) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
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
CREATE TABLE IF NOT EXISTS customer_ledger (
    id BIGSERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id),
    user_id INT NOT NULL REFERENCES users(id),
    type customer_ledger_type_enum NOT NULL,
    reference_id INT,
    debit DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    credit DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    balance DECIMAL(15,4) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_ledger ON customer_ledger(customer_id);

CREATE TABLE IF NOT EXISTS supplier_ledger (
    id BIGSERIAL PRIMARY KEY,
    supplier_id INT NOT NULL REFERENCES suppliers(id),
    user_id INT NOT NULL REFERENCES users(id),
    type supplier_ledger_type_enum NOT NULL,
    reference_id INT,
    debit DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    credit DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    balance DECIMAL(15,4) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_ledger ON supplier_ledger(supplier_id);

-- 12. OPERATIONAL EXPENSES
CREATE TABLE IF NOT EXISTS expense_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    reference_no VARCHAR(50) UNIQUE NOT NULL,
    category_id INT NOT NULL REFERENCES expense_categories(id),
    user_id INT NOT NULL REFERENCES users(id),
    amount DECIMAL(15,4) NOT NULL,
    tax_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    date DATE NOT NULL,
    payment_method_id INT NOT NULL REFERENCES payment_methods(id),
    note TEXT,
    attachment_path VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. HELD SALES
CREATE TABLE IF NOT EXISTS held_sales (
    id SERIAL PRIMARY KEY,
    reference_no VARCHAR(50) UNIQUE NOT NULL,
    user_id INT NOT NULL REFERENCES users(id),
    customer_id INT REFERENCES customers(id),
    hold_note VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS held_sale_items (
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
CREATE TABLE IF NOT EXISTS audit_logs (
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

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_table, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_group VARCHAR(50) NOT NULL DEFAULT 'general',
    setting_value TEXT NOT NULL,
    description VARCHAR(255),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backup_logs (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,
    backup_type VARCHAR(20) NOT NULL,
    local_status VARCHAR(20) NOT NULL DEFAULT 'completed',
    verification_status VARCHAR(20) NOT NULL DEFAULT 'unverified',
    verified_at TIMESTAMPTZ,
    restored_row_count INT,
    remote_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    remote_url VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
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

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- 15. ADDITIONAL PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ref ON stock_movements(reference_type, reference_id);

-- ====================================================================
-- SEED INITIAL MASTER DATA
-- ====================================================================

-- 1. Default Units
INSERT INTO units (id, name, short_name, allow_decimal) VALUES
(1, 'Piece', 'pcs', FALSE),
(2, 'Box', 'box', FALSE),
(3, 'Kilogram', 'kg', TRUE),
(4, 'Liter', 'L', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 2. Default Tax Rates
INSERT INTO tax_rates (id, name, rate, is_active, is_default) VALUES
(1, 'Standard VAT 15%', 15.00, TRUE, TRUE),
(2, 'Zero-Rated VAT 0%', 0.00, TRUE, FALSE),
(3, 'VAT Exempt', 0.00, TRUE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- 3. Default Payment Methods
INSERT INTO payment_methods (id, name, code, is_active, is_cash) VALUES
(1, 'Cash', 'cash', TRUE, TRUE),
(2, 'Mada / Card', 'card', TRUE, FALSE),
(3, 'Bank Transfer', 'bank', TRUE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- 4. Default Categories
INSERT INTO categories (id, name, description) VALUES
(1, 'Groceries & Staples', 'Rice, oil, spices and daily food items'),
(2, 'Dairy & Beverages', 'Milk, juices, water and soft drinks'),
(3, 'Snacks & Confectionery', 'Chips, biscuits, chocolates'),
(4, 'Personal & Household', 'Soaps, detergents, cleaning products'),
(5, 'Fresh Produce & Fruits', 'Fresh vegetables, fruits, and loose items')
ON CONFLICT (id) DO NOTHING;

-- 5. Default Users
-- Passwords below are hashed with bcrypt for "admin123" and "sales123"
INSERT INTO users (id, role, username, email, password_hash, full_name, phone, pin_code, is_active) VALUES
(1, 'manager', 'admin', 'manager@alnoorshop.com', '$2b$10$M2nH3FzA144Zi1/O0LErb.5evVVJj11reUN1yFO2aARRwQLCKFZtu', 'Shamim Hossen (Manager)', '+966501234567', '12345', TRUE),
(2, 'sales_executive', 'cashier1', 'cashier1@alnoorshop.com', '$2b$10$RALPUd90MJ1i2REruAjZF.BIAMOTRc.ROS718ALiptTV7ygDBhp2C', 'Rafiq Ahmed (Sales Executive)', '+966559876543', '56789', TRUE)
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- 6. Default Walk-in Customer
INSERT INTO customers (id, name, phone, opening_balance) VALUES
(1, 'Walk-in Customer (General)', '0000000000', 0.0000)
ON CONFLICT (id) DO NOTHING;

-- 7. Default System Settings (100% UI Configurable)
-- 1. Shop Profile
INSERT INTO settings (setting_key, setting_group, setting_value, description, is_public) VALUES
('shop_name_en', 'shop', 'AL-NOOR SUPERMARKET & HYPERMARKET', 'Shop English Name', true),
('shop_name_ar', 'shop', 'AL-NOOR RETAIL POS', 'Shop Secondary / POS Name', true),
('shop_cr_number', 'shop', '1010123456', 'Commercial Registration Number', true),
('shop_vat_number', 'shop', '300123456700003', 'VAT / Tax Registration Number', true),
('shop_phone', 'shop', '+966 11 456 7890', 'Shop Contact Phone', true),
('shop_email', 'shop', 'info@alnoorshop.com', 'Shop Email Address', true),
('shop_address', 'shop', 'King Fahd Road, Riyadh, Saudi Arabia', 'Shop Physical Address', true),
('shop_closing_hour', 'shop', '00:00', 'Daily Shop Closing Hour (e.g. 00:00 for 12 AM)', true),
('shop_logo_path', 'shop', '', 'Shop Brand Logo URL or Path', true),
('receipt_header', 'shop', 'Welcome to Al-Noor Supermarket', 'Receipt Top Header Message', true),
('receipt_footer', 'shop', 'Thank you for shopping with us! Return within 7 days with invoice.', 'Receipt Bottom Note', true)
ON CONFLICT (setting_key) DO NOTHING;

-- 2. Tax & VAT Settings
INSERT INTO settings (setting_key, setting_group, setting_value, description, is_public) VALUES
('default_tax_rate_id', 'tax', '1', 'Default Tax Rate ID for newly created products', false),
('tax_calculation_mode', 'tax', 'inclusive', 'Default POS pricing mode (inclusive or exclusive)', true),
('tax_label', 'tax', 'VAT (15%)', 'Tax Label displayed on receipts', true)
ON CONFLICT (setting_key) DO NOTHING;

-- 3. Currency & Regional Locale
INSERT INTO settings (setting_key, setting_group, setting_value, description, is_public) VALUES
('currency_code', 'currency', 'SAR', 'Active Currency ISO Code', true),
('currency_symbol', 'currency', 'SAR', 'Currency Symbol or Display Abbreviation', true),
('currency_symbol_position', 'currency', 'after', 'Symbol Position (before or after)', true),
('currency_decimals', 'currency', '2', 'Display Decimals (2 or 3)', true),
('decimal_separator', 'currency', '.', 'Decimal Separator Character', true),
('thousands_separator', 'currency', ',', 'Thousands Grouping Character', true),
('timezone', 'currency', 'Asia/Riyadh', 'System Standard Timezone', true),
('date_format', 'currency', 'YYYY-MM-DD', 'Display Date Format', true)
ON CONFLICT (setting_key) DO NOTHING;

-- 4. UI Theme & Visual Styling
INSERT INTO settings (setting_key, setting_group, setting_value, description, is_public) VALUES
('theme_mode_default', 'theme', 'system', 'Default Theme (light, dark, or system)', true),
('theme_accent_color', 'theme', '#2563eb', 'Primary Brand Accent Color Hex', true),
('ui_font_scale', 'theme', '100%', 'Global UI Zoom & Font Scale: 90%, 100%, 110%, 120%, 130%', true),
('pos_density_mode', 'theme', 'comfortable', 'POS Screen Density (comfortable or compact)', true)
ON CONFLICT (setting_key) DO NOTHING;

-- 5. POS & Hardware Peripheral Behavior
INSERT INTO settings (setting_key, setting_group, setting_value, description, is_public) VALUES
('scale_barcode_prefix', 'hardware', '20,21,28,29', 'Comma-separated weighing scale prefixes', true),
('scale_barcode_format', 'hardware', 'EAN13_WEIGHT_5_DIGIT', 'Scale Barcode Encoding Spec', true),
('direct_escpos_print', 'hardware', 'false', 'Enable direct raw network/USB thermal printing', true),
('escpos_printer_ip', 'hardware', '192.168.1.200', 'Raw ESC/POS Printer IP Address', false),
('cash_drawer_auto_kick', 'hardware', 'true', 'Auto-pulse drawer kick on cash sale', true),
('barcode_audio_beep', 'hardware', 'true', 'Play audio beep on successful barcode scan', true),
('allow_negative_stock', 'pos', 'false', 'Allow selling below zero stock', false),
('quick_tender_presets', 'pos', '50,100,200,500', 'Quick cash payment preset values', true)
ON CONFLICT (setting_key) DO NOTHING;

-- Reset Sequences to ensure serial IDs start after seeded records
SELECT setval('units_id_seq', (SELECT MAX(id) FROM units));
SELECT setval('tax_rates_id_seq', (SELECT MAX(id) FROM tax_rates));
SELECT setval('payment_methods_id_seq', (SELECT MAX(id) FROM payment_methods));
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers));
