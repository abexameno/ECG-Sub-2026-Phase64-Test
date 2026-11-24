# Grade 7 Mathematics term-sequence source audit

**Status: Term-specific sequence not authoritatively established.**

## Primary source

Kenya Institute of Curriculum Development (KICD), *Mathematics Grade 7 Curriculum Design*, Revised 2024.

- Official PDF: https://kicd.ac.ke/wp-content/uploads/2024/06/Mathematics-Grade-7-Design-Formated-April-2024.pdf
- Relevant sections: lesson allocation (printed page ix), summary of strands and sub-strands (printed page xii), and strand/sub-strand designs throughout the document.
- What it verifies: Grade 7 Mathematics receives five lessons per week; the curriculum lists 18 sub-strands in an ordered design and a total of 150 suggested lessons for the full grade.
- What it does **not** verify: a mandatory assignment of each sub-strand to Term 1, Term 2, or Term 3, or a fixed 13-week-by-5-lesson scheme for each term.

## Secondary term schemes reviewed

Publicly accessible teacher-resource and scheme-hosting sites provide term-labelled schemes, including:
- https://notes.co.ke/uploads/GRADE_7_TERM_1_MATHEMATICS_SCHEMES.pdf
- https://teacherske.co.ke/documents/term-1-grade-7-mathematics-activities-schemes-of-work/
- https://www.schemesofwork.co.ke/generate-pdf?preview=&scheme_id=1291408

These are not KICD-issued curriculum designs. They are teacher/school planning artifacts and differ in term/week allocations. They may be used as corroborating examples for a *provisional school plan* after line-by-line alignment to the KICD outcomes, but must not be described as the official national term sequence.

## Engineering decision

1. Preserve KICD's full-grade sub-strand allocation data and source metadata.
2. Keep termAllocationStatus = UNVERIFIED until a term-specific allocation is approved as an explicit planning policy or verified against a school-approved scheme.
3. Do not silently distribute 150 full-year lessons into three terms or extrapolate 13 weeks × 5 lessons into curriculum content.
4. Use the week/lesson coverage validator to detect missing or duplicate schedule slots once an expected schedule is supplied. Coverage checks establish schedule completeness, not curriculum alignment.
5. Before enabling Grade 7 Mathematics generation, obtain a school-approved term scheme or a documented policy for term allocation, then check every outcome and lesson against the KICD design and record the source/version.

## Decision record

As of 2026-10-22, the available primary source is authoritative for learning outcomes, sub-strand order and suggested full-grade lesson counts, but insufficient to assert one official term-by-term sequence. The safe action is to keep generation blocked rather than fabricate a term map.

## Additional source review — user-provided school planning example (2026-11-22)

The only additional school planning document supplied for this audit is *Grade 7 Agriculture and Nutrition, Term 2, 2026 Scheme of Work* (8 pages; Exameno Master Template). It is useful as a **format and school-calendar example only**. It is not a Mathematics curriculum source and does not establish Grade 7 Mathematics learning outcomes, sub-strand order, or term allocation.

The supplied Agriculture scheme shows a school planning pattern of four lesson slots in teaching weeks, a mid-term assessment in Week 7 Lesson 4, a half-term break in Week 8, and teaching weeks 1–7 and 9–13. This pattern must not automatically be transferred to Mathematics: the KICD Grade 7 Mathematics design states five Mathematics lessons per week, and the Agriculture document does not authorize a Mathematics timetable or term sequence. Use the school's approved Mathematics timetable if supplied; otherwise retain the Mathematics source-verification block.

Decision: no Mathematics curriculum rows, learning outcomes, term assignments, or week/lesson slots have been derived from the Agriculture document. The generation restriction remains in force.
