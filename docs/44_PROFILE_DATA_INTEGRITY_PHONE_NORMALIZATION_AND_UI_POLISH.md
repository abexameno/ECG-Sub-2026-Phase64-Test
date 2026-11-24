# Phase 44 — Profile Data Integrity, Phone Normalization & Light UI Polish

## Overview
Phase 44 implements data integrity guarantees across user profile ingestion, Kenyan phone number normalization, authoritative account timestamps (`dateJoined`), organization taxonomy enforcement, and refined light-lavender UI accents.

---

## 1. Canonical Profile Data Architecture

| Field | Type | Rule / Constraint | Source of Truth |
| :--- | :--- | :--- | :--- |
| `firstName` | `string` | Mandatory, non-empty, trimmed | User Input / Profile Modal / Settings |
| `lastName` | `string` | Mandatory, non-empty, trimmed | User Input / Profile Modal / Settings |
| `email` | `string` | Verified Google account email, read-only | Firebase Authentication Token |
| `phoneNumber` | `string` | Canonical format: `+254XXXXXXXXX` (13 chars) | Normalized via `utils/phoneUtils.ts` |
| `schoolName` | `string` | Real institution name for Teachers; `Exameno ECG` for Admins | Ingestion validation |
| `organization` | `string` | Synced with `schoolName` | Canonical model |
| `county` | `string` | Official 47 Kenyan Counties (e.g., `Nairobi City`, `Kiambu`) | Searchable County Selector |
| `dateJoined` | `string` (ISO) | Server-generated immutable creation date | `resolveAuthoritativeDateJoined` |
| `profileComplete` | `boolean` | `true` only when all authoritative fields pass verification | Evaluated via `isProfileComplete()` |
| `credits` | `number` | 5 free credits awarded once on initial profile onboarding | Protected against duplicate grants |

---

## 2. Kenyan Phone Normalization Engine (`utils/phoneUtils.ts`)

- **Accepted Ingestion Formats**:
  - `07XXXXXXXX` or `01XXXXXXXX` (10 digits)
  - `+254 7XXXXXXXX` or `+254 1XXXXXXXX` (with or without spaces/hyphens)
  - `2547XXXXXXXX` or `2541XXXXXXXX` (12 digits)
- **Canonical Persisted Format**:
  - `+254XXXXXXXXX` (e.g. `+254717713493`)
- **Display Formatting**:
  - `formatKenyanPhoneDisplay(phone)` -> `+254 717 713 493`

---

## 3. Organization & School Affiliation Rules

1. **System Administrators (`role === 'Admin'`)**:
   - Organization is set to `Exameno ECG`.
2. **Teachers (`role !== 'Admin'`)**:
   - Must provide their actual school / institution name.
   - Placeholder names (`Exameno School`, `Exameno ECG`) are rejected with actionable error messages prompting them to enter their real school.

---

## 4. Immutable Date Joined Resolution (`resolveAuthoritativeDateJoined`)

- Preserves existing valid `dateJoined` strings.
- Backfills from existing trustworthy account creation dates (`createdAt`).
- Generates a new UTC ISO string for first-time account creations.
- Prevents server date drift or user overwrite.

---

## 5. UI Polish

- **"More Tools & Settings" Dropdown & Mobile Sheet**:
  - Soft light-lavender container treatment (`bg-purple-50`, `border-purple-200`).
  - High-contrast typography (`text-purple-950`), crisp icons (`text-[#3b1464]`), and clean active states.
- **Settings Panel**:
  - Integrated First Name, Last Name, Phone normalization feedback, Searchable County Selector, and "Member since [Date]" badge.
