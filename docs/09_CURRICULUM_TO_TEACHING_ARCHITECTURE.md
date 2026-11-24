# ECG Architecture: Curriculum-to-Teaching Architecture (Phase 3)

## 1. Overview
Phase 3 establishes the deterministic bridge between the Canonical Curriculum domain and School Configurations, producing a structured `TeachingPlan` prior to invoking generative AI (Gemini).

## 2. Core Architectural Principle
> **ECG must determine curriculum coverage and teaching allocation from authoritative curriculum data and school configuration before invoking generative AI for pedagogical content.**

Gemini does not independently determine:
- Teaching weeks or lessons per week
- Available teaching capacity
- Curriculum hierarchy or sequencing
- Curriculum validation

## 3. Curriculum-to-Teaching Flow
```text
                CANONICAL CURRICULUM
                         │
                         │ WHAT
                         ↓
              CURRICULUM MAPPING
                         │
                         │ WHAT + WHEN
                         ↓
                  TEACHING PLAN
                         │
                         │ HOW
                         ↓
              PEDAGOGICAL ENGINE
                         │
                         ↓
                      GEMINI
                         │
                         ↓
               GENERATED CONTENT
                         │
                         ↓
                  VALIDATION
```

## 4. Teaching Capacity Calculation
Teaching capacity is derived deterministically from the active school configuration:
$$\text{Total Lesson Capacity} = \text{Teaching Weeks Per Term} \times \text{Lessons Per Week}$$

For example:
- **School A (LWPS)**: $13 \text{ weeks} \times 5 \text{ lessons/wk} = 65 \text{ lessons}$
- **School B**: $12 \text{ weeks} \times 4 \text{ lessons/wk} = 48 \text{ lessons}$
- **School C**: $11 \text{ weeks} \times 6 \text{ lessons/wk} = 66 \text{ lessons}$

The same canonical curriculum is reused identically across all schools without modification.

## 5. Capacity Mismatch Handling
The system evaluates whether available teaching capacity satisfies curriculum coverage requirements and classifies status into:
- `'sufficient'`
- `'tight'`
- `'insufficient'`
