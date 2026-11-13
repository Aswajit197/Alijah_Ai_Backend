import { Router } from 'express';
import { RoleController } from './role.controller.js';
import { authenticate, requireTenantUser } from '../../middleware/auth.js';
import { enforceTenantIsolation } from '../../middleware/tenantContext.js';
import { requirePermission } from '../../middleware/checkPermission.js';

const router = Router();

// All role routes require authenticated tenant user & tenant context
router.use(authenticate, requireTenantUser, enforceTenantIsolation);

// Read permissions dictionary
router.get('/permissions', RoleController.getPermissions);

// Read roles
router.get('/', requirePermission('view_settings'), RoleController.list);

// Manage roles (requires manage_roles permission)
router.post('/', requirePermission('manage_roles'), RoleController.create);
router.put('/:id', requirePermission('manage_roles'), RoleController.update);
router.delete('/:id', requirePermission('manage_roles'), RoleController.delete);

export const roleRoutes = router;

