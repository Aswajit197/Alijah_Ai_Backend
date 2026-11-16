import { Router } from 'express';
import { CustomerController } from './customer.controller.js';
import { authenticate, requireTenantUser } from '../../middleware/auth.js';
import { enforceTenantIsolation } from '../../middleware/tenantContext.js';
import { requirePermission } from '../../middleware/checkPermission.js';

const router = Router();

router.use(authenticate, requireTenantUser, enforceTenantIsolation);

// Read customers
router.get('/', requirePermission('view_customers'), CustomerController.list);
router.get('/:id', requirePermission('view_customers'), CustomerController.getById);

// Manage customers
router.post('/', requirePermission('edit_customers'), CustomerController.create);
router.patch('/:id', requirePermission('edit_customers'), CustomerController.update);
router.delete('/:id', requirePermission('edit_customers'), CustomerController.delete);

// Equipment sub-resources
router.post('/:id/equipment', requirePermission('edit_customers'), CustomerController.addEquipment);
router.patch('/:id/equipment/:equipmentId', requirePermission('edit_customers'), CustomerController.updateEquipment);
router.delete('/:id/equipment/:equipmentId', requirePermission('edit_customers'), CustomerController.deleteEquipment);

export const customerRoutes = router;
