import { Request, Response } from 'express';
import { NotificationService } from './notification.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';

export class NotificationController {
  /**
   * GET /api/v1/notifications/stream
   * Real-time Server-Sent Events (SSE) stream for instant notifications without polling
   */
  static async stream(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId || req.tenantUser?.tenantId;
      if (!tenantId) {
        return errorResponse(res, 'Tenant context missing', 400);
      }

      const userId = req.tenantUser?.sub;
      const clientId = `sse_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // 1. Set SSE Headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      // 2. Register client connection
      NotificationService.addClient(clientId, tenantId, userId, res);

      // 3. Send initial connected event with current unread count
      const initial = await NotificationService.list(tenantId, userId, { limit: 1 });
      res.write(`event: connected\ndata: ${JSON.stringify({ clientId, unreadCount: initial.unreadCount })}\n\n`);

      // 4. Send keep-alive heartbeat comment every 25 seconds to keep proxies and load balancers open
      const keepAliveTimer = setInterval(() => {
        try {
          res.write(': keepalive\n\n');
        } catch {
          clearInterval(keepAliveTimer);
          NotificationService.removeClient(clientId);
        }
      }, 25000);

      // 5. Cleanup on connection close
      req.on('close', () => {
        clearInterval(keepAliveTimer);
        NotificationService.removeClient(clientId);
      });
    } catch (err: any) {
      console.error('SSE Stream error:', err);
      if (!res.headersSent) {
        return errorResponse(res, err.message || 'SSE stream failed', 500);
      }
      res.end();
    }
  }

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
