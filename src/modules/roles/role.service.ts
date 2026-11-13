import { prisma } from '../../config/database.js';
import { SYSTEM_PERMISSIONS } from '../../constants/permissions.js';

export class RoleService {
  static async listRoles(tenantId: string) {
    return prisma.role.findMany({
      where: { tenantId },
      include: {
        permissions: {
          select: {
            permissionId: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  static getAvailablePermissions() {
    return SYSTEM_PERMISSIONS;
  }

  static async createRole(tenantId: string, data: {
    name: string;
    slug?: string;
    description?: string;
    approvalLimit?: number;
    permissions: string[];
  }) {
    const slug = (data.slug || data.name.toLowerCase().replace(/\s+/g, '-')).trim();

    // Check slug uniqueness within tenant
    const existing = await prisma.role.findUnique({
      where: {
        tenantId_slug: { tenantId, slug },
      },
    });

    if (existing) {
      throw new Error(`A role with slug '${slug}' already exists in your company.`);
    }

    return prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          tenantId,
          name: data.name,
          slug,
          description: data.description,
          isDefault: false,
          approvalLimit: data.approvalLimit || 0,
        },
      });

      // Insert role permissions
      if (data.permissions && data.permissions.length > 0) {
        for (const permId of data.permissions) {
          await tx.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: permId,
            },
          });
        }
      }

      return tx.role.findUnique({
        where: { id: role.id },
        include: { permissions: true },
      });
    });
  }

  static async updateRole(tenantId: string, roleId: string, data: {
    name?: string;
    description?: string;
    approvalLimit?: number;
    permissions?: string[];
  }) {
    const role = await prisma.role.findFirst({
      where: { id: roleId, tenantId },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({
        where: { id: roleId },
        data: {
          name: data.name !== undefined ? data.name : role.name,
          description: data.description !== undefined ? data.description : role.description,
          approvalLimit: data.approvalLimit !== undefined ? data.approvalLimit : role.approvalLimit,
        },
      });

      if (data.permissions !== undefined) {
        // Protected default roles (Owner/Admin) cannot have permissions stripped
        if (role.isDefault) {
          throw new Error('Permissions for default system roles cannot be modified.');
        }

        await tx.rolePermission.deleteMany({ where: { roleId } });
        for (const permId of data.permissions) {
          await tx.rolePermission.create({
            data: { roleId, permissionId: permId },
          });
        }
      }

      return tx.role.findUnique({
        where: { id: roleId },
        include: { permissions: true },
      });
    });
  }

  static async deleteRole(tenantId: string, roleId: string) {
    const role = await prisma.role.findFirst({
      where: { id: roleId, tenantId },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    if (role.isDefault) {
      throw new Error('Default roles (Business Owner, Administrator) cannot be deleted.');
    }

    if (role._count.users > 0) {
      throw new Error(`Cannot delete role: ${role._count.users} user(s) are currently assigned to this role. Reassign them first.`);
    }

    await prisma.role.delete({
      where: { id: roleId },
    });

    return { id: roleId, deleted: true };
  }
}

