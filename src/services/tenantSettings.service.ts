import fs from 'fs';
import path from 'path';

export interface PromptVersionRecord {
  version: number;
  prompt: string;
  inboundGreeting: string;
  followUpGreeting: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface TenantSettings {
  dispatchPolicy: 'ALLOW' | 'RECOMMEND'; // ALLOW = Autonomous AI Dispatch, RECOMMEND = Human Dispatcher Triage
  invoiceApprovalThreshold: number; // in USD (default $5,000)
  emergencyPageTimeoutMinutes: number; // default 10 minutes
  autoDispatchEnabled: boolean;
  businessHoursStart: string; // e.g. "08:00"
  businessHoursEnd: string; // e.g. "18:00"
  agentMode: 'single' | 'separate';
  inboundGreeting: string;
  followUpGreeting: string;
  receptionistPrompt: string;
  promptVersions: PromptVersionRecord[];
}

export const DEFAULT_RECEPTIONIST_PROMPT = `# Role
You are Elijah, the AI assistant for {{business_name}}, a service company. Services we offer:
{{service_categories}}. Callers are homeowners, property managers and businesses.
Be warm, brief and clear. One question at a time. Never invent prices, times or policies.

# Which call is this
This call's purpose is "{{call_purpose}}".
- "inbound": someone called us. Follow "Inbound calls" below.
- "follow_up": we are calling a customer about a finished visit. Follow "Follow-up calls".
Your opening line has already been said; continue from it.

# Inbound calls
Work through these steps in order, one question at a time. Do not jump ahead: booking details
come only after the caller has heard the price and agreed to book.

1. Understand the problem. Ask one or two short questions (what is happening, where, since
   when). Decide which of our services it needs and use that service's key as trade in every tool.
2. Safety first:
   - Gas smell, sparks, smoke or burning: tell them to leave the building and call 911 or the gas
     company now. Do not book. Offer to have a person call back.
   - Water leaking: tell them to turn off the main water shutoff if they can.
   - No heating or cooling: ask once whether anyone elderly, an infant or medically vulnerable
     is in the home. If yes, treat it as an emergency.
3. Call find_customer once. If they are a returning customer, greet them by first name.
4. Which address: disambiguate customer addresses via PostgreSQL caller address records.
5. Service area: verify 5-digit ZIP against company service areas.
6. Price: quote visit or diagnostic fee ($129 standard diagnostic) and remind that the technician
   provides written on-site pricing before starting work.
7. Confirm mobile number for arrival tracking and dispatch updates.
8. Check technician availability and book verified appointment slot.`;

export const DEFAULT_INBOUND_GREETING = "Thanks for calling {{business_name}}, this is Elijah, the company's AI assistant. This call is recorded. How can I help?";
export const DEFAULT_FOLLOW_UP_GREETING = "Hi {{customer_first_name}}, this is Elijah from {{business_name}}. I'm calling about your recent visit with {{technician_name}}. Do you have a minute for two quick questions?";

const DEFAULT_SETTINGS: TenantSettings = {
  dispatchPolicy: 'ALLOW', // Default to autonomous AI dispatch
  invoiceApprovalThreshold: 5000,
  emergencyPageTimeoutMinutes: 10,
  autoDispatchEnabled: true,
  businessHoursStart: '08:00',
  businessHoursEnd: '18:00',
  agentMode: 'single',
  inboundGreeting: DEFAULT_INBOUND_GREETING,
  followUpGreeting: DEFAULT_FOLLOW_UP_GREETING,
  receptionistPrompt: DEFAULT_RECEPTIONIST_PROMPT,
  promptVersions: [
    {
      version: 1,
      prompt: DEFAULT_RECEPTIONIST_PROMPT,
      inboundGreeting: DEFAULT_INBOUND_GREETING,
      followUpGreeting: DEFAULT_FOLLOW_UP_GREETING,
      note: 'Production Baseline Prompt & Retell Telephony Setup',
      createdBy: 'setup',
      createdAt: '2026-11-20T10:00:00.000Z',
    },
  ],
};

// Storage file path
const DATA_DIR = path.resolve(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'tenant_settings.json');

class TenantSettingsStore {
  private cache: Record<string, TenantSettings> = {};

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(SETTINGS_FILE)) {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        this.cache = JSON.parse(raw);
      }
    } catch (err) {
      console.error('Failed to load tenant settings from disk:', err);
      this.cache = {};
    }
  }

  private saveToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save tenant settings to disk:', err);
    }
  }

  getSettings(tenantId: string): TenantSettings {
    if (!this.cache[tenantId]) {
      return { ...DEFAULT_SETTINGS };
    }
    return { ...DEFAULT_SETTINGS, ...this.cache[tenantId] };
  }

  updateSettings(tenantId: string, updates: Partial<TenantSettings>): TenantSettings {
    const current = this.getSettings(tenantId);
    const updated: TenantSettings = {
      ...current,
      ...updates,
      autoDispatchEnabled: (updates.dispatchPolicy || current.dispatchPolicy) === 'ALLOW',
    };
    this.cache[tenantId] = updated;
    this.saveToDisk();
    return updated;
  }

  savePrompt(
    tenantId: string,
    data: {
      prompt?: string;
      inboundGreeting?: string;
      followUpGreeting?: string;
      agentMode?: 'single' | 'separate';
      note?: string;
    },
    createdBy: string = 'user'
  ): { settings: TenantSettings; version: PromptVersionRecord } {
    const current = this.getSettings(tenantId);
    const versions = current.promptVersions || [];
    const nextVersionNum = versions.length > 0 ? Math.max(...versions.map((v) => v.version)) + 1 : 1;

    const newVersion: PromptVersionRecord = {
      version: nextVersionNum,
      prompt: data.prompt ?? current.receptionistPrompt,
      inboundGreeting: data.inboundGreeting ?? current.inboundGreeting,
      followUpGreeting: data.followUpGreeting ?? current.followUpGreeting,
      note: data.note || `Version ${nextVersionNum} deployed`,
      createdBy,
      createdAt: new Date().toISOString(),
    };

    const updated: TenantSettings = {
      ...current,
      receptionistPrompt: data.prompt ?? current.receptionistPrompt,
      inboundGreeting: data.inboundGreeting ?? current.inboundGreeting,
      followUpGreeting: data.followUpGreeting ?? current.followUpGreeting,
      agentMode: data.agentMode ?? current.agentMode,
      promptVersions: [newVersion, ...versions],
    };

    this.cache[tenantId] = updated;
    this.saveToDisk();
    return { settings: updated, version: newVersion };
  }

  restorePromptVersion(tenantId: string, versionNumber: number, createdBy: string = 'user'): TenantSettings {
    const current = this.getSettings(tenantId);
    const versions = current.promptVersions || [];
    const target = versions.find((v) => v.version === versionNumber);
    if (!target) {
      throw new Error(`Prompt version ${versionNumber} not found`);
    }

    const nextVersionNum = Math.max(...versions.map((v) => v.version)) + 1;
    const rollbackRecord: PromptVersionRecord = {
      version: nextVersionNum,
      prompt: target.prompt,
      inboundGreeting: target.inboundGreeting,
      followUpGreeting: target.followUpGreeting,
      note: `Rollback to Version ${versionNumber} ("${target.note}")`,
      createdBy,
      createdAt: new Date().toISOString(),
    };

    const updated: TenantSettings = {
      ...current,
      receptionistPrompt: target.prompt,
      inboundGreeting: target.inboundGreeting,
      followUpGreeting: target.followUpGreeting,
      promptVersions: [rollbackRecord, ...versions],
    };

    this.cache[tenantId] = updated;
    this.saveToDisk();
    return updated;
  }

  resetPromptToDefault(tenantId: string, createdBy: string = 'user'): TenantSettings {
    const current = this.getSettings(tenantId);
    const versions = current.promptVersions || [];
    const nextVersionNum = versions.length > 0 ? Math.max(...versions.map((v) => v.version)) + 1 : 1;

    const defaultRecord: PromptVersionRecord = {
      version: nextVersionNum,
      prompt: DEFAULT_RECEPTIONIST_PROMPT,
      inboundGreeting: DEFAULT_INBOUND_GREETING,
      followUpGreeting: DEFAULT_FOLLOW_UP_GREETING,
      note: 'Reset to Production Baseline Defaults',
      createdBy,
      createdAt: new Date().toISOString(),
    };

    const updated: TenantSettings = {
      ...current,
      receptionistPrompt: DEFAULT_RECEPTIONIST_PROMPT,
      inboundGreeting: DEFAULT_INBOUND_GREETING,
      followUpGreeting: DEFAULT_FOLLOW_UP_GREETING,
      agentMode: 'single',
      promptVersions: [defaultRecord, ...versions],
    };

    this.cache[tenantId] = updated;
    this.saveToDisk();
    return updated;
  }
}

export const TenantSettingsService = new TenantSettingsStore();
