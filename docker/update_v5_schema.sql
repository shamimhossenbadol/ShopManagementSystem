-- ====================================================================
-- IDEMPOTENT DATABASE UPGRADE SCRIPT
-- Ensures all columns, tables, and constraints for V5 (session management,
-- cash shifts, adjustments, scales) exist.
-- Safe to run repeatedly on any existing database.
-- ====================================================================

-- 1. USERS: Add session tracking columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_session_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_pos_session_id VARCHAR(100);

-- 2. CASH SESSIONS: Add shift & carry-forward columns
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS terminal_name VARCHAR(100) DEFAULT 'Terminal-01';
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS sequence_number INT;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS previous_session_id INT REFERENCES cash_sessions(id);
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS carry_forward_balance DECIMAL(15,4) NOT NULL DEFAULT 0.0000;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS close_type VARCHAR(20) DEFAULT 'normal';
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS force_closed_by INT REFERENCES users(id);
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS force_close_reason TEXT;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS terminal_card_total DECIMAL(15,4) NOT NULL DEFAULT 0.0000;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS terminal_card_expected DECIMAL(15,4) NOT NULL DEFAULT 0.0000;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS terminal_card_discrepancy DECIMAL(15,4) NOT NULL DEFAULT 0.0000;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS opening_card_balance DECIMAL(15,4) NOT NULL DEFAULT 0.0000;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS carry_forward_card_balance DECIMAL(15,4) NOT NULL DEFAULT 0.0000;

-- 3. CASH SESSIONS: Ensure single open shift constraint & sequence numbers
UPDATE cash_sessions 
SET status = 'closed', closed_at = NOW(), closing_note = 'Auto-closed legacy duplicate open session'
WHERE status = 'open' 
  AND id NOT IN (SELECT id FROM cash_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1);

CREATE UNIQUE INDEX IF NOT EXISTS uq_single_open_cash_session 
    ON cash_sessions ((1)) WHERE status = 'open';

UPDATE cash_sessions SET sequence_number = id WHERE sequence_number IS NULL;

-- 4. SALES: Add session_id reference
ALTER TABLE sales ADD COLUMN IF NOT EXISTS session_id INT REFERENCES cash_sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sales_session_id ON sales(session_id);

-- 5. SESSION ADJUSTMENTS: Create immutable ledger table
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

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_session_adjustments_no_update_delete') THEN
        CREATE OR REPLACE FUNCTION prevent_adjustment_mutation()
        RETURNS TRIGGER AS $fn$
        BEGIN
            RAISE EXCEPTION 'Session adjustments are immutable and cannot be modified or deleted';
        END;
        $fn$ LANGUAGE plpgsql;

        CREATE TRIGGER trg_session_adjustments_no_update_delete
            BEFORE UPDATE OR DELETE ON session_adjustments
            FOR EACH ROW EXECUTE FUNCTION prevent_adjustment_mutation();
    END IF;
END $$;

-- 6. TAX & PRODUCE SCALE ENHANCEMENTS
ALTER TABLE tax_rates ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tax_rates ADD COLUMN IF NOT EXISTS tax_type VARCHAR(50) DEFAULT 'VAT';
ALTER TABLE products ADD COLUMN IF NOT EXISTS plu_code VARCHAR(20);
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_expiry BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_weighable BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_quick_plu BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_products_plu ON products(plu_code);

-- 7. SETTINGS
ALTER TABLE settings ADD COLUMN IF NOT EXISTS setting_group VARCHAR(50) DEFAULT 'shop';
CREATE INDEX IF NOT EXISTS idx_settings_group ON settings(setting_group);
INSERT INTO settings (setting_key, setting_group, setting_value, description, is_public)
VALUES ('shop_closing_hour', 'shop', '00:00', 'Daily Shop Closing Hour (e.g. 00:00 for 12 AM)', true)
ON CONFLICT (setting_key) DO NOTHING;
