import { Request, Response } from 'express';
import { z } from 'zod';
import { EstimateService } from './estimate.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';

const createEstimateSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().optional(),
  serviceAddress: z.string().optional(),
  tradeCategory: z.string().optional(),
  title: z.string().min(2, 'Scope / Title is required'),
  amount: z.number().min(0, 'Amount must be greater or equal to 0'),
  status: z.enum(['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED']).optional(),
  grossMarginPct: z.number().optional(),
  notes: z.string().optional(),
  hasTiers: z.boolean().optional(),
  tiers: z.any().optional(),
  scopeItems: z.any().optional(),
});

const updateEstimateSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED']).optional(),
  amount: z.number().min(0).optional(),
  title: z.string().min(2).optional(),
  notes: z.string().optional(),
  tradeCategory: z.string().optional(),
});

export class EstimateController {
  /**
   * List estimates & pipeline metrics for tenant.
   */
  static async list(req: Request, res: Response) {
    try {
      const { status, search } = req.query;
      const data = await EstimateService.listEstimates((req as any).tenantId!, {
        status: status ? String(status) : undefined,
        search: search ? String(search) : undefined,
      });
      return successResponse(res, data, 'Estimates retrieved successfully');
    } catch (err: any) {
      return errorResponse(res, err.message || 'Failed to list estimates', 500);
    }
  }

  /**
   * Create a new proposal / estimate.
   */
  static async create(req: Request, res: Response) {
    try {
      const parsed = createEstimateSchema.safeParse(req.body);
      if (!parsed.success) {
        return errorResponse(res, 'Validation error', 400, parsed.error.format());
      }

      const repName = (req as any).user?.name || 'Staff Estimator';
      const created = await EstimateService.createEstimate((req as any).tenantId!, parsed.data, repName);
      return successResponse(res, created, 'Estimate created successfully', 201);
    } catch (err: any) {
      return errorResponse(res, err.message || 'Failed to create estimate', 500);
    }
  }

  /**
   * Update estimate status or details.
   */
  static async update(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const parsed = updateEstimateSchema.safeParse(req.body);
      if (!parsed.success) {
        return errorResponse(res, 'Validation error', 400, parsed.error.format());
      }

      const updated = await EstimateService.updateEstimate((req as any).tenantId!, id, parsed.data);
      return successResponse(res, updated, 'Estimate updated successfully');
    } catch (err: any) {
      return errorResponse(res, err.message || 'Failed to update estimate', 500);
    }
  }

  /**
   * Delete estimate.
   */
  static async delete(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      await EstimateService.deleteEstimate((req as any).tenantId!, id);
      return successResponse(res, null, 'Estimate deleted successfully');
    } catch (err: any) {
      return errorResponse(res, err.message || 'Failed to delete estimate', 500);
    }
  }
}
