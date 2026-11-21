import fs from 'fs';
import path from 'path';

export interface TenantSettings {
  dispatchPolicy: 'ALLOW' | 'RECOMMEND'; // ALLOW = Autonomous AI Dispatch, RECOMMEND = Human Dispatcher Triage
  invoiceApprovalThreshold: number; // in USD (default $5,000)
  emergencyPageTimeoutMinutes: number; // default 10 minutes
  autoDispatchEnabled: boolean;
  businessHoursStart: string; // e.g. "08:00"
  businessHoursEnd: string; // e.g. "18:00"
}

const DEFAULT_SETTINGS: TenantSettings = {
  dispatchPolicy: 'ALLOW', // Default to autonomous AI dispatch
  invoiceApprovalThreshold: 5000,
  emergencyPageTimeoutMinutes: 10,
  autoDispatchEnabled: true,
  businessHoursStart: '08:00',
  businessHoursEnd: '18:00',
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
}

export const TenantSettingsService = new TenantSettingsStore();
