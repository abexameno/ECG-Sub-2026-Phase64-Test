import { SchoolConfigService } from './schoolConfigService.ts';
import { CanonicalCurriculumService } from './canonicalCurriculumService.ts';
import { TeachingPlanService } from './teachingPlanService.ts';
import { GenerationContext, GenerationRequirements, GenerationValidationResult } from '../types.ts';

export const GenerationContextService = {
  buildContext(
    schoolId: string,
    gradeId: string,
    learningAreaId: string,
    term: string,
    requirements: GenerationRequirements,
    strandId?: string,
    subStrandId?: string,
    weekNumber?: number,
    lessonNumber?: number
  ): GenerationContext {
    const school = SchoolConfigService.getSchoolProfile(schoolId);
    if (!school) {
      throw new Error(`Invalid school profile ID: ${schoolId}`);
    }
    const curriculum = CanonicalCurriculumService.getCurriculum();
    const grade = CanonicalCurriculumService.getGradeById(gradeId);
    const learningArea = CanonicalCurriculumService.getLearningAreaById(learningAreaId);
    
    let strandTitle: string | undefined;
    let subStrandTitle: string | undefined;
    let outcomes: { id: string; statement: string }[] = [];

    if (strandId) {
      const strand = CanonicalCurriculumService.getStrands(learningAreaId).find(s => s.id === strandId);
      strandTitle = strand?.title;
    }

    if (subStrandId) {
      const subStrand = CanonicalCurriculumService.getSubStrands(strandId || '').find(ss => ss.id === subStrandId);
      subStrandTitle = subStrand?.title;
      outcomes = CanonicalCurriculumService.getLearningOutcomes(subStrandId).map(lo => ({
        id: lo.id,
        statement: lo.statement
      }));
    }

    return {
      schoolContext: {
        schoolId: school.id,
        schoolName: school.name,
        lessonsPerWeek: school.teachingConfig.lessonsPerWeek,
        teachingWeeks: school.teachingConfig.teachingWeeksPerTerm,
      },
      curriculumContext: {
        curriculumId: curriculum.id,
        curriculumVersion: curriculum.version,
        gradeLevelId: gradeId,
        gradeName: grade?.name || gradeId,
        learningAreaId,
        learningAreaName: learningArea?.name || learningAreaId,
        strandId,
        strandTitle,
        subStrandId,
        subStrandTitle,
        learningOutcomes: outcomes,
      },
      teachingContext: {
        term,
        weekNumber,
        lessonNumber,
        totalCapacity: school.teachingConfig.lessonsPerWeek * school.teachingConfig.teachingWeeksPerTerm,
      },
      requirements,
      provenance: {
        model: 'gemini-3.8-flash',
        promptVersion: '2026.1',
        generatedAt: new Date().toISOString(),
      }
    };
  },

  validateGeneratedArtifact(
    context: GenerationContext,
    artifactMetadata: {
      schoolId?: string;
      grade?: string;
      subject?: string;
      strand?: string;
      subStrand?: string;
    }
  ): GenerationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (artifactMetadata.schoolId && artifactMetadata.schoolId !== context.schoolContext.schoolId) {
      errors.push(`School ID mismatch: Expected ${context.schoolContext.schoolId}, got ${artifactMetadata.schoolId}`);
    }

    if (artifactMetadata.grade && !artifactMetadata.grade.toLowerCase().includes(context.curriculumContext.gradeName.toLowerCase())) {
      warnings.push(`Grade mismatch warning: Expected ${context.curriculumContext.gradeName}, got ${artifactMetadata.grade}`);
    }

    if (artifactMetadata.subject && !artifactMetadata.subject.toLowerCase().includes(context.curriculumContext.learningAreaName.toLowerCase())) {
      warnings.push(`Subject mismatch warning: Expected ${context.curriculumContext.learningAreaName}, got ${artifactMetadata.subject}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
};
