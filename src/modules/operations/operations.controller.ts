import { Request, Response } from 'express';
import { InternalService } from '../internal/internal.service.js';
import { TenantSettingsService } from '../../services/tenantSettings.service.js';

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
      const data = await InternalService.updateServiceArea(tenantId, String(req.params.serviceAreaId), req.body);
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
      await InternalService.deleteServiceArea(tenantId, String(req.params.serviceAreaId));
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
      const updatedBy = req.tenantUser?.sub || 'user';
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

  static async recordTechnicianCheckIn(req: Request, res: Response) {
    try {
      const tenantId = getTenantId(req);
      const data = await InternalService.recordTechnicianCheckIn(tenantId, req.body);
      return res.status(201).json({ data });
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: error.message } });
    }
  }

  // Technician Recommendations for Dispatch
  static async recommendTechnicians(req: Request, res: Response) {
    try {
      const tenantId = getTenantId(req);
      const data = await InternalService.recommendTechnicians(tenantId, String(req.params.jobId));
      return res.json({ data });
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: error.message } });
    }
  }

  // Agent & Prompt Studio Settings
  static async getAgentSettings(req: Request, res: Response) {
    try {
      const tenantId = getTenantId(req);
      const settings = TenantSettingsService.getSettings(tenantId);
      return res.json({
        data: {
          mode: settings.agentMode || 'single',
          inboundGreeting: settings.inboundGreeting,
          followUpGreeting: settings.followUpGreeting,
          prompt: settings.receptionistPrompt,
          promptVersions: settings.promptVersions || [],
        },
      });
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: error.message } });
    }
  }

  static async updateAgentSettings(req: Request, res: Response) {
    try {
      const tenantId = getTenantId(req);
      const user = req.tenantUser?.name || req.tenantUser?.sub || 'Owner';
      const result = TenantSettingsService.savePrompt(tenantId, req.body, user);
      return res.json({ data: result });
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: error.message } });
    }
  }

  static async listPromptVersions(req: Request, res: Response) {
    try {
      const tenantId = getTenantId(req);
      const settings = TenantSettingsService.getSettings(tenantId);
      return res.json({ data: settings.promptVersions || [] });
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: error.message } });
    }
  }

  static async restorePromptVersion(req: Request, res: Response) {
    try {
      const tenantId = getTenantId(req);
      const version = parseInt(String(req.params.version), 10);
      const user = req.tenantUser?.name || req.tenantUser?.sub || 'Owner';
      const settings = TenantSettingsService.restorePromptVersion(tenantId, version, user);
      return res.json({ data: settings });
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: error.message } });
    }
  }

  static async resetPromptToDefault(req: Request, res: Response) {
    try {
      const tenantId = getTenantId(req);
      const user = req.tenantUser?.name || req.tenantUser?.sub || 'Owner';
      const settings = TenantSettingsService.resetPromptToDefault(tenantId, user);
      return res.json({ data: settings });
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: error.message } });
    }
  }
}
