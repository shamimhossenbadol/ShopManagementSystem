-- ====================================================================
-- LEGACY MIGRATION SCRIPT (CONSOLIDATED INTO docker/init.sql)
-- NOTE: All schema definitions, tables, and settings below are now
-- canonicalized directly in docker/init.sql for single-source-of-truth.
-- ====================================================================

-- 1. Tax Rates table updates
ALTER TABLE tax_rates ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tax_rates ADD COLUMN IF NOT EXISTS tax_type VARCHAR(50) DEFAULT 'VAT';

-- 2. Products table updates for Supermarket Produce & Scales
ALTER TABLE products ADD COLUMN IF NOT EXISTS plu_code VARCHAR(10);
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_expiry BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_weighable BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_quick_plu BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_plu ON products(plu_code);

-- 3. Product Batches & Perishable Expiry Tracking (FEFO)
CREATE TABLE IF NOT EXISTS product_batches (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) NOT NULL,
    expiry_date DATE NOT NULL,
    initial_quantity NUMERIC(15, 3) NOT NULL CHECK (initial_quantity >= 0),
    current_quantity NUMERIC(15, 3) NOT NULL CHECK (current_quantity >= 0),
    cost_price NUMERIC(15, 4) NOT NULL CHECK (cost_price >= 0),
    purchase_item_id INT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_batches_expiry ON product_batches(product_id, expiry_date);

-- 4. Promotions Engine
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promotion_type_enum') THEN
        CREATE TYPE promotion_type_enum AS ENUM ('percentage_discount', 'fixed_discount', 'bundle_price', 'buy_x_get_y_free');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS promotions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    promotion_type promotion_type_enum NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    min_order_amount NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promotion_rules (
    id SERIAL PRIMARY KEY,
    promotion_id INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    buy_quantity INTEGER DEFAULT 1,
    get_quantity INTEGER DEFAULT 0,
    discount_value NUMERIC(15, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotion_rules_prod ON promotion_rules(product_id);

-- 5. Dynamic Customization Settings & Groups
ALTER TABLE settings ADD COLUMN IF NOT EXISTS setting_group VARCHAR(50) DEFAULT 'shop';
CREATE INDEX IF NOT EXISTS idx_settings_group ON settings(setting_group);

-- Seed / Upsert Grouped Settings
INSERT INTO settings (setting_key, setting_value, description, setting_group) VALUES
-- Shop Branding
('shop_name_en', 'AL-NOOR SUPERMARKET & HYPERMARKET', 'English Supermarket Name', 'shop'),
('shop_name_ar', 'AL-NOOR RETAIL POS', 'Secondary POS Identifier', 'shop'),
('vat_number', '300123456700003', 'Saudi ZATCA 15-Digit VAT Registration Number', 'shop'),
('cr_number', '1010123456', 'Saudi Ministry of Commerce Commercial Registration', 'shop'),
('shop_phone', '+966 11 456 7890', 'Main Supermarket Phone Number', 'shop'),
('shop_email', 'info@alnoorshop.sa', 'Official Email Address', 'shop'),
('shop_address_en', 'King Fahd Road, Al-Olaya, Riyadh, Saudi Arabia', 'Store Physical Address (EN)', 'shop'),
('shop_address_ar', 'King Fahd Road, Al-Olaya, Riyadh, Saudi Arabia', 'Store Physical Address (Secondary)', 'shop'),
('shop_logo_url', '', 'Store Logo URL or Data URI', 'shop'),
('receipt_header_en', 'Welcome to Al-Noor Supermarket', 'Thermal Receipt Header (English)', 'shop'),
('receipt_header_ar', 'Welcome to Al-Noor Supermarket & Retail POS', 'Thermal Receipt Header (Secondary)', 'shop'),
('receipt_footer_en', 'Thank you for shopping with us! Freshness Guaranteed.', 'Receipt Footer Note (English)', 'shop'),
('receipt_footer_ar', 'Thank you for shopping with us! Return within 7 days with invoice.', 'Receipt Footer Note (Secondary)', 'shop'),
-- Tax Configuration
('default_tax_rate_id', '1', 'Active default VAT rate ID for checkout', 'tax'),
('tax_enabled', 'true', 'Global Tax calculation flag', 'tax'),
('tax_label', 'VAT (15%)', 'Tax display label across receipts and UI', 'tax'),
('prices_include_tax', 'true', 'Shelf tag prices include VAT by default (Saudi retail standard)', 'tax'),
-- Currency & Locale Customizer
('currency_code', 'SAR', 'ISO Currency Code', 'currency'),
('currency_symbol', 'SAR', 'Currency display symbol', 'currency'),
('currency_position', 'after', 'Currency symbol position (before/after)', 'currency'),
('currency_decimals', '2', 'Decimal places for financial figures (typically 2)', 'currency'),
('thousands_separator', ',', 'Thousands grouping separator', 'currency'),
('decimal_separator', '.', 'Decimal point separator', 'currency'),
-- Theme & UI Modes
('theme_mode', 'dark', 'Interface Theme Mode (light/dark/system)', 'theme'),
('accent_color', 'blue', 'Primary accent color palette (blue/emerald/indigo/violet/amber)', 'theme'),
('ui_font_scale', '100%', 'Global UI Zoom & Font Scale: 90%, 100%, 110%, 120%, 130%', 'theme'),
('compact_density', 'false', 'Enable compact table row spacing for POS/Catalog', 'theme'),
-- POS Hardware & Device Policies
('printer_type', 'thermal_80mm', 'Receipt Printer Standard (thermal_80mm/thermal_58mm/a4)', 'hardware'),
('auto_print_receipt', 'true', 'Automatically trigger silent print dialog upon sale tender', 'hardware'),
('cash_drawer_kick', 'true', 'Send ESC/POS pulse to open cash drawer on cash tender', 'hardware'),
('barcode_scanner_beep', 'true', 'Play audio beep on successful item scan in POS terminal', 'hardware'),
('scale_barcode_prefix', '20,21,28,29', 'Variable weight scale barcode prefixes (EAN-13)', 'hardware'),
('customer_display_enabled', 'false', 'Enable secondary 2-line VFD customer display pole', 'hardware')
ON CONFLICT (setting_key) DO UPDATE SET 
    setting_value = EXCLUDED.setting_value,
    setting_group = EXCLUDED.setting_group;

-- Ensure default 15% standard tax exists
INSERT INTO tax_rates (name, rate, is_default, is_active)
VALUES ('Standard VAT (15%)', 15.0000, true, true)
ON CONFLICT DO NOTHING;
