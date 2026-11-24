export type AttentionSignalType =
  | 'ATTENDANCE_PATTERN'
  | 'PARTICIPATION_PATTERN'
  | 'ACTIVITY_PATTERN'
  | 'ASSESSMENT_EVIDENCE_GAP'
  | 'INTERPRETATION_CONFLICT'
  | 'TEACHER_FLAG';

export type AttentionSignalSeverity = 'INFO' | 'REVIEW' | 'ATTENTION';

export type AttentionSignalStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'FOLLOW_UP_REQUIRED'
  | 'RESOLVED'
  | 'DISMISSED';

export interface LearnerAttentionSignal {
  id: string;
  schoolId: string;
  learnerId: string;
  classGroupId: string;
  teacherId: string;
  signalType: AttentionSignalType;
  severity: AttentionSignalSeverity;
  sourceReferences: string[];
  reason: string;
  createdAt: string;
  status: AttentionSignalStatus;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  dismissedAt?: string;
  dismissedBy?: string;
  dismissedReason?: string;
}

export type FollowUpActionType =
  | 'CHECK_IN_WITH_LEARNER'
  | 'REVIEW_LEARNING_ACTIVITY'
  | 'PROVIDE_ADDITIONAL_PRACTICE'
  | 'RETEACH_CONCEPT'
  | 'PAIR_WITH_PEER'
  | 'MONITOR_NEXT_LESSON'
  | 'REVIEW_ASSESSMENT'
  | 'OTHER';

export type FollowUpStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface FollowUpHistoryEntry {
  id: string;
  action: string;
  actorId: string;
  timestamp: string;
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  reason?: string;
}

export interface LearnerFollowUp {
  id: string;
  schoolId: string;
  learnerId: string;
  classGroupId: string;
  teacherId: string;
  attentionSignalId?: string;
  actionType: FollowUpActionType;
  status: FollowUpStatus;
  notes?: string;
  createdAt: string;
  followUpDate: string;
  completedAt?: string;
  completedBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  history: FollowUpHistoryEntry[];
}

export interface EngagementAttentionConfig {
  schoolId: string;
  attendanceAbsenceThreshold: number; // e.g. 3 absences
  lateThreshold: number; // e.g. 3 lates
  participationReviewThreshold: number; // e.g. 3 NOT_RECORDED or low participation
  evidenceReviewThreshold: number; // e.g. 0 evidence or high conflict
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface ClassInterventionSummary {
  schoolId: string;
  classGroupId: string;
  totalLearners: number;
  needsReviewCount: number;
  openSignalsCount: number;
  openFollowUpsCount: number;
  completedFollowUpsCount: number;
}
