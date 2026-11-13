import { Request, Response } from 'express';
import { z } from 'zod';
import { UserService } from './user.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  roleId: z.string().min(1),
  phone: z.string().optional(),
  password: z.string().min(6).optional(),
});

export class UserController {
  static async list(req: Request, res: Response) {
    try {
      const users = await UserService.listUsers(req.tenantId!);
      return successResponse(res, users);
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const data = createUserSchema.parse(req.body);
      const result = await UserService.createUser(req.tenantId!, data);
      return successResponse(res, result, 'User invited and role assigned', 201);
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  static async reassignRole(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { roleId } = req.body;
      if (!roleId) {
        return errorResponse(res, 'roleId is required', 400);
      }
      const updated = await UserService.reassignRole(req.tenantId!, id, roleId);
      return successResponse(res, updated, 'User role reassigned');
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  static async toggleActive(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { isActive } = req.body;
      const updated = await UserService.toggleActive(req.tenantId!, id, Boolean(isActive));
      return successResponse(res, updated, 'User status updated');
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }
}
