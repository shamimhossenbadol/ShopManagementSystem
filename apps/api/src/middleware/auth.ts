import { FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/pool.js';

export interface UserJwtPayload {
  id: number;
  role: 'manager' | 'sales_executive';
  actualRole?: 'manager' | 'sales_executive';
  username: string;
  fullName: string;
  sessionId?: string;
  sessionType?: 'dashboard' | 'pos';
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: UserJwtPayload;
    user: UserJwtPayload;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user: UserJwtPayload;
  }
}

// Authentication Hook with Single Active Session Enforcement
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    const cookieToken = request.cookies?.auth_token;

    let decoded: UserJwtPayload | null = null;

    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.substring(7).trim();
      decoded = request.server.jwt.verify<UserJwtPayload>(token);
    } else if (cookieToken) {
      decoded = request.server.jwt.verify<UserJwtPayload>(cookieToken);
    }

    if (!decoded) {
      return reply.status(401).send({
        success: false,
        message: 'Authentication required. Please login.',
        timestamp: new Date().toISOString(),
      });
    }

    // Verify user exists, is active, and session is not superseded by another window/device
    const userRes = await query(
      `SELECT current_session_id, current_pos_session_id, is_active FROM users WHERE id = $1`,
      [decoded.id]
    );

    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      return reply.status(401).send({
        success: false,
        code: 'USER_INACTIVE',
        message: 'Account is deactivated or does not exist.',
        timestamp: new Date().toISOString(),
      });
    }

    // Distinguish between POS cash register shift session and Manager back-office dashboard session
    let activeSessionId: string | null = null;
    if (decoded.sessionType === 'pos') {
      activeSessionId = userRes.rows[0].current_pos_session_id;
    } else if (decoded.sessionType === 'dashboard') {
      activeSessionId = userRes.rows[0].current_session_id;
    } else {
      // Fallback for legacy tokens without explicit sessionType
      activeSessionId = decoded.role === 'sales_executive'
        ? (userRes.rows[0].current_pos_session_id || userRes.rows[0].current_session_id)
        : userRes.rows[0].current_session_id;
    }

    if (!activeSessionId || (decoded.sessionId && activeSessionId !== decoded.sessionId)) {
      return reply.status(401).send({
        success: false,
        code: 'SESSION_SUPERSEDED',
        message: 'This account was logged out or logged in from another window or device.',
        timestamp: new Date().toISOString(),
      });
    }

    request.user = decoded;
  } catch (err: any) {
    return reply.status(401).send({
      success: false,
      message: 'Invalid or expired session token.',
      timestamp: new Date().toISOString(),
    });
  }
}

// Role Authorization Hook
export function requireRole(allowedRoles: Array<'manager' | 'sales_executive'>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        message: 'Authentication required.',
        timestamp: new Date().toISOString(),
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        success: false,
        message: 'Forbidden: You do not have permission to access this resource.',
        timestamp: new Date().toISOString(),
      });
    }
  };
}
