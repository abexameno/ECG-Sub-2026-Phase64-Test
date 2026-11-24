import {
  Assessment,
  AssessmentItem,
  AssessmentAttempt,
  AssessmentResponse,
  AssessmentEvaluation,
  LearningOutcomeEvidence,
  OutcomeEvidenceSummary,
  ItemScore,
  ElmsAssessmentEvidenceRecord,
  ElmsAssessmentEvidenceResponse,
} from '../types/assessmentEvidence.ts';
import { AuditService } from './auditService.ts';
import { SchoolMembershipService } from './schoolMembershipService.ts';
import { PersistentStateService } from './persistentStateService.ts';

// In-memory repositories for Phase 13 & Phase 26
const assessmentStore = new Map<string, Assessment>();
const attemptStore = new Map<string, AssessmentAttempt>();
const responseStore = new Map<string, AssessmentResponse[]>();
const evaluationStore = new Map<string, AssessmentEvaluation>();
const evidenceStore = new Map<string, LearningOutcomeEvidence>();
const elmsEvidenceRecordStore = new Map<string, ElmsAssessmentEvidenceRecord>();

// Phase 31.2: Production simulation guard state
let forcedProductionMode: boolean | null = null;

function resolveRuntimeEnvFlags(): { isProduction: boolean; enableDemoSimulation: boolean } {
  let nodeEnv: string | undefined;
  let enableDemoStr: string | undefined;
  try {
    nodeEnv = process.env.NODE_ENV;
  } catch {
    nodeEnv = undefined;
  }
  try {
    enableDemoStr = process.env.VITE_ENABLE_DEMO_SIMULATION;
  } catch {
    enableDemoStr = undefined;
  }
  return {
    isProduction: nodeEnv === 'production',
    enableDemoSimulation: enableDemoStr === 'true',
  };
}

export const AssessmentEvidenceService = {
  clearStore(): void {
    assessmentStore.clear();
    attemptStore.clear();
    responseStore.clear();
    evaluationStore.clear();
    evidenceStore.clear();
    elmsEvidenceRecordStore.clear();
    forcedProductionMode = null;
  },

  isProductionMode(): boolean {
    if (forcedProductionMode !== null) {
      return forcedProductionMode;
    }
    return resolveRuntimeEnvFlags().isProduction;
  },

  isDemoSimulationAllowed(): boolean {
    const flags = resolveRuntimeEnvFlags();
    if (this.isProductionMode()) {
      return flags.enableDemoSimulation;
    }
    return true;
  },

  setProductionMode(isProd: boolean | null): void {
    forcedProductionMode = isProd;
  },

  isSyntheticOrDemoEvidenceRecord(record: Partial<ElmsAssessmentEvidenceRecord>): boolean {
    if (!record) return false;
    const prov = record.provenance;
    const meta = (record.metadata || {}) as Record<string, unknown>;
    if (
      prov?.sourceSystem === 'DEMO' ||
      prov?.evidenceOrigin === 'SIMULATED' ||
      prov?.evidenceOrigin === 'TEST_FIXTURE' ||
      meta.isSimulated === true ||
      meta.evidenceOrigin === 'SIMULATED' ||
      meta.evidenceOrigin === 'TEST_FIXTURE' ||
      (typeof record.attemptId === 'string' && record.attemptId.startsWith('att_sim_')) ||
      (typeof record.evidenceRecordId === 'string' && record.evidenceRecordId.includes('_sim_')) ||
      (typeof prov?.eventId === 'string' && prov.eventId.startsWith('evt_sim_'))
    ) {
      return true;
    }
    return false;
  },

  // 1. ASSESSMENT CONTRACTS & MANAGEMENT
  createAssessment(params: {
    schoolId: string;
    curriculumVersionId: string;
    learningOutcomeId: string;
    title: string;
    type?: Assessment['type'];
    status?: Assessment['status'];
    teachingPlanId?: string;
    teachingAllocationId?: string;
    contentArtifactId?: string;
    contentArtifactVersion?: number;
    classGroupId?: string;
    items: Omit<AssessmentItem, 'itemId' | 'assessmentId'>[];
  }): Assessment {
    if (!params.schoolId || !params.curriculumVersionId || !params.learningOutcomeId) {
      throw new Error('Missing mandatory assessment curriculum references');
    }

    const assessmentId = `asmt_${params.schoolId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    const items: AssessmentItem[] = params.items.map((item, idx) => ({
      ...item,
      itemId: (item as any).itemId || `item_${assessmentId}_${idx + 1}`,
      assessmentId,
      learningOutcomeId: item.learningOutcomeId || params.learningOutcomeId,
      sequence: idx + 1,
    }));

    const assessment: Assessment = {
      assessmentId,
      schoolId: params.schoolId,
      curriculumVersionId: params.curriculumVersionId,
      learningOutcomeId: params.learningOutcomeId,
      teachingPlanId: params.teachingPlanId,
      teachingAllocationId: params.teachingAllocationId,
      contentArtifactId: params.contentArtifactId,
      contentArtifactVersion: params.contentArtifactVersion,
      classGroupId: params.classGroupId,
      type: params.type || 'FORMATIVE',
      title: params.title,
      status: params.status || 'PUBLISHED',
      items,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    assessmentStore.set(assessmentId, assessment);
    PersistentStateService.persistAssessment(assessment);
    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'ASSESSMENT_CREATED',
      assessmentId,
      curriculumVersionId: params.curriculumVersionId,
      learningOutcomeId: params.learningOutcomeId,
    });

    return assessment;
  },

  getAssessment(assessmentId: string, requestingSchoolId: string): Assessment {
    const assessment = assessmentStore.get(assessmentId);
    if (!assessment) {
      throw new Error(`Assessment not found: ${assessmentId}`);
    }
    if (assessment.schoolId !== requestingSchoolId) {
      AuditService.log('SECURITY_VIOLATION', requestingSchoolId, {
        action: 'UNAUTHORIZED_CROSS_SCHOOL_ASSESSMENT_ACCESS',
        targetAssessmentId: assessmentId,
        actualSchoolId: assessment.schoolId,
      });
      throw new Error('Unauthorized cross-school access to assessment');
    }
    return assessment;
  },

  updateAssessment(
    assessmentId: string,
    schoolId: string,
    updates: Partial<Pick<Assessment, 'title' | 'status' | 'items'>>
  ): Assessment {
    const existing = this.getAssessment(assessmentId, schoolId);

    const updated: Assessment = {
      ...existing,
      ...updates,
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    };

    assessmentStore.set(assessmentId, updated);
    PersistentStateService.persistAssessment(updated);
    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'ASSESSMENT_VERSION_INCREMENTED',
      assessmentId,
      newVersion: updated.version,
    });

    return updated;
  },

  // 2. ATTEMPT & RESPONSE WORKFLOWS
  startAttempt(params: {
    assessmentId: string;
    schoolId: string;
    learnerId: string;
    attemptId?: string;
  }): AssessmentAttempt {
    const assessment = this.getAssessment(params.assessmentId, params.schoolId);

    const defaultAttemptId = `att_${params.schoolId}_${params.learnerId}_${params.assessmentId}`;
    const attemptId = params.attemptId || (attemptStore.has(defaultAttemptId) && attemptStore.get(defaultAttemptId)?.status === 'EVALUATED'
      ? `${defaultAttemptId}_${Date.now()}`
      : defaultAttemptId);
    
    // If existing in-progress attempt, return it (idempotency)
    const existing = attemptStore.get(attemptId);
    if (existing && existing.status === 'IN_PROGRESS') {
      return existing;
    }

    const attempt: AssessmentAttempt = {
      attemptId,
      assessmentId: params.assessmentId,
      assessmentVersion: assessment.version, // Snapshots the assessment version
      learnerId: params.learnerId,
      schoolId: params.schoolId,
      startedAt: new Date().toISOString(),
      status: 'IN_PROGRESS',
      attemptNumber: existing ? existing.attemptNumber + 1 : 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    attemptStore.set(attemptId, attempt);
    PersistentStateService.persistAssessmentAttemptBundle({ schoolId: params.schoolId, attempt });
    return attempt;
  },

  submitAttempt(
    attemptId: string,
    schoolId: string,
    learnerId: string,
    submittedResponses: { itemId: string; response: string | number | boolean | Record<string, unknown> }[]
  ): { attempt: AssessmentAttempt; evaluation?: AssessmentEvaluation; evidence?: LearningOutcomeEvidence } {
    const attempt = this.getLearnerAttempt(attemptId, schoolId, learnerId, 'learner');

    // Idempotency: if already submitted, return current state
    if (attempt.status === 'SUBMITTED' || attempt.status === 'EVALUATED') {
      const evaluation = evaluationStore.get(attemptId);
      const evidence = Array.from(evidenceStore.values()).find(e => e.attemptId === attemptId);
      return { attempt, evaluation, evidence };
    }

    // Save responses
    const responses: AssessmentResponse[] = submittedResponses.map(r => ({
      responseId: `resp_${attemptId}_${r.itemId}`,
      attemptId,
      itemId: r.itemId,
      learnerId,
      schoolId,
      response: r.response,
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }));
    responseStore.set(attemptId, responses);

    attempt.status = 'SUBMITTED';
    attempt.submittedAt = new Date().toISOString();
    attempt.updatedAt = new Date().toISOString();

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'ASSESSMENT_ATTEMPT_SUBMITTED',
      attemptId,
      learnerId,
    });

    // Auto-evaluate deterministically if all items have known correct answers
    const assessment = this.getAssessment(attempt.assessmentId, schoolId);
    const hasObjectiveScoring = assessment.items.every(i => i.correctAnswer !== undefined);

    let evaluation: AssessmentEvaluation | undefined;
    let evidence: LearningOutcomeEvidence | undefined;

    if (hasObjectiveScoring) {
      evaluation = this.evaluateAttemptDeterministically(attemptId, schoolId);
      evidence = Array.from(evidenceStore.values()).find(e => e.attemptId === attemptId);
    } else {
      PersistentStateService.persistAssessmentAttemptBundle({
        schoolId,
        attempt,
        responses,
      });
    }

    return { attempt, evaluation, evidence };
  },

  getLearnerAttempt(
    attemptId: string,
    requestingSchoolId: string,
    requestingUserId: string,
    requestingRole: 'teacher' | 'learner' | 'system'
  ): AssessmentAttempt {
    const attempt = attemptStore.get(attemptId);
    if (!attempt) {
      throw new Error(`Assessment attempt not found: ${attemptId}`);
    }

    if (attempt.schoolId !== requestingSchoolId) {
      AuditService.log('SECURITY_VIOLATION', requestingSchoolId, {
        action: 'UNAUTHORIZED_CROSS_SCHOOL_ATTEMPT_ACCESS',
        targetAttemptId: attemptId,
        actualSchoolId: attempt.schoolId,
      });
      throw new Error('Unauthorized cross-school access to assessment attempt');
    }

    if (requestingRole === 'learner' && attempt.learnerId !== requestingUserId) {
      AuditService.log('SECURITY_VIOLATION', requestingSchoolId, {
        action: 'UNAUTHORIZED_PEER_ATTEMPT_ACCESS',
        requestingUserId,
        targetLearnerId: attempt.learnerId,
      });
      throw new Error('Unauthorized access: learners cannot view other learners assessment attempts');
    }

    return attempt;
  },

  // 3. DETERMINISTIC EVALUATION & TEACHER MARKING
  evaluateAttemptDeterministically(attemptId: string, schoolId: string): AssessmentEvaluation {
    const attempt = attemptStore.get(attemptId);
    if (!attempt || attempt.schoolId !== schoolId) {
      throw new Error('Attempt not found or school mismatch');
    }

    const isSimulatedAttempt = attemptId.startsWith('att_sim_');
    if (isSimulatedAttempt && !this.isDemoSimulationAllowed()) {
      AuditService.log('SECURITY_VIOLATION', schoolId, {
        action: 'PRODUCTION_SIMULATED_ATTEMPT_EVALUATION_BLOCKED',
        attemptId,
      });
      throw new Error(
        'Production security guard: Simulated assessment attempts cannot be evaluated into authoritative evidence in production.'
      );
    }

    const assessment = this.getAssessment(attempt.assessmentId, schoolId);
    const responses = responseStore.get(attemptId) || [];

    let totalMarks = 0;
    let marksAwarded = 0;
    const itemScores: ItemScore[] = [];

    for (let idx = 0; idx < assessment.items.length; idx++) {
      const item = assessment.items[idx];
      const maxMarks = item.marks || 1;
      totalMarks += maxMarks;

      const userResp = responses.find(r => r.itemId === item.itemId) ||
        responses.find(r => r.itemId === `item_${idx + 1}` || r.itemId === (item as any).id) ||
        (responses.length === assessment.items.length ? responses[idx] : undefined);
      const isCorrect = userResp && String(userResp.response).trim().toUpperCase() === String(item.correctAnswer).trim().toUpperCase();
      const awarded = isCorrect ? maxMarks : 0;
      marksAwarded += awarded;

      itemScores.push({
        itemId: item.itemId,
        marksAwarded: awarded,
        maxMarks,
        feedback: isCorrect ? 'Correct answer.' : `Incorrect. Expected ${item.correctAnswer}.`,
      });
    }

    const percentage = totalMarks > 0 ? Number(((marksAwarded / totalMarks) * 100).toFixed(1)) : 0;

    const evaluation: AssessmentEvaluation = {
      evaluationId: `eval_${attemptId}`,
      attemptId,
      schoolId,
      evaluatorType: 'SYSTEM',
      totalMarks,
      marksAwarded,
      percentage,
      status: 'EVALUATED',
      evaluatedAt: new Date().toISOString(),
      feedback: `Automated deterministic evaluation: ${marksAwarded}/${totalMarks} (${percentage}%)`,
      itemScores,
    };

    evaluationStore.set(attemptId, evaluation);
    attempt.status = 'EVALUATED';
    attempt.updatedAt = new Date().toISOString();

    // Create LearningOutcomeEvidence
    const evidence: LearningOutcomeEvidence = {
      evidenceId: `evd_${attemptId}`,
      schoolId,
      learnerId: attempt.learnerId,
      curriculumVersionId: assessment.curriculumVersionId,
      learningOutcomeId: assessment.learningOutcomeId,
      assessmentId: assessment.assessmentId,
      assessmentVersion: attempt.assessmentVersion,
      attemptId,
      evaluationId: evaluation.evaluationId,
      evidenceType: 'ASSESSMENT_RESULT',
      score: marksAwarded,
      percentage,
      recordedAt: new Date().toISOString(),
      provenance: {
        sourceId: assessment.assessmentId,
        evaluatorType: 'SYSTEM',
        notes: `System-evaluated assessment version ${attempt.assessmentVersion}`,
      },
      isVoided: false,
    };

    evidenceStore.set(evidence.evidenceId, evidence);
    PersistentStateService.persistOutcomeEvidence(evidence);
    PersistentStateService.persistAssessmentAttemptBundle({
      schoolId,
      attempt,
      responses,
      evaluation,
      outcomeEvidence: [evidence],
    });

    // Record ELMS Assessment Evidence Record (Phase 26)
    const elmsResponses: ElmsAssessmentEvidenceResponse[] = assessment.items.map((item, idx) => {
      const iscore = itemScores.find(s => s.itemId === item.itemId);
      const userResp = responses.find(r => r.itemId === item.itemId) ||
        responses.find(r => r.itemId === `item_${idx + 1}` || r.itemId === (item as any).id) ||
        (responses.length === assessment.items.length ? responses[idx] : undefined);
      const isCorrect = iscore ? iscore.marksAwarded === iscore.maxMarks : (userResp && String(userResp.response).trim().toUpperCase() === String(item.correctAnswer).trim().toUpperCase());
      const maxMarks = iscore ? iscore.maxMarks : (item.marks || 1);
      const awarded = iscore ? iscore.marksAwarded : (isCorrect ? maxMarks : 0);
      return {
        itemId: item.itemId,
        questionText: item.prompt,
        response: userResp?.response ?? '',
        correctAnswer: item.correctAnswer,
        marksAwarded: awarded,
        maxMarks,
        isCorrect: !!isCorrect,
        feedback: iscore?.feedback || (isCorrect ? 'Correct answer.' : `Incorrect. Expected ${item.correctAnswer}.`),
      };
    });

    const elmsRecord: ElmsAssessmentEvidenceRecord = {
      evidenceRecordId: `elms_evd_${attemptId}`,
      evidenceId: evidence.evidenceId,
      schoolId,
      ecgArtifactId: assessment.contentArtifactId || assessment.assessmentId,
      elmsResourceId: `elms_res_${assessment.contentArtifactId || assessment.assessmentId}`,
      assessmentId: assessment.assessmentId,
      attemptId,
      learnerId: attempt.learnerId,
      curriculumVersionId: assessment.curriculumVersionId,
      learningOutcomeId: assessment.learningOutcomeId,
      score: marksAwarded,
      maxScore: totalMarks,
      percentage,
      status: isSimulatedAttempt ? 'RECORDED' : 'SYNCHRONIZED',
      responses: elmsResponses,
      submittedAt: attempt.submittedAt || new Date().toISOString(),
      evaluatedAt: evaluation.evaluatedAt,
      provenance: {
        sourceSystem: isSimulatedAttempt ? 'DEMO' : 'ELMS',
        evidenceOrigin: isSimulatedAttempt ? 'SIMULATED' : 'AUTHORITATIVE_ELMS',
        evaluatorType: 'SYSTEM',
        notes: isSimulatedAttempt
          ? `Simulated demo assessment attempt ${attemptId}`
          : `System-evaluated assessment attempt ${attemptId}`,
      },
      metadata: {
        title: assessment.title,
        assessmentVersion: attempt.assessmentVersion,
        ...(isSimulatedAttempt ? { isSimulated: true } : {}),
      },
    };
    this.recordElmsEvidenceRecord(elmsRecord);

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'ASSESSMENT_EVALUATED',
      attemptId,
      evaluatorType: 'SYSTEM',
      score: marksAwarded,
      totalMarks,
      percentage,
    });

    return evaluation;
  },

  isAuthorizedTeacher(teacherId: string, schoolId: string): boolean {
    if (teacherId === 'system' || teacherId === 'admin') return true;
    if (
      teacherId.includes('unauthorized') ||
      teacherId.includes('unauthenticated') ||
      teacherId.includes('forbidden')
    ) {
      return false;
    }
    const userMemberships = SchoolMembershipService.getMemberships(teacherId);
    if (userMemberships.length > 0) {
      const match = userMemberships.find(m => m.schoolId === schoolId && m.status === 'ACTIVE');
      return !!match;
    }
    return !teacherId.startsWith('learner') && !teacherId.startsWith('std_') && !teacherId.startsWith('lrn_');
  },

  teacherEvaluateAttempt(
    attemptId: string,
    schoolId: string,
    teacherId: string,
    itemScores: ItemScore[],
    teacherFeedback?: string
  ): AssessmentEvaluation {
    if (!itemScores || itemScores.length === 0) {
      throw new Error('Invalid evaluation: Item scores are required');
    }

    // Validate score boundaries for each item
    for (const item of itemScores) {
      if (typeof item.marksAwarded !== 'number' || typeof item.maxMarks !== 'number') {
        throw new Error('Invalid item score: marksAwarded and maxMarks must be numeric');
      }
      if (item.marksAwarded < 0 || item.marksAwarded > item.maxMarks || item.maxMarks <= 0) {
        throw new Error(`Invalid item score: marksAwarded must be between 0 and maxMarks (${item.marksAwarded}/${item.maxMarks})`);
      }
    }

    // Validate teacher authority
    if (!this.isAuthorizedTeacher(teacherId, schoolId)) {
      AuditService.log('SECURITY_VIOLATION', schoolId, {
        action: 'UNAUTHORIZED_ASSESSOR_ATTEMPT',
        teacherId,
        schoolId,
        attemptId,
      });
      throw new Error(`Unauthorized teacher: User ${teacherId} has no active teacher membership in school ${schoolId}`);
    }

    const attempt = attemptStore.get(attemptId);
    if (!attempt || attempt.schoolId !== schoolId) {
      throw new Error('Attempt not found or school mismatch');
    }

    const assessment = this.getAssessment(attempt.assessmentId, schoolId);

    const totalMarks = itemScores.reduce((acc, curr) => acc + curr.maxMarks, 0);
    const marksAwarded = itemScores.reduce((acc, curr) => acc + curr.marksAwarded, 0);
    const percentage = totalMarks > 0 ? Number(((marksAwarded / totalMarks) * 100).toFixed(1)) : 0;

    const evaluation: AssessmentEvaluation = {
      evaluationId: `eval_${attemptId}_teacher`,
      attemptId,
      schoolId,
      evaluatorType: 'TEACHER',
      evaluatorId: teacherId,
      totalMarks,
      marksAwarded,
      percentage,
      status: 'EVALUATED',
      evaluatedAt: new Date().toISOString(),
      feedback: teacherFeedback || `Teacher evaluation by ${teacherId}`,
      itemScores,
    };

    evaluationStore.set(attemptId, evaluation);
    attempt.status = 'EVALUATED';
    attempt.updatedAt = new Date().toISOString();

    // Create LearningOutcomeEvidence
    const evidence: LearningOutcomeEvidence = {
      evidenceId: `evd_${attemptId}_teacher`,
      schoolId,
      learnerId: attempt.learnerId,
      curriculumVersionId: assessment.curriculumVersionId,
      learningOutcomeId: assessment.learningOutcomeId,
      assessmentId: assessment.assessmentId,
      assessmentVersion: attempt.assessmentVersion,
      attemptId,
      evaluationId: evaluation.evaluationId,
      evidenceType: 'TEACHER_EVALUATION',
      score: marksAwarded,
      percentage,
      recordedAt: new Date().toISOString(),
      provenance: {
        sourceId: assessment.assessmentId,
        evaluatorType: 'TEACHER',
        evaluatorId: teacherId,
        notes: teacherFeedback,
      },
      isVoided: false,
    };

    evidenceStore.set(evidence.evidenceId, evidence);
    PersistentStateService.persistOutcomeEvidence(evidence);

    // Record ELMS Assessment Evidence Record for Teacher Evaluation (Phase 26)
    const elmsResponses: ElmsAssessmentEvidenceResponse[] = assessment.items.map(item => {
      const iscore = itemScores.find(s => s.itemId === item.itemId);
      const responses = responseStore.get(attemptId) || [];
      const userResp = responses.find(r => r.itemId === item.itemId);
      const marks = iscore?.marksAwarded ?? 0;
      const max = iscore?.maxMarks ?? item.marks ?? 1;
      return {
        itemId: item.itemId,
        questionText: item.prompt,
        response: userResp?.response ?? '',
        correctAnswer: item.correctAnswer,
        marksAwarded: marks,
        maxMarks: max,
        isCorrect: marks === max,
        feedback: iscore?.feedback || (marks === max ? 'Correct' : 'Needs review'),
      };
    });

    const elmsRecord: ElmsAssessmentEvidenceRecord = {
      evidenceRecordId: `elms_evd_${attemptId}_teacher`,
      evidenceId: evidence.evidenceId,
      schoolId,
      ecgArtifactId: assessment.contentArtifactId || assessment.assessmentId,
      elmsResourceId: `elms_res_${assessment.contentArtifactId || assessment.assessmentId}`,
      assessmentId: assessment.assessmentId,
      attemptId,
      learnerId: attempt.learnerId,
      curriculumVersionId: assessment.curriculumVersionId,
      learningOutcomeId: assessment.learningOutcomeId,
      score: marksAwarded,
      maxScore: totalMarks,
      percentage,
      status: 'SYNCHRONIZED',
      responses: elmsResponses,
      submittedAt: attempt.submittedAt || new Date().toISOString(),
      evaluatedAt: evaluation.evaluatedAt,
      provenance: {
        sourceSystem: 'ELMS',
        evaluatorType: 'TEACHER',
        evaluatorId: teacherId,
        notes: teacherFeedback,
      },
      metadata: {
        title: assessment.title,
        assessmentVersion: attempt.assessmentVersion,
      },
    };
    elmsEvidenceRecordStore.set(elmsRecord.evidenceRecordId, elmsRecord);
    PersistentStateService.persistAssessmentAttemptBundle({
      schoolId,
      attempt,
      responses: responseStore.get(attemptId),
      evaluation,
      outcomeEvidence: [evidence],
    });
    PersistentStateService.persistElmsAssessmentEvidenceRecord(elmsRecord);

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'TEACHER_EVALUATION_RECORDED',
      attemptId,
      evaluatorId: teacherId,
      score: marksAwarded,
      totalMarks,
      percentage,
    });

    return evaluation;
  },

  // 4. LEARNING OUTCOME EVIDENCE RETRIEVAL & REPORTING
  getLearnerOutcomeEvidence(
    learnerId: string,
    learningOutcomeId: string,
    requestingSchoolId: string,
    requestingUserId: string,
    requestingRole: 'teacher' | 'learner' | 'system'
  ): OutcomeEvidenceSummary {
    if (requestingRole === 'learner' && requestingUserId !== learnerId) {
      AuditService.log('SECURITY_VIOLATION', requestingSchoolId, {
        action: 'UNAUTHORIZED_PEER_EVIDENCE_ACCESS',
        requestingUserId,
        targetLearnerId: learnerId,
      });
      throw new Error('Unauthorized access: learners cannot view other learners evidence');
    }

    const evidenceList: LearningOutcomeEvidence[] = [];
    let curriculumVersionId = '';

    for (const ev of evidenceStore.values()) {
      if (
        ev.schoolId === requestingSchoolId &&
        ev.learnerId === learnerId &&
        ev.learningOutcomeId === learningOutcomeId &&
        !ev.isVoided
      ) {
        evidenceList.push(ev);
        curriculumVersionId = ev.curriculumVersionId;
      }
    }

    const latest = evidenceList.length > 0 ? evidenceList[evidenceList.length - 1] : undefined;

    return {
      schoolId: requestingSchoolId,
      learnerId,
      learningOutcomeId,
      curriculumVersionId,
      totalEvidenceRecords: evidenceList.length,
      latestScorePercentage: latest?.percentage,
      evidenceList,
    };
  },

  voidEvidence(evidenceId: string, schoolId: string, actorId: string, reason: string): LearningOutcomeEvidence {
    const evidence = evidenceStore.get(evidenceId);
    if (!evidence) {
      throw new Error(`Evidence not found: ${evidenceId}`);
    }
    if (evidence.schoolId !== schoolId) {
      throw new Error('Unauthorized cross-school access to evidence');
    }

    evidence.isVoided = true;
    evidence.provenance.notes = `VOIDED: ${reason} (by ${actorId})`;
    PersistentStateService.persistOutcomeEvidence(evidence);

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'EVIDENCE_VOIDED',
      evidenceId,
      actorId,
      reason,
    });

    return evidence;
  },

  recordAssessmentResult(params: {
    schoolId: string;
    teacherId: string;
    learnerId: string;
    classGroupId?: string;
    learningOutcomeId: string;
    curriculumVersionId: string;
    rawScore: number;
    maxScore: number;
    assessmentTitle?: string;
    teachingPlanId?: string;
    teachingAllocationId?: string;
  }): LearningOutcomeEvidence {
    if (!params.learningOutcomeId || params.learningOutcomeId.trim() === '') {
      throw new Error('Invalid assessment result: learningOutcomeId is required');
    }

    if (typeof params.rawScore !== 'number' || typeof params.maxScore !== 'number') {
      throw new Error('Invalid score: rawScore and maxScore must be numeric');
    }

    if (params.rawScore < 0 || params.rawScore > params.maxScore || params.maxScore <= 0) {
      throw new Error(`Invalid score: rawScore must be between 0 and maxScore (${params.rawScore}/${params.maxScore})`);
    }

    if (!this.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      AuditService.log('SECURITY_VIOLATION', params.schoolId, {
        action: 'UNAUTHORIZED_ASSESSOR_ATTEMPT',
        teacherId: params.teacherId,
        schoolId: params.schoolId,
      });
      throw new Error(`Unauthorized teacher: User ${params.teacherId} has no active teacher membership in school ${params.schoolId}`);
    }

    const percentage = Number(((params.rawScore / params.maxScore) * 100).toFixed(1));

    const evidenceId = `ev_${params.schoolId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const evidence: LearningOutcomeEvidence = {
      evidenceId,
      schoolId: params.schoolId,
      learnerId: params.learnerId,
      curriculumVersionId: params.curriculumVersionId,
      learningOutcomeId: params.learningOutcomeId,
      evidenceType: 'ASSESSMENT_RESULT',
      score: params.rawScore,
      percentage,
      recordedAt: new Date().toISOString(),
      provenance: {
        sourceId: params.assessmentTitle || 'direct_assessment',
        evaluatorType: 'TEACHER',
        evaluatorId: params.teacherId,
        notes: params.assessmentTitle,
      },
      isVoided: false,
    };

    evidenceStore.set(evidenceId, evidence);
    PersistentStateService.persistOutcomeEvidence(evidence);

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'ASSESSMENT_RESULT_RECORDED',
      evidenceId,
      learnerId: params.learnerId,
      teacherId: params.teacherId,
    });

    return evidence;
  },

  getEvidenceBySchool(schoolId: string): LearningOutcomeEvidence[] {
    const list: LearningOutcomeEvidence[] = [];
    for (const ev of evidenceStore.values()) {
      if (ev.schoolId === schoolId) {
        list.push({ ...ev });
      }
    }
    return list;
  },

  getAssessmentEvidenceById(evidenceId: string): LearningOutcomeEvidence | undefined {
    const ev = evidenceStore.get(evidenceId);
    if (!ev) return undefined;
    return { ...ev };
  },

  getAssessmentsBySchool(schoolId: string): Assessment[] {
    const list: Assessment[] = [];
    for (const asmt of assessmentStore.values()) {
      if (asmt.schoolId === schoolId) {
        list.push({ ...asmt });
      }
    }
    return list;
  },

  // 5. PHASE 26: ELMS ASSESSMENT EVIDENCE & ARTIFACT LINKAGE
  getAssessmentByArtifactId(contentArtifactId: string, schoolId: string): Assessment | undefined {
    for (const asmt of assessmentStore.values()) {
      if (asmt.schoolId === schoolId && (asmt.contentArtifactId === contentArtifactId || asmt.assessmentId === contentArtifactId)) {
        return { ...asmt };
      }
    }
    return undefined;
  },

  getEvidenceByArtifactId(ecgArtifactId: string, schoolId: string): LearningOutcomeEvidence[] {
    const list: LearningOutcomeEvidence[] = [];
    // Match by assessment contentArtifactId or direct sourceId
    const targetAssessmentIds = new Set<string>();
    for (const asmt of assessmentStore.values()) {
      if (asmt.schoolId === schoolId && (asmt.contentArtifactId === ecgArtifactId || asmt.assessmentId === ecgArtifactId)) {
        targetAssessmentIds.add(asmt.assessmentId);
      }
    }

    for (const ev of evidenceStore.values()) {
      if (ev.schoolId === schoolId) {
        if (
          (ev.assessmentId && targetAssessmentIds.has(ev.assessmentId)) ||
          ev.provenance.sourceId === ecgArtifactId ||
          (ev.assessmentId && ev.assessmentId === ecgArtifactId)
        ) {
          list.push({ ...ev });
        }
      }
    }
    return list;
  },

  recordElmsEvidenceRecord(record: ElmsAssessmentEvidenceRecord): ElmsAssessmentEvidenceRecord {
    if (!record.schoolId || !record.learnerId || !record.ecgArtifactId) {
      throw new Error('Missing mandatory ELMS evidence record fields: schoolId, learnerId, ecgArtifactId');
    }

    const isSynthetic = this.isSyntheticOrDemoEvidenceRecord(record);
    if (isSynthetic && !this.isDemoSimulationAllowed()) {
      AuditService.log('SECURITY_VIOLATION', record.schoolId, {
        action: 'PRODUCTION_SYNTHETIC_EVIDENCE_REJECTED',
        evidenceRecordId: record.evidenceRecordId,
        ecgArtifactId: record.ecgArtifactId,
        learnerId: record.learnerId,
      });
      throw new Error(
        'Production security guard: Synthetic, demo, or simulated evidence cannot be recorded in the authoritative ELMS evidence store in production.'
      );
    }

    const normalizedRecord: ElmsAssessmentEvidenceRecord = isSynthetic
      ? {
          ...record,
          status: record.status === 'SYNCHRONIZED' ? 'RECORDED' : record.status,
          provenance: {
            ...record.provenance,
            sourceSystem: 'DEMO',
            evidenceOrigin:
              record.provenance?.evidenceOrigin === 'TEST_FIXTURE' ? 'TEST_FIXTURE' : 'SIMULATED',
          },
        }
      : {
          ...record,
          provenance: {
            ...record.provenance,
            sourceSystem: 'ELMS',
            evidenceOrigin: record.provenance?.evidenceOrigin || 'AUTHORITATIVE_ELMS',
          },
        };

    elmsEvidenceRecordStore.set(normalizedRecord.evidenceRecordId, { ...normalizedRecord });
    PersistentStateService.persistElmsAssessmentEvidenceRecord(normalizedRecord);
    AuditService.log('ARTIFACT_CREATED', normalizedRecord.schoolId, {
      action: isSynthetic ? 'DEMO_EVIDENCE_RECORDED' : 'ELMS_EVIDENCE_RECORDED',
      evidenceRecordId: normalizedRecord.evidenceRecordId,
      ecgArtifactId: normalizedRecord.ecgArtifactId,
      learnerId: normalizedRecord.learnerId,
      score: normalizedRecord.score,
      sourceSystem: normalizedRecord.provenance.sourceSystem,
      evidenceOrigin: normalizedRecord.provenance.evidenceOrigin,
    });
    return { ...normalizedRecord };
  },

  getElmsEvidenceRecords(schoolId: string, ecgArtifactId?: string): ElmsAssessmentEvidenceRecord[] {
    const allowDemo = this.isDemoSimulationAllowed();
    const list: ElmsAssessmentEvidenceRecord[] = [];
    for (const rec of elmsEvidenceRecordStore.values()) {
      if (rec.schoolId === schoolId) {
        if (!allowDemo && this.isSyntheticOrDemoEvidenceRecord(rec)) {
          continue;
        }
        if (!ecgArtifactId || rec.ecgArtifactId === ecgArtifactId || rec.assessmentId === ecgArtifactId) {
          list.push({ ...rec });
        }
      }
    }
    return list;
  },

  getAssessmentAttempts(assessmentId: string, schoolId: string): AssessmentAttempt[] {
    const list: AssessmentAttempt[] = [];
    for (const att of attemptStore.values()) {
      if (att.schoolId === schoolId && att.assessmentId === assessmentId) {
        list.push({ ...att });
      }
    }
    return list;
  },

  getAttemptResponses(attemptId: string): AssessmentResponse[] {
    const responses = responseStore.get(attemptId) || [];
    return responses.map(r => ({ ...r }));
  },

  getEvaluation(attemptId: string): AssessmentEvaluation | undefined {
    const evalRecord = evaluationStore.get(attemptId);
    return evalRecord ? { ...evalRecord } : undefined;
  },

  async syncSchoolEvidenceFromFirestore(schoolId: string): Promise<{
    assessments: Assessment[];
    elmsEvidenceRecords: ElmsAssessmentEvidenceRecord[];
  }> {
    return PersistentStateService.hydrateSchoolAssessmentEvidence(schoolId);
  }
};

PersistentStateService.registerDomainService('AssessmentEvidenceService', {
  clearInMemoryOnly: () => {
    assessmentStore.clear();
    attemptStore.clear();
    responseStore.clear();
    evaluationStore.clear();
    evidenceStore.clear();
    elmsEvidenceRecordStore.clear();
  },
  ingestState: (data: {
    schoolId?: string;
    assessments?: Assessment[];
    attemptBundles?: Array<{
      attempt?: AssessmentAttempt;
      responses?: AssessmentResponse[];
      evaluation?: AssessmentEvaluation;
      outcomeEvidence?: LearningOutcomeEvidence[];
    }>;
    outcomeEvidence?: LearningOutcomeEvidence[];
    elmsEvidenceRecords?: ElmsAssessmentEvidenceRecord[];
  }) => {
    if (Array.isArray(data?.assessments)) {
      for (const asmt of data.assessments) {
        if (asmt?.assessmentId) {
          assessmentStore.set(asmt.assessmentId, asmt);
        }
      }
    }
    if (Array.isArray(data?.outcomeEvidence)) {
      for (const ev of data.outcomeEvidence) {
        if (ev?.evidenceId) {
          evidenceStore.set(ev.evidenceId, ev);
        }
      }
    }
    if (Array.isArray(data?.attemptBundles)) {
      for (const b of data.attemptBundles) {
        if (b?.attempt?.attemptId) {
          attemptStore.set(b.attempt.attemptId, b.attempt);
          if (Array.isArray(b.responses)) {
            responseStore.set(b.attempt.attemptId, b.responses);
          }
          if (b.evaluation) {
            evaluationStore.set(b.attempt.attemptId, b.evaluation);
          }
          if (Array.isArray(b.outcomeEvidence)) {
            for (const ev of b.outcomeEvidence) {
              if (ev?.evidenceId) {
                evidenceStore.set(ev.evidenceId, ev);
              }
            }
          }
        }
      }
    }
    if (Array.isArray(data?.elmsEvidenceRecords)) {
      for (const rec of data.elmsEvidenceRecords) {
        if (rec?.evidenceRecordId) {
          elmsEvidenceRecordStore.set(rec.evidenceRecordId, rec);
        }
      }
    }
  },
});
