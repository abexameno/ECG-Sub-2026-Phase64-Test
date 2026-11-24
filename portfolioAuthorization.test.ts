import { describe, expect, it, beforeEach } from '@jest/globals';

/**
 * PHASE 20.1B — PORTFOLIO EXPORT AUTHORIZATION & AUDIT LEDGER TESTS
 * 
 * Verifies the programmatic and validation contracts of the portfolio merging, 
 * backend authorization rules, duplicate protections, and audit registry schemas.
 */

// Mock DB records for testing
const MOCK_DB: Record<string, any> = {
  'users/teacher_1/library/doc_1': { id: 'doc_1', title: 'Mathematics Lesson Plan', metadata: { contentType: 'lesson_plan', grade: 'Grade 3', subject: 'Mathematics', term: 'Term 1' } },
  'users/teacher_1/library/doc_2': { id: 'doc_2', title: 'English Lesson Notes', metadata: { contentType: 'lesson_notes', grade: 'Grade 3', subject: 'English', term: 'Term 1' } },
  'users/teacher_2/library/doc_3': { id: 'doc_3', title: 'CRE Scheme of Work', metadata: { contentType: 'scheme_of_work', grade: 'Grade 4', subject: 'CRE', term: 'Term 2' } },
  'users/independent_teacher/library/doc_4': { id: 'doc_4', title: 'Science Lesson Plan', metadata: { contentType: 'lesson_plan', grade: 'Grade 5', subject: 'Science', term: 'Term 1' } },
};

// Mock School memberships for testing
const MOCK_MEMBERSHIPS: Record<string, { userId: string; schoolId: string; status: string }[]> = {
  'teacher_1': [{ userId: 'teacher_1', schoolId: 'school_alpha', status: 'ACTIVE' }],
  'teacher_2': [{ userId: 'teacher_2', schoolId: 'school_beta', status: 'ACTIVE' }],
  'independent_teacher': [], // No active school memberships
};

class MockAuditRegistry {
  public exports: any[] = [];
  public count = 0;
  public simulateFailure = false;

  public async logExport(payload: {
    userId: string;
    schoolId: string;
    resourceIds: string[];
    resourceTypes: string[];
    grades: string[];
    subjects: string[];
    terms: string[];
  }) {
    if (this.simulateFailure) {
      throw new Error("Simulated Firestore write failure");
    }
    const id = `audit_exp_${Date.now()}_${++this.count}`;
    const record = {
      id,
      ...payload,
      resourceCount: payload.resourceIds.length,
      generatedAt: new Date().toISOString(),
      status: 'AUTHORIZED',
      creditsConsumed: 0
    };
    this.exports.push(record);
    return record;
  }
}

async function validateMergeExportEndpoint(
  req: { uid: string; body: { userId?: string; schoolId?: string; resourceCount?: number; resourceIds?: string[] } },
  auditRegistry: MockAuditRegistry
) {
  const { userId, schoolId, resourceCount, resourceIds } = req.body;
  const authenticatedUserId = req.uid;

  if (!authenticatedUserId) {
    return { status: 401, body: { error: "Unauthorized: No valid user authentication found." } };
  }

  if (userId && userId !== authenticatedUserId) {
    return { status: 403, body: { error: "Forbidden: You are not authorized to export another user's resources." } };
  }

  const activeUserId = authenticatedUserId;

  // Verify and derive schoolId context
  const activeMemberships = MOCK_MEMBERSHIPS[activeUserId] || [];
  const activeSchoolIds = activeMemberships.map(m => m.schoolId).filter(Boolean);

  let verifiedSchoolId = "";

  if (activeSchoolIds.length > 0) {
    if (schoolId) {
      // If a schoolId is supplied, verify the user actually belongs to it
      if (!activeSchoolIds.includes(schoolId)) {
        return { status: 403, body: { error: "Forbidden: You are not authorized for the requested school context." } };
      }
      verifiedSchoolId = schoolId;
    } else {
      // Default to their primary active membership school context
      verifiedSchoolId = activeSchoolIds[0];
    }
  } else {
    // User has no active school memberships (independent learner)
    if (schoolId) {
      return { status: 403, body: { error: "Forbidden: You have no active school memberships to authorize this school context." } };
    }
    verifiedSchoolId = "";
  }

  if (!resourceIds || !Array.isArray(resourceIds) || resourceIds.length === 0) {
    return { status: 400, body: { error: "Invalid request: At least one resource ID is required." } };
  }

  // Check duplicates
  const uniqueIds = new Set(resourceIds);
  if (uniqueIds.size !== resourceIds.length) {
    return { status: 400, body: { error: "Invalid request: Duplicate resource IDs are not permitted." } };
  }

  // Prevent oversized packages
  const MAX_PORTFOLIO_LIMIT = 50;
  if (resourceIds.length > MAX_PORTFOLIO_LIMIT) {
    return { status: 400, body: { error: `Invalid request: A portfolio cannot exceed a maximum of ${MAX_PORTFOLIO_LIMIT} resources.` } };
  }

  if (resourceCount && resourceCount !== resourceIds.length) {
    return { status: 400, body: { error: "Invalid request: Resource count mismatch." } };
  }

  const verifiedTypes = new Set<string>();
  const verifiedGrades = new Set<string>();
  const verifiedSubjects = new Set<string>();
  const verifiedTerms = new Set<string>();

  for (const itemId of resourceIds) {
    if (typeof itemId !== 'string' || !itemId.trim()) {
      return { status: 400, body: { error: "Invalid request: Malformed resource ID detected." } };
    }

    const path = `users/${activeUserId}/library/${itemId.trim()}`;
    const mockDoc = MOCK_DB[path];

    if (!mockDoc) {
      return { status: 404, body: { error: "These resources could not be verified for export. Please refresh your library and try again." } };
    }

    const cType = mockDoc.metadata?.contentType || 'unknown';
    const grade = mockDoc.metadata?.grade || 'unknown';
    const subject = mockDoc.metadata?.subject || 'unknown';
    const term = mockDoc.metadata?.term || 'unknown';

    verifiedTypes.add(cType);
    verifiedGrades.add(grade);
    verifiedSubjects.add(subject);
    verifiedTerms.add(term);
  }

  let auditRecord;
  try {
    auditRecord = await auditRegistry.logExport({
      userId: activeUserId,
      schoolId: verifiedSchoolId,
      resourceIds,
      resourceTypes: Array.from(verifiedTypes),
      grades: Array.from(verifiedGrades),
      subjects: Array.from(verifiedSubjects),
      terms: Array.from(verifiedTerms),
    });
  } catch (err) {
    return { status: 500, body: { error: "Internal error: Failed to record export audit trail. Generation aborted." } };
  }

  return {
    status: 200,
    body: {
      authorized: true,
      auditId: auditRecord.id,
      creditsConsumed: 0,
      message: "Resources validated and authorized for PDF packaging."
    }
  };
}

describe('Phase 20.1B: Portfolio PDF Merge Export Authorization & Audit Registry Tests', () => {
  let auditRegistry: MockAuditRegistry;

  beforeEach(() => {
    auditRegistry = new MockAuditRegistry();
  });

  it('TEST 1 — Unauthenticated request is rejected with 401', async () => {
    const req = {
      uid: '',
      body: { userId: 'teacher_1', resourceIds: ['doc_1'], resourceCount: 1 }
    };
    const res = await validateMergeExportEndpoint(req, auditRegistry);
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Unauthorized');
    expect(auditRegistry.exports.length).toBe(0);
  });

  it('TEST 2 — Cross-user forgery attempt is rejected with 403', async () => {
    const req = {
      uid: 'teacher_1',
      body: { userId: 'teacher_2', resourceIds: ['doc_3'], resourceCount: 1 }
    };
    const res = await validateMergeExportEndpoint(req, auditRegistry);
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Forbidden');
    expect(auditRegistry.exports.length).toBe(0);
  });

  it('TEST 3 — Invalid resource IDs (belonging to other user) are rejected with 404', async () => {
    const req = {
      uid: 'teacher_1',
      body: { userId: 'teacher_1', resourceIds: ['doc_3'], resourceCount: 1 } // doc_3 belongs to teacher_2
    };
    const res = await validateMergeExportEndpoint(req, auditRegistry);
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('could not be verified');
    expect(auditRegistry.exports.length).toBe(0);
  });

  it('TEST 4 — Valid resource list successfully logs audit record and returns authorized status', async () => {
    const req = {
      uid: 'teacher_1',
      body: { userId: 'teacher_1', schoolId: 'school_alpha', resourceIds: ['doc_1', 'doc_2'], resourceCount: 2 }
    };
    const res = await validateMergeExportEndpoint(req, auditRegistry);
    expect(res.status).toBe(200);
    expect(res.body.authorized).toBe(true);
    expect(res.body.auditId).toBeDefined();
    expect(res.body.creditsConsumed).toBe(0);

    expect(auditRegistry.exports.length).toBe(1);
    const log = auditRegistry.exports[0];
    expect(log.userId).toBe('teacher_1');
    expect(log.schoolId).toBe('school_alpha');
    expect(log.resourceIds).toEqual(['doc_1', 'doc_2']);
    expect(log.resourceCount).toBe(2);
    expect(log.resourceTypes).toContain('lesson_plan');
    expect(log.resourceTypes).toContain('lesson_notes');
    expect(log.grades).toEqual(['Grade 3']);
    expect(log.subjects).toContain('Mathematics');
    expect(log.subjects).toContain('English');
    expect(log.status).toBe('AUTHORIZED');
  });

  it('TEST 5 — Duplicate resource IDs are rejected with 400', async () => {
    const req = {
      uid: 'teacher_1',
      body: { userId: 'teacher_1', resourceIds: ['doc_1', 'doc_1'], resourceCount: 2 }
    };
    const res = await validateMergeExportEndpoint(req, auditRegistry);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Duplicate resource IDs');
    expect(auditRegistry.exports.length).toBe(0);
  });

  it('TEST 6 — Resource count mismatch is rejected with 400', async () => {
    const req = {
      uid: 'teacher_1',
      body: { userId: 'teacher_1', resourceIds: ['doc_1', 'doc_2'], resourceCount: 5 }
    };
    const res = await validateMergeExportEndpoint(req, auditRegistry);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Resource count mismatch');
    expect(auditRegistry.exports.length).toBe(0);
  });

  it('TEST 7 — Portfolio limit exceeding max threshold (50) is rejected with 400', async () => {
    const largeResourceIds = Array.from({ length: 55 }).map((_, i) => `doc_${i}`);
    const req = {
      uid: 'teacher_1',
      body: { userId: 'teacher_1', resourceIds: largeResourceIds, resourceCount: 55 }
    };
    const res = await validateMergeExportEndpoint(req, auditRegistry);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('A portfolio cannot exceed a maximum of');
    expect(auditRegistry.exports.length).toBe(0);
  });

  it('TEST 8 — Valid authenticated user + valid active school → 200', async () => {
    const req = {
      uid: 'teacher_1',
      body: { userId: 'teacher_1', schoolId: 'school_alpha', resourceIds: ['doc_1'], resourceCount: 1 }
    };
    const res = await validateMergeExportEndpoint(req, auditRegistry);
    expect(res.status).toBe(200);
    expect(res.body.authorized).toBe(true);
    expect(auditRegistry.exports[0].schoolId).toBe('school_alpha');
  });

  it('TEST 9 — Authenticated user attempts to submit forged/unauthorized schoolId → 403', async () => {
    const req = {
      uid: 'teacher_1',
      body: { userId: 'teacher_1', schoolId: 'unauthorized_school_id', resourceIds: ['doc_1'], resourceCount: 1 }
    };
    const res = await validateMergeExportEndpoint(req, auditRegistry);
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('not authorized for the requested school context');
    expect(auditRegistry.exports.length).toBe(0);
  });

  it('TEST 10 — Authenticated user with no active school memberships defaults to individual (empty schoolId)', async () => {
    const req = {
      uid: 'independent_teacher',
      body: { userId: 'independent_teacher', schoolId: '', resourceIds: ['doc_4'], resourceCount: 1 }
    };

    const res = await validateMergeExportEndpoint(req, auditRegistry);
    expect(res.status).toBe(200);
    expect(res.body.authorized).toBe(true);
    expect(auditRegistry.exports[0].schoolId).toBe('');
  });

  it('TEST 11 — Client-supplied schoolId cannot override the verified school context if independent', async () => {
    const req = {
      uid: 'independent_teacher',
      body: { userId: 'independent_teacher', schoolId: 'school_alpha', resourceIds: ['doc_4'], resourceCount: 1 }
    };
    const res = await validateMergeExportEndpoint(req, auditRegistry);
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('no active school memberships to authorize this school context');
    expect(auditRegistry.exports.length).toBe(0);
  });

  it('TEST 12 — Simulated audit write failure → authorization fails closed (HTTP 500)', async () => {
    auditRegistry.simulateFailure = true;
    const req = {
      uid: 'teacher_1',
      body: { userId: 'teacher_1', schoolId: 'school_alpha', resourceIds: ['doc_1'], resourceCount: 1 }
    };
    const res = await validateMergeExportEndpoint(req, auditRegistry);
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Failed to record export audit trail');
    expect(res.body.authorized).toBeUndefined(); // Compilation must NOT proceed
    expect(auditRegistry.exports.length).toBe(0);
  });
});
