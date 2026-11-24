import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User } from '../types.ts';
import { LESSON_BREAKDOWNS } from '../data/curriculum/index.ts';
import { getCurriculumTextByTerm } from '../curriculumData.ts';
import { GRADES, SUBJECTS_BY_GRADE } from '../constants.tsx';
import CustomSelect from './CustomSelect.tsx';
import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { handleFirestoreError, cleanForFirestore, OperationType } from '../firebaseUtils';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import { connectToGoogleDrive } from '../services/googleDriveService';
import { exportCurriculumToCSV, exportCurriculumToMarkdown } from '../utils/curriculumExport';
import { 
  BookOpen, 
  Upload, 
  Download, 
  RefreshCw, 
  Save, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  FileText, 
  Layers, 
  ShieldAlert, 
  FileJson, 
  FileSpreadsheet,
  Cloud,
  Sparkles,
  Code,
  Clock,
  RotateCcw,
  Library,
  GraduationCap,
  CalendarDays,
  AlertTriangle,
  FileCheck2,
  XCircle,
  ExternalLink,
  Info,
  Check,
  Copy,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ShieldCheck
} from 'lucide-react';

interface CurriculumManagerProps {
  currentUser: User | null;
}

interface ParsedLessonItem {
  week: string;
  lessonNum: string;
  strand: string;
  subStrand: string;
  content: string;
  lineNum: number;
}

interface StructuredStrand {
  name: string;
  subStrands: {
    name: string;
    lessons: ParsedLessonItem[];
  }[];
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

export const CurriculumManager: React.FC<CurriculumManagerProps> = ({ currentUser }) => {
  // 1. Role / Access Check
  const isAdmin = currentUser?.role === 'Admin';

  // 2. State Management
  const [selectedGrade, setSelectedGrade] = useState<string>('Grade 1');
  const [selectedSubject, setSelectedSubject] = useState<string>('CRE');
  const [activeViewMode, setActiveViewMode] = useState<'structured' | 'raw' | 'resources' | 'upload' | 'sync'>('structured');
  const [resourceSubTab, setResourceSubTab] = useState<'guide' | 'validator' | 'export'>('guide');
  
  // Curriculum Memory Store & Overrides
  const [breakdownStore, setBreakdownStore] = useState<{ [key: string]: string }>({});
  const [firestoreOverrides, setFirestoreOverrides] = useState<{ [key: string]: { content: string; updatedAt?: string } }>({});
  const [modifiedKeys, setModifiedKeys] = useState<Set<string>>(new Set());
  
  // Timestamps Tracking
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [uploadedAt, setUploadedAt] = useState<Date | null>(() => {
    const saved = localStorage.getItem('curriculumUploadedAt');
    return saved ? new Date(saved) : null;
  });
  const [lastExportedAt, setLastExportedAt] = useState<Date | null>(() => {
    const saved = localStorage.getItem('curriculumLastExportedAt');
    return saved ? new Date(saved) : null;
  });

  // UI States
  const [isHelpOpen, setIsHelpOpen] = useState(true);
  const [selectedTerm, setSelectedTerm] = useState(() => localStorage.getItem('curriculum_selected_term') || 'All Terms');
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('curriculum_search_term') || '');
  const [toast, setToast] = useState<{message: string} | null>(null);

  useEffect(() => {
    localStorage.setItem('curriculum_selected_term', selectedTerm);
  }, [selectedTerm]);

  useEffect(() => {
    localStorage.setItem('curriculum_search_term', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const [currentTextContent, setCurrentTextContent] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(false);
  const [statusNotification, setStatusNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  
  // Resource Hub Validator & Drive States
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
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);

  // Upload States
  const [uploadRawText, setUploadRawText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<{ key: string; count: number; content: string }[] | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to Format Timestamps
  const formatTimestamp = (dateOrString?: string | Date | null): string => {
    if (!dateOrString) return 'Default Baseline';
    try {
      const d = typeof dateOrString === 'string' ? new Date(dateOrString) : dateOrString;
      if (isNaN(d.getTime())) return 'Default Baseline';
      return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Default Baseline';
    }
  };

  // Helper to build current breakdown key
  const getSubjectKey = (grade: string, subject: string): string => {
    let normalizedSubject = subject.toUpperCase()
      .replace(/ & /g, '_&_')
      .replace(/\s+/g, '_');

    if (subject === 'CRE') normalizedSubject = 'CRE';
    else if (subject.includes('Christian Religious Education')) normalizedSubject = 'CHRISTIAN_RELIGIOUS_EDUCATION_(CRE)';
    else if (subject.includes('Science & Technology')) normalizedSubject = 'SCIENCE_&_TECHNOLOGY';
    else if (subject.includes('Integrated Science')) normalizedSubject = 'INTEGRATED_SCIENCE';
    else if (subject.includes('Pre-Technical')) normalizedSubject = 'PRE-TECHNICAL_STUDIES';
    else if (subject.includes('Creative Arts')) normalizedSubject = 'CREATIVE_ARTS_AND_SPORTS';
    else if (subject.includes('Social Studies')) normalizedSubject = 'SOCIAL_STUDIES';
    else if (subject.includes('Environmental')) normalizedSubject = 'ENVIRONMENTAL';

    return `${grade.toUpperCase().replace(/\s+/g, '_')}_${normalizedSubject}_LESSON_BREAKDOWN`;
  };

  const currentKey = useMemo(() => getSubjectKey(selectedGrade, selectedSubject), [selectedGrade, selectedSubject]);

  // Available subjects for selected grade
  const availableSubjects = useMemo(() => {
    return SUBJECTS_BY_GRADE[selectedGrade] || ['English', 'Mathematics', 'Kiswahili', 'CRE'];
  }, [selectedGrade]);

  // Ensure selectedSubject is valid for selectedGrade
  useEffect(() => {
    if (!availableSubjects.includes(selectedSubject)) {
      setSelectedSubject(availableSubjects[0] || 'English');
    }
  }, [selectedGrade, availableSubjects]);

  // Persist timestamps to localStorage
  useEffect(() => {
    if (uploadedAt) localStorage.setItem('curriculumUploadedAt', uploadedAt.toISOString());
  }, [uploadedAt]);

  useEffect(() => {
    if (lastExportedAt) localStorage.setItem('curriculumLastExportedAt', lastExportedAt.toISOString());
  }, [lastExportedAt]);

  // Fetch Firestore Overrides
  const fetchFirestoreOverrides = async () => {
    setIsLoadingFirestore(true);
    try {
      const overridesRef = collection(db, 'curriculum_overrides');
      const snapshot = await getDocs(overridesRef);
      const overrides: { [key: string]: { content: string; updatedAt?: string } } = {};
      
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data && data.content) {
          overrides[docSnap.id] = {
            content: data.content,
            updatedAt: data.updatedAt || new Date().toISOString()
          };
        }
      });

      setFirestoreOverrides(overrides);

      // Apply overrides to active store
      setBreakdownStore(prev => {
        const updated = { ...prev };
        Object.keys(overrides).forEach(key => {
          updated[key] = overrides[key].content;
        });
        return updated;
      });

      setLastRefreshedAt(new Date());

      setStatusNotification({
        type: 'success',
        message: `Loaded ${Object.keys(overrides).length} custom curriculum override(s) from Firestore.`
      });
    } catch (err: any) {
      console.error('Error fetching Firestore curriculum overrides:', err);
      handleFirestoreError(err, OperationType.LIST, 'curriculum_overrides');
    } finally {
      setIsLoadingFirestore(false);
    }
  };

  // Initialize Data on mount
  useEffect(() => {
    const initialStore: { [key: string]: string } = { ...LESSON_BREAKDOWNS };
    setBreakdownStore(initialStore);
    fetchFirestoreOverrides();
  }, []);

  // Refresh Cache Action
  const handleRefreshCache = async () => {
    // Clear curriculum local cache items
    localStorage.removeItem('curriculumUploadedAt');
    localStorage.removeItem('curriculumLastExportedAt');
    setUploadedAt(null);
    setLastExportedAt(null);

    // Reset store to built-in defaults
    const resetStore: { [key: string]: string } = { ...LESSON_BREAKDOWNS };
    setBreakdownStore(resetStore);
    setModifiedKeys(new Set());

    // Re-fetch from Firestore
    await fetchFirestoreOverrides();
    setLastRefreshedAt(new Date());

    setStatusNotification({
      type: 'success',
      message: 'Local cache cleared successfully and re-synced fresh curriculum data from Firestore.'
    });
  };

  // Sync current text content when subject/grade changes or breakdownStore updates
  useEffect(() => {
    const text = breakdownStore[currentKey] || getCurriculumTextByTerm(selectedGrade, selectedSubject, []) || '';
    setCurrentTextContent(text);
  }, [currentKey, breakdownStore, selectedGrade, selectedSubject]);

  // KICD Parser for Structured View
  const parseBreakdownText = (text: string): StructuredStrand[] => {
    if (!text) return [];

    const lines = text.split('\n');
    const strandMap: { [strandName: string]: { [subStrandName: string]: ParsedLessonItem[] } } = {};
    let currentWeek = 'Week 1';

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (/^week\s*\d+/i.test(trimmed)) {
        currentWeek = trimmed;
        return;
      }

      const lessonMatch = trimmed.match(/-?\s*Lesson\s*(\d+)[\s:]*Strand[\s:]*([^,;]+),\s*Sub-Strand[\s:]*([^,;]+),\s*Content[\s:]*(.*)/i) ||
                          trimmed.match(/-?\s*Lesson\s*(\d+)[\s:]*Topic[\s:]*([^,;]+),\s*Subtopic[\s:]*([^,;]+),\s*Content[\s:]*(.*)/i);

      if (lessonMatch) {
        const lessonNum = lessonMatch[1].trim();
        const strand = lessonMatch[2].trim();
        const subStrand = lessonMatch[3].trim();
        const content = lessonMatch[4].trim();

        if (!strandMap[strand]) strandMap[strand] = {};
        if (!strandMap[strand][subStrand]) strandMap[strand][subStrand] = [];

        strandMap[strand][subStrand].push({
          week: currentWeek,
          lessonNum,
          strand,
          subStrand,
          content,
          lineNum: index + 1
        });
      }
    });

    return Object.keys(strandMap).map(strandName => ({
      name: strandName,
      subStrands: Object.keys(strandMap[strandName]).map(subStrandName => ({
        name: subStrandName,
        lessons: strandMap[strandName][subStrandName]
      }))
    }));
  };

  const structuredStrands = useMemo(() => parseBreakdownText(currentTextContent), [currentTextContent]);

  const filteredStrands = useMemo(() => {
    if (!searchTerm.trim()) return structuredStrands;
    const lowerSearch = searchTerm.toLowerCase();

    return structuredStrands.filter(s => {
      const matchStrand = s.name.toLowerCase().includes(lowerSearch);
      const matchSubStrand = s.subStrands.some(sub => sub.name.toLowerCase().includes(lowerSearch));
      const matchLesson = s.subStrands.some(sub => sub.lessons.some(l => l.content.toLowerCase().includes(lowerSearch)));
      return matchStrand || matchSubStrand || matchLesson;
    });
  }, [structuredStrands, searchTerm]);

  // Save changes to local store
  const handleSaveTextContent = (newText: string) => {
    setCurrentTextContent(newText);
    setBreakdownStore(prev => ({ ...prev, [currentKey]: newText }));
    setModifiedKeys(prev => new Set(prev).add(currentKey));

    setToast({ message: 'Content Saved' });

    setStatusNotification({
      type: 'info',
      message: `Updated local curriculum for ${selectedGrade} - ${selectedSubject}. Click "Sync to Firestore" to persist globally.`
    });
  };

  // Sync current key to Firestore
  const handleSyncCurrentToFirestore = async () => {
    if (!currentTextContent.trim()) {
      setStatusNotification({ type: 'error', message: 'Cannot sync empty curriculum text.' });
      return;
    }

    setIsSyncing(true);
    const nowIso = new Date().toISOString();
    try {
      const docRef = doc(db, 'curriculum_overrides', currentKey);
      await setDoc(docRef, cleanForFirestore({
        key: currentKey,
        grade: selectedGrade,
        subject: selectedSubject,
        content: currentTextContent,
        updatedAt: nowIso
      }));

      setFirestoreOverrides(prev => ({
        ...prev,
        [currentKey]: { content: currentTextContent, updatedAt: nowIso }
      }));

      setModifiedKeys(prev => {
        const next = new Set(prev);
        next.delete(currentKey);
        return next;
      });

      setStatusNotification({
        type: 'success',
        message: `Synced ${selectedGrade} - ${selectedSubject} curriculum to Firestore cloud!`
      });
    } catch (err: any) {
      console.error('Sync failed:', err);
      handleFirestoreError(err, OperationType.WRITE, `curriculum_overrides/${currentKey}`);
      setStatusNotification({ type: 'error', message: `Sync failed: ${err.message}` });
    } finally {
      setIsSyncing(false);
    }
  };

  // Bulk sync all modified keys to Firestore
  const handleBulkSyncToFirestore = async () => {
    if (modifiedKeys.size === 0) {
      setStatusNotification({ type: 'info', message: 'No unsynced local changes found.' });
      return;
    }

    setIsSyncing(true);
    const nowIso = new Date().toISOString();
    try {
      const batch = writeBatch(db);
      modifiedKeys.forEach(key => {
        const docRef = doc(db, 'curriculum_overrides', key);
        const content = breakdownStore[key];
        if (content) {
          batch.set(docRef, cleanForFirestore({
            key,
            content,
            updatedAt: nowIso
          }));
        }
      });

      await batch.commit();

      setModifiedKeys(new Set());
      await fetchFirestoreOverrides();

      setStatusNotification({
        type: 'success',
        message: `Batch-synced ${modifiedKeys.size} curriculum breakdown(s) to Firestore!`
      });
    } catch (err: any) {
      console.error('Batch sync failed:', err);
      setStatusNotification({ type: 'error', message: `Batch sync failed: ${err.message}` });
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete override from Firestore
  const handleDeleteOverride = async (key: string) => {
    if (!window.confirm(`Revert ${key} to default built-in curriculum? This will remove the Firestore override.`)) return;

    try {
      await deleteDoc(doc(db, 'curriculum_overrides', key));
      setFirestoreOverrides(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      const defaultText = LESSON_BREAKDOWNS[key] || '';
      setBreakdownStore(prev => ({ ...prev, [key]: defaultText }));
      if (key === currentKey) setCurrentTextContent(defaultText);

      setStatusNotification({
        type: 'success',
        message: `Reverted ${key} to built-in KICD default.`
      });
    } catch (err: any) {
      console.error('Error deleting override:', err);
      handleFirestoreError(err, OperationType.DELETE, `curriculum_overrides/${key}`);
    }
  };

  // Add Strand & Sub-strand
  const handleAddStrand = () => {
    const strandName = prompt('Enter new Strand name (e.g. "Numbers & Operations"):');
    if (!strandName?.trim()) return;

    const newStrandBlock = `\n\nStrand: ${strandName.trim()}\nSub-Strand: General Concept\n- Lesson 1: Strand: ${strandName.trim()}, Sub-Strand: General Concept, Content: Introduction to ${strandName.trim()}.`;
    handleSaveTextContent(currentTextContent + newStrandBlock);
  };

  const handleAddSubStrand = (strandName: string) => {
    const subStrandName = prompt(`Enter new Sub-Strand under "${strandName}":`);
    if (!subStrandName?.trim()) return;

    const newSubBlock = `\n- Lesson 1: Strand: ${strandName}, Sub-Strand: ${subStrandName.trim()}, Content: Core learning outcome for ${subStrandName.trim()}.`;
    handleSaveTextContent(currentTextContent + newSubBlock);
  };

  // Process Upload Payload
  const handleProcessUploadPayload = (rawString: string) => {
    setUploadError(null);
    setParsedPreview(null);

    if (!rawString.trim()) {
      setUploadError('Please select a file or paste curriculum data.');
      return;
    }

    try {
      const results: { key: string; count: number; content: string }[] = [];
      let isJson = false;

      try {
        const jsonData = JSON.parse(rawString);
        isJson = true;

        if (Array.isArray(jsonData)) {
          jsonData.forEach((item: any) => {
            if (item.key && item.content) {
              results.push({ key: item.key, count: item.content.split('\n').length, content: item.content });
            }
          });
        } else if (typeof jsonData === 'object') {
          Object.keys(jsonData).forEach(key => {
            const val = jsonData[key];
            if (typeof val === 'string') {
              results.push({ key, count: val.split('\n').length, content: val });
            } else if (typeof val === 'object' && val.content) {
              results.push({ key, count: val.content.split('\n').length, content: val.content });
            }
          });
        }
      } catch (e) {
        // Not JSON
      }

      if (!isJson) {
        const parsedCsv = Papa.parse(rawString, { header: true, skipEmptyLines: true });
        if (parsedCsv.data && parsedCsv.data.length > 0) {
          const firstRow: any = parsedCsv.data[0];

          if ('key' in firstRow || 'Key' in firstRow) {
            parsedCsv.data.forEach((row: any) => {
              const k = row.key || row.Key;
              const c = row.content || row.Content;
              if (k && c) {
                results.push({ key: k, count: String(c).split('\n').length, content: String(c) });
              }
            });
          }
        }
      }

      if (results.length === 0 && rawString.trim().length > 10) {
        results.push({
          key: currentKey,
          count: rawString.split('\n').length,
          content: rawString.trim()
        });
      }

      if (results.length === 0) {
        setUploadError('Unable to parse curriculum structure from provided data. Please ensure it follows JSON, CSV, or KICD breakdown format.');
      } else {
        setParsedPreview(results);
      }
    } catch (err: any) {
      setUploadError(`Parsing error: ${err.message}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setUploadRawText(text);
      setUploadedAt(new Date());
      handleProcessUploadPayload(text);
    };
    reader.readAsText(file);
  };

  const handleCommitUploadPreview = () => {
    if (!parsedPreview || parsedPreview.length === 0) return;

    setBreakdownStore(prev => {
      const next = { ...prev };
      parsedPreview.forEach(item => {
        next[item.key] = item.content;
      });
      return next;
    });

    setModifiedKeys(prev => {
      const next = new Set(prev);
      parsedPreview.forEach(item => next.add(item.key));
      return next;
    });

    const currentUploaded = parsedPreview.find(p => p.key === currentKey);
    if (currentUploaded) {
      setCurrentTextContent(currentUploaded.content);
    }

    setUploadedAt(new Date());

    setStatusNotification({
      type: 'success',
      message: `Applied ${parsedPreview.length} curriculum breakdown(s) to local editor. Click "Sync to Firestore" to persist globally.`
    });

    setParsedPreview(null);
    setUploadRawText('');
    setActiveViewMode('structured');
  };

  // Export Handlers
  const handleExportJSON = () => {
    const exportData: { [key: string]: string } = {};
    Object.keys(breakdownStore).forEach(key => {
      if (breakdownStore[key]) exportData[key] = breakdownStore[key];
    });

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ECG_Curriculum_Export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setLastExportedAt(new Date());
  };

  const handleExportCSV = () => {
    const content = exportCurriculumToCSV(breakdownStore);
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ECG_Curriculum_Export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setLastExportedAt(new Date());
  };

  const handleExportMarkdown = () => {
    const content = exportCurriculumToMarkdown(breakdownStore);
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ECG_Curriculum_Export_${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setLastExportedAt(new Date());
  };

  const handleExportPDF = () => {
    const currentText = currentTextContent || getCurriculumTextByTerm(selectedGrade, selectedSubject, [selectedTerm]);
    if (!currentText.trim()) {
      setStatusNotification({ type: 'error', message: 'No curriculum content loaded to export as PDF.' });
      return;
    }

    try {
      const doc = new jsPDF();
      doc.setFont('Helvetica');

      // Title & Header
      doc.setFontSize(20);
      doc.setTextColor(5, 150, 105);
      doc.text("EXAMENO CBE CONTENT GENERATOR", 105, 25, { align: 'center' });

      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text("Official Curriculum Schemes of Work", 105, 34, { align: 'center' });

      doc.setDrawColor(200, 200, 200);
      doc.line(20, 40, 190, 40);

      // Metadata
      doc.setFontSize(10);
      doc.text(`Grade Level: ${selectedGrade}`, 20, 50);
      doc.text(`Subject: ${selectedSubject}`, 20, 57);
      doc.text(`Term: ${selectedTerm}`, 20, 64);
      doc.text(`Exported On: ${new Date().toLocaleDateString('en-GB')}`, 20, 71);

      doc.line(20, 77, 190, 77);

      let yPos = 88;
      const lines = currentText.split('\n');

      lines.forEach(line => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }

        const trimmed = line.trim();
        if (!trimmed) return;

        if (trimmed.startsWith('---') || trimmed.startsWith('Week')) {
          doc.setFontSize(11);
          doc.setTextColor(5, 150, 105);
          doc.text(trimmed, 20, yPos);
          yPos += 7;
        } else {
          doc.setFontSize(9);
          doc.setTextColor(51, 65, 85);
          const splitLines = doc.splitTextToSize(trimmed, 165);
          doc.text(splitLines, 25, yPos);
          yPos += (splitLines.length * 5) + 2;
        }
      });

      doc.save(`Exameno_${selectedGrade}_${selectedSubject.replace(/\s+/g, '_')}_Scheme.pdf`);
      setLastExportedAt(new Date());
      setStatusNotification({ type: 'success', message: 'Curriculum PDF generated and downloaded successfully.' });
    } catch (err: any) {
      console.error('PDF generation error:', err);
      setStatusNotification({ type: 'error', message: `PDF Export failed: ${err.message}` });
    }
  };

  // Scheme Sandbox Validator Engine
  const validateCurriculumText = (text: string) => {
    if (!text.trim()) {
      setStatusNotification({ message: 'Please enter curriculum content to validate.', type: 'error' });
      return;
    }

    const lines = text.split('\n');
    const issues: ValidationIssue[] = [];
    let termCount = 0;
    let weekCount = 0;
    let lessonCount = 0;
    const strands = new Set<string>();
    const subStrands = new Set<string>();

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();
      if (!trimmed) return;

      if (/^-{3,}\s*term\s+(\d)/i.test(trimmed)) {
        termCount++;
        return;
      }

      if (/^week\s+(\d+)/i.test(trimmed)) {
        weekCount++;
        return;
      }

      if (/^-\s*lesson/i.test(trimmed) || /^lesson/i.test(trimmed)) {
        lessonCount++;

        if (!trimmed.startsWith('-')) {
          issues.push({
            lineNum,
            type: 'warning',
            message: "Standard KICD recommendations suggest starting lesson lines with a hyphen '- '.",
            text: trimmed
          });
        }

        const hasStrand = /strand\s*:/i.test(trimmed);
        const hasSubStrand = /sub-strand\s*:/i.test(trimmed);
        const hasContent = /content\s*:/i.test(trimmed);

        if (!hasStrand) {
          issues.push({ lineNum, type: 'error', message: "Missing 'Strand:' tag in lesson definition.", text: trimmed });
        }
        if (!hasSubStrand) {
          issues.push({ lineNum, type: 'error', message: "Missing 'Sub-Strand:' tag in lesson definition.", text: trimmed });
        }
        if (!hasContent) {
          issues.push({ lineNum, type: 'error', message: "Missing 'Content:' block detailing learning outcomes.", text: trimmed });
        }

        const strandMatch = trimmed.match(/strand\s*:\s*([^,]+)/i);
        const subStrandMatch = trimmed.match(/sub-strand\s*:\s*([^,]+)/i);
        if (strandMatch) strands.add(strandMatch[1].trim());
        if (subStrandMatch) subStrands.add(subStrandMatch[1].trim());
      }
    });

    if (termCount === 0) {
      issues.push({ lineNum: 1, type: 'warning', message: "No '--- Term X ---' block detected.", text: "Header" });
    }

    const errors = issues.filter(i => i.type === 'error').length;
    const warnings = issues.filter(i => i.type === 'warning').length;
    const rawScore = 100 - (errors * 15) - (warnings * 5);
    const score = Math.max(0, Math.min(100, rawScore));

    setValidationReport({
      score,
      issues,
      summary: { terms: termCount, weeks: weekCount, lessons: lessonCount, strands, subStrands }
    });

    setStatusNotification({
      type: errors > 0 ? 'error' : 'success',
      message: errors > 0 
        ? `Validation found ${errors} error(s) and ${warnings} warning(s).` 
        : `Validation successful! Curriculum alignment score: ${score}%`
    });
  };

  // Connect Google Drive
  const handleConnectDrive = async () => {
    setIsSyncingDrive(true);
    try {
      const token = await connectToGoogleDrive();
      setDriveToken(token);
      setStatusNotification({ type: 'success', message: 'Google Drive connected successfully for curriculum backups!' });
    } catch (err: any) {
      console.error('Drive connection error:', err);
      setStatusNotification({ type: 'error', message: `Google Drive connection failed: ${err.message}` });
    } finally {
      setIsSyncingDrive(false);
    }
  };

  // Access Denied for Non-Admins
  if (!isAdmin) {
    return (
      <div className="p-8 bg-rose-50 border-2 border-rose-300 rounded-2xl text-center space-y-4 max-w-2xl mx-auto my-12 shadow-sm">
        <div className="w-16 h-16 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto border border-rose-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-rose-900 uppercase tracking-tight">Access Restricted</h2>
        <p className="text-sm font-semibold text-rose-700 leading-relaxed">
          The Curriculum & Resources Manager is restricted strictly to users with the <span className="font-bold underline">Admin</span> role.
        </p>
        <p className="text-xs text-rose-600 italic">Current Role: {currentUser?.role || 'Guest'}</p>
      </div>
    );
  }

  // Summary Counts
  const totalBreakdownKeys = Object.keys(breakdownStore).length;
  const totalOverridesCount = Object.keys(firestoreOverrides).length;
  const unsyncedChangesCount = modifiedKeys.size;
  const activeSubjectUpdatedAt = firestoreOverrides[currentKey]?.updatedAt;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 border border-slate-200 text-[10px] font-black rounded uppercase">
                Admin Exclusive
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-slate-200 text-[10px] font-black rounded uppercase">
                KICD CBC / CBE Engine
              </span>
              <span className="px-2.5 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-mono font-bold rounded flex items-center gap-1">
                <Clock className="w-3 h-3 text-indigo-600" />
                Cache Refreshed: {formatTimestamp(lastRefreshedAt)}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 mt-1 uppercase tracking-tight flex items-center gap-2">
              <BookOpen className="w-7 h-7 text-indigo-700" />
              Curriculum & Resources Manager
            </h1>
            <p className="text-xs font-semibold text-slate-600 mt-1">
              Centralized platform to manage KICD curriculum strands, lesson breakdowns, scheme validation, document exports, and Firestore synchronization.
            </p>
          </div>

          {/* Quick Actions Control Bar */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsHelpOpen(prev => !prev)}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              title="Toggle Administrator Guidance & How to Use This Manager"
            >
              <HelpCircle className="w-4 h-4 text-indigo-700" />
              {isHelpOpen ? 'Hide Guide' : 'How to Use This Manager'}
            </button>
            <button
              onClick={handleRefreshCache}
              disabled={isLoadingFirestore}
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              title="Clear local curriculum cache and re-sync from Firestore"
            >
              <RotateCcw className={`w-4 h-4 ${isLoadingFirestore ? 'animate-spin' : ''}`} /> Refresh Cache
            </button>
            <button
              onClick={handleExportJSON}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
              title="Export all curriculum data as JSON"
            >
              <FileJson className="w-4 h-4" /> JSON Export
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
              title="Export all curriculum data as CSV"
            >
              <FileSpreadsheet className="w-4 h-4" /> CSV Export
            </button>
            <button
              onClick={fetchFirestoreOverrides}
              disabled={isLoadingFirestore}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingFirestore ? 'animate-spin' : ''}`} /> Reload Firestore
            </button>
          </div>
        </div>

        {/* Status Toast / Notification */}
        {statusNotification && (
          <div className={`p-4 rounded-xl border border-slate-200 text-xs font-bold flex items-start justify-between gap-3 ${
            statusNotification.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-500' :
            statusNotification.type === 'error' ? 'bg-rose-50 text-rose-900 border-rose-500' :
            'bg-blue-50 text-blue-900 border-blue-500'
          }`}>
            <div className="flex items-center gap-2">
              {statusNotification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> :
               statusNotification.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" /> :
               <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />}
              <span>{statusNotification.message}</span>
            </div>
            <button onClick={() => setStatusNotification(null)} className="text-slate-500 hover:text-black">×</button>
          </div>
        )}

        {/* Stat Cards Row with Timestamps */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="p-4 bg-indigo-50/50 rounded-xl border border-slate-200 space-y-1">
            <div className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">Total KICD Breakdowns</div>
            <div className="text-2xl font-black text-slate-900">{totalBreakdownKeys}</div>
            <div className="text-[10px] text-slate-500 font-bold">Grades 1–10 + Pre-Primary</div>
          </div>

          <div className="p-4 bg-emerald-50/50 rounded-xl border border-slate-200 space-y-1">
            <div className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Firestore Overrides</div>
            <div className="text-2xl font-black text-emerald-900">{totalOverridesCount}</div>
            <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
              <Clock className="w-3 h-3 text-emerald-600" />
              <span>Refreshed: {formatTimestamp(lastRefreshedAt).split(',')[0]}</span>
            </div>
          </div>

          <div className="p-4 bg-amber-50/50 rounded-xl border border-slate-200 space-y-1">
            <div className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Unsaved Local Changes</div>
            <div className="text-2xl font-black text-amber-900">{unsyncedChangesCount}</div>
            <div className="text-[10px] text-slate-500 font-bold">
              {unsyncedChangesCount > 0 ? (
                <button onClick={handleBulkSyncToFirestore} className="text-amber-800 underline hover:font-black">Sync All Now</button>
              ) : 'All Synced to Cloud'}
            </div>
          </div>

          <div className="p-4 bg-purple-50/50 rounded-xl border border-slate-200 space-y-1">
            <div className="text-[10px] font-black uppercase text-purple-700 tracking-wider">Active Subject Status</div>
            <div className="text-sm font-black text-slate-900 truncate">{selectedGrade} &bull; {selectedSubject}</div>
            <div className="text-[10px] text-slate-600 font-mono font-bold flex items-center gap-1 truncate">
              <Clock className="w-3 h-3 text-purple-600 shrink-0" />
              <span>Last Updated: {formatTimestamp(activeSubjectUpdatedAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* HOW TO USE THIS MANAGER - Administrator Guidance & Authority Guardrails */}
      {isHelpOpen && (
        <div id="curriculum-manager-help" className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-5 md:p-6 shadow-md space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-black uppercase rounded tracking-wider">
                    Administrator Guidance
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black uppercase rounded tracking-wider">
                    Authority Guardrails
                  </span>
                </div>
                <h2 className="text-lg md:text-xl font-black text-white tracking-tight uppercase mt-0.5 flex items-center gap-2">
                  HOW TO USE THIS MANAGER
                </h2>
              </div>
            </div>
            <button
              onClick={() => setIsHelpOpen(false)}
              className="px-2.5 py-1 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
            >
              Dismiss
            </button>
          </div>

          {/* Six-Step Guidance */}
          <div className="space-y-2">
            <div className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
              <span>Standard 6-Step Workflow</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 space-y-1">
                <div className="text-[11px] font-black text-indigo-400 uppercase tracking-wide">1. SELECT GRADE, SUBJECT & TERM</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Choose the grade, subject/learning area and term you want to review.
                </p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 space-y-1">
                <div className="text-[11px] font-black text-indigo-400 uppercase tracking-wide">2. REVIEW THE CURRICULUM STRUCTURE</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Review Strands, Sub-Strands, Learning Outcomes, Lesson Breakdown, and Timing. Use the <strong className="text-white">Structured Strands View</strong> for normal curriculum inspection.
                </p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 space-y-1">
                <div className="text-[11px] font-black text-indigo-400 uppercase tracking-wide">3. VALIDATE BEFORE MAKING CHANGES</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Use the <strong className="text-white">KICD Validator / Resource Hub</strong> where available to check curriculum structure and alignment. Do not assume imported or manually entered content is automatically authoritative.
                </p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 space-y-1">
                <div className="text-[11px] font-black text-amber-400 uppercase tracking-wide">4. MAKE CHANGES ONLY WHEN AUTHORIZED</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Curriculum changes can affect Teaching Plans, Teaching Allocations, Coverage, Content Generation, and Teacher workflows. Only make authorized curriculum changes. Do not replace approved KICD curriculum with textbook-derived or invented content.
                </p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 space-y-1">
                <div className="text-[11px] font-black text-emerald-400 uppercase tracking-wide">5. SAVE / SYNCHRONIZE APPROVED CHANGES</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Where the manager supports Firestore synchronization, synchronize only approved changes. Verify that the saved state is correct after synchronization.
                </p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 space-y-1">
                <div className="text-[11px] font-black text-indigo-400 uppercase tracking-wide">6. RE-VALIDATE</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  After an authorized change or synchronization, re-check the curriculum structure and validation status.
                </p>
              </div>
            </div>
          </div>

          {/* Curriculum Authority: Baseline vs Override */}
          <div className="border border-indigo-950 bg-indigo-950/40 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-900/60 pb-2">
              <div className="text-xs font-black uppercase tracking-wider text-indigo-300">
                CURRICULUM AUTHORITY
              </div>
              <div className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase rounded tracking-wider">
                OVERRIDE ≠ REPLACEMENT
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-slate-900/90 border border-emerald-500/30 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-400 uppercase">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  DEFAULT BASELINE
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The approved ECG/KICD curriculum currently used as the baseline for curriculum operations.
                </p>
              </div>

              <div className="bg-slate-900/90 border border-amber-500/30 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-400 uppercase">
                  <AlertCircle className="w-3.5 h-3.5" />
                  FIRESTORE OVERRIDE
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  An authorized school/system-specific modification stored separately from the baseline for the applicable school/system context.
                </p>
              </div>
            </div>

            <div className="bg-amber-950/30 border border-amber-600/40 rounded-lg p-3 text-xs text-amber-200/90 leading-relaxed">
              <strong className="text-amber-100 uppercase font-black tracking-wide">IMPORTANT: </strong>
              A Firestore Override does <strong className="text-white">NOT</strong> replace the KICD/ECG baseline (<strong className="text-amber-300">Override ≠ Replacement</strong>). The baseline remains the authoritative curriculum foundation unless the established curriculum governance explicitly determines otherwise.
            </div>
          </div>

          {/* UI Labels and Main Manager Tools */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* UI Labels */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3.5 space-y-2.5">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-300 border-b border-slate-700/80 pb-1.5">
                Current UI Labels Explained
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300">
                <li>
                  <strong className="text-emerald-400">Default Baseline:</strong> The approved ECG/KICD curriculum currently used as the baseline for curriculum operations.
                </li>
                <li>
                  <strong className="text-amber-400">Firestore Override:</strong> An authorized modification stored separately from the baseline for the applicable school/system context.
                </li>
                <li>
                  <strong className="text-amber-300">Unsaved Local Changes:</strong> Changes currently made in the manager that have not yet been synchronized to the approved cloud state.
                </li>
                <li>
                  <strong className="text-indigo-300">Firestore Sync:</strong> The process of synchronizing approved curriculum data with the cloud datastore.
                </li>
              </ul>
            </div>

            {/* Main Manager Tools */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3.5 space-y-2.5">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-300 border-b border-slate-700/80 pb-1.5">
                Main Manager Tools
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300">
                <li>
                  <strong className="text-indigo-300">STRUCTURED STRANDS VIEW:</strong> Review organized curriculum: Strand → Sub-Strand → Learning Outcome / Content → Timing.
                </li>
                <li>
                  <strong className="text-indigo-300">RAW KICD BREAKDOWN EDITOR:</strong> For authorized work with the underlying structured curriculum breakdown.
                </li>
                <li>
                  <strong className="text-indigo-300">RESOURCE HUB & KICD VALIDATOR:</strong> Inspect resources and validate curriculum alignment.
                </li>
                <li>
                  <strong className="text-indigo-300">UPLOAD & IMPORT DATA:</strong> Import supported JSON/CSV data. Imported data must still be validated and is not automatically authoritative.
                </li>
                <li>
                  <strong className="text-indigo-300">FIRESTORE SYNC HUB:</strong> Review and synchronize approved cloud data. Synchronization does not by itself make unvetted data authoritative.
                </li>
              </ul>
            </div>
          </div>

          {/* Admin Safety & Important Warning */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="bg-rose-950/25 border border-rose-800/40 rounded-xl p-3 text-xs text-rose-200 leading-relaxed">
              <strong className="text-rose-100 font-black uppercase block mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                IMPORTANT WARNING
              </strong>
              Curriculum data is upstream of teaching plans and content generation. Do not make unverified curriculum changes. Always verify the authoritative source before changing curriculum structure.
            </div>

            <div className="bg-indigo-950/25 border border-indigo-800/40 rounded-xl p-3 text-xs text-indigo-200 leading-relaxed">
              <strong className="text-indigo-100 font-black uppercase block mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                ADMIN SAFETY
              </strong>
              The Curriculum Manager is an administrative tool. Changes made here can affect downstream teaching and content-generation workflows. Always verify the source, make only authorized changes, synchronize carefully, and re-validate afterward.
            </div>
          </div>
        </div>
      )}

      {/* Main View Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveViewMode('structured')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-2 ${
            activeViewMode === 'structured'
              ? 'bg-indigo-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              : 'bg-white text-slate-700 hover:bg-indigo-50'
          }`}
        >
          <Layers className="w-4 h-4" /> Structured Strands View
        </button>

        <button
          onClick={() => setActiveViewMode('raw')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-2 ${
            activeViewMode === 'raw'
              ? 'bg-indigo-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              : 'bg-white text-slate-700 hover:bg-indigo-50'
          }`}
        >
          <Code className="w-4 h-4" /> Raw KICD Breakdown Editor
        </button>

        <button
          onClick={() => setActiveViewMode('resources')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-2 ${
            activeViewMode === 'resources'
              ? 'bg-indigo-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              : 'bg-white text-slate-700 hover:bg-indigo-50'
          }`}
        >
          <Library className="w-4 h-4" /> Resource Hub & KICD Validator
        </button>

        <button
          onClick={() => setActiveViewMode('upload')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-2 ${
            activeViewMode === 'upload'
              ? 'bg-indigo-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              : 'bg-white text-slate-700 hover:bg-indigo-50'
          }`}
        >
          <Upload className="w-4 h-4" /> Upload & Import Data (JSON/CSV)
        </button>

        <button
          onClick={() => setActiveViewMode('sync')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-2 ${
            activeViewMode === 'sync'
              ? 'bg-indigo-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              : 'bg-white text-slate-700 hover:bg-indigo-50'
          }`}
        >
          <Cloud className="w-4 h-4" /> Firestore Sync Hub
          {totalOverridesCount > 0 && (
            <span className="px-2 py-0.5 bg-mint border border-slate-200 text-[10px] text-slate-900 rounded-full font-bold">
              {totalOverridesCount}
            </span>
          )}
        </button>
      </div>

      {/* Subject & Grade Filter Controls Bar for Structured & Raw Views */}
      {(activeViewMode === 'structured' || activeViewMode === 'raw') && (
        <div className="bg-mint/30 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 flex-1">
            {/* Grade Select */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-600 mb-1 block">1. Select Grade</label>
              <CustomSelect
                value={selectedGrade}
                onChange={(val) => setSelectedGrade(val)}
                options={GRADES.map(g => ({ value: g, label: g }))}
                variant="neo"
              />
            </div>

            {/* Subject Select */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-600 mb-1 block">2. Select Subject</label>
              <CustomSelect
                value={selectedSubject}
                onChange={(val) => setSelectedSubject(val)}
                options={availableSubjects.map(s => ({ value: s, label: s }))}
                variant="neo"
              />
            </div>

            {/* Term Select */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-600 mb-1 block">3. Select Term</label>
              <CustomSelect
                value={selectedTerm}
                onChange={(val) => setSelectedTerm(val)}
                options={['All Terms', 'Term 1', 'Term 2', 'Term 3']}
                variant="neo"
              />
            </div>

            {/* Search Input */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-600 mb-1 block flex justify-between">
                <span>Search Filter</span>
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="text-rose-600 hover:text-rose-800 underline"
                  >
                    Clear All
                  </button>
                )}
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter strands/topics..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white focus:outline-none"
                />
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0">
            {/* Subject Last Updated Timestamp Badge */}
            <span className="px-3 py-1.5 bg-white border border-slate-200 text-[10px] font-mono font-bold text-slate-800 rounded-xl flex items-center gap-1.5 shadow-sm">
              <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Last Updated: {formatTimestamp(activeSubjectUpdatedAt)}</span>
            </span>

            <button
              onClick={handleSyncCurrentToFirestore}
              disabled={isSyncing}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white border border-slate-200 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {isSyncing ? 'Syncing...' : 'Sync Subject to Firestore'}
            </button>
          </div>
        </div>
      )}

      {/* VIEW 1: STRUCTURED STRANDS & SUB-STRANDS VIEW */}
      {activeViewMode === 'structured' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 border border-slate-200 rounded-2xl">
            <div>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                Strands & Sub-Strands ({filteredStrands.length} Strands Found)
              </h2>
              <span className="text-[10px] font-mono text-slate-500 font-bold">
                Last Updated Badge: {formatTimestamp(activeSubjectUpdatedAt)}
              </span>
            </div>

            <button
              onClick={handleAddStrand}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
            >
              <Plus className="w-4 h-4" /> Add Strand
            </button>
          </div>

          {filteredStrands.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-600">No structured strands parsed for {selectedGrade} - {selectedSubject}.</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Switch to the <span className="font-bold">Raw KICD Breakdown Editor</span> or <span className="font-bold">Upload Data</span> to paste or import curriculum schemes.
              </p>
              <button
                onClick={handleAddStrand}
                className="px-4 py-2 bg-indigo-600 text-white font-bold border border-slate-200 rounded-xl text-xs inline-flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add First Strand
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredStrands.map((strand, sIdx) => (
                <div key={sIdx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  {/* Strand Title Header */}
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-black text-xs border border-slate-200">
                        {sIdx + 1}
                      </span>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{strand.name}</h3>
                        <span className="text-[10px] font-bold text-slate-500">
                          {strand.subStrands.length} Sub-Strand(s) &bull; {strand.subStrands.reduce((sum, sub) => sum + sub.lessons.length, 0)} Lesson Breakdown(s)
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAddSubStrand(strand.name)}
                      className="px-2.5 py-1 bg-white hover:bg-mint text-slate-900 border border-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Sub-Strand
                    </button>
                  </div>

                  {/* Sub-Strands List */}
                  <div className="p-4 space-y-4 divide-y divide-slate-100">
                    {strand.subStrands.map((sub, subIdx) => (
                      <div key={subIdx} className="pt-3 first:pt-0 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-2">
                            <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                            Sub-Strand: {sub.name}
                          </h4>
                          <span className="text-[10px] font-bold text-slate-400">{sub.lessons.length} Lesson Item(s)</span>
                        </div>

                        {/* Lessons Table */}
                        {sub.lessons.length > 0 && (
                          <div className="overflow-x-auto border border-slate-200/10 rounded-xl">
                            <table className="w-full text-left text-[11px]">
                              <thead className="bg-slate-100 border-b border-slate-200/10 font-black text-slate-700">
                                <tr>
                                  <th className="p-2.5 w-24">Timing</th>
                                  <th className="p-2.5">Learning Outcome & Content</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-black/5 bg-white font-medium">
                                {sub.lessons.map((lesson, lIdx) => (
                                  <tr key={lIdx} className="hover:bg-mint/10 transition-colors">
                                    <td className="p-2.5 whitespace-nowrap font-bold text-slate-900 bg-slate-50/50 border-r border-slate-200/5">
                                      {lesson.week}
                                      <div className="text-[9px] text-slate-400 font-mono">Lesson {lesson.lessonNum}</div>
                                    </td>
                                    <td className="p-2.5 text-slate-800 leading-relaxed">
                                      {lesson.content}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: RAW KICD BREAKDOWN TEXT EDITOR */}
      {activeViewMode === 'raw' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <Code className="w-5 h-5 text-indigo-600" />
                  Raw KICD Breakdown Editor: {selectedGrade} - {selectedSubject}
                </h2>
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-mono font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-indigo-600" />
                  Updated: {formatTimestamp(activeSubjectUpdatedAt)}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-bold mt-1">
                Edit formatted lesson breakdown text. Format: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700">- Lesson 1: Strand: X, Sub-Strand: Y, Content: Z</code>
              </p>
            </div>

            <button
              onClick={() => handleSaveTextContent(currentTextContent)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              <Save className="w-4 h-4" /> Save Local Changes
            </button>
          </div>

          <textarea
            value={currentTextContent}
            onChange={(e) => setCurrentTextContent(e.target.value)}
            rows={20}
            className="w-full p-4 font-mono text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
            placeholder="Paste or write KICD lesson breakdowns..."
          />

          <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 font-bold gap-3">
            <span>Total Lines: {currentTextContent.split('\n').length} lines &bull; Last Updated: {formatTimestamp(activeSubjectUpdatedAt)}</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleSaveTextContent(currentTextContent)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-900 font-bold"
              >
                Apply Changes
              </button>
              <button
                onClick={handleSyncCurrentToFirestore}
                disabled={isSyncing}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-slate-200 rounded-lg font-bold"
              >
                Sync to Firestore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: RESOURCE HUB & KICD VALIDATOR (MIGRATED FROM TEACHER RESOURCE HUB) */}
      {activeViewMode === 'resources' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          {/* Sub-tabs for Resource Hub */}
          <div className="flex flex-wrap justify-between items-center border-b border-slate-200 pb-4 gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <Library className="w-5 h-5 text-indigo-600" />
                Teacher Resource Hub & Scheme Validator
              </h2>
              <p className="text-xs text-slate-600 font-bold mt-0.5">
                KICD alignment guides, interactive scheme sandbox validator, PDF/Markdown document exports, and Google Drive integration.
              </p>
            </div>

            <div className="flex gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setResourceSubTab('guide')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  resourceSubTab === 'guide' ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm' : 'text-slate-600 hover:text-black'
                }`}
              >
                KICD Guide
              </button>
              <button
                onClick={() => setResourceSubTab('validator')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  resourceSubTab === 'validator' ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm' : 'text-slate-600 hover:text-black'
                }`}
              >
                Sandbox Validator
              </button>
              <button
                onClick={() => setResourceSubTab('export')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  resourceSubTab === 'export' ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm' : 'text-slate-600 hover:text-black'
                }`}
              >
                Document Exports
              </button>
            </div>
          </div>

          {/* Sub-Tab 1: KICD Guide */}
          {resourceSubTab === 'guide' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-emerald-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-black text-emerald-900 text-xs uppercase">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    KICD Curriculum Standard
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    All generated Schemes of Work, Lesson Plans, and Assessments strictly adhere to standard strands, sub-strands, specific learning outcomes, and core competencies mandated by KICD.
                  </p>
                </div>

                <div className="p-4 bg-indigo-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-black text-indigo-900 text-xs uppercase">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                    Grades 1–10 Full Coverage
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    Supports Primary (Grades 1–6), Junior School (Grades 7–9), and Senior School (Grade 10) learning areas including STEM, Humanities, Languages, and Creative Arts.
                  </p>
                </div>

                <div className="p-4 bg-purple-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-black text-purple-900 text-xs uppercase">
                    <Clock className="w-4 h-4 text-purple-600" />
                    Real-time Cache & Timestamps
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    Updates are timestamped globally across Firestore. Teachers can click "Refresh Cache" at any time to invalidate local state and pull fresh content.
                  </p>
                </div>
              </div>

              {/* Sample Structure Card */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" /> Standard KICD Scheme Syntax Reference
                </h3>
                <pre className="p-4 bg-white border border-slate-200/10 rounded-xl font-mono text-xs text-slate-800 leading-relaxed overflow-x-auto">
{`--- Term 1 ---
Week 1
- Lesson 1: Strand: Creation, Sub-Strand: Self-awareness, Content: Identify uniqueness as guided by the word of God.
- Lesson 2: Strand: Creation, Sub-Strand: Self-awareness, Content: State individual gender and attributes.
- Lesson 3: Strand: Creation, Sub-Strand: Family, Content: Name family members and describe roles.`}
                </pre>
              </div>
            </div>
          )}

          {/* Sub-Tab 2: Sandbox Scheme Validator */}
          {resourceSubTab === 'validator' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">KICD Scheme Alignment Validator</h3>
                  <p className="text-xs text-slate-500 font-semibold">Paste raw scheme content to verify structural integrity, missing tags, sequence jumps, and alignment score.</p>
                </div>
                <button
                  onClick={() => validateCurriculumText(validatorText)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  <FileCheck2 className="w-4 h-4" /> Run Alignment Check
                </button>
              </div>

              <textarea
                value={validatorText}
                onChange={(e) => setValidatorText(e.target.value)}
                rows={10}
                className="w-full p-4 font-mono text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Paste scheme text here..."
              />

              {validationReport && (
                <div className="p-5 border border-slate-200 rounded-2xl bg-white space-y-4 shadow-sm">
                  <div className="flex justify-between items-center border-b border-slate-200/10 pb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border border-slate-200 text-white ${
                        validationReport.score >= 80 ? 'bg-emerald-600' : validationReport.score >= 50 ? 'bg-amber-500' : 'bg-rose-600'
                      }`}>
                        {validationReport.score}%
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 uppercase">Curriculum Alignment Score</h4>
                        <p className="text-xs text-slate-500 font-bold">
                          {validationReport.summary.lessons} Lesson(s) &bull; {validationReport.summary.weeks} Week(s) &bull; {validationReport.summary.strands.size} Strand(s)
                        </p>
                      </div>
                    </div>

                    <span className={`px-3 py-1 rounded-xl text-xs font-black border border-slate-200 ${
                      validationReport.issues.length === 0 ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                    }`}>
                      {validationReport.issues.length} Issue(s) Found
                    </span>
                  </div>

                  {validationReport.issues.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {validationReport.issues.map((issue, idx) => (
                        <div key={idx} className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 font-medium ${
                          issue.type === 'error' ? 'bg-rose-50 text-rose-900 border-rose-300' : 'bg-amber-50 text-amber-900 border-amber-300'
                        }`}>
                          {issue.type === 'error' ? <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
                          <div>
                            <span className="font-bold">Line {issue.lineNum}:</span> {issue.message}
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5 italic">"{issue.text}"</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sub-Tab 3: Document Exports & Drive Sync */}
          {resourceSubTab === 'export' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-sm">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-800 rounded-xl border border-slate-200 flex items-center justify-center font-black">
                    PDF
                  </div>
                  <h4 className="text-xs font-black uppercase text-slate-900">Formal PDF Scheme Document</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                    Generate an official printable PDF scheme of work complete with school headers and watermarks.
                  </p>
                  <button
                    onClick={handleExportPDF}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold border border-slate-200 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <Download className="w-4 h-4" /> Download PDF
                  </button>
                </div>

                <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-sm">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-800 rounded-xl border border-slate-200 flex items-center justify-center font-black">
                    MD
                  </div>
                  <h4 className="text-xs font-black uppercase text-slate-900">Markdown Scheme Export</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                    Export full curriculum repository as clean markdown compatible with all text editors and LMS platforms.
                  </p>
                  <button
                    onClick={handleExportMarkdown}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold border border-slate-200 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <FileText className="w-4 h-4" /> Download Markdown
                  </button>
                </div>

                <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-sm">
                  <div className="w-10 h-10 bg-blue-100 text-blue-800 rounded-xl border border-slate-200 flex items-center justify-center font-black">
                    DRV
                  </div>
                  <h4 className="text-xs font-black uppercase text-slate-900">Google Drive Integration</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                    Connect Google Drive to auto-backup teacher lesson plans and curriculum schemes directly to cloud storage.
                  </p>
                  <button
                    onClick={handleConnectDrive}
                    disabled={isSyncingDrive}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold border border-slate-200 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                  >
                    <Cloud className="w-4 h-4" /> {driveToken ? 'Drive Connected' : 'Connect Drive'}
                  </button>
                </div>
              </div>

              {/* Timestamps Badge Info Banner */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Last Uploaded: {formatTimestamp(uploadedAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Last Exported: {formatTimestamp(lastExportedAt)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: UPLOAD & IMPORT DATA (JSON/CSV) */}
      {activeViewMode === 'upload' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                Upload & Import Curriculum Data
              </h2>
              {uploadedAt && (
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-slate-200 rounded text-[10px] font-mono font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-600" />
                  Uploaded: {formatTimestamp(uploadedAt)}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 font-bold mt-1">
              Import curriculum breakdowns via JSON files, CSV files, or raw copy-pasted payload. Supports both single-subject and multi-grade batch imports.
            </p>
          </div>

          {/* File Upload Dropzone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 border-2 border-dashed border-slate-200 hover:border-indigo-600 bg-indigo-50/30 hover:bg-indigo-50 rounded-2xl text-center cursor-pointer transition-all space-y-3 group"
            >
              <div className="w-12 h-12 bg-white text-indigo-600 rounded-2xl flex items-center justify-center mx-auto border border-slate-200 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase">Click to Browse JSON / CSV File</h3>
                <p className="text-xs text-slate-500 font-semibold mt-1">Supports .json, .csv, and text curriculum files</p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".json,.csv,.txt"
                className="hidden"
              />
            </div>

            {/* Direct Raw Text Paste */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-700 block">Or Paste Data Payload Directly</label>
              <textarea
                value={uploadRawText}
                onChange={(e) => {
                  setUploadRawText(e.target.value);
                  handleProcessUploadPayload(e.target.value);
                }}
                rows={8}
                className="w-full p-3 font-mono text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none"
                placeholder={`Paste JSON array/object or CSV text here...\nExample JSON: [ { "key": "GRADE_1_ENGLISH_LESSON_BREAKDOWN", "content": "..." } ]`}
              />
            </div>
          </div>

          {/* Error Banner */}
          {uploadError && (
            <div className="p-4 bg-rose-50 border border-rose-400 rounded-xl text-rose-900 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedPreview && parsedPreview.length > 0 && (
            <div className="border border-slate-200 rounded-2xl p-4 bg-emerald-50/40 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-black text-emerald-900 uppercase tracking-tight flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Parsed {parsedPreview.length} Curriculum Breakdown Key(s) Ready for Import
                  </h3>
                  <p className="text-xs text-emerald-800 font-semibold">Review parsed data before applying to local curriculum store.</p>
                </div>

                <button
                  onClick={handleCommitUploadPreview}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-slate-200 rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  Confirm & Import to Local Store
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-200/10 rounded-xl bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200/10 font-black text-slate-700">
                    <tr>
                      <th className="p-2.5">Curriculum Key</th>
                      <th className="p-2.5">Line Count</th>
                      <th className="p-2.5">Preview Content Snippet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 font-medium">
                    {parsedPreview.map((item, idx) => (
                      <tr key={idx} className="hover:bg-mint/10">
                        <td className="p-2.5 font-bold font-mono text-indigo-900">{item.key}</td>
                        <td className="p-2.5 font-bold">{item.count} lines</td>
                        <td className="p-2.5 text-slate-500 italic truncate max-w-xs">{item.content.substring(0, 80)}...</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 5: FIRESTORE SYNC HUB */}
      {activeViewMode === 'sync' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <Cloud className="w-5 h-5 text-indigo-600" />
                Firestore Cloud Overrides Hub
              </h2>
              <p className="text-xs text-slate-600 font-bold mt-1">
                View, manage, and audit all custom curriculum overrides stored in Firestore collection <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700">curriculum_overrides</code>.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleBulkSyncToFirestore}
                disabled={isSyncing || modifiedKeys.size === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white border border-slate-200 rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" /> Sync All Modified ({modifiedKeys.size})
              </button>

              <button
                onClick={fetchFirestoreOverrides}
                disabled={isLoadingFirestore}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-900 rounded-xl text-xs font-bold flex items-center gap-1"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingFirestore ? 'animate-spin' : ''}`} /> Refresh Table
              </button>
            </div>
          </div>

          {Object.keys(firestoreOverrides).length === 0 ? (
            <div className="p-12 text-center bg-slate-50/50 border border-slate-200 rounded-2xl space-y-2">
              <Cloud className="w-12 h-12 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-600">No Firestore Curriculum Overrides Found.</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Currently all subjects are utilizing built-in KICD default baselines. Any subject edited and synced will appear here with an explicit timestamp badge.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 font-black text-slate-800">
                  <tr>
                    <th className="p-3">Curriculum Key</th>
                    <th className="p-3">Content Lines</th>
                    <th className="p-3">Visual Timestamp (Last Updated)</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10 font-medium">
                  {Object.keys(firestoreOverrides).map((key) => {
                    const item = firestoreOverrides[key];
                    const lineCount = item.content ? item.content.split('\n').length : 0;
                    return (
                      <tr key={key} className="hover:bg-mint/10 transition-colors">
                        <td className="p-3 font-bold font-mono text-indigo-900">{key}</td>
                        <td className="p-3 font-bold text-slate-700">{lineCount} lines</td>
                        <td className="p-3 font-mono font-bold text-slate-800">
                          <span className="px-2.5 py-1 bg-slate-100 border border-slate-200/20 rounded-lg text-[10px] inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                            {formatTimestamp(item.updatedAt)}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteOverride(key)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-slate-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1"
                            title="Revert to built-in default baseline"
                          >
                            <Trash2 className="w-3 h-3 text-rose-600" /> Revert Baseline
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-xl z-50 animate-fade-in">
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default CurriculumManager;
