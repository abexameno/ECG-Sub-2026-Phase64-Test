import React, { useState, useEffect, useRef } from 'react';
import { GeneratedContent, ContentType, QuestionType, ExportHeaderInfo, AssessmentExportType, GeneratedQuestion, SchemeOfWorkData, ROWCFormData, SchemeOfWorkEntry, ROWCLessonEntry, User, AISuggestionType } from '../types.ts';
import { ExportControls } from './ExportControls.tsx';
import MarkdownRenderer from '../utils/MarkdownRenderer.tsx';
import { generateRubric, regenerateQuestion } from '../services/geminiService.ts';
import { CurriculumAlignmentService } from '../services/curriculumAlignmentService.ts';
import { ContentArtifact, AlignmentFinding } from '../types/artifact.ts';
import ImageEditorModal from './ImageEditorModal.tsx';
import { AssessmentElmsPublishingPanel } from './AssessmentElmsPublishingPanel.tsx';
import { TeacherActionPlan } from '../types/teacherAction.ts';
import { cleanGeneratedContent } from '../lib/utils.ts';

interface ContentDisplayProps {
 content: GeneratedContent | null;
 onContentUpdate?: (updatedContent: GeneratedContent) => void;
 onContentBodyUpdate?: (newBody: string) => void;
 onDeleteQuestionImage?: (questionIndex: number) => void;
 onUploadQuestionImage?: (questionIndex: number, imageBase64: string) => void;
 onApplySuggestion?: (suggestionType: AISuggestionType) => void;
 onGenerateSingleImage?: (questionIndex: number) => void;
 onDeleteQuestion?: (questionIndex: number) => void;
 onUpdateQuestion?: (questionIndex: number, updatedQuestion: GeneratedQuestion) => void;
 onOpenIllustrationStudio?: (prompt: string, subject: string, topic: string, grade: string) => void;
 exportHeaderInfo: ExportHeaderInfo;
 setExportHeaderInfo: React.Dispatch<React.SetStateAction<ExportHeaderInfo>>;
 assessmentExportType: AssessmentExportType;
 setAssessmentExportType: React.Dispatch<React.SetStateAction<AssessmentExportType>>;
 isSuggestionLoading?: string | null;
 isReadOnly?: boolean; 
 onSaveToLibrary?: () => void;
 isSaved?: boolean;
 showAutoSaveToast?: boolean;
 currentUser?: User | null;
 onGenerateResourceFromSOW?: (
  resourceType: ContentType.LessonPlan | ContentType.LessonNotes,
  sowData: SchemeOfWorkData,
  entry: SchemeOfWorkEntry,
  parentArtifactId?: string
 ) => void;
 onMarkLessonTaughtFromSOW?: (
  sowData: SchemeOfWorkData,
  entry: SchemeOfWorkEntry,
  actualTeachingDate: string,
  parentArtifactId?: string
 ) => void;
 onGenerateAssessmentFromSOW?: (
  sowData: SchemeOfWorkData,
  entry: SchemeOfWorkEntry,
  parentArtifactId?: string
 ) => void;
 onInitiateResourceFromAction?: (
  action: TeacherActionPlan,
  preferredContentType?: ContentType,
  isFollowUpAssessment?: boolean
 ) => void;
 library?: GeneratedContent[];
}

const formatSowOutcomes = (text: string) => {
 if (!text) return '';
 return text.replace(/(Knowledge:|Skills:|Attitudes:)/g, '**$1**');
};

const EditableTextarea: React.FC<{ value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; onBlur: () => void }> = ({ value, onChange, onBlur }) => {
 const textareaRef = useRef<HTMLTextAreaElement>(null);

 useEffect(() => {
 if (textareaRef.current) {
 textareaRef.current.style.height = 'auto';
 textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
 textareaRef.current.focus();
 textareaRef.current.select();
 }
 }, [value]);

 return (
 <textarea
 ref={textareaRef}
 value={value}
 onChange={onChange}
 onBlur={onBlur}
 onKeyDown={(e) => { if (e.key === 'Escape') { (e.target as HTMLTextAreaElement).blur(); } }}
 className="w-full bg-white p-2 rounded-xl border border-slate-200 focus:outline-none text-sm text-slate-900 min-h-[50px] resize-y font-medium"
 />
 );
};

export const ContentDisplay: React.FC<ContentDisplayProps> = ({ 
 content, 
 onContentUpdate,
 onContentBodyUpdate, 
 onDeleteQuestionImage, 
 onUploadQuestionImage, 
 onGenerateSingleImage, 
 onDeleteQuestion, 
 onUpdateQuestion, 
 onOpenIllustrationStudio,
 exportHeaderInfo, 
 setExportHeaderInfo, 
 assessmentExportType, 
 setAssessmentExportType, 
 onApplySuggestion, 
 isSuggestionLoading, 
 isReadOnly = false, 
 onSaveToLibrary, 
 isSaved,
 showAutoSaveToast,
 currentUser,
 onGenerateResourceFromSOW,
 onMarkLessonTaughtFromSOW,
 onGenerateAssessmentFromSOW,
 onInitiateResourceFromAction,
 library = []
}) => {
 const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
 const [editedQuestion, setEditedQuestion] = useState<GeneratedQuestion | null>(null);
 const [currentPage, setCurrentPage] = useState(1);
 const [showSaveFeedback, setShowSaveFeedback] = useState(false);
 const [openQuestionMenuIndex, setOpenQuestionMenuIndex] = useState<number | null>(null);
 const [taughtModalLesson, setTaughtModalLesson] = useState<{ sowData: SchemeOfWorkData; entry: SchemeOfWorkEntry } | null>(null);
 const [taughtDateInput, setTaughtDateInput] = useState<string>(new Date().toISOString().split('T')[0]);
 
 const [localSuggestionLoading, setLocalSuggestionLoading] = useState<string | null>(null);
 const [isSuggestionsMenuOpen, setIsSuggestionsMenuOpen] = useState(false);
 const [isRegeneratingQuestion, setIsRegeneratingQuestion] = useState<number | null>(null);
 const isAssessment = [ContentType.Quiz, ContentType.Assessment, ContentType.TopicExam, ContentType.TermExam].includes(content?.metadata?.contentType as any);
 
 const [regeneratingSectionIndex, setRegeneratingSectionIndex] = useState<number | null>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);
 
 const [isEditingBody, setIsEditingBody] = useState(false);
 const [editedBody, setEditedBody] = useState('');
 
 const [editingCell, setEditingCell] = useState<{ type: 'rowc' | 'sow'; id: string; field: string } | null>(null);
 const [editText, setEditText] = useState('');
 const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);

 const [auditResult, setAuditResult] = useState<{ score: number; report: string; recommendations: string[] } | null>(null);
 const [alignmentStatus, setAlignmentStatus] = useState<'well_aligned' | 'needs_review' | 'significant_misalignment' | null>(null);
 const [alignmentFindings, setAlignmentFindings] = useState<AlignmentFinding[]>([]);
 const [alignmentExplanation, setAlignmentExplanation] = useState<string | null>(null);
 const [lastCheckedArtifact, setLastCheckedArtifact] = useState<ContentArtifact<GeneratedContent> | null>(null);
 const [isAuditing, setIsAuditing] = useState(false);
 const [isAiExplaining, setIsAiExplaining] = useState(false);

 const handleRunAlignmentCheck = async () => {
 if (!content) return;
 setIsAuditing(true);
 try {
 const artifact: ContentArtifact<GeneratedContent> = {
 id: content.id || 'temp',
 artifactType: content.metadata?.contentType as any || 'Document',
 schoolId: currentUser?.schoolName || 'ECG', 
 schoolName: currentUser?.schoolName || 'Exameno ECG',
 county: currentUser?.county || '',
 academicYear: new Date().getFullYear().toString(),
 curriculumId: 'canonical-cbc',
 curriculumVersion: '2024.1',
 gradeLevelId: '', 
 learningAreaId: '', 
 gradeLevelName: content.metadata?.grade || '',
 learningAreaName: content.metadata?.subject || '',
 curriculumReferences: [], 
 version: 1,
 status: 'draft',
 source: 'ai_generated',
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 content: content,
 };

 const checkedArtifact = await CurriculumAlignmentService.performAlignmentCheck(artifact);
 setAlignmentStatus(checkedArtifact.alignmentStatus || 'well_aligned');
 setAlignmentFindings(checkedArtifact.alignmentFindings || []);
 setLastCheckedArtifact(checkedArtifact);
 
 const summary = CurriculumAlignmentService.generateDeterministicSummary(
   checkedArtifact.alignmentFindings || [],
   content.metadata?.grade || 'Grade',
   content.metadata?.subject || 'Subject',
   content.metadata?.contentType || 'Document'
 );
 setAlignmentExplanation(summary);
 } catch (e) {
 console.error(e);
 alert('Alignment check failed.');
 } finally {
 setIsAuditing(false);
 }
 };

 const handleRequestAiExplanation = async () => {
   if (!lastCheckedArtifact) return;
   setIsAiExplaining(true);
   try {
     const aiSummary = await CurriculumAlignmentService.getAiExplanation(lastCheckedArtifact);
     setAlignmentExplanation(aiSummary);
   } catch (e) {
     alert('AI explanation could not be generated.');
   } finally {
     setIsAiExplaining(false);
   }
 };

 const handleRunAudit = async () => {
 if (!content) return;
 setIsAuditing(true);
 try {
 await handleRunAlignmentCheck();
 } catch (e) {
 alert('Curriculum audit failed.');
 } finally {
 setIsAuditing(false);
 }
 };

 useEffect(() => {
 if (content && currentUser?.autoClean) {
 const cleaned = cleanGeneratedContent(content);
 if (JSON.stringify(cleaned) !== JSON.stringify(content)) {
 // Apply cleaning
 if (onContentUpdate) {
 onContentUpdate(cleaned);
 }
 }
 }
 }, [content, currentUser?.autoClean]);

 useEffect(() => {
 setCurrentPage(1);
 setEditingQuestionIndex(null);
 setLocalSuggestionLoading(null);
 setRegeneratingSectionIndex(null);
 setOpenQuestionMenuIndex(null);
 setIsEditingBody(false);
 setEditingCell(null);
 }, [content?.id]);
 
 const handleStartEditingCell = (type: 'rowc' | 'sow', id: string, field: string, currentText: string) => {
 if (editingCell) handleSaveCell(); // Save previous cell if one was being edited
 setEditingCell({ type, id, field });
 setEditText(currentText);
 };

 const handleSaveCell = () => {
 if (!editingCell || !content || !onContentUpdate) {
 setEditingCell(null);
 return;
 }

 let updatedContent = { ...content };

 if (editingCell.type === 'rowc' && updatedContent.rowcData) {
 updatedContent.rowcData = {
 ...updatedContent.rowcData,
 lessons: updatedContent.rowcData.lessons.map(lesson => 
 lesson.id === editingCell.id ? { ...lesson, [editingCell.field as keyof ROWCLessonEntry]: editText } : lesson
 )
 };
 } else if (editingCell.type === 'sow' && updatedContent.schemeOfWorkData) {
 const entryIndex = parseInt(editingCell.id, 10);
 updatedContent.schemeOfWorkData = {
 ...updatedContent.schemeOfWorkData,
 entries: updatedContent.schemeOfWorkData.entries.map((entry, index) => 
 index === entryIndex ? { ...entry, [editingCell.field as keyof SchemeOfWorkEntry]: editText } : entry
 )
 };
 }

 onContentUpdate(updatedContent);
 setEditingCell(null);
 };

 const handleStartEditingQuestion = (index: number) => {
 setEditingQuestionIndex(index);
 setEditedQuestion(JSON.parse(JSON.stringify(content!.questions![index])));
 setOpenQuestionMenuIndex(null);
 };
 
 const handleSaveEditingQuestion = () => {
 if (onUpdateQuestion && editingQuestionIndex !== null && editedQuestion) {
 onUpdateQuestion(editingQuestionIndex, editedQuestion);
 }
 setEditingQuestionIndex(null);
 setEditedQuestion(null);
 };

 const handleRegenerateQuestion = async (index: number) => {
 if (!content || !content.questions || !onUpdateQuestion) return;
 setIsRegeneratingQuestion(index);
 setOpenQuestionMenuIndex(null);
 try {
 const context = content.body || JSON.stringify(content.questions.map(q => q.questionText));
 const newQ = await regenerateQuestion(content.questions[index], context);
 onUpdateQuestion(index, newQ);
 } catch (e) {
 alert('Regeneration failed.');
 } finally {
 setIsRegeneratingQuestion(null);
 }
 };

 const handleApplySuggestionInternal = async (suggestionType: AISuggestionType) => {
 if (suggestionType === AISuggestionType.GradingRubric) {
 setLocalSuggestionLoading('GRADING_RUBRIC');
 try {
 const rubric = await generateRubric(content!);
 if (onContentUpdate) {
 onContentUpdate({ ...content!, rubric: rubric });
 }
 } catch (e: any) {
 alert(e?.message || 'Failed to generate rubric.');
 } finally {
 setLocalSuggestionLoading(null);
 }
 } else if (onApplySuggestion) {
 onApplySuggestion(suggestionType);
 }
 };

 const handleImageUploadTrigger = (index: number) => {
 setOpenQuestionMenuIndex(null);
 if (fileInputRef.current) {
 fileInputRef.current.setAttribute('data-target-index', index.toString());
 fileInputRef.current.click();
 }
 };

 const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 const indexStr = e.target.getAttribute('data-target-index');
 if (file && indexStr && onUploadQuestionImage) {
 const reader = new FileReader();
 reader.onload = (event) => {
 const base64 = event.target?.result as string;
 onUploadQuestionImage(parseInt(indexStr), base64);
 };
 reader.readAsDataURL(file);
 }
 e.target.value = '';
 };
 
 if (!content) {
 return (
 <div className="bg-white border border-slate-200 border-dashed p-12 rounded-2xl text-center text-slate-500 flex flex-col justify-center items-center h-full min-h-[400px]">
 <div className="bg-mint p-4 rounded-full mb-4 border border-slate-200">
 <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
 </div>
 <p className="text-lg font-bold text-slate-700 uppercase tracking-tight">Your generated content will appear here.</p>
 </div>
 );
 }

 const QUESTIONS_PER_PAGE = 10;
 const isPaginated = content.questions && content.questions.length > QUESTIONS_PER_PAGE;
 const totalPages = isPaginated ? Math.ceil(content.questions!.length / QUESTIONS_PER_PAGE) : 1;
 const startIndex = (currentPage - 1) * QUESTIONS_PER_PAGE;
 const currentQuestions = isPaginated ? content.questions!.slice(startIndex, startIndex + QUESTIONS_PER_PAGE) : (content.questions || []);

 const SOW_PREVIEW_COLUMNS: { key: keyof SchemeOfWorkEntry; header: string; widthClass: string; align?: string }[] = [
  { key: 'week', header: 'Wk', widthClass: 'w-[55px] min-w-[55px]', align: 'text-center' },
  { key: 'lesson', header: 'Lsn', widthClass: 'w-[55px] min-w-[55px]', align: 'text-center' },
  { key: 'strand', header: 'Strand', widthClass: 'w-[150px] min-w-[130px]' },
  { key: 'subStrand', header: 'Sub-Strand', widthClass: 'w-[160px] min-w-[140px]' },
  { key: 'learningOutcomes', header: 'Learning Outcomes', widthClass: 'w-[320px] min-w-[260px]' },
  { key: 'learningExperiences', header: 'Learning Experiences', widthClass: 'w-[280px] min-w-[230px]' },
  { key: 'inquiryQuestions', header: 'Key Inquiry Questions', widthClass: 'w-[200px] min-w-[170px]' },
  { key: 'learningResources', header: 'Learning Resources', widthClass: 'w-[180px] min-w-[150px]' },
  { key: 'assessment', header: 'Assessment', widthClass: 'w-[150px] min-w-[130px]' },
  { key: 'remarks', header: 'Remarks', widthClass: 'w-[120px] min-w-[100px]' },
 ];

 const getSowPreviewCellValue = (entry: SchemeOfWorkEntry, key: keyof SchemeOfWorkEntry): string => {
  switch (key) {
    case 'week':
      return String(entry.week ?? '');
    case 'lesson':
      return String(entry.lesson ?? '');
    case 'strand':
      return String(entry.strand ?? (entry as any).strandTitle ?? '');
    case 'subStrand':
      return String(entry.subStrand ?? (entry as any).subStrandTitle ?? '');
    case 'learningOutcomes':
      return String(entry.learningOutcomes || (entry as any).specificLearningOutcomes || (entry as any).learningOutcomesText || '');
    case 'inquiryQuestions':
      return String(entry.inquiryQuestions || (entry as any).keyInquiryQuestions || '');
    case 'learningExperiences':
      return String(entry.learningExperiences || (entry as any).content || (entry as any).learningExperience || '');
    case 'learningResources':
      return String(entry.learningResources || (entry as any).resources || '');
    case 'assessment':
      return String(entry.assessment || (entry as any).assessmentMethods || '');
    case 'remarks':
      return String(entry.remarks ?? '');
    default:
      return String(entry[key] ?? '');
  }
 };

 const SchemeOfWorkTable: React.FC<{ data: SchemeOfWorkData }> = ({ data }) => (
  <div className="overflow-auto max-h-[70vh] my-8 border border-slate-200 rounded-xl shadow-sm bg-white">
  <table className="min-w-[1600px] w-full divide-y divide-slate-200 text-sm table-fixed">
  <thead className="bg-mint sticky top-0 z-10 border-b border-slate-300">
  <tr>
  {SOW_PREVIEW_COLUMNS.map(col => (
  <th key={col.key} className={`px-3 py-3.5 text-left font-black text-slate-800 uppercase tracking-widest text-[10px] ${col.widthClass} ${col.align || ''}`}>{col.header}</th>
  ))}
  <th className="px-3 py-3.5 text-left font-black text-slate-800 uppercase tracking-widest text-[10px] w-[160px] min-w-[160px]">Actions</th>
  </tr>
  </thead>
  <tbody className="bg-white divide-y divide-slate-200">
  {data.entries.map((entry, i) => (
  <tr key={entry.id || i} className="hover:bg-slate-50/80 transition-colors align-top">
  {SOW_PREVIEW_COLUMNS.map(col => {
    const rawVal = getSowPreviewCellValue(entry, col.key);
    const isEditingThisCell = editingCell?.type === 'sow' && editingCell.id === `${i}` && editingCell.field === col.key;
    return (
      <td 
        key={col.key} 
        className={`px-3 py-3 text-slate-900 font-medium text-xs break-words leading-relaxed ${col.widthClass} ${col.align || ''} cursor-pointer hover:bg-amber-50/60 transition-colors`} 
        onClick={() => handleStartEditingCell('sow', `${i}`, col.key, rawVal)}
      >
        {isEditingThisCell ? (
          <EditableTextarea value={editText} onChange={e => setEditText(e.target.value)} onBlur={handleSaveCell} />
        ) : (
          <MarkdownRenderer markdown={col.key === 'learningOutcomes' ? formatSowOutcomes(rawVal) : rawVal} className="prose-xs max-w-none" />
        )}
      </td>
    );
  })}
  <td className="px-3 py-3 text-slate-900 font-medium whitespace-nowrap w-[160px] min-w-[160px]">
   <div className="flex flex-col gap-1.5">
     <div className="flex flex-row gap-1.5">
       <button
         type="button"
         onClick={(e) => {
           e.stopPropagation();
           if (onGenerateResourceFromSOW) {
             onGenerateResourceFromSOW(ContentType.LessonPlan, data, entry, content?.id);
           }
         }}
         className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
         title="Generate Lesson Plan for this SOW lesson"
       >
         <span>📖</span> Plan
       </button>
       <button
         type="button"
         onClick={(e) => {
           e.stopPropagation();
           if (onGenerateResourceFromSOW) {
             onGenerateResourceFromSOW(ContentType.LessonNotes, data, entry, content?.id);
           }
         }}
         className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
         title="Generate Lesson Notes for this SOW lesson"
       >
         <span>📝</span> Notes
       </button>
     </div>
     <div className="flex flex-row gap-1.5">
       <button
         type="button"
         onClick={(e) => {
           e.stopPropagation();
           setTaughtModalLesson({ sowData: data, entry });
           setTaughtDateInput(entry.actualTeachingDate || new Date().toISOString().split('T')[0]);
         }}
         className={`px-2 py-1 font-bold text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm border ${
           entry.isTaught 
             ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200' 
             : 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600'
         }`}
         title={entry.isTaught ? `Taught on ${entry.actualTeachingDate}` : 'Mark this lesson as taught'}
       >
         <span>{entry.isTaught ? '✓' : '⏱️'}</span>
         <span>{entry.isTaught ? `Taught (${entry.actualTeachingDate || 'Done'})` : 'Mark Taught'}</span>
       </button>
       <button
         type="button"
         onClick={(e) => {
           e.stopPropagation();
           if (onGenerateAssessmentFromSOW) {
             onGenerateAssessmentFromSOW(data, entry, content?.id);
           }
         }}
         className="px-2 py-1 bg-purple-700 hover:bg-purple-800 text-white font-bold text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
         title="Generate Assessment bound to this SOW sub-strand"
       >
         <span>🎯</span> Assessment
       </button>
     </div>
   </div>
  </td>
  </tr>
  ))}
  </tbody>
  </table>
  </div>
 );

const ROWCTable: React.FC<{ data: ROWCFormData }> = ({ data }) => (
 <div className="overflow-x-auto my-8 border border-slate-200 rounded-xl">
 <table className="min-w-full divide-y divide-black text-sm">
 <thead className="bg-mint">
 <tr>
 {['Date', 'Strand/Lesson', 'Activities', 'Resources', 'Remarks'].map(header => (
 <th key={header} className="px-3 py-4 text-left font-black text-slate-800 uppercase tracking-widest text-[10px]">{header}</th>
 ))}
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-black/10 border border-slate-200">
 {data.lessons.map((lesson) => (
 <tr key={lesson.id} className="hover:bg-mint/30 transition-colors">
 <td className="px-3 py-4 whitespace-nowrap text-slate-900 font-bold" onClick={() => handleStartEditingCell('rowc', lesson.id, 'date', lesson.date)}>
 {editingCell?.type === 'rowc' && editingCell.id === lesson.id && editingCell.field === 'date' ? <EditableTextarea value={editText} onChange={e => setEditText(e.target.value)} onBlur={handleSaveCell} /> : lesson.date}
 </td>
 <td className="px-3 py-4">
 <div className="font-black text-emerald-800 uppercase text-[11px]" onClick={() => handleStartEditingCell('rowc', lesson.id, 'strand', lesson.strand)}>
 {editingCell?.type === 'rowc' && editingCell.id === lesson.id && editingCell.field === 'strand' ? <EditableTextarea value={editText} onChange={e => setEditText(e.target.value)} onBlur={handleSaveCell} /> : lesson.strand}
 </div>
 <div className="text-xs text-slate-600 font-bold" onClick={() => handleStartEditingCell('rowc', lesson.id, 'lessonTitle', lesson.lessonTitle)}>
 {editingCell?.type === 'rowc' && editingCell.id === lesson.id && editingCell.field === 'lessonTitle' ? <EditableTextarea value={editText} onChange={e => setEditText(e.target.value)} onBlur={handleSaveCell} /> : lesson.lessonTitle}
 </div>
 </td>
 <td className="px-3 py-4 text-slate-800 font-medium" onClick={() => handleStartEditingCell('rowc', lesson.id, 'learningActivities', lesson.learningActivities)}>
 {editingCell?.type === 'rowc' && editingCell.id === lesson.id && editingCell.field === 'learningActivities' ? <EditableTextarea value={editText} onChange={e => setEditText(e.target.value)} onBlur={handleSaveCell} /> : <MarkdownRenderer markdown={lesson.learningActivities} className="prose-xs" />}
 </td>
 <td className="px-3 py-4 text-slate-800 font-medium" onClick={() => handleStartEditingCell('rowc', lesson.id, 'resources', lesson.resources)}>
 {editingCell?.type === 'rowc' && editingCell.id === lesson.id && editingCell.field === 'resources' ? <EditableTextarea value={editText} onChange={e => setEditText(e.target.value)} onBlur={handleSaveCell} /> : lesson.resources}
 </td>
 <td className="px-3 py-4 text-slate-600 italic font-medium" onClick={() => handleStartEditingCell('rowc', lesson.id, 'remarks', lesson.remarks)}>
 {editingCell?.type === 'rowc' && editingCell.id === lesson.id && editingCell.field === 'remarks' ? <EditableTextarea value={editText} onChange={e => setEditText(e.target.value)} onBlur={handleSaveCell} /> : <MarkdownRenderer markdown={lesson.remarks} className="prose-xs" />}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 {data.reflection && (
 <div className="bg-mint p-4 rounded-xl border border-slate-200" onClick={() => handleStartEditingCell('rowc', 'main', 'reflection', data.reflection)}>
 <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">Teacher's Reflection</h4>
 {editingCell?.type === 'rowc' && editingCell.id === 'main' && editingCell.field === 'reflection' ? <EditableTextarea value={editText} onChange={e => setEditText(e.target.value)} onBlur={handleSaveCell} /> : <p className="text-sm text-slate-800 italic font-medium">{data.reflection}</p>}
 </div>
 )}
 </div>
);


 return (
 <div className="bg-white border border-slate-200 rounded-2xl flex flex-col h-full relative transition-all duration-300 overflow-hidden">
 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

 <div className="p-6 md:p-8 border-b border-slate-200 bg-mint">
 <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
 <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-tight tracking-tight">{content.title || 'Generated Document'}</h2>
 {!isReadOnly && onSaveToLibrary && (
 <button
 onClick={() => { onSaveToLibrary(); setShowSaveFeedback(true); setTimeout(() => setShowSaveFeedback(false), 2000); }}
 className={`flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-black transition-all uppercase tracking-wide ${showSaveFeedback ? 'bg-emerald-800 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
 >
 {showAutoSaveToast ? (
 <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>Auto-saved</span>
 ) : showSaveFeedback ? 'Saved!' : isSaved ? 'Save Version' : 'Save to Library'}
 </button>
 )}
 </div>
 </div>

 {!isReadOnly && (
 <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap gap-2 items-center justify-between">
 <div className="flex flex-wrap gap-2 items-center">
 <button
 onClick={handleRunAlignmentCheck}
 disabled={isAuditing}
 className={`shrink-0 px-4 py-2 text-xs font-black text-white border border-slate-200 rounded-xl transition-colors uppercase tracking-wide disabled:opacity-50 flex items-center gap-2 ${
 isAuditing ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'
 }`}
 >
 <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
 {isAuditing ? 'Checking Alignment...' : 'Verify Curriculum Alignment'}
 </button>

 <div className="relative inline-block text-left">
   <button
     onClick={() => setIsSuggestionsMenuOpen(!isSuggestionsMenuOpen)}
     disabled={!!isSuggestionLoading || !!localSuggestionLoading}
     className="shrink-0 px-4 py-2 text-xs font-black text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors uppercase tracking-wide disabled:opacity-50 flex items-center gap-2"
   >
     <span>✨</span>
     {isSuggestionLoading || localSuggestionLoading ? 'Applying Enhancement...' : 'AI Enhancements'}
     <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
       <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
     </svg>
   </button>
   {isSuggestionsMenuOpen && (
     <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-white border border-slate-200 shadow-xl z-50 p-2 space-y-1 animate-fade-in">
       <button
         onClick={() => { setIsSuggestionsMenuOpen(false); handleApplySuggestionInternal(AISuggestionType.BloomsTaxonomy); }}
         className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 rounded-xl flex items-center gap-2 transition-colors"
       >
         <span>🎯</span> Bloom's Taxonomy Progression
       </button>
       <button
         onClick={() => { setIsSuggestionsMenuOpen(false); handleApplySuggestionInternal(AISuggestionType.LearningOutcomes); }}
         className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 rounded-xl flex items-center gap-2 transition-colors"
       >
         <span>📋</span> Strengthen CBC Outcomes
       </button>
       <button
         onClick={() => { setIsSuggestionsMenuOpen(false); handleApplySuggestionInternal(AISuggestionType.ImproveQuestions); }}
         className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 rounded-xl flex items-center gap-2 transition-colors"
       >
         <span>✍️</span> Refine Questions & Answers
       </button>
       <button
         onClick={() => { setIsSuggestionsMenuOpen(false); handleApplySuggestionInternal(AISuggestionType.GradingRubric); }}
         className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 rounded-xl flex items-center gap-2 transition-colors"
       >
         <span>📊</span> Generate CBC Grading Rubric
       </button>
       <button
         onClick={() => { setIsSuggestionsMenuOpen(false); handleApplySuggestionInternal(AISuggestionType.GenerateLessonPlan); }}
         className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 rounded-xl flex items-center gap-2 transition-colors"
       >
         <span>📖</span> Generate CBC Lesson Plan
       </button>
     </div>
   )}
 </div>
 </div>
 {content.body && onContentBodyUpdate && !isReadOnly && (
 <div className="ml-auto flex gap-2">
 {isEditingBody && (
 <button onClick={() => setIsEditingBody(false)} className="shrink-0 px-4 py-2 text-xs font-black bg-slate-500 hover:bg-slate-600 text-white border border-slate-200 rounded-xl transition-colors uppercase tracking-wide">
 Cancel
 </button>
 )}
 <button 
 onClick={() => {
 if (isEditingBody) {
 onContentBodyUpdate(editedBody);
 setIsEditingBody(false);
 } else {
 setEditedBody(content.body || '');
 setIsEditingBody(true);
 }
 }}
 className={`shrink-0 px-4 py-2 text-xs font-black rounded-xl border border-slate-200 transition-colors uppercase tracking-wide ${isEditingBody ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}`}
 >
 {isEditingBody ? 'Save Content' : 'Edit Content'}
 </button>
 </div>
 )}
 </div>
 )}

 <div className="p-6 md:p-8 overflow-y-auto flex-grow custom-scrollbar bg-white">
 {alignmentStatus && (
 <div className={`mb-8 overflow-hidden rounded-xl border p-6 animate-fade-in ${
 alignmentStatus === 'well_aligned' ? 'border-emerald-200 bg-emerald-50' : 
 alignmentStatus === 'needs_review' ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50'
 }`}>
 <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200/50">
 <div className="flex items-center gap-2">
 <span className={`text-xs font-bold uppercase tracking-wider ${
 alignmentStatus === 'well_aligned' ? 'text-emerald-800' : 
 alignmentStatus === 'needs_review' ? 'text-amber-800' : 'text-rose-800'
 }`}>Curriculum Alignment</span>
 </div>
 <div className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 ${
 alignmentStatus === 'well_aligned' ? 'bg-emerald-600 text-white' : 
 alignmentStatus === 'needs_review' ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white'
 }`}>
 {alignmentStatus === 'well_aligned' ? '🟢 WELL ALIGNED' : 
 alignmentStatus === 'needs_review' ? '🟡 NEEDS REVIEW' : '🔴 SIGNIFICANT MISALIGNMENT'}
 </div>
 </div>

 <div className="grid md:grid-cols-2 gap-6">
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <h4 className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Analysis</h4>
 <button
   onClick={handleRequestAiExplanation}
   disabled={isAiExplaining}
   className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 uppercase tracking-wider flex items-center gap-1"
 >
   <span>✨</span> {isAiExplaining ? 'Elaborating...' : 'AI Elaboration (On-Demand)'}
 </button>
 </div>
 <div className="bg-white/60 p-4 rounded-xl text-sm text-slate-700 leading-relaxed border border-white/50">
 {alignmentExplanation || "Analyzing findings..."}
 </div>
 </div>

 <div className="space-y-3">
 <h4 className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Findings</h4>
 <div className="space-y-2">
 {alignmentFindings.map((finding, i) => (
 <div key={i} className="bg-white/80 p-3 rounded-lg border border-white/50 text-xs shadow-sm">
 <div className="flex items-center justify-between mb-1">
 <span className="font-semibold text-slate-800">{finding.category}</span>
 <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
 finding.status === 'well_aligned' ? 'bg-emerald-100 text-emerald-800' : 
 finding.status === 'needs_review' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
 }`}>{finding.status.replace('_', ' ')}</span>
 </div>
 <p className="text-slate-600 mb-1">{finding.message}</p>
 {finding.suggestion && (
 <div className="mt-2 pt-2 border-t border-slate-200/50 text-xs text-[#3b1464] font-medium">
 Tip: {finding.suggestion}
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>
 )}
  {content.auditReport && (
 <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-mint p-6 animate-fade-in">
 <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
 <svg className="h-5 w-5 text-emerald-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
 <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Curriculum Audit Report</span>
 </div>
 <div className="bg-white p-4 rounded-xl border border-slate-200 ">
 <MarkdownRenderer markdown={content.auditReport} className="text-slate-900 prose-sm max-w-none font-medium" />
 </div>
 </div>
 )}


 <div className="prose prose-slate max-w-none">
 {(content.metadata?.teacherActionId || content.metadata?.sourceTeacherActionId) && (
   <div className="not-prose mb-6 p-4 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-wrap items-center justify-between gap-3">
     <div className="space-y-1">
       <div className="flex flex-wrap items-center gap-2">
         <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-black uppercase tracking-wider">
           Linked to Teacher Action Plan
         </span>
         {content.metadata?.teacherActionContext?.actionType && (
           <span className="px-2 py-0.5 bg-white text-indigo-800 border border-indigo-200 rounded text-[10px] font-bold">
             {content.metadata.teacherActionContext.actionType.replace(/_/g, ' ')}
           </span>
         )}
         {content.metadata?.teacherActionContext?.focusArea && (
           <span className="text-xs font-bold text-slate-800">
             Focus: {content.metadata.teacherActionContext.focusArea}
           </span>
         )}
       </div>
       <div className="text-[11px] text-slate-600 font-mono flex flex-wrap gap-3">
         <span>Action ID: {content.metadata.teacherActionId || content.metadata.sourceTeacherActionId}</span>
         {content.metadata.ecgArtifactId && <span>Assessment ID: {content.metadata.ecgArtifactId}</span>}
       </div>
     </div>
   </div>
 )}
 {content.schemeOfWorkData && <SchemeOfWorkTable data={content.schemeOfWorkData} />}
 {content.rowcData && <ROWCTable data={content.rowcData} />}

 {content.body && (
 isEditingBody ? (
 <textarea 
 value={editedBody}
 onChange={(e) => setEditedBody(e.target.value)}
 className="w-full min-h-[600px] bg-slate-50 p-4 rounded-md border border-slate-200 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
 />
 ) : (
 <MarkdownRenderer markdown={content.body} />
 )
 )}

 {isAssessment && content && (
   <AssessmentElmsPublishingPanel
     content={content}
     currentUser={currentUser || null}
     onContentUpdate={onContentUpdate}
     library={library}
     onInitiateResourceFromAction={onInitiateResourceFromAction}
   />
 )}

 {content.questions && content.questions.length > 0 && (
 <div className="mt-12 space-y-12">
 <h2 className="text-2xl font-black text-slate-900 border-b border-slate-200 pb-4 tracking-tight">Assessment questions</h2>
 {currentQuestions.map((q, idx) => {
 const absIndex = startIndex + idx;
 const isEditing = editingQuestionIndex === absIndex;
 const isRegenerating = isRegeneratingQuestion === absIndex;

 return (
 <div key={absIndex} className="relative overflow-hidden bg-white border border-slate-200 rounded-3xl animate-fade-in group">
 <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-mint">
 <div className="flex items-center gap-3">
 <div className="bg-slate-900 px-3 py-1 rounded-lg text-white border border-slate-200 font-black text-sm uppercase tracking-tight">Q{absIndex + 1}</div>
 <div className="text-slate-600 text-[10px] font-black uppercase tracking-widest">{q.questionType}</div>
 {q.marks !== undefined && (
 <div className="bg-white px-3 py-1 rounded-lg text-[10px] font-black text-emerald-800 uppercase tracking-widest border border-slate-200">
 {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
 </div>
 )}
 {q.bloomsTaxonomyLevel && (
 <div className="bg-white px-3 py-1 rounded-lg text-[10px] font-black text-indigo-800 uppercase tracking-widest border border-slate-200">{q.bloomsTaxonomyLevel}</div>
 )}
 </div>
 {!isReadOnly && (
 <div className="relative">
 <button 
 onClick={() => setOpenQuestionMenuIndex(openQuestionMenuIndex === absIndex ? null : absIndex)}
 className={`p-2 rounded-lg transition-colors ${openQuestionMenuIndex === absIndex ? 'bg-slate-200 text-slate-900 ' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`} 
 title="Question Actions"
 >
 <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
 </button>
 {openQuestionMenuIndex === absIndex && (
 <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl z-20 py-2 border border-slate-200 animate-scale-up origin-top-right overflow-hidden">
 <button 
 onClick={() => handleRegenerateQuestion(absIndex)}
 className="w-full text-left px-4 py-3 text-sm font-black text-emerald-800 hover:bg-mint flex items-center gap-3 transition-colors uppercase tracking-tight"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
 Regenerate
 </button>
 <button 
 onClick={() => handleStartEditingQuestion(absIndex)}
 className="w-full text-left px-4 py-3 text-sm font-black text-slate-700 hover:bg-mint flex items-center gap-3 transition-colors uppercase tracking-tight"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
 Edit
 </button>
 <button 
 onClick={() => { if(window.confirm('Delete this question?')) onDeleteQuestion?.(absIndex); setOpenQuestionMenuIndex(null); }}
 className="w-full text-left px-4 py-3 text-sm font-black text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors uppercase tracking-tight"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
 Delete
 </button>
 <div className="h-px bg-black/10 my-1"></div>
 <button 
 onClick={() => onGenerateSingleImage?.(absIndex)}
 className="w-full text-left px-4 py-3 text-sm font-black text-indigo-600 hover:bg-indigo-50 flex items-center gap-3 transition-colors uppercase tracking-tight"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
 AI Image
 </button>
 <button 
 onClick={() => handleImageUploadTrigger(absIndex)}
 className="w-full text-left px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors uppercase tracking-tight"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
 Upload Image
 </button>
 </div>
 )}
 </div>
 )}
 </div>

 <div className="p-6 md:p-8 space-y-6">
 {isEditing ? (
 <div className="space-y-4 pt-4">
 <textarea 
 className="w-full p-4 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none " 
 rows={4}
 value={editedQuestion?.questionText} 
 onChange={(e) => setEditedQuestion(prev => prev ? ({...prev, questionText: e.target.value}) : null)}
 />
 <div className="flex justify-end gap-3">
 <button onClick={() => setEditingQuestionIndex(null)} className="px-4 py-2 text-xs font-bold text-white bg-slate-500 hover:bg-slate-600 border border-slate-200 rounded-xl transition-colors uppercase tracking-widest">Cancel</button>
 <button onClick={handleSaveEditingQuestion} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold border border-slate-200 rounded-xl uppercase tracking-widest transition-all">Save Changes</button>
 </div>
 </div>
 ) : isRegenerating ? (
 <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-slate-50">
 <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
 <span className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">Brainstorming...</span>
 </div>
 ) : (
 <>
 <div className="text-xl md:text-2xl font-bold text-slate-900 leading-relaxed">
 <MarkdownRenderer markdown={q.questionText} />
 </div>

 {!q.imageUrl && !q.isGeneratingImage && !isReadOnly && isAssessment && (
 <div className="flex flex-wrap justify-center gap-4 py-4">
 <button 
 onClick={() => onGenerateSingleImage?.(absIndex)}
 className="flex items-center gap-3 px-5 py-2.5 bg-white hover:bg-mint text-slate-900 border border-slate-200 rounded-2xl transition-all group/btn uppercase text-xs font-black tracking-wider"
 >
 <svg className="w-5 h-5 transition-transform group-hover/btn:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
 Generate AI Photo
 </button>
 {onOpenIllustrationStudio && (
 <button 
 onClick={() => {
 onOpenIllustrationStudio(
 q.questionText, 
 content.metadata?.subject || 'Mathematics', 
 content.metadata?.topic || '', 
 content.metadata?.grade || 'Grade 7'
 );
 }}
 className="flex items-center gap-3 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-200 rounded-2xl transition-all group/btn uppercase text-xs font-black tracking-wider"
 >
 <svg className="w-5 h-5 text-emerald-400 transition-transform group-hover/btn:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
 Design Vector Diagram
 </button>
 )}
 </div>
 )}

 {q.isGeneratingImage && (
 <div className="flex flex-col items-center justify-center p-12 bg-slate-50 border border-dashed border-slate-200 rounded-3xl animate-pulse">
 <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
 <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">AI Artist working...</span>
 </div>
 )}

 {q.imageUrl && (
 <div className="relative rounded-3xl overflow-hidden bg-white p-3 group/img border border-slate-200">
 <img src={q.imageUrl} alt="Contextual aid" className="w-full max-h-[500px] object-contain rounded-2xl mx-auto" />
 {!isReadOnly && (
 <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover/img:opacity-100 transition-opacity">
 <button 
 onClick={() => setEditingImageIndex(absIndex)}
 className="p-2 bg-white text-slate-900 border border-slate-200 rounded-full hover:bg-mint transition"
 title="Edit Image"
 >
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
 </button>
 <button 
 onClick={() => onDeleteQuestionImage?.(absIndex)}
 className="p-2 bg-rose-600 text-white border border-slate-200 rounded-full hover:bg-rose-700 transition"
 title="Delete Image"
 >
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
 </button>
 </div>
 )}
 </div>
 )}

 {q.questionType === QuestionType.MultipleChoice && q.options && (
 <div className="space-y-4 mt-6">
 {q.options.map((opt, oIdx) => (
 <div key={oIdx} className="flex items-center gap-4 group/opt cursor-default">
 <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-emerald-600 text-white rounded-full font-black text-lg group-hover/opt:scale-110 transition-transform">
 {String.fromCharCode(65 + oIdx)}
 </div>
 <span className="text-lg font-medium text-slate-900">{opt}</span>
 </div>
 ))}
 </div>
 )}

 {(assessmentExportType === AssessmentExportType.QuestionsAndAnswers || !isReadOnly) && (
 <div className="mt-8 pt-8 border-t border-slate-200/10 space-y-4">
 <div className="flex items-start gap-3">
 <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest shrink-0 mt-1">Suggested Mark Scheme:</span>
 <div className="text-slate-900 font-bold text-lg">
 <MarkdownRenderer markdown={q.correctAnswer} />
 </div>
 </div>
 {q.explanation && (
 <div className="flex items-start gap-3">
 <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest shrink-0 mt-1">Technical Logic:</span>
 <div className="text-slate-700 italic text-base leading-relaxed font-medium">
 {q.explanation}
 </div>
 </div>
 )}
 </div>
 )}
 </>
 )}
 </div>
 </div>
 );
 })}

 {isPaginated && (
 <div className="flex justify-center items-center gap-6 pt-8 border-t border-slate-200/10">
 <button 
 disabled={currentPage === 1}
 onClick={() => setCurrentPage(prev => prev - 1)}
 className="p-3 rounded-xl bg-white border border-slate-200 text-slate-900 disabled:opacity-30 hover:bg-mint transition-all "
 >
 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
 </button>
 <span className="text-xs font-black text-slate-900 bg-mint px-6 py-2 rounded-xl border border-slate-200 uppercase tracking-widest">Page {currentPage} of {totalPages}</span>
 <button 
 disabled={currentPage === totalPages}
 onClick={() => setCurrentPage(prev => prev + 1)}
 className="p-3 rounded-xl bg-white border border-slate-200 text-slate-900 disabled:opacity-30 hover:bg-mint transition-all "
 >
 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
 </button>
 </div>
 )}
 </div>
 )}

 {content.rubric && (
   <div className="mt-8 p-6 rounded-2xl border border-indigo-200 bg-indigo-50/40 animate-fade-in">
     <h3 className="text-base font-black text-indigo-950 mb-3 flex items-center gap-2">
       <span>📊</span> CBC Assessment &amp; Grading Rubric
     </h3>
     <MarkdownRenderer markdown={content.rubric} className="text-slate-800 prose-sm max-w-none" />
   </div>
 )}
 </div>
 </div>

 {!isReadOnly && (
 <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-200 transition-colors">
 <ExportControls content={content} headerInfo={exportHeaderInfo} setHeaderInfo={setExportHeaderInfo} assessmentExportType={assessmentExportType} setAssessmentExportType={setAssessmentExportType} currentUser={currentUser} artifact={lastCheckedArtifact || undefined} />
 </div>
 )}

 {editingImageIndex !== null && content.questions && content.questions[editingImageIndex] && content.questions[editingImageIndex].imageUrl && (
 <ImageEditorModal
 initialImageBase64={content.questions[editingImageIndex].imageUrl!}
 onClose={() => setEditingImageIndex(null)}
 onSave={(newImageBase64) => {
 if (onUploadQuestionImage) {
 onUploadQuestionImage(editingImageIndex, newImageBase64);
 }
 setEditingImageIndex(null);
 }}
 />
 )}

 {/* Mark Lesson as Taught Modal (Phase 25B) */}
 {taughtModalLesson && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
    <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-md w-full p-6 space-y-4 relative">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">⏱️</span>
          <h3 className="text-lg font-black text-slate-900">Mark Lesson as Taught</h3>
        </div>
        <button
          type="button"
          onClick={() => setTaughtModalLesson(null)}
          className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        >
          ✕
        </button>
      </div>

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
        <div className="flex items-center justify-between text-slate-600 font-bold">
          <span>{taughtModalLesson.sowData.grade} • {taughtModalLesson.sowData.subject}</span>
          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">{taughtModalLesson.sowData.term}</span>
        </div>
        <div className="text-sm font-black text-slate-900">
          Week {taughtModalLesson.entry.week}, Lesson {taughtModalLesson.entry.lesson}
        </div>
        <div className="font-bold text-slate-800">
          {taughtModalLesson.entry.strand} &rsaquo; {taughtModalLesson.entry.subStrand}
        </div>
        <div className="text-slate-600 italic line-clamp-2">
          {taughtModalLesson.entry.learningOutcomes}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-black uppercase text-slate-700">
          Actual Teaching Date
        </label>
        <input
          type="date"
          value={taughtDateInput}
          onChange={(e) => setTaughtDateInput(e.target.value)}
          className="w-full p-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <p className="text-[11px] text-slate-500 font-medium">
          Record the date when this lesson was actually delivered in class.
        </p>
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
        <button
          type="button"
          onClick={() => setTaughtModalLesson(null)}
          className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            if (onMarkLessonTaughtFromSOW) {
              onMarkLessonTaughtFromSOW(
                taughtModalLesson.sowData,
                taughtModalLesson.entry,
                taughtDateInput,
                content?.id
              );
            }
            setTaughtModalLesson(null);
          }}
          className="px-5 py-2.5 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm uppercase tracking-wide flex items-center gap-1.5"
        >
          <span>✓</span> Confirm Taught
        </button>
      </div>
    </div>
  </div>
 )}

 </div>
 );
};