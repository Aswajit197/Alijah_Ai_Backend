import { prisma } from '../../config/database.js';
import { hashPassword } from '../../utils/password.js';

export class UserService {
  static async listUsers(tenantId: string) {
    return prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isActive: true,
        createdAt: true,
        role: {
          select: {
            id: true,
            name: true,
            slug: true,
            approvalLimit: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async createUser(tenantId: string, data: {
    name: string;
    email: string;
    roleId: string;
    phone?: string;
    password?: string;
  }) {
    const email = data.email.toLowerCase().trim();

    // Verify role exists in the platform
    const role = await prisma.role.findUnique({
      where: { id: data.roleId },
    });
    if (!role) {
      throw new Error('Selected role does not exist.');
    }

    // Check email uniqueness within this tenant
    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existing) {
      throw new Error(`User with email '${email}' already exists in your company.`);
    }

    const initialPassword = data.password || 'Welcome123!';
    const passwordHash = await hashPassword(initialPassword);

    const user = await prisma.user.create({
      data: {
        tenantId,
        email,
        name: data.name,
        phone: data.phone,
        roleId: role.id,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isActive: true,
        role: {
          select: {
            id: true,
            name: true,
            slug: true,
            approvalLimit: true,
          },
        },
      },
    });

    return {
      user,
      temporaryPassword: initialPassword,
    };
  }

  static async reassignRole(tenantId: string, userId: string, newRoleId: string) {
    // Verify target role exists
    const role = await prisma.role.findUnique({
      where: { id: newRoleId },
    });
    if (!role) {
      throw new Error('Target role not found');
    }

    // Verify target user exists in this tenant
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) {
      throw new Error('User not found');
    }

    return prisma.user.update({
      where: { id: userId },
      data: { roleId: newRoleId },
      select: {
        id: true,
        email: true,
        name: true,
        role: {
          select: {
            id: true,
            name: true,
            slug: true,
            approvalLimit: true,
          },
        },
      },
    });
  }

  static async toggleActive(tenantId: string, userId: string, isActive: boolean) {
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: { role: true },
    });
    if (!user) {
      throw new Error('User not found');
    }

    if (user.role.slug === 'owner' && !isActive) {
      throw new Error('The primary Business Owner account cannot be deactivated.');
    }

    return prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });
  }
}
