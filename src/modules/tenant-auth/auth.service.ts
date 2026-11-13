import { prisma } from '../../config/database.js';
import { verifyPassword } from '../../utils/password.js';
import { signTenantUserToken } from '../../utils/jwt.js';

export class TenantAuthService {
  static async login(data: { email: string; password: string; tenantSlug?: string }) {
    const email = data.email.toLowerCase().trim();

    // Query user
    let user;
    if (data.tenantSlug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: data.tenantSlug.toLowerCase().trim() },
      });
      if (!tenant) {
        throw new Error(`Tenant '${data.tenantSlug}' not found.`);
      }
      user = await prisma.user.findUnique({
        where: {
          tenantId_email: {
            tenantId: tenant.id,
            email,
          },
        },
        include: {
          tenant: true,
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });
    } else {
      // If tenantSlug is not provided, find by email across tenants
      user = await prisma.user.findFirst({
        where: { email },
        include: {
          tenant: true,
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });
    }

    if (!user || !user.isActive) {
      throw new Error('Invalid email or password');
    }

    if (user.tenant.status !== 'ACTIVE' && user.tenant.status !== 'TRIAL') {
      throw new Error(`Your company account is ${user.tenant.status.toLowerCase()}. Please contact support.`);
    }

    const isValid = await verifyPassword(data.password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    const token = signTenantUserToken({
      sub: user.id,
      tenantId: user.tenantId,
      roleId: user.roleId,
      roleSlug: user.role.slug,
      email: user.email,
      name: user.name,
    });

    const permissions = user.role.slug === 'owner' || user.role.slug === 'admin'
      ? ['*'] // Global wildcard for Owner & Admin
      : user.role.permissions.map((rp) => rp.permissionId);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        tenantName: user.tenant.name,
        tenantSlug: user.tenant.slug,
        role: {
          id: user.role.id,
          name: user.role.name,
          slug: user.role.slug,
          approvalLimit: Number(user.role.approvalLimit),
          permissions,
        },
      },
    };
  }

  static async getMe(userId: string, tenantId: string) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        tenant: true,
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user || user.tenantId !== tenantId) {
      throw new Error('User not found or access revoked');
    }

    const permissions = user.role.slug === 'owner' || user.role.slug === 'admin'
      ? ['*']
      : user.role.permissions.map((rp) => rp.permissionId);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      tenantSlug: user.tenant.slug,
      role: {
        id: user.role.id,
        name: user.role.name,
        slug: user.role.slug,
        approvalLimit: Number(user.role.approvalLimit),
        permissions,
      },
    };
  }
}

