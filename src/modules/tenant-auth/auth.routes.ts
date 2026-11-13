import { Router } from 'express';
import { TenantAuthController } from './auth.controller.js';
import { authenticate, requireTenantUser } from '../../middleware/auth.js';
import { enforceTenantIsolation } from '../../middleware/tenantContext.js';

const router = Router();

// Public login endpoint
router.post('/login', TenantAuthController.login);

// Protected current user profile
router.get('/me', authenticate, requireTenantUser, enforceTenantIsolation, TenantAuthController.me);

export const tenantAuthRoutes = router;

