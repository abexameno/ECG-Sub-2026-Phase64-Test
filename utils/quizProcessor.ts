
import { RawMCQ, GeneratedQuestion, QuestionType, GeneratedContent, ContentType, AssessmentExportType } from '../types.ts';

const optionWeights = [
  { option: 'A', weight: 26 },
  { option: 'B', weight: 28 },
  { option: 'C', weight: 24 },
  { option: 'D', weight: 22 },
];

const weightedOptions: ('A' | 'B' | 'C' | 'D')[] = [];
optionWeights.forEach(({ option, weight }) => {
  for (let i = 0; i < weight; i++) {
    weightedOptions.push(option as 'A' | 'B' | 'C' | 'D');
  }
});

function shuffleArray<T,>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function processMCQ(rawMcq: RawMCQ, marks?: number): GeneratedQuestion {
  const correctOption = weightedOptions[Math.floor(Math.random() * weightedOptions.length)];
  const finalOptions: { [key: string]: string } = {};
  const cleanText = (text: string) => (text || '').replace(/^\s*([a-zA-Z0-9]{1,2})\s*[.)]\s*/, '').trim();
  const cleanedCorrectAnswer = cleanText(rawMcq.correctAnswer);
  
  const initialDistractors = Array.isArray(rawMcq.distractors) ? rawMcq.distractors : [];
  const plausibleDistractors = [
    ...new Set(
      initialDistractors
        .map(cleanText)
        .filter(d => d && d.toLowerCase() !== cleanedCorrectAnswer.toLowerCase())
    )
  ];

  finalOptions[correctOption] = cleanedCorrectAnswer;
  const shuffledDistractors = shuffleArray(plausibleDistractors);
  
  const optionLetters: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
  let distractorIndex = 0;
  for (const letter of optionLetters) {
    if (!finalOptions[letter]) {
      finalOptions[letter] = shuffledDistractors[distractorIndex] || `[Additional option needed]`;
      distractorIndex++;
    }
  }

  return {
    id: `gen_q_${Date.now()}_${Math.random()}`,
    questionText: rawMcq.questionText,
    questionType: QuestionType.MultipleChoice,
    options: [finalOptions['A'], finalOptions['B'], finalOptions['C'], finalOptions['D']],
    correctOption: correctOption,
    correctAnswer: `${correctOption} - ${cleanedCorrectAnswer}`,
    explanation: rawMcq.explanation,
    imageDescription: rawMcq.imageDescription,
    marks: marks !== undefined ? marks : 1,
  };
}

export function getDocumentTitle(content: GeneratedContent, assessmentExportType?: AssessmentExportType): string {
    if (!content.metadata) return content.title;
    const { grade, subject, contentType, topic, term } = content.metadata;
    let exportTypeString = '';
    if (content.questions && content.questions.length > 0 && assessmentExportType) {
        exportTypeString = assessmentExportType === AssessmentExportType.QuestionsOnly ? 'Students Copy' : 'Teachers Marking Guide';
    }
    return `${grade} - ${subject} - ${contentType} : ${topic} ${exportTypeString}`.trim();
}