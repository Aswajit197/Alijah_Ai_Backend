import { Request, Response, NextFunction } from 'express';
import { verifyToken, SuperAdminTokenPayload, TenantUserTokenPayload } from '../utils/jwt.js';
import { errorResponse } from '../utils/response.js';
import { fromUuid } from '../modules/internal/id-mapper.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      superAdmin?: SuperAdminTokenPayload;
      tenantUser?: TenantUserTokenPayload;
      tenantId?: string;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return errorResponse(res, 'Authentication token missing or invalid format', 401);
  }

  try {
    const payload = verifyToken(token);
    if (payload.type === 'SUPER_ADMIN') {
      req.superAdmin = payload;
    } else if (payload.type === 'TENANT_USER') {
      req.tenantUser = payload;
      req.tenantId = fromUuid(payload.tenantId) || payload.tenantId;
    }
    next();
  } catch (err: any) {
    return errorResponse(res, 'Invalid or expired token', 401, err.message);
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.superAdmin || req.superAdmin.type !== 'SUPER_ADMIN') {
    return errorResponse(res, 'Forbidden: SuperAdmin access required', 403);
  }
  next();
}

export function requireTenantUser(req: Request, res: Response, next: NextFunction) {
  if (!req.tenantUser || req.tenantUser.type !== 'TENANT_USER' || !req.tenantId) {
    return errorResponse(res, 'Forbidden: Tenant user access required', 403);
  }
  next();
}

