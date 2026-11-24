import { SchoolProfile, TeachingConfig, TextbookReference, AcademicCalendar } from '../types.ts';
import { SchoolDuplicateCandidate, SchoolMergeRequest, SchoolMergeResult } from '../types/school.ts';
import { SchoolSearchQuery, DuplicateSchoolCheckResult, SchoolConfigChangeImpact, SchoolSetupReadiness } from '../types/teacherOnboarding.ts';
import { AuditService } from './auditService.ts';
import { SchoolMembershipService } from './schoolMembershipService.ts';
import { NotificationService } from './notificationService.ts';
import { PersistentStateService } from './persistentStateService.ts';

const LWPS_PROFILE: SchoolProfile = {
  id: 'lwps',
  name: 'Lizzie Wanyoike Preparatory School',
  schoolType: 'Primary',
  country: 'Kenya',
  county: 'Kiambu',
  schoolCode: 'LWPS-001',
  gradesOffered: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  learningAreasOffered: ['la-sci', 'la-math', 'la-eng', 'la-kis', 'la-ca'],
  curriculumSystem: 'Kenya Competency-Based Curriculum (CBC)',
  academicYear: '2026',
  status: 'active',
  isAuthoritative: true,
  aliases: ['school-lwps'],
  teachingConfig: {
    lessonsPerWeek: 5,
    lessonDurationMinutes: 40,
    teachingWeeksPerTerm: 13,
    revisionWeeks: 1,
    assessmentWeeks: 1,
  },
  contentPreferences: {
    defaultTextbooks: [
      { subject: 'Creative Arts and Sports', grade: 'Grade 8', textbookName: 'Distinction Creative Arts and Sports Grade 8' },
      { subject: 'Mathematics', grade: 'Grade 8', textbookName: 'Distinction Mathematics Grade 8' },
      { subject: 'English', grade: 'Grade 8', textbookName: 'Distinction English Grade 8' },
    ],
    sowStyle: 'Standard KICD CBC Scheme of Work format',
    lessonPlanStyle: 'Detailed CBC 5-Es Lesson Plan format',
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// Legacy duplicate record created in early testing; safely merged into authoritative LWPS profile
const SCHOOL_LWPS_ALIAS_PROFILE: SchoolProfile = {
  ...LWPS_PROFILE,
  id: 'school-lwps',
  name: 'Lizzie Wanyoike Preparatory School (Legacy Record)',
  status: 'merged',
  isAuthoritative: false,
  canonicalSchoolId: 'lwps',
  mergedAt: '2026-01-01T00:00:00.000Z',
  mergedBy: 'system',
  mergeNotes: 'Canonical duplicate alias resolved to authoritative Lizzie Wanyoike Preparatory School (lwps).',
};

const SCHOOL_A_PROFILE: SchoolProfile = {
  id: 'school-a',
  name: 'School A Academy',
  schoolType: 'Primary',
  country: 'Kenya',
  county: 'Nairobi',
  schoolCode: 'SCH-A-001',
  gradesOffered: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  learningAreasOffered: ['la-sci', 'la-math', 'la-eng', 'la-kis'],
  curriculumSystem: 'Kenya Competency-Based Curriculum (CBC)',
  academicYear: '2026',
  status: 'active',
  isAuthoritative: true,
  teachingConfig: {
    lessonsPerWeek: 5,
    lessonDurationMinutes: 40,
    teachingWeeksPerTerm: 13,
    revisionWeeks: 1,
    assessmentWeeks: 1,
  },
  contentPreferences: {
    sowStyle: 'Standard KICD CBC Scheme of Work format',
    lessonPlanStyle: 'Detailed CBC 5-Es Lesson Plan format',
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const SCHOOL_B_PROFILE: SchoolProfile = {
  id: 'school-b',
  name: 'Hillside Academy',
  schoolType: 'Junior Secondary',
  country: 'Kenya',
  county: 'Nakuru',
  schoolCode: 'HSA-002',
  gradesOffered: ['Grade 7', 'Grade 8', 'Grade 9'],
  learningAreasOffered: ['la-sci', 'la-math', 'la-agri'],
  curriculumSystem: 'Kenya Competency-Based Curriculum (CBC)',
  academicYear: '2026',
  status: 'active',
  isAuthoritative: true,
  teachingConfig: {
    lessonsPerWeek: 4,
    lessonDurationMinutes: 45,
    teachingWeeksPerTerm: 12,
    revisionWeeks: 1,
    assessmentWeeks: 1,
  },
  contentPreferences: {
    defaultTextbooks: [
      { subject: 'Creative Arts and Sports', grade: 'Grade 8', textbookName: 'Champion Creative Arts & Sports Grade 8' },
      { subject: 'Mathematics', grade: 'Grade 8', textbookName: 'Champion Mathematics Grade 8' },
    ],
    sowStyle: 'Compact 12-week Scheme of Work format',
    lessonPlanStyle: 'Standard Lesson Plan format',
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const SCHOOL_C_PROFILE: SchoolProfile = {
  id: 'school-c',
  name: 'School C Secondary',
  schoolType: 'Secondary',
  country: 'Kenya',
  county: 'Mombasa',
  schoolCode: 'SCS-003',
  gradesOffered: ['Grade 9', 'Grade 10'],
  learningAreasOffered: ['la-sci', 'la-math', 'la-chem', 'la-phys'],
  curriculumSystem: 'Kenya Competency-Based Education (CBE)',
  academicYear: '2026',
  status: 'active',
  isAuthoritative: true,
  teachingConfig: {
    lessonsPerWeek: 6,
    lessonDurationMinutes: 40,
    teachingWeeksPerTerm: 12,
    revisionWeeks: 1,
    assessmentWeeks: 1,
  },
  contentPreferences: {
    sowStyle: 'Standard CBE format',
    lessonPlanStyle: 'CBE Lesson Plan format',
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const schoolRegistry: Map<string, SchoolProfile> = new Map([
  ['lwps', LWPS_PROFILE],
  ['school-lwps', SCHOOL_LWPS_ALIAS_PROFILE],
  ['school-a', SCHOOL_A_PROFILE],
  ['school-b', SCHOOL_B_PROFILE],
  ['school-c', SCHOOL_C_PROFILE],
]);

function normalizeSchoolName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(school|academy|preparatory|junior|senior|primary|secondary|high|college)\b/g, '')
    .trim();
}

export const SchoolConfigService = {
  getSchoolProfile(schoolId?: string): SchoolProfile {
    if (!schoolId) return LWPS_PROFILE;
    const profile = schoolRegistry.get(schoolId);
    if (!profile) return LWPS_PROFILE;

    // Canonical redirect: If this record was safely merged into an authoritative school, resolve target
    if (profile.status === 'merged' && profile.canonicalSchoolId && profile.canonicalSchoolId !== schoolId) {
      const canonical = schoolRegistry.get(profile.canonicalSchoolId);
      if (canonical) return canonical;
    }
    return profile;
  },

  getSchoolProfileRaw(schoolId: string): SchoolProfile | undefined {
    return schoolRegistry.get(schoolId);
  },

  resolveCanonicalSchoolId(schoolId?: string): string {
    if (!schoolId) return 'lwps';
    const profile = schoolRegistry.get(schoolId);
    if (profile?.status === 'merged' && profile.canonicalSchoolId) {
      return profile.canonicalSchoolId;
    }
    return schoolId;
  },

  isRegisteredSchool(schoolId: string): boolean {
    return schoolRegistry.has(schoolId);
  },

  getAllSchools(options?: { includeInactive?: boolean; includeMerged?: boolean }): SchoolProfile[] {
    const includeInactive = options?.includeInactive ?? false;
    const includeMerged = options?.includeMerged ?? false;

    // Deduplicate schools: return authoritative/canonical active schools by default
    const uniqueSchools = new Map<string, SchoolProfile>();

    for (const profile of schoolRegistry.values()) {
      if (!includeMerged && profile.status === 'merged') continue;
      if (!includeInactive && profile.status === 'deactivated') continue;

      const canonicalKey = profile.canonicalSchoolId || profile.id;
      if (!includeMerged && uniqueSchools.has(canonicalKey)) {
        continue;
      }
      uniqueSchools.set(profile.id, profile);
    }

    return Array.from(uniqueSchools.values());
  },

  getAllSchoolsForAdmin(): SchoolProfile[] {
    return Array.from(schoolRegistry.values());
  },

  registerSchool(profile: SchoolProfile): void {
    const normalized: SchoolProfile = {
      ...profile,
      status: profile.status || 'active',
      updatedAt: new Date().toISOString(),
    };
    schoolRegistry.set(profile.id, normalized);
    PersistentStateService.persistSchoolProfile(normalized);
  },

  ingestSchools(schools: SchoolProfile[]): void {
    if (!Array.isArray(schools)) return;
    for (const s of schools) {
      if (s && s.id) {
        schoolRegistry.set(s.id, s);
      }
    }
  },

  async hydrateFromFirestore(schoolId?: string): Promise<void> {
    if (schoolId) {
      await PersistentStateService.hydrateSchoolById(schoolId);
    } else {
      await PersistentStateService.hydrateSchools();
    }
  },

  registerProfile(profile: SchoolProfile): void {
    this.registerSchool(profile);
  },

  findDuplicateCandidates(): SchoolDuplicateCandidate[] {
    const candidates: SchoolDuplicateCandidate[] = [];
    const all = Array.from(schoolRegistry.values());

    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        if (a.id === b.id) continue;

        const evidence: string[] = [];
        let confidence: 'high' | 'medium' | 'low' = 'low';

        const normA = normalizeSchoolName(a.name);
        const normB = normalizeSchoolName(b.name);

        // Check canonical or alias relationship
        if (
          a.canonicalSchoolId === b.id ||
          b.canonicalSchoolId === a.id ||
          (a.aliases && a.aliases.includes(b.id)) ||
          (b.aliases && b.aliases.includes(a.id))
        ) {
          confidence = 'high';
          evidence.push(`Confirmed link: '${a.id}' is associated with '${b.id}'.`);
        }

        // Check name similarity
        if (normA && normB && (normA === normB || normA.includes(normB) || normB.includes(normA))) {
          confidence = 'high';
          evidence.push(`Identical or closely matching school name: "${a.name}" & "${b.name}".`);
        }

        // Check registration code
        if (a.schoolCode && b.schoolCode && a.schoolCode.trim().toLowerCase() === b.schoolCode.trim().toLowerCase()) {
          confidence = 'high';
          evidence.push(`Matching official registration code: ${a.schoolCode}.`);
        }

        // Check county/location
        if (a.county && b.county && a.county.toLowerCase() === b.county.toLowerCase()) {
          evidence.push(`Both registered in the same county: ${a.county}.`);
        }

        if (evidence.length > 0) {
          let recommendedCanonicalId = a.id;
          if (b.isAuthoritative && !a.isAuthoritative) {
            recommendedCanonicalId = b.id;
          } else if (a.status === 'merged' && b.status !== 'merged') {
            recommendedCanonicalId = b.id;
          } else if (b.id === 'lwps' && a.id === 'school-lwps') {
            recommendedCanonicalId = 'lwps';
          }

          candidates.push({
            id: `candidate_${a.id}_${b.id}`,
            schoolA: a,
            schoolB: b,
            confidence,
            reason: evidence[0],
            recommendedCanonicalId,
            evidence,
          });
        }
      }
    }

    return candidates;
  },

  mergeSchools(request: SchoolMergeRequest): SchoolMergeResult {
    const { sourceSchoolId, targetSchoolId, mergedByUserId, notes } = request;

    if (!sourceSchoolId || !targetSchoolId) {
      throw new Error('Both sourceSchoolId and targetSchoolId are required for merge');
    }
    if (sourceSchoolId === targetSchoolId) {
      throw new Error('Cannot merge a school into itself');
    }

    const source = schoolRegistry.get(sourceSchoolId);
    const target = schoolRegistry.get(targetSchoolId);

    if (!source) throw new Error(`Source school not found: ${sourceSchoolId}`);
    if (!target) throw new Error(`Target school not found: ${targetSchoolId}`);

    const now = new Date().toISOString();

    // 1. Mark source school as safely merged (non-destructive)
    source.status = 'merged';
    source.canonicalSchoolId = targetSchoolId;
    source.mergedAt = now;
    source.mergedBy = mergedByUserId;
    source.mergeNotes = notes || `Safely merged into authoritative school "${target.name}" (${targetSchoolId})`;
    source.updatedAt = now;
    schoolRegistry.set(sourceSchoolId, source);
    PersistentStateService.persistSchoolProfile(source);

    // 2. Append alias to target school
    const aliases = new Set(target.aliases || []);
    aliases.add(sourceSchoolId);
    if (source.aliases) {
      source.aliases.forEach(a => aliases.add(a));
    }
    target.aliases = Array.from(aliases);
    target.isAuthoritative = true;
    target.updatedAt = now;
    schoolRegistry.set(targetSchoolId, target);
    PersistentStateService.persistSchoolProfile(target);

    // 3. Migrate teacher memberships
    let migratedCount = 0;
    try {
      const migrationResult = SchoolMembershipService.migrateSchoolMemberships(sourceSchoolId, targetSchoolId, mergedByUserId);
      migratedCount = migrationResult.count;

      // Notify migrated users
      migrationResult.userIds.forEach(userId => {
        NotificationService.createNotification({
          userId,
          type: 'account_update',
          title: 'School Membership Updated',
          message: `Your school membership has been updated as part of a duplicate record resolution. You are now associated with "${target.name}". No action is required on your part.`,
          metadata: {
            reason: 'SCHOOL_MERGE',
            updatedBy: 'System'
          }
        }).catch(err => console.warn('Failed to notify migrated user:', userId, err));
      });
    } catch (err) {
      console.warn('Membership migration notice during school merge:', err);
    }

    // 4. Audit trail
    const auditLogId = `audit_merge_${Date.now()}`;
    AuditService.log('SCHOOL_MERGED', targetSchoolId, {
      sourceSchoolId,
      targetSchoolId,
      sourceName: source.name,
      targetName: target.name,
      mergedBy: mergedByUserId,
      migratedMembershipsCount: migratedCount,
      notes,
    });

    return {
      success: true,
      sourceSchoolId,
      targetSchoolId,
      message: `Successfully merged "${source.name}" (${sourceSchoolId}) into authoritative record "${target.name}" (${targetSchoolId}).`,
      mergedAt: now,
      migratedMembershipsCount: migratedCount,
      auditLogId,
    };
  },

  deactivateSchool(schoolId: string, userId: string, reason?: string): SchoolProfile {
    const school = schoolRegistry.get(schoolId);
    if (!school) throw new Error(`School not found: ${schoolId}`);

    school.status = 'deactivated';
    school.deactivatedAt = new Date().toISOString();
    school.deactivatedBy = userId;
    school.deactivationReason = reason || 'Deactivated by administrator';
    school.updatedAt = new Date().toISOString();
    schoolRegistry.set(schoolId, school);
    PersistentStateService.persistSchoolProfile(school);

    AuditService.log('SCHOOL_DEACTIVATED', schoolId, { userId, reason });
    return school;
  },

  reactivateSchool(schoolId: string, userId: string): SchoolProfile {
    const school = schoolRegistry.get(schoolId);
    if (!school) throw new Error(`School not found: ${schoolId}`);

    school.status = 'active';
    school.updatedAt = new Date().toISOString();
    schoolRegistry.set(schoolId, school);
    PersistentStateService.persistSchoolProfile(school);

    AuditService.log('SCHOOL_REACTIVATED', schoolId, { userId });
    return school;
  },

  searchSchools(query: string | SchoolSearchQuery): SchoolProfile[] {
    const all = this.getAllSchools();
    if (typeof query === 'string') {
      const q = query.trim().toLowerCase();
      if (!q) return all;
      return all.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.schoolType && s.schoolType.toLowerCase().includes(q))
      );
    }

    let filtered = all;
    if (query.name && query.name.trim()) {
      const q = query.name.trim().toLowerCase();
      filtered = filtered.filter(s => s.name.toLowerCase().includes(q));
    }
    if (query.type && query.type.trim()) {
      const q = query.type.trim().toLowerCase();
      filtered = filtered.filter(s => s.schoolType && s.schoolType.toLowerCase().includes(q));
    }
    if (query.country && query.country.trim()) {
      const q = query.country.trim().toLowerCase();
      filtered = filtered.filter(s => s.country && s.country.toLowerCase().includes(q));
    }
    return filtered;
  },

  checkDuplicateSchool(name: string): DuplicateSchoolCheckResult {
    const rawInput = name.trim().toLowerCase();
    const normalizedInput = normalizeSchoolName(name);
    const all = Array.from(schoolRegistry.values());

    const matches = all.filter(s => {
      const rawExist = s.name.trim().toLowerCase();
      const normExist = normalizeSchoolName(s.name);
      if (rawExist === rawInput) return true;
      
      // Strict equality for short normalized names, partial match for longer names
      if (normalizedInput && normExist) {
        if (normExist === normalizedInput) return true;
        
        // Only allow partial matches for strings longer than 3 characters to avoid single-letter collisions
        if (normExist.length > 3 && normalizedInput.includes(normExist)) return true;
        if (normalizedInput.length > 3 && normExist.includes(normalizedInput)) return true;
      }
      return false;
    });

    return {
      isDuplicateLikely: matches.length > 0,
      matchingSchools: matches,
    };
  },

  createSchool(schoolData: Partial<SchoolProfile>, creatorUserId?: string): SchoolProfile {
    if (!schoolData.name || !schoolData.name.trim()) {
      throw new Error('School name is required');
    }

    const schoolId = schoolData.id || `sch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const newProfile: SchoolProfile = {
      id: schoolId,
      name: schoolData.name.trim(),
      schoolType: schoolData.schoolType || 'Primary',
      country: schoolData.country || 'Kenya',
      county: schoolData.county,
      status: 'active',
      gradesOffered: schoolData.gradesOffered || ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
      learningAreasOffered: schoolData.learningAreasOffered || ['la-sci', 'la-math', 'la-eng', 'la-kis'],
      curriculumSystem: schoolData.curriculumSystem || 'Kenya Competency-Based Curriculum (CBC)',
      academicYear: schoolData.academicYear || '2026',
      teachingConfig: schoolData.teachingConfig || {
        lessonsPerWeek: 5,
        lessonDurationMinutes: 40,
        teachingWeeksPerTerm: 13,
        revisionWeeks: 1,
        assessmentWeeks: 1,
      },
      contentPreferences: schoolData.contentPreferences || {
        sowStyle: 'Standard KICD CBC Scheme of Work format',
        lessonPlanStyle: 'Detailed CBC 5-Es Lesson Plan format',
      },
      createdBy: creatorUserId,
      createdAt: now,
      updatedAt: now,
    };

    schoolRegistry.set(schoolId, newProfile);
    PersistentStateService.persistSchoolProfile(newProfile);

    AuditService.log('SCHOOL_CREATED', schoolId, {
      schoolName: newProfile.name,
      schoolType: newProfile.schoolType,
      createdBy: creatorUserId,
    });

    return newProfile;
  },

  updateSchoolProfile(schoolId: string, updates: Partial<SchoolProfile>, requestedByUserId?: string): SchoolProfile {
    const existing = schoolRegistry.get(schoolId);
    if (!existing) {
      throw new Error(`School not found: ${schoolId}`);
    }

    const updated: SchoolProfile = {
      ...existing,
      ...updates,
      id: schoolId,
      updatedAt: new Date().toISOString(),
    };

    schoolRegistry.set(schoolId, updated);
    PersistentStateService.persistSchoolProfile(updated);

    AuditService.log('SCHOOL_CONFIG_CHANGED', schoolId, {
      updatedBy: requestedByUserId,
      updatedFields: Object.keys(updates),
    });

    return updated;
  },

  updateTeachingConfig(schoolId: string, newConfigUpdates: Partial<TeachingConfig>, requestedByUserId?: string): SchoolConfigChangeImpact {
    const school = schoolRegistry.get(schoolId);
    if (!school) {
      throw new Error(`School not found: ${schoolId}`);
    }

    const previousConfig = { ...school.teachingConfig };
    const newConfig: TeachingConfig = {
      ...previousConfig,
      ...newConfigUpdates,
    };

    school.teachingConfig = newConfig;
    school.updatedAt = new Date().toISOString();
    schoolRegistry.set(schoolId, school);
    PersistentStateService.persistSchoolProfile(school);

    const prevSlots = previousConfig.lessonsPerWeek * previousConfig.teachingWeeksPerTerm;
    const newSlots = newConfig.lessonsPerWeek * newConfig.teachingWeeksPerTerm;
    const slotDiff = newSlots - prevSlots;

    const reviewRequired = slotDiff < 0;
    const warning = reviewRequired
      ? `Teaching capacity reduced from ${prevSlots} to ${newSlots} slots. Existing Teaching Plans require review.`
      : undefined;

    AuditService.log('TEACHING_CONFIG_CHANGED', schoolId, {
      updatedBy: requestedByUserId,
      previousConfig,
      newConfig,
      capacityChangeSlots: slotDiff,
    });

    return {
      schoolId,
      previousConfig,
      newConfig,
      capacityChangeSlots: slotDiff,
      capacityWarning: warning,
      reviewRequired,
    };
  },

  getSchoolReadiness(schoolId: string): SchoolSetupReadiness {
    const school = schoolRegistry.get(schoolId);
    if (!school) {
      return {
        isProfileComplete: false,
        isGradesConfigured: false,
        isLearningAreasConfigured: false,
        isTeachingConfigured: false,
        isCalendarConfigured: false,
        status: 'INCOMPLETE',
      };
    }

    const isProfileComplete = Boolean(school.name && school.schoolType && school.country);
    const isGradesConfigured = Boolean(school.gradesOffered && school.gradesOffered.length > 0);
    const isLearningAreasConfigured = Boolean(school.learningAreasOffered && school.learningAreasOffered.length > 0);
    const isTeachingConfigured = Boolean(
      school.teachingConfig &&
      school.teachingConfig.lessonsPerWeek > 0 &&
      school.teachingConfig.teachingWeeksPerTerm > 0
    );
    const isCalendarConfigured = Boolean(school.academicCalendar || school.academicYear);

    const isReady = isProfileComplete && isGradesConfigured && isLearningAreasConfigured && isTeachingConfigured;

    return {
      isProfileComplete,
      isGradesConfigured,
      isLearningAreasConfigured,
      isTeachingConfigured,
      isCalendarConfigured,
      status: isReady ? 'READY_TO_TEACH' : 'INCOMPLETE',
    };
  },

  getTeachingConfig(schoolId?: string): TeachingConfig {
    const profile = this.getSchoolProfile(schoolId) || LWPS_PROFILE;
    return profile.teachingConfig;
  },

  getExpectedWeeks(schoolId?: string): number {
    return this.getTeachingConfig(schoolId).teachingWeeksPerTerm;
  },

  getLessonsPerWeek(schoolId?: string): number {
    return this.getTeachingConfig(schoolId).lessonsPerWeek;
  },

  getDefaultTextbook(schoolId: string | undefined, subject: string, grade: string): string {
    const profile = this.getSchoolProfile(schoolId) || LWPS_PROFILE;
    const tb = profile.contentPreferences?.defaultTextbooks?.find(
      t => t.subject.toLowerCase() === subject.toLowerCase() && t.grade.toLowerCase() === grade.toLowerCase()
    );
    return tb ? tb.textbookName : `Standard ${subject} Textbook for ${grade}`;
  },

  clearStore(): void {
    schoolRegistry.clear();
    schoolRegistry.set('lwps', LWPS_PROFILE);
    schoolRegistry.set('school-lwps', SCHOOL_LWPS_ALIAS_PROFILE);
    schoolRegistry.set('school-a', SCHOOL_A_PROFILE);
    schoolRegistry.set('school-b', SCHOOL_B_PROFILE);
    schoolRegistry.set('school-c', SCHOOL_C_PROFILE);
  }
};

PersistentStateService.registerDomainService('SchoolConfigService', {
  clearInMemoryOnly: () => {
    SchoolConfigService.clearStore();
  },
  ingestState: (data: { schools?: SchoolProfile[] }) => {
    if (data?.schools) {
      SchoolConfigService.ingestSchools(data.schools);
    }
  },
});
