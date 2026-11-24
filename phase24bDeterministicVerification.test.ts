import { CurriculumAlignmentService } from './services/curriculumAlignmentService.ts';
import { CanonicalCurriculumService } from './services/canonicalCurriculumService.ts';
import { ContentArtifact } from './types/artifact.ts';
import { GeneratedContent, ContentType, SchemeOfWorkData } from './types.ts';
import { auditCurriculumAlignment } from './services/geminiService.ts';

describe('Phase 24B — Deterministic Curriculum Verification & AI Cost Optimization Tests', () => {
  describe('I. Deterministic Curriculum Alignment Verification (Zero AI API Calls)', () => {
    it('1. performs 100% deterministic alignment check for Grade 8 Integrated Science SOW', async () => {
      const canonicalNodes = CanonicalCurriculumService.resolveCanonicalSowNodes('Grade 8', 'Integrated Science', ['Term 2']);
      const sowData: SchemeOfWorkData = {
        grade: 'Grade 8',
        subject: 'Integrated Science',
        term: 'Term 2',
        entries: canonicalNodes.map(n => ({
          week: `${n.week}`,
          lesson: `${n.lesson}`,
          strand: n.strandTitle,
          subStrand: n.subStrandTitle,
          learningOutcomes: n.learningOutcomesText,
          keyInquiryQuestions: n.keyInquiryQuestions.join('; '),
          learningExperiences: 'Learners investigate cell structures using light microscopes.',
          learningResources: 'Microscope, plant cell specimens, slides',
          assessment: 'Observation & Practical Activity',
          remarks: ''
        }))
      };

      const artifact: ContentArtifact<GeneratedContent> = {
        id: 'test-art-g8-term2',
        artifactType: 'Scheme of Work',
        schoolId: 'lwps',
        schoolName: 'Lightway Primary School',
        academicYear: '2026',
        curriculumId: 'kicd-cbc-2026',
        curriculumVersion: '2026.1',
        gradeLevelName: 'Grade 8',
        learningAreaName: 'Integrated Science',
        curriculumReferences: [],
        version: 1,
        status: 'draft',
        source: 'ai_generated',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        content: {
          id: 'gen-123',
          title: 'Grade 8 Integrated Science SOW Term 2',
          schemeOfWorkData: sowData,
          metadata: { grade: 'Grade 8', subject: 'Integrated Science', contentType: ContentType.SchemeOfWork, terms: ['Term 2'] }
        }
      };

      const checked = await CurriculumAlignmentService.performAlignmentCheck(artifact);
      expect(checked.alignmentStatus).toBe('well_aligned');
      expect(checked.alignmentFindings).toBeDefined();
      expect(checked.alignmentFindings!.length).toBeGreaterThan(0);

      const authorityFinding = checked.alignmentFindings!.find(f => f.category === 'Curriculum Authority');
      expect(authorityFinding?.status).toBe('well_aligned');

      const termFinding = checked.alignmentFindings!.find(f => f.category === 'Term Alignment');
      expect(termFinding?.status).toBe('well_aligned');

      const summary = CurriculumAlignmentService.generateDeterministicSummary(
        checked.alignmentFindings!,
        'Grade 8',
        'Integrated Science',
        'Scheme of Work'
      );
      expect(summary).toContain('Curriculum alignment verified');
      expect(summary).toContain('Grade 8');
    });

    it('2. deterministically detects cross-term leakage (e.g. Force & Energy in Grade 8 Term 2)', async () => {
      const corruptSowData: SchemeOfWorkData = {
        grade: 'Grade 8',
        subject: 'Integrated Science',
        term: 'Term 2',
        entries: [
          {
            week: '1',
            lesson: '1',
            strand: '3.0 Force and Energy',
            subStrand: '3.1 Transformation of Energy',
            learningOutcomes: '**Knowledge:** Describe energy transformations.',
            keyInquiryQuestions: 'How is energy transformed?',
            learningExperiences: 'Practical activity.',
            learningResources: 'Charts',
            assessment: 'Oral questions',
            remarks: ''
          }
        ]
      };

      const corruptArtifact: ContentArtifact<GeneratedContent> = {
        id: 'corrupt-g8-term2',
        artifactType: 'Scheme of Work',
        schoolId: 'lwps',
        academicYear: '2026',
        curriculumId: 'kicd-cbc-2026',
        curriculumVersion: '2026.1',
        gradeLevelName: 'Grade 8',
        learningAreaName: 'Integrated Science',
        curriculumReferences: [],
        version: 1,
        status: 'draft',
        source: 'ai_generated',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        content: {
          id: 'gen-corrupt',
          title: 'Grade 8 Integrated Science SOW Term 2',
          schemeOfWorkData: corruptSowData,
          metadata: { grade: 'Grade 8', subject: 'Integrated Science', contentType: ContentType.SchemeOfWork, terms: ['Term 2'] }
        }
      };

      const checked = await CurriculumAlignmentService.performAlignmentCheck(corruptArtifact);
      expect(checked.alignmentStatus).toBe('significant_misalignment');

      const leakageFinding = checked.alignmentFindings!.find(f => f.category === 'Term Alignment');
      expect(leakageFinding?.status).toBe('significant_misalignment');
      expect(leakageFinding?.message).toContain('Cross-term curriculum leakage detected');

      const summary = CurriculumAlignmentService.generateDeterministicSummary(
        checked.alignmentFindings!,
        'Grade 8',
        'Integrated Science',
        'Scheme of Work'
      );
      expect(summary).toContain('Significant curriculum misalignment');
    });

    it('3. verifies deterministic auditCurriculumAlignment helper without API calls', async () => {
      const canonicalNodes = CanonicalCurriculumService.resolveCanonicalSowNodes('Grade 6', 'Agriculture and Nutrition', ['Term 1']);
      const content: GeneratedContent = {
        id: 'content-g6-term1',
        title: 'Grade 6 Agriculture and Nutrition SOW Term 1',
        schemeOfWorkData: {
          grade: 'Grade 6',
          subject: 'Agriculture and Nutrition',
          term: 'Term 1',
          entries: canonicalNodes.map(n => ({
            week: `${n.week}`,
            lesson: `${n.lesson}`,
            strand: n.strandTitle,
            subStrand: n.subStrandTitle,
            learningOutcomes: n.learningOutcomesText,
            keyInquiryQuestions: n.keyInquiryQuestions.join('; '),
            learningExperiences: 'Learners prepare seedbeds.',
            learningResources: 'Jembe, watering can, seeds',
            assessment: 'Practical',
            remarks: ''
          }))
        },
        metadata: { grade: 'Grade 6', subject: 'Agriculture and Nutrition', contentType: ContentType.SchemeOfWork, terms: ['Term 1'] }
      };

      const audit = await auditCurriculumAlignment(content);
      expect(audit.score).toBeGreaterThanOrEqual(90);
      expect(audit.report).toContain('Curriculum alignment verified');
      expect(audit.recommendations.length).toBeGreaterThan(0);
    });
  });
});
