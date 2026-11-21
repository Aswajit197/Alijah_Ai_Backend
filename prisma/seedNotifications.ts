import { prisma } from '../src/config/database.js';
import { NotificationType, NotificationPriority } from '@prisma/client';

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'vanguard-electric' } });
  if (!tenant) {
    console.log('Vanguard tenant not found');
    return;
  }

  // Clear existing if any
  await prisma.notification.deleteMany({ where: { tenantId: tenant.id } });

  const notifs = [
    {
      tenantId: tenant.id,
      type: NotificationType.EMERGENCY_LEAD,
      priority: NotificationPriority.URGENT,
      title: '🚨 Emergency Lead: JOB-2807',
      message: 'John TestDemo: Electrical panel sparking and burning smell at 123 Main St. Immediate triage needed.',
      link: '/schedule',
      entityType: 'JOB',
      isRead: false,
    },
    {
      tenantId: tenant.id,
      type: NotificationType.JOB_DISPATCH,
      priority: NotificationPriority.HIGH,
      title: 'Work Order Dispatched: JOB-7668',
      message: 'Dispatched to Aswajit Mohapatra — Michael Scott: AC stopped cooling, blowing warm air.',
      link: '/schedule',
      entityType: 'JOB',
      isRead: false,
    },
    {
      tenantId: tenant.id,
      type: NotificationType.TECH_STATUS_CHANGE,
      priority: NotificationPriority.NORMAL,
      title: 'Tech Aswajit Mohapatra is ON ROUTE',
      message: 'En route to 1725 E Camelback Rd for JOB-7668. Customer notified via live tracker SMS.',
      link: '/schedule',
      entityType: 'JOB',
      isRead: false,
    },
    {
      tenantId: tenant.id,
      type: NotificationType.DISPATCH_TIMEOUT,
      priority: NotificationPriority.HIGH,
      title: 'Elijah AI Auto-Reassignment: JOB-9009',
      message: 'Tek Chand was unavailable. Job automatically re-offered to Aswajit Mohapatra.',
      link: '/schedule',
      entityType: 'JOB',
      isRead: true,
    },
  ];

  for (const n of notifs) {
    await prisma.notification.create({ data: n });
  }

  console.log('Successfully created', notifs.length, 'sample notifications');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
