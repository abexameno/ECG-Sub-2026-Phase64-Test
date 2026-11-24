import {
  LearningOutcomeInterpretation,
  InterpretationStatus,
  EvidenceConflictStatus,
  EvidenceMetric,
  AssessmentEvidenceInterpretation,
  LearnerAssessmentInterpretation,
  AssessmentItemAnalytic,
  TeacherSupportInsight,
  TeacherOverride,
  AssessmentAssignmentStatus,
  LO_MASTERY_V1_CONFIG,
  LoMasteryV1Config,
} from '../types/interpretation.ts';
import { AssessmentEvidenceService } from './assessmentEvidenceService.ts';
import { AuditService } from './auditService.ts';
import { SchoolMembershipService } from './schoolMembershipService.ts';
import { LearnerRosterService } from './learnerRosterService.ts';
import { ClassGroupService } from './classGroupService.ts';
import { ContentArtifactRepository } from './contentArtifactRepository.ts';
import { ElmsIntegrationService } from './elmsIntegrationService.ts';
import { PersistentStateService } from './persistentStateService.ts';

const CURRENT_POLICY_VERSION = LO_MASTERY_V1_CONFIG.version;

// In-memory store for outcome interpretations
const interpretationStore = new Map<string, LearningOutcomeInterpretation>();
const assessmentInterpretationStore = new Map<string, AssessmentEvidenceInterpretation>();
const assessmentOverrideStore = new Map<string, TeacherOverride>();

export const LearningOutcomeInterpretationService = {
  CURRENT_POLICY_VERSION,
  POLICY_CONFIG: LO_MASTERY_V1_CONFIG,

  clearStore(): void {
    interpretationStore.clear();
    assessmentInterpretationStore.clear();
    assessmentOverrideStore.clear();
  },

  // 1. EVALUATION & INTERPRETATION ENGINE
  evaluateOutcome(params: {
    learnerId: string;
    learningOutcomeId: string;
    schoolId: string;
    curriculumVersionId: string;
    requestingUserId: string;
    requestingRole: 'teacher' | 'learner' | 'system';
    policyVersion?: string;
  }): LearningOutcomeInterpretation {
    const policyVersion = params.policyVersion || CURRENT_POLICY_VERSION;

    // Retrieve evidence via AssessmentEvidenceService
    const evidenceSummary = AssessmentEvidenceService.getLearnerOutcomeEvidence(
      params.learnerId,
      params.learningOutcomeId,
      params.schoolId,
      params.requestingUserId,
      params.requestingRole
    );

    const validEvidence = evidenceSummary.evidenceList.filter(e => !e.isVoided);
    const evidenceCount = validEvidence.length;
    const supportingEvidenceIds = validEvidence.map(e => e.evidenceId);

    // Rule 1: Zero valid evidence records -> INSUFFICIENT_EVIDENCE
    if (evidenceCount === 0) {
      const emptyMetrics: EvidenceMetric = {
        totalEvidenceCount: 0,
        validEvidenceCount: 0,
        assessmentResultCount: 0,
        teacherEvaluationCount: 0,
      };

      const interpretation: LearningOutcomeInterpretation = {
        interpretationId: `interp_${params.schoolId}_${params.learnerId}_${params.learningOutcomeId}`,
        schoolId: params.schoolId,
        learnerId: params.learnerId,
        curriculumVersionId: params.curriculumVersionId,
        learningOutcomeId: params.learningOutcomeId,
        interpretationStatus: 'INSUFFICIENT_EVIDENCE',
        evidenceCount: 0,
        conflictStatus: 'NOT_APPLICABLE',
        metrics: emptyMetrics,
        evaluatedAt: new Date().toISOString(),
        interpretationPolicyVersion: policyVersion,
        explanation: 'Insufficient evidence: No valid assessment or evaluation records exist for this outcome.',
        supportingEvidenceIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      interpretationStore.set(interpretation.interpretationId, interpretation);
      return interpretation;
    }

    // Compute metrics
    const percentages: number[] = [];
    let assessmentResultCount = 0;
    let teacherEvaluationCount = 0;
    let latestDate = '';

    for (const ev of validEvidence) {
      if (typeof ev.percentage === 'number') {
        percentages.push(ev.percentage);
      }
      if (ev.evidenceType === 'ASSESSMENT_RESULT') assessmentResultCount++;
      if (ev.evidenceType === 'TEACHER_EVALUATION') teacherEvaluationCount++;
      if (!latestDate || new Date(ev.recordedAt) > new Date(latestDate)) {
        latestDate = ev.recordedAt;
      }
    }

    const highest = percentages.length > 0 ? Math.max(...percentages) : undefined;
    const lowest = percentages.length > 0 ? Math.min(...percentages) : undefined;
    const avg = percentages.length > 0
      ? Number((percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(1))
      : undefined;

    const metrics: EvidenceMetric = {
      totalEvidenceCount: evidenceSummary.totalEvidenceRecords,
      validEvidenceCount: evidenceCount,
      assessmentResultCount,
      teacherEvaluationCount,
      latestEvidenceDate: latestDate,
      highestScorePercentage: highest,
      lowestScorePercentage: lowest,
      averagePercentage: avg,
    };

    // Determine Conflict Status
    let conflictStatus: EvidenceConflictStatus = 'CONSISTENT';
    if (highest !== undefined && lowest !== undefined && (highest - lowest) > LO_MASTERY_V1_CONFIG.highConflictDelta) {
      conflictStatus = 'HIGH_CONFLICT';
    } else if (highest !== undefined && lowest !== undefined && (highest - lowest) > LO_MASTERY_V1_CONFIG.moderateVarianceDelta) {
      conflictStatus = 'MODERATE_VARIANCE';
    }

    // Determine Interpretation Status based on Policy
    let status: InterpretationStatus = 'DEVELOPING';
    let explanation = '';

    if (evidenceCount < LO_MASTERY_V1_CONFIG.minCorroboratingAttempts) {
      // Single evidence record cannot alone declare full DEMONSTRATED without corroboration
      const singleScore = percentages[0] ?? 0;
      if (singleScore >= 80) {
        status = 'DEVELOPING';
        explanation = `Single high score (${singleScore}%) indicates positive progress but requires corroborating evidence for full demonstration under ${policyVersion}.`;
      } else if (singleScore >= LO_MASTERY_V1_CONFIG.developingMinAvg) {
        status = 'DEVELOPING';
        explanation = `Single assessment record (${singleScore}%) demonstrates developing competency.`;
      } else {
        status = 'EMERGING';
        explanation = `Initial assessment record (${singleScore}%) indicates emerging understanding; additional practice recommended.`;
      }
    } else {
      // 2 or more evidence records
      if (avg !== undefined && avg >= LO_MASTERY_V1_CONFIG.strongMinAvg && (lowest === undefined || lowest >= LO_MASTERY_V1_CONFIG.strongMinFloor)) {
        status = 'STRONG_DEMONSTRATION';
        explanation = `Consistent high performance across ${evidenceCount} evidence records (average ${avg}%, lowest ${lowest}%). Demonstrates thorough competency.`;
      } else if (avg !== undefined && avg >= LO_MASTERY_V1_CONFIG.demonstratedMinAvg && (lowest === undefined || lowest >= LO_MASTERY_V1_CONFIG.demonstratedMinFloor)) {
        status = 'DEMONSTRATED';
        explanation = `Satisfactory demonstration across ${evidenceCount} evidence records (average ${avg}%). Meets curriculum outcome standards.`;
      } else if (conflictStatus === 'HIGH_CONFLICT') {
        status = 'DEVELOPING';
        explanation = `High variance in evidence records (${lowest}% to ${highest}%). Retaining DEVELOPING status pending teacher review or confirmation.`;
      } else if (avg !== undefined && avg >= LO_MASTERY_V1_CONFIG.developingMinAvg) {
        status = 'DEVELOPING';
        explanation = `Developing demonstration across ${evidenceCount} evidence records (average ${avg}%).`;
      } else {
        status = 'EMERGING';
        explanation = `Emerging performance across ${evidenceCount} evidence records (average ${avg}%). Targeted support suggested.`;
      }
    }

    const interpretationId = `interp_${params.schoolId}_${params.learnerId}_${params.learningOutcomeId}`;
    const existing = interpretationStore.get(interpretationId);

    const interpretation: LearningOutcomeInterpretation = {
      interpretationId,
      schoolId: params.schoolId,
      learnerId: params.learnerId,
      curriculumVersionId: params.curriculumVersionId,
      learningOutcomeId: params.learningOutcomeId,
      interpretationStatus: existing?.teacherOverride ? existing.teacherOverride.overriddenStatus : status,
      evidenceCount,
      conflictStatus,
      metrics,
      evaluatedAt: new Date().toISOString(),
      interpretationPolicyVersion: policyVersion,
      explanation: existing?.teacherOverride ? `Teacher Override: ${existing.teacherOverride.reason} (originally ${status})` : explanation,
      supportingEvidenceIds,
      teacherOverride: existing?.teacherOverride,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    interpretationStore.set(interpretationId, interpretation);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'LEARNING_OUTCOME_INTERPRETED',
      interpretationId,
      learnerId: params.learnerId,
      learningOutcomeId: params.learningOutcomeId,
      status: interpretation.interpretationStatus,
      policyVersion,
    });

    return interpretation;
  },

  getInterpretation(
    learnerId: string,
    learningOutcomeId: string,
    requestingSchoolId: string,
    requestingUserId: string,
    requestingRole: 'teacher' | 'learner' | 'system'
  ): LearningOutcomeInterpretation {
    const interpretation = Array.from(interpretationStore.values()).find(
      i => i.learnerId === learnerId && i.learningOutcomeId === learningOutcomeId
    );

    if (!interpretation) {
      throw new Error(`Interpretation not found for learner ${learnerId} and outcome ${learningOutcomeId}`);
    }

    if (interpretation.schoolId !== requestingSchoolId) {
      AuditService.log('SECURITY_VIOLATION', requestingSchoolId, {
        action: 'UNAUTHORIZED_CROSS_SCHOOL_INTERPRETATION_ACCESS',
        targetLearnerId: learnerId,
        actualSchoolId: interpretation.schoolId,
      });
      throw new Error('Unauthorized cross-school access to interpretation');
    }

    if (requestingRole === 'learner' && requestingUserId !== learnerId) {
      AuditService.log('SECURITY_VIOLATION', requestingSchoolId, {
        action: 'UNAUTHORIZED_PEER_INTERPRETATION_ACCESS',
        requestingUserId,
        targetLearnerId: learnerId,
      });
      throw new Error('Unauthorized access: learners cannot view other learners interpretations');
    }

    return interpretation;
  },

  overrideInterpretation(
    interpretationId: string,
    schoolId: string,
    teacherId: string,
    newStatus: InterpretationStatus,
    reason: string
  ): LearningOutcomeInterpretation {
    if (!AssessmentEvidenceService.isAuthorizedTeacher(teacherId, schoolId)) {
      AuditService.log('SECURITY_VIOLATION', schoolId, {
        action: 'UNAUTHORIZED_INTERPRETATION_OVERRIDE_ATTEMPT',
        teacherId,
        schoolId,
        interpretationId,
      });
      throw new Error(`Unauthorized teacher: User ${teacherId} has no active teacher membership in school ${schoolId}`);
    }

    const interpretation = interpretationStore.get(interpretationId);
    if (!interpretation) {
      throw new Error(`Interpretation not found: ${interpretationId}`);
    }
    if (interpretation.schoolId !== schoolId) {
      throw new Error('Unauthorized cross-school access to interpretation');
    }

    const previousStatus = interpretation.interpretationStatus;
    interpretation.teacherOverride = {
      teacherId,
      previousStatus,
      overriddenStatus: newStatus,
      reason,
      recordedAt: new Date().toISOString(),
    };

    interpretation.interpretationStatus = newStatus;
    interpretation.explanation = `Teacher Override by ${teacherId}: ${reason} (previously ${previousStatus})`;
    interpretation.updatedAt = new Date().toISOString();

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'INTERPRETATION_OVERRIDDEN',
      interpretationId,
      teacherId,
      previousStatus,
      newStatus,
      reason,
    });

    return interpretation;
  },

  getInterpretationsBySchool(schoolId: string): LearningOutcomeInterpretation[] {
    const list: LearningOutcomeInterpretation[] = [];
    for (const interp of interpretationStore.values()) {
      if (interp.schoolId === schoolId) {
        list.push({ ...interp });
      }
    }
    return list;
  },

  // 3. PHASE 26 & 27: ELMS ASSESSMENT EVIDENCE → ECG INTERPRETATION ENGINE
  interpretAssessmentEvidence(params: {
    ecgArtifactId: string;
    schoolId: string;
    requestingTeacherId: string;
    classGroupId?: string;
    policyVersion?: string;
  }): AssessmentEvidenceInterpretation {
    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.requestingTeacherId, params.schoolId)) {
      AuditService.log('SECURITY_VIOLATION', params.schoolId, {
        action: 'UNAUTHORIZED_ASSESSMENT_INTERPRETATION_ATTEMPT',
        teacherId: params.requestingTeacherId,
        schoolId: params.schoolId,
        ecgArtifactId: params.ecgArtifactId,
      });
      throw new Error(`Unauthorized teacher: User ${params.requestingTeacherId} is not an authorized teacher in school ${params.schoolId}`);
    }

    // Tenant and authorization validation for classGroupId if supplied
    if (params.classGroupId) {
      const classGroup = ClassGroupService.getClassGroupById(params.classGroupId);
      if (!classGroup || classGroup.schoolId !== params.schoolId) {
        AuditService.log('SECURITY_VIOLATION', params.schoolId, {
          action: 'UNAUTHORIZED_CROSS_SCHOOL_CLASS_GROUP_ACCESS',
          teacherId: params.requestingTeacherId,
          schoolId: params.schoolId,
          classGroupId: params.classGroupId,
        });
        throw new Error(`Unauthorized cross-school access: Class group ${params.classGroupId} not found in school ${params.schoolId}`);
      }
    }

    const policyVersion = params.policyVersion || CURRENT_POLICY_VERSION;

    // Phase 28: Authoritative Context Resolution
    const publication = ElmsIntegrationService.getPublication(params.schoolId, params.ecgArtifactId);
    const assignments = ElmsIntegrationService.getAssignmentsForArtifact(params.schoolId, params.ecgArtifactId);

    let assignmentStatus: AssessmentAssignmentStatus = 'NOT_PUBLISHED';
    let resolvedClassGroupId = params.classGroupId;
    let resolvedAssignmentId: string | undefined = undefined;

    if (!publication) {
      assignmentStatus = 'NOT_PUBLISHED';
    } else if (assignments.length === 0) {
      // Check legacy publication-direct context
      if (publication.classGroupId) {
        assignmentStatus = 'ASSIGNED';
        resolvedClassGroupId = resolvedClassGroupId || publication.classGroupId;
      } else {
        assignmentStatus = 'PUBLISHED_NOT_ASSIGNED';
      }
    } else {
      assignmentStatus = 'ASSIGNED';
      // Use explicit context or default if single assignment
      const activeAssignment = params.classGroupId
        ? assignments.find(a => a.classGroupId === params.classGroupId)
        : (assignments.length === 1 ? assignments[0] : undefined);

      if (activeAssignment) {
        resolvedClassGroupId = activeAssignment.classGroupId;
        resolvedAssignmentId = activeAssignment.assignmentId;
      } else if (assignments.length > 1 && !params.classGroupId) {
        // Multiple assignments exist but no context selected
        // We still let it proceed with any evidence found, but status remains 'ASSIGNED'
      }
    }

    // Retrieve assessment from AssessmentEvidenceService or ContentArtifactRepository
    let assessment = AssessmentEvidenceService.getAssessmentByArtifactId(params.ecgArtifactId, params.schoolId);
    let learningOutcomeId = assessment?.learningOutcomeId || 'slo_default';
    let curriculumVersionId = assessment?.curriculumVersionId || 'kicd_cbe_2026';
    let assessmentItems = assessment?.items || [];

    // Fallback: check ContentArtifactRepository
    const artifact = ContentArtifactRepository.getById(params.ecgArtifactId, params.schoolId);
    if (artifact) {
      if (artifact.curriculumReferences && artifact.curriculumReferences.length > 0) {
        learningOutcomeId = artifact.curriculumReferences[0].learningOutcomeIds?.[0] || learningOutcomeId;
      }
      if (artifact.curriculumVersion) {
        curriculumVersionId = artifact.curriculumVersion;
      }
      if (assessmentItems.length === 0 && artifact.content && Array.isArray((artifact.content as any).questions)) {
        assessmentItems = (artifact.content as any).questions.map((q: any, idx: number) => ({
          itemId: q.id || `item_${params.ecgArtifactId}_${idx + 1}`,
          assessmentId: assessment?.assessmentId || `asmt_${params.ecgArtifactId}`,
          learningOutcomeId,
          sequence: idx + 1,
          type: (q.questionType === 'multiple_choice' ? 'MULTIPLE_CHOICE' : 'STRUCTURED') as any,
          prompt: q.questionText || `Question ${idx + 1}`,
          marks: q.marks || 1,
          correctAnswer: q.correctOption || q.correctAnswer || 'A',
        }));
      }
    }

    // Resolve assigned roster learners if class group context is present
    let assignedLearners: any[] = [];
    if (resolvedClassGroupId) {
      assignedLearners = LearnerRosterService.getLearnersForClassGroup(resolvedClassGroupId, params.schoolId);
    } else if (assignments.length > 0) {
      // Collect learners from all assigned class groups
      const allAssigned: any[] = [];
      const seenIds = new Set<string>();
      for (const asgn of assignments) {
        const roster = LearnerRosterService.getLearnersForClassGroup(asgn.classGroupId, params.schoolId);
        for (const l of roster) {
          if (!seenIds.has(l.id)) {
            seenIds.add(l.id);
            allAssigned.push(l);
          }
        }
      }
      assignedLearners = allAssigned;
    }

    // Retrieve factual ELMS evidence records
    const elmsRecords = AssessmentEvidenceService.getElmsEvidenceRecords(params.schoolId, params.ecgArtifactId);

    // Group records by learnerId
    const learnerMap = new Map<string, typeof elmsRecords>();
    for (const rec of elmsRecords) {
      if (!learnerMap.has(rec.learnerId)) {
        learnerMap.set(rec.learnerId, []);
      }
      learnerMap.get(rec.learnerId)!.push(rec);
    }

    // Build complete set of learners to evaluate (roster assigned + any submitters)
    const assignedLearnerMap = new Map(assignedLearners.map(l => [l.id, l]));
    const allLearnerIds: string[] = [];
    const seenLearnerIds = new Set<string>();

    for (const al of assignedLearners) {
      if (!seenLearnerIds.has(al.id)) {
        seenLearnerIds.add(al.id);
        allLearnerIds.push(al.id);
      }
    }

    // Only add non-assigned submitters if we are NOT in a specific class context
    if (!resolvedClassGroupId) {
      for (const submitterId of learnerMap.keys()) {
        if (!seenLearnerIds.has(submitterId)) {
          seenLearnerIds.add(submitterId);
          allLearnerIds.push(submitterId);
        }
      }
    }

    const learnerInterpretations: LearnerAssessmentInterpretation[] = [];

    let strongCount = 0;
    let demonstratedCount = 0;
    let developingCount = 0;
    let emergingCount = 0;
    let insufficientCount = 0;

    let totalScoresSum = 0;
    let highestScorePercentage = 0;
    let lowestScorePercentage = learnerMap.size > 0 ? 100 : 0;

    for (const learnerId of allLearnerIds) {
      const records = learnerMap.get(learnerId);

      // Check Teacher Override first
      const overrideKey = `${params.schoolId}:${params.ecgArtifactId}:${learnerId}`;
      const existingOverride = assessmentOverrideStore.get(overrideKey);

      if (records && records.length > 0) {
        // A. Learner has submitted assessment evidence
        const percentages = records.map(r => r.percentage);
        const high = Math.max(...percentages);
        const low = Math.min(...percentages);
        // Equal-weighted arithmetic mean across valid attempts (No time-decay)
        const avg = Number((percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(1));

        totalScoresSum += avg;
        if (high > highestScorePercentage) highestScorePercentage = high;
        if (low < lowestScorePercentage) lowestScorePercentage = low;

        // Determine conflict status
        let conflictStatus: EvidenceConflictStatus = 'CONSISTENT';
        if (records.length >= LO_MASTERY_V1_CONFIG.minCorroboratingAttempts) {
          if (high - low > LO_MASTERY_V1_CONFIG.highConflictDelta) {
            conflictStatus = 'HIGH_CONFLICT';
          } else if (high - low > LO_MASTERY_V1_CONFIG.moderateVarianceDelta) {
            conflictStatus = 'MODERATE_VARIANCE';
          }
        } else {
          conflictStatus = 'NOT_APPLICABLE';
        }

        // Determine baseline deterministic status (LO-MASTERY-V1 policy)
        let status: InterpretationStatus = 'DEVELOPING';
        let explanation = '';

        if (records.length < LO_MASTERY_V1_CONFIG.minCorroboratingAttempts) {
          if (avg >= 80) {
            status = 'DEVELOPING';
            explanation = `Single high score (${avg}%) indicates positive progress but requires corroborating evidence under ${policyVersion}.`;
          } else if (avg >= LO_MASTERY_V1_CONFIG.developingMinAvg) {
            status = 'DEVELOPING';
            explanation = `Single assessment attempt (${avg}%) demonstrates developing competency.`;
          } else {
            status = 'EMERGING';
            explanation = `Initial assessment attempt (${avg}%) indicates emerging understanding; targeted practice recommended.`;
          }
        } else {
          if (avg >= LO_MASTERY_V1_CONFIG.strongMinAvg && low >= LO_MASTERY_V1_CONFIG.strongMinFloor) {
            status = 'STRONG_DEMONSTRATION';
            explanation = `Consistent high performance across ${records.length} attempts (average ${avg}%, lowest ${low}%). Demonstrates thorough competency.`;
          } else if (avg >= LO_MASTERY_V1_CONFIG.demonstratedMinAvg && low >= LO_MASTERY_V1_CONFIG.demonstratedMinFloor) {
            status = 'DEMONSTRATED';
            explanation = `Satisfactory demonstration across ${records.length} attempts (average ${avg}%). Meets curriculum outcome standards.`;
          } else if (conflictStatus === 'HIGH_CONFLICT') {
            status = 'DEVELOPING';
            explanation = `High variance in attempt scores (${low}% to ${high}%). Retaining DEVELOPING status pending teacher review.`;
          } else if (avg >= LO_MASTERY_V1_CONFIG.developingMinAvg) {
            status = 'DEVELOPING';
            explanation = `Developing demonstration across ${records.length} attempts (average ${avg}%).`;
          } else {
            status = 'EMERGING';
            explanation = `Emerging performance across ${records.length} attempts (average ${avg}%). Remedial instruction recommended.`;
          }
        }

        const finalStatus = existingOverride ? existingOverride.overriddenStatus : status;
        const finalExplanation = existingOverride
          ? `Teacher Override by ${existingOverride.teacherId}: ${existingOverride.reason} (originally ${status})`
          : explanation;

        if (finalStatus === 'STRONG_DEMONSTRATION') strongCount++;
        else if (finalStatus === 'DEMONSTRATED') demonstratedCount++;
        else if (finalStatus === 'DEVELOPING') developingCount++;
        else if (finalStatus === 'EMERGING') emergingCount++;
        else insufficientCount++;

        const learnerObj = assignedLearnerMap.get(learnerId) || LearnerRosterService.getLearner(learnerId, params.schoolId);
        const latestRec = records[records.length - 1];

        learnerInterpretations.push({
          learnerId,
          learnerName: learnerObj?.displayName || `Learner ${learnerId}`,
          attemptId: latestRec.attemptId,
          score: latestRec.score,
          maxScore: latestRec.maxScore,
          percentage: avg,
          status: finalStatus,
          conflictStatus,
          explanation: finalExplanation,
          supportingEvidenceIds: records.map(r => r.evidenceRecordId),
          teacherOverride: existingOverride,
        });
      } else {
        // B. Assigned learner with ZERO submissions (Roster-Aware Insufficient Evidence)
        // Critical: Do NOT fabricate a 0% score, 0 marks, or false attempt.
        const finalStatus: InterpretationStatus = existingOverride ? existingOverride.overriddenStatus : 'INSUFFICIENT_EVIDENCE';
        const finalExplanation = existingOverride
          ? `Teacher Override by ${existingOverride.teacherId}: ${existingOverride.reason} (originally INSUFFICIENT_EVIDENCE)`
          : 'No assessment submission recorded. Insufficient evidence to evaluate competency.';

        if (finalStatus === 'STRONG_DEMONSTRATION') strongCount++;
        else if (finalStatus === 'DEMONSTRATED') demonstratedCount++;
        else if (finalStatus === 'DEVELOPING') developingCount++;
        else if (finalStatus === 'EMERGING') emergingCount++;
        else insufficientCount++;

        const learnerObj = assignedLearnerMap.get(learnerId) || LearnerRosterService.getLearner(learnerId, params.schoolId);

        learnerInterpretations.push({
          learnerId,
          learnerName: learnerObj?.displayName || `Learner ${learnerId}`,
          status: finalStatus,
          conflictStatus: 'NOT_APPLICABLE',
          explanation: finalExplanation,
          supportingEvidenceIds: [],
          teacherOverride: existingOverride,
        });
      }
    }

    // Compute Item Analytics
    const itemAnalytics: AssessmentItemAnalytic[] = assessmentItems.map(item => {
      let totalResponsesForItem = 0;
      let correctResponses = 0;
      let totalMarksAwardedForItem = 0;

      for (const rec of elmsRecords) {
        const resp = rec.responses?.find(r => r.itemId === item.itemId || r.itemId === `item_${item.sequence}`) ||
          (rec.responses && rec.responses.length === assessmentItems.length ? rec.responses[assessmentItems.indexOf(item)] : undefined);
        if (resp) {
          totalResponsesForItem++;
          totalMarksAwardedForItem += resp.marksAwarded;
          if (resp.isCorrect || resp.marksAwarded === resp.maxMarks) {
            correctResponses++;
          }
        }
      }

      const successRatePercentage = totalResponsesForItem > 0
        ? Number(((correctResponses / totalResponsesForItem) * 100).toFixed(1))
        : 0;
      const averageScore = totalResponsesForItem > 0
        ? Number((totalMarksAwardedForItem / totalResponsesForItem).toFixed(1))
        : 0;

      return {
        itemId: item.itemId,
        sequence: item.sequence,
        prompt: item.prompt,
        maxMarks: item.marks || 1,
        averageScore,
        successRatePercentage,
        strugglingLearnerCount: totalResponsesForItem - correctResponses,
      };
    });

    // Compute Teacher Support Insights
    const identifiedCurriculumGaps: string[] = [];
    for (const itemAnalytic of itemAnalytics) {
      if (itemAnalytic.successRatePercentage < LO_MASTERY_V1_CONFIG.itemDeficitThreshold && elmsRecords.length > 0) {
        identifiedCurriculumGaps.push(
          `Question ${itemAnalytic.sequence} ("${itemAnalytic.prompt.length > 50 ? itemAnalytic.prompt.slice(0, 47) + '...' : itemAnalytic.prompt}") showed lower success rate (${itemAnalytic.successRatePercentage}%). Review this core concept standard.`
        );
      }
    }

    const submittedLearnersCount = learnerMap.size;
    const assignedLearnersCount = assignedLearners.length > 0 ? assignedLearners.length : submittedLearnersCount;
    const awaitingSubmissionsCount = Math.max(0, assignedLearnersCount - submittedLearnersCount);

    let evidenceStatus: 'EVIDENCE_RECORDED' | 'AWAITING_LEARNER_SUBMISSIONS' | 'PARTIAL_SUBMISSIONS';
    if (submittedLearnersCount === 0) {
      evidenceStatus = 'AWAITING_LEARNER_SUBMISSIONS';
    } else if (awaitingSubmissionsCount > 0) {
      evidenceStatus = 'PARTIAL_SUBMISSIONS';
    } else {
      evidenceStatus = 'EVIDENCE_RECORDED';
    }

    const recommendedPedagogicalActions: string[] = [];
    if (submittedLearnersCount === 0) {
      recommendedPedagogicalActions.push(
        'Awaiting learner submissions from ELMS. Assign this assessment to learners in ELMS to collect performance evidence.'
      );
    } else {
      if (awaitingSubmissionsCount > 0) {
        recommendedPedagogicalActions.push(
          `Collect pending assessment submissions from ${awaitingSubmissionsCount} assigned learner(s) awaiting completion.`
        );
      }
      if (emergingCount > 0) {
        recommendedPedagogicalActions.push(
          `Schedule targeted small-group remedial support for ${emergingCount} learner(s) demonstrating emerging grasp of foundational concepts.`
        );
      }
      if (developingCount > 0) {
        recommendedPedagogicalActions.push(
          `Provide differentiated practice tasks for ${developingCount} developing learner(s) to reinforce problem-solving steps.`
        );
      }
      if (strongCount > 0) {
        recommendedPedagogicalActions.push(
          `Offer inquiry extension challenges or peer-mentoring roles for ${strongCount} learner(s) demonstrating strong mastery.`
        );
      }
      if (identifiedCurriculumGaps.length > 0) {
        recommendedPedagogicalActions.push(
          'Conduct a whole-class review on flagged assessment items before moving to subsequent sub-strands.'
        );
      }
    }

    const availableAssignments = assignments.map(a => {
      const cg = ClassGroupService.getClassGroupById(a.classGroupId);
      return {
        assignmentId: a.assignmentId,
        classGroupId: a.classGroupId,
        classGroupName: cg?.name || a.classGroupId,
      };
    });

    const hasAnyOverrides = learnerInterpretations.some(li => !!li.teacherOverride);
    const existing = assessmentInterpretationStore.get(`${params.schoolId}:${params.ecgArtifactId}`);
    let reviewStatus: 'PENDING_REVIEW' | 'REVIEWED' | 'OVERRIDDEN' = 'PENDING_REVIEW';
    
    if (hasAnyOverrides) {
      reviewStatus = 'OVERRIDDEN';
    } else if (existing?.teacherReviewStatus === 'REVIEWED') {
      reviewStatus = 'REVIEWED';
    }

    const interpretation: AssessmentEvidenceInterpretation = {
      interpretationId: `interp_asmt_${params.schoolId}_${params.ecgArtifactId}`,
      schoolId: params.schoolId,
      ecgArtifactId: params.ecgArtifactId,
      elmsResourceId: assessment?.contentArtifactId ? `elms_res_${assessment.contentArtifactId}` : `elms_res_${params.ecgArtifactId}`,
      assessmentId: assessment?.assessmentId || `asmt_${params.ecgArtifactId}`,
      learningOutcomeId,
      curriculumVersionId,
      evaluatedAt: new Date().toISOString(),
      policyVersion,
      attemptWeighting: 'EQUAL',
      classGroupId: resolvedClassGroupId,
      assignmentId: resolvedAssignmentId,
      assignmentStatus,
      factualSummary: {
        totalLearnersAssessed: submittedLearnersCount,
        totalAttempts: elmsRecords.length,
        averageScorePercentage: submittedLearnersCount > 0 ? Number((totalScoresSum / submittedLearnersCount).toFixed(1)) : 0,
        highestScorePercentage: submittedLearnersCount > 0 ? highestScorePercentage : 0,
        lowestScorePercentage: submittedLearnersCount > 0 ? lowestScorePercentage : 0,
        totalLearnersAssigned: assignedLearnersCount,
        totalLearnersSubmitted: submittedLearnersCount,
        totalLearnersAwaitingSubmission: awaitingSubmissionsCount,
        evidenceStatus,
        itemAnalytics,
        availableAssignments,
      },
      competencyDistribution: {
        strongDemonstrationCount: strongCount,
        demonstratedCount,
        developingCount,
        emergingCount,
        insufficientEvidenceCount: insufficientCount,
      },
      learnerInterpretations,
      teacherSupportInsights: {
        identifiedCurriculumGaps,
        recommendedPedagogicalActions,
        nonDiagnosticNotice:
          'Advisory teacher pedagogical support based strictly on objective curriculum assessment evidence. The system does not make clinical, cognitive, or diagnostic determinations.',
      },
      teacherReviewStatus: reviewStatus,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    assessmentInterpretationStore.set(`${params.schoolId}:${params.ecgArtifactId}`, interpretation);

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'ASSESSMENT_EVIDENCE_INTERPRETED',
      ecgArtifactId: params.ecgArtifactId,
      totalLearners: allLearnerIds.length,
      policyVersion,
      teacherId: params.requestingTeacherId,
      classGroupId: resolvedClassGroupId,
    });

    return interpretation;
  },

  overrideAssessmentLearnerStatus(params: {
    ecgArtifactId: string;
    schoolId: string;
    learnerId: string;
    teacherId: string;
    newStatus: InterpretationStatus;
    reason: string;
    classGroupId?: string;
  }): AssessmentEvidenceInterpretation {
    if (!params.reason || params.reason.trim() === '') {
      throw new Error('A mandatory professional rationale reason is required for teacher override');
    }

    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      AuditService.log('SECURITY_VIOLATION', params.schoolId, {
        action: 'UNAUTHORIZED_ASSESSMENT_OVERRIDE_ATTEMPT',
        teacherId: params.teacherId,
        schoolId: params.schoolId,
        ecgArtifactId: params.ecgArtifactId,
        learnerId: params.learnerId,
      });
      throw new Error(`Unauthorized teacher: User ${params.teacherId} is not an authorized teacher in school ${params.schoolId}`);
    }

    const currentInterp = this.interpretAssessmentEvidence({
      ecgArtifactId: params.ecgArtifactId,
      schoolId: params.schoolId,
      requestingTeacherId: params.teacherId,
      classGroupId: params.classGroupId,
    });

    const targetLearnerInterp = currentInterp.learnerInterpretations.find(l => l.learnerId === params.learnerId);
    const previousStatus = targetLearnerInterp?.status || 'DEVELOPING';

    const overrideKey = `${params.schoolId}:${params.ecgArtifactId}:${params.learnerId}`;
    const overrideRecord: TeacherOverride = {
      teacherId: params.teacherId,
      previousStatus,
      overriddenStatus: params.newStatus,
      reason: params.reason.trim(),
      recordedAt: new Date().toISOString(),
    };
    assessmentOverrideStore.set(overrideKey, overrideRecord);
    PersistentStateService.persistAssessmentOverride({
      schoolId: params.schoolId,
      ecgArtifactId: params.ecgArtifactId,
      learnerId: params.learnerId,
      override: overrideRecord,
    });

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'ASSESSMENT_LEARNER_STATUS_OVERRIDDEN',
      ecgArtifactId: params.ecgArtifactId,
      learnerId: params.learnerId,
      teacherId: params.teacherId,
      previousStatus,
      newStatus: params.newStatus,
      reason: params.reason,
    });

    return this.interpretAssessmentEvidence({
      ecgArtifactId: params.ecgArtifactId,
      schoolId: params.schoolId,
      requestingTeacherId: params.teacherId,
      classGroupId: params.classGroupId,
    });
  },

  confirmAssessmentReview(params: {
    ecgArtifactId: string;
    schoolId: string;
    teacherId: string;
    classGroupId?: string;
  }): AssessmentEvidenceInterpretation {
    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      throw new Error(`Unauthorized teacher: ${params.teacherId}`);
    }

    const interpretation = this.interpretAssessmentEvidence({
      ecgArtifactId: params.ecgArtifactId,
      schoolId: params.schoolId,
      requestingTeacherId: params.teacherId,
      classGroupId: params.classGroupId,
    });

    interpretation.teacherReviewStatus = 'REVIEWED';
    interpretation.updatedAt = new Date().toISOString();

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'ASSESSMENT_INTERPRETATION_REVIEW_CONFIRMED',
      ecgArtifactId: params.ecgArtifactId,
      teacherId: params.teacherId,
    });

    return interpretation;
  },

  getAssessmentInterpretation(
    ecgArtifactId: string,
    schoolId: string,
    requestingTeacherId: string,
    classGroupId?: string
  ): AssessmentEvidenceInterpretation {
    return this.interpretAssessmentEvidence({
      ecgArtifactId,
      schoolId,
      requestingTeacherId,
      classGroupId,
    });
  }
};

PersistentStateService.registerDomainService('LearningOutcomeInterpretationService', {
  clearInMemoryOnly: () => {
    LearningOutcomeInterpretationService.clearStore();
  },
  ingestState: (data: {
    schoolId?: string;
    overrides?: Array<{
      schoolId?: string;
      ecgArtifactId?: string;
      learnerId?: string;
      override?: TeacherOverride;
    }>;
  }) => {
    if (Array.isArray(data?.overrides)) {
      for (const item of data.overrides) {
        if (item?.schoolId && item?.ecgArtifactId && item?.learnerId && item?.override) {
          assessmentOverrideStore.set(
            `${item.schoolId}:${item.ecgArtifactId}:${item.learnerId}`,
            item.override
          );
        }
      }
    }
  },
});
