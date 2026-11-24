


import { GoogleGenAI, Type } from "@google/genai";
import { FormState, ContentType, GeneratedContent, QuestionType, RawMCQ, GeneratedQuestion, RawQuestion, SchemeOfWorkData, ROWCFormData, RawShortAnswer, RawTrueFalse, RawEssay, RawDiscussion, SchemeOfWorkEntry, AISuggestionType, CanonicalSowNode } from '../types.ts';
import { processMCQ, getDocumentTitle } from '../utils/quizProcessor.ts';
import { LESSON_BREAKDOWNS } from '../data/curriculum/index.ts';
import { SchoolConfigService } from './schoolConfigService.ts';
import { AcademicOperationsService } from './academicOperationsService.ts';
import { CanonicalCurriculumService } from './canonicalCurriculumService.ts';
import { SowSchedulingService } from './sowSchedulingService.ts';
import { getCurriculumByTerm, getCurriculumTextByTerm, getLessonsToGenerate } from '../curriculumData.ts';
import { SPECIAL_CALENDAR_EVENTS } from '../constants.tsx';
import { auth } from '../firebase';

const FAILED_IMAGE_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyBjbGFzcz0iZmFpbGVkLWltYWdlLXBsYWNlaG9sZGVyIiB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2aWV3Qm94PSIwIDAgNDAwIDMwMCI+PHJlY3QgZmlsbD0iIzFlMjkzYiIgd2lkdGg9IjQwMCIgaGVpZGh0PSIzMDAiLz48dGV4dCBmaWxsPSIjOTRhM3I4IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZHk9IjEwLjUiIGZvbnQtd2VpZGh0PSJib2xkIiB4PSI1MCUiIHk9IjUwJSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+SW1hZ2UgR2VuZXJhdGlvbiBGYWlsZWQ8L3RleHQ+PC9zdmc+';

const PRO_MODEL = 'gemini-3.8-flash';
const FLASH_MODEL = 'gemini-3.8-flash';
const IMAGE_FLASH = 'gemini-3.1-flash-lite-image';
const IMAGE_PRO = 'gemini-3.1-flash-lite-image';

const SOW_EXPECTED_WEEKS = 13;
const SOW_LESSONS_PER_WEEK = 5;
async function aiClientProxy(payload: {
  prompt: any;
  model?: string;
  config?: any;
  contentType?: string;
  operationId?: string;
  totalChunks?: number;
}) {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
      let errBody = '';
      try {
          const errJson = await response.json();
          errBody = errJson?.error || errJson?.message || JSON.stringify(errJson);
      } catch (e) {
          try {
              errBody = await response.text();
          } catch (e2) {}
      }
      if (response.status === 429 || (typeof errBody === 'string' && (errBody.includes('429') || errBody.includes('prepayment credits') || errBody.includes('quota')))) {
          throw new Error(`Generation API Error (429): Your Gemini API credits are depleted. Please visit the Google AI Studio billing page (https://aistudio.google.com/app/billing) to add credits or check your quota.`);
      }
      throw new Error(`Generation API Error (${response.status}): ${errBody || 'The backend returned an error code. If it persists, try reducing document size or retry.'}`);
  }

  let data;
  try {
      data = await response.json();
  } catch (err) {
      throw new Error(`Invalid response from Generation API. The backend may be offline or timing out.\nRaw response could not be parsed.`);
  }
  
  const result = data.result;
  
  // Extract text if available to mirror SDK structure
  if (result && result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts) {
      const textPart = result.candidates[0].content.parts.find((p: any) => p.text);
      if (textPart) {
          result.text = textPart.text;
      }
  }
  
  return result;
}


const isKiswahili = (subject: string) => subject && subject.toLowerCase().includes('kiswahili');

export async function generateImage(prompt: string, subject: string, metadata: { grade: string }, isForQuestion: boolean = false, imageSize: '1K' | '2K' | '4K' = '1K', aspectRatio?: string): Promise<string> {
    try {
        const token = await auth.currentUser?.getIdToken();
        const response = await fetch('/api/illustrations/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                prompt: prompt + (isForQuestion ? " (This is a visual aid for an assessment. CRITICAL: 1. Keep the diagram extremely simple and minimal. 2. DO NOT include any text, names, formulas, or answers in the diagram. 3. If labels are necessary, use ONLY generic letters (A, B, C). 4. Use a flat 2D vector style on a plain white background.)" : ""),
                subject: subject,
                grade: metadata.grade,
                topic: "General Educational Vector Diagram"
            }),
        });

        if (!response.ok) {
            throw new Error(`Illustration API Error (${response.status})`);
        }

        let data;
        try {
            data = await response.json();
        } catch(e) {
            throw new Error("Invalid response received from Illustration API.");
        }
        
        if (data && data.illustration_svg) {
            // Remove markdown format that might be returned accidentally
            let svgStr = data.illustration_svg;
            svgStr = svgStr.replace(/```xml/g, "").replace(/```svg/g, "").replace(/```html/g, "").replace(/```/g, "").trim();
            
            // Encode SVG to base64 string
            const base64Svg = btoa(unescape(encodeURIComponent(svgStr)));
            return `data:image/svg+xml;base64,${base64Svg}`;
        }
        throw new Error("No SVG data found in response.");

    } catch (error: any) {
        console.error(`Vector image generation failed:`, error);
        
        if (error.message?.includes("Requested entity was not found.") && typeof window !== 'undefined' && (window as any).aistudio) {
             (window as any).aistudio.openSelectKey();
        }
        return FAILED_IMAGE_PLACEHOLDER;
    }
}

export async function generateSingleImageForQuestion(
  q: GeneratedQuestion,
  metadata: { grade: string; subject: string },
  imageSize: '1K' | '2K' | '4K' = '1K'
): Promise<{ imageUrl: string; imageDescription: string }> {
  const description = q.imageDescription || q.questionText;
  if (!description) return { imageUrl: '', imageDescription: '' };
  const imageUrl = await generateImage(description, metadata.subject, { grade: metadata.grade }, true, imageSize);
  return { imageUrl, imageDescription: description };
}

function processShortAnswer(raw: RawShortAnswer, marks?: number): GeneratedQuestion {
    return {
        id: `gen_q_${Date.now()}_${Math.random()}`,
        questionText: raw.questionText,
        questionType: QuestionType.ShortAnswer,
        correctAnswer: raw.correctAnswer,
        explanation: raw.explanation,
        imageDescription: raw.imageDescription,
        requiresImage: raw.imageRequired,
        marks: marks !== undefined ? marks : 2,
    };
}

function processTrueFalse(raw: RawTrueFalse, marks?: number): GeneratedQuestion {
    return {
        id: `gen_q_${Date.now()}_${Math.random()}`,
        questionText: raw.questionText,
        questionType: QuestionType.TrueFalse,
        correctAnswer: raw.correctAnswer,
        explanation: raw.explanation,
        imageDescription: raw.imageDescription,
        requiresImage: raw.imageRequired,
        marks: marks !== undefined ? marks : 1,
    };
}

function processEssay(raw: RawEssay, marks?: number): GeneratedQuestion {
    return {
        id: `gen_q_${Date.now()}_${Math.random()}`,
        questionText: raw.questionText,
        questionType: QuestionType.Essay,
        correctAnswer: raw.correctAnswer,
        explanation: raw.explanation,
        imageDescription: raw.imageDescription,
        requiresImage: raw.imageRequired,
        marks: marks !== undefined ? marks : 0,
    };
}

function processDiscussion(raw: RawDiscussion, marks?: number): GeneratedQuestion {
    return {
        id: `gen_q_${Date.now()}_${Math.random()}`,
        questionText: raw.questionText,
        questionType: QuestionType.Discussion,
        correctAnswer: raw.correctAnswer,
        explanation: raw.explanation,
        imageDescription: raw.imageDescription,
        requiresImage: raw.imageRequired,
        marks: marks !== undefined ? marks : 0,
    };
}

export const getCurriculumContext = (grade: string, subject: string, terms?: string[], weeks?: string[], strand?: string, subStrand?: string): string => {
    const filtered = getLessonsToGenerate({ grade, subject, terms, weeks, strand, subStrand });
    if (filtered) return filtered;

    const normalizedSubject = (subject || '').toUpperCase()
        .replace(/ & /g, '_')
        .replace(/\s/g, '_')
        .replace('PRE-TECHNICAL_STUDIES', 'PRE-TECHNICAL_STUDIES');

    const key = `${(grade || '').toUpperCase().replace(' ', '_')}_${normalizedSubject}_LESSON_BREAKDOWN`;
    return LESSON_BREAKDOWNS[key] || '';
};

async function generateAssessment(formState: FormState, systemInstruction: string, onProgress?: (progress: number) => void): Promise<GeneratedContent> {
    const { grade, subject, topic, contentType, questionCounts, totalQuestions, distributionMode, difficulty, documentText, documentImageBase64, documentImageMimeType, markingSchemeText, imageSize, additionalInformation, additionalInstructions } = formState;

    if (onProgress) onProgress(10);

    let assessmentPurpose = '';
    switch (contentType) {
        case ContentType.Quiz:
            assessmentPurpose = 'This is a quick, formative quiz (5-10 questions) to check for understanding of a specific sub-topic. Focus primarily on "Recall" and "Application" levels of Bloom\'s Taxonomy.';
            break;
        case ContentType.Assessment:
            assessmentPurpose = 'This is a standard assessment. Include a balanced mix of question difficulties and types, covering the key learning objectives of the topic.';
            break;
        case ContentType.TopicExam:
            assessmentPurpose = 'This is a summative Topic Exam. The questions must be comprehensive, covering all major learning outcomes of the entire topic. Ensure a high level of rigor and include multi-step problems or synthesis-level questions.';
            break;
        case ContentType.TermExam:
            assessmentPurpose = 'This is a comprehensive, summative Term Exam covering multiple topics from the term. The scope is broad and must test for deep understanding and application of knowledge across different areas. Ensure maximum rigor and complexity appropriate for a final term assessment.';
            break;
    }

    let prompt = `You are an expert assessment designer for the Kenyan Competency-Based Curriculum (CBC). Your task is to architect a high-quality ${contentType}.

    **ASSESSMENT BLUEPRINT**
    - **Grade Level:** ${grade}
    - **Subject:** ${subject}
    - **Core Topic/Scope:** "${topic}"
    - **Assessment Type & Purpose:** ${contentType}. ${assessmentPurpose}
    - **Target Difficulty:** ${difficulty}

    **PEDAGOGICAL FRAMEWORK & CONSTRAINTS**
    1.  **Curriculum Alignment:** All questions must strictly align with Kenyan CBC standards for the specified grade and subject.
    2.  **Contextual Relevance:** Integrate Kenyan names, locations, scenarios, and cultural contexts to make questions relatable for learners.
    3.  **Clarity & Precision:** Questions must be unambiguously worded, grammatically perfect, and free from any potential for multiple interpretations.
    4.  **Bloom's Taxonomy Integration:** The difficulty of questions must be intentionally varied, ranging from Lower-Order Thinking Skills (LOTS) like "Remembering" and "Understanding" to Higher-Order Thinking Skills (HOTS) like "Analyzing," "Evaluating," and "Creating," based on the '${difficulty}' setting. Explicitly label each question with its corresponding Bloom's level (e.g., 'bloomsTaxonomyLevel: "Application"').
    5.  **Distractor Quality (for MCQs):** All distractors must be plausible, based on common student misconceptions, and homogenous in structure. Avoid obviously incorrect options.
    6.  **Instructional Explanations:** For every question, provide a clear, detailed explanation for the correct answer. This should not just state the answer but also explain the underlying concept to facilitate learning and self-correction.
    7.  **Visual Aid Prompts (CRITICAL):** 
        -   If a question **REQUIRES** a visual aid (diagram, map, chart) to be solvable, you MUST set the flag 'imageRequired' to true.
        -   Provide a concise, detailed prompt in the 'imageDescription' field describing exactly what should be drawn. 
        -   Example: "A diagram of a flower labeled A, B, C, D where B points to the anther."
        -   Ensure pedagogical correctness.
    `;
    
    if (formState.sowLessonContext) {
        prompt += `\n\n${buildSowLessonScopePrompt(formState.sowLessonContext, contentType)}
**ASSESSMENT SCOPE LOCK:** Generate questions only for this selected SOW lesson and its stated learning outcomes. Do not assess other lessons, weeks, strands, or sub-strands. Use supplied experiences, resources, inquiry questions, and assessment method only where relevant to the selected outcomes.\n`;
    }

    if (isKiswahili(subject)) {
        prompt += `\n**LANGUAGE MANDATE (CRITICAL):**
        - This is a Kiswahili subject.
        - All generated text (Questions, Options, Answers, Explanations) MUST be in **KISWAHILI ONLY**.
        - Do NOT mix English and Kiswahili (Code-switching) unless referring to a specific book title or technical term that lacks a Kiswahili equivalent.
        - Ensure the Kiswahili used is grade-appropriate and grammatically correct (Sanifu).
        `;
    }

    if (additionalInformation) prompt += `\n**Teacher Context/Notes:**\n${additionalInformation}\n`;
    if (additionalInstructions) prompt += `\n**Additional AI Instructions:**\n${additionalInstructions}\n`;

    if (distributionMode === 'manual') {
        prompt += `\n**SPECIFIC QUESTION COUNTS REQUESTED:**\n`;
        Object.entries(questionCounts).forEach(([type, count]) => {
            if (count && count > 0) prompt += `- ${count} ${type} questions\n`;
        });
    } else {
        prompt += `\n**TARGET QUESTION COUNT:** ${totalQuestions} questions with a pedagogically sound distribution of types.\n`;
    }

    if (documentText) prompt += `\n**SOURCE TEXT (STRICT ADHERENCE):** Use the following content as the SOLE knowledge base for these questions:\n---\n${documentText}\n---\n`;
    if (markingSchemeText) prompt += `\n**ANSWER KEY OVERRIDE:** Ensure all answers align with this marking guide:\n---\n${markingSchemeText}\n---\n`;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            questions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        questionType: { type: Type.STRING, enum: Object.values(QuestionType) },
                        questionText: { type: Type.STRING },
                        imageDescription: { type: Type.STRING },
                        imageRequired: { type: Type.BOOLEAN },
                        correctAnswer: { type: Type.STRING },
                        distractors: { type: Type.ARRAY, items: { type: Type.STRING } },
                        explanation: { type: Type.STRING },
                        bloomsTaxonomyLevel: { type: Type.STRING }
                    },
                    required: ["questionType", "questionText", "correctAnswer", "explanation"]
                }
            }
        },
        required: ["questions"]
    };

    const parts: any[] = [{ text: prompt }];
    let model = PRO_MODEL;

    if (documentImageBase64 && documentImageMimeType) {
        parts.push({ text: "\nAnalyze this source image for question generation:" });
        parts.push({ inlineData: { mimeType: documentImageMimeType, data: documentImageBase64 } });
        model = FLASH_MODEL; 
    }

    const result = await aiClientProxy({
        model,
        prompt: { parts },
        contentType,
        config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: responseSchema,
        },
    });

    if (onProgress) onProgress(60);

    let responseJson: any = {};
    if (result.text) {
        try {
            responseJson = JSON.parse(result.text);
        } catch (e) {
            console.warn("Failed to parse JSON directly from gen output, falling back. Raw TEXT:", result.text.substring(0, 50));
            responseJson = { questions: [] };
        }
    }
    const questions: GeneratedQuestion[] = (responseJson.questions || [])
        .map((raw: RawQuestion) => {
            let processedQ: GeneratedQuestion | null = null;
            switch (raw.questionType) {
                case QuestionType.MultipleChoice:
                    processedQ = processMCQ(raw as RawMCQ, formState.questionMarks?.[QuestionType.MultipleChoice]);
                    // Pass through image props
                    processedQ.requiresImage = (raw as any).imageRequired;
                    processedQ.imageDescription = (raw as any).imageDescription;
                    break;
                case QuestionType.ShortAnswer:
                    processedQ = processShortAnswer(raw as RawShortAnswer, formState.questionMarks?.[QuestionType.ShortAnswer]);
                    break;
                case QuestionType.TrueFalse:
                    processedQ = processTrueFalse(raw as RawTrueFalse, formState.questionMarks?.[QuestionType.TrueFalse]);
                    break;
                case QuestionType.Essay:
                    processedQ = processEssay(raw as RawEssay, formState.questionMarks?.[QuestionType.Essay]);
                    break;
                case QuestionType.Discussion:
                    processedQ = processDiscussion(raw as RawDiscussion, formState.questionMarks?.[QuestionType.Discussion]);
                    break;
                default:
                    console.warn('Unknown question type from AI:', raw.questionType);
                    return null;
            }
            return processedQ;
        })
        .filter((q: GeneratedQuestion | null): q is GeneratedQuestion => q !== null);

    // Filter questions that need images
    const questionsNeedingImages = questions.filter(q => q.requiresImage && q.imageDescription);

    const newContent: GeneratedContent = {
        id: `gen_${Date.now()}`,
        title: getDocumentTitle({ metadata: { grade, subject, contentType, topic } } as GeneratedContent),
        questions,
        metadata: { grade, subject, contentType, topic, imageSize },
    };

    return newContent;
}

export async function validateAndRepairSow(
    sowData: SchemeOfWorkData,
    formState: FormState,
    systemInstruction: string,
    responseSchema: any,
    canonicalNodes: CanonicalSowNode[]
): Promise<SchemeOfWorkData> {
    const rawMap: Map<string, SchemeOfWorkEntry> = new Map();
    (sowData.entries || []).forEach(entry => {
        const weekStr = String(entry.week).replace(/\\D/g, '');
        const lessonStr = String(entry.lesson).replace(/\\D/g, '');
        const week = parseInt(weekStr, 10);
        const lesson = parseInt(lessonStr, 10);
        if (!isNaN(week) && !isNaN(lesson)) {
            rawMap.set(`W${week}-L${lesson}`, entry);
        }
    });

    const finalEntries: SchemeOfWorkEntry[] = [];

    for (const node of canonicalNodes) {
        const key = `W${node.week}-L${node.lesson}`;
        const rawEntry = rawMap.get(key);

        if (!rawEntry) {
            throw new Error(`SOW generation incomplete: Gemini did not return Week ${node.week}, Lesson ${node.lesson}. No document was finalized.`);
        }

        const requiredGeneratedFields: Array<keyof SchemeOfWorkEntry> = [
            'learningExperiences',
            'learningResources',
            'assessment'
        ];
        const missingFields = requiredGeneratedFields.filter(field =>
            typeof rawEntry[field] !== 'string' || !(rawEntry[field] as string).trim()
        );
        if (missingFields.length > 0) {
            throw new Error(
                `SOW generation incomplete: Week ${node.week}, Lesson ${node.lesson} is missing ${missingFields.join(', ')}. No generic fallback content was inserted and no document was finalized.`
            );
        }

        const inquiry = (rawEntry.inquiryQuestions && rawEntry.inquiryQuestions.trim())
            ? rawEntry.inquiryQuestions
            : (node.keyInquiryQuestions && node.keyInquiryQuestions.length > 0 ? node.keyInquiryQuestions.join('; ') : '');

        if (!inquiry.trim()) {
            throw new Error(`SOW generation incomplete: Week ${node.week}, Lesson ${node.lesson} has no key inquiry question in the generated response or canonical curriculum source.`);
        }

        finalEntries.push({
            id: `sow-entry-${node.week}-${node.lesson}-${Math.random().toString(36).substring(2, 9)}`,
            week: String(node.week),
            lesson: String(node.lesson),
            strand: node.strandTitle,
            subStrand: node.subStrandTitle,
            learningOutcomes: node.learningOutcomesText,
            inquiryQuestions: inquiry,
            learningExperiences: rawEntry.learningExperiences,
            learningResources: rawEntry.learningResources,
            assessment: rawEntry.assessment,
            remarks: rawEntry.remarks || ''
        });
    }

    return {
        grade: formState.grade,
        subject: formState.subject,
        term: formState.terms?.join(', ') || 'Full Year',
        teacher: sowData.teacher || '',
        entries: finalEntries
    };
}

async function generateSchemeOfWork(formState: FormState, teacherName: string | undefined, systemInstruction: string, onProgress?: (progress: number) => void): Promise<GeneratedContent> {
    const { grade, subject, terms, additionalInformation, additionalInstructions } = formState;
    if (onProgress) onProgress(10);
    const termString = terms?.join(', ') || 'Full Year';
    
    const schoolTeachingConfig = formState.schoolId ? SchoolConfigService.getTeachingConfig(formState.schoolId) : undefined;
    const sowExpectedWeeks = formState.teachingWeeks || schoolTeachingConfig?.teachingWeeksPerTerm || 10;
    const sowLessonsPerWeek = formState.lessonsPerWeek || schoolTeachingConfig?.lessonsPerWeek || 4;
    const teachingConfig = {
        teachingWeeksPerTerm: sowExpectedWeeks,
        lessonsPerWeek: sowLessonsPerWeek
    };

    const requestedTerms = terms && terms.length > 0 ? terms : ['Term 1'];
    
    // Evaluate school capacity against authoritative KICD curriculum requirements
    const capacityEvaluation = SowSchedulingService.evaluateCapacity({
        grade,
        subject,
        terms: requestedTerms,
        teachingWeeks: sowExpectedWeeks,
        lessonsPerWeek: sowLessonsPerWeek
    });

    if (!capacityEvaluation.canGenerate) {
        throw new Error(capacityEvaluation.message);
    }

    const generationEligibility = CanonicalCurriculumService.getGenerationEligibility(grade, subject);
    if (!generationEligibility.allowed) {
        throw new Error(
            `Scheme of Work generation is blocked for ${grade} ${subject}: ${generationEligibility.reason}`
        );
    }

    const canonicalNodes = CanonicalCurriculumService.resolveCanonicalSowNodes(
        grade,
        subject,
        requestedTerms,
        teachingConfig
    );

    const maxCanonicalWeek = canonicalNodes.length > 0
        ? Math.max(...canonicalNodes.map(n => n.week))
        : sowExpectedWeeks * requestedTerms.length;
    const totalExpectedWeeks = Math.max(sowExpectedWeeks * requestedTerms.length, maxCanonicalWeek);
    const targetWeeks = Array.from({length: totalExpectedWeeks}, (_, i) => i + 1);

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            entries: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        week: { type: Type.STRING },
                        lesson: { type: Type.STRING },
                        strand: { type: Type.STRING },
                        subStrand: { type: Type.STRING },
                        learningOutcomes: { type: Type.STRING },
                        inquiryQuestions: { type: Type.STRING },
                        learningExperiences: { type: Type.STRING },
                        learningResources: { type: Type.STRING },
                        assessment: { type: Type.STRING },
                        remarks: { type: Type.STRING }
                    },
                    required: ["week", "lesson", "strand", "subStrand", "learningOutcomes", "inquiryQuestions", "learningExperiences", "learningResources", "assessment", "remarks"]
                }
            }
        },
        required: ["entries"]
    };

    const CHUNK_SIZE = 4;
    const chunkPromises = [];
    const totalChunksCount = Math.max(1, Math.ceil(targetWeeks.length / CHUNK_SIZE));
    const sowOperationId = `sow_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    for (let i = 0; i < targetWeeks.length; i += CHUNK_SIZE) {
        const chunkWeeks = targetWeeks.slice(i, i + CHUNK_SIZE);
        const chunkNodes = canonicalNodes.filter(n => chunkWeeks.includes(n.week));
        
        let prompt = `You are a Master Teacher and Senior Curriculum Developer enriching a Scheme of Work for the Kenyan Competency-Based Curriculum (CBC). The output must be professional, meticulously detailed, and structured exactly as specified below.

        **SCHEME OF WORK BLUEPRINT**
        - **Grade Level:** ${grade}
        - **Subject / Learning Area:** ${subject}
        - **Term(s) Covered:** ${termString}

        **CURRENT GENERATION CHUNK (CRITICAL):**
        Generate content ONLY for the exact canonical lesson nodes listed below. Do not infer a standard number of lessons per week, add missing lesson slots, merge lessons, split lessons, or move content between weeks. The listed nodes are the complete and exclusive schedule for this chunk.

        **LOCKED CANONICAL CURRICULUM NODES (CRITICAL - PRESERVE EXACTLY):**
        ${chunkNodes.map(n => `- Week ${n.week}, Lesson ${n.lesson} | Strand: ${n.strandTitle} | Sub-Strand: ${n.subStrandTitle} | Specific Learning Outcomes (authoritative; preserve meaning and scope): ${n.learningOutcomesText}`).join('\n')}

        **SOURCE-FIDELITY RULES (NON-NEGOTIABLE):**
        - Treat each listed canonical node as a separate lesson. Never combine two or more sub-strands, cooking methods, procedures, or lesson topics into one entry.
        - Do not introduce a related topic, technique, activity, or learning outcome that belongs to another lesson.
        - Keep each lesson's learning experiences, resources, and assessment tightly within that lesson's own strand, sub-strand, and stated learning outcomes.
        - Do not broaden or reinterpret the lesson title/scope to make it more comprehensive. Specificity is more important than elaboration.
        - If the supplied canonical node does not provide enough information to create a required field accurately, return that field as an empty string; validation will block finalization rather than invent content.
        - Return exactly one entry for every listed Week/Lesson pair and no other entries.

        **MANDATORY OUTPUT STRUCTURE & CONTENT REQUIREMENTS:**
        For each lesson entry, provide comprehensive details for the following 10 columns:

        1.  **Wk (Week):** ONLY use the assigned number (e.g., '2', not 'Week 2').
        2.  **Lsn (Lesson):** ONLY use the assigned lesson number within the week (e.g., '1', '2').
        3.  **Strand:** Use the locked canonical strand.
        4.  **Sub-Strand:** Use the locked canonical sub-strand.
        5.  **Specific Learning Outcomes:** Use SMART outcomes under sub-headers: **Knowledge:**, **Skills:**, and **Attitudes:**.
        6.  **Key Inquiry Questions:** Formulate thought-provoking questions.
        7.  **Learning Experiences:** Describe learner-centered activities and practical investigations.
        8.  **Learning Resources:** List specific, practical curriculum resources required.
        9.  **Assessment:** Specify the assessment method (observation, oral questioning, portfolio, practical).
        10. **Remarks:** Leave this field as an empty string ("").
        `;
        
        if (isKiswahili(subject)) {
            prompt += `\n**LANGUAGE MANDATE (CRITICAL):**
            - This is a Kiswahili subject.
            - All content generated inside the JSON fields MUST be in **KISWAHILI ONLY**.`;
        }

        if (additionalInformation) prompt += `\n**Extra Context:**\n${additionalInformation}\n`;
        if (additionalInstructions) prompt += `\n**Additional AI Instructions:**\n${additionalInstructions}\n`;

        chunkPromises.push(aiClientProxy({
            model: PRO_MODEL,
            prompt: prompt,
            contentType: ContentType.SchemeOfWork,
            operationId: sowOperationId,
            totalChunks: totalChunksCount,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: responseSchema
            },
        }));
    }

    let completedChunks = 0;
    const totalChunks = chunkPromises.length;

    const wrappedChunkPromises = chunkPromises.map(p => p.then(res => {
        completedChunks++;
        if (onProgress) {
            const chunkProgress = 10 + Math.floor((completedChunks / totalChunks) * 70);
            onProgress(Math.min(chunkProgress, 80));
        }
        return res;
    }));

    // Await all chunks in parallel
    const chunkResults = await Promise.all(wrappedChunkPromises);
    if (onProgress) onProgress(85);
    const allEntries: SchemeOfWorkEntry[] = [];

    for (const result of chunkResults) {
        try {
            const data = result.text ? JSON.parse(result.text) : {};
            if (data.entries && Array.isArray(data.entries)) {
                allEntries.push(...data.entries);
            }
        } catch (e) {
            console.error("Failed to parse SOW chunk:", e);
        }
    }

    const completeData = await validateAndRepairSow({ entries: allEntries, grade, subject, term: termString, teacher: teacherName || '' }, formState, systemInstruction, responseSchema, canonicalNodes);

    return {
        id: `gen_${Date.now()}`,
        title: `${grade} - ${subject} - Scheme of Work (${termString})`,
        schemeOfWorkData: { ...completeData, grade, subject, term: termString, teacher: teacherName || '' },
        metadata: { schoolId: formState.schoolId || 'lwps', grade, subject, contentType: ContentType.SchemeOfWork, topic: `Scheme for ${termString}`, terms: requestedTerms },
    };
}

async function generateROWC(formState: FormState, systemInstruction: string): Promise<GeneratedContent> {
    const { rowcData, additionalInformation, additionalInstructions } = formState;

    let prompt = `You are a meticulous and reflective Master Teacher tasked with completing a professional Record of Work Covered (ROWC) from raw lesson notes. Your goal is to transform the brief input into a comprehensive, accountability-ready document.

    **TASK:** For each lesson entry provided in the raw JSON data, expand and refine the content according to the following professional standards:

    1.  **Standardize Data:** Ensure all fields like Grade, Subject, Strand, etc., are complete and consistently formatted.
    2.  **Elaborate on Learning Activities:** Based on the raw 'learningActivities' notes, write a clear, descriptive summary of what actually transpired during the lesson. Describe the flow, the methods used (e.g., "group discussion," "practical demonstration," "learners' presentation"), and the nature of student engagement.
    3.  **CRITICAL - Write Reflective Remarks:** The 'remarks' field is the most important. It must be a professional reflection on the lesson's execution. If remarks are already provided in the input, refine them to be more professional and detailed. For each lesson, write a concise remark covering:
        -   **Lesson Outcome:** Was the lesson objective achieved? Was the work covered as planned? (e.g., "Objectives fully met," "Partially covered, will continue next lesson").
        -   **Learner Engagement:** How did the students respond? Mention observations on participation, understanding, or any common misconceptions identified. (e.g., "Learners were highly engaged during the practical activity," "Some students struggled with the concept of...").
        -   **Action/Next Steps:** What is the follow-up plan? Mention any necessary remedial actions, homework assigned, or adjustments for the next lesson. (e.g., "Remedial work planned for struggling learners," "Next lesson will begin with a recap of...").
    4.  **Overall Reflection:** For the top-level 'reflection' field, write a brief, overarching summary of the week's progress, highlighting key achievements, challenges encountered across the lessons, and the general outlook for the following week.

    The final output must be in a structured JSON format, with all fields populated with professional, clear, and reflective content.
    `;
    
    prompt += `\n**LANGUAGE INSTRUCTION:**
    - If a lesson's subject is **Kiswahili**, ensure the 'learningActivities', 'remarks', and any other generated text for that entry is in **KISWAHILI ONLY**.
    - For other subjects, use English.
    `;
    
    if (additionalInformation) prompt += `\n**Extra Context:**\n${additionalInformation}\n`;
    if (additionalInstructions) prompt += `\n**Additional AI Instructions:**\n${additionalInstructions}\n`;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            weekRange: { type: Type.STRING },
            reflection: { type: Type.STRING },
            lessons: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        date: { type: Type.STRING },
                        grade: { type: Type.STRING },
                        subject: { type: Type.STRING },
                        term: { type: Type.STRING },
                        strand: { type: Type.STRING },
                        subStrand: { type: Type.STRING },
                        lessonTitle: { type: Type.STRING },
                        learningActivities: { type: Type.STRING },
                        resources: { type: Type.STRING },
                        assessment: { type: Type.STRING },
                        remarks: { type: Type.STRING }
                    }
                }
            }
        },
        required: ["lessons", "weekRange"]
    };

    const result = await aiClientProxy({
        model: FLASH_MODEL,
        prompt: prompt + "\n**Raw Input Data:** " + JSON.stringify(rowcData?.lessons),
        contentType: ContentType.RecordOfWorkCovered,
        config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: responseSchema
        },
    });

    const completed = result.text ? JSON.parse(result.text) : { lessons: [] };
    return {
        id: `gen_${Date.now()}`,
        title: `ROWC: ${completed.weekRange}`,
        rowcData: completed,
        metadata: { grade: 'Mixed', subject: 'Mixed', topic: `ROWC ${completed.weekRange}`, contentType: ContentType.RecordOfWorkCovered },
    };
}

export function buildSowLessonScopePrompt(context: NonNullable<FormState['sowLessonContext']>, contentType: ContentType): string {
    const fields: Array<[string, string | undefined]> = [
        ['Grade', context.grade], ['Subject', context.subject], ['Term', context.term],
        ['Week', context.week], ['Lesson', context.lesson], ['Strand', context.strand],
        ['Sub-strand', context.subStrand], ['Specific Learning Outcomes', context.learningOutcomes],
        ['Key Inquiry Questions', context.inquiryQuestions], ['Learning Experiences', context.learningExperiences],
        ['Learning Resources', context.learningResources], ['Assessment Methods', context.assessment], ['Remarks', context.remarks],
    ];
    const sourceFields = fields.filter(([, value]) => typeof value === 'string' && value.trim())
        .map(([label, value]) => `- **${label}:** ${value}`).join('\n');
    return `**AUTHORITATIVE SELECTED SOW LESSON — STRICT SCOPE**
Requested resource: ${contentType}
Source SOW: ${context.sowTitle || 'Approved Scheme of Work'}.
Use only this single selected lesson. Do not generate adjacent lessons, other weeks, other sub-strands, or a multi-week series. Preserve grade, subject, term, week, lesson number, strand, sub-strand, and the stated learning outcomes. Treat supplied SOW fields as authoritative. Elaborate only where directly aligned to these outcomes. Do not invent missing curriculum fields or present invented values as source-authored.

${sourceFields}

The output must identify Week ${context.week}, Lesson ${context.lesson}, and remain confined to this lesson.
`;
}

export function buildSowScopedResourcePrompt(
    context: NonNullable<FormState['sowLessonContext']>,
    contentType: ContentType
): string {
    const scope = buildSowLessonScopePrompt(context, contentType);
    if (contentType === ContentType.StudyGuide ||
        (contentType as string) === 'Students Study Guides' ||
        (contentType as string) === 'Learner Study Guide') {
        return `${scope}
# ${context.grade || 'Selected grade'} ${context.subject || 'Selected subject'}: Lesson Study Guide

Create a learner-friendly study guide for this selected lesson only.

## Lesson Summary
Summarise the selected lesson's supplied learning outcomes accurately.

## Key Concepts
Explain only concepts needed to achieve the supplied learning outcomes. Do not introduce content from other lessons or weeks.

## Learning Activities and Examples
Use the supplied learning experiences as the basis for relevant explanations and examples. Clearly distinguish helpful elaboration from source-provided content.

## Practice Questions
Create grade-appropriate questions that assess only the selected lesson's stated learning outcomes.

## Answers
Provide accurate answers to the practice questions.

## Lesson Recap
Reinforce the key learning from this selected lesson only.
`;
    }

    return `${scope}
Create the requested ${contentType} for the selected SOW lesson only.
Use the supplied learning outcomes to define the scope. Elaborate only where directly necessary to support those outcomes.
Do not include adjacent lessons, other weeks, other strands, or a broader topic series.
Do not invent absent source fields or describe generated additions as content copied from the SOW.
`;
}

async function generateTextContent(formState: FormState, systemInstruction: string, teacherName: string = 'Teacher', schoolName: string = 'School'): Promise<GeneratedContent> {
    const { grade, subject, topic, contentType, imageSize, additionalInformation, additionalInstructions } = formState;
    const curriculumContext = getCurriculumContext(grade, subject);
    
    let prompt = "";
    let effectiveSystemInstruction = systemInstruction + `\n\n**IMPORTANT FORMATTING RULE:** Do NOT use ALL CAPS for headings, text, or any UI elements. Use proper, sentence-case or title-case for all text as appropriate.`;

    if (contentType === ContentType.LessonPlan) {
        effectiveSystemInstruction = `You are an expert curriculum developer creating a professional, audit-ready Lesson Plan for the Kenyan Competency-Based Curriculum (CBC). The output must be meticulously detailed, instructionally sound, and strictly follow the provided structure. The tone should be professional and directed at a teacher who will execute the plan. Use professional Markdown for headings (like '### Title'), lists, and bold text for structure.\n\n**IMPORTANT FORMATTING RULE:** Do NOT use ALL CAPS for headings, text, or any UI elements. Use proper, sentence-case or title-case for all text as appropriate.`;
        
        if (formState.sowLessonContext) {
            const sowLesson = formState.sowLessonContext;
            prompt = `${buildSowLessonScopePrompt(sowLesson, contentType)}
# ${grade} - ${subject} - Lesson Plan

## Week ${sowLesson.week} - Lesson ${sowLesson.lesson}

### Specific Learning Outcomes
Use the supplied outcomes as authoritative; do not replace or broaden them.

### Key Inquiry Questions
Use the supplied inquiry questions and do not substitute unrelated questions.

### Learning Resources
Use the supplied resources and add only directly relevant supporting materials.

### Introduction
Activate prior knowledge and introduce this lesson's outcomes.

### Lesson Development
Provide sequenced teacher and learner activities directly aligned to the supplied learning experiences and outcomes.

### Conclusion
Summarise only the concepts taught in this lesson.

### Assessment
Use the supplied assessment method and provide checks aligned to the stated outcomes.

### Reflection
Provide a brief teacher reflection prompt for this lesson.
`;
        } else {
        const { selectedWeeks, textbookReference } = formState;
        const requestedTerms = formState.terms || ['Term 1'];
        const canonicalNodes = CanonicalCurriculumService.resolveCanonicalSowNodes(
            grade,
            subject,
            requestedTerms
        );
        const weeks = selectedWeeks && selectedWeeks.length > 0 ? selectedWeeks : ['1'];
        const nodesForWeeks = canonicalNodes.filter(n => weeks.includes(String(n.week)));
        
        if (nodesForWeeks.length === 0) {
            throw new Error(`No curriculum nodes found for weeks: ${weeks.join(', ')}`);
        }
        
        const weeksStr = weeks.join(', ');

        prompt = `**CRITICAL INSTRUCTION:** The entire output must be formatted using professional Markdown. Use headings (#, ##, ###), lists (* or - or 1.), and bold text (**) for structure and emphasis. Adhere to the following structure precisely.

        **LOCKED CANONICAL CURRICULUM NODES (CRITICAL - PRESERVE EXACTLY):**
        ${nodesForWeeks.map(n => `- Week ${n.week}, Lesson ${n.lesson} | Strand: ${n.strandTitle} | Sub-Strand: ${n.subStrandTitle} | Outcomes: ${n.learningOutcomesText.replace(/\n/g, ' ')}`).join('\n')}

        You must generate a comprehensive set of Lesson Plans for the following weeks: ${weeksStr}.
        For each selected week, you must generate all lessons taught in that week based strictly on the nodes above (e.g. Lesson 1, Lesson 2, Lesson 3, etc. for that week).
        Repeat the following structure for EVERY single lesson generated in the document.

# ${subject} - Grade ${grade} - Lesson Plans

## Week [Insert Week Number] - Lesson [Insert Lesson Number]: [AI: Generate an engaging lesson title based on the topic below]

**Topic: ${topic} (${textbookReference || 'Curriculum Design'})**

### Specific Learning Outcomes
*AI: Generate 3-5 SMART (Specific, Measurable, Achievable, Relevant, Time-bound) learning outcomes for a 40-minute lesson. For example:*
- *By the end of this lesson, learners should be able to define soil pollution.*
- *By the end of this lesson, learners should be able to list two causes of soil pollution.*

### Key Inquiry Questions
*AI: Formulate 2-3 thought-provoking, open-ended questions to guide the lesson and encourage critical thinking. For example:*
- *What happens to our environment when we throw away rubbish improperly?*
- *How can we protect the soil in our school compound?*

### Learning Resources
*AI: List all necessary resources, including:*
- *Textbook reference: e.g., Mwangaza wa Kiswahili Grade 3 (Pages X-Y)*
- *Visual aids: e.g., Chart paper, whiteboard, markers*
- *Practical materials: e.g., Pictures, real-life examples of pollutants, or digital media related to '${topic}'*

### Introduction (5 Minutes)
*AI: Describe an engaging introduction. Detail how the teacher will capture learners' attention, connect the topic to their prior knowledge, and state the lesson's objectives. For example: "Begin by asking learners if they have ever seen... Discuss their observations briefly. Introduce the topic of..."*

### Lesson Development
*AI: Provide a series of numbered, step-by-step instructions for the teacher to follow. Each step should have a bolded title.*

**1. Explanation of Key Concepts (10 Minutes)**
- *AI: Describe the teacher-led activities for this step. Be specific. For example: "Discuss various causes of soil pollution using the textbook and visual aids. Focus on: **Agricultural activities** (excessive use of pesticides), **Industrial activities** (discharge of waste), **Domestic activities**..."*

**2. Learner Activity - Group Discussion (15 Minutes)**
- *AI: Describe a learner-centered activity in detail. For example: "Divide learners into small groups of 4-5. Ask each group to discuss and list at least two causes of soil pollution they observe in their community."*
- *AI: Provide clear guidance for the teacher, for example: "Guide the discussions to ensure learners understand how these activities pollute the soil."*

**3. Class Sharing and Elaboration (5 Minutes)**
- *AI: Describe a whole-class consolidation activity. For example: "Have each group's secretary present their findings. Facilitate a whole-class discussion, consolidating the identified causes and providing further explanations."*

*(AI: Continue with more steps if necessary to cover the content comprehensively.)*

### Conclusion (5 Minutes)
*AI: Describe how to summarize the lesson. This should include recapping the main learning points and linking to the next lesson. For example: "Recap the main causes of soil pollution discussed. Emphasize that understanding these causes is the first step towards prevention."*

### Assessment
*AI: Generate 3-4 assessment questions categorized by Bloom's Taxonomy level, in the format below. Provide a brief answer key.*
**1. Knowledge:** *(AI: Create a recall-based question.)* (Recall)
**2. Comprehension:** *(AI: Create a question that requires learners to explain a concept.)* (Explain)
**3. Application:** *(AI: Create a scenario-based question.)* (Apply)

---

*(AI: Continue with the next lesson following the exact same structure)*
`;
        }
    } else if (contentType === ContentType.LessonNotes) {
        effectiveSystemInstruction = `You are a Master Teacher creating detailed, easy-to-deliver lesson notes for a Kenyan CBC teacher. The output must be structured, clear, and packed with practical classroom instructions, tips, and assessment questions. Use professional Markdown with headings, lists, and bold text, following the specified format exactly. STRICT RULE: DO NOT include any images, image prompts, or placeholders for images in the generated text.\n\n**IMPORTANT FORMATTING RULE:** Do NOT use ALL CAPS for headings, text, or any UI elements. Use proper, sentence-case or title-case for all text as appropriate.`;
        
        if (formState.sowLessonContext) {
            const sowLesson = formState.sowLessonContext;
            prompt = `${buildSowLessonScopePrompt(sowLesson, contentType)}
# ${grade} - ${subject} - Lesson Notes

## Week ${sowLesson.week} - Lesson ${sowLesson.lesson}

### Lesson Overview
Explain the selected sub-strand and supplied learning outcomes in learner-friendly language.

### Key Concepts and Vocabulary
Explain only concepts necessary to achieve the supplied outcomes.

### Lesson Content
Present accurate, grade-appropriate explanations confined to this lesson.

### Teaching and Learning Activities
Develop the supplied learning experiences into clear classroom steps without changing their scope.

### Learning Resources
Use the supplied resources and identify only directly relevant supporting materials.

### Assessment
Use the supplied assessment method and provide focused checks aligned to the outcomes.

### Lesson Summary
Summarise the key learning from this lesson.
`;
        } else {
            prompt = `**CRITICAL INSTRUCTION: The entire output must be formatted using professional Markdown. Use headings (#, ##, ###, ####, #####), lists (* or - or 1.), and bold text (**) for structure and emphasis. Follow this structure precisely. STRICT RULE: DO NOT INCLUDE ANY IMAGES.**

Generate comprehensive Teacher's Lesson Notes for **${grade} ${subject}** on the topic: **"${topic}"**. The notes should guide a teacher through delivering a series of lessons over several weeks.

# ${grade} - ${subject} - Lesson Notes

## Topic: [AI: Generate a concise title for the main topic, e.g., "Personal Hygiene"]
**Teacher's Overview:** *[AI: Write a brief, introductory paragraph for the teacher explaining the scope, main goals, and key competencies covered in this series of lessons.]*

---

### Term [AI: Fill in the appropriate Term Number]

#### Week [AI: Fill in the Week Number]: [AI: Generate a Sub-Topic/Theme for the week]

##### Lesson 1: [AI: Generate a Lesson Title] (Reference: [AI: Suggest a textbook reference if applicable])
- **Learning Objectives:**
    * *[AI: Generate 2-3 clear learning objectives for this lesson.]*
- **Key Vocabulary & Concepts:**
    * **[AI: Identify a key term]:** *[AI: Provide a simple definition for the teacher to explain.]*
    * **[AI: Identify another key term]:** *[AI: Provide a simple definition.]*
- **Teaching & Learning Activities:**
    1.  **Introduction (approx. 5 mins):** *[AI: Provide detailed instructions for the teacher on how to introduce the lesson, e.g., "Ask learners to share..."]*
    2.  **Lesson Development (approx. 25 mins):** *[AI: Provide step-by-step teacher-led explanation and student activities, e.g., "Explain the concept of... using the chart. Then, divide learners into groups to..."]*
    3.  **Conclusion (approx. 5 mins):** *[AI: Provide instructions on how to summarize and wrap up the lesson, e.g., "Recap the key points by asking..."]*
- **Teacher's Notes:**
    * **Differentiation:** *[AI: Suggest how to support both struggling and advanced learners.]*
    * **Common Misconceptions:** *[AI: Point out potential misunderstandings students might have.]*
- **Assessment:**
    1. *[AI: Generate a question to ask the class.]*
    2. *[AI: Generate another question to check for understanding.]*
- **Learning Resources:**
    * *[AI: List relevant resources like textbooks, charts, etc.]*

*(AI: Continue with more lessons and weeks as needed to cover the topic comprehensively, following the same structure.)*

---

### Conclusion
*[AI: Write a final summary paragraph for the teacher, recapping the overall learning journey for this topic and suggesting how to link it to future topics.]*
`;
        }
    } else if (contentType === ContentType.StudyGuide || (contentType as string) === 'Students Study Guides' || (contentType as string) === 'Learner Study Guide') {
        if (formState.sowLessonContext) {
            prompt = buildSowScopedResourcePrompt(formState.sowLessonContext, contentType);
        } else {

        effectiveSystemInstruction = `You are a curriculum expert creating a supportive, student-facing study guide for the Kenyan CBC. The tone must be encouraging and the content easy to navigate. The guide should be broken down into individual lessons, each with a summary, key points, practice questions, and answers, strictly following the provided structure. Use professional Markdown.\n\n**IMPORTANT FORMATTING RULE:** Do NOT use ALL CAPS for headings, text, or any UI elements. Use proper, sentence-case or title-case for all text as appropriate.`;
        
        prompt = `**CRITICAL INSTRUCTION: The entire output must be formatted using professional Markdown. Use headings (#, ##, ###, ####, #####), lists (* or 1.), italics (*), and bold text (**). Follow this structure precisely.**

Generate a student-friendly Study Guide for **${grade} ${subject}** on the topic: **"${topic}"**. The guide should help learners revise independently by breaking the topic into logical weekly lessons.

# ${grade} ${subject}: Students Study Guide

## Topic: [AI: Generate a concise title for the main topic, e.g., "Personal Hygiene"]
*[AI: Write a brief, engaging overview of the entire topic for the student, explaining what they will learn.]*

---

### Term [AI: Fill in the appropriate Term Number]

#### Week [AI: Fill in the Week Number]: [AI: Generate a Sub-Topic/Theme for the week]

##### Lesson 1: [AI: Generate a Lesson Title] (Reference: [AI: Suggest a textbook reference if applicable])
**Summary:** *[AI: Write a concise paragraph summarizing the lesson's main points.]*

**Key Concepts:** (or **Key Items** / **Key Practices** as appropriate)
* *[AI: Generate a key point with an explanation.]*
* *[AI: Generate another key point with an explanation.]*

**Practice Questions:**
1. *[AI: Generate a practice question.]*
2. *[AI: Generate another practice question.]*

**Answers:**
1. *[AI: Provide the answer to Question 1.]*
2. *[AI: Provide the answer to Question 2.]*

*(AI: Continue with more lessons and weeks as needed to cover the topic comprehensively, following the same structure.)*

---

### Conclusion
*[AI: Write a final summary paragraph encouraging the student and recapping the overall importance of the topic.]*
`;
        }
    } else { // Generic fallback
        prompt = formState.sowLessonContext
            ? buildSowScopedResourcePrompt(formState.sowLessonContext, contentType)
            : `Generate a high-utility ${contentType} for ${grade} ${subject} on "${topic}". Use professional Markdown. Context: ${curriculumContext}`;
    }
    
    if (additionalInformation) prompt += `\n\n**Teacher Context/Notes:**\n${additionalInformation}\n`;
    if (additionalInstructions) prompt += `\n\n**Additional AI Instructions:**\n${additionalInstructions}\n`;
    
    let kiswahiliInstruction = "";
    if (isKiswahili(subject)) {
        kiswahiliInstruction = `\n**LANGUAGE MANDATE (CRITICAL):**
        - This is a Kiswahili subject.
        - The ENTIRE generated output (Headings, Subheadings, Bullet points, Content, Questions, Answers) MUST be in **KISWAHILI ONLY**.
        - Do not use English headers like "Introduction" or "Conclusion"; use their Kiswahili equivalents (e.g., "Utangulizi", "Hitimisho").
        - Maintain professional Markdown formatting.
        `;
    }

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            body: { type: Type.STRING },
            imagePrompts: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: { placeholder: { type: Type.STRING }, prompt: { type: Type.STRING } }
                }
            }
        },
        required: ["body"]
    };

    const result = await aiClientProxy({
        model: FLASH_MODEL,
        prompt: prompt + kiswahiliInstruction,
        contentType,
        config: { 
            systemInstruction: effectiveSystemInstruction, 
            responseMimeType: 'application/json',
            responseSchema: responseSchema
        },
    });

    const responseJson = result.text ? JSON.parse(result.text) : { body: "Failed." };
    return {
        id: `gen_${Date.now()}`,
        title: getDocumentTitle({ metadata: { grade, subject, contentType, topic } } as GeneratedContent),
        body: responseJson.body,
        imagePrompts: responseJson.imagePrompts || [],
        metadata: { grade, subject, topic, contentType, imageSize },
    };
}

export function buildGenerationSystemInstruction(isUploadedSowBound: boolean): string {
    const curriculumAuthority = isUploadedSowBound
        ? `UPLOADED SOW SOURCE OF TRUTH:
    - The selected uploaded Scheme of Work is the authoritative source for its own grade, subject, term plan, lesson sequence, and supplied curriculum fields.
    - Treat the uploaded document as the source provided by the school/user; do not assume or claim that its KICD alignment has been independently verified.
    - Do not perform a second KICD/canonical-curriculum alignment or term-allocation validation for a resource generated from this selected uploaded SOW lesson.
    - Do not block generation merely because a separate canonical curriculum record, term allocation, authority status, or curriculum-verification flag is absent.
    - Preserve the selected SOW lesson's supplied grade, subject, term, week, lesson, strand, sub-strand, outcomes, inquiry questions, experiences, resources, assessment methods, and remarks.
    - Keep every SOW-bound resource confined to the selected lesson. Never invent missing source fields or claim invented values came from the uploaded SOW.
    - Retain technical checks for source readability, extraction completeness, required structure, selected lesson identity, provenance, metadata consistency, and safe data handling.
    - This uploaded-SOW rule does not authorize generation of a new AI-created Scheme of Work without the separate canonical eligibility and scheduling checks.`
        : `CURRICULUM STANDARDS:
    - Strictly align with KICD, CBC, and CBE standards for Grades 1-10.
    - Never invent strands, sub-strands, specific learning outcomes, or content standards.
    - Coverage: Grade 1-6 (Primary), 7-9 (Junior), 10 (Senior).`;

    return `You are Exameno ECG Assistant, an expert in Kenyan CBC/CBE Curriculum, KICD Learning Designs, and Educational Assessment.

    ${curriculumAuthority}

    QUESTION GENERATION RULES (MCQ):
    - Use four options only (A, B, C, D).
    - Provide exactly one correct answer.
    - Use format: Question text\\nA) Option 1\\nB) Option 2\\nC) Option 3\\nD) Option 4\\nANSWER: C
    - Avoid "All/None of the above". Use British English.

    CONTENT STRUCTURES:
    - Lesson Plans: Strand, Sub-strand, Outcomes, Inquiry Questions, Competencies, Values, PCIs, Resources, Introduction, Development, Assessment, Reflection.
    - Schemes of Work: Week, Lesson, Strand, Sub-strand, Outcomes, Experiences, Resources, Assessment, Remarks.
    - ROWC: Week, Lesson, Content Covered, Activities, Remarks.

    GENERAL GUIDELINES:
    - British English spelling. Professional, clear, and concise.
    - Priority: Accuracy > Educational Value > Formatting.
    - Never sacrifice accuracy for brevity. Include clear marking schemes.`;
}

export async function generateContent(formState: FormState, teacherName?: string, schoolName?: string, onProgress?: (progress: number) => void): Promise<GeneratedContent> {
    const systemInstruction = buildGenerationSystemInstruction(!!formState.sowLessonContext);
    
    if (onProgress) onProgress(5); // Initial start

    // Phase 30: Enforce authoritative curriculum lock when bound to a Teacher Action Plan
    if (formState.teacherActionContext) {
        const actCtx = formState.teacherActionContext;
        const sowCtx = formState.sowLessonContext;
        const hasMismatch =
            (actCtx.grade && formState.grade !== actCtx.grade) ||
            (actCtx.subject && formState.subject !== actCtx.subject) ||
            (actCtx.term && formState.term && formState.term !== actCtx.term) ||
            (actCtx.week && formState.week && String(formState.week) !== String(actCtx.week)) ||
            (actCtx.lesson && formState.lessonNumber && String(formState.lessonNumber) !== String(actCtx.lesson)) ||
            (actCtx.strand && sowCtx?.strand && sowCtx.strand !== actCtx.strand) ||
            (actCtx.subStrand && sowCtx?.subStrand && sowCtx.subStrand !== actCtx.subStrand) ||
            (actCtx.specificLearningOutcome && sowCtx?.learningOutcomes && sowCtx.learningOutcomes !== actCtx.specificLearningOutcome);

        if (hasMismatch) {
            throw new Error('Curriculum lock violation: Authoritative curriculum fields cannot be modified while bound to a Teacher Action Plan. Please clear/unbind the action context first.');
        }
    }

    try {
        let result: GeneratedContent;
        switch (formState.contentType) {
            case ContentType.Assessment:
            case ContentType.Quiz:
            case ContentType.TopicExam:
            case ContentType.TermExam:
                result = await generateAssessment(formState, systemInstruction, onProgress);
                break;
            case ContentType.SchemeOfWork:
                result = await generateSchemeOfWork(formState, teacherName, systemInstruction, onProgress);
                break;
            case ContentType.RecordOfWorkCovered:
                result = await generateROWC(formState, systemInstruction);
                break;
            default:
                result = await generateTextContent(formState, systemInstruction, teacherName, schoolName);
                break;
        }
        if (onProgress) onProgress(100);
        if (
            result &&
            result.metadata &&
            (formState.parentArtifactId ||
             formState.curriculumLessonId ||
             formState.sowLessonContext ||
             formState.teacherActionId ||
             formState.sourceTeacherActionId ||
             formState.teacherActionContext)
        ) {
            const actionId = formState.teacherActionId || formState.sourceTeacherActionId || formState.teacherActionContext?.actionId;
            result.metadata = {
                ...result.metadata,
                schoolId: formState.schoolId || result.metadata.schoolId,
                term: formState.term || formState.terms?.[0] || formState.teacherActionContext?.term || result.metadata.term,
                parentArtifactId: formState.parentArtifactId,
                masterSowId: formState.masterSowId,
                curriculumLessonId: formState.curriculumLessonId,
                scheduledLessonId: formState.scheduledLessonId,
                teacherActionId: actionId,
                sourceTeacherActionId: actionId,
                sourceInterpretationId: formState.sourceInterpretationId || formState.teacherActionContext?.sourceInterpretationId,
                ecgArtifactId: formState.ecgArtifactId || formState.teacherActionContext?.ecgArtifactId,
                classGroupId: formState.teacherActionContext?.classGroupId,
                actionScope: formState.teacherActionContext?.scope,
                selectedLearnerIds: formState.teacherActionContext?.selectedLearnerIds,
                targetLearnerId: formState.teacherActionContext?.learnerId,
                week: formState.week || formState.teacherActionContext?.week,
                lessonNumber: formState.lessonNumber || formState.teacherActionContext?.lesson,
                strand: formState.sowLessonContext?.strand || formState.teacherActionContext?.strand,
                subStrand: formState.sowLessonContext?.subStrand || formState.teacherActionContext?.subStrand,
                specificLearningOutcome: formState.sowLessonContext?.learningOutcomes || formState.teacherActionContext?.specificLearningOutcome,
                sourceSowId: formState.sowLessonContext?.sourceSowId,
                sourceSowEntryId: formState.sowLessonContext?.sourceSowEntryId,
                sourceDocumentRef: formState.sowLessonContext?.sourceDocumentRef,
            };
        }
        return result;
    } catch (e: any) {
        let errorMessage = "Content generation failed.";
        
        // Extract error message correctly
        if (e?.error?.message) {
            errorMessage = e.error.message;
        } else if (e?.message) {
            errorMessage = e.message;
        } else if (typeof e === 'string') {
            errorMessage = e;
        } else {
            try {
                errorMessage = JSON.stringify(e);
            } catch(ignored) {}
        }
        
        try {
            // Attempt to parse if the error message contains a JSON string
            const jsonMatch = errorMessage.match(/\{.*\}/);
            if (jsonMatch) {
                const parsedError = JSON.parse(jsonMatch[0]);
                if (parsedError.error?.code === 503) {
                    errorMessage = "The AI model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again in a few minutes.";
                } else if (parsedError.error?.message) {
                    errorMessage = parsedError.error.message;
                }
            }
        } catch (parseError) {
            // Ignore parse errors, fallback to original message
        }

        // Catch explicitly formatted strings as well
        if (typeof errorMessage === 'string' && (errorMessage.includes('503') && errorMessage.includes('high demand') || errorMessage.includes('UNAVAILABLE'))) {
             errorMessage = "The AI model is currently experiencing high demand. Please try again in a few minutes.";
        }
        
        if (typeof errorMessage === 'string' && (errorMessage.includes('prepayment credits are depleted') || errorMessage.includes('billing'))) {
            if (typeof window !== 'undefined' && (window as any).aistudio) {
                setTimeout(() => {
                     (window as any).aistudio.openSelectKey();
                }, 100);
            }
            errorMessage = "Your Gemini API key has run out of credits. Please provide a different API key that has active billing, or use the free tier if applicable.";
        }
        
        console.error("AI Generation log:", errorMessage);
        throw new Error(errorMessage);
    }
}

export async function auditCurriculumAlignment(content: GeneratedContent): Promise<{ score: number; report: string; recommendations: string[] }> {
  const { grade, subject, contentType } = content.metadata || {};
  const artifact: any = {
    id: content.id || 'temp',
    artifactType: contentType || 'Document',
    gradeLevelName: grade || '',
    learningAreaName: subject || '',
    curriculumReferences: [],
    content: content,
  };

  const checked = await (await import('./curriculumAlignmentService.ts')).CurriculumAlignmentService.performAlignmentCheck(artifact);
  const findings = checked.alignmentFindings || [];
  
  let score = 100;
  const misalignedCount = findings.filter(f => f.status === 'significant_misalignment').length;
  const reviewCount = findings.filter(f => f.status === 'needs_review').length;
  
  score = Math.max(40, score - (misalignedCount * 25) - (reviewCount * 5));

  const report = (await import('./curriculumAlignmentService.ts')).CurriculumAlignmentService.generateDeterministicSummary(
    findings,
    grade || 'Grade',
    subject || 'Subject',
    contentType || 'Content'
  );

  const recommendations: string[] = [];
  findings.forEach(f => {
    if (f.suggestion && !recommendations.includes(f.suggestion)) {
      recommendations.push(f.suggestion);
    }
  });

  if (recommendations.length === 0) {
    recommendations.push(
      "Ensure all inquiry questions promote higher-order thinking skills (HOTS).",
      "Integrate localized Kenyan contexts and practical investigations.",
      "Maintain strict alignment with official KICD CBC learning outcomes."
    );
  }

  return {
    score,
    report,
    recommendations
  };
}

export async function summarizeContent(content: GeneratedContent): Promise<string> {
    const result = await aiClientProxy({
        model: FLASH_MODEL,
        prompt: `Provide an Executive Summary: ${content.body || JSON.stringify(content.questions)}`,
        config: { systemInstruction: "You are Exameno ECG Assistant. Provide a 3-bullet summary with 'Key Takeaways' from the content." }
    });
    return result.text || "Summary failed.";
}

export async function generateRubric(content: GeneratedContent): Promise<string> {
  const result = await aiClientProxy({
    model: PRO_MODEL,
    prompt: `Create a detailed CBC assessment rubric for: ${content.title}. The rubric should be a Markdown table.`,
    config: { systemInstruction: "You are Exameno ECG Assistant, acting as an expert educational assessor. Output the rubric as a clear Markdown table." }
  });
  return result.text || "Rubric generation failed.";
}

export async function applyAISuggestion(
  content: GeneratedContent,
  suggestionType: AISuggestionType
): Promise<GeneratedContent> {
  if (suggestionType === AISuggestionType.GradingRubric) {
    const rubric = await generateRubric(content);
    return { ...content, rubric };
  }

  let prompt = '';
  switch (suggestionType) {
    case AISuggestionType.BloomsTaxonomy:
      prompt = `Review and enhance the following CBC educational content to systematically incorporate Bloom's Taxonomy cognitive progression (from Remembering and Understanding to Higher-Order Thinking Skills: Applying, Analyzing, Evaluating, Creating). Maintain KICD CBC standards. Output the revised content in professional Markdown:\n\n${content.body || JSON.stringify(content.questions || '')}`;
      break;
    case AISuggestionType.LearningOutcomes:
      prompt = `Strengthen the alignment of this educational content with specific CBC Specific Learning Outcomes (SLOs) and core competencies (Critical Thinking, Problem Solving, Communication, Collaboration). Output the revised content in professional Markdown:\n\n${content.body || JSON.stringify(content.questions || '')}`;
      break;
    case AISuggestionType.ImproveQuestions:
      prompt = `Review and improve the assessment questions in this CBC content. Ensure: 1) One unambiguously correct answer. 2) 4 plausible options for MCQs (A, B, C, D) without 'All/None of the above'. 3) Clear mark allocation. 4) Accurate answer keys and concise explanations. Output the improved content in professional Markdown:\n\n${content.body || JSON.stringify(content.questions || '')}`;
      break;
    case AISuggestionType.GenerateLessonPlan:
      prompt = `Generate a comprehensive CBC Lesson Plan based on this topic and content: "${content.title}". Include Strand, Sub-strand, Specific Learning Outcomes, Key Inquiry Questions, Core Competencies, Values, PCIs, Learning Resources, Introduction, Lesson Development, Assessment, and Reflection. Output in professional Markdown:\n\n${content.body || JSON.stringify(content.questions || '')}`;
      break;
    default:
      prompt = `Review and improve this CBC educational content according to Kenyan KICD standards. Output in professional Markdown:\n\n${content.body || JSON.stringify(content.questions || '')}`;
      break;
  }

  const result = await aiClientProxy({
    model: FLASH_MODEL,
    prompt: prompt,
    config: {
      systemInstruction: "You are Exameno ECG Assistant, an expert in Kenyan CBC curriculum designs. Provide structured, practical, and curriculum-aligned educational output in British English."
    }
  });
  
  const text = result.text || "";
  return { ...content, body: text || content.body };
}

export async function regenerateTextSection(sectionText: string, context: string): Promise<string> {
    const result = await aiClientProxy({
        model: FLASH_MODEL,
        prompt: `Rewrite this section:\n"${sectionText}"\n\nContext: ${context.substring(0, 1000)}`
    });
    return result.text || sectionText;
}

export async function regenerateQuestion(question: GeneratedQuestion, context: string): Promise<GeneratedQuestion> {
    const result = await aiClientProxy({
        model: FLASH_MODEL,
        prompt: `Replace this question: ${JSON.stringify(question)}`,
        config: { 
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: { questionText: { type: Type.STRING }, correctAnswer: { type: Type.STRING }, explanation: { type: Type.STRING } }
            }
        }
    });
    const raw = result.text ? JSON.parse(result.text) : {};
    return { ...question, ...raw };
}

export async function generateAnalyticsInsights(logs: any[]): Promise<string> {
    const result = await aiClientProxy({
        model: PRO_MODEL,
        prompt: `Analyze these usage logs: ${JSON.stringify(logs.slice(0, 30))}`,
        config: { systemInstruction: "You are a senior data analyst." }
    });
    return result.text || "No insights available.";
}

async function aiClientStreamProxy(payload: { prompt: any; model?: string; config?: any }) {
    const { getAuth } = await import('firebase/auth');
    const token = await getAuth().currentUser?.getIdToken();
    const response = await fetch('/api/generate-stream', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(await response.text());
    if (!response.body) throw new Error("Response body is null");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    return {
        async *[Symbol.asyncIterator]() {
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') return;
                        try {
                            const parsed = JSON.parse(data);
                            // Process chunk to add .text property if missing
                            if (parsed.candidates && parsed.candidates[0]?.content?.parts) {
                                const textPart = parsed.candidates[0].content.parts.find((p: any) => p.text);
                                if (textPart && !parsed.text) {
                                    parsed.text = textPart.text;
                                }
                            }
                            yield parsed;
                        } catch (e) {
                            console.error("Error parsing stream chunk:", e);
                        }
                    }
                }
            }
        }
    };
}

export async function getAIChat(content: GeneratedContent): Promise<any> {
    const history: any[] = [
        { role: 'user', parts: [{ text: `Here is some educational content I am working on: \n\n${JSON.stringify(content)}` }] },
        { role: 'model', parts: [{ text: "I have received the content. How can I help you with it?" }] }
    ];

    return {
        sendMessageStream: async ({ message }: { message: string }) => {
            history.push({ role: 'user', parts: [{ text: message }] });
            const stream = await aiClientStreamProxy({
                model: FLASH_MODEL,
                prompt: history,
                config: {
                    systemInstruction: "You are Exameno ECG Assistant, a professional curriculum expert helping a teacher with Kenyan CBC educational content. Be helpful, structured, and curriculum-aligned. Use British English spelling."
                }
            });

            // We need to collect the full response to update the history
            let fullContent = "";
            return {
                async *[Symbol.asyncIterator]() {
                    for await (const chunk of (stream as any)) {
                        if (chunk.text) fullContent += chunk.text;
                        yield chunk;
                    }
                    history.push({ role: 'model', parts: [{ text: fullContent }] });
                }
            };
        }
    };
}
