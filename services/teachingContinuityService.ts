import {
  TeachingSequence,
  LessonSequenceEntry,
  ContinuityIssue,
  FollowThroughAction,
  ContinuityEvidenceSummary,
  ContinuityStatus,
  InstructionalContinuity,
  SequenceEntryStatus,
  ContinuityIssueType,
} from '../types/teachingContinuity.ts';
import { TeachingReflectionService } from './teachingReflectionService.ts';
import { AuditService } from './auditService.ts';
import { TeachingPlanService } from './teachingPlanService.ts';

const sequenceStore = new Map<string, TeachingSequence>(); // sequenceId -> TeachingSequence
const entryStore = new Map<string, LessonSequenceEntry>(); // entryId -> LessonSequenceEntry
const issueStore = new Map<string, ContinuityIssue>(); // issueId -> ContinuityIssue
const followThroughStore = new Map<string, FollowThroughAction>(); // followThroughId -> FollowThroughAction
const idempotencyStore = new Map<string, string>(); // idempotencyKey -> entityId

export const TeachingContinuityService = {
  clearStore(): void {
    sequenceStore.clear();
    entryStore.clear();
    issueStore.clear();
    followThroughStore.clear();
    idempotencyStore.clear();
  },

  // 1. Teaching Sequence Management
  createTeachingSequence(params: {
    schoolId: string;
    teacherId: string;
    classGroupId: string;
    teachingPlanId: string;
    learningAreaId: string;
    curriculumVersionId: string;
    title: string;
    idempotencyKey?: string;
  }): TeachingSequence {
    TeachingReflectionService.authorizeTeacherForClassGroup(params.schoolId, params.teacherId, params.classGroupId);

    if (params.idempotencyKey && idempotencyStore.has(params.idempotencyKey)) {
      const existingId = idempotencyStore.get(params.idempotencyKey)!;
      return sequenceStore.get(existingId)!;
    }

    const sequenceId = `seq_${params.schoolId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const sequence: TeachingSequence = {
      id: sequenceId,
      schoolId: params.schoolId,
      classGroupId: params.classGroupId,
      teachingPlanId: params.teachingPlanId,
      learningAreaId: params.learningAreaId,
      curriculumVersionId: params.curriculumVersionId,
      title: params.title,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    sequenceStore.set(sequenceId, sequence);

    if (params.idempotencyKey) {
      idempotencyStore.set(params.idempotencyKey, sequenceId);
    }

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'TEACHING_SEQUENCE_CREATED',
      sequenceId,
      classGroupId: params.classGroupId,
      learningAreaId: params.learningAreaId,
    });

    return sequence;
  },

  getTeachingSequence(sequenceId: string, schoolId: string): TeachingSequence {
    const seq = sequenceStore.get(sequenceId);
    if (!seq || seq.schoolId !== schoolId) {
      throw new Error(`Teaching sequence not found or unauthorized: ${sequenceId}`);
    }
    return seq;
  },

  listTeachingSequences(schoolId: string, classGroupId?: string): TeachingSequence[] {
    const list: TeachingSequence[] = [];
    for (const seq of sequenceStore.values()) {
      if (seq.schoolId === schoolId && (!classGroupId || seq.classGroupId === classGroupId)) {
        list.push(seq);
      }
    }
    return list;
  },

  // 2. Lesson Sequence Entry Tracking (Planned vs Delivered)
  addLessonSequenceEntry(params: {
    schoolId: string;
    teacherId: string;
    teachingSequenceId: string;
    classGroupId: string;
    teachingAllocationId: string;
    lessonReviewId?: string;
    nextLessonPlanId?: string;
    sequenceNumber: number;
    plannedFocus: string;
    actualFocus?: string;
    entryStatus?: SequenceEntryStatus;
    plannedDate: string;
    deliveredDate?: string;
    idempotencyKey?: string;
  }): LessonSequenceEntry {
    TeachingReflectionService.authorizeTeacherForClassGroup(params.schoolId, params.teacherId, params.classGroupId);

    if (params.idempotencyKey && idempotencyStore.has(params.idempotencyKey)) {
      const existingId = idempotencyStore.get(params.idempotencyKey)!;
      return entryStore.get(existingId)!;
    }

    const entryId = `entry_${params.schoolId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const entry: LessonSequenceEntry = {
      id: entryId,
      teachingSequenceId: params.teachingSequenceId,
      schoolId: params.schoolId,
      classGroupId: params.classGroupId,
      teachingAllocationId: params.teachingAllocationId,
      lessonReviewId: params.lessonReviewId,
      nextLessonPlanId: params.nextLessonPlanId,
      sequenceNumber: params.sequenceNumber,
      plannedFocus: params.plannedFocus,
      actualFocus: params.actualFocus,
      entryStatus: params.entryStatus || 'PLANNED',
      plannedDate: params.plannedDate,
      deliveredDate: params.deliveredDate,
      createdAt: now,
      updatedAt: now,
    };

    entryStore.set(entryId, entry);

    if (params.idempotencyKey) {
      idempotencyStore.set(params.idempotencyKey, entryId);
    }

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'LESSON_SEQUENCE_ENTRY_CREATED',
      entryId,
      teachingAllocationId: params.teachingAllocationId,
    });

    return entry;
  },

  getEntriesForSequence(sequenceId: string, schoolId: string): LessonSequenceEntry[] {
    const seq = this.getTeachingSequence(sequenceId, schoolId);
    const entries: LessonSequenceEntry[] = [];
    for (const entry of entryStore.values()) {
      if (entry.teachingSequenceId === seq.id && entry.schoolId === schoolId) {
        entries.push(entry);
      }
    }
    return entries.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  },

  updateSequenceEntryStatus(params: {
    entryId: string;
    schoolId: string;
    teacherId: string;
    entryStatus: SequenceEntryStatus;
    actualFocus?: string;
    lessonReviewId?: string;
    nextLessonPlanId?: string;
    deliveredDate?: string;
  }): LessonSequenceEntry {
    const entry = entryStore.get(params.entryId);
    if (!entry || entry.schoolId !== params.schoolId) {
      throw new Error(`Lesson sequence entry not found or unauthorized: ${params.entryId}`);
    }
    TeachingReflectionService.authorizeTeacherForClassGroup(params.schoolId, params.teacherId, entry.classGroupId);

    entry.entryStatus = params.entryStatus;
    if (params.actualFocus) entry.actualFocus = params.actualFocus;
    if (params.lessonReviewId) entry.lessonReviewId = params.lessonReviewId;
    if (params.nextLessonPlanId) entry.nextLessonPlanId = params.nextLessonPlanId;
    if (params.deliveredDate) entry.deliveredDate = params.deliveredDate;
    entry.updatedAt = new Date().toISOString();

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'LESSON_SEQUENCE_ENTRY_UPDATED',
      entryId: params.entryId,
      entryStatus: params.entryStatus,
    });

    return entry;
  },

  // 3. Continuity Issues & Carry-Forward
  recordContinuityIssue(params: {
    schoolId: string;
    teacherId: string;
    classGroupId: string;
    sourceLessonReviewId: string;
    issueType: ContinuityIssueType;
    description: string;
  }): ContinuityIssue {
    TeachingReflectionService.authorizeTeacherForClassGroup(params.schoolId, params.teacherId, params.classGroupId);

    const issueId = `issue_${params.schoolId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const issue: ContinuityIssue = {
      id: issueId,
      schoolId: params.schoolId,
      classGroupId: params.classGroupId,
      sourceLessonReviewId: params.sourceLessonReviewId,
      issueType: params.issueType,
      description: params.description,
      status: 'OPEN',
      createdAt: now,
    };

    issueStore.set(issueId, issue);

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'CONTINUITY_ISSUE_RECORDED',
      issueId,
      issueType: params.issueType,
    });

    return issue;
  },

  getOpenIssues(schoolId: string, classGroupId: string): ContinuityIssue[] {
    const issues: ContinuityIssue[] = [];
    for (const issue of issueStore.values()) {
      if (issue.schoolId === schoolId && issue.classGroupId === classGroupId && issue.status !== 'RESOLVED') {
        issues.push(issue);
      }
    }
    return issues;
  },

  // 4. Follow-Through Actions (Teacher-Approved Recommendations)
  createFollowThroughAction(params: {
    schoolId: string;
    teacherId: string;
    classGroupId: string;
    sourceLessonReviewId: string;
    recommendationId: string;
    teacherNotes?: string;
  }): FollowThroughAction {
    TeachingReflectionService.authorizeTeacherForClassGroup(params.schoolId, params.teacherId, params.classGroupId);

    const recommendations = TeachingReflectionService.getRecommendations(params.sourceLessonReviewId, params.schoolId);
    const rec = recommendations.find((r) => r.id === params.recommendationId);
    if (!rec) {
      throw new Error(`Recommendation not found: ${params.recommendationId}`);
    }

    const ftId = `ft_${params.schoolId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const action: FollowThroughAction = {
      id: ftId,
      schoolId: params.schoolId,
      teacherId: params.teacherId,
      classGroupId: params.classGroupId,
      sourceLessonReviewId: params.sourceLessonReviewId,
      recommendationId: params.recommendationId,
      actionType: rec.recommendationType,
      teacherDecision: rec.status,
      teacherNotes: params.teacherNotes,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    followThroughStore.set(ftId, action);

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'FOLLOW_THROUGH_ACTION_CREATED',
      followThroughId: ftId,
      actionType: rec.recommendationType,
    });

    return action;
  },

  getFollowThroughActions(schoolId: string, classGroupId: string): FollowThroughAction[] {
    const list: FollowThroughAction[] = [];
    for (const ft of followThroughStore.values()) {
      if (ft.schoolId === schoolId && ft.classGroupId === classGroupId) {
        list.push(ft);
      }
    }
    return list;
  },

  // 5. Comprehensive Instructional Continuity Layer
  getInstructionalContinuity(params: {
    schoolId: string;
    teacherId: string;
    classGroupId: string;
    currentTeachingAllocationId: string;
    learningAreaId: string;
  }): InstructionalContinuity {
    TeachingReflectionService.authorizeTeacherForClassGroup(params.schoolId, params.teacherId, params.classGroupId);

    const reviews = TeachingReflectionService.listLessonReviews(params.schoolId, params.classGroupId);
    // Sort by lessonDate / creation descending
    reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const latestReview = reviews.length > 0 ? reviews[0] : undefined;
    let previousLessonContext: InstructionalContinuity['previousLesson'] = undefined;

    if (latestReview) {
      const reflection = TeachingReflectionService.getReflectionForReview(latestReview.id, params.schoolId);
      const evidence = TeachingReflectionService.getLessonEvidenceSummary(latestReview.id, params.schoolId);
      const openIssues = this.getOpenIssues(params.schoolId, params.classGroupId).filter(
        (i) => i.sourceLessonReviewId === latestReview.id
      );
      const followThroughs = this.getFollowThroughActions(params.schoolId, params.classGroupId).filter(
        (ft) => ft.sourceLessonReviewId === latestReview.id
      );

      previousLessonContext = {
        reviewId: latestReview.id,
        intendedFocus: `Learning Outcome IDs: ${latestReview.learningOutcomeIds.join(', ')}`,
        actualFocus: reflection?.whatWorked || 'Delivered lesson outcomes',
        deliveryStatus: latestReview.deliveryStatus,
        keyEvidence: [
          `Attendance: ${evidence.attendanceCount.present}/${evidence.attendanceCount.total}`,
          `Assessment Evidence: ${evidence.assessmentEvidenceCount} records`,
          `Mastery: ${evidence.interpretationBreakdown.mastered} mastered`,
        ],
        reflection,
        unresolvedIssues: openIssues,
        approvedAction: followThroughs.length > 0 ? followThroughs[0] : undefined,
      };
    }

    const openIssuesAll = this.getOpenIssues(params.schoolId, params.classGroupId);
    const activeFollowThroughsAll = this.getFollowThroughActions(params.schoolId, params.classGroupId).filter(
      (ft) => ft.status === 'PENDING'
    );

    // Determine continuity status deterministically
    let continuityStatus: ContinuityStatus = 'ON_TRACK';
    let explanation = 'Instructional flow is operating smoothly on track with planned curriculum objectives.';

    if (latestReview) {
      const reflection = TeachingReflectionService.getReflectionForReview(latestReview.id, params.schoolId);
      const evidence = TeachingReflectionService.getLessonEvidenceSummary(latestReview.id, params.schoolId);

      if (reflection?.pacing === 'TOO_SLOW') {
        continuityStatus = 'RETEACH_REQUIRED';
        explanation = 'Previous lesson observed pacing as too slow. Reteaching is required.';
      } else if (reflection?.learnerResponse === 'LIMITED' || evidence.interpretationBreakdown.insufficientEvidence > 5) {
        continuityStatus = 'REASSESSMENT_REQUIRED';
        explanation = 'Limited learner response or insufficient evidence captured; reassessment is recommended.';
      } else if (evidence.interpretationBreakdown.belowExpectation > 0 || evidence.interpretationBreakdown.developing > evidence.interpretationBreakdown.mastered) {
        continuityStatus = 'REINFORCEMENT_REQUIRED';
        explanation = 'Assessment evidence reveals developing understanding or learning gaps requiring reinforcement.';
      } else if (openIssuesAll.length > 0 || activeFollowThroughsAll.length > 0) {
        continuityStatus = 'FOLLOW_UP_REQUIRED';
        explanation = 'There are unresolved instructional issues or pending follow-through actions from previous sessions.';
      } else if (evidence.interpretationBreakdown.mastered > evidence.interpretationBreakdown.developing * 2) {
        continuityStatus = 'EXTENSION_AVAILABLE';
        explanation = 'Strong mastery demonstrated across majority of learners; extension activities are available.';
      }
    }

    return {
      classGroupId: params.classGroupId,
      learningAreaId: params.learningAreaId,
      previousLesson: previousLessonContext,
      currentLesson: {
        teachingAllocationId: params.currentTeachingAllocationId,
        plannedFocus: 'Scheduled current lesson based on canonical teaching allocation and teaching plan.',
        relevantPreviousContext: latestReview ? `Carrying forward from lesson review ${latestReview.id}` : 'Initial session in sequence.',
        outstandingFollowThrough: activeFollowThroughsAll,
      },
      nextLesson: {
        plannedNextStep: 'Proceed to subsequent curriculum strand allocation according to KICD teaching plan.',
        teacherApprovedAdjustment: activeFollowThroughsAll.length > 0 ? activeFollowThroughsAll[0].actionType : undefined,
        requiredPreparation: ['Review previous evidence summary', 'Ensure core learning resources are ready'],
        outstandingEvidenceActions: openIssuesAll.map((i) => i.description),
      },
      continuityStatus,
      explanation,
    };
  },

  // 6. Continuity Evidence Summary
  getContinuityEvidenceSummary(sequenceId: string, schoolId: string): ContinuityEvidenceSummary {
    const seq = this.getTeachingSequence(sequenceId, schoolId);
    const entries = this.getEntriesForSequence(sequenceId, schoolId);
    const openIssues = this.getOpenIssues(schoolId, seq.classGroupId);
    const followThroughs = this.getFollowThroughActions(schoolId, seq.classGroupId);

    return {
      sequenceId,
      totalLessonsPlanned: entries.length,
      totalLessonsDelivered: entries.filter((e) => e.entryStatus === 'DELIVERED' || e.entryStatus === 'COMPLETED').length,
      totalReviewsCompleted: entries.filter((e) => e.lessonReviewId).length,
      openIssuesCount: openIssues.length,
      activeFollowThroughs: followThroughs.filter((ft) => ft.status === 'PENDING').length,
    };
  },
};
