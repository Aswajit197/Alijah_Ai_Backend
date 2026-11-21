import { prisma } from '../src/config/database.js';
import { SuperAdminNotificationType, SuperAdminAlertSeverity } from '@prisma/client';

async function main() {
  await prisma.superAdminNotification.deleteMany({});

  const sampleAlerts = [
    {
      type: SuperAdminNotificationType.TENANT_CREATED,
      severity: SuperAdminAlertSeverity.INFO,
      title: 'New Company Onboarded: Apex Climate Solutions',
      message: 'Onboarded on GROWTH plan with code \'apex-climate\'. Setup invite dispatched to contact@apexclimate.com.',
      tenantSlug: 'apex-climate',
      link: '/tenants',
      isRead: false,
    },
    {
      type: SuperAdminNotificationType.INVITE_ACCEPTED,
      severity: SuperAdminAlertSeverity.INFO,
      title: '🎉 Owner Activated: Aswajit Mohapatra',
      message: 'Aswajit Mohapatra (amohapatra@pods365.com) completed onboarding & activated Vanguard Electric & Power.',
      tenantSlug: 'vanguard-electric',
      link: '/tenants',
      isRead: false,
    },
    {
      type: SuperAdminNotificationType.USAGE_QUOTA_ALERT,
      severity: SuperAdminAlertSeverity.WARNING,
      title: '⚠️ Voice Quota Alert: Desert Air HVAC',
      message: 'Desert Air HVAC has consumed 88% of their allocated AI voice dispatch minutes for the current billing cycle.',
      tenantSlug: 'desert-air',
      link: '/tenants',
      isRead: false,
    },
    {
      type: SuperAdminNotificationType.SYSTEM_ALERT,
      severity: SuperAdminAlertSeverity.INFO,
      title: 'AI Service Gateway Auto-Scaled',
      message: 'Workflow and voice orchestrator nodes expanded capacity to handle peak dispatch operations.',
      link: '/dashboard',
      isRead: true,
    },
  ];

  for (const alert of sampleAlerts) {
    await prisma.superAdminNotification.create({ data: alert });
  }

  console.log('Successfully seeded', sampleAlerts.length, 'SuperAdmin platform notifications');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
