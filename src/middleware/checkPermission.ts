import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { errorResponse } from '../utils/response.js';

export function requirePermission(permissionId: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantUser = req.tenantUser;
      if (!tenantUser) {
        return errorResponse(res, 'Authentication required', 401);
      }

      // Fast path: Owners and Admins have global permission within tenant
      if (tenantUser.roleSlug === 'owner' || tenantUser.roleSlug === 'admin') {
        return next();
      }

      // Query role permissions
      const hasPermission = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: tenantUser.roleId,
            permissionId,
          },
        },
      });

      if (!hasPermission) {
        return errorResponse(
          res,
          `Permission denied: Missing '${permissionId}' entitlement`,
          403
        );
      }

      next();
    } catch (err: any) {
      return errorResponse(res, 'Failed to verify permissions', 500, err.message);
    }
  };
}

export function checkApprovalThreshold(amountParamKey = 'amount') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantUser = req.tenantUser;
      if (!tenantUser) {
        return errorResponse(res, 'Authentication required', 401);
      }

      if (tenantUser.roleSlug === 'owner' || tenantUser.roleSlug === 'admin') {
        return next();
      }

      const amount = parseFloat(req.body[amountParamKey] || req.query[amountParamKey] || '0');
      const role = await prisma.role.findUnique({
        where: { id: tenantUser.roleId },
        select: { approvalLimit: true },
      });

      if (!role) {
        return errorResponse(res, 'Role not found', 404);
      }

      const limit = Number(role.approvalLimit);
      if (amount > limit) {
        return errorResponse(
          res,
          `Approval limit exceeded: Requested amount ($${amount}) exceeds your authority ($${limit}). Routed to Needs You.`,
          403
        );
      }

      next();
    } catch (err: any) {
      return errorResponse(res, 'Failed to verify approval threshold', 500, err.message);
    }
  };
}

