import React, { useState } from 'react';
import { User, GeneratedContent, ContentType } from '../types';
import { ElmsIntegrationService } from '../services/elmsIntegrationService';
import { ElmsConnectionService } from '../services/elmsConnectionService';
import { ContentArtifactRepository } from '../services/contentArtifactRepository';
import { AuditService } from '../services/auditService';
import { AssessmentElmsEvidenceInterpretationPanel } from './AssessmentElmsEvidenceInterpretationPanel';
import { TeacherActionPlan } from '../types/teacherAction';
import { Send, CheckCircle, AlertTriangle, Lock, BookOpen, Layers, Sparkles, Clock, ShieldCheck, RefreshCw } from 'lucide-react';

interface AssessmentElmsPublishingPanelProps {
  content: GeneratedContent;
  currentUser: User | null;
  onContentUpdate?: (updatedContent: GeneratedContent) => void;
  library?: GeneratedContent[];
  onInitiateResourceFromAction?: (
    action: TeacherActionPlan,
    preferredContentType?: ContentType,
    isFollowUpAssessment?: boolean
  ) => void;
}

export const AssessmentElmsPublishingPanel: React.FC<AssessmentElmsPublishingPanelProps> = ({
  content,
  currentUser,
  onContentUpdate,
  library = [],
  onInitiateResourceFromAction,
}) => {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [showReviewDetails, setShowReviewDetails] = useState(false);

  const schoolId = currentUser?.schoolName || 'lwps';
  const teacherId = currentUser?.id || 't_lwps_1';
  const metadata = content.metadata || {
    grade: 'Grade 8',
    subject: 'Integrated Science',
    topic: 'General',
    contentType: ContentType.Assessment,
  };

  // Determine ELMS Connection state
  const connection = ElmsConnectionService.getConnection(schoolId);
  const isConnected = connection && connection.status === 'CONNECTED';

  // Check existing ELMS publication status from artifact store or metadata
  const ecgArtifactId = content.id || content.metadata?.parentArtifactId || `art_assessment_${Date.now()}`;
  const existingPub = ElmsIntegrationService.getPublication(schoolId, ecgArtifactId);
  const metadataPub = content.metadata?.elmsPublication;

  const currentStatus = metadataPub?.status || (existingPub ? (existingPub.status as any) : 'NOT_PUBLISHED');
  const elmsResourceId = metadataPub?.elmsResourceId || existingPub?.elmsResourceId;
  const publishedAt = metadataPub?.publishedAt || existingPub?.publishedAt;

  // Derive linked ECG resources for context display (ECG-side only)
  const masterSowId = metadata.masterSowId || metadata.parentArtifactId;
  const isSowLinked = !!masterSowId;
  const isLessonPlanLinked = !!(metadata.curriculumLessonId || metadata.scheduledLessonId);
  const isNotesLinked = !!(metadata.strand && metadata.subStrand);
  const isRowcCompleted = library.some(
    item =>
      item.metadata?.contentType === ContentType.RecordOfWorkCovered &&
      (item.metadata?.parentArtifactId === masterSowId || item.metadata?.masterSowId === masterSowId)
  );

  const questionCount = content.questions?.length || 0;
  const totalMarks = content.questions?.reduce((sum, q) => sum + (q.marks || 1), 0) || questionCount;

  // Readiness Validation (Deterministic, ZERO Gemini calls)
  const validateReadiness = (): { ready: boolean; reason?: string } => {
    if (!content) return { ready: false, reason: 'Assessment content is missing.' };
    if (!content.questions || content.questions.length === 0) return { ready: false, reason: 'Assessment must contain at least 1 question.' };
    if (!metadata.grade || !metadata.subject) return { ready: false, reason: 'Assessment grade and subject are required.' };
    if (!currentUser) return { ready: false, reason: 'Teacher authentication is required.' };
    if (!isConnected) return { ready: false, reason: 'ELMS connection is not active for this school context.' };
    return { ready: true };
  };

  const readiness = validateReadiness();

  const handlePublish = async () => {
    if (isPublishing) return; // Double-click protection
    setPublishError(null);

    const check = validateReadiness();
    if (!check.ready) {
      setPublishError(check.reason || 'Readiness check failed.');
      return;
    }

    setIsPublishing(true);

    try {
      // 1. Ensure artifact exists in ContentArtifactRepository for school isolation
      let artifact = ContentArtifactRepository.getById(ecgArtifactId, schoolId);
      if (!artifact) {
        ContentArtifactRepository.save({
          id: ecgArtifactId,
          schoolId: schoolId,
          version: 1,
          artifactType: 'assessment',
          curriculumId: 'canonical-cbc',
          curriculumVersion: '2024.1',
          gradeLevelId: metadata.grade,
          learningAreaId: metadata.subject,
          status: 'validated',
          source: 'ai_generated',
          curriculumReferences: [
            {
              gradeLevelId: metadata.grade,
              learningAreaId: metadata.subject,
              strandId: metadata.strand || 'general',
              subStrandId: metadata.subStrand || 'general',
              learningOutcomeIds: [metadata.specificLearningOutcome || 'slo-1'],
            },
          ],
          generationMetadata: {
            generationId: `gen_${ecgArtifactId}`,
            model: 'gemini-2.5-flash',
            promptVersion: 'assessment_template',
            generatedAt: new Date().toISOString(),
          },
          content: content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // 2. Publish to ELMS via Phase 54 Service
      const pub = ElmsIntegrationService.publishResource({
        schoolId,
        teacherId,
        ecgArtifactId,
        learningAreaId: metadata.subject,
        curriculumVersionId: 'kicd_cbe_2026',
        teachingPlanId: metadata.masterSowId,
        teachingAllocationId: metadata.curriculumLessonId,
        learningOutcomeIds: metadata.specificLearningOutcome ? [metadata.specificLearningOutcome] : [],
        metadata: {
          title: content.title,
          questionCount,
          totalMarks,
          grade: metadata.grade,
          subject: metadata.subject,
          term: metadata.term,
          week: metadata.week,
          lesson: metadata.lessonNumber,
        },
      });

      // 3. Persist publication relationship in content metadata
      const updatedContent: GeneratedContent = {
        ...content,
        metadata: {
          ...metadata,
          parentArtifactId: ecgArtifactId,
          elmsPublication: {
            publicationId: pub.publicationId,
            elmsResourceId: pub.elmsResourceId,
            publishedAt: pub.publishedAt,
            status: 'PUBLISHED',
            schoolId: pub.schoolId,
            publishedBy: teacherId,
          },
        },
      };

      if (onContentUpdate) {
        onContentUpdate(updatedContent);
      }

      AuditService.log('ARTIFACT_UPDATED', schoolId, {
        action: 'ECG_ASSESSMENT_PUBLISHED_TO_ELMS',
        ecgArtifactId,
        publicationId: pub.publicationId,
        elmsResourceId: pub.elmsResourceId,
        teacherId,
      });
    } catch (err: any) {
      console.error('ELMS Publication Error:', err);
      setPublishError(err?.message || 'Failed to publish assessment to ELMS.');

      // Mark status as FAILED
      const updatedContent: GeneratedContent = {
        ...content,
        metadata: {
          ...metadata,
          elmsPublication: {
            publicationId: `pub_failed_${Date.now()}`,
            elmsResourceId: 'FAILED',
            publishedAt: new Date().toISOString(),
            status: 'FAILED',
            schoolId,
            publishedBy: teacherId,
            errorDetails: err?.message || 'Publication failed',
          },
        },
      };

      if (onContentUpdate) {
        onContentUpdate(updatedContent);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-5 border border-purple-800/40 shadow-xl mb-6 my-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-600/30 rounded-xl border border-purple-500/40 text-purple-300">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-purple-200">
                Publish Assessment to ELMS
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                Phase 25C
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Synchronize this assessment to ELMS for learner assignment, attempts & grading.
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {currentStatus === 'PUBLISHED' && (
            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" /> PUBLISHED TO ELMS
            </span>
          )}
          {currentStatus === 'FAILED' && (
            <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> PUBLICATION FAILED
            </span>
          )}
          {currentStatus === 'NOT_PUBLISHED' && (
            <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> NOT PUBLISHED
            </span>
          )}
        </div>
      </div>

      {/* Primary Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
        {/* Assessment Attributes */}
        <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80 space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-400 border-b border-slate-700/60 pb-1.5 font-bold">
            <span className="uppercase tracking-wider text-[10px] text-purple-300">Assessment Spec</span>
            <span>{questionCount} Questions ({totalMarks} Marks)</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-slate-300">
            <div><span className="text-slate-500">Grade:</span> <strong className="text-white">{metadata.grade}</strong></div>
            <div><span className="text-slate-500">Subject:</span> <strong className="text-white">{metadata.subject}</strong></div>
            <div><span className="text-slate-500">Term:</span> <strong className="text-white">{metadata.term || 'Term 1'}</strong></div>
            <div><span className="text-slate-500">Schedule:</span> <strong className="text-white">Wk {metadata.week || 1}, Lsn {metadata.lessonNumber || 1}</strong></div>
          </div>
          {metadata.strand && (
            <div className="pt-1 text-[11px] text-slate-300 border-t border-slate-700/50">
              <span className="text-slate-500 font-bold">Strand & Sub-strand:</span> {metadata.strand} &rsaquo; {metadata.subStrand}
            </div>
          )}
        </div>

        {/* ECG Curriculum & Teaching Context (ECG-side only) */}
        <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80 space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-400 border-b border-slate-700/60 pb-1.5 font-bold">
            <span className="uppercase tracking-wider text-[10px] text-emerald-400">ECG Teaching Context (ECG ONLY)</span>
            <span className="text-[10px] text-slate-400">Remains in ECG</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className={isSowLinked ? "text-emerald-400 font-bold" : "text-slate-500"}>
                {isSowLinked ? '✓ SOW Linked' : '— SOW Unlinked'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={isLessonPlanLinked ? "text-emerald-400 font-bold" : "text-slate-500"}>
                {isLessonPlanLinked ? '✓ Lesson Plan' : '— Lesson Plan'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={isNotesLinked ? "text-emerald-400 font-bold" : "text-slate-500"}>
                {isNotesLinked ? '✓ Notes Linked' : '— Notes'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={isRowcCompleted ? "text-emerald-400 font-bold" : "text-slate-500"}>
                {isRowcCompleted ? '✓ ROWC Done' : '— ROWC Pending'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Architectural Guarantee Notice */}
      <div className="bg-purple-950/60 border border-purple-800/50 rounded-xl p-3 text-[11px] text-purple-200 flex items-start gap-2 mb-4">
        <ShieldCheck className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-white">ELMS Boundary Guarantee:</span> Only this Assessment will be published to ELMS. SOW, Lesson Plan, Notes and ROWC remain in ECG. Zero AI / Gemini calls are made during publishing.
        </div>
      </div>

      {/* ELMS Connection Check or Error Banner */}
      {!isConnected && (
        <div className="bg-amber-950/80 border border-amber-700/80 rounded-xl p-3 text-xs text-amber-200 flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>ELMS Connection Required for <strong>{schoolId}</strong>. Please verify ELMS connection in School Settings.</span>
          </div>
          <span className="text-[10px] bg-amber-900 border border-amber-600 px-2 py-0.5 rounded font-bold">Not Connected</span>
        </div>
      )}

      {publishError && (
        <div className="bg-rose-950/90 border border-rose-700 rounded-xl p-3 text-xs text-rose-200 flex items-center gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{publishError}</span>
        </div>
      )}

      {/* Success Info Banner if published */}
      {currentStatus === 'PUBLISHED' && elmsResourceId && (
        <div className="bg-emerald-950/80 border border-emerald-800 rounded-xl p-3 text-xs text-emerald-200 flex items-center justify-between mb-4">
          <div>
            <div className="font-bold text-emerald-300">Published to ELMS Successfully</div>
            <div className="text-[11px] text-emerald-400/80 mt-0.5 font-mono">ELMS Resource ID: {elmsResourceId}</div>
          </div>
          {publishedAt && (
            <div className="text-[10px] text-slate-400 font-medium text-right">
              Published: {new Date(publishedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={() => setShowReviewDetails(!showReviewDetails)}
          className="text-xs text-slate-400 hover:text-white font-bold underline flex items-center gap-1 self-start sm:self-auto"
        >
          {showReviewDetails ? 'Hide Review Specs' : 'Review Assessment Specs'}
        </button>

        <button
          type="button"
          onClick={handlePublish}
          disabled={isPublishing || !readiness.ready}
          className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
            isPublishing
              ? 'bg-purple-900 text-purple-300 cursor-wait animate-pulse'
              : currentStatus === 'PUBLISHED'
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-400'
              : readiness.ready
              ? 'bg-purple-600 hover:bg-purple-500 text-white border border-purple-400'
              : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
          }`}
        >
          {isPublishing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Publishing to ELMS...</span>
            </>
          ) : currentStatus === 'PUBLISHED' ? (
            <>
              <CheckCircle className="h-4 w-4" />
              <span>Update / Republish to ELMS</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              <span>Publish Assessment to ELMS</span>
            </>
          )}
        </button>
      </div>

      {showReviewDetails && (
        <div className="mt-4 pt-4 border-t border-slate-800 text-xs space-y-2 bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-slate-300">
          <h4 className="font-bold text-purple-300 uppercase tracking-wider text-[10px]">Detailed Review Snapshot</h4>
          <div><span className="text-slate-500">ECG Artifact ID:</span> <span className="font-mono text-slate-200">{ecgArtifactId}</span></div>
          <div><span className="text-slate-500">Master SOW ID:</span> <span className="font-mono text-slate-200">{metadata.masterSowId || 'None'}</span></div>
          <div><span className="text-slate-500">Curriculum Lesson ID:</span> <span className="font-mono text-slate-200">{metadata.curriculumLessonId || 'None'}</span></div>
          <div><span className="text-slate-500">Specific Learning Outcome:</span> <span className="text-slate-200">{metadata.specificLearningOutcome || 'Standard Curriculum Outcome'}</span></div>
        </div>
      )}

      {/* Phase 26: ELMS Assessment Evidence & ECG Interpretation Layer */}
      {currentStatus === 'PUBLISHED' && (
        <AssessmentElmsEvidenceInterpretationPanel
          content={content}
          currentUser={currentUser}
          onContentUpdate={onContentUpdate}
          library={library}
          onInitiateResourceFromAction={onInitiateResourceFromAction}
        />
      )}
    </div>
  );
};
