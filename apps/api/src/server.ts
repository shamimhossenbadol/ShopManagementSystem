import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import fs from 'fs';
import path from 'path';
import { env } from './config/env.js';
import { db } from './db/pool.js';

// Route imports
import { authRoutes } from './modules/auth/auth.routes.js';
import { productRoutes } from './modules/products/products.routes.js';
import { batchRoutes } from './modules/batches/batches.routes.js';
import { promotionRoutes } from './modules/promotions/promotions.routes.js';
import { inventoryRoutes } from './modules/inventory/inventory.routes.js';
import { salesRoutes } from './modules/sales/sales.routes.js';
import { purchaseRoutes } from './modules/purchases/purchases.routes.js';
import { invoiceRoutes } from './modules/invoices/invoices.routes.js';
import { returnRoutes } from './modules/returns/returns.routes.js';
import { ledgerRoutes } from './modules/ledgers/ledgers.routes.js';
import { cashRoutes } from './modules/cash/cash.routes.js';
import { expenseRoutes } from './modules/expenses/expenses.routes.js';
import { reportRoutes } from './modules/reports/reports.routes.js';
import { backupRoutes } from './modules/backup/backup.routes.js';
import { settingsRoutes } from './modules/settings/settings.routes.js';

const server = Fastify({
  logger: env.NODE_ENV === 'development',
  disableRequestLogging: env.NODE_ENV === 'production',
  bodyLimit: 15 * 1024 * 1024, // 15MB for base64 image uploads
});

// Support empty bodies with Content-Type: application/json without throwing FST_ERR_CTP_EMPTY_JSON_BODY
server.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  try {
    const text = (body as string || '').trim();
    if (!text) {
      done(null, {});
      return;
    }
    const json = JSON.parse(text);
    done(null, json);
  } catch (err: any) {
    err.statusCode = 400;
    done(err, undefined);
  }
});

async function waitForDatabase(maxRetries = 30, delayMs = 1500): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await db.query('SELECT 1');
      console.log('✅ Connected to PostgreSQL database.');
      return;
    } catch (err: any) {
      console.warn(`⏳ Waiting for database to be ready (attempt ${attempt}/${maxRetries}): ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('❌ Could not connect to PostgreSQL database after multiple attempts.');
}

async function runAutoMigrations() {
  console.log('🔄 Verifying and applying database schema migrations...');

  const migrationSteps: { name: string; sql: string; critical?: boolean }[] = [
    {
      name: 'Users table session tracking columns',
      critical: true,
      sql: `
        ALTER TABLE users ADD COLUMN IF NOT EXISTS current_session_id VARCHAR(100);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS current_pos_session_id VARCHAR(100);
      `,
    },
    {
      name: 'Users table PIN hash column expansion and optional password hash & username',
      critical: true,
      sql: `
        ALTER TABLE users ALTER COLUMN pin_code TYPE VARCHAR(255);
        ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
        ALTER TABLE users ALTER COLUMN username DROP NOT NULL;
      `,
    },
    {
      name: 'Cash sessions columns & terminal support',
      sql: `
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
      `,
    },
    {
      name: 'Single open POS session constraint and sequence numbering',
      sql: `
        -- Close legacy duplicate open sessions before creating the unique index
        UPDATE cash_sessions 
        SET status = 'closed', closed_at = NOW(), closing_note = 'Auto-closed legacy open session'
        WHERE status = 'open' 
          AND id NOT IN (SELECT id FROM cash_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1);

        CREATE UNIQUE INDEX IF NOT EXISTS uq_single_open_cash_session 
            ON cash_sessions ((1)) WHERE status = 'open';

        UPDATE cash_sessions SET sequence_number = id WHERE sequence_number IS NULL;
      `,
    },
    {
      name: 'Sales session foreign key and index',
      sql: `
        ALTER TABLE sales ADD COLUMN IF NOT EXISTS session_id INT REFERENCES cash_sessions(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_sales_session_id ON sales(session_id);
      `,
    },
    {
      name: 'Product batches purchase tracking',
      sql: `
        ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS purchase_id INT REFERENCES purchases(id) ON DELETE SET NULL;
        ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      `,
    },
    {
      name: 'Session adjustments table and immutability trigger',
      sql: `
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
      `,
    },
    {
      name: 'Tax and produce scale enhancements',
      sql: `
        ALTER TABLE tax_rates ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE tax_rates ADD COLUMN IF NOT EXISTS tax_type VARCHAR(50) DEFAULT 'VAT';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS plu_code VARCHAR(20);
        ALTER TABLE products ADD COLUMN IF NOT EXISTS has_expiry BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_weighable BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_quick_plu BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
        CREATE INDEX IF NOT EXISTS idx_products_plu ON products(plu_code);
      `,
    },
    {
      name: 'Settings defaults and group column',
      sql: `
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS setting_group VARCHAR(50) DEFAULT 'shop';
        CREATE INDEX IF NOT EXISTS idx_settings_group ON settings(setting_group);
        INSERT INTO settings (setting_key, setting_group, setting_value, description, is_public)
        VALUES ('shop_closing_hour', 'shop', '00:00', 'Daily Shop Closing Hour (e.g. 00:00 for 12 AM)', true)
        ON CONFLICT (setting_key) DO NOTHING;
      `,
    },
  ];

  for (const step of migrationSteps) {
    try {
      await db.query(step.sql);
      console.log(`✅ Auto-migration: ${step.name} applied successfully.`);
    } catch (err: any) {
      console.error(`❌ Auto-migration error on "${step.name}":`, err.message);
      if (step.critical) {
        throw new Error(`Critical migration failed on "${step.name}": ${err.message}`);
      }
    }
  }

  console.log('🎉 All database auto-migrations completed and verified.');
}

async function main() {
  await waitForDatabase();
  await runAutoMigrations();

  // 1. Plugins
  await server.register(cors, {
    origin: true,
    credentials: true,
  });

  await server.register(cookie);

  await server.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: 'auth_token',
      signed: false,
    },
  });

  await server.register(rateLimit, {
    max: 1000, // Generous rate limit for local shop LAN operations
    timeWindow: '1 minute',
  });

  // 2. Health check route
  server.get('/health', async (request, reply) => {
    try {
      const dbCheck = await db.query('SELECT 1');
      return reply.send({
        status: 'healthy',
        database: dbCheck.rows.length > 0 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      });
    } catch (err: any) {
      return reply.status(500).send({
        status: 'unhealthy',
        database: 'error',
        error: err.message,
      });
    }
  });

  // 2.1 Static file serving for uploads (Product Images, Receipts)
  server.get('/api/v1/uploads/*', async (request, reply) => {
    const filePath = (request.params as any)['*'];
    const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    const uploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'data/uploads');
    const fullPath = path.join(uploadDir, safePath);

    if (!fs.existsSync(fullPath)) {
      return reply.status(404).send({ success: false, message: 'File not found' });
    }

    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    };

    reply.type(mimeTypes[ext] || 'application/octet-stream');
    return fs.createReadStream(fullPath);
  });

  // 3. Register Domain API Routes with prefix /api/v1
  await server.register(authRoutes, { prefix: '/api/v1/auth' });
  await server.register(productRoutes, { prefix: '/api/v1/products' });
  await server.register(batchRoutes, { prefix: '/api/v1/batches' });
  await server.register(promotionRoutes, { prefix: '/api/v1/promotions' });
  await server.register(inventoryRoutes, { prefix: '/api/v1/inventory' });
  await server.register(salesRoutes, { prefix: '/api/v1/sales' });
  await server.register(purchaseRoutes, { prefix: '/api/v1/purchases' });
  await server.register(invoiceRoutes, { prefix: '/api/v1/invoices' });
  await server.register(returnRoutes, { prefix: '/api/v1/returns' });
  await server.register(ledgerRoutes, { prefix: '/api/v1/ledgers' });
  await server.register(cashRoutes, { prefix: '/api/v1/cash' });
  await server.register(expenseRoutes, { prefix: '/api/v1/expenses' });
  await server.register(reportRoutes, { prefix: '/api/v1/reports' });
  await server.register(backupRoutes, { prefix: '/api/v1/backup' });
  await server.register(settingsRoutes, { prefix: '/api/v1/settings' });

  // 4. Central Error Handler
  server.setErrorHandler((error, request, reply) => {
    console.error(`[API ERROR] ${request.method} ${request.url}:`, error);
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      success: false,
      message: error.message || 'Internal Server Error',
      timestamp: new Date().toISOString(),
    });
  });

  // 5. Start Listening
  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 Retail Shop API Server running on port ${env.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
