import { Request, Response } from 'express';
import { z } from 'zod';
import { CustomerService } from './customer.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';

const equipmentSchema = z.object({
  name: z.string().min(2, 'Equipment name is required'),
  type: z.string().optional(),
  brand: z.string().min(1, 'Brand is required'),
  modelNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  installYear: z.number().int().optional(),
  locationOnSite: z.string().optional(),
  warrantyStatus: z.string().optional(),
  notes: z.string().optional(),
});

const createCustomerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  customerType: z.enum(['RESIDENTIAL', 'COMMERCIAL']).optional(),
  companyName: z.string().optional(),
  phone: z.string().min(7, 'Valid phone number is required'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  gateCode: z.string().optional(),
  accessNotes: z.string().optional(),
  initialEquipment: equipmentSchema.optional(),
});

const updateCustomerSchema = z.object({
  name: z.string().min(2).optional(),
  customerType: z.enum(['RESIDENTIAL', 'COMMERCIAL']).optional(),
  companyName: z.string().optional(),
  phone: z.string().min(7).optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  gateCode: z.string().optional(),
  accessNotes: z.string().optional(),
});

export class CustomerController {
  /**
   * List customers for the active tenant.
   */
  static async list(req: Request, res: Response) {
    try {
      const search = req.query.search as string | undefined;
      const type = req.query.type as string | undefined;
      const customers = await CustomerService.listCustomers(req.tenantId!, search, type);
      return successResponse(res, customers);
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  }

  /**
   * Get single customer by ID.
   */
  static async getById(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const customer = await CustomerService.getCustomerById(req.tenantId!, id);
      return successResponse(res, customer);
    } catch (err: any) {
      return errorResponse(res, err.message, 404);
    }
  }

  /**
   * Create a new customer.
   */
  static async create(req: Request, res: Response) {
    try {
      const data = createCustomerSchema.parse(req.body);
      const result = await CustomerService.createCustomer(req.tenantId!, {
        ...data,
        email: data.email || undefined,
      });
      return successResponse(res, result, 'Customer created successfully', 201);
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  /**
   * Update customer profile.
   */
  static async update(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const data = updateCustomerSchema.parse(req.body);
      const updated = await CustomerService.updateCustomer(req.tenantId!, id, {
        ...data,
        email: data.email || undefined,
      });
      return successResponse(res, updated, 'Customer updated successfully');
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  /**
   * Delete customer.
   */
  static async delete(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      await CustomerService.deleteCustomer(req.tenantId!, id);
      return successResponse(res, null, 'Customer deleted');
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  /**
   * Add equipment to a customer.
   */
  static async addEquipment(req: Request, res: Response) {
    try {
      const customerId = String(req.params.id);
      const data = equipmentSchema.parse(req.body);
      const equipment = await CustomerService.addEquipment(req.tenantId!, customerId, data);
      return successResponse(res, equipment, 'Equipment added successfully', 201);
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  /**
   * Update equipment details.
   */
  static async updateEquipment(req: Request, res: Response) {
    try {
      const equipmentId = String(req.params.equipmentId);
      const data = equipmentSchema.partial().parse(req.body);
      const updated = await CustomerService.updateEquipment(req.tenantId!, equipmentId, data);
      return successResponse(res, updated, 'Equipment updated successfully');
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }

  /**
   * Delete equipment unit.
   */
  static async deleteEquipment(req: Request, res: Response) {
    try {
      const equipmentId = String(req.params.equipmentId);
      await CustomerService.deleteEquipment(req.tenantId!, equipmentId);
      return successResponse(res, null, 'Equipment deleted');
    } catch (err: any) {
      return errorResponse(res, err.message, 400);
    }
  }
}
