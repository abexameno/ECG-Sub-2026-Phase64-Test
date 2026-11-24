import {
  TeachingActivity,
  LearnerActivity,
  CompletionEvidence,
  ProgressCalculationResult
} from '../types/activity.ts';
import { AuditService } from './auditService.ts';
import { PersistentStateService } from './persistentStateService.ts';

// In-memory stores for teaching & learner activities
const teachingActivityStore = new Map<string, TeachingActivity>();
const learnerActivityStore = new Map<string, LearnerActivity>();

export const TeachingActivityService = {
  clearStore(): void {
    teachingActivityStore.clear();
    learnerActivityStore.clear();
  },

  clearInMemoryOnly(): void {
    teachingActivityStore.clear();
    learnerActivityStore.clear();
  },

  ingestState(payload: { schoolId: string; teachingActivities?: TeachingActivity[]; learnerActivities?: LearnerActivity[] }): void {
    if (Array.isArray(payload?.teachingActivities)) {
      for (const act of payload.teachingActivities) {
        if (act?.activityId && act.schoolId === payload.schoolId) {
          teachingActivityStore.set(act.activityId, act);
        }
      }
    }
    if (Array.isArray(payload?.learnerActivities)) {
      for (const act of payload.learnerActivities) {
        if (act?.activityId && act.schoolId === payload.schoolId) {
          learnerActivityStore.set(act.activityId, act);
        }
      }
    }
  },

  // 1. TEACHING ACTIVITY MANAGEMENT
  createTeachingActivity(params: {
    schoolId: string;
    teacherId: string;
    teachingPlanId: string;
    teachingAllocationId: string;
    curriculumVersionId: string;
    learningOutcomeId: string;
    artifactId?: string;
    artifactVersion?: number;
    activityType?: 'LESSON_DELIVERY' | 'PRACTICAL_EXERCISE' | 'TOPICAL_REVISION' | 'ASSESSMENT';
  }): TeachingActivity {
    if (!params.schoolId || !params.teachingPlanId || !params.teachingAllocationId) {
      throw new Error('Missing mandatory teaching activity identifiers');
    }

    const activityId = `tact_${params.schoolId}_${params.teachingPlanId}_${params.teachingAllocationId}`;
    
    // If existing, return existing record
    if (teachingActivityStore.has(activityId)) {
      return teachingActivityStore.get(activityId)!;
    }

    const activity: TeachingActivity = {
      activityId,
      schoolId: params.schoolId,
      teacherId: params.teacherId,
      teachingPlanId: params.teachingPlanId,
      teachingAllocationId: params.teachingAllocationId,
      curriculumVersionId: params.curriculumVersionId,
      learningOutcomeId: params.learningOutcomeId,
      artifactId: params.artifactId,
      artifactVersion: params.artifactVersion,
      activityType: params.activityType || 'LESSON_DELIVERY',
      status: 'NOT_STARTED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    teachingActivityStore.set(activityId, activity);
    PersistentStateService.persistTeachingActivity(activity);
    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'TEACHING_ACTIVITY_CREATED',
      activityId,
      teachingPlanId: params.teachingPlanId,
      teachingAllocationId: params.teachingAllocationId,
    });

    return activity;
  },

  startTeachingActivity(activityId: string, schoolId: string, teacherId: string): TeachingActivity {
    const activity = this.getTeachingActivity(activityId, schoolId);
    if (activity.status === 'COMPLETED') {
      return activity; // Already completed
    }

    activity.status = 'IN_PROGRESS';
    activity.startedAt = activity.startedAt || new Date().toISOString();
    activity.updatedAt = new Date().toISOString();
    PersistentStateService.persistTeachingActivity(activity);

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'TEACHING_ACTIVITY_STARTED',
      activityId,
      teacherId,
    });

    return activity;
  },

  deliverTeachingActivity(activityId: string, schoolId: string, teacherId: string): TeachingActivity {
    const activity = this.getTeachingActivity(activityId, schoolId);
    
    activity.status = 'DELIVERED';
    activity.deliveredAt = new Date().toISOString();
    activity.updatedAt = new Date().toISOString();
    PersistentStateService.persistTeachingActivity(activity);

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'LESSON_DELIVERED',
      activityId,
      teacherId,
    });

    return activity;
  },

  completeTeachingActivity(
    activityId: string,
    schoolId: string,
    teacherId: string,
    evidenceNotes?: string
  ): TeachingActivity {
    const activity = this.getTeachingActivity(activityId, schoolId);

    // Idempotency: if already completed, return safe existing
    if (activity.status === 'COMPLETED' && activity.completionEvidence && !activity.completionEvidence.isRevoked) {
      return activity;
    }

    const evidence: CompletionEvidence = {
      evidenceId: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      source: 'TEACHER_CONFIRMATION',
      recordedBy: teacherId,
      recordedAt: new Date().toISOString(),
      notes: evidenceNotes,
      isRevoked: false,
    };

    activity.status = 'COMPLETED';
    activity.completedAt = new Date().toISOString();
    activity.completionEvidence = evidence;
    activity.updatedAt = new Date().toISOString();
    PersistentStateService.persistTeachingActivity(activity);

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'TEACHING_COMPLETED',
      activityId,
      teacherId,
      evidenceId: evidence.evidenceId,
    });

    return activity;
  },

  revokeOrCorrectCompletion(
    activityId: string,
    schoolId: string,
    teacherId: string,
    reason: string
  ): TeachingActivity {
    const activity = this.getTeachingActivity(activityId, schoolId);
    if (!activity.completionEvidence) {
      throw new Error('No completion evidence exists to revoke');
    }

    activity.completionEvidence.isRevoked = true;
    activity.completionEvidence.notes = `REVOKED: ${reason} (by ${teacherId})`;
    activity.status = 'IN_PROGRESS';
    activity.updatedAt = new Date().toISOString();
    PersistentStateService.persistTeachingActivity(activity);

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'COMPLETION_CORRECTED',
      activityId,
      teacherId,
      reason,
    });

    return activity;
  },

  getTeachingActivity(activityId: string, requestingSchoolId: string): TeachingActivity {
    const activity = teachingActivityStore.get(activityId);
    if (!activity) {
      throw new Error(`Teaching activity not found: ${activityId}`);
    }
    if (activity.schoolId !== requestingSchoolId) {
      AuditService.log('SECURITY_VIOLATION', requestingSchoolId, {
        action: 'UNAUTHORIZED_CROSS_SCHOOL_TEACHING_ACTIVITY_ACCESS',
        targetActivityId: activityId,
        actualSchoolId: activity.schoolId,
      });
      throw new Error('Unauthorized cross-school access to teaching activity');
    }
    return activity;
  },

  // 2. LEARNER ACTIVITY MANAGEMENT
  createLearnerActivity(params: {
    schoolId: string;
    learnerId: string;
    teachingPlanId: string;
    teachingAllocationId: string;
    curriculumVersionId: string;
    learningOutcomeId: string;
    artifactId?: string;
    artifactVersion?: number;
    activityType?: 'LESSON_ENGAGEMENT' | 'PRACTICE_EXERCISE' | 'ASSIGNMENT_SUBMISSION' | 'ASSESSMENT';
  }): LearnerActivity {
    if (!params.schoolId || !params.learnerId || !params.teachingAllocationId) {
      throw new Error('Missing mandatory learner activity identifiers');
    }

    const activityId = `lact_${params.schoolId}_${params.learnerId}_${params.teachingAllocationId}`;

    if (learnerActivityStore.has(activityId)) {
      return learnerActivityStore.get(activityId)!;
    }

    const activity: LearnerActivity = {
      activityId,
      learnerId: params.learnerId,
      schoolId: params.schoolId,
      teachingPlanId: params.teachingPlanId,
      teachingAllocationId: params.teachingAllocationId,
      curriculumVersionId: params.curriculumVersionId,
      learningOutcomeId: params.learningOutcomeId,
      artifactId: params.artifactId,
      artifactVersion: params.artifactVersion,
      activityType: params.activityType || 'LESSON_ENGAGEMENT',
      status: 'NOT_STARTED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    learnerActivityStore.set(activityId, activity);
    PersistentStateService.persistLearnerActivity(activity);
    return activity;
  },

  startLearnerActivity(activityId: string, schoolId: string, learnerId: string): LearnerActivity {
    const activity = this.getLearnerActivity(activityId, schoolId, learnerId, 'learner');
    if (activity.status === 'COMPLETED' || activity.status === 'SUBMITTED') {
      return activity;
    }

    activity.status = 'IN_PROGRESS';
    activity.startedAt = activity.startedAt || new Date().toISOString();
    activity.updatedAt = new Date().toISOString();
    PersistentStateService.persistLearnerActivity(activity);
    return activity;
  },

  submitLearnerActivity(
    activityId: string,
    schoolId: string,
    learnerId: string,
    evidenceReference?: string
  ): LearnerActivity {
    const activity = this.getLearnerActivity(activityId, schoolId, learnerId, 'learner');
    
    activity.status = 'SUBMITTED';
    activity.submittedAt = new Date().toISOString();
    activity.evidenceReference = evidenceReference;
    activity.updatedAt = new Date().toISOString();
    PersistentStateService.persistLearnerActivity(activity);

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'LEARNER_ACTIVITY_SUBMITTED',
      activityId,
      learnerId,
    });

    return activity;
  },

  completeLearnerActivity(
    activityId: string,
    schoolId: string,
    actorId: string,
    actorRole: 'teacher' | 'system'
  ): LearnerActivity {
    const activity = this.getLearnerActivity(activityId, schoolId, actorId, actorRole);

    activity.status = 'COMPLETED';
    activity.completedAt = new Date().toISOString();
    activity.updatedAt = new Date().toISOString();
    PersistentStateService.persistLearnerActivity(activity);

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'LEARNER_ACTIVITY_COMPLETED',
      activityId,
      actorId,
    });

    return activity;
  },

  getLearnerActivity(
    activityId: string,
    requestingSchoolId: string,
    requestingUserId: string,
    requestingRole: 'teacher' | 'learner' | 'system'
  ): LearnerActivity {
    const activity = learnerActivityStore.get(activityId);
    if (!activity) {
      throw new Error(`Learner activity not found: ${activityId}`);
    }

    if (activity.schoolId !== requestingSchoolId) {
      AuditService.log('SECURITY_VIOLATION', requestingSchoolId, {
        action: 'UNAUTHORIZED_CROSS_SCHOOL_LEARNER_ACTIVITY_ACCESS',
        targetActivityId: activityId,
        actualSchoolId: activity.schoolId,
      });
      throw new Error('Unauthorized cross-school access to learner activity');
    }

    // Learner privacy: A learner can only inspect their own activities
    if (requestingRole === 'learner' && activity.learnerId !== requestingUserId) {
      AuditService.log('SECURITY_VIOLATION', requestingSchoolId, {
        action: 'UNAUTHORIZED_PEER_LEARNER_ACTIVITY_ACCESS',
        requestingUserId,
        targetLearnerId: activity.learnerId,
      });
      throw new Error('Unauthorized access: learners cannot view other learners records');
    }

    return activity;
  },

  // 3. DETERMINISTIC PROGRESS CALCULATIONS
  calculateTeachingProgress(
    teachingPlanId: string,
    schoolId: string,
    totalPlannedLessons: number
  ): ProgressCalculationResult {
    if (totalPlannedLessons <= 0) {
      return {
        scope: 'TEACHING_PLAN',
        schoolId,
        targetId: teachingPlanId,
        totalApplicable: 0,
        totalCompleted: 0,
        progressPercentage: 0,
        status: 'NOT_APPLICABLE',
        calculatedAt: new Date().toISOString(),
      };
    }

    let completedCount = 0;
    for (const act of teachingActivityStore.values()) {
      if (
        act.schoolId === schoolId &&
        act.teachingPlanId === teachingPlanId &&
        act.status === 'COMPLETED' &&
        act.completionEvidence &&
        !act.completionEvidence.isRevoked
      ) {
        completedCount++;
      }
    }

    const progressPercentage = Number(
      Math.min(100, (completedCount / totalPlannedLessons) * 100).toFixed(1)
    );

    return {
      scope: 'TEACHING_PLAN',
      schoolId,
      targetId: teachingPlanId,
      totalApplicable: totalPlannedLessons,
      totalCompleted: completedCount,
      progressPercentage,
      status: progressPercentage === 100 ? 'COMPLETED' : 'IN_PROGRESS',
      calculatedAt: new Date().toISOString(),
    };
  },

  calculateLearnerProgress(
    learnerId: string,
    schoolId: string,
    assignedActivitiesCount: number
  ): ProgressCalculationResult {
    if (assignedActivitiesCount <= 0) {
      return {
        scope: 'LEARNER',
        schoolId,
        targetId: learnerId,
        totalApplicable: 0,
        totalCompleted: 0,
        progressPercentage: 0,
        status: 'NOT_APPLICABLE',
        calculatedAt: new Date().toISOString(),
      };
    }

    let completedCount = 0;
    for (const act of learnerActivityStore.values()) {
      if (
        act.schoolId === schoolId &&
        act.learnerId === learnerId &&
        act.status === 'COMPLETED'
      ) {
        completedCount++;
      }
    }

    const progressPercentage = Number(
      Math.min(100, (completedCount / assignedActivitiesCount) * 100).toFixed(1)
    );

    return {
      scope: 'LEARNER',
      schoolId,
      targetId: learnerId,
      totalApplicable: assignedActivitiesCount,
      totalCompleted: completedCount,
      progressPercentage,
      status: progressPercentage === 100 ? 'COMPLETED' : 'IN_PROGRESS',
      calculatedAt: new Date().toISOString(),
    };
  },

  getActivitiesBySchool(schoolId: string): TeachingActivity[] {
    const list: TeachingActivity[] = [];
    for (const act of teachingActivityStore.values()) {
      if (act.schoolId === schoolId) {
        list.push({ ...act });
      }
    }
    return list;
  },

  getLearnerActivitiesBySchool(schoolId: string): LearnerActivity[] {
    const list: LearnerActivity[] = [];
    for (const act of learnerActivityStore.values()) {
      if (act.schoolId === schoolId) {
        list.push({ ...act });
      }
    }
    return list;
  }
};

PersistentStateService.registerDomainService('TeachingActivityService', {
  clearInMemoryOnly: () => TeachingActivityService.clearInMemoryOnly(),
  ingestState: (payload) => TeachingActivityService.ingestState(payload),
});

