import { Router } from 'express';
import { ProjectController } from './project.controller.js';
import { authenticate, requireTenantUser } from '../../middleware/auth.js';
import { enforceTenantIsolation } from '../../middleware/tenantContext.js';
import { requirePermission } from '../../middleware/checkPermission.js';

const router = Router();

router.use(authenticate, requireTenantUser, enforceTenantIsolation);

// Read projects
router.get('/', requirePermission('view_projects'), ProjectController.list);

// Manage projects (restricted to manage_projects: owner, office_manager, sales_estimator)
router.post('/', requirePermission('manage_projects'), ProjectController.create);
router.patch('/:id', requirePermission('manage_projects'), ProjectController.update);
router.delete('/:id', requirePermission('manage_projects'), ProjectController.delete);

export const projectRoutes = router;
