# Phase 19 Architecture Documentation: Teacher Onboarding, School Membership & Self-Service School Configuration

## Executive Summary
Phase 19 formalizes Exameno CBE Content Generator (ECG) as a **Teacher-First, School-Aware, Multi-School Platform**.
This architecture separates the individual teacher identity from school profiles, membership roles, and authorized teaching contexts.

---

## 1. Architectural Foundation & Data Model

```
                    ECG USER
                        │
                        ▼
                 TEACHER PROFILE
                        │
                        ▼
                SCHOOL MEMBERSHIP
                        │
                        ▼
                 SCHOOL PROFILE
                        │
                 ┌──────┴──────┐
                 ▼             ▼
          TEACHING CONFIG   ACADEMIC CALENDAR
                 │             │
                 └──────┬──────┘
                        ▼
                 TEACHING CONTEXT
                        │
                 ┌──────┴──────┐
                 ▼             ▼
              GRADE       LEARNING AREA
                        │
                        ▼
                  TEACHING PLAN
                        │
                        ▼
                  TODAY'S LESSON
```

### Core Entities

1. **Teacher Profile (`TeacherProfile`)**:
   - Represents the individual teacher user account.
   - Fields: `id`, `userId`, `displayName`, `email`, `phoneNumber`, `professionalInfo` (`tscNumber`, `qualifications`, `specialization`).
   - Owned by the teacher.

2. **School Membership (`SchoolMembership`)**:
   - Represents the relationship between a teacher and a school.
   - Fields: `id`, `userId`, `schoolId`, `role` (`TEACHER` | `ACADEMIC_ADMIN` | `SCHOOL_ADMIN` | `SUPER_ADMIN`), `status` (`PENDING` | `ACTIVE` | `SUSPENDED` | `REMOVED`), `joinedAt`, `createdAt`, `updatedAt`.
   - Access to school data is strictly authorized via an active membership with status `ACTIVE`.

3. **School Profile (`SchoolProfile`)**:
   - Represents the school entity.
   - Fields: `id`, `name`, `schoolType`, `country`, `schoolCode`, `gradesOffered`, `learningAreasOffered`, `teachingConfig`.

4. **Teaching Context (`TeacherTeachingContext`)**:
   - Authorized teaching context for the active school session.
   - Fields: `schoolId`, `teacherId`, `gradeId`, `learningAreaId`, `termId`, `academicYearId`.

---

## 2. Server-Side Authorization & Security Boundary

- **Authorization Enforcement**: `SchoolMembershipService.validateAccess(userId, schoolId, requiredRole)` deterministically validates active school membership.
- **IDOR Protection**: Direct queries for school memberships or administrative actions by unauthorized teachers are rejected server-side and logged via `AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED')`.
- **Role Hierarchy**:
  - `SUPER_ADMIN`: Platform-wide full access.
  - `SCHOOL_ADMIN`: School profile management, teaching configuration updates, member approval/rejection/suspension/role changes.
  - `ACADEMIC_ADMIN`: Academic oversight and operation management.
  - `TEACHER`: Resource generation, teaching context usage, lesson delivery, learner activity.

---

## 3. Workflows

### A. School Discovery & Join Request
- Teachers search existing registered schools by name or location (`searchSchools`).
- Requesting to join creates a `PENDING` membership (`MEMBERSHIP_REQUESTED`).
- School Admins review and approve/reject pending memberships (`MEMBERSHIP_APPROVED` / `MEMBERSHIP_REJECTED`).

### B. Duplicate School Protection & Self-Service Creation
- Fuzzy, normalized deterministic matching checks for existing school names (`checkDuplicateSchool`).
- If a match exists, a warning presents options: `[ View Matching Schools ]` or `[ Create New School Anyway ]`.
- Creating a new school designates the creator as `SCHOOL_ADMIN` with an `ACTIVE` membership (`createSchoolWithMembership`).

### C. Multi-School Switching
- Teachers belonging to multiple schools switch active context cleanly via `setActiveSchool`.
- Switching active school resets/clears incompatible cached state and resolves the new school's authorized teaching context and today's lesson.

### D. Self-Service School Configuration & Capacity Impact
- `SCHOOL_ADMIN` users can modify `TeachingConfig` (`lessonsPerWeek`, `lessonDurationMinutes`, `teachingWeeksPerTerm`).
- When saved, capacity impact is calculated. If capacity is reduced, a notice details slot reduction and flags existing Teaching Plans for review without destroying historical data.

---

## 4. Audit Logging

All Phase 19 actions are recorded via `AuditService`:
- `SCHOOL_CREATED`
- `MEMBERSHIP_REQUESTED`
- `MEMBERSHIP_APPROVED`
- `MEMBERSHIP_REJECTED`
- `MEMBERSHIP_SUSPENDED`
- `MEMBERSHIP_REMOVED`
- `MEMBERSHIP_ROLE_CHANGED`
- `SCHOOL_CONFIG_CHANGED`
- `TEACHING_CONFIG_CHANGED`
- `SCHOOL_SWITCHED`
- `UNAUTHORIZED_ACCESS_ATTEMPTED`

---

## 5. Non-AI Functional Independence
Gemini / AI is strictly excluded from authorization, school existence, membership roles, context resolution, and capacity calculations. The platform's security and onboarding mechanics remain 100% functional without AI dependency.
