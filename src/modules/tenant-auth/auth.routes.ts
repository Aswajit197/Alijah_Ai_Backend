import { Router } from 'express';
import { TenantAuthController } from './auth.controller.js';
import { authenticate, requireTenantUser } from '../../middleware/auth.js';
import { enforceTenantIsolation } from '../../middleware/tenantContext.js';

const router = Router();

// Public login & invitation endpoints
router.post('/login', TenantAuthController.login);
router.post('/forgot-password', TenantAuthController.forgotPassword);
router.get('/invitation/:token', TenantAuthController.getInvitation);
router.post('/set-password', TenantAuthController.setPassword);

// Protected current user profile & company settings
router.get('/me', authenticate, requireTenantUser, enforceTenantIsolation, TenantAuthController.me);
router.get('/company-settings', authenticate, requireTenantUser, enforceTenantIsolation, TenantAuthController.getCompanySettings);
router.patch('/company-settings', authenticate, requireTenantUser, enforceTenantIsolation, TenantAuthController.updateCompanySettings);

export const tenantAuthRoutes = router;

