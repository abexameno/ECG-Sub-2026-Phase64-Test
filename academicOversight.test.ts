import { AcademicOversightService } from './services/academicOversightService.ts';
import { AcademicOperationsService } from './services/academicOperationsService.ts';
import { TeachingPlanService } from './services/teachingPlanService.ts';
import { TeachingActivityService } from './services/teachingActivityService.ts';
import { AssessmentEvidenceService } from './services/assessmentEvidenceService.ts';
import { LearningOutcomeInterpretationService } from './services/learningOutcomeInterpretationService.ts';
import { CanonicalCurriculumService } from './services/canonicalCurriculumService.ts';
import { CurriculumIngestionService } from './services/curriculumIngestionService.ts';
import { SchoolConfigService } from './services/schoolConfigService.ts';

describe('Phase 18 — School Academic Oversight, Monitoring & Reporting', () => {
  beforeEach(() => {
    TeachingPlanService.clearStore?.();
    TeachingActivityService.clearStore();
    AssessmentEvidenceService.clearStore();
    LearningOutcomeInterpretationService.clearStore();
  });

  // --------------------------------------------------------------------------
  // EC-01 to EC-04: Dashboard Resolution, School Isolation, Academic Year & Term
  // --------------------------------------------------------------------------
  test('EC-01 to EC-04: Should load school academic overview with correct academic year, term, and school isolation', () => {
    const overview = AcademicOversightService.getSchoolAcademicOverview('lwps', {
      requestingUserId: 'admin_1',
      requestingRole: 'SCHOOL_ADMIN',
    });

    expect(overview).toBeDefined();
    expect(overview.schoolId).toBe('lwps');
    expect(overview.schoolName).toContain('Lizzie Wanyoike');
    expect(overview.academicYearName).toBe('2026');
    expect(overview.termName).toBe('Term 1');
    expect(overview.isReadOnly).toBe(true);

    // Multi-School isolation check
    const schoolBOverview = AcademicOversightService.getSchoolAcademicOverview('school-b', {
      requestingUserId: 'admin_b',
      requestingRole: 'SCHOOL_ADMIN',
    });
    expect(schoolBOverview.schoolId).toBe('school-b');
    expect(schoolBOverview.schoolName).toBe('Hillside Academy');

    // Cross-school invalid id
    expect(() => {
      AcademicOversightService.getSchoolAcademicOverview('unknown-school', {
        requestingUserId: 'admin_1',
        requestingRole: 'SCHOOL_ADMIN',
      });
    }).toThrow('Unauthorized or invalid school: unknown-school');
  });

  // --------------------------------------------------------------------------
  // EC-05 to EC-09: Teaching Control, Planned, Expected, Delivered, Cancelled, Rescheduled
  // --------------------------------------------------------------------------
  test('EC-05 to EC-09: Should accurately compute planned vs expected vs actual teaching with cancellations & rescheduling', () => {
    // 1. Create a planned teaching plan
    const plan = TeachingPlanService.createPlan({
      schoolId: 'lwps',
      subject: 'Mathematics',
      grade: 'Grade 8',
      term: 'Term 1',
      academicYear: '2026',
      curriculumVersion: 'KICD-CBC-2026-V1',
      curriculumId: 'KICD-CBC-2026-V1',
      learningAreaId: 'la_math_g8',
      allocations: [
        {
          id: 'alloc_1',
          weekNumber: 1,
          lessonNumber: 1,
          strand: 'Numbers',
          subStrand: 'Integers',
          learningOutcomeId: 'slo_g8_math_01',
          learningExperiences: 'Solving integers',
          resources: 'Textbook pg 10',
          assessmentMethods: 'Written questions',
        },
        {
          id: 'alloc_2',
          weekNumber: 1,
          lessonNumber: 2,
          strand: 'Numbers',
          subStrand: 'Integers',
          learningOutcomeId: 'slo_g8_math_02',
          learningExperiences: 'Number lines',
          resources: 'Charts',
          assessmentMethods: 'Oral questions',
        },
      ],
    });

    // 2. Schedule and deliver 1 lesson
    TeachingActivityService.createTeachingActivity({
      schoolId: 'lwps',
      teacherId: 'teacher_1',
      teachingPlanId: plan.id,
      teachingAllocationId: 'alloc_1',
      curriculumVersionId: 'KICD-CBC-2026-V1',
      learningOutcomeId: 'slo_g8_math_01',
    });
    const act = TeachingActivityService.startTeachingActivity(`tact_lwps_${plan.id}_alloc_1`, 'lwps', 'teacher_1');
    TeachingActivityService.completeTeachingActivity(act.activityId, 'lwps', 'teacher_1', 'Delivered successfully');

    // 3. Record operational cancellation for alloc_2
    AcademicOperationsService.recordOperationalException({
      schoolId: 'lwps',
      academicYearId: 'ay_lwps_2026',
      termId: 'term_lwps_2026_1',
      date: '2026-01-08',
      type: 'LESSON_CANCELLED',
      reason: 'School assembly disruption',
      affectedAllocationId: 'alloc_2',
      requestingRole: 'admin',
    });

    const summary = AcademicOversightService.computeTeachingControlSummary('lwps', 'term_lwps_2026_1');

    expect(summary.plannedLessons).toBeGreaterThanOrEqual(2);
    expect(summary.deliveredLessons).toBe(1);
    expect(summary.cancelledLessons).toBeGreaterThanOrEqual(1);
    expect(summary.status).toBe('ATTENTION_NEEDED');
  });

  // --------------------------------------------------------------------------
  // EC-10 to EC-12: Capacity & Curriculum Coverage Calculations (Phase 10 integration)
  // --------------------------------------------------------------------------
  test('EC-10 to EC-12: Should consume Phase 10 coverage logic and Phase 3/17 capacity calculations deterministically', () => {
    const overview = AcademicOversightService.getSchoolAcademicOverview('lwps', {
      requestingUserId: 'admin_1',
      requestingRole: 'SCHOOL_ADMIN',
    });

    expect(overview.capacity.totalAvailableSlots).toBe(65); // 13 weeks * 5 lessons/week for LWPS
    expect(overview.capacity.capacityStatus).toBeDefined();

    expect(overview.curriculumCoverage.curriculumVersionId).toBeDefined();
    expect(overview.curriculumCoverage.totalOutcomes).toBeGreaterThan(0);
    expect(overview.curriculumCoverage.isZeroDenominator).toBe(false);
  });

  // --------------------------------------------------------------------------
  // EC-13 to EC-17: Learner Evidence, Outcome Interpretation & Non-Redefinition
  // --------------------------------------------------------------------------
  test('EC-13 to EC-17: Should consume Phase 13 evidence and Phase 14 interpretation without redefining mastery or progress', () => {
    // Administer assessment and evaluate
    const asmt = AssessmentEvidenceService.createAssessment({
      schoolId: 'lwps',
      curriculumVersionId: 'KICD-CBC-2026-V1',
      learningOutcomeId: 'slo_g8_math_01',
      title: 'Integer Formative Quiz',
      items: [
        {
          prompt: 'What is -5 + 8?',
          type: 'MULTIPLE_CHOICE',
          options: [
            { label: 'A', value: '-3', text: '-3' },
            { label: 'B', value: '3', text: '3' },
            { label: 'C', value: '13', text: '13' },
            { label: 'D', value: '-13', text: '-13' },
          ],
          correctAnswer: '3',
          marks: 10,
        },
      ],
    });

    const attempt = AssessmentEvidenceService.startAttempt({
      assessmentId: asmt.assessmentId,
      schoolId: 'lwps',
      learnerId: 'learner_101',
    });

    AssessmentEvidenceService.submitAttempt(
      attempt.attemptId,
      'lwps',
      'learner_101',
      [{ itemId: asmt.items[0].itemId, response: '3' }]
    );

    // Second assessment for corroborating evidence
    const asmt2 = AssessmentEvidenceService.createAssessment({
      schoolId: 'lwps',
      curriculumVersionId: 'KICD-CBC-2026-V1',
      learningOutcomeId: 'slo_g8_math_01',
      title: 'Integer Formative Quiz 2',
      items: [
        {
          prompt: 'What is 10 - 4?',
          type: 'MULTIPLE_CHOICE',
          options: [
            { label: 'A', value: '6', text: '6' },
            { label: 'B', value: '5', text: '5' },
            { label: 'C', value: '4', text: '4' },
            { label: 'D', value: '7', text: '7' },
          ],
          correctAnswer: '6',
          marks: 10,
        },
      ],
    });

    const attempt2 = AssessmentEvidenceService.startAttempt({
      assessmentId: asmt2.assessmentId,
      schoolId: 'lwps',
      learnerId: 'learner_101',
    });

    AssessmentEvidenceService.submitAttempt(
      attempt2.attemptId,
      'lwps',
      'learner_101',
      [{ itemId: asmt2.items[0].itemId, response: '6' }]
    );

    // Evaluate Outcome in Phase 14
    LearningOutcomeInterpretationService.evaluateOutcome({
      learnerId: 'learner_101',
      learningOutcomeId: 'slo_g8_math_01',
      schoolId: 'lwps',
      curriculumVersionId: 'KICD-CBC-2026-V1',
      requestingUserId: 'teacher_1',
      requestingRole: 'teacher',
    });

    const overview = AcademicOversightService.getSchoolAcademicOverview('lwps', {
      requestingUserId: 'admin_1',
      requestingRole: 'SCHOOL_ADMIN',
    });

    expect(overview.learnerEvidence.learnersWithEvidence).toBe(1);
    expect(overview.learnerEvidence.totalAssessmentsConducted).toBe(2);
    expect(overview.outcomeInterpretation.strongDemonstrationCount).toBe(1);
    expect(overview.outcomeInterpretation.policyVersion).toBe('LO-MASTERY-V1');
  });

  // --------------------------------------------------------------------------
  // EC-18 to EC-24: Read-Only Guarantees, Historical Integrity & Immutability
  // --------------------------------------------------------------------------
  test('EC-18 to EC-24: Academic oversight must be read-only and preserve curriculum/historical integrity', () => {
    const plansBefore = TeachingPlanService.getPlansBySchool('lwps').length;
    const activitiesBefore = TeachingActivityService.getActivitiesBySchool('lwps').length;
    const evidenceBefore = AssessmentEvidenceService.getEvidenceBySchool('lwps').length;

    // Load multiple overviews and reports
    AcademicOversightService.getSchoolAcademicOverview('lwps', {
      requestingUserId: 'admin_1',
      requestingRole: 'SCHOOL_ADMIN',
    });
    AcademicOversightService.getDailyTeachingReport('lwps', '2026-01-08', 'admin_1', 'SCHOOL_ADMIN');
    AcademicOversightService.getWeeklyTeachingReport('lwps', 1, 'term_lwps_2026_1', 'admin_1', 'SCHOOL_ADMIN');

    // Confirm state has not changed (Zero Mutations)
    expect(TeachingPlanService.getPlansBySchool('lwps').length).toBe(plansBefore);
    expect(TeachingActivityService.getActivitiesBySchool('lwps').length).toBe(activitiesBefore);
    expect(AssessmentEvidenceService.getEvidenceBySchool('lwps').length).toBe(evidenceBefore);
  });

  // --------------------------------------------------------------------------
  // EC-25 to EC-29: Security, Teacher Authorization, Learner Privacy & IDOR
  // --------------------------------------------------------------------------
  test('EC-25 to EC-29: Should enforce teacher privacy and reject IDOR / cross-school access', () => {
    // 1. Teacher requesting own view
    const teacherOwnView = AcademicOversightService.getTeacherAcademicView(
      'lwps',
      'teacher_1',
      'teacher_1',
      'TEACHER'
    );
    expect(teacherOwnView.teacherId).toBe('teacher_1');

    // 2. Teacher attempting to view peer teacher view (IDOR rejection)
    expect(() => {
      AcademicOversightService.getTeacherAcademicView(
        'lwps',
        'teacher_2',
        'teacher_1',
        'TEACHER'
      );
    }).toThrow('Unauthorized access: teachers cannot view other teachers operational performance');

    // 3. Admin viewing teacher view (Allowed)
    const adminView = AcademicOversightService.getTeacherAcademicView(
      'lwps',
      'teacher_1',
      'admin_1',
      'SCHOOL_ADMIN'
    );
    expect(adminView.teacherId).toBe('teacher_1');

    // 4. Cross-school access attempt
    expect(() => {
      AcademicOversightService.getTeacherAcademicView(
        'school-b',
        'teacher_1',
        'admin_lwps',
        'TEACHER'
      );
    }).toThrow();
  });

  // --------------------------------------------------------------------------
  // EC-30 to EC-34: Multi-School, Zero Denominators & Missing Data Handling
  // --------------------------------------------------------------------------
  test('EC-30 to EC-34: Should handle multiple schools, zero denominators, and avoid data fabrication', () => {
    // School B
    const schoolBOverview = AcademicOversightService.getSchoolAcademicOverview('school-b', {
      requestingUserId: 'admin_b',
      requestingRole: 'SCHOOL_ADMIN',
    });

    expect(schoolBOverview.capacity.totalAvailableSlots).toBe(48); // 12 weeks * 4 lessons/week for School B
    expect(schoolBOverview.schoolId).toBe('school-b');

    // Zero-denominator check on empty scope
    const coverageReport = AcademicOversightService.getCurriculumCoverageReport(
      'lwps',
      { learningAreaId: 'la_non_existent' },
      'admin_1',
      'SCHOOL_ADMIN'
    );
    expect(coverageReport.totalOutcomes).toBe(0);
    expect(coverageReport.coveragePercentage).toBeNull();
  });

  // --------------------------------------------------------------------------
  // EC-35 to EC-39: Deterministic Attention Queue & Drill-Down Integrity
  // --------------------------------------------------------------------------
  test('EC-35 to EC-39: Should detect deterministic attention items without attributing them to teacher or curriculum failure', () => {
    const overview = AcademicOversightService.getSchoolAcademicOverview('lwps', {
      requestingUserId: 'admin_1',
      requestingRole: 'SCHOOL_ADMIN',
    });

    expect(Array.isArray(overview.attentionItems)).toBe(true);
    for (const item of overview.attentionItems) {
      expect(['INFORMATION', 'ATTENTION', 'WARNING', 'CRITICAL']).toContain(item.severity);
      expect(item.recommendedAction).toBeDefined();
      expect(item.sourceType).toBeDefined();
    }
  });

  // --------------------------------------------------------------------------
  // EC-40 to EC-45: Reports, Export & AI Non-Authority Boundary
  // --------------------------------------------------------------------------
  test('EC-40 to EC-45: Should export formatted reports and ensure AI cannot override deterministic numbers', () => {
    const csvExport = AcademicOversightService.exportReport({
      schoolId: 'lwps',
      reportType: 'OVERVIEW',
      format: 'CSV',
      requestingUserId: 'admin_1',
      requestingRole: 'SCHOOL_ADMIN',
    });

    expect(csvExport.content).toContain('Lizzie Wanyoike');
    expect(csvExport.content).toContain('Curriculum Coverage');
    expect(csvExport.format).toBe('CSV');

    const jsonExport = AcademicOversightService.exportReport({
      schoolId: 'lwps',
      reportType: 'OVERVIEW',
      format: 'JSON',
      requestingUserId: 'admin_1',
      requestingRole: 'SCHOOL_ADMIN',
    });
    expect(jsonExport.format).toBe('JSON');
    const parsed = JSON.parse(jsonExport.content);
    expect(parsed.schoolId).toBe('lwps');

    // AI summary helper test
    const overview = AcademicOversightService.getSchoolAcademicOverview('lwps', {
      requestingUserId: 'admin_1',
      requestingRole: 'SCHOOL_ADMIN',
    });
    const summary = AcademicOversightService.generateAdministrativeSummary(
      overview,
      'Review term 1 mathematics pacing with department heads.'
    );

    expect(summary.sourceMetricsPreserved).toBe(true);
    expect(summary.isAIEnhanced).toBe(true);
    expect(summary.summary).toContain('Teaching Control');
    expect(summary.summary).toContain('Review term 1 mathematics pacing');
  });
});
