# CURRICULUM & RESOURCES MANAGER — ADMINISTRATOR GUIDE
## HOW TO USE THIS MANAGER

## 1. Purpose
The **Curriculum & Resources Manager** in the Exameno CBE Content Generator (ECG) Admin Panel provides a centralized, secure interface for administrators to review official KICD CBC/CBE curriculum structures, inspect strands, sub-strands, and specific learning outcomes (SLOs), validate curriculum formats, manage authorized overrides, and synchronize curriculum data with the Firestore cloud datastore.

---

## 2. Who Should Use It
This interface is strictly restricted to **Administrators** (`role: 'Admin'`). Ordinary teachers and guests are blocked from accessing curriculum editing or synchronization controls to safeguard the integrity of upstream curriculum data.

---

## 3. Basic Workflow (6 Steps)
Administrators should follow this standardized workflow:

1. **Select Grade, Subject & Term**: Choose the grade level (Grade 1–10, Pre-Primary), subject/learning area, and term to inspect.
2. **Review the Curriculum Structure**: Review strands, sub-strands, specific learning outcomes, lesson breakdowns, and timing in the Structured Strands View.
3. **Validate Before Making Changes**: Use the KICD Validator / Resource Hub to audit curriculum formatting, syntax, and alignment before executing modifications. Never assume unvalidated data is authoritative.
4. **Make Changes Only When Authorized**: Curriculum changes directly impact downstream teaching plans, allocations, coverage records, and AI content generation. Never invent curriculum or replace KICD standards with unverified textbook sources.
5. **Save / Synchronize Approved Changes**: Synchronize authorized modifications to Firestore cloud storage. Verify saved status upon completion.
6. **Re-Validate**: After synchronization, verify the structured view and run validator checks to ensure complete curriculum alignment.

---

## 4. Main Manager Tools

### Structured Strands View
Hierarchical browser organizing curriculum into:
`Strand → Sub-Strand → Specific Learning Outcome / Content → Timing`
Provides rapid search, filtering, and inspection of all curriculum units.

### Raw KICD Breakdown Editor
Direct editor for authorized modifications to raw structured lesson breakdowns. Allows editing, saving locally, and testing line-by-line KICD lesson strings.

### Resource Hub & KICD Validator
Automated validation engine that audits curriculum text against KICD naming rules, strand structures, and week/lesson syntax.

### Upload & Import Data (JSON / CSV)
Batch import utility for structured curriculum files. Imported data is staged for preview and must be validated before synchronization.

### Firestore Sync Hub
Centralized synchronization console to inspect local modifications, view active overrides, and execute single or bulk cloud synchronization.

---

## 5. Curriculum Authority: Baseline vs Override

```
+-------------------------------------------------------------+
|                      CURRICULUM AUTHORITY                   |
+------------------------------+------------------------------+
|       DEFAULT BASELINE       |      FIRESTORE OVERRIDE      |
|  Approved ECG/KICD baseline  |  Authorized school/system    |
|   used for all operations    |     context modification     |
+------------------------------+------------------------------+
|                   OVERRIDE ≠ REPLACEMENT                    |
+-------------------------------------------------------------+
```

### Default Baseline
The approved ECG/KICD curriculum built into the system that acts as the authoritative foundation for all lesson plans, schemes of work, assessments, and coverage calculations.

### Firestore Override
An authorized modification stored separately in Firestore for specific school or system contexts.

### Critical Rule: OVERRIDE ≠ REPLACEMENT
A Firestore Override does **NOT** replace or delete the KICD/ECG baseline. The baseline remains the permanent, authoritative foundation. Overrides exist as separate context layers and do not compromise the underlying canonical curriculum.

---

## 6. Current UI Labels Explained
- **Default Baseline**: The approved ECG/KICD curriculum currently used as the baseline for curriculum operations.
- **Firestore Override**: An authorized modification stored separately from the baseline for the applicable school/system context.
- **Unsaved Local Changes**: Changes currently made in the manager that have not yet been synchronized to the approved cloud state.
- **Firestore Sync**: The process of synchronizing approved curriculum data with the cloud datastore.

---

## 7. Administrative Safety Principle
Curriculum data sits **upstream** of teaching plans, teaching allocations, coverage tracking, and content generation.

**Core Rules:**
- Always verify the authoritative KICD source before changing curriculum structure.
- Make only authorized curriculum adjustments.
- Synchronize carefully and always re-validate afterward.
- Never weaken curriculum standards or invent unapproved strands/sub-strands.

---

## 8. Curriculum Authority Boundary Architecture

- KICD CURRICULUM = AUTHORITATIVE WHAT
- SCHOOL = WHERE / CONDITIONS
- TEACHING PLAN = WHEN
- TEACHING ALLOCATION = WHAT IS PLANNED
- COVERAGE = HOW MUCH
- GEMINI = ADVISORY HOW
- SERVER = AUTHORITY FOR SECURITY, ENTITLEMENT AND SYSTEM RULES
- TEACHER = FINAL DECISION-MAKER

---

## 9. Troubleshooting & Basic Verification
1. **Cache or Sync Mismatch**: Click **Refresh Cache** to clear local temporary storage and re-fetch fresh cloud overrides from Firestore.
2. **Reload Overrides**: Click **Reload Firestore** to pull recent cloud changes without clearing local unsaved drafts.
3. **Validation Errors**: Run the **KICD Validator** on raw curriculum text to locate missing headers, improper week notations, or syntax irregularities.

