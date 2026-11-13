import { prisma } from '../../config/database.js';

export class RoleService {
  /**
   * Returns all platform roles defined by SuperAdmin for the company to assign to staff.
   */
  static async listRoles() {
    return prisma.role.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        approvalLimit: true,
        permissions: {
          select: {
            permissionId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
