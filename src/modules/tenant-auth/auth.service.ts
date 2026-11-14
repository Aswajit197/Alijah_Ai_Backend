import { prisma } from '../../config/database.js';
import { verifyPassword, hashPassword } from '../../utils/password.js';
import { signTenantUserToken } from '../../utils/jwt.js';

export class TenantAuthService {
  /**
   * Validates a one-time invitation token.
   */
  static async getInvitationByToken(token: string) {
    if (!token) {
      throw new Error('Invitation token is required.');
    }

    const user = await prisma.user.findUnique({
      where: { inviteToken: token },
      include: {
        tenant: true,
        role: true,
      },
    });

    if (!user) {
      throw new Error('Invalid or non-existent invitation link.');
    }

    if (user.isInviteAccepted) {
      throw new Error('This invitation has already been accepted. Please sign in with your password.');
    }

    if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) {
      throw new Error('This invitation link has expired (24-hour validity). Please request a new invite.');
    }

    return {
      valid: true,
      email: user.email,
      name: user.name,
      tenantName: user.tenant.name,
      tenantSlug: user.tenant.slug,
      role: user.role.name,
      expiresAt: user.inviteExpiresAt,
    };
  }

  /**
   * Sets the user's password using the one-time invitation token and logs them in.
   */
  static async setPasswordWithToken(data: { token: string; password: string }) {
    if (!data.token) {
      throw new Error('Invitation token is required.');
    }

    if (!data.password || data.password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }

    const user = await prisma.user.findUnique({
      where: { inviteToken: data.token },
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

    if (!user) {
      throw new Error('Invalid or non-existent invitation link.');
    }

    if (user.isInviteAccepted) {
      throw new Error('This invitation has already been used. Please log in.');
    }

    if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) {
      throw new Error('This invitation link has expired. Please contact your administrator for a new invite.');
    }

    const passwordHash = await hashPassword(data.password);

    // Update user record: set new password, mark invite accepted, clear single-use token
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        isInviteAccepted: true,
        inviteToken: null,
        inviteExpiresAt: null,
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

    // Auto-login upon setting password
    const token = signTenantUserToken({
      sub: updatedUser.id,
      tenantId: updatedUser.tenantId,
      roleId: updatedUser.roleId,
      roleSlug: updatedUser.role.slug,
      email: updatedUser.email,
      name: updatedUser.name,
    });

    const permissions = updatedUser.role.slug === 'owner' || updatedUser.role.slug === 'admin'
      ? ['*']
      : updatedUser.role.permissions.map((rp) => rp.permissionId);

    return {
      token,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        tenantId: updatedUser.tenantId,
        tenantName: updatedUser.tenant.name,
        tenantSlug: updatedUser.tenant.slug,
        role: {
          id: updatedUser.role.id,
          name: updatedUser.role.name,
          slug: updatedUser.role.slug,
          approvalLimit: Number(updatedUser.role.approvalLimit),
          permissions,
        },
      },
    };
  }

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

