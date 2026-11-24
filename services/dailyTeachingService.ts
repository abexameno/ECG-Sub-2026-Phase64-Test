import {
  TodayLessonView,
  LessonResourceSummary,
  NextLessonSummary,
  LessonReviewSummary,
} from '../types/dailyTeaching.ts';
import { SchoolConfigService } from './schoolConfigService.ts';
import { CanonicalCurriculumService } from './canonicalCurriculumService.ts';
import { TeachingPlanService } from './teachingPlanService.ts';
import { TeacherWorkspaceService } from './teacherWorkspaceService.ts';
import { TeachingActivityService } from './teachingActivityService.ts';
import { AssessmentEvidenceService } from './assessmentEvidenceService.ts';
import { LearningOutcomeInterpretationService } from './learningOutcomeInterpretationService.ts';
import { ContentArtifactRepository } from './contentArtifactRepository.ts';
import { AuditService } from './auditService.ts';
import { AcademicOperationsService } from './academicOperationsService.ts';
import { TeachingActivity, LearnerActivity } from '../types/activity.ts';
import { AssessmentAttempt } from '../types/assessmentEvidence.ts';

export const DailyTeachingService = {
  // 1. TODAY'S LESSON RESOLUTION (DETERMINISTIC FROM TEACHING PLAN)
  resolveTodayLesson(
    teacherId: string,
    schoolId: string,
    classGroupId?: string,
    learningAreaId?: string
  ): TodayLessonView | null {
    if (!SchoolConfigService.isRegisteredSchool(schoolId)) {
      throw new Error(`Unauthorized or invalid school: ${schoolId}`);
    }
    const school = SchoolConfigService.getSchoolProfile(schoolId);

    const context = TeacherWorkspaceService.getTeacherContext(teacherId, schoolId, classGroupId, learningAreaId);
    const curriculum = CanonicalCurriculumService.getCurriculum();

    const teachingPlan = TeachingPlanService.generateTeachingPlan(
      context.schoolId,
      context.gradeId,
      context.learningAreaId,
      context.termId
    );

    if (!teachingPlan || !teachingPlan.weeks || teachingPlan.weeks.length === 0) {
      return {
        schoolId: context.schoolId,
        teacherId,
        teachingPlanId: 'none',
        teachingAllocationId: 'none',
        curriculumVersionId: curriculum.version,
        grade: context.gradeId === 'grade-8' ? 'Grade 8' : context.gradeId,
        learningArea: context.learningAreaId || 'Integrated Science',
        term: context.termId,
        weekNumber: 1,
        lessonNumber: 1,
        strandTitle: 'Curriculum Strand',
        subStrandTitle: 'Sub-Strand',
        topicTitle: 'No Teaching Plan Generated',
        learningOutcomeId: 'none',
        learningOutcomeStatement: 'No active teaching plan found for this learning area and term.',
        status: 'NOT_STARTED',
        resources: [],
        exceptionCode: 'NO_TEACHING_PLAN',
        exceptionMessage: 'No teaching plan found for this learning area and term. Generate a teaching plan to start pacing lessons.',
      };
    }

    // Deterministically find the current lesson slot
    // First, find the earliest uncompleted slot in the teaching plan
    let targetWeek = teachingPlan.weeks[0];
    let targetSlot = targetWeek.lessonSlots[0];

    if (!targetSlot) {
      return null;
    }

    // Check if any activity is in progress or completed
    let found = false;
    for (const week of teachingPlan.weeks) {
      for (const slot of week.lessonSlots) {
        const allocationId = `week_${week.weekNumber}_lesson_${slot.lessonNumber}`;
        const activityId = `tact_${context.schoolId}_${teachingPlan.id}_${allocationId}`;
        try {
          const act = TeachingActivityService.getTeachingActivity(activityId, context.schoolId);
          if (act.status !== 'COMPLETED') {
            targetWeek = week;
            targetSlot = slot;
            found = true;
            break;
          }
        } catch {
          // No activity started yet for this slot
          targetWeek = week;
          targetSlot = slot;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    // If all slots are completed
    let isTermCompleted = false;
    if (!found) {
      isTermCompleted = true;
      // Default to last slot for display
      const lastWeek = teachingPlan.weeks[teachingPlan.weeks.length - 1];
      targetWeek = lastWeek;
      targetSlot = lastWeek.lessonSlots[lastWeek.lessonSlots.length - 1];
    }

    const teachingAllocationId = `week_${targetWeek.weekNumber}_lesson_${targetSlot.lessonNumber}`;
    const activityId = `tact_${context.schoolId}_${teachingPlan.id}_${teachingAllocationId}`;

    let activity: TeachingActivity | undefined;
    try {
      activity = TeachingActivityService.getTeachingActivity(activityId, context.schoolId);
    } catch {
      // Not yet created in activity store
    }

    const strand = targetSlot.strandId
      ? CanonicalCurriculumService.getStrands(context.learningAreaId).find(s => s.id === targetSlot.strandId)
      : undefined;
    const subStrand = targetSlot.subStrandId && targetSlot.strandId
      ? CanonicalCurriculumService.getSubStrands(targetSlot.strandId).find(ss => ss.id === targetSlot.subStrandId)
      : undefined;
    const outcomeId = targetSlot.learningOutcomeIds?.[0] || 'lo_sci_g8_01';
    const outcome = CanonicalCurriculumService.getLearningOutcomes(targetSlot.subStrandId || '').find(o => o.id === outcomeId)
      || { id: outcomeId, statement: 'Identify physical properties of materials and their practical applications.' };

    // Resolve available resources
    const artifacts = ContentArtifactRepository.list(context.schoolId, {
      gradeLevelId: context.gradeId,
      learningAreaId: context.learningAreaId,
    });

    const lpArtifact = artifacts.find(a => a.artifactType === 'lesson_plan');
    const notesArtifact = artifacts.find(a => a.artifactType === 'learning_activity' || a.artifactType === 'learner_content');
    const sowArtifact = artifacts.find(a => a.artifactType === 'scheme_of_work');

    const resources: LessonResourceSummary[] = [
      {
        type: 'LESSON_PLAN',
        title: lpArtifact ? 'Lesson Plan: Properties of Materials' : 'Lesson Plan (Unprepared)',
        isAvailable: !!lpArtifact,
        artifactId: lpArtifact?.id,
        artifactVersion: lpArtifact?.version,
      },
      {
        type: 'LESSON_NOTES',
        title: notesArtifact ? 'Learner Lesson Notes: Properties of Materials' : 'Lesson Notes (Unprepared)',
        isAvailable: !!notesArtifact,
        artifactId: notesArtifact?.id,
        artifactVersion: notesArtifact?.version,
      },
      {
        type: 'SCHEME_OF_WORK',
        title: sowArtifact ? `${context.termId} Scheme of Work` : 'Scheme of Work (Unprepared)',
        isAvailable: !!sowArtifact,
        artifactId: sowArtifact?.id,
        artifactVersion: sowArtifact?.version,
      },
      {
        type: 'ASSESSMENT',
        title: 'Topical Assessment: Properties of Materials',
        isAvailable: true,
        assessmentId: `asmt_${context.schoolId}_prop_mat`,
      },
    ];

    // Resolve next lesson
    const nextLesson = this.getNextLesson(teacherId, context.schoolId, teachingPlan.id, teachingAllocationId, classGroupId, learningAreaId);

    const todayStr = new Date().toISOString().split('T')[0];
    const dayView = AcademicOperationsService.getAcademicDayView(context.schoolId, todayStr);
    let operationalNotice: string | undefined;
    if (!dayView.isTeachingDay) {
      operationalNotice = dayView.dayType === 'SCHOOL_CLOSED'
        ? 'School is closed today due to an administrative or weather event.'
        : 'Today is scheduled as a non-teaching day / holiday.';
    }

    return {
      schoolId: context.schoolId,
      teacherId,
      teachingPlanId: teachingPlan.id,
      teachingAllocationId,
      curriculumVersionId: curriculum.version,
      grade: context.gradeId === 'grade-8' ? 'Grade 8' : context.gradeId,
      learningArea: 'Integrated Science',
      term: context.termId,
      weekNumber: targetWeek.weekNumber,
      lessonNumber: targetSlot.lessonNumber,
      strandTitle: strand?.title || 'Science and Technology',
      subStrandTitle: subStrand?.title || 'Properties of Materials',
      topicTitle: 'Physical and Chemical Properties',
      learningOutcomeId: outcomeId,
      learningOutcomeStatement: outcome.statement,
      status: isTermCompleted ? 'COMPLETED' : (activity ? activity.status : 'NOT_STARTED'),
      activityId: activity?.activityId,
      startedAt: activity?.startedAt,
      deliveredAt: activity?.deliveredAt,
      completedAt: activity?.completedAt,
      completionEvidence: activity?.completionEvidence,
      resources,
      nextLesson: nextLesson || undefined,
      isTeachingDay: dayView.isTeachingDay,
      dayType: dayView.dayType,
      operationalNotice,
      exceptionCode: isTermCompleted ? 'COMPLETED_TERM' : undefined,
      exceptionMessage: isTermCompleted ? 'All scheduled lessons for this term have been completed!' : undefined,
    };
  },

  // 2. START LESSON (EXPLICIT TEACHER ACTION, IDEMPOTENT)
  startLesson(
    teacherId: string,
    schoolId: string,
    teachingPlanId: string,
    teachingAllocationId: string,
    learningOutcomeId: string,
    artifactId?: string,
    artifactVersion?: number
  ): TeachingActivity {
    if (!SchoolConfigService.isRegisteredSchool(schoolId)) {
      throw new Error(`Unauthorized or invalid school: ${schoolId}`);
    }

    const curriculum = CanonicalCurriculumService.getCurriculum();

    // Create or retrieve existing activity
    const activity = TeachingActivityService.createTeachingActivity({
      schoolId,
      teacherId,
      teachingPlanId,
      teachingAllocationId,
      curriculumVersionId: curriculum.version,
      learningOutcomeId,
      artifactId,
      artifactVersion,
      activityType: 'LESSON_DELIVERY',
    });

    const startedActivity = TeachingActivityService.startTeachingActivity(
      activity.activityId,
      schoolId,
      teacherId
    );

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'CLASSROOM_LESSON_STARTED',
      teacherId,
      activityId: startedActivity.activityId,
      teachingAllocationId,
      artifactVersionUsed: artifactVersion,
    });

    return startedActivity;
  },

  // 3. MARK DELIVERED (EXPLICIT DELIVERY CONFIRMATION)
  markDelivered(teacherId: string, schoolId: string, activityId: string): TeachingActivity {
    const activity = TeachingActivityService.deliverTeachingActivity(
      activityId,
      schoolId,
      teacherId
    );

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'CLASSROOM_LESSON_MARKED_DELIVERED',
      teacherId,
      activityId,
    });

    return activity;
  },

  // 4. RECORD LEARNER ACTIVITY
  recordLearnerActivity(params: {
    teacherId: string;
    schoolId: string;
    learnerId: string;
    teachingPlanId: string;
    teachingAllocationId: string;
    learningOutcomeId: string;
    activityType: 'LESSON_ENGAGEMENT' | 'PRACTICE_EXERCISE' | 'ASSIGNMENT_SUBMISSION' | 'ASSESSMENT';
    evidenceReference?: string;
    artifactId?: string;
    artifactVersion?: number;
  }): LearnerActivity {
    const school = SchoolConfigService.getSchoolProfile(params.schoolId);
    if (!school) {
      throw new Error(`Unauthorized or invalid school: ${params.schoolId}`);
    }

    const curriculum = CanonicalCurriculumService.getCurriculum();

    const activity = TeachingActivityService.createLearnerActivity({
      schoolId: params.schoolId,
      learnerId: params.learnerId,
      teachingPlanId: params.teachingPlanId,
      teachingAllocationId: params.teachingAllocationId,
      curriculumVersionId: curriculum.version,
      learningOutcomeId: params.learningOutcomeId,
      activityType: params.activityType,
      artifactId: params.artifactId,
      artifactVersion: params.artifactVersion,
    });

    TeachingActivityService.startLearnerActivity(activity.activityId, params.schoolId, params.learnerId);

    if (params.evidenceReference) {
      TeachingActivityService.submitLearnerActivity(
        activity.activityId,
        params.schoolId,
        params.learnerId,
        params.evidenceReference
      );
    }

    const completed = TeachingActivityService.completeLearnerActivity(
      activity.activityId,
      params.schoolId,
      params.teacherId,
      'teacher'
    );

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'CLASSROOM_LEARNER_ACTIVITY_RECORDED',
      teacherId: params.teacherId,
      learnerId: params.learnerId,
      activityId: completed.activityId,
    });

    return completed;
  },

  // 5. LAUNCH & RECORD ASSESSMENT
  recordLearnerAssessmentAttempt(params: {
    teacherId: string;
    schoolId: string;
    assessmentId: string;
    learnerId: string;
    responses: Array<{
      itemId: string;
      selectedOption?: string;
      textResponse?: string;
    }>;
  }): AssessmentAttempt {
    if (!SchoolConfigService.isRegisteredSchool(params.schoolId)) {
      throw new Error(`Unauthorized or invalid school: ${params.schoolId}`);
    }

    const attempt = AssessmentEvidenceService.startAttempt({
      assessmentId: params.assessmentId,
      schoolId: params.schoolId,
      learnerId: params.learnerId,
    });

    const submittedResponses = params.responses.map(r => ({
      itemId: r.itemId,
      response: (r.selectedOption || r.textResponse || '') as string,
    }));

    const result = AssessmentEvidenceService.submitAttempt(
      attempt.attemptId,
      params.schoolId,
      params.learnerId,
      submittedResponses
    );

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'CLASSROOM_ASSESSMENT_EVALUATED',
      teacherId: params.teacherId,
      learnerId: params.learnerId,
      assessmentId: params.assessmentId,
    });

    return result.attempt;
  },

  // 6. COMPLETE LESSON (EXPLICIT CONFIRMATION REQUIRED)
  completeLesson(
    teacherId: string,
    schoolId: string,
    activityId: string,
    completionNotes?: string
  ): TeachingActivity {
    const activity = TeachingActivityService.completeTeachingActivity(
      activityId,
      schoolId,
      teacherId,
      completionNotes || 'Lesson completed successfully in regular classroom session.'
    );

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'CLASSROOM_LESSON_COMPLETED',
      teacherId,
      activityId,
    });

    return activity;
  },

  // 7. CORRECT OR REVOKE LESSON COMPLETION
  correctLessonCompletion(
    teacherId: string,
    schoolId: string,
    activityId: string,
    reason: string
  ): TeachingActivity {
    const activity = TeachingActivityService.revokeOrCorrectCompletion(
      activityId,
      schoolId,
      teacherId,
      reason
    );

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'CLASSROOM_LESSON_COMPLETION_CORRECTED',
      teacherId,
      activityId,
      reason,
    });

    return activity;
  },

  // 8. LESSON REVIEW SUMMARY (CONSUMES PHASE 14 INTERPRETATIONS WITHOUT INVENTING MASTERY)
  getLessonReviewSummary(
    teacherId: string,
    schoolId: string,
    learningOutcomeId: string,
    learnerIds: string[]
  ): LessonReviewSummary {
    const school = SchoolConfigService.getSchoolProfile(schoolId);
    if (!school) {
      throw new Error(`Unauthorized or invalid school: ${schoolId}`);
    }

    const curriculum = CanonicalCurriculumService.getCurriculum();
    const outcome = CanonicalCurriculumService.getLearningOutcomes('ss_sci_g8_01').find(o => o.id === learningOutcomeId)
      || { id: learningOutcomeId, statement: 'Explain physical and chemical properties of materials.' };

    let strongCount = 0;
    let developingCount = 0;
    let insufficientCount = 0;

    const learners = learnerIds.map(learnerId => {
      try {
        const interp = LearningOutcomeInterpretationService.evaluateOutcome({
          learnerId,
          learningOutcomeId,
          schoolId,
          curriculumVersionId: curriculum.version,
          requestingUserId: teacherId,
          requestingRole: 'teacher',
        });

        if (interp.interpretationStatus === 'STRONG_DEMONSTRATION') strongCount++;
        else if (interp.interpretationStatus === 'DEVELOPING') developingCount++;
        else insufficientCount++;

        return {
          learnerId,
          learnerName: `Learner ${learnerId}`,
          status: interp.interpretationStatus,
        };
      } catch {
        insufficientCount++;
        return {
          learnerId,
          learnerName: `Learner ${learnerId}`,
          status: 'INSUFFICIENT_EVIDENCE' as const,
        };
      }
    });

    return {
      learningOutcomeId,
      learningOutcomeStatement: outcome.statement,
      totalLearnersEvaluated: learnerIds.length,
      strongDemonstrationCount: strongCount,
      developingCount: developingCount,
      insufficientEvidenceCount: insufficientCount,
      learners,
    };
  },

  // 9. NEXT LESSON RESOLUTION (DETERMINISTIC FROM TEACHING PLAN)
  getNextLesson(
    teacherId: string,
    schoolId: string,
    teachingPlanId: string,
    currentAllocationId: string,
    classGroupId?: string,
    learningAreaId?: string
  ): NextLessonSummary | null {
    const context = TeacherWorkspaceService.getTeacherContext(teacherId, schoolId, classGroupId, learningAreaId);
    const teachingPlan = TeachingPlanService.generateTeachingPlan(
      schoolId,
      context.gradeId,
      context.learningAreaId,
      context.termId
    );

    // Flatten slots to find next sequential lesson
    const allSlots: Array<{
      weekNumber: number;
      lessonNumber: number;
      allocationId: string;
      strandId?: string;
      subStrandId?: string;
      outcomeId: string;
    }> = [];

    for (const week of teachingPlan.weeks) {
      for (const slot of week.lessonSlots) {
        allSlots.push({
          weekNumber: week.weekNumber,
          lessonNumber: slot.lessonNumber,
          allocationId: `week_${week.weekNumber}_lesson_${slot.lessonNumber}`,
          strandId: slot.strandId,
          subStrandId: slot.subStrandId,
          outcomeId: slot.learningOutcomeIds?.[0] || 'lo_sci_g8_01',
        });
      }
    }

    const currentIndex = allSlots.findIndex(s => s.allocationId === currentAllocationId);
    if (currentIndex === -1 || currentIndex + 1 >= allSlots.length) {
      return null;
    }

    const next = allSlots[currentIndex + 1];
    const outcome = CanonicalCurriculumService.getLearningOutcomes(next.subStrandId || '').find(o => o.id === next.outcomeId)
      || { id: next.outcomeId, statement: 'Demonstrate methods of separating mixtures.' };

    return {
      teachingPlanId: teachingPlan.id,
      teachingAllocationId: next.allocationId,
      weekNumber: next.weekNumber,
      lessonNumber: next.lessonNumber,
      grade: context.gradeId === 'grade-8' ? 'Grade 8' : context.gradeId,
      learningArea: 'Integrated Science',
      topicTitle: 'Separation of Mixtures',
      learningOutcomeId: next.outcomeId,
      learningOutcomeStatement: outcome.statement,
    };
  }
};
