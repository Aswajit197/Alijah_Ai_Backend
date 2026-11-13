export interface PermissionDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
}

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  // Navigation & Core
  { id: 'view_home', name: 'View Home Dashboard', category: 'General', description: 'Access to role-specific dashboard' },
  { id: 'view_inbox', name: 'View Unified Inbox', category: 'Inbox', description: 'View calls, SMS, and email threads' },
  { id: 'inbox_reply', name: 'Reply in Inbox', category: 'Inbox', description: 'Send messages or reply to customers directly' },
  { id: 'inbox_takeover', name: 'Takeover from AI', category: 'Inbox', description: 'Pause Elijah and take manual control of conversation' },
  { id: 'view_recordings', name: 'Listen to Call Audio', category: 'Inbox', description: 'Listen to recorded inbound/outbound calls' },

  // Customers & Properties
  { id: 'view_customers', name: 'View Customers', category: 'Customers', description: 'Access customer records and history' },
  { id: 'edit_customers', name: 'Create & Edit Customers', category: 'Customers', description: 'Update customer details, addresses, and equipment' },

  // Scheduling & Dispatch
  { id: 'view_leads', name: 'View Leads', category: 'Dispatch', description: 'View incoming unqualified leads' },
  { id: 'book_jobs', name: 'Book Appointments', category: 'Dispatch', description: 'Schedule new jobs on the calendar' },
  { id: 'dispatch_jobs', name: 'Dispatch & Assign Technicians', category: 'Dispatch', description: 'Assign jobs to technicians and manage lanes' },

  // Estimates & Sales
  { id: 'view_estimates', name: 'View Estimates', category: 'Estimating', description: 'View draft, sent, and approved estimates' },
  { id: 'edit_estimates', name: 'Create & Edit Estimates', category: 'Estimating', description: 'Draft proposals and edit line item pricing' },

  // Human Approval & Governance
  { id: 'approve_actions', name: 'Approve AI Actions', category: 'Needs You', description: 'Approve or override high-value/risk decisions' },
  { id: 'view_exceptions', name: 'View System Exceptions', category: 'Needs You', description: 'Access critical operational alerts and anomalies' },

  // Billing & Finance
  { id: 'view_financial', name: 'View Financial Metrics', category: 'Finance', description: 'View revenue totals and business KPIs' },
  { id: 'view_invoices', name: 'View Invoices', category: 'Finance', description: 'Access invoice records and payment history' },
  { id: 'manage_ar', name: 'Manage Accounts Receivable', category: 'Finance', description: 'Manage aging buckets and automated payment chasers' },
  { id: 'pay_actions', name: 'Trigger Payment Actions', category: 'Finance', description: 'Send payment links or charge cards' },

  // AI Workforce & Knowledge Lab
  { id: 'configure_ai', name: 'Configure AI Workforce', category: 'AI Team', description: 'Manage receptionist prompts, hours, and behaviors' },
  { id: 'run_lab', name: 'Run Simulation Lab', category: 'Simulation', description: 'Test Elijah with simulated calls and scenarios' },
  { id: 'view_knowledge', name: 'View Knowledge Base', category: 'Knowledge', description: 'Access company price sheets and FAQs' },
  { id: 'manage_knowledge', name: 'Manage Knowledge Base', category: 'Knowledge', description: 'Upload documents and edit trade policies' },
  { id: 'view_supervisor', name: 'View AI Supervisor', category: 'AI Team', description: 'Audit AI decisions, sentiment, and accuracy' },
  { id: 'pause_ai', name: 'Emergency Pause AI', category: 'AI Team', description: 'Kill switch to pause all autonomous AI actions' },

  // Field Technician Portal
  { id: 'tech_app', name: 'Mobile Technician App', category: 'Field', description: 'Access to mobile field job workflow and checklists' },

  // Projects & Workflow Recipes
  { id: 'view_projects', name: 'View Multi-Stage Projects', category: 'Projects', description: 'Track complex multi-day installation projects' },
  { id: 'manage_projects', name: 'Manage Projects', category: 'Projects', description: 'Update project stages, milestones, and assignments' },
  { id: 'view_workflows', name: 'View Follow-up Recipes', category: 'Workflows', description: 'Inspect automated text/email follow-up sequences' },
  { id: 'manage_workflows', name: 'Edit Follow-up Recipes', category: 'Workflows', description: 'Create and modify automated workflows' },

  // Administration & Audit
  { id: 'view_settings', name: 'View Settings', category: 'Settings', description: 'View company settings and service areas' },
  { id: 'manage_settings', name: 'Manage Company Settings', category: 'Settings', description: 'Edit company profile, integration apps, and billing' },
  { id: 'manage_roles', name: 'Manage Roles & Permissions', category: 'Settings', description: 'Create and edit custom dynamic roles' },
  { id: 'manage_users', name: 'Manage Team Members', category: 'Settings', description: 'Invite, deactivate, and assign roles to staff' },
  { id: 'view_audit', name: 'View Audit Log', category: 'Compliance', description: 'View complete immutable audit trail of all actions' },
  { id: 'view_results', name: 'View ROI & Analytics', category: 'Analytics', description: 'Access financial ROI and time saved metrics' }
];

export const PERMISSION_IDS = SYSTEM_PERMISSIONS.map(p => p.id);

