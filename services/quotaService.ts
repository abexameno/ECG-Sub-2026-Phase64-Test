import { SchoolConfigService } from './schoolConfigService.ts';

interface SchoolQuotaRecord {
  schoolId: string;
  monthlyLimit: number;
  consumed: number;
  lastResetDate: string;
}

const quotaStore = new Map<string, SchoolQuotaRecord>();

export const QuotaService = {
  getQuotaStatus(schoolId: string): { limit: number; consumed: number; remaining: number; allowed: boolean } {
    const school = SchoolConfigService.getSchoolProfile(schoolId);
    if (!school) {
      throw new Error(`Quota Error: Invalid school ID ${schoolId}`);
    }

    let record = quotaStore.get(schoolId);
    const now = new Date().toISOString().substring(0, 7); // YYYY-MM

    if (!record || record.lastResetDate !== now) {
      record = {
        schoolId,
        monthlyLimit: 500, // Default production monthly generation quota per school
        consumed: 0,
        lastResetDate: now,
      };
      quotaStore.set(schoolId, record);
    }

    const remaining = Math.max(0, record.monthlyLimit - record.consumed);
    return {
      limit: record.monthlyLimit,
      consumed: record.consumed,
      remaining,
      allowed: remaining > 0,
    };
  },

  consumeQuota(schoolId: string, amount: number = 1): boolean {
    const status = QuotaService.getQuotaStatus(schoolId);
    if (!status.allowed || status.remaining < amount) {
      throw new Error(`Quota Exceeded: School ${schoolId} has reached its monthly generation quota.`);
    }

    const record = quotaStore.get(schoolId)!;
    record.consumed += amount;
    quotaStore.set(schoolId, record);
    return true;
  },

  resetStore(): void {
    quotaStore.clear();
  }
};
