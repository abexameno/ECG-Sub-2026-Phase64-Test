import {
  ElmsResourcePublication,
  ElmsPublicationStatus,
  ElmsLearnerMapping,
  ElmsClassMapping,
  ElmsLearningEvent,
  ElmsEventType,
  ElmsEventStatus,
  ElmsAssessmentSubmissionPayload,
  ElmsSyncStatus,
  ElmsReconciliationReport,
  ElmsAssignment,
} from '../types/elmsIntegration.ts';
import { SchoolMembershipService } from './schoolMembershipService.ts';
import { SchoolConfigService } from './schoolConfigService.ts';
import { ContentArtifactRepository } from './contentArtifactRepository.ts';
import { CurriculumReference } from '../types/artifact.ts';
import { LearnerRosterService } from './learnerRosterService.ts';
import { ClassGroupService } from './classGroupService.ts';
import { TeachingActivityService } from './teachingActivityService.ts';
import { AssessmentEvidenceService } from './assessmentEvidenceService.ts';
import { AuditService } from './auditService.ts';
import { PersistentStateService } from './persistentStateService.ts';

// In-memory repositories for Phase 29
const publicationStore = new Map<string, ElmsResourcePublication>();
const publicationByArtifactStore = new Map<string, string>(); // key: `${schoolId}:${ecgArtifactId}` -> publicationId
const learnerMappingStore = new Map<string, ElmsLearnerMapping>(); // key: `${schoolId}:${ecgLearnerId}` or `${schoolId}:${elmsLearnerId}`
const classMappingStore = new Map<string, ElmsClassMapping>(); // key: `${schoolId}:${ecgClassGroupId}` or `${schoolId}:${elmsClassGroupId}`
const assignmentStore = new Map<string, ElmsAssignment>(); // key: assignmentId
const eventStore = new Map<string, ElmsLearningEvent>(); // key: eventId
const idempotencyStore = new Map<string, string>(); // key: `${schoolId}:${idempotencyKey}` -> eventId
const serviceCredentialsStore = new Map<string, { apiKey: string; sharedSecret: string; active: boolean }>();

export const ElmsIntegrationService = {
  clearStore(): void {
    publicationStore.clear();
    publicationByArtifactStore.clear();
    learnerMappingStore.clear();
    classMappingStore.clear();
    assignmentStore.clear();
    eventStore.clear();
    idempotencyStore.clear();
    serviceCredentialsStore.clear();
  },

  // 1. SERVICE CREDENTIALS & AUTHENTICATION
  setServiceCredentials(schoolId: string, credentials: { apiKey: string; sharedSecret: string; active?: boolean }): void {
    const school = SchoolConfigService.getSchoolProfile(schoolId);
    if (!school) {
      throw new Error(`Cannot configure ELMS credentials: School not found ${schoolId}`);
    }
    serviceCredentialsStore.set(schoolId, {
      apiKey: credentials.apiKey,
      sharedSecret: credentials.sharedSecret,
      active: credentials.active !== undefined ? credentials.active : true,
    });
  },

  validateServiceAuth(schoolId: string, apiKey?: string, bearerToken?: string): boolean {
    const creds = serviceCredentialsStore.get(schoolId);
    if (!creds || !creds.active) {
      // If not configured, allow fallback test mode only if explicitly authenticated by known demo keys
      if (apiKey === `elms_key_${schoolId}` || bearerToken === `elms_bearer_${schoolId}`) {
        return true;
      }
      return false;
    }
    if (apiKey && creds.apiKey === apiKey) {
      return true;
    }
    if (bearerToken && (creds.sharedSecret === bearerToken || bearerToken === `Bearer ${creds.sharedSecret}`)) {
      return true;
    }
    return false;
  },

  // 2. RESOURCE PUBLICATION (ECG → ELMS)
  publishResource(params: {
    schoolId: string;
    teacherId: string;
    ecgArtifactId: string;
    artifactVersion?: number;
    classGroupId?: string;
    learningAreaId?: string;
    curriculumVersionId?: string;
    teachingPlanId?: string;
    teachingAllocationId?: string;
    learningOutcomeIds?: string[];
    customElmsResourceId?: string;
    metadata?: Record<string, unknown>;
  }): ElmsResourcePublication {
    // Validate school
    const school = SchoolConfigService.getSchoolProfile(params.schoolId);
    if (!school) {
      throw new Error(`Publication rejected: Invalid school ID ${params.schoolId}`);
    }

    // Verify teacher authorization for the school
    const membership = SchoolMembershipService.getMembership(params.teacherId, params.schoolId);
    if (!membership || membership.status !== 'ACTIVE') {
      AuditService.log('SECURITY_VIOLATION', params.schoolId, {
        action: 'UNAUTHORIZED_ELMS_PUBLICATION_ATTEMPT',
        teacherId: params.teacherId,
        ecgArtifactId: params.ecgArtifactId,
      });
      throw new Error(`Teacher ${params.teacherId} is not an active member of school ${params.schoolId}`);
    }

    // Retrieve and validate artifact
    const artifact = ContentArtifactRepository.getById(params.ecgArtifactId, params.schoolId, params.artifactVersion);
    if (!artifact) {
      throw new Error(`Artifact ${params.ecgArtifactId} not found in school ${params.schoolId}`);
    }

    // Check if publication already exists for this artifact in this school
    const artifactKey = `${params.schoolId}:${params.ecgArtifactId}`;
    const existingPubId = publicationByArtifactStore.get(artifactKey);

    const version = params.artifactVersion || artifact.version || 1;
    const elmsResourceId = params.customElmsResourceId || `elms_res_${params.ecgArtifactId}_v${version}`;
    const firstRef = (artifact.curriculumReferences && artifact.curriculumReferences[0]) as CurriculumReference | undefined;
    const learningAreaId = params.learningAreaId || artifact.learningAreaId || firstRef?.learningAreaId || 'general';
    const curriculumVersionId = params.curriculumVersionId || artifact.curriculumVersion || 'kicd_cbe_2026';
    const learningOutcomeIds = params.learningOutcomeIds || firstRef?.learningOutcomeIds || [];

    let publication: ElmsResourcePublication;

    if (existingPubId && publicationStore.has(existingPubId)) {
      publication = publicationStore.get(existingPubId)!;
      publication.artifactVersion = version;
      publication.elmsResourceId = elmsResourceId;
      publication.status = 'PUBLISHED';
      publication.classGroupId = params.classGroupId || publication.classGroupId;
      publication.teachingPlanId = params.teachingPlanId || publication.teachingPlanId;
      publication.teachingAllocationId = params.teachingAllocationId || publication.teachingAllocationId;
      publication.learningOutcomeIds = learningOutcomeIds.length > 0 ? learningOutcomeIds : publication.learningOutcomeIds;
      publication.updatedAt = new Date().toISOString();
      if (params.metadata) {
        publication.metadata = { ...publication.metadata, ...params.metadata };
      }
    } else {
      const publicationId = `pub_elms_${params.schoolId}_${params.ecgArtifactId}_${Date.now()}`;
      publication = {
        publicationId,
        ecgArtifactId: params.ecgArtifactId,
        artifactVersion: version,
        elmsResourceId,
        schoolId: params.schoolId,
        classGroupId: params.classGroupId,
        learningAreaId,
        curriculumVersionId,
        teachingPlanId: params.teachingPlanId,
        teachingAllocationId: params.teachingAllocationId,
        learningOutcomeIds,
        status: 'PUBLISHED',
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: params.metadata,
      };
      publicationStore.set(publicationId, publication);
      publicationByArtifactStore.set(artifactKey, publicationId);
    }
    PersistentStateService.persistElmsPublication(publication);

    // Phase 28: If classGroupId is provided, ensure an authoritative assignment exists
    if (params.classGroupId) {
      this.assignAssessmentToClass({
        schoolId: params.schoolId,
        teacherId: params.teacherId,
        ecgArtifactId: params.ecgArtifactId,
        classGroupId: params.classGroupId,
      });
    }

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'ELMS_RESOURCE_PUBLISHED',
      publicationId: publication.publicationId,
      ecgArtifactId: params.ecgArtifactId,
      elmsResourceId: publication.elmsResourceId,
      teacherId: params.teacherId,
    });

    return publication;
  },

  updatePublishedResource(params: {
    schoolId: string;
    teacherId: string;
    ecgArtifactId: string;
    newVersion: number;
    metadata?: Record<string, unknown>;
  }): ElmsResourcePublication {
    const artifactKey = `${params.schoolId}:${params.ecgArtifactId}`;
    const pubId = publicationByArtifactStore.get(artifactKey);
    if (!pubId || !publicationStore.has(pubId)) {
      throw new Error(`No published resource found for artifact ${params.ecgArtifactId} in school ${params.schoolId}`);
    }

    const publication = publicationStore.get(pubId)!;
    publication.artifactVersion = params.newVersion;
    publication.elmsResourceId = `elms_res_${params.ecgArtifactId}_v${params.newVersion}`;
    publication.status = 'UPDATED';
    publication.updatedAt = new Date().toISOString();
    if (params.metadata) {
      publication.metadata = { ...publication.metadata, ...params.metadata };
    }
    PersistentStateService.persistElmsPublication(publication);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'ELMS_RESOURCE_VERSION_UPDATED',
      publicationId: publication.publicationId,
      ecgArtifactId: params.ecgArtifactId,
      newVersion: params.newVersion,
      teacherId: params.teacherId,
    });

    return publication;
  },

  withdrawPublishedResource(params: {
    schoolId: string;
    teacherId: string;
    ecgArtifactId: string;
  }): ElmsResourcePublication {
    const artifactKey = `${params.schoolId}:${params.ecgArtifactId}`;
    const pubId = publicationByArtifactStore.get(artifactKey);
    if (!pubId || !publicationStore.has(pubId)) {
      throw new Error(`No published resource found for artifact ${params.ecgArtifactId} in school ${params.schoolId}`);
    }

    const publication = publicationStore.get(pubId)!;
    publication.status = 'WITHDRAWN';
    publication.updatedAt = new Date().toISOString();
    PersistentStateService.persistElmsPublication(publication);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'ELMS_RESOURCE_WITHDRAWN',
      publicationId: publication.publicationId,
      ecgArtifactId: params.ecgArtifactId,
      teacherId: params.teacherId,
    });

    return publication;
  },

  getPublication(schoolId: string, publicationIdOrArtifactId: string): ElmsResourcePublication | undefined {
    const pub = publicationStore.get(publicationIdOrArtifactId);
    if (pub) {
      if (pub.schoolId !== schoolId) {
        throw new Error(`Security Violation: Access denied to publication for school ${schoolId}`);
      }
      return pub;
    }

    const artifactKey = `${schoolId}:${publicationIdOrArtifactId}`;
    const pubId = publicationByArtifactStore.get(artifactKey);
    if (pubId) {
      return publicationStore.get(pubId);
    }
    return undefined;
  },

  listPublications(schoolId: string, filter?: { classGroupId?: string; status?: ElmsPublicationStatus }): ElmsResourcePublication[] {
    return Array.from(publicationStore.values()).filter((p) => {
      if (p.schoolId !== schoolId) return false;
      if (filter?.classGroupId && p.classGroupId !== filter.classGroupId) {
        // Also check if any assignment exists for this publication and class group
        const assignments = this.getAssignmentsForArtifact(schoolId, p.ecgArtifactId);
        const match = assignments.some(a => a.classGroupId === filter.classGroupId);
        if (!match && p.classGroupId !== filter.classGroupId) return false;
      }
      if (filter?.status && p.status !== filter.status) return false;
      return true;
    });
  },

  // 3. ASSIGNMENT MANAGEMENT (Phase 28 Context Hardening)
  assignAssessmentToClass(params: {
    schoolId: string;
    teacherId: string;
    ecgArtifactId: string;
    classGroupId: string;
    metadata?: Record<string, unknown>;
  }): ElmsAssignment {
    const publication = this.getPublication(params.schoolId, params.ecgArtifactId);
    if (!publication) {
      throw new Error(`Cannot assign: Assessment ${params.ecgArtifactId} is not published to ELMS.`);
    }

    // Verify class group exists
    const classGroup = ClassGroupService.getClassGroupById(params.classGroupId);
    if (!classGroup || classGroup.schoolId !== params.schoolId) {
      throw new Error(`Invalid class group ${params.classGroupId} for school ${params.schoolId}`);
    }

    // Idempotency: Check if already assigned
    const existing = Array.from(assignmentStore.values()).find(
      a => a.schoolId === params.schoolId && 
           a.ecgArtifactId === params.ecgArtifactId && 
           a.classGroupId === params.classGroupId &&
           a.status === 'ACTIVE'
    );
    if (existing) return existing;

    const assignmentId = `asgn_elms_${params.schoolId}_${params.ecgArtifactId}_${params.classGroupId}`;
    const assignment: ElmsAssignment = {
      assignmentId,
      publicationId: publication.publicationId,
      ecgArtifactId: params.ecgArtifactId,
      elmsResourceId: publication.elmsResourceId,
      schoolId: params.schoolId,
      classGroupId: params.classGroupId,
      assignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'ACTIVE',
      metadata: params.metadata,
    };

    assignmentStore.set(assignmentId, assignment);
    PersistentStateService.persistElmsAssignment(assignment);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'ELMS_ASSESSMENT_ASSIGNED',
      assignmentId,
      ecgArtifactId: params.ecgArtifactId,
      classGroupId: params.classGroupId,
      teacherId: params.teacherId,
    });

    return assignment;
  },

  getAssignmentsForArtifact(schoolId: string, ecgArtifactId: string): ElmsAssignment[] {
    return Array.from(assignmentStore.values()).filter(
      a => a.schoolId === schoolId && a.ecgArtifactId === ecgArtifactId && a.status === 'ACTIVE'
    );
  },

  getAssignmentsForClass(schoolId: string, classGroupId: string): ElmsAssignment[] {
    return Array.from(assignmentStore.values()).filter(
      a => a.schoolId === schoolId && a.classGroupId === classGroupId && a.status === 'ACTIVE'
    );
  },

  withdrawAssignment(schoolId: string, assignmentId: string, teacherId: string): void {
    const assignment = assignmentStore.get(assignmentId);
    if (!assignment || assignment.schoolId !== schoolId) {
      throw new Error(`Assignment ${assignmentId} not found.`);
    }

    assignment.status = 'ARCHIVED';
    assignment.updatedAt = new Date().toISOString();
    PersistentStateService.persistElmsAssignment(assignment);

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'ELMS_ASSESSMENT_ASSIGNMENT_WITHDRAWN',
      assignmentId,
      teacherId,
    });
  },

  // 4. IDENTITY MAPPINGS (Learner & Class)
  mapLearner(params: {
    schoolId: string;
    ecgLearnerId: string;
    elmsLearnerId: string;
    requestingUserId: string;
  }): ElmsLearnerMapping {
    if (!params.schoolId || !params.ecgLearnerId || !params.elmsLearnerId) {
      throw new Error('Missing mandatory learner mapping identifiers');
    }

    // Verify learner exists in ECG roster
    const learner = LearnerRosterService.getLearner(params.ecgLearnerId, params.schoolId);
    if (!learner) {
      throw new Error(`Learner ${params.ecgLearnerId} not found in school ${params.schoolId}`);
    }

    const mappingId = `map_lrn_${params.schoolId}_${params.ecgLearnerId}`;
    const mapping: ElmsLearnerMapping = {
      id: mappingId,
      schoolId: params.schoolId,
      ecgLearnerId: params.ecgLearnerId,
      elmsLearnerId: params.elmsLearnerId,
      status: 'ACTIVE',
      mappedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    learnerMappingStore.set(`${params.schoolId}:ecg:${params.ecgLearnerId}`, mapping);
    learnerMappingStore.set(`${params.schoolId}:elms:${params.elmsLearnerId}`, mapping);
    PersistentStateService.persistElmsLearnerMapping(mapping);

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'ELMS_LEARNER_MAPPING_CREATED',
      ecgLearnerId: params.ecgLearnerId,
      elmsLearnerId: params.elmsLearnerId,
      requestingUserId: params.requestingUserId,
    });

    return mapping;
  },

  getEcgLearnerId(schoolId: string, elmsLearnerId: string): string | undefined {
    const mapping = learnerMappingStore.get(`${schoolId}:elms:${elmsLearnerId}`);
    if (mapping && mapping.status === 'ACTIVE') {
      return mapping.ecgLearnerId;
    }
    // Fallback: check if learnerId is directly valid in ECG for this school
    const learner = LearnerRosterService.getLearner(elmsLearnerId, schoolId);
    if (learner) {
      return learner.id;
    }
    return undefined;
  },

  getElmsLearnerId(schoolId: string, ecgLearnerId: string): string | undefined {
    const mapping = learnerMappingStore.get(`${schoolId}:ecg:${ecgLearnerId}`);
    if (mapping && mapping.status === 'ACTIVE') {
      return mapping.elmsLearnerId;
    }
    return undefined;
  },

  mapClass(params: {
    schoolId: string;
    ecgClassGroupId: string;
    elmsClassGroupId: string;
    requestingUserId: string;
  }): ElmsClassMapping {
    if (!params.schoolId || !params.ecgClassGroupId || !params.elmsClassGroupId) {
      throw new Error('Missing mandatory class mapping identifiers');
    }

    const classGroup = ClassGroupService.getClassGroupById(params.ecgClassGroupId);
    if (!classGroup) {
      throw new Error(`Class group ${params.ecgClassGroupId} not found in school ${params.schoolId}`);
    }

    const mappingId = `map_cls_${params.schoolId}_${params.ecgClassGroupId}`;
    const mapping: ElmsClassMapping = {
      id: mappingId,
      schoolId: params.schoolId,
      ecgClassGroupId: params.ecgClassGroupId,
      elmsClassGroupId: params.elmsClassGroupId,
      status: 'ACTIVE',
      mappedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    classMappingStore.set(`${params.schoolId}:ecg:${params.ecgClassGroupId}`, mapping);
    classMappingStore.set(`${params.schoolId}:elms:${params.elmsClassGroupId}`, mapping);
    PersistentStateService.persistElmsClassMapping(mapping);

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'ELMS_CLASS_MAPPING_CREATED',
      ecgClassGroupId: params.ecgClassGroupId,
      elmsClassGroupId: params.elmsClassGroupId,
      requestingUserId: params.requestingUserId,
    });

    return mapping;
  },

  getEcgClassGroupId(schoolId: string, elmsClassGroupId: string): string | undefined {
    const mapping = classMappingStore.get(`${schoolId}:elms:${elmsClassGroupId}`);
    if (mapping && mapping.status === 'ACTIVE') {
      return mapping.ecgClassGroupId;
    }
    const classGroup = ClassGroupService.getClassGroupById(elmsClassGroupId);
    if (classGroup) {
      return classGroup.id;
    }
    return undefined;
  },

  getElmsClassGroupId(schoolId: string, ecgClassGroupId: string): string | undefined {
    const mapping = classMappingStore.get(`${schoolId}:ecg:${ecgClassGroupId}`);
    if (mapping && mapping.status === 'ACTIVE') {
      return mapping.elmsClassGroupId;
    }
    return undefined;
  },

  isSimulatedLearningEvent<T = any>(
    eventInput: Partial<ElmsLearningEvent<T>>
  ): boolean {
    if (!eventInput) return false;
    const payload = (eventInput.payload || {}) as Record<string, unknown>;
    if (
      eventInput.sourceSystem === 'DEMO' ||
      payload.isSimulated === true ||
      payload.evidenceOrigin === 'SIMULATED' ||
      payload.evidenceOrigin === 'TEST_FIXTURE' ||
      (typeof eventInput.eventId === 'string' && eventInput.eventId.startsWith('evt_sim_')) ||
      (typeof eventInput.idempotencyKey === 'string' && eventInput.idempotencyKey.startsWith('idemp_sim_')) ||
      (typeof payload.attemptId === 'string' && payload.attemptId.startsWith('att_sim_'))
    ) {
      return true;
    }
    return false;
  },

  // 4. LEARNING EVENT INGESTION & SYNCHRONIZATION (ELMS → ECG)
  ingestLearningEvent<T = any>(eventInput: Omit<ElmsLearningEvent<T>, 'status' | 'retryCount' | 'processedAt'>): {
    event: ElmsLearningEvent<T>;
    actionTaken: string;
  } {
    if (!eventInput.schoolId || !eventInput.eventId || !eventInput.idempotencyKey) {
      throw new Error('Invalid event: Missing mandatory eventId, schoolId, or idempotencyKey');
    }

    const isSimulatedEvent = this.isSimulatedLearningEvent(eventInput);
    if (isSimulatedEvent && !AssessmentEvidenceService.isDemoSimulationAllowed()) {
      AuditService.log('SECURITY_VIOLATION', eventInput.schoolId, {
        action: 'PRODUCTION_SIMULATED_ELMS_EVENT_REJECTED',
        eventId: eventInput.eventId,
        eventType: eventInput.eventType,
        sourceSystem: eventInput.sourceSystem,
      });
      throw new Error(
        'Production security guard: Simulated or demo ELMS learning events are rejected in production.'
      );
    }

    // 1. Idempotency check: Repeated delivery with same idempotencyKey is safely deduplicated
    const idempotencyKey = `${eventInput.schoolId}:${eventInput.idempotencyKey}`;
    const existingEventId = idempotencyStore.get(idempotencyKey);
    if (existingEventId && eventStore.has(existingEventId)) {
      const existingEvent = eventStore.get(existingEventId)! as ElmsLearningEvent<T>;
      return {
        event: {
          ...existingEvent,
          status: 'IGNORED_DUPLICATE',
        },
        actionTaken: 'IDEMPOTENT_DUPLICATE_IGNORED',
      };
    }

    const event: ElmsLearningEvent<T> = {
      ...eventInput,
      sourceSystem: isSimulatedEvent ? 'DEMO' : eventInput.sourceSystem,
      status: 'PENDING',
      retryCount: 0,
    };

    eventStore.set(event.eventId, event);
    idempotencyStore.set(idempotencyKey, event.eventId);

    // 2. Identity Resolution
    let resolvedLearnerId: string | undefined = undefined;
    if (event.learnerId) {
      resolvedLearnerId = this.getEcgLearnerId(event.schoolId, event.learnerId);
    }

    let resolvedClassGroupId: string | undefined = undefined;
    if (event.classGroupId) {
      resolvedClassGroupId = this.getEcgClassGroupId(event.schoolId, event.classGroupId);
    }

    let resolvedArtifactId = event.ecgArtifactId;
    let resolvedPublication: ElmsResourcePublication | undefined = undefined;

    if (!resolvedArtifactId && event.resourceId) {
      // Find publication matching resourceId
      resolvedPublication = Array.from(publicationStore.values()).find(
        (p) => p.schoolId === event.schoolId && (p.elmsResourceId === event.resourceId || p.ecgArtifactId === event.resourceId)
      );
      if (resolvedPublication) {
        resolvedArtifactId = resolvedPublication.ecgArtifactId;
      }
    } else if (resolvedArtifactId) {
      resolvedPublication = this.getPublication(event.schoolId, resolvedArtifactId);
    }

    const teachingPlanId = event.teachingPlanId || resolvedPublication?.teachingPlanId || 'tp_default';
    const teachingAllocationId = event.teachingAllocationId || resolvedPublication?.teachingAllocationId || 'week_1_lesson_1';
    const curriculumVersionId = resolvedPublication?.curriculumVersionId || 'kicd_cbe_2026';
    const learningOutcomeId = event.learningOutcomeId || resolvedPublication?.learningOutcomeIds?.[0] || 'lo_default';

    let actionTaken = 'EVENT_PROCESSED';

    try {
      switch (event.eventType) {
        case 'LEARNING_ACTIVITY_STARTED': {
          if (!resolvedLearnerId) {
            throw new Error(`Cannot process ${event.eventType}: Unmapped or unknown learner ID ${event.learnerId}`);
          }
          const activity = TeachingActivityService.createLearnerActivity({
            schoolId: event.schoolId,
            learnerId: resolvedLearnerId,
            teachingPlanId,
            teachingAllocationId,
            curriculumVersionId,
            learningOutcomeId,
            artifactId: resolvedArtifactId,
            artifactVersion: resolvedPublication?.artifactVersion,
            activityType: 'LESSON_ENGAGEMENT',
          });
          TeachingActivityService.startLearnerActivity(activity.activityId, event.schoolId, resolvedLearnerId);
          actionTaken = `LEARNER_ACTIVITY_STARTED:${activity.activityId}`;
          break;
        }

        case 'LEARNING_ACTIVITY_COMPLETED': {
          if (!resolvedLearnerId) {
            throw new Error(`Cannot process ${event.eventType}: Unmapped or unknown learner ID ${event.learnerId}`);
          }
          const activity = TeachingActivityService.createLearnerActivity({
            schoolId: event.schoolId,
            learnerId: resolvedLearnerId,
            teachingPlanId,
            teachingAllocationId,
            curriculumVersionId,
            learningOutcomeId,
            artifactId: resolvedArtifactId,
            artifactVersion: resolvedPublication?.artifactVersion,
            activityType: 'LESSON_ENGAGEMENT',
          });
          TeachingActivityService.startLearnerActivity(activity.activityId, event.schoolId, resolvedLearnerId);
          TeachingActivityService.completeLearnerActivity(activity.activityId, event.schoolId, 'system', 'system');
          actionTaken = `LEARNER_ACTIVITY_COMPLETED:${activity.activityId}`;
          break;
        }

        case 'LEARNER_ACTIVITY_RECORDED': {
          if (!resolvedLearnerId) {
            throw new Error(`Cannot process ${event.eventType}: Unmapped or unknown learner ID ${event.learnerId}`);
          }
          const activity = TeachingActivityService.createLearnerActivity({
            schoolId: event.schoolId,
            learnerId: resolvedLearnerId,
            teachingPlanId,
            teachingAllocationId,
            curriculumVersionId,
            learningOutcomeId,
            artifactId: resolvedArtifactId,
            artifactVersion: resolvedPublication?.artifactVersion,
            activityType: ((event.payload as any)?.activityType as any) || 'LESSON_ENGAGEMENT',
          });
          actionTaken = `LEARNER_ACTIVITY_RECORDED:${activity.activityId}`;
          break;
        }

        case 'ASSESSMENT_STARTED': {
          if (!resolvedLearnerId) {
            throw new Error(`Cannot process ${event.eventType}: Unmapped or unknown learner ID ${event.learnerId}`);
          }
          const assessmentId = (event.payload as any)?.assessmentId || event.resourceId || 'asmt_elms_auto';
          
          // Ensure assessment exists in assessment store or create placeholder
          try {
            AssessmentEvidenceService.getAssessment(assessmentId, event.schoolId);
          } catch {
            AssessmentEvidenceService.createAssessment({
              schoolId: event.schoolId,
              curriculumVersionId,
              learningOutcomeId,
              title: (event.payload as any)?.title || 'ELMS Integrated Online Assessment',
              teachingPlanId,
              teachingAllocationId,
              contentArtifactId: resolvedArtifactId,
              items: [
                {
                  sequence: 1,
                  type: 'MULTIPLE_CHOICE',
                  prompt: 'Integrated ELMS Item 1',
                  marks: 10,
                  correctAnswer: 'A',
                  learningOutcomeId,
                },
              ],
            });
          }

          const attempt = AssessmentEvidenceService.startAttempt({
            assessmentId,
            schoolId: event.schoolId,
            learnerId: resolvedLearnerId,
          });
          actionTaken = `ASSESSMENT_ATTEMPT_STARTED:${attempt.attemptId}`;
          break;
        }

        case 'ASSESSMENT_SUBMITTED':
        case 'ASSESSMENT_COMPLETED': {
          if (!resolvedLearnerId) {
            throw new Error(`Cannot process ${event.eventType}: Unmapped or unknown learner ID ${event.learnerId}`);
          }
          const payload = (event.payload || {}) as Partial<ElmsAssessmentSubmissionPayload>;
          const assessmentId = payload.assessmentId || event.resourceId || 'asmt_elms_auto';
          
          let assessment: any;
          // First check by artifact ID
          if (resolvedArtifactId) {
            assessment = AssessmentEvidenceService.getAssessmentByArtifactId(resolvedArtifactId, event.schoolId);
          }
          if (!assessment) {
            try {
              assessment = AssessmentEvidenceService.getAssessment(assessmentId, event.schoolId);
            } catch {
              // Try to reconstruct assessment items from ContentArtifactRepository if available
              let artifactQuestions: any[] = [];
              if (resolvedArtifactId) {
                const art = ContentArtifactRepository.getById(resolvedArtifactId, event.schoolId);
                if (art && art.content && Array.isArray((art.content as any).questions)) {
                  artifactQuestions = (art.content as any).questions;
                }
              }

              const items = artifactQuestions.length > 0
                ? artifactQuestions.map((q, idx) => ({
                    sequence: idx + 1,
                    type: (q.questionType === 'multiple_choice' ? 'MULTIPLE_CHOICE' : 'STRUCTURED') as any,
                    prompt: q.questionText || `Question ${idx + 1}`,
                    marks: q.marks || 1,
                    correctAnswer: q.correctOption || q.correctAnswer || 'A',
                    learningOutcomeId,
                  }))
                : [
                    {
                      sequence: 1,
                      type: 'MULTIPLE_CHOICE' as const,
                      prompt: 'Integrated Question',
                      marks: 10,
                      correctAnswer: 'A',
                      learningOutcomeId,
                    },
                  ];

              assessment = AssessmentEvidenceService.createAssessment({
                schoolId: event.schoolId,
                curriculumVersionId,
                learningOutcomeId,
                title: resolvedPublication?.metadata?.title as string || 'ELMS Integrated Assessment',
                teachingPlanId,
                teachingAllocationId,
                contentArtifactId: resolvedArtifactId,
                items,
              });
            }
          }

          const attempt = AssessmentEvidenceService.startAttempt({
            attemptId: payload.attemptId,
            assessmentId: assessment.assessmentId,
            schoolId: event.schoolId,
            learnerId: resolvedLearnerId,
          });

          const responses = payload.responses && payload.responses.length > 0
            ? payload.responses
            : [{ itemId: assessment.items[0]?.itemId || 'item_1', response: 'A' }];

          const submitResult = AssessmentEvidenceService.submitAttempt(
            attempt.attemptId,
            event.schoolId,
            resolvedLearnerId,
            responses
          );

          // Phase 26 & 31.2: Ensure ELMS Assessment Evidence Record is registered with accurate provenance and linkage
          const elmsRecId = `elms_evd_${attempt.attemptId}`;
          if (submitResult.evaluation) {
            AssessmentEvidenceService.recordElmsEvidenceRecord({
              evidenceRecordId: elmsRecId,
              evidenceId: submitResult.evidence?.evidenceId,
              schoolId: event.schoolId,
              ecgArtifactId: resolvedArtifactId || assessment.contentArtifactId || assessment.assessmentId,
              elmsResourceId: event.resourceId || resolvedPublication?.elmsResourceId || assessment.assessmentId,
              assessmentId: assessment.assessmentId,
              attemptId: attempt.attemptId,
              learnerId: resolvedLearnerId,
              elmsLearnerId: event.learnerId,
              classGroupId: resolvedClassGroupId || resolvedPublication?.classGroupId || assessment.classGroupId,
              curriculumVersionId,
              learningOutcomeId: assessment.learningOutcomeId || learningOutcomeId,
              score: submitResult.evaluation.marksAwarded,
              maxScore: submitResult.evaluation.totalMarks,
              percentage: submitResult.evaluation.percentage,
              status: isSimulatedEvent ? 'RECORDED' : 'SYNCHRONIZED',
              responses: assessment.items.map((it: any, idx: number) => {
                const userR =
                  responses.find((r: any) => r.itemId === it.itemId || r.itemId === `item_${idx + 1}`) ||
                  (responses.length === assessment.items.length ? responses[idx] : undefined);
                const scoreItem = submitResult.evaluation?.itemScores?.find((s: any) => s.itemId === it.itemId);
                const isC = scoreItem ? scoreItem.marksAwarded === scoreItem.maxMarks : false;
                return {
                  itemId: it.itemId,
                  questionText: it.prompt,
                  response: userR?.response ?? '',
                  correctAnswer: it.correctAnswer,
                  marksAwarded: scoreItem?.marksAwarded ?? 0,
                  maxMarks: scoreItem?.maxMarks ?? it.marks ?? 1,
                  isCorrect: isC,
                  feedback: scoreItem?.feedback,
                };
              }),
              submittedAt: attempt.submittedAt || event.timestamp || new Date().toISOString(),
              evaluatedAt: submitResult.evaluation.evaluatedAt,
              provenance: {
                sourceSystem: isSimulatedEvent ? 'DEMO' : 'ELMS',
                evidenceOrigin: isSimulatedEvent ? 'SIMULATED' : 'AUTHORITATIVE_ELMS',
                eventId: event.eventId,
                evaluatorType: submitResult.evaluation.evaluatorType,
                notes: isSimulatedEvent
                  ? `Simulated demo submission from event ${event.eventId}`
                  : `Synchronized from ELMS Event ${event.eventId}`,
              },
              metadata: {
                ...(isSimulatedEvent ? { isSimulated: true, evidenceOrigin: 'SIMULATED' } : {}),
              },
            });
          }

          actionTaken = `ASSESSMENT_SUBMITTED_AND_EVIDENCED:${submitResult.attempt.attemptId}`;
          break;
        }

        case 'LEARNING_EVIDENCE_RECORDED': {
          actionTaken = `LEARNING_EVIDENCE_RECORDED_FOR_OUTCOME:${learningOutcomeId}`;
          break;
        }

        default: {
          actionTaken = `GENERIC_EVENT_RECORDED:${event.eventType}`;
          break;
        }
      }

      event.status = 'PROCESSED';
      event.processedAt = new Date().toISOString();

      AuditService.log('ARTIFACT_CREATED', event.schoolId, {
        action: 'ELMS_EVENT_PROCESSED',
        eventId: event.eventId,
        eventType: event.eventType,
        actionTaken,
      });
    } catch (err: any) {
      event.status = 'FAILED';
      event.processingError = err.message;
      AuditService.log('SECURITY_VIOLATION', event.schoolId, {
        action: 'ELMS_EVENT_PROCESSING_FAILED',
        eventId: event.eventId,
        eventType: event.eventType,
        error: err.message,
      });
    }

    PersistentStateService.persistElmsLearningEvent(event);
    return { event, actionTaken };
  },

  getEvent(schoolId: string, eventId: string): ElmsLearningEvent | undefined {
    const event = eventStore.get(eventId);
    if (event && event.schoolId !== schoolId) {
      throw new Error(`Security Violation: Access denied to event for school ${schoolId}`);
    }
    return event;
  },

  listEvents(schoolId: string, filter?: { eventType?: ElmsEventType; status?: ElmsEventStatus }): ElmsLearningEvent[] {
    return Array.from(eventStore.values()).filter((e) => {
      if (e.schoolId !== schoolId) return false;
      if (filter?.eventType && e.eventType !== filter.eventType) return false;
      if (filter?.status && e.status !== filter.status) return false;
      return true;
    });
  },

  // 5. RETRY & RECONCILIATION
  retryFailedEvent(schoolId: string, eventId: string): { success: boolean; event: ElmsLearningEvent } {
    const event = this.getEvent(schoolId, eventId);
    if (!event) {
      throw new Error(`Event ${eventId} not found in school ${schoolId}`);
    }

    event.retryCount += 1;
    // Attempt re-ingestion
    const result = this.ingestLearningEvent({
      eventId: event.eventId,
      sourceSystem: event.sourceSystem,
      eventType: event.eventType,
      schoolId: event.schoolId,
      learnerId: event.learnerId,
      classGroupId: event.classGroupId,
      resourceId: event.resourceId,
      ecgArtifactId: event.ecgArtifactId,
      teachingPlanId: event.teachingPlanId,
      teachingAllocationId: event.teachingAllocationId,
      learningOutcomeId: event.learningOutcomeId,
      timestamp: event.timestamp,
      eventVersion: event.eventVersion,
      payloadVersion: event.payloadVersion,
      correlationId: event.correlationId,
      idempotencyKey: `${event.idempotencyKey}_retry_${event.retryCount}`,
      payload: event.payload,
    });

    return {
      success: result.event.status === 'PROCESSED',
      event: result.event,
    };
  },

  reconcile(schoolId: string): ElmsReconciliationReport {
    const publications = this.listPublications(schoolId);
    const learnerMappings = Array.from(learnerMappingStore.values()).filter((m) => m.schoolId === schoolId);
    const classMappings = Array.from(classMappingStore.values()).filter((m) => m.schoolId === schoolId);

    const initialEvents = this.listEvents(schoolId);
    const initialFailed = initialEvents.filter((e) => e.status === 'FAILED');

    // Attempt to retry failed events
    for (const failed of initialFailed) {
      if (failed.learnerId && this.getEcgLearnerId(schoolId, failed.learnerId)) {
        try {
          this.retryFailedEvent(schoolId, failed.eventId);
        } catch {
          // Keep as failed if still unresolved
        }
      }
    }

    const updatedEvents = this.listEvents(schoolId);
    const pendingEvents = updatedEvents.filter((e) => e.status === 'PENDING');
    const failedEvents = updatedEvents.filter((e) => e.status === 'FAILED');
    const processedEvents = updatedEvents.filter((e) => e.status === 'PROCESSED');

    const report: ElmsReconciliationReport = {
      schoolId,
      generatedAt: new Date().toISOString(),
      publishedResourcesCount: publications.length,
      learnerMappingsCount: learnerMappings.length,
      classMappingsCount: classMappings.length,
      processedEventsCount: processedEvents.length,
      pendingEventsCount: pendingEvents.length,
      failedEventsCount: failedEvents.length,
      unmappedLearnersCount: failedEvents.filter((e) => e.processingError?.includes('Unmapped')).length,
      unmappedClassesCount: 0,
      unresolvedEvents: failedEvents,
    };

    AuditService.log('ARTIFACT_CREATED', schoolId, {
      action: 'ELMS_RECONCILIATION_PERFORMED',
      schoolId,
      processedEventsCount: report.processedEventsCount,
      failedEventsCount: report.failedEventsCount,
    });

    return report;
  },

  getSyncStatus(schoolId: string): ElmsSyncStatus {
    const events = this.listEvents(schoolId);
    const totalReceived = events.length;
    const totalProcessed = events.filter((e) => e.status === 'PROCESSED').length;
    const totalFailed = events.filter((e) => e.status === 'FAILED').length;
    const totalPending = events.filter((e) => e.status === 'PENDING').length;
    const lastEvent = events.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

    return {
      totalReceived,
      totalProcessed,
      totalFailed,
      totalPending,
      lastSyncAt: lastEvent ? lastEvent.timestamp : undefined,
      unresolvedIssuesCount: totalFailed + totalPending,
    };
  },

  async syncSchoolElmsStateFromFirestore(schoolId: string): Promise<{
    publications: ElmsResourcePublication[];
    events: ElmsLearningEvent[];
  }> {
    return PersistentStateService.hydrateSchoolElmsIntegration(schoolId);
  },
};

PersistentStateService.registerDomainService('ElmsIntegrationService', {
  clearInMemoryOnly: () => {
    publicationStore.clear();
    publicationByArtifactStore.clear();
    learnerMappingStore.clear();
    classMappingStore.clear();
    assignmentStore.clear();
    eventStore.clear();
    idempotencyStore.clear();
  },
  ingestState: (data: {
    schoolId?: string;
    publications?: ElmsResourcePublication[];
    mappings?: Array<any>;
    assignments?: ElmsAssignment[];
    events?: ElmsLearningEvent[];
  }) => {
    if (Array.isArray(data?.publications)) {
      for (const pub of data.publications) {
        if (pub?.publicationId && pub.schoolId && pub.ecgArtifactId) {
          publicationStore.set(pub.publicationId, pub);
          publicationByArtifactStore.set(`${pub.schoolId}:${pub.ecgArtifactId}`, pub.publicationId);
        }
      }
    }
    if (Array.isArray(data?.mappings)) {
      for (const m of data.mappings) {
        if (!m || !m.schoolId) continue;
        if (m.mappingKind === 'LEARNER' || (m.ecgLearnerId && m.elmsLearnerId)) {
          learnerMappingStore.set(`${m.schoolId}:ecg:${m.ecgLearnerId}`, m);
          learnerMappingStore.set(`${m.schoolId}:elms:${m.elmsLearnerId}`, m);
        } else if (m.mappingKind === 'CLASS' || (m.ecgClassGroupId && m.elmsClassGroupId)) {
          classMappingStore.set(`${m.schoolId}:ecg:${m.ecgClassGroupId}`, m);
          classMappingStore.set(`${m.schoolId}:elms:${m.elmsClassGroupId}`, m);
        }
      }
    }
    if (Array.isArray(data?.assignments)) {
      for (const asgn of data.assignments) {
        if (asgn?.assignmentId) {
          assignmentStore.set(asgn.assignmentId, asgn);
        }
      }
    }
    if (Array.isArray(data?.events)) {
      for (const evt of data.events) {
        if (evt?.eventId && evt.schoolId) {
          eventStore.set(evt.eventId, evt);
          if (evt.idempotencyKey) {
            idempotencyStore.set(`${evt.schoolId}:${evt.idempotencyKey}`, evt.eventId);
          }
        }
      }
    }
  },
});
