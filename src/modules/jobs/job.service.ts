import { prisma } from '../../config/database.js';
import { JobStatus } from '@prisma/client';

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

    return prisma.job.create({
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

    return prisma.job.update({
      where: { id: jobId },
      data: {
        technicianId: data.technicianId,
        status: 'DISPATCHED',
        scheduledDate,
        scheduledStart,
        scheduledEnd,
        priority: data.priority || job.priority,
        notes: data.notes !== undefined ? data.notes : job.notes,
      },
      include: {
        customer: true,
        equipment: true,
        technician: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });
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

    return prisma.job.update({
      where: { id: jobId },
      data: updateData,
      include: {
        customer: true,
        equipment: true,
        technician: true,
      },
    });
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

    return prisma.job.update({
      where: { id: jobId },
      data: updateData,
      include: {
        customer: true,
        equipment: true,
        technician: true,
      },
    });
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
  static async getTechnicianActiveJob(tenantId: string, technicianUserId?: string) {
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
    }

    // Fallback: earliest active job in company for preview
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
}
