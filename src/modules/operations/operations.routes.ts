import { Router, Request, Response, NextFunction } from 'express';
import { OperationsController } from './operations.controller.js';
import { verifyToken } from '../../utils/jwt.js';

export const operationsRoutes = Router();

// Middleware: Accept either Authorization Bearer token or x-tenant-id
operationsRoutes.use((req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(authHeader.split(' ')[1]);
      if (payload.type === 'TENANT_USER') {
        req.tenantUser = payload;
        req.tenantId = payload.tenantId;
      }
    } catch {
      // Ignored for dev fallback
    }
  }

  // Fallback to x-tenant-id header if not populated from JWT
  if (!req.tenantId && req.headers['x-tenant-id']) {
    req.tenantId = req.headers['x-tenant-id'] as string;
  }

  next();
});

// Service Areas
operationsRoutes.get('/service-areas', OperationsController.listServiceAreas);
operationsRoutes.post('/service-areas', OperationsController.createServiceArea);
operationsRoutes.delete('/service-areas/:serviceAreaId', OperationsController.deleteServiceArea);

// Follow-Up Settings
operationsRoutes.get('/follow-up-settings', OperationsController.getFollowUpSettings);
operationsRoutes.put('/follow-up-settings', OperationsController.updateFollowUpSettings);

// Technician Check-Ins
operationsRoutes.get('/technician-check-ins', OperationsController.listTechnicianCheckIns);
