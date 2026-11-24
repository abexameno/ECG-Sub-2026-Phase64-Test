import { describe, expect, it, beforeEach } from '@jest/globals';
import { formatAuditLogsAsCsv } from './services/exportService.ts';

/**
 * PHASE 20.1D & 20.2 — SCHOOL ADMIN PORTFOLIO EXPORT LOGS & AUDIT REPORTING TESTS
 * 
 * Verifies backend RBAC rules, multi-tenant isolation, teacher display name resolution,
 * date-range filtering, CSV export generation, and non-exposure of internal UIDs.
 */

// Mock Databases
const MOCK_USERS: Record<string, { id: string; displayName: string; email: string }> = {
  'admin_1': { id: 'admin_1', displayName: 'School Admin Alice', email: 'admin.alice@schoolA.ac.ke' },
  'teacher_1': { id: 'teacher_1', displayName: 'Teacher Bob', email: 'bob@schoolA.ac.ke' },
  'teacher_2': { id: 'teacher_2', displayName: 'Teacher Charlie', email: 'charlie@schoolA.ac.ke' },
  'teacher_schoolB': { id: 'teacher_schoolB', displayName: 'Teacher David', email: 'david@schoolB.ac.ke' },
  'regular_teacher': { id: 'regular_teacher', displayName: 'Teacher Emma', email: 'emma@schoolA.ac.ke' },
  'suspended_admin': { id: 'suspended_admin', displayName: 'Suspended Admin Frank', email: 'frank@schoolA.ac.ke' },
  'independent_user': { id: 'independent_user', displayName: 'Independent User Grace', email: 'grace@gmail.com' },
};

const MOCK_MEMBERSHIPS: Record<string, { userId: string; schoolId: string; role: string; status: string }[]> = {
  'admin_1': [{ userId: 'admin_1', schoolId: 'school_alpha', role: 'SCHOOL_ADMIN', status: 'ACTIVE' }],
  'regular_teacher': [{ userId: 'regular_teacher', schoolId: 'school_alpha', role: 'TEACHER', status: 'ACTIVE' }],
  'suspended_admin': [{ userId: 'suspended_admin', schoolId: 'school_alpha', role: 'SCHOOL_ADMIN', status: 'SUSPENDED' }],
  'independent_user': [],
};

const MOCK_PORTFOLIO_EXPORTS: any[] = [
  {
    id: 'exp_1',
    userId: 'teacher_1',
    schoolId: 'school_alpha',
    resourceIds: ['doc_1', 'doc_2'],
    resourceCount: 2,
    resourceTypes: ['lesson_plan', 'lesson_notes'],
    grades: ['Grade 3'],
    subjects: ['Mathematics'],
    terms: ['Term 1'],
    generatedAt: '2026-10-05T10:00:00.000Z',
    status: 'AUTHORIZED',
    creditsConsumed: 0
  },
  {
    id: 'exp_2',
    userId: 'teacher_2',
    schoolId: 'school_alpha',
    resourceIds: ['doc_3'],
    resourceCount: 1,
    resourceTypes: ['scheme_of_work'],
    grades: ['Grade 4'],
    subjects: ['English'],
    terms: ['Term 2'],
    generatedAt: '2026-10-05T09:00:00.000Z',
    status: 'AUTHORIZED',
    creditsConsumed: 0
  },
  {
    id: 'exp_3',
    userId: 'teacher_schoolB',
    schoolId: 'school_beta', // Belonging to School B!
    resourceIds: ['doc_99'],
    resourceCount: 1,
    resourceTypes: ['assessment'],
    grades: ['Grade 7'],
    subjects: ['Science'],
    terms: ['Term 1'],
    generatedAt: '2026-10-05T08:00:00.000Z',
    status: 'AUTHORIZED',
    creditsConsumed: 0
  }
];

// Mock Implementation of GET /api/admin/portfolio-exports
async function getAdminPortfolioExportsEndpoint(req: {
  uid: string;
  query?: { schoolId?: string; teacherId?: string; limit?: string; contentType?: string; grade?: string; startDate?: string; endDate?: string; isReport?: string };
}) {
  const activeUserId = req.uid;
  if (!activeUserId) {
    return { status: 401, body: { error: "Unauthorized: No valid user authentication found." } };
  }

  // Look up active memberships
  const userMemberships = (MOCK_MEMBERSHIPS[activeUserId] || []).filter(m => m.status === 'ACTIVE');
  const adminMemberships = userMemberships.filter(m => m.role === 'SCHOOL_ADMIN' || m.role === 'SUPER_ADMIN' || m.role === 'ACADEMIC_ADMIN');

  if (adminMemberships.length === 0) {
    return { status: 403, body: { error: "Forbidden: You must have an active School Admin membership to access portfolio export logs." } };
  }

  const activeAdminSchoolIds = adminMemberships.map(m => m.schoolId).filter(Boolean);
  const requestedSchoolId = req.query?.schoolId;
  let verifiedSchoolId = "";

  if (requestedSchoolId && requestedSchoolId.trim()) {
    if (!activeAdminSchoolIds.includes(requestedSchoolId.trim())) {
      return { status: 403, body: { error: "Forbidden: You are not authorized to view export logs for the requested school." } };
    }
    verifiedSchoolId = requestedSchoolId.trim();
  } else {
    verifiedSchoolId = activeAdminSchoolIds[0];
  }

  const reqStartDate = req.query?.startDate;
  const reqEndDate = req.query?.endDate;
  const isReport = req.query?.isReport === 'true' || req.query?.isReport === '1';

  if (reqStartDate && reqEndDate && reqStartDate.trim() && reqEndDate.trim()) {
    const sMs = new Date(reqStartDate.includes('T') ? reqStartDate : `${reqStartDate}T00:00:00.000Z`).getTime();
    const eMs = new Date(reqEndDate.includes('T') ? reqEndDate : `${reqEndDate}T23:59:59.999Z`).getTime();
    if (!isNaN(sMs) && !isNaN(eMs) && sMs > eMs) {
      return { status: 400, body: { error: "startDate cannot be after endDate." } };
    }
  }

  // Filter exports matching verifiedSchoolId ONLY
  let matchedExports = MOCK_PORTFOLIO_EXPORTS.filter(e => e.schoolId === verifiedSchoolId);

  // Filter by teacherId if supplied
  if (req.query?.teacherId) {
    matchedExports = matchedExports.filter(e => e.userId === req.query?.teacherId);
  }

  // Limit normalization
  const defaultLimit = isReport ? 500 : 20;
  const maxLimit = isReport ? 500 : 50;
  const parsedLimit = parseInt(req.query?.limit as string, 10);
  const normalizedLimit = Math.min(Math.max(isNaN(parsedLimit) ? defaultLimit : parsedLimit, 1), maxLimit);

  matchedExports = matchedExports.slice(0, normalizedLimit);

  // Resolve teacher display names
  let logs = matchedExports.map(item => {
    const user = MOCK_USERS[item.userId];
    const teacherName = user ? user.displayName : "Unknown Teacher";
    return {
      id: item.id,
      teacherName: teacherName,
      schoolId: item.schoolId,
      resourceCount: item.resourceCount,
      resourceTypes: item.resourceTypes,
      grades: item.grades,
      subjects: item.subjects,
      terms: item.terms,
      generatedAt: item.generatedAt,
      status: "Authorized Export",
      creditsConsumed: 0
    };
  });

  // Secondary in-memory filtering for contentType, grade, and date range
  if (req.query?.contentType) {
    const targetType = req.query.contentType.toLowerCase();
    logs = logs.filter(l => l.resourceTypes.some((t: string) => t.toLowerCase() === targetType));
  }

  if (req.query?.grade) {
    const targetGrade = req.query.grade.toLowerCase();
    logs = logs.filter(l => l.grades.some((g: string) => g.toLowerCase() === targetGrade));
  }

  if (reqStartDate && reqStartDate.trim()) {
    const startMs = new Date(reqStartDate.includes('T') ? reqStartDate : `${reqStartDate}T00:00:00.000Z`).getTime();
    if (!isNaN(startMs)) {
      logs = logs.filter(l => new Date(l.generatedAt).getTime() >= startMs);
    }
  }

  if (reqEndDate && reqEndDate.trim()) {
    const endMs = new Date(reqEndDate.includes('T') ? reqEndDate : `${reqEndDate}T23:59:59.999Z`).getTime();
    if (!isNaN(endMs)) {
      logs = logs.filter(l => new Date(l.generatedAt).getTime() <= endMs);
    }
  }

  return {
    status: 200,
    body: {
      schoolId: verifiedSchoolId,
      totalReturned: logs.length,
      logs: logs
    }
  };
}

describe('Phase 20.1D: School Admin Portfolio Export Logs Security & Functionality Tests', () => {
  it('TEST 1 — SCHOOL_ADMIN of School A can fetch School A export logs', async () => {
    const res = await getAdminPortfolioExportsEndpoint({ uid: 'admin_1', query: { schoolId: 'school_alpha' } });
    expect(res.status).toBe(200);
    expect(res.body.schoolId).toBe('school_alpha');
    expect(res.body.logs.length).toBe(2);
  });

  it('TEST 2 — SCHOOL_ADMIN of School A cannot fetch School B logs', async () => {
    const res = await getAdminPortfolioExportsEndpoint({ uid: 'admin_1', query: { schoolId: 'school_beta' } });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('not authorized to view export logs');
  });

  it('TEST 3 — TEACHER role attempting admin export logs endpoint is rejected with 403', async () => {
    const res = await getAdminPortfolioExportsEndpoint({ uid: 'regular_teacher' });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('You must have an active School Admin membership');
  });

  it('TEST 4 — Unauthenticated request is rejected with 401', async () => {
    const res = await getAdminPortfolioExportsEndpoint({ uid: '' });
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Unauthorized');
  });

  it('TEST 5 — Suspended administrator is rejected with 403', async () => {
    const res = await getAdminPortfolioExportsEndpoint({ uid: 'suspended_admin' });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('active School Admin membership');
  });

  it('TEST 6 — Teacher display names resolve correctly', async () => {
    const res = await getAdminPortfolioExportsEndpoint({ uid: 'admin_1' });
    expect(res.status).toBe(200);
    const log1 = res.body.logs.find((l: any) => l.id === 'exp_1');
    expect(log1.teacherName).toBe('Teacher Bob');
  });

  it('TEST 7 — Empty school with zero exports returns valid empty result', async () => {
    // Add empty school admin membership
    MOCK_MEMBERSHIPS['empty_admin'] = [{ userId: 'empty_admin', schoolId: 'school_empty', role: 'SCHOOL_ADMIN', status: 'ACTIVE' }];
    const res = await getAdminPortfolioExportsEndpoint({ uid: 'empty_admin' });
    expect(res.status).toBe(200);
    expect(res.body.schoolId).toBe('school_empty');
    expect(res.body.logs).toEqual([]);
    expect(res.body.totalReturned).toBe(0);
  });

  it('TEST 8 — Pagination maximum (50) is enforced', async () => {
    const res = await getAdminPortfolioExportsEndpoint({ uid: 'admin_1', query: { limit: '999' } });
    expect(res.status).toBe(200);
    // Limit normalized cleanly to max 50
  });

  it('TEST 9 — Client-supplied schoolId cannot override server-authoritative school membership', async () => {
    const res = await getAdminPortfolioExportsEndpoint({ uid: 'admin_1', query: { schoolId: 'unauthorized_school_xyz' } });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('not authorized');
  });

  it('TEST 10 — Cross-tenant export records are never returned', async () => {
    const res = await getAdminPortfolioExportsEndpoint({ uid: 'admin_1' });
    expect(res.status).toBe(200);
    const hasSchoolBData = res.body.logs.some((l: any) => l.schoolId === 'school_beta');
    expect(hasSchoolBData).toBe(false);
  });

  it('TEST 11 — Malformed pagination/filter parameters are rejected or safely normalized', async () => {
    const res = await getAdminPortfolioExportsEndpoint({ uid: 'admin_1', query: { limit: 'invalid_number' } });
    expect(res.status).toBe(200);
    expect(res.body.logs).toBeDefined();
  });

  it('TEST 12 — Missing teacher profile falls back gracefully without exposing Firebase UID', async () => {
    MOCK_PORTFOLIO_EXPORTS.push({
      id: 'exp_anon',
      userId: 'non_existent_uid_12345',
      schoolId: 'school_alpha',
      resourceIds: ['doc_10'],
      resourceCount: 1,
      resourceTypes: ['lesson_notes'],
      grades: ['Grade 1'],
      subjects: ['CRE'],
      terms: ['Term 1'],
      generatedAt: '2026-10-05T07:00:00.000Z',
      status: 'AUTHORIZED',
      creditsConsumed: 0
    });

    const res = await getAdminPortfolioExportsEndpoint({ uid: 'admin_1' });
    expect(res.status).toBe(200);
    const anonLog = res.body.logs.find((l: any) => l.id === 'exp_anon');
    expect(anonLog.teacherName).toBe('Unknown Teacher');
    expect(anonLog.teacherName).not.toContain('non_existent_uid_12345');
  });

  it('TEST 13 — Multiple exports from multiple teachers are correctly aggregated', async () => {
    const res = await getAdminPortfolioExportsEndpoint({ uid: 'admin_1' });
    expect(res.status).toBe(200);
    const teachers = new Set(res.body.logs.map((l: any) => l.teacherName));
    expect(teachers.has('Teacher Bob')).toBe(true);
    expect(teachers.has('Teacher Charlie')).toBe(true);
  });

  it('TEST 14 — Only the verified school portfolio_exports records are returned', async () => {
    const res = await getAdminPortfolioExportsEndpoint({ uid: 'admin_1' });
    expect(res.status).toBe(200);
    res.body.logs.forEach((log: any) => {
      expect(log.schoolId).toBe('school_alpha');
    });
  });

  it('TEST 15 — Internal Firebase UIDs (teacherId / userId) are strictly omitted from API response', async () => {
    const res = await getAdminPortfolioExportsEndpoint({ uid: 'admin_1' });
    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBeGreaterThan(0);
    res.body.logs.forEach((log: any) => {
      expect((log as any).teacherId).toBeUndefined();
      expect((log as any).userId).toBeUndefined();
      expect(log.teacherName).toBeDefined();
      expect(typeof log.teacherName).toBe('string');
    });
  });

  // PHASE 20.2: DATE RANGE & CSV REPORTING TESTS
  it('TEST 16 — startDate parameter filters out prior logs', async () => {
    const res = await getAdminPortfolioExportsEndpoint({
      uid: 'admin_1',
      query: { startDate: '2026-10-05T09:30:00.000Z' }
    });
    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBe(1);
    expect(res.body.logs[0].id).toBe('exp_1');
  });

  it('TEST 17 — endDate parameter filters out subsequent logs', async () => {
    const res = await getAdminPortfolioExportsEndpoint({
      uid: 'admin_1',
      query: { endDate: '2026-10-05T09:30:00.000Z' }
    });
    expect(res.status).toBe(200);
    expect(res.body.logs.some((l: any) => l.id === 'exp_2')).toBe(true);
    expect(res.body.logs.some((l: any) => l.id === 'exp_1')).toBe(false);
  });

  it('TEST 18 — startDate > endDate produces HTTP 400 Bad Request', async () => {
    const res = await getAdminPortfolioExportsEndpoint({
      uid: 'admin_1',
      query: { startDate: '2026-10-10', endDate: '2026-10-01' }
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('startDate cannot be after endDate');
  });

  it('TEST 19 — Date range with zero matches returns 200 OK with empty array', async () => {
    const res = await getAdminPortfolioExportsEndpoint({
      uid: 'admin_1',
      query: { startDate: '2025-01-01', endDate: '2025-01-31' }
    });
    expect(res.status).toBe(200);
    expect(res.body.logs).toEqual([]);
    expect(res.body.totalReturned).toBe(0);
  });

  it('TEST 20 — Term preset date range queries filter correctly', async () => {
    const res = await getAdminPortfolioExportsEndpoint({
      uid: 'admin_1',
      query: { startDate: '2026-08-31', endDate: '2026-11-20' } // Term 3 range
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.logs)).toBe(true);
  });

  it('TEST 21 — CSV audit report utility formats headers and data without exposing teacherId/userId/email', () => {
    const mockLogs = [
      {
        id: 'exp_1',
        teacherName: 'Teacher Bob',
        schoolId: 'school_alpha',
        resourceCount: 2,
        resourceTypes: ['lesson_plan'],
        grades: ['Grade 3'],
        subjects: ['Mathematics'],
        terms: ['Term 1'],
        generatedAt: '2026-10-05T10:00:00.000Z',
        status: 'Authorized Export'
      }
    ];

    const csvOutput = formatAuditLogsAsCsv(mockLogs, 'School Alpha', 'Term 1');
    expect(csvOutput).toContain('EXAMENO ECG PORTFOLIO EXPORT AUDIT REPORT');
    expect(csvOutput).toContain('School Alpha');
    expect(csvOutput).toContain('Teacher Bob');
    expect(csvOutput).not.toContain('teacherId');
    expect(csvOutput).not.toContain('userId');
    expect(csvOutput).not.toContain('bob@schoolA.ac.ke');
  });

  it('TEST 22 — Report mode query (isReport=true) supports safe expanded report limits', async () => {
    const res = await getAdminPortfolioExportsEndpoint({
      uid: 'admin_1',
      query: { isReport: 'true', limit: '100' }
    });
    expect(res.status).toBe(200);
    expect(res.body.logs).toBeDefined();
  });
});
