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
      return successResponse(res, result, 'Tenant created and default roles initialized', 201);
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
}
