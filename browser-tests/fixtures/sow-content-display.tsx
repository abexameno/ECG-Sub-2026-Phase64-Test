import React from 'react';
import '../../index.css';
import { createRoot } from 'react-dom/client';
import { ContentDisplay } from '../../components/ContentDisplay.tsx';
import { ContentType } from '../../types/content.ts';

declare global {
  interface Window {
    __sowActionCalls?: Array<{ type: string; week: string; lesson: string }>;
  }
}

window.__sowActionCalls = [];

const content = {
  id: 'browser-sow-fixture',
  title: 'Grade 7 Social Studies Scheme of Work',
  questions: [],
  metadata: {
    grade: 'Grade 7',
    subject: 'Social Studies',
    topic: 'Term 1',
    contentType: ContentType.SchemeOfWork,
  },
  schemeOfWorkData: {
    grade: 'Grade 7',
    subject: 'Social Studies',
    term: 'Term 1',
    teacher: 'Browser Test',
    entries: [
      {
        id: 'lesson-2-1', week: '2', lesson: '1', strand: 'People and Relationships',
        subStrand: 'Human Origin', learningOutcomes: 'Knowledge: Describe theories of human origin.',
        inquiryQuestions: 'What are the theories of human origin?',
        learningExperiences: 'Learners discuss scientific and religious explanations.',
        learningResources: 'Learner book; charts', assessment: 'Oral questions', remarks: 'First lesson sentinel',
      },
      {
        id: 'lesson-2-2', week: '2', lesson: '2', strand: 'People and Relationships',
        subStrand: 'Human Origin', learningOutcomes: 'Explain stages of human evolution.',
        inquiryQuestions: 'How did humans evolve?',
        learningExperiences: 'Learners interpret a timeline.',
        learningResources: 'Timeline; textbook', assessment: 'Observation', remarks: 'FINAL RIGHTMOST COLUMN SENTINEL',
      },
    ],
  },
} as any;

const recordAction = (type: string, entry: any) => {
  window.__sowActionCalls?.push({ type, week: entry.week, lesson: entry.lesson });
};

const root = createRoot(document.getElementById('root')!);
root.render(
  <ContentDisplay
    content={content}
    exportHeaderInfo={{} as any}
    setExportHeaderInfo={() => undefined}
    assessmentExportType={'standard' as any}
    setAssessmentExportType={() => undefined}
    onGenerateResourceFromSOW={(_type, _data, entry) => recordAction('resource', entry)}
    onGenerateAssessmentFromSOW={(_data, entry) => recordAction('assessment', entry)}
    onContentUpdate={() => undefined}
  />
);
