
import { CanonicalCurriculumService } from './services/canonicalCurriculumService.ts';
import { SowSchedulingService } from './services/sowSchedulingService.ts';

describe('Phase 2 Completion Verification', () => {
    it('Grade 3 CRE Term 1 with 13 weeks * 5 lessons = 65 periods should have 65 nodes including revision', () => {
        const masterNodes = CanonicalCurriculumService.getMasterCurriculumSowNodes('Grade 3', 'CRE', ['Term 1']);
        const schedule = { teachingWeeks: 13, lessonsPerWeek: 5 };
        const scheduledNodes = SowSchedulingService.scheduleMasterNodes(masterNodes, schedule, ['Term 1']);
        
        expect(scheduledNodes.length).toBe(65);
        const canonicalLessons = scheduledNodes.filter(n => n.strandId && !n.strandId.startsWith('revision'));
        expect(canonicalLessons.length).toBe(8); // 8 actual lessons
        const revisionLessons = scheduledNodes.filter(n => n.strandId && n.strandId.startsWith('revision'));
        expect(revisionLessons.length).toBe(65 - 8);
    });
});
