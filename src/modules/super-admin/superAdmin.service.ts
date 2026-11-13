import { prisma } from '../../config/database.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { signSuperAdminToken } from '../../utils/jwt.js';
import { SYSTEM_PERMISSIONS } from '../../constants/permissions.js';

export class SuperAdminService {
  static async login(email: string, password: string) {
    const admin = await prisma.superAdmin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!admin || !admin.isActive) {
      throw new Error('Invalid superadmin credentials or account deactivated');
    }

    const isValid = await verifyPassword(password, admin.passwordHash);
    if (!isValid) {
      throw new Error('Invalid superadmin credentials');
    }

    const token = signSuperAdminToken({
      sub: admin.id,
      email: admin.email,
      name: admin.name,
    });

    return {
      token,
      superAdmin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
    };
  }

  static async listTenants() {
    return prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            users: true,
            customers: true,
            jobs: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async createTenant(data: {
    name: string;
    slug: string;
    tradeType?: string;
    phone?: string;
    address?: string;
    plan?: 'STARTER' | 'GROWTH' | 'OPERATIONS' | 'ENTERPRISE';
    ownerName: string;
    ownerEmail: string;
    ownerPassword?: string;
  }) {
    const slug = data.slug.toLowerCase().trim();

    // Check if slug already exists
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      throw new Error(`A tenant with code '${slug}' already exists.`);
    }

    const initialPassword = data.ownerPassword || 'DesertAir2026!';
    const passwordHash = await hashPassword(initialPassword);
    const allPermIds = SYSTEM_PERMISSIONS.map((p) => p.id);

    // Transaction to create tenant, seed default roles, and create owner user
    return prisma.$transaction(async (tx) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: data.name,
          slug,
          tradeType: data.tradeType || 'HVAC',
          phone: data.phone,
          address: data.address,
          plan: data.plan || 'GROWTH',
          status: 'ACTIVE',
        },
      });

      // 2. Seed Default Protected Roles (Owner & Admin)
      const ownerRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'Business Owner',
          slug: 'owner',
          isDefault: true,
          approvalLimit: 999999999,
          description: 'Full unrestricted oversight, financial authority, and executive settings.',
        },
      });

      const adminRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'Administrator',
          slug: 'admin',
          isDefault: true,
          approvalLimit: 999999999,
          description: 'Multi-location and operational administration, user and role management.',
        },
      });

      // Attach all permissions to Owner and Admin
      for (const permId of allPermIds) {
        await tx.rolePermission.create({
          data: { roleId: ownerRole.id, permissionId: permId },
        });
        await tx.rolePermission.create({
          data: { roleId: adminRole.id, permissionId: permId },
        });
      }

      // 3. Create Tenant Owner User
      const ownerUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: data.ownerEmail.toLowerCase().trim(),
          name: data.ownerName,
          passwordHash,
          roleId: ownerRole.id,
        },
        include: {
          role: true,
        },
      });

      return {
        tenant,
        ownerUser: {
          id: ownerUser.id,
          email: ownerUser.email,
          name: ownerUser.name,
          role: ownerUser.role.name,
        },
        temporaryPassword: initialPassword,
      };
    });
  }

  static async updateTenantStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'ARCHIVED') {
    return prisma.tenant.update({
      where: { id },
      data: { status },
    });
  }
}

