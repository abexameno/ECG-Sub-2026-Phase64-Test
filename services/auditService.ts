export type AuditEventType =
  | 'GENERATION_STARTED'
  | 'GENERATION_COMPLETED'
  | 'GENERATION_FAILED'
  | 'VALIDATION_FAILED'
  | 'ARTIFACT_CREATED'
  | 'ARTIFACT_UPDATED'
  | 'ARTIFACT_COPIED'
  | 'ARTIFACT_ARCHIVED'
  | 'QUOTA_EXCEEDED'
  | 'SECURITY_VIOLATION'
  | 'SCHOOL_CREATED'
  | 'MEMBERSHIP_REQUESTED'
  | 'MEMBERSHIP_APPROVED'
  | 'MEMBERSHIP_REJECTED'
  | 'MEMBERSHIP_SUSPENDED'
  | 'MEMBERSHIP_REMOVED'
  | 'MEMBERSHIP_ROLE_CHANGED'
  | 'SCHOOL_CONFIG_CHANGED'
  | 'TEACHING_CONFIG_CHANGED'
  | 'SCHOOL_SWITCHED'
  | 'UNAUTHORIZED_ACCESS_ATTEMPTED'
  | 'PDF_EXPORT'
  | 'PDF_MERGE_EXPORT'
  | 'SCHOOL_MERGED'
  | 'SCHOOL_DEACTIVATED'
  | 'SCHOOL_REACTIVATED'
  | 'MEMBERSHIPS_MIGRATED'
  | 'ADMIN_ACTION';

interface AuditLogEntry {
  eventId: string;
  timestamp: string;
  schoolId?: string;
  eventType: AuditEventType;
  action?: string;
  details: Record<string, unknown>;
}

const auditLogs: AuditLogEntry[] = [];

export const AuditService = {
  log(eventType: AuditEventType, schoolId?: string, details: Record<string, unknown> = {}): AuditLogEntry {
    const entry: AuditLogEntry = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      schoolId,
      eventType,
      action: (details.action as string) || eventType,
      details,
    };

    auditLogs.push(entry);
    // Keep max 1000 in memory
    if (auditLogs.length > 1000) {
      auditLogs.shift();
    }

    return entry;
  },

  getLogs(schoolId?: string): AuditLogEntry[] {
    if (!schoolId) return [...auditLogs];
    return auditLogs.filter(l => l.schoolId === schoolId);
  },

  getLogsForSchool(schoolId: string): AuditLogEntry[] {
    return this.getLogs(schoolId);
  },

  queryLogs(schoolId?: string): AuditLogEntry[] {
    return this.getLogs(schoolId);
  },

  clearLogs(): void {
    auditLogs.length = 0;
  }
};
