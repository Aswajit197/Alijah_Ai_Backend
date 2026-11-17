import { prisma } from '../../config/database.js';

export interface CreateEquipmentInput {
  name: string;
  type?: string;
  brand: string;
  modelNumber?: string;
  serialNumber?: string;
  installYear?: number;
  locationOnSite?: string;
  warrantyStatus?: string;
  notes?: string;
}

export interface CreateCustomerInput {
  name: string;
  customerType?: 'RESIDENTIAL' | 'COMMERCIAL';
  companyName?: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  gateCode?: string;
  accessNotes?: string;
  initialEquipment?: CreateEquipmentInput;
}

export interface UpdateCustomerInput {
  name?: string;
  customerType?: 'RESIDENTIAL' | 'COMMERCIAL';
  companyName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  gateCode?: string;
  accessNotes?: string;
}

export class CustomerService {
  /**
   * Lists customers for a tenant with optional search query & type filter.
   */
  static async listCustomers(tenantId: string, search?: string, type?: string) {
    const where: any = { tenantId };

    if (type && type !== 'ALL') {
      where.customerType = type.toUpperCase();
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
        { companyName: { contains: q, mode: 'insensitive' } },
        {
          equipments: {
            some: {
              OR: [
                { serialNumber: { contains: q, mode: 'insensitive' } },
                { modelNumber: { contains: q, mode: 'insensitive' } },
                { brand: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        equipments: {
          select: {
            id: true,
            name: true,
            brand: true,
            type: true,
            modelNumber: true,
            serialNumber: true,
            warrantyStatus: true,
            locationOnSite: true,
          },
        },
        _count: {
          select: {
            jobs: true,
            equipments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return customers;
  }

  /**
   * Retrieves full details for a single customer.
   */
  static async getCustomerById(tenantId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      include: {
        equipments: {
          orderBy: { createdAt: 'desc' },
        },
        jobs: {
          include: {
            equipment: true,
            technician: {
              select: { id: true, name: true, phone: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    return customer;
  }

  /**
   * Creates a new customer with optional initial equipment.
   */
  static async createCustomer(tenantId: string, data: CreateCustomerInput) {
    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          tenantId,
          name: data.name,
          customerType: data.customerType || 'RESIDENTIAL',
          companyName: data.companyName,
          phone: data.phone,
          email: data.email,
          address: data.address,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          gateCode: data.gateCode,
          accessNotes: data.accessNotes,
        },
      });

      let equipment = null;
      if (data.initialEquipment && data.initialEquipment.name && data.initialEquipment.brand) {
        equipment = await tx.equipment.create({
          data: {
            tenantId,
            customerId: customer.id,
            name: data.initialEquipment.name,
            type: data.initialEquipment.type || 'HVAC',
            brand: data.initialEquipment.brand,
            modelNumber: data.initialEquipment.modelNumber,
            serialNumber: data.initialEquipment.serialNumber,
            installYear: data.initialEquipment.installYear,
            locationOnSite: data.initialEquipment.locationOnSite,
            warrantyStatus: data.initialEquipment.warrantyStatus || 'UNDER_WARRANTY',
            notes: data.initialEquipment.notes,
          },
        });
      }

      return {
        customer,
        equipment,
      };
    });
  }

  /**
   * Updates customer profile details.
   */
  static async updateCustomer(tenantId: string, customerId: string, data: UpdateCustomerInput) {
    const existing = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!existing) {
      throw new Error('Customer not found');
    }

    return prisma.customer.update({
      where: { id: customerId },
      data,
    });
  }

  /**
   * Deletes a customer and cascading relations.
   */
  static async deleteCustomer(tenantId: string, customerId: string) {
    const existing = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!existing) {
      throw new Error('Customer not found');
    }

    return prisma.customer.delete({
      where: { id: customerId },
    });
  }

  /**
   * Adds a new piece of equipment to a customer's record.
   */
  static async addEquipment(tenantId: string, customerId: string, data: CreateEquipmentInput) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    return prisma.equipment.create({
      data: {
        tenantId,
        customerId,
        name: data.name,
        type: data.type || 'HVAC',
        brand: data.brand,
        modelNumber: data.modelNumber,
        serialNumber: data.serialNumber,
        installYear: data.installYear,
        locationOnSite: data.locationOnSite,
        warrantyStatus: data.warrantyStatus || 'UNDER_WARRANTY',
        notes: data.notes,
      },
    });
  }

  /**
   * Updates an equipment record.
   */
  static async updateEquipment(tenantId: string, equipmentId: string, data: Partial<CreateEquipmentInput>) {
    const equipment = await prisma.equipment.findFirst({
      where: { id: equipmentId, tenantId },
    });

    if (!equipment) {
      throw new Error('Equipment not found');
    }

    return prisma.equipment.update({
      where: { id: equipmentId },
      data,
    });
  }

  /**
   * Deletes an equipment record.
   */
  static async deleteEquipment(tenantId: string, equipmentId: string) {
    const equipment = await prisma.equipment.findFirst({
      where: { id: equipmentId, tenantId },
    });

    if (!equipment) {
      throw new Error('Equipment not found');
    }

    return prisma.equipment.delete({
      where: { id: equipmentId },
    });
  }
}
