import { Request, Response } from 'express';
import { z } from 'zod';
import { SuperAdminService } from './superAdmin.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const createTenantSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  tradeType: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  plan: z.enum(['STARTER', 'GROWTH', 'OPERATIONS', 'ENTERPRISE']).optional(),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(6).optional(),
});

const roleSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9_-]+$/, 'Slug must be lowercase alphanumeric with underscores/hyphens'),
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

export class SuperAdminController {
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const result = await SuperAdminService.login(email, password);
      return successResponse(res, result, 'SuperAdmin login successful');
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  // --- Tenants ---
  static async listTenants(_req: Request, res: Response) {
    try {
      const tenants = await SuperAdminService.listTenants();
      return successResponse(res, tenants, 'Tenants retrieved successfully');
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  }

  static async createTenant(req: Request, res: Response) {
    try {
      const data = createTenantSchema.parse(req.body);
      const result = await SuperAdminService.createTenant(data);
      return successResponse(res, result, 'Tenant created and owner assigned', 201);
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  static async updateStatus(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { status } = req.body;
      const updated = await SuperAdminService.updateTenantStatus(id, status);
      return successResponse(res, updated, 'Tenant status updated');
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  // --- Global Roles Management ---
  static async listRoles(_req: Request, res: Response) {
    try {
      const roles = await SuperAdminService.listRoles();
      return successResponse(res, roles, 'Platform roles retrieved');
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  }

  static getPermissions(_req: Request, res: Response) {
    const permissions = SuperAdminService.getAvailablePermissions();
    return successResponse(res, permissions);
  }

  static async createRole(req: Request, res: Response) {
    try {
      const data = roleSchema.parse(req.body);
      const role = await SuperAdminService.createRole(data);
      return successResponse(res, role, 'Role created successfully', 201);
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  static async updateRole(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const data = updateRoleSchema.parse(req.body);
      const updated = await SuperAdminService.updateRole(id, data);
      return successResponse(res, updated, 'Role updated successfully');
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  static async deleteRole(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const result = await SuperAdminService.deleteRole(id);
      return successResponse(res, result, 'Role deleted successfully');
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }
}
