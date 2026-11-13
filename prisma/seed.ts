import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SYSTEM_PERMISSIONS } from '../src/constants/permissions.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Seed Permissions
  console.log('Inserting system permissions...');
  for (const perm of SYSTEM_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { id: perm.id },
      update: {
        name: perm.name,
        category: perm.category,
        description: perm.description,
      },
      create: perm,
    });
  }
  console.log(`✅ Seeded ${SYSTEM_PERMISSIONS.length} system permissions.`);

  // 2. Seed Super Admin
  const superAdminEmail = process.env.SUPERADMIN_EMAIL || 'superadmin@elijah.ai';
  const superAdminPassword = process.env.SUPERADMIN_PASSWORD || 'SuperSecretPassword123!';
  const superAdminHash = await bcrypt.hash(superAdminPassword, 10);

  const superAdmin = await prisma.superAdmin.upsert({
    where: { email: superAdminEmail },
    update: {
      passwordHash: superAdminHash,
      name: process.env.SUPERADMIN_NAME || 'Platform SuperAdmin',
    },
    create: {
      email: superAdminEmail,
      passwordHash: superAdminHash,
      name: process.env.SUPERADMIN_NAME || 'Platform SuperAdmin',
    },
  });
  console.log(`✅ Seeded SuperAdmin: ${superAdmin.email}`);

  // 3. Seed Demo Tenant: Desert Air HVAC & Plumbing
  const demoSlug = 'desert-air';
  const tenant = await prisma.tenant.upsert({
    where: { slug: demoSlug },
    update: {
      name: 'Desert Air HVAC & Plumbing',
      tradeType: 'HVAC',
      status: 'ACTIVE',
      plan: 'OPERATIONS',
      phone: '(480) 555-0199',
      address: '2410 E University Dr, Phoenix, AZ 85034',
    },
    create: {
      name: 'Desert Air HVAC & Plumbing',
      slug: demoSlug,
      tradeType: 'HVAC',
      status: 'ACTIVE',
      plan: 'OPERATIONS',
      phone: '(480) 555-0199',
      address: '2410 E University Dr, Phoenix, AZ 85034',
    },
  });
  console.log(`✅ Seeded Demo Tenant: ${tenant.name} (${tenant.slug})`);

  // Helper to create role with permissions
  const allPermIds = SYSTEM_PERMISSIONS.map((p) => p.id);
  const hash = await bcrypt.hash('password123', 10);

  async function createOrUpdateRole(
    name: string,
    slug: string,
    isDefault: boolean,
    approvalLimit: number,
    permissions: string[]
  ) {
    const role = await prisma.role.upsert({
      where: {
        tenantId_slug: { tenantId: tenant.id, slug },
      },
      update: {
        name,
        isDefault,
        approvalLimit,
      },
      create: {
        tenantId: tenant.id,
        name,
        slug,
        isDefault,
        approvalLimit,
      },
    });

    // Delete existing role permissions and re-insert
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    });

    for (const permId of permissions) {
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permId,
        },
      });
    }

    return role;
  }

  // A. Default Protected Roles
  const ownerRole = await createOrUpdateRole('Business Owner', 'owner', true, 999999999, allPermIds);
  const adminRole = await createOrUpdateRole('Administrator', 'admin', true, 999999999, allPermIds);

  // B. Dynamic Prototype Roles
  const officeRole = await createOrUpdateRole('Office Manager', 'office-manager', false, 1000, [
    'view_home', 'view_inbox', 'inbox_reply', 'inbox_takeover', 'view_recordings',
    'view_customers', 'edit_customers', 'view_leads', 'book_jobs', 'dispatch_jobs',
    'view_estimates', 'approve_actions', 'view_exceptions', 'view_invoices',
    'view_workflows', 'run_lab', 'view_knowledge', 'manage_knowledge',
    'view_supervisor', 'view_projects', 'view_settings'
  ]);

  const dispatcherRole = await createOrUpdateRole('Dispatcher', 'dispatcher', false, 0, [
    'view_home', 'view_inbox', 'inbox_reply', 'inbox_takeover', 'view_recordings',
    'view_customers', 'view_leads', 'book_jobs', 'dispatch_jobs', 'view_exceptions',
    'view_projects'
  ]);

  const salesRole = await createOrUpdateRole('Sales Manager', 'sales-manager', false, 15000, [
    'view_home', 'view_inbox', 'inbox_reply', 'inbox_takeover', 'view_recordings',
    'view_customers', 'view_leads', 'book_jobs', 'view_estimates', 'edit_estimates',
    'approve_actions', 'view_exceptions', 'view_financial', 'view_workflows',
    'manage_workflows', 'view_results', 'view_knowledge', 'view_projects'
  ]);

  const techRole = await createOrUpdateRole('Field Technician', 'technician', false, 0, [
    'tech_app'
  ]);

  const financeRole = await createOrUpdateRole('Finance / AR', 'finance', false, 5000, [
    'view_home', 'view_customers', 'view_financial', 'view_invoices', 'manage_ar',
    'pay_actions', 'approve_actions', 'view_exceptions', 'view_results', 'view_audit'
  ]);

  console.log('✅ Seeded 7 standard roles for Desert Air.');

  // 4. Seed Demo Users
  const usersToSeed = [
    { email: 'owner@pashupat.cloud', name: 'Michael Carter', roleId: ownerRole.id },
    { email: 'admin@pashupat.cloud', name: 'Jennifer Morgan', roleId: adminRole.id },
    { email: 'office@pashupat.cloud', name: 'Amanda Brooks', roleId: officeRole.id },
    { email: 'dispatcher@pashupat.cloud', name: 'Robert Martinez', roleId: dispatcherRole.id },
    { email: 'sales@pashupat.cloud', name: 'Daniel Reed', roleId: salesRole.id },
    { email: 'technician@pashupat.cloud', name: 'Mike Rodriguez', roleId: techRole.id },
    { email: 'finance@pashupat.cloud', name: 'Rachel Green', roleId: financeRole.id },
  ];

  for (const u of usersToSeed) {
    await prisma.user.upsert({
      where: {
        tenantId_email: { tenantId: tenant.id, email: u.email },
      },
      update: {
        name: u.name,
        roleId: u.roleId,
        passwordHash: hash,
      },
      create: {
        tenantId: tenant.id,
        email: u.email,
        name: u.name,
        roleId: u.roleId,
        passwordHash: hash,
      },
    });
  }

  console.log('✅ Seeded 7 demo users (password: password123)');
  console.log('✨ Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

