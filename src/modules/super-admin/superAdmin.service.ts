import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import { SuperAdminNotificationType, SuperAdminAlertSeverity } from '@prisma/client';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { signSuperAdminToken } from '../../utils/jwt.js';
import { MailService } from '../../services/mail.service.js';

export interface CreateSuperAdminNotificationInput {
  type: SuperAdminNotificationType;
  title: string;
  message: string;
  severity?: SuperAdminAlertSeverity;
  tenantId?: string | null;
  tenantSlug?: string | null;
  link?: string | null;
  metadata?: Record<string, any>;
}

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
        users: {
          where: { role: { slug: 'owner' } },
          select: {
            id: true,
            email: true,
            name: true,
            isInviteAccepted: true,
            inviteExpiresAt: true,
            inviteToken: true,
          },
          take: 1,
        },
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
    const ownerEmail = data.ownerEmail.toLowerCase().trim();

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

    // Generate secure single-use invitation token with 24-hour expiration
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Temporary random password hash until owner activates account
    const tempRandomPass = crypto.randomBytes(16).toString('hex');
    const passwordHash = await hashPassword(tempRandomPass);

    const result = await prisma.$transaction(async (tx) => {
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
          email: ownerEmail,
          name: data.ownerName,
          passwordHash,
          roleId: ownerRole.id,
          inviteToken,
          inviteExpiresAt,
          isInviteAccepted: false,
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
          isInviteAccepted: false,
          inviteExpiresAt,
        },
      };
    });

    const companyAppUrl = process.env.COMPANY_APP_URL || 'http://localhost:3000';
    const inviteLink = `${companyAppUrl}/set-password?token=${inviteToken}`;

    // Dispatch invitation email (or log preview if SMTP unconfigured)
    await MailService.sendInvitation({
      to: ownerEmail,
      recipientName: data.ownerName,
      tenantName: data.name,
      roleName: ownerRole.name,
      inviteLink,
      expiresInHours: 24,
    });

    // Notify SuperAdmin platform of new company registration
    SuperAdminService.createNotification({
      type: 'TENANT_CREATED',
      severity: 'INFO',
      title: `New Company Onboarded: ${data.name}`,
      message: `${data.ownerName} (${ownerEmail}) provisioned on ${data.plan || 'GROWTH'} plan with code '${slug}'.`,
      tenantId: result.tenant.id,
      tenantSlug: slug,
      link: '/tenants',
    }).catch(() => {});

    return {
      ...result,
      inviteToken,
      inviteLink,
      inviteExpiresAt,
    };
  }

  static async resendTenantInvite(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new Error('Tenant not found.');
    }

    const ownerUser = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        role: { slug: 'owner' },
      },
      include: {
        role: true,
      },
    });

    if (!ownerUser) {
      throw new Error('No owner account found for this tenant.');
    }

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.user.update({
      where: { id: ownerUser.id },
      data: {
        inviteToken,
        inviteExpiresAt,
        isInviteAccepted: false,
      },
    });

    const companyAppUrl = process.env.COMPANY_APP_URL || 'http://localhost:3000';
    const inviteLink = `${companyAppUrl}/set-password?token=${inviteToken}`;

    await MailService.sendInvitation({
      to: ownerUser.email,
      recipientName: ownerUser.name,
      tenantName: tenant.name,
      roleName: ownerUser.role.name,
      inviteLink,
      expiresInHours: 24,
    });

    SuperAdminService.createNotification({
      type: 'INVITE_RESENT',
      severity: 'INFO',
      title: `Setup Link Resent: ${tenant.name}`,
      message: `Fresh 24h onboarding link delivered to ${ownerUser.name} (${ownerUser.email}).`,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      link: '/tenants',
    }).catch(() => {});

    return {
      success: true,
      ownerEmail: ownerUser.email,
      inviteLink,
      inviteExpiresAt,
    };
  }

  static async updateTenantStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'ARCHIVED') {
    const updated = await prisma.tenant.update({
      where: { id },
      data: { status },
    });

    SuperAdminService.createNotification({
      type: 'TENANT_STATUS_CHANGED',
      severity: status === 'SUSPENDED' ? 'CRITICAL' : 'WARNING',
      title: `Tenant Status Updated: ${updated.name}`,
      message: `Status transitioned to ${status}. Company access is now ${status === 'SUSPENDED' ? 'blocked' : 'active'}.`,
      tenantId: updated.id,
      tenantSlug: updated.slug,
      link: '/tenants',
    }).catch(() => {});

    return updated;
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

  // --- SuperAdmin Notifications & Platform Alerts ---
  static async createNotification(data: CreateSuperAdminNotificationInput) {
    try {
      return await prisma.superAdminNotification.create({
        data: {
          type: data.type,
          title: data.title,
          message: data.message,
          severity: data.severity || 'INFO',
          tenantId: data.tenantId || null,
          tenantSlug: data.tenantSlug || null,
          link: data.link || '/tenants',
          metadata: data.metadata || undefined,
        },
      });
    } catch (err: any) {
      console.error('Failed to create superadmin notification:', err.message);
      return null;
    }
  }

  static async listNotifications(options: { unreadOnly?: boolean; limit?: number } = {}) {
    const limit = options.limit || 30;
    const where: any = {};
    if (options.unreadOnly) {
      where.isRead = false;
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.superAdminNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.superAdminNotification.count({
        where: { isRead: false },
      }),
    ]);

    return {
      notifications,
      unreadCount,
    };
  }

  static async markNotificationRead(id: string) {
    return prisma.superAdminNotification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  static async markAllNotificationsRead() {
    return prisma.superAdminNotification.updateMany({
      where: { isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  static async deleteNotification(id: string) {
    return prisma.superAdminNotification.delete({
      where: { id },
    });
  }
}
