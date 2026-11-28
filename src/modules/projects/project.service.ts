import { prisma } from '../../config/database.js';

export interface CreateProjectInput {
  estimateId?: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  serviceAddress?: string;
  tradeCategory?: string;
  title: string;
  value: number;
  stage?: string;
  assignedCrew?: string;
  permitNumber?: string;
  equipmentModel?: string;
  notes?: string;
}

export class ProjectService {
  /**
   * Generates sequential PRJ-XXX project number per tenant.
   */
  private static async getNextProjectNumber(tenantId: string): Promise<string> {
    const count = await prisma.project.count({ where: { tenantId } });
    const num = 300 + count + 1;
    return `PRJ-${num}`;
  }

  /**
   * Calculates progress percentage based on stage.
   */
  private static getProgressForStage(stage: string): number {
    switch (stage) {
      case 'Deposit':
        return 20;
      case 'Permit':
        return 40;
      case 'Equipment':
        return 60;
      case 'Install':
        return 80;
      case 'Inspection':
        return 90;
      case 'Complete':
        return 100;
      default:
        return 20;
    }
  }

  /**
   * Default milestones template for trade projects.
   */
  private static getDefaultMilestones(stage: string) {
    const stages = ['Deposit', 'Permit', 'Equipment', 'Install', 'Inspection', 'Complete'];
    const currentIdx = stages.indexOf(stage);

    return [
      {
        label: 'Deposit Secured (50%)',
        stage: 'Deposit',
        isComplete: currentIdx >= 0,
        completedAt: currentIdx >= 0 ? 'Verified' : undefined,
      },
      {
        label: 'City Permit Filing & Approval',
        stage: 'Permit',
        isComplete: currentIdx >= 1,
        completedAt: currentIdx >= 1 ? 'Approved' : undefined,
      },
      {
        label: 'Equipment Delivery & Staging',
        stage: 'Equipment',
        isComplete: currentIdx >= 2,
        completedAt: currentIdx >= 2 ? 'Staged' : undefined,
      },
      {
        label: 'Installation Day & Crew On-Site',
        stage: 'Install',
        isComplete: currentIdx >= 3,
        completedAt: currentIdx >= 3 ? 'Completed' : undefined,
      },
      {
        label: 'City & Utility Code Inspection',
        stage: 'Inspection',
        isComplete: currentIdx >= 4,
        completedAt: currentIdx >= 4 ? 'Signed off' : undefined,
      },
    ];
  }

  /**
   * Lists projects with aggregates and stage filters.
   */
  static async listProjects(
    tenantId: string,
    filters: {
      stage?: string;
      search?: string;
    } = {}
  ) {
    const where: any = { tenantId };

    if (filters.stage && filters.stage !== 'All' && filters.stage !== 'ALL') {
      where.stage = filters.stage;
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { projectNumber: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { tradeCategory: { contains: q, mode: 'insensitive' } },
        { permitNumber: { contains: q, mode: 'insensitive' } },
        { assignedCrew: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [projects, allTenantProjects] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              address: true,
              city: true,
            },
          },
          estimate: {
            select: {
              id: true,
              estimateNumber: true,
              amount: true,
              title: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.findMany({
        where: { tenantId },
        select: {
          id: true,
          value: true,
          stage: true,
        },
      }),
    ]);

    let activePipelineValue = 0;
    const counts: Record<string, number> = {
      All: allTenantProjects.length,
      Deposit: 0,
      Permit: 0,
      Equipment: 0,
      Install: 0,
      Inspection: 0,
      Complete: 0,
    };

    for (const prj of allTenantProjects) {
      const val = Number(prj.value || 0);
      const st = prj.stage || 'Deposit';
      counts[st] = (counts[st] || 0) + 1;

      if (st !== 'Complete') {
        activePipelineValue += val;
      }
    }

    return {
      projects,
      metrics: {
        activePipelineValue,
        counts,
      },
    };
  }

  /**
   * Creates a new installation project.
   */
  static async createProject(tenantId: string, data: CreateProjectInput) {
    const projectNumber = await this.getNextProjectNumber(tenantId);
    const stage = data.stage || 'Deposit';
    const progressPct = this.getProgressForStage(stage);
    const milestones = this.getDefaultMilestones(stage);

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

    const initialTimeline = [
      {
        timestamp: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        channel: 'SMS',
        message: `Project ${projectNumber} locked in! Deposit confirmation and initial milestone schedule generated.`,
      },
    ];

    return prisma.project.create({
      data: {
        tenantId,
        projectNumber,
        estimateId: data.estimateId || null,
        customerId: data.customerId || null,
        customerName,
        customerPhone: customerPhone || null,
        serviceAddress: serviceAddress || null,
        tradeCategory: data.tradeCategory || 'HVAC',
        title: data.title,
        value: data.value,
        stage,
        progressPct,
        assignedCrew: data.assignedCrew || 'Unassigned Crew',
        permitNumber: data.permitNumber || null,
        equipmentModel: data.equipmentModel || data.title,
        lastAction: `Project created at stage ${stage}.`,
        notes: data.notes || null,
        milestones,
        timeline: initialTimeline,
      },
      include: {
        customer: true,
        estimate: true,
      },
    });
  }

  /**
   * Advances stage or updates project fields.
   */
  static async updateProject(
    tenantId: string,
    id: string,
    data: {
      stage?: string;
      assignedCrew?: string;
      permitNumber?: string;
      equipmentModel?: string;
      notes?: string;
      advanceNextStage?: boolean;
    }
  ) {
    const existing = await prisma.project.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new Error('Project not found');
    }

    const stages = ['Deposit', 'Permit', 'Equipment', 'Install', 'Inspection', 'Complete'];
    let newStage = data.stage || existing.stage;

    if (data.advanceNextStage) {
      const currentIdx = stages.indexOf(existing.stage);
      if (currentIdx >= 0 && currentIdx < stages.length - 1) {
        newStage = stages[currentIdx + 1];
      }
    }

    const newProgress = this.getProgressForStage(newStage);

    // Update milestones
    let milestones: any[] = Array.isArray(existing.milestones)
      ? (existing.milestones as any[])
      : this.getDefaultMilestones(existing.stage);

    milestones = milestones.map((m) => {
      if (m.stage === newStage || stages.indexOf(m.stage) <= stages.indexOf(newStage)) {
        return {
          ...m,
          isComplete: true,
          completedAt: m.completedAt || 'Verified just now',
        };
      }
      return m;
    });

    // Append timeline message if stage changed
    let timeline: any[] = Array.isArray(existing.timeline) ? (existing.timeline as any[]) : [];
    let lastAction = existing.lastAction;

    if (newStage !== existing.stage) {
      const nowStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      lastAction = `Advanced project to ${newStage}. Customer notified via automated SMS.`;
      timeline = [
        {
          timestamp: nowStr,
          channel: 'SMS',
          message: `Hi ${existing.customerName.split(' ')[0]}, Elijah here! Your installation project has advanced to ${newStage}. We will keep you posted on the next milestone.`,
        },
        ...timeline,
      ];
    }

    return prisma.project.update({
      where: { id },
      data: {
        stage: newStage,
        progressPct: newProgress,
        assignedCrew: data.assignedCrew !== undefined ? data.assignedCrew : existing.assignedCrew,
        permitNumber: data.permitNumber !== undefined ? data.permitNumber : existing.permitNumber,
        equipmentModel: data.equipmentModel !== undefined ? data.equipmentModel : existing.equipmentModel,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        lastAction,
        milestones,
        timeline,
      },
      include: {
        customer: true,
        estimate: true,
      },
    });
  }

  /**
   * Deletes a project.
   */
  static async deleteProject(tenantId: string, id: string) {
    const existing = await prisma.project.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new Error('Project not found');
    }

    return prisma.project.delete({
      where: { id },
    });
  }
}
