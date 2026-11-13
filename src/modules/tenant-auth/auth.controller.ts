import { Request, Response } from 'express';
import { z } from 'zod';
import { TenantAuthService } from './auth.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().optional(),
});

export class TenantAuthController {
  static async login(req: Request, res: Response) {
    try {
      const data = loginSchema.parse(req.body);
      const result = await TenantAuthService.login(data);
      return successResponse(res, result, 'Login successful');
    } catch (err: any) {
      return errorResponse(res, err.message, 401);
    }
  }

  static async me(req: Request, res: Response) {
    try {
      if (!req.tenantUser || !req.tenantId) {
        return errorResponse(res, 'Unauthorized', 401);
      }
      const user = await TenantAuthService.getMe(req.tenantUser.sub, req.tenantId);
      return successResponse(res, user, 'Profile loaded');
    } catch (err: any) {
      return errorResponse(res, err.message, 404);
    }
  }
}

