export type ElmsPublicationStatus = 'PUBLISHED' | 'UPDATED' | 'WITHDRAWN';

export type ElmsEventType =
  | 'LEARNING_RESOURCE_PUBLISHED'
  | 'LEARNING_RESOURCE_UPDATED'
  | 'LEARNING_RESOURCE_WITHDRAWN'
  | 'LEARNING_ACTIVITY_STARTED'
  | 'LEARNING_ACTIVITY_COMPLETED'
  | 'LEARNER_ACTIVITY_RECORDED'
  | 'ASSESSMENT_STARTED'
  | 'ASSESSMENT_SUBMITTED'
  | 'ASSESSMENT_COMPLETED'
  | 'LEARNING_EVIDENCE_RECORDED';

export type ElmsEventStatus = 'PENDING' | 'PROCESSED' | 'FAILED' | 'RECONCILED' | 'IGNORED_DUPLICATE';

export interface ElmsResourcePublication {
  publicationId: string;
  ecgArtifactId: string;
  artifactVersion: number;
  elmsResourceId: string;
  schoolId: string;
  classGroupId?: string;
  learningAreaId: string;
  curriculumVersionId: string;
  teachingPlanId?: string;
  teachingAllocationId?: string;
  learningOutcomeIds: string[];
  status: ElmsPublicationStatus;
  publishedAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ElmsLearnerMapping {
  id: string;
  schoolId: string;
  ecgLearnerId: string;
  elmsLearnerId: string;
  status: 'ACTIVE' | 'INACTIVE';
  mappedAt: string;
  updatedAt: string;
}

export interface ElmsClassMapping {
  id: string;
  schoolId: string;
  ecgClassGroupId: string;
  elmsClassGroupId: string;
  status: 'ACTIVE' | 'INACTIVE';
  mappedAt: string;
  updatedAt: string;
}

export interface ElmsAssignment {
  assignmentId: string;
  publicationId: string;
  ecgArtifactId: string;
  elmsResourceId: string;
  schoolId: string;
  classGroupId: string;
  assignedAt: string;
  updatedAt: string;
  status: 'ACTIVE' | 'ARCHIVED';
  metadata?: Record<string, unknown>;
}

export interface ElmsLearningEvent<T = any> {
  eventId: string;
  sourceSystem: 'ELMS' | 'ECG' | 'DEMO';
  eventType: ElmsEventType;
  schoolId: string;
  learnerId?: string; // May be ELMS or ECG identifier
  classGroupId?: string; // May be ELMS or ECG identifier
  resourceId?: string; // ELMS resource ID or ECG artifact ID
  ecgArtifactId?: string;
  teachingPlanId?: string;
  teachingAllocationId?: string;
  learningOutcomeId?: string;
  timestamp: string;
  eventVersion: string;
  payloadVersion: string;
  correlationId?: string;
  idempotencyKey: string;
  payload: T;
  status: ElmsEventStatus;
  processingError?: string;
  processedAt?: string;
  retryCount: number;
}

export interface ElmsAssessmentSubmissionPayload {
  assessmentId: string;
  attemptId: string;
  learnerId: string;
  responses: Array<{
    itemId: string;
    response: string | number | boolean | Record<string, unknown>;
  }>;
  score?: number;
  totalMarks?: number;
  durationSeconds?: number;
}

export interface ElmsSyncStatus {
  totalReceived: number;
  totalProcessed: number;
  totalFailed: number;
  totalPending: number;
  lastSyncAt?: string;
  unresolvedIssuesCount: number;
}

export interface ElmsReconciliationReport {
  schoolId: string;
  generatedAt: string;
  publishedResourcesCount: number;
  learnerMappingsCount: number;
  classMappingsCount: number;
  processedEventsCount: number;
  pendingEventsCount: number;
  failedEventsCount: number;
  unmappedLearnersCount: number;
  unmappedClassesCount: number;
  unresolvedEvents: ElmsLearningEvent[];
}

export type { ElmsAssessmentEvidenceRecord, ElmsAssessmentEvidenceResponse } from './assessmentEvidence.ts';
