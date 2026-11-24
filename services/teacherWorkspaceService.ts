import {
  TeacherContext,
  TeacherResourceSelection,
  TeacherResourceItem,
  TeachingPackage,
  TodayLessonSummary,
} from '../types/teacherWorkspace.ts';
import { SchoolConfigService } from './schoolConfigService.ts';
import { AcademicOperationsService } from './academicOperationsService.ts';
import { CanonicalCurriculumService } from './canonicalCurriculumService.ts';
import { TeachingPlanService } from './teachingPlanService.ts';
import { ArtifactService } from './artifactService.ts';
import { ContentArtifactRepository } from './contentArtifactRepository.ts';
import { AssessmentEvidenceService } from './assessmentEvidenceService.ts';
import { AuditService } from './auditService.ts';
import { ContentArtifact, CurriculumReference } from '../types.ts';

// In-memory store for packages and remembered teacher contexts
const rememberedContexts = new Map<string, TeacherContext>();
const teachingPackages = new Map<string, TeachingPackage>();

export const TeacherWorkspaceService = {
  clearStore(): void {
    rememberedContexts.clear();
    teachingPackages.clear();
  },

  // 1. ACTIVE TEACHING CONTEXT WITH SENSIBLE DEFAULTS
  getTeacherContext(
    teacherId: string,
    schoolId: string,
    classGroupId?: string,
    learningAreaId?: string
  ): TeacherContext {
    // Check remembered context
    const remembered = rememberedContexts.get(`${schoolId}_${teacherId}`);
    if (remembered && !classGroupId && !learningAreaId) {
      return remembered;
    }

    // Default to school's active profile and standard grade/learning area
    const school = SchoolConfigService.getSchoolProfile(schoolId);
    if (!school) {
      throw new Error(`Unauthorized or invalid school: ${schoolId}`);
    }

    const activeTerm = AcademicOperationsService.getActiveTerm(schoolId);
    let gradeId = remembered?.gradeId || 'grade-8';
    if (classGroupId) {
      if (classGroupId.includes('g7') || classGroupId.includes('grade-7')) gradeId = 'grade-7';
      else if (classGroupId.includes('g9') || classGroupId.includes('grade-9')) gradeId = 'grade-9';
      else if (classGroupId.includes('g8') || classGroupId.includes('grade-8')) gradeId = 'grade-8';
    }

    const defaultContext: TeacherContext = {
      schoolId,
      gradeId,
      learningAreaId: learningAreaId || remembered?.learningAreaId || 'la-sci',
      academicYear: 2026,
      termId: activeTerm?.name || 'Term 1',
    };

    rememberedContexts.set(`${schoolId}_${teacherId}`, defaultContext);
    return defaultContext;
  },

  setTeacherContext(teacherId: string, context: TeacherContext): TeacherContext {
    const school = SchoolConfigService.getSchoolProfile(context.schoolId);
    if (!school) {
      throw new Error(`Unauthorized or invalid school: ${context.schoolId}`);
    }

    rememberedContexts.set(`${context.schoolId}_${teacherId}`, context);
    return context;
  },

  // 2. TODAY'S LESSON ACCESS
  getTodayLesson(context: TeacherContext, teacherId: string): TodayLessonSummary {
    const teachingPlan = TeachingPlanService.generateTeachingPlan(
      context.schoolId,
      context.gradeId,
      context.learningAreaId,
      context.termId
    );

    const firstSlot = teachingPlan.weeks[0]?.lessonSlots[0];
    const strand = firstSlot?.strandId ? CanonicalCurriculumService.getStrands(context.learningAreaId).find(s => s.id === firstSlot.strandId) : undefined;
    const subStrand = firstSlot?.subStrandId && firstSlot.strandId ? CanonicalCurriculumService.getSubStrands(firstSlot.strandId).find(ss => ss.id === firstSlot.subStrandId) : undefined;
    const outcome = firstSlot?.subStrandId ? CanonicalCurriculumService.getLearningOutcomes(firstSlot.subStrandId)[0] : undefined;

    return {
      grade: context.gradeId === 'grade-8' ? 'Grade 8' : context.gradeId,
      learningArea: 'Integrated Science',
      term: context.termId,
      week: 1,
      lessonNumber: 1,
      strand: strand?.title || 'Science and Technology',
      subStrand: subStrand?.title || 'Properties of Materials',
      topicTitle: 'Physical and Chemical Properties',
      learningOutcome: outcome?.statement || 'Identify key physical properties of pure substances.',
    };
  },

  // 3. GENERATE TEACHING PACKAGE (ONE COORDINATED FRONT DOOR)
  async generateTeachingPackage(
    teacherId: string,
    context: TeacherContext,
    selection: TeacherResourceSelection
  ): Promise<TeachingPackage> {
    const school = SchoolConfigService.getSchoolProfile(context.schoolId);
    if (!school) {
      throw new Error(`Unauthorized school ID: ${context.schoolId}`);
    }

    AuditService.log('ARTIFACT_CREATED', context.schoolId, {
      action: 'TEACHING_PACKAGE_GENERATION_REQUESTED',
      teacherId,
      gradeId: context.gradeId,
      learningAreaId: context.learningAreaId,
      termId: context.termId,
      selection,
    });

    // 1. Resolve Teaching Plan & Allocations
    const teachingPlan = TeachingPlanService.generateTeachingPlan(
      context.schoolId,
      context.gradeId,
      context.learningAreaId,
      context.termId
    );

    const firstSlot = teachingPlan.weeks[0]?.lessonSlots[0];
    const outcomeId = firstSlot?.learningOutcomeIds?.[0] || 'lo_sci_g8_01';
    const curriculum = CanonicalCurriculumService.getCurriculum();

    const currRef: CurriculumReference = {
      gradeLevelId: context.gradeId,
      learningAreaId: context.learningAreaId,
      strandId: firstSlot?.strandId,
      subStrandId: firstSlot?.subStrandId,
      learningOutcomeIds: [outcomeId],
    };

    const resources: TeacherResourceItem[] = [];

    // 2. Scheme of Work (SOW)
    if (selection.schemeOfWork) {
      const existingSOW = ContentArtifactRepository.list(context.schoolId, {
        gradeLevelId: context.gradeId,
        learningAreaId: context.learningAreaId,
        artifactType: 'scheme_of_work',
      });

      if (existingSOW.length > 0) {
        // Reuse existing valid resource
        const art = existingSOW[0];
        resources.push({
          id: `res_sow_${art.id}`,
          type: 'SCHEME_OF_WORK',
          title: `${context.termId} Scheme of Work`,
          status: 'READY',
          artifactId: art.id,
          artifactVersion: art.version,
          content: typeof art.content === 'string' ? art.content : JSON.stringify(art.content),
          createdAt: art.createdAt,
          updatedAt: art.updatedAt,
        });
      } else {
        const sowArtifact = ArtifactService.createArtifact(
          'scheme_of_work',
          context.schoolId,
          context.gradeId,
          context.learningAreaId,
          [currRef],
          {
            term: context.termId,
            weeks: teachingPlan.weeks.map(w => ({
              weekNumber: w.weekNumber,
              lessons: w.lessonSlots.map(l => ({
                lessonNumber: l.lessonNumber,
                strand: l.strandId,
                subStrand: l.subStrandId,
                learningOutcomes: l.learningOutcomeIds,
              }))
            }))
          },
          { teachingPlanId: teachingPlan.id, termId: context.termId }
        );

        ContentArtifactRepository.save(sowArtifact);

        resources.push({
          id: `res_sow_${sowArtifact.id}`,
          type: 'SCHEME_OF_WORK',
          title: `${context.termId} Scheme of Work`,
          status: 'READY',
          artifactId: sowArtifact.id,
          artifactVersion: sowArtifact.version,
          content: JSON.stringify(sowArtifact.content),
          createdAt: sowArtifact.createdAt,
          updatedAt: sowArtifact.updatedAt,
        });
      }
    }

    // 3. Lesson Plans
    if (selection.lessonPlans) {
      const lpArtifact = ArtifactService.createArtifact(
        'lesson_plan',
        context.schoolId,
        context.gradeId,
        context.learningAreaId,
        [currRef],
        {
          weekNumber: 1,
          lessonNumber: 1,
          title: 'Lesson Plan: Properties of Materials',
          learningOutcomes: ['Identify physical properties of common substances'],
          introduction: 'Review states of matter with learners (5 mins).',
          development: 'Demonstrate density and solubility tests (25 mins).',
          conclusion: 'Summary and quick recall questions (10 mins).',
        },
        { teachingPlanId: teachingPlan.id, termId: context.termId, weekNumber: 1, lessonNumber: 1 }
      );

      ContentArtifactRepository.save(lpArtifact);

      resources.push({
        id: `res_lp_${lpArtifact.id}`,
        type: 'LESSON_PLAN',
        title: 'Week 1 Lesson 1: Properties of Materials',
        status: 'READY',
        artifactId: lpArtifact.id,
        artifactVersion: lpArtifact.version,
        content: JSON.stringify(lpArtifact.content),
        createdAt: lpArtifact.createdAt,
        updatedAt: lpArtifact.updatedAt,
      });
    }

    // 4. Lesson Notes (using 'teacher_resource' artifact type)
    if (selection.lessonNotes) {
      const notesArtifact = ArtifactService.createArtifact(
        'teacher_resource',
        context.schoolId,
        context.gradeId,
        context.learningAreaId,
        [currRef],
        {
          title: 'Learner Lesson Notes: Properties of Materials',
          summary: 'Matter exists in solid, liquid, and gas states with specific physical properties.',
          keyPoints: [
            'Solids have definite shape and volume.',
            'Liquids have definite volume but adapt shape of container.',
            'Density measures mass per unit volume.',
          ],
          activities: ['Observe sample objects and categorize by hardness, color, and conductivity.']
        },
        { teachingPlanId: teachingPlan.id, termId: context.termId, weekNumber: 1, lessonNumber: 1 }
      );

      ContentArtifactRepository.save(notesArtifact);

      resources.push({
        id: `res_notes_${notesArtifact.id}`,
        type: 'LESSON_NOTES',
        title: 'Lesson Notes: Properties of Materials',
        status: 'READY',
        artifactId: notesArtifact.id,
        artifactVersion: notesArtifact.version,
        content: JSON.stringify(notesArtifact.content),
        createdAt: notesArtifact.createdAt,
        updatedAt: notesArtifact.updatedAt,
      });
    }

    // 5. Assessments
    if (selection.assessments) {
      const assessment = AssessmentEvidenceService.createAssessment({
        schoolId: context.schoolId,
        curriculumVersionId: curriculum.version,
        learningOutcomeId: outcomeId,
        teachingPlanId: teachingPlan.id,
        type: 'FORMATIVE',
        title: 'Topical Assessment: Properties of Materials',
        items: [
          {
            sequence: 1,
            type: 'MULTIPLE_CHOICE',
            prompt: 'Which state of matter has both definite shape and volume?',
            options: [
              { key: 'A', text: 'Solid' },
              { key: 'B', text: 'Liquid' },
              { key: 'C', text: 'Gas' },
              { key: 'D', text: 'Plasma' },
            ],
            correctAnswer: 'A',
            marks: 2,
            learningOutcomeId: outcomeId,
          },
          {
            sequence: 2,
            type: 'STRUCTURED',
            prompt: 'State two differences between physical and chemical properties of materials.',
            marks: 4,
            learningOutcomeId: outcomeId,
          }
        ]
      });

      resources.push({
        id: `res_ass_${assessment.assessmentId}`,
        type: 'ASSESSMENT',
        title: assessment.title,
        status: 'READY',
        assessmentId: assessment.assessmentId,
        content: JSON.stringify(assessment.items),
        createdAt: assessment.createdAt,
        updatedAt: assessment.updatedAt,
      });
    }

    const packageId = `pkg_${context.schoolId}_${Date.now()}`;
    const teachingPackage: TeachingPackage = {
      packageId,
      schoolId: context.schoolId,
      teacherId,
      context,
      status: 'READY',
      resources,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    teachingPackages.set(packageId, teachingPackage);

    AuditService.log('ARTIFACT_CREATED', context.schoolId, {
      action: 'TEACHING_PACKAGE_COMPLETED',
      packageId,
      resourceCount: resources.length,
    });

    return teachingPackage;
  },

  // 4. GET MY RESOURCES (NATURAL GROUPING)
  getMyResources(context: TeacherContext, teacherId: string): TeacherResourceItem[] {
    const artifacts = ContentArtifactRepository.list(context.schoolId, {
      gradeLevelId: context.gradeId,
      learningAreaId: context.learningAreaId,
    });

    const items: TeacherResourceItem[] = artifacts.map((art: ContentArtifact) => {
      let type: 'SCHEME_OF_WORK' | 'LESSON_PLAN' | 'LESSON_NOTES' | 'ASSESSMENT' = 'LESSON_NOTES';
      if (art.artifactType === 'scheme_of_work') type = 'SCHEME_OF_WORK';
      else if (art.artifactType === 'lesson_plan') type = 'LESSON_PLAN';
      else if (art.artifactType === 'assessment') type = 'ASSESSMENT';

      return {
        id: `res_${art.id}`,
        type,
        title: `${type.replace(/_/g, ' ')} (v${art.version})`,
        status: 'READY',
        artifactId: art.id,
        artifactVersion: art.version,
        content: typeof art.content === 'string' ? art.content : JSON.stringify(art.content),
        createdAt: art.createdAt,
        updatedAt: art.updatedAt,
      };
    });

    return items;
  },

  // 5. REGENERATE RESOURCE (PRESERVES PREVIOUS VERSION)
  regenerateResource(
    teacherId: string,
    artifactId: string,
    schoolId: string
  ): ContentArtifact {
    let existing: ContentArtifact | undefined;
    try {
      existing = ContentArtifactRepository.getById(artifactId, schoolId);
    } catch {
      throw new Error('Unauthorized cross-school regeneration request');
    }
    if (!existing) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }
    if (existing.schoolId !== schoolId) {
      throw new Error('Unauthorized cross-school regeneration request');
    }

    const newArtifact = ArtifactService.updateArtifactContent(
      existing,
      existing.content,
      'ai_generated'
    );

    ContentArtifactRepository.save(newArtifact);

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'RESOURCE_REGENERATED',
      originalArtifactId: artifactId,
      newArtifactId: newArtifact.id,
      newVersion: newArtifact.version,
    });

    return newArtifact;
  }
};
