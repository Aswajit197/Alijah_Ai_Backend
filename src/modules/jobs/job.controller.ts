import { Request, Response } from 'express';
import { z } from 'zod';
import { JobService } from './job.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';
import { jobEvents } from '../../utils/jobEvents.js';

const createJobSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  equipmentId: z.string().optional(),
  technicianId: z.string().optional(),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  status: z
    .enum(['UNSCHEDULED', 'SCHEDULED', 'DISPATCHED', 'EN_ROUTE', 'ON_SITE', 'COMPLETED', 'CANCELLED'])
    .optional(),
  priority: z.enum(['EMERGENCY', 'HIGH', 'NORMAL', 'LOW']).optional(),
  scheduledDate: z.string().optional(),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
  serviceAddress: z.string().optional(),
  gateCode: z.string().optional(),
  reportedIssue: z.string().optional(),
  notes: z.string().optional(),
  totalAmount: z.number().optional(),
});

const dispatchJobSchema = z.object({
  technicianId: z.string().min(1, 'Technician is required'),
  scheduledDate: z.string().optional(),
  scheduledStart: z.string().min(1, 'Start time is required'),
  scheduledEnd: z.string().min(1, 'End time is required'),
  priority: z.enum(['EMERGENCY', 'HIGH', 'NORMAL', 'LOW']).optional(),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['UNSCHEDULED', 'SCHEDULED', 'DISPATCHED', 'EN_ROUTE', 'ON_SITE', 'COMPLETED', 'CANCELLED']),
  notes: z.string().optional(),
});

export class JobController {
  static async list(req: Request, res: Response) {
    try {
      const filters = {
        date: req.query.date as string | undefined,
        status: req.query.status as string | undefined,
        technicianId: req.query.technicianId as string | undefined,
        search: req.query.search as string | undefined,
      };

      const jobs = await JobService.listJobs(req.tenantId!, filters);
      return successResponse(res, jobs);
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  }

  static async listTechnicians(req: Request, res: Response) {
    try {
      const techs = await JobService.listTechnicians(req.tenantId!);
      return successResponse(res, techs);
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  }

  static async getActiveTechJob(req: Request, res: Response) {
    try {
      const job = await JobService.getTechnicianActiveJob(req.tenantId!, req.tenantUser?.sub);
      return successResponse(res, job);
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const job = await JobService.getJobById(req.tenantId!, id);
      return successResponse(res, job);
    } catch (err: any) {
      return errorResponse(res, err.message, 404);
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const data = createJobSchema.parse(req.body);
      const result = await JobService.createJob(req.tenantId!, data);
      return successResponse(res, result, 'Work order created', 201);
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  static async dispatch(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const data = dispatchJobSchema.parse(req.body);
      const result = await JobService.dispatchJob(req.tenantId!, id, data);
      return successResponse(res, result, 'Job dispatched to technician');
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  static async updateStatus(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const data = updateStatusSchema.parse(req.body);
      const result = await JobService.updateJobStatus(req.tenantId!, id, data.status, data.notes);
      return successResponse(res, result, `Status updated to ${data.status}`);
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const data = createJobSchema.partial().parse(req.body);
      const result = await JobService.updateJob(req.tenantId!, id, data);
      return successResponse(res, result, 'Work order updated');
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      await JobService.deleteJob(req.tenantId!, id);
      return successResponse(res, null, 'Work order deleted');
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  static async getPublicTracking(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const result = await JobService.getPublicTracking(id);
      return successResponse(res, result, 'Tracking details retrieved');
    } catch (err: any) {
      return errorResponse(res, err.message, 404);
    }
  }

  /**
   * Server-Sent Events (SSE) stream for real-time customer job tracking.
   * Eliminates polling: server pushes updates instantly when technician status changes.
   */
  static async streamPublicTracking(req: Request, res: Response) {
    const id = String(req.params.id);

    try {
      // 1. Fetch initial job tracking payload to verify job exists
      const initialData = await JobService.getPublicTracking(id);

      // 2. Set SSE Headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      // 3. Immediately send current state as first event
      res.write(`data: ${JSON.stringify(initialData)}\n\n`);

      // 4. If already in terminal state (COMPLETED or CANCELLED), finish stream
      if (initialData.status === 'COMPLETED' || initialData.status === 'CANCELLED') {
        res.end();
        return;
      }

      // 5. Listener for subsequent updates
      const eventChannel = `job:${id}`;
      const onJobUpdate = (updatedData: any) => {
        try {
          res.write(`data: ${JSON.stringify(updatedData)}\n\n`);
          if (updatedData.status === 'COMPLETED' || updatedData.status === 'CANCELLED') {
            cleanup();
            res.end();
          }
        } catch {
          cleanup();
        }
      };

      jobEvents.on(eventChannel, onJobUpdate);

      // 6. Keep-alive heartbeat every 20s to prevent reverse-proxy timeout
      const heartbeatTimer = setInterval(() => {
        try {
          res.write(': heartbeat\n\n');
        } catch {
          cleanup();
        }
      }, 20000);

      const cleanup = () => {
        clearInterval(heartbeatTimer);
        jobEvents.off(eventChannel, onJobUpdate);
      };

      req.on('close', cleanup);
      req.on('end', cleanup);
    } catch (err: any) {
      return res.status(404).json({ success: false, message: err.message || 'Work order not found' });
    }
  }

  static async createPublicRequest(req: Request, res: Response) {
    try {
      const result = await JobService.createPublicRequest(req.body);
      return successResponse(res, result, 'Service request submitted successfully', 201);
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  static async getCompanyProfile(req: Request, res: Response) {
    try {
      const slug = req.params.slug ? String(req.params.slug) : undefined;
      const result = await JobService.getCompanyProfile(slug);
      return successResponse(res, result, 'Company profile retrieved');
    } catch (err: any) {
      return errorResponse(res, err.message, 404);
    }
  }
}
