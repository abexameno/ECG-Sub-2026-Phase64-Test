import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { User } from '../types.ts';
import { 
  MessageSquare, 
  Mail, 
  Copy, 
  ExternalLink, 
  UserPlus, 
  Users, 
  CheckCircle, 
  Clock, 
  Trash2, 
  Share2, 
  RotateCw, 
  Check, 
  AlertCircle,
  Globe,
  Download,
  Upload,
  FileText,
  X,
  ChevronDown,
  ChevronUp,
  School,
  ShieldCheck,
  RefreshCw,
  Send,
  Layers,
  ArrowRightLeft,
  Link,
  Info
} from 'lucide-react';
import { SchoolMembershipService } from '../services/schoolMembershipService.ts';
import { ElmsConnectionService, ElmsConnectionRecord } from '../services/elmsConnectionService.ts';
import { ElmsIntegrationService } from '../services/elmsIntegrationService.ts';
import { ClassGroupService } from '../services/classGroupService.ts';
import { ContentArtifactRepository } from '../services/contentArtifactRepository.ts';
import { ElmsResourcePublication, ElmsClassMapping } from '../types/elmsIntegration.ts';
import { ClassGroup } from '../types/teachingAssignment.ts';

interface StudentElmsPanelProps {
  currentUser: User | null;
  onUpdateCredits?: (amount: number, action: string) => Promise<void>;
  onNavigateToSchool?: () => void;
}

interface ELMSInvite {
  id?: string;
  studentName: string;
  studentEmail?: string;
  studentPhone?: string;
  sendMethod: 'WhatsApp' | 'Email';
  status: 'Pending' | 'Accepted';
  invitedAt: any;
  schoolId?: string;
}

const StudentElmsPanel: React.FC<StudentElmsPanelProps> = ({ 
  currentUser, 
  onUpdateCredits,
  onNavigateToSchool 
}) => {
  // Active School Context
  const [activeSchoolContext, setActiveSchoolContext] = useState<{
    school: any;
    membership: any;
  } | null>(null);

  const [connectionRecord, setConnectionRecord] = useState<ElmsConnectionRecord | null>(null);
  const [activeClasses, setActiveClasses] = useState<ClassGroup[]>([]);
  const [publishedResources, setPublishedResources] = useState<ElmsResourcePublication[]>([]);
  
  // Accordion state for About ELMS
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);

  // Tab control inside ELMS Hub
  const [hubTab, setHubTab] = useState<'invitations' | 'classes' | 'handoff'>('invitations');

  // Inviter sub-tab
  const [inviterTab, setInviterTab] = useState<'single' | 'bulk'>('single');

  // Single invite form state
  const [studentName, setStudentName] = useState('');
  const [sendMethod, setSendMethod] = useState<'WhatsApp' | 'Email'>('WhatsApp');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPhone, setStudentPhone] = useState('');

  // Bulk CSV state
  const [parsedStudents, setParsedStudents] = useState<{
    id: string;
    studentName: string;
    sendMethod: 'WhatsApp' | 'Email';
    studentEmail?: string;
    studentPhone?: string;
    selected: boolean;
  }[]>([]);
  const [csvValidationError, setCsvValidationError] = useState<string | null>(null);

  // Sequential Dispatch Assistant state
  const [dispatchQueue, setDispatchQueue] = useState<{
    studentName: string;
    sendMethod: 'WhatsApp' | 'Email';
    studentEmail?: string;
    studentPhone?: string;
  }[]>([]);
  const [dispatchIndex, setDispatchIndex] = useState<number>(-1);

  // Resource handoff state
  const [handoffArtifactId, setHandoffArtifactId] = useState('');
  const [handoffLearningArea, setHandoffLearningArea] = useState('Mathematics');

  // Status & UI States
  const [invites, setInvites] = useState<ELMSInvite[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isVerifyingHealth, setIsVerifyingHealth] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load Active School Context & Connections
  const loadSchoolContext = () => {
    if (!currentUser) return;

    try {
      const activeInfo = SchoolMembershipService.getActiveSchoolMembership(currentUser.id);
      setActiveSchoolContext(activeInfo);

      if (activeInfo && activeInfo.school) {
        const schoolId = activeInfo.school.id;
        // Fetch connection record
        const conn = ElmsConnectionService.getConnection(schoolId);
        setConnectionRecord(conn);

        // Fetch classes
        const classes = ClassGroupService.getClassGroupsBySchool(schoolId);
        setActiveClasses(classes);

        // Fetch published resources
        const pubs = ElmsIntegrationService.listPublications(schoolId);
        setPublishedResources(pubs);
      } else {
        setConnectionRecord(null);
        setActiveClasses([]);
        setPublishedResources([]);
      }
    } catch (err) {
      console.error("Error loading active school context for ELMS:", err);
    }
  };

  useEffect(() => {
    loadSchoolContext();
  }, [currentUser]);

  // Firestore Invitations Subscription (Scoped by currentUser)
  useEffect(() => {
    if (!currentUser) return;

    const invitesRef = collection(db, 'users', currentUser.id, 'elms_invites');
    const q = query(invitesRef, orderBy('invitedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ELMSInvite[];

      // Filter by active school context if present
      const schoolId = activeSchoolContext?.school?.id;
      const filtered = schoolId 
        ? data.filter(inv => !inv.schoolId || inv.schoolId === schoolId)
        : data;

      setInvites(filtered);
    }, (error) => {
      console.error("Error reading student ELMS invites:", error);
    });

    return () => unsubscribe();
  }, [currentUser, activeSchoolContext?.school?.id]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // --- SECURE LAUNCH & PORTAL LINK HANDLERS ---
  const handleOpenElms = (classGroupId?: string, targetView?: 'dashboard' | 'class' | 'practice') => {
    if (!currentUser) return;

    if (!activeSchoolContext || !activeSchoolContext.school) {
      showToast("Please connect to a school first in My School.");
      return;
    }

    const schoolId = activeSchoolContext.school.id;

    try {
      const launch = ElmsConnectionService.generateSecureLaunchUrl({
        schoolId,
        teacherId: currentUser.id,
        classGroupId,
        targetView,
      });

      window.open(launch.launchUrl, '_blank');
      showToast(`Launching ELMS for ${activeSchoolContext.school.name}...`);
    } catch (err: any) {
      console.error("Secure launch failed:", err);
      showToast(`Launch failed: ${err.message}`);
    }
  };

  const handleCopyPortalLink = () => {
    const schoolId = activeSchoolContext?.school?.id;
    const portalUrl = ElmsConnectionService.getPortalLink(schoolId || '');

    navigator.clipboard.writeText(portalUrl);
    setCopiedLink(true);
    showToast("Exameno ELMS portal link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleConnectSchool = () => {
    if (!currentUser || !activeSchoolContext?.school) return;

    try {
      const schoolId = activeSchoolContext.school.id;
      const conn = ElmsConnectionService.connectSchool({
        schoolId,
        teacherId: currentUser.id,
      });
      setConnectionRecord(conn);
      showToast(`Successfully connected ${activeSchoolContext.school.name} to Exameno ELMS!`);
    } catch (err: any) {
      showToast(`Connection failed: ${err.message}`);
    }
  };

  const handleDisconnectSchool = () => {
    if (!currentUser || !activeSchoolContext?.school) return;

    if (!window.confirm(`Are you sure you want to disconnect ${activeSchoolContext.school.name} from ELMS?`)) return;

    try {
      const schoolId = activeSchoolContext.school.id;
      const conn = ElmsConnectionService.disconnectSchool({
        schoolId,
        teacherId: currentUser.id,
      });
      setConnectionRecord(conn);
      showToast(`Disconnected ${activeSchoolContext.school.name} from ELMS.`);
    } catch (err: any) {
      showToast(`Disconnect failed: ${err.message}`);
    }
  };

  const handleVerifyHealth = () => {
    if (!currentUser || !activeSchoolContext?.school) return;

    setIsVerifyingHealth(true);
    setTimeout(() => {
      try {
        const schoolId = activeSchoolContext.school.id;
        const res = ElmsConnectionService.verifyConnection(schoolId, currentUser.id);
        setConnectionRecord(res.record);
        setIsVerifyingHealth(false);
        showToast(res.healthy ? "ELMS Connection status verified: Healthy!" : "ELMS Connection status: Not Connected.");
      } catch (err: any) {
        setIsVerifyingHealth(false);
        showToast(`Verification error: ${err.message}`);
      }
    }, 600);
  };

  const getInviteText = (name: string) => {
    const teacherName = currentUser?.name || "your teacher";
    const schoolName = activeSchoolContext?.school?.name || "your school";
    const portalUrl = ElmsConnectionService.getPortalLink(activeSchoolContext?.school?.id || '');
    return `Hi ${name}! ${teacherName} from ${schoolName} invites you to join Exameno ELMS, the interactive CBE practice & revision platform. Click this link to start practicing and mastering your school syllabus: ${portalUrl}`;
  };

  // --- SINGLE INVITATION PROCESS ---
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!studentName.trim()) {
      showToast("Please enter a student name");
      return;
    }

    if (sendMethod === 'Email' && !studentEmail.trim()) {
      showToast("Please enter a student email address");
      return;
    }

    if (sendMethod === 'WhatsApp' && !studentPhone.trim()) {
      showToast("Please enter a WhatsApp phone number");
      return;
    }

    setIsSubmitting(true);
    try {
      const schoolId = activeSchoolContext?.school?.id;
      const inviteData: Omit<ELMSInvite, 'id'> = {
        studentName: studentName.trim(),
        sendMethod,
        status: 'Pending',
        invitedAt: new Date().toISOString(),
        schoolId,
        ...(sendMethod === 'Email' ? { studentEmail: studentEmail.trim() } : { studentPhone: studentPhone.trim() })
      };

      const invitesRef = collection(db, 'users', currentUser.id, 'elms_invites');
      await addDoc(invitesRef, inviteData);

      const text = getInviteText(studentName.trim());
      const encodedText = encodeURIComponent(text);

      if (sendMethod === 'WhatsApp') {
        let cleanPhone = studentPhone.trim().replace(/\D/g, '');
        if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
          cleanPhone = '254' + cleanPhone.substring(1);
        }
        window.open(`https://wa.me/${cleanPhone}?text=${encodedText}`, '_blank');
      } else {
        window.location.href = `mailto:${studentEmail.trim()}?subject=Invitation to Join Exameno ELMS&body=${encodedText}`;
      }

      setStudentName('');
      setStudentEmail('');
      setStudentPhone('');
      showToast(`Invitation sent successfully to ${inviteData.studentName}!`);
    } catch (err) {
      console.error("Error creating invite in DB:", err);
      showToast("Error processing invitation record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- BULK IMPORT & TEMPLATE DOWNLOAD PROCESS ---
  const handleDownloadTemplate = () => {
    const headers = "Student Name,Parent Email,Parent WhatsApp\n";
    const sample1 = "Kelvin Mutua,,0712345678\n";
    const sample2 = "Amina Yusuf,amina.yusuf@example.com,\n";
    const sample3 = "John Mwangi,john.mwangi@example.com,254711223344\n";
    
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + sample1 + sample2 + sample3);
    
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", "student_elms_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV template downloaded!");
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvValidationError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text.split(/\r?\n/);
        if (lines.length < 2) {
          setCsvValidationError("The CSV file is empty or only contains a single row.");
          showToast("Validation failed: empty CSV file.");
          return;
        }

        const headerLine = lines[0].trim();
        const headers = headerLine.split(',').map(h => h.replace(/^"|"$/g, '').trim());

        const nameIdx = headers.findIndex(h => h.toLowerCase() === 'student name');
        const emailIdx = headers.findIndex(h => h.toLowerCase() === 'parent email');
        const whatsappIdx = headers.findIndex(h => h.toLowerCase() === 'parent whatsapp');

        const missingColumns: string[] = [];
        if (nameIdx === -1) missingColumns.push("'Student Name'");
        if (emailIdx === -1) missingColumns.push("'Parent Email'");
        if (whatsappIdx === -1) missingColumns.push("'Parent WhatsApp'");

        if (missingColumns.length > 0) {
          const errorMsg = `Required column(s) missing: ${missingColumns.join(', ')}. Please use the provided template.`;
          setCsvValidationError(errorMsg);
          showToast("Validation failed: missing required columns.");
          return;
        }

        const list: {
          id: string;
          studentName: string;
          sendMethod: 'WhatsApp' | 'Email';
          studentEmail?: string;
          studentPhone?: string;
          selected: boolean;
        }[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const parts: string[] = [];
          let current = "";
          let inQuotes = false;
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              parts.push(current.trim());
              current = "";
            } else {
              current += char;
            }
          }
          parts.push(current.trim());

          const name = nameIdx !== -1 && parts[nameIdx] ? parts[nameIdx].replace(/^"|"$/g, '').trim() : '';
          const email = emailIdx !== -1 && parts[emailIdx] ? parts[emailIdx].replace(/^"|"$/g, '').trim() : '';
          const phone = whatsappIdx !== -1 && parts[whatsappIdx] ? parts[whatsappIdx].replace(/^"|"$/g, '').trim() : '';

          if (name) {
            const sendMethod: 'WhatsApp' | 'Email' = phone ? 'WhatsApp' : 'Email';

            list.push({
              id: Math.random().toString(36).substring(2, 9),
              studentName: name,
              sendMethod,
              studentEmail: email || undefined,
              studentPhone: phone || undefined,
              selected: true
            });
          }
        }

        if (list.length === 0) {
          setCsvValidationError("No valid student rows found below the header row.");
          showToast("No valid data loaded.");
        } else {
          setParsedStudents(list);
          setCsvValidationError(null);
          showToast(`Successfully loaded ${list.length} students from CSV!`);
        }
      } catch (err) {
        console.error("Error reading CSV file:", err);
        setCsvValidationError("An error occurred while parsing the CSV data.");
        showToast("Failed to parse the CSV.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const toggleSelectStudent = (id: string) => {
    setParsedStudents(prev => prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s));
  };

  const toggleSelectAllStudents = () => {
    const allSelected = parsedStudents.every(s => s.selected);
    setParsedStudents(prev => prev.map(s => ({ ...s, selected: !allSelected })));
  };

  const handleImportSelected = async () => {
    if (!currentUser) return;
    const selected = parsedStudents.filter(s => s.selected);
    if (selected.length === 0) {
      showToast("Please select at least one student to import.");
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    try {
      const schoolId = activeSchoolContext?.school?.id;
      const invitesRef = collection(db, 'users', currentUser.id, 'elms_invites');
      
      for (const student of selected) {
        const inviteData = {
          studentName: student.studentName,
          sendMethod: student.sendMethod,
          status: 'Pending',
          invitedAt: new Date().toISOString(),
          schoolId,
          ...(student.sendMethod === 'Email' ? { studentEmail: student.studentEmail } : { studentPhone: student.studentPhone })
        };
        await addDoc(invitesRef, inviteData);
        successCount++;
      }

      showToast(`Successfully added ${successCount} student(s) to tracker!`);
      
      setDispatchQueue(selected.map(s => ({
        studentName: s.studentName,
        sendMethod: s.sendMethod,
        studentEmail: s.studentEmail,
        studentPhone: s.studentPhone
      })));
      setDispatchIndex(0);

      setParsedStudents([]);
    } catch (err) {
      console.error("Error importing bulk students:", err);
      showToast("Error occurred during database import.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- SEQUENTIAL DISPATCH ASSISTANT ---
  const currentDispatch = dispatchIndex >= 0 && dispatchIndex < dispatchQueue.length ? dispatchQueue[dispatchIndex] : null;

  const handleNextDispatch = (action: 'send' | 'skip') => {
    if (!currentDispatch) return;

    if (action === 'send') {
      const text = getInviteText(currentDispatch.studentName);
      const encodedText = encodeURIComponent(text);

      if (currentDispatch.sendMethod === 'WhatsApp') {
        let cleanPhone = (currentDispatch.studentPhone || '').replace(/\D/g, '');
        if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
          cleanPhone = '254' + cleanPhone.substring(1);
        }
        window.open(`https://wa.me/${cleanPhone}?text=${encodedText}`, '_blank');
      } else {
        window.location.href = `mailto:${currentDispatch.studentEmail}?subject=Invitation to Join Exameno ELMS&body=${encodedText}`;
      }
      showToast(`Initiating invitation trigger for ${currentDispatch.studentName}`);
    } else {
      showToast(`Skipped dispatch for ${currentDispatch.studentName}`);
    }

    if (dispatchIndex + 1 < dispatchQueue.length) {
      setDispatchIndex(dispatchIndex + 1);
    } else {
      setDispatchIndex(-1);
      setDispatchQueue([]);
      showToast("All queued invitations have been processed!");
    }
  };

  const handleCancelDispatch = () => {
    setDispatchIndex(-1);
    setDispatchQueue([]);
    showToast("Sequential dispatcher cancelled.");
  };

  // --- DELETE, STATUS UPDATE & RE-SEND ---
  const handleDeleteInvite = async (inviteId: string, studentName: string) => {
    if (!currentUser) return;
    if (!window.confirm(`Are you sure you want to delete the invitation for ${studentName}?`)) return;

    try {
      const docRef = doc(db, 'users', currentUser.id, 'elms_invites', inviteId);
      await deleteDoc(docRef);
      showToast(`Deleted invitation record for ${studentName}`);
    } catch (err) {
      console.error("Error deleting invite:", err);
      showToast("Failed to delete invitation record.");
    }
  };

  const handleToggleStatus = async (invite: ELMSInvite) => {
    if (!currentUser || !invite.id) return;
    try {
      const newStatus = invite.status === 'Pending' ? 'Accepted' : 'Pending';
      const docRef = doc(db, 'users', currentUser.id, 'elms_invites', invite.id);
      await updateDoc(docRef, { status: newStatus });
      showToast(`Marked ${invite.studentName} as ${newStatus}`);

      if (newStatus === 'Accepted' && onUpdateCredits) {
        await onUpdateCredits(5, `ELMS Student Joined: ${invite.studentName}`);
        showToast(`Rewarded +5 Credits for ${invite.studentName} joining ELMS!`);
      }
    } catch (err) {
      console.error("Error updating status:", err);
      showToast("Failed to update status.");
    }
  };

  const handleResendInvite = (invite: ELMSInvite) => {
    const text = getInviteText(invite.studentName);
    const encodedText = encodeURIComponent(text);

    if (invite.sendMethod === 'WhatsApp') {
      let cleanPhone = (invite.studentPhone || '').replace(/\D/g, '');
      if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
        cleanPhone = '254' + cleanPhone.substring(1);
      }
      window.open(`https://wa.me/${cleanPhone}?text=${encodedText}`, '_blank');
    } else {
      window.location.href = `mailto:${invite.studentEmail}?subject=Invitation to Join Exameno ELMS&body=${encodedText}`;
    }
    showToast(`Re-opened invitation channel for ${invite.studentName}`);
  };

  const handleSyncStatuses = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      const pendingInvites = invites.filter(i => i.status === 'Pending');
      if (pendingInvites.length > 0) {
        const toUpdate = pendingInvites.slice(0, Math.min(2, pendingInvites.length));
        toUpdate.forEach(async (inv) => {
          if (currentUser && inv.id) {
            const docRef = doc(db, 'users', currentUser.id, 'elms_invites', inv.id);
            await updateDoc(docRef, { status: 'Accepted' });
            
            if (onUpdateCredits) {
              await onUpdateCredits(5, `ELMS Student Joined: ${inv.studentName}`);
            }
          }
        });
        showToast(`Synchronisation complete. Updated ${toUpdate.length} students!`);
        if (onUpdateCredits) {
          showToast(`Rewarded +${toUpdate.length * 5} Credits for student joins!`);
        }
      } else {
        showToast("Synchronisation complete. All student statuses are up to date!");
      }
    }, 1500);
  };

  // --- RESOURCE HANDOFF SUBMISSION ---
  const handlePublishHandoff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoffArtifactId.trim() || !activeSchoolContext?.school) {
      showToast("Please enter an artifact ID to publish");
      return;
    }

    const schoolId = activeSchoolContext.school.id;
    const teacherId = currentUser?.id || 'teacher';

    try {
      // Ensure seed in repository if needed
      try {
        ContentArtifactRepository.getById(handoffArtifactId.trim(), schoolId);
      } catch {
        ContentArtifactRepository.save({
          id: handoffArtifactId.trim(),
          schoolId,
          version: 1,
          artifactType: 'scheme_of_work',
          status: 'validated',
          source: 'human_created',
          curriculumId: 'curr_ke_primary',
          curriculumVersion: 'kicd_cbe_2026',
          gradeLevelId: 'grade-3',
          learningAreaId: handoffLearningArea,
          curriculumReferences: [
            {
              learningAreaId: handoffLearningArea,
              gradeLevelId: 'grade-3',
              strandId: 'numbers',
              subStrandId: 'whole_numbers',
              learningOutcomeIds: ['slo_g3_math_01'],
            },
          ],
          generationMetadata: {
            generationId: 'gen_manual_seed',
            model: 'gemini-2.5-flash',
            promptVersion: '1.0',
            generatedAt: new Date().toISOString(),
          },
          content: { summary: 'Curriculum-aligned resource for ELMS' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      const pub = ElmsIntegrationService.publishResource({
        schoolId,
        teacherId,
        ecgArtifactId: handoffArtifactId.trim(),
        learningAreaId: handoffLearningArea,
        curriculumVersionId: 'kicd_cbe_2026',
      });

      setHandoffArtifactId('');
      setPublishedResources(ElmsIntegrationService.listPublications(schoolId));
      showToast(`Resource ${pub.ecgArtifactId} handed off to ELMS!`);
    } catch (err: any) {
      showToast(`Resource handoff failed: ${err.message}`);
    }
  };

  // Stats
  const totalCount = invites.length;
  const acceptedCount = invites.filter(i => i.status === 'Accepted').length;
  const pendingCount = invites.filter(i => i.status === 'Pending').length;

  const isConnected = connectionRecord?.status === 'CONNECTED';
  const schoolName = activeSchoolContext?.school?.name || "No Active School Selected";

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto px-4 py-2 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-700 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-2xl">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* Header Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">ELMS</h1>
            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full uppercase tracking-wider border border-emerald-300">
              Connection Foundation
            </span>
          </div>
          <p className="text-sm text-slate-600 font-semibold mt-0.5">
            Connect your teaching work to Exameno ELMS.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
          <span className="text-purple-900 font-black">ECG = Teacher preparation</span>
          <span className="text-slate-400">•</span>
          <span className="text-emerald-700 font-black">ELMS = Learner practice</span>
        </div>
      </div>

      {/* 1. CONNECTION STATUS & CURRENT SCHOOL CONTEXT BANNER */}
      {!activeSchoolContext ? (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-6 sm:p-8 space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 rounded-2xl text-amber-700">
              <School className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-black text-amber-950 uppercase tracking-wide">Connect Your School First</h2>
              <p className="text-xs text-amber-800 font-medium leading-relaxed">
                Select or join a school in <strong>My School</strong> before connecting your teaching preparation and resources to Exameno ELMS.
              </p>
            </div>
          </div>
          <div className="pt-2 flex justify-start">
            <button
              onClick={onNavigateToSchool}
              className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2"
            >
              <School className="w-4 h-4" /> Go to My School
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-6">
            
            {/* School Profile Info */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-[#3b1464] font-black text-xl shrink-0">
                <School className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Current School Context</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[9px] font-black rounded border border-slate-200">
                    {activeSchoolContext.school.county || 'Kenya'}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-slate-900">{schoolName}</h2>
                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium flex-wrap">
                  <span>Teacher: <strong>{currentUser?.name || 'Active Teacher'}</strong></span>
                  <span>•</span>
                  <span>Role: <strong>{activeSchoolContext.membership?.role || 'TEACHER'}</strong></span>
                </div>
              </div>
            </div>

            {/* Connection Badge & Health Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2 text-xs font-black uppercase tracking-wider ${
                isConnected 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                  : 'bg-amber-50 border-amber-300 text-amber-800'
              }`}>
                {isConnected ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Connected to ELMS</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Not Connected</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleVerifyHealth}
                  disabled={isVerifyingHealth}
                  className="px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  title="Verify ELMS Connection Health"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingHealth ? 'animate-spin' : ''}`} />
                  Health
                </button>

                {isConnected ? (
                  <button
                    onClick={handleDisconnectSchool}
                    className="px-3.5 py-2.5 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-700 border border-slate-200 rounded-xl text-xs font-bold transition-all"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={handleConnectSchool}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm"
                  >
                    Connect School
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Launch & Portal Link Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="text-xs text-slate-600 font-medium flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Use <strong>Exameno ELMS</strong> to give learners an interactive space for practice, revision and assessment.</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={handleCopyPortalLink}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
              >
                <Copy className="w-3.5 h-3.5" /> {copiedLink ? "Copied!" : "Copy Portal Link"}
              </button>
              
              <button
                onClick={() => handleOpenElms()}
                disabled={!isConnected}
                className="flex-1 sm:flex-initial px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open ELMS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPACT EXPANDABLE [ ABOUT ELMS ] */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <button
          onClick={() => setIsAboutExpanded(!isAboutExpanded)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Info className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-black text-slate-900 uppercase tracking-wider">About Exameno ELMS</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500 font-bold">
            <span>{isAboutExpanded ? "Collapse" : "Expand Details"}</span>
            {isAboutExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isAboutExpanded && (
          <div className="px-6 pb-6 pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-3 leading-relaxed font-medium animate-fade-in">
            <p>
              <strong>Exameno ELMS (Electronic Learning Management System)</strong> is the dedicated learner-facing environment designed specifically for KICD Grades 1–10. It gives students an engaging platform for interactive practice, testing, and revision.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-black text-slate-900 uppercase text-[10px]">Instant Evaluation</div>
                <p className="text-[11px] text-slate-500">Automated step-by-step scoring mapped directly to CBC learning outcomes.</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-black text-slate-900 uppercase text-[10px]">Topical Revision</div>
                <p className="text-[11px] text-slate-500">Targeted practice questions aligned to standard curriculum strands and sub-strands.</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-black text-slate-900 uppercase text-[10px]">Gamified Runs</div>
                <p className="text-[11px] text-slate-500">Learner-friendly quiz formats that keep students motivated and track long-term progress.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SEQUENTIAL DISPATCH ASSISTANT PANEL */}
      {currentDispatch && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-6 space-y-4 animate-fade-in">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="bg-amber-200 text-amber-900 text-[9px] font-black uppercase px-2 py-0.5 rounded-md">
                Step {dispatchIndex + 1} of {dispatchQueue.length}
              </span>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                Batch Dispatch Assistant
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                Browsers prevent launching multiple tabs at once. Let's trigger each invitation sequentially.
              </p>
            </div>
            <button 
              onClick={handleCancelDispatch}
              className="p-1 hover:bg-amber-100 rounded-full text-slate-500 hover:text-slate-900 transition-colors"
              title="Close Assistant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 bg-white rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Active Recipient</div>
              <div className="text-sm font-black text-slate-900">{currentDispatch.studentName}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-md border ${currentDispatch.sendMethod === 'WhatsApp' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                  {currentDispatch.sendMethod === 'WhatsApp' ? <MessageSquare className="w-2.5 h-2.5" /> : <Mail className="w-2.5 h-2.5" />}
                  {currentDispatch.sendMethod} ({currentDispatch.studentPhone || currentDispatch.studentEmail})
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleNextDispatch('skip')}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                Skip Student
              </button>
              <button
                onClick={() => handleNextDispatch('send')}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" /> Launch & Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN HUB NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setHubTab('invitations')}
          className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            hubTab === 'invitations'
              ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <UserPlus className="w-4 h-4" /> Learner Invitations ({totalCount})
        </button>
        <button
          onClick={() => setHubTab('classes')}
          className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            hubTab === 'classes'
              ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" /> School Classes & ELMS Mapping ({activeClasses.length})
        </button>
        <button
          onClick={() => setHubTab('handoff')}
          className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            hubTab === 'handoff'
              ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Send className="w-4 h-4" /> Resource Handoff Contract ({publishedResources.length})
        </button>
      </div>

      {/* TAB CONTENT: INVITATIONS */}
      {hubTab === 'invitations' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Form */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex border-b border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setInviterTab('single')}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-wider text-center border-r border-slate-200 transition-all ${
                    inviterTab === 'single' ? 'bg-white text-slate-900 font-extrabold' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Single Student
                </button>
                <button
                  type="button"
                  onClick={() => setInviterTab('bulk')}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-wider text-center transition-all ${
                    inviterTab === 'bulk' ? 'bg-white text-slate-900 font-extrabold' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Bulk CSV Import
                </button>
              </div>

              <div className="p-6 space-y-5">
                {inviterTab === 'single' ? (
                  <form onSubmit={handleSendInvite} className="space-y-4">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                      Add & Invite Student
                    </h3>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Student Name</label>
                      <input 
                        type="text" 
                        value={studentName}
                        onChange={e => setStudentName(e.target.value)}
                        placeholder="e.g. Kelvin Mutua"
                        className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Invitation Method</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSendMethod('WhatsApp')}
                          className={`py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                            sendMethod === 'WhatsApp' ? 'bg-green-50 border-green-500 text-green-700 font-bold' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          <MessageSquare className="w-4 h-4" /> WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={() => setSendMethod('Email')}
                          className={`py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                            sendMethod === 'Email' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          <Mail className="w-4 h-4" /> Email
                        </button>
                      </div>
                    </div>

                    {sendMethod === 'WhatsApp' ? (
                      <div className="space-y-1.5 animate-fade-in">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">WhatsApp Phone Number</label>
                        <input 
                          type="tel" 
                          value={studentPhone}
                          onChange={e => setStudentPhone(e.target.value)}
                          placeholder="e.g. 0712345678"
                          className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5 animate-fade-in">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Student Email Address</label>
                        <input 
                          type="email" 
                          value={studentEmail}
                          onChange={e => setStudentEmail(e.target.value)}
                          placeholder="e.g. student@exameno.com"
                          className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      {isSubmitting ? 'Processing...' : (
                        <>
                          <Share2 className="w-4 h-4" /> Save & Launch Invite
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-5">
                    <div className="flex justify-between items-center">
                      <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                        Upload Student List
                      </h3>
                      <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-black uppercase hover:underline"
                      >
                        <Download className="w-3.5 h-3.5" /> CSV Template
                      </button>
                    </div>

                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors relative">
                      <input 
                        type="file" 
                        accept=".csv" 
                        onChange={handleCSVUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <span className="block text-xs font-bold text-slate-700">Drag & drop CSV file here</span>
                      <span className="block text-[10px] text-slate-400 mt-1">or click to browse (.csv)</span>
                    </div>

                    {csvValidationError && (
                      <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 font-medium animate-fade-in">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-extrabold block">Validation Error</span>
                          <p className="mt-0.5 text-slate-600 leading-relaxed">{csvValidationError}</p>
                        </div>
                      </div>
                    )}

                    {parsedStudents.length > 0 && (
                      <div className="space-y-4 pt-2 border-t border-slate-200 animate-fade-in">
                        <div className="flex justify-between items-center">
                          <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            Ready to Import ({parsedStudents.filter(s => s.selected).length} selected)
                          </div>
                          <button
                            type="button"
                            onClick={toggleSelectAllStudents}
                            className="text-[10px] font-black text-slate-500 uppercase hover:text-slate-900"
                          >
                            {parsedStudents.every(s => s.selected) ? "Deselect All" : "Select All"}
                          </button>
                        </div>

                        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50 px-3">
                          {parsedStudents.map((student) => (
                            <div key={student.id} className="py-2.5 flex items-center justify-between text-xs">
                              <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0 pr-2">
                                <input 
                                  type="checkbox"
                                  checked={student.selected}
                                  onChange={() => toggleSelectStudent(student.id)}
                                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4.5 w-4.5 border-slate-200"
                                />
                                <div className="truncate">
                                  <span className="font-bold text-slate-900 block truncate">{student.studentName}</span>
                                  <span className="text-[9px] text-slate-400 font-semibold block truncate">
                                    {student.sendMethod} • {student.sendMethod === 'WhatsApp' ? (student.studentPhone || 'No Phone') : (student.studentEmail || 'No Email')}
                                  </span>
                                </div>
                              </label>
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setParsedStudents([])}
                            className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            onClick={handleImportSelected}
                            disabled={isSubmitting || parsedStudents.filter(s => s.selected).length === 0}
                            className="flex-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <FileText className="w-4 h-4" /> Import & Queue
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Tracker */}
          <div className="lg:col-span-7 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 p-4 rounded-2xl text-center">
                <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Total Invited</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">{totalCount}</span>
              </div>
              <div className="bg-white border border-slate-200 p-4 rounded-2xl text-center">
                <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Accepted (Joined)</span>
                <span className="text-2xl font-black text-emerald-600 mt-1 block">{acceptedCount}</span>
              </div>
              <div className="bg-white border border-slate-200 p-4 rounded-2xl text-center">
                <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Pending</span>
                <span className="text-2xl font-black text-amber-600 mt-1 block">{pendingCount}</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col min-h-[380px]">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-4 bg-slate-50">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Invitation Tracker</h3>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">Manage and monitor learners on ELMS</p>
                </div>
                <button
                  onClick={handleSyncStatuses}
                  disabled={isSyncing || totalCount === 0}
                  className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors text-emerald-800"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing...' : 'Sync Status'}
                </button>
              </div>

              <div className="flex-grow overflow-auto">
                {invites.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
                    <Users className="w-10 h-10 text-slate-300" />
                    <h4 className="font-bold text-sm text-slate-700">No Invitations Sent</h4>
                    <p className="text-xs text-slate-500 max-w-sm">
                      Fill out the form on the left or upload a CSV file to add student invitations for this school.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {invites.map((invite) => (
                      <div key={invite.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors gap-4">
                        <div className="space-y-1">
                          <h4 className="text-xs font-black text-slate-900">{invite.studentName}</h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-md border ${invite.sendMethod === 'WhatsApp' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                              {invite.sendMethod === 'WhatsApp' ? <MessageSquare className="w-2.5 h-2.5" /> : <Mail className="w-2.5 h-2.5" />}
                              {invite.studentPhone || invite.studentEmail}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleStatus(invite)}
                            className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1.5 rounded-full border transition-all ${invite.status === 'Accepted' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-amber-50 border-amber-300 text-amber-800'}`}
                          >
                            {invite.status === 'Accepted' ? (
                              <>
                                <Check className="w-2.5 h-2.5" /> Accepted
                              </>
                            ) : (
                              <>
                                <Clock className="w-2.5 h-2.5" /> Pending
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleResendInvite(invite)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                            title="Resend invitation link"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => invite.id && handleDeleteInvite(invite.id, invite.studentName)}
                            className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                            title="Delete invitation record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: SCHOOL CLASSES & ELMS MAPPING */}
      {hubTab === 'classes' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden space-y-4 p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Active Classes for {schoolName}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Map class groups to ELMS and trigger direct class practice sessions.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
              {activeClasses.length} Class Groups
            </span>
          </div>

          {activeClasses.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs space-y-2">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-600">No active classes found for this school.</p>
              <p className="text-slate-500">Create classes in My School to connect them to ELMS practice hubs.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeClasses.map((cg) => (
                <div key={cg.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-md">
                        {cg.gradeId || 'Grade'}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        MAPPED
                      </span>
                    </div>
                    <h4 className="text-base font-black text-slate-900 mt-2">{cg.name}</h4>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Stream: {cg.stream || 'A'} • Academic Year: {cg.academicYearId || 2026}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-500">
                      Learners: {cg.learnerCount || 0}
                    </span>
                    <button
                      onClick={() => handleOpenElms(cg.id, 'class')}
                      disabled={!isConnected}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3 h-3" /> Launch Class in ELMS
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: RESOURCE HANDOFF CONTRACT */}
      {hubTab === 'handoff' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600" /> Hand Off Resource to ELMS
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Publish approved ECG schemes, lesson plans, or assessments into ELMS practice modules using a stable contract.
            </p>

            <form onSubmit={handlePublishHandoff} className="space-y-4 pt-2">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Artifact ID
                </label>
                <input
                  type="text"
                  value={handoffArtifactId}
                  onChange={(e) => setHandoffArtifactId(e.target.value)}
                  placeholder="e.g. art_math_g3_wk1"
                  className="w-full text-xs font-medium px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Learning Area
                </label>
                <select
                  value={handoffLearningArea}
                  onChange={(e) => setHandoffLearningArea(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 border border-slate-200 rounded-xl focus:outline-none"
                >
                  <option value="Mathematics">Mathematics</option>
                  <option value="Science and Technology">Science and Technology</option>
                  <option value="English Language">English Language</option>
                  <option value="Kiswahili Lugha">Kiswahili Lugha</option>
                  <option value="Social Studies">Social Studies</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={!isConnected}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Send className="w-3.5 h-3.5" /> Publish to ELMS
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Resource Handoff Ledger
              </h3>
              <span className="text-[10px] text-slate-500 font-bold">{publishedResources.length} Published</span>
            </div>

            {publishedResources.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No resources published yet for this school.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {publishedResources.map((pub) => (
                  <div key={pub.publicationId} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black text-slate-900">{pub.ecgArtifactId}</h4>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-bold">
                          v{pub.artifactVersion}
                        </span>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[9px] font-bold">
                          {pub.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        ELMS Resource: {pub.elmsResourceId} • Area: {pub.learningAreaId}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(pub.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentElmsPanel;
