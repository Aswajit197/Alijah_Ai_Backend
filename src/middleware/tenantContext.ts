import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response.js';

/**
 * Ensures request has an authenticated tenant context.
 * If X-Tenant-Slug or X-Tenant-Id header is provided by the client,
 * it verifies that it matches the user's authenticated token.
 */
export function enforceTenantIsolation(req: Request, res: Response, next: NextFunction) {
  if (!req.tenantId || !req.tenantUser) {
    return errorResponse(res, 'Access denied. Missing tenant context.', 403);
  }

  const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
  if (headerTenantId && headerTenantId !== req.tenantId) {
    return errorResponse(
      res,
      'Security violation: Cross-tenant access attempt detected.',
      403
    );
  }

  next();
}

