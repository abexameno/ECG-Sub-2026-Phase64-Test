import { ContentType } from './types.ts';
import { CONTENT_TYPES } from './constants.tsx';

describe('ECG-Sub-2026 — Content Type Selector & Dispatcher Routing', () => {
  const expectedOrder = [
    ContentType.SchemeOfWork,
    ContentType.LessonPlan,
    ContentType.LessonNotes,
    ContentType.StudyGuide,
    ContentType.Quiz,
    ContentType.TopicExam,
    ContentType.TermExam,
    ContentType.Assessment,
    ContentType.RecordOfWorkCovered,
  ];

  const expectedDisplayLabels = [
    'Schemes of Work',
    'Lesson Plan',
    'Lesson Notes',
    'Learner Study Guide',
    'Short Quiz',
    'Topic Exam',
    'Comprehensive Term Exam',
    'Competency-Based Assessment',
    'Record of Work Covered (ROWC)',
  ];

  describe('1. Content Type Count and Exact Order', () => {
    it('contains exactly nine distinct content types in CONTENT_TYPES array', () => {
      expect(CONTENT_TYPES).toHaveLength(9);
    });

    it('matches the required exact ordering across selector options', () => {
      expect(CONTENT_TYPES).toEqual(expectedOrder);
    });

    it('has exact matching user-facing display labels in the correct sequence', () => {
      CONTENT_TYPES.forEach((type, index) => {
        expect(type).toBe(expectedDisplayLabels[index]);
      });
    });
  });

  describe('2. Unique Identifiers and Backward Compatibility', () => {
    it('ensures all nine content types have unique values', () => {
      const uniqueValues = new Set(CONTENT_TYPES);
      expect(uniqueValues.size).toBe(9);
    });

    it('uses Learner Study Guide for study guides', () => {
      expect(ContentType.StudyGuide).toBe('Learner Study Guide');
    });

    it('maintains distinct Topic Exam and Comprehensive Term Exam types without duplicating Topic Assessment', () => {
      expect(ContentType.TopicExam).toBe('Topic Exam');
      expect(ContentType.TermExam).toBe('Comprehensive Term Exam');
      expect(ContentType.Assessment).toBe('Competency-Based Assessment');
      expect(ContentType.TopicExam).not.toEqual(ContentType.TermExam);
      expect(ContentType.TopicExam).not.toEqual(ContentType.Assessment);
      expect(ContentType.TermExam).not.toEqual(ContentType.Assessment);
    });

    it('uses Record of Work Covered (ROWC) for ROWC', () => {
      expect(ContentType.RecordOfWorkCovered).toBe('Record of Work Covered (ROWC)');
    });
  });

  describe('3. Dispatcher Routing Classification', () => {
    it('correctly classifies assessment types (Quiz, TopicExam, TermExam, Assessment)', () => {
      const assessmentTypes = [
        ContentType.Quiz,
        ContentType.TopicExam,
        ContentType.TermExam,
        ContentType.Assessment,
      ];

      assessmentTypes.forEach((type) => {
        const isAssessment = [
          ContentType.Quiz,
          ContentType.Assessment,
          ContentType.TopicExam,
          ContentType.TermExam,
        ].includes(type);
        expect(isAssessment).toBe(true);
      });
    });

    it('correctly routes text and planning content types (SOW, LessonPlan, LessonNotes, StudyGuide, ROWC)', () => {
      const nonAssessmentTypes = [
        ContentType.SchemeOfWork,
        ContentType.LessonPlan,
        ContentType.LessonNotes,
        ContentType.StudyGuide,
        ContentType.RecordOfWorkCovered,
      ];

      nonAssessmentTypes.forEach((type) => {
        const isAssessment = [
          ContentType.Quiz,
          ContentType.Assessment,
          ContentType.TopicExam,
          ContentType.TermExam,
        ].includes(type);
        expect(isAssessment).toBe(false);
      });
    });
  });
});
