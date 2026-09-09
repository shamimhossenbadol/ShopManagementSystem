import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { authenticate, requireRole } from '../../middleware/auth.js';

const loginSchema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
  pin: z.string().optional(),
  sessionType: z.enum(['dashboard', 'pos']).optional(),
  forceLogin: z.boolean().optional().default(false),
  forceTakeover: z.boolean().optional().default(false),
});

const createUserSchema = z
  .object({
    role: z.enum(['manager', 'sales_executive']).default('sales_executive'),
    username: z.string().optional().nullable().or(z.literal('')),
    email: z.string().email().optional().nullable().or(z.literal('')),
    password: z.string().optional().nullable().or(z.literal('')),
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    phone: z.string().optional().nullable().or(z.literal('')),
    pinCode: z.string().optional().nullable().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    // For manager: Username, Password, and PIN are strictly required
    if (data.role === 'manager') {
      if (!data.username || data.username.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['username'],
          message: 'Store Manager requires a username of at least 3 characters.',
        });
      }
      if (!data.password || data.password.trim().length < 6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['password'],
          message: 'Store Manager requires an account password of at least 6 characters.',
        });
      }
      if (!data.pinCode || data.pinCode.trim().length < 5 || data.pinCode.trim().length > 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['pinCode'],
          message: 'Store Manager requires a 5 to 10-digit authorization PIN.',
        });
      }
    }

    // For sales executive: ONLY PIN is required
    if (data.role === 'sales_executive') {
      if (!data.pinCode || data.pinCode.trim().length < 5 || data.pinCode.trim().length > 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['pinCode'],
          message: 'Sales Executive requires a 5 to 10-digit POS unlock PIN.',
        });
      }
    }
  });

const updateUserSchema = z.object({
  password: z.string().min(6).optional().nullable().or(z.literal('')),
  pinCode: z.string().min(5).max(10).optional().nullable().or(z.literal('')),
  isActive: z.boolean().optional(),
});

const promoteUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50)
    .regex(/^[a-z0-9_.-]+$/i, 'Username may only contain letters, numbers, underscores, dashes, and periods.'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  pinCode: z.string().min(5).max(10).optional().nullable().or(z.literal('')),
});

const changePasswordSchema = z.object({
  newPassword: z.string().min(6),
});

async function isUserAncestor(ancestorId: number, childId: number): Promise<boolean> {
  let currentId: number | null = childId;
  const visited = new Set<number>();
  while (currentId !== null && !visited.has(currentId)) {
    visited.add(currentId);
    const res: any = await query(`SELECT created_by FROM users WHERE id = $1`, [currentId]);
    if (!res || !res.rows || res.rows.length === 0 || res.rows[0].created_by === null) {
      break;
    }
    const parentId: number = Number(res.rows[0].created_by);
    if (parentId === ancestorId) {
      return true;
    }
    currentId = parentId;
  }
  return false;
}

interface SseClient {
  sessionId: string;
  sessionType?: 'dashboard' | 'pos';
  reply: any;
}

const activeSseClients = new Map<number, Set<SseClient>>();

export function broadcastSessionEvent(
  userId: number,
  event: 'SESSION_SUPERSEDED' | 'SESSION_TERMINATED',
  keepSessionId?: string,
  targetSessionType?: 'dashboard' | 'pos'
) {
  const userSockets = activeSseClients.get(userId);
  if (!userSockets) return;

  for (const client of Array.from(userSockets)) {
    // If a specific session type is targeted, never interfere with other session types
    if (targetSessionType && client.sessionType && client.sessionType !== targetSessionType) {
      continue;
    }
    if (!keepSessionId || client.sessionId !== keepSessionId) {
      try {
        client.reply.raw.write(
          `event: ${event}\ndata: ${JSON.stringify({ event, timestamp: new Date().toISOString() })}\n\n`
        );
        client.reply.raw.end();
      } catch {
        // Socket already closed
      }
      userSockets.delete(client);
    }
  }

  if (userSockets.size === 0) {
    activeSseClients.delete(userId);
  }
}

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/v1/auth/login - Staff Login (Password or Quick PIN)
  fastify.post('/login', async (request, reply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid login credentials format.',
        errors: parseResult.error.format(),
      });
    }

    const { username, password, pin, forceLogin } = parseResult.data;

    let userRes;
    if (pin && !password) {
      // Secure PIN login: fetch users with a PIN and compare using bcrypt
      const candidateQuery = username
        ? await query(
            `SELECT id, role, username, password_hash, full_name, is_active, pin_code, current_session_id, current_pos_session_id 
             FROM users 
             WHERE username = $1 AND pin_code IS NOT NULL`,
            [username]
          )
        : await query(
            `SELECT id, role, username, password_hash, full_name, is_active, pin_code, current_session_id, current_pos_session_id 
             FROM users 
             WHERE pin_code IS NOT NULL`
          );

      // Iterate candidates and compare PIN hash (supports both hashed and legacy plaintext PINs)
      let matchedUser = null;
      for (const candidate of candidateQuery.rows) {
        if (!candidate.pin_code) continue;
        // Check if PIN is stored as bcrypt hash (starts with $2) or plaintext legacy
        const isHashed = candidate.pin_code.startsWith('$2');
        const pinMatch = isHashed
          ? await bcrypt.compare(pin, candidate.pin_code)
          : candidate.pin_code === pin;
        if (pinMatch) {
          matchedUser = candidate;
          break;
        }
      }

      if (matchedUser && !matchedUser.is_active) {
        return reply.status(403).send({
          success: false,
          message: 'Account access has been revoked. You cannot access this system.',
        });
      }

      userRes = { rows: matchedUser ? [matchedUser] : [] };

      if (userRes.rows.length === 0) {
        return reply.status(401).send({
          success: false,
          message: 'Invalid 5-digit PIN code.',
        });
      }
    } else {
      if (!username || !password) {
        return reply.status(400).send({
          success: false,
          message: 'Username and password are required.',
        });
      }

      userRes = await query(
        `SELECT id, role, username, password_hash, full_name, is_active, pin_code, current_session_id, current_pos_session_id 
         FROM users 
         WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) OR (LOWER($1) = 'manager' AND role = 'manager')`,
        [username.trim()]
      );

      if (userRes.rows.length === 0) {
        return reply.status(401).send({
          success: false,
          message: 'Invalid username or password.',
        });
      }

      const userCheck = userRes.rows[0];
      const passwordMatch = await bcrypt.compare(password, userCheck.password_hash);
      if (!passwordMatch) {
        return reply.status(401).send({
          success: false,
          message: 'Invalid username or password.',
        });
      }
    }

    const user = userRes.rows[0];

    if (!user.is_active) {
      return reply.status(403).send({
        success: false,
        message: 'Account access has been revoked. You cannot access this system.',
      });
    }

    // Determine session type & effective role:
    // PIN login strictly receives executive privileges ('sales_executive').
    // Full manager powers strictly require logging in via username and password.
    const isPinLogin = Boolean(pin && !password);
    const requestedSessionType = parseResult.data.sessionType;
    const sessionType: 'dashboard' | 'pos' = requestedSessionType
      ? requestedSessionType
      : (isPinLogin || user.role === 'sales_executive' ? 'pos' : 'dashboard');

    const effectiveRole = isPinLogin ? 'sales_executive' : user.role;

    // POS Exclusive Session Check: For cashier/PIN logins, enforce single active operator on POS
    if (sessionType === 'pos') {
      const { forceTakeover } = parseResult.data;
      const openSessionRes = await query(
        `SELECT cs.id, cs.user_id, cs.opened_at, cs.opening_balance,
                u.full_name as user_name, u.username as user_username, u.role as user_role
         FROM cash_sessions cs
         JOIN users u ON u.id = cs.user_id
         WHERE cs.status = 'open'
         LIMIT 1`
      );

      if (openSessionRes.rows.length > 0) {
        const activeSession = openSessionRes.rows[0];
        // If the open session belongs to a DIFFERENT user, POS is occupied
        if (activeSession.user_id !== user.id) {
          // Calculate operational cash movements & drawer balance (excluding opening_float)
          const movRes = await query(
            `SELECT COALESCE(SUM(CASE WHEN type = 'cash_in' AND source != 'opening_float' THEN amount WHEN type = 'cash_out' THEN -amount ELSE 0 END), 0) as net_operational_flow
             FROM cash_movements WHERE session_id = $1`,
            [activeSession.id]
          );
          const netFlow = Number(movRes.rows[0]?.net_operational_flow || 0);
          const expectedBalance = Number(activeSession.opening_balance) + netFlow;

          if (!forceTakeover) {
            // Get sales stats for the active session
            const salesStatsRes = await query(
              `SELECT COUNT(id) as sales_count, COALESCE(SUM(grand_total), 0) as total_sales
               FROM sales WHERE session_id = $1 AND sale_status = 'completed'`,
              [activeSession.id]
            );

            return reply.status(409).send({
              success: false,
              code: 'POS_OCCUPIED',
              message: `POS is currently in use by ${activeSession.user_name}.`,
              requiresTakeover: true,
              data: {
                activeOperator: {
                  userId: activeSession.user_id,
                  fullName: activeSession.user_name,
                  username: activeSession.user_username,
                  role: activeSession.user_role || 'sales_executive',
                  openedAt: activeSession.opened_at,
                  salesCount: Number(salesStatsRes.rows[0]?.sales_count || 0),
                  totalSales: Number(salesStatsRes.rows[0]?.total_sales || 0),
                  cashInDrawer: expectedBalance,
                },
              },
            });
          }

          // Force takeover: auto-close the displaced cashier's session
          await query(
            `UPDATE cash_sessions 
             SET status = 'closed', closed_at = NOW(),
                 closing_balance = $1, expected_balance = $1, difference = 0,
                 close_type = 'takeover', force_closed_by = $2,
                 force_close_reason = $3,
                 closing_note = $4
             WHERE id = $5`,
            [
              expectedBalance,
              user.id,
              'Login takeover',
              `Force-closed: Takeover by ${user.full_name} (@${user.username}) during login`,
              activeSession.id,
            ]
          );

          // Invalidate ONLY the displaced cashier's POS session (never touch manager dashboard sessions!)
          await query(`UPDATE users SET current_pos_session_id = NULL WHERE id = $1`, [activeSession.user_id]);
          broadcastSessionEvent(activeSession.user_id, 'SESSION_SUPERSEDED', undefined, 'pos');

          // Audit log
          await query(
            `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
             VALUES ($1, 'CASH_SESSION_FORCE_TAKEOVER', 'cash_sessions', $2, $3)`,
            [
              user.id,
              activeSession.id,
              JSON.stringify({
                displacedUser: activeSession.user_name,
                displacedUserId: activeSession.user_id,
                takenOverBy: user.full_name,
                expectedBalance,
                context: 'login_takeover',
                timestamp: new Date().toISOString(),
              }),
            ]
          );
        }
      }


      // Generate unique POS session identifier
      const sessionId = crypto.randomUUID();

      // Update last_login_at and current_pos_session_id (POS counter only)
      await query(
        `UPDATE users SET last_login_at = NOW(), current_pos_session_id = $1 WHERE id = $2`,
        [sessionId, user.id]
      );

      // Instantly terminate any other active POS SSE connections for this cashier
      broadcastSessionEvent(user.id, 'SESSION_SUPERSEDED', sessionId, 'pos');

      // Issue JWT with embedded sessionId and sessionType: 'pos'
      const token = fastify.jwt.sign({
        id: user.id,
        role: effectiveRole,
        actualRole: user.role,
        username: user.username,
        fullName: user.full_name,
        sessionId,
        sessionType: 'pos',
      });

      // Record login audit log
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
         VALUES ($1, 'USER_LOGIN', 'users', $1, $2)`,
        [user.id, JSON.stringify({ username: user.username, role: effectiveRole, sessionType: 'pos', isPinLogin, timestamp: new Date().toISOString() })]
      );

      // Set HTTP-Only cookie
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
            role: effectiveRole,
            actualRole: user.role,
            username: user.username,
            fullName: user.full_name,
            pinCode: user.pin_code,
            sessionType: 'pos',
          },
        },
      });
    }

    // Manager Dashboard Login (sessionType === 'dashboard')

    // Generate unique session identifier for manager dashboard
    const sessionId = crypto.randomUUID();

    // Update last_login_at and current_session_id (Manager Dashboard only)
    await query(
      `UPDATE users SET last_login_at = NOW(), current_session_id = $1 WHERE id = $2`,
      [sessionId, user.id]
    );

    // Instantly terminate any other active dashboard sessions for this manager (Laptop 2 supersedes Laptop 1)
    broadcastSessionEvent(user.id, 'SESSION_SUPERSEDED', sessionId, 'dashboard');

    // Issue JWT with embedded sessionId and sessionType: 'dashboard'
    const token = fastify.jwt.sign({
      id: user.id,
      role: 'manager',
      actualRole: user.role,
      username: user.username,
      fullName: user.full_name,
      sessionId,
      sessionType: 'dashboard',
    });

    // Record login audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
       VALUES ($1, 'USER_LOGIN', 'users', $1, $2)`,
      [user.id, JSON.stringify({ username: user.username, role: 'manager', sessionType: 'dashboard', timestamp: new Date().toISOString() })]
    );

    // Set HTTP-Only cookie
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
          role: 'manager',
          actualRole: user.role,
          username: user.username,
          fullName: user.full_name,
          pinCode: user.pin_code,
          sessionType: 'dashboard',
        },
      },
    });
  });

  // GET /api/v1/auth/staff-list - Public list of active staff for PIN login selector
  fastify.get('/staff-list', async (request, reply) => {
    const res = await query(
      `SELECT id, username, full_name, role 
       FROM users 
       WHERE is_active = TRUE 
       ORDER BY role ASC, id ASC`
    );
    return reply.send({ success: true, data: res.rows });
  });

  // POST & GET /api/v1/auth/logout - Invalidate Session and Clear Cookies
  const logoutHandler = async (request: any, reply: any) => {
    try {
      const authHeader = request.headers?.authorization;
      const cookieToken = request.cookies?.auth_token;
      let tokenToDecode = '';
      if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        tokenToDecode = authHeader.substring(7).trim();
      } else if (cookieToken) {
        tokenToDecode = cookieToken;
      }

      if (tokenToDecode) {
        const decoded: any = fastify.jwt.decode(tokenToDecode);
        if (decoded?.id) {
          // If any shift is still open, close it cleanly so it does not leave open shifts lingering
          await query(
            `UPDATE cash_sessions 
             SET status = 'closed', closed_at = NOW(), close_type = 'normal',
                 closing_note = COALESCE(closing_note, 'Closed upon user session logout')
             WHERE user_id = $1 AND status = 'open'`,
            [decoded.id]
          );

          // Completely invalidate both POS and Dashboard sessions for this user
          await query(
            `UPDATE users SET current_session_id = NULL, current_pos_session_id = NULL WHERE id = $1`,
            [decoded.id]
          );
          broadcastSessionEvent(decoded.id, 'SESSION_TERMINATED', undefined, 'pos');
          broadcastSessionEvent(decoded.id, 'SESSION_TERMINATED', undefined, 'dashboard');
        }
      }
    } catch (e) {
      // Non-critical if token is already expired or malformed
    }

    reply.setCookie('auth_token', '', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 0,
      expires: new Date(0),
    });
    reply.clearCookie('auth_token', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    });
    return reply.send({
      success: true,
      message: 'Logged out successfully.',
    });
  };

  fastify.post('/logout', logoutHandler);
  fastify.get('/logout', logoutHandler);

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

    const rawUser = userRes.rows[0];

    // Check active cash session: remains active until explicitly closed on logout
    const sessionRes = await query(
      `SELECT id, status, opened_at, opening_balance, opening_card_balance, carry_forward_balance, carry_forward_card_balance, sequence_number, terminal_name 
       FROM cash_sessions 
       WHERE user_id = $1 AND status = 'open' 
       ORDER BY opened_at DESC LIMIT 1`,
      [request.user!.id]
    );

    return reply.send({
      success: true,
      data: {
        user: {
          ...rawUser,
          role: request.user!.role, // Effective session role ('sales_executive' if PIN login, 'manager' if password login)
          actualRole: rawUser.role, // Underlying database role
          fullName: rawUser.full_name,
        },
        activeShift: sessionRes.rows[0] || null,
      },
    });
  });

  // GET /api/v1/auth/users - List all staff (Manager only)
  fastify.get('/users', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const res = await query(
      `SELECT id, role, username, email, full_name, phone, 
              CASE WHEN pin_code IS NOT NULL THEN '•••••' ELSE NULL END AS pin_code, 
              is_active, created_by, last_login_at, created_at 
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

    let finalUsername: string | null = null;
    let passwordHash: string | null = null;

    if (role === 'manager') {
      finalUsername = username ? username.trim().toLowerCase() : '';
      if (!finalUsername || finalUsername.length < 3) {
        return reply.status(400).send({ success: false, message: 'Store Manager requires a username of at least 3 characters.' });
      }
      // Check username conflict (case insensitive)
      const existRes = await query(`SELECT id FROM users WHERE LOWER(username) = LOWER($1)`, [finalUsername]);
      if (existRes.rows.length > 0) {
        return reply.status(400).send({ success: false, message: 'Username already taken.' });
      }
      passwordHash = password && password.trim().length >= 6
        ? await bcrypt.hash(password.trim(), 10)
        : null;
    } else {
      // Sales executive: username and password are strictly NULL
      finalUsername = null;
      passwordHash = null;
    }

    const pinHash = pinCode && pinCode.trim().length >= 5
      ? await bcrypt.hash(pinCode.trim(), 10)
      : null;

    const res = await query(
      `INSERT INTO users (role, username, email, password_hash, full_name, phone, pin_code, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)
       RETURNING id, role, username, email, full_name, phone, 
                 CASE WHEN pin_code IS NOT NULL THEN '•••••' ELSE NULL END AS pin_code, 
                 is_active, created_by, created_at`,
      [role, finalUsername, email ? email.trim() : null, passwordHash, fullName.trim(), phone ? phone.trim() : null, pinHash, request.user!.id]
    );

    // Audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
       VALUES ($1, 'USER_CREATED', 'users', $2, $3)`,
      [request.user!.id, res.rows[0].id, JSON.stringify({ username: finalUsername, role, fullName: fullName.trim() })]
    );

    return reply.status(201).send({
      success: true,
      message: 'Staff user created successfully.',
      data: res.rows[0],
    });
  });

  // PUT /api/v1/auth/users/:id - Update staff credentials (PIN/OTP for both; Password for Manager; Name/Username permanent)
  fastify.put('/users/:id', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: 'Invalid update data.', errors: parsed.error.format() });
    }

    const updates = parsed.data;
    const currentRes = await query(`SELECT * FROM users WHERE id = $1`, [Number(id)]);
    if (currentRes.rows.length === 0) {
      return reply.status(404).send({ success: false, message: 'User not found.' });
    }

    const cur = currentRes.rows[0];
    let pinCode = cur.pin_code;
    if (updates.pinCode && updates.pinCode.trim().length >= 5) {
      pinCode = updates.pinCode.startsWith('$2') ? updates.pinCode : await bcrypt.hash(updates.pinCode.trim(), 10);
    }

    let passwordHash = cur.password_hash;
    if (cur.role === 'manager' && updates.password && updates.password.trim().length >= 6) {
      passwordHash = await bcrypt.hash(updates.password.trim(), 10);
    }

    const isActive = updates.isActive !== undefined ? updates.isActive : cur.is_active;

    const res = await query(
      `UPDATE users 
       SET pin_code = $1, password_hash = $2, is_active = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id, role, username, email, full_name, phone, 
                 CASE WHEN pin_code IS NOT NULL THEN '•••••' ELSE NULL END AS pin_code, 
                 is_active, created_by, updated_at`,
      [pinCode, passwordHash, isActive, Number(id)]
    );

    // Audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, old_values, new_values)
       VALUES ($1, 'USER_UPDATED', 'users', $2, $3, $4)`,
      [
        request.user!.id,
        Number(id),
        JSON.stringify({ fullName: cur.full_name, isActive: cur.is_active }),
        JSON.stringify({ fullName: cur.full_name, isActive }),
      ]
    );

    return reply.send({
      success: true,
      message: 'Staff credentials updated successfully.',
      data: res.rows[0],
    });
  });

  // POST /api/v1/auth/users/:id/promote - Promote Sales Executive to Store Manager
  fastify.post('/users/:id/promote', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = promoteUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid promotion credentials.',
        errors: parsed.error.format(),
      });
    }

    const { username, password, pinCode } = parsed.data;
    const cleanUsername = username.trim().toLowerCase();

    const targetUserRes = await query(`SELECT * FROM users WHERE id = $1`, [Number(id)]);
    if (targetUserRes.rows.length === 0) {
      return reply.status(404).send({ success: false, message: 'Staff member not found.' });
    }

    const targetUser = targetUserRes.rows[0];
    if (targetUser.role === 'manager') {
      return reply.status(400).send({ success: false, message: 'Staff member is already a Store Manager.' });
    }
    if (!targetUser.is_active) {
      return reply.status(400).send({ success: false, message: 'Cannot promote a deactivated staff member. Please restore access first.' });
    }

    // Check username uniqueness against other users
    const conflictRes = await query(`SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2`, [cleanUsername, Number(id)]);
    if (conflictRes.rows.length > 0) {
      return reply.status(400).send({ success: false, message: `Username '${cleanUsername}' is already taken. Please choose another.` });
    }

    const passwordHash = await bcrypt.hash(password.trim(), 10);
    // If a new PIN was provided, update it; otherwise preserve existing PIN
    const pinHash = pinCode && pinCode.trim().length >= 5
      ? await bcrypt.hash(pinCode.trim(), 10)
      : targetUser.pin_code;

    const res = await query(
      `UPDATE users 
       SET role = 'manager', 
           username = $1, 
           password_hash = $2, 
           pin_code = $3, 
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, role, username, email, full_name, phone, 
                 CASE WHEN pin_code IS NOT NULL THEN '•••••' ELSE NULL END AS pin_code, 
                 is_active, created_by, updated_at`,
      [cleanUsername, passwordHash, pinHash, Number(id)]
    );

    // Audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, old_values, new_values)
       VALUES ($1, 'USER_PROMOTED_TO_MANAGER', 'users', $2, $3, $4)`,
      [
        request.user!.id,
        Number(id),
        JSON.stringify({ role: 'sales_executive', fullName: targetUser.full_name }),
        JSON.stringify({ role: 'manager', username: cleanUsername, fullName: targetUser.full_name }),
      ]
    );

    return reply.send({
      success: true,
      message: `Staff member ${targetUser.full_name} has been promoted to Store Manager.`,
      data: res.rows[0],
    });
  });

  // POST /api/v1/auth/users/:id/revoke - Permanently revoke a user's system access (Parent-based protection)
  fastify.post('/users/:id/revoke', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const targetUserId = Number(id);
    const callerId = request.user!.id;

    if (targetUserId === callerId) {
      return reply.status(400).send({ success: false, message: 'You cannot revoke your own account access.' });
    }

    const targetUserRes = await query(`SELECT id, role, username, full_name, is_active, created_by FROM users WHERE id = $1`, [targetUserId]);
    if (targetUserRes.rows.length === 0) {
      return reply.status(404).send({ success: false, message: 'Staff member not found.' });
    }

    const targetUser = targetUserRes.rows[0];

    // Root administrator protection: target has no parent or id === 1
    if (targetUserId === 1 || (targetUser.created_by === null && callerId !== 1)) {
      return reply.status(403).send({ success: false, message: 'Access denied. The root administrator account cannot be revoked.' });
    }

    // Parent hierarchy check: Child can never revoke access of parent or ancestors
    const isTargetParent = await isUserAncestor(targetUserId, callerId);
    if (isTargetParent) {
      return reply.status(403).send({
        success: false,
        message: 'Access denied. A child account cannot revoke access for a parent administrator.',
      });
    }

    // Deactivate user and clear active session IDs
    const res = await query(
      `UPDATE users 
       SET is_active = FALSE, 
           current_session_id = NULL, 
           current_pos_session_id = NULL, 
           updated_at = NOW() 
       WHERE id = $1 
       RETURNING id, role, username, full_name, is_active, updated_at`,
      [targetUserId]
    );

    // Immediately kick all active SSE sessions for this user
    broadcastSessionEvent(targetUserId, 'SESSION_TERMINATED');

    // Auto-close any active cash register sessions
    await query(
      `UPDATE cash_sessions 
       SET status = 'closed', closed_at = NOW(), closing_note = 'Auto-closed: Staff access revoked by manager' 
       WHERE user_id = $1 AND status = 'open'`,
      [targetUserId]
    );

    // Audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
       VALUES ($1, 'USER_ACCESS_REVOKED', 'users', $2, $3)`,
      [
        callerId,
        targetUserId,
        JSON.stringify({ revokedUserId: targetUserId, fullName: targetUser.full_name, role: targetUser.role, timestamp: new Date().toISOString() }),
      ]
    );

    return reply.send({
      success: true,
      message: `System access for ${targetUser.full_name} has been revoked.`,
      data: res.rows[0],
    });
  });

  // POST /api/v1/auth/users/:id/restore - Restore a user's system access
  fastify.post('/users/:id/restore', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const targetUserId = Number(id);
    const callerId = request.user!.id;

    const targetUserRes = await query(`SELECT id, role, username, full_name, is_active, created_by FROM users WHERE id = $1`, [targetUserId]);
    if (targetUserRes.rows.length === 0) {
      return reply.status(404).send({ success: false, message: 'Staff member not found.' });
    }

    const targetUser = targetUserRes.rows[0];

    // Parent hierarchy check: Child can never modify access for parent or ancestors
    const isTargetParent = await isUserAncestor(targetUserId, callerId);
    if (isTargetParent) {
      return reply.status(403).send({
        success: false,
        message: 'Access denied. A child account cannot modify access for a parent administrator.',
      });
    }

    const res = await query(
      `UPDATE users 
       SET is_active = TRUE, updated_at = NOW() 
       WHERE id = $1 
       RETURNING id, role, username, full_name, is_active, updated_at`,
      [targetUserId]
    );

    // Audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
       VALUES ($1, 'USER_ACCESS_RESTORED', 'users', $2, $3)`,
      [
        request.user!.id,
        targetUserId,
        JSON.stringify({ restoredUserId: targetUserId, fullName: targetUser.full_name, role: targetUser.role, timestamp: new Date().toISOString() }),
      ]
    );

    return reply.send({
      success: true,
      message: `System access for ${targetUser.full_name} has been restored.`,
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

  // PUT /api/v1/auth/users/:id/pin - Reset staff 5-digit PIN (Manager only)
  fastify.put('/users/:id/pin', { preHandler: [authenticate, requireRole(['manager'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { pinCode } = request.body as { pinCode: string };

    if (!pinCode || pinCode.length < 5 || pinCode.length > 10) {
      return reply.status(400).send({ success: false, message: 'PIN code must be 5 to 10 digits.' });
    }

    const pinHash = await bcrypt.hash(pinCode, 10);
    await query(`UPDATE users SET pin_code = $1, updated_at = NOW() WHERE id = $2`, [pinHash, Number(id)]);

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
       VALUES ($1, 'PIN_RESET', 'users', $2, $3)`,
      [request.user!.id, Number(id), JSON.stringify({ targetUserId: Number(id), timestamp: new Date().toISOString() })]
    );

    return reply.send({ success: true, message: 'Staff 5-digit PIN updated successfully.' });
  });

  // POST /api/v1/auth/verify-pin - Quick Manager PIN verification
  fastify.post('/verify-pin', { preHandler: [authenticate] }, async (request, reply) => {
    const { pin } = request.body as { pin: string };
    if (!pin) {
      return reply.status(400).send({ success: false, message: 'PIN code required.' });
    }

    // Secure: fetch all active managers with PINs and compare using bcrypt
    const candidates = await query(
      `SELECT id, full_name, pin_code FROM users WHERE role = 'manager' AND pin_code IS NOT NULL AND is_active = TRUE`
    );

    let authorizedManager = null;
    for (const mgr of candidates.rows) {
      if (!mgr.pin_code) continue;
      const isHashed = mgr.pin_code.startsWith('$2');
      const match = isHashed
        ? await bcrypt.compare(pin, mgr.pin_code)
        : mgr.pin_code === pin;
      if (match) {
        authorizedManager = mgr;
        break;
      }
    }

    if (!authorizedManager) {
      return reply.status(401).send({ success: false, message: 'Invalid Manager PIN code.' });
    }

    return reply.send({
      success: true,
      message: 'Manager authorized.',
      data: { authorizedBy: authorizedManager.full_name },
    });
  });

  // POST /api/v1/auth/switch-to-pos - Demote Manager to Sales Executive POS Session (Requires PIN Verification)
  fastify.post('/switch-to-pos', { preHandler: [authenticate] }, async (request, reply) => {
    const { pin } = (request.body as { pin?: string }) || {};
    
    if (!pin || pin.length < 5) {
      return reply.status(400).send({
        success: false,
        message: 'A valid 5-digit PIN is required to activate POS terminal session.',
      });
    }

    const userRes = await query(
      `SELECT id, role, username, full_name, is_active, pin_code FROM users WHERE id = $1`,
      [request.user!.id]
    );

    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      return reply.status(403).send({ success: false, message: 'User not active or found.' });
    }

    const user = userRes.rows[0];

    // Verify PIN matches (supports bcrypt hashed and legacy plaintext PINs)
    const isHashed = user.pin_code?.startsWith('$2');
    const pinMatch = user.pin_code
      ? (isHashed ? await bcrypt.compare(pin, user.pin_code) : user.pin_code === pin)
      : false;

    if (!pinMatch) {
      return reply.status(401).send({
        success: false,
        message: 'Invalid PIN code. Please enter your correct 5-digit PIN to access the POS terminal.',
      });
    }

    // Generate new unique session identifier for POS terminal
    const sessionId = crypto.randomUUID();
    await query(`UPDATE users SET current_pos_session_id = $1 WHERE id = $2`, [sessionId, user.id]);
    broadcastSessionEvent(user.id, 'SESSION_SUPERSEDED', sessionId, 'pos');

    // Issue new JWT with role = 'sales_executive' and sessionType = 'pos'
    const token = fastify.jwt.sign({
      id: user.id,
      role: 'sales_executive',
      actualRole: user.role,
      username: user.username,
      fullName: user.full_name,
      sessionId,
      sessionType: 'pos',
    });

    // Record audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_table, entity_id, new_values)
       VALUES ($1, 'MANAGER_SWITCHED_TO_POS_SHIFT', 'users', $1, $2)`,
      [user.id, JSON.stringify({ username: user.username, effectiveRole: 'sales_executive', sessionType: 'pos', pinVerified: true, timestamp: new Date().toISOString() })]
    );

    // Update HTTP-Only auth_token cookie
    reply.setCookie('auth_token', token, {
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 12 * 60 * 60,
    });

    return reply.send({
      success: true,
      message: 'PIN verified. Sales executive POS shift activated.',
      data: {
        token,
        user: {
          id: user.id,
          role: 'sales_executive',
          actualRole: user.role,
          username: user.username,
          fullName: user.full_name,
          sessionType: 'pos',
        },
      },
    });
  });

  // GET /api/v1/auth/session-events - Instant Real-Time SSE Stream for Multi-Device Session Invalidation
  fastify.get('/session-events', { preHandler: [authenticate] }, (request, reply) => {
    const userId = request.user!.id;
    const sessionId = request.user!.sessionId || '';
    const sessionType = request.user!.sessionType || (request.user!.role === 'manager' ? 'dashboard' : 'pos');

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx proxy buffering for instant push
    reply.raw.flushHeaders?.();

    const clientObj: SseClient = { sessionId, sessionType, reply };
    if (!activeSseClients.has(userId)) {
      activeSseClients.set(userId, new Set());
    }
    activeSseClients.get(userId)!.add(clientObj);

    // Initial handshake
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', sessionId })}\n\n`);

    // Keepalive comment ping every 25 seconds
    const keepAliveTimer = setInterval(() => {
      try {
        reply.raw.write(': keep-alive\n\n');
      } catch {
        clearInterval(keepAliveTimer);
      }
    }, 25000);

    request.raw.on('close', () => {
      clearInterval(keepAliveTimer);
      const set = activeSseClients.get(userId);
      if (set) {
        set.delete(clientObj);
        if (set.size === 0) activeSseClients.delete(userId);
      }
    });
  });

  // GET /api/v1/auth/heartbeat - Fast Low-Latency Heartbeat Fallback
  fastify.get('/heartbeat', { preHandler: [authenticate] }, async (request, reply) => {
    return reply.send({
      success: true,
      active: true,
      timestamp: new Date().toISOString(),
    });
  });
}

