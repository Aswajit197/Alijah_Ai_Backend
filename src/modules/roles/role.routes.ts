import { Router } from 'express';
import { RoleController } from './role.controller.js';
import { authenticate, requireTenantUser } from '../../middleware/auth.js';
import { enforceTenantIsolation } from '../../middleware/tenantContext.js';

const router = Router();

// Companies can read roles (authenticated) to select when inviting/assigning users
router.use(authenticate, requireTenantUser, enforceTenantIsolation);
router.get('/', RoleController.list);

export const roleRoutes = router;
