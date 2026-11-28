import { prisma } from '../../config/database.js';

export interface CreateEstimateInput {
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  serviceAddress?: string;
  tradeCategory?: string;
  title: string;
  amount: number;
  status?: string;
  grossMarginPct?: number;
  repName?: string;
  notes?: string;
  hasTiers?: boolean;
  tiers?: any;
  scopeItems?: any;
}

export class EstimateService {
  /**
   * Generates sequential EST-XXXX estimate number per tenant.
   */
  private static async getNextEstimateNumber(tenantId: string): Promise<string> {
    const count = await prisma.estimate.count({ where: { tenantId } });
    const num = 2500 + count + 1;
    return `EST-${num}`;
  }

  /**
   * Lists estimates with pipeline aggregates and tab filters.
   */
  static async listEstimates(
    tenantId: string,
    filters: {
      status?: string;
      search?: string;
    } = {}
  ) {
    const where: any = { tenantId };

    if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status.toUpperCase();
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { estimateNumber: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { tradeCategory: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [estimates, allTenantEstimates] = await Promise.all([
      prisma.estimate.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              address: true,
              city: true,
              state: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.estimate.findMany({
        where: { tenantId },
        select: {
          id: true,
          amount: true,
          status: true,
        },
      }),
    ]);

    // Compute live metrics
    let openPipelineValue = 0;
    let acceptedValue = 0;
    let activeFollowUpsCount = 0;

    const counts: Record<string, number> = {
      ALL: allTenantEstimates.length,
      DRAFT: 0,
      SENT: 0,
      VIEWED: 0,
      ACCEPTED: 0,
      DECLINED: 0,
      EXPIRED: 0,
    };

    for (const est of allTenantEstimates) {
      const amt = Number(est.amount || 0);
      const st = (est.status || 'DRAFT').toUpperCase();
      counts[st] = (counts[st] || 0) + 1;

      if (['DRAFT', 'SENT', 'VIEWED'].includes(st)) {
        openPipelineValue += amt;
      }
      if (st === 'ACCEPTED') {
        acceptedValue += amt;
      }
      if (['SENT', 'VIEWED'].includes(st)) {
        activeFollowUpsCount += 1;
      }
    }

    return {
      estimates,
      metrics: {
        openPipelineValue,
        acceptedValue,
        activeFollowUpsCount,
        counts,
      },
    };
  }

  /**
   * Creates a new proposal / estimate.
   */
  static async createEstimate(tenantId: string, data: CreateEstimateInput, defaultRep: string = 'Staff Estimator') {
    const estimateNumber = await this.getNextEstimateNumber(tenantId);

    // If customerId is provided, resolve customer details
    let customerName = data.customerName;
    let customerPhone = data.customerPhone;
    let serviceAddress = data.serviceAddress;

    if (data.customerId) {
      const cust = await prisma.customer.findFirst({
        where: { id: data.customerId, tenantId },
      });
      if (cust) {
        customerName = cust.name;
        customerPhone = customerPhone || cust.phone;
        serviceAddress = serviceAddress || `${cust.address || ''}${cust.city ? `, ${cust.city}` : ''}`;
      }
    }

    return prisma.estimate.create({
      data: {
        tenantId,
        estimateNumber,
        customerId: data.customerId || null,
        customerName,
        customerPhone: customerPhone || null,
        serviceAddress: serviceAddress || null,
        tradeCategory: data.tradeCategory || 'HVAC',
        title: data.title,
        amount: data.amount,
        status: data.status || 'DRAFT',
        grossMarginPct: data.grossMarginPct || null,
        repName: data.repName || defaultRep,
        notes: data.notes || null,
        hasTiers: Boolean(data.hasTiers),
        tiers: data.tiers || null,
        scopeItems: data.scopeItems || null,
      },
      include: {
        customer: true,
      },
    });
  }

  /**
   * Updates an estimate status or attributes.
   */
  static async updateEstimate(
    tenantId: string,
    id: string,
    data: {
      status?: string;
      amount?: number;
      title?: string;
      notes?: string;
      tradeCategory?: string;
    }
  ) {
    const existing = await prisma.estimate.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new Error('Estimate not found');
    }

    const updateData: any = {};
    if (data.status) {
      updateData.status = data.status.toUpperCase();
      if (updateData.status === 'SENT' && !existing.sentAt) updateData.sentAt = new Date();
      if (updateData.status === 'VIEWED' && !existing.viewedAt) updateData.viewedAt = new Date();
      if (updateData.status === 'ACCEPTED' && !existing.acceptedAt) updateData.acceptedAt = new Date();
    }
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.tradeCategory !== undefined) updateData.tradeCategory = data.tradeCategory;

    return prisma.estimate.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Deletes an estimate.
   */
  static async deleteEstimate(tenantId: string, id: string) {
    const existing = await prisma.estimate.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new Error('Estimate not found');
    }
    return prisma.estimate.delete({ where: { id } });
  }
}
