/**
 * Profile Data Integrity & Validation Utilities
 * 
 * Phase 44 Canonical Profile Standards:
 * - One User -> One Valid Profile -> One Canonical Phone (+254XXXXXXXXX) -> One School Context -> One Immutable Date Joined
 */

import { User } from '../types/user';
import { KENYA_COUNTIES } from '../constants/kenyaCounties';
import { isValidKenyanPhone, normalizeKenyanPhone } from './phoneUtils';

export const LEGACY_SCHOOL_PLACEHOLDERS = ['Exameno School', 'Exameno ECG'];

/**
 * Checks if a user profile is complete and valid according to Phase 44 rules.
 */
export function isProfileComplete(user: Partial<User> | null | undefined): boolean {
  if (!user) return false;

  const firstName = (user.firstName !== undefined ? user.firstName : (user.name ? user.name.trim().split(' ')[0] : '')).trim();
  const lastName = (user.lastName !== undefined ? user.lastName : (user.name ? user.name.trim().split(' ').slice(1).join(' ') : '')).trim();
  const email = (user.email || '').trim();
  const phoneNumber = (user.phoneNumber || '').trim();
  const schoolName = (user.schoolName || user.organization || '').trim();
  const county = (user.county || '').trim();
  const role = user.role || 'Teacher';

  if (!firstName || !lastName || !email || !phoneNumber || !county) {
    return false;
  }

  // Validate Kenyan phone number
  if (!isValidKenyanPhone(phoneNumber)) {
    return false;
  }

  // County check against standard Kenya counties
  const isCountyValid = KENYA_COUNTIES.some(
    c => {
      const countyStr = typeof c === 'string' ? c : ((c as any).value || (c as any).label || '');
      return countyStr.toLowerCase() === county.toLowerCase();
    }
  ) || county.length > 2;

  if (!isCountyValid) {
    return false;
  }

  // Admin vs Teacher Organization Rule:
  // Admin may retain 'Exameno ECG' or 'Exameno School'
  // Non-Admin teachers MUST provide their actual school name and cannot retain legacy placeholders
  if (role === 'Admin') {
    if (!schoolName) return false;
  } else {
    if (!schoolName || LEGACY_SCHOOL_PLACEHOLDERS.includes(schoolName)) {
      return false;
    }
  }

  return true;
}

/**
 * Validates profile submission payload and returns any validation errors
 */
export function validateProfileData(data: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  schoolName?: string;
  county?: string;
  role?: string;
}): {
  isValid: boolean;
  errors: string[];
  normalizedPhone: string | null;
  normalizedSchool: string;
} {
  const errors: string[] = [];
  const firstName = (data.firstName || '').trim();
  const lastName = (data.lastName || '').trim();
  const email = (data.email || '').trim();
  const rawPhone = (data.phoneNumber || '').trim();
  const schoolName = (data.schoolName || '').trim();
  const county = (data.county || '').trim();
  const role = data.role || 'Teacher';

  if (!firstName) {
    errors.push('First Name is required.');
  }
  if (!lastName) {
    errors.push('Last Name is required.');
  }
  if (!email) {
    errors.push('Email is required.');
  }

  let normalizedPhone: string | null = null;
  if (!rawPhone) {
    errors.push('Phone Number is required.');
  } else {
    normalizedPhone = normalizeKenyanPhone(rawPhone);
    if (!normalizedPhone) {
      errors.push('Invalid Kenyan phone number format. Please enter a valid number such as 0717 713 493 or +254717713493.');
    }
  }

  if (!schoolName) {
    errors.push('School Name is required.');
  } else if (role !== 'Admin' && LEGACY_SCHOOL_PLACEHOLDERS.includes(schoolName)) {
    errors.push('Please provide your actual school name. "Exameno ECG" and "Exameno School" are placeholder names.');
  }

  if (!county) {
    errors.push('County selection is required.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalizedPhone,
    normalizedSchool: schoolName
  };
}

/**
 * Safely resolves the permanent dateJoined timestamp for a user.
 * - If dateJoined exists, preserves it.
 * - Else if existing trustworthy createdAt exists, backfills from createdAt.
 * - Else if new user, sets current server timestamp.
 */
export function resolveAuthoritativeDateJoined(
  existingUserOrDateJoined: any,
  fallbackCreatedAtOrIsNew?: any,
  isNewUserFlag: boolean = false
): string {
  // Case 1: Called with (dateJoinedString, createdAtString)
  if (typeof existingUserOrDateJoined === 'string' && existingUserOrDateJoined.trim()) {
    return existingUserOrDateJoined.trim();
  }

  // Case 2: Called with a user object: existingUser.dateJoined
  if (existingUserOrDateJoined && typeof existingUserOrDateJoined === 'object') {
    if (existingUserOrDateJoined.dateJoined) {
      return String(existingUserOrDateJoined.dateJoined);
    }
    if (existingUserOrDateJoined.createdAt) {
      const ca = existingUserOrDateJoined.createdAt;
      if (typeof ca === 'string') return ca;
      if (ca.toDate) return ca.toDate().toISOString();
      if (typeof ca.seconds === 'number') return new Date(ca.seconds * 1000).toISOString();
    }
  }

  // Case 3: fallback createdAt passed as 2nd arg
  if (typeof fallbackCreatedAtOrIsNew === 'string' && fallbackCreatedAtOrIsNew.trim()) {
    return fallbackCreatedAtOrIsNew.trim();
  }
  if (fallbackCreatedAtOrIsNew && typeof fallbackCreatedAtOrIsNew === 'object') {
    if (fallbackCreatedAtOrIsNew.toDate) return fallbackCreatedAtOrIsNew.toDate().toISOString();
    if (typeof fallbackCreatedAtOrIsNew.seconds === 'number') {
      return new Date(fallbackCreatedAtOrIsNew.seconds * 1000).toISOString();
    }
  }

  // Case 4: New user or timestamp generation
  if (fallbackCreatedAtOrIsNew === true || isNewUserFlag || !existingUserOrDateJoined) {
    return new Date().toISOString();
  }

  // Safe fallback
  return new Date().toISOString();
}
