import React, { useState, useEffect } from 'react';
import { TodayLessonView } from '../types/dailyTeaching.ts';
import { SchoolProfile } from '../types/school.ts';
import { ClassGroup } from '../types/teachingAssignment.ts';
import { LearnerResponseObservation, ResourceEffectiveness } from '../types/teachingReflection.ts';
import { DailyTeachingService } from '../services/dailyTeachingService.ts';
import { TeachingReflectionService } from '../services/teachingReflectionService.ts';
import {
  X,
  Play,
  Pause,
  Clock,
  CheckCircle2,
  FileText,
  Users,
  Sparkles,
  ArrowRight,
  BookOpen,
  Award,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';

interface ClassroomDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  todayLesson: TodayLessonView;
  currentUserId: string;
  activeSchool: SchoolProfile;
  activeClass?: ClassGroup;
  onNavigateToGenerator?: (grade: string, subject: string, extraContext?: any) => void;
  onLessonCompleted?: () => void;
}

export const ClassroomDeliveryModal: React.FC<ClassroomDeliveryModalProps> = ({
  isOpen,
  onClose,
  todayLesson,
  currentUserId,
  activeSchool,
  activeClass,
  onNavigateToGenerator,
  onLessonCompleted,
}) => {
  const [activeStep, setActiveStep] = useState<'TEACHING' | 'REFLECTING' | 'COMPLETED'>(
    todayLesson.status === 'COMPLETED' ? 'COMPLETED' : 'TEACHING'
  );

  // Timer state (45-minute default lesson period)
  const [secondsRemaining, setSecondsRemaining] = useState(45 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Active teaching status
  const [status, setStatus] = useState(todayLesson.status);
  const [activityId, setActivityId] = useState<string | undefined>(todayLesson.activityId);

  // Reflection form state
  const [completionNotes, setCompletionNotes] = useState('Lesson delivered in regular classroom session with full learner engagement.');
  const [pacing, setPacing] = useState<'APPROPRIATE' | 'TOO_FAST' | 'TOO_SLOW'>('APPROPRIATE');
  const [learnerResponse, setLearnerResponse] = useState<LearnerResponseObservation>('STRONG');
  const [resourceEffectiveness, setResourceEffectiveness] = useState<ResourceEffectiveness>('EFFECTIVE');

  // Learner activity recording modal state inside teaching view
  const [showLearnerInput, setShowLearnerInput] = useState(false);
  const [learnerIdInput, setLearnerIdInput] = useState('');
  const [learnerEvidenceInput, setLearnerEvidenceInput] = useState('');
  const [learnerRecordedMessage, setLearnerRecordedMessage] = useState<string | null>(null);

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => prev - 1);
      }, 1000);
    } else if (secondsRemaining === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, secondsRemaining]);

  if (!isOpen) return null;

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartLesson = () => {
    try {
      const act = DailyTeachingService.startLesson(
        currentUserId,
        activeSchool.id,
        todayLesson.teachingPlanId,
        todayLesson.teachingAllocationId,
        todayLesson.learningOutcomeId
      );
      setStatus(act.status);
      setActivityId(act.activityId);
      setIsTimerRunning(true);
    } catch (err: any) {
      alert(`Error starting lesson: ${err.message}`);
    }
  };

  const handleMarkDelivered = () => {
    if (!activityId) {
      handleStartLesson();
    }
    try {
      const targetActId = activityId || `tact_${activeSchool.id}_${todayLesson.teachingPlanId}_${todayLesson.teachingAllocationId}`;
      const delivered = DailyTeachingService.markDelivered(currentUserId, activeSchool.id, targetActId);
      setStatus(delivered.status);
    } catch (err: any) {
      alert(`Error marking delivered: ${err.message}`);
    }
  };

  const handleRecordLearnerActivitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!learnerIdInput.trim()) return;
    try {
      DailyTeachingService.recordLearnerActivity({
        teacherId: currentUserId,
        schoolId: activeSchool.id,
        learnerId: learnerIdInput.trim(),
        teachingPlanId: todayLesson.teachingPlanId,
        teachingAllocationId: todayLesson.teachingAllocationId,
        learningOutcomeId: todayLesson.learningOutcomeId,
        activityType: 'PRACTICE_EXERCISE',
        evidenceReference: learnerEvidenceInput.trim() || 'Classroom practice exercise submission',
      });
      setLearnerRecordedMessage(`Activity recorded for Learner ${learnerIdInput.trim()}!`);
      setLearnerIdInput('');
      setLearnerEvidenceInput('');
      setShowLearnerInput(false);
      setTimeout(() => setLearnerRecordedMessage(null), 4000);
    } catch (err: any) {
      alert(`Error recording learner activity: ${err.message}`);
    }
  };

  const handleCompleteAndReflect = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const targetActId = activityId || `tact_${activeSchool.id}_${todayLesson.teachingPlanId}_${todayLesson.teachingAllocationId}`;
      
      // 1. Ensure lesson is started if not already
      DailyTeachingService.startLesson(
        currentUserId,
        activeSchool.id,
        todayLesson.teachingPlanId,
        todayLesson.teachingAllocationId,
        todayLesson.learningOutcomeId
      );

      // 2. Complete lesson with explicit confirmation evidence
      const completed = DailyTeachingService.completeLesson(
        currentUserId,
        activeSchool.id,
        targetActId,
        completionNotes
      );

      // 3. Record post-lesson reflection
      try {
        const review = TeachingReflectionService.createLessonReview({
          schoolId: activeSchool.id,
          teacherId: currentUserId,
          classGroupId: activeClass?.id || 'class_default',
          teachingPlanId: todayLesson.teachingPlanId,
          teachingAllocationId: todayLesson.teachingAllocationId,
          curriculumVersionId: todayLesson.curriculumVersionId,
          learningAreaId: todayLesson.learningArea,
          learningOutcomeIds: [todayLesson.learningOutcomeId],
          lessonDate: new Date().toISOString().split('T')[0],
          deliveryStatus: 'DELIVERED',
        });

        TeachingReflectionService.recordReflection({
          schoolId: activeSchool.id,
          teacherId: currentUserId,
          lessonReviewId: review.id,
          pacing,
          learnerResponse,
          resourceEffectiveness,
          whatWorked: completionNotes,
        });
      } catch (refErr) {
        console.warn('Reflection record optional step:', refErr);
      }

      setStatus('COMPLETED');
      setActiveStep('COMPLETED');
      setIsTimerRunning(false);
      if (onLessonCompleted) onLessonCompleted();
    } catch (err: any) {
      alert(`Error completing lesson: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 font-sans">
      <div className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Header Bar */}
        <div className="bg-[#3b1464] text-white p-5 sm:p-6 flex items-center justify-between border-b border-purple-900">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-purple-200 mb-1">
              <span>{activeClass?.name || todayLesson.grade}</span>
              <span>•</span>
              <span>{todayLesson.learningArea}</span>
              <span>•</span>
              <span>Week {todayLesson.weekNumber} • Lesson {todayLesson.lessonNumber}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">{todayLesson.topicTitle}</h2>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {learnerRecordedMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{learnerRecordedMessage}</span>
            </div>
          )}

          {/* STEP 1: CLASSROOM TEACHING MODE */}
          {activeStep === 'TEACHING' && (
            <div className="space-y-6">
              {/* SLO Card */}
              <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-purple-900">
                    Specific Learning Outcome (SLO)
                  </span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-purple-100 text-purple-900 rounded-md">
                    KICD Aligned
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                  {todayLesson.learningOutcomeStatement}
                </p>
                <div className="text-xs text-slate-500 font-medium">
                  Strand: <strong className="text-slate-800">{todayLesson.strandTitle}</strong> • Sub-strand:{' '}
                  <strong className="text-slate-800">{todayLesson.subStrandTitle}</strong>
                </div>
              </div>

              {/* Lesson Timer & Status Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#3b1464] text-white flex items-center justify-center font-mono font-black text-lg shadow-sm">
                    {formatTimer(secondsRemaining)}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-600">Lesson Timer</p>
                    <p className="text-xs text-slate-500 font-medium">Standard 45-minute period</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {isTimerRunning ? (
                    <button
                      onClick={() => setIsTimerRunning(false)}
                      className="flex-1 sm:flex-initial px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause Timer</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleStartLesson}
                      className="flex-1 sm:flex-initial px-4 py-2 bg-[#3b1464] hover:bg-[#2e1065] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>{status === 'IN_PROGRESS' ? 'Resume Timer' : 'Start Lesson Timer'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setSecondsRemaining(45 * 60);
                      setIsTimerRunning(false);
                    }}
                    className="p-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-slate-600 text-xs font-bold transition-colors"
                    title="Reset Timer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Materials Available */}
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wider text-slate-700">Prepared Lesson Materials</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {todayLesson.resources.map((res, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-bold ${
                        res.isAvailable
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className={`w-4 h-4 flex-shrink-0 ${res.isAvailable ? 'text-emerald-700' : 'text-slate-400'}`} />
                        <span className="truncate">{res.title}</span>
                      </div>
                      {res.isAvailable ? (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded">
                          Ready
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-slate-200 text-slate-600 rounded">
                          Unprepared
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Learner Recording Drawer Toggle */}
              {showLearnerInput ? (
                <form onSubmit={handleRecordLearnerActivitySubmit} className="p-4 bg-purple-50/80 border border-purple-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-purple-950">Record Learner Practice / Activity</span>
                    <button
                      type="button"
                      onClick={() => setShowLearnerInput(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Learner Name / ID</label>
                      <input
                        type="text"
                        placeholder="e.g. Learner 101 or John Doe"
                        value={learnerIdInput}
                        onChange={(e) => setLearnerIdInput(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-900"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Evidence / Activity Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. Conducted density measurement test"
                        value={learnerEvidenceInput}
                        onChange={(e) => setLearnerEvidenceInput(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-900"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-[#3b1464] hover:bg-[#2e1065] text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
                  >
                    Save Learner Practice Entry
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLearnerInput(true)}
                  className="w-full py-2.5 px-4 bg-white hover:bg-purple-50/50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-800 flex items-center justify-center gap-2 transition-colors"
                >
                  <Users className="w-4 h-4 text-purple-900" />
                  <span>Record Learner Activity / Practice Response</span>
                </button>
              )}

              {/* Evidence Status Summary & Audit Timeline */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                    Lesson Evidence & Verification Status
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    Audit Trail Active
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className={`p-2 rounded-xl border flex items-center gap-1.5 font-bold ${
                    status === 'DELIVERED' || status === 'COMPLETED'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${status === 'DELIVERED' || status === 'COMPLETED' ? 'text-emerald-600' : 'text-slate-300'}`} />
                    <span>Delivered</span>
                  </div>

                  <div className={`p-2 rounded-xl border flex items-center gap-1.5 font-bold ${
                    todayLesson.resources.some(r => r.isAvailable)
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${todayLesson.resources.some(r => r.isAvailable) ? 'text-emerald-600' : 'text-slate-300'}`} />
                    <span>Materials</span>
                  </div>

                  <div className={`p-2 rounded-xl border flex items-center gap-1.5 font-bold ${
                    learnerRecordedMessage || todayLesson.status === 'COMPLETED'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${learnerRecordedMessage || todayLesson.status === 'COMPLETED' ? 'text-emerald-600' : 'text-slate-300'}`} />
                    <span>Practice Activity</span>
                  </div>

                  <div className={`p-2 rounded-xl border flex items-center gap-1.5 font-bold ${
                    status === 'COMPLETED'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${status === 'COMPLETED' ? 'text-emerald-600' : 'text-slate-300'}`} />
                    <span>Confirmed</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleMarkDelivered}
                  className="w-full sm:flex-1 py-3 px-4 bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs rounded-xl border border-slate-300 shadow-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{status === 'DELIVERED' ? 'Delivery Marked ✓' : 'Mark Lesson Delivered'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep('REFLECTING')}
                  className="w-full sm:flex-1 py-3 px-4 bg-[#3b1464] hover:bg-[#2e1065] text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Complete Lesson & Reflect</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: REFLECTION & COMPLETION FORM */}
          {activeStep === 'REFLECTING' && (
            <form onSubmit={handleCompleteAndReflect} className="space-y-5">
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl space-y-1">
                <h3 className="text-sm font-black text-purple-950 uppercase tracking-wider">
                  Lesson Completion & Lightweight Reflection
                </h3>
                <p className="text-xs text-purple-800 font-medium">
                  Record simple observations to confirm completion and guide the next lesson.
                </p>
              </div>

              {/* Completion Notes */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">
                  Completion Notes / Observations
                </label>
                <textarea
                  rows={3}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-300 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-900"
                  placeholder="Record summary of lesson execution, learner participation, or key takeaways..."
                  required
                />
              </div>

              {/* Quick Checkboxes / Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Pacing Observation</label>
                  <select
                    value={pacing}
                    onChange={(e) => setPacing(e.target.value as any)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-900"
                  >
                    <option value="APPROPRIATE">Appropriate Pacing</option>
                    <option value="TOO_FAST">Too Fast</option>
                    <option value="TOO_SLOW">Too Slow</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Learner Response</label>
                  <select
                    value={learnerResponse}
                    onChange={(e) => setLearnerResponse(e.target.value as LearnerResponseObservation)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-900"
                  >
                    <option value="STRONG">Strong Demonstration</option>
                    <option value="MIXED">Mixed Understanding</option>
                    <option value="LIMITED">Limited Response</option>
                    <option value="UNCLEAR">Unclear / Needs Evaluation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Resource Utility</label>
                  <select
                    value={resourceEffectiveness}
                    onChange={(e) => setResourceEffectiveness(e.target.value as ResourceEffectiveness)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-900"
                  >
                    <option value="EFFECTIVE">Effective Materials</option>
                    <option value="PARTIALLY_EFFECTIVE">Partially Effective</option>
                    <option value="NEEDS_CHANGE">Needs Revision / Change</option>
                    <option value="NOT_REVIEWED">Not Reviewed</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setActiveStep('TEACHING')}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors"
                >
                  Back to Teaching Mode
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#3b1464] hover:bg-[#2e1065] text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Completion & Save</span>
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: LESSON COMPLETED & NEXT LESSON TRANSITION */}
          {activeStep === 'COMPLETED' && (
            <div className="space-y-6 text-center py-2 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-300 text-emerald-800 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-2xl font-black text-slate-900">Lesson Successfully Completed!</h3>
                <p className="text-xs text-slate-600 font-medium max-w-md mx-auto mt-1">
                  Authoritative lesson record and completion evidence updated for {todayLesson.topicTitle}.
                </p>
              </div>

              {/* NEXT LESSON CARD */}
              {todayLesson.nextLesson ? (
                <div className="bg-purple-50/80 border border-purple-200 rounded-3xl p-5 text-left space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-900 bg-purple-100 px-2.5 py-1 rounded-md">
                      Next Planned Lesson
                    </span>
                    <span className="text-xs font-bold text-slate-600">
                      Week {todayLesson.nextLesson.weekNumber} • Lesson {todayLesson.nextLesson.lessonNumber}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-lg font-black text-slate-900">{todayLesson.nextLesson.topicTitle}</h4>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">
                      {todayLesson.nextLesson.grade} • {todayLesson.nextLesson.learningArea}
                    </p>
                    <p className="text-xs text-slate-700 font-normal bg-white p-2.5 border border-purple-200 rounded-xl mt-2">
                      <strong className="font-bold text-purple-950">Next Objective: </strong>
                      {todayLesson.nextLesson.learningOutcomeStatement}
                    </p>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                    {onNavigateToGenerator && (
                      <button
                        onClick={() => {
                          onClose();
                          onNavigateToGenerator(
                            todayLesson.nextLesson!.grade,
                            todayLesson.nextLesson!.learningArea,
                            {
                              topic: todayLesson.nextLesson!.topicTitle,
                              slo: todayLesson.nextLesson!.learningOutcomeStatement,
                            }
                          );
                        }}
                        className="w-full sm:flex-1 py-2.5 px-4 bg-[#3b1464] hover:bg-[#2e1065] text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Prepare Next Lesson Materials</span>
                      </button>
                    )}

                    <button
                      onClick={onClose}
                      className="w-full sm:w-auto py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-[#3b1464] text-white font-bold text-xs rounded-xl shadow-sm"
                >
                  Close & Return to Dashboard
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
