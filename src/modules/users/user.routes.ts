import { Router } from 'express';
import { UserController } from './user.controller.js';
import { authenticate, requireTenantUser } from '../../middleware/auth.js';
import { enforceTenantIsolation } from '../../middleware/tenantContext.js';
import { requirePermission } from '../../middleware/checkPermission.js';

const router = Router();

router.use(authenticate, requireTenantUser, enforceTenantIsolation);

// Read users list (view_settings permission)
router.get('/', requirePermission('view_settings'), UserController.list);

// Manage team members (manage_users permission)
router.post('/', requirePermission('manage_users'), UserController.create);
router.patch('/:id/role', requirePermission('manage_users'), UserController.reassignRole);
router.patch('/:id/status', requirePermission('manage_users'), UserController.toggleActive);

export const userRoutes = router;

