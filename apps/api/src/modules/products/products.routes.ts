import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { parseScaleBarcode } from '../../utils/scaleBarcode.js';

const productSchema = z.object({
  sku: z.string().min(1),
  barcode: z.string().optional().nullable(),
  pluCode: z.string().optional().nullable(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  categoryId: z.coerce.number().optional().nullable(),
  brandId: z.coerce.number().optional().nullable(),
  unitId: z.coerce.number().default(1),
  packagingMultiplier: z.coerce.number().min(0.01).default(1.00),
  taxRateId: z.coerce.number().default(1),
  taxType: z.enum(['inclusive', 'exclusive']).default('exclusive'),
  costPrice: z.coerce.number().min(0).default(0),
  wholesalePrice: z.coerce.number().min(0).optional().nullable(),
  sellingPrice: z.coerce.number().min(0),
  minStockLevel: z.coerce.number().min(0).default(5),
  initialStock: z.coerce.number().min(0).default(0),
  hasExpiry: z.boolean().default(false),
  isWeighable: z.boolean().default(false),
  isQuickPlu: z.boolean().default(false),
});

const updateProductSchema = z.object({
  sku: z.string().min(1).optional(),
  barcode: z.string().optional().nullable(),
  pluCode: z.string().optional().nullable(),
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  categoryId: z.coerce.number().optional().nullable(),
  brandId: z.coerce.number().optional().nullable(),
  unitId: z.coerce.number().optional(),
  packagingMultiplier: z.coerce.number().min(0.01).optional(),
  taxRateId: z.coerce.number().optional(),
  taxType: z.enum(['inclusive', 'exclusive']).optional(),
  costPrice: z.coerce.number().min(0).optional(),
  wholesalePrice: z.coerce.number().min(0).optional().nullable(),
  sellingPrice: z.coerce.number().min(0).optional(),
  minStockLevel: z.coerce.number().min(0).optional(),
  hasExpiry: z.boolean().optional(),
  isWeighable: z.boolean().optional(),
  isQuickPlu: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const categorySchema = z.object({
  name: z.string().min(1),
  parentId: z.coerce.number().optional().nullable(),
  description: z.string().optional().nullable(),
});

export async function productRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/v1/products - List / search products
  fastify.get('/', async (request, reply) => {
    const { search, category_id, is_quick_plu, is_weighable } = request.query as any;
    const isManager = request.user!.role === 'manager';

    let sql = `
      SELECT 
        p.id, p.sku, p.barcode, p.plu_code, p.name, p.description,
        p.category_id, c.name as category_name,
        p.brand_id, b.name as brand_name,
        p.unit_id, u.name as unit_name, u.short_name as unit_short, u.allow_decimal,
        p.packaging_multiplier,
        p.tax_rate_id, t.rate as tax_rate, t.name as tax_name,
        p.tax_type,
        ${isManager ? 'p.cost_price,' : ''}
        p.wholesale_price,
        p.selling_price,
        p.min_stock_level,
        p.has_expiry,
        p.is_weighable,
        p.is_quick_plu,
        p.is_active,
        p.current_stock,
        COALESCE(p.image_url, (SELECT file_path FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, id DESC LIMIT 1)) as image_url,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id', pi.id,
            'file_path', pi.file_path,
            'file_name', pi.file_name,
            'is_primary', pi.is_primary
          )), '[]'::json)
          FROM product_images pi
          WHERE pi.product_id = p.id
        ) as images
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN units u ON p.unit_id = u.id
      LEFT JOIN tax_rates t ON p.tax_rate_id = t.id
      WHERE p.is_active = TRUE AND p.is_deleted = FALSE
    `;

    const params: any[] = [];
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.barcode ILIKE $${params.length} OR p.plu_code ILIKE $${params.length})`;
    }
    if (category_id) {
      params.push(Number(category_id));
      sql += ` AND p.category_id = $${params.length}`;
    }
    if (is_quick_plu === 'true' || is_quick_plu === true) {
      sql += ` AND p.is_quick_plu = TRUE`;
    }
    if (is_weighable === 'true' || is_weighable === true) {
      sql += ` AND p.is_weighable = TRUE`;
    }

    sql += ` ORDER BY p.id ASC LIMIT 200`;

    const res = await query(sql, params);
    return reply.send({ success: true, data: res.rows });
  });

  // GET /api/v1/products/quick-plu - Fast produce grid for POS touchscreens
  fastify.get('/quick-plu', async (request, reply) => {
    const isManager = request.user!.role === 'manager';

    const res = await query(
      `SELECT 
        p.id, p.sku, p.barcode, p.plu_code, p.name,
        p.category_id, c.name as category_name,
        p.unit_id, u.short_name as unit_short, u.allow_decimal,
        p.tax_rate_id, t.rate as tax_rate, p.tax_type,
        ${isManager ? 'p.cost_price,' : ''}
        p.selling_price, p.current_stock, p.has_expiry, p.is_weighable,
        p.image_url,
        (SELECT file_path FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as primary_image
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN units u ON p.unit_id = u.id
       LEFT JOIN tax_rates t ON p.tax_rate_id = t.id
       WHERE (p.is_quick_plu = TRUE OR p.is_weighable = TRUE)
         AND p.is_active = TRUE AND p.is_deleted = FALSE
       ORDER BY c.name ASC, p.name ASC`
    );

    return reply.send({ success: true, data: res.rows });
  });

  // GET /api/v1/products/scan/:barcode - Fast barcode & produce scale decoder lookup
  fastify.get('/scan/:barcode', async (request, reply) => {
    const { barcode } = request.params as { barcode: string };
    const isManager = request.user!.role === 'manager';

    // 1. Check if barcode is a variable-weight scale barcode
    const scaleParsed = parseScaleBarcode(barcode);

    if (scaleParsed.isScaleBarcode && scaleParsed.pluCode) {
      // Find product by PLU code
      const scaleItemRes = await query(
        `SELECT 
          p.id, p.sku, p.barcode, p.plu_code, p.name,
          p.unit_id, u.short_name as unit_short, u.allow_decimal,
          p.tax_rate_id, t.rate as tax_rate, p.tax_type,
          ${isManager ? 'p.cost_price,' : ''}
          p.selling_price, p.current_stock, p.has_expiry, p.is_weighable
         FROM products p
         LEFT JOIN units u ON p.unit_id = u.id
         LEFT JOIN tax_rates t ON p.tax_rate_id = t.id
         WHERE (p.plu_code = $1 OR p.sku = $1 OR p.barcode = $1)
           AND p.is_active = TRUE AND p.is_deleted = FALSE
         LIMIT 1`,
        [scaleParsed.pluCode]
      );

      if (scaleItemRes.rows.length > 0) {
        const item = scaleItemRes.rows[0];
        let scannedQty = 1.0;

        if (scaleParsed.weightKg !== undefined) {
          scannedQty = scaleParsed.weightKg;
        } else if (scaleParsed.embeddedPrice !== undefined && Number(item.selling_price) > 0) {
          scannedQty = Math.round((scaleParsed.embeddedPrice / Number(item.selling_price)) * 1000) / 1000;
        }

        return reply.send({
          success: true,
          isScaleBarcode: true,
          scannedQuantity: scannedQty,
          scannedWeightKg: scaleParsed.weightKg,
          embeddedPrice: scaleParsed.embeddedPrice,
          data: item,
        });
      }
    }

    // 2. Standard Barcode / SKU / PLU lookup
    const res = await query(
      `SELECT 
        p.id, p.sku, p.barcode, p.plu_code, p.name,
        p.unit_id, u.short_name as unit_short, u.allow_decimal,
        p.tax_rate_id, t.rate as tax_rate,
        p.tax_type,
        ${isManager ? 'p.cost_price,' : ''}
        p.selling_price,
        p.current_stock,
        p.has_expiry,
        p.is_weighable,
        p.is_quick_plu
       FROM products p
       LEFT JOIN units u ON p.unit_id = u.id
       LEFT JOIN tax_rates t ON p.tax_rate_id = t.id
       WHERE (p.barcode = $1 OR p.sku = $1 OR p.plu_code = $1)
         AND p.is_active = TRUE AND p.is_deleted = FALSE
       LIMIT 1`,
      [barcode]
    );

    if (res.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        message: `Product with barcode/SKU/PLU "${barcode}" not found.`,
      });
    }

    return reply.send({ success: true, isScaleBarcode: false, scannedQuantity: 1.0, data: res.rows[0] });
  });

  // GET /api/v1/products/categories
  fastify.get('/categories', async (request, reply) => {
    const res = await query(
      `SELECT c.*, COUNT(p.id) as product_count 
       FROM categories c 
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE AND p.is_deleted = FALSE
       WHERE c.is_active = TRUE AND c.is_deleted = FALSE
       GROUP BY c.id ORDER BY c.name ASC`
    );
    return reply.send({ success: true, data: res.rows });
  });

  // POST /api/v1/products/categories (Manager only)
  fastify.post('/categories', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const parsed = categorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: 'Category name required.' });
    }
    const { name, parentId, description } = parsed.data;

    const res = await query(
      `INSERT INTO categories (name, parent_id, description) VALUES ($1, $2, $3) RETURNING *`,
      [name, parentId || null, description || null]
    );

    return reply.status(201).send({ success: true, message: 'Category created.', data: res.rows[0] });
  });

  // GET /api/v1/products/brands
  fastify.get('/brands', async (request, reply) => {
    const res = await query(`SELECT * FROM brands WHERE is_active = TRUE AND is_deleted = FALSE ORDER BY name ASC`);
    return reply.send({ success: true, data: res.rows });
  });

  // POST /api/v1/products/brands (Manager only)
  fastify.post('/brands', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const { name, description } = request.body as any;
    if (!name) return reply.status(400).send({ success: false, message: 'Brand name required' });
    const res = await query(`INSERT INTO brands (name, description) VALUES ($1, $2) RETURNING *`, [name, description || null]);
    return reply.status(201).send({ success: true, data: res.rows[0] });
  });

  // GET /api/v1/products/units
  fastify.get('/units', async (request, reply) => {
    const res = await query(`SELECT * FROM units ORDER BY id ASC`);
    return reply.send({ success: true, data: res.rows });
  });

  // GET /api/v1/products/:id - Single product details
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const isManager = request.user!.role === 'manager';

    const res = await query(
      `SELECT 
        p.*, c.name as category_name, b.name as brand_name, u.name as unit_name, u.short_name as unit_short,
        t.rate as tax_rate
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       LEFT JOIN units u ON p.unit_id = u.id
       LEFT JOIN tax_rates t ON p.tax_rate_id = t.id
       WHERE p.id = $1 AND p.is_deleted = FALSE`,
      [Number(id)]
    );

    if (res.rows.length === 0) {
      return reply.status(404).send({ success: false, message: 'Product not found.' });
    }

    const row = res.rows[0];
    if (!isManager) {
      delete row.cost_price;
    }

    // Attach images
    const imagesRes = await query(
      `SELECT * FROM product_images WHERE product_id = $1 ORDER BY is_primary DESC, sort_order ASC`,
      [Number(id)]
    );
    row.images = imagesRes.rows;

    return reply.send({ success: true, data: row });
  });

  // POST /api/v1/products - Create Product (Manager only)
  fastify.post('/', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const parsed = productSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid product data.',
        errors: parsed.error.format(),
      });
    }

    const data = parsed.data;

    // Check SKU conflict
    const existing = await query(`SELECT id FROM products WHERE sku = $1 AND is_deleted = FALSE`, [data.sku]);
    if (existing.rows.length > 0) {
      return reply.status(400).send({ success: false, message: 'SKU already exists.' });
    }

    const product = await withTransaction(async (client) => {
      const pRes = await client.query(
        `INSERT INTO products (
          sku, barcode, plu_code, name, description, category_id, brand_id,
          unit_id, packaging_multiplier, tax_rate_id, tax_type, cost_price, wholesale_price,
          selling_price, current_stock, min_stock_level, has_expiry, is_weighable, is_quick_plu
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         RETURNING *`,
        [
          data.sku,
          data.barcode || null,
          data.pluCode || null,
          data.name,
          data.description || null,
          data.categoryId || null,
          data.brandId || null,
          data.unitId,
          data.packagingMultiplier,
          data.taxRateId,
          data.taxType,
          data.costPrice,
          data.wholesalePrice || null,
          data.sellingPrice,
          data.initialStock, // Denormalized initial current_stock
          data.minStockLevel,
          data.hasExpiry,
          data.isWeighable,
          data.isQuickPlu,
        ]
      );

      const prod = pRes.rows[0];

      // If initial stock provided, insert opening movement
      if (data.initialStock > 0) {
        await client.query(
          `INSERT INTO stock_movements (product_id, quantity, type, reference_type, unit_cost, user_id, notes)
           VALUES ($1, $2, 'opening', 'opening_stock', $3, $4, 'Initial stock on product creation')`,
          [prod.id, data.initialStock, data.costPrice, request.user!.id]
        );
      }

      // Record audit log
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
         VALUES ($1, 'PRODUCT_CREATED', 'products', $2, $3)`,
        [request.user!.id, prod.id, JSON.stringify({ sku: prod.sku, name: prod.name, sellingPrice: prod.selling_price })]
      );

      return prod;
    });

    return reply.status(201).send({
      success: true,
      message: 'Product created successfully.',
      data: product,
    });
  });

  // PUT /api/v1/products/:id - Update Product (Manager only)
  fastify.put('/:id', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateProductSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: 'Invalid product update data.' });
    }

    const curRes = await query(`SELECT * FROM products WHERE id = $1 AND is_deleted = FALSE`, [Number(id)]);
    if (curRes.rows.length === 0) {
      return reply.status(404).send({ success: false, message: 'Product not found.' });
    }

    const cur = curRes.rows[0];
    const data = parsed.data;

    const updated = await withTransaction(async (client) => {
      const pRes = await client.query(
        `UPDATE products SET
          sku = $1, barcode = $2, plu_code = $3, name = $4, description = $5,
          category_id = $6, brand_id = $7, unit_id = $8, packaging_multiplier = $9,
          tax_rate_id = $10, tax_type = $11, cost_price = $12, wholesale_price = $13,
          selling_price = $14, min_stock_level = $15, has_expiry = $16, is_weighable = $17,
          is_quick_plu = $18, is_active = $19, updated_at = NOW()
         WHERE id = $20 RETURNING *`,
        [
          data.sku ?? cur.sku,
          data.barcode !== undefined ? data.barcode : cur.barcode,
          data.pluCode !== undefined ? data.pluCode : cur.plu_code,
          data.name ?? cur.name,
          data.description !== undefined ? data.description : cur.description,
          data.categoryId !== undefined ? data.categoryId : cur.category_id,
          data.brandId !== undefined ? data.brandId : cur.brand_id,
          data.unitId ?? cur.unit_id,
          data.packagingMultiplier ?? cur.packaging_multiplier,
          data.taxRateId ?? cur.tax_rate_id,
          data.taxType ?? cur.tax_type,
          data.costPrice ?? cur.cost_price,
          data.wholesalePrice !== undefined ? data.wholesalePrice : cur.wholesale_price,
          data.sellingPrice ?? cur.selling_price,
          data.minStockLevel ?? cur.min_stock_level,
          data.hasExpiry ?? cur.has_expiry,
          data.isWeighable ?? cur.is_weighable,
          data.isQuickPlu ?? cur.is_quick_plu,
          data.isActive ?? cur.is_active,
          Number(id),
        ]
      );

      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, old_values, new_values)
         VALUES ($1, 'PRODUCT_UPDATED', 'products', $2, $3, $4)`,
        [
          request.user!.id,
          Number(id),
          JSON.stringify({ name: cur.name, sellingPrice: cur.selling_price }),
          JSON.stringify(data),
        ]
      );

      return pRes.rows[0];
    });

    return reply.send({ success: true, message: 'Product updated successfully.', data: updated });
  });

  // DELETE /api/v1/products/:id - Soft delete Product (Manager only)
  fastify.delete('/:id', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await query(`UPDATE products SET is_deleted = TRUE, is_active = FALSE, updated_at = NOW() WHERE id = $1`, [Number(id)]);

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
       VALUES ($1, 'PRODUCT_DELETED', 'products', $2, $3)`,
      [request.user!.id, Number(id), JSON.stringify({ deletedAt: new Date().toISOString() })]
    );

    return reply.send({ success: true, message: 'Product deleted successfully.' });
  });

  // POST /api/v1/products/:id/images - Upload Product Image (Manager only)
  fastify.post('/:id/images', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { fileName, dataUrl, isPrimary, mimeType } = request.body as any;

    if (!dataUrl || !fileName) {
      return reply.status(400).send({ success: false, message: 'dataUrl and fileName are required.' });
    }

    const baseUploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'data/uploads');
    const uploadDir = path.join(baseUploadDir, 'products');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return reply.status(400).send({ success: false, message: 'Invalid base64 dataUrl.' });
    }

    const detectedMime = mimeType || matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const safeExt = path.extname(fileName) || '.webp';
    const uniqueName = `prod_${id}_${Date.now()}${safeExt}`;
    const targetPath = path.join(uploadDir, uniqueName);

    fs.writeFileSync(targetPath, buffer);

    const filePath = `/api/v1/uploads/products/${uniqueName}`;
    if (isPrimary) {
      await query(`UPDATE product_images SET is_primary = FALSE WHERE product_id = $1`, [Number(id)]);
      await query(`UPDATE products SET image_url = $1 WHERE id = $2`, [filePath, Number(id)]);
    }

    const res = await query(
      `INSERT INTO product_images (product_id, file_path, file_name, file_size_bytes, mime_type, is_primary, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        Number(id),
        filePath,
        fileName,
        buffer.length,
        detectedMime,
        Boolean(isPrimary),
        request.user!.id,
      ]
    );

    return reply.status(201).send({ success: true, message: 'Image uploaded successfully.', data: res.rows[0] });
  });

  // DELETE /api/v1/products/images/:imageId - Delete Product Image (Manager only)
  fastify.delete('/images/:imageId', { preHandler: [requireRole(['manager'])] }, async (request, reply) => {
    const { imageId } = request.params as { imageId: string };
    const imgRes = await query(`SELECT * FROM product_images WHERE id = $1`, [Number(imageId)]);

    if (imgRes.rows.length === 0) {
      return reply.status(404).send({ success: false, message: 'Image not found.' });
    }

    const img = imgRes.rows[0];
    const baseUploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'data/uploads');
    const uploadDir = path.join(baseUploadDir, 'products');
    const diskPath = path.join(uploadDir, path.basename(img.file_path));

    try {
      if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
    } catch (e) {
      console.warn('Could not delete image from disk:', e);
    }

    await query(`DELETE FROM product_images WHERE id = $1`, [Number(imageId)]);
    await query(
      `UPDATE products 
       SET image_url = (SELECT file_path FROM product_images WHERE product_id = $1 ORDER BY is_primary DESC, id DESC LIMIT 1)
       WHERE id = $1`,
      [img.product_id]
    );
    return reply.send({ success: true, message: 'Image deleted successfully.' });
  });

  // GET /api/v1/products/:id/barcode-label - Thermal Barcode Label Generator
  fastify.get('/:id/barcode-label', async (request, reply) => {
    const { id } = request.params as { id: string };
    const prodRes = await query(
      `SELECT p.*, t.rate as tax_rate, t.name as tax_name 
       FROM products p 
       LEFT JOIN tax_rates t ON t.id = p.tax_rate_id 
       WHERE p.id = $1 AND p.is_deleted = FALSE`,
      [Number(id)]
    );

    if (prodRes.rows.length === 0) {
      return reply.status(404).send({ success: false, message: 'Product not found.' });
    }

    const prod = prodRes.rows[0];
    const settingsRes = await query(`SELECT setting_key, setting_value FROM settings`);
    const settingsMap = Object.fromEntries(settingsRes.rows.map((r) => [r.setting_key, r.setting_value]));

    return reply.send({
      success: true,
      data: {
        shopName: settingsMap.shop_name_en || 'AL-NOOR SUPERMARKET & HYPERMARKET',
        shopNameAr: settingsMap.shop_name_ar || 'AL-NOOR RETAIL POS',
        productName: prod.name,
        sku: prod.sku,
        barcode: prod.barcode || prod.sku,
        price: Number(prod.selling_price),
        currency: settingsMap.currency_symbol || 'SAR',
        taxRate: Number(prod.tax_rate || 15),
        isTaxInclusive: prod.tax_type === 'inclusive' || settingsMap.prices_include_tax === 'true',
        formattedPrice: `${Number(prod.selling_price).toFixed(2)} ${settingsMap.currency_symbol || 'SAR'}`,
        labelDimensions: {
          standard: '50x25mm',
          compact: '40x30mm',
        },
      },
    });
  });
}
