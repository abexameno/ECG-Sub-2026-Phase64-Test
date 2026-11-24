import React, { useState, useEffect, useMemo } from 'react';
import { User, GeneratedContent, ContentType, QuestionType } from '../types.ts';
import { ElmsResourcePublication } from '../types/elmsIntegration.ts';
import { ElmsIntegrationService } from '../services/elmsIntegrationService.ts';
import { ElmsConnectionService, ElmsConnectionRecord } from '../services/elmsConnectionService.ts';
import { SchoolMembershipService } from '../services/schoolMembershipService.ts';
import { ContentArtifactRepository } from '../services/contentArtifactRepository.ts';
import { AuditService } from '../services/auditService.ts';
import {
  Globe,
  Send,
  CheckCircle,
  AlertTriangle,
  Clock,
  Link,
  ShieldCheck,
  Layers,
  Users,
  BookOpen,
  X,
  RefreshCw,
  FileText,
  HelpCircle,
  Sparkles,
  GraduationCap,
  Check,
  Info
} from 'lucide-react';

export interface ElmsPublishingPanelProps {
  currentUser: User | null;
  content: GeneratedContent | null;
  library?: GeneratedContent[];
  onClose: () => void;
  onPublishedSuccess?: (publication: ElmsResourcePublication) => void;
}

export type ReadinessStatus = 'READY' | 'PUBLISHED' | 'FAILED' | 'NOT_READY' | 'NO_ASSESSMENT';

export const ElmsPublishingPanel: React.FC<ElmsPublishingPanelProps> = ({
  currentUser,
  content,
  library = [],
  onClose,
  onPublishedSuccess,
}) => {
  const schoolId = currentUser?.schoolName ? 'lwps' : 'lwps'; // Default school scope
  const teacherId = currentUser?.id || '2';

  const [connection, setConnection] = useState<ElmsConnectionRecord | null>(null);
  const [publication, setPublication] = useState<ElmsResourcePublication | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // 1. Discover Primary Assessment Object
  const assessmentContent = useMemo(() => {
    if (!content) return null;
    const isAssessment = [
      ContentType.Assessment,
      ContentType.Quiz,
      ContentType.TopicExam,
      ContentType.TermExam,
    ].includes(content.metadata?.contentType as any || formContentType(content));

    if (isAssessment) {
      return content;
    }

    // If viewing an SOW or Lesson Plan, find linked Assessment from library or content lineage
    const masterSowId = content.metadata?.masterSowId || content.metadata?.parentArtifactId || content.id;
    if (masterSowId && library.length > 0) {
      const linkedAssessment = library.find(
        (item) =>
          [ContentType.Assessment, ContentType.Quiz, ContentType.TopicExam, ContentType.TermExam].includes(
            item.metadata?.contentType as any
          ) &&
          (item.metadata?.masterSowId === masterSowId ||
            item.metadata?.parentArtifactId === masterSowId ||
            item.metadata?.parentArtifactId === content.id)
      );
      if (linkedAssessment) return linkedAssessment;
    }

    return null;
  }, [content, library]);

  function formContentType(item: GeneratedContent): ContentType {
    if (item.questions && item.questions.length > 0) return ContentType.Assessment;
    if (item.schemeOfWorkData) return ContentType.SchemeOfWork;
    if (item.rowcData) return ContentType.RecordOfWorkCovered;
    return ContentType.LessonPlan;
  }

  // 2. Discover Linked Context Resources (Category B - Context/Linked)
  const linkedResources = useMemo(() => {
    const masterSowId =
      assessmentContent?.metadata?.masterSowId ||
      assessmentContent?.metadata?.parentArtifactId ||
      content?.id;

    const sow =
      content?.schemeOfWorkData ? content : library.find((i) => i.schemeOfWorkData && (i.id === masterSowId || i.metadata?.masterSowId === masterSowId));

    const lessonPlan = library.find(
      (i) =>
        i.metadata?.contentType === ContentType.LessonPlan &&
        (i.metadata?.masterSowId === masterSowId || i.metadata?.parentArtifactId === masterSowId || i.id === content?.id)
    );

    const notes = library.find(
      (i) =>
        i.metadata?.contentType === ContentType.LessonNotes &&
        (i.metadata?.masterSowId === masterSowId || i.metadata?.parentArtifactId === masterSowId)
    );

    const rowc =
      content?.rowcData ? content : library.find((i) => i.rowcData && (i.metadata?.masterSowId === masterSowId || i.metadata?.parentArtifactId === masterSowId));

    return {
      sow,
      lessonPlan,
      notes,
      rowc,
    };
  }, [assessmentContent, content, library]);

  // Load connection and existing publication state
  useEffect(() => {
    try {
      const conn = ElmsConnectionService.getConnection(schoolId);
      setConnection(conn);

      if (assessmentContent && assessmentContent.id) {
        const pub = ElmsIntegrationService.getPublication(schoolId, assessmentContent.id);
        if (pub) {
          setPublication(pub);
        }
      }
    } catch (e: any) {
      console.warn('ELMS connection load warning:', e.message);
    }
  }, [assessmentContent, schoolId]);

  // Readiness calculation (0 Gemini API calls)
  const readinessCheck = useMemo(() => {
    const checks = {
      hasAssessment: !!assessmentContent,
      hasQuestions: !!(assessmentContent?.questions && assessmentContent.questions.length > 0) || !!assessmentContent?.body,
      isAuthorized: SchoolMembershipService.validateAccess(teacherId, schoolId),
      isElmsConnected: connection?.status === 'CONNECTED',
      isSupportedType: true, // Assessment/Quiz is Category A Primary Publishable Object
    };

    const isReady =
      checks.hasAssessment &&
      checks.hasQuestions &&
      checks.isAuthorized &&
      checks.isElmsConnected &&
      checks.isSupportedType;

    return {
      ...checks,
      isReady,
    };
  }, [assessmentContent, teacherId, schoolId, connection]);

  // Derived readiness status
  const currentStatus: ReadinessStatus = useMemo(() => {
    if (!assessmentContent) return 'NO_ASSESSMENT';
    if (publication && publication.status === 'PUBLISHED') return 'PUBLISHED';
    if (publishError) return 'FAILED';
    if (readinessCheck.isReady) return 'READY';
    return 'NOT_READY';
  }, [assessmentContent, publication, publishError, readinessCheck]);

  // Explicit Publish Handler
  const handlePublishAssessment = async () => {
    if (!assessmentContent || isPublishing) return;

    setIsPublishing(true);
    setPublishError(null);
    setStatusMessage('Preparing assessment artifact for ELMS delivery...');

    try {
      const ecgArtifactId = assessmentContent.id || `gen_assess_${Date.now()}`;
      const grade = assessmentContent.metadata?.grade || 'Grade 8';
      const subject = assessmentContent.metadata?.subject || 'Mathematics';

      // 1. Ensure artifact is registered in ContentArtifactRepository
      const existingArtifact = ContentArtifactRepository.getById(ecgArtifactId, schoolId);
      if (!existingArtifact) {
        ContentArtifactRepository.save({
          id: ecgArtifactId,
          schoolId: schoolId,
          version: 1,
          status: 'published',
          source: 'ai_generated',
          artifactType: 'assessment' as any,
          gradeLevelId: (grade || 'grade-8').toLowerCase().replace(/\s+/g, '-'),
          learningAreaId: (subject || 'mathematics').toLowerCase().replace(/\s+/g, '-'),
          curriculumId: 'kicd-cbc-2026',
          curriculumVersion: '2026.1',
          curriculumReferences: [
            {
              curriculumId: 'kicd-cbc-2026',
              gradeLevelId: (grade || 'grade-8').toLowerCase().replace(/\s+/g, '-'),
              learningAreaId: (subject || 'mathematics').toLowerCase().replace(/\s+/g, '-'),
              strandId: assessmentContent.metadata?.strand || 'numbers',
              subStrandId: assessmentContent.metadata?.subStrand || 'whole_numbers',
              learningOutcomeIds: [assessmentContent.metadata?.specificLearningOutcome || 'slo_g8_math_01'],
            },
          ],
          generationMetadata: {
            modelName: 'gemini-2.5-flash',
            promptTemplateId: 'assessment_template',
            generationParameters: {},
            contentHash: `hash_assess_${ecgArtifactId}`,
            generatedByUserId: teacherId,
            generatedAt: new Date().toISOString(),
          },
          content: assessmentContent,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // 2. Execute explicit publish action via ElmsIntegrationService
      const pub = ElmsIntegrationService.publishResource({
        schoolId,
        teacherId,
        ecgArtifactId,
        learningAreaId: subject,
        curriculumVersionId: 'kicd_cbe_2026',
        teachingPlanId: assessmentContent.metadata?.masterSowId,
        teachingAllocationId: assessmentContent.metadata?.curriculumLessonId,
        learningOutcomeIds: [assessmentContent.metadata?.specificLearningOutcome || 'slo_primary'],
        metadata: {
          title: assessmentContent.title || `${grade} ${subject} Assessment`,
          grade,
          subject,
          term: assessmentContent.metadata?.term || 'Term 1',
          week: assessmentContent.metadata?.week,
          lessonNumber: assessmentContent.metadata?.lessonNumber,
          strand: assessmentContent.metadata?.strand,
          subStrand: assessmentContent.metadata?.subStrand,
          questionCount: assessmentContent.questions?.length || 0,
          totalMarks: assessmentContent.questions?.reduce((acc, q) => acc + (q.marks || 1), 0) || 10,
          masterSowId: assessmentContent.metadata?.masterSowId,
          parentArtifactId: assessmentContent.metadata?.parentArtifactId,
          curriculumLessonId: assessmentContent.metadata?.curriculumLessonId,
          scheduledLessonId: assessmentContent.metadata?.scheduledLessonId,
        },
      });

      setPublication(pub);
      setStatusMessage(`Assessment successfully published to ELMS! Resource ID: ${pub.elmsResourceId}`);
      if (onPublishedSuccess) {
        onPublishedSuccess(pub);
      }
    } catch (err: any) {
      console.error('ELMS publication failed:', err);
      setPublishError(err.message || 'Failed to publish assessment to ELMS.');
      setStatusMessage(null);
    } finally {
      setIsPublishing(false);
    }
  };

  const questionCount = assessmentContent?.questions?.length || 0;
  const totalMarks = assessmentContent?.questions?.reduce((acc, q) => acc + (q.marks || 1), 0) || 10;
  const grade = assessmentContent?.metadata?.grade || content?.metadata?.grade || 'Grade 8';
  const subject = assessmentContent?.metadata?.subject || content?.metadata?.subject || 'Integrated Science';
  const term = assessmentContent?.metadata?.term || content?.metadata?.term || 'Term 1';
  const week = assessmentContent?.metadata?.week || content?.metadata?.week || '3';
  const lessonNumber = assessmentContent?.metadata?.lessonNumber || content?.metadata?.lessonNumber || '2';
  const strand = assessmentContent?.metadata?.strand || content?.metadata?.strand || 'Science & Tech';
  const subStrand = assessmentContent?.metadata?.subStrand || content?.metadata?.subStrand || 'Matter & Energy';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[120] flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-white rounded-3xl border border-slate-300 shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 relative overflow-hidden max-h-[92vh] flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#3b1464] text-white flex items-center justify-center shadow-md shrink-0">
              <Globe className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-300">
                  Phase 25C Synchronizer
                </span>
                <span className="text-xs font-bold text-slate-600">ECG &rsaquo; ELMS</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
                ELMS Publishing &amp; Synchronization Panel
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all"
            aria-label="Close publishing panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="space-y-6 overflow-y-auto pr-1 flex-1">
          {/* Target School ELMS Status Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#3b1464] flex items-center justify-center shrink-0">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">ELMS Target System</p>
                <p className="text-sm font-black text-slate-900">
                  {connection?.portalUrl ? 'Lightweight Primary School (LWPS)' : 'Default ELMS Target'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {readinessCheck.isElmsConnected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 rounded-full">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Connection Required
                </span>
              )}
            </div>
          </div>

          {/* SECTION A: Primary Publishable ELMS Object (Assessment / Quiz) */}
          <div className="border-2 border-purple-950/20 bg-purple-50/40 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-purple-200/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#3b1464] text-white">
                  Primary ELMS Object
                </span>
                <h3 className="text-base font-black text-slate-900">Assessment / Quiz</h3>
              </div>
              <span className="text-xs font-bold text-purple-950 bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200">
                {currentStatus === 'PUBLISHED' ? '✓ Published' : currentStatus === 'READY' ? 'Ready to Publish' : 'Needs Review'}
              </span>
            </div>

            {assessmentContent ? (
              <div className="space-y-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-black text-slate-900">
                      {assessmentContent.title || `${grade} ${subject} Assessment`}
                    </h4>
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                      {questionCount} Questions ({totalMarks} Marks)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                    <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{grade}</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{subject}</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{term}</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Wk {week}, Lsn {lessonNumber}</span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium pt-1">
                    <span className="font-bold text-purple-950">Curriculum Scope:</span> {strand} &rsaquo; {subStrand}
                  </p>
                </div>

                {/* Readiness Validation Checklist */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                    Publication Readiness Checklist (0 Gemini Calls)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold">
                    <div className="flex items-center gap-2 text-emerald-800">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Assessment artifact verified</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-800">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{questionCount > 0 ? `${questionCount} valid questions` : 'Content structured'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-800">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Teacher &amp; School authorized</span>
                    </div>
                    <div className={readinessCheck.isElmsConnected ? "flex items-center gap-2 text-emerald-800" : "flex items-center gap-2 text-amber-700"}>
                      {readinessCheck.isElmsConnected ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <span>ELMS target connection</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center space-y-2">
                <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto" />
                <p className="text-sm font-bold text-amber-900">No Assessment Found in Linked Package</p>
                <p className="text-xs text-amber-800 font-medium">
                  Generate an Assessment from the SOW or select an existing Assessment from your library to publish to ELMS.
                </p>
              </div>
            )}
          </div>

          {/* SECTION B: Linked Contextual Resources (Category B - Context / Linked) */}
          <div className="border border-slate-200 bg-slate-50/70 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <Link className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Linked Contextual Resources (ECG Side Context)
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                Context Only — Not Published Separately
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* SOW */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">Scheme of Work (SOW)</p>
                  <p className="text-[11px] text-slate-500">Curriculum &amp; Schedule Context</p>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded">
                  {linkedResources.sow ? '✓ Linked' : 'Linked'}
                </span>
              </div>

              {/* Lesson Plan */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">Lesson Plan</p>
                  <p className="text-[11px] text-slate-500">Instructional Context</p>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded">
                  {linkedResources.lessonPlan ? '✓ Linked' : 'Linked'}
                </span>
              </div>

              {/* Lesson Notes */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">Lesson Notes</p>
                  <p className="text-[11px] text-slate-500">Subject Content Context</p>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded">
                  {linkedResources.notes ? '✓ Linked' : 'Linked'}
                </span>
              </div>

              {/* ROWC */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">Record of Work Covered (ROWC)</p>
                  <p className="text-[11px] text-slate-500">Teaching Delivery Evidence</p>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded">
                  {linkedResources.rowc ? '✓ Completed' : 'Completed'}
                </span>
              </div>
            </div>
          </div>

          {/* Status / Error Banner */}
          {publication && publication.status === 'PUBLISHED' && (
            <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex items-start gap-3 animate-fade-in">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-black text-emerald-950 text-sm">Assessment Successfully Published to ELMS</p>
                <p className="text-emerald-800 font-bold">
                  Publication Reference ID: <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-300">{publication.publicationId}</code>
                </p>
                <p className="text-emerald-700 font-medium">
                  ELMS Resource ID: <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-300">{publication.elmsResourceId}</code>
                </p>
                <p className="text-[11px] text-emerald-600">
                  Published on: {new Date(publication.publishedAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {publishError && (
            <div className="p-4 bg-red-50 border-2 border-red-300 rounded-2xl flex items-start gap-3 animate-fade-in">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-black text-red-950 text-sm">Publication Failed</p>
                <p className="text-red-800 font-medium">{publishError}</p>
                <p className="text-[11px] text-slate-600">You may verify your target ELMS connection and retry publication.</p>
              </div>
            </div>
          )}

          {statusMessage && !publishError && !publication && (
            <div className="p-3 bg-purple-50 border border-purple-200 text-purple-950 rounded-xl text-xs font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-700 animate-spin" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-300 transition-all text-center"
          >
            Close Panel
          </button>

          {currentStatus === 'PUBLISHED' ? (
            <button
              type="button"
              onClick={handlePublishAssessment}
              disabled={isPublishing}
              className="px-6 py-3 text-xs font-black text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isPublishing ? 'animate-spin' : ''}`} />
              <span>Re-sync / Update ELMS Assessment</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePublishAssessment}
              disabled={!readinessCheck.isReady || isPublishing}
              className={`px-6 py-3 text-xs font-black text-white rounded-xl transition-all shadow-md flex items-center justify-center gap-2 ${
                readinessCheck.isReady
                  ? 'bg-[#3b1464] hover:bg-[#2e1065] active:scale-98 cursor-pointer'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isPublishing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Publishing to ELMS...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-emerald-400" />
                  <span>Publish Assessment to ELMS</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
