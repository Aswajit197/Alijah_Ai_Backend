import { Router } from 'express';
import { NotificationController } from './notification.controller.js';
import { authenticate, requireTenantUser } from '../../middleware/auth.js';
import { enforceTenantIsolation } from '../../middleware/tenantContext.js';

const router = Router();

// Protect all notification routes with tenant authentication
router.use(authenticate, requireTenantUser, enforceTenantIsolation);

router.get('/stream', NotificationController.stream);
router.get('/', NotificationController.list);
router.patch('/read-all', NotificationController.markAllRead);
router.patch('/:id/read', NotificationController.markRead);
router.delete('/:id', NotificationController.delete);

export const notificationRoutes = router;
