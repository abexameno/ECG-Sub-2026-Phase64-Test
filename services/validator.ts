// services/validator.ts

export interface ValidationRule {
    name: string;
    description: string;
    check: (content: string) => { valid: boolean; message: string };
}

export const curriculumValidationRules: ValidationRule[] = [
    {
        name: 'Syntactic Markers',
        description: 'Checks for Term, Week, Strand, Sub-Strand headers',
        check: (content: string) => {
            const markers = ['--- Term 1 ---', 'Week', 'Lesson', 'Strand:', 'Sub-Strand:'];
            const missing = markers.filter(marker => !content.includes(marker));
            if (missing.length > 0) {
                return { valid: false, message: `Missing required markers: ${missing.join(', ')}` };
            }
            return { valid: true, message: 'All structural markers present.' };
        }
    },
    {
        name: 'Lesson Format',
        description: 'Checks for bulleted lesson entries',
        check: (content: string) => {
            const lines = content.split('\n');
            const lessonLines = lines.filter(line => line.trim().startsWith('- Lesson'));
            if (lessonLines.length === 0) {
                return { valid: false, message: 'No lesson entries found (- Lesson).' };
            }
            return { valid: true, message: `${lessonLines.length} lessons detected.` };
        }
    }
];

export const validateContent = (content: string) => {
    const results = curriculumValidationRules.map(rule => ({
        ...rule,
        ...rule.check(content)
    }));

    const validCount = results.filter(r => r.valid).length;
    const score = Math.round((validCount / results.length) * 100);

    return {
        score,
        results
    };
};
