import { ContentArtifact, ArtifactValidationResult, ArtifactType, ArtifactStatus, ArtifactSource, CurriculumReference, GenerationMetadata } from '../types.ts';
import { SchoolConfigService } from './schoolConfigService.ts';
import { CanonicalCurriculumService } from './canonicalCurriculumService.ts';

export const ArtifactService = {
  createArtifact<T>(
    artifactType: ArtifactType,
    schoolId: string,
    gradeLevelId: string,
    learningAreaId: string,
    curriculumReferences: CurriculumReference[],
    content: T,
    options?: {
      teachingPlanId?: string;
      termId?: string;
      weekNumber?: number;
      lessonNumber?: number;
      generationMetadata?: GenerationMetadata;
      source?: ArtifactSource;
    }
  ): ContentArtifact<T> {
    if (!schoolId || !SchoolConfigService.isRegisteredSchool(schoolId)) {
      throw new Error(`Invalid school ID for artifact creation: ${schoolId}`);
    }
    const school = SchoolConfigService.getSchoolProfile(schoolId);
    const curriculum = CanonicalCurriculumService.getCurriculum();

    const artifact: ContentArtifact<T> = {
      id: `art_${schoolId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      artifactType,
      schoolId: schoolId,
      schoolName: school.name,
      schoolLogo: school.logo,
      county: school.county,
      academicYear: school.academicYear,
      curriculumId: curriculum.id,
      curriculumVersion: curriculum.version,
      gradeLevelId,
      gradeLevelName: CanonicalCurriculumService.getGradeById(gradeLevelId)?.name,
      learningAreaId,
      learningAreaName: CanonicalCurriculumService.getLearningAreaById(learningAreaId)?.name,
      teachingPlanId: options?.teachingPlanId,
      termId: options?.termId,
      term: options?.termId, // Simple mapping for now
      weekNumber: options?.weekNumber,
      lessonNumber: options?.lessonNumber,
      curriculumReferences,
      generationMetadata: options?.generationMetadata,
      version: 1,
      status: options?.generationMetadata ? 'generated' : 'draft',
      source: options?.source || (options?.generationMetadata ? 'ai_generated' : 'human_created'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      content,
    };

    const validation = ArtifactService.validateArtifact(artifact);
    if (!validation.valid) {
      throw new Error(`Artifact validation failed: ${validation.errors.join(', ')}`);
    }

    return artifact;
  },

  validateArtifact(artifact: ContentArtifact): ArtifactValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!artifact.id) errors.push('Missing artifact ID');
    if (!artifact.artifactType) errors.push('Missing artifact type');
    
    if (!artifact.schoolId || !SchoolConfigService.isRegisteredSchool(artifact.schoolId)) {
      errors.push(`Invalid school ID: ${artifact.schoolId}`);
    }

    const grade = CanonicalCurriculumService.getGradeById(artifact.gradeLevelId);
    if (!grade) errors.push(`Invalid grade level ID: ${artifact.gradeLevelId}`);

    const la = CanonicalCurriculumService.getLearningAreaById(artifact.learningAreaId);
    if (!la) errors.push(`Invalid learning area ID: ${artifact.learningAreaId}`);

    if (artifact.version < 1) errors.push('Artifact version must be >= 1');
    if (!artifact.curriculumReferences || artifact.curriculumReferences.length === 0) {
      warnings.push('Artifact contains no curriculum references');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  },

  updateArtifactContent<T>(
    existing: ContentArtifact<T>,
    newContent: T,
    source: ArtifactSource = 'human_edited'
  ): ContentArtifact<T> {
    const updated: ContentArtifact<T> = {
      ...existing,
      version: existing.version + 1,
      source,
      updatedAt: new Date().toISOString(),
      content: newContent,
    };

    const validation = ArtifactService.validateArtifact(updated);
    if (!validation.valid) {
      throw new Error(`Updated artifact validation failed: ${validation.errors.join(', ')}`);
    }

    return updated;
  },

  copyArtifactForSchool<T>(
    existing: ContentArtifact<T>,
    targetSchoolId: string
  ): ContentArtifact<T> {
    const targetSchool = SchoolConfigService.getSchoolProfile(targetSchoolId);
    if (!targetSchool) {
      throw new Error(`Invalid target school ID for copy: ${targetSchoolId}`);
    }

    return {
      ...existing,
      id: `art_${targetSchoolId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      schoolId: targetSchool.id,
      version: 1,
      status: 'draft',
      source: 'human_created',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
};
