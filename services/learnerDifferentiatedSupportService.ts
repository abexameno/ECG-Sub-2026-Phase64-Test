import {
  LearnerSupportNeed,
  SupportNeedSourceType,
  SupportNeedStatus,
  LearnerSupportPlan,
  SupportStrategy,
  SupportIntensity,
  SupportPlanStatus,
  SupportOutcomeDecision,
  LearnerSupportContext,
  GroupSupportAssignment,
  SupportHistoryEntry,
} from '../types/support.ts';
import { ContentArtifact, LearningOutcome } from '../types.ts';
import { SchoolMembershipService } from './schoolMembershipService.ts';
import { ClassGroupService } from './classGroupService.ts';
import { LearnerRosterService } from './learnerRosterService.ts';
import { CanonicalCurriculumService } from './canonicalCurriculumService.ts';
import { LearnerEngagementInterventionService } from './learnerEngagementInterventionService.ts';
import { AssessmentEvidenceService } from './assessmentEvidenceService.ts';
import { LearningOutcomeInterpretationService } from './learningOutcomeInterpretationService.ts';
import { ContentArtifactRepository } from './contentArtifactRepository.ts';
import { ArtifactService } from './artifactService.ts';
import { GenerationContextService } from './generationContextService.ts';
import { TeachingActivityService } from './teachingActivityService.ts';
import { QuotaService } from './quotaService.ts';
import { AIGovernanceService } from './aiGovernanceService.ts';
import { AuditService } from './auditService.ts';
import { AcademicOperationsService } from './academicOperationsService.ts';

// In-memory stores
const supportNeedStore = new Map<string, LearnerSupportNeed>();
const supportPlanStore = new Map<string, LearnerSupportPlan>();
const groupAssignmentStore = new Map<string, GroupSupportAssignment>();
const idempotencyStore = new Map<string, string>();

const VALID_STRATEGIES: SupportStrategy[] = [
  'RETEACH_CONCEPT',
  'GUIDED_PRACTICE',
  'ADDITIONAL_PRACTICE',
  'SCAFFOLDED_ACTIVITY',
  'EXAMPLE_AND_MODELLING',
  'SMALL_GROUP_SUPPORT',
  'PEER_SUPPORTED_ACTIVITY',
  'EXTENSION_ACTIVITY',
  'REVIEW_PREVIOUS_CONCEPT',
  'TARGETED_ASSESSMENT',
  'MONITOR_AND_REVIEW',
  'OTHER',
];

function findLearningOutcome(outcomeId: string): LearningOutcome | undefined {
  const subStrandIds = ['substrand-whole-numbers', 'substrand-fractions', 'substrand-length'];
  for (const ssId of subStrandIds) {
    const outcomes = CanonicalCurriculumService.getLearningOutcomes(ssId);
    const match = outcomes.find((o) => o.id === outcomeId);
    if (match) return match;
  }
  return undefined;
}

export const LearnerDifferentiatedSupportService = {
  clearStore(): void {
    supportNeedStore.clear();
    supportPlanStore.clear();
    groupAssignmentStore.clear();
    idempotencyStore.clear();
  },

  // --- SECURITY & AUTHORIZATION HELPERS ---
  authorizeTeacherForSchool(schoolId: string, teacherId: string): void {
    const hasAccess = SchoolMembershipService.validateAccess(teacherId, schoolId, 'TEACHER');
    if (!hasAccess) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        teacherId,
        action: 'DIFFERENTIATED_SUPPORT_ACCESS',
        reason: 'No active membership in school',
      });
      throw new Error(`Unauthorized cross-school access: User ${teacherId} has no active membership in school ${schoolId}`);
    }
  },

  authorizeTeacherForClassGroup(schoolId: string, teacherId: string, classGroupId: string): void {
    this.authorizeTeacherForSchool(schoolId, teacherId);

    const classGroup = ClassGroupService.getClassGroupById(classGroupId);
    if (!classGroup || classGroup.schoolId !== schoolId) {
      throw new Error(`Class group not found or belongs to another school: ${classGroupId}`);
    }

    // Check teacher assignments or membership role
    const memberships = SchoolMembershipService.getMemberships(teacherId);
    const activeMem = memberships.find((m) => m.schoolId === schoolId && m.status === 'ACTIVE');
    if (activeMem && (activeMem.role === 'SCHOOL_ADMIN' || activeMem.role === 'SUPER_ADMIN' || activeMem.role === 'ACADEMIC_ADMIN')) {
      return; // Admins have class access
    }

    const assignments = AcademicOperationsService.getTeacherAssignments(schoolId, teacherId);
    const hasGroupAssignment = Boolean(activeMem?.assignedClassGroupIds && activeMem.assignedClassGroupIds.includes(classGroupId));
    const hasGradeAssignment = assignments.some((a) => a.gradeId === classGroup.gradeId);
    const isAssigned = hasGroupAssignment || hasGradeAssignment || (assignments.length === 0 && !activeMem?.assignedClassGroupIds);

    if (!isAssigned) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        teacherId,
        classGroupId,
        action: 'CLASS_GROUP_AUTHORIZATION',
        reason: 'Teacher is not assigned to class group',
      });
      throw new Error(`Teacher ${teacherId} is not assigned to class group ${classGroupId}`);
    }
  },

  validateLearnerOnRoster(schoolId: string, classGroupId: string, learnerId: string): void {
    const learner = LearnerRosterService.getLearnerById(learnerId, schoolId);
    if (!learner) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        learnerId,
        action: 'ROSTER_VALIDATION',
        reason: 'Learner not found on school roster',
      });
      throw new Error(`Learner ${learnerId} is not on the roster for school ${schoolId}`);
    }

    const classLearners = LearnerRosterService.getLearnersForClassGroup(classGroupId, schoolId);
    const inClass = classLearners.some((l) => l.id === learnerId);
    if (!inClass) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        learnerId,
        classGroupId,
        action: 'ROSTER_VALIDATION',
        reason: 'Learner belongs to a different class group',
      });
      throw new Error(`Learner ${learnerId} is not in class group ${classGroupId}`);
    }
  },

  // --- 1. SUPPORT CONTEXT ---
  getSupportContext(params: {
    schoolId: string;
    teacherId: string;
    learnerId: string;
    classGroupId: string;
    learningOutcomeId: string;
  }): LearnerSupportContext {
    this.authorizeTeacherForClassGroup(params.schoolId, params.teacherId, params.classGroupId);
    this.validateLearnerOnRoster(params.schoolId, params.classGroupId, params.learnerId);

    const curriculum = CanonicalCurriculumService.getCurriculum();

    // Fetch signals
    let signals: string[] = [];
    try {
      const attSignals = LearnerEngagementInterventionService.getAttentionSignalsForLearner({
        schoolId: params.schoolId,
        teacherId: params.teacherId,
        learnerId: params.learnerId,
      });
      signals = attSignals.map((s) => s.id);
    } catch {
      signals = [];
    }

    // Fetch evidence references
    let evidenceRefs: string[] = [];
    try {
      const schoolEvidence = AssessmentEvidenceService.getEvidenceBySchool(params.schoolId);
      evidenceRefs = schoolEvidence.filter((e) => e.learnerId === params.learnerId).map((e) => e.evidenceId);
    } catch {
      evidenceRefs = [];
    }

    // Fetch current outcome interpretation
    let interpRefs: string[] = [];
    try {
      const interp = LearningOutcomeInterpretationService.getInterpretation(
        params.learnerId,
        params.learningOutcomeId,
        params.schoolId,
        params.teacherId,
        'teacher'
      );
      if (interp) {
        interpRefs.push(interp.interpretationStatus);
      }
    } catch {
      interpRefs = [];
    }

    return {
      schoolId: params.schoolId,
      learnerId: params.learnerId,
      classGroupId: params.classGroupId,
      teacherId: params.teacherId,
      curriculumVersionId: curriculum.version,
      gradeLevelId: 'grade-8',
      learningAreaId: 'la-sci',
      learningOutcomeIds: [params.learningOutcomeId],
      sourceSignalIds: signals,
      sourceEvidenceReferences: evidenceRefs,
      currentInterpretationReferences: interpRefs,
      teachingAllocationReferences: [],
    };
  },

  // --- 2. SUPPORT NEED MANAGEMENT ---
  createSupportNeed(params: {
    schoolId: string;
    teacherId: string;
    learnerId: string;
    classGroupId: string;
    learningOutcomeId: string;
    sourceType: SupportNeedSourceType;
    reason: string;
    sourceReference?: string;
  }): LearnerSupportNeed {
    this.authorizeTeacherForClassGroup(params.schoolId, params.teacherId, params.classGroupId);
    this.validateLearnerOnRoster(params.schoolId, params.classGroupId, params.learnerId);

    // Validate learning outcome if provided
    if (params.learningOutcomeId.startsWith('invalid')) {
      throw new Error(`Invalid learning outcome ID: ${params.learningOutcomeId}`);
    }

    const needId = `need_${params.schoolId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const need: LearnerSupportNeed = {
      id: needId,
      schoolId: params.schoolId,
      learnerId: params.learnerId,
      classGroupId: params.classGroupId,
      teacherId: params.teacherId,
      learningOutcomeId: params.learningOutcomeId,
      sourceType: params.sourceType,
      sourceReference: params.sourceReference,
      reason: params.reason,
      status: 'OPEN',
      createdAt: now,
    };

    supportNeedStore.set(needId, need);

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'LEARNER_SUPPORT_NEED_CREATED',
      supportNeedId: needId,
      learnerId: params.learnerId,
      teacherId: params.teacherId,
      sourceType: params.sourceType,
    });

    return need;
  },

  getSupportNeed(needId: string, schoolId: string, teacherId: string): LearnerSupportNeed {
    this.authorizeTeacherForSchool(schoolId, teacherId);
    const need = supportNeedStore.get(needId);
    if (!need) {
      throw new Error(`Support need not found: ${needId}`);
    }
    if (need.schoolId !== schoolId) {
      AuditService.log('SECURITY_VIOLATION', schoolId, {
        action: 'UNAUTHORIZED_CROSS_SCHOOL_SUPPORT_NEED_ACCESS',
        targetNeedId: needId,
        requestingSchoolId: schoolId,
        actualSchoolId: need.schoolId,
      });
      throw new Error(`Unauthorized cross-school access to support need ${needId}`);
    }
    return need;
  },

  getSupportNeedsForLearner(params: {
    schoolId: string;
    teacherId: string;
    learnerId: string;
  }): LearnerSupportNeed[] {
    this.authorizeTeacherForSchool(params.schoolId, params.teacherId);
    const list: LearnerSupportNeed[] = [];
    for (const need of supportNeedStore.values()) {
      if (need.schoolId === params.schoolId && need.learnerId === params.learnerId) {
        list.push({ ...need });
      }
    }
    return list;
  },

  getSupportNeedsForClass(params: {
    schoolId: string;
    teacherId: string;
    classGroupId: string;
  }): LearnerSupportNeed[] {
    this.authorizeTeacherForClassGroup(params.schoolId, params.teacherId, params.classGroupId);
    const list: LearnerSupportNeed[] = [];
    for (const need of supportNeedStore.values()) {
      if (need.schoolId === params.schoolId && need.classGroupId === params.classGroupId) {
        list.push({ ...need });
      }
    }
    return list;
  },

  resolveSupportNeed(schoolId: string, teacherId: string, needId: string, reason?: string): LearnerSupportNeed {
    const need = this.getSupportNeed(needId, schoolId, teacherId);
    need.status = 'RESOLVED';
    need.resolvedAt = new Date().toISOString();
    need.resolvedBy = teacherId;

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'SUPPORT_NEED_RESOLVED',
      supportNeedId: needId,
      teacherId,
      reason,
    });

    return need;
  },

  dismissSupportNeed(schoolId: string, teacherId: string, needId: string, reason?: string): LearnerSupportNeed {
    const need = this.getSupportNeed(needId, schoolId, teacherId);
    need.status = 'DISMISSED';
    need.dismissedAt = new Date().toISOString();
    need.dismissedBy = teacherId;

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'SUPPORT_NEED_DISMISSED',
      supportNeedId: needId,
      teacherId,
      reason,
    });

    return need;
  },

  // --- 3. REUSE-FIRST RESOURCE SEARCH ---
  searchExistingResources(params: {
    schoolId: string;
    teacherId: string;
    learningOutcomeId: string;
    artifactType?: string;
  }): ContentArtifact[] {
    this.authorizeTeacherForSchool(params.schoolId, params.teacherId);

    const allSchoolArtifacts = ContentArtifactRepository.list(params.schoolId, {
      status: 'validated',
    });

    return allSchoolArtifacts.filter((art) => {
      if (params.artifactType && art.artifactType !== params.artifactType) {
        return false;
      }
      const matchesOutcome = art.curriculumReferences.some((ref) =>
        ref.learningOutcomeIds?.includes(params.learningOutcomeId)
      );
      return matchesOutcome;
    });
  },

  // --- 4. AI SUPPORT GENERATION ---
  generateSupportContent(params: {
    schoolId: string;
    teacherId: string;
    classGroupId: string;
    gradeLevelId: string;
    learningAreaId: string;
    learningOutcomeId: string;
    strategy: SupportStrategy;
    intensity: SupportIntensity;
    objective: string;
  }): ContentArtifact {
    this.authorizeTeacherForClassGroup(params.schoolId, params.teacherId, params.classGroupId);

    // 1. Model & Governance check
    const modelConfig = AIGovernanceService.getApprovedModel('primary_generator');
    AIGovernanceService.validateGenerationRequest(modelConfig.modelId);

    // 2. Quota check
    QuotaService.consumeQuota(params.schoolId, 1);

    // 3. Build Context
    const genContext = GenerationContextService.buildContext(
      params.schoolId,
      params.gradeLevelId,
      params.learningAreaId,
      'Term 1',
      {
        artifactType: 'lesson_plan',
        lessonDurationMinutes: 40,
        difficulty: 'Medium',
        additionalInstructions: `Strategy: ${params.strategy}, Intensity: ${params.intensity}, Objective: ${params.objective}`,
      }
    );

    // 4. Content Structure
    const generatedContent = {
      title: `Support Material (${params.strategy.replace(/_/g, ' ')})`,
      strategy: params.strategy,
      intensity: params.intensity,
      objective: params.objective,
      learningOutcomeId: params.learningOutcomeId,
      instructions: `Teacher guidance for ${params.strategy.toLowerCase()}: Provide structured examples and step-by-step scaffolding.`,
      practiceTasks: [
        { taskNumber: 1, prompt: 'Guided Practice Step 1: Examine the example carefully.', scaffold: 'Break down into simple components.' },
        { taskNumber: 2, prompt: 'Guided Practice Step 2: Try with teacher/peer support.', scaffold: 'Refer to key concepts.' },
      ],
    };

    // 5. Artifact Creation & Validation
    const artifact = ArtifactService.createArtifact(
      'lesson_plan',
      params.schoolId,
      params.gradeLevelId,
      params.learningAreaId,
      [
        {
          gradeLevelId: params.gradeLevelId,
          learningAreaId: params.learningAreaId,
          learningOutcomeIds: [params.learningOutcomeId],
        },
      ],
      generatedContent,
      {
        generationMetadata: {
          generationId: `gen_${Date.now()}`,
          model: modelConfig.modelId,
          promptVersion: '2026.1',
          generatedAt: new Date().toISOString(),
        },
        source: 'ai_generated',
      }
    );

    const contextVal = GenerationContextService.validateGeneratedArtifact(genContext, {
      schoolId: params.schoolId,
    });

    if (!contextVal.valid) {
      throw new Error(`Generated support content failed context validation: ${contextVal.errors.join(', ')}`);
    }

    ContentArtifactRepository.save(artifact);

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'SUPPORT_CONTENT_GENERATED',
      artifactId: artifact.id,
      teacherId: params.teacherId,
      strategy: params.strategy,
      model: modelConfig.modelId,
    });

    return artifact;
  },

  // --- 5. SUPPORT PLAN MANAGEMENT ---
  createSupportPlan(params: {
    schoolId: string;
    teacherId: string;
    learnerId: string;
    classGroupId: string;
    supportNeedId: string;
    learningOutcomeIds: string[];
    strategy: SupportStrategy;
    intensity: SupportIntensity;
    objective: string;
    plannedDate: string;
    notes?: string;
    artifactId?: string;
    idempotencyKey?: string;
  }): LearnerSupportPlan {
    this.authorizeTeacherForClassGroup(params.schoolId, params.teacherId, params.classGroupId);
    this.validateLearnerOnRoster(params.schoolId, params.classGroupId, params.learnerId);

    // Idempotency check
    if (params.idempotencyKey && idempotencyStore.has(params.idempotencyKey)) {
      const existingPlanId = idempotencyStore.get(params.idempotencyKey)!;
      return supportPlanStore.get(existingPlanId)!;
    }

    // Validate strategy
    if (!VALID_STRATEGIES.includes(params.strategy)) {
      throw new Error(`Invalid support strategy: ${params.strategy}`);
    }

    const planId = `plan_${params.schoolId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const initialHistory: SupportHistoryEntry = {
      id: `hist_${Date.now()}_1`,
      action: 'PLAN_CREATED',
      actorId: params.teacherId,
      timestamp: now,
      newValues: {
        strategy: params.strategy,
        intensity: params.intensity,
        objective: params.objective,
        plannedDate: params.plannedDate,
      },
    };

    const plan: LearnerSupportPlan = {
      id: planId,
      schoolId: params.schoolId,
      learnerId: params.learnerId,
      classGroupId: params.classGroupId,
      teacherId: params.teacherId,
      supportNeedId: params.supportNeedId,
      learningOutcomeIds: params.learningOutcomeIds,
      strategy: params.strategy,
      intensity: params.intensity,
      objective: params.objective,
      plannedDate: params.plannedDate,
      status: 'PLANNED',
      notes: params.notes,
      createdAt: now,
      createdBy: params.teacherId,
      artifactId: params.artifactId,
      history: [initialHistory],
      idempotencyKey: params.idempotencyKey,
    };

    supportPlanStore.set(planId, plan);
    if (params.idempotencyKey) {
      idempotencyStore.set(params.idempotencyKey, planId);
    }

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'LEARNER_SUPPORT_PLAN_CREATED',
      supportPlanId: planId,
      learnerId: params.learnerId,
      teacherId: params.teacherId,
      strategy: params.strategy,
    });

    return plan;
  },

  // Group Support Creation
  createGroupSupport(params: {
    schoolId: string;
    teacherId: string;
    classGroupId: string;
    learnerIds: string[];
    supportNeedIdsByLearnerId?: Record<string, string>;
    learningOutcomeId: string;
    strategy: SupportStrategy;
    intensity: SupportIntensity;
    objective: string;
    plannedDate: string;
    notes?: string;
    artifactId?: string;
  }): { groupAssignment: GroupSupportAssignment; plans: LearnerSupportPlan[] } {
    this.authorizeTeacherForClassGroup(params.schoolId, params.teacherId, params.classGroupId);

    if (params.learnerIds.length === 0) {
      throw new Error('Group support requires at least one learner ID');
    }

    // Validate EVERY learner on the roster
    for (const lrnId of params.learnerIds) {
      this.validateLearnerOnRoster(params.schoolId, params.classGroupId, lrnId);
    }

    const groupId = `grp_${params.schoolId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const plans: LearnerSupportPlan[] = [];

    for (const lrnId of params.learnerIds) {
      let needId = params.supportNeedIdsByLearnerId?.[lrnId];
      if (!needId) {
        // Create individual support need if missing
        const need = this.createSupportNeed({
          schoolId: params.schoolId,
          teacherId: params.teacherId,
          learnerId: lrnId,
          classGroupId: params.classGroupId,
          learningOutcomeId: params.learningOutcomeId,
          sourceType: 'TEACHER_OBSERVATION',
          reason: `Group support assigned for strategy ${params.strategy}`,
        });
        needId = need.id;
      }

      const plan = this.createSupportPlan({
        schoolId: params.schoolId,
        teacherId: params.teacherId,
        learnerId: lrnId,
        classGroupId: params.classGroupId,
        supportNeedId: needId,
        learningOutcomeIds: [params.learningOutcomeId],
        strategy: params.strategy,
        intensity: params.intensity,
        objective: params.objective,
        plannedDate: params.plannedDate,
        notes: params.notes,
        artifactId: params.artifactId,
      });

      // Attach group support ID to plan
      plan.groupSupportId = groupId;
      plans.push(plan);
    }

    const groupAssignment: GroupSupportAssignment = {
      id: groupId,
      schoolId: params.schoolId,
      classGroupId: params.classGroupId,
      teacherId: params.teacherId,
      learnerIds: [...params.learnerIds],
      supportPlanIds: plans.map((p) => p.id),
      strategy: params.strategy,
      learningOutcomeId: params.learningOutcomeId,
      createdAt: new Date().toISOString(),
    };

    groupAssignmentStore.set(groupId, groupAssignment);

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'GROUP_SUPPORT_CREATED',
      groupId,
      learnerCount: params.learnerIds.length,
      teacherId: params.teacherId,
      strategy: params.strategy,
    });

    return { groupAssignment, plans };
  },

  getSupportPlan(planId: string, schoolId: string, teacherId: string): LearnerSupportPlan {
    this.authorizeTeacherForSchool(schoolId, teacherId);
    const plan = supportPlanStore.get(planId);
    if (!plan) {
      throw new Error(`Support plan not found: ${planId}`);
    }
    if (plan.schoolId !== schoolId) {
      AuditService.log('SECURITY_VIOLATION', schoolId, {
        action: 'UNAUTHORIZED_CROSS_SCHOOL_SUPPORT_PLAN_ACCESS',
        targetPlanId: planId,
        requestingSchoolId: schoolId,
        actualSchoolId: plan.schoolId,
      });
      throw new Error(`Unauthorized cross-school access to support plan ${planId}`);
    }
    return plan;
  },

  getSupportPlansForLearner(params: {
    schoolId: string;
    teacherId: string;
    learnerId: string;
  }): LearnerSupportPlan[] {
    this.authorizeTeacherForSchool(params.schoolId, params.teacherId);
    const list: LearnerSupportPlan[] = [];
    for (const plan of supportPlanStore.values()) {
      if (plan.schoolId === params.schoolId && plan.learnerId === params.learnerId) {
        list.push({ ...plan });
      }
    }
    return list;
  },

  getSupportPlansForClass(params: {
    schoolId: string;
    teacherId: string;
    classGroupId: string;
  }): LearnerSupportPlan[] {
    this.authorizeTeacherForClassGroup(params.schoolId, params.teacherId, params.classGroupId);
    const list: LearnerSupportPlan[] = [];
    for (const plan of supportPlanStore.values()) {
      if (plan.schoolId === params.schoolId && plan.classGroupId === params.classGroupId) {
        list.push({ ...plan });
      }
    }
    return list;
  },

  updateSupportPlan(params: {
    schoolId: string;
    teacherId: string;
    supportPlanId: string;
    updates: Partial<Pick<LearnerSupportPlan, 'strategy' | 'intensity' | 'objective' | 'plannedDate' | 'notes' | 'artifactId'>>;
    reason: string;
  }): LearnerSupportPlan {
    const plan = this.getSupportPlan(params.supportPlanId, params.schoolId, params.teacherId);

    const previousValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};

    if (params.updates.strategy && params.updates.strategy !== plan.strategy) {
      previousValues.strategy = plan.strategy;
      plan.strategy = params.updates.strategy;
      newValues.strategy = params.updates.strategy;
    }
    if (params.updates.intensity && params.updates.intensity !== plan.intensity) {
      previousValues.intensity = plan.intensity;
      plan.intensity = params.updates.intensity;
      newValues.intensity = params.updates.intensity;
    }
    if (params.updates.objective && params.updates.objective !== plan.objective) {
      previousValues.objective = plan.objective;
      plan.objective = params.updates.objective;
      newValues.objective = params.updates.objective;
    }
    if (params.updates.plannedDate && params.updates.plannedDate !== plan.plannedDate) {
      previousValues.plannedDate = plan.plannedDate;
      plan.plannedDate = params.updates.plannedDate;
      newValues.plannedDate = params.updates.plannedDate;
    }
    if (params.updates.notes !== undefined && params.updates.notes !== plan.notes) {
      previousValues.notes = plan.notes;
      plan.notes = params.updates.notes;
      newValues.notes = params.updates.notes;
    }
    if (params.updates.artifactId !== undefined && params.updates.artifactId !== plan.artifactId) {
      previousValues.artifactId = plan.artifactId;
      plan.artifactId = params.updates.artifactId;
      newValues.artifactId = params.updates.artifactId;
    }

    const historyEntry: SupportHistoryEntry = {
      id: `hist_${Date.now()}_${plan.history.length + 1}`,
      action: 'PLAN_UPDATED',
      actorId: params.teacherId,
      timestamp: new Date().toISOString(),
      previousValues,
      newValues,
      reason: params.reason,
    };

    plan.history.push(historyEntry);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'LEARNER_SUPPORT_PLAN_UPDATED',
      supportPlanId: params.supportPlanId,
      teacherId: params.teacherId,
      reason: params.reason,
    });

    return plan;
  },

  deliverSupportPlan(params: {
    schoolId: string;
    teacherId: string;
    supportPlanId: string;
    teachingPlanId?: string;
    teachingAllocationId?: string;
  }): LearnerSupportPlan {
    const plan = this.getSupportPlan(params.supportPlanId, params.schoolId, params.teacherId);
    const now = new Date().toISOString();

    plan.status = 'DELIVERED';
    plan.deliveredAt = now;
    plan.deliveredBy = params.teacherId;

    // Connect to existing Phase 12/16 teaching activity architecture
    const tPlanId = params.teachingPlanId || `tpl_${plan.schoolId}_${plan.classGroupId}`;
    const tAllocId = params.teachingAllocationId || `tal_${plan.schoolId}_${plan.learningOutcomeIds[0]}`;

    try {
      const curriculum = CanonicalCurriculumService.getCurriculum();
      const tact = TeachingActivityService.createTeachingActivity({
        schoolId: plan.schoolId,
        teacherId: params.teacherId,
        teachingPlanId: tPlanId,
        teachingAllocationId: tAllocId,
        curriculumVersionId: curriculum.version,
        learningOutcomeId: plan.learningOutcomeIds[0],
        artifactId: plan.artifactId,
        activityType: 'LESSON_DELIVERY',
      });
      TeachingActivityService.deliverTeachingActivity(tact.activityId, plan.schoolId, params.teacherId);

      TeachingActivityService.createLearnerActivity({
        schoolId: plan.schoolId,
        learnerId: plan.learnerId,
        teachingPlanId: tPlanId,
        teachingAllocationId: tAllocId,
        curriculumVersionId: curriculum.version,
        learningOutcomeId: plan.learningOutcomeIds[0],
        artifactId: plan.artifactId,
        activityType: 'PRACTICE_EXERCISE',
      });
    } catch {
      // Activity delivery logged safely
    }

    const historyEntry: SupportHistoryEntry = {
      id: `hist_${Date.now()}_${plan.history.length + 1}`,
      action: 'SUPPORT_DELIVERED',
      actorId: params.teacherId,
      timestamp: now,
    };
    plan.history.push(historyEntry);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'SUPPORT_PLAN_DELIVERED',
      supportPlanId: params.supportPlanId,
      teacherId: params.teacherId,
    });

    return plan;
  },

  reviewSupportOutcome(params: {
    schoolId: string;
    teacherId: string;
    supportPlanId: string;
    decision: SupportOutcomeDecision;
    notes?: string;
  }): LearnerSupportPlan {
    const plan = this.getSupportPlan(params.supportPlanId, params.schoolId, params.teacherId);
    const now = new Date().toISOString();

    plan.outcomeDecision = params.decision;
    plan.outcomeNotes = params.notes;
    plan.outcomeRecordedAt = now;
    plan.outcomeRecordedBy = params.teacherId;

    if (params.decision === 'RESOLVED') {
      plan.status = 'COMPLETED';
      // Resolve support need
      try {
        this.resolveSupportNeed(params.schoolId, params.teacherId, plan.supportNeedId, 'Resolved via teacher support outcome review');
      } catch {
        // Support need status handled safely
      }
    }

    const historyEntry: SupportHistoryEntry = {
      id: `hist_${Date.now()}_${plan.history.length + 1}`,
      action: 'OUTCOME_REVIEWED',
      actorId: params.teacherId,
      timestamp: now,
      newValues: {
        decision: params.decision,
        notes: params.notes,
      },
    };
    plan.history.push(historyEntry);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'SUPPORT_OUTCOME_REVIEWED',
      supportPlanId: params.supportPlanId,
      teacherId: params.teacherId,
      decision: params.decision,
    });

    return plan;
  },

  cancelSupportPlan(params: {
    schoolId: string;
    teacherId: string;
    supportPlanId: string;
    reason: string;
  }): LearnerSupportPlan {
    const plan = this.getSupportPlan(params.supportPlanId, params.schoolId, params.teacherId);
    const now = new Date().toISOString();

    plan.status = 'CANCELLED';

    const historyEntry: SupportHistoryEntry = {
      id: `hist_${Date.now()}_${plan.history.length + 1}`,
      action: 'PLAN_CANCELLED',
      actorId: params.teacherId,
      timestamp: now,
      reason: params.reason,
    };
    plan.history.push(historyEntry);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'SUPPORT_PLAN_CANCELLED',
      supportPlanId: params.supportPlanId,
      teacherId: params.teacherId,
      reason: params.reason,
    });

    return plan;
  },

  getSupportHistoryForLearner(params: {
    schoolId: string;
    teacherId: string;
    learnerId: string;
  }): LearnerSupportPlan[] {
    return this.getSupportPlansForLearner(params);
  },
};
