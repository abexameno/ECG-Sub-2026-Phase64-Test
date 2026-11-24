import { ContentArtifact, ArtifactStatus, ArtifactSource, CurriculumReference, GenerationMetadata } from '../types.ts';
import { ArtifactService } from './artifactService.ts';
import { SchoolConfigService } from './schoolConfigService.ts';
import { PersistentStateService } from './persistentStateService.ts';

// In-memory persistent state store for artifacts with multi-school isolation and version history
const artifactStore = new Map<string, ContentArtifact[]>(); // key: base artifact id -> array of versions sorted by version ascending

export const ContentArtifactRepository = {
  save<T>(artifact: ContentArtifact<T>): ContentArtifact<T> {
    // Validate school isolation
    const school = SchoolConfigService.getSchoolProfile(artifact.schoolId);
    if (!school) {
      throw new Error(`Repository rejection: Invalid school ID ${artifact.schoolId}`);
    }

    const validation = ArtifactService.validateArtifact(artifact);
    if (!validation.valid) {
      throw new Error(`Repository rejection: Artifact validation failed: ${validation.errors.join(', ')}`);
    }

    const versions = artifactStore.get(artifact.id) || [];
    const existingIndex = versions.findIndex(v => v.version === artifact.version);

    if (existingIndex >= 0) {
      versions[existingIndex] = artifact;
    } else {
      versions.push(artifact);
    }

    versions.sort((a, b) => a.version - b.version);
    artifactStore.set(artifact.id, versions);
    PersistentStateService.persistContentArtifactVersions(artifact.schoolId, artifact.id, versions);

    return artifact;
  },

  getById<T>(id: string, schoolId: string, version?: number): ContentArtifact<T> | undefined {
    const versions = artifactStore.get(id);
    if (!versions || versions.length === 0) return undefined;

    // Enforce school isolation boundary
    const latest = versions[versions.length - 1];
    if (latest.schoolId !== schoolId) {
      throw new Error(`Security Violation: Access denied to artifact ${id} for school ${schoolId}`);
    }

    if (version !== undefined) {
      const match = versions.find(v => v.version === version);
      return match as ContentArtifact<T> | undefined;
    }

    return latest as ContentArtifact<T>;
  },

  list(
    schoolId: string,
    filters?: {
      artifactType?: string;
      gradeLevelId?: string;
      learningAreaId?: string;
      status?: ArtifactStatus;
      source?: ArtifactSource;
    }
  ): ContentArtifact[] {
    const results: ContentArtifact[] = [];

    for (const [, versions] of artifactStore.entries()) {
      if (!versions || versions.length === 0) continue;
      const latest = versions[versions.length - 1];

      // Enforce strict school isolation
      if (latest.schoolId !== schoolId) continue;

      if (filters?.artifactType && latest.artifactType !== filters.artifactType) continue;
      if (filters?.gradeLevelId && latest.gradeLevelId !== filters.gradeLevelId) continue;
      if (filters?.learningAreaId && latest.learningAreaId !== filters.learningAreaId) continue;
      if (filters?.status && latest.status !== filters.status) continue;
      if (filters?.source && latest.source !== filters.source) continue;

      results.push(latest);
    }

    return results;
  },

  archive(id: string, schoolId: string): ContentArtifact {
    const artifact = this.getById(id, schoolId);
    if (!artifact) {
      throw new Error(`Artifact not found: ${id}`);
    }

    const archived: ContentArtifact = {
      ...artifact,
      status: 'archived',
      updatedAt: new Date().toISOString(),
    };

    return this.save(archived);
  },

  restore(id: string, schoolId: string): ContentArtifact {
    const versions = artifactStore.get(id);
    if (!versions || versions.length === 0) {
      throw new Error(`Artifact not found: ${id}`);
    }

    const latest = versions[versions.length - 1];
    if (latest.schoolId !== schoolId) {
      throw new Error(`Security Violation: Access denied to artifact ${id}`);
    }

    const restored: ContentArtifact = {
      ...latest,
      status: 'validated',
      updatedAt: new Date().toISOString(),
    };

    return this.save(restored);
  },

  copyForSchool(id: string, sourceSchoolId: string, targetSchoolId: string): ContentArtifact {
    const source = this.getById(id, sourceSchoolId);
    if (!source) {
      throw new Error(`Source artifact not found: ${id}`);
    }

    const copied = ArtifactService.copyArtifactForSchool(source, targetSchoolId);
    return this.save(copied);
  },

  clearStore(): void {
    artifactStore.clear();
  },

  clear(): void {
    artifactStore.clear();
  },

  getByActionId<T = unknown>(actionId: string, schoolId: string): ContentArtifact<T>[] {
    if (!schoolId) {
      throw new Error('Cross-school protection: schoolId is required to list artifacts by action');
    }
    return (this.list(schoolId) as ContentArtifact<T>[]).filter(
      (a) =>
        a.teacherActionId === actionId ||
        (a.content as any)?.metadata?.teacherActionId === actionId ||
        (a.content as any)?.metadata?.sourceTeacherActionId === actionId
    );
  },

  ingestArtifactDoc(docData: { id?: string; schoolId?: string; versions?: ContentArtifact[] }): void {
    if (!docData || !docData.id || !Array.isArray(docData.versions) || docData.versions.length === 0) return;
    const sorted = [...docData.versions].sort((a, b) => a.version - b.version);
    artifactStore.set(docData.id, sorted);
  },

  async syncSchoolArtifactsFromFirestore(schoolId: string): Promise<ContentArtifact[]> {
    await PersistentStateService.hydrateSchoolArtifacts(schoolId);
    return this.list(schoolId);
  }
};

PersistentStateService.registerDomainService('ContentArtifactRepository', {
  clearInMemoryOnly: () => {
    ContentArtifactRepository.clearStore();
  },
  ingestState: (data: { schoolId?: string; artifactDocs?: Array<{ id?: string; schoolId?: string; versions?: ContentArtifact[] }> }) => {
    if (Array.isArray(data?.artifactDocs)) {
      for (const docData of data.artifactDocs) {
        ContentArtifactRepository.ingestArtifactDoc(docData);
      }
    }
  },
});
