import {
  AttentionSignalType,
  AttentionSignalSeverity,
  AttentionSignalStatus,
  LearnerAttentionSignal,
  FollowUpActionType,
  FollowUpStatus,
  LearnerFollowUp,
  EngagementAttentionConfig,
  ClassInterventionSummary,
} from '../types/intervention.ts';
import { SchoolMembershipService } from './schoolMembershipService.ts';
import { ClassGroupService } from './classGroupService.ts';
import { LearnerRosterService } from './learnerRosterService.ts';
import { LearnerParticipationService } from './learnerParticipationService.ts';
import { AssessmentEvidenceService } from './assessmentEvidenceService.ts';
import { LearningOutcomeInterpretationService } from './learningOutcomeInterpretationService.ts';
import { AuditService } from './auditService.ts';

// In-memory persistence stores
const configStore = new Map<string, EngagementAttentionConfig>();
const signalStore = new Map<string, LearnerAttentionSignal>();
const followUpStore = new Map<string, LearnerFollowUp>();

export const LearnerEngagementInterventionService = {
  clearStore(): void {
    configStore.clear();
    signalStore.clear();
    followUpStore.clear();
  },

  // -------------------------------------------------------------
  // CONFIGURATION MANAGEMENT
  // -------------------------------------------------------------
  getConfig(schoolId: string): EngagementAttentionConfig {
    const existing = configStore.get(schoolId);
    if (existing) return { ...existing };

    const defaultConfig: EngagementAttentionConfig = {
      schoolId,
      attendanceAbsenceThreshold: 3,
      lateThreshold: 3,
      participationReviewThreshold: 3,
      evidenceReviewThreshold: 1,
      enabled: true,
      updatedAt: new Date().toISOString(),
      updatedBy: 'SYSTEM',
    };
    configStore.set(schoolId, defaultConfig);
    return { ...defaultConfig };
  },

  updateConfig(
    schoolId: string,
    requestingUserId: string,
    updates: Partial<Omit<EngagementAttentionConfig, 'schoolId'>>
  ): EngagementAttentionConfig {
    // Verify membership and admin authority
    const memberships = SchoolMembershipService.getMemberships(requestingUserId);
    const activeMem = memberships.find((m) => m.schoolId === schoolId && m.status === 'ACTIVE');

    if (!activeMem || !['SCHOOL_ADMIN', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'].includes(activeMem.role)) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        action: 'UPDATE_ENGAGEMENT_CONFIG',
        requestingUserId,
        reason: 'INSUFFICIENT_ADMIN_ROLE',
      });
      throw new Error('Unauthorized: Only school administrators can update engagement configuration.');
    }

    const current = this.getConfig(schoolId);
    const updated: EngagementAttentionConfig = {
      ...current,
      ...updates,
      schoolId,
      updatedAt: new Date().toISOString(),
      updatedBy: requestingUserId,
    };

    configStore.set(schoolId, updated);

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'ENGAGEMENT_CONFIG_UPDATED',
      updatedBy: requestingUserId,
      config: updated,
    });

    return { ...updated };
  },

  // -------------------------------------------------------------
  // AUTHORIZATION & VALIDATION HELPERS
  // -------------------------------------------------------------
  authorizeTeacherForClass(schoolId: string, teacherId: string, classGroupId: string): void {
    const memberships = SchoolMembershipService.getMemberships(teacherId);
    const activeMem = memberships.find((m) => m.schoolId === schoolId && m.status === 'ACTIVE');

    if (!activeMem) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        action: 'UNAUTHORIZED_ACCESS_ATTEMPTED',
        teacherId,
        reason: 'NO_ACTIVE_SCHOOL_MEMBERSHIP',
      });
      throw new Error('Unauthorized: User has no active membership in this school.');
    }

    if (['SCHOOL_ADMIN', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'].includes(activeMem.role)) {
      return; // Admins authorized for all class groups
    }

    const classGroup = ClassGroupService.getClassGroupById(classGroupId);
    if (!classGroup || classGroup.schoolId !== schoolId) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        action: 'UNAUTHORIZED_ACCESS_ATTEMPTED',
        teacherId,
        classGroupId,
        reason: 'INVALID_CLASS_GROUP_FOR_SCHOOL',
      });
      throw new Error('Unauthorized: Class group not found or belongs to another school.');
    }

    if (
      activeMem.assignedClassGroupIds &&
      activeMem.assignedClassGroupIds.length > 0 &&
      !activeMem.assignedClassGroupIds.includes(classGroupId)
    ) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        action: 'UNAUTHORIZED_ACCESS_ATTEMPTED',
        teacherId,
        classGroupId,
        reason: 'TEACHER_NOT_ASSIGNED_TO_CLASS',
      });
      throw new Error('Unauthorized: Class group not found or belongs to another school.');
    }

    // Check roster or active teaching assignment
    const learners = LearnerRosterService.getLearnersForClassGroup(classGroupId, schoolId);
    // Standard validation passed if class group exists and belongs to school
  },

  validateLearnerInClass(schoolId: string, classGroupId: string, learnerId: string): void {
    const learners = LearnerRosterService.getLearnersForClassGroup(classGroupId, schoolId);
    const learnerOnRoster = learners.some((l) => l.id === learnerId);

    if (!learnerOnRoster) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        action: 'ROSTER_VALIDATION_FAILED',
        classGroupId,
        learnerId,
        reason: 'LEARNER_NOT_ON_CLASS_ROSTER',
      });
      throw new Error(`Unauthorized: Learner ${learnerId} is not on the roster for class group ${classGroupId}.`);
    }
  },

  // -------------------------------------------------------------
  // SIGNAL GENERATION & DETERMINISTIC ENGINE
  // -------------------------------------------------------------
  generateSignalsForClass(params: {
    schoolId: string;
    teacherId: string;
    classGroupId: string;
  }): LearnerAttentionSignal[] {
    const { schoolId, teacherId, classGroupId } = params;
    this.authorizeTeacherForClass(schoolId, teacherId, classGroupId);

    const config = this.getConfig(schoolId);
    if (!config.enabled) return [];

    const learners = LearnerRosterService.getLearnersForClassGroup(classGroupId, schoolId);
    const newOrUpdatedSignals: LearnerAttentionSignal[] = [];

    const interpretations = LearningOutcomeInterpretationService.getInterpretationsBySchool(schoolId);

    for (const learner of learners) {
      // 1. Attendance Pattern Signal
      const attendanceRecords = LearnerParticipationService.getLearnerAttendanceHistory({
        schoolId,
        requestingUserId: teacherId,
        learnerId: learner.id,
      });

      const absentRecords = attendanceRecords.filter((r) => r.attendanceStatus === 'ABSENT');
      if (absentRecords.length >= config.attendanceAbsenceThreshold) {
        const signal = this.upsertSignal({
          schoolId,
          learnerId: learner.id,
          classGroupId,
          teacherId,
          signalType: 'ATTENDANCE_PATTERN',
          severity: absentRecords.length >= 5 ? 'ATTENTION' : 'REVIEW',
          reason: `${absentRecords.length} absences recorded across recent classroom sessions.`,
          sourceReferences: absentRecords.map((r) => r.id),
        });
        newOrUpdatedSignals.push(signal);
      }

      const lateRecords = attendanceRecords.filter((r) => r.attendanceStatus === 'LATE');
      if (lateRecords.length >= config.lateThreshold) {
        const signal = this.upsertSignal({
          schoolId,
          learnerId: learner.id,
          classGroupId,
          teacherId,
          signalType: 'ATTENDANCE_PATTERN',
          severity: 'REVIEW',
          reason: `${lateRecords.length} late arrivals recorded across recent classroom sessions.`,
          sourceReferences: lateRecords.map((r) => r.id),
        });
        newOrUpdatedSignals.push(signal);
      }

      // 2. Participation Pattern Signal
      const unrecordedParticipation = attendanceRecords.filter(
        (r) => r.participationStatus === 'NOT_RECORDED'
      );
      if (unrecordedParticipation.length >= config.participationReviewThreshold) {
        const signal = this.upsertSignal({
          schoolId,
          learnerId: learner.id,
          classGroupId,
          teacherId,
          signalType: 'PARTICIPATION_PATTERN',
          severity: 'REVIEW',
          reason: `Participation not recorded consistently across ${unrecordedParticipation.length} recent teaching activities. Insufficient evidence for review.`,
          sourceReferences: unrecordedParticipation.map((r) => r.id),
        });
        newOrUpdatedSignals.push(signal);
      }

      // 3. Assessment Evidence Gap Signal
      let learnerEvCount = 0;
      try {
        const schoolEvidence = AssessmentEvidenceService.getEvidenceBySchool(schoolId);
        learnerEvCount = schoolEvidence.filter((e) => e.learnerId === learner.id && !e.isVoided).length;
      } catch {
        learnerEvCount = 0;
      }

      if (learnerEvCount === 0) {
        const signal = this.upsertSignal({
          schoolId,
          learnerId: learner.id,
          classGroupId,
          teacherId,
          signalType: 'ASSESSMENT_EVIDENCE_GAP',
          severity: 'REVIEW',
          reason: 'Insufficient evidence: No valid assessment records exist for key outcomes taught.',
          sourceReferences: [],
        });
        newOrUpdatedSignals.push(signal);
      }

      // 4. Interpretation Conflict Signal
      const learnerInterps = interpretations.filter((i) => i.learnerId === learner.id);
      const conflictInterp = learnerInterps.find((i) => i.conflictStatus === 'HIGH_CONFLICT');
      if (conflictInterp) {
        const signal = this.upsertSignal({
          schoolId,
          learnerId: learner.id,
          classGroupId,
          teacherId,
          signalType: 'INTERPRETATION_CONFLICT',
          severity: 'ATTENTION',
          reason: 'Evidence conflict observed in interpretation engine (HIGH_CONFLICT). Requires teacher review.',
          sourceReferences: [conflictInterp.interpretationId],
        });
        newOrUpdatedSignals.push(signal);
      }
    }

    return newOrUpdatedSignals;
  },

  upsertSignal(params: {
    schoolId: string;
    learnerId: string;
    classGroupId: string;
    teacherId: string;
    signalType: AttentionSignalType;
    severity: AttentionSignalSeverity;
    reason: string;
    sourceReferences: string[];
  }): LearnerAttentionSignal {
    const { schoolId, learnerId, classGroupId, teacherId, signalType, severity, reason, sourceReferences } = params;

    // Composite key for signal deduplication
    const signalId = `sig_${schoolId}_${classGroupId}_${learnerId}_${signalType}`;
    const existing = signalStore.get(signalId);

    if (existing) {
      if (existing.status === 'DISMISSED' || existing.status === 'RESOLVED') {
        // Return existing resolved/dismissed signal unless re-opened
        return { ...existing };
      }
      // Update details
      const updated: LearnerAttentionSignal = {
        ...existing,
        severity,
        reason,
        sourceReferences,
      };
      signalStore.set(signalId, updated);
      return { ...updated };
    }

    const newSignal: LearnerAttentionSignal = {
      id: signalId,
      schoolId,
      learnerId,
      classGroupId,
      teacherId,
      signalType,
      severity,
      sourceReferences,
      reason,
      createdAt: new Date().toISOString(),
      status: 'OPEN',
    };

    signalStore.set(signalId, newSignal);

    AuditService.log('ARTIFACT_CREATED', schoolId, {
      action: 'ATTENTION_SIGNAL_GENERATED',
      signalId,
      learnerId,
      classGroupId,
      signalType,
      severity,
      reason,
    });

    return { ...newSignal };
  },

  createTeacherFlagSignal(params: {
    schoolId: string;
    teacherId: string;
    classGroupId: string;
    learnerId: string;
    reason: string;
    notes?: string;
  }): LearnerAttentionSignal {
    const { schoolId, teacherId, classGroupId, learnerId, reason } = params;
    this.authorizeTeacherForClass(schoolId, teacherId, classGroupId);
    this.validateLearnerInClass(schoolId, classGroupId, learnerId);

    const signalId = `sig_${schoolId}_${classGroupId}_${learnerId}_TEACHER_FLAG_${Date.now()}`;
    const signal: LearnerAttentionSignal = {
      id: signalId,
      schoolId,
      learnerId,
      classGroupId,
      teacherId,
      signalType: 'TEACHER_FLAG',
      severity: 'REVIEW',
      sourceReferences: [],
      reason: reason || 'Teacher flagged learner for review.',
      createdAt: new Date().toISOString(),
      status: 'OPEN',
    };

    signalStore.set(signalId, signal);

    AuditService.log('ARTIFACT_CREATED', schoolId, {
      action: 'TEACHER_FLAG_SIGNAL_CREATED',
      signalId,
      learnerId,
      teacherId,
      reason,
    });

    return { ...signal };
  },

  // -------------------------------------------------------------
  // SIGNAL QUERY & LIFECYCLE MANAGEMENT
  // -------------------------------------------------------------
  getAttentionSignalsForClass(params: {
    schoolId: string;
    teacherId: string;
    classGroupId: string;
    statusFilter?: AttentionSignalStatus;
  }): LearnerAttentionSignal[] {
    const { schoolId, teacherId, classGroupId, statusFilter } = params;
    this.authorizeTeacherForClass(schoolId, teacherId, classGroupId);

    const result: LearnerAttentionSignal[] = [];
    for (const signal of signalStore.values()) {
      if (
        signal.schoolId === schoolId &&
        signal.classGroupId === classGroupId &&
        (!statusFilter || signal.status === statusFilter)
      ) {
        result.push({ ...signal });
      }
    }
    return result;
  },

  getAttentionSignalsForLearner(params: {
    schoolId: string;
    teacherId: string;
    learnerId: string;
  }): LearnerAttentionSignal[] {
    const { schoolId, teacherId, learnerId } = params;

    // Verify school membership
    const memberships = SchoolMembershipService.getMemberships(teacherId);
    const activeMem = memberships.find((m) => m.schoolId === schoolId && m.status === 'ACTIVE');
    if (!activeMem) {
      throw new Error('Unauthorized: User has no active membership in this school.');
    }

    const result: LearnerAttentionSignal[] = [];
    for (const signal of signalStore.values()) {
      if (signal.schoolId === schoolId && signal.learnerId === learnerId) {
        result.push({ ...signal });
      }
    }
    return result;
  },

  acknowledgeSignal(params: {
    schoolId: string;
    teacherId: string;
    signalId: string;
  }): LearnerAttentionSignal {
    const { schoolId, teacherId, signalId } = params;
    const signal = signalStore.get(signalId);

    if (!signal) throw new Error(`Attention signal not found: ${signalId}`);
    if (signal.schoolId !== schoolId) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        action: 'CROSS_SCHOOL_SIGNAL_ACCESS',
        signalId,
        teacherId,
      });
      throw new Error('Unauthorized cross-school signal access.');
    }

    this.authorizeTeacherForClass(schoolId, teacherId, signal.classGroupId);

    signal.status = 'ACKNOWLEDGED';
    signal.acknowledgedAt = new Date().toISOString();
    signal.acknowledgedBy = teacherId;

    signalStore.set(signalId, signal);

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'ATTENTION_SIGNAL_ACKNOWLEDGED',
      signalId,
      teacherId,
    });

    return { ...signal };
  },

  dismissSignal(params: {
    schoolId: string;
    teacherId: string;
    signalId: string;
    reason: string;
  }): LearnerAttentionSignal {
    const { schoolId, teacherId, signalId, reason } = params;
    const signal = signalStore.get(signalId);

    if (!signal) throw new Error(`Attention signal not found: ${signalId}`);
    if (signal.schoolId !== schoolId) {
      throw new Error('Unauthorized cross-school signal access.');
    }

    this.authorizeTeacherForClass(schoolId, teacherId, signal.classGroupId);

    signal.status = 'DISMISSED';
    signal.dismissedAt = new Date().toISOString();
    signal.dismissedBy = teacherId;
    signal.dismissedReason = reason;

    signalStore.set(signalId, signal);

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'ATTENTION_SIGNAL_DISMISSED',
      signalId,
      teacherId,
      reason,
    });

    return { ...signal };
  },

  resolveSignal(params: {
    schoolId: string;
    teacherId: string;
    signalId: string;
  }): LearnerAttentionSignal {
    const { schoolId, teacherId, signalId } = params;
    const signal = signalStore.get(signalId);

    if (!signal) throw new Error(`Attention signal not found: ${signalId}`);
    if (signal.schoolId !== schoolId) {
      throw new Error('Unauthorized cross-school signal access.');
    }

    this.authorizeTeacherForClass(schoolId, teacherId, signal.classGroupId);

    signal.status = 'RESOLVED';
    signal.resolvedAt = new Date().toISOString();
    signal.resolvedBy = teacherId;

    signalStore.set(signalId, signal);

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'ATTENTION_SIGNAL_RESOLVED',
      signalId,
      teacherId,
    });

    return { ...signal };
  },

  // -------------------------------------------------------------
  // FOLLOW-UP CRUD MANAGEMENT
  // -------------------------------------------------------------
  createFollowUp(params: {
    schoolId: string;
    teacherId: string;
    classGroupId: string;
    learnerId: string;
    attentionSignalId?: string;
    actionType: FollowUpActionType;
    followUpDate: string;
    notes?: string;
    idempotencyKey?: string;
  }): LearnerFollowUp {
    const { schoolId, teacherId, classGroupId, learnerId, attentionSignalId, actionType, followUpDate, notes, idempotencyKey } = params;

    this.authorizeTeacherForClass(schoolId, teacherId, classGroupId);
    this.validateLearnerInClass(schoolId, classGroupId, learnerId);

    // Idempotency check
    if (idempotencyKey) {
      const existing = Array.from(followUpStore.values()).find((f) => f.id === idempotencyKey);
      if (existing) return { ...existing };
    }

    const followUpId = idempotencyKey || `fol_${schoolId}_${learnerId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const initialHistory = [
      {
        id: `hist_1_${followUpId}`,
        action: 'CREATED',
        actorId: teacherId,
        timestamp: new Date().toISOString(),
        newValues: { actionType, followUpDate, notes, status: 'OPEN' },
      },
    ];

    const followUp: LearnerFollowUp = {
      id: followUpId,
      schoolId,
      learnerId,
      classGroupId,
      teacherId,
      attentionSignalId,
      actionType,
      status: 'OPEN',
      notes,
      createdAt: new Date().toISOString(),
      followUpDate,
      history: initialHistory,
    };

    followUpStore.set(followUpId, followUp);

    // If linked to an attention signal, update signal status to FOLLOW_UP_REQUIRED or ACKNOWLEDGED
    if (attentionSignalId) {
      const signal = signalStore.get(attentionSignalId);
      if (signal && signal.schoolId === schoolId) {
        signal.status = 'FOLLOW_UP_REQUIRED';
        signalStore.set(attentionSignalId, signal);
      }
    }

    AuditService.log('ARTIFACT_CREATED', schoolId, {
      action: 'LEARNER_FOLLOW_UP_CREATED',
      followUpId,
      learnerId,
      classGroupId,
      teacherId,
      actionType,
      followUpDate,
    });

    return { ...followUp };
  },

  updateFollowUp(params: {
    schoolId: string;
    teacherId: string;
    followUpId: string;
    actionType?: FollowUpActionType;
    followUpDate?: string;
    notes?: string;
    reason: string;
  }): LearnerFollowUp {
    const { schoolId, teacherId, followUpId, actionType, followUpDate, notes, reason } = params;
    const followUp = followUpStore.get(followUpId);

    if (!followUp) throw new Error(`Follow-up record not found: ${followUpId}`);
    if (followUp.schoolId !== schoolId) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        action: 'CROSS_SCHOOL_FOLLOW_UP_ACCESS',
        followUpId,
        teacherId,
      });
      throw new Error('Unauthorized cross-school follow-up access.');
    }

    this.authorizeTeacherForClass(schoolId, teacherId, followUp.classGroupId);

    const previousValues = {
      actionType: followUp.actionType,
      followUpDate: followUp.followUpDate,
      notes: followUp.notes,
    };

    if (actionType) followUp.actionType = actionType;
    if (followUpDate) followUp.followUpDate = followUpDate;
    if (notes !== undefined) followUp.notes = notes;

    const newValues = {
      actionType: followUp.actionType,
      followUpDate: followUp.followUpDate,
      notes: followUp.notes,
    };

    const historyEntry = {
      id: `hist_${followUp.history.length + 1}_${followUpId}`,
      action: 'UPDATED',
      actorId: teacherId,
      timestamp: new Date().toISOString(),
      previousValues,
      newValues,
      reason,
    };

    followUp.history.push(historyEntry);
    followUpStore.set(followUpId, followUp);

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'LEARNER_FOLLOW_UP_UPDATED',
      followUpId,
      teacherId,
      reason,
    });

    return { ...followUp };
  },

  completeFollowUp(params: {
    schoolId: string;
    teacherId: string;
    followUpId: string;
    notes?: string;
  }): LearnerFollowUp {
    const { schoolId, teacherId, followUpId, notes } = params;
    const followUp = followUpStore.get(followUpId);

    if (!followUp) throw new Error(`Follow-up record not found: ${followUpId}`);
    if (followUp.schoolId !== schoolId) {
      throw new Error('Unauthorized cross-school follow-up access.');
    }

    this.authorizeTeacherForClass(schoolId, teacherId, followUp.classGroupId);

    followUp.status = 'COMPLETED';
    followUp.completedAt = new Date().toISOString();
    followUp.completedBy = teacherId;
    if (notes) followUp.notes = notes;

    const historyEntry = {
      id: `hist_${followUp.history.length + 1}_${followUpId}`,
      action: 'COMPLETED',
      actorId: teacherId,
      timestamp: new Date().toISOString(),
      newValues: { status: 'COMPLETED', notes },
    };

    followUp.history.push(historyEntry);
    followUpStore.set(followUpId, followUp);

    // If linked signal exists, resolve it if all associated follow-ups are completed
    if (followUp.attentionSignalId) {
      const signal = signalStore.get(followUp.attentionSignalId);
      if (signal) {
        const otherOpenFollowUps = Array.from(followUpStore.values()).some(
          (f) =>
            f.attentionSignalId === followUp.attentionSignalId &&
            f.id !== followUpId &&
            (f.status === 'OPEN' || f.status === 'IN_PROGRESS')
        );
        if (!otherOpenFollowUps) {
          signal.status = 'RESOLVED';
          signal.resolvedAt = new Date().toISOString();
          signal.resolvedBy = teacherId;
          signalStore.set(signal.id, signal);
        }
      }
    }

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'LEARNER_FOLLOW_UP_COMPLETED',
      followUpId,
      teacherId,
    });

    return { ...followUp };
  },

  cancelFollowUp(params: {
    schoolId: string;
    teacherId: string;
    followUpId: string;
    reason: string;
  }): LearnerFollowUp {
    const { schoolId, teacherId, followUpId, reason } = params;
    const followUp = followUpStore.get(followUpId);

    if (!followUp) throw new Error(`Follow-up record not found: ${followUpId}`);
    if (followUp.schoolId !== schoolId) {
      throw new Error('Unauthorized cross-school follow-up access.');
    }

    this.authorizeTeacherForClass(schoolId, teacherId, followUp.classGroupId);

    followUp.status = 'CANCELLED';
    followUp.cancelledAt = new Date().toISOString();
    followUp.cancelledBy = teacherId;
    followUp.cancellationReason = reason;

    const historyEntry = {
      id: `hist_${followUp.history.length + 1}_${followUpId}`,
      action: 'CANCELLED',
      actorId: teacherId,
      timestamp: new Date().toISOString(),
      reason,
    };

    followUp.history.push(historyEntry);
    followUpStore.set(followUpId, followUp);

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'LEARNER_FOLLOW_UP_CANCELLED',
      followUpId,
      teacherId,
      reason,
    });

    return { ...followUp };
  },

  getFollowUpsForLearner(params: {
    schoolId: string;
    teacherId: string;
    learnerId: string;
  }): LearnerFollowUp[] {
    const { schoolId, teacherId, learnerId } = params;

    const memberships = SchoolMembershipService.getMemberships(teacherId);
    const activeMem = memberships.find((m) => m.schoolId === schoolId && m.status === 'ACTIVE');
    if (!activeMem) {
      throw new Error('Unauthorized: User has no active membership in this school.');
    }

    const result: LearnerFollowUp[] = [];
    for (const f of followUpStore.values()) {
      if (f.schoolId === schoolId && f.learnerId === learnerId) {
        result.push({ ...f });
      }
    }
    return result;
  },

  getFollowUpsForClass(params: {
    schoolId: string;
    teacherId: string;
    classGroupId: string;
    statusFilter?: FollowUpStatus;
  }): LearnerFollowUp[] {
    const { schoolId, teacherId, classGroupId, statusFilter } = params;
    this.authorizeTeacherForClass(schoolId, teacherId, classGroupId);

    const result: LearnerFollowUp[] = [];
    for (const f of followUpStore.values()) {
      if (
        f.schoolId === schoolId &&
        f.classGroupId === classGroupId &&
        (!statusFilter || f.status === statusFilter)
      ) {
        result.push({ ...f });
      }
    }
    return result;
  },

  // -------------------------------------------------------------
  // CLASS SUMMARY AGGREGATOR
  // -------------------------------------------------------------
  getClassSummary(params: {
    schoolId: string;
    teacherId: string;
    classGroupId: string;
  }): ClassInterventionSummary {
    const { schoolId, teacherId, classGroupId } = params;
    this.authorizeTeacherForClass(schoolId, teacherId, classGroupId);

    const learners = LearnerRosterService.getLearnersForClassGroup(classGroupId, schoolId);
    const classSignals = this.getAttentionSignalsForClass({ schoolId, teacherId, classGroupId });
    const classFollowUps = this.getFollowUpsForClass({ schoolId, teacherId, classGroupId });

    const openSignals = classSignals.filter((s) => s.status === 'OPEN' || s.status === 'FOLLOW_UP_REQUIRED');
    const openFollowUps = classFollowUps.filter((f) => f.status === 'OPEN' || f.status === 'IN_PROGRESS');
    const completedFollowUps = classFollowUps.filter((f) => f.status === 'COMPLETED');

    // Learners needing review: unique learner IDs with open signals or open follow-ups
    const needsReviewLearners = new Set<string>();
    openSignals.forEach((s) => needsReviewLearners.add(s.learnerId));
    openFollowUps.forEach((f) => needsReviewLearners.add(f.learnerId));

    return {
      schoolId,
      classGroupId,
      totalLearners: learners.length,
      needsReviewCount: needsReviewLearners.size,
      openSignalsCount: openSignals.length,
      openFollowUpsCount: openFollowUps.length,
      completedFollowUpsCount: completedFollowUps.length,
    };
  },
};
