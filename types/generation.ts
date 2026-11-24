import { SchoolProfile } from './school.ts';
import { Curriculum, GradeLevel, LearningArea, Strand, SubStrand, LearningOutcome } from './curriculum.ts';
import { TeachingPlan } from './teachingPlan.ts';

export interface GenerationRequirements {
  artifactType: 'scheme_of_work' | 'lesson_plan' | 'assessment' | 'study_guide' | 'rowc';
  lessonDurationMinutes: number;
  desiredOutputStructure?: string;
  teacherRequirements?: string;
  learnerRequirements?: string;
  language?: string;
  difficulty?: string;
  additionalInstructions?: string;
}

export interface GenerationContext {
  schoolContext: {
    schoolId: string;
    schoolName: string;
    lessonsPerWeek: number;
    teachingWeeks: number;
  };
  curriculumContext: {
    curriculumId: string;
    curriculumVersion: string;
    gradeLevelId: string;
    gradeName: string;
    learningAreaId: string;
    learningAreaName: string;
    strandId?: string;
    strandTitle?: string;
    subStrandId?: string;
    subStrandTitle?: string;
    learningOutcomes: { id: string; statement: string }[];
  };
  teachingContext: {
    teachingPlanId?: string;
    term: string;
    weekNumber?: number;
    lessonNumber?: number;
    totalCapacity: number;
  };
  requirements: GenerationRequirements;
  provenance: {
    model: string;
    promptVersion: string;
    generatedAt: string;
  };
}

export interface GenerationValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
