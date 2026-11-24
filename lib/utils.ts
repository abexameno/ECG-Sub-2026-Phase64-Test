import { GeneratedContent, GeneratedQuestion } from '../types';

export const cleanGeneratedContent = (content: GeneratedContent): GeneratedContent => {
    if (!content.questions) return content;

    const uniqueQuestions: GeneratedQuestion[] = [];
    const questionMap = new Map<string, GeneratedQuestion>();

    for (const q of content.questions) {
        // Normalize text
        const normalizedText = q.questionText.trim().toLowerCase().replace(/\s+/g, ' ');
        
        if (!questionMap.has(normalizedText)) {
            questionMap.set(normalizedText, {
                ...q,
                questionText: q.questionText.trim(),
                correctAnswer: q.correctAnswer.trim(),
                options: q.options?.map(o => o.trim())
            });
            uniqueQuestions.push(q);
        }
    }

    return {
        ...content,
        questions: uniqueQuestions
    };
};
