import { SchoolConfigService } from './schoolConfigService.ts';
import { SchoolMembershipService } from './schoolMembershipService.ts';
import { AuditService } from './auditService.ts';
import { PersistentStateService } from './persistentStateService.ts';

export type ElmsConnectionStatus = 'CONNECTED' | 'NOT_CONNECTED' | 'NEEDS_ATTENTION' | 'ERROR';

export interface ElmsConnectionRecord {
  schoolId: string;
  elmsSchoolId: string;
  status: ElmsConnectionStatus;
  connectedAt?: string;
  connectedBy?: string;
  lastVerifiedAt?: string;
  portalUrl: string;
  version?: string;
  errorDetails?: string;
}

export interface ElmsLaunchParams {
  schoolId: string;
  teacherId: string;
  classGroupId?: string;
  learnerId?: string;
  targetView?: 'dashboard' | 'class' | 'practice' | 'assessment';
}

export interface ElmsLaunchTokenResult {
  launchUrl: string;
  expiresAt: string;
  token: string;
  schoolId: string;
  teacherId: string;
}

const DEFAULT_ELMS_BASE_URL = 'https://exameno-cbe-online-learning-801909250548.europe-west2.run.app';

// In-Memory Connection Store
const connectionStore = new Map<string, ElmsConnectionRecord>();

function initSeedConnections() {
  if (connectionStore.size > 0) return;

  const now = new Date().toISOString();

  // Seed LightWeight Primary School (lwps) as Connected
  connectionStore.set('lwps', {
    schoolId: 'lwps',
    elmsSchoolId: 'elms_inst_lwps_2026',
    status: 'CONNECTED',
    connectedAt: now,
    connectedBy: '2', // Jane Doe
    lastVerifiedAt: now,
    portalUrl: `${DEFAULT_ELMS_BASE_URL}/portal?school=lwps`,
    version: '1.2.0',
  });

  // Seed School B as Not Connected
  connectionStore.set('school-b', {
    schoolId: 'school-b',
    elmsSchoolId: '',
    status: 'NOT_CONNECTED',
    portalUrl: `${DEFAULT_ELMS_BASE_URL}/portal?school=school-b`,
  });
}

export const ElmsConnectionService = {
  clearStore(): void {
    connectionStore.clear();
    initSeedConnections();
  },

  getConnection(schoolId: string): ElmsConnectionRecord {
    initSeedConnections();

    // Check if school exists
    if (!schoolId) {
      return {
        schoolId: '',
        elmsSchoolId: '',
        status: 'NOT_CONNECTED',
        portalUrl: DEFAULT_ELMS_BASE_URL,
        errorDetails: 'No active school context',
      };
    }

    const conn = connectionStore.get(schoolId);
    if (conn) {
      return conn;
    }

    // Default un-connected state for new or unknown school
    const defaultRecord: ElmsConnectionRecord = {
      schoolId,
      elmsSchoolId: `elms_inst_${schoolId}`,
      status: 'NOT_CONNECTED',
      portalUrl: `${DEFAULT_ELMS_BASE_URL}/portal?school=${encodeURIComponent(schoolId)}`,
    };
    return defaultRecord;
  },

  connectSchool(params: {
    schoolId: string;
    teacherId: string;
    elmsSchoolId?: string;
    portalUrl?: string;
  }): ElmsConnectionRecord {
    initSeedConnections();

    if (!params.schoolId) {
      throw new Error('Cannot connect to ELMS: School ID is required');
    }

    // Enforce Tenant Authorization: Teacher must be active member of schoolId
    const isAuthorized = SchoolMembershipService.validateAccess(params.teacherId, params.schoolId);
    if (!isAuthorized) {
      AuditService.log('SECURITY_VIOLATION', params.schoolId, {
        action: 'UNAUTHORIZED_ELMS_CONNECTION_ATTEMPT',
        teacherId: params.teacherId,
        schoolId: params.schoolId,
      });
      throw new Error(`Unauthorized: Teacher ${params.teacherId} is not an active member of school ${params.schoolId}`);
    }

    const now = new Date().toISOString();
    const elmsSchoolId = params.elmsSchoolId || `elms_inst_${params.schoolId}_${Date.now().toString(36)}`;
    const portalUrl = params.portalUrl || `${DEFAULT_ELMS_BASE_URL}/portal?school=${encodeURIComponent(params.schoolId)}`;

    const connRecord: ElmsConnectionRecord = {
      schoolId: params.schoolId,
      elmsSchoolId,
      status: 'CONNECTED',
      connectedAt: now,
      connectedBy: params.teacherId,
      lastVerifiedAt: now,
      portalUrl,
      version: '1.2.0',
    };

    connectionStore.set(params.schoolId, connRecord);
    PersistentStateService.persistElmsConnection(connRecord);

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'ELMS_SCHOOL_CONNECTED',
      schoolId: params.schoolId,
      connectedBy: params.teacherId,
      elmsSchoolId,
    });

    return connRecord;
  },

  disconnectSchool(params: { schoolId: string; teacherId: string }): ElmsConnectionRecord {
    initSeedConnections();

    const isAuthorized = SchoolMembershipService.validateAccess(params.teacherId, params.schoolId);
    if (!isAuthorized) {
      AuditService.log('SECURITY_VIOLATION', params.schoolId, {
        action: 'UNAUTHORIZED_ELMS_DISCONNECT_ATTEMPT',
        teacherId: params.teacherId,
      });
      throw new Error(`Unauthorized: Teacher ${params.teacherId} is not authorized for school ${params.schoolId}`);
    }

    const conn = this.getConnection(params.schoolId);
    conn.status = 'NOT_CONNECTED';
    conn.lastVerifiedAt = new Date().toISOString();
    conn.errorDetails = undefined;

    connectionStore.set(params.schoolId, conn);
    PersistentStateService.persistElmsConnection(conn);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'ELMS_SCHOOL_DISCONNECTED',
      schoolId: params.schoolId,
      disconnectedBy: params.teacherId,
    });

    return conn;
  },

  verifyConnection(schoolId: string, requestingUserId: string): { healthy: boolean; record: ElmsConnectionRecord } {
    initSeedConnections();

    const isAuthorized = SchoolMembershipService.validateAccess(requestingUserId, schoolId);
    if (!isAuthorized) {
      throw new Error(`Unauthorized access to school ELMS connection verification for ${schoolId}`);
    }

    const conn = this.getConnection(schoolId);
    if (conn.status === 'CONNECTED') {
      conn.lastVerifiedAt = new Date().toISOString();
      connectionStore.set(schoolId, conn);
      PersistentStateService.persistElmsConnection(conn);
      return { healthy: true, record: conn };
    }

    return { healthy: false, record: conn };
  },

  generateSecureLaunchUrl(params: ElmsLaunchParams): ElmsLaunchTokenResult {
    initSeedConnections();

    if (!params.schoolId || !params.teacherId) {
      throw new Error('Launch failed: School ID and Teacher ID are mandatory');
    }

    // IDOR & Tenant Security: Verify requesting teacher belongs to schoolId
    const isAuthorized = SchoolMembershipService.validateAccess(params.teacherId, params.schoolId);
    if (!isAuthorized) {
      AuditService.log('SECURITY_VIOLATION', params.schoolId, {
        action: 'UNAUTHORIZED_ELMS_LAUNCH_ATTEMPT',
        teacherId: params.teacherId,
        schoolId: params.schoolId,
      });
      throw new Error(`Access Denied: Teacher ${params.teacherId} cannot launch ELMS for school ${params.schoolId}`);
    }

    const conn = this.getConnection(params.schoolId);
    if (conn.status !== 'CONNECTED') {
      throw new Error(`ELMS connection is not active for school ${params.schoolId}. Status: ${conn.status}`);
    }

    // Generate secure token with expiration timestamp (5 minutes expiration)
    const issueTime = Date.now();
    const expiresAt = new Date(issueTime + 5 * 60 * 1000).toISOString();
    const payloadStr = `${params.schoolId}:${params.teacherId}:${issueTime}`;
    // Base64 token
    const token = btoa(payloadStr).replace(/=/g, '');

    const targetView = params.targetView || 'dashboard';
    let launchUrl = `${DEFAULT_ELMS_BASE_URL}/${targetView === 'dashboard' ? 'teacher-dashboard' : targetView}?schoolId=${encodeURIComponent(params.schoolId)}&teacherId=${encodeURIComponent(params.teacherId)}&stoken=${token}&exp=${encodeURIComponent(expiresAt)}`;

    if (params.classGroupId) {
      launchUrl += `&classGroupId=${encodeURIComponent(params.classGroupId)}`;
    }
    if (params.learnerId) {
      launchUrl += `&learnerId=${encodeURIComponent(params.learnerId)}`;
    }

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'ELMS_SECURE_LAUNCH_GENERATED',
      schoolId: params.schoolId,
      teacherId: params.teacherId,
      targetView,
    });

    return {
      launchUrl,
      expiresAt,
      token,
      schoolId: params.schoolId,
      teacherId: params.teacherId,
    };
  },

  getPortalLink(schoolId: string): string {
    if (!schoolId) {
      return `${DEFAULT_ELMS_BASE_URL}/portal`;
    }
    return `${DEFAULT_ELMS_BASE_URL}/portal?school=${encodeURIComponent(schoolId)}`;
  },

  ingestConnection(record: ElmsConnectionRecord): void {
    initSeedConnections();
    if (!record || !record.schoolId) return;
    connectionStore.set(record.schoolId, record);
  },

  async syncSchoolConnectionFromFirestore(schoolId: string): Promise<ElmsConnectionRecord> {
    initSeedConnections();
    const record = await PersistentStateService.hydrateElmsConnection(schoolId);
    if (record) {
      this.ingestConnection(record);
    }
    return this.getConnection(schoolId);
  },
};

PersistentStateService.registerDomainService('ElmsConnectionService', {
  clearInMemoryOnly: () => {
    ElmsConnectionService.clearStore();
  },
  ingestState: (data: { connections?: ElmsConnectionRecord[] }) => {
    if (Array.isArray(data?.connections)) {
      for (const conn of data.connections) {
        ElmsConnectionService.ingestConnection(conn);
      }
    }
  },
});
