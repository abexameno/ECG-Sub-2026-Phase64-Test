import React, { useState, useEffect } from 'react';
import { User } from '../types.ts';
import { TeachingContinuityService } from '../services/teachingContinuityService.ts';
import { TeachingReflectionService } from '../services/teachingReflectionService.ts';
import { InstructionalContinuity } from '../types/teachingContinuity.ts';
import { RecommendationType } from '../types/teachingReflection.ts';
import { Network, CheckCircle2, ArrowRight, AlertCircle, RefreshCw, BookOpen, ShieldCheck } from 'lucide-react';

interface TeachingContinuityPanelProps {
  currentUser: User | null;
  schoolId: string;
  classGroupId: string;
  currentTeachingAllocationId: string;
  learningAreaId: string;
}

export const TeachingContinuityPanel: React.FC<TeachingContinuityPanelProps> = ({
  currentUser,
  schoolId,
  classGroupId,
  currentTeachingAllocationId,
  learningAreaId,
}) => {
  const teacherId = currentUser?.id || 'teacher_default';
  const [continuity, setContinuity] = useState<InstructionalContinuity | null>(null);
  const [selectedAction, setSelectedAction] = useState<RecommendationType>('REINFORCE');
  const [teacherNotes, setTeacherNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadContinuity();
  }, [schoolId, classGroupId, currentTeachingAllocationId, learningAreaId, teacherId]);

  const loadContinuity = () => {
    try {
      setErrorMsg(null);
      const data = TeachingContinuityService.getInstructionalContinuity({
        schoolId,
        teacherId,
        classGroupId,
        currentTeachingAllocationId,
        learningAreaId,
      });
      setContinuity(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load instructional continuity.');
    }
  };

  const handleApplyDecision = () => {
    if (!continuity?.previousLesson) return;
    try {
      setErrorMsg(null);
      // Generate or fetch recommendation from previous review
      const recs = TeachingReflectionService.getRecommendations(continuity.previousLesson.reviewId, schoolId);
      const rec = recs.length > 0 ? recs[0] : TeachingReflectionService.generateNextLessonRecommendation(continuity.previousLesson.reviewId, schoolId, teacherId);

      // Handle teacher decision in Phase 26 service
      TeachingReflectionService.handleTeacherDecision(rec.id, schoolId, teacherId, 'MODIFIED', selectedAction, teacherNotes);

      // Create follow through action in Phase 27 continuity service
      TeachingContinuityService.createFollowThroughAction({
        schoolId,
        teacherId,
        classGroupId,
        sourceLessonReviewId: continuity.previousLesson.reviewId,
        recommendationId: rec.id,
        teacherNotes,
      });

      setSuccessMsg('Teacher instructional decision successfully recorded and applied to next session sequence.');
      loadContinuity();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to apply teacher decision.');
    }
  };

  if (!continuity) {
    return (
      <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center text-slate-500 text-xs font-medium">
        Loading instructional continuity state...
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-emerald-700 tracking-wider mb-1">
            <Network className="w-4 h-4" />
            <span>Phase 27 • Instructional Continuity Layer</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Teaching Sequence & Follow-Through</h2>
        </div>
        <span className={`px-3 py-1 text-xs font-bold rounded-full border ${
          continuity.continuityStatus === 'ON_TRACK'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-amber-50 text-amber-800 border-amber-200'
        }`}>
          Status: {continuity.continuityStatus}
        </span>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-200">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Step 1: Previous Lesson */}
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">1. Previous Lesson</span>
            <span className="text-xs font-mono font-bold text-slate-700">
              {continuity.previousLesson ? 'Reviewed' : 'No Prior Review'}
            </span>
          </div>
          {continuity.previousLesson ? (
            <div className="space-y-2 text-xs">
              <p className="font-bold text-slate-900">{continuity.previousLesson.intendedFocus}</p>
              <div className="space-y-1 text-slate-600">
                <p><strong className="text-slate-700">Delivery:</strong> {continuity.previousLesson.deliveryStatus}</p>
                <p><strong className="text-slate-700">Reflection:</strong> {continuity.previousLesson.actualFocus}</p>
                <div className="pt-1 border-t border-slate-200">
                  <strong className="text-slate-700 block mb-0.5">Key Evidence:</strong>
                  {continuity.previousLesson.keyEvidence.map((ev, i) => (
                    <p key={i} className="text-slate-600">• {ev}</p>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No previous lesson review recorded for this sequence yet.</p>
          )}
        </div>

        {/* Step 2: Teacher Decision */}
        <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">2. Teacher Decision</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          {continuity.previousLesson ? (
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Instructional Action</label>
                <select
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value as RecommendationType)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
                >
                  <option value="PROCEED">Proceed to Next Outcome</option>
                  <option value="REINFORCE">Reinforce Core Concepts</option>
                  <option value="RETEACH">Reteach Core Concepts</option>
                  <option value="REASSESS">Reassess / Collect Evidence</option>
                  <option value="EXTEND">Extend / Advanced Challenge</option>
                  <option value="CONTINUE_SUPPORT">Continue Support</option>
                  <option value="REGROUP">Regroup Learners</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Teacher Notes / Reason</label>
                <input
                  type="text"
                  value={teacherNotes}
                  onChange={(e) => setTeacherNotes(e.target.value)}
                  placeholder="Optional teacher notes..."
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="button"
                onClick={handleApplyDecision}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                <span>Save & Apply Decision</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">Complete a lesson review to unlock teacher follow-through decisions.</p>
          )}
        </div>

        {/* Step 3: Next Lesson */}
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">3. Next Lesson</span>
            <BookOpen className="w-4 h-4 text-slate-500" />
          </div>
          <div className="space-y-2 text-xs text-slate-700">
            <p className="font-bold text-slate-900">{continuity.nextLesson?.plannedNextStep}</p>
            {continuity.nextLesson?.teacherApprovedAdjustment && (
              <p><strong className="text-slate-800">Approved Focus:</strong> <span className="text-emerald-700 font-bold">{continuity.nextLesson.teacherApprovedAdjustment}</span></p>
            )}
            <div className="pt-1 border-t border-slate-200">
              <strong className="text-slate-800 block mb-0.5">Required Preparation:</strong>
              {continuity.nextLesson?.requiredPreparation.map((prep, i) => (
                <p key={i} className="text-slate-600">• {prep}</p>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-medium">
        <strong className="text-slate-900 block mb-0.5">Continuity Explanation:</strong>
        {continuity.explanation}
      </div>
    </div>
  );
};
