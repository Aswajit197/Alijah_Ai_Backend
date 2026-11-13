import { Request, Response } from 'express';
import { RoleService } from './role.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';

export class RoleController {
  static async list(_req: Request, res: Response) {
    try {
      const roles = await RoleService.listRoles();
      return successResponse(res, roles, 'Roles available for assignment');
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  }
}
