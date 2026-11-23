import { prisma } from '../../config/database.js';
import { NotificationType, NotificationPriority } from '@prisma/client';
import { Response } from 'express';

export interface CreateNotificationInput {
  tenantId: string;
  userId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  link?: string;
  entityType?: 'JOB' | 'LEAD' | 'CALL' | 'CUSTOMER' | 'ESCALATION';
  entityId?: string;
  metadata?: Record<string, any>;
}

interface SSEClient {
  id: string;
  tenantId: string;
  userId?: string | null;
  res: Response;
}

const sseClients = new Map<string, SSEClient>();

export class NotificationService {
  /**
   * Register an SSE client connection.
   */
  static addClient(id: string, tenantId: string, userId: string | null | undefined, res: Response) {
    sseClients.set(id, { id, tenantId, userId: userId || null, res });
  }

  /**
   * Remove an SSE client on disconnect.
   */
  static removeClient(id: string) {
    sseClients.delete(id);
  }

  /**
   * Broadcast an SSE event to connected subscribers for a tenant.
   */
  static broadcast(tenantId: string, event: string, data: any, targetUserId?: string | null) {
    for (const [id, client] of sseClients.entries()) {
      if (client.tenantId === tenantId) {
        if (!targetUserId || !client.userId || client.userId === targetUserId) {
          try {
            client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          } catch (e) {
            sseClients.delete(id);
          }
        }
      }
    }
  }

  /**
   * Create an in-app operational notification.
   * If userId is omitted or null, it broadcasts to all tenant dispatchers/owners.
   */
  static async create(input: CreateNotificationInput) {
    try {
      const notification = await prisma.notification.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId || null,
          type: input.type,
          title: input.title,
          message: input.message,
          priority: input.priority || NotificationPriority.NORMAL,
          link: input.link || null,
          entityType: input.entityType || null,
          entityId: input.entityId || null,
          metadata: input.metadata || undefined,
        },
      });

      // Broadcast immediately via SSE to connected users in this tenant
      if (notification) {
        NotificationService.broadcast(input.tenantId, 'notification', notification, input.userId);
      }

      return notification;
    } catch (err: any) {
      console.error('Failed to create notification:', err.message);
      // Non-blocking: we don't want notification failure to break the parent business transaction
      return null;
    }
  }

  /**
   * List notifications for a tenant and optionally filtered by user.
   * Returns notifications where userId = current user OR userId is NULL (tenant-wide).
   */
  static async list(
    tenantId: string,
    userId?: string,
    options: { unreadOnly?: boolean; limit?: number } = {}
  ) {
    const limit = options.limit || 30;

    const whereClause: any = {
      tenantId,
      OR: [
        { userId: null }, // broadcast to all
        ...(userId ? [{ userId }] : []),
      ],
    };

    if (options.unreadOnly) {
      whereClause.isRead = false;
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({
        where: {
          tenantId,
          isRead: false,
          OR: [
            { userId: null },
            ...(userId ? [{ userId }] : []),
          ],
        },
      }),
    ]);

    return {
      notifications,
      unreadCount,
    };
  }

  /**
   * Mark a single notification as read.
   */
  static async markAsRead(tenantId: string, id: string) {
    return prisma.notification.updateMany({
      where: {
        id,
        tenantId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all unread notifications as read for this tenant & user.
   */
  static async markAllAsRead(tenantId: string, userId?: string) {
    return prisma.notification.updateMany({
      where: {
        tenantId,
        isRead: false,
        OR: [
          { userId: null },
          ...(userId ? [{ userId }] : []),
        ],
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Delete / dismiss a notification.
   */
  static async delete(tenantId: string, id: string) {
    return prisma.notification.deleteMany({
      where: {
        id,
        tenantId,
      },
    });
  }
}
