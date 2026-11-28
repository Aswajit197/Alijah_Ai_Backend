import { Request, Response } from 'express';
import { ProjectService } from './project.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';

export class ProjectController {
  static async list(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const { stage, search } = req.query;

      const result = await ProjectService.listProjects(tenantId, {
        stage: stage ? String(stage) : undefined,
        search: search ? String(search) : undefined,
      });

      return successResponse(res, result);
    } catch (err: any) {
      return errorResponse(res, err.message || 'Failed to list projects', 500);
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const {
        estimateId,
        customerId,
        customerName,
        customerPhone,
        serviceAddress,
        tradeCategory,
        title,
        value,
        stage,
        assignedCrew,
        permitNumber,
        equipmentModel,
        notes,
      } = req.body;

      if (!customerName || !title) {
        return errorResponse(res, 'Customer name and project title are required', 400);
      }

      const project = await ProjectService.createProject(tenantId, {
        estimateId,
        customerId,
        customerName,
        customerPhone,
        serviceAddress,
        tradeCategory,
        title,
        value: Number(value || 0),
        stage,
        assignedCrew,
        permitNumber,
        equipmentModel,
        notes,
      });

      return successResponse(res, project, 'Project created successfully', 201);
    } catch (err: any) {
      return errorResponse(res, err.message || 'Failed to create project', 500);
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const id = String(req.params.id);
      const { stage, assignedCrew, permitNumber, equipmentModel, notes, advanceNextStage } = req.body;

      const project = await ProjectService.updateProject(tenantId, id, {
        stage,
        assignedCrew,
        permitNumber,
        equipmentModel,
        notes,
        advanceNextStage: Boolean(advanceNextStage),
      });

      return successResponse(res, project, 'Project updated successfully');
    } catch (err: any) {
      return errorResponse(res, err.message || 'Failed to update project', 500);
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId;
      const id = String(req.params.id);

      await ProjectService.deleteProject(tenantId, id);
      return successResponse(res, null, 'Project deleted successfully');
    } catch (err: any) {
      return errorResponse(res, err.message || 'Failed to delete project', 500);
    }
  }
}
