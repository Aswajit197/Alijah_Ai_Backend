import { Request, Response } from 'express';
import { NotificationService } from './notification.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';

export class NotificationController {
  /**
   * GET /api/v1/notifications
   * List recent notifications with unread count
   */
  static async list(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId || req.tenantUser?.tenantId;
      if (!tenantId) {
        return errorResponse(res, 'Tenant context missing', 400);
      }

      const userId = req.tenantUser?.sub;
      const unreadOnly = req.query.unreadOnly === 'true';
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;

      const data = await NotificationService.list(tenantId, userId, { unreadOnly, limit });
      return successResponse(res, data, 'Notifications retrieved successfully');
    } catch (err: any) {
      console.error('Failed to list notifications:', err);
      return errorResponse(res, err.message || 'Failed to list notifications', 500);
    }
  }

  /**
   * PATCH /api/v1/notifications/:id/read
   * Mark a single notification as read
   */
  static async markRead(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId || req.tenantUser?.tenantId;
      const { id } = req.params;
      if (!tenantId || !id) {
        return errorResponse(res, 'Missing tenant or notification ID', 400);
      }

      await NotificationService.markAsRead(tenantId, id);
      return successResponse(res, { id, isRead: true }, 'Notification marked as read');
    } catch (err: any) {
      console.error('Failed to mark notification as read:', err);
      return errorResponse(res, err.message || 'Failed to mark as read', 500);
    }
  }

  /**
   * PATCH /api/v1/notifications/read-all
   * Mark all unread notifications as read
   */
  static async markAllRead(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId || req.tenantUser?.tenantId;
      if (!tenantId) {
        return errorResponse(res, 'Tenant context missing', 400);
      }

      const userId = req.tenantUser?.sub;
      const result = await NotificationService.markAllAsRead(tenantId, userId);
      return successResponse(res, { count: result.count }, 'All notifications marked as read');
    } catch (err: any) {
      console.error('Failed to mark all as read:', err);
      return errorResponse(res, err.message || 'Failed to mark all as read', 500);
    }
  }

  /**
   * DELETE /api/v1/notifications/:id
   * Dismiss/delete notification
   */
  static async delete(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId || req.tenantUser?.tenantId;
      const { id } = req.params;
      if (!tenantId || !id) {
        return errorResponse(res, 'Missing tenant or notification ID', 400);
      }

      await NotificationService.delete(tenantId, id);
      return successResponse(res, { id }, 'Notification dismissed');
    } catch (err: any) {
      console.error('Failed to dismiss notification:', err);
      return errorResponse(res, err.message || 'Failed to dismiss notification', 500);
    }
  }
}
