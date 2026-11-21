import { Router } from 'express';
import { SuperAdminController } from './superAdmin.controller.js';
import { authenticate, requireSuperAdmin } from '../../middleware/auth.js';

const router = Router();

// Public SuperAdmin route
router.post('/auth/login', SuperAdminController.login);

// Protected SuperAdmin routes
router.use(authenticate, requireSuperAdmin);

// Tenant management
router.get('/tenants', SuperAdminController.listTenants);
router.post('/tenants', SuperAdminController.createTenant);
router.post('/tenants/:id/resend-invite', SuperAdminController.resendInvite);
router.patch('/tenants/:id/status', SuperAdminController.updateStatus);

// Role & Permission Management (SuperAdmin Only)
router.get('/permissions', SuperAdminController.getPermissions);
router.post('/permissions', SuperAdminController.createPermission);
router.put('/permissions/:id', SuperAdminController.updatePermission);
router.delete('/permissions/:id', SuperAdminController.deletePermission);

router.get('/roles', SuperAdminController.listRoles);
router.post('/roles', SuperAdminController.createRole);
router.put('/roles/:id', SuperAdminController.updateRole);
router.delete('/roles/:id', SuperAdminController.deleteRole);

// SuperAdmin Notifications & Platform Alerts
router.get('/notifications', SuperAdminController.listNotifications);
router.patch('/notifications/read-all', SuperAdminController.markAllNotificationsRead);
router.patch('/notifications/:id/read', SuperAdminController.markNotificationRead);
router.delete('/notifications/:id', SuperAdminController.deleteNotification);

export const superAdminRoutes = router;
