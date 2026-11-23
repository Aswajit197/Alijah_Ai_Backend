import { Router } from 'express';
import { InternalController } from './internal.controller.js';
import { requireServiceToken, resolveInternalTenant } from './internal.auth.js';

export const internalRoutes = Router();

// 1. Service-to-service token verification
internalRoutes.use(requireServiceToken);

// 2. Health Check
internalRoutes.get('/health', InternalController.health);

// 3. Global Tenant Discovery (Called by Retell voice-service when inbound call rings)
internalRoutes.get('/tenants/by-phone/:e164', InternalController.getTenantByPhone);

// 4. Tenant-Scoped Routes
internalRoutes.use(resolveInternalTenant);

// Scheduling & Service Coverage
internalRoutes.get('/service-areas/check', InternalController.checkServiceArea);
internalRoutes.get('/availability', InternalController.getAvailability);

// Caller Addresses & Disambiguation (from operations-service)
internalRoutes.post('/caller-addresses/lookup', InternalController.lookupCallerAddresses);
internalRoutes.post('/caller-addresses', InternalController.saveCallerAddress);

// Follow-Up Timing Settings (from operations-service)
internalRoutes.get('/follow-up-settings', InternalController.getFollowUpSettings);
internalRoutes.put('/follow-up-settings', InternalController.updateFollowUpSettings);

// Technician Mid-Job Check-Ins (from operations-service)
internalRoutes.post('/technician-check-ins', InternalController.recordTechnicianCheckIn);
internalRoutes.get('/technician-check-ins', InternalController.listTechnicianCheckIns);

// Service Areas Management
internalRoutes.get('/service-areas', InternalController.listServiceAreas);
internalRoutes.post('/service-areas', InternalController.createServiceArea);
internalRoutes.delete('/service-areas/:serviceAreaId', InternalController.deleteServiceArea);

// Customers
internalRoutes.get('/customers/by-phone/:phone', InternalController.getCustomerByPhone);
internalRoutes.get('/customers/:id', InternalController.getCustomerById);
internalRoutes.post('/customers', InternalController.upsertCustomer);

// Technicians
internalRoutes.get('/technicians', InternalController.listTechnicians);
internalRoutes.get('/technicians/on-call', InternalController.listOnCall);

// Jobs & Dispatch
internalRoutes.post('/jobs', InternalController.createJob);
internalRoutes.get('/jobs/:jobId/technician-recommendations', InternalController.recommendTechnicians);
internalRoutes.put('/jobs/:jobId/assignment', InternalController.assignTechnician);
internalRoutes.delete('/jobs/:jobId/assignment', InternalController.unassignTechnician);
internalRoutes.post('/jobs/:jobId/status', InternalController.updateJobStatus);

// Quotes & Pricing
internalRoutes.post('/jobs/:jobId/quotes', InternalController.createQuote);
internalRoutes.post('/jobs/:jobId/quotes/:quoteId/decision', InternalController.decideQuote);
internalRoutes.get('/service-categories', InternalController.listServiceCategories);
internalRoutes.get('/estimates', InternalController.getEstimate);

// Feedback, Policy, Invoices, Messages, Photos
internalRoutes.post('/jobs/:jobId/feedback', InternalController.recordFeedback);
internalRoutes.post('/jobs/:jobId/photos', InternalController.uploadPhoto);
internalRoutes.get('/jobs/:jobId/photos/:photoId', InternalController.getPhoto);
internalRoutes.post('/policy/check', InternalController.checkPolicy);
internalRoutes.post('/invoices', InternalController.createInvoice);
internalRoutes.post('/invoices/:id/send', InternalController.sendInvoice);
internalRoutes.post('/invoices/:id/payments', InternalController.recordPayment);
internalRoutes.post('/invoices/:id/dispute', InternalController.disputeInvoice);
internalRoutes.post('/messages', InternalController.sendMessage);
