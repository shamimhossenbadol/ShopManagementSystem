import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const createUserSchema = z.object({
  role: z.enum(['manager', 'sales_executive']).default('sales_executive'),
  username: z.string().min(3),
  email: z.string().email().optional().nullable(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  phone: z.string().optional().nullable(),
  pinCode: z.string().min(4).max(10).optional().nullable(),
});

const updateUserSchema = z.object({
  role: z.enum(['manager', 'sales_executive']).optional(),
  email: z.string().email().optional().nullable(),
  fullName: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  pinCode: z.string().min(4).max(10).optional().nullable(),
  isActive: z.boolean().optional(),
});

const changePasswordSchema = z.object({
  newPassword: z.string().min(6),
});

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/v1/auth/login - Staff Login
  fastify.post('/login', async (request, reply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid login credentials format.',
        errors: parseResult.error.format(),
      });
    }

    const { username, password } = parseResult.data;

    const userRes = await query(
      `SELECT id, role, username, password_hash, full_name, is_active, pin_code 
       FROM users 
       WHERE username = $1`,
      [username]
    );

    if (userRes.rows.length === 0) {
      return reply.status(401).send({
        success: false,
        message: 'Invalid username or password.',
      });
    }

    const user = userRes.rows[0];

    if (!user.is_active) {
      return reply.status(403).send({
        success: false,
        message: 'Account is deactivated. Please contact the manager.',
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return reply.status(401).send({
        success: false,
        message: 'Invalid username or password.',
      });
    }

    // Update last_login_at
    await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);

    // Issue JWT
    const token = fastify.jwt.sign({
      id: user.id,
      role: user.role,
      username: user.username,
      fullName: user.full_name,
    });

    // Record login audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
       VALUES ($1, 'USER_LOGIN', 'users', $1, $2)`,
      [user.id, JSON.stringify({ username: user.username, role: user.role, timestamp: new Date().toISOString() })]
    );

    // Set HTTP-Only cookie (secure: false enables local shop LAN HTTP operation)
    reply.setCookie('auth_token', token, {
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 12 * 60 * 60, // 12 hours
    });

    return reply.send({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: {
          id: user.id,
          role: user.role,
          username: user.username,
          fullName: user.full_name,
          pinCode: user.pin_code,
        },
      },
    });
  });

  // POST /api/v1/auth/logout
  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('auth_token', { path: '/' });
    return reply.send({
      success: true,
      message: 'Logged out successfully.',
    });
  });

  // GET /api/v1/auth/me - Current User & Shift Profile
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const userRes = await query(
      `SELECT id, role, username, email, full_name, phone, pin_code, is_active, last_login_at 
       FROM users 
       WHERE id = $1`,
      [request.user!.id]
    );

    if (userRes.rows.length === 0) {
      return reply.status(404).send({ success: false, message: 'User not found.' });
    }

    // Check active cash session
    const sessionRes = await query(
      `SELECT id, status, opened_at, opening_balance 
       FROM cash_sessions 
       WHERE user_id = $1 AND status = 'open' 
       ORDER BY opened_at DESC LIMIT 1`,
      [request.user!.id]
    );

    return reply.send({
      success: true,
      data: {
        user: userRes.rows[0],
        activeShift: sessionRes.rows[0] || null,
      },
    });
  });

  // GET /api/v1/auth/users - List all staff (Manager only)
  fastify.get('/users', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const res = await query(
      `SELECT id, role, username, email, full_name, phone, pin_code, is_active, last_login_at, created_at 
       FROM users 
       ORDER BY id ASC`
    );
    return reply.send({ success: true, data: res.rows });
  });

  // POST /api/v1/auth/users - Create new staff account (Manager only)
  fastify.post('/users', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid user registration data.',
        errors: parsed.error.format(),
      });
    }

    const { role, username, email, password, fullName, phone, pinCode } = parsed.data;

    // Check username conflict
    const existRes = await query(`SELECT id FROM users WHERE username = $1`, [username]);
    if (existRes.rows.length > 0) {
      return reply.status(400).send({ success: false, message: 'Username already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const res = await query(
      `INSERT INTO users (role, username, email, password_hash, full_name, phone, pin_code, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       RETURNING id, role, username, email, full_name, phone, pin_code, is_active, created_at`,
      [role, username, email || null, passwordHash, fullName, phone || null, pinCode || null]
    );

    // Audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
       VALUES ($1, 'USER_CREATED', 'users', $2, $3)`,
      [request.user!.id, res.rows[0].id, JSON.stringify({ username, role, fullName })]
    );

    return reply.status(201).send({
      success: true,
      message: 'Staff user created successfully.',
      data: res.rows[0],
    });
  });

  // PUT /api/v1/auth/users/:id - Update staff details (Manager only)
  fastify.put('/users/:id', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: 'Invalid update data.' });
    }

    const updates = parsed.data;
    const currentRes = await query(`SELECT * FROM users WHERE id = $1`, [Number(id)]);
    if (currentRes.rows.length === 0) {
      return reply.status(404).send({ success: false, message: 'User not found.' });
    }

    const cur = currentRes.rows[0];
    const role = updates.role ?? cur.role;
    const email = updates.email !== undefined ? updates.email : cur.email;
    const fullName = updates.fullName ?? cur.full_name;
    const phone = updates.phone !== undefined ? updates.phone : cur.phone;
    const pinCode = updates.pinCode !== undefined ? updates.pinCode : cur.pin_code;
    const isActive = updates.isActive !== undefined ? updates.isActive : cur.is_active;

    const res = await query(
      `UPDATE users 
       SET role = $1, email = $2, full_name = $3, phone = $4, pin_code = $5, is_active = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING id, role, username, email, full_name, phone, pin_code, is_active, updated_at`,
      [role, email, fullName, phone, pinCode, isActive, Number(id)]
    );

    // Audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, old_values, new_values)
       VALUES ($1, 'USER_UPDATED', 'users', $2, $3, $4)`,
      [
        request.user!.id,
        Number(id),
        JSON.stringify({ role: cur.role, fullName: cur.full_name, isActive: cur.is_active }),
        JSON.stringify({ role, fullName, isActive }),
      ]
    );

    return reply.send({
      success: true,
      message: 'Staff user updated successfully.',
      data: res.rows[0],
    });
  });

  // PUT /api/v1/auth/users/:id/password - Reset staff password (Manager only)
  fastify.put('/users/:id/password', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [passwordHash, Number(id)]);

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
       VALUES ($1, 'PASSWORD_RESET', 'users', $2, $3)`,
      [request.user!.id, Number(id), JSON.stringify({ targetUserId: Number(id), timestamp: new Date().toISOString() })]
    );

    return reply.send({ success: true, message: 'Password reset successfully.' });
  });

  // POST /api/v1/auth/verify-pin - Quick Manager PIN verification
  fastify.post('/verify-pin', { preHandler: [authenticate] }, async (request, reply) => {
    const { pin } = request.body as { pin: string };
    if (!pin) {
      return reply.status(400).send({ success: false, message: 'PIN code required.' });
    }

    const res = await query(
      `SELECT id, full_name FROM users WHERE role = 'manager' AND pin_code = $1 AND is_active = TRUE LIMIT 1`,
      [pin]
    );

    if (res.rows.length === 0) {
      return reply.status(401).send({ success: false, message: 'Invalid Manager PIN code.' });
    }

    return reply.send({
      success: true,
      message: 'Manager authorized.',
      data: { authorizedBy: res.rows[0].full_name },
    });
  });
}
