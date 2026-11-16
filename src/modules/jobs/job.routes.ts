import { Router } from 'express';
import { JobController } from './job.controller.js';
import { authenticate, requireTenantUser } from '../../middleware/auth.js';
import { enforceTenantIsolation } from '../../middleware/tenantContext.js';

const router = Router();

router.use(authenticate, requireTenantUser, enforceTenantIsolation);

// Read routes
router.get('/', JobController.list);
router.get('/technicians', JobController.listTechnicians);
router.get('/active-tech', JobController.getActiveTechJob);
router.get('/:id', JobController.getById);

// Write routes
router.post('/', JobController.create);
router.patch('/:id/dispatch', JobController.dispatch);
router.patch('/:id/status', JobController.updateStatus);
router.patch('/:id', JobController.update);
router.delete('/:id', JobController.delete);

export const jobRoutes = router;
