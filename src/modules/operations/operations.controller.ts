import { Request, Response } from 'express';
import { InternalService } from '../internal/internal.service.js';

function getTenantId(req: Request): string {
  const tenantId = req.tenantId || (req.headers['x-tenant-id'] as string);
  if (!tenantId) {
    throw new Error('Missing tenant ID');
  }
  return tenantId;
}

export class OperationsController {
  // Service Areas
  static async listServiceAreas(req: Request, res: Response) {
    try {
      const tenantId = getTenantId(req);
      const data = await InternalService.listServiceAreas(tenantId);
      return res.json({ data });
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: error.message } });
    }
  }

  static async createServiceArea(req: Request, res: Response) {
    try {
      const tenantId = getTenantId(req);
      const data = await InternalService.createServiceArea(tenantId, req.body);
      return res.status(201).json({ data });
    } catch (error: any) {
      if (error.code === 'P2002') {
        const target = String(error.meta?.target || '');
        if (target.includes('name')) {
          return res.status(409).json({ error: { code: 'SERVICE_AREA_NAME_TAKEN', message: 'Service area name already exists' } });
        }
        return res.status(409).json({ error: { code: 'ZIP_CODE_ALREADY_SERVED', message: 'One or more ZIP codes are already served' } });
      }
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: error.message } });
    }
  }

  static async updateServiceArea(req: Request, res: Response) {
    try {
      const tenantId = getTenantId(req);
      const data = await InternalService.updateServiceArea(tenantId, req.params.serviceAreaId, req.body);
      return res.json({ data });
    } catch (error: any) {
      if (error.code === 'P2002') {
        const target = String(error.meta?.target || '');
        if (target.includes('name')) {
          return res.status(409).json({ error: { code: 'SERVICE_AREA_NAME_TAKEN', message: 'Service area name already exists' } });
        }
        return res.status(409).json({ error: { code: 'ZIP_CODE_ALREADY_SERVED', message: 'One or more ZIP codes are already served' } });
      }
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: error.message } });
    }
  }

  static async deleteServiceArea(req: Request, res: Response) {
    try {
      const tenantId = getTenantId(req);
      await InternalService.deleteServiceArea(tenantId, req.params.serviceAreaId);
      return res.status(204).send();
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: error.message } });
    }
  }

  // Follow-Up Timing Settings
  static async getFollowUpSettings(req: Request, res: Response) {
    try {
      const tenantId = getTenantId(req);
      const data = await InternalService.getFollowUpSettings(tenantId);
      return res.json({ data });
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: error.message } });
    }
  }

  static async updateFollowUpSettings(req: Request, res: Response) {
    try {
      const tenantId = getTenantId(req);
      const updatedBy = req.tenantUser?.userId || 'user';
      const data = await InternalService.updateFollowUpSettings(tenantId, req.body, updatedBy);
      return res.json({ data });
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: error.message } });
    }
  }

  // Technician Check-Ins
  static async listTechnicianCheckIns(req: Request, res: Response) {
    try {
      const tenantId = getTenantId(req);
      const serviceRequestId = req.query.serviceRequestId ? String(req.query.serviceRequestId) : undefined;
      const data = await InternalService.listTechnicianCheckIns(tenantId, serviceRequestId);
      return res.json({ data });
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: error.message } });
    }
  }
}
