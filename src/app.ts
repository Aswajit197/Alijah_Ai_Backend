import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { superAdminRoutes } from './modules/super-admin/superAdmin.routes.js';
import { tenantAuthRoutes } from './modules/tenant-auth/auth.routes.js';
import { roleRoutes } from './modules/roles/role.routes.js';
import { userRoutes } from './modules/users/user.routes.js';
import { errorResponse } from './utils/response.js';

export const app = express();

// Middlewares
app.use(
  cors({
    origin: env.CORS_ORIGIN.includes(',') ? env.CORS_ORIGIN.split(',') : env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());

// Health Check
app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Elijah AI Backend Core',
  });
});

// Module API Routes
app.use('/api/v1/super', superAdminRoutes);
app.use('/api/v1/auth', tenantAuthRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/users', userRoutes);

// 404 Handler
app.use((_req: Request, res: Response) => {
  return errorResponse(res, 'API endpoint not found', 404);
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  return errorResponse(res, err.message || 'Internal server error', 500);
});

