import { FastifyRequest, FastifyReply } from 'fastify';

export interface UserJwtPayload {
  id: number;
  role: 'manager' | 'sales_executive';
  username: string;
  fullName: string;
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

// Authentication Hook
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
