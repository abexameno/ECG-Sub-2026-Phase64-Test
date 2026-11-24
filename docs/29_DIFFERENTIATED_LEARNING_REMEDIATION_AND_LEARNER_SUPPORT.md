# Phase 23 — Differentiated Learning, Remediation & Learner Support

## Executive Summary & Architectural Intent

Phase 23 establishes a lightweight, teacher-first system for **Differentiated Learning, Remediation & Learner Support** within the Exameno CBE Content Generator (ECG) platform.

Building directly upon Phase 22 (Learner Attention Signals & Follow-Up), Phase 23 enables a teacher to respond to an identified learning need by selecting or generating appropriate differentiated or remedial support resources, delivering those resources to individual learners or small groups, and reviewing the outcome—**without ECG diagnosing the learner, changing the curriculum, or automatically declaring mastery**.

---

## Core Principles & Authority Boundaries

### 1. Support Responds to Evidence, Not Deficit Diagnosis
- Support needs (`LearnerSupportNeed`) are triggered by objective sources: Phase 22 attention signals, teacher classroom observations, assessment evidence, or interpretation gaps.
- ECG **STRICTLY FORBIDS** creating clinical, psychological, or deficit diagnoses (e.g. "dyslexic", "low ability", "slow learner").
- Remediation and differentiation are normal, positive components of Competency-Based Education (CBE). Support ≠ Failure.

### 2. Differentiation Does Not Change Curriculum Expectations
- Support resources and learning plans remain tied to canonical KICD curriculum outcomes (`LearningOutcome`).
- Scaffolding, reteaching, and alternative representations adjust *how* learning is accessed, not *what* outcomes are expected.

### 3. Reuse-First Resource Strategy
- Before generating new AI content, ECG searches existing validated school content artifacts (`ContentArtifactRepository`) for reusable learning materials.
- When AI generation is requested, ECG uses authoritative `GenerationContext` and model governance (`AIGovernanceService`, `QuotaService`).

### 4. Group Support Preserves Learner Identity
- Small group support (`createGroupSupport`) allows teachers to assign a support plan to multiple learners simultaneously.
- However, each learner receives an individual `LearnerSupportPlan`, ensuring that individual progress, history, and delivery records remain discrete and auditable.

### 5. Non-Interference & Teacher Authority
- Delivering support or completing a support plan **DOES NOT** automatically grant outcome mastery (`MASTERY`).
- Outcome interpretation remains governed exclusively by Phase 14 (`LearningOutcomeInterpretationService`), under teacher authority.
- Semantic boundary: `Attendance ≠ Participation ≠ Activity ≠ Assessment ≠ Interpretation ≠ Attention ≠ Support ≠ Mastery`.

---

## Domain Models & Data Structures

### 1. `LearnerSupportNeed`
Represents an identified learning need requiring differentiated or remedial support:

```typescript
export type SupportNeedSourceType =
  | 'ATTENTION_SIGNAL'
  | 'TEACHER_OBSERVATION'
  | 'ASSESSMENT_EVIDENCE'
  | 'INTERPRETATION_GAP'
  | 'LEARNER_REQUEST';

export type SupportNeedStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED';

export interface LearnerSupportNeed {
  id: string;
  schoolId: string;
  learnerId: string;
  classGroupId: string;
  teacherId: string;
  learningOutcomeId: string;
  sourceType: SupportNeedSourceType;
  sourceReference?: string;
  reason: string;
  status: SupportNeedStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  dismissedAt?: string;
  dismissedBy?: string;
}
```

### 2. `LearnerSupportPlan`
Represents a teacher-created support plan specifying strategy, intensity, objective, and content:

```typescript
export type SupportStrategy =
  | 'RETEACH_CONCEPT'
  | 'GUIDED_PRACTICE'
  | 'ADDITIONAL_PRACTICE'
  | 'SCAFFOLDED_ACTIVITY'
  | 'EXAMPLE_AND_MODELLING'
  | 'SMALL_GROUP_SUPPORT'
  | 'PEER_SUPPORTED_ACTIVITY'
  | 'EXTENSION_ACTIVITY'
  | 'REVIEW_PREVIOUS_CONCEPT'
  | 'TARGETED_ASSESSMENT'
  | 'MONITOR_AND_REVIEW'
  | 'OTHER';

export type SupportIntensity = 'LIGHT' | 'STANDARD' | 'ADDITIONAL_SUPPORT' | 'INTENSIVE_SUPPORT';

export type SupportPlanStatus = 'PLANNED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';

export type SupportOutcomeDecision = 'RESOLVED' | 'NEEDS_FURTHER_SUPPORT' | 'ADJUST_STRATEGY' | 'DISCONTINUED';

export interface LearnerSupportPlan {
  id: string;
  schoolId: string;
  learnerId: string;
  classGroupId: string;
  teacherId: string;
  supportNeedId: string;
  groupSupportId?: string;
  learningOutcomeIds: string[];
  strategy: SupportStrategy;
  intensity: SupportIntensity;
  objective: string;
  plannedDate: string;
  status: SupportPlanStatus;
  deliveredAt?: string;
  deliveredBy?: string;
  notes?: string;
  artifactId?: string;
  outcomeDecision?: SupportOutcomeDecision;
  outcomeNotes?: string;
  outcomeRecordedAt?: string;
  outcomeRecordedBy?: string;
  history: SupportHistoryEntry[];
  createdAt: string;
  createdBy: string;
  idempotencyKey?: string;
}
```

---

## Service Architecture & Workflow

### Workflow Lifecycle
1. **Identify Need**: Teacher identifies or system surfaces a `LearnerSupportNeed`.
2. **Select Resource**: Teacher searches existing artifacts (`searchExistingResources`) or generates AI support material (`generateSupportContent`).
3. **Plan Support**: Teacher creates an individual (`createSupportPlan`) or group (`createGroupSupport`) support plan.
4. **Deliver Support**: Support is delivered (`deliverSupportPlan`), generating a `LESSON_DELIVERY` teaching activity and `PRACTICE_EXERCISE` learner activity.
5. **Review Outcome**: Teacher evaluates the support outcome (`reviewSupportOutcome`), marking the plan completed or adjusting strategy.

---

## Verification & Acceptance Criteria Matrix (EC-01 to EC-64)

| Criterion | Description | Verification Status |
|---|---|---|
| **EC-01** | Canonical support-need model exists (`LearnerSupportNeed`) | **PASSED** |
| **EC-02** | Canonical support-plan model exists (`LearnerSupportPlan`) | **PASSED** |
| **EC-03** | Support context is deterministic (`getSupportContext`) | **PASSED** |
| **EC-04** | Learning Outcome linkage validated against curriculum | **PASSED** |
| **EC-05** | Curriculum version linkage preserved | **PASSED** |
| **EC-06** | School ownership enforced | **PASSED** |
| **EC-07** | Teacher authorization enforced | **PASSED** |
| **EC-08** | Class authorization enforced | **PASSED** |
| **EC-09** | Roster validation enforced | **PASSED** |
| **EC-10** | Attention signals initiate support review | **PASSED** |
| **EC-11** | Teacher observations initiate support | **PASSED** |
| **EC-12** | Support does not create learner diagnoses | **PASSED** |
| **EC-13** | Support strategies are controlled and understandable | **PASSED** |
| **EC-14** | Differentiation does not create parallel curriculum | **PASSED** |
| **EC-15** | Support objective is explicit | **PASSED** |
| **EC-16** | Existing resources searched before generation | **PASSED** |
| **EC-17** | Resource reuse is school-safe | **PASSED** |
| **EC-18** | AI-generated support uses authoritative GenerationContext | **PASSED** |
| **EC-19** | AI-generated support is deterministically validated | **PASSED** |
| **EC-20** | Invalid generated content not persisted | **PASSED** |
| **EC-21** | AI cannot invent curriculum references | **PASSED** |
| **EC-22** | AI cannot determine mastery | **PASSED** |
| **EC-23** | AI cannot determine learner diagnosis | **PASSED** |
| **EC-24** | AI cannot bypass authorization | **PASSED** |
| **EC-25** | ContentArtifact integration works | **PASSED** |
| **EC-26** | Artifact versioning works | **PASSED** |
| **EC-27** | Teacher can preview support content | **PASSED** |
| **EC-28** | Teacher controls support usage | **PASSED** |
| **EC-29** | Individual support plan creation works | **PASSED** |
| **EC-30** | Group support creation works | **PASSED** |
| **EC-31** | Group support preserves individual learner identity | **PASSED** |
| **EC-32** | Support delivery integrates with TeachingActivity architecture | **PASSED** |
| **EC-33** | Learner interaction integrates with LearnerActivity architecture | **PASSED** |
| **EC-34** | Optional assessment uses Phase 13 evidence architecture | **PASSED** |
| **EC-35** | New evidence remains independent from support status | **PASSED** |
| **EC-36** | Support does not automatically create mastery | **PASSED** |
| **EC-37** | Support does not automatically alter performance | **PASSED** |
| **EC-38** | Support does not automatically create completion | **PASSED** |
| **EC-39** | Support does not alter curriculum coverage | **PASSED** |
| **EC-40** | Support does not alter teaching allocation | **PASSED** |
| **EC-41** | Support review can reference new evidence | **PASSED** |
| **EC-42** | Phase 14 interpretation remains authoritative | **PASSED** |
| **EC-43** | Support status is teacher-controlled | **PASSED** |
| **EC-44** | Support completion does not mean mastery | **PASSED** |
| **EC-45** | Support history is preserved | **PASSED** |
| **EC-46** | Corrections are auditable | **PASSED** |
| **EC-47** | Teacher notes are protected | **PASSED** |
| **EC-48** | Duplicate support plan creation prevented via idempotencyKey | **PASSED** |
| **EC-49** | Concurrent support creation is safe | **PASSED** |
| **EC-50** | Cross-school access blocked | **PASSED** |
| **EC-51** | Cross-class access blocked | **PASSED** |
| **EC-52** | Unauthorized learner access blocked | **PASSED** |
| **EC-53** | IDOR manipulation blocked | **PASSED** |
| **EC-54** | Unauthorized access audited in AuditService | **PASSED** |
| **EC-55** | Quota and AI governance enforced | **PASSED** |
| **EC-56** | Multi-school isolation verified | **PASSED** |
| **EC-57** | Roster transfers preserve support history | **PASSED** |
| **EC-58** | Teacher reassignment preserves historical attribution | **PASSED** |
| **EC-59** | Phase 1–22 regression passes | **PASSED** |
| **EC-60** | TypeScript compilation passes cleanly (`tsc --noEmit`) | **PASSED** |
| **EC-61** | Lint passes cleanly (`npm run lint`) | **PASSED** |
| **EC-62** | Production build passes cleanly (`npm run build`) | **PASSED** |
| **EC-63** | Performance targets verified (< 50ms operations) | **PASSED** |
| **EC-64** | Documentation complete in /docs | **PASSED** |
