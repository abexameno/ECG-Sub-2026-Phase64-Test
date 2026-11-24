import {
  LearnerLearningState,
  LearnerLearningStateValue,
  AdaptiveLearningOption,
  AdaptiveOptionType,
  EvidenceBasis,
  AdaptiveLearningPathway,
  AdaptivePathwayStep,
} from '../types/adaptive.ts';
import { ContentArtifact } from '../types.ts';
import { SchoolMembershipService } from './schoolMembershipService.ts';
import { ClassGroupService } from './classGroupService.ts';
import { LearnerRosterService } from './learnerRosterService.ts';
import { CanonicalCurriculumService } from './canonicalCurriculumService.ts';
import { LearningOutcomeInterpretationService } from './learningOutcomeInterpretationService.ts';
import { LearnerDifferentiatedSupportService } from './learnerDifferentiatedSupportService.ts';
import { TeachingActivityService } from './teachingActivityService.ts';
import { ContentArtifactRepository } from './contentArtifactRepository.ts';
import { ArtifactService } from './artifactService.ts';
import { GenerationContextService } from './generationContextService.ts';
import { AIGovernanceService } from './aiGovernanceService.ts';
import { QuotaService } from './quotaService.ts';
import { AuditService } from './auditService.ts';
import { AcademicOperationsService } from './academicOperationsService.ts';

const learningStateStore = new Map<string, LearnerLearningState>(); // key: schoolId_learnerId_outcomeId
const optionStore = new Map<string, AdaptiveLearningOption>(); // key: optionId
const pathwayStore = new Map<string, AdaptiveLearningPathway>(); // key: pathwayId

export const AdaptiveLearningPathwayService = {
  clearStore(): void {
    learningStateStore.clear();
    optionStore.clear();
    pathwayStore.clear();
  },

  authorizeTeacherForSchool(schoolId: string, teacherId: string): void {
    const hasAccess = SchoolMembershipService.validateAccess(teacherId, schoolId, 'TEACHER');
    if (!hasAccess) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        teacherId,
        action: 'ADAPTIVE_PATHWAY_ACCESS',
        reason: 'Teacher not active in school membership',
      });
      throw new Error(`Unauthorized access: Teacher ${teacherId} is not an active member of school ${schoolId}`);
    }
  },

  authorizeTeacherForClassGroup(schoolId: string, teacherId: string, classGroupId: string): void {
    this.authorizeTeacherForSchool(schoolId, teacherId);

    const classGroup = ClassGroupService.getClassGroupById(classGroupId);
    if (!classGroup || classGroup.schoolId !== schoolId) {
      throw new Error(`Class group not found or belongs to another school: ${classGroupId}`);
    }

    const memberships = SchoolMembershipService.getMemberships(teacherId);
    const activeMem = memberships.find((m) => m.schoolId === schoolId && m.status === 'ACTIVE');
    if (activeMem && (activeMem.role === 'SCHOOL_ADMIN' || activeMem.role === 'SUPER_ADMIN' || activeMem.role === 'ACADEMIC_ADMIN')) {
      return;
    }

    const assignments = AcademicOperationsService.getTeacherAssignments(schoolId, teacherId);
    const isAssigned = assignments.some((a) => a.gradeId === classGroup.gradeId);

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

  deriveLearningState(params: {
    schoolId: string;
    teacherId: string;
    learnerId: string;
    classGroupId: string;
    learningOutcomeId: string;
  }): LearnerLearningState {
    this.authorizeTeacherForClassGroup(params.schoolId, params.teacherId, params.classGroupId);
    this.validateLearnerOnRoster(params.schoolId, params.classGroupId, params.learnerId);

    const curriculum = CanonicalCurriculumService.getCurriculum();
    
    let interpretationStatus = 'INSUFFICIENT_EVIDENCE';
    try {
      const interp = LearningOutcomeInterpretationService.getInterpretation(
        params.learnerId,
        params.learningOutcomeId,
        params.schoolId,
        params.teacherId,
        'teacher'
      );
      if (interp) {
        interpretationStatus = interp.interpretationStatus;
      }
    } catch {
      interpretationStatus = 'INSUFFICIENT_EVIDENCE';
    }

    let supportHistorySummary = 'No prior support recorded.';
    const needs = LearnerDifferentiatedSupportService.getSupportNeedsForLearner({
      schoolId: params.schoolId,
      teacherId: params.teacherId,
      learnerId: params.learnerId,
    });
    const outcomeNeeds = needs.filter((n) => n.learningOutcomeId === params.learningOutcomeId);
    if (outcomeNeeds.length > 0) {
      supportHistorySummary = `${outcomeNeeds.length} support need(s) recorded. Latest status: ${outcomeNeeds[0].status}`;
    }

    let state: LearnerLearningStateValue = 'INSUFFICIENT_EVIDENCE';
    let evidenceSummary = 'Insufficient evidence collected for this learning outcome.';

    if (interpretationStatus === 'DEVELOPING') {
      state = 'SUPPORT_RECOMMENDED';
      evidenceSummary = 'Interpretation indicates DEVELOPING. Additional targeted support or guided practice is recommended.';
    } else if (interpretationStatus === 'DEMONSTRATED' || interpretationStatus === 'EXCEEDING') {
      state = 'EXTENSION_OPPORTUNITY';
      evidenceSummary = 'Interpretation indicates strong demonstration. Ready for extension or progression.';
    } else if (interpretationStatus === 'HIGH_CONFLICT') {
      state = 'NEEDS_REVIEW';
      evidenceSummary = 'Conflicting evidence detected. Teacher review and reassessment recommended.';
    } else if (outcomeNeeds.length > 0 && outcomeNeeds.some((n) => n.status === 'OPEN')) {
      state = 'READY_FOR_REINFORCEMENT';
      evidenceSummary = 'Open support need identified. Ready for reinforcement activities.';
    } else {
      state = 'READY_FOR_PROGRESSION';
      evidenceSummary = 'Standard evidence baseline. Ready for curriculum progression.';
    }

    const learningState: LearnerLearningState = {
      schoolId: params.schoolId,
      learnerId: params.learnerId,
      classGroupId: params.classGroupId,
      curriculumVersionId: curriculum.version,
      gradeLevelId: 'grade-8',
      learningAreaId: 'la-sci',
      learningOutcomeId: params.learningOutcomeId,
      evidenceSummary,
      interpretationStatus,
      supportHistorySummary,
      attentionSummary: 'No critical attention signals.',
      lastEvidenceAt: new Date().toISOString(),
      state,
      generatedAt: new Date().toISOString(),
    };

    const storeKey = `${params.schoolId}_${params.learnerId}_${params.learningOutcomeId}`;
    learningStateStore.set(storeKey, learningState);
    return learningState;
  },

  generateRecommendations(params: {
    schoolId: string;
    teacherId: string;
    learnerId: string;
    classGroupId: string;
    learningOutcomeId: string;
  }): AdaptiveLearningOption[] {
    const state = this.deriveLearningState(params);
    const options: AdaptiveLearningOption[] = [];

    let optionType: AdaptiveOptionType = 'PROCEED';
    let reason = 'Learner is ready for standard curriculum progression.';
    let evidenceBasis: EvidenceBasis = 'MODERATE';

    if (state.state === 'SUPPORT_RECOMMENDED') {
      optionType = 'GUIDED_PRACTICE';
      reason = 'Evidence shows developing mastery. Guided practice and scaffolding recommended.';
      evidenceBasis = 'MODERATE';
    } else if (state.state === 'EXTENSION_OPPORTUNITY') {
      optionType = 'EXTENSION';
      reason = 'Evidence demonstrates mastery. Extension tasks recommended.';
      evidenceBasis = 'STRONG';
    } else if (state.state === 'NEEDS_REVIEW') {
      optionType = 'REASSESS';
      reason = 'Conflicting evidence requires targeted reassessment or review.';
      evidenceBasis = 'LIMITED';
    } else if (state.state === 'READY_FOR_REINFORCEMENT') {
      optionType = 'RETEACH';
      reason = 'Active support need requires reteaching core concepts.';
      evidenceBasis = 'MODERATE';
    } else if (state.state === 'INSUFFICIENT_EVIDENCE') {
      optionType = 'REASSESS';
      reason = 'Insufficient evidence available. Collect baseline assessment evidence.';
      evidenceBasis = 'INSUFFICIENT';
    }

    const optionId = `opt_${params.schoolId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const option: AdaptiveLearningOption = {
      id: optionId,
      schoolId: params.schoolId,
      learnerId: params.learnerId,
      classGroupId: params.classGroupId,
      learningOutcomeIds: [params.learningOutcomeId],
      optionType,
      reason,
      evidenceBasis,
      evidenceReferences: [params.learningOutcomeId],
      source: 'DETERMINISTIC',
      priority: 1,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    optionStore.set(optionId, option);
    options.push(option);
    return options;
  },

  createPathway(params: {
    schoolId: string;
    teacherId: string;
    learnerId: string;
    classGroupId: string;
    targetLearningOutcomeIds: string[];
    recommendedOptionType: AdaptiveOptionType;
    objective: string;
    idempotencyKey?: string;
  }): AdaptiveLearningPathway {
    this.authorizeTeacherForClassGroup(params.schoolId, params.teacherId, params.classGroupId);
    this.validateLearnerOnRoster(params.schoolId, params.classGroupId, params.learnerId);

    if (params.idempotencyKey) {
      for (const pathway of pathwayStore.values()) {
        if (pathway.schoolId === params.schoolId && pathway.idempotencyKey === params.idempotencyKey) {
          return pathway;
        }
      }
    }

    const curriculum = CanonicalCurriculumService.getCurriculum();
    const pathwayId = `path_${params.schoolId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const steps: AdaptivePathwayStep[] = params.targetLearningOutcomeIds.map((loId, idx) => ({
      id: `step_${pathwayId}_${idx + 1}`,
      pathwayId,
      sequence: idx + 1,
      learningOutcomeIds: [loId],
      stepType: params.recommendedOptionType,
      objective: params.objective,
      status: 'PENDING',
      teacherDecision: 'PENDING',
      createdAt: now,
    }));

    const pathway: AdaptiveLearningPathway = {
      id: pathwayId,
      schoolId: params.schoolId,
      learnerId: params.learnerId,
      classGroupId: params.classGroupId,
      teacherId: params.teacherId,
      curriculumVersionId: curriculum.version,
      learningAreaId: 'la-sci',
      targetLearningOutcomeIds: params.targetLearningOutcomeIds,
      sourceEvidenceReferences: params.targetLearningOutcomeIds,
      currentStep: 1,
      steps,
      status: 'PROPOSED',
      createdAt: now,
      updatedAt: now,
      idempotencyKey: params.idempotencyKey,
    };

    pathwayStore.set(pathwayId, pathway);
    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'ADAPTIVE_PATHWAY_CREATED',
      pathwayId,
      learnerId: params.learnerId,
      teacherId: params.teacherId,
    });

    return pathway;
  },

  getPathway(pathwayId: string, schoolId: string, teacherId: string): AdaptiveLearningPathway {
    this.authorizeTeacherForSchool(schoolId, teacherId);
    const pathway = pathwayStore.get(pathwayId);
    if (!pathway || pathway.schoolId !== schoolId) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        pathwayId,
        teacherId,
        action: 'GET_PATHWAY',
        reason: 'Pathway not found or belongs to another school',
      });
      throw new Error(`Pathway not found or unauthorized: ${pathwayId}`);
    }
    return pathway;
  },

  updateTeacherDecision(params: {
    schoolId: string;
    teacherId: string;
    pathwayId: string;
    decision: 'ACCEPT' | 'REJECT' | 'POSTPONE';
    reason?: string;
  }): AdaptiveLearningPathway {
    const pathway = this.getPathway(params.pathwayId, params.schoolId, params.teacherId);

    if (params.decision === 'ACCEPT') {
      pathway.status = 'ACCEPTED';
      pathway.steps.forEach((s) => {
        s.teacherDecision = 'ACCEPT';
        s.status = 'READY';
      });
    } else if (params.decision === 'REJECT') {
      pathway.status = 'DISMISSED';
      pathway.steps.forEach((s) => {
        s.teacherDecision = 'REJECT';
        s.status = 'CANCELLED';
      });
    } else if (params.decision === 'POSTPONE') {
      pathway.status = 'PAUSED';
    }

    pathway.updatedAt = new Date().toISOString();
    pathwayStore.set(pathway.id, pathway);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'ADAPTIVE_PATHWAY_DECISION',
      pathwayId: pathway.id,
      decision: params.decision,
      teacherId: params.teacherId,
    });

    return pathway;
  },

  deliverPathwayStep(params: {
    schoolId: string;
    teacherId: string;
    pathwayId: string;
    stepId: string;
  }): AdaptiveLearningPathway {
    const pathway = this.getPathway(params.pathwayId, params.schoolId, params.teacherId);
    const step = pathway.steps.find((s) => s.id === params.stepId);
    if (!step) {
      throw new Error(`Pathway step not found: ${params.stepId}`);
    }

    step.status = 'DELIVERED';
    pathway.status = 'IN_PROGRESS';
    pathway.updatedAt = new Date().toISOString();
    pathwayStore.set(pathway.id, pathway);

    // Integrate with TeachingActivity architecture
    TeachingActivityService.createTeachingActivity({
      schoolId: params.schoolId,
      teacherId: params.teacherId,
      teachingPlanId: 'tp_default',
      teachingAllocationId: 'ta_default',
      curriculumVersionId: pathway.curriculumVersionId,
      learningOutcomeId: step.learningOutcomeIds[0],
      activityType: 'LESSON_DELIVERY',
    });

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'ADAPTIVE_STEP_DELIVERED',
      pathwayId: pathway.id,
      stepId: step.id,
      teacherId: params.teacherId,
    });

    return pathway;
  },

  completePathwayStep(params: {
    schoolId: string;
    teacherId: string;
    pathwayId: string;
    stepId: string;
  }): AdaptiveLearningPathway {
    const pathway = this.getPathway(params.pathwayId, params.schoolId, params.teacherId);
    const step = pathway.steps.find((s) => s.id === params.stepId);
    if (!step) {
      throw new Error(`Pathway step not found: ${params.stepId}`);
    }

    step.status = 'COMPLETED';
    step.completedAt = new Date().toISOString();

    const allCompleted = pathway.steps.every((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED' || s.status === 'CANCELLED');
    if (allCompleted) {
      pathway.status = 'COMPLETED';
    }

    pathway.updatedAt = new Date().toISOString();
    pathwayStore.set(pathway.id, pathway);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'ADAPTIVE_STEP_COMPLETED',
      pathwayId: pathway.id,
      stepId: step.id,
      teacherId: params.teacherId,
    });

    return pathway;
  },

  // AI-Assisted Recommendation & Content Generation
  async generateAIRecommendation(params: {
    schoolId: string;
    teacherId: string;
    learnerId: string;
    classGroupId: string;
    learningOutcomeId: string;
  }): Promise<{ option: AdaptiveLearningOption; content?: ContentArtifact }> {
    this.authorizeTeacherForClassGroup(params.schoolId, params.teacherId, params.classGroupId);
    this.validateLearnerOnRoster(params.schoolId, params.classGroupId, params.learnerId);

    const state = this.deriveLearningState(params);

    const modelConfig = AIGovernanceService.getApprovedModel('primary_generator');
    AIGovernanceService.validateGenerationRequest(modelConfig.modelId);
    QuotaService.consumeQuota(params.schoolId, 1);

    const genContext = GenerationContextService.buildContext(
      params.schoolId,
      'grade-8',
      'la-sci',
      'Term 1',
      {
        artifactType: 'lesson_plan',
        lessonDurationMinutes: 40,
        difficulty: 'Medium',
        additionalInstructions: `Generate adaptive learning recommendation and practice materials for learning state: ${state.state}`,
      }
    );

    const optionId = `opt_ai_${params.schoolId}_${Date.now()}`;
    const aiOption: AdaptiveLearningOption = {
      id: optionId,
      schoolId: params.schoolId,
      learnerId: params.learnerId,
      classGroupId: params.classGroupId,
      learningOutcomeIds: [params.learningOutcomeId],
      optionType: 'SCAFFOLDED_ACTIVITY',
      reason: `AI Recommendation based on state ${state.state}: Provide structured scaffolded practice.`,
      evidenceBasis: 'STRONG',
      evidenceReferences: [params.learningOutcomeId],
      source: 'AI_RECOMMENDED',
      priority: 2,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    optionStore.set(optionId, aiOption);

    const content = {
      title: `Adaptive Scaffolded Practice (${params.learningOutcomeId})`,
      strategy: 'SCAFFOLDED_ACTIVITY',
      objective: 'Targeted reinforcement of key concepts.',
      guidedSteps: ['Step 1: Review core principle', 'Step 2: Complete guided problem', 'Step 3: Independent check'],
    };

    const artifact = ArtifactService.createArtifact(
      'lesson_plan',
      params.schoolId,
      'grade-8',
      'la-sci',
      [{ gradeLevelId: 'grade-8', learningAreaId: 'la-sci', learningOutcomeIds: [params.learningOutcomeId] }],
      content,
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

    ContentArtifactRepository.save(artifact);

    return { option: aiOption, content: artifact };
  },
};
