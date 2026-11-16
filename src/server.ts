import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/database.js';

async function bootstrap() {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL database');

    app.listen(env.PORT, () => {
      console.log(`🚀 Elijah AI Core API running at http://localhost:${env.PORT}`);
      console.log(`📡 SuperAdmin API:  http://localhost:${env.PORT}/api/v1/super`);
      console.log(`🏢 Tenant Auth API: http://localhost:${env.PORT}/api/v1/auth`);
      console.log(`🛡️  Roles & RBAC:   http://localhost:${env.PORT}/api/v1/roles`);
      console.log(`👥 Users API:       http://localhost:${env.PORT}/api/v1/users`);
      console.log(`📦 Customers API:   http://localhost:${env.PORT}/api/v1/customers`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();

