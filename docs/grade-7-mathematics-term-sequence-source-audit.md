# Grade 7 Mathematics term-sequence source audit

**Status: School-approved Term 1 sequence verified; KICD outcome alignment still pending.**

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


## Approved school Mathematics sequence — user confirmation (2026-11-24)

The user explicitly confirmed that the uploaded *TERM-1-GRADE-7-MATHEMATICS-SCHEMES-OF-WORK(2).pdf* is the actual school-approved Grade 7 Mathematics Term 1 2026 Scheme of Work, notwithstanding blank teacher-name, TSC-number and school fields on its first page. Those blank fields are not treated as evidence against approval. Per the user's standing document-processing instruction, any cover page is disregarded and processing starts with the first curriculum table.

Source document observations:
- 22 pages total; the first curriculum table begins on page 2.
- Grade 7 Mathematics, Term 1, academic year 2026.
- Weeks 1–12 contain five numbered lesson slots each (60 timetable slots).
- Week 8 lessons 4–5 are explicitly marked Half Term, leaving 58 teaching lesson entries.
- Week 13 is explicitly marked End Term Assessment/Closing.
- The document's school approval is based on the user's direct confirmation in the project conversation; the PDF itself does not contain a named approver or school identifier.

Decision:
- Record the school-specific Term 1 sequence as verified for planning/provenance purposes.
- Do not describe it as an official national KICD term-by-term allocation. KICD's cited design establishes full-grade allocations, not a mandatory term split.
- Keep curriculum alignment as a separate gate. The scheme must be compared lesson-by-lesson with the applicable KICD Grade 7 Mathematics learning outcomes and sub-strand design before enabling AI-created Mathematics SOW generation.
- Preserve the approved source rows and week/lesson numbering. Do not silently rewrite apparent mismatches; surface them as review flags.
- Ignore the cover page when importing or processing; begin at the first table.
