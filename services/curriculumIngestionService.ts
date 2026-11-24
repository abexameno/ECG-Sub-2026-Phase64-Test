import { AuditService } from './auditService.ts';

export type CurriculumIngestionMode = 'CREATE' | 'NEW_VERSION';

export type CurriculumSourceType =
  | 'OFFICIAL_DOCUMENT'
  | 'OFFICIAL_DATASET'
  | 'STRUCTURED_IMPORT'
  | 'MANUAL_ENTRY'
  | 'OTHER';

export interface CurriculumSource {
  name: string;
  type: CurriculumSourceType;
  reference?: string;
  version?: string;
}

export interface LearningOutcomeInput {
  learningOutcomeId: string;
  statement: string;
}

export interface SubStrandInput {
  subStrandId: string;
  name: string;
  learningOutcomes: LearningOutcomeInput[];
}

export interface StrandInput {
  strandId: string;
  name: string;
  subStrands: SubStrandInput[];
}

export interface LearningAreaInput {
  learningAreaId: string;
  name: string;
  strands: StrandInput[];
}

export interface CurriculumGradeInput {
  gradeId: string;
  name: string;
  learningAreas: LearningAreaInput[];
}

export interface CurriculumIngestionRequest {
  curriculumId?: string;
  name: string;
  source: CurriculumSource;
  version: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  grades: CurriculumGradeInput[];
  ingestionMode: CurriculumIngestionMode;
}

export interface CurriculumIngestionError {
  code: string;
  message: string;
  path?: string;
  severity: 'ERROR';
}

export interface CurriculumIngestionWarning {
  code: string;
  message: string;
  path?: string;
  severity: 'WARNING';
}

export interface CurriculumIngestionResult {
  success: boolean;
  curriculumId?: string;
  version?: string;
  draftId?: string;
  status: 'CREATED' | 'DUPLICATE' | 'REJECTED';
  errors: CurriculumIngestionError[];
  warnings: CurriculumIngestionWarning[];
  statistics?: {
    grades: number;
    learningAreas: number;
    strands: number;
    subStrands: number;
    learningOutcomes: number;
  };
}

export type CurriculumLifecycleStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ACTIVE' | 'RETIRED' | 'REJECTED';

export interface PublishedCurriculumRecord {
  curriculumId: string;
  name: string;
  version: string;
  source: CurriculumSource;
  grades: CurriculumGradeInput[];
  status: CurriculumLifecycleStatus;
  createdAt: string;
  publishedAt?: string;
  retiredAt?: string;
}

// In-memory persistent store for ingested/published curricula
const curriculumStore = new Map<string, PublishedCurriculumRecord>();
let activeCurriculumVersionKey: string | null = null;

export const CurriculumIngestionService = {
  clearStore(): void {
    curriculumStore.clear();
    activeCurriculumVersionKey = null;
  },

  ingest(request: CurriculumIngestionRequest): CurriculumIngestionResult {
    const errors: CurriculumIngestionError[] = [];
    const warnings: CurriculumIngestionWarning[] = [];

    // 1. Basic field & metadata validation
    if (!request.name || request.name.trim() === '') {
      errors.push({ code: 'MISSING_CURRICULUM_NAME', message: 'Curriculum name is required.', severity: 'ERROR' });
    }
    if (!request.version || request.version.trim() === '') {
      errors.push({ code: 'MISSING_VERSION', message: 'Curriculum version is required.', severity: 'ERROR' });
    }
    if (!request.source || !request.source.name || !request.source.type) {
      errors.push({ code: 'INVALID_SOURCE', message: 'Valid source provenance is required.', severity: 'ERROR' });
    }
    if (!request.grades || request.grades.length === 0) {
      errors.push({ code: 'MISSING_GRADES', message: 'At least one grade level is required.', severity: 'ERROR' });
    }

    const curriculumId = request.curriculumId || `cur_${request.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${request.version}`;
    const versionKey = `${curriculumId}@@${request.version}`;

    // Idempotency check
    if (curriculumStore.has(versionKey)) {
      AuditService.log('SECURITY_VIOLATION', undefined, { action: 'DUPLICATE_INGESTION_ATTEMPT', versionKey });
      return {
        success: false,
        curriculumId,
        version: request.version,
        status: 'DUPLICATE',
        errors: [{ code: 'DUPLICATE_INGESTION', message: `Curriculum version ${request.version} already ingested.`, severity: 'ERROR' }],
        warnings: [],
      };
    }

    // 2. Hierarchy, orphan, and duplicate checks
    const gradeIds = new Set<string>();
    const learningAreaIds = new Set<string>();
    const strandIds = new Set<string>();
    const subStrandIds = new Set<string>();
    const outcomeIds = new Set<string>();

    let gradeCount = 0;
    let laCount = 0;
    let strandCount = 0;
    let subStrandCount = 0;
    let outcomeCount = 0;

    if (request.grades) {
      for (const grade of request.grades) {
        gradeCount++;
        if (!grade.gradeId || grade.gradeId.trim() === '') {
          errors.push({ code: 'MISSING_GRADE_ID', message: 'Grade ID is required.', path: `grades[${grade.name}]`, severity: 'ERROR' });
        } else if (gradeIds.has(grade.gradeId)) {
          errors.push({ code: 'DUPLICATE_GRADE_ID', message: `Duplicate grade ID: ${grade.gradeId}`, severity: 'ERROR' });
        } else {
          gradeIds.add(grade.gradeId);
        }

        if (!grade.learningAreas || grade.learningAreas.length === 0) {
          errors.push({ code: 'ORPHAN_GRADE', message: `Grade ${grade.name} has no learning areas.`, severity: 'ERROR' });
        } else {
          for (const la of grade.learningAreas) {
            laCount++;
            if (!la.learningAreaId || la.learningAreaId.trim() === '') {
              errors.push({ code: 'MISSING_LEARNING_AREA_ID', message: 'Learning area ID is required.', severity: 'ERROR' });
            } else if (learningAreaIds.has(la.learningAreaId)) {
              // Note: Same learning area might span multiple grades, but unique IDs per grade or global unique IDs
              learningAreaIds.add(la.learningAreaId);
            }

            if (!la.strands || la.strands.length === 0) {
              errors.push({ code: 'ORPHAN_LEARNING_AREA', message: `Learning area ${la.name} has no strands.`, severity: 'ERROR' });
            } else {
              for (const strand of la.strands) {
                strandCount++;
                if (!strand.strandId || strand.strandId.trim() === '') {
                  errors.push({ code: 'MISSING_STRAND_ID', message: 'Strand ID is required.', severity: 'ERROR' });
                } else if (strandIds.has(strand.strandId)) {
                  errors.push({ code: 'DUPLICATE_STRAND_ID', message: `Duplicate strand ID: ${strand.strandId}`, severity: 'ERROR' });
                } else {
                  strandIds.add(strand.strandId);
                }

                if (!strand.subStrands || strand.subStrands.length === 0) {
                  errors.push({ code: 'ORPHAN_STRAND', message: `Strand ${strand.name} has no sub-strands.`, severity: 'ERROR' });
                } else {
                  for (const ss of strand.subStrands) {
                    subStrandCount++;
                    if (!ss.subStrandId || ss.subStrandId.trim() === '') {
                      errors.push({ code: 'MISSING_SUB_STRAND_ID', message: 'Sub-strand ID is required.', severity: 'ERROR' });
                    } else if (subStrandIds.has(ss.subStrandId)) {
                      errors.push({ code: 'DUPLICATE_SUB_STRAND_ID', message: `Duplicate sub-strand ID: ${ss.subStrandId}`, severity: 'ERROR' });
                    } else {
                      subStrandIds.add(ss.subStrandId);
                    }

                    if (!ss.learningOutcomes || ss.learningOutcomes.length === 0) {
                      errors.push({ code: 'ORPHAN_SUB_STRAND', message: `Sub-strand ${ss.name} has no learning outcomes.`, severity: 'ERROR' });
                    } else {
                      for (const lo of ss.learningOutcomes) {
                        outcomeCount++;
                        if (!lo.learningOutcomeId || lo.learningOutcomeId.trim() === '') {
                          errors.push({ code: 'MISSING_LEARNING_OUTCOME_ID', message: 'Learning outcome ID is required.', severity: 'ERROR' });
                        } else if (outcomeIds.has(lo.learningOutcomeId)) {
                          errors.push({ code: 'DUPLICATE_LEARNING_OUTCOME_ID', message: `Duplicate learning outcome ID: ${lo.learningOutcomeId}`, severity: 'ERROR' });
                        } else {
                          outcomeIds.add(lo.learningOutcomeId);
                        }

                        if (!lo.statement || lo.statement.trim() === '') {
                          errors.push({ code: 'MISSING_LEARNING_OUTCOME_STATEMENT', message: 'Learning outcome statement cannot be blank.', severity: 'ERROR' });
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      AuditService.log('VALIDATION_FAILED', undefined, { curriculumId, version: request.version, errors });
      return {
        success: false,
        curriculumId,
        version: request.version,
        status: 'REJECTED',
        errors,
        warnings,
      };
    }

    // Save as DRAFT
    const record: PublishedCurriculumRecord = {
      curriculumId,
      name: request.name,
      version: request.version,
      source: request.source,
      grades: request.grades,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
    };

    curriculumStore.set(versionKey, record);
    AuditService.log('ARTIFACT_CREATED', undefined, { action: 'CURRICULUM_DRAFT_CREATED', curriculumId, version: request.version });

    return {
      success: true,
      curriculumId,
      version: request.version,
      draftId: versionKey,
      status: 'CREATED',
      errors: [],
      warnings: [],
      statistics: {
        grades: gradeCount,
        learningAreas: laCount,
        strands: strandCount,
        subStrands: subStrandCount,
        learningOutcomes: outcomeCount,
      },
    };
  },

  approve(curriculumId: string, version: string): boolean {
    const key = `${curriculumId}@@${version}`;
    const record = curriculumStore.get(key);
    if (!record) throw new Error(`Curriculum version not found: ${key}`);
    if (record.status !== 'DRAFT' && record.status !== 'UNDER_REVIEW') {
      throw new Error(`Cannot approve curriculum in status ${record.status}`);
    }
    record.status = 'APPROVED';
    AuditService.log('ARTIFACT_UPDATED', undefined, { action: 'CURRICULUM_APPROVED', curriculumId, version });
    return true;
  },

  publish(curriculumId: string, version: string): boolean {
    const key = `${curriculumId}@@${version}`;
    const record = curriculumStore.get(key);
    if (!record) throw new Error(`Curriculum version not found: ${key}`);
    if (record.status !== 'APPROVED') {
      throw new Error(`Curriculum must be APPROVED before publication. Current status: ${record.status}`);
    }
    record.status = 'PUBLISHED';
    record.publishedAt = new Date().toISOString();
    AuditService.log('ARTIFACT_UPDATED', undefined, { action: 'CURRICULUM_PUBLISHED', curriculumId, version });
    return true;
  },

  activate(curriculumId: string, version: string): boolean {
    const key = `${curriculumId}@@${version}`;
    const record = curriculumStore.get(key);
    if (!record) throw new Error(`Curriculum version not found: ${key}`);
    if (record.status !== 'PUBLISHED') {
      throw new Error(`Curriculum must be PUBLISHED before activation. Current status: ${record.status}`);
    }

    // Retire current active if any
    if (activeCurriculumVersionKey && curriculumStore.has(activeCurriculumVersionKey)) {
      const activeRec = curriculumStore.get(activeCurriculumVersionKey)!;
      activeRec.status = 'RETIRED';
      activeRec.retiredAt = new Date().toISOString();
    }

    record.status = 'ACTIVE';
    activeCurriculumVersionKey = key;
    AuditService.log('ARTIFACT_UPDATED', undefined, { action: 'CURRICULUM_ACTIVATED', curriculumId, version });
    return true;
  },

  getActiveCurriculum(): PublishedCurriculumRecord | undefined {
    if (!activeCurriculumVersionKey) return undefined;
    return curriculumStore.get(activeCurriculumVersionKey);
  },

  getRecord(curriculumId: string, version: string): PublishedCurriculumRecord | undefined {
    return curriculumStore.get(`${curriculumId}@@${version}`);
  }
};
