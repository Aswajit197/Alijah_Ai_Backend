import { Request, Response } from 'express';
import { z } from 'zod';
import { TenantAuthService } from './auth.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().optional(),
});

const setPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export class TenantAuthController {
  static async getInvitation(req: Request, res: Response) {
    try {
      const token = req.params.token as string;
      const result = await TenantAuthService.getInvitationByToken(token);
      return successResponse(res, result, 'Invitation details loaded');
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  static async setPassword(req: Request, res: Response) {
    try {
      const data = setPasswordSchema.parse(req.body);
      const result = await TenantAuthService.setPasswordWithToken(data);
      return successResponse(res, result, 'Password set successfully. Welcome to Elijah AI!');
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

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

