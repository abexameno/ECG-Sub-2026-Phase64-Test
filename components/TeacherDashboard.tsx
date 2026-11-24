import React, { useState, useMemo } from 'react';
import { User, ContentType, GeneratedContent, CreditLog, SchemeOfWorkEntry, ROWCLessonEntry, AssessmentExportType } from '../types.ts';
import { CONTENT_TYPES, SUBJECTS_BY_GRADE } from '../constants.tsx';
import { ContentTypeIcon } from './ContentTypeIcon.tsx';
import { 
  Share2, X, Search, Filter, Trash2, Edit3, ExternalLink, 
  Calendar as CalendarIcon, BookOpen, GraduationCap, 
  CheckSquare, Square, Download, Loader2, CheckCircle2, AlertCircle, FileText
} from 'lucide-react';
import ReferralHub from './ReferralHub.tsx';
import { formatMergedAsPdf, isResourcePdfCompatible } from '../services/pdfService.ts';
import { auth } from '../firebase.ts';
import { SchoolMembershipService } from '../services/schoolMembershipService.ts';
import { parseDocument } from '../services/documentParser.ts';
import { parseUploadedSowText, type SowImportResult } from '../services/sowImportService.ts';
import { validateSowSourceFile } from '../services/sowSourceDocumentStorage.ts';
import { recognizeSowPdf } from '../services/sowOcrService.ts';

interface TeacherDashboardProps {
  currentUser: User;
  library: GeneratedContent[];
  onSelectContent: (content: GeneratedContent) => void;
  onDeleteContent: (id: string) => void;
  onRenameContent: (id: string, newTitle: string) => void;
  onBuyCredits: () => void;
  onReferralsClick?: () => void;
  onImportSow?: (content: GeneratedContent, sourceFile: File) => Promise<void>;
}

const ProgressOverview: React.FC<{ library: GeneratedContent[], onFilter: (subject: string, term: string) => void }> = ({ library, onFilter }) => {
  const progressData = useMemo(() => {
    const data: Record<string, Record<string, { hasMajor: boolean, hasMinor: boolean }>> = {};
    const subjects = Object.values(SUBJECTS_BY_GRADE).flat().filter((v, i, a) => a.indexOf(v) === i);
    const terms = ['Term 1', 'Term 2', 'Term 3'];

    subjects.forEach(subject => {
      data[subject] = {};
      terms.forEach(term => {
        data[subject][term] = { hasMajor: false, hasMinor: false };
      });
    });

    library.forEach(item => {
      const subject = item.metadata?.subject;
      const itemTerms = item.metadata?.terms || (item.metadata?.term ? [item.metadata.term] : []);
      if (!subject || itemTerms.length === 0) return;

      const isMajor = item.metadata?.contentType === ContentType.SchemeOfWork || item.metadata?.contentType === ContentType.TermExam;

      itemTerms.forEach(term => {
        if (data[subject] && data[subject][term]) {
          if (isMajor) data[subject][term].hasMajor = true;
          else data[subject][term].hasMinor = true;
        }
      });
    });

    // Filter out subjects with no content at all
    const filteredSubjects = subjects.filter(subject => terms.some(term => data[subject][term].hasMajor || data[subject][term].hasMinor));
    
    return { grid: data, subjects: filteredSubjects, terms };
  }, [library]);

  const { grid, subjects, terms } = progressData;

  if (subjects.length === 0) return null;

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 mt-6 transition-colors">
      <h2 className="text-xl font-bold text-slate-800 mb-3">Progress Overview</h2>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th scope="col" className="p-2 font-bold text-slate-700 text-sm">Subject</th>
              {terms.map(t => (
                <th key={t} scope="col" className="p-2 font-bold text-slate-700 text-sm text-center">{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map(subject => (
              <tr key={subject} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="p-2 font-medium text-slate-800 text-sm">{subject}</td>
                {terms.map(term => {
                  const cell = grid[subject]?.[term];
                  const hasMajor = cell?.hasMajor;
                  const hasMinor = cell?.hasMinor;
                  return (
                    <td key={term} className="p-2 text-center">
                      <button
                        onClick={() => onFilter(subject, term)}
                        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                          hasMajor
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : hasMinor
                            ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        }`}
                        title={`Filter for ${subject} in ${term}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${hasMajor ? 'bg-emerald-500' : hasMinor ? 'bg-purple-500' : 'bg-slate-300'}`}></span>
                        <span>{hasMajor ? 'Complete' : hasMinor ? 'In Progress' : 'Empty'}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const getFolderStyles = (type: string) => {
  switch (type) {
    case ContentType.LessonPlan:
      return 'border-purple-200 bg-purple-50/50 hover:bg-purple-50/80 hover:border-purple-300';
    case ContentType.LessonNotes:
      return 'border-blue-200 bg-blue-50/50 hover:bg-blue-50/80 hover:border-blue-300';
    case ContentType.StudyGuide:
      return 'border-cyan-200 bg-cyan-50/50 hover:bg-cyan-50/80 hover:border-cyan-300';
    case ContentType.SchemeOfWork:
      return 'border-amber-200 bg-amber-50/50 hover:bg-amber-50/80 hover:border-amber-300';
    case ContentType.RecordOfWorkCovered:
      return 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50/80 hover:border-emerald-300';
    case ContentType.Assessment:
    case ContentType.Quiz:
    case ContentType.TopicExam:
    case ContentType.TermExam:
      return 'border-rose-200 bg-rose-50/50 hover:bg-rose-50/80 hover:border-rose-300';
    default:
      return 'border-slate-200 bg-slate-50/50 hover:bg-slate-50/80 hover:border-slate-300';
  }
};

const getBadgeStyles = (type: string) => {
  switch (type) {
    case ContentType.LessonPlan:
      return 'bg-purple-100 text-purple-800';
    case ContentType.LessonNotes:
      return 'bg-blue-100 text-blue-800';
    case ContentType.StudyGuide:
      return 'bg-cyan-100 text-cyan-800';
    case ContentType.SchemeOfWork:
      return 'bg-amber-100 text-amber-800';
    case ContentType.RecordOfWorkCovered:
      return 'bg-emerald-100 text-emerald-800';
    case ContentType.Assessment:
    case ContentType.Quiz:
    case ContentType.TopicExam:
    case ContentType.TermExam:
      return 'bg-rose-100 text-rose-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
};

const getIconColorClass = (type: string) => {
  switch (type) {
    case ContentType.LessonPlan:
      return 'text-purple-600 group-hover:scale-110';
    case ContentType.LessonNotes:
      return 'text-blue-600 group-hover:scale-110';
    case ContentType.StudyGuide:
      return 'text-cyan-600 group-hover:scale-110';
    case ContentType.SchemeOfWork:
      return 'text-amber-600 group-hover:scale-110';
    case ContentType.RecordOfWorkCovered:
      return 'text-emerald-600 group-hover:scale-110';
    case ContentType.Assessment:
    case ContentType.Quiz:
    case ContentType.TopicExam:
    case ContentType.TermExam:
      return 'text-rose-600 group-hover:scale-110';
    default:
      return 'text-slate-600 group-hover:scale-110';
  }
};

const SOWImportPanel: React.FC<{ onImport?: (content: GeneratedContent, sourceFile: File) => Promise<void>; currentUser: User }> = ({ onImport, currentUser }) => {
  const [result, setResult] = useState<SowImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [term, setTerm] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [ocrRequired, setOcrRequired] = useState(false);

  const handleFile = async (file?: File) => {
    if (!file) return;
    const fileValidationError = validateSowSourceFile(file);
    if (fileValidationError) { setError(fileValidationError); setResult(null); setSourceFile(null); return; }
    setBusy(true); setError(''); setNotice(''); setResult(null); setOcrRequired(false);
    try {
      const text = await parseDocument(file);
      const parsed = parseUploadedSowText(text, currentUser.name || '');
      setResult(parsed); setFileName(file.name); setSourceFile(file);
      setGrade(parsed.metadata.grade || ''); setSubject(parsed.metadata.subject || '');
      setTerm(parsed.metadata.term || ''); setAcademicYear(parsed.metadata.academicYear || '');
      if (!parsed.entries.length) setNotice('The file was read, but the lesson table could not be reliably extracted. Review the source and use a text-based PDF or DOCX with a clear table. No lesson rows have been fabricated.');
    } catch (e: any) {
      const message = e?.message || 'Could not read this document.';
      if (/OCR is required/i.test(message) && file.name.toLowerCase().endsWith('.pdf')) {
        setSourceFile(file); setFileName(file.name); setOcrRequired(true);
        setNotice('This PDF has no usable selectable text. You can request secure server-side OCR, if the OCR service has been configured.');
      } else { setError(message); }
    }
    finally { setBusy(false); }
  };

  const runOcr = async () => {
    if (!sourceFile) return;
    setBusy(true); setError(''); setNotice('Running OCR on the original PDF…');
    try {
      const ocr = await recognizeSowPdf(sourceFile);
      const parsed = parseUploadedSowText(ocr.text, currentUser.name || '');
      setResult(parsed); setGrade(parsed.metadata.grade || ''); setSubject(parsed.metadata.subject || '');
      setTerm(parsed.metadata.term || ''); setAcademicYear(parsed.metadata.academicYear || '');
      setOcrRequired(false);
      setNotice(`OCR completed${ocr.pageCount ? ` for ${ocr.pageCount} pages` : ''}. Review every extracted lesson and correct any recognition errors before saving.`);
      if (!parsed.entries.length) setNotice('OCR returned text, but no reliable lesson rows were detected. Review the source document; no lesson rows have been fabricated.');
    } catch (e: any) { setError(e?.message || 'OCR processing failed.'); setNotice(''); }
    finally { setBusy(false); }
  };

  const updateEntry = (entryId: string, field: keyof SchemeOfWorkEntry, value: string) => {
    setResult(current => {
      if (!current) return current;
      const entries = current.entries.map(entry => entry.id === entryId ? { ...entry, [field]: value } : entry);
      const duplicateSlots = new Set<string>();
      const seenSlots = new Set<string>();
      const normalizeSlot = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
      entries.forEach(entry => {
        const slot = `${normalizeSlot(String(entry.week || ''))}::${normalizeSlot(String(entry.lesson || ''))}`;
        if (seenSlots.has(slot)) duplicateSlots.add(slot);
        seenSlots.add(slot);
      });
      const contentFields = ['strand','subStrand','learningOutcomes','inquiryQuestions','learningExperiences','learningResources','assessment','remarks'] as const;
      const populated = entries.reduce((total, entry) => total + contentFields.filter(key => String(entry[key] || '').trim()).length, 0);
      const populatedFieldRatio = entries.length ? populated / (entries.length * contentFields.length) : 0;
      const missingWeekCount = entries.filter(entry => !String(entry.week || '').trim()).length;
      const missingLessonCount = entries.filter(entry => !String(entry.lesson || '').trim()).length;
      const issues = [...current.quality.issues.filter(issue => !/duplicate|missing week|empty|sequence gap/i.test(issue))];
      if (duplicateSlots.size) issues.push(`${duplicateSlots.size} duplicate week/lesson slot(s) require review.`);
      if (missingWeekCount || missingLessonCount) issues.push('Some extracted rows are missing week or lesson identifiers.');
      if (populatedFieldRatio < 0.80 && entries.length) issues.push('Some lesson content fields are empty; merged source cells or extraction gaps may require teacher review.');
      const lessonsByWeek = new Map<string, number[]>();
      entries.forEach(entry => { const key = normalizeSlot(String(entry.week || '')); const number = Number(String(entry.lesson || '').match(/\d+/)?.[0]); if (key && Number.isFinite(number)) lessonsByWeek.set(key, [...(lessonsByWeek.get(key) || []), number]); });
      const sequenceGaps: string[] = [];
      lessonsByWeek.forEach((values, key) => { const unique = [...new Set(values)].sort((a,b)=>a-b); for(let n=unique[0]; n<unique[unique.length-1]; n++) if(!unique.includes(n+1)) sequenceGaps.push(`Week ${key}: lesson ${n+1} is absent between observed lessons.`); });
      if (sequenceGaps.length) issues.push(`${sequenceGaps.length} possible lesson-sequence gap(s) were found within observed weeks; verify against the uploaded schedule.`);
      const quality = { ...current.quality, duplicateSlotCount: duplicateSlots.size, missingWeekCount, missingLessonCount, populatedFieldRatio: Number(populatedFieldRatio.toFixed(3)), sequenceGapCount: sequenceGaps.length, sequenceGaps, issues };
      return { ...current, entries, quality, data: { ...current.data, entries } };
    });
  };

  const save = async () => {
    if (!result || !onImport || !sourceFile) return;
    if (!grade.trim() || !subject.trim() || !term.trim()) { setError('Grade, Subject and Term are required before saving.'); return; }
    if (!result.entries.length) { setError('No lesson rows were extracted. Saving an empty SOW is not permitted.'); return; }
    setBusy(true); setError('');
    try {
      const importedAt = new Date().toISOString();
      const data = { ...result.data, grade: grade.trim(), subject: subject.trim(), term: term.trim(), teacher: currentUser.name || result.data.teacher };
      const item: GeneratedContent = {
        title: `${data.grade} - ${data.subject} - ${data.term}`,
        body: `Imported from source document: ${fileName}\nAcademic year: ${academicYear || 'Not stated in source'}\n\nExtracted from the uploaded source document. Original file: ${fileName}.`,
        schemeOfWorkData: data,
        metadata: {
          grade: data.grade, subject: data.subject, topic: 'Uploaded Scheme of Work',
          contentType: ContentType.SchemeOfWork, term: data.term, terms: [data.term],
          sourceDocumentRef: fileName, sowAuthority: 'UPLOADED_SOURCE',
          academicYear: academicYear.trim() || undefined, importedAt,
          importWarnings: result.warnings, importQuality: result.quality,
        } as any,
      };
      await onImport(item, sourceFile);
      setNotice('SOW imported into your library. Its uploaded document is treated as the authority for its own lesson plan.');
      setResult(null); setFileName(''); setSourceFile(null);
    } catch (e: any) { setError(e?.message || 'Could not save the imported SOW.'); }
    finally { setBusy(false); }
  };

  return <section className="bg-white border border-slate-200 rounded-xl p-4 mb-5">
    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
      <div><h2 className="text-lg font-bold text-slate-900">Import an existing Scheme of Work</h2><p className="text-sm text-slate-600">Upload a school SOW. Its own lesson sequence and curriculum fields remain authoritative. The original PDF, DOCX or TXT file is securely stored with your library record. Extracted lesson records remain editable before saving.</p></div>
      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-900 px-4 py-2 text-sm font-semibold cursor-pointer hover:bg-slate-50">
        <FileText className="w-4 h-4" /> {busy ? 'Processing…' : 'Choose PDF / DOCX / TXT'}
        <input type="file" accept=".pdf,.docx,.txt" className="hidden" disabled={busy} onChange={e => handleFile(e.target.files?.[0])} />
      </label>
    </div>
    {error && <p role="alert" className="text-sm text-red-700 bg-red-50 p-2 rounded mb-3">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-800 bg-emerald-50 p-2 rounded mb-3">{notice}</p>}
    {ocrRequired && <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3"><div className="text-sm text-amber-950"><strong>Scanned PDF detected.</strong> OCR will send the document to the configured Exameno server-side Document AI processor. The original file is not changed.</div><button type="button" disabled={busy} onClick={runOcr} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Running OCR…' : 'Run OCR and extract lessons'}</button></div>}
    {result && <div className="space-y-3">
      <p className="text-xs text-slate-500">Source: {fileName} · {result.entries.length} lesson rows detected · {result.detectedColumns.length} columns detected</p>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2" aria-label="Extraction quality report">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">Extraction quality report</p><span className="text-sm font-bold text-slate-800">{result.quality.score}/100 · {result.quality.status === 'insufficient' ? 'Insufficient extraction' : 'Teacher review required'}</span></div>
        <p className="text-xs text-slate-600">This score measures structural completeness only. It does not verify curriculum correctness or guarantee that extracted text matches the source.</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs"><div><strong>{result.quality.lessonCount}</strong><br/>Lesson rows</div><div><strong>{result.quality.duplicateSlotCount}</strong><br/>Duplicate slots</div><div><strong>{result.quality.missingWeekCount + result.quality.missingLessonCount}</strong><br/>Missing identifiers</div><div><strong>{Math.round(result.quality.populatedFieldRatio * 100)}%</strong><br/>Content fields populated</div><div><strong>{Math.round(result.quality.sourcePageCoverage * 100)}%</strong><br/>Rows with page reference</div><div><strong>{result.quality.sequenceGapCount}</strong><br/>Possible sequence gaps</div></div>
        {result.quality.issues.length > 0 && <ul className="list-disc pl-5 text-xs text-amber-900">{result.quality.issues.map((issue,index)=><li key={index}>{issue}</li>)}{result.quality.sequenceGaps.map((gap,index)=><li key={`gap-${index}`}>{gap}</li>)}</ul>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <label className="text-xs font-semibold">Grade<input className="block w-full border rounded p-2 mt-1 text-sm" value={grade} onChange={e=>setGrade(e.target.value)} placeholder="Grade 7" /></label>
        <label className="text-xs font-semibold">Subject<input className="block w-full border rounded p-2 mt-1 text-sm" value={subject} onChange={e=>setSubject(e.target.value)} placeholder="English" /></label>
        <label className="text-xs font-semibold">Term<input className="block w-full border rounded p-2 mt-1 text-sm" value={term} onChange={e=>setTerm(e.target.value)} placeholder="Term 1" /></label>
        <label className="text-xs font-semibold">Academic Year<input className="block w-full border rounded p-2 mt-1 text-sm" value={academicYear} onChange={e=>setAcademicYear(e.target.value)} placeholder="2026" /></label>
      </div>
      {result.warnings.length > 0 && <div className="bg-amber-50 border border-amber-200 rounded p-3"><p className="text-sm font-semibold text-amber-900">Review required</p><ul className="list-disc pl-5 text-xs text-amber-900">{result.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></div>}
      {result.entries.length > 0 && <div className="overflow-x-auto border rounded"><table className="min-w-full text-xs"><thead className="bg-slate-50"><tr>{[['week','Week'],['lesson','Lesson']].map(([key,label])=><th key={key} className="text-left p-2 border-b min-w-36">{label}</th>)}<th className="text-left p-2 border-b min-w-24">Source page</th>{[['strand','Strand'],['subStrand','Sub-strand'],['learningOutcomes','Learning Outcomes'],['inquiryQuestions','Inquiry Questions'],['learningExperiences','Learning Experiences'],['learningResources','Resources'],['assessment','Assessment'],['remarks','Remarks']].map(([key,label])=><th key={key} className="text-left p-2 border-b min-w-36">{label}</th>)}</tr></thead><tbody>{result.entries.map(row=><tr key={row.id}>{(['week','lesson'] as const).map(field=><td key={field} className="p-1 border-b align-top"><textarea aria-label={`${field} for week ${row.week}, lesson ${row.lesson}`} className="w-full min-w-28 min-h-12 border border-slate-200 rounded p-1 text-xs" value={row[field] || ''} onChange={e=>updateEntry(row.id,field,e.target.value)} /></td>)}<td className="p-2 border-b text-slate-500">{row.sourcePage ? `Page ${row.sourcePage}` : '—'}</td>{(['strand','subStrand','learningOutcomes','inquiryQuestions','learningExperiences','learningResources','assessment','remarks'] as const).map(field=><td key={field} className="p-1 border-b align-top"><textarea aria-label={`${field} for week ${row.week}, lesson ${row.lesson}`} className="w-full min-w-28 min-h-12 border border-slate-200 rounded p-1 text-xs" value={row[field] || ''} onChange={e=>updateEntry(row.id,field,e.target.value)} /></td>)}</tr>)}</tbody></table></div>}
      <div className="flex justify-end"><button type="button" disabled={busy || !onImport || !sourceFile || !result.entries.length} onClick={save} className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-40">{busy ? 'Saving…' : 'Save to SOW Library'}</button></div>
    </div>}
  </section>;
};

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ 
  currentUser, 
  library, 
  onSelectContent, 
  onDeleteContent, 
  onRenameContent, 
  onBuyCredits, 
  onReferralsClick,
  onImportSow
}) => {
  const [selectedFolder, setSelectedFolder] = useState<ContentType | null>(null);
  const [filter, setFilter] = useState<{ subject: string, term: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showReferralModal, setShowReferralModal] = useState(false);

  // Multi-item export state
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isExportingMerged, setIsExportingMerged] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [lastBackupDate, setLastBackupDate] = useState<string | null>(() => {
    return localStorage.getItem(`last_backup_date_${currentUser.id}`);
  });

  const [showBackupNotification, setShowBackupNotification] = useState(false);

  React.useEffect(() => {
    if (!lastBackupDate) {
      setShowBackupNotification(true);
    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (new Date(lastBackupDate) < thirtyDaysAgo) {
        setShowBackupNotification(true);
      }
    }
  }, [lastBackupDate]);

  const handleBackupLibrary = () => {
    if (library.length === 0) {
      alert("Your library is empty.");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(library, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `exameno_library_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    const now = new Date().toISOString();
    localStorage.setItem(`last_backup_date_${currentUser.id}`, now);
    setLastBackupDate(now);
    setShowBackupNotification(false);
  };

  const libraryByFolder = useMemo<Record<string, GeneratedContent[]>>(() => {
    const grouped: Record<string, GeneratedContent[]> = {};
    CONTENT_TYPES.forEach(type => { grouped[type] = []; });
    
    library.forEach(item => {
      const type = item.metadata?.contentType;
      if (type && grouped[type]) {
        grouped[type].push(item);
      }
    });
    return grouped;
  }, [library]);

  const filteredLibraryItems = useMemo(() => {
    if (!filter) return [];
    return library.filter(item => {
      const subjectMatch = item.metadata?.subject === filter.subject;
      const termMatch = item.metadata?.terms?.includes(filter.term) || item.metadata?.term === filter.term;
      return subjectMatch && termMatch;
    });
  }, [library, filter]);

  const activeItems = selectedFolder ? libraryByFolder[selectedFolder] || [] : [];
  const baseItems = filter ? filteredLibraryItems : activeItems;
  
  const displayItems = useMemo(() => {
    if (!searchQuery.trim()) return baseItems;
    const query = searchQuery.toLowerCase();
    return baseItems.filter(item => 
      item.title.toLowerCase().includes(query) ||
      (item.metadata?.subject && item.metadata.subject.toLowerCase().includes(query)) ||
      (item.metadata?.grade && item.metadata.grade.toLowerCase().includes(query)) ||
      (item.metadata?.contentType && item.metadata.contentType.toLowerCase().includes(query))
    );
  }, [baseItems, searchQuery]);

  const handleFilter = (subject: string, term: string) => {
    setFilter({ subject, term });
    setSelectedFolder(null); // Clear folder selection when filtering
  };

  const clearFilters = () => {
    setFilter(null);
  };

  // Selection handlers
  const toggleSelectItem = (id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    const compatibleIds = displayItems.filter(isResourcePdfCompatible).map(item => item.id!).filter(Boolean);
    setSelectedItemIds(new Set(compatibleIds));
  };

  const handleClearSelection = () => {
    setSelectedItemIds(new Set());
  };

  const selectedItems = useMemo(() => {
    return library.filter(item => item.id && selectedItemIds.has(item.id));
  }, [library, selectedItemIds]);

  const handleMergeExport = async () => {
    if (selectedItems.length === 0) return;

    setExportFeedback(null);
    setIsExportingMerged(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Authentication required. Please log in and try again.');
      }

      const activeSchoolId = SchoolMembershipService.getActiveSchoolMembership(currentUser.id)?.school?.id || "";

      const response = await fetch('/api/library/validate-merge-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: currentUser.id,
          schoolId: activeSchoolId,
          resourceCount: selectedItems.length,
          resourceIds: selectedItems.map(item => item.id)
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "These resources could not be verified for export. Please refresh your library and try again.");
      }

      const result = await formatMergedAsPdf(selectedItems, {
        schoolName: currentUser.schoolName,
        county: currentUser.county,
        userId: currentUser.id,
        assessmentExportType: AssessmentExportType.QuestionsAndAnswers
      });

      setExportFeedback({
        type: 'success',
        message: `Successfully merged and exported ${result.documentCount} resource${result.documentCount > 1 ? 's' : ''} to "${result.filename}".`
      });

      // Clear feedback after 5 seconds
      setTimeout(() => {
        setExportFeedback(null);
      }, 5000);
    } catch (err: any) {
      console.error('Merge export error:', err);
      setExportFeedback({
        type: 'error',
        message: err.message || 'Some selected resources cannot be exported as PDF. Please select compatible resources.'
      });
    } finally {
      setIsExportingMerged(false);
    }
  };

  return (
    <div className="space-y-4">
      <SOWImportPanel currentUser={currentUser} onImport={onImportSow} />
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">My Library</h1>
          <p className="mt-1 text-slate-500 font-medium font-sans">Manage your generated CBE & CBC materials.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative flex-grow min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search my resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-200 outline-none transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 bg-white p-2.5 rounded-xl border border-slate-200 transition-colors">
            <div className="flex flex-col px-1">
              <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider leading-none">Credits</span>
              <span className="text-xl font-black text-emerald-600 leading-tight">
                {typeof currentUser.credits === 'number' ? currentUser.credits : '...'}
              </span>
            </div>
            <button 
              onClick={onBuyCredits}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg border border-slate-200 uppercase tracking-widest transition-all"
            >
              Buy More
            </button>
          </div>
        </div>
      </div>

      {showReferralModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full relative border border-slate-200">
            <button onClick={() => setShowReferralModal(false)} className="absolute top-4 right-4"><X size={20} /></button>
            <ReferralHub currentUser={currentUser} />
          </div>
        </div>
      )}

      {exportFeedback && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
          exportFeedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          {exportFeedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <p className="text-sm font-semibold flex-1">{exportFeedback.message}</p>
          <button 
            onClick={() => setExportFeedback(null)} 
            className="p-1 rounded-lg hover:bg-black/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <ProgressOverview library={library} onFilter={handleFilter} />

      {filter && (
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">Filtered View: {filter.subject} - {filter.term}</h2>
            <button onClick={clearFilters} className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md">Clear Filter</button>
          </div>
        </div>
      )}

      {!selectedFolder && !filter ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {Object.entries(libraryByFolder).map(([type, items]: [string, GeneratedContent[]]) => {
            const styles = getFolderStyles(type);
            const badgeStyles = getBadgeStyles(type);
            const iconClass = getIconColorClass(type);
            return (
              <button
                key={type}
                onClick={() => setSelectedFolder(type as ContentType)}
                className={`p-6 text-left group flex flex-col h-full border border-slate-200 rounded-2xl transition-all duration-200 shadow-sm hover:translate-y-[-2px] hover:shadow-md ${styles}`}
                aria-label={`Open ${type} folder, contains ${items.length} items`}
              >
                <div className="flex items-start justify-between mb-4 w-full">
                  <ContentTypeIcon type={type as ContentType} className={`h-12 w-12 transition-transform ${iconClass}`} />
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-slate-200 ${badgeStyles}`}>{items.length} items</span>
                </div>
                <h3 className="text-base font-black tracking-tight text-slate-900 group-hover:text-black transition-colors mt-auto">{type}</h3>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-4 sticky top-0 z-10 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => { setSelectedFolder(null); clearFilters(); }} 
                className="p-2 hover:bg-slate-100 rounded-full text-slate-600 hover:text-slate-900 transition-colors" 
                title="Back to folders" 
                aria-label="Go back to folder view"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h2 className="text-xl font-bold text-slate-800">{selectedFolder || `${filter?.subject} - ${filter?.term}`}</h2>
                <p className="text-xs text-slate-500 font-medium">{displayItems.length} items</p>
              </div>
            </div>

            {displayItems.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAllVisible}
                  className="px-3 py-2 text-xs font-bold text-purple-950 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-purple-700" />
                  Select All
                </button>
                {selectedItemIds.size > 0 && (
                  <button
                    onClick={handleClearSelection}
                    className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                    Clear Selection
                  </button>
                )}
              </div>
            )}
          </div>
          
          {displayItems.length === 0 ? (
            <div className="text-center py-24 bg-slate-50 border-t border-slate-200">
              <div className="max-w-xs mx-auto">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200 border-dashed">
                  <Search className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">No resources found</h3>
                <p className="text-sm text-slate-500 font-medium font-sans mt-1">
                  {searchQuery ? `No matches for "${searchQuery}" in this folder.` : "This folder is empty. Start generating content to see it here."}
                </p>
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="mt-4 text-[#3b1464] font-black text-xs uppercase tracking-widest hover:underline"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Mobile Card Layout */}
              <div className="md:hidden divide-y divide-slate-200 border-t border-slate-200 bg-slate-50">
                {displayItems.map((item) => {
                  const isSelected = !!item.id && selectedItemIds.has(item.id);
                  const isCompatible = isResourcePdfCompatible(item);

                  return (
                    <div 
                      key={item.id} 
                      className={`p-5 space-y-4 transition-colors ${
                        isSelected ? 'bg-purple-50/70 border-l-4 border-l-purple-600' : 'bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.id && isCompatible) toggleSelectItem(item.id);
                            }}
                            disabled={!isCompatible}
                            className={`min-w-[44px] min-h-[44px] -ml-2 -mt-2 p-2 flex items-center justify-center rounded-lg focus:outline-none ${
                              !isCompatible ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-100'
                            }`}
                            aria-label={isSelected ? `Deselect ${item.title}` : `Select ${item.title}`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-[#3b1464]" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-400" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0" onClick={() => onSelectContent(item)}>
                            <div className="flex items-center gap-2 mb-1">
                              <ContentTypeIcon type={item.metadata?.contentType as ContentType} className="w-4 h-4 text-purple-900" />
                              <span className="text-[10px] font-black text-purple-900 uppercase tracking-widest">
                                {item.metadata?.contentType}
                              </span>
                            </div>
                            {editingId === item.id ? (
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <input 
                                  type="text" 
                                  value={editTitle} 
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  className="bg-white border border-purple-500 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-purple-200 w-full font-bold"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      onRenameContent(item.id!, editTitle);
                                      setEditingId(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingId(null);
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <h3 className="text-base font-black text-slate-900 leading-tight">
                                {item.title}
                              </h3>
                            )}
                          </div>
                        </div>

                        <span className="flex-shrink-0 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                          {item.savedAt ? new Date(item.savedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '...'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 font-bold uppercase tracking-tight pl-10">
                        <div className="flex items-center gap-1">
                          <GraduationCap className="w-3 h-3 text-slate-400" />
                          <span>{item.metadata?.grade}</span>
                        </div>
                        <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                        <div className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-slate-400" />
                          <span>{item.metadata?.subject}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => onSelectContent(item)}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#3b1464] text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-200 shadow-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open
                        </button>
                        <button 
                          onClick={() => { setEditingId(item.id!); setEditTitle(item.title); }}
                          className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-blue-600 transition-all"
                          title="Rename"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => { 
                            if (window.confirm(`Delete "${item.title}"?`)) {
                              onDeleteContent(item.id!);
                            }
                          }} 
                          className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-red-600 transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] border-t border-slate-200">
                      <th scope="col" className="p-5 w-12 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedItemIds.size === displayItems.length && displayItems.length > 0) {
                              handleClearSelection();
                            } else {
                              handleSelectAllVisible();
                            }
                          }}
                          className="p-1 hover:bg-slate-200 rounded transition-colors focus:outline-none"
                          title={selectedItemIds.size === displayItems.length ? "Deselect all" : "Select all"}
                        >
                          {selectedItemIds.size > 0 && selectedItemIds.size === displayItems.length ? (
                            <CheckSquare className="w-4 h-4 text-[#3b1464]" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </th>
                      <th scope="col" className="p-5">Title</th>
                      <th scope="col" className="p-5">Context</th>
                      <th scope="col" className="p-5">Created</th>
                      <th scope="col" className="p-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {displayItems.map((item) => {
                      const isSelected = !!item.id && selectedItemIds.has(item.id);
                      const isCompatible = isResourcePdfCompatible(item);

                      return (
                        <tr 
                          key={item.id} 
                          className={`group transition-colors ${
                            isSelected ? 'bg-purple-50/60' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="p-5 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.id && isCompatible) toggleSelectItem(item.id);
                              }}
                              disabled={!isCompatible}
                              className={`p-1.5 rounded focus:outline-none ${
                                !isCompatible ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-200'
                              }`}
                              title={!isCompatible ? "Not PDF compatible" : isSelected ? "Deselect" : "Select"}
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-[#3b1464]" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                          </td>
                          <td className="p-5">
                            {editingId === item.id ? (
                              <div className="flex items-center gap-2">
                                <input 
                                  type="text" 
                                  value={editTitle} 
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  className="bg-white border border-purple-500 rounded-lg px-3 py-1.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-purple-200 w-full font-bold"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      onRenameContent(item.id!, editTitle);
                                      setEditingId(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingId(null);
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <div 
                                className="font-black text-slate-900 group-hover:text-purple-900 transition-colors cursor-pointer flex flex-wrap items-center gap-2" 
                                onClick={() => onSelectContent(item)}
                              >
                                <span className="truncate max-w-md" title={item.title}>{item.title}</span>
                                {(item.metadata?.teacherActionId || item.metadata?.sourceTeacherActionId) && (
                                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[9px] font-black uppercase tracking-wider">
                                    Action Plan Resource
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-5">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
                                {item.metadata?.subject}
                              </span>
                              <span className="text-xs font-bold text-slate-400">
                                {item.metadata?.grade}
                              </span>
                            </div>
                          </td>
                          <td className="p-5">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-700">
                                {item.savedAt ? new Date(item.savedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '...'}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">
                                {item.savedAt ? new Date(item.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                          </td>
                          <td className="p-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => onSelectContent(item)} 
                                className="px-4 py-2 text-xs font-black bg-white text-slate-900 hover:bg-slate-50 border border-slate-200 rounded-xl shadow-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all uppercase tracking-widest"
                              >
                                Open
                              </button>
                              <button 
                                onClick={() => { setEditingId(item.id!); setEditTitle(item.title); }}
                                className="p-2 text-slate-400 hover:text-purple-900 hover:bg-purple-50 rounded-lg transition-all"
                                title="Rename"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => { 
                                  if (window.confirm(`Delete "${item.title}"?`)) {
                                    onDeleteContent(item.id!);
                                  }
                                }} 
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating Multi-Item Selection Export Bar */}
      {selectedItemIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-2xl bg-[#3b1464] text-white p-4 rounded-2xl shadow-2xl border border-purple-400/30 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <FileText className="w-5 h-5 text-purple-200" />
            </div>
            <div>
              <p className="text-sm font-black tracking-tight">
                {selectedItemIds.size} Resource{selectedItemIds.size > 1 ? 's' : ''} Selected
              </p>
              <p className="text-xs text-purple-200 font-medium">
                Ready to compile into one verified PDF document
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleClearSelection}
              disabled={isExportingMerged}
              className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold text-purple-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleMergeExport}
              disabled={isExportingMerged}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExportingMerged ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Merging PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-slate-950" />
                  <span>{selectedItemIds.size === 1 ? 'Export Selected PDF' : 'Merge & Export PDF'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
      </div>
  );
};

export default TeacherDashboard;
