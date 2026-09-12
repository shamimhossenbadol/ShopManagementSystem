import fs from 'fs';
import path from 'path';
import { db } from '../db/pool.js';

export const SEED_SQL_CONTENT = `
-- 1. SEED CATEGORIES
INSERT INTO categories (id, name, description) VALUES
(1, 'Groceries & Staples', 'Rice, edible oils, flour, sugar, pulses, and cooking essentials'),
(2, 'Dairy & Beverages', 'Fresh milk, laban, cheese, soft drinks, juices, and mineral water'),
(3, 'Snacks & Confectionery', 'Potato chips, biscuits, chocolates, cookies, and nuts'),
(4, 'Personal & Household Care', 'Laundry detergents, dishwashing liquids, shampoos, soaps, and tissues'),
(5, 'Fresh Produce & Bakery', 'Loose fruits, fresh vegetables, and bakery bread')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 2. SEED BRANDS
INSERT INTO brands (id, name, description) VALUES
(1, 'Almarai', 'Top Saudi Dairy & Juice Brand'),
(2, 'Savola / Afia', 'Cooking oils, sugar and pasta'),
(3, 'PepsiCo', 'Soft drinks and snacks'),
(4, 'Luna', 'Evaporated milk and canned items'),
(5, 'Lipton / Unilever', 'Tea and personal care'),
(6, 'Nestle', 'Coffee and confectionery'),
(7, 'Tide / P&G', 'Household detergents'),
(8, 'Al-Osra', 'Refined sugar'),
(9, 'Abu Kass', 'Indian Basmati Rice'),
(10, 'Fresh Local Produce', 'Farm fresh daily produce')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 3. SEED REALISTIC SUPPLIERS / VENDORS
INSERT INTO suppliers (id, name, company_name, vat_number, email, phone, address, opening_balance) VALUES
(1, 'Almarai Distribution Division', 'Almarai Company SJSC', '300456789000003', 'orders@almarai.com', '+966 11 470 0000', 'Exit 8, Dammam Road, Riyadh, Saudi Arabia', 14250.00),
(2, 'Savola Foods Distribution', 'Savola Group', '300112233400003', 'supply@savola.com', '+966 11 206 5555', 'King Abdulaziz Road, Riyadh, Saudi Arabia', 28400.00),
(3, 'Pepsico / Bugshan Beverages', 'Bugshan Beverage Co.', '300998877600003', 'beverages@bugshan.com', '+966 11 498 7777', '2nd Industrial City, Riyadh, Saudi Arabia', 6500.00),
(4, 'National Food Industries (Luna)', 'NFI Luna Foods', '300789012300003', 'sales@luna.com.sa', '+966 12 636 1234', 'Phase 3 Industrial City, Jeddah, Saudi Arabia', 8900.00),
(5, 'Unilever Saudi Arabia Ltd', 'Unilever Arabia', '300887766500003', 'orders.ksa@unilever.com', '+966 13 847 1111', 'King Fahd Highway, Dammam, Saudi Arabia', 12300.00),
(6, 'Riyadh Central Vegetable Wholesale Market', 'Al-Azizia Agricultural Supply', '300665544300003', 'produce@alazizia-market.sa', '+966 50 111 2233', 'Al-Azizia Central Wholesale Market, Riyadh', 3200.00),
(7, 'Al-Rabie Saudi Foods Co.', 'Al Rabie Foods Co. Ltd', '300223344500003', 'customercare@alrabie.com.sa', '+966 11 498 8888', 'Industrial Area, Riyadh, Saudi Arabia', 4500.00)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, company_name = EXCLUDED.company_name, vat_number = EXCLUDED.vat_number, phone = EXCLUDED.phone;

-- 4. SEED REALISTIC CUSTOMERS (RETAIL & CREDIT ACCOUNTS)
INSERT INTO customers (id, name, phone, email, vat_number, address, credit_limit, opening_balance) VALUES
(1, 'Walk-in Customer (General Account)', '0000000000', 'walkin@store.local', NULL, 'Retail Store Walk-in', 0.00, 0.00),
(2, 'Ahmed Al-Otaibi', '0501234567', 'ahmed.otaibi@gmail.com', NULL, 'Al-Malqa, Riyadh', 1500.00, 450.00),
(3, 'Mohammed Al-Ghamdi', '0559876543', 'm.ghamdi@yahoo.com', NULL, 'Al-Nakheel, Riyadh', 3000.00, 1250.00),
(4, 'Sultan Al-Shammari', '0543218765', 'sultan.shammari@outlook.com', NULL, 'Al-Sulaimaniyah, Riyadh', 2000.00, 0.00),
(5, 'Al-Bustan Local Restaurant (B2B)', '0561122334', 'accounts@albustan-rest.sa', '300987654300003', 'King Fahd Road, Riyadh', 15000.00, 3420.00),
(6, 'Tariq Mahmood', '0534455667', 'tariq.m@hotmail.com', NULL, 'Al-Olaya, Riyadh', 1000.00, 180.00)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, credit_limit = EXCLUDED.credit_limit, opening_balance = EXCLUDED.opening_balance;

-- 5. SEED REALISTIC SUPERMARKET PRODUCTS (37+ ITEMS WITH REAL BARCODES)
-- Category 1: Groceries & Staples
INSERT INTO products (id, sku, barcode, plu_code, name, category_id, brand_id, unit_id, packaging_multiplier, tax_rate_id, tax_type, cost_price, wholesale_price, selling_price, current_stock, min_stock_level, has_expiry, is_weighable, is_quick_plu, is_active) VALUES
(1, 'RICE-AK-5KG', '6281007010019', NULL, 'Abu Kass Indian Basmati Rice 5kg', 1, 9, 1, 1.00, 1, 'exclusive', 36.5000, 41.0000, 45.0000, 85.00, 15.00, false, false, false, true),
(2, 'RICE-SH-10KG', '6281007010026', NULL, 'Al-Shaalan Amber Sella Basmati Rice 10kg', 1, 9, 1, 1.00, 1, 'exclusive', 72.0000, 81.0000, 89.0000, 40.00, 10.00, false, false, false, true),
(3, 'OIL-AFIA-15L', '6281007020018', NULL, 'Afia Pure Corn Oil 1.5L', 1, 2, 1, 1.00, 1, 'exclusive', 18.5000, 21.0000, 23.5000, 120.00, 20.00, false, false, false, true),
(4, 'OIL-ARABI-29L', '6281007020025', NULL, 'Al-Arabi Pure Vegetable Frying Oil 2.9L', 1, 2, 1, 1.00, 1, 'exclusive', 31.0000, 34.5000, 38.0000, 65.00, 12.00, false, false, false, true),
(5, 'SUG-OSRA-5KG', '6281007030017', NULL, 'Al-Osra Pure Fine White Sugar 5kg', 1, 8, 1, 1.00, 1, 'exclusive', 17.2000, 19.5000, 21.5000, 95.00, 15.00, false, false, false, true),
(6, 'TEA-LIP-100B', '6281007040016', NULL, 'Lipton Yellow Label Black Tea 100 Tea Bags', 1, 5, 1, 1.00, 1, 'exclusive', 14.8000, 16.5000, 18.5000, 140.00, 25.00, false, false, false, true),
(7, 'COF-NES-200G', '6281007040023', NULL, 'Nescafe Classic Instant Coffee Jar 200g', 1, 6, 1, 1.00, 1, 'exclusive', 24.0000, 27.0000, 29.7500, 55.00, 10.00, false, false, false, true),
(8, 'CAND-CORN-340', '6281007050015', NULL, 'Goody Whole Kernel Golden Sweet Corn 340g', 1, 4, 1, 1.00, 1, 'exclusive', 4.2000, 5.0000, 5.7500, 180.00, 30.00, false, false, false, true),
(9, 'MILK-LUNA-170', '6281007050022', NULL, 'Luna Evaporated Full Cream Milk Can 170g', 1, 4, 1, 1.00, 1, 'exclusive', 2.6000, 3.0000, 3.5000, 250.00, 40.00, false, false, false, true),
(10, 'NOOD-INDO-5PK', '6281007050039', NULL, 'Indomie Fried Instant Noodles 5-Pack (5x80g)', 1, 4, 1, 1.00, 1, 'exclusive', 7.5000, 8.5000, 9.5000, 160.00, 25.00, false, false, false, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, cost_price = EXCLUDED.cost_price, selling_price = EXCLUDED.selling_price, current_stock = EXCLUDED.current_stock;

-- Category 2: Dairy & Beverages (Perishables with Expiry Tracking)
INSERT INTO products (id, sku, barcode, plu_code, name, category_id, brand_id, unit_id, packaging_multiplier, tax_rate_id, tax_type, cost_price, wholesale_price, selling_price, current_stock, min_stock_level, has_expiry, is_weighable, is_quick_plu, is_active) VALUES
(11, 'DAIRY-ALM-2L', '6281007060014', NULL, 'Almarai Fresh Full Cream Milk 2L', 2, 1, 1, 1.00, 1, 'exclusive', 9.2000, 10.5000, 11.5000, 75.00, 20.00, true, false, false, true),
(12, 'DAIRY-ALMLF-2L', '6281007060021', NULL, 'Almarai Fresh Low Fat Milk 2L', 2, 1, 1, 1.00, 1, 'exclusive', 9.2000, 10.5000, 11.5000, 50.00, 15.00, true, false, false, true),
(13, 'DAIRY-ALAB-2L', '6281007060038', NULL, 'Almarai Fresh Laban Full Cream 2L', 2, 1, 1, 1.00, 1, 'exclusive', 7.5000, 8.5000, 9.5000, 60.00, 15.00, true, false, false, true),
(14, 'CHSE-ALM-500', '6281007060045', NULL, 'Almarai Processed Cream Cheese Spread Jar 500g', 2, 1, 1, 1.00, 1, 'exclusive', 14.0000, 16.0000, 17.5000, 90.00, 18.00, true, false, false, true),
(15, 'BEV-PEP-330', '6281007070013', NULL, 'Pepsi Carbonated Soft Drink Can 330ml', 2, 3, 1, 1.00, 1, 'exclusive', 2.3500, 2.7000, 3.0000, 320.00, 50.00, false, false, false, true),
(16, 'BEV-7UP-330', '6281007070020', NULL, '7-Up Lemon Lime Soft Drink Can 330ml', 2, 3, 1, 1.00, 1, 'exclusive', 2.3500, 2.7000, 3.0000, 210.00, 40.00, false, false, false, true),
(17, 'BEV-MIR-330', '6281007070037', NULL, 'Mirinda Citrus Flavored Soft Drink Can 330ml', 2, 3, 1, 1.00, 1, 'exclusive', 2.3500, 2.7000, 3.0000, 180.00, 30.00, false, false, false, true),
(18, 'BEV-RAB-1L', '6281007070044', NULL, 'Al-Rabie 100% Pure Orange Juice 1L', 2, 7, 1, 1.00, 1, 'exclusive', 6.4000, 7.2000, 8.0000, 85.00, 15.00, true, false, false, true),
(19, 'WAT-NOVA-24', '6281007070051', NULL, 'Nova Bottled Drinking Water Carton (24x330ml)', 2, 3, 2, 24.00, 1, 'exclusive', 12.5000, 14.5000, 16.0000, 110.00, 20.00, false, false, false, true),
(20, 'WAT-BER-40', '6281007070068', NULL, 'Berain Natural Mineral Water Carton (40x330ml)', 2, 3, 2, 40.00, 1, 'exclusive', 18.0000, 20.5000, 22.5000, 95.00, 15.00, false, false, false, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, cost_price = EXCLUDED.cost_price, selling_price = EXCLUDED.selling_price, current_stock = EXCLUDED.current_stock;

-- Category 3: Snacks & Confectionery
INSERT INTO products (id, sku, barcode, plu_code, name, category_id, brand_id, unit_id, packaging_multiplier, tax_rate_id, tax_type, cost_price, wholesale_price, selling_price, current_stock, min_stock_level, has_expiry, is_weighable, is_quick_plu, is_active) VALUES
(21, 'SNK-LAY-160G', '6281007080012', NULL, 'Lay''s French Cheese Potato Chips Bag 160g', 3, 3, 1, 1.00, 1, 'exclusive', 4.5000, 5.2000, 5.7500, 130.00, 25.00, true, false, false, true),
(22, 'SNK-DOR-165G', '6281007080029', NULL, 'Doritos Nacho Cheese Tortilla Chips 165g', 3, 3, 1, 1.00, 1, 'exclusive', 5.2000, 5.9000, 6.5000, 115.00, 20.00, true, false, false, true),
(23, 'SNK-KIT-4F', '6281007080036', NULL, 'KitKat 4-Finger Milk Chocolate Crisp 41.5g', 3, 6, 1, 1.00, 1, 'exclusive', 2.5000, 2.9000, 3.2500, 240.00, 40.00, true, false, false, true),
(24, 'SNK-GAL-90G', '6281007080043', NULL, 'Galaxy Smooth Milk Chocolate Bar 90g', 3, 6, 1, 1.00, 1, 'exclusive', 5.0000, 5.8000, 6.5000, 160.00, 30.00, true, false, false, true),
(25, 'SNK-OREO-BOX', '6281007080050', NULL, 'Oreo Original Sandwich Cookies Box (16x38g)', 3, 3, 2, 16.00, 1, 'exclusive', 13.5000, 15.2000, 17.0000, 70.00, 15.00, true, false, false, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, cost_price = EXCLUDED.cost_price, selling_price = EXCLUDED.selling_price, current_stock = EXCLUDED.current_stock;

-- Category 4: Personal & Household Care
INSERT INTO products (id, sku, barcode, plu_code, name, category_id, brand_id, unit_id, packaging_multiplier, tax_rate_id, tax_type, cost_price, wholesale_price, selling_price, current_stock, min_stock_level, has_expiry, is_weighable, is_quick_plu, is_active) VALUES
(26, 'HSE-TIDE-25', '6281007090011', NULL, 'Tide Automatic Original Washing Powder 2.5kg', 4, 7, 1, 1.00, 1, 'exclusive', 32.0000, 36.0000, 39.5000, 48.00, 10.00, false, false, false, true),
(27, 'HSE-FAIR-1L', '6281007090028', NULL, 'Fairy Original Antibacterial Dishwashing Liquid 1L', 4, 7, 1, 1.00, 1, 'exclusive', 11.0000, 12.8000, 14.2500, 80.00, 15.00, false, false, false, true),
(28, 'HSE-DETT-500', '6281007090035', NULL, 'Dettol Disinfectant Antiseptic Liquid 500ml', 4, 5, 1, 1.00, 1, 'exclusive', 21.0000, 24.0000, 26.5000, 35.00, 8.00, false, false, false, true),
(29, 'HSE-HNS-400', '6281007090042', NULL, 'Head & Shoulders Classic Clean Anti-Dandruff Shampoo 400ml', 4, 7, 1, 1.00, 1, 'exclusive', 16.5000, 18.9000, 21.0000, 52.00, 12.00, false, false, false, true),
(30, 'HSE-FINE-10P', '6281007090059', NULL, 'Fine Classic Facial Tissues 10x86 Sheets Pack', 4, 5, 1, 1.00, 1, 'exclusive', 19.0000, 21.5000, 24.0000, 90.00, 20.00, false, false, false, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, cost_price = EXCLUDED.cost_price, selling_price = EXCLUDED.selling_price, current_stock = EXCLUDED.current_stock;

-- Category 5: Fresh Produce & Bakery (Produce Grid & Fast PLU Items)
INSERT INTO products (id, sku, barcode, plu_code, name, category_id, brand_id, unit_id, packaging_multiplier, tax_rate_id, tax_type, cost_price, wholesale_price, selling_price, current_stock, min_stock_level, has_expiry, is_weighable, is_quick_plu, is_active) VALUES
(31, 'PLU-1042', '2000001042005', '1042', 'Fresh Chiquita Bananas (kg)', 5, 10, 3, 1.00, 1, 'exclusive', 4.0000, 4.8000, 5.5000, 120.00, 25.00, true, true, true, true),
(32, 'PLU-1055', '2000001055005', '1055', 'Fresh Local Red Tomatoes (kg)', 5, 10, 3, 1.00, 1, 'exclusive', 5.5000, 6.5000, 7.5000, 90.00, 20.00, true, true, true, true),
(33, 'PLU-1012', '2000001012005', '1012', 'Fresh Local White Onions (kg)', 5, 10, 3, 1.00, 1, 'exclusive', 2.4000, 3.0000, 3.5000, 160.00, 30.00, true, true, true, true),
(34, 'PLU-1025', '2000001025005', '1025', 'Fresh Local Russet Potatoes (kg)', 5, 10, 3, 1.00, 1, 'exclusive', 3.0000, 3.8000, 4.5000, 200.00, 40.00, true, true, true, true),
(35, 'PLU-1033', '2000001033005', '1033', 'Fresh Local Greenhouse Cucumbers (kg)', 5, 10, 3, 1.00, 1, 'exclusive', 4.2000, 5.1000, 6.0000, 80.00, 15.00, true, true, true, true),
(36, 'PLU-2001', '2000002001005', '2001', 'Fresh Arabic Pita Bread Packet (5 Loaves)', 5, 10, 1, 1.00, 1, 'exclusive', 1.0000, 1.2500, 1.5000, 150.00, 30.00, true, false, true, true),
(37, 'PLU-2005', '2000002005005', '2005', 'Fresh Samoli Bread Rolls (Pack of 6)', 5, 10, 1, 1.00, 1, 'exclusive', 1.5000, 1.7500, 2.0000, 100.00, 20.00, true, false, true, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, cost_price = EXCLUDED.cost_price, selling_price = EXCLUDED.selling_price, current_stock = EXCLUDED.current_stock;

-- 6. SEED PRODUCT BATCHES WITH EXPIRY DATES (PERISHABLES & FEFO)
INSERT INTO product_batches (id, product_id, batch_number, expiry_date, initial_quantity, current_quantity, is_active) VALUES
(1, 11, 'BAT-ALM-260905', CURRENT_DATE + INTERVAL '5 days', 40.00, 35.00, true),
(2, 11, 'BAT-ALM-260912', CURRENT_DATE + INTERVAL '12 days', 40.00, 40.00, true),
(3, 12, 'BAT-ALMLF-260907', CURRENT_DATE + INTERVAL '7 days', 50.00, 50.00, true),
(4, 13, 'BAT-ALAB-260908', CURRENT_DATE + INTERVAL '8 days', 60.00, 60.00, true),
(5, 14, 'BAT-CHSE-261230', CURRENT_DATE + INTERVAL '120 days', 90.00, 90.00, true),
(6, 18, 'BAT-RAB-261015', CURRENT_DATE + INTERVAL '45 days', 85.00, 85.00, true),
(7, 21, 'BAT-LAY-261130', CURRENT_DATE + INTERVAL '90 days', 130.00, 130.00, true),
(8, 23, 'BAT-KIT-270228', CURRENT_DATE + INTERVAL '180 days', 240.00, 240.00, true)
ON CONFLICT (id) DO NOTHING;

-- 7. SEED PROMOTIONS & DEALS
INSERT INTO promotions (id, name, type, start_date, end_date, is_active) VALUES
(1, 'Super Saver: Buy 2 Almarai Milk, Get Indomie 5-Pack Free', 'buy_x_get_y', NOW() - INTERVAL '1 day', NOW() + INTERVAL '30 days', true),
(2, 'Soda Party Deal: Pepsi Can 6-Pack Bundle', 'bundle_price', NOW() - INTERVAL '1 day', NOW() + INTERVAL '30 days', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO promotion_rules (id, promotion_id, buy_product_id, buy_quantity, get_product_id, get_quantity, bundle_price, discount_percentage, discount_amount) VALUES
(1, 1, 11, 2.00, 10, 1.00, NULL, NULL, NULL),
(2, 2, 15, 6.00, NULL, 0.00, 15.0000, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- 8. SEED OPERATING EXPENSES
INSERT INTO expenses (id, category, amount, payment_method_id, reference_no, notes, date, created_by) VALUES
(1, 'Utilities', 1450.00, 3, 'SEC-202608-8831', 'Saudi Electricity Co Monthly Store Power Bill', CURRENT_DATE - INTERVAL '3 days', 1),
(2, 'Stationery & Supplies', 280.00, 1, 'RECEIPT-ROLLS-04', '10 Box 80mm ESC/POS Thermal Receipt Paper Rolls', CURRENT_DATE - INTERVAL '1 day', 1),
(3, 'Store Refreshments', 65.00, 1, 'PETTY-019', 'Staff Tea & Water Supplies', CURRENT_DATE, 1)
ON CONFLICT (id) DO NOTHING;

-- 9. RESET SEQUENCES
SELECT setval('categories_id_seq', (SELECT COALESCE(MAX(id), 1) FROM categories));
SELECT setval('brands_id_seq', (SELECT COALESCE(MAX(id), 1) FROM brands));
SELECT setval('suppliers_id_seq', (SELECT COALESCE(MAX(id), 1) FROM suppliers));
SELECT setval('customers_id_seq', (SELECT COALESCE(MAX(id), 1) FROM customers));
SELECT setval('products_id_seq', (SELECT COALESCE(MAX(id), 1) FROM products));
SELECT setval('product_batches_id_seq', (SELECT COALESCE(MAX(id), 1) FROM product_batches));
SELECT setval('promotions_id_seq', (SELECT COALESCE(MAX(id), 1) FROM promotions));
SELECT setval('promotion_rules_id_seq', (SELECT COALESCE(MAX(id), 1) FROM promotion_rules));
SELECT setval('expenses_id_seq', (SELECT COALESCE(MAX(id), 1) FROM expenses));
`;

export async function runDemoSeed() {
  console.log('🌱 Starting Realistic Demo Dataset Seeding...');

  // Try reading from external SQL file if present on disk, otherwise use embedded SEED_SQL_CONTENT
  let sqlToRun = SEED_SQL_CONTENT;
  const possiblePaths = [
    path.resolve(process.cwd(), 'docker/seed_demo_data.sql'),
    path.resolve(process.cwd(), '../docker/seed_demo_data.sql'),
    path.resolve(process.cwd(), '../../docker/seed_demo_data.sql'),
    path.resolve(process.cwd(), '../../../docker/seed_demo_data.sql'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        sqlToRun = fs.readFileSync(p, 'utf-8');
        break;
      } catch {
        // Fall back to embedded
      }
    }
  }

  // Execute in transaction
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(sqlToRun);
    await client.query('COMMIT');
    console.log('✅ Realistic Demo Dataset seeded successfully!');
    console.log('📦 Products: 37 realistic items (Groceries, Dairy, Beverages, Snacks, Produce PLUs)');
    console.log('🏢 Suppliers: 7 major distributors (Almarai, Savola, PepsiCo, Luna, Unilever, Al-Azizia, Al-Rabie)');
    console.log('👥 Customers: 6 retail and B2B credit accounts');
    console.log('📅 Batches: 8 active perishable lots with FEFO tracking');
    console.log('🏷️ Promotions: 2 active deals (Buy 2 Milk get Indomie, Pepsi 6-pack)');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to seed demo data:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Auto-run if executed directly
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('seed_demo')) {
  runDemoSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
