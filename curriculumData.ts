
import { LESSON_BREAKDOWNS } from './data/curriculum/index.ts';

export interface GradeCurriculum {
  [strand: string]: string[];
}

export interface Curriculum {
  [subject: string]: {
    [grade: string]: GradeCurriculum;
  };
}

const toProperCase = (str: string) => {
    if (!str) return str;
    // Keep acronyms like CRE, ICT, PP1, etc. uppercase
    if (str.length <= 4 && str === str.toUpperCase()) return str;
    return str.toLowerCase().replace(/(?:^|\s|[-'"])\w/g, (match) => match.toUpperCase());
};

const prePrimaryCurriculum: Curriculum = {
  'Creative Activities': {
    'PP1': { 'Art': ['Drawing', 'Colouring', 'Painting'], 'Music': ['Singing simple songs'], 'Movement': ['Creative dance'] },
    'PP2': { 'Art': ['Making patterns', 'Modelling with clay'], 'Music': ['Singing in rounds'], 'Movement': ['Role play'] },
  },
  'Environmental Activities': {
    'PP1': { 'Our School': ['People in school'], 'Weather': ['Sunny', 'Rainy'], 'Plants and Animals': ['Common plants'] },
    'PP2': { 'Our Community': ['Community helpers'], 'Water': ['Sources of water'], 'Soil': ['Types of soil'] },
  },
};

const lowerPrimaryCurriculum: Curriculum = {
  'English': {
    'Grade 1': { 'Listening and Speaking': ['Greetings', 'Rhymes'], 'Reading': ['Picture Reading', 'Letters'], 'Grammar': ['Articles'], 'Writing': ['Tracing'] },
    'Grade 2': { 'Listening and Speaking': ['Expressing Feelings'], 'Reading': ['Reading Sentences'], 'Grammar': ['Pronouns'], 'Writing': ['Sentences'] },
  },
  'Mathematics': {
    'Grade 1': { 'Numbers': ['Counting'], 'Measurement': ['Length'], 'Geometry': ['Shapes'] },
    'Grade 2': { 'Numbers': ['Place Value'], 'Measurement': ['Calendar'], 'Geometry': ['Lines'] },
  },
};

export const CURRICULUM_DATA: Curriculum = { ...prePrimaryCurriculum, ...lowerPrimaryCurriculum };

export function getPossibleLessonKeys(grade: string, subject: string): string[] {
    if (!grade || !subject) return [];

    const normGrade = grade.toUpperCase().trim().replace(/\s+/g, '_');
    const normSub = subject.toUpperCase().trim().replace(/ & /g, '_&_').replace(/\s+/g, '_');
    const rawSub = subject.trim();

    const keys = new Set<string>();

    keys.add(`${normGrade}_${normSub}_LESSON_BREAKDOWN`);

    const normClean = normSub.replace(/[^A-Z0-9_]/g, '_');
    keys.add(`${normGrade}_${normClean}_LESSON_BREAKDOWN`);

    if (rawSub === 'CRE' || rawSub.toLowerCase().includes('christian religious') || normSub.includes('CRE')) {
        keys.add(`${normGrade}_CRE_LESSON_BREAKDOWN`);
        keys.add(`${normGrade}_CHRISTIAN_RELIGIOUS_EDUCATION_(CRE)_LESSON_BREAKDOWN`);
        keys.add(`${normGrade}_CHRISTIAN_RELIGIOUS_EDUCATION_LESSON_BREAKDOWN`);
    }

    if (rawSub.toLowerCase().includes('environmental')) {
        keys.add(`${normGrade}_ENVIRONMENTAL_LESSON_BREAKDOWN`);
        keys.add(`${normGrade}_ENVIRONMENTAL_ACTIVITIES_LESSON_BREAKDOWN`);
    }

    if (rawSub.toLowerCase().includes('science') && rawSub.toLowerCase().includes('tech')) {
        keys.add(`${normGrade}_SCIENCE_&_TECHNOLOGY_LESSON_BREAKDOWN`);
        keys.add(`${normGrade}_SCIENCE_AND_TECHNOLOGY_LESSON_BREAKDOWN`);
        keys.add(`${normGrade}_SCIENCE_TECH_LESSON_BREAKDOWN`);
    }

    if (rawSub.toLowerCase().includes('integrated science')) {
        keys.add(`${normGrade}_INTEGRATED_SCIENCE_LESSON_BREAKDOWN`);
    }

    if (rawSub.toLowerCase().includes('pre-technical') || rawSub.toLowerCase().includes('pre technical') || rawSub.toLowerCase().includes('pre_technical')) {
        keys.add(`${normGrade}_PRE-TECHNICAL_STUDIES_LESSON_BREAKDOWN`);
        keys.add(`${normGrade}_PRE_TECHNICAL_STUDIES_LESSON_BREAKDOWN`);
    }

    if (rawSub.toLowerCase().includes('creative')) {
        keys.add(`${normGrade}_CREATIVE_ARTS_AND_SPORTS_LESSON_BREAKDOWN`);
        keys.add(`${normGrade}_CREATIVE_ARTS_&_SPORTS_LESSON_BREAKDOWN`);
        keys.add(`${normGrade}_CREATIVE_ACTIVITIES_LESSON_BREAKDOWN`);
    }

    if (rawSub.toLowerCase().includes('agriculture')) {
        keys.add(`${normGrade}_AGRICULTURE_AND_NUTRITION_LESSON_BREAKDOWN`);
        keys.add(`${normGrade}_AGRICULTURE_&_NUTRITION_LESSON_BREAKDOWN`);
        keys.add(`${normGrade}_AGRICULTURE_LESSON_BREAKDOWN`);
    }

    if (rawSub.toLowerCase().includes('social studies')) {
        keys.add(`${normGrade}_SOCIAL_STUDIES_LESSON_BREAKDOWN`);
    }

    if (normGrade === 'GRADE_11' || normGrade === 'GRADE_12') {
        const grade10Keys = Array.from(keys).map(k => k.replace(/GRADE_1[12]/, 'GRADE_10'));
        grade10Keys.forEach(k => keys.add(k));
    }

    return Array.from(keys);
}

export const getCurriculumTextByTerm = (grade: string, subject: string, terms: string[]): string => {
    if (!grade || !subject) return '';
    
    const candidateKeys = getPossibleLessonKeys(grade, subject);
    let breakdownText = '';
    
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        for (const key of candidateKeys) {
            const override = localStorage.getItem(`curriculum_override_${key}`);
            if (override) {
                breakdownText = override;
                break;
            }
        }
    }
    
    if (!breakdownText) {
        for (const key of candidateKeys) {
            if (LESSON_BREAKDOWNS?.[key]) {
                breakdownText = LESSON_BREAKDOWNS[key];
                break;
            }
        }
    }

    if (!breakdownText) return '';

    const termHeaders: { index: number; terms: number[] }[] = [];
    const termRegex = /-{3,}\s*TERM\s+([^-\n\r]+?)\s*-{3,}/gi;
    let match;
    while ((match = termRegex.exec(breakdownText)) !== null) {
        const termGroup = match[1] || '';
        const termsInHeader = new Set<number>();
        
        const rangeMatch = termGroup.match(/(\d)\s*-\s*(\d)/);
        if (rangeMatch) {
            const start = parseInt(rangeMatch[1]);
            const end = parseInt(rangeMatch[2]);
            for (let i = start; i <= end; i++) termsInHeader.add(i);
        }

        const termParts = termGroup.toUpperCase().split(/,|\s+AND\s+|\s+/).filter(Boolean);
        termParts.forEach(term => {
            if (term === '1' || term.includes('ONE') || term === 'I') termsInHeader.add(1);
            else if (term === '2' || term.includes('TWO') || term === 'II') termsInHeader.add(2);
            else if (term === '3' || term.includes('THREE') || term === 'III') termsInHeader.add(3);
            const num = parseInt(term);
            if (!isNaN(num) && num >= 1 && num <= 3) termsInHeader.add(num);
        });
        
        if (termsInHeader.size > 0) {
            termHeaders.push({ index: match.index, terms: Array.from(termsInHeader) });
        }
    }
    termHeaders.sort((a, b) => a.index - b.index);

    let contentToProcess = '';
    let processedSomething = false;
    
    if (termHeaders.length > 0 && terms && terms.length > 0) {
        const isAllTerms = terms.includes('All Terms');
        const selectedNums = terms.map(t => {
            if (t === 'All Terms') return null;
            const num = parseInt(t.replace('Term ', ''));
            return isNaN(num) ? null : num;
        }).filter((n): n is number => n !== null);
        
        if (isAllTerms || selectedNums.length > 0) {
            termHeaders.forEach((header, i) => {
                const matches = isAllTerms || header.terms.some(t => selectedNums.includes(t));
                if (matches) {
                    const startIndex = header.index;
                    const nextHeaderIndex = i + 1 < termHeaders.length ? termHeaders[i + 1].index : breakdownText.length;
                    contentToProcess += breakdownText.substring(startIndex, nextHeaderIndex) + '\n';
                    processedSomething = true;
                }
            });
        }
    }

    if (!processedSomething) {
        contentToProcess = breakdownText;
    }
    
    return contentToProcess;
};

export const getCurriculumByTerm = (grade: string, subject: string, terms: string[]): GradeCurriculum => {
    let contentToProcess = getCurriculumTextByTerm(grade, subject, terms);
    if (!contentToProcess) {
        return CURRICULUM_DATA[subject]?.[grade] || {};
    }

    const curriculum: GradeCurriculum = {};
    const cleanName = (name: string) => {
        return name.trim().replace(/[.;,:]+$/, '').trim();
    };

    const processLine = (line: string) => {
        const strandMatch = line.match(/(?:^|[^a-zA-Z0-9_\-])(?:Strand|Topic)\s*[:\-]\s*([^,;:\n\r]+)/i);
        const subStrandMatch = line.match(/(?:Sub[\s_\-]*Str[\s_\-]*and|Sub[\s_\-]*Strand|Sub[\s_\-]*Topic|Subtopic|Sub[\s_\-]*topic)\s*[:\-]\s*([^,;:\n\r]+)/i);
        
        if (strandMatch) {
            const strand = toProperCase(cleanName(strandMatch[1]));
            if (!curriculum[strand]) curriculum[strand] = [];
            
            if (subStrandMatch) {
                const subStrand = toProperCase(cleanName(subStrandMatch[1]));
                if (!curriculum[strand].includes(subStrand)) {
                    curriculum[strand].push(subStrand);
                }
            }
        }
    };

    contentToProcess.split('\n').forEach(processLine);
    return curriculum;
};

export function hasCurriculumData(grade: string, subject: string): boolean {
    if (!grade || !subject) return false;
    const candidateKeys = getPossibleLessonKeys(grade, subject);
    for (const key of candidateKeys) {
        if (LESSON_BREAKDOWNS?.[key]) return true;
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            if (localStorage.getItem(`curriculum_override_${key}`)) return true;
        }
    }
    return !!CURRICULUM_DATA[subject]?.[grade];
}

export interface LessonFilterOptions {
  grade: string;
  subject: string;
  terms?: string[];
  weeks?: (string | number)[];
  strand?: string;
  subStrand?: string;
}

export function getLessonsToGenerate(options: LessonFilterOptions): string {
  const { grade, subject, terms = [], weeks = [], strand, subStrand } = options;
  let text = getCurriculumTextByTerm(grade, subject, terms);
  if (!text) {
    let normalizedSubject = (subject || '').toUpperCase()
        .replace(/ & /g, '_')
        .replace(/\s/g, '_');
    if (subject === 'CRE') normalizedSubject = 'CRE';
    else if (subject.includes('Christian Religious Education')) normalizedSubject = 'CHRISTIAN_RELIGIOUS_EDUCATION_(CRE)';
    else if (subject.includes('Science & Technology')) normalizedSubject = 'SCIENCE_&_TECHNOLOGY';
    else if (subject.includes('Integrated Science')) normalizedSubject = 'INTEGRATED_SCIENCE';
    else if (subject.includes('Pre-Technical')) normalizedSubject = 'PRE-TECHNICAL_STUDIES';
    else if (subject.includes('Creative Arts')) normalizedSubject = 'CREATIVE_ARTS_AND_SPORTS';
    else if (subject.includes('Social Studies')) normalizedSubject = 'SOCIAL_STUDIES';
    else if (subject.includes('Environmental')) normalizedSubject = 'ENVIRONMENTAL';

    const key = `${(grade || '').toUpperCase().replace(' ', '_')}_${normalizedSubject}_LESSON_BREAKDOWN`;
    text = LESSON_BREAKDOWNS[key] || '';
  }
  if (!text) return '';

  const lines = text.split('\n');
  const filteredLines: string[] = [];
  let currentWeek = '';
  let currentStrand = '';
  let currentSubStrand = '';
  let activeWeekMatch = weeks.length === 0;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('week ') || lower.startsWith('week') || lower.startsWith('wk ')) {
      currentWeek = line.replace(/[^0-9]/g, '');
      activeWeekMatch = weeks.length === 0 || weeks.some((w: any) => String(w).trim() === String(currentWeek).trim() || lower.includes(`week ${w}`) || lower.includes(`wk ${w}`));
    }
    if (lower.includes('strand') || line.startsWith('#')) {
      currentStrand = line;
    }
    if (lower.includes('sub-strand') || lower.includes('substrand')) {
      currentSubStrand = line;
    }

    const matchStrand = !strand || currentStrand.toLowerCase().includes(strand.toLowerCase()) || lower.includes(strand.toLowerCase());
    const matchSubStrand = !subStrand || currentSubStrand.toLowerCase().includes(subStrand.toLowerCase()) || lower.includes(subStrand.toLowerCase());

    let include = true;
    if (weeks.length > 0 && !activeWeekMatch && !weeks.some((w: any) => lower.includes(`week ${w}`) || lower.includes(`wk ${w}`))) {
      include = false;
    }
    if (strand && !matchStrand && !matchSubStrand && !lower.includes(strand.toLowerCase())) {
      include = false;
    }
    if (subStrand && !matchSubStrand && !lower.includes(subStrand.toLowerCase())) {
      include = false;
    }

    if (include || (!weeks.length && !strand && !subStrand)) {
      filteredLines.push(line);
    }
  }

  return filteredLines.length > 0 ? filteredLines.join('\n') : text;
}
