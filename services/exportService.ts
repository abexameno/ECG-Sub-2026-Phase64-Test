



declare const docx: any;
declare const XLSX: any;
declare const PptxGenJS: any;

import { GeneratedQuestion, QuestionType, GeneratedContent, ExportHeaderInfo, AssessmentExportType, ContentType } from '../types.ts';
import { waitForGlobal } from '../utils/waitForGlobal.ts';
import { formatSowAsDocx } from './sowMasterTemplateExportService.ts';

const BRAND_COLOR = '064e3b'; // Dark Green (Emerald 900)

export function cleanText(value: unknown): string {
    const normalize = (input: unknown, seen: WeakSet<object>): string => {
        if (input === null || input === undefined) return '';
        if (typeof input === 'string') return input;
        if (typeof input === 'number' || typeof input === 'boolean' || typeof input === 'bigint') {
            return String(input);
        }
        if (typeof input === 'symbol' || typeof input === 'function') {
            try { return String(input); } catch { return ''; }
        }
        if (typeof input === 'object') {
            if (seen.has(input)) return '';
            seen.add(input);
            if (Array.isArray(input)) {
                return input.map(item => normalize(item, seen)).filter(Boolean).join('; ');
            }
            try {
                if ('text' in input) {
                    return normalize((input as { text?: unknown }).text, seen);
                }
                const values = Object.values(input as Record<string, unknown>)
                    .map(item => normalize(item, seen))
                    .filter(Boolean);
                if (values.length > 0) return values.join('; ');
                return JSON.stringify(input) ?? '';
            } catch {
                try { return String(input); } catch { return ''; }
            }
        }
        try { return String(input); } catch { return ''; }
    };

    const text = normalize(value, new WeakSet<object>());
    return text
        // Remove Markdown heading prefixes, not hash characters inside content (for example C#).
        .replace(/^\s{0,3}#{1,6}\s+/gm, '')
        // Remove paired Markdown emphasis/strike delimiters while preserving literal symbols.
        .replace(/\*\*(.+?)\*\*/gs, '$1')
        .replace(/__(.+?)__/gs, '$1')
        .replace(/~~(.+?)~~/gs, '$1')
        .replace(/(^|[\s([{])\*([^*\n]+)\*(?=$|[\s.,!?;:)\]}])/g, '$1$2')
        .replace(/(^|[\s([{])_([^_\n]+)_(?=$|[\s.,!?;:)\]}])/g, '$1$2')
        .trim();
}

function firstPresentValue(...values: unknown[]): unknown {
    return values.find(value => value !== undefined && value !== null && value !== '') ?? '';
}

function csvCell(value: unknown): string {
    return `"${cleanText(value).replace(/"/g, '""')}"`;
}

export function generateFilename(content: GeneratedContent, extension: string, assessmentExportType?: AssessmentExportType): string {
    const { grade, subject, contentType, terms, schoolId } = content.metadata || {};
    
    // Attempt to get school name from metadata if it was passed through, otherwise use SchoolConfigService
    // Since we are in exportService, we might not have easy access to the full artifact here 
    // unless we pass it in. For now, we'll try to find school name from schoolId
    
    let schoolName = 'ECG';
    try {
        // We can't easily import SchoolConfigService here if it's a circular dep, 
        // but we can check if it's in metadata
        if ((content as any).schoolName) {
            schoolName = (content as any).schoolName;
        }
    } catch (e) {}

    const cleanSchool = (schoolName || 'School').trim();
    const cleanSubject = (subject || 'Subject').trim();
    const cleanGrade = (grade || 'Grade').trim();
    const cleanType = (contentType || 'Document').trim();
    const year = (content.metadata as any)?.academicYear || new Date().getFullYear();
    if (content.schemeOfWorkData) {
        const sowTerm = content.schemeOfWorkData.term || (content.metadata as any)?.term || terms?.[0] || 'Term';
        const sowFilename = `${cleanGrade} - ${cleanSubject} - ${sowTerm} - ${year}`;
        return `${sowFilename.replace(/[\\\\/:*?"<>|]/g, '_')}.${extension}`;
    }
    
    let termSuffix = '';
    if (terms && terms.length > 0) {
        termSuffix = ` - ${terms.join('-')}`;
    }

    const filename = `${cleanSchool} - ${cleanGrade} - ${cleanSubject} - ${cleanType}${termSuffix} - ${year}`;
    
    // Sanitize filename for filesystem
    return `${filename.replace(/[\\/:*?"<>|]/g, '_')}.${extension}`;
}

export async function formatAsCsv(content: GeneratedContent): Promise<string> {
    let csv = '';
    if (content.schemeOfWorkData) {
        csv = 'Week,Lesson,Strand,Sub-Strand,Specific Learning Outcomes,Learning Experiences,Key Inquiry Questions,Learning Resources,Assessment Methods,Remarks\n';
        content.schemeOfWorkData.entries.forEach(e => {
            const outcomesVal = firstPresentValue(e.learningOutcomes, (e as any).specificLearningOutcomes, (e as any).learningOutcomesText);
            const inquiryVal = firstPresentValue(e.inquiryQuestions, (e as any).keyInquiryQuestions);
            const experiencesVal = firstPresentValue(e.learningExperiences, (e as any).content, (e as any).learningExperience);
            const resourcesVal = firstPresentValue(e.learningResources, (e as any).resources);
            const assessmentVal = firstPresentValue(e.assessment, (e as any).assessmentMethods);
            const remarksVal = firstPresentValue(e.remarks);
            const strandVal = firstPresentValue(e.strand, (e as any).strandTitle);
            const subStrandVal = firstPresentValue(e.subStrand, (e as any).subStrandTitle);

            csv += [
                e.week,
                e.lesson,
                strandVal,
                subStrandVal,
                outcomesVal,
                experiencesVal,
                inquiryVal,
                resourcesVal,
                assessmentVal,
                remarksVal
            ].map(csvCell).join(',') + '\n';
        });
    } else if (content.rowcData) {
        csv = 'Date,Grade,Subject,Lesson,Activity,Resources,Remarks\n';
        content.rowcData.lessons.forEach(l => {
            csv += [l.date, l.grade, l.subject, l.lessonTitle, l.learningActivities, l.resources, l.remarks]
                .map(csvCell).join(',') + '\n';
        });
    } else if (content.questions) {
        csv = 'Type,Text,Answer,Explanation\n';
        content.questions.forEach(q => {
            csv += [q.questionType, q.questionText, q.correctAnswer, q.explanation]
                .map(csvCell).join(',') + '\n';
        });
    }
    return csv;
}

export function formatAuditLogsAsCsv(
    logs: any[],
    schoolName: string,
    dateRangeLabel: string,
    options?: { isTruncated?: boolean; maxLimit?: number }
): string {
    let csv = `EXAMENO ECG PORTFOLIO EXPORT AUDIT REPORT\n`;
    csv += `School Name,"${(schoolName || 'Exameno School').replace(/"/g, '""')}"\n`;
    csv += `Date Range,"${(dateRangeLabel || 'All Dates').replace(/"/g, '""')}"\n`;
    csv += `Report Generated At,"${new Date().toISOString()}"\n`;

    if (options?.isTruncated) {
        csv += `Report Notice,"PARTIAL REPORT TRUNCATED AT MAXIMUM SERVER LIMIT OF ${options.maxLimit || 1000} RECORDS. FILTER BY NARROWER DATE RANGE FOR COMPLETE RESULTS."\n`;
    }

    csv += `\nTeacher Name,Export Date & Time,Resource Count,Content Types,Grades,Subjects,Terms,Status\n`;

    if (!logs || logs.length === 0) {
        csv += `No audit records found for the selected range.,,,,,,,\n`;
        return csv;
    }

    logs.forEach(log => {
        const teacher = (log.teacherName || 'Unknown Teacher').replace(/"/g, '""');
        const dateStr = log.generatedAt || '';
        const count = log.resourceCount || 0;
        const types = (Array.isArray(log.resourceTypes) ? log.resourceTypes.join('; ') : '').replace(/"/g, '""');
        const grades = (Array.isArray(log.grades) ? log.grades.join('; ') : '').replace(/"/g, '""');
        const subjects = (Array.isArray(log.subjects) ? log.subjects.join('; ') : '').replace(/"/g, '""');
        const terms = (Array.isArray(log.terms) ? log.terms.join('; ') : '').replace(/"/g, '""');
        const status = (log.status || 'Authorized Export').replace(/"/g, '""');

        csv += `"${teacher}","${dateStr}","${count}","${types}","${grades}","${subjects}","${terms}","${status}"\n`;
    });

    return csv;
}

async function getXlsxInstance(): Promise<any> {
    if (typeof window !== 'undefined' && (window as any).XLSX?.utils) {
        return (window as any).XLSX;
    }
    if (typeof XLSX !== 'undefined' && XLSX?.utils) {
        return XLSX;
    }
    return await waitForGlobal('XLSX');
}

export function sanitizeSheetName(name: string, fallback: string = 'Sheet 1'): string {
    if (!name || typeof name !== 'string') return fallback;
    const clean = name.replace(/[\\/?*[\]:]/g, '_').trim();
    return clean.slice(0, 31) || fallback;
}

export function buildSowWorkbook(content: GeneratedContent, headerInfo?: ExportHeaderInfo, XLSX?: any): any {
    const wb = XLSX.utils.book_new();
    const sowData = content.schemeOfWorkData;
    const rawEntries: any[] = Array.isArray(sowData?.entries) ? sowData.entries : [];

    const schoolName = (headerInfo?.schoolName || (content as any).schoolName || '').trim();
    const grade = (headerInfo?.gradeLevel || sowData?.grade || content.metadata?.grade || '').trim();
    const subject = (headerInfo?.subject || sowData?.subject || content.metadata?.subject || '').trim();
    const teacherName = (headerInfo?.teacherName || sowData?.teacher || '').trim();
    const tscNumber = (headerInfo?.tscNumber || '').trim();
    const year = headerInfo?.academicYear || (content.metadata as any)?.academicYear || new Date().getFullYear();

    const termMap = new Map<string, any[]>();
    const hasPerEntryTerm = rawEntries.some(e => Boolean(e && e.term && String(e.term).trim()));

    if (hasPerEntryTerm) {
        rawEntries.forEach(entry => {
            const rawTerm = String(entry.term || sowData?.term || content.metadata?.term || 'Term 1').trim();
            if (!termMap.has(rawTerm)) {
                termMap.set(rawTerm, []);
            }
            termMap.get(rawTerm)!.push(entry);
        });
    } else {
        const defaultTerm = String(sowData?.term || content.metadata?.term || 'Term 1').trim();
        termMap.set(defaultTerm, rawEntries);
    }

    const createdSheetNames = new Set<string>();

    termMap.forEach((termEntries, rawTermName) => {
        const termName = rawTermName || 'Term 1';
        let baseSheetName = sanitizeSheetName(termName, 'Term 1');
        let sheetName = baseSheetName;
        let counter = 2;
        while (createdSheetNames.has(sheetName.toLowerCase())) {
            sheetName = sanitizeSheetName(`${baseSheetName} (${counter})`);
            counter++;
        }
        createdSheetNames.add(sheetName.toLowerCase());

        const rows: (string | number)[][] = [];

        // Title & Header Block
        rows.push(['EXAMENO CBE CONTENT GENERATOR — SCHEME OF WORK', '', '', '', '', '', '', '', '', '']);
        rows.push([
            (content.metadata as any)?.sowAuthority === 'UPLOADED_SOURCE'
                ? 'UPLOADED SOURCE SCHEME OF WORK — SOURCE CONTENT PRESERVED'
                : 'KICD/TSC-ALIGNED PROFESSIONAL WORKBOOK FORMAT',
            '', '', '', '', '', '', '', '', ''
        ]);
        rows.push(['', '', '', '', '', '', '', '', '', '']);

        // Institutional Metadata Row 1
        rows.push([
            'School:',
            schoolName,
            '',
            '',
            'Grade / Level:',
            grade,
            'Subject / Learning Area:',
            subject,
            '',
            ''
        ]);

        // Institutional Metadata Row 2
        rows.push([
            'Teacher:',
            teacherName,
            '',
            '',
            'TSC Number:',
            tscNumber,
            'Term / Year:',
            `${termName} / ${year}`,
            '',
            ''
        ]);

        rows.push(['', '', '', '', '', '', '', '', '', '']);

        // Main Curriculum Table Header (Row 7, index 6)
        const tableHeaders = [
            'Week',
            'Lesson',
            'Strand',
            'Sub-Strand',
            'Specific Learning Outcomes',
            'Learning Experiences',
            'Key Inquiry Questions',
            'Learning Resources',
            'Assessment Methods',
            'Remarks'
        ];
        rows.push(tableHeaders);

        // Data Rows
        if (termEntries.length === 0) {
            rows.push(['No scheme of work entries recorded for this term.', '', '', '', '', '', '', '', '', '']);
        } else {
            termEntries.forEach(entry => {
                const outcomesVal = firstPresentValue(entry.learningOutcomes, (entry as any).specificLearningOutcomes, (entry as any).learningOutcomesText);
                const inquiryVal = firstPresentValue(entry.inquiryQuestions, (entry as any).keyInquiryQuestions);
                const experiencesVal = firstPresentValue(entry.learningExperiences, (entry as any).content, (entry as any).learningExperience);
                const resourcesVal = firstPresentValue(entry.learningResources, (entry as any).resources);
                const assessmentVal = firstPresentValue(entry.assessment, (entry as any).assessmentMethods);
                const remarksVal = firstPresentValue(entry.remarks);
                const strandVal = firstPresentValue(entry.strand, (entry as any).strandTitle);
                const subStrandVal = firstPresentValue(entry.subStrand, (entry as any).subStrandTitle);

                rows.push([
                    cleanText(entry.week),
                    cleanText(entry.lesson),
                    cleanText(strandVal),
                    cleanText(subStrandVal),
                    cleanText(outcomesVal),
                    cleanText(experiencesVal),
                    cleanText(inquiryVal),
                    cleanText(resourcesVal),
                    cleanText(assessmentVal),
                    cleanText(remarksVal)
                ]);
            });
        }

        // Spacer Row
        rows.push(['', '', '', '', '', '', '', '', '', '']);

        // Sign-Off Block
        const signOffRowIdx = rows.length;
        rows.push(['INSTITUTIONAL REVIEW & ADMINISTRATIVE SIGN-OFF', '', '', '', '', '', '', '', '', '']);
        rows.push(['Teacher Signature: _______________________', '', '', 'Date: _______________', '', 'Remarks: ___________________________________', '', '', '', '']);
        rows.push(['HOD / Subject Head Signature: _______________', '', '', 'Date: _______________', '', 'Remarks: ___________________________________', '', '', '', '']);
        rows.push(['Principal / Headteacher Signature: __________', '', '', 'Date: _______________', '', 'Official School Stamp: [                   ]', '', '', '', '']);

        const ws = XLSX.utils.aoa_to_sheet(rows);

        // Column Widths
        ws['!cols'] = [
            { wch: 6 },   // Week
            { wch: 6 },   // Lesson
            { wch: 18 },  // Strand
            { wch: 20 },  // Sub-Strand
            { wch: 38 },  // Specific Learning Outcomes
            { wch: 38 },  // Learning Experiences
            { wch: 26 },  // Key Inquiry Questions
            { wch: 26 },  // Learning Resources
            { wch: 22 },  // Assessment Methods
            { wch: 22 }   // Reflections / Remarks
        ];

        // Row Heights
        ws['!rows'] = [
            { hpt: 24 }, // Title
            { hpt: 16 }, // Subtitle
            { hpt: 10 }, // Spacer
            { hpt: 18 }, // Meta 1
            { hpt: 18 }, // Meta 2
            { hpt: 10 }, // Spacer
            { hpt: 24 }  // Table header
        ];

        // Cell Merges
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, // Title
            { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }, // Subtitle
            { s: { r: 3, c: 1 }, e: { r: 3, c: 3 } }, // School name
            { s: { r: 3, c: 7 }, e: { r: 3, c: 9 } }, // Subject
            { s: { r: 4, c: 1 }, e: { r: 4, c: 3 } }, // Teacher name
            { s: { r: 4, c: 7 }, e: { r: 4, c: 9 } }, // Term/Year
            { s: { r: signOffRowIdx, c: 0 }, e: { r: signOffRowIdx, c: 9 } }, // Sign-off title
            { s: { r: signOffRowIdx + 1, c: 0 }, e: { r: signOffRowIdx + 1, c: 2 } },
            { s: { r: signOffRowIdx + 1, c: 3 }, e: { r: signOffRowIdx + 1, c: 4 } },
            { s: { r: signOffRowIdx + 1, c: 5 }, e: { r: signOffRowIdx + 1, c: 9 } },
            { s: { r: signOffRowIdx + 2, c: 0 }, e: { r: signOffRowIdx + 2, c: 2 } },
            { s: { r: signOffRowIdx + 2, c: 3 }, e: { r: signOffRowIdx + 2, c: 4 } },
            { s: { r: signOffRowIdx + 2, c: 5 }, e: { r: signOffRowIdx + 2, c: 9 } },
            { s: { r: signOffRowIdx + 3, c: 0 }, e: { r: signOffRowIdx + 3, c: 2 } },
            { s: { r: signOffRowIdx + 3, c: 3 }, e: { r: signOffRowIdx + 3, c: 4 } },
            { s: { r: signOffRowIdx + 3, c: 5 }, e: { r: signOffRowIdx + 3, c: 9 } }
        ];

        // Print & Page Setup (A4 Landscape)
        ws['!pageSetup'] = {
            orientation: 'landscape',
            paperSize: 9, // A4
            scale: 85,
            fitToWidth: 1,
            fitToHeight: 0
        };

        ws['!margins'] = {
            left: 0.5,
            right: 0.5,
            top: 0.75,
            bottom: 0.75,
            header: 0.3,
            footer: 0.3
        };

        const totalDataRows = termEntries.length > 0 ? termEntries.length : 1;
        ws['!autofilter'] = { ref: `A7:J${7 + totalDataRows}` };

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    return wb;
}

export function buildRowcWorkbook(content: GeneratedContent, headerInfo?: ExportHeaderInfo, XLSX?: any): any {
    const wb = XLSX.utils.book_new();
    const rowcData = content.rowcData;
    const lessons: any[] = Array.isArray(rowcData?.lessons) ? rowcData.lessons : [];

    const schoolName = (headerInfo?.schoolName || (content as any).schoolName || content.metadata?.schoolId || 'Exameno School').trim();
    const grade = (headerInfo?.gradeLevel || content.metadata?.grade || 'Grade Level').trim();
    const subject = (headerInfo?.subject || content.metadata?.subject || 'Subject').trim();
    const teacherName = (headerInfo?.teacherName || 'Subject Teacher').trim();
    const weekRange = (rowcData?.weekRange || headerInfo?.term || content.metadata?.term || 'Term 1').trim();
    const reflection = rowcData?.reflection ? cleanText(rowcData.reflection) : '';

    const termMap = new Map<string, any[]>();
    const hasPerLessonTerm = lessons.some(l => Boolean(l && l.term && String(l.term).trim()));

    if (hasPerLessonTerm) {
        lessons.forEach(l => {
            const rawTerm = String(l.term || content.metadata?.term || 'Term 1').trim();
            if (!termMap.has(rawTerm)) {
                termMap.set(rawTerm, []);
            }
            termMap.get(rawTerm)!.push(l);
        });
    } else {
        const defaultTerm = (content.metadata?.term || 'Record of Work').trim();
        termMap.set(defaultTerm, lessons);
    }

    const createdSheetNames = new Set<string>();

    termMap.forEach((termLessons, rawTermName) => {
        const termName = rawTermName || 'Record of Work';
        let baseSheetName = sanitizeSheetName(termName, 'Record of Work');
        let sheetName = baseSheetName;
        let counter = 2;
        while (createdSheetNames.has(sheetName.toLowerCase())) {
            sheetName = sanitizeSheetName(`${baseSheetName} (${counter})`);
            counter++;
        }
        createdSheetNames.add(sheetName.toLowerCase());

        const rows: (string | number)[][] = [];

        // Title Block
        rows.push(['EXAMENO CBE CONTENT GENERATOR — RECORD OF WORK COVERED', '', '', '', '', '', '', '']);
        rows.push(['KICD/TSC-ALIGNED PROFESSIONAL WORKBOOK FORMAT', '', '', '', '', '', '', '']);
        rows.push(['', '', '', '', '', '', '', '']);

        // Metadata Block
        rows.push([
            'School:',
            schoolName,
            '',
            '',
            'Grade / Level:',
            grade,
            'Subject:',
            subject
        ]);

        rows.push([
            'Teacher:',
            teacherName,
            '',
            '',
            'Week Range / Term:',
            weekRange,
            '',
            ''
        ]);

        rows.push(['', '', '', '', '', '', '', '']);

        // Table Header
        const tableHeaders = [
            'Date / Wk',
            'Grade',
            'Subject',
            'Strand / Sub-Strand',
            'Lesson Title',
            'Learning Activities / Content Covered',
            'Learning Resources',
            'Assessment & Remarks'
        ];
        rows.push(tableHeaders);

        // Data Rows
        if (termLessons.length === 0) {
            rows.push(['No lesson entries recorded.', '', '', '', '', '', '', '']);
        } else {
            termLessons.forEach(l => {
                const strandSubStrand = `${l.strand || ''}${l.subStrand ? ' / ' + l.subStrand : ''}`;
                const assessRemarks = `${l.assessment ? 'Assessment: ' + cleanText(l.assessment) + '; ' : ''}${cleanText(l.remarks || '')}`;
                rows.push([
                    l.date || '',
                    l.grade || grade,
                    l.subject || subject,
                    strandSubStrand,
                    l.lessonTitle || '',
                    cleanText(l.learningActivities || ''),
                    cleanText(l.resources || ''),
                    assessRemarks
                ]);
            });
        }

        // Spacer
        rows.push(['', '', '', '', '', '', '', '']);

        // Reflection section if present
        if (reflection) {
            rows.push(['TEACHER PEDAGOGICAL REFLECTION & NOTES', '', '', '', '', '', '', '']);
            rows.push([reflection, '', '', '', '', '', '', '']);
            rows.push(['', '', '', '', '', '', '', '']);
        }

        // Sign-Off Block
        const signOffRowIdx = rows.length;
        rows.push(['INSTITUTIONAL REVIEW & ADMINISTRATIVE SIGN-OFF', '', '', '', '', '', '', '']);
        rows.push(['Teacher Signature: _______________________', '', 'Date: _______________', '', 'Remarks: ___________________________________', '', '', '']);
        rows.push(['HOD / Subject Head Signature: _______________', '', 'Date: _______________', '', 'Remarks: ___________________________________', '', '', '']);
        rows.push(['Principal / Deputy Signature: ______________', '', 'Date: _______________', '', 'Official School Stamp: [                   ]', '', '', '']);

        const ws = XLSX.utils.aoa_to_sheet(rows);

        // Column widths
        ws['!cols'] = [
            { wch: 14 }, // Date / Wk
            { wch: 10 }, // Grade
            { wch: 18 }, // Subject
            { wch: 24 }, // Strand / Sub-Strand
            { wch: 24 }, // Lesson Title
            { wch: 40 }, // Learning Activities
            { wch: 24 }, // Learning Resources
            { wch: 26 }  // Assessment & Remarks
        ];

        // Merges
        const merges: any[] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, // Title
            { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }, // Subtitle
            { s: { r: 3, c: 1 }, e: { r: 3, c: 3 } }, // School name
            { s: { r: 4, c: 1 }, e: { r: 4, c: 3 } }, // Teacher name
            { s: { r: 4, c: 5 }, e: { r: 4, c: 7 } }, // Week Range / Term
            { s: { r: signOffRowIdx, c: 0 }, e: { r: signOffRowIdx, c: 7 } },
            { s: { r: signOffRowIdx + 1, c: 0 }, e: { r: signOffRowIdx + 1, c: 1 } },
            { s: { r: signOffRowIdx + 1, c: 2 }, e: { r: signOffRowIdx + 1, c: 3 } },
            { s: { r: signOffRowIdx + 1, c: 4 }, e: { r: signOffRowIdx + 1, c: 7 } },
            { s: { r: signOffRowIdx + 2, c: 0 }, e: { r: signOffRowIdx + 2, c: 1 } },
            { s: { r: signOffRowIdx + 2, c: 2 }, e: { r: signOffRowIdx + 2, c: 3 } },
            { s: { r: signOffRowIdx + 2, c: 4 }, e: { r: signOffRowIdx + 2, c: 7 } },
            { s: { r: signOffRowIdx + 3, c: 0 }, e: { r: signOffRowIdx + 3, c: 1 } },
            { s: { r: signOffRowIdx + 3, c: 2 }, e: { r: signOffRowIdx + 3, c: 3 } },
            { s: { r: signOffRowIdx + 3, c: 4 }, e: { r: signOffRowIdx + 3, c: 7 } }
        ];

        if (reflection) {
            merges.push(
                { s: { r: signOffRowIdx - 3, c: 0 }, e: { r: signOffRowIdx - 3, c: 7 } },
                { s: { r: signOffRowIdx - 2, c: 0 }, e: { r: signOffRowIdx - 2, c: 7 } }
            );
        }

        ws['!merges'] = merges;

        ws['!pageSetup'] = {
            orientation: 'landscape',
            paperSize: 9, // A4
            scale: 85,
            fitToWidth: 1,
            fitToHeight: 0
        };

        ws['!margins'] = {
            left: 0.5,
            right: 0.5,
            top: 0.75,
            bottom: 0.75,
            header: 0.3,
            footer: 0.3
        };

        const totalDataRows = termLessons.length > 0 ? termLessons.length : 1;
        ws['!autofilter'] = { ref: `A7:H${7 + totalDataRows}` };

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    return wb;
}

export function buildAssessmentWorkbook(
    content: GeneratedContent,
    assessmentExportType?: AssessmentExportType,
    headerInfo?: ExportHeaderInfo,
    XLSX?: any
): any {
    const wb = XLSX.utils.book_new();
    const questions: any[] = Array.isArray(content.questions) ? content.questions : [];

    const schoolName = (headerInfo?.schoolName || (content as any).schoolName || content.metadata?.schoolId || 'Exameno School').trim();
    const grade = (headerInfo?.gradeLevel || content.metadata?.grade || 'Grade Level').trim();
    const subject = (headerInfo?.subject || content.metadata?.subject || 'Subject').trim();
    const teacherName = (headerInfo?.teacherName || 'Examiner / Teacher').trim();
    const term = (headerInfo?.term || content.metadata?.term || 'Term 1').trim();

    const rows: (string | number)[][] = [];

    // Header
    rows.push(['EXAMENO CBE CONTENT GENERATOR — ASSESSMENT & MARKING SCHEME', '', '', '', '', '']);
    rows.push(['KICD/TSC-ALIGNED PROFESSIONAL ASSESSMENT FORMAT', '', '', '', '', '']);
    rows.push(['', '', '', '', '', '']);

    rows.push([
        'School:',
        schoolName,
        '',
        'Grade / Level:',
        grade,
        'Subject:'
    ]);

    rows.push([
        'Teacher:',
        teacherName,
        '',
        'Term / Year:',
        term,
        `Total Items: ${questions.length}`
    ]);

    rows.push(['', '', '', '', '', '']);

    // Table Header
    rows.push([
        'Item #',
        'Question Type',
        'Question Text',
        'Marks',
        'Correct Answer / Scoring Key',
        'Explanation / Marking Rubric'
    ]);

    if (questions.length === 0) {
        rows.push(['No assessment questions found.', '', '', '', '', '']);
    } else {
        questions.forEach((q, idx) => {
            rows.push([
                idx + 1,
                q.questionType || 'Question',
                cleanText(q.questionText || ''),
                q.marks || 1,
                cleanText(q.correctAnswer || q.correctOption || ''),
                cleanText(q.explanation || '')
            ]);
        });
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);

    ws['!cols'] = [
        { wch: 8 },  // Item #
        { wch: 18 }, // Type
        { wch: 45 }, // Question
        { wch: 8 },  // Marks
        { wch: 28 }, // Answer
        { wch: 35 }  // Explanation
    ];

    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }
    ];

    ws['!pageSetup'] = { orientation: 'landscape', paperSize: 9 };

    XLSX.utils.book_append_sheet(wb, ws, 'Assessment');
    return wb;
}

export function buildGeneralWorkbook(content: GeneratedContent, headerInfo?: ExportHeaderInfo, XLSX?: any): any {
    const wb = XLSX.utils.book_new();
    const rows: (string | number)[][] = [];

    const title = content.title || 'Exameno Educational Resource';
    const schoolName = (headerInfo?.schoolName || (content as any).schoolName || 'Exameno School').trim();
    const grade = (headerInfo?.gradeLevel || content.metadata?.grade || '').trim();
    const subject = (headerInfo?.subject || content.metadata?.subject || '').trim();

    rows.push([title, '', '', '']);
    rows.push(['KICD/TSC-ALIGNED PROFESSIONAL WORKBOOK FORMAT', '', '', '']);
    rows.push(['', '', '', '']);
    rows.push(['School:', schoolName, 'Grade / Subject:', `${grade} ${subject}`.trim()]);
    rows.push(['', '', '', '']);

    if (content.body) {
        const lines = content.body.split('\n');
        lines.forEach(line => {
            rows.push([cleanText(line), '', '', '']);
        });
    } else {
        rows.push(['No additional tabular data found.', '', '', '']);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 45 }, { wch: 25 }, { wch: 25 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Content');
    return wb;
}

export async function formatAsExcel(
    content: GeneratedContent,
    assessmentExportType?: AssessmentExportType,
    headerInfo?: ExportHeaderInfo
): Promise<Blob> {
    const XLSX = await getXlsxInstance();
    let wb: any;

    if (content.schemeOfWorkData) {
        wb = buildSowWorkbook(content, headerInfo, XLSX);
    } else if (content.rowcData) {
        wb = buildRowcWorkbook(content, headerInfo, XLSX);
    } else if (content.questions && content.questions.length > 0) {
        wb = buildAssessmentWorkbook(content, assessmentExportType, headerInfo, XLSX);
    } else {
        wb = buildGeneralWorkbook(content, headerInfo, XLSX);
    }

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function parseMarkdownToDocx(markdown: string, docx: any): any[] {
    const { Paragraph, TextRun, HeadingLevel, BorderStyle, Table, TableRow, TableCell, WidthType } = docx;
    if (!markdown) return [];
    
    const children: any[] = [];
    const lines = markdown.split('\n');
    
    let tableBuffer: string[][] = [];
    let inTable = false;

    const flushTable = () => {
        if (tableBuffer.length > 0) {
             const rows = tableBuffer.map((row, rowIndex) => {
                 const isHeader = rowIndex === 0 || (rowIndex === 1 && row.every(c => c.match(/^-+$/)));
                 if (rowIndex === 1 && row.every(c => c.match(/^-+$/))) return null; // Skip separator row

                 return new TableRow({
                     children: row.map(cell => new TableCell({
                         children: [new Paragraph({ text: cell.trim() })],
                         width: { size: 100 / row.length, type: WidthType.PERCENTAGE },
                         shading: isHeader ? { fill: "EEEEEE" } : undefined
                     }))
                 });
             }).filter(r => r !== null);

             children.push(new Table({
                 rows: rows as any[],
                 width: { size: 100, type: WidthType.PERCENTAGE },
                 borders: {
                     top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                     bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                     left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                     right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                     insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                     insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                 }
             }));
             tableBuffer = [];
             inTable = false;
        }
    };

    for (const line of lines) {
        const trimmed = line.trim();

        // Handle Table
        if (trimmed.startsWith('|')) {
             if (!inTable) inTable = true;
             const cells = trimmed.split('|').slice(1, -1);
             tableBuffer.push(cells);
             continue;
        } else {
             if (inTable) flushTable();
        }
        
        if (!trimmed) continue;

        if (trimmed === '---' || trimmed === '***') {
            children.push(new Paragraph({
                border: { bottom: { color: "BDC3C7", space: 1, style: BorderStyle.SINGLE, size: 6 } },
                spacing: { before: 240, after: 240 }
            }));
            continue;
        }

        if (trimmed.startsWith('# ')) {
             children.push(new Paragraph({
                children: [new TextRun({ text: cleanText(trimmed.substring(2)), bold: true, size: 32, font: "Arial" })],
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }));
        } else if (trimmed.startsWith('## ')) {
             children.push(new Paragraph({
                children: [new TextRun({ text: cleanText(trimmed.substring(3)), bold: true, size: 28, font: "Arial", color: BRAND_COLOR })],
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 150 }
            }));
        } else if (trimmed.startsWith('### ')) {
             children.push(new Paragraph({
                children: [new TextRun({ text: cleanText(trimmed.substring(4)), bold: true, size: 24, font: "Arial" })],
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 250, after: 120 }
            }));
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            // Bullet list
            children.push(new Paragraph({
                children: [new TextRun({ text: cleanText(trimmed.substring(2)), font: "Arial" })],
                bullet: { level: 0 },
                spacing: { after: 100 }
            }));
        } else if (trimmed.match(/^\d+\.\s/)) {
            // Numbered list
            const content = trimmed.replace(/^\d+\.\s/, '');
            children.push(new Paragraph({
                children: [new TextRun({ text: cleanText(content), font: "Arial" })],
                numbering: { reference: "default-numbering", level: 0 },
                spacing: { after: 100 }
            }));
        } else {
             const lineChildren: any[] = [];
             const parts = line.split(/(\*\*.*?\*\*|<u>.*?<\/u>)/g);
             parts.forEach(part => {
                 if (part.startsWith('**') && part.endsWith('**')) {
                     lineChildren.push(new TextRun({ text: part.slice(2, -2), bold: true, font: "Arial" }));
                 } else if (part.startsWith('<u>') && part.endsWith('</u>')) {
                     const innerText = part.slice(3, -4);
                     const isBold = innerText.startsWith('**') && innerText.endsWith('**');
                     lineChildren.push(new TextRun({ 
                         text: isBold ? innerText.slice(2, -2) : innerText, 
                         underline: {}, 
                         bold: isBold,
                         font: "Arial" 
                    }));
                 } else {
                     lineChildren.push(new TextRun({ text: part, font: "Arial" }));
                 }
             });
             children.push(new Paragraph({ children: lineChildren, spacing: { after: 120 } }));
        }
    }
    
    if (inTable) flushTable();
    return children;
}

// Helper to convert base64 string to Uint8Array for docx image
function base64ToUint8Array(base64: string) {
    const binaryString = window.atob(base64.split(',')[1]); // Remove data:image... prefix
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}


export async function formatAsDocx(content: GeneratedContent, assessmentExportType: AssessmentExportType, headerInfo?: ExportHeaderInfo): Promise<Blob> {
    // Every SOW Word export must be populated from the approved Exameno master template.
    if (content.schemeOfWorkData) return formatSowAsDocx(content, headerInfo);
    const docx = await waitForGlobal('docx');
    const { Document, Packer, Paragraph, TextRun, AlignmentType, Footer, PageNumber, BorderStyle, PageBreak, Table, TableRow, TableCell, WidthType, HeadingLevel, ImageRun } = docx;
    
    const children: any[] = [];
    const isLandscape = content.metadata?.contentType === ContentType.SchemeOfWork || content.metadata?.contentType === ContentType.RecordOfWorkCovered;
    const isAssessment = [ContentType.Assessment, ContentType.Quiz, ContentType.TopicExam, ContentType.TermExam].includes(content.metadata?.contentType as ContentType) && content.questions && content.questions.length > 0;

    if (isAssessment) {
        const mcqQuestions = content.questions!.filter(q => q.questionType === QuestionType.MultipleChoice);
        const structuredQuestions = content.questions!.filter(q => q.questionType !== QuestionType.MultipleChoice);
        const totalQuestions = content.questions!.length;
        const mcqMarks = mcqQuestions.reduce((sum, q) => sum + (q.marks || 1), 0);
        const structuredMarks = structuredQuestions.reduce((sum, q) => sum + (q.marks || 5), 0);
        const totalMarks = mcqMarks + structuredMarks;
        
        const headerText = `${content.metadata?.grade || ''} - ${content.metadata?.subject || ''} - ${content.metadata?.contentType || ''}`;
        children.push(new Paragraph({ text: headerText.toUpperCase(), alignment: AlignmentType.CENTER, style: 'coverHeaderStyle' }));
        
        const exportTypeString = assessmentExportType === AssessmentExportType.QuestionsOnly ? 'Students Copy' : 'Teachers Marking Guide';
        children.push(new Paragraph({ text: exportTypeString, alignment: AlignmentType.CENTER, style: 'coverSubheaderStyle', spacing: { after: 100 } }));

        if (content.metadata?.topic) {
            children.push(new Paragraph({ text: `Topics Covered: ${content.metadata.topic.replace('Content covering the following curriculum topics:', '').trim()}`, alignment: AlignmentType.CENTER, style: 'coverSubheaderStyle' }));
        }

        children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
        children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: [10, 40, 10, 40],
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            rows: [
                new TableRow({ children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Name:", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ text: "_".repeat(40) })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Date:", bold: true })], alignment: AlignmentType.RIGHT })] }),
                    new TableCell({ children: [new Paragraph({ text: "_".repeat(25) })] }),
                ]})
            ],
        }));

        children.push(new Paragraph({ text: "Instructions to Candidates", heading: HeadingLevel.HEADING_2, style: 'underlineHeading', spacing: { before: 300, after: 100 } }));
        const instructions = [ 'Write your name in the spaces provided above.', 'This paper consists of two sections: A and B.', 'Answer ALL the questions in the spaces provided.', 'All working MUST be clearly shown where applicable.', `This paper consists of ${totalQuestions} questions.`, 'Candidates should check the question paper to ascertain that all the pages are printed as indicated and that no questions are missing.' ];
        instructions.forEach(inst => children.push(new Paragraph({ text: inst, numbering: { reference: "instructions-numbering", level: 0 } })));
        
        children.push(new Paragraph({ text: "Question Breakdown", heading: HeadingLevel.HEADING_2, style: 'underlineHeading', spacing: { before: 300, after: 100 } }));
        children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({ tableHeader: true, children: [ new TableCell({ children: [new Paragraph("Section")] }), new TableCell({ children: [new Paragraph("Question Type")] }), new TableCell({ children: [new Paragraph("Number of Questions")] }), new TableCell({ children: [new Paragraph("Marks")] }) ]}),
                new TableRow({ children: [ new TableCell({ children: [new Paragraph("A")] }), new TableCell({ children: [new Paragraph("Multiple Choice")] }), new TableCell({ children: [new Paragraph({ text: `${mcqQuestions.length}`, alignment: AlignmentType.CENTER })] }), new TableCell({ children: [new Paragraph({ text: `${mcqMarks}`, alignment: AlignmentType.CENTER })] }) ]}),
                new TableRow({ children: [ new TableCell({ children: [new Paragraph("B")] }), new TableCell({ children: [new Paragraph("Structured Questions")] }), new TableCell({ children: [new Paragraph({ text: `${structuredQuestions.length}`, alignment: AlignmentType.CENTER })] }), new TableCell({ children: [new Paragraph({ text: `${structuredMarks}`, alignment: AlignmentType.CENTER })] }) ]}),
                new TableRow({ children: [ new TableCell({ children: [new Paragraph({ text: "Total", alignment: AlignmentType.RIGHT })], colSpan: 3 }), new TableCell({ children: [new Paragraph({ text: `${totalMarks}`, alignment: AlignmentType.CENTER })] }) ]}),
            ],
        }));

        children.push(new Paragraph({ text: "For Official Use Only:", heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 100 } }));
        if (mcqQuestions.length > 0) {
            children.push(new Paragraph({ text: `SECTION A: MULTIPLE CHOICE (${mcqMarks} MARKS)`, heading: HeadingLevel.HEADING_3, style: 'underlineHeading' }));
            const headerCells = [new TableCell({ children: [new Paragraph("Question No.")] })];
            const scoreCells = [new TableCell({ children: [new Paragraph("Candidate's Score")] })];
            mcqQuestions.forEach((_, i) => {
                headerCells.push(new TableCell({ children: [new Paragraph({ text: `${i + 1}`, alignment: AlignmentType.CENTER })] }));
                scoreCells.push(new TableCell({ children: [new Paragraph(" ")] }));
            });
            children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: headerCells }), new TableRow({ children: scoreCells })] }));
        }
        if (structuredQuestions.length > 0) {
            children.push(new Paragraph({ text: `SECTION B: STRUCTURED QUESTIONS (${structuredMarks} MARKS)`, heading: HeadingLevel.HEADING_3, style: 'underlineHeading', spacing: { before: 200 } }));
            const headerCells = [new TableCell({ children: [new Paragraph("Question No.")] })];
            const scoreCells = [new TableCell({ children: [new Paragraph("Candidate's Score")] })];
            structuredQuestions.forEach((_, i) => {
                headerCells.push(new TableCell({ children: [new Paragraph({ text: `${mcqQuestions.length + i + 1}`, alignment: AlignmentType.CENTER })] }));
                scoreCells.push(new TableCell({ children: [new Paragraph(" ")] }));
            });
            children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: headerCells }), new TableRow({ children: scoreCells })] }));
        }

        children.push(new PageBreak());

        // --- QUESTIONS ---
        if (mcqQuestions.length > 0) {
            children.push(new Paragraph({ text: "SECTION A: MULTIPLE CHOICE", heading: HeadingLevel.HEADING_2, style: 'underlineHeading', spacing: { before: 300, after: 200 } }));
            mcqQuestions.forEach((q, index) => {
                const marks = q.marks || 1;
                children.push(new Paragraph({ children: [
                    new TextRun({ text: `${index + 1}. `, bold: true }), 
                    new TextRun(cleanText(q.questionText)),
                    new TextRun({ text: ` (${marks} ${marks === 1 ? 'mark' : 'marks'})`, italics: true, size: 22 })
                ]}));
                
                // Embed image if available
                if (q.imageUrl) {
                    try {
                        const imageBuffer = base64ToUint8Array(q.imageUrl);
                        children.push(new Paragraph({
                            children: [
                                new ImageRun({
                                    data: imageBuffer,
                                    transformation: { width: 200, height: 200 },
                                }),
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 100 }
                        }));
                    } catch (e) {
                        console.error("Failed to add image to word doc", e);
                    }
                }

                if (q.options) {
                    q.options.forEach((opt, i) => children.push(new Paragraph({ text: `${String.fromCharCode(65 + i)}. ${cleanText(opt)}`, indent: { left: 720 } })));
                }
                if (assessmentExportType === AssessmentExportType.QuestionsAndAnswers) {
                    children.push(new Paragraph({ children: [new TextRun({ text: "Answer: " + cleanText(q.correctAnswer), color: '2E7D32', bold: true })], indent: { left: 360 } }));
                    if (q.explanation) {
                        children.push(new Paragraph({ children: [new TextRun({ text: "Explanation: " + cleanText(q.explanation), color: '555555', italics: true })], indent: { left: 360 } }));
                    }
                }
                children.push(new Paragraph("")); // Spacer
            });
        }
        if (structuredQuestions.length > 0) {
            if (mcqQuestions.length > 0) children.push(new PageBreak());
            children.push(new Paragraph({ text: "SECTION B: STRUCTURED QUESTIONS", heading: HeadingLevel.HEADING_2, style: 'underlineHeading', spacing: { before: 300, after: 200 } }));
            structuredQuestions.forEach((q, index) => {
                const marks = q.marks || 5;
                children.push(new Paragraph({ children: [
                    new TextRun({ text: `${mcqQuestions.length + index + 1}. `, bold: true }),
                    new TextRun(cleanText(q.questionText)),
                    new TextRun({ text: ` (${marks} ${marks === 1 ? 'mark' : 'marks'})`, italics: true, size: 22 })
                ]}));

                // Embed image if available
                if (q.imageUrl) {
                    try {
                        const imageBuffer = base64ToUint8Array(q.imageUrl);
                        children.push(new Paragraph({
                            children: [
                                new ImageRun({
                                    data: imageBuffer,
                                    transformation: { width: 200, height: 200 },
                                }),
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 100 }
                        }));
                    } catch (e) {
                        console.error("Failed to add image to word doc", e);
                    }
                }

                if (assessmentExportType === AssessmentExportType.QuestionsAndAnswers) {
                     children.push(new Paragraph({ children: [new TextRun({ text: "Answer: " + cleanText(q.correctAnswer), color: '2E7D32', bold: true })], indent: { left: 360 } }));
                     if (q.explanation) {
                        children.push(new Paragraph({ children: [new TextRun({ text: "Explanation: " + cleanText(q.explanation), color: '555555', italics: true })], indent: { left: 360 } }));
                    }
                } else {
                    const lines = Math.max(2, Math.floor(marks / 2));
                    for (let i = 0; i < lines; i++) {
                        children.push(new Paragraph({ spacing: { after: 300 } }));
                    }
                }
                 children.push(new Paragraph(""));
            });
        }

    } else {
        // --- ORIGINAL LOGIC FOR OTHER CONTENT ---
        children.push(new Paragraph({
            children: [new TextRun({ text: (content.metadata?.grade || '') + " – " + (content.metadata?.subject || ''), font: "Arial", bold: true, size: 36, color: BRAND_COLOR })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 800, after: 100 }
        }));
        
        const sowDataForExport = (content as unknown as { schemeOfWorkData?: { term?: string; entries: any[] } }).schemeOfWorkData;
        const subTitleText = (content.metadata?.contentType === ContentType.SchemeOfWork && sowDataForExport?.term)
            ? `${content.metadata.contentType} (${sowDataForExport.term})`
            : content.metadata?.contentType || 'Study Guide';

        children.push(new Paragraph({
            children: [new TextRun({ text: subTitleText, font: "Arial", size: 28, color: '555555' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 }
        }));
        
        if (sowDataForExport) {
            const headers = ['Week', 'Lesson', 'Strand', 'Sub-Strand', 'Specific Learning Outcomes', 'Learning Experiences', 'Key Inquiry Questions', 'Learning Resources', 'Assessment Methods', 'Remarks'];
            const headerRow = new TableRow({
                tableHeader: true,
                children: headers.map(header => new TableCell({
                    children: [new Paragraph({ text: header, bold: true, style: 'tableHeaderStyle' })],
                    shading: { fill: "E0E0E0" }
                })),
            });
    
            const dataRows = sowDataForExport.entries.map((entry: any) => {
                const outcomesVal = entry.learningOutcomes || (entry as any).specificLearningOutcomes || (entry as any).learningOutcomesText || '';
                const inquiryVal = entry.inquiryQuestions || (entry as any).keyInquiryQuestions || '';
                const experiencesVal = entry.learningExperiences || (entry as any).content || (entry as any).learningExperience || '';
                const resourcesVal = entry.learningResources || (entry as any).resources || '';
                const assessmentVal = entry.assessment || (entry as any).assessmentMethods || '';
                const remarksVal = entry.remarks || '';
                const strandVal = entry.strand || (entry as any).strandTitle || '';
                const subStrandVal = entry.subStrand || (entry as any).subStrandTitle || '';

                return new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ text: String(entry.week || ''), style: 'tableCellStyle' })] }),
                        new TableCell({ children: [new Paragraph({ text: String(entry.lesson || ''), style: 'tableCellStyle' })] }),
                        new TableCell({ children: [new Paragraph({ text: strandVal, style: 'tableCellStyle' })] }),
                        new TableCell({ children: [new Paragraph({ text: subStrandVal, style: 'tableCellStyle' })] }),
                        new TableCell({ children: parseMarkdownToDocx(outcomesVal, docx) }),
                        new TableCell({ children: parseMarkdownToDocx(experiencesVal, docx) }),
                        new TableCell({ children: parseMarkdownToDocx(inquiryVal, docx) }),
                        new TableCell({ children: parseMarkdownToDocx(resourcesVal, docx) }),
                        new TableCell({ children: [new Paragraph({ text: assessmentVal, style: 'tableCellStyle' })] }),
                        new TableCell({ children: [new Paragraph({ text: remarksVal, style: 'tableCellStyle' })] }),
                    ],
                });
            });
    
            children.push(new Table({
                rows: [headerRow, ...dataRows],
                width: { size: 100, type: WidthType.PERCENTAGE },
                columnWidths: [4, 4, 10, 10, 18, 18, 12, 12, 8, 4],
            }));
        } else if (content.rowcData) {
            const headers = ['Date', 'Grade', 'Subject', 'Lesson Title', 'Learning Activities', 'Resources', 'Assessment', 'Remarks'];
            const headerRow = new TableRow({
                tableHeader: true,
                children: headers.map(header => new TableCell({
                    children: [new Paragraph({ text: header, bold: true, style: 'tableHeaderStyle' })],
                    shading: { fill: "E0E0E0" }
                })),
            });
    
            const dataRows = content.rowcData.lessons.map(lesson => new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ text: lesson.date, style: 'tableCellStyle' })] }),
                    new TableCell({ children: [new Paragraph({ text: lesson.grade, style: 'tableCellStyle' })] }),
                    new TableCell({ children: [new Paragraph({ text: lesson.subject, style: 'tableCellStyle' })] }),
                    new TableCell({ children: [new Paragraph({ text: lesson.lessonTitle, style: 'tableCellStyle' })] }),
                    new TableCell({ children: parseMarkdownToDocx(lesson.learningActivities, docx) }),
                    new TableCell({ children: [new Paragraph({ text: lesson.resources, style: 'tableCellStyle' })] }),
                    new TableCell({ children: [new Paragraph({ text: lesson.assessment, style: 'tableCellStyle' })] }),
                    new TableCell({ children: parseMarkdownToDocx(lesson.remarks, docx) }),
                ],
            }));
            
            children.push(new Table({
                rows: [headerRow, ...dataRows],
                width: { size: 100, type: WidthType.PERCENTAGE },
            }));
        } else if (content.body && headerInfo?.includeBody !== false) {
            children.push(...parseMarkdownToDocx(content.body, docx));
        }
    }

    if (headerInfo?.includeRubric && content.rubric) {
        children.push(new PageBreak());
        children.push(new Paragraph({ text: "AI GRADING RUBRIC", heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER, color: BRAND_COLOR }));
        children.push(...parseMarkdownToDocx(content.rubric, docx));
    }

    const doc = new Document({
        styles: {
            paragraphStyles: [
                { id: "coverHeaderStyle", name: "Cover Header", run: { size: 32, bold: true } },
                { id: "coverSubheaderStyle", name: "Cover Subheader", run: { size: 28, italics: true } },
                { id: "underlineHeading", name: "Underline Heading", run: { underline: {} } },
                { id: "tableHeaderStyle", name: "Table Header Style", run: { font: "Arial", size: 18, bold: true } },
                { id: "tableCellStyle", name: "Table Cell Style", run: { font: "Arial", size: 18 } }
            ]
        },
        numbering: {
            config: [
                {
                    reference: "default-numbering",
                    levels: [ { level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720, hanging: 260 } } } } ],
                },
                {
                    reference: "instructions-numbering",
                    levels: [ { level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720, hanging: 260 } } } } ],
                },
            ],
        },
        sections: [{ 
            properties: { page: { size: { orientation: isLandscape ? "landscape" : "portrait" } } },
            footers: {
                default: new Footer({
                    children: [
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [70, 30],
                            rows: [
                                new TableRow({
                                    children: [
                                        new TableCell({
                                            children: [new Paragraph({ text: "Created by Exameno CBE Content Generator (ECG) 2026 - 0717713493", alignment: AlignmentType.LEFT })],
                                            borders: { top: { style: BorderStyle.SINGLE, size: 2, color: "auto" }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                                        }),
                                        new TableCell({
                                            children: [new Paragraph({
                                                children: [new TextRun("Page "), new TextRun({ children: [PageNumber.CURRENT] }), new TextRun(" of "), new TextRun({ children: [PageNumber.TOTAL_PAGES] })],
                                                alignment: AlignmentType.RIGHT,
                                            })],
                                            borders: { top: { style: BorderStyle.SINGLE, size: 2, color: "auto" }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                                        }),
                                    ],
                                }),
                            ],
                        }),
                    ],
                }),
            },
            children 
        }]
    });

    return Packer.toBlob(doc);
}

export async function formatAsPptx(content: GeneratedContent, headerInfo?: ExportHeaderInfo): Promise<Blob> {
    const PptxGenJS = await waitForGlobal('PptxGenJS');
    const pres = new PptxGenJS();
    pres.layout = 'LAYOUT_16x9';

    const slide1 = pres.addSlide();
    slide1.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: BRAND_COLOR } });
    
    slide1.addText(content.title.toUpperCase(), { 
        x: 0.5, y: 1.5, w: 9, h: 1.0, 
        fontSize: 24, bold: true, align: 'center', color: 'FFFFFF', fontFace: 'Arial'
    });

    if (content.body) {
        const sections = content.body.split(/(?=\n#+ )/); 
        sections.forEach(section => {
            const slide = pres.addSlide();
            slide.addText(cleanText(section).substring(0, 1000), { 
                x: 0.5, y: 0.5, w: 9, h: 4.5, 
                fontSize: 16, valign: 'top', color: '333333', fontFace: 'Arial'
            });
        });
    }

    const blob = await pres.write("blob");
    return new Blob([blob], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

export function formatAsMoodleXml(content: GeneratedContent): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<quiz>\n`;

    // Add a category question to organize quiz questions in Moodle's Question Bank
    const gradeVal = content.metadata?.grade || 'Grade';
    const subjVal = content.metadata?.subject || 'Subject';
    const topicVal = content.metadata?.topic || 'General';
    const categoryPath = `$course$/Exameno/${escapeXml(gradeVal)}/${escapeXml(subjVal)}/${escapeXml(topicVal)}`;
    
    xml += `  <!-- question: 0 -->\n`;
    xml += `  <question type="category">\n`;
    xml += `    <category>\n`;
    xml += `      <text>${categoryPath}</text>\n`;
    xml += `    </category>\n`;
    xml += `    <info format="html">\n`;
    xml += `      <text><![CDATA[Generated CBE/CBC Assessments by Exameno Content Generator]]></text>\n`;
    xml += `    </info>\n`;
    xml += `    <idnumber></idnumber>\n`;
    xml += `  </question>\n\n`;

    if (content.questions && content.questions.length > 0) {
        content.questions.forEach((q, index) => {
            const questionIndex = index + 1;
            const moodleType = mapQuestionTypeToMoodle(q.questionType);
            const defaultGrade = q.marks ? q.marks.toFixed(7) : "1.0000000";
            
            xml += `  <!-- question: ${questionIndex} -->\n`;
            xml += `  <question type="${moodleType}">\n`;
            
            // Name
            xml += `    <name>\n`;
            xml += `      <text><![CDATA[Q${questionIndex}: ${escapeXml(truncateText(q.questionText, 50))}]]></text>\n`;
            xml += `    </name>\n`;

            // Question text
            let qTextHtml = `<p>${escapeXml(q.questionText)}</p>`;
            if (q.imageUrl) {
                qTextHtml += `<p><img src="${escapeXml(q.imageUrl)}" alt="Question Image" style="max-width:100%; height:auto;" /></p>`;
            }
            if (q.marks) {
                qTextHtml += `<p><em>(${q.marks} Marks)</em></p>`;
            }
            xml += `    <questiontext format="html">\n`;
            xml += `      <text><![CDATA[${qTextHtml}]]></text>\n`;
            xml += `    </questiontext>\n`;

            // Feedback/Explanation
            let fbHtml = "";
            if (q.explanation) {
                fbHtml += `<p><strong>Explanation:</strong> ${escapeXml(q.explanation)}</p>`;
            }
            if (q.correctAnswer && moodleType !== 'shortanswer') {
                fbHtml += `<p><strong>Marking Guide:</strong> ${escapeXml(q.correctAnswer)}</p>`;
            }
            xml += `    <generalfeedback format="html">\n`;
            xml += `      <text><![CDATA[${fbHtml}]]></text>\n`;
            xml += `    </generalfeedback>\n`;

            // Default settings
            xml += `    <defaultgrade>${defaultGrade}</defaultgrade>\n`;
            xml += `    <penalty>0.3333333</penalty>\n`;
            xml += `    <hidden>0</hidden>\n`;
            xml += `    <idnumber></idnumber>\n`;

            if (moodleType === 'multichoice') {
                xml += `    <single>true</single>\n`;
                xml += `    <shuffleanswers>true</shuffleanswers>\n`;
                xml += `    <answernumbering>abc</answernumbering>\n`;
                xml += `    <showstandardinstruction>0</showstandardinstruction>\n`;
                xml += `    <correctfeedback format="html">\n`;
                xml += `      <text><![CDATA[<p>Your answer is correct.</p>]]></text>\n`;
                xml += `    </correctfeedback>\n`;
                xml += `    <partiallycorrectfeedback format="html">\n`;
                xml += `      <text><![CDATA[<p>Your answer is partially correct.</p>]]></text>\n`;
                xml += `    </partiallycorrectfeedback>\n`;
                xml += `    <incorrectfeedback format="html">\n`;
                xml += `      <text><![CDATA[<p>Your answer is incorrect.</p>]]></text>\n`;
                xml += `    </incorrectfeedback>\n`;
                xml += `    <shownumcorrect/>\n`;

                const options = q.options || [];
                options.forEach((optText, optIndex) => {
                    const letter = String.fromCharCode(65 + optIndex); // A, B, C, D
                    
                    let isCorrect = false;
                    if (q.correctOption) {
                        isCorrect = q.correctOption.trim().toUpperCase() === letter;
                    } else {
                        isCorrect = q.correctAnswer === optText || q.correctAnswer === letter;
                    }

                    const fraction = isCorrect ? "100" : "0";
                    const fb = isCorrect ? "<p>Correct!</p>" : "<p>Incorrect option</p>";

                    xml += `    <answer fraction="${fraction}" format="html">\n`;
                    xml += `      <text><![CDATA[<p>${escapeXml(optText)}</p>]]></text>\n`;
                    xml += `      <feedback format="html">\n`;
                    xml += `        <text><![CDATA[${fb}]]></text>\n`;
                    xml += `      </feedback>\n`;
                    xml += `    </answer>\n`;
                });
            } else if (moodleType === 'truefalse') {
                const ansLower = (q.correctAnswer || '').toLowerCase().trim();
                const isTrueCorrect = ansLower.includes('true') || ansLower === 't' || q.correctOption === 'A' || q.correctOption === 'T';

                xml += `    <answer fraction="${isTrueCorrect ? '100' : '0'}" format="html">\n`;
                xml += `      <text><![CDATA[True]]></text>\n`;
                xml += `      <feedback format="html">\n`;
                xml += `        <text></text>\n`;
                xml += `      </feedback>\n`;
                xml += `    </answer>\n`;

                xml += `    <answer fraction="${isTrueCorrect ? '0' : '100'}" format="html">\n`;
                xml += `      <text><![CDATA[False]]></text>\n`;
                xml += `      <feedback format="html">\n`;
                xml += `        <text></text>\n`;
                xml += `      </feedback>\n`;
                xml += `    </answer>\n`;
            } else if (moodleType === 'shortanswer') {
                xml += `    <usecase>0</usecase>\n`;
                xml += `    <answer fraction="100" format="plain">\n`;
                xml += `      <text><![CDATA[${escapeXml(q.correctAnswer)}]]></text>\n`;
                xml += `      <feedback format="html">\n`;
                xml += `        <text><![CDATA[<p>Correct answer!</p>]]></text>\n`;
                xml += `      </feedback>\n`;
                xml += `    </answer>\n`;
            } else if (moodleType === 'essay') {
                xml += `    <responseformat>editor</responseformat>\n`;
                xml += `    <responserequired>1</responserequired>\n`;
                xml += `    <responsefieldlines>15</responsefieldlines>\n`;
                xml += `    <attachments>0</attachments>\n`;
                xml += `    <attachmentsrequired>0</attachmentsrequired>\n`;
                xml += `    <graderinfo format="html">\n`;
                xml += `      <text><![CDATA[<p><strong>Proposed Grading Guideline:</strong></p><p>${escapeXml(q.correctAnswer)}</p>${q.explanation ? `<p><strong>Explanation:</strong> ${escapeXml(q.explanation)}</p>` : ''}]]></text>\n`;
                xml += `    </graderinfo>\n`;
                xml += `    <responsetemplate format="html">\n`;
                xml += `      <text></text>\n`;
                xml += `    </responsetemplate>\n`;
            }

            xml += `  </question>\n\n`;
        });
    }

    xml += `</quiz>\n`;
    return xml;
}

function mapQuestionTypeToMoodle(type: QuestionType): string {
    switch (type) {
        case QuestionType.MultipleChoice:
            return 'multichoice';
        case QuestionType.TrueFalse:
            return 'truefalse';
        case QuestionType.ShortAnswer:
            return 'shortanswer';
        case QuestionType.Essay:
        case QuestionType.Discussion:
            return 'essay';
        default:
            return 'essay';
    }
}

function truncateText(text: string, length: number): string {
    if (!text) return "";
    const clean = text.replace(/[*#_]/g, '').trim();
    if (clean.length <= length) return clean;
    return clean.substring(0, length) + "...";
}

function escapeXml(unsafe: string): string {
    if (!unsafe) return "";
    // Inside CDATA, only ]]> is illegal. We can safely escape it.
    return unsafe.replace(/\]\]>/g, ']]]]><![CDATA[>');
}
