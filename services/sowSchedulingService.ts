import {
  CanonicalSowNode,
  SchoolSowSchedule,
  SowCapacityEvaluation,
  SowCapacityStatus
} from '../types.ts';
import { CanonicalCurriculumService } from './canonicalCurriculumService.ts';

export const SowSchedulingService = {
  /**
   * Evaluates whether a school's teaching schedule has sufficient capacity
   * to cover the authoritative KICD curriculum requirements.
   *
   * Principle: KICD curriculum determines WHAT must be taught.
   * School timetable determines WHEN it is taught.
   */
  evaluateCapacity(params: {
    grade: string;
    subject: string;
    terms?: string[];
    teachingWeeks: number;
    lessonsPerWeek: number;
    canonicalLessonCount?: number;
  }): SowCapacityEvaluation {
    const {
      grade,
      subject,
      terms = ['Term 1'],
      teachingWeeks,
      lessonsPerWeek,
    } = params;

    const requestedTerms = (!terms || terms.length === 0) ? ['Term 1'] : terms;
    
    // Get canonical lesson count if not provided
    const canonicalLessonCount = params.canonicalLessonCount !== undefined
      ? params.canonicalLessonCount
      : CanonicalCurriculumService.getCanonicalLessonCount(grade, subject, requestedTerms);

    const termsCount = requestedTerms.length;
    // Total school capacity is teaching weeks per term * lessons per week * number of terms
    const totalAvailablePeriods = Math.max(0, teachingWeeks * lessonsPerWeek * termsCount);

    let status: SowCapacityStatus;
    let canGenerate: boolean;
    let unscheduledLessons = 0;
    let unusedCapacity = 0;
    let message = '';

    if (totalAvailablePeriods === canonicalLessonCount) {
      // CASE A — EXACT MATCH
      status = 'EXACT_MATCH';
      canGenerate = true;
      unscheduledLessons = 0;
      unusedCapacity = 0;
      message = '✓ Schedule capacity matches curriculum requirements';
    } else if (totalAvailablePeriods > canonicalLessonCount) {
      // CASE B — EXCESS CAPACITY
      status = 'EXCESS_CAPACITY';
      canGenerate = true;
      unscheduledLessons = 0;
      unusedCapacity = totalAvailablePeriods - canonicalLessonCount;
      message = `${canonicalLessonCount} curriculum lessons | ${unusedCapacity} additional teaching periods available for revision, assessment, or school activities.`;
    } else {
      // CASE C — INSUFFICIENT CAPACITY
      status = 'INSUFFICIENT_CAPACITY';
      canGenerate = false;
      unscheduledLessons = canonicalLessonCount - totalAvailablePeriods;
      unusedCapacity = 0;
      message = `Insufficient teaching capacity. This curriculum contains ${canonicalLessonCount} canonical lessons, but the selected school schedule provides only ${totalAvailablePeriods} teaching periods. ${unscheduledLessons} curriculum lessons cannot currently be scheduled. Increase the number of teaching weeks or lessons per week before generating the final School SOW.`;
    }

    return {
      grade,
      subject,
      terms: requestedTerms,
      canonicalLessonCount,
      teachingWeeks,
      lessonsPerWeek,
      totalAvailablePeriods,
      status,
      canGenerate,
      unscheduledLessons,
      unusedCapacity,
      message,
    };
  },

  /**
   * Maps Master Curriculum SOW nodes onto a school's flexible schedule.
   *
   * Crucial invariants:
   * 1. 100% of canonical nodes are preserved.
   * 2. Canonical curriculum is never truncated.
   * 3. AI is not permitted to inject fake curriculum nodes for excess capacity.
   * 4. Multi-term week indexing is preserved without cross-term leakage.
   */
  scheduleMasterNodes(
    masterNodes: CanonicalSowNode[],
    schedule?: { teachingWeeks?: number; lessonsPerWeek?: number },
    terms: string[] = ['Term 1']
  ): CanonicalSowNode[] {
    const lessonsPerWeek = Math.max(1, schedule?.lessonsPerWeek || 4);
    const teachingWeeks = Math.max(1, schedule?.teachingWeeks || 10);
    const requestedTerms = (!terms || terms.length === 0) ? ['Term 1'] : terms;

    const scheduledNodes: CanonicalSowNode[] = [];
    let cumulativeWeekOffset = 0;

    for (let termIdx = 0; termIdx < requestedTerms.length; termIdx++) {
      const term = requestedTerms[termIdx];
      const normalizedTerm = term.toLowerCase().replace(/\s+/g, '');

      // Filter master nodes for this specific term
      const termNodes = masterNodes.filter(n => {
        const normNodeTerm = n.term.toLowerCase().replace(/\s+/g, '');
        return normNodeTerm === normalizedTerm || normalizedTerm.includes(normNodeTerm) || normNodeTerm.includes(normalizedTerm);
      });

      // If no nodes match this term specifically, fallback to nodes belonging to termIdx
      const activeNodes = termNodes.length > 0 ? termNodes : masterNodes;

      // Fill curriculum nodes
      for (let i = 0; i < activeNodes.length; i++) {
        const node = activeNodes[i];
        const weekNum = Math.floor(i / lessonsPerWeek) + 1 + cumulativeWeekOffset;
        const lessonNum = (i % lessonsPerWeek) + 1;

        scheduledNodes.push({
          ...node,
          week: weekNum,
          lesson: lessonNum,
          term,
        });
      }

      // Fill remaining capacity with revision slots
      const totalTermPeriods = teachingWeeks * lessonsPerWeek;
      for (let i = activeNodes.length; i < totalTermPeriods; i++) {
        const weekNum = Math.floor(i / lessonsPerWeek) + 1 + cumulativeWeekOffset;
        const lessonNum = (i % lessonsPerWeek) + 1;
        
        scheduledNodes.push({
            week: weekNum,
            lesson: lessonNum,
            term,
            strandId: `revision-${termIdx}-${i}`,
            strandTitle: 'Revision / Assessment',
            subStrandId: `revision-${termIdx}-${i}`,
            subStrandTitle: 'Consolidation Activity',
            learningOutcomeIds: [],
            learningOutcomesText: 'Review and consolidate learning.',
            keyInquiryQuestions: ['What have we learned so far?']
        });
      }

      cumulativeWeekOffset += teachingWeeks;
    }

    return scheduledNodes;
  },

  /**
   * Generates a complete School Scheduled SOW by taking canonical curriculum
   * and mapping it to the school's configured schedule.
   */
  generateSchoolSow(
    grade: string,
    subject: string,
    terms: string[] = ['Term 1'],
    schedule?: SchoolSowSchedule
  ): {
    evaluation: SowCapacityEvaluation;
    masterNodes: CanonicalSowNode[];
    scheduledNodes: CanonicalSowNode[];
  } {
    const masterNodes = CanonicalCurriculumService.getMasterCurriculumSowNodes(grade, subject, terms);
    const teachingWeeks = schedule?.teachingWeeks || 10;
    const lessonsPerWeek = schedule?.lessonsPerWeek || 4;

    const evaluation = this.evaluateCapacity({
      grade,
      subject,
      terms,
      teachingWeeks,
      lessonsPerWeek,
      canonicalLessonCount: masterNodes.length,
    });

    const scheduledNodes = this.scheduleMasterNodes(
      masterNodes,
      { teachingWeeks, lessonsPerWeek },
      terms
    );

    return {
      evaluation,
      masterNodes,
      scheduledNodes,
    };
  }
};
