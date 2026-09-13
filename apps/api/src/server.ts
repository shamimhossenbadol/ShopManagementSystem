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

async function verifyDatabase(): Promise<void> {
  await waitForDatabase();
  console.log('✅ PostgreSQL database ready and verified against canonical schema.');
}

async function main() {
  await verifyDatabase();

  // 1. Plugins
  await server.register(cors, {
    origin: ['http://localhost:3000', 'http://localhost', 'http://127.0.0.1:3000', 'http://127.0.0.1'],
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
