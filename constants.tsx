import React from 'react';
import { ContentType, QuestionType } from './types.ts';

export const GRADES = [
  'Play Group',
  'PP1',
  'PP2',
  ...Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`)
];

export const SUBJECTS_BY_GRADE: { [key: string]: string[] } = {
  // Pre-Primary
  'Play Group': ['Creative Activities', 'Environmental Activities', 'Language Activities', 'Mathematics Activities', 'Religious Activities'],
  'PP1': ['Creative Activities', 'Environmental Activities', 'Language Activities', 'Mathematics Activities', 'Religious Activities'],
  'PP2': ['Creative Activities', 'Environmental Activities', 'Language Activities', 'Mathematics Activities', 'Religious Activities'],
  
  // Lower Primary: Grades 1-3
  'Grade 1': ['Creative Activities', 'Environmental', 'English', 'Mathematics', 'CRE', 'Kiswahili'],
  'Grade 2': ['Creative Activities', 'Environmental', 'English', 'Mathematics', 'CRE', 'Kiswahili'],
  'Grade 3': ['Creative Activities', 'Environmental', 'English', 'Mathematics', 'CRE', 'Kiswahili'],
  
  // Upper Primary: Grades 4-6
  'Grade 4': ['English', 'Kiswahili', 'Agriculture and Nutrition', 'Science & Technology', 'Mathematics', 'Christian Religious Education (CRE)', 'Creative Arts and Sports', 'Social Studies'],
  'Grade 5': ['English', 'Kiswahili', 'Agriculture and Nutrition', 'Science & Technology', 'Mathematics', 'Christian Religious Education (CRE)', 'Creative Arts and Sports', 'Social Studies'],
  'Grade 6': ['English', 'Kiswahili', 'Agriculture and Nutrition', 'Science & Technology', 'Mathematics', 'Christian Religious Education (CRE)', 'Creative Arts and Sports', 'Social Studies'],
  
  // Junior School: Grades 7-9
  'Grade 7': ['Mathematics', 'English', 'Kiswahili', 'Integrated Science', 'Social Studies', 'Creative Arts and Sports', 'Agriculture and Nutrition', 'Pre-Technical Studies', 'Christian Religious Education (CRE)'],
  'Grade 8': ['Mathematics', 'English', 'Kiswahili', 'Integrated Science', 'Social Studies', 'Creative Arts and Sports', 'Agriculture and Nutrition', 'Pre-Technical Studies', 'Christian Religious Education (CRE)'],
  'Grade 9': ['Mathematics', 'English', 'Kiswahili', 'Integrated Science', 'Social Studies', 'Creative Arts and Sports', 'Agriculture and Nutrition', 'Pre-Technical Studies', 'Christian Religious Education (CRE)'],
  
  // Senior School: A combined list for pathways.
  'Grade 10': ['English', 'Kiswahili', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'History and Citizenship', 'Geography', 'Christian Religious Education (CRE)', 'Business Studies', 'Agriculture', 'Computer Science', 'Music', 'Visual Arts', 'Physical Education and Sports', 'General Science', 'Pre-Technical Studies', 'Literature in English'],
  'Grade 11': ['English', 'Kiswahili', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'History and Citizenship', 'Geography', 'Christian Religious Education (CRE)', 'Business Studies', 'Agriculture', 'Computer Science', 'Music', 'Visual Arts', 'Physical Education and Sports', 'General Science', 'Pre-Technical Studies', 'Literature in English'],
  'Grade 12': ['English', 'Kiswahili', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'History and Citizenship', 'Geography', 'Christian Religious Education (CRE)', 'Business Studies', 'Agriculture', 'Computer Science', 'Music', 'Visual Arts', 'Physical Education and Sports', 'General Science', 'Pre-Technical Studies', 'Literature in English'],
};

export const CONTENT_TYPES: ContentType[] = [
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

export const ASSESSMENT_QUESTION_TYPES: QuestionType[] = [
  QuestionType.MultipleChoice,
  QuestionType.ShortAnswer,
  QuestionType.TrueFalse,
  QuestionType.Essay,
  QuestionType.Discussion,
];

export const ICONS = {
    word: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 01-1-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>,
    pdf: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm7 0a1 1 0 00-1-1H7a1 1 0 00-1 1v2a1 1 0 001 1h3a1 1 0 001-1V4z" clipRule="evenodd" /></svg>,
    excel: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1-1H3a1 1 0 01-1-1V3zm3 2v2h10V5H5zm0 4v2h4v-2H5zm0 4v2h4v-2H5zm6-4v2h4v-2h-4zm0 4v2h4v-2h-4z" /></svg>,
    // Fix: Added icons for CSV and PowerPoint to support new export buttons.
    csv: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V7zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" clipRule="evenodd" /></svg>,
    powerpoint: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a2 2 0 012-2h10a2 2 0 012 2v7h-2V5H5v10h4v2H5a2 2 0 01-2-2V3zm14.707 9.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 15H9a1 1 0 110-2h5.586l-2.293-2.293a1 1 0 011.414-1.414l4 4z" clipRule="evenodd" /></svg>,
    moodle: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>,
};

// A placeholder SVG data URL to use when image generation fails, themed for the app.
export const FAILED_IMAGE_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyBjbGFzcz0iZmFpbGVkLWltYWdlLXBsYWNlaG9sZGVyIiB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2aWV3Qm94PSIwIDAgNDAwIDMwMCI+PHJlY3QgZmlsbD0iIzFlMjkzYiIgd2lkdGg9IjQwMCIgaGVpZGh0PSIzMDAiLz48dGV4dCBmaWxsPSIjOTRhM3I4IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZHk9IjEwLjUiIGZvbnQtd2VpZGh0PSJib2xkIiB4PSI1MCUiIHk9IjUwJSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+SW1hZ2UgR2VuZXJhdGlvbiBGYWlsZWQ8L3RleHQ+PC9zdmc+';

// A valid, complete base64 string for a 1x1 transparent PNG.
export const SCHOOL_LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export const SPECIAL_CALENDAR_EVENTS: { [key: number]: string } = {
  8: 'Mid-Term Break',
  14: 'End-Term Assessment',
  15: 'Holiday / School Closure',
};
