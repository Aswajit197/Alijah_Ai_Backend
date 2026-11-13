import { Request, Response } from 'express';
import { z } from 'zod';
import { RoleService } from './role.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';

const createRoleSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).optional(),
  description: z.string().optional(),
  approvalLimit: z.number().min(0).default(0),
  permissions: z.array(z.string()).default([]),
});

const updateRoleSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  approvalLimit: z.number().min(0).optional(),
  permissions: z.array(z.string()).optional(),
});

export class RoleController {
  static async list(req: Request, res: Response) {
    try {
      const roles = await RoleService.listRoles(req.tenantId!);
      return successResponse(res, roles);
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  }

  static getPermissions(_req: Request, res: Response) {
    const perms = RoleService.getAvailablePermissions();
    return successResponse(res, perms);
  }

  static async create(req: Request, res: Response) {
    try {
      const data = createRoleSchema.parse(req.body);
      const role = await RoleService.createRole(req.tenantId!, data);
      return successResponse(res, role, 'Role created successfully', 201);
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const data = updateRoleSchema.parse(req.body);
      const updated = await RoleService.updateRole(req.tenantId!, id, data);
      return successResponse(res, updated, 'Role updated successfully');
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const result = await RoleService.deleteRole(req.tenantId!, id);
      return successResponse(res, result, 'Role deleted successfully');
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }
}
