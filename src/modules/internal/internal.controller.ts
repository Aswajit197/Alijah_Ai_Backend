import { Request, Response } from 'express';
import { InternalService } from './internal.service.js';
import { InternalRequest } from './internal.auth.js';
import { toUuid } from './id-mapper.js';
import { TenantSettingsService } from '../../services/tenantSettings.service.js';

export class InternalController {
  /**
   * GET /internal/v1/tenants/by-phone/:e164
   */
  static async getTenantByPhone(req: Request, res: Response) {
    try {
      const e164 = String(req.params.e164 || '');
      const tenant = await InternalService.findTenantByPhoneNumber(e164);
      if (!tenant) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Tenant not found for this phone number' },
        });
      }
      return res.json({ data: tenant });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * GET /internal/v1/service-areas/check?zip=85004
   */
  static async checkServiceArea(req: InternalRequest, res: Response) {
    try {
      const zip = String(req.query.zip || '');
      const result = await InternalService.checkServiceArea(req.tenantId!, zip);
      return res.json({ data: result });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * GET /internal/v1/availability?trade=hvac&zip=85004&date=YYYY-MM-DD
   */
  static async getAvailability(req: InternalRequest, res: Response) {
    try {
      const trade = String(req.query.trade || 'hvac');
      const zip = String(req.query.zip || '');
      const date = req.query.date ? String(req.query.date) : undefined;

      const slots = await InternalService.listAvailableSlots(req.tenantId!, trade, zip, date);
      return res.json({ data: slots });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * GET /internal/v1/customers/by-phone/:phone
   */
  static async getCustomerByPhone(req: InternalRequest, res: Response) {
    try {
      const phone = String(req.params.phone || '');
      const customer = await InternalService.findCustomerByPhone(req.tenantId!, phone);
      if (!customer) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Customer not found' },
        });
      }
      return res.json({ data: customer });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * GET /internal/v1/customers/:id
   */
  static async getCustomerById(req: InternalRequest, res: Response) {
    try {
      const id = String(req.params.id || '');
      const customer = await InternalService.findCustomerById(req.tenantId!, id);
      if (!customer) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Customer not found' },
        });
      }
      return res.json({ data: customer });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * POST /internal/v1/customers
   */
  static async upsertCustomer(req: InternalRequest, res: Response) {
    try {
      const result = await InternalService.upsertCustomer(req.tenantId!, req.body);
      return res.json({ data: result });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * POST /internal/v1/jobs
   */
  static async createJob(req: InternalRequest, res: Response) {
    try {
      const job = await InternalService.createJob(req.tenantId!, req.body);
      return res.status(201).json({ data: job });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * GET /internal/v1/technicians
   */
  static async listTechnicians(req: InternalRequest, res: Response) {
    try {
      const trade = req.query.trade ? String(req.query.trade) : undefined;
      const techs = await InternalService.listTechnicians(req.tenantId!, trade);
      return res.json({ data: techs });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * GET /internal/v1/technicians/on-call
   */
  static async listOnCall(req: InternalRequest, res: Response) {
    try {
      const trade = req.query.trade ? String(req.query.trade) : undefined;
      const techs = await InternalService.listTechnicians(req.tenantId!, trade);
      return res.json({ data: techs });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * GET /internal/v1/jobs/:jobId/technician-recommendations
   */
  static async recommendTechnicians(req: InternalRequest, res: Response) {
    try {
      const jobId = String(req.params.jobId || '');
      const candidates = await InternalService.recommendTechnicians(req.tenantId!, jobId);
      return res.json({ data: candidates });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * PUT /internal/v1/jobs/:jobId/assignment
   */
  static async assignTechnician(req: InternalRequest, res: Response) {
    try {
      const jobId = String(req.params.jobId || '');
      const technicianId = String(req.body.technicianId || '');
      const result = await InternalService.assignTechnician(req.tenantId!, jobId, technicianId);
      return res.json({ data: result });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * DELETE /internal/v1/jobs/:jobId/assignment
   */
  static async unassignTechnician(req: InternalRequest, res: Response) {
    try {
      const jobId = String(req.params.jobId || '');
      const result = await InternalService.unassignTechnician(req.tenantId!, jobId);
      return res.json({ data: result });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * POST /internal/v1/jobs/:jobId/status
   */
  static async updateJobStatus(req: InternalRequest, res: Response) {
    try {
      const jobId = String(req.params.jobId || '');
      const { status, notes } = req.body;
      const result = await InternalService.updateJobStatus(req.tenantId!, jobId, String(status || ''), notes);
      return res.json({ data: result });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * POST /internal/v1/jobs/:jobId/quotes
   */
  static async createQuote(req: InternalRequest, res: Response) {
    const jobId = String(req.params.jobId || '');
    return res.status(201).json({
      data: {
        id: toUuid(jobId),
        number: 'Q-901',
        status: 'PENDING',
        totalCents: 24900,
        lines: [
          { name: 'Diagnostic and System Evaluation', priceCents: 12900 },
          { name: 'Electrical Dual Run Capacitor', priceCents: 12000 },
        ],
        explanation: ['Replaced swollen capacitor and restored full cooling airflow.'],
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        technician: { name: 'Assigned Technician' },
      },
    });
  }

  /**
   * POST /internal/v1/jobs/:jobId/quotes/:quoteId/decision
   */
  static async decideQuote(req: InternalRequest, res: Response) {
    return res.json({
      data: {
        id: String(req.params.quoteId || ''),
        number: 'Q-901',
        status: req.body.status || 'APPROVED',
        totalCents: 24900,
        lines: [],
        explanation: ['Customer approved estimate'],
        validUntil: new Date().toISOString(),
      },
    });
  }

  /**
   * POST /internal/v1/jobs/:jobId/feedback
   */
  static async recordFeedback(_req: InternalRequest, res: Response) {
    return res.json({ data: { recorded: true } });
  }

  /**
   * POST /internal/v1/invoices
   */
  static async createInvoice(req: InternalRequest, res: Response) {
    return res.status(201).json({
      data: {
        id: toUuid(req.body.jobId || 'inv-1001'),
        number: 'INV-9041',
        totalCents: 12900,
        balanceCents: 12900,
        status: 'ISSUED',
        paymentUrl: 'http://localhost:3000/pay/sample',
      },
    });
  }

  /**
   * POST /internal/v1/invoices/:id/send
   */
  static async sendInvoice(req: InternalRequest, res: Response) {
    return res.json({
      data: {
        id: String(req.params.id || ''),
        number: 'INV-9041',
        totalCents: 12900,
        balanceCents: 12900,
        status: 'SENT',
        paymentUrl: 'http://localhost:3000/pay/sample',
      },
    });
  }

  /**
   * POST /internal/v1/invoices/:id/payments
   */
  static async recordPayment(req: InternalRequest, res: Response) {
    return res.json({
      data: {
        id: String(req.params.id || ''),
        number: 'INV-9041',
        totalCents: 12900,
        balanceCents: 0,
        status: 'PAID',
        paymentUrl: null,
      },
    });
  }

  /**
   * POST /internal/v1/invoices/:id/dispute
   */
  static async disputeInvoice(req: InternalRequest, res: Response) {
    return res.json({
      data: {
        id: String(req.params.id || ''),
        number: 'INV-9041',
        totalCents: 12900,
        balanceCents: 12900,
        status: 'DISPUTED',
      },
    });
  }

  /**
   * POST /internal/v1/messages
   */
  static async sendMessage(req: InternalRequest, res: Response) {
    console.log('[Internal Messaging] Outgoing Message Dispatch:', req.body);
    return res.json({ data: { delivered: true, timestamp: new Date().toISOString() } });
  }

  /**
   * GET /internal/v1/service-categories
   */
  static async listServiceCategories(_req: InternalRequest, res: Response) {
    return res.json({ data: InternalService.listServiceCategories() });
  }

  /**
   * GET /internal/v1/estimates
   */
  static async getEstimate(req: InternalRequest, res: Response) {
    const trade = String(req.query.trade || 'hvac');
    const problem = String(req.query.problem || '');
    const isEmergency = req.query.isEmergency === 'true';

    return res.json({ data: InternalService.getEstimate(trade, problem, isEmergency) });
  }

  /**
   * POST /internal/v1/policy/check
   * Rule 1: The Company Dispatch Policy (dispatch.assign)
   * Rule 2: Invoice Approval Threshold (invoice.send)
   */
  static async checkPolicy(req: InternalRequest, res: Response) {
    const { action, amountCents } = req.body || {};
    const tenantId = req.tenantId || 'cmwg840lc0001yeczrxxdxt6r';
    const settings = TenantSettingsService.getSettings(tenantId);

    // Rule 1: The Company Dispatch Policy (dispatch.assign)
    // ALLOW -> Autonomous AI Dispatch (Assign top candidate)
    // RECOMMEND -> Dispatcher Triage Queue (Awaiting manual decision)
    if (action === 'dispatch.assign') {
      const decision = settings.dispatchPolicy || 'ALLOW';
      return res.json({ data: { decision } });
    }

    // Rule 2: Invoice Approval Threshold (invoice.send)
    if (action === 'invoice.send') {
      const limitCents = (settings.invoiceApprovalThreshold || 5000) * 100;
      if (amountCents && amountCents > limitCents) {
        return res.json({ data: { decision: 'REQUIRE_APPROVAL' } });
      }
      return res.json({ data: { decision: 'APPROVE' } });
    }

    return res.json({ data: { decision: 'ALLOW' } });
  }

  /**
   * POST /internal/v1/jobs/:jobId/photos
   */
  static async uploadPhoto(req: InternalRequest, res: Response) {
    const photoId = toUuid(String(Date.now()));
    return res.status(201).json({
      data: {
        id: photoId,
        url: `/uploads/${photoId}`,
        createdAt: new Date().toISOString(),
      },
    });
  }

  /**
   * GET /internal/v1/jobs/:jobId/photos/:photoId
   */
  static async getPhoto(_req: InternalRequest, res: Response) {
    return res.json({ data: { ok: true } });
  }

  /**
   * GET /health or /internal/v1/health
   */
  static async health(_req: Request, res: Response) {
    return res.json({ status: 'ok', service: 'core-service (backend native)' });
  }

  // =========================================================================
  // Caller Addresses & Disambiguation (Merged from operations-service)
  // =========================================================================

  /**
   * POST /internal/v1/caller-addresses/lookup
   */
  static async lookupCallerAddresses(req: InternalRequest, res: Response) {
    try {
      const { phoneNumber, answer } = req.body || {};
      if (!phoneNumber) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'phoneNumber is required' } });
      }
      const result = await InternalService.lookupCallerAddresses(req.tenantId!, phoneNumber, answer);
      return res.json({ data: result });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * POST /internal/v1/caller-addresses
   */
  static async saveCallerAddress(req: InternalRequest, res: Response) {
    try {
      const { phoneNumber, label, address } = req.body || {};
      if (!phoneNumber || !address) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'phoneNumber and address are required' } });
      }
      const result = await InternalService.saveCallerAddress(req.tenantId!, phoneNumber, address, label);
      return res.status(201).json({ data: result });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  // =========================================================================
  // Follow-Up Timing Settings (Merged from operations-service)
  // =========================================================================

  /**
   * GET /internal/v1/follow-up-settings or /api/v1/follow-up-settings
   */
  static async getFollowUpSettings(req: InternalRequest, res: Response) {
    try {
      const result = await InternalService.getFollowUpSettings(req.tenantId!);
      return res.json({ data: result });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * PUT /api/v1/follow-up-settings
   */
  static async updateFollowUpSettings(req: InternalRequest, res: Response) {
    try {
      const updatedBy = (req as any).user?.name || 'office_manager';
      const result = await InternalService.updateFollowUpSettings(req.tenantId!, req.body, updatedBy);
      return res.json({ data: result });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  // =========================================================================
  // Technician Mid-Job Check-Ins (Merged from operations-service)
  // =========================================================================

  /**
   * POST /internal/v1/technician-check-ins
   */
  static async recordTechnicianCheckIn(req: InternalRequest, res: Response) {
    try {
      const result = await InternalService.recordTechnicianCheckIn(req.tenantId!, req.body);
      return res.status(201).json({ data: result });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * GET /api/v1/technician-check-ins
   */
  static async listTechnicianCheckIns(req: InternalRequest, res: Response) {
    try {
      const serviceRequestId = req.query.serviceRequestId ? String(req.query.serviceRequestId) : undefined;
      const result = await InternalService.listTechnicianCheckIns(req.tenantId!, serviceRequestId);
      return res.json({ data: result });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  // =========================================================================
  // Service Areas CRUD (Merged from operations-service)
  // =========================================================================

  /**
   * GET /api/v1/service-areas
   */
  static async listServiceAreas(req: InternalRequest, res: Response) {
    try {
      const result = await InternalService.listServiceAreas(req.tenantId!);
      return res.json({ data: result });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * POST /api/v1/service-areas
   */
  static async createServiceArea(req: InternalRequest, res: Response) {
    try {
      const result = await InternalService.createServiceArea(req.tenantId!, req.body);
      return res.status(201).json({ data: result });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * DELETE /api/v1/service-areas/:serviceAreaId
   */
  static async deleteServiceArea(req: InternalRequest, res: Response) {
    try {
      await InternalService.deleteServiceArea(req.tenantId!, req.params.serviceAreaId);
      return res.status(204).send();
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }
}
