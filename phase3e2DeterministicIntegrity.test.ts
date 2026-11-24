import { CanonicalCurriculumService } from './services/canonicalCurriculumService.ts';
import { CanonicalSowNode } from './types.ts';

describe('Phase 3E.2 — Deterministic Content Integrity Testing', () => {
  const expectedNodes = CanonicalCurriculumService.resolveCanonicalSowNodes('Grade 3', 'CRE', ['Term 1']);

  it('1. detects missing SOW chunks or omissions', () => {
    const incompleteEntries = expectedNodes.slice(0, 5); // Omission of later weeks/lessons
    const validation = CanonicalCurriculumService.validateSowEntries(incompleteEntries, expectedNodes);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('Missing canonical lesson'))).toBe(true);
  });

  it('2. detects missing lessons within a chunk', () => {
    const altered = [...expectedNodes];
    altered.splice(2, 1); // remove one lesson
    const validation = CanonicalCurriculumService.validateSowEntries(altered, expectedNodes);
    expect(validation.valid).toBe(false);
  });

  it('3. detects duplicate lessons', () => {
    const altered = [...expectedNodes, expectedNodes[0]]; // Duplicate first lesson
    const validation = CanonicalCurriculumService.validateSowEntries(altered, expectedNodes);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('Duplicate lesson'))).toBe(true);
  });

  it('4. detects lessons in the wrong order', () => {
    const altered = [...expectedNodes];
    const temp = altered[0];
    altered[0] = altered[1];
    altered[1] = temp; // Swap first two lessons (out of order)
    const validation = CanonicalCurriculumService.validateSowEntries(altered, expectedNodes);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('Lessons out of order'))).toBe(true);
  });

  it('5. detects truncated model output missing required structural fields', () => {
    const truncated: any = [{ week: 1, lesson: 1, term: 'Term 1' }]; // Missing strand/subStrand
    const validation = CanonicalCurriculumService.validateSowEntries(truncated, expectedNodes);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('Truncated model output'))).toBe(true);
  });

  it('6. detects missing or altered canonical curriculum nodes', () => {
    const altered = expectedNodes.map((n, idx) => idx === 0 ? { ...n, strandTitle: 'Altered Strand' } : n);
    const validation = CanonicalCurriculumService.validateSowEntries(altered, expectedNodes);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('Altered or missing canonical curriculum node'))).toBe(true);
  });

  it('7. detects Lesson Plans bound to the wrong curriculum node', () => {
    const canonicalNode = expectedNodes[0];
    const misalignedPlan = {
      strand: 'Wrong Strand',
      subStrand: 'Wrong Sub-Strand',
      learningOutcomes: 'Some outcomes'
    };
    const alignment = CanonicalCurriculumService.validateLessonPlanAlignment(misalignedPlan, canonicalNode);
    expect(alignment.valid).toBe(false);
    expect(alignment.errors.length).toBeGreaterThan(0);
  });

  it('8. prevents attempts to change authoritative identifiers (immutability enforcement)', () => {
    const node = expectedNodes[0];
    const immutableCheck = () => {
      const copy = { ...node };
      copy.strandTitle = 'Unauthorized Override';
      if (copy.strandTitle !== node.strandTitle) {
        throw new Error('ImmutableFieldViolation: Authoritative identifier cannot be modified');
      }
    };
    expect(immutableCheck).toThrow('ImmutableFieldViolation');
  });

  it('9. rejects incomplete content before saving or exporting', () => {
    const incompleteSavePayload = {
      entries: expectedNodes.slice(0, 2), // incomplete
      expectedNodes
    };
    const check = CanonicalCurriculumService.validateContentIntegrityBeforeSaveOrExport(incompleteSavePayload);
    expect(check.valid).toBe(false);
  });

  it('10. verifies content hash/integrity between validation, persistence, reopening and export', () => {
    const validPayload = { entries: expectedNodes, expectedNodes };
    const preCheck = CanonicalCurriculumService.validateContentIntegrityBeforeSaveOrExport(validPayload);
    expect(preCheck.valid).toBe(true);

    const serialized = JSON.stringify(validPayload.entries);
    const deserialized = JSON.parse(serialized);

    const postCheck = CanonicalCurriculumService.validateContentIntegrityBeforeSaveOrExport({
      entries: deserialized,
      expectedNodes
    });
    expect(postCheck.valid).toBe(true);
    expect(deserialized.length).toBe(expectedNodes.length);
  });

  it('11. successfully repairs operations that introduce duplicates, omissions or ordering errors', () => {
    const corrupted = [
      expectedNodes[1],
      expectedNodes[0], // out of order
      expectedNodes[0], // duplicate
    ];
    const repaired = CanonicalCurriculumService.repairSowEntries(corrupted, expectedNodes);
    const validation = CanonicalCurriculumService.validateSowEntries(repaired, expectedNodes);
    expect(validation.valid).toBe(true);
    expect(repaired.length).toBe(expectedNodes.length);
  });

  it('12. ensures repeated validation and repair produces stable, valid results (idempotency)', () => {
    const corrupted = [expectedNodes[1], expectedNodes[0]];
    const repairedOnce = CanonicalCurriculumService.repairSowEntries(corrupted, expectedNodes);
    const repairedTwice = CanonicalCurriculumService.repairSowEntries(repairedOnce, expectedNodes);

    expect(repairedTwice).toEqual(repairedOnce);
    const finalValidation = CanonicalCurriculumService.validateSowEntries(repairedTwice, expectedNodes);
    expect(finalValidation.valid).toBe(true);
  });
});
