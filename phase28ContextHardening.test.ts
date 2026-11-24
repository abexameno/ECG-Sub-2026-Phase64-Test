
import { ElmsIntegrationService } from './services/elmsIntegrationService';
import { LearningOutcomeInterpretationService } from './services/learningOutcomeInterpretationService';
import { AssessmentEvidenceService } from './services/assessmentEvidenceService';
import { LearnerRosterService } from './services/learnerRosterService';
import { ClassGroupService } from './services/classGroupService';
import { SchoolMembershipService } from './services/schoolMembershipService';
import { SchoolConfigService } from './services/schoolConfigService';
import { ContentArtifactRepository } from './services/contentArtifactRepository';

describe('Phase 28 - Assessment Evidence Context Hardening & Teacher Review', () => {
  const schoolId = 'lwps';
  const teacherId = 't_lwps_1';
  const adminId = '5';
  const loId = 'lo_math_1.1';

  beforeEach(() => {
    ElmsIntegrationService.clearStore();
    LearningOutcomeInterpretationService.clearStore();
    AssessmentEvidenceService.clearStore();
    LearnerRosterService.clearStore();
    ClassGroupService.clearStore();
    SchoolMembershipService.clearStore();
    SchoolConfigService.clearStore();

    // Setup school and teacher
    SchoolConfigService.registerSchool({ 
      id: schoolId, 
      name: 'LWPS', 
      county: 'Nairobi', 
      schoolType: 'Primary',
      gradesOffered: ['Grade 1', 'Grade 2', 'Grade 3'],
      learningAreasOffered: ['la-math'],
      curriculumSystem: 'Kenya CBC',
      academicYear: '2026',
      status: 'active'
    } as any);
    SchoolMembershipService.addMembership({
      userId: teacherId,
      schoolId,
      role: 'TEACHER',
      status: 'ACTIVE'
    });

    // Setup 2 classes
    ClassGroupService.createClassGroup({
      id: 'cg_1',
      name: 'Grade 3A',
      schoolId,
      academicYearId: 'ay_2026',
    });
    ClassGroupService.createClassGroup({
      id: 'cg_2',
      name: 'Grade 3B',
      schoolId,
      academicYearId: 'ay_2026',
    });

    // Add learners to each
    LearnerRosterService.addLearner({ id: 'l1', displayName: 'L1', schoolId, classGroupId: 'cg_1', academicYearId: 'ay_2026', requestingUserId: adminId });
    LearnerRosterService.addLearner({ id: 'l2', displayName: 'L2', schoolId, classGroupId: 'cg_2', academicYearId: 'ay_2026', requestingUserId: adminId });
  });

  test('Context Hardening: Assignment should be created upon publication with classGroupId', () => {
    const artifactId = 'art_123';
    
    // Mock artifact in repo
    ContentArtifactRepository.save({
      id: artifactId,
      schoolId,
      title: 'Context Test',
      artifactType: 'assessment',
      gradeLevelId: 'grade-3',
      learningAreaId: 'la-math',
      curriculumReferences: [{ learningOutcomeIds: [loId] }],
      version: 1,
      status: 'validated',
      source: 'generator',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any);

    AssessmentEvidenceService.createAssessment({
      schoolId,
      curriculumVersionId: 'v1',
      learningOutcomeId: loId,
      title: 'Context Test',
      contentArtifactId: artifactId,
      items: [{ prompt: 'Q1', marks: 10, correctAnswer: 'A' }]
    });

    const pub = ElmsIntegrationService.publishResource({
      schoolId,
      teacherId,
      ecgArtifactId: artifactId,
      classGroupId: 'cg_1'
    });

    expect(pub.status).toBe('PUBLISHED');
    
    const assignments = ElmsIntegrationService.getAssignmentsForArtifact(schoolId, artifactId);
    expect(assignments.length).toBe(1);
    expect(assignments[0].classGroupId).toBe('cg_1');
  });

  test('Teacher Review: Explicit confirmation sets status to REVIEWED', () => {
    const artifactId = 'art_review';
    
    ContentArtifactRepository.save({
      id: artifactId,
      schoolId,
      title: 'Review Test',
      artifactType: 'assessment',
      gradeLevelId: 'grade-3',
      learningAreaId: 'la-math',
      curriculumReferences: [{ learningOutcomeIds: [loId] }],
      version: 1,
      status: 'validated',
      source: 'generator',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any);

    AssessmentEvidenceService.createAssessment({
      schoolId,
      curriculumVersionId: 'v1',
      learningOutcomeId: loId,
      title: 'Review Test',
      contentArtifactId: artifactId,
      items: [{ prompt: 'Q1', marks: 10, correctAnswer: 'A' }]
    });

    // Publish and Assign
    ElmsIntegrationService.publishResource({ schoolId, teacherId, ecgArtifactId: artifactId, classGroupId: 'cg_1' });

    // Initial interpretation should be PENDING_REVIEW
    let interp = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
      ecgArtifactId: artifactId,
      schoolId,
      requestingTeacherId: teacherId
    });
    expect(interp.teacherReviewStatus).toBe('PENDING_REVIEW');

    // Confirm Review
    interp = LearningOutcomeInterpretationService.confirmAssessmentReview({
      ecgArtifactId: artifactId,
      schoolId,
      teacherId
    });
    expect(interp.teacherReviewStatus).toBe('REVIEWED');
  });

  test('Multi-Assignment Context Resolution: Should filter roster and evidence by classGroupId', () => {
    const artifactId = 'art_multi';

    ContentArtifactRepository.save({
      id: artifactId,
      schoolId,
      title: 'Multi Context',
      artifactType: 'assessment',
      gradeLevelId: 'grade-3',
      learningAreaId: 'la-math',
      curriculumReferences: [{ learningOutcomeIds: [loId] }],
      version: 1,
      status: 'validated',
      source: 'generator',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any);

    const assessment = AssessmentEvidenceService.createAssessment({
      schoolId,
      curriculumVersionId: 'v1',
      learningOutcomeId: loId,
      title: 'Multi Context',
      contentArtifactId: artifactId,
      items: [{ prompt: 'Q1', marks: 10, correctAnswer: 'A' }]
    });

    // Assign to 2 classes
    ElmsIntegrationService.publishResource({ schoolId, teacherId, ecgArtifactId: artifactId, classGroupId: 'cg_1' });
    ElmsIntegrationService.assignAssessmentToClass({ schoolId, teacherId, ecgArtifactId: artifactId, classGroupId: 'cg_2' });

    // Ingest submission for L1 (cg_1)
    ElmsIntegrationService.ingestLearningEvent({
      eventId: 'evt_l1',
      sourceSystem: 'ELMS',
      eventType: 'ASSESSMENT_SUBMITTED',
      schoolId,
      learnerId: 'l1',
      ecgArtifactId: artifactId,
      timestamp: new Date().toISOString(),
      idempotencyKey: 'idemp_l1',
      payload: { assessmentId: assessment.assessmentId, attemptId: 'att_l1', learnerId: 'l1', responses: [{ itemId: assessment.items[0].itemId, response: 'A' }] }
    });

    // 1. Interpret for ALL assignments
    const interpAll = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
      ecgArtifactId: artifactId,
      schoolId,
      requestingTeacherId: teacherId
    });
    // Should see both L1 and L2
    expect(interpAll.learnerInterpretations.length).toBe(2);
    expect(interpAll.factualSummary.availableAssignments?.length).toBe(2);

    // 2. Interpret for CG_1 ONLY
    const interpCG1 = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
      ecgArtifactId: artifactId,
      schoolId,
      requestingTeacherId: teacherId,
      classGroupId: 'cg_1'
    });
    // Should see ONLY L1
    expect(interpCG1.learnerInterpretations.length).toBe(1);
    expect(interpCG1.learnerInterpretations[0].learnerId).toBe('l1');

    // 3. Interpret for CG_2 ONLY
    const interpCG2 = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
      ecgArtifactId: artifactId,
      schoolId,
      requestingTeacherId: teacherId,
      classGroupId: 'cg_2'
    });
    // Should see ONLY L2 (with insufficient evidence)
    expect(interpCG2.learnerInterpretations.length).toBe(1);
    expect(interpCG2.learnerInterpretations[0].learnerId).toBe('l2');
    expect(interpCG2.learnerInterpretations[0].status).toBe('INSUFFICIENT_EVIDENCE');
  });
});
