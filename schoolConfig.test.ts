import { SchoolConfigService } from './services/schoolConfigService.ts';

describe('SchoolConfigService (Phase 1 Architectural Modernization)', () => {
  test('should return default LWPS profile when no schoolId is provided', () => {
    const profile = SchoolConfigService.getSchoolProfile();
    expect(profile.id).toBe('lwps');
    expect(profile.teachingConfig.lessonsPerWeek).toBe(5);
    expect(profile.teachingConfig.teachingWeeksPerTerm).toBe(13);
  });

  test('should return School B profile when school-b is requested', () => {
    const profile = SchoolConfigService.getSchoolProfile('school-b');
    expect(profile.id).toBe('school-b');
    expect(profile.teachingConfig.lessonsPerWeek).toBe(4);
    expect(profile.teachingConfig.teachingWeeksPerTerm).toBe(12);
  });

  test('should fallback to LWPS for unknown schoolId', () => {
    const profile = SchoolConfigService.getSchoolProfile('unknown-school');
    expect(profile.id).toBe('lwps');
  });

  test('should resolve default textbooks correctly per school', () => {
    const lwpsBook = SchoolConfigService.getDefaultTextbook('lwps', 'Mathematics', 'Grade 8');
    expect(lwpsBook).toContain('Distinction Mathematics');

    const schoolBBook = SchoolConfigService.getDefaultTextbook('school-b', 'Mathematics', 'Grade 8');
    expect(schoolBBook).toContain('Champion Mathematics');
  });
});
