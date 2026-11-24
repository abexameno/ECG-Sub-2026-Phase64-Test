# Phase 31 — Class Differentiation, Learning Groups & Targeted Instruction

## Executive Summary & Architectural Intent

Phase 25 establishes a lightweight, teacher-first system for **Class Differentiation, Learning Groups & Targeted Instruction** within the Exameno CBE Content Generator (ECG) platform.

The objective is to allow one teacher to efficiently teach learners with different current learning needs within the same class by creating temporary instructional groups (such as Guided Practice, Reinforcement, Review, Core Learning, Extension, and Targeted Instruction) while strictly preserving individual learner agency, evidence, and authoritative curriculum boundaries.

---

## Core Principles & Authority Boundaries

### 1. Temporary Teaching Mechanism, Not Permanent Classification
- **Rule**: A learning group is a temporary teaching mechanism, not a permanent learner classification.
- Learners may move freely between groups as evidence and teaching needs change.
- Group membership never changes the learner's official grade, class, curriculum, learner identity, mastery status, or academic standing.

### 2. Teacher-First Principle
- The teacher remains the final authority. ECG provides suggested grouping based on deterministic evidence analysis, but requires explicit teacher approval (Accept, Modify, Reject, Manual Creation).

### 3. Individual Evidence Preservation
- Group membership does not imply mastery, attendance, participation, or completion. Individual learner activity, assessment attempts, and Phase 14 interpretation remain authoritative and distinct.

---

## Domain Models & Data Structures

### 1. `LearningGroup`
```typescript
export type LearningGroupPurpose =
  | 'REINFORCEMENT'
  | 'GUIDED_PRACTICE'
  | 'CORE_LEARNING'
  | 'REVIEW'
  | 'EXTENSION'
  | 'TARGETED_INSTRUCTION'
  | 'CUSTOM';

export type LearningGroupStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';

export interface LearningGroup {
  id: string;
  schoolId: string;
  classGroupId: string;
  teacherId: string;
  academicYearId: string;
  learningAreaId: string;
  curriculumVersionId: string;
  name: string;
  purpose: LearningGroupPurpose;
  learningOutcomeIds: string[];
  objective: string;
  status: LearningGroupStatus;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}
```

### 2. `LearningGroupMembership`
```typescript
export type MembershipStatus = 'ACTIVE' | 'REMOVED' | 'COMPLETED';

export interface LearningGroupMembership {
  id: string;
  schoolId: string;
  learningGroupId: string;
  learnerId: string;
  classGroupId: string;
  teacherId: string;
  joinedAt: string;
  leftAt?: string;
  status: MembershipStatus;
  reason?: string;
  createdAt: string;
  createdBy: string;
}
```

---

## Verification & Acceptance Criteria Matrix (EC-01 to EC-86)

| Criterion | Description | Status |
|---|---|---|
| **EC-01** | `LearningGroup` exists | **PASSED** |
| **EC-02** | `LearningGroupMembership` exists | **PASSED** |
| **EC-03** | Groups are temporary instructional structures | **PASSED** |
| **EC-04** | Membership is time-aware | **PASSED** |
| **EC-05** | Historical membership is preserved | **PASSED** |
| **EC-06** | School ownership is enforced | **PASSED** |
| **EC-07** | Teacher authorization is enforced | **PASSED** |
| **EC-08** | Class authorization is enforced | **PASSED** |
| **EC-09** | Roster validation is enforced | **PASSED** |
| **EC-10** | Curriculum version linkage is preserved | **PASSED** |
| **EC-11** | Learning Outcome linkage is authoritative | **PASSED** |
| **EC-12** | Group purpose is explicit | **PASSED** |
| **EC-13** | Group objective is explicit | **PASSED** |
| **EC-14** | Grouping suggestions are evidence-informed | **PASSED** |
| **EC-15** | Grouping suggestions are deterministic | **PASSED** |
| **EC-16** | Opaque learner clustering is not used | **PASSED** |
| **EC-17** | Teacher approval is required | **PASSED** |
| **EC-18** | Teacher can manually create groups | **PASSED** |
| **EC-19** | Teacher can modify group membership | **PASSED** |
| **EC-20** | Teacher can remove learners | **PASSED** |
| **EC-21** | Teacher can move learners | **PASSED** |
| **EC-22** | Historical membership remains intact after movement | **PASSED** |
| **EC-23** | Groups can be paused | **PASSED** |
| **EC-24** | Groups can be completed | **PASSED** |
| **EC-25** | Groups can be archived | **PASSED** |
| **EC-26** | Group completion does not imply individual completion | **PASSED** |
| **EC-27** | Group membership does not imply mastery | **PASSED** |
| **EC-28** | Group membership does not change learner grade | **PASSED** |
| **EC-29** | Group membership does not change class assignment | **PASSED** |
| **EC-30** | Group membership does not change curriculum identity | **PASSED** |
| **EC-31** | Group membership does not silently modify TeachingPlan | **PASSED** |
| **EC-32** | Group membership does not silently modify TeachingAllocation | **PASSED** |
| **EC-33** | Attendance remains individual | **PASSED** |
| **EC-34** | Participation remains individual | **PASSED** |
| **EC-35** | LearnerActivity remains individual | **PASSED** |
| **EC-36** | AssessmentEvidence remains individual | **PASSED** |
| **EC-37** | Phase 14 interpretation remains individual | **PASSED** |
| **EC-38** | Phase 22 signals can inform group suggestions | **PASSED** |
| **EC-39** | Phase 23 support plans can inform group suggestions | **PASSED** |
| **EC-40** | Phase 24 adaptive pathways can inform group suggestions | **PASSED** |
| **EC-41** | Teacher can convert compatible recommendations into groups | **PASSED** |
| **EC-42** | Teacher can reject suggestions | **PASSED** |
| **EC-43** | Resource reuse works | **PASSED** |
| **EC-44** | Generated group content uses GenerationContext | **PASSED** |
| **EC-45** | Generated content is deterministically validated | **PASSED** |
| **EC-46** | Generated content uses ContentArtifact | **PASSED** |
| **EC-47** | Artifact versioning is preserved | **PASSED** |
| **EC-48** | AI cannot create authoritative curriculum | **PASSED** |
| **EC-49** | AI cannot permanently classify learners | **PASSED** |
| **EC-50** | AI cannot determine mastery | **PASSED** |
| **EC-51** | AI cannot diagnose learners | **PASSED** |
| **EC-52** | AI cannot automatically assign learners to groups | **PASSED** |
| **EC-53** | AI cannot bypass authorization | **PASSED** |
| **EC-54** | Group delivery uses TeachingActivity | **PASSED** |
| **EC-55** | Learner interaction uses LearnerActivity | **PASSED** |
| **EC-56** | Assessment uses Phase 13 architecture | **PASSED** |
| **EC-57** | New evidence flows to Phase 14 | **PASSED** |
| **EC-58** | Group performance does not replace individual evidence | **PASSED** |
| **EC-59** | Cross-school access is blocked | **PASSED** |
| **EC-60** | Cross-class access is blocked | **PASSED** |
| **EC-61** | Unauthorized learner access is blocked | **PASSED** |
| **EC-62** | IDOR manipulation is blocked | **PASSED** |
| **EC-63** | Unauthorized access is audited | **PASSED** |
| **EC-64** | Duplicate group creation is prevented | **PASSED** |
| **EC-65** | Duplicate membership creation is prevented | **PASSED** |
| **EC-66** | Concurrent operations are safe | **PASSED** |
| **EC-67** | Multi-school behavior is verified | **PASSED** |
| **EC-68** | Roster transfer history is preserved | **PASSED** |
| **EC-69** | Teacher reassignment preserves historical attribution | **PASSED** |
| **EC-70** | Curriculum version changes preserve historical groups | **PASSED** |
| **EC-71** | Corrections are auditable | **PASSED** |
| **EC-72–76** | Phase 20–24 integrations remain intact | **PASSED** |
| **EC-77–78** | Teacher workflow remains simple and efficient | **PASSED** |
| **EC-79** | Class differentiation summary is deterministic | **PASSED** |
| **EC-80** | Performance targets verified (p95 ≤ 500-1,000ms) | **PASSED** |
| **EC-81** | Data integrity verified | **PASSED** |
| **EC-82** | TypeScript compilation passes cleanly | **PASSED** |
| **EC-83** | Lint passes cleanly (`npm run lint`) | **PASSED** |
| **EC-84** | Production build passes cleanly (`npm run build`) | **PASSED** |
| **EC-85** | Full regression passes | **PASSED** |
| **EC-86** | Documentation complete in `/docs` | **PASSED** |
