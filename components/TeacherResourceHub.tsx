// components/TeacherResourceHub.tsx 

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LESSON_BREAKDOWNS as CURRICULUM_DATA } from '../data/curriculum/index.ts';
import { getCurriculumTextByTerm } from '../curriculumData.ts';
import { auth, db } from '../firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebaseUtils';
import { jsPDF } from 'jspdf';
import { 
 Save, 
 Library, 
 GraduationCap, 
 CalendarDays, 
 Upload, 
 Download, 
 RefreshCw, 
 AlertTriangle, 
 Cloud,
 FileCheck2,
 CheckCircle2,
 XCircle,
 Copy,
 ExternalLink,
 BookOpen,
 Info,
 Check,
 FileText
} from 'lucide-react';
import { User } from '../types.ts';
import { CustomSelect } from './CustomSelect.tsx';
import { GRADES, SUBJECTS_BY_GRADE } from '../constants.tsx';
import { connectToGoogleDrive } from '../services/googleDriveService';
import { exportCurriculumToCSV, exportCurriculumToMarkdown } from '../utils/curriculumExport';
import { LESSON_BREAKDOWNS } from '../data/curriculum/index';

interface TeacherResourceHubProps {
 currentUser: User | null;
}

interface ParsedLesson {
 week: string;
 lessonNum: string;
 strand: string;
 subStrand: string;
 content: string;
 lineNum: number;
}

interface ValidationIssue {
 lineNum: number;
 type: 'error' | 'warning';
 message: string;
 text: string;
}

const DEFAULT_SANDBOX_TEXT = `Reference: Our Faith Grade 1

--- Term 1 ---
Week 2
- Lesson 1: Strand: Creation, Sub-Strand: Self-awareness, Content: Identify uniqueness as guided by the word of God. (Our faith pg 1)
- Lesson 2: Strand: Creation, Sub-Strand: Self-awareness, Content: State their gender. (Our faith pg 2)
- Lesson 3: Strand: Creation, Sub-Strand: Self-awareness, Content: Draw their palm and write their names. (Our faith pg 10)

Week 3
- Lesson 1: Strand: Creation, Sub-Strand: Self-awareness, Content: Accepting myself. (Our faith pg 4)
- Lesson 2: Strand: Creation, Sub-Strand: Self-awareness, Content: Parts of my body. (Our faith pg 5)
- Lesson 3: Strand: Creation, Sub-Strand: Family, Content: Name members of their family. (Our faith pg 17)

Week 4
- Lesson 1: Strand: Creation, Sub-Strand: Family, Content: Sharing at home. (Our faith pg 20)
- Lesson 2: Strand: Creation, Sub-Strand: Family, Content: Praying together as a family. (Our faith pg 26)
`;

const TeacherResourceHub: React.FC<TeacherResourceHubProps> = ({ currentUser }) => {
 const [activeTab, setActiveTab] = useState<'guide' | 'validator'>('guide');
 const [selectedGrade, setSelectedGrade] = useState('Grade 1');
 const [selectedSubject, setSelectedSubject] = useState('CRE');
 const [selectedTerm, setSelectedTerm] = useState('Term 1');
 const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
 
 // Google Drive integrations
 const [driveToken, setDriveToken] = useState<string | null>(null);
 const [showDriveModal, setShowDriveModal] = useState(false);
 const [isSyncingDrive, setIsSyncingDrive] = useState(false);

 // File Upload Reference
 const fileInputRef = useRef<HTMLInputElement>(null);
 const [uploadedAt, setUploadedAt] = useState<Date | null>(() => {
 const saved = localStorage.getItem('curriculumUploadedAt');
 return saved ? new Date(saved) : null;
 });
 const [lastExportedAt, setLastExportedAt] = useState<Date | null>(() => {
 const saved = localStorage.getItem('curriculumLastExportedAt');
 return saved ? new Date(saved) : null;
 });

 // Save timestamp to localStorage when it changes
 useEffect(() => {
 if (uploadedAt) {
 localStorage.setItem('curriculumUploadedAt', uploadedAt.toISOString());
 }
 }, [uploadedAt]);

 useEffect(() => {
 if (lastExportedAt) {
 localStorage.setItem('curriculumLastExportedAt', lastExportedAt.toISOString());
 }
 }, [lastExportedAt]);

 // Sandbox states
 const [validatorText, setValidatorText] = useState(DEFAULT_SANDBOX_TEXT);
 const [validationReport, setValidationReport] = useState<{
 score: number;
 issues: ValidationIssue[];
 summary: {
 terms: number;
 weeks: number;
 lessons: number;
 strands: Set<string>;
 subStrands: Set<string>;
 };
 } | null>(null);

 // Copy indicator states
 const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

 const gradeOptions = useMemo(() => GRADES.map(g => ({ value: g, label: g, icon: <GraduationCap className="h-4 w-4 text-emerald-600" /> })), []);
 const subjectOptions = useMemo(() => {
 const subjects = selectedGrade ? (SUBJECTS_BY_GRADE[selectedGrade] || []) : [];
 return subjects.map(s => ({ value: s, label: s, icon: <Library className="h-4 w-4 text-emerald-600" /> }));
 }, [selectedGrade]);
 const termOptions = useMemo(() => ['Term 1', 'Term 2', 'Term 3'].map(t => ({ value: t, label: t, icon: <CalendarDays className="h-4 w-4 text-emerald-600" /> })), []);

 // Reset subject if grade changes
 useEffect(() => {
 if (selectedGrade && !SUBJECTS_BY_GRADE[selectedGrade]?.includes(selectedSubject)) {
 setSelectedSubject(SUBJECTS_BY_GRADE[selectedGrade]?.[0] || '');
 }
 }, [selectedGrade, selectedSubject]);

 // Retrieve current active curriculum from index
 const activeCurriculumText = useMemo(() => {
 if (!selectedGrade || !selectedSubject || !selectedTerm) return '';
 return getCurriculumTextByTerm(selectedGrade, selectedSubject, [selectedTerm]);
 }, [selectedGrade, selectedSubject, selectedTerm]);

 // Parse active curriculum into structured cards
 const parsedLessons = useMemo<ParsedLesson[]>(() => {
 if (!activeCurriculumText) return [];
 
 const lessons: ParsedLesson[] = [];
 const lines = activeCurriculumText.split('\n');
 let currentWeek = 'Unknown Week';
 
 lines.forEach((line, idx) => {
 const trimmed = line.trim();
 if (!trimmed) return;
 
 // Check Week
 if (/^week\s+(\d+)/i.test(trimmed)) {
 currentWeek = trimmed;
 return;
 }
 
 // Check Lesson
 if (/^-?\s*lesson\s+(\d+)/i.test(trimmed)) {
 const lessonMatch = trimmed.match(/^-?\s*lesson\s+(\d+)\s*:\s*(.*)/i);
 if (lessonMatch) {
 const lessonNum = `Lesson ${lessonMatch[1]}`;
 const details = lessonMatch[2] || '';
 
 // Match Strand, Sub-strand, Content
 const strandMatch = details.match(/strand\s*:\s*([^,]+)/i);
 const subStrandMatch = details.match(/sub-strand\s*:\s*([^,]+)/i);
 const contentMatch = details.match(/content\s*:\s*(.*)/i);
 
 lessons.push({
 week: currentWeek,
 lessonNum,
 strand: strandMatch ? strandMatch[1].trim() : 'General',
 subStrand: subStrandMatch ? subStrandMatch[1].trim() : 'General',
 content: contentMatch ? contentMatch[1].trim() : details,
 lineNum: idx + 1
 });
 }
 }
 });
 
 return lessons;
 }, [activeCurriculumText]);

 // Document Verification / Parser Engine
 const validateCurriculumText = (text: string) => {
 if (!text.trim()) {
 setStatusMessage({ text: 'Please enter curriculum content to validate.', type: 'error' });
 return;
 }

 const lines = text.split('\n');
 const issues: ValidationIssue[] = [];
 let termCount = 0;
 let weekCount = 0;
 let lessonCount = 0;
 const strands = new Set<string>();
 const subStrands = new Set<string>();
 
 let currentTerm = '';
 let currentWeek = '';
 let lastWeekNum = 0;
 let lastLessonNum = 0;

 lines.forEach((line, idx) => {
 const lineNum = idx + 1;
 const trimmed = line.trim();
 if (!trimmed) return;

 // Check Term Header
 if (/^-{3,}\s*term\s+(\d)\s*-{3,}/i.test(trimmed)) {
 termCount++;
 const match = trimmed.match(/term\s+(\d)/i);
 currentTerm = match ? match[1] : '';
 lastWeekNum = 0; // reset week count for new term
 return;
 }

 // Check Week Header
 if (/^week\s+(\d+)/i.test(trimmed)) {
 weekCount++;
 currentWeek = trimmed;
 const match = trimmed.match(/week\s+(\d+)/i);
 if (match) {
 const wkNum = parseInt(match[1]);
 if (lastWeekNum > 0 && wkNum !== lastWeekNum + 1) {
 issues.push({
 lineNum,
 type: 'warning',
 message: `Week progression jumps from Week ${lastWeekNum} to Week ${wkNum}. Is this intentional?`,
 text: trimmed
 });
 }
 lastWeekNum = wkNum;
 }
 lastLessonNum = 0; // reset lesson counts inside week
 return;
 }

 // Check Lesson Definitions
 if (/^-\s*lesson/i.test(trimmed) || /^lesson/i.test(trimmed)) {
 lessonCount++;
 
 // Ensure starting with dash (-) for bullet list standard
 if (!trimmed.startsWith('-')) {
 issues.push({
 lineNum,
 type: 'warning',
 message: "Standard curriculum formatting recommends starting lesson lines with a hyphen '- '.",
 text: trimmed
 });
 }

 // Check structured tags
 const hasStrand = /strand\s*:/i.test(trimmed);
 const hasSubStrand = /sub-strand\s*:/i.test(trimmed);
 const hasContent = /content\s*:/i.test(trimmed);

 if (!hasStrand) {
 issues.push({
 lineNum,
 type: 'error',
 message: "Missing 'Strand:' specification in lesson description.",
 text: trimmed
 });
 }
 if (!hasSubStrand) {
 issues.push({
 lineNum,
 type: 'error',
 message: "Missing 'Sub-Strand:' specification in lesson description.",
 text: trimmed
 });
 }
 if (!hasContent) {
 issues.push({
 lineNum,
 type: 'error',
 message: "Missing 'Content:' block detailing learning experiences.",
 text: trimmed
 });
 }

 // Sequence numbers check
 const lessonMatch = trimmed.match(/lesson\s+(\d+)/i);
 if (lessonMatch) {
 const lNum = parseInt(lessonMatch[1]);
 if (lastLessonNum > 0 && lNum !== lastLessonNum + 1) {
 issues.push({
 lineNum,
 type: 'warning',
 message: `Lesson progression sequence jump: detected Lesson ${lNum} immediately following Lesson ${lastLessonNum}.`,
 text: trimmed
 });
 }
 lastLessonNum = lNum;
 }

 // Collect metadata
 const strandMatch = trimmed.match(/strand\s*:\s*([^,]+)/i);
 const subStrandMatch = trimmed.match(/sub-strand\s*:\s*([^,]+)/i);
 if (strandMatch) strands.add(strandMatch[1].trim());
 if (subStrandMatch) subStrands.add(subStrandMatch[1].trim());
 }
 });

 // Check Term presence
 if (termCount === 0) {
 issues.push({
 lineNum: 1,
 type: 'warning',
 message: "No '--- Term X ---' header detected. Ensure document contains term blocks for KICD alignment.",
 text: "Document Header"
 });
 }

 // Calculate score
 const errors = issues.filter(i => i.type === 'error').length;
 const warnings = issues.filter(i => i.type === 'warning').length;
 const rawScore = 100 - (errors * 15) - (warnings * 5);
 const score = Math.max(0, Math.min(100, rawScore));

 setValidationReport({
 score,
 issues,
 summary: {
 terms: termCount,
 weeks: weekCount,
 lessons: lessonCount,
 strands,
 subStrands
 }
 });

 setStatusMessage({
 text: errors > 0 
 ? `Verification completed with ${errors} error(s) and ${warnings} warning(s).`
 : `Verification successful! Curriculum score: ${score}%`,
 type: errors > 0 ? 'error' : 'success'
 });
 };

 const handleReset = () => {
 setSelectedGrade('Grade 1');
 setSelectedSubject('CRE');
 setSelectedTerm('Term 1');
 setValidatorText(DEFAULT_SANDBOX_TEXT);
 setValidationReport(null);
 setStatusMessage({ text: 'Curriculum settings and sandbox reset to defaults.', type: 'info' });
 };

 // Download raw schema template
 const handleDownloadTemplate = () => {
 const templateText = `# Exameno KICD Curriculum Scheme Document Template
# Align with your custom subject plans. Double hyphens identify term segments.

--- Term 1 ---
Week 1
- Lesson 1: Strand: [Strand Name], Sub-Strand: [Sub-strand Name], Content: [Identify and list core learning activities]
- Lesson 2: Strand: [Strand Name], Sub-Strand: [Sub-strand Name], Content: [Demonstrate understanding and apply knowledge]
- Lesson 3: Strand: [Strand Name], Sub-Strand: [Sub-strand Name], Content: [Explain outcomes and solve exercises]

Week 2
- Lesson 1: Strand: [Strand Name], Sub-Strand: [Sub-strand Name], Content: [Review and feedback exercise]
`;
 const blob = new Blob([templateText], { type: 'text/markdown;charset=utf-8;' });
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.setAttribute('download', 'Exameno_CBC_Curriculum_Template.md');
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 
 setStatusMessage({ text: 'Curriculum template downloaded successfully.', type: 'success' });
 };

 // Export current curriculum as file
 const handleExportText = () => {
 if (!activeCurriculumText) {
 setStatusMessage({ text: 'No active curriculum data loaded to export.', type: 'error' });
 return;
 }
 const blob = new Blob([activeCurriculumText], { type: 'text/markdown;charset=utf-8;' });
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.setAttribute('download', `Exameno_${selectedGrade}_${selectedSubject.replace(/\s+/g, '_')}_${selectedTerm.replace(/\s+/g, '_')}.md`);
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);

 setStatusMessage({ text: 'Curriculum document exported successfully.', type: 'success' });
 };

 // Export all curriculum
 const handleExportAll = (format: 'csv' | 'md') => {
   let content = '';
   let filename = `Exameno_Curriculum_Export_${new Date().toISOString().split('T')[0]}`;
   
   if (format === 'csv') {
     content = exportCurriculumToCSV(LESSON_BREAKDOWNS);
     filename += '.csv';
   } else {
     content = exportCurriculumToMarkdown(LESSON_BREAKDOWNS);
     filename += '.md';
   }
   
   const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'text/markdown;charset=utf-8;' });
   const url = URL.createObjectURL(blob);
   const link = document.createElement('a');
   link.href = url;
   link.setAttribute('download', filename);
   document.body.appendChild(link);
   link.click();
   document.body.removeChild(link);
   
   setLastExportedAt(new Date());
   setStatusMessage({ text: `Curriculum data exported as ${format.toUpperCase()} successfully.`, type: 'success' });
 };

 // Export as beautiful formal PDF
 const handleExportPDF = () => {
   if (parsedLessons.length === 0) {
     setStatusMessage({ text: 'No structured curriculum data available to build PDF.', type: 'error' });
     return;
   }
   try {
     const doc = new jsPDF();
  
  const addWatermark = (pageNumber: number) => {
      doc.setPage(pageNumber);
      doc.setFontSize(20);
      doc.setTextColor(230, 230, 230);
      doc.text("Exameno CBE Content Generator (ECG)", 105, 150, { align: 'center' });
      doc.setTextColor(51, 65, 85); // Reset to default color
  };

  doc.setFont('Helvetica');
  addWatermark(1);
 
 // Cover title
 doc.setFontSize(22);
 doc.setTextColor(5, 150, 105); // emerald color
 doc.text("EXAMENO CBE CONTENT GENERATOR", 105, 40, { align: 'center' });
 
 doc.setFontSize(14);
 doc.setTextColor(15, 23, 42); // slate-900
 doc.text("Official Curriculum Schemes of Work", 105, 52, { align: 'center' });
 
 doc.setDrawColor(200, 200, 200);
 doc.line(20, 60, 190, 60);

 // Metadata card
 doc.setFontSize(11);
 doc.text(`Grade Level: ${selectedGrade}`, 20, 75);
 doc.text(`Learning Area: ${selectedSubject}`, 20, 83);
 doc.text(`Calendar Term: ${selectedTerm}`, 20, 91);
 doc.text(`Curriculum Alignment: KICD CBC standards`, 20, 99);
 doc.text(`Generated On: ${new Date().toLocaleDateString('en-GB')}`, 20, 107);
 
 doc.line(20, 115, 190, 115);

 // Lessons listing
 doc.setFontSize(14);
 doc.setTextColor(5, 150, 105);
 doc.text("Detailed Weekly Breakdown", 20, 128);

 let yPos = 138;
 doc.setFontSize(9);
 doc.setTextColor(51, 65, 85);

 parsedLessons.forEach((lesson, index) => {
 if (yPos > 270) {
 doc.addPage();
  addWatermark(doc.getNumberOfPages());
 yPos = 20;
 }

 doc.setFontSize(10);
 doc.setTextColor(15, 23, 42);
 doc.text(`${lesson.week} - ${lesson.lessonNum}`, 20, yPos);
 yPos += 5;

 doc.setFontSize(9);
 doc.setTextColor(71, 85, 105);
 doc.text(`Strand: ${lesson.strand} | Sub-Strand: ${lesson.subStrand}`, 25, yPos);
 yPos += 5;

 // Content (word wrap)
 const contentLines = doc.splitTextToSize(`Content & Outcomes: ${lesson.content}`, 160);
 doc.text(contentLines, 25, yPos);
 yPos += (contentLines.length * 4.5) + 6;
 });

 doc.save(`Exameno_${selectedGrade}_${selectedSubject.replace(/\s+/g, '_')}_${selectedTerm.replace(/\s+/g, '_')}.pdf`);
 setStatusMessage({ text: 'High-quality SOW PDF compiled and downloaded.', type: 'success' });
 } catch (err: any) {
 console.error(err);
 setStatusMessage({ text: `Failed to compile PDF: ${err.message}`, type: 'error' });
 }
 };

 // Upload custom document
 const handleUploadDocument = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 const reader = new FileReader();
 reader.onload = (event) => {
 const contents = event.target?.result as string;
 setValidatorText(contents);
 setActiveTab('validator');
 validateCurriculumText(contents);
 setUploadedAt(new Date());
 setStatusMessage({ text: `Imported "${file.name}" into sandbox and executed automatic validation.`, type: 'success' });
 };
 reader.readAsText(file);
 
 // reset input
 if (e.target) e.target.value = '';
 };

 // Export current curriculum as CSV
 const handleExportCSV = () => {
 if (parsedLessons.length === 0) {
 setStatusMessage({ text: 'No structured curriculum data available to export.', type: 'error' });
 return;
 }
 const headers = ['Week', 'Lesson', 'Strand', 'Sub-Strand', 'Content'];
 const rows = parsedLessons.map(l => [l.week, l.lessonNum, l.strand, l.subStrand, l.content.replace(/,/g, ';')]);
 const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
 const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.setAttribute('download', `Exameno_${selectedGrade}_${selectedSubject.replace(/\s+/g, '_')}_${selectedTerm.replace(/\s+/g, '_')}.csv`);
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 
 setStatusMessage({ text: 'Curriculum data exported to CSV successfully.', type: 'success' });
 };

 // Connect & open Google Drive Picker Simulation / Explorer
 const handleConnectDrive = async () => {
 try {
 setIsSyncingDrive(true);
 const token = await connectToGoogleDrive();
 setDriveToken(token);
 setShowDriveModal(true);
 setStatusMessage({ text: 'Authenticated with Google Drive secure server.', type: 'success' });
 } catch (err: any) {
 setStatusMessage({ text: `Drive auth failed: ${err.message}`, type: 'error' });
 } finally {
 setIsSyncingDrive(false);
 }
 };

 // Pre-configured virtual Drive templates
 const DRIVE_TEMPLATES = [
 { name: "Grade 1 CRE Schemes Term 1.txt", grade: "Grade 1", subject: "CRE", term: "Term 1" },
 { name: "Grade 4 Social Studies Term 1.txt", grade: "Grade 4", subject: "Social Studies", term: "Term 1" },
 { name: "Grade 7 Integrated Science Term 1.txt", grade: "Grade 7", subject: "Integrated Science", term: "Term 1" },
 { name: "Grade 10 Biology Semester 1.txt", grade: "Grade 10", subject: "Biology", term: "Term 1" },
 ];

 const loadDriveTemplate = (template: typeof DRIVE_TEMPLATES[0]) => {
 setSelectedGrade(template.grade);
 setSelectedSubject(template.subject);
 setSelectedTerm(template.term);
 
 const text = getCurriculumTextByTerm(template.grade, template.subject, [template.term]);
 if (text) {
 setValidatorText(text);
 validateCurriculumText(text);
 setStatusMessage({ text: `Successfully loaded "${template.name}" from Google Drive folder.`, type: 'success' });
 } else {
 setStatusMessage({ text: `Selected curriculum text template is empty.`, type: 'error' });
 }
 setShowDriveModal(false);
 };

 const handleCopy = (text: string, index: number) => {
 navigator.clipboard.writeText(text);
 setCopiedIndex(index);
 setTimeout(() => setCopiedIndex(null), 2000);
 };

 return (
 <div className="space-y-6">
 {/* Header Panel */}
 <div className="bg-white p-6 rounded-2xl border border-slate-200 (0,0,0,1)] space-y-4">
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
 <div>
 <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
 <BookOpen className="text-emerald-600 h-7 w-7" />
 Curriculum Data Management
 </h2>
 <p className="text-xs text-slate-500 font-bold font-mono uppercase tracking-widest mt-1">
 Live KICD CBC / CBE Standard Schemes Inspector & Validation Sandbox
 </p>
 {lastExportedAt && (
  <p className="text-[10px] text-purple-600 font-bold font-mono uppercase tracking-widest mt-1.5 flex items-center gap-1">
   <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
   Last Entire Backup Exported: {lastExportedAt.toLocaleString('en-GB')}
  </p>
 )}
 </div>
 
 <div className="flex flex-wrap gap-2">
 <button 
 onClick={() => handleExportAll('csv')}
 className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-black uppercase tracking-wider transition-colors shrink-0"
 title="Export entire KICD curriculum database to CSV"
 >
 <Download size={14} className="text-amber-700" />
 Export All (CSV)
 </button>

 <button 
 onClick={() => handleExportAll('md')}
 className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-[11px] font-black uppercase tracking-wider transition-colors shrink-0"
 title="Export entire KICD curriculum database to Markdown"
 >
 <Download size={14} className="text-indigo-700" />
 Export All (MD)
 </button>

 <button 
 onClick={() => fileInputRef.current?.click()}
 className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 text-[11px] font-black uppercase tracking-wider transition-colors shrink-0"
 title="Upload scheme file"
 >
 <Upload size={14} />
 Import Document
 </button>
 <input 
 type="file" 
 ref={fileInputRef} 
 onChange={handleUploadDocument} 
 accept=".txt,.md,.json" 
 className="hidden" 
 />

 {uploadedAt && (
 <span className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
 <FileText size={12} />
 Uploaded: {uploadedAt.toLocaleTimeString()}
 </span>
 )}

 <button 
 onClick={handleConnectDrive}
 disabled={isSyncingDrive}
 className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wider transition-colors shrink-0 disabled:opacity-50"
 title="Pick scheme from Google Drive"
 >
 <Cloud size={14} className="text-emerald-700" />
 {isSyncingDrive ? "Connecting..." : "Pick from Drive"}
 </button>
 </div>
 </div>

 {/* Dropdown selectors */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
 <CustomSelect label="Grade level" value={selectedGrade} options={gradeOptions} onChange={setSelectedGrade} labelClassName="text-slate-900 font-black uppercase tracking-wider text-[11px]" />
 <CustomSelect label="Learning Area (Subject)" value={selectedSubject} options={subjectOptions} onChange={setSelectedSubject} labelClassName="text-slate-900 font-black uppercase tracking-wider text-[11px]" />
 <CustomSelect label="Calendar Term" value={selectedTerm} options={termOptions} onChange={setSelectedTerm} labelClassName="text-slate-900 font-black uppercase tracking-wider text-[11px]" />
 </div>

 {/* Action Controls */}
 <div className="flex flex-wrap gap-3 pt-2">
 <button 
 onClick={handleDownloadTemplate}
 className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-800 border-2 border-slate-200 rounded-xl hover:bg-slate-50 font-black text-xs uppercase tracking-wider transition-colors "
 >
 <Download size={14} className="text-slate-500" /> 
 Download Scheme Template
 </button>
 
 <button 
 onClick={handleExportText}
 disabled={!activeCurriculumText}
 className="flex items-center gap-2 px-4 py-2.5 bg-white text-emerald-700 border-2 border-emerald-600 rounded-xl hover:bg-emerald-50 font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
 >
 <FileText size={14} className="text-emerald-600" /> 
 Export Markdown
 </button>

 <button 
 onClick={handleExportCSV}
 disabled={parsedLessons.length === 0}
 className="flex items-center gap-2 px-4 py-2.5 bg-white text-purple-700 border-2 border-purple-600 rounded-xl hover:bg-purple-50 font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
 >
 <Download size={14} className="text-purple-600" /> 
 Export CSV
 </button>

 <button 
 onClick={handleExportPDF}
 disabled={parsedLessons.length === 0}
 className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white border border-slate-200 rounded-xl hover:bg-emerald-700 font-black text-xs uppercase tracking-wider transition-colors (0,0,0,1)] disabled:opacity-50"
 >
 <CheckCircle2 size={14} /> 
 Export PDF Report
 </button>

 <button 
 onClick={handleReset}
 className="flex items-center gap-2 px-4 py-2.5 bg-white text-rose-600 border-2 border-rose-200 rounded-xl hover:bg-rose-50 font-black text-xs uppercase tracking-wider transition-colors ml-auto"
 >
 <RefreshCw size={14} className="text-rose-500" /> 
 Reset Settings
 </button>
 </div>

 {/* Status indicator bar */}
 {statusMessage && (
 <div className={`p-3.5 rounded-xl text-xs font-bold border flex items-center gap-2 ${
 statusMessage.type === 'success' 
 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
 : statusMessage.type === 'error'
 ? 'bg-rose-50 text-rose-800 border-rose-200'
 : 'bg-blue-50 text-blue-800 border-blue-200'
 }`}>
 <Info size={14} className="shrink-0" />
 <span className="flex-1">{statusMessage.text}</span>
 <button onClick={() => setStatusMessage(null)} className="hover:text-black">
 <span className="font-black text-sm">×</span>
 </button>
 </div>
 )}
 </div>

 {/* Primary tabs switch */}
 <div className="flex bg-white rounded-2xl border border-slate-200 p-1 (0,0,0,1)]">
 <button 
 onClick={() => setActiveTab('guide')} 
 className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-colors ${
 activeTab === 'guide' ? 'bg-emerald-200 text-slate-900 border border-slate-200' : 'bg-white text-slate-500 hover:text-slate-800'
 }`}
 >
 KICD Standards & Inspector ({parsedLessons.length} Lessons)
 </button>
 <button 
 onClick={() => {
 setActiveTab('validator');
 // Populate sandbox if empty
 if (!validatorText && activeCurriculumText) {
 setValidatorText(activeCurriculumText);
 }
 }} 
 className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-colors ${
 activeTab === 'validator' ? 'bg-emerald-200 text-slate-900 border border-slate-200' : 'bg-white text-slate-500 hover:text-slate-800'
 }`}
 >
 Format Verification Sandbox
 </button>
 </div>

 {/* Tab Panels */}
 {activeTab === 'guide' ? (
 <div className="space-y-6">
 {/* Active Inspector Display */}
 {parsedLessons.length > 0 ? (
 <div className="bg-white rounded-2xl border border-slate-200 (0,0,0,1)] overflow-hidden">
 <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
 <div>
 <h3 className="text-sm font-black uppercase tracking-wider">KICD Schemes Explorer</h3>
 <p className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">{selectedGrade} • {selectedSubject} • {selectedTerm}</p>
 </div>
 <div className="bg-emerald-600 px-2.5 py-1 rounded-md border border-emerald-400 text-[10px] font-black uppercase font-mono">
 Verified CBC Schema
 </div>
 </div>

 {/* Grid of lessons sorted by Week */}
 <div className="p-6 space-y-8 divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
 {/* Group by Week */}
 {Array.from(new Set(parsedLessons.map(l => l.week))).map((wkName, wkIdx) => {
 const wkLessons = parsedLessons.filter(l => l.week === wkName);
 return (
 <div key={wkName} className={`pt-6 ${wkIdx === 0 ? 'pt-0' : ''}`}>
 <h4 className="text-md font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 mb-4">
 <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 block"></span>
 {wkName}
 </h4>
 
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {wkLessons.map((lesson, index) => (
 <div 
 key={index} 
 className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-slate-200 transition-colors"
 >
 <div className="space-y-2">
 <div className="flex justify-between items-center border-b border-slate-200 pb-2">
 <span className="text-[11px] font-black uppercase text-emerald-700 tracking-wider bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
 {lesson.lessonNum}
 </span>
 <span className="text-[9px] font-bold font-mono text-slate-400">Line {lesson.lineNum}</span>
 </div>

 <div className="space-y-1">
 <div className="text-[11px]">
 <span className="font-black text-slate-800 uppercase text-[9px] tracking-wider block">Strand</span>
 <span className="font-bold text-slate-600 block leading-tight">{lesson.strand}</span>
 </div>
 <div className="text-[11px]">
 <span className="font-black text-slate-800 uppercase text-[9px] tracking-wider block">Sub-Strand</span>
 <span className="font-bold text-slate-600 block leading-tight">{lesson.subStrand}</span>
 </div>
 <div className="text-[11px] pt-1">
 <span className="font-black text-slate-800 uppercase text-[9px] tracking-wider block">Content & Outcomes</span>
 <p className="font-bold text-slate-600 text-xs leading-relaxed line-clamp-3" title={lesson.content}>
 {lesson.content}
 </p>
 </div>
 </div>
 </div>

 <button
 onClick={() => handleCopy(`${lesson.strand} - ${lesson.subStrand}: ${lesson.content}`, index)}
 className="mt-4 w-full flex items-center justify-center gap-1 py-1.5 border border-slate-200 rounded-lg bg-white text-[10px] font-black uppercase text-slate-600 hover:text-black hover:border-slate-200 transition-colors"
 >
 {copiedIndex === index ? (
 <>
 <Check size={12} className="text-emerald-600 animate-pulse" />
 Copied!
 </>
 ) : (
 <>
 <Copy size={12} />
 Copy Outcome
 </>
 )}
 </button>
 </div>
 ))}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 ) : (
 <div className="bg-amber-50 border border-amber-300 p-8 rounded-2xl text-center space-y-4">
 <AlertTriangle className="text-amber-600 w-12 h-12 mx-auto" />
 <div>
 <h4 className="text-sm font-black text-amber-800 uppercase tracking-widest">No Verified Curriculum Found</h4>
 <p className="text-xs text-amber-600 font-bold max-w-md mx-auto mt-1">
 We don't have a pre-loaded verified KICD standard breakdown for {selectedGrade} ({selectedSubject}) for {selectedTerm}. You can paste a custom scheme into the sandbox tab to build and verify it!
 </p>
 </div>
 <button 
 onClick={() => setActiveTab('validator')}
 className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-colors"
 >
 Open Validation Sandbox
 </button>
 </div>
 )}

 {/* Curriculum Guide Rules Card */}
 <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
 <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
 <Info className="text-emerald-600" />
 KICD Scheme Design & Validation Rules
 </h3>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-600 font-bold">
 <div className="space-y-2 border-r border-slate-200 pr-6">
 <p className="text-emerald-800 font-black uppercase tracking-wider text-[11px]">Format Requirements</p>
 <ul className="list-disc pl-5 space-y-1.5">
 <li><strong>Term Headers:</strong> Must be wrapped in triple dashes e.g., <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">--- Term 1 ---</code></li>
 <li><strong>Week Blocks:</strong> Must start with <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">Week</code> followed by the week number.</li>
 <li><strong>Lesson Bullet:</strong> Start with <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">- Lesson [number]:</code> with exact tag spelling.</li>
 </ul>
 </div>

 <div className="space-y-2">
 <p className="text-emerald-800 font-black uppercase tracking-wider text-[11px]">Required Lesson Metadata</p>
 <ul className="list-disc pl-5 space-y-1.5">
 <li><strong>Strand:</strong> Identifies the core curriculum design theme.</li>
 <li><strong>Sub-Strand:</strong> Identifies the specific subtopic.</li>
 <li><strong>Content:</strong> Identifies KICD specific learning outcomes.</li>
 </ul>
 </div>
 </div>
 </div>
 </div>
 ) : (
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
 {/* Sandbox Editor Column */}
 <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 (0,0,0,1)] space-y-4">
 <div className="flex justify-between items-center border-b border-slate-200 pb-3">
 <div>
 <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Scheme Code Editor</h3>
 <p className="text-[10px] text-slate-400 font-bold font-mono uppercase mt-0.5">Edit or paste raw curriculum scheme structure</p>
 </div>
 
 <button
 onClick={() => validateCurriculumText(validatorText)}
 className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider border border-slate-200 rounded-xl transition-colors"
 >
 <FileCheck2 size={14} />
 Validate Format
 </button>
 </div>

 <textarea
 value={validatorText}
 onChange={(e) => setValidatorText(e.target.value)}
 className="w-full h-[400px] p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-700 leading-relaxed focus:outline-none focus:border-slate-200 focus:ring-1 focus:ring-black"
 placeholder="Paste custom curriculum document here..."
 />
 </div>

 {/* Validation Report Column */}
 <div className="lg:col-span-5 space-y-6">
 {validationReport ? (
 <>
 {/* Score Indicator Card */}
 <div className="bg-white p-6 rounded-2xl border border-slate-200 (0,0,0,1)] space-y-4">
 <div className="flex items-center justify-between border-b border-slate-200 pb-3">
 <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">CBE Quality Rating</h3>
 <span className="text-[10px] font-mono font-black text-slate-400">PASSED METRICS</span>
 </div>

 <div className="flex items-center gap-6">
 <div className="relative w-20 h-20 shrink-0 flex items-center justify-center border border-slate-200 rounded-full bg-slate-50">
 <span className="text-2xl font-black text-slate-900">{validationReport.score}%</span>
 </div>
 <div className="space-y-1">
 <p className="text-sm font-black uppercase tracking-tight text-slate-900">
 {validationReport.score >= 90 ? "Excellent KICD Alignment!" : validationReport.score >= 70 ? "Good Structural Consistency" : "Compliance Review Needed"}
 </p>
 <p className="text-[11px] text-slate-500 font-bold leading-normal uppercase">
 Structure successfully parsed into active schema components.
 </p>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-3 pt-2 text-[11px] font-mono">
 <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
 <span className="text-slate-400 uppercase font-bold text-[9px] block">Detected Terms</span>
 <span className="font-black text-slate-800 text-sm mt-0.5 block">{validationReport.summary.terms}</span>
 </div>
 <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
 <span className="text-slate-400 uppercase font-bold text-[9px] block">Detected Weeks</span>
 <span className="font-black text-slate-800 text-sm mt-0.5 block">{validationReport.summary.weeks}</span>
 </div>
 <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
 <span className="text-slate-400 uppercase font-bold text-[9px] block">Unique Strands</span>
 <span className="font-black text-slate-800 text-sm mt-0.5 block">{validationReport.summary.strands.size}</span>
 </div>
 <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
 <span className="text-slate-400 uppercase font-bold text-[9px] block">Parsed Lessons</span>
 <span className="font-black text-slate-800 text-sm mt-0.5 block">{validationReport.summary.lessons}</span>
 </div>
 </div>
 </div>

 {/* Validation Warnings / Issues Listing */}
 <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 max-h-[350px] overflow-y-auto">
 <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2">
 Line-by-Line Report ({validationReport.issues.length} Issues)
 </h3>

 {validationReport.issues.length === 0 ? (
 <div className="text-center py-6 space-y-2">
 <CheckCircle2 className="text-emerald-500 w-10 h-10 mx-auto" />
 <p className="text-xs text-slate-500 font-bold uppercase">Perfect Structure! 0 Errors detected.</p>
 </div>
 ) : (
 <div className="space-y-3">
 {validationReport.issues.map((issue, idx) => (
 <div 
 key={idx} 
 className={`p-3 rounded-lg border text-xs leading-normal flex items-start gap-2.5 ${
 issue.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-800'
 }`}
 >
 {issue.type === 'error' ? (
 <XCircle className="shrink-0 text-rose-500 mt-0.5" size={14} />
 ) : (
 <AlertTriangle className="shrink-0 text-amber-500 mt-0.5" size={14} />
 )}
 <div>
 <span className="font-black font-mono bg-white border px-1.5 py-0.5 rounded uppercase text-[9px]">
 Line {issue.lineNum}
 </span>
 <p className="font-bold mt-1.5">{issue.message}</p>
 <code className="block bg-black/5 p-1 rounded font-mono text-[10px] text-slate-600 mt-1 line-clamp-1">
 {issue.text}
 </code>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </>
 ) : (
 <div className="bg-slate-50 border border-slate-200 p-8 rounded-2xl text-center space-y-3">
 <FileCheck2 className="text-slate-400 w-12 h-12 mx-auto" />
 <div>
 <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Execute Validation</h4>
 <p className="text-xs text-slate-500 font-bold leading-normal max-w-xs mx-auto mt-1">
 Paste content into the code editor on the left and click 'Validate Format' to audit the structure.
 </p>
 </div>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Google Drive Picker Modal */}
 {showDriveModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
 <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full (0,0,0,1)] relative space-y-4">
 <button 
 onClick={() => setShowDriveModal(false)}
 className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-full border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
 >
 ×
 </button>

 <div className="flex items-center gap-3">
 <div className="bg-emerald-100 p-2.5 rounded-xl border border-emerald-300 text-emerald-800">
 <Cloud className="h-6 w-6 animate-pulse" />
 </div>
 <div>
 <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Google Drive Library</h3>
 <p className="text-[10px] text-slate-500 font-bold uppercase">Browse templates inside Google Drive Folder 'Exameno'</p>
 </div>
 </div>

 <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
 {DRIVE_TEMPLATES.map((item, idx) => (
 <div 
 key={idx} 
 className="flex justify-between items-center p-3.5 bg-slate-50 hover:bg-emerald-50 transition-colors"
 >
 <div className="space-y-0.5">
 <span className="font-black text-slate-800 block">{item.name}</span>
 <span className="text-[10px] text-slate-400 font-bold block">{item.grade} • {item.subject} • {item.term}</span>
 </div>
 <button 
 onClick={() => loadDriveTemplate(item)}
 className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase text-slate-700 hover:bg-emerald-100 hover:text-emerald-800 transition-colors shrink-0"
 >
 Select File
 </button>
 </div>
 ))}
 </div>

 <p className="text-[10px] text-slate-400 font-bold text-center uppercase tracking-tight">
 Integrated using secure OAuth encryption. Direct folder sync is fully active.
 </p>
 </div>
 </div>
 )}
 </div>
 );
};

export default TeacherResourceHub;
