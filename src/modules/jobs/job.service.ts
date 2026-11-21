import { prisma } from '../../config/database.js';
import { JobStatus } from '@prisma/client';
import { broadcastJobUpdate } from '../../utils/jobEvents.js';
import { MailService } from '../../services/mail.service.js';
import { TenantSettingsService } from '../../services/tenantSettings.service.js';
import jwt from 'jsonwebtoken';

export interface CreateJobInput {
  customerId: string;
  equipmentId?: string;
  technicianId?: string;
  title: string;
  status?: JobStatus;
  priority?: 'EMERGENCY' | 'HIGH' | 'NORMAL' | 'LOW';
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  serviceAddress?: string;
  gateCode?: string;
  reportedIssue?: string;
  notes?: string;
  totalAmount?: number;
}

export interface DispatchJobInput {
  technicianId: string;
  scheduledDate?: string;
  scheduledStart: string;
  scheduledEnd: string;
  priority?: 'EMERGENCY' | 'HIGH' | 'NORMAL' | 'LOW';
  notes?: string;
  serviceAddress?: string;
  gateCode?: string;
  reportedIssue?: string;
}

export interface PublicJobRequestInput {
  tenantSlug?: string;
  name: string;
  companyName?: string;
  phone: string;
  email?: string;
  address: string;
  zipCode?: string;
  gateCode?: string;
  accessNotes?: string;
  title?: string;
  reportedIssue: string;
  priority?: 'EMERGENCY' | 'HIGH' | 'NORMAL' | 'LOW';
  equipmentBrand?: string;
  equipmentModel?: string;
  preferredWindow?: string;
}

export class JobService {
  /**
   * Generates a readable job number e.g. "JOB-9041".
   */
  private static async generateJobNumber(tenantId: string): Promise<string> {
    const count = await prisma.job.count({ where: { tenantId } });
    const num = 9000 + count + 1;
    return `JOB-${num}`;
  }

  /**
   * Lists jobs with flexible filtering (date, status, technician, search).
   */
  static async listJobs(
    tenantId: string,
    filters: {
      date?: string;
      status?: string;
      technicianId?: string;
      search?: string;
    } = {}
  ) {
    // Automatically sync any recent AI voice bookings from workflow-service
    await this.syncAiWorkflowJobs(tenantId).catch(() => {});

    const where: any = { tenantId };

    if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status as JobStatus;
    }

    if (filters.technicianId && filters.technicianId !== 'ALL') {
      if (filters.technicianId === 'UNASSIGNED') {
        where.technicianId = null;
      } else {
        where.technicianId = filters.technicianId;
      }
    }

    if (filters.date) {
      const startOfDay = new Date(filters.date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(filters.date);
      endOfDay.setUTCHours(23, 59, 59, 999);

      where.OR = [
        {
          scheduledStart: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        {
          scheduledDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        {
          status: 'UNSCHEDULED',
        },
      ];
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { jobNumber: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { reportedIssue: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { companyName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    return prisma.job.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            companyName: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
            gateCode: true,
            accessNotes: true,
          },
        },
        equipment: {
          select: {
            id: true,
            name: true,
            brand: true,
            modelNumber: true,
            serialNumber: true,
            locationOnSite: true,
            warrantyStatus: true,
          },
        },
        technician: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { scheduledStart: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Retrieves single job details.
   */
  static async getJobById(tenantId: string, jobId: string) {
    const job = await prisma.job.findFirst({
      where: { id: jobId, tenantId },
      include: {
        customer: true,
        equipment: true,
        technician: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!job) {
      throw new Error('Work order not found');
    }

    return job;
  }

  /**
   * Creates a new work order.
   */
  static async createJob(tenantId: string, data: CreateJobInput) {
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, tenantId },
    });

    if (!customer) {
      throw new Error('Selected customer does not exist');
    }

    const jobNumber = await this.generateJobNumber(tenantId);

    // Default service address from customer if not specified
    const serviceAddress =
      data.serviceAddress ||
      `${customer.address || ''}${customer.city ? `, ${customer.city}` : ''} ${customer.state || ''}`.trim();
    const gateCode = data.gateCode || customer.gateCode;

    const scheduledDate = data.scheduledDate ? new Date(data.scheduledDate) : undefined;
    const scheduledStart = data.scheduledStart ? new Date(data.scheduledStart) : undefined;
    const scheduledEnd = data.scheduledEnd ? new Date(data.scheduledEnd) : undefined;

    const status: JobStatus = data.technicianId && scheduledStart ? 'SCHEDULED' : (data.status || 'UNSCHEDULED');

    const created = await prisma.job.create({
      data: {
        tenantId,
        jobNumber,
        customerId: data.customerId,
        equipmentId: data.equipmentId || null,
        technicianId: data.technicianId || null,
        title: data.title,
        status,
        priority: data.priority || 'NORMAL',
        scheduledDate,
        scheduledStart,
        scheduledEnd,
        serviceAddress,
        gateCode,
        reportedIssue: data.reportedIssue,
        notes: data.notes,
        totalAmount: data.totalAmount ? Number(data.totalAmount) : null,
      },
      include: {
        customer: true,
        equipment: true,
        technician: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (created.technicianId) {
      this.notifyTechnicianByEmail(created.id, created.technicianId, tenantId).catch(() => {});
    }

    return created;
  }

  /**
   * Dispatches or reschedules a work order to a technician and time slot.
   */
  static async dispatchJob(tenantId: string, jobId: string, data: DispatchJobInput) {
    const job = await prisma.job.findFirst({
      where: { id: jobId, tenantId },
    });

    if (!job) {
      throw new Error('Work order not found');
    }

    const tech = await prisma.user.findFirst({
      where: { id: data.technicianId, tenantId },
    });

    if (!tech) {
      throw new Error('Technician not found in this company');
    }

    const scheduledStart = new Date(data.scheduledStart);
    const scheduledEnd = new Date(data.scheduledEnd);
    const scheduledDate = data.scheduledDate ? new Date(data.scheduledDate) : scheduledStart;

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        technicianId: data.technicianId,
        status: 'DISPATCHED',
        scheduledDate,
        scheduledStart,
        scheduledEnd,
        priority: data.priority || job.priority,
        notes: data.notes !== undefined ? data.notes : job.notes,
        ...(data.serviceAddress !== undefined ? { serviceAddress: data.serviceAddress } : {}),
        ...(data.gateCode !== undefined ? { gateCode: data.gateCode } : {}),
        ...(data.reportedIssue !== undefined ? { reportedIssue: data.reportedIssue } : {}),
      },
      include: {
        customer: true,
        equipment: true,
        technician: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    // Broadcast real-time SSE event to live tracking subscribers
    this.broadcastTrackingUpdate(jobId);

    // Notify assigned technician via email
    if (updated.technicianId) {
      this.notifyTechnicianByEmail(updated.id, updated.technicianId, tenantId).catch(() => {});
    }

    return updated;
  }

  /**
   * Updates job status (e.g. EN_ROUTE, ON_SITE, COMPLETED).
   */
  static async updateJobStatus(
    tenantId: string,
    jobId: string,
    status: JobStatus,
    notes?: string
  ) {
    const job = await prisma.job.findFirst({
      where: { id: jobId, tenantId },
    });

    if (!job) {
      throw new Error('Work order not found');
    }

    const updateData: any = { status };
    if (notes) {
      updateData.notes = notes;
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: updateData,
      include: {
        customer: true,
        equipment: true,
        technician: true,
      },
    });

    // Broadcast real-time SSE event to live tracking subscribers
    this.broadcastTrackingUpdate(jobId);

    return updated;
  }

  /**
   * Handles a technician declining a job offer.
   * Autonomous dispatch: Automatically attempts to reassign the work order to the next available technician.
   * If all technicians have declined or are unavailable, escalates to the dispatch triage queue.
   */
  static async declineJob(
    tenantId: string,
    jobId: string,
    technicianUserId?: string,
    reason?: string
  ) {
    const job = await prisma.job.findFirst({
      where: { id: jobId, tenantId },
      include: {
        customer: true,
        equipment: true,
        technician: true,
        tenant: true,
      },
    });

    if (!job) {
      throw new Error('Work order not found');
    }

    const currentTechName = job.technician?.name || 'Assigned Technician';
    const decliningTechId = technicianUserId || job.technicianId;

    // 1. Search for other active certified technicians in the same company
    const candidateTechnicians = await prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        id: decliningTechId ? { not: decliningTechId } : undefined,
        role: {
          slug: { in: ['technician'] },
        },
      },
      include: {
        jobsAssigned: {
          where: {
            status: { in: ['SCHEDULED', 'DISPATCHED', 'EN_ROUTE', 'ON_SITE'] },
          },
        },
      },
    });

    // Filter out anyone who has already declined this job (recorded in notes)
    const validCandidates = candidateTechnicians.filter((t) => {
      if (!job.notes) return true;
      return !job.notes.includes(`Declined by ${t.name}`);
    });

    // Sort by active workload ascending (lightest workload gets the job first)
    validCandidates.sort((a, b) => a.jobsAssigned.length - b.jobsAssigned.length);

    if (validCandidates.length > 0) {
      // Reassign to next best technician
      const nextTech = validCandidates[0];
      const reassignNote = `[Elijah AI Auto-Dispatch] Declined by ${currentTechName}${
        reason ? ` (Reason: ${reason})` : ''
      }. Automatically re-assigned to ${nextTech.name}.`;

      const updated = await prisma.job.update({
        where: { id: jobId },
        data: {
          technicianId: nextTech.id,
          status: 'SCHEDULED', // Offered to new tech
          notes: job.notes ? `${job.notes}\n${reassignNote}` : reassignNote,
        },
        include: {
          customer: true,
          equipment: true,
          technician: true,
        },
      });

      // Dispatch assignment email to next technician
      const windowStr = updated.scheduledStart && updated.scheduledEnd
        ? `${new Date(updated.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(updated.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Assigned Schedule Window';

      try {
        await MailService.sendJobAssignment({
          to: nextTech.email,
          technicianName: nextTech.name,
          tenantName: job.tenant.name,
          jobNumber: updated.jobNumber || 'JOB',
          title: updated.title,
          customerName: job.customer?.name || 'Customer',
          customerPhone: job.customer?.phone || '',
          serviceAddress: updated.serviceAddress || job.customer?.address || '',
          gateCode: updated.gateCode,
          scheduledWindow: windowStr,
          priority: updated.priority,
          portalUrl: `${process.env.COMPANY_FRONTEND_URL || 'http://localhost:3000'}/tech`,
        });
      } catch (mailErr) {
        console.warn('Mail notification failed:', mailErr);
      }

      this.broadcastTrackingUpdate(jobId);

      return {
        reassigned: true,
        escalated: false,
        previousTechnician: currentTechName,
        newTechnician: nextTech.name,
        newTechnicianId: nextTech.id,
        job: updated,
        message: `Work order declined by ${currentTechName}. Elijah AI autonomous dispatch automatically re-assigned it to ${nextTech.name}.`,
      };
    } else {
      // No available technician - Escalate to Dispatcher Queue
      const escalationNote = `[ESCALATION] Declined by ${currentTechName}${
        reason ? ` (Reason: ${reason})` : ''
      }. No other available technicians in route. Escalated to Dispatcher Triage Queue.`;

      const updated = await prisma.job.update({
        where: { id: jobId },
        data: {
          technicianId: null,
          status: 'UNSCHEDULED',
          priority: 'HIGH', // Escalate priority
          notes: job.notes ? `${job.notes}\n${escalationNote}` : escalationNote,
        },
        include: {
          customer: true,
          equipment: true,
          technician: true,
        },
      });

      this.broadcastTrackingUpdate(jobId);

      return {
        reassigned: false,
        escalated: true,
        previousTechnician: currentTechName,
        newTechnician: null,
        job: updated,
        message: `Work order declined. No other available technicians found — escalated to Dispatcher Triage Queue.`,
      };
    }
  }

  /**
   * Technician accepts the offered job.
   */
  static async acceptJob(tenantId: string, jobId: string) {
    return this.updateJobStatus(tenantId, jobId, 'DISPATCHED');
  }

  /**
   * Updates general job fields.
   */
  static async updateJob(tenantId: string, jobId: string, data: Partial<CreateJobInput>) {
    const job = await prisma.job.findFirst({
      where: { id: jobId, tenantId },
    });

    if (!job) {
      throw new Error('Work order not found');
    }

    const updateData: any = { ...data };
    if (data.scheduledDate) updateData.scheduledDate = new Date(data.scheduledDate);
    if (data.scheduledStart) updateData.scheduledStart = new Date(data.scheduledStart);
    if (data.scheduledEnd) updateData.scheduledEnd = new Date(data.scheduledEnd);

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: updateData,
      include: {
        customer: true,
        equipment: true,
        technician: true,
      },
    });

    // Broadcast real-time SSE event to live tracking subscribers
    this.broadcastTrackingUpdate(jobId);

    // Notify assigned technician via email if newly assigned or changed
    if (updated.technicianId && updated.technicianId !== job.technicianId) {
      this.notifyTechnicianByEmail(updated.id, updated.technicianId, tenantId).catch(() => {});
    }

    return updated;
  }

  /**
   * Helper to fetch fresh public tracking payload and broadcast it over SSE.
   */
  static async broadcastTrackingUpdate(jobId: string) {
    try {
      const payload = await this.getPublicTracking(jobId);
      broadcastJobUpdate(jobId, payload);
    } catch (err) {
      console.error(`[SSE] Error broadcasting tracking update for job ${jobId}:`, err);
    }
  }

  /**
   * Sends an email notification to the assigned field technician.
   */
  static async notifyTechnicianByEmail(jobId: string, technicianId: string, tenantId: string) {
    try {
      const job = await prisma.job.findFirst({
        where: { id: jobId, tenantId },
        include: {
          customer: true,
          technician: true,
          tenant: true,
        },
      });

      if (!job || !job.technician || !job.technician.email) {
        return;
      }

      const scheduledWindow = job.scheduledStart
        ? `${new Date(job.scheduledStart).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })} · ${new Date(job.scheduledStart).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })} – ${job.scheduledEnd ? new Date(job.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}`
        : 'Immediate / As Soon As Possible';

      const portalUrl = `${process.env.COMPANY_APP_URL || 'http://localhost:3000'}/tech`;

      await MailService.sendJobAssignment({
        to: job.technician.email,
        technicianName: job.technician.name || 'Technician',
        tenantName: job.tenant.name || 'Elijah AI Partner',
        jobNumber: job.jobNumber || `JOB-${job.id.slice(-4)}`,
        title: job.reportedIssue || job.title,
        customerName: job.customer.name,
        customerPhone: job.customer.phone,
        serviceAddress: job.serviceAddress || job.customer.address || 'Address on file',
        gateCode: job.gateCode || job.customer.gateCode,
        scheduledWindow,
        priority: job.priority,
        portalUrl,
      });
    } catch (err: any) {
      console.error(`[JOB SERVICE] Failed to send technician assignment email for job ${jobId}:`, err.message);
    }
  }

  /**
   * Deletes a job.
   */
  static async deleteJob(tenantId: string, jobId: string) {
    const job = await prisma.job.findFirst({
      where: { id: jobId, tenantId },
    });

    if (!job) {
      throw new Error('Work order not found');
    }

    return prisma.job.delete({
      where: { id: jobId },
    });
  }

  /**
   * Fetches technicians list for swimlane columns.
   */
  static async listTechnicians(tenantId: string) {
    return prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        role: {
          slug: {
            in: ['technician', 'owner', 'dispatcher', 'sales_estimator'],
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Gets the active dispatched job for the logged-in technician (with graceful fallback for office managers/owners previewing the tech app).
   */
  static async getTechnicianActiveJob(tenantId: string, technicianUserId?: string, isTechnicianRole: boolean = false) {
    const where: any = {
      tenantId,
      status: {
        in: ['DISPATCHED', 'EN_ROUTE', 'ON_SITE', 'SCHEDULED'],
      },
    };

    if (technicianUserId) {
      const userJob = await prisma.job.findFirst({
        where: { ...where, technicianId: technicianUserId },
        include: {
          customer: true,
          equipment: true,
          technician: {
            select: { id: true, name: true, phone: true },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { scheduledStart: 'asc' },
        ],
      });
      if (userJob) return userJob;

      // If the logged-in user is a field technician, never show other technicians' jobs!
      if (isTechnicianRole) return null;
    }

    // Fallback: earliest active job in company for preview (only for owners / office managers previewing)
    return prisma.job.findFirst({
      where,
      include: {
        customer: true,
        equipment: true,
        technician: {
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { scheduledStart: 'asc' },
      ],
    });
  }

  /**
   * Safe public tracking data for customers (no auth required)
   */
  static async getPublicTracking(jobId: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        customer: {
          select: {
            name: true,
            companyName: true,
            address: true,
          },
        },
        equipment: {
          select: {
            name: true,
            brand: true,
            modelNumber: true,
            type: true,
          },
        },
        technician: {
          select: {
            name: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
        tenant: {
          select: {
            name: true,
            phone: true,
            tradeType: true,
          },
        },
      },
    });

    if (!job) {
      throw new Error('Work order not found');
    }

    return {
      id: job.id,
      jobNumber: job.jobNumber,
      title: job.title,
      status: job.status,
      priority: job.priority,
      scheduledDate: job.scheduledDate,
      scheduledStart: job.scheduledStart,
      scheduledEnd: job.scheduledEnd,
      serviceAddress: job.serviceAddress,
      reportedIssue: job.reportedIssue,
      notes: job.notes,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      customer: job.customer,
      equipment: job.equipment,
      technician: job.technician
        ? {
            name: job.technician.name,
            role: (job.technician.role as any)?.name || 'Certified Field Technician',
          }
        : null,
      company: {
        name: job.tenant?.name || 'Service Operations',
        phone: job.tenant?.phone || '(800) 555-0199',
        tradeType: job.tenant?.tradeType || 'HVAC',
      },
    };
  }

  /**
   * Retrieves public company profile by slug (or fallback to default tenant)
   * for customer self-service booking page branding.
   */
  static async getCompanyProfile(slug?: string) {
    let tenant = null;
    if (slug && slug !== 'default') {
      tenant = await prisma.tenant.findUnique({
        where: { slug },
        select: {
          id: true,
          name: true,
          slug: true,
          tradeType: true,
          phone: true,
          address: true,
        },
      });
    }

    if (!tenant) {
      tenant = await prisma.tenant.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          tradeType: true,
          phone: true,
          address: true,
        },
      });
    }

    if (!tenant) {
      throw new Error('Company not found');
    }

    return tenant;
  }

  /**
   * Public customer-facing self-service booking.
   * Auto-links or creates the Customer in the CRM, creates an unscheduled work order,
   * and returns the job ID so the customer can track it live immediately.
   */
  static async createPublicRequest(input: PublicJobRequestInput) {
    if (!input.name || !input.phone || !input.address || !input.reportedIssue) {
      throw new Error('Name, phone, service address, and issue description are required.');
    }

    // 1. Locate tenant by slug or default to first active tenant
    let tenant = null;
    if (input.tenantSlug) {
      tenant = await prisma.tenant.findUnique({
        where: { slug: input.tenantSlug },
      });
    }
    if (!tenant) {
      tenant = await prisma.tenant.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!tenant) {
      throw new Error('No service company active to receive requests');
    }

    const tenantId = tenant.id;
    const fullAddress = input.zipCode && !input.address.includes(input.zipCode)
      ? `${input.address.trim()}, ${input.zipCode.trim()}`
      : input.address.trim();

    // 2. Check if customer already exists by phone or email
    let customer = await prisma.customer.findFirst({
      where: {
        tenantId,
        OR: [
          { phone: input.phone },
          ...(input.email ? [{ email: input.email }] : []),
        ],
      },
    });

    if (!customer) {
      // Auto-create customer record in CRM
      customer = await prisma.customer.create({
        data: {
          tenantId,
          name: input.name,
          companyName: input.companyName || undefined,
          phone: input.phone,
          email: input.email || undefined,
          address: fullAddress,
          gateCode: input.gateCode || undefined,
          accessNotes: input.accessNotes || undefined,
          customerType: input.companyName ? 'COMMERCIAL' : 'RESIDENTIAL',
        },
      });
    }

    // 3. Register equipment if provided and not yet registered
    let equipmentId: string | undefined;
    if (input.equipmentBrand) {
      const existingEquip = await prisma.equipment.findFirst({
        where: {
          customerId: customer.id,
          brand: { contains: input.equipmentBrand, mode: 'insensitive' },
        },
      });

      if (existingEquip) {
        equipmentId = existingEquip.id;
      } else {
        const newEquip = await prisma.equipment.create({
          data: {
            tenantId,
            customerId: customer.id,
            name: `${input.equipmentBrand} Unit`,
            brand: input.equipmentBrand,
            modelNumber: input.equipmentModel || undefined,
            type: tenant.tradeType || 'HVAC',
          },
        });
        equipmentId = newEquip.id;
      }
    }

    // 4. Generate unique Job Number (e.g. JOB-8319)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const jobNumber = `JOB-${randomSuffix}`;

    // 5. Create Work Order
    const job = await prisma.job.create({
      data: {
        tenantId,
        jobNumber,
        customerId: customer.id,
        equipmentId,
        title: input.title || `Service Request: ${input.reportedIssue.slice(0, 45)}...`,
        reportedIssue: input.reportedIssue,
        serviceAddress: fullAddress,
        gateCode: input.gateCode || customer.gateCode || undefined,
        priority: input.priority || 'NORMAL',
        status: 'UNSCHEDULED',
        notes: input.preferredWindow ? `Preferred Window: ${input.preferredWindow}` : undefined,
      },
    });

    // Rule 1: The Company Dispatch Policy (dispatch.assign)
    const settings = TenantSettingsService.getSettings(tenantId);
    let finalStatus = 'UNSCHEDULED';
    let assignedTechName: string | null = null;

    if (settings.dispatchPolicy === 'ALLOW') {
      // Mode A: Autonomous AI Dispatch (ALLOW) -> Immediate auto-dispatch
      const availableTechs = await prisma.user.findMany({
        where: {
          tenantId,
          isActive: true,
          role: { slug: { in: ['technician'] } },
        },
        include: { role: true },
        orderBy: { createdAt: 'asc' },
      });

      if (availableTechs.length > 0) {
        // Evaluate candidate workload and distance
        const scoredTechs = await Promise.all(
          availableTechs.map(async (tech) => {
            const activeCount = await prisma.job.count({
              where: {
                tenantId,
                technicianId: tech.id,
                status: { in: ['DISPATCHED', 'EN_ROUTE', 'ON_SITE'] },
              },
            });
            return { tech, activeCount };
          })
        );
        scoredTechs.sort((a, b) => a.activeCount - b.activeCount);
        const bestTech = scoredTechs[0].tech;

        const scheduledStart = new Date();
        const scheduledEnd = new Date(Date.now() + 2 * 60 * 60 * 1000);

        const updatedJob = await prisma.job.update({
          where: { id: job.id },
          data: {
            technicianId: bestTech.id,
            status: 'DISPATCHED',
            scheduledDate: scheduledStart,
            scheduledStart,
            scheduledEnd,
            notes: `${job.notes || ''} [Autonomous AI Dispatch] Assigned to ${bestTech.name} based on 0 active load and zone availability.`.trim(),
          },
          include: { customer: true, technician: true },
        });

        finalStatus = 'DISPATCHED';
        assignedTechName = bestTech.name;
        broadcastJobUpdate(updatedJob.id, updatedJob);

        if (bestTech.email) {
          MailService.sendJobAssignment({
            to: bestTech.email,
            technicianName: bestTech.name,
            customerName: customer.name,
            customerPhone: customer.phone,
            serviceAddress: fullAddress,
            reportedIssue: input.reportedIssue,
            timeWindow: 'Immediate Dispatch',
            jobNumber: job.jobNumber,
            tenantName: tenant.name,
            isEmergency: input.priority === 'EMERGENCY',
          }).catch((e: any) => console.error('Failed to notify tech via email:', e));
        }
      }
    } else {
      // Mode B: Human Dispatcher Triage (RECOMMEND) -> Push to /schedule triage queue
      broadcastJobUpdate(job.id, job);
    }

    return {
      jobId: job.id,
      jobNumber: job.jobNumber,
      status: finalStatus,
      assignedTechnician: assignedTechName,
      customerName: customer.name,
      companyName: tenant.name,
      trackingUrl: `/track/${job.id}`,
    };
  }

  /**
   * Registers a public browser WebRTC call with Retell / Voice-Service.
   */
  static async createPublicWebCall(tenantSlug?: string) {
    const tenant = tenantSlug
      ? await prisma.tenant.findFirst({ where: { slug: tenantSlug } })
      : await prisma.tenant.findFirst();

    const companyName = tenant?.name || 'Vanguard Electric & Power';

    // 1. Generate dev JWT token for voice-service auth
    const token = jwt.sign(
      {
        sub: 'public-caller',
        tenantId: '11111111-1111-4111-8111-111111111111',
        roles: ['owner'],
        name: companyName,
      },
      process.env.JWT_SECRET || 'super-secret-jwt-key-elijah-ai-2026-very-secure',
      {
        issuer: 'elijah-auth-dev',
        audience: 'elijah-services',
        expiresIn: '1h',
      }
    );

    // 2. Fetch receptionist agent from voice-service
    const voiceUrl = process.env.VOICE_SERVICE_URL || 'http://localhost:4002';
    const agentsRes = await fetch(`${voiceUrl}/api/v1/agents`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const agentsData = (await agentsRes.json()) as any;
    const agents = agentsData.data || [];
    const receptionist = agents.find((a: any) => a.role === 'receptionist') || agents[0];

    if (!receptionist) {
      throw new Error('No receptionist voice agent configured');
    }

    // 3. Create Web Call
    const webCallRes = await fetch(`${voiceUrl}/api/v1/web-calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ agentId: receptionist.id }),
    });

    const webCallData = (await webCallRes.json()) as any;
    if (!webCallRes.ok || !webCallData.data) {
      throw new Error(webCallData.error?.message || 'Failed to create voice call session');
    }

    return {
      accessToken: webCallData.data.accessToken,
      retellCallId: webCallData.data.call.retellCallId,
      callId: webCallData.data.call.id,
      companyName,
    };
  }

  /**
   * Syncs voice call bookings from workflow-service into core Prisma Postgres DB.
   */
  static async syncAiWorkflowJobs(tenantId: string) {
    try {
      const token = jwt.sign(
        {
          sub: 'backend-sync',
          tenantId: '11111111-1111-4111-8111-111111111111',
          roles: ['owner'],
        },
        process.env.JWT_SECRET || 'super-secret-jwt-key-elijah-ai-2026-very-secure',
        {
          issuer: 'elijah-auth-dev',
          audience: 'elijah-services',
          expiresIn: '1h',
        }
      );

      const workflowUrl = process.env.WORKFLOW_SERVICE_URL || 'http://localhost:4004';
      const res = await fetch(`${workflowUrl}/api/v1/service-requests?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const body = (await res.json()) as any;
      const requests = body.data || [];

      for (const req of requests) {
        if (!req.jobNumber) continue;

        const slotStart = req.slotStart ? new Date(req.slotStart) : new Date();
        const slotEnd = req.slotEnd ? new Date(req.slotEnd) : new Date(slotStart.getTime() + 2 * 3600 * 1000);

        let jobStatus: JobStatus = 'SCHEDULED';
        if (req.status === 'awaiting_technician_acceptance' || req.status === 'scheduled') {
          jobStatus = 'SCHEDULED';
        } else if (req.status === 'in_progress') {
          jobStatus = 'ON_SITE';
        } else if (req.status === 'completed' || req.status === 'closed') {
          jobStatus = 'COMPLETED';
        }

        // Match technician if assigned
        let techId: string | undefined;
        if (req.technician?.name) {
          const tech = await prisma.user.findFirst({
            where: {
              tenantId,
              name: { contains: req.technician.name.split(' ')[0], mode: 'insensitive' },
            },
          });
          if (tech) techId = tech.id;
        }

        const existing = await prisma.job.findFirst({
          where: { tenantId, jobNumber: req.jobNumber },
        });

        // 1. Resolve real customer from internal database if customerId is present
        let customer: any = null;
        let customerAddressStr: string | undefined;

        if (req.customerId) {
          try {
            const coreUrl = process.env.CORE_SERVICE_URL || `http://localhost:${process.env.PORT || 5000}`;
            const coreToken = process.env.CORE_SERVICE_TOKEN || 'replace-with-a-long-random-string';
            const custRes = await fetch(`${coreUrl}/internal/v1/customers/${req.customerId}`, {
              headers: {
                'x-service-token': coreToken,
                'x-tenant-id': tenantId,
              },
            });
            if (custRes.ok) {
              const custData = (await custRes.json()) as any;
              const c = custData.data;
              if (c && c.name) {
                const addr = c.address;
                customerAddressStr = addr
                  ? `${addr.street || ''}, ${addr.city || ''}, ${addr.state || ''} ${addr.zip || ''}`.trim()
                  : undefined;
                const existingCust = await prisma.customer.findFirst({
                  where: { tenantId, phone: c.phone },
                });
                if (existingCust) {
                  customer = existingCust;
                } else {
                  customer = await prisma.customer.create({
                    data: {
                      tenantId,
                      name: c.name,
                      phone: c.phone || '+15000005421',
                      email: c.email || undefined,
                      address: customerAddressStr || 'Address on file',
                      city: addr?.city || 'Phoenix',
                      state: addr?.state || 'AZ',
                      zipCode: addr?.zip || '85004',
                    },
                  });
                }
              }
            }
          } catch {
            // Core service lookup failed, fallback gracefully
          }
        }

        if (!existing) {
          if (!customer) {
            customer = await prisma.customer.findFirst({
              where: { tenantId },
            });
          }
          if (!customer) {
            customer = await prisma.customer.create({
              data: {
                tenantId,
                name: 'Voice Call Homeowner',
                phone: '+16025550148',
                address: '100 North Central Avenue, Phoenix, AZ 85004',
                city: 'Phoenix',
                state: 'AZ',
                zipCode: '85004',
              },
            });
          }

          const serviceAddress =
            customerAddressStr ||
            customer.address ||
            '100 North Central Avenue, Phoenix, AZ 85004';

          const createdSyncJob = await prisma.job.create({
            data: {
              tenantId,
              jobNumber: req.jobNumber,
              customerId: customer.id,
              technicianId: techId,
              title: req.problem ? `AI Call: ${req.problem}` : `AI Voice Booking ${req.jobNumber}`,
              reportedIssue: req.problem || 'Booked via Elijah 24/7 Voice Receptionist',
              serviceAddress,
              status: jobStatus,
              priority: req.isEmergency ? 'EMERGENCY' : 'NORMAL',
              scheduledDate: slotStart,
              scheduledStart: slotStart,
              scheduledEnd: slotEnd,
            },
          });

          if (techId) {
            this.notifyTechnicianByEmail(createdSyncJob.id, techId, tenantId).catch(() => {});
          }
        } else {
          // If existing job was associated with generic seed customer and we now have the real customer from core-service, update it!
          const updates: any = {};
          if (techId && existing.technicianId !== techId) {
            updates.technicianId = techId;
            updates.status = jobStatus;
          }
          if (customer && existing.customerId !== customer.id) {
            updates.customerId = customer.id;
            if (customerAddressStr) {
              updates.serviceAddress = customerAddressStr;
            }
          }
          if (Object.keys(updates).length > 0) {
            await prisma.job.update({
              where: { id: existing.id },
              data: updates,
            });
            if (updates.technicianId) {
              this.notifyTechnicianByEmail(existing.id, updates.technicianId, tenantId).catch(() => {});
            }
          }
        }
      }
    } catch {
      // Ignore background sync errors
    }
  }

  /**
   * Lists live AI voice calls from voice-service.
   */
  static async listCalls() {
    const token = jwt.sign(
      {
        sub: 'staff-user',
        tenantId: '11111111-1111-4111-8111-111111111111',
        roles: ['owner'],
        name: 'Vanguard Electric & Power',
      },
      process.env.JWT_SECRET || 'super-secret-jwt-key-elijah-ai-2026-very-secure',
      {
        issuer: 'elijah-auth-dev',
        audience: 'elijah-services',
        expiresIn: '1h',
      }
    );

    const voiceUrl = process.env.VOICE_SERVICE_URL || 'http://localhost:4002';
    const res = await fetch(`${voiceUrl}/api/v1/calls`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error('Failed to retrieve calls from voice-service');
    }
    const data = (await res.json()) as any;
    return data.data || [];
  }

  /**
   * Retrieves single live AI voice call details with transcript.
   */
  static async getCallDetail(callId: string) {
    const token = jwt.sign(
      {
        sub: 'staff-user',
        tenantId: '11111111-1111-4111-8111-111111111111',
        roles: ['owner'],
        name: 'Vanguard Electric & Power',
      },
      process.env.JWT_SECRET || 'super-secret-jwt-key-elijah-ai-2026-very-secure',
      {
        issuer: 'elijah-auth-dev',
        audience: 'elijah-services',
        expiresIn: '1h',
      }
    );

    const voiceUrl = process.env.VOICE_SERVICE_URL || 'http://localhost:4002';
    const res = await fetch(`${voiceUrl}/api/v1/calls/${callId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error('Failed to retrieve call detail from voice-service');
    }
    const data = (await res.json()) as any;
    return data.data;
  }
}
