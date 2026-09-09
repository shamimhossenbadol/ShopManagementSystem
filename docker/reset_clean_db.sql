-- ====================================================================
-- CLEAN DATABASE RESET SCRIPT
-- Removes all transactional data, products, suppliers, customers, and users
-- Preserves: Core Master Settings, Tax Rates, Payment Methods, Units,
--            Default Categories, Walk-in Customer, and Manager User.
-- ====================================================================

TRUNCATE TABLE 
    sales_return_items,
    sales_returns,
    purchase_return_items,
    purchase_returns,
    held_sale_items,
    held_sales,
    sale_payments,
    sale_items,
    invoices,
    sales,
    purchase_payments,
    purchase_items,
    purchases,
    stock_adjustments,
    stock_movements,
    session_adjustments,
    cash_movements,
    cash_sessions,
    product_batches,
    product_images,
    promotion_rules,
    promotions,
    products,
    brands,
    suppliers,
    expenses,
    customer_ledger,
    supplier_ledger,
    audit_logs,
    notifications,
    backup_logs
CASCADE;

-- Remove all customers except the standard Walk-in customer
DELETE FROM customers WHERE id != 1;

-- Remove all users except the Manager
DELETE FROM users WHERE role != 'manager';

-- Ensure Manager user is active with reset sessions
INSERT INTO users (id, role, username, email, password_hash, full_name, phone, pin_code, is_active) VALUES
(1, 'manager', 'admin', 'manager@alnoorshop.com', '$2b$10$M2nH3FzA144Zi1/O0LErb.5evVVJj11reUN1yFO2aARRwQLCKFZtu', 'Shamim Hossen (Manager)', '+966501234567', '12345', TRUE)
ON CONFLICT (id) DO UPDATE SET 
    role = 'manager',
    is_active = TRUE,
    current_session_id = NULL,
    current_pos_session_id = NULL;

-- Reset primary key sequences for clean testing IDs
SELECT setval('products_id_seq', 1, false);
SELECT setval('sales_id_seq', 1, false);
SELECT setval('purchases_id_seq', 1, false);
SELECT setval('suppliers_id_seq', 1, false);
SELECT setval('cash_sessions_id_seq', 1, false);
SELECT setval('customers_id_seq', 1, true);
