
import { CanonicalCurriculumService } from './services/canonicalCurriculumService.ts';
import { ContentType } from './types.ts';

describe('Phase 32.2A Remediation', () => {
    it('Grade 3 CRE Term 1 should return lesson nodes via fallback bridge', () => {
        const nodes = CanonicalCurriculumService.getMasterCurriculumSowNodes('Grade 3', 'CRE', ['Term 1']);
        expect(nodes.length).toBeGreaterThan(0);
        // Verify a specific lesson from data/curriculum/grade-3-cre.ts
        expect(nodes.some(n => n.strandTitle === 'Creation')).toBe(true);
    });

    it('Grade 3 CRE Term 1 lesson count should be > 0', () => {
        const count = CanonicalCurriculumService.getCanonicalLessonCount('Grade 3', 'CRE', ['Term 1']);
        expect(count).toBeGreaterThan(0);
    });
});
