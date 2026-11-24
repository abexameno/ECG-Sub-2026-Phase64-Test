import { GeneratedContent } from '../types.ts';

/**
 * Removes large base64 image data from a GeneratedContent object before storage
 * to prevent exceeding localStorage quota. This function creates a deep-enough copy
 * to avoid mutating the original state object.
 */
export const stripImageData = (content: GeneratedContent): GeneratedContent => {
    if (!content) {
        return content;
    }

    // Create a new object, spreading the original content.
    const newContent = { ...content };

    // If there's a body, remove embedded base64 images to save space.
    if (newContent.body) {
        // This regex finds markdown images with data URIs and replaces their data with a placeholder.
        const imageRegex = /!\[(.*?)\]\((data:image\/(?:jpeg|png|gif|svg\+xml);base64,.*?)\)/g;
        newContent.body = newContent.body.replace(imageRegex, '![$1]([Image data removed for storage])');
    }

    // If there are questions, map over them and remove imageUrl from each.
    if (newContent.questions && Array.isArray(newContent.questions)) {
        newContent.questions = newContent.questions.map(question => {
            // If the question has an imageUrl, create a new question object without it.
            if ('imageUrl' in question) {
                const { imageUrl, ...restOfQuestion } = question;
                return restOfQuestion;
            }
            return question;
        });
    }

    return newContent;
};