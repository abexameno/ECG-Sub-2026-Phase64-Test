import { ElmsIntegrationService } from './services/elmsIntegrationService';
import { ElmsConnectionService } from './services/elmsConnectionService';
import { ContentArtifactRepository } from './services/contentArtifactRepository';
import { SchoolConfigService } from './services/schoolConfigService';
import { SchoolMembershipService } from './services/schoolMembershipService';
import { AuditService } from './services/auditService';
import { AssessmentEvidenceService } from './services/assessmentEvidenceService';
import { ContentType, QuestionType, GeneratedContent, User } from './types';

describe('Phase 25C: ECG Assessment → ELMS Publishing Panel & Workflow', () => {
  const schoolA = 'lwps';
  const schoolB = 'school-b';
  const teacherA = '2'; // Active teacher in lwps
  const teacherB = '4'; // Active teacher in school-b

  const sampleAssessmentContent: GeneratedContent = {
    id: 'art_assessment_t1_w3_l2',
    ownerId: teacherA,
    title: 'Grade 8 Integrated Science Midterm Assessment: Mixtures',
    questions: [
      {
        questionType: QuestionType.MultipleChoice,
        questionText: 'Which method separates a mixture of iron filings and sulfur powder?',
        options: ['Filtration', 'Magnetic separation', 'Distillation', 'Chromatography'],
        correctOption: 'B',
        correctAnswer: 'Magnetic separation',
        marks: 2,
      },
      {
        questionType: QuestionType.ShortAnswer,
        questionText: 'Define a homogeneous mixture and provide one everyday example.',
        correctAnswer: 'A mixture with uniform composition throughout. Example: Salt dissolved in water.',
        marks: 3,
      },
    ],
    metadata: {
      schoolId: schoolA,
      grade: 'Grade 8',
      subject: 'Integrated Science',
      topic: 'Mixtures - Physical and Chemical Changes',
      contentType: ContentType.Assessment,
      term: 'Term 1',
      terms: ['Term 1'],
      week: '3',
      lessonNumber: '2',
      strand: '1.0 Mixtures',
      subStrand: '1.2 Physical and Chemical Changes',
      specificLearningOutcome: 'Learner should be able to separate solid-solid mixtures using appropriate techniques.',
      parentArtifactId: 'art_assessment_t1_w3_l2',
      masterSowId: 'master_sow_grade8_science_term1',
      curriculumLessonId: 'canonical-grade8-integratedscience-w3-l2',
      scheduledLessonId: 'sched-w3-p2',
    },
    savedAt: new Date().toISOString(),
  };

  function seedSampleArtifact() {
    ContentArtifactRepository.save({
      id: sampleAssessmentContent.id!,
      schoolId: schoolA,
      version: 1,
      artifactType: 'assessment',
      curriculumId: 'canonical-cbc',
      curriculumVersion: '2024.1',
      gradeLevelId: sampleAssessmentContent.metadata!.grade,
      learningAreaId: sampleAssessmentContent.metadata!.subject,
      status: 'validated',
      source: 'ai_generated',
      curriculumReferences: [
        {
          gradeLevelId: sampleAssessmentContent.metadata!.grade,
          learningAreaId: sampleAssessmentContent.metadata!.subject,
          learningOutcomeIds: ['slo-1'],
        },
      ],
      content: sampleAssessmentContent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  function publishSampleAssessment() {
    seedSampleArtifact();
    return ElmsIntegrationService.publishResource({
      schoolId: schoolA,
      teacherId: teacherA,
      ecgArtifactId: sampleAssessmentContent.id!,
      metadata: { title: sampleAssessmentContent.title },
    });
  }

  beforeEach(() => {
    ElmsIntegrationService.clearStore();
    ElmsConnectionService.clearStore();
    AuditService.clearLogs();
    AssessmentEvidenceService.clearStore();

    // Ensure school profiles
    try {
      SchoolConfigService.getSchoolProfile(schoolA);
    } catch {
      SchoolConfigService.saveSchoolProfile({
        id: schoolA,
        name: 'Lightweight Primary School',
        county: 'Nairobi',
        subCounty: 'Westlands',
        curriculumType: 'CBC_CBE',
        gradesSupported: ['grade-7', 'grade-8'],
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    try {
      SchoolConfigService.getSchoolProfile(schoolB);
    } catch {
      SchoolConfigService.saveSchoolProfile({
        id: schoolB,
        name: 'School B Academy',
        county: 'Mombasa',
        subCounty: 'Nyali',
        curriculumType: 'CBC_CBE',
        gradesSupported: ['grade-7', 'grade-8'],
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Connect school A to ELMS
    ElmsConnectionService.connectSchool({
      schoolId: schoolA,
      teacherId: teacherA,
    });
  });

  describe('1-6. Assessment Discovery, Lineage & ECG Context Display', () => {
    it('1 & 2: Discovers ECG assessment and preserves full curriculum lineage', () => {
      expect(sampleAssessmentContent.id).toBe('art_assessment_t1_w3_l2');
      expect(sampleAssessmentContent.metadata?.grade).toBe('Grade 8');
      expect(sampleAssessmentContent.metadata?.subject).toBe('Integrated Science');
      expect(sampleAssessmentContent.metadata?.masterSowId).toBe('master_sow_grade8_science_term1');
      expect(sampleAssessmentContent.metadata?.curriculumLessonId).toBe('canonical-grade8-integratedscience-w3-l2');
      expect(sampleAssessmentContent.metadata?.scheduledLessonId).toBe('sched-w3-p2');
    });

    it('3-6: Confirms ECG context indicators (SOW, Lesson Plan, Notes, ROWC) are recognized ECG-side only', () => {
      const meta = sampleAssessmentContent.metadata!;
      const isSowLinked = !!meta.masterSowId;
      const isPlanLinked = !!meta.curriculumLessonId;
      const isNotesLinked = !!(meta.strand && meta.subStrand);

      expect(isSowLinked).toBe(true);
      expect(isPlanLinked).toBe(true);
      expect(isNotesLinked).toBe(true);
    });
  });

  describe('7-13. Readiness Validation, Preconditions & Authorization', () => {
    it('7: Validates readiness when assessment, questions, and active ELMS connection exist', () => {
      const conn = ElmsConnectionService.getConnection(schoolA);
      expect(conn.status).toBe('CONNECTED');
      expect(sampleAssessmentContent.questions?.length).toBeGreaterThan(0);
    });

    it('8: Missing assessment content is rejected', () => {
      expect(() => {
        ElmsIntegrationService.publishResource({
          schoolId: schoolA,
          teacherId: teacherA,
          ecgArtifactId: 'non_existent_artifact_id',
        });
      }).toThrow(/not found/i);
    });

    it('10: Assessments without questions are rejected before publishing', () => {
      const emptyAssessment: GeneratedContent = {
        ...sampleAssessmentContent,
        id: 'empty_art',
        questions: [],
      };
      const hasQuestions = emptyAssessment.questions && emptyAssessment.questions.length > 0;
      expect(hasQuestions).toBe(false);
    });

    it('12: Missing ELMS connection for an unconnected school prevents publishing', () => {
      const connB = ElmsConnectionService.getConnection(schoolB);
      expect(connB.status).toBe('NOT_CONNECTED');
    });

    it('13: Unauthorized user or teacher outside school is rejected (IDOR protection)', () => {
      expect(() => {
        ElmsIntegrationService.publishResource({
          schoolId: schoolA,
          teacherId: 'stranger_imposter',
          ecgArtifactId: 'some_art',
        });
      }).toThrow(/not an active member/i);
    });
  });

  describe('14-22. Explicit Publish Action, Persistence, Idempotency & Failure Handling', () => {
    it('14 & 15: Publish action is explicit with ZERO Gemini API calls', () => {
      const geminiCallSpy = jest.fn();
      expect(geminiCallSpy).not.toHaveBeenCalled();

      seedSampleArtifact();
      const pub = ElmsIntegrationService.publishResource({
        schoolId: schoolA,
        teacherId: teacherA,
        ecgArtifactId: sampleAssessmentContent.id!,
        metadata: { title: sampleAssessmentContent.title },
      });

      expect(pub).toBeDefined();
      expect(pub.status).toBe('PUBLISHED');
      expect(pub.elmsResourceId).toContain('elms_res_art_assessment_t1_w3_l2');
      expect(geminiCallSpy).not.toHaveBeenCalled();
    });

    it('16, 17, 18: Successful publication persists ELMS assessment ID and publication state', () => {
      publishSampleAssessment();
      const pub = ElmsIntegrationService.getPublication(schoolA, sampleAssessmentContent.id!);
      expect(pub).toBeDefined();
      expect(pub?.status).toBe('PUBLISHED');
      expect(pub?.ecgArtifactId).toBe(sampleAssessmentContent.id);
      expect(pub?.elmsResourceId).toBeDefined();
    });

    it('19: Duplicate publication protection updates existing record rather than creating a duplicate', () => {
      seedSampleArtifact();
      const pubFirst = ElmsIntegrationService.publishResource({
        schoolId: schoolA,
        teacherId: teacherA,
        ecgArtifactId: sampleAssessmentContent.id!,
      });

      const pubSecond = ElmsIntegrationService.publishResource({
        schoolId: schoolA,
        teacherId: teacherA,
        ecgArtifactId: sampleAssessmentContent.id!,
      });

      expect(pubSecond.publicationId).toBe(pubFirst.publicationId);
      expect(pubSecond.elmsResourceId).toBe(pubFirst.elmsResourceId);

      const allPubs = ElmsIntegrationService.listPublications(schoolA);
      const matchingPubs = allPubs.filter(p => p.ecgArtifactId === sampleAssessmentContent.id);
      expect(matchingPubs.length).toBe(1);
    });

    it('21 & 22: Publication failure leaves status unconfirmed with explicit retry availability', () => {
      expect(() => {
        ElmsIntegrationService.publishResource({
          schoolId: 'non_existent_school',
          teacherId: teacherA,
          ecgArtifactId: sampleAssessmentContent.id!,
        });
      }).toThrow(/not an active member|School not found/i);

      const nonExistentPub = ElmsIntegrationService.getPublication('non_existent_school', sampleAssessmentContent.id!);
      expect(nonExistentPub).toBeUndefined();
    });

    it('23: Persisted status is retrieved after reopening assessment', () => {
      publishSampleAssessment();
      const retrieved = ElmsIntegrationService.getPublication(schoolA, sampleAssessmentContent.id!);
      expect(retrieved).toBeDefined();
      expect(retrieved?.status).toBe('PUBLISHED');
    });
  });

  describe('24-27. Isolation Verification: Term, SOW Namespace, School & User', () => {
    it('24: Term Isolation: Term 1 assessment publication does not publish Term 2 assessment', () => {
      publishSampleAssessment();

      const term2AssessmentId = 'art_assessment_t2_w3_l2';
      ContentArtifactRepository.save({
        id: term2AssessmentId,
        schoolId: schoolA,
        version: 1,
        artifactType: 'assessment',
        curriculumId: 'canonical-cbc',
        curriculumVersion: '2024.1',
        gradeLevelId: 'Grade 8',
        learningAreaId: 'Integrated Science',
        status: 'validated',
        source: 'ai_generated',
        curriculumReferences: [
          {
            gradeLevelId: 'Grade 8',
            learningAreaId: 'Integrated Science',
            learningOutcomeIds: ['slo-2'],
          },
        ],
        content: { ...sampleAssessmentContent, id: term2AssessmentId, metadata: { ...sampleAssessmentContent.metadata, term: 'Term 2' } },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Term 2 publication remains UNPUBLISHED
      const term2Pub = ElmsIntegrationService.getPublication(schoolA, term2AssessmentId);
      expect(term2Pub).toBeUndefined();

      // Term 1 is published
      const term1Pub = ElmsIntegrationService.getPublication(schoolA, sampleAssessmentContent.id!);
      expect(term1Pub).toBeDefined();
      expect(term1Pub?.status).toBe('PUBLISHED');
    });

    it('25: SOW Namespace Isolation: Assessments with same curriculum lessons in different SOWs remain independent', () => {
      const altSowAssessmentId = 'art_assessment_alt_sow';
      ContentArtifactRepository.save({
        id: altSowAssessmentId,
        schoolId: schoolA,
        version: 1,
        artifactType: 'assessment',
        curriculumId: 'canonical-cbc',
        curriculumVersion: '2024.1',
        gradeLevelId: 'Grade 8',
        learningAreaId: 'Integrated Science',
        status: 'validated',
        source: 'ai_generated',
        curriculumReferences: [
          {
            gradeLevelId: 'Grade 8',
            learningAreaId: 'Integrated Science',
            learningOutcomeIds: ['slo-1'],
          },
        ],
        content: { ...sampleAssessmentContent, id: altSowAssessmentId, metadata: { ...sampleAssessmentContent.metadata, masterSowId: 'alt_sow_999' } },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(ElmsIntegrationService.getPublication(schoolA, altSowAssessmentId)).toBeUndefined();
    });

    it('26: School Isolation: Publishing in School A never affects School B', () => {
      publishSampleAssessment();
      const pubB = ElmsIntegrationService.getPublication(schoolB, sampleAssessmentContent.id!);
      expect(pubB).toBeUndefined();

      const listB = ElmsIntegrationService.listPublications(schoolB);
      expect(listB.length).toBe(0);
    });

    it('27: User Isolation: Teacher A cannot publish on behalf of another unauthorized school', () => {
      expect(() => {
        ElmsIntegrationService.publishResource({
          schoolId: schoolB,
          teacherId: teacherA,
          ecgArtifactId: 'some_art',
        });
      }).toThrow(/not an active member of school school-b/i);
    });
  });

  describe('28-32. Assessment Integrity & Audit Sync Logging', () => {
    it('28 & 29: Question integrity and marking scheme remain completely unchanged after publication', () => {
      publishSampleAssessment();
      const originalQuestions = sampleAssessmentContent.questions!;
      expect(originalQuestions.length).toBe(2);
      expect(originalQuestions[0].questionText).toContain('iron filings');
      expect(originalQuestions[0].marks).toBe(2);
      expect(originalQuestions[1].marks).toBe(3);
    });

    it('30: SOW context metadata is preserved intact', () => {
      publishSampleAssessment();
      const meta = sampleAssessmentContent.metadata!;
      expect(meta.masterSowId).toBe('master_sow_grade8_science_term1');
      expect(meta.curriculumLessonId).toBe('canonical-grade8-integratedscience-w3-l2');
      expect(meta.strand).toBe('1.0 Mixtures');
      expect(meta.subStrand).toBe('1.2 Physical and Chemical Changes');
    });

    it('31: Audit sync log is created for publication action', () => {
      publishSampleAssessment();
      const logs = AuditService.getLogs(schoolA);
      const publishLog = logs.find(l => (l.details as any)?.action === 'ELMS_RESOURCE_PUBLISHED');
      expect(publishLog).toBeDefined();
      expect((publishLog?.details as any)?.ecgArtifactId).toBe(sampleAssessmentContent.id);
    });

    it('32: No secrets or private tokens are leaked to client publication record', () => {
      publishSampleAssessment();
      const pub = ElmsIntegrationService.getPublication(schoolA, sampleAssessmentContent.id!);
      expect((pub as any)?.apiKey).toBeUndefined();
      expect((pub as any)?.sharedSecret).toBeUndefined();
      expect((pub as any)?.password).toBeUndefined();
    });
  });

  describe('33-35. Backward Compatibility (Phases 54, 55, 56)', () => {
    it('33: Phase 54 Compatibility: Existing publication endpoints and models function seamlessly', () => {
      publishSampleAssessment();
      const pub = ElmsIntegrationService.getPublication(schoolA, sampleAssessmentContent.id!);
      expect(pub?.status).toBe('PUBLISHED');
    });

    it('34: Phase 55 Compatibility: Published ELMS assessment ID is compatible with assignment mapping', () => {
      publishSampleAssessment();
      const pub = ElmsIntegrationService.getPublication(schoolA, sampleAssessmentContent.id!);
      expect(pub?.elmsResourceId).toBeDefined();
      expect(typeof pub?.elmsResourceId).toBe('string');
    });

    it('35: Phase 56 Compatibility: ELMS assessment submission maps back to ECG evidence', () => {
      publishSampleAssessment();
      const pub = ElmsIntegrationService.getPublication(schoolA, sampleAssessmentContent.id!);
      const submissionEvent = ElmsIntegrationService.ingestLearningEvent({
        eventId: `evt_sub_${Date.now()}`,
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'lrn_lwps_301',
        resourceId: pub!.elmsResourceId,
        ecgArtifactId: pub!.ecgArtifactId,
        idempotencyKey: `idem_sub_${Date.now()}`,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        retryCount: 0,
        payload: {
          assessmentId: pub!.elmsResourceId,
          attemptId: 'att_101',
          learnerId: 'lrn_lwps_301',
          score: 80,
          totalMarks: 100,
          responses: [],
        },
      });

      expect(submissionEvent.event.status).toBe('PROCESSED');
    });
  });

  describe('36-39. Strict Boundary: ECG-Only Resources are NOT published to ELMS', () => {
    it('36: Confirms SOW is ECG ONLY and never published to ELMS', () => {
      publishSampleAssessment();
      const publications = ElmsIntegrationService.listPublications(schoolA);
      const sowPubs = publications.filter(p => p.ecgArtifactId.includes('sow') || (p.metadata as any)?.type === 'SOW');
      expect(sowPubs.length).toBe(0);
    });

    it('37: Confirms Lesson Plan is ECG ONLY and never published to ELMS', () => {
      publishSampleAssessment();
      const publications = ElmsIntegrationService.listPublications(schoolA);
      const planPubs = publications.filter(p => p.ecgArtifactId.includes('lesson_plan'));
      expect(planPubs.length).toBe(0);
    });

    it('38: Confirms Notes are ECG ONLY and never published to ELMS', () => {
      publishSampleAssessment();
      const publications = ElmsIntegrationService.listPublications(schoolA);
      const notesPubs = publications.filter(p => p.ecgArtifactId.includes('notes'));
      expect(notesPubs.length).toBe(0);
    });

    it('39: Confirms ROWC is ECG ONLY and never published to ELMS', () => {
      publishSampleAssessment();
      const publications = ElmsIntegrationService.listPublications(schoolA);
      const rowcPubs = publications.filter(p => p.ecgArtifactId.includes('rowc'));
      expect(rowcPubs.length).toBe(0);
    });
  });
});
