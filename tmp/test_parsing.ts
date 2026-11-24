
const breakdownText = `
--- Term 1 ---

Week 2
- Lesson 1: Strand: Creation, Sub-Strand: Self-care, Content: Appreciating oneself as God's creation (Mentors CRE page 1-3)
- Lesson 2: Strand: Creation, Sub-Strand: My Family, Content: Appreciating members of the family (Mentors CRE page 4-6)
`;

const termRegex = /-{3,}\s*TERM\s+([^-\n\r]+?)\s*-{3,}/gi;
// ... (I need to find the lessons for a specific term)

const weekRegex = /(?:week|wk)\s*(\d+)/i;
const lessonRegex = /- Lesson (\d+): Strand: ([^,]+), Sub-Strand: ([^,]+), Content: (.+)/i;

const lines = breakdownText.split('\n');
let currentWeek = 0;
for (const line of lines) {
    const weekMatch = line.match(weekRegex);
    if (weekMatch) {
        currentWeek = parseInt(weekMatch[1]);
        continue;
    }
    const lessonMatch = line.match(lessonRegex);
    if (lessonMatch) {
        const [_, lesson, strand, subStrand, content] = lessonMatch;
        console.log(`Week: ${currentWeek}, Lesson: ${lesson}, Strand: ${strand}, SubStrand: ${subStrand}`);
    }
}
