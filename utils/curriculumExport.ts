
import { LESSON_BREAKDOWNS } from '../data/curriculum/index';

export const exportCurriculumToCSV = (data: { [key: string]: string }) => {
  const csvRows = ['Key,Content'];
  for (const [key, content] of Object.entries(data)) {
    csvRows.push(`"${key}","${content.replace(/"/g, '""')}"`);
  }
  return csvRows.join('\n');
};

export const exportCurriculumToMarkdown = (data: { [key: string]: string }) => {
  let md = '# Curriculum Data Export\n\n';
  for (const [key, content] of Object.entries(data)) {
    md += `## ${key}\n\n${content}\n\n---\n\n`;
  }
  return md;
};
