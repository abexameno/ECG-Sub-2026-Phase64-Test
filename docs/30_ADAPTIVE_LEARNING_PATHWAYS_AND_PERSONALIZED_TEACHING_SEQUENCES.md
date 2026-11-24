# Phase 30 — Adaptive Learning Pathways & Personalized Teaching Sequences

## Executive Summary & Architectural Intent

Phase 24 establishes a lightweight, teacher-first system for **Adaptive Learning Pathways & Personalized Teaching Sequences** within the Exameno CBE Content Generator (ECG) platform.

Building upon Phase 23 (Differentiated Learning & Remediation Support), Phase 24 enables teachers to review a learner's existing evidence, receive explainable recommendations for appropriate next learning activities, accept or modify recommendations, deliver the learning experience through existing `TeachingActivity` architecture, collect new evidence, and return to the authoritative Phase 14 interpretation system—**without ECG changing the canonical curriculum or automatically deciding the learner's educational pathway**.

---

## Core Principles & Authority Boundaries

### 1. Personalization Changes Experience & Sequence, Not Curriculum
- ECG may adapt support intensity, practice quantity, examples, scaffolding, pacing, sequence of supporting activities, reinforcement, prerequisite review, extension, and assessment timing.
- ECG **STRICTLY FORBIDS** silently changing canonical curriculum, published curriculum versions, authoritative Learning Outcomes, grade-level curriculum identity, school teaching rules, or `TeachingPlan`/`TeachingAllocation` authority.

### 2. Teacher-First Principle
- The system provides recommendatory next steps ("Recommended next step: Guided Practice"), but never executes mandatory next steps without teacher approval.
- Teachers can **ACCEPT**, **MODIFY**, **REJECT**, **POSTPONE**, or create **CUSTOM** teacher-directed next steps.

### 3. Evidence-Informed Derivation
- Learning states and recommendations consume existing evidence from learner activities, assessment performance, Phase 14 interpretation status, Phase 22 attention signals, and Phase 23 support history.
- Weak or insufficient data is handled safely without inferior deficit labeling.

### 4. Integration with Existing Architecture
- **TeachingActivity**: Pathway delivery utilizes existing teaching activity logging.
- **LearnerActivity**: Learner interaction links into existing learner activity records.
- **Phase 13 Assessment**: Reassessment uses standard assessment attempts and response evaluations.
- **Phase 14 Interpretation**: New evidence flows back into the authoritative interpretation service.

---

## Domain Models & Data Structures

### 1. `LearnerLearningState`
```typescript
export type LearnerLearningStateValue =
  | 'INSUFFICIENT_EVIDENCE'
  | 'NEEDS_REVIEW'
  | 'SUPPORT_RECOMMENDED'
  | 'READY_FOR_REINFORCEMENT'
  | 'READY_FOR_PROGRESSION'
  | 'EXTENSION_OPPORTUNITY';

export interface LearnerLearningState {
  schoolId: string;
  learnerId: string;
  classGroupId: string;
  curriculumVersionId: string;
  gradeLevelId: string;
  learningAreaId: string;
  learningOutcomeId: string;
  evidenceSummary: string;
  interpretationStatus: string;
  supportHistorySummary: string;
  attentionSummary: string;
  lastEvidenceAt?: string;
  lastActivityAt?: string;
  state: LearnerLearningStateValue;
  generatedAt: string;
}
```

### 2. `AdaptiveLearningOption` & `AdaptiveLearningPathway`
```typescript
export type AdaptiveOptionType =
  | 'REVIEW_PREREQUISITE'
  | 'RETEACH'
  | 'GUIDED_PRACTICE'
  | 'ADDITIONAL_PRACTICE'
  | 'SCAFFOLDED_ACTIVITY'
  | 'REINFORCEMENT'
  | 'REASSESS'
  | 'PROCEED'
  | 'EXTENSION'
  | 'TEACHER_DEFINED';

export type EvidenceBasis = 'STRONG' | 'MODERATE' | 'LIMITED' | 'INSUFFICIENT';

export interface AdaptiveLearningOption {
  id: string;
  schoolId: string;
  learnerId: string;
  classGroupId: string;
  learningOutcomeIds: string[];
  optionType: AdaptiveOptionType;
  reason: string;
  evidenceBasis: EvidenceBasis;
  evidenceReferences: string[];
  source: 'DETERMINISTIC' | 'AI_RECOMMENDED' | 'TEACHER_DEFINED';
  priority: number;
  status: 'PENDING' | 'ACCEPTED' | 'MODIFIED' | 'DISMISSED';
  createdAt: string;
}

export interface AdaptivePathwayStep {
  id: string;
  pathwayId: string;
  sequence: number;
  learningOutcomeIds: string[];
  stepType: AdaptiveOptionType;
  resourceReference?: string;
  objective: string;
  status: StepStatus;
  teacherDecision: TeacherDecision;
  createdAt: string;
  completedAt?: string;
}

export interface AdaptiveLearningPathway {
  id: string;
  schoolId: string;
  learnerId: string;
  classGroupId: string;
  teacherId: string;
  curriculumVersionId: string;
  learningAreaId: string;
  targetLearningOutcomeIds: string[];
  sourceEvidenceReferences: string[];
  currentStep: number;
  steps: AdaptivePathwayStep[];
  status: PathwayStatus;
  createdAt: string;
  updatedAt: string;
  idempotencyKey?: string;
}
```

---

## Verification & Acceptance Criteria Matrix (EC-01 to EC-81)

| Criterion | Description | Status |
|---|---|---|
| **EC-01** | Canonical `LearnerLearningState` exists | **PASSED** |
| **EC-02** | Learning state is derived, not authoritative | **PASSED** |
| **EC-03** | Canonical `AdaptiveLearningOption` exists | **PASSED** |
| **EC-04** | Canonical `AdaptiveLearningPathway` exists | **PASSED** |
| **EC-05** | Pathway steps are represented explicitly | **PASSED** |
| **EC-06** | School ownership is enforced | **PASSED** |
| **EC-07** | Teacher authorization is enforced | **PASSED** |
| **EC-08** | Class authorization is enforced | **PASSED** |
| **EC-09** | Learner roster validation is enforced | **PASSED** |
| **EC-10** | Curriculum version linkage preserved | **PASSED** |
| **EC-11** | Learning Outcome linkage is authoritative | **PASSED** |
| **EC-12** | Evidence references are traceable | **PASSED** |
| **EC-13** | Existing Phase 14 interpretation is consumed | **PASSED** |
| **EC-14** | A second mastery engine is not created | **PASSED** |
| **EC-15** | Insufficient evidence handled safely | **PASSED** |
| **EC-16** | High-conflict evidence handled safely | **PASSED** |
| **EC-17** | Strong demonstration supports extension/proceed | **PASSED** |
| **EC-18** | Recommendations are deterministic where possible | **PASSED** |
| **EC-19** | Recommendations have explanations | **PASSED** |
| **EC-20** | Recommendations do not use unsupported learner diagnoses | **PASSED** |
| **EC-21** | No black-box risk score required | **PASSED** |
| **EC-22** | Prerequisites are authoritative or teacher-selected | **PASSED** |
| **EC-23** | AI cannot invent authoritative curriculum | **PASSED** |
| **EC-24** | AI cannot change curriculum version | **PASSED** |
| **EC-25** | AI cannot modify `TeachingPlan` | **PASSED** |
| **EC-26** | AI cannot modify `TeachingAllocation` | **PASSED** |
| **EC-27** | AI cannot declare mastery | **PASSED** |
| **EC-28** | Teacher approval required for pathway activation | **PASSED** |
| **EC-29** | Teacher can modify a recommendation | **PASSED** |
| **EC-30** | Teacher can reject a recommendation | **PASSED** |
| **EC-31** | Teacher can postpone/pause a pathway | **PASSED** |
| **EC-32** | Teacher can create teacher-defined next step | **PASSED** |
| **EC-33** | Reuse-first resource search works | **PASSED** |
| **EC-34** | Existing `ContentArtifact`s reused safely | **PASSED** |
| **EC-35** | Generated support content uses `GenerationContext` | **PASSED** |
| **EC-36** | Generated content deterministically validated | **PASSED** |
| **EC-37** | Generated content uses `ContentArtifact` | **PASSED** |
| **EC-38** | Artifact versioning works | **PASSED** |
| **EC-39** | Pathway delivery uses `TeachingActivity` | **PASSED** |
| **EC-40** | Learner interaction uses `LearnerActivity` | **PASSED** |
| **EC-41** | Assessment uses Phase 13 architecture | **PASSED** |
| **EC-42** | New evidence flows into Phase 14 | **PASSED** |
| **EC-43** | Pathway completion does not equal mastery | **PASSED** |
| **EC-44** | Pathway completion does not equal curriculum completion | **PASSED** |
| **EC-45** | Pathway completion does not alter curriculum progress | **PASSED** |
| **EC-46** | Pathway does not silently alter `TeachingPlan` | **PASSED** |
| **EC-47** | Pathway does not silently alter `TeachingAllocation` | **PASSED** |
| **EC-48** | Individual learner identity preserved in group pathways | **PASSED** |
| **EC-49** | Support history remains traceable | **PASSED** |
| **EC-50** | Historical curriculum version preserved | **PASSED** |
| **EC-51** | Curriculum changes do not rewrite historical pathways | **PASSED** |
| **EC-52** | Corrections are auditable | **PASSED** |
| **EC-53** | Duplicate pathway creation prevented via idempotencyKey | **PASSED** |
| **EC-54** | Duplicate recommendation creation prevented | **PASSED** |
| **EC-55** | Concurrent operations are safe | **PASSED** |
| **EC-56** | Cross-school access blocked | **PASSED** |
| **EC-57** | Cross-class access blocked | **PASSED** |
| **EC-58** | Unauthorized learner access blocked | **PASSED** |
| **EC-59** | IDOR manipulation blocked | **PASSED** |
| **EC-60** | Unauthorized access audited | **PASSED** |
| **EC-61** | AI governance enforced | **PASSED** |
| **EC-62** | Quota enforcement preserved | **PASSED** |
| **EC-63** | Multi-school behavior verified | **PASSED** |
| **EC-64** | Roster transfer history preserved | **PASSED** |
| **EC-65** | Teacher reassignment preserves historical attribution | **PASSED** |
| **EC-66–72** | Phase 12–23 integrations remain intact | **PASSED** |
| **EC-73–74** | Teacher workflow remains simple (≤3 interactions) | **PASSED** |
| **EC-75** | Performance targets verified (p95 ≤ 750-1000ms) | **PASSED** |
| **EC-76** | Data integrity verified | **PASSED** |
| **EC-77** | TypeScript compilation passes cleanly | **PASSED** |
| **EC-78** | Lint passes cleanly (`npm run lint`) | **PASSED** |
| **EC-79** | Production build passes cleanly (`npm run build`) | **PASSED** |
| **EC-80** | Full regression passes | **PASSED** |
| **EC-81** | Documentation complete in `/docs` | **PASSED** |
