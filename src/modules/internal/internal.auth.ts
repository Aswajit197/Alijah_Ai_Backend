import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { DEFAULT_TENANT_UUID, fromUuid, registerMapping } from './id-mapper.js';

export interface InternalRequest extends Request {
  tenantId?: string;
  tenant?: any;
}

/**
 * Validates x-service-token header for internal service-to-service communication.
 */
export async function requireServiceToken(req: Request, res: Response, next: NextFunction) {
  // Allow health endpoints without auth
  if (req.path === '/health' || req.path === '/internal/v1/health') {
    return next();
  }

  const token = req.headers['x-service-token'] as string;
  const expected = process.env.CORE_SERVICE_TOKEN || 'replace-with-a-long-random-string';

  if (!token || token !== expected) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Missing or invalid x-service-token header',
      },
    });
  }

  next();
}

/**
 * Resolves the tenant from the x-tenant-id header.
 * Seamlessly maps the simulator demo UUID (11111111-1111-4111-8111-111111111111)
 * or mapped CUID to the active database Tenant.
 */
export async function resolveInternalTenant(req: InternalRequest, res: Response, next: NextFunction) {
  const rawTenantId = req.headers['x-tenant-id'] as string;

  try {
    const activeTenants = await prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });

    if (activeTenants.length === 0) {
      return res.status(500).json({
        error: { code: 'NO_ACTIVE_TENANT', message: 'No active tenant found in system' },
      });
    }

    // Default to Vanguard Electric & Power or the primary active company
    const defaultTenant =
      activeTenants.find((t) => t.slug === 'vanguard-electric') || activeTenants[0];
    registerMapping(defaultTenant.id, DEFAULT_TENANT_UUID);

    if (!rawTenantId || rawTenantId.toLowerCase() === DEFAULT_TENANT_UUID.toLowerCase()) {
      req.tenantId = defaultTenant.id;
      req.tenant = defaultTenant;
      return next();
    }

    const resolvedId = fromUuid(rawTenantId);
    let matched = activeTenants.find(
      (t) => t.id === resolvedId || t.id === rawTenantId || t.slug === rawTenantId
    );

    if (!matched) {
      matched = defaultTenant;
    }

    req.tenantId = matched.id;
    req.tenant = matched;
    next();
  } catch (error: any) {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Tenant resolution failure' },
    });
  }
}
