import { SchoolConfigService } from './services/schoolConfigService.ts';
import { SchoolMembershipService } from './services/schoolMembershipService.ts';

describe('School Profile Management & Archiving Unit Tests', () => {
  const testUserId = 'test_admin_user_001';
  const testTeacherId = 'test_teacher_user_002';

  beforeEach(() => {
    // Ensure standard clean test state
  });

  test('SPM-01: Should create a new school profile and persist it', () => {
    const schoolData = {
      name: 'St. Teresa Junior Secondary School',
      schoolType: 'Junior Secondary',
      country: 'Kenya',
      county: 'Kiambu',
      teachingConfig: {
        lessonsPerWeek: 6,
        lessonDurationMinutes: 40,
        teachingWeeksPerTerm: 12,
        revisionWeeks: 1,
        assessmentWeeks: 1,
      },
    };

    const newSchool = SchoolConfigService.createSchool(schoolData, testUserId);
    expect(newSchool).toBeDefined();
    expect(newSchool.id).toBeDefined();
    expect(newSchool.name).toBe('St. Teresa Junior Secondary School');
    expect(newSchool.status).toBe('active');
    expect(newSchool.county).toBe('Kiambu');

    // Retrieve from SchoolConfigService
    const retrieved = SchoolConfigService.getSchoolProfile(newSchool.id);
    expect(retrieved.name).toBe('St. Teresa Junior Secondary School');
    expect(retrieved.teachingConfig.lessonsPerWeek).toBe(6);

    // Verify it is included in all schools
    const all = SchoolConfigService.getAllSchools();
    expect(all.some(s => s.id === newSchool.id)).toBe(true);
  });

  test('SPM-02: Should update school profile details safely without mutating unchanged fields', () => {
    const school = SchoolConfigService.createSchool({
      name: 'Mombasa Academy',
      schoolType: 'Primary',
      county: 'Mombasa',
      teachingConfig: {
        lessonsPerWeek: 5,
        lessonDurationMinutes: 35,
        teachingWeeksPerTerm: 13,
      },
    }, testUserId);

    const updated = SchoolConfigService.updateSchoolProfile(school.id, {
      name: 'Mombasa Academy JSS & Primary',
      county: 'Mombasa',
      schoolType: 'Junior Secondary',
    }, testUserId);

    expect(updated.name).toBe('Mombasa Academy JSS & Primary');
    expect(updated.schoolType).toBe('Junior Secondary');
    expect(updated.teachingConfig.lessonsPerWeek).toBe(5); // Unchanged
  });

  test('SPM-03: Should update teaching configuration and return capacity impact assessment', () => {
    const school = SchoolConfigService.createSchool({
      name: 'Nairobi Heights School',
      schoolType: 'Secondary',
      county: 'Nairobi City',
      teachingConfig: {
        lessonsPerWeek: 5,
        lessonDurationMinutes: 40,
        teachingWeeksPerTerm: 12, // Total 60 slots
      },
    }, testUserId);

    // Reduction in capacity (from 5*12=60 down to 4*10=40, -20 slots)
    const impactReduction = SchoolConfigService.updateTeachingConfig(school.id, {
      lessonsPerWeek: 4,
      lessonDurationMinutes: 40,
      teachingWeeksPerTerm: 10,
    }, testUserId);

    expect(impactReduction).toBeDefined();
    expect(impactReduction.capacityChangeSlots).toBe(-20);
    expect(impactReduction.reviewRequired).toBe(true);
    expect(impactReduction.capacityWarning).toContain('reduced from 60 to 40 slots');

    // Expansion in capacity (from 4*10=40 to 6*12=72, +32 slots)
    const impactExpansion = SchoolConfigService.updateTeachingConfig(school.id, {
      lessonsPerWeek: 6,
      lessonDurationMinutes: 40,
      teachingWeeksPerTerm: 12,
    }, testUserId);

    expect(impactExpansion.capacityChangeSlots).toBe(32);
    expect(impactExpansion.reviewRequired).toBe(false);

    const refreshed = SchoolConfigService.getSchoolProfile(school.id);
    expect(refreshed.teachingConfig.lessonsPerWeek).toBe(6);
    expect(refreshed.teachingConfig.teachingWeeksPerTerm).toBe(12);
  });

  test('SPM-04: Should enforce School Admin authorization for school management actions', () => {
    const school = SchoolConfigService.createSchool({
      name: 'Nakuru Town Academy',
      schoolType: 'Primary',
      county: 'Nakuru',
      teachingConfig: {
        lessonsPerWeek: 5,
        lessonDurationMinutes: 35,
        teachingWeeksPerTerm: 10,
      },
    }, testUserId);

    // Create admin membership for testUserId
    SchoolMembershipService.addTeacherMembership({
      userId: testUserId,
      schoolId: school.id,
      role: 'SCHOOL_ADMIN',
      status: 'ACTIVE',
    });

    // Create regular teacher membership for testTeacherId
    SchoolMembershipService.addTeacherMembership({
      userId: testTeacherId,
      schoolId: school.id,
      role: 'TEACHER',
      status: 'ACTIVE',
    });

    // Validate access
    const isAdminAuthorized = SchoolMembershipService.validateAccess(testUserId, school.id, 'SCHOOL_ADMIN');
    expect(isAdminAuthorized).toBe(true);

    const isTeacherAdminAuthorized = SchoolMembershipService.validateAccess(testTeacherId, school.id, 'SCHOOL_ADMIN');
    expect(isTeacherAdminAuthorized).toBe(false);

    const isTeacherRegularAuthorized = SchoolMembershipService.validateAccess(testTeacherId, school.id, 'TEACHER');
    expect(isTeacherRegularAuthorized).toBe(true);
  });

  test('SPM-05: Should safely archive/deactivate a school profile and allow reactivation', () => {
    const school = SchoolConfigService.createSchool({
      name: 'Eldoret Progressive School',
      schoolType: 'Primary',
      county: 'Uasin Gishu',
      teachingConfig: {
        lessonsPerWeek: 5,
        lessonDurationMinutes: 35,
        teachingWeeksPerTerm: 10,
      },
    }, testUserId);

    // Create admin membership
    SchoolMembershipService.addTeacherMembership({
      userId: testUserId,
      schoolId: school.id,
      role: 'SCHOOL_ADMIN',
      status: 'ACTIVE',
    });

    // Archive / deactivate school
    const deactivated = SchoolConfigService.deactivateSchool(
      school.id,
      testUserId,
      'Duplicate record consolidation'
    );

    expect(deactivated.status).toBe('deactivated');
    expect(deactivated.deactivatedBy).toBe(testUserId);
    expect(deactivated.deactivationReason).toBe('Duplicate record consolidation');
    expect(deactivated.deactivatedAt).toBeDefined();

    // Active dropdowns exclude deactivated schools by default
    const activeSchools = SchoolConfigService.getAllSchools();
    expect(activeSchools.some(s => s.id === school.id)).toBe(false);

    // Including inactive lists it
    const allSchools = SchoolConfigService.getAllSchools({ includeInactive: true });
    expect(allSchools.some(s => s.id === school.id)).toBe(true);

    // Existing memberships remain preserved
    const memberships = SchoolMembershipService.getSchoolMemberships(school.id, testUserId);
    expect(memberships.length).toBeGreaterThan(0);

    // Reactivate school
    const reactivated = SchoolConfigService.reactivateSchool(school.id, testUserId);
    expect(reactivated.status).toBe('active');

    // Verify it is back in active list
    const activeSchoolsAfterReactivation = SchoolConfigService.getAllSchools();
    expect(activeSchoolsAfterReactivation.some(s => s.id === school.id)).toBe(true);
  });
});
