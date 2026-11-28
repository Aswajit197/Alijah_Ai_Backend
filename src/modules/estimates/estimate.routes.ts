import { Router } from 'express';
import { EstimateController } from './estimate.controller.js';
import { authenticate, requireTenantUser } from '../../middleware/auth.js';
import { enforceTenantIsolation } from '../../middleware/tenantContext.js';
import { requirePermission } from '../../middleware/checkPermission.js';

const router = Router();

router.use(authenticate, requireTenantUser, enforceTenantIsolation);

// Read proposals/estimates
router.get('/', requirePermission('view_estimates'), EstimateController.list);

// Manage proposals/estimates (restricted to edit_estimates permission: owner, office_manager, sales_estimator)
router.post('/', requirePermission('edit_estimates'), EstimateController.create);
router.patch('/:id', requirePermission('edit_estimates'), EstimateController.update);
router.delete('/:id', requirePermission('edit_estimates'), EstimateController.delete);

export const estimateRoutes = router;
