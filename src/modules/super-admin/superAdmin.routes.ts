import { Router } from 'express';
import { SuperAdminController } from './superAdmin.controller.js';
import { authenticate, requireSuperAdmin } from '../../middleware/auth.js';

const router = Router();

// Public SuperAdmin route
router.post('/auth/login', SuperAdminController.login);

// Protected SuperAdmin routes
router.use(authenticate, requireSuperAdmin);
router.get('/tenants', SuperAdminController.listTenants);
router.post('/tenants', SuperAdminController.createTenant);
router.patch('/tenants/:id/status', SuperAdminController.updateStatus);

export const superAdminRoutes = router;

