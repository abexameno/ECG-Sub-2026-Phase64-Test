import React, { useState, useEffect } from 'react';
import { User, GeneratedContent, ContentType } from '../types';
import { AssessmentEvidenceInterpretation, InterpretationStatus, LO_MASTERY_V1_CONFIG } from '../types/interpretation';
import { LearningOutcomeInterpretationService } from '../services/learningOutcomeInterpretationService';
import { AssessmentEvidenceService } from '../services/assessmentEvidenceService';
import { ElmsIntegrationService } from '../services/elmsIntegrationService';
import { LearnerRosterService } from '../services/learnerRosterService';
import { ClassGroupService } from '../services/classGroupService';
import { 
  FileText, 
  CheckCircle, 
  HelpCircle, 
  TrendingUp, 
  Users, 
  ShieldCheck, 
  AlertCircle, 
  Sparkles, 
  BookOpen, 
  Edit3, 
  RefreshCw, 
  Info,
  ClipboardList,
  CheckSquare,
  XSquare,
  PlayCircle,
  Plus,
  History
} from 'lucide-react';
import { TeacherActionService } from '../services/teacherActionService';
import { 
  TeacherActionPlan, 
  TeacherActionType, 
  TeacherActionScope, 
  SuggestedTeacherAction,
  TeacherActionStatus,
  TeacherActionFollowUpComparison
} from '../types/teacherAction';

interface AssessmentElmsEvidenceInterpretationPanelProps {
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

export const AssessmentElmsEvidenceInterpretationPanel: React.FC<AssessmentElmsEvidenceInterpretationPanelProps> = ({
  content,
  currentUser,
  onInitiateResourceFromAction,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'roster' | 'pedagogy' | 'actions'>('overview');
  const [interpretation, setInterpretation] = useState<AssessmentEvidenceInterpretation | null>(null);
  const [selectedClassGroupId, setSelectedClassGroupId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  
  // Teacher Action State
  const [actionPlans, setActionPlans] = useState<TeacherActionPlan[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedTeacherAction[]>([]);
  const [isCreatingAction, setIsCreatingAction] = useState(false);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  
  // New Action Form State
  const [newActionType, setNewActionType] = useState<TeacherActionType>('GUIDED_PRACTICE');
  const [newActionScope, setNewActionScope] = useState<TeacherActionScope>('WHOLE_CLASS');
  const [newActionFocus, setNewActionFocus] = useState('');
  const [newActionNotes, setNewActionNotes] = useState('');
  const [selectedLearners, setSelectedLearners] = useState<string[]>([]);
  const [overrideModalLearnerId, setOverrideModalLearnerId] = useState<string | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<InterpretationStatus>('DEVELOPING');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationMessage, setSimulationMessage] = useState<string | null>(null);
  const [selectedResourceTypes, setSelectedResourceTypes] = useState<Record<string, ContentType>>({});
  // Phase 31 Follow-Up Assessment & Before/After Comparison State
  const [followUpComparisons, setFollowUpComparisons] = useState<Record<string, TeacherActionFollowUpComparison>>({});
  const [followUpBusyActionId, setFollowUpBusyActionId] = useState<string | null>(null);
  const [followUpMessageByAction, setFollowUpMessageByAction] = useState<Record<string, string>>({});

  const schoolId = currentUser?.schoolName || 'lwps';
  const teacherId = currentUser?.id || 't_lwps_1';
  const ecgArtifactId = content.id || content.metadata?.parentArtifactId || 'assessment_active';
  const metadata = (content.metadata || {}) as any;
  const initialClassGroupId = metadata.classGroupId || undefined;
  const isDemoSimulationAllowed =
    (import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_SIMULATION === 'true') &&
    TeacherActionService.isDemoSimulationAllowed();

  const loadInterpretation = () => {
    setIsLoading(true);
    try {
      const interp = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
        ecgArtifactId,
        schoolId,
        requestingTeacherId: teacherId,
        classGroupId: selectedClassGroupId || initialClassGroupId,
      });
      setInterpretation(interp);
      
      // Load Actions
      const plans = TeacherActionService.getActionPlans(schoolId, {
        ecgArtifactId,
        classGroupId: selectedClassGroupId || initialClassGroupId
      });
      setActionPlans(plans);
      
      // Generate Suggestions
      const sugs = TeacherActionService.generateSuggestions(interp);
      setSuggestions(sugs);
    } catch (err: any) {
      console.warn('Could not load assessment interpretation:', err?.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInterpretation();
  }, [ecgArtifactId, schoolId, teacherId, selectedClassGroupId, initialClassGroupId]);

  const handleConfirmReview = () => {
    try {
      const updated = LearningOutcomeInterpretationService.confirmAssessmentReview({
        ecgArtifactId,
        schoolId,
        teacherId,
        classGroupId: selectedClassGroupId || initialClassGroupId,
      });
      setInterpretation(updated);
      
      // Switch to actions tab automatically after review
      setActiveTab('actions');
    } catch (err: any) {
      console.error('Failed to confirm review:', err?.message);
    }
  };

  const handleCreateAction = (suggestion?: SuggestedTeacherAction) => {
    if (suggestion) {
      setNewActionType(suggestion.actionType);
      setNewActionScope(suggestion.scope);
      setNewActionFocus(suggestion.focusArea);
      setSelectedLearners(suggestion.targetLearnerIds || []);
      setSelectedSuggestionId(suggestion.id);
    } else {
      setNewActionType('GUIDED_PRACTICE');
      setNewActionScope('WHOLE_CLASS');
      setNewActionFocus(interpretation?.learningOutcomeId || '');
      setSelectedLearners([]);
      setSelectedSuggestionId(null);
    }
    setNewActionNotes('');
    setIsCreatingAction(true);
  };

  const handleSaveAction = () => {
    if (!newActionFocus.trim()) return;
    
    try {
      const plan = TeacherActionService.createActionPlan({
        schoolId,
        teacherId,
        ecgArtifactId,
        actionType: newActionType,
        scope: newActionScope,
        focusArea: newActionFocus,
        teacherNotes: newActionNotes,
        classGroupId: selectedClassGroupId || initialClassGroupId,
        selectedLearnerIds: newActionScope === 'SELECTED_LEARNERS' ? selectedLearners : undefined,
        learnerId: newActionScope === 'INDIVIDUAL_LEARNER' ? selectedLearners[0] : undefined,
        sourceInterpretationId: interpretation?.interpretationId,
        masterSowId: metadata.masterSowId,
        parentArtifactId: metadata.parentArtifactId,
        curriculumLessonId: metadata.curriculumLessonId,
        scheduledLessonId: metadata.scheduledLessonId,
        curriculumContext: {
          grade: metadata.grade,
          subject: metadata.subject,
          term: metadata.term,
          week: metadata.week || metadata.sowLessonContext?.week,
          lesson: metadata.lessonNumber || metadata.sowLessonContext?.lesson,
          strand: metadata.strand || metadata.sowLessonContext?.strand,
          subStrand: metadata.subStrand || metadata.sowLessonContext?.subStrand,
          learningOutcomeId: interpretation?.learningOutcomeId,
          learningOutcomes: metadata.sowLessonContext?.learningOutcomes || interpretation?.learningOutcomeStatement,
        }
      });
      
      setActionPlans([plan, ...actionPlans]);
      setIsCreatingAction(false);
      
      // Remove suggestion if used
      if (selectedSuggestionId) {
        setSuggestions(suggestions.filter(s => s.id !== selectedSuggestionId));
      }
    } catch (err: any) {
      alert(`Failed to save action: ${err.message}`);
    }
  };

  const handleUpdateActionStatus = (actionId: string, status: TeacherActionStatus) => {
    try {
      const updated = TeacherActionService.updateActionStatus({
        actionId,
        schoolId,
        teacherId,
        newStatus: status
      });
      setActionPlans(actionPlans.map(p => p.actionId === actionId ? updated : p));
    } catch (err: any) {
      console.error('Failed to update action status:', err.message);
    }
  };

  // Phase 31 Handlers
  const handleQuickCreateFollowUpAssessment = async (plan: TeacherActionPlan) => {
    if (!isDemoSimulationAllowed || !TeacherActionService.isDemoSimulationAllowed()) {
      setFollowUpMessageByAction(prev => ({
        ...prev,
        [plan.actionId]: 'Error: Demo follow-up simulation is disabled in production.',
      }));
      return;
    }
    setFollowUpBusyActionId(plan.actionId);
    setFollowUpMessageByAction(prev => ({ ...prev, [plan.actionId]: '' }));
    try {
      const { updatedAction, followUpLink } = await TeacherActionService.generateFollowUpAssessmentFromAction({
        actionId: plan.actionId,
        schoolId,
        teacherId,
        preferredContentType: ContentType.Quiz,
        generatorFn: async (fs) => ({
          id: `fup_quiz_${plan.actionId}_${Date.now()}`,
          title: `Follow-Up Check: ${plan.focusArea}`,
          questions: [
            {
              questionType: 'Multiple Choice' as any,
              questionText: `Which statement best demonstrates mastery of ${plan.focusArea}?`,
              options: [
                'A) Accurate application of the core concept',
                'B) Partial recall without context',
                'C) Unrelated observation',
                'D) Incomplete assumption',
              ],
              correctOption: 'A',
              correctAnswer: 'A) Accurate application of the core concept',
              marks: 5,
            },
            {
              questionType: 'Short Answer' as any,
              questionText: `Apply ${plan.focusArea} to a practical classroom scenario.`,
              correctAnswer: 'Clear step-by-step explanation aligned with KICD outcomes.',
              marks: 5,
            },
          ],
          metadata: {
            grade: fs.grade,
            subject: fs.subject,
            topic: fs.topic,
            contentType: ContentType.Quiz,
          },
        }),
      });
      setActionPlans(prev => prev.map(p => (p.actionId === plan.actionId ? { ...updatedAction } : p)));
      setFollowUpMessageByAction(prev => ({
        ...prev,
        [plan.actionId]: `Created & linked follow-up assessment "${followUpLink.title}".`,
      }));
    } catch (err: any) {
      setFollowUpMessageByAction(prev => ({
        ...prev,
        [plan.actionId]: `Error: ${err.message}`,
      }));
    } finally {
      setFollowUpBusyActionId(null);
    }
  };

  const handlePublishFollowUpToElms = (plan: TeacherActionPlan, followUpArtifactId: string) => {
    try {
      const { updatedAction } = TeacherActionService.publishFollowUpAssessmentToElms({
        actionId: plan.actionId,
        schoolId,
        teacherId,
        followUpArtifactId,
        classGroupId: plan.classGroupId || selectedClassGroupId || initialClassGroupId,
      });
      setActionPlans(prev => prev.map(p => (p.actionId === plan.actionId ? { ...updatedAction } : p)));
      setFollowUpMessageByAction(prev => ({
        ...prev,
        [plan.actionId]: `Published follow-up assessment (${followUpArtifactId}) to ELMS.`,
      }));
    } catch (err: any) {
      setFollowUpMessageByAction(prev => ({
        ...prev,
        [plan.actionId]: `Error publishing follow-up: ${err.message}`,
      }));
    }
  };

  const handleSimulateFollowUpEvidence = (plan: TeacherActionPlan, followUpArtifactId: string) => {
    if (!isDemoSimulationAllowed || !TeacherActionService.isDemoSimulationAllowed()) {
      setFollowUpMessageByAction(prev => ({
        ...prev,
        [plan.actionId]: 'Error: Demo follow-up evidence simulation is disabled in production.',
      }));
      return;
    }
    try {
      const learners =
        plan.scope === 'INDIVIDUAL_LEARNER' && plan.learnerId
          ? [plan.learnerId]
          : plan.scope === 'SELECTED_LEARNERS' && plan.selectedLearnerIds?.length
          ? plan.selectedLearnerIds
          : (interpretation?.learnerInterpretations || []).map(l => l.learnerId);

      learners.forEach((lrnId, idx) => {
        TeacherActionService.recordFollowUpAssessmentEvidence({
          actionId: plan.actionId,
          schoolId,
          teacherId,
          followUpArtifactId,
          learnerId: lrnId,
          score: idx % 2 === 0 ? 8 : 7,
          maxScore: 10,
          classGroupId: plan.classGroupId || selectedClassGroupId || initialClassGroupId,
          sourceSystem: 'DEMO',
          evidenceOrigin: 'SIMULATED',
          isSimulated: true,
        });
      });

      const comp = TeacherActionService.compareActionBeforeAfterEvidence({
        actionId: plan.actionId,
        schoolId,
        teacherId,
        followUpArtifactId,
        classGroupId: plan.classGroupId || selectedClassGroupId || initialClassGroupId,
      });
      setFollowUpComparisons(prev => ({ ...prev, [plan.actionId]: comp }));
      const refreshedPlan = TeacherActionService.getActionById(plan.actionId, schoolId, teacherId);
      if (refreshedPlan) {
        setActionPlans(prev => prev.map(p => (p.actionId === plan.actionId ? { ...refreshedPlan } : p)));
      }
      setFollowUpMessageByAction(prev => ({
        ...prev,
        [plan.actionId]: `Recorded follow-up evidence for ${learners.length} targeted learner(s) and computed Before/After comparison.`,
      }));
    } catch (err: any) {
      setFollowUpMessageByAction(prev => ({
        ...prev,
        [plan.actionId]: `Error recording follow-up evidence: ${err.message}`,
      }));
    }
  };

  const handleCompareBeforeAfter = (plan: TeacherActionPlan, followUpArtifactId?: string) => {
    try {
      const comp = TeacherActionService.compareActionBeforeAfterEvidence({
        actionId: plan.actionId,
        schoolId,
        teacherId,
        followUpArtifactId,
        classGroupId: plan.classGroupId || selectedClassGroupId || initialClassGroupId,
      });
      setFollowUpComparisons(prev => ({ ...prev, [plan.actionId]: comp }));
    } catch (err: any) {
      setFollowUpMessageByAction(prev => ({
        ...prev,
        [plan.actionId]: `Comparison error: ${err.message}`,
      }));
    }
  };

  const handleConfirmFollowUpReview = (plan: TeacherActionPlan, completeAction: boolean) => {
    try {
      const { comparison, updatedAction } = TeacherActionService.confirmFollowUpReview({
        actionId: plan.actionId,
        schoolId,
        teacherId,
        completeAction,
        classGroupId: plan.classGroupId || selectedClassGroupId || initialClassGroupId,
      });
      setFollowUpComparisons(prev => ({ ...prev, [plan.actionId]: comparison }));
      setActionPlans(prev => prev.map(p => (p.actionId === plan.actionId ? { ...updatedAction } : p)));
      setFollowUpMessageByAction(prev => ({
        ...prev,
        [plan.actionId]: completeAction
          ? 'Follow-up review confirmed and Teacher Action Plan marked COMPLETED.'
          : 'Follow-up review confirmed.',
      }));
    } catch (err: any) {
      setFollowUpMessageByAction(prev => ({
        ...prev,
        [plan.actionId]: `Review error: ${err.message}`,
      }));
    }
  };

  const handleSaveOverride = () => {
    if (!overrideModalLearnerId) return;
    if (!overrideReason.trim()) {
      setOverrideError('A professional reason is required for teacher override.');
      return;
    }
    setOverrideError(null);

    try {
      const updated = LearningOutcomeInterpretationService.overrideAssessmentLearnerStatus({
        ecgArtifactId,
        schoolId,
        learnerId: overrideModalLearnerId,
        teacherId,
        newStatus: overrideStatus,
        reason: overrideReason.trim(),
        classGroupId: selectedClassGroupId || initialClassGroupId,
      });
      setInterpretation(updated);
      setOverrideModalLearnerId(null);
      setOverrideReason('');
    } catch (err: any) {
      setOverrideError(err?.message || 'Failed to record override.');
    }
  };

  const handleSimulateSubmissions = () => {
    if (!isDemoSimulationAllowed || !TeacherActionService.isDemoSimulationAllowed()) {
      setSimulationMessage('Simulation error: Demo ELMS submission simulation is disabled in production.');
      return;
    }
    setIsSimulating(true);
    setSimulationMessage(null);
    try {
      // Find or seed learners in school
      let learners = LearnerRosterService.getLearnersBySchool(schoolId);
      if (learners.length === 0) {
        const classes = ClassGroupService.getClassGroupsBySchool(schoolId);
        const classGroupId = classes[0]?.id || 'cg_lwps_g8a';
        LearnerRosterService.addLearner({
          id: `lrn_${schoolId}_01`,
          schoolId,
          displayName: 'Amina Otieno',
          learnerIdentifier: 'ADM-101',
          classGroupId,
          academicYearId: 'ay_2026',
          requestingUserId: '1',
        });
        LearnerRosterService.addLearner({
          id: `lrn_${schoolId}_02`,
          schoolId,
          displayName: 'Brian Mwangi',
          learnerIdentifier: 'ADM-102',
          classGroupId,
          academicYearId: 'ay_2026',
          requestingUserId: '1',
        });
        LearnerRosterService.addLearner({
          id: `lrn_${schoolId}_03`,
          schoolId,
          displayName: 'Chepkoech Korir',
          learnerIdentifier: 'ADM-103',
          classGroupId,
          academicYearId: 'ay_2026',
          requestingUserId: '1',
        });
        learners = LearnerRosterService.getLearnersBySchool(schoolId);
      }

      // Map learners to ELMS if not mapped
      for (const lrn of learners.slice(0, 3)) {
        try {
          ElmsIntegrationService.mapLearner({
            schoolId,
            ecgLearnerId: lrn.id,
            elmsLearnerId: `elms_u_${lrn.id}`,
            requestingUserId: teacherId,
          });
        } catch {
          // Ignore if already mapped
        }
      }

      // Ingest submissions for 3 learners with realistic answers
      const questions = content.questions || [];
      const q1Id = questions[0]?.id || 'item_1';
      const q1Ans = questions[0]?.correctOption || questions[0]?.correctAnswer || 'A';
      const q2Id = questions[1]?.id || 'item_2';
      const q2Ans = questions[1]?.correctOption || questions[1]?.correctAnswer || 'B';

      // Learner 1: 100% correct
      ElmsIntegrationService.ingestLearningEvent({
        eventId: `evt_sim_${Date.now()}_1`,
        sourceSystem: 'DEMO',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId,
        learnerId: `elms_u_${learners[0]?.id || '1'}`,
        resourceId: ecgArtifactId,
        ecgArtifactId,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: `idemp_sim_${Date.now()}_1`,
        payload: {
          assessmentId: ecgArtifactId,
          attemptId: `att_sim_${Date.now()}_1`,
          learnerId: `elms_u_${learners[0]?.id || '1'}`,
          isSimulated: true,
          evidenceOrigin: 'SIMULATED',
          responses: [
            { itemId: q1Id, response: q1Ans },
            { itemId: q2Id, response: q2Ans },
          ],
        },
      });

      // Learner 2: 50% correct
      if (learners[1]) {
        ElmsIntegrationService.ingestLearningEvent({
          eventId: `evt_sim_${Date.now()}_2`,
          sourceSystem: 'DEMO',
          eventType: 'ASSESSMENT_SUBMITTED',
          schoolId,
          learnerId: `elms_u_${learners[1].id}`,
          resourceId: ecgArtifactId,
          ecgArtifactId,
          timestamp: new Date().toISOString(),
          eventVersion: '1.0',
          payloadVersion: '1.0',
          idempotencyKey: `idemp_sim_${Date.now()}_2`,
          payload: {
            assessmentId: ecgArtifactId,
            attemptId: `att_sim_${Date.now()}_2`,
            learnerId: `elms_u_${learners[1].id}`,
            isSimulated: true,
            evidenceOrigin: 'SIMULATED',
            responses: [
              { itemId: q1Id, response: q1Ans },
              { itemId: q2Id, response: 'WRONG' },
            ],
          },
        });
      }

      // Learner 3: 0% correct (needs remedial support)
      if (learners[2]) {
        ElmsIntegrationService.ingestLearningEvent({
          eventId: `evt_sim_${Date.now()}_3`,
          sourceSystem: 'DEMO',
          eventType: 'ASSESSMENT_SUBMITTED',
          schoolId,
          learnerId: `elms_u_${learners[2].id}`,
          resourceId: ecgArtifactId,
          ecgArtifactId,
          timestamp: new Date().toISOString(),
          eventVersion: '1.0',
          payloadVersion: '1.0',
          idempotencyKey: `idemp_sim_${Date.now()}_3`,
          payload: {
            assessmentId: ecgArtifactId,
            attemptId: `att_sim_${Date.now()}_3`,
            learnerId: `elms_u_${learners[2].id}`,
            isSimulated: true,
            evidenceOrigin: 'SIMULATED',
            responses: [
              { itemId: q1Id, response: 'WRONG_1' },
              { itemId: q2Id, response: 'WRONG_2' },
            ],
          },
        });
      }

      loadInterpretation();
      setSimulationMessage('Successfully synchronized 3 test learner attempts from ELMS!');
    } catch (err: any) {
      setSimulationMessage(`Simulation error: ${err?.message || 'Could not simulate attempts'}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const factual = interpretation?.factualSummary || {
    totalLearnersAssessed: 0,
    totalLearnersAssigned: 0,
    totalLearnersAwaitingSubmission: 0,
    totalAttempts: 0,
    averageScorePercentage: 0,
    highestScorePercentage: 0,
    lowestScorePercentage: 0,
    itemAnalytics: [],
  };

  const dist = interpretation?.competencyDistribution || {
    strongDemonstrationCount: 0,
    demonstratedCount: 0,
    developingCount: 0,
    emergingCount: 0,
    insufficientEvidenceCount: 0,
  };

  const learnersList = interpretation?.learnerInterpretations || [];
  const insights = interpretation?.teacherSupportInsights;

  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-5 text-white shadow-xl mt-6 space-y-5 animate-fade-in">
      {/* Panel Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-purple-300">Phase 27</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-xs font-bold text-slate-300">Policy: LO-MASTERY-V1</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-xs text-purple-300 font-medium">Equal-Weighted Valid Attempts</span>
          </div>
          <h3 className="text-base font-bold text-white mt-1">
            {content.title || 'Curriculum Assessment Evidence & Competency Analysis'}
          </h3>
          {/* Unboxed Metadata with Typographic Separators */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1.5 font-medium">
            <span>{metadata.grade || 'Grade'}</span>
            <span aria-hidden="true">·</span>
            <span>{metadata.subject || 'Subject'}</span>
            {interpretation?.teacherReviewStatus && (
              <>
                <span aria-hidden="true">·</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                  interpretation.teacherReviewStatus === 'REVIEWED' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800' :
                  interpretation.teacherReviewStatus === 'OVERRIDDEN' ? 'bg-purple-900/40 text-purple-400 border border-purple-800' :
                  'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {interpretation.teacherReviewStatus.replace('_', ' ')}
                </span>
              </>
            )}
            {metadata.term && (
              <>
                <span aria-hidden="true">·</span>
                <span>{metadata.term}</span>
              </>
            )}
            {metadata.week && (
              <>
                <span aria-hidden="true">·</span>
                <span>Week {metadata.week}</span>
              </>
            )}
            {metadata.lessonNumber && (
              <>
                <span aria-hidden="true">·</span>
                <span>Lesson {metadata.lessonNumber}</span>
              </>
            )}
            {metadata.strand && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-slate-300">{metadata.strand}</span>
              </>
            )}
            {metadata.subStrand && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-slate-300">{metadata.subStrand}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {interpretation?.factualSummary?.availableAssignments && interpretation.factualSummary.availableAssignments.length > 1 && (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase">View Class:</span>
              <select
                value={selectedClassGroupId || initialClassGroupId || ''}
                onChange={(e) => setSelectedClassGroupId(e.target.value || undefined)}
                className="bg-slate-800 border border-slate-700 text-xs text-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="">All Assignments</option>
                {interpretation.factualSummary.availableAssignments.map(asgn => (
                  <option key={asgn.classGroupId} value={asgn.classGroupId}>
                    {asgn.classGroupName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {interpretation?.teacherReviewStatus === 'PENDING_REVIEW' && (
            <button
              type="button"
              onClick={handleConfirmReview}
              className="p-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-600 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Confirm Review</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadInterpretation}
            disabled={isLoading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Refresh Evidence"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Specific Learning Outcome Banner */}
      {metadata.specificLearningOutcome && (
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
          <div className="text-[10px] uppercase font-bold tracking-wider text-purple-400 mb-0.5">
            Target Curriculum Outcome
          </div>
          <div className="font-medium text-slate-200">{metadata.specificLearningOutcome}</div>
        </div>
      )}

      {/* Segmented Interactive Navigation Tabs (Zero-Pill styling) */}
      <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-purple-700 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>Factual Evidence & Analytics</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'roster'
              ? 'bg-purple-700 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Learner Mastery Roster ({factual.totalLearnersAssessed})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('pedagogy')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'pedagogy'
              ? 'bg-purple-700 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Insights</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('actions')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'actions'
              ? 'bg-purple-700 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          <span>Teacher Actions ({actionPlans.length})</span>
        </button>
      </div>

      {/* Simulation Feedback Alert */}
      {simulationMessage && (
        <div className="bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-xs p-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{simulationMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSimulationMessage(null)}
            className="text-xs text-emerald-400 hover:underline font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Empty State when zero submissions */}
      {factual.totalLearnersAssessed === 0 && (
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-6 text-center space-y-3">
          <div className="inline-flex p-3 bg-purple-900/30 text-purple-300 rounded-xl border border-purple-800">
            <BookOpen className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-white">Awaiting Learner Attempts from ELMS</h4>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">
            This assessment has been published to ELMS. When learners complete assignments and submit attempts in ELMS, their factual assessment evidence and question responses will automatically stream into this interpretation layer.
          </p>
          {isDemoSimulationAllowed && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSimulateSubmissions}
                disabled={isSimulating}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-2 shadow-sm"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
                <span>{isSimulating ? 'Syncing Sample Attempts...' : 'Simulate Sample ELMS Submissions'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {activeTab === 'overview' && factual.totalLearnersAssessed > 0 && (
        <div className="space-y-4">
          {/* Factual Metrics Summary Bar */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">
              Factual Assessment Evidence Summary
            </div>
            {/* Clean unboxed inline metrics */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 font-semibold pt-1">
              <div>
                <span className="text-slate-500 font-normal">Assessed: </span>
                <span className="text-white font-mono">{factual.totalLearnersAssessed}</span>
              </div>
              {typeof factual.totalLearnersAssigned === 'number' && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <div>
                    <span className="text-slate-500 font-normal">Assigned: </span>
                    <span className="text-white font-mono">{factual.totalLearnersAssigned}</span>
                  </div>
                </>
              )}
              {typeof factual.totalLearnersAwaitingSubmission === 'number' && factual.totalLearnersAwaitingSubmission > 0 && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <div>
                    <span className="text-amber-400 font-normal">Awaiting: </span>
                    <span className="text-amber-300 font-mono">{factual.totalLearnersAwaitingSubmission}</span>
                  </div>
                </>
              )}
              <span aria-hidden="true" className="text-slate-600">·</span>
              <div>
                <span className="text-slate-500 font-normal">Submissions: </span>
                <span className="text-white font-mono">{factual.totalAttempts}</span>
              </div>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <div>
                <span className="text-slate-500 font-normal">Class Average: </span>
                <span className="text-emerald-400 font-mono">{factual.averageScorePercentage}%</span>
              </div>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <div>
                <span className="text-slate-500 font-normal">Highest Score: </span>
                <span className="text-white font-mono">{factual.highestScorePercentage}%</span>
              </div>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <div>
                <span className="text-slate-500 font-normal">Lowest Score: </span>
                <span className="text-white font-mono">{factual.lowestScorePercentage}%</span>
              </div>
            </div>
          </div>

          {/* Competency Mastery Distribution Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                Strong Demonstration
              </div>
              <div className="text-xl font-black text-white font-mono mt-1">
                {dist.strongDemonstrationCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Average ≥{LO_MASTERY_V1_CONFIG.strongMinAvg}% consistently</div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                Demonstrated
              </div>
              <div className="text-xl font-black text-white font-mono mt-1">
                {dist.demonstratedCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Average ≥{LO_MASTERY_V1_CONFIG.demonstratedMinAvg}% satisfactory</div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                Developing
              </div>
              <div className="text-xl font-black text-white font-mono mt-1">
                {dist.developingCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Average ≥{LO_MASTERY_V1_CONFIG.developingMinAvg}% or single score</div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                Emerging
              </div>
              <div className="text-xl font-black text-white font-mono mt-1">
                {dist.emergingCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Average &lt;{LO_MASTERY_V1_CONFIG.developingMinAvg}% requires support</div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Insufficient Evidence
              </div>
              <div className="text-xl font-black text-white font-mono mt-1">
                {dist.insufficientEvidenceCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Awaiting learner submissions</div>
            </div>
          </div>

          {/* Item-by-Item Factual Accuracy Analysis */}
          {factual.itemAnalytics.length > 0 && (
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                  Item-by-Item Factual Performance Analytics
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {factual.itemAnalytics.length} Items Evaluated
                </span>
              </div>

              <div className="space-y-2.5">
                {factual.itemAnalytics.map((item) => (
                  <div
                    key={item.itemId}
                    className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs space-y-1.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="font-bold text-white line-clamp-1">
                        Q{item.sequence}. {item.prompt}
                      </div>
                      <div className="flex items-center gap-2 text-slate-300 font-mono text-[11px] shrink-0">
                        <span>Success: {item.successRatePercentage}%</span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span>Avg Marks: {item.averageScore}/{item.maxMarks}</span>
                      </div>
                    </div>

                    {/* Clean Progress bar */}
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          item.successRatePercentage >= 70
                            ? 'bg-emerald-500'
                            : item.successRatePercentage >= 50
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.max(5, item.successRatePercentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LEARNER MASTERY ROSTER */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          <div className="bg-slate-950/80 rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
              <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                Learner Assessment Evidence Records ({learnersList.length})
              </div>
              <div className="text-xs text-slate-400 font-medium">
                Governed by CBE LO-MASTERY-V1 Policy
              </div>
            </div>

            {learnersList.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No learner assessment records found yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {learnersList.map((learner) => (
                  <div
                    key={learner.learnerId}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-900/60 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-bold text-white">
                        <span>{learner.learnerName || learner.learnerId}</span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="font-mono text-slate-400 text-[11px]">{learner.learnerId}</span>
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        {learner.explanation}
                      </div>
                      {learner.conflictStatus === 'HIGH_CONFLICT' && (
                        <div className="text-[11px] text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                          <AlertCircle className="h-3 w-3" />
                          <span>High Variance Across Multiple Attempts — Teacher Review Advised</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 shrink-0 self-end sm:self-center">
                      <div className="text-right">
                        {typeof learner.percentage === 'number' ? (
                          <>
                            <div className="font-black text-white font-mono text-sm">
                              {learner.percentage}%
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {learner.score}/{learner.maxScore} marks
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="font-bold text-slate-400 font-mono text-xs">
                              No submission
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Awaiting attempt
                            </div>
                          </>
                        )}
                      </div>

                      {/* Clean Text Status */}
                      <div className="text-right min-w-[110px]">
                        <div className="font-bold text-xs uppercase tracking-wide">
                          {learner.status === 'STRONG_DEMONSTRATION' && (
                            <span className="text-emerald-400">Strong Dem.</span>
                          )}
                          {learner.status === 'DEMONSTRATED' && (
                            <span className="text-blue-400">Demonstrated</span>
                          )}
                          {learner.status === 'DEVELOPING' && (
                            <span className="text-amber-400">Developing</span>
                          )}
                          {learner.status === 'EMERGING' && (
                            <span className="text-rose-400">Emerging</span>
                          )}
                          {learner.status === 'INSUFFICIENT_EVIDENCE' && (
                            <span className="text-slate-400">Insufficient</span>
                          )}
                        </div>
                        {learner.teacherOverride && (
                          <div className="text-[10px] text-purple-400 font-bold">
                            Overridden
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setOverrideModalLearnerId(learner.learnerId);
                          setOverrideStatus(learner.status);
                          setOverrideReason(learner.teacherOverride?.reason || '');
                        }}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Override or confirm teacher judgment"
                      >
                        <Edit3 className="h-3.5 w-3.5 text-purple-400" />
                        <span>Override</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: TEACHER SUPPORT & PEDAGOGY */}
      {activeTab === 'pedagogy' && (
        <div className="space-y-4">
          {/* Identified Curriculum Gaps */}
          {insights?.identifiedCurriculumGaps && insights.identifiedCurriculumGaps.length > 0 ? (
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Identified Curriculum Inquiries Requiring Teacher Attention</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300 pt-1">
                {insights.identifiedCurriculumGaps.map((gap, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-xs text-slate-300">
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                Curriculum Item Performance Baseline
              </div>
              <div>No critical item-level deficits identified across evaluated submissions.</div>
            </div>
          )}

          {/* Recommended Teacher Pedagogical Actions */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Recommended Pedagogical Interventions</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-300 pt-1">
              {insights?.recommendedPedagogicalActions.map((action, idx) => (
                <li key={idx} className="flex items-start gap-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-purple-400 font-bold">•</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* TAB 4: TEACHER ACTIONS */}
      {activeTab === 'actions' && (
        <div className="space-y-5">
          {interpretation?.teacherReviewStatus !== 'REVIEWED' && interpretation?.teacherReviewStatus !== 'OVERRIDDEN' ? (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-8 text-center space-y-4">
              <div className="inline-flex p-3 bg-amber-900/20 text-amber-400 rounded-xl border border-amber-800/50">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-white">Review Required Before Action Planning</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                To ensure pedagogical integrity, please confirm your review of the assessment evidence using the "Confirm Review" button at the top before recording planned teacher actions or interventions.
              </p>
              {interpretation?.teacherReviewStatus === 'PENDING_REVIEW' && (
                <button
                  type="button"
                  onClick={handleConfirmReview}
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg inline-flex items-center gap-2"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Confirm Review & Unlock Actions</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Actions Controls */}
              <div className="flex items-center justify-between gap-4">
                <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                  Teacher Intervention & Action Plan
                </div>
                {!isCreatingAction && (
                  <button
                    type="button"
                    onClick={() => handleCreateAction()}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create Custom Action</span>
                  </button>
                )}
              </div>

              {/* Suggestions Section */}
              {suggestions.length > 0 && !isCreatingAction && (
                <div className="space-y-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Evidence-Based Suggested Actions
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {suggestions.map(sug => (
                      <div key={sug.id} className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-3 hover:border-purple-500/50 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 bg-purple-900/30 text-purple-300 border border-purple-800/50 rounded text-[9px] font-black uppercase tracking-tighter">
                                {sug.actionType.replace('_', ' ')}
                              </span>
                              <span className="text-[9px] font-bold text-slate-500 uppercase">
                                Scope: {sug.scope.replace('_', ' ')}
                              </span>
                            </div>
                            <div className="text-xs font-bold text-white line-clamp-1">
                              {sug.focusArea}
                            </div>
                          </div>
                          <Sparkles className="h-4 w-4 text-purple-400 shrink-0" />
                        </div>
                        <p className="text-[11px] text-slate-400 leading-normal italic">
                          "{sug.rationale}"
                        </p>
                        <button
                          type="button"
                          onClick={() => handleCreateAction(sug)}
                          className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Use Suggestion</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Create Action Form */}
              {isCreatingAction && (
                <div className="bg-slate-950/90 border border-purple-500/30 rounded-xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-purple-900/30 rounded-lg">
                        <ClipboardList className="h-4 w-4 text-purple-400" />
                      </div>
                      <h4 className="text-sm font-bold text-white">Plan Teacher Action</h4>
                    </div>
                    <button 
                      onClick={() => setIsCreatingAction(false)}
                      className="text-slate-500 hover:text-white transition-colors"
                    >
                      <XSquare className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase">Action Type</label>
                      <select 
                        value={newActionType}
                        onChange={(e) => setNewActionType(e.target.value as TeacherActionType)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                      >
                        <option value="RETEACH">Reteach Concept</option>
                        <option value="GUIDED_PRACTICE">Guided Practice</option>
                        <option value="DIFFERENTIATED_PRACTICE">Differentiated Practice</option>
                        <option value="SMALL_GROUP_SUPPORT">Small Group Support</option>
                        <option value="INDIVIDUAL_FOLLOW_UP">Individual Follow-up</option>
                        <option value="PEER_SUPPORTED_PRACTICE">Peer-supported Practice</option>
                        <option value="EXTENSION_CHALLENGE">Extension Challenge</option>
                        <option value="FURTHER_ASSESSMENT">Gather Further Evidence</option>
                        <option value="NO_ADDITIONAL_ACTION">No Additional Action</option>
                        <option value="OTHER">Other Action</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase">Scope</label>
                      <select 
                        value={newActionScope}
                        onChange={(e) => {
                          const scope = e.target.value as TeacherActionScope;
                          setNewActionScope(scope);
                          if (scope === 'WHOLE_CLASS') setSelectedLearners([]);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                      >
                        <option value="WHOLE_CLASS">Whole Class</option>
                        <option value="SELECTED_LEARNERS">Selected Learners</option>
                        <option value="INDIVIDUAL_LEARNER">Individual Learner</option>
                      </select>
                    </div>

                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase">Focus Area</label>
                      <input 
                        type="text"
                        value={newActionFocus}
                        onChange={(e) => setNewActionFocus(e.target.value)}
                        placeholder="e.g. Sub-strand 1.2, Specific Inquiry, Question 3..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>

                    {newActionScope !== 'WHOLE_CLASS' && (
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase">
                          {newActionScope === 'INDIVIDUAL_LEARNER' ? 'Select Learner' : `Select Learners (${selectedLearners.length})`}
                        </label>
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 max-h-40 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {(interpretation?.learnerInterpretations || []).map((l: any) => (
                            <label 
                              key={l.learnerId} 
                              className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition-colors ${
                                selectedLearners.includes(l.learnerId) 
                                  ? 'bg-purple-900/20 border-purple-500/50' 
                                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                              }`}
                            >
                              <input 
                                type={newActionScope === 'INDIVIDUAL_LEARNER' ? 'radio' : 'checkbox'}
                                checked={selectedLearners.includes(l.learnerId)}
                                onChange={() => {
                                  if (newActionScope === 'INDIVIDUAL_LEARNER') {
                                    setSelectedLearners([l.learnerId]);
                                  } else {
                                    setSelectedLearners(prev => 
                                      prev.includes(l.learnerId) 
                                        ? prev.filter(id => id !== l.learnerId) 
                                        : [...prev, l.learnerId]
                                    );
                                  }
                                }}
                                className="h-3 w-3 rounded text-purple-600 bg-slate-950 border-slate-700"
                              />
                              <span className="text-[10px] font-medium text-slate-300 truncate">
                                {l.learnerName || l.learnerId}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase">Teacher Notes & Rationale</label>
                      <textarea 
                        value={newActionNotes}
                        onChange={(e) => setNewActionNotes(e.target.value)}
                        rows={3}
                        placeholder="Detail your professional plan for this action..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsCreatingAction(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAction}
                      disabled={!newActionFocus.trim() || (newActionScope !== 'WHOLE_CLASS' && selectedLearners.length === 0)}
                      className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Confirm & Save Action</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Action History List */}
              <div className="space-y-3">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="h-3 w-3" />
                  <span>Recorded Actions History</span>
                </div>
                
                {actionPlans.length === 0 ? (
                  <div className="p-10 border border-dashed border-slate-800 rounded-xl text-center">
                    <p className="text-xs text-slate-500">No actions recorded for this assessment context yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {actionPlans.map(plan => (
                      <div key={plan.actionId} className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors">
                        <div className="p-4 flex flex-col sm:flex-row gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded text-[9px] font-black uppercase">
                                {plan.actionType.replace('_', ' ')}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                plan.status === 'COMPLETED' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-800/50' :
                                plan.status === 'CANCELLED' || plan.status === 'REJECTED' ? 'bg-rose-900/20 text-rose-400 border-rose-800/50' :
                                plan.status === 'IN_PROGRESS' ? 'bg-blue-900/20 text-blue-400 border-blue-800/50' :
                                'bg-purple-900/20 text-purple-400 border-purple-800/50'
                              }`}>
                                {plan.status}
                              </span>
                              <span aria-hidden="true" className="text-slate-700">·</span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {new Date(plan.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            
                            <div className="text-sm font-bold text-white">
                              {plan.focusArea}
                            </div>
                            
                            {plan.teacherNotes && (
                              <p className="text-xs text-slate-400 leading-relaxed italic">
                                "{plan.teacherNotes}"
                              </p>
                            )}
                            
                            <div className="flex flex-wrap items-center gap-3 pt-1">
                              <div className="flex items-center gap-1.5">
                                <Users className="h-3 w-3 text-slate-500" />
                                <span className="text-[10px] text-slate-400">
                                  Scope: <span className="font-bold text-slate-300">{plan.scope.replace('_', ' ')}</span>
                                </span>
                              </div>
                              {plan.selectedLearnerIds && plan.selectedLearnerIds.length > 0 && (
                                <div className="text-[10px] text-slate-500">
                                  {plan.selectedLearnerIds.length} Learner(s)
                                </div>
                              )}
                              {plan.learnerId && (
                                <div className="text-[10px] text-slate-500 font-mono">
                                  ID: {plan.learnerId}
                                </div>
                              )}
                              <div className="text-[10px] text-indigo-400 font-bold bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-800/40">
                                Linked Resources: {(plan.linkedResources || []).length}
                              </div>
                            </div>

                            {/* Linked Supporting Resources List (Phase 30) */}
                            {plan.linkedResources && plan.linkedResources.length > 0 && (
                              <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 space-y-1.5">
                                <div className="text-[10px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                                  <BookOpen className="h-3 w-3 text-indigo-400" />
                                  <span>Linked Supporting Resources ({plan.linkedResources.length})</span>
                                </div>
                                <div className="space-y-1">
                                  {plan.linkedResources.map((res) => (
                                    <div
                                      key={res.artifactId}
                                      className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px]"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="px-1.5 py-0.5 bg-indigo-900/40 text-indigo-300 border border-indigo-700/50 rounded text-[9px] font-bold">
                                          {res.contentType}
                                        </span>
                                        <span className="font-semibold text-slate-200">{res.title}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                        <span>{res.artifactId}</span>
                                        <span>•</span>
                                        <span>{new Date(res.createdAt).toLocaleDateString()}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Phase 30: Teacher-Initiated Supporting Resource Creation */}
                            {plan.status !== 'CANCELLED' && plan.status !== 'REJECTED' && plan.actionType !== 'NO_ACTION_REQUIRED' && (
                              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                                <select
                                  value={
                                    selectedResourceTypes[plan.actionId] ||
                                    TeacherActionService.getDefaultContentTypeForAction(plan.actionType) ||
                                    ContentType.LessonNotes
                                  }
                                  onChange={(e) =>
                                    setSelectedResourceTypes((prev) => ({
                                      ...prev,
                                      [plan.actionId]: e.target.value as ContentType,
                                    }))
                                  }
                                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  aria-label="Supporting Resource Type"
                                >
                                  <option value={ContentType.LessonNotes}>Lesson Notes / Remedial Practice</option>
                                  <option value={ContentType.LessonPlan}>Lesson Plan (Re-teaching / Support)</option>
                                  <option value={ContentType.StudyGuide}>Revision Guide & Summary</option>
                                  <option value={ContentType.Quiz}>Follow-up Quiz / Practice Check</option>
                                  <option value={ContentType.Assessment}>Competency-Based Assessment (CBA)</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const chosenType =
                                      selectedResourceTypes[plan.actionId] ||
                                      TeacherActionService.getDefaultContentTypeForAction(plan.actionType) ||
                                      ContentType.LessonNotes;
                                    if (onInitiateResourceFromAction) {
                                      onInitiateResourceFromAction(plan, chosenType, false);
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-colors"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  <span>Create Supporting Resource</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onInitiateResourceFromAction) {
                                      onInitiateResourceFromAction(plan, ContentType.Quiz, true);
                                    } else if (isDemoSimulationAllowed) {
                                      handleQuickCreateFollowUpAssessment(plan);
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-colors"
                                >
                                  <ClipboardList className="h-3.5 w-3.5" />
                                  <span>Create Follow-Up Assessment</span>
                                </button>
                                {isDemoSimulationAllowed && (
                                  <button
                                    type="button"
                                    disabled={followUpBusyActionId === plan.actionId}
                                    onClick={() => handleQuickCreateFollowUpAssessment(plan)}
                                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-800/50 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                                  >
                                    <Plus className="h-3 w-3" />
                                    <span>Quick Follow-Up Check</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Phase 31: Linked Follow-Up Assessments & Before/After Reassessment */}
                            {followUpMessageByAction[plan.actionId] && (
                              <div className="mt-2 px-3 py-1.5 bg-slate-900/90 border border-slate-700 rounded-lg text-[11px] text-emerald-300 font-medium">
                                {followUpMessageByAction[plan.actionId]}
                              </div>
                            )}

                            {plan.linkedFollowUpAssessments && plan.linkedFollowUpAssessments.length > 0 && (
                              <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-2">
                                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <ClipboardList className="h-3 w-3" />
                                    <span>
                                      Linked Follow-Up Assessments ({plan.linkedFollowUpAssessments.length})
                                    </span>
                                  </div>
                                  {plan.followUpReviewStatus && (
                                    <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[9px] text-slate-300 font-mono">
                                      Review: {plan.followUpReviewStatus}
                                    </span>
                                  )}
                                </div>

                                <div className="space-y-1.5">
                                  {plan.linkedFollowUpAssessments.map((fup) => (
                                    <div
                                      key={fup.followUpId}
                                      className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="px-1.5 py-0.5 bg-emerald-900/30 text-emerald-300 border border-emerald-700/50 rounded text-[9px] font-bold">
                                          {fup.contentType}
                                        </span>
                                        <span className="font-bold text-white">{fup.title}</span>
                                        <span className="text-[10px] text-slate-500 font-mono">
                                          ({fup.followUpArtifactId})
                                        </span>
                                        <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[9px] font-mono">
                                          ELMS: {fup.elmsPublicationStatus}
                                        </span>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {fup.elmsPublicationStatus === 'NOT_PUBLISHED' && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handlePublishFollowUpToElms(plan, fup.followUpArtifactId)
                                            }
                                            className="px-2 py-1 bg-blue-900/40 hover:bg-blue-800/50 text-blue-300 border border-blue-700/50 rounded text-[10px] font-bold"
                                          >
                                            Publish to ELMS
                                          </button>
                                        )}
                                        {isDemoSimulationAllowed && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleSimulateFollowUpEvidence(plan, fup.followUpArtifactId)
                                            }
                                            className="px-2 py-1 bg-purple-900/40 hover:bg-purple-800/50 text-purple-300 border border-purple-700/50 rounded text-[10px] font-bold"
                                          >
                                            Record Demo Follow-Up Evidence
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleCompareBeforeAfter(plan, fup.followUpArtifactId)
                                          }
                                          className="px-2 py-1 bg-emerald-900/40 hover:bg-emerald-800/50 text-emerald-300 border border-emerald-700/50 rounded text-[10px] font-bold flex items-center gap-1"
                                        >
                                          <TrendingUp className="h-3 w-3" />
                                          <span>Compare Before / After</span>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Deterministic Before/After Comparison Card */}
                                {followUpComparisons[plan.actionId] && (() => {
                                  const cmp = followUpComparisons[plan.actionId];
                                  return (
                                    <div className="mt-2 bg-slate-950/90 border border-emerald-800/50 rounded-xl p-3.5 space-y-3">
                                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                                        <div className="flex items-center gap-2">
                                          <TrendingUp className="h-4 w-4 text-emerald-400" />
                                          <span className="text-xs font-black uppercase tracking-wider text-white">
                                            Deterministic Before / After Evidence Comparison
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-mono">
                                          <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded">
                                            Policy: {cmp.policyVersion}
                                          </span>
                                          <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800/60 rounded font-bold">
                                            {cmp.teacherReviewStatus}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Summary Metrics */}
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2">
                                          <div className="text-[9px] text-slate-400 uppercase font-bold">
                                            Before Avg
                                          </div>
                                          <div className="text-sm font-black text-slate-200">
                                            {cmp.cohortSummary.originalAveragePercentage}%
                                          </div>
                                          <div className="text-[9px] text-slate-500">
                                            {cmp.cohortSummary.originalSubmittedCount}/
                                            {cmp.cohortSummary.totalTargetedLearners} submitted
                                          </div>
                                        </div>
                                        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2">
                                          <div className="text-[9px] text-slate-400 uppercase font-bold">
                                            After Avg
                                          </div>
                                          <div className="text-sm font-black text-emerald-400">
                                            {cmp.cohortSummary.followUpAveragePercentage}%
                                          </div>
                                          <div className="text-[9px] text-slate-500">
                                            {cmp.cohortSummary.followUpSubmittedCount}/
                                            {cmp.cohortSummary.totalTargetedLearners} submitted
                                          </div>
                                        </div>
                                        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2">
                                          <div className="text-[9px] text-slate-400 uppercase font-bold">
                                            Score Delta
                                          </div>
                                          <div className="text-sm font-black text-indigo-300">
                                            {cmp.cohortSummary.averageDeltaPercentage >= 0 ? '+' : ''}
                                            {cmp.cohortSummary.averageDeltaPercentage}%
                                          </div>
                                          <div className="text-[9px] text-slate-500">
                                            Improved: {cmp.cohortSummary.improvedCount}
                                          </div>
                                        </div>
                                        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2">
                                          <div className="text-[9px] text-slate-400 uppercase font-bold">
                                            Awaiting Follow-Up
                                          </div>
                                          <div className="text-sm font-black text-amber-400">
                                            {cmp.cohortSummary.awaitingFollowUpCount}
                                          </div>
                                          <div className="text-[9px] text-slate-500">
                                            No fabricated 0%
                                          </div>
                                        </div>
                                      </div>

                                      {/* Learner-by-Learner Table */}
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-[11px]">
                                          <thead>
                                            <tr className="border-b border-slate-800 text-[9px] uppercase text-slate-400">
                                              <th className="py-1.5 pr-2">Learner</th>
                                              <th className="py-1.5 px-2">Original (Before)</th>
                                              <th className="py-1.5 px-2">Follow-Up (After)</th>
                                              <th className="py-1.5 px-2">Delta</th>
                                              <th className="py-1.5 pl-2">Movement</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-800/60">
                                            {cmp.learnerComparisons.map((lc) => (
                                              <tr key={lc.learnerId}>
                                                <td className="py-1.5 pr-2 font-bold text-slate-200">
                                                  {lc.learnerName || lc.learnerId}
                                                </td>
                                                <td className="py-1.5 px-2 text-slate-300 font-mono">
                                                  {lc.originalStatus}{' '}
                                                  {lc.originalPercentage !== undefined
                                                    ? `(${lc.originalPercentage}%)`
                                                    : '(No Submission)'}
                                                </td>
                                                <td className="py-1.5 px-2 text-slate-200 font-mono">
                                                  {lc.followUpStatus}{' '}
                                                  {lc.followUpPercentage !== undefined
                                                    ? `(${lc.followUpPercentage}%)`
                                                    : '(Awaiting)'}
                                                </td>
                                                <td className="py-1.5 px-2 font-mono font-bold text-indigo-300">
                                                  {lc.scoreDeltaPercentage !== undefined
                                                    ? `${lc.scoreDeltaPercentage >= 0 ? '+' : ''}${lc.scoreDeltaPercentage}%`
                                                    : '—'}
                                                </td>
                                                <td className="py-1.5 pl-2">
                                                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 text-[9px] font-bold">
                                                    {lc.movement}
                                                  </span>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>

                                      {/* Teacher Review & Action Completion Controls */}
                                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                                        <span className="text-[10px] text-slate-400 italic">
                                          {cmp.advisoryInsights.nonDiagnosticNotice}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => handleConfirmFollowUpReview(plan, false)}
                                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-[10px] font-bold"
                                          >
                                            Confirm Follow-Up Review
                                          </button>
                                          {plan.status !== 'COMPLETED' && (
                                            <button
                                              type="button"
                                              onClick={() => handleConfirmFollowUpReview(plan, true)}
                                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider"
                                            >
                                              Confirm & Complete Action
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>

                          <div className="flex sm:flex-col gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-4 justify-end">
                            {plan.status === 'PROPOSED' && (
                              <button 
                                onClick={() => handleUpdateActionStatus(plan.actionId, 'ACCEPTED')}
                                className="flex-1 sm:flex-none p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-[10px] font-bold flex items-center justify-center gap-1"
                              >
                                <PlayCircle className="h-3 w-3" />
                                <span>Accept</span>
                              </button>
                            )}
                            {(plan.status === 'PROPOSED' || plan.status === 'ACCEPTED') && (
                              <button 
                                onClick={() => handleUpdateActionStatus(plan.actionId, 'IN_PROGRESS')}
                                className="flex-1 sm:flex-none p-1.5 bg-blue-900/40 hover:bg-blue-800/40 text-blue-300 rounded-lg border border-blue-800/50 text-[10px] font-bold flex items-center justify-center gap-1"
                              >
                                <PlayCircle className="h-3 w-3" />
                                <span>Start</span>
                              </button>
                            )}
                            {plan.status === 'IN_PROGRESS' && (
                              <button 
                                onClick={() => handleUpdateActionStatus(plan.actionId, 'COMPLETED')}
                                className="flex-1 sm:flex-none p-1.5 bg-emerald-900/40 hover:bg-emerald-800/40 text-emerald-400 rounded-lg border border-emerald-800/50 text-[10px] font-bold flex items-center justify-center gap-1"
                              >
                                <CheckSquare className="h-3 w-3" />
                                <span>Complete</span>
                              </button>
                            )}
                            {plan.status !== 'COMPLETED' && plan.status !== 'CANCELLED' && (
                              <button 
                                onClick={() => handleUpdateActionStatus(plan.actionId, 'CANCELLED')}
                                className="flex-1 sm:flex-none p-1.5 bg-slate-900 hover:bg-rose-900/20 text-slate-500 hover:text-rose-400 rounded-lg border border-slate-800 hover:border-rose-800/50 text-[10px] font-bold flex items-center justify-center gap-1"
                              >
                                <XSquare className="h-3 w-3" />
                                <span>Cancel</span>
                              </button>
                            )}
                          </div>
                        </div>
                        {plan.status === 'COMPLETED' && (
                          <div className="bg-emerald-950/20 px-4 py-2 border-t border-emerald-900/20 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-[9px] text-emerald-500/70 font-bold uppercase">
                              <CheckCircle className="h-3 w-3" />
                              <span>Action Successfully Completed</span>
                            </div>
                            {plan.completedAt && (
                              <span className="text-[9px] text-slate-600 font-mono">
                                {new Date(plan.completedAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
      <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-start gap-2.5">
        <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-300">Non-Diagnostic Safeguard: </span>
          <span>
            {insights?.nonDiagnosticNotice ||
              'Advisory pedagogical guidance based strictly on objective curriculum assessment evidence. The system does not make clinical, cognitive, or diagnostic determinations.'}
          </span>
        </div>
      </div>

      {/* Teacher Override Modal Dialog */}
      {overrideModalLearnerId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-purple-400" />
                <span>Teacher Professional Override</span>
              </div>
              <button
                type="button"
                onClick={() => setOverrideModalLearnerId(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Apply professional judgment to adjust the demonstrated competency status for learner{' '}
              <strong className="text-white">{overrideModalLearnerId}</strong>. Factual raw scores remain immutable.
            </p>

            {overrideError && (
              <div className="p-2.5 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl">
                {overrideError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                New Competency Status
              </label>
              <select
                value={overrideStatus}
                onChange={(e) => setOverrideStatus(e.target.value as InterpretationStatus)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-bold"
              >
                <option value="STRONG_DEMONSTRATION">Strong Demonstration</option>
                <option value="DEMONSTRATED">Demonstrated</option>
                <option value="DEVELOPING">Developing</option>
                <option value="EMERGING">Emerging</option>
                <option value="INSUFFICIENT_EVIDENCE">Insufficient Evidence</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Professional Rationale (Mandatory for Audit Trail)
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="State specific pedagogical observations or classroom performance evidence justifying this adjustment..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder-slate-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setOverrideModalLearnerId(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveOverride}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-wider"
              >
                Save Teacher Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
