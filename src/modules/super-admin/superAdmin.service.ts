import { prisma } from '../../config/database.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { signSuperAdminToken } from '../../utils/jwt.js';

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

  // --- Tenant Management ---
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

    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      throw new Error(`A tenant with code '${slug}' already exists.`);
    }

    const ownerRole = await prisma.role.findUnique({
      where: { slug: 'owner' },
    });
    if (!ownerRole) {
      throw new Error("System error: Global 'owner' role not found. Please run seed script.");
    }

    const initialPassword = data.ownerPassword || 'DesertAir2026!';
    const passwordHash = await hashPassword(initialPassword);

    return prisma.$transaction(async (tx) => {
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

  // --- Dynamic Roles Management (SuperAdmin Only) ---
  static async listRoles() {
    return prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async createRole(data: {
    name: string;
    slug: string;
    description?: string;
    approvalLimit?: number;
    permissions: string[];
  }) {
    const slug = data.slug.toLowerCase().trim();

    const existing = await prisma.role.findUnique({ where: { slug } });
    if (existing) {
      throw new Error(`A role with slug '${slug}' already exists.`);
    }

    return prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name: data.name,
          slug,
          description: data.description,
          approvalLimit: data.approvalLimit || 0,
        },
      });

      if (data.permissions && data.permissions.length > 0) {
        for (const permId of data.permissions) {
          await tx.rolePermission.create({
            data: { roleId: role.id, permissionId: permId },
          });
        }
      }

      return tx.role.findUnique({
        where: { id: role.id },
        include: { permissions: { include: { permission: true } } },
      });
    });
  }

  static async updateRole(id: string, data: {
    name?: string;
    description?: string;
    approvalLimit?: number;
    permissions?: string[];
  }) {
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new Error('Role not found');
    }

    return prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: {
          name: data.name !== undefined ? data.name : role.name,
          description: data.description !== undefined ? data.description : role.description,
          approvalLimit: data.approvalLimit !== undefined ? data.approvalLimit : role.approvalLimit,
        },
      });

      if (data.permissions !== undefined) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        for (const permId of data.permissions) {
          await tx.rolePermission.create({
            data: { roleId: id, permissionId: permId },
          });
        }
      }

      return tx.role.findUnique({
        where: { id },
        include: { permissions: { include: { permission: true } } },
      });
    });
  }

  static async deleteRole(id: string) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    if (role.slug === 'owner') {
      throw new Error("The 'owner' role is foundational and cannot be deleted.");
    }

    if (role._count.users > 0) {
      throw new Error(`Cannot delete role: ${role._count.users} user(s) across companies are currently assigned to this role.`);
    }

    await prisma.role.delete({ where: { id } });
    return { id, deleted: true };
  }

  // --- Dynamic Permissions Management (SuperAdmin Only) ---
  static async listPermissions() {
    return prisma.permission.findMany({
      include: {
        _count: {
          select: { roles: true },
        },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  static async createPermission(data: {
    id: string;
    name: string;
    category: string;
    description?: string;
  }) {
    const id = data.id.toLowerCase().trim().replace(/[^a-z0-9_:]/g, '_');

    const existing = await prisma.permission.findUnique({ where: { id } });
    if (existing) {
      throw new Error(`Permission with ID '${id}' already exists.`);
    }

    return prisma.permission.create({
      data: {
        id,
        name: data.name,
        category: data.category || 'General',
        description: data.description,
      },
    });
  }

  static async updatePermission(id: string, data: {
    name?: string;
    category?: string;
    description?: string;
  }) {
    const perm = await prisma.permission.findUnique({ where: { id } });
    if (!perm) {
      throw new Error('Permission not found');
    }

    return prisma.permission.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : perm.name,
        category: data.category !== undefined ? data.category : perm.category,
        description: data.description !== undefined ? data.description : perm.description,
      },
    });
  }

  static async deletePermission(id: string) {
    const perm = await prisma.permission.findUnique({
      where: { id },
      include: {
        _count: {
          select: { roles: true },
        },
      },
    });

    if (!perm) {
      throw new Error('Permission not found');
    }

    return prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { permissionId: id } });
      await tx.permission.delete({ where: { id } });
      return { id, deleted: true, detachedFromRoles: perm._count.roles };
    });
  }
}
