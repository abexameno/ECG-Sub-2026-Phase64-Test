/**
 * Phase 44: Profile Data Integrity, Phone Normalization & UI Polish Tests
 */

import {
  sanitizePhoneInput,
  isValidKenyanPhone,
  normalizeKenyanPhone,
  formatKenyanPhoneDisplay
} from './utils/phoneUtils';
import {
  isProfileComplete,
  validateProfileData,
  resolveAuthoritativeDateJoined,
  LEGACY_SCHOOL_PLACEHOLDERS
} from './utils/profileUtils';
import { User } from './types';

describe('Phase 44: Kenyan Phone Number Normalization & Validation', () => {
  it('should sanitize phone number input by stripping formatting noise', () => {
    expect(sanitizePhoneInput(' 0717-713-493 ')).toBe('0717713493');
    expect(sanitizePhoneInput('+254 (0717) 713-493')).toBe('+2540717713493');
    expect(sanitizePhoneInput('254 717 713 493')).toBe('254717713493');
  });

  it('should validate valid Kenyan phone numbers in various formats', () => {
    // 07xx Safaricom/Airtel/Telkom
    expect(isValidKenyanPhone('0717713493')).toBe(true);
    expect(isValidKenyanPhone('0717 713 493')).toBe(true);
    expect(isValidKenyanPhone('0722123456')).toBe(true);
    expect(isValidKenyanPhone('0733123456')).toBe(true);

    // 01xx Safaricom/Airtel new prefixes
    expect(isValidKenyanPhone('0110123456')).toBe(true);
    expect(isValidKenyanPhone('0115123456')).toBe(true);

    // International +254
    expect(isValidKenyanPhone('+254717713493')).toBe(true);
    expect(isValidKenyanPhone('+254 717 713 493')).toBe(true);
    expect(isValidKenyanPhone('+254110123456')).toBe(true);

    // 254 without plus
    expect(isValidKenyanPhone('254717713493')).toBe(true);
    expect(isValidKenyanPhone('254110123456')).toBe(true);
  });

  it('should reject invalid or non-Kenyan phone numbers', () => {
    expect(isValidKenyanPhone('')).toBe(false);
    expect(isValidKenyanPhone('07123')).toBe(false); // too short
    expect(isValidKenyanPhone('07123456789012')).toBe(false); // too long
    expect(isValidKenyanPhone('+14155552671')).toBe(false); // US number
    expect(isValidKenyanPhone('0812345678')).toBe(false); // Invalid prefix 08
    expect(isValidKenyanPhone('abcdefghijk')).toBe(false); // non-numeric
  });

  it('should normalize any valid Kenyan phone to canonical +254XXXXXXXXX format', () => {
    expect(normalizeKenyanPhone('0717713493')).toBe('+254717713493');
    expect(normalizeKenyanPhone('0717 713 493')).toBe('+254717713493');
    expect(normalizeKenyanPhone('+254 717 713 493')).toBe('+254717713493');
    expect(normalizeKenyanPhone('254717713493')).toBe('+254717713493');
    expect(normalizeKenyanPhone('0110123456')).toBe('+254110123456');
    expect(normalizeKenyanPhone('+254110123456')).toBe('+254110123456');
  });

  it('should format Kenyan phone numbers for clean display', () => {
    expect(formatKenyanPhoneDisplay('+254717713493')).toBe('+254 717 713 493');
    expect(formatKenyanPhoneDisplay('0717713493')).toBe('+254 717 713 493');
    expect(formatKenyanPhoneDisplay('')).toBe('');
  });
});

describe('Phase 44: Profile Data Integrity & Completion Validation', () => {
  const completeTeacher: User = {
    id: 'user_1',
    name: 'Jane Wanjiku',
    firstName: 'Jane',
    lastName: 'Wanjiku',
    email: 'jane.wanjiku@gmail.com',
    phoneNumber: '+254717713493',
    schoolName: 'Moi Educational Centre',
    county: 'Nairobi City',
    role: 'Teacher',
    status: 'Active',
    credits: 10,
    profileComplete: true
  };

  it('should identify a fully valid teacher profile as complete', () => {
    expect(isProfileComplete(completeTeacher)).toBe(true);
  });

  it('should require firstName and lastName', () => {
    const missingFirst = { ...completeTeacher, firstName: '' };
    expect(isProfileComplete(missingFirst)).toBe(false);

    const missingLast = { ...completeTeacher, lastName: '' };
    expect(isProfileComplete(missingLast)).toBe(false);
  });

  it('should reject incomplete profiles missing phone or with invalid phone numbers', () => {
    const missingPhone = { ...completeTeacher, phoneNumber: '' };
    expect(isProfileComplete(missingPhone)).toBe(false);

    const invalidPhone = { ...completeTeacher, phoneNumber: '12345' };
    expect(isProfileComplete(invalidPhone)).toBe(false);
  });

  it('should require teachers to have their actual school name and not legacy placeholders', () => {
    const placeholderSchool = { ...completeTeacher, schoolName: 'Exameno School' };
    expect(isProfileComplete(placeholderSchool)).toBe(false);

    const placeholderECG = { ...completeTeacher, schoolName: 'Exameno ECG' };
    expect(isProfileComplete(placeholderECG)).toBe(false);
  });

  it('should allow Admin to have Exameno ECG as organization', () => {
    const adminUser: User = {
      ...completeTeacher,
      role: 'Admin',
      schoolName: 'Exameno ECG',
      organization: 'Exameno ECG'
    };
    expect(isProfileComplete(adminUser)).toBe(true);
  });

  it('should require county selection', () => {
    const missingCounty = { ...completeTeacher, county: '' };
    expect(isProfileComplete(missingCounty)).toBe(false);
  });

  it('should validate profile data with clear validation results', () => {
    const validResult = validateProfileData({
      firstName: 'Faith',
      lastName: 'Achieng',
      email: 'faith.achieng@gmail.com',
      phoneNumber: '0712 345 678',
      schoolName: 'Kisumu Girls High School',
      county: 'Kisumu',
      role: 'Teacher'
    });
    expect(validResult.isValid).toBe(true);
    expect(validResult.normalizedPhone).toBe('+254712345678');

    const invalidResult = validateProfileData({
      firstName: 'Faith',
      lastName: '',
      email: 'faith.achieng@gmail.com',
      phoneNumber: '0712 345 678',
      schoolName: 'Exameno School',
      county: 'Kisumu',
      role: 'Teacher'
    });
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Phase 44: Authoritative DateJoined Resolution', () => {
  it('should preserve existing valid dateJoined', () => {
    const existingDate = '2025-01-15T08:30:00.000Z';
    const resolved = resolveAuthoritativeDateJoined(existingDate, '2025-02-01T00:00:00.000Z');
    expect(resolved).toBe(existingDate);
  });

  it('should fallback to earliest createdAt if dateJoined is not present', () => {
    const createdAt = '2024-11-20T10:00:00.000Z';
    const resolved = resolveAuthoritativeDateJoined(undefined, createdAt);
    expect(resolved).toBe(createdAt);
  });

  it('should generate valid current ISO timestamp if no past dates exist', () => {
    const resolved = resolveAuthoritativeDateJoined(undefined, undefined);
    expect(new Date(resolved).getTime()).not.toBeNaN();
    expect(resolved).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
