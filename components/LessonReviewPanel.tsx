import React, { useState } from 'react';
import { User } from '../types.ts';
import { TeachingReflectionService } from '../services/teachingReflectionService.ts';
import { PacingObservation, LearnerResponseObservation, ResourceEffectiveness, DeliveryStatus, LessonReview, LessonEvidenceSummary } from '../types/teachingReflection.ts';
import { CheckCircle2, Clock, Users, FileText, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';

interface LessonReviewPanelProps {
  currentUser: User | null;
  schoolId: string;
  classGroupId: string;
  teachingPlanId: string;
  teachingAllocationId: string;
  curriculumVersionId: string;
  learningAreaId: string;
  learningOutcomeIds: string[];
  onOpenNextPlanning?: (reviewId: string) => void;
}

export const LessonReviewPanel: React.FC<LessonReviewPanelProps> = ({
  currentUser,
  schoolId,
  classGroupId,
  teachingPlanId,
  teachingAllocationId,
  curriculumVersionId,
  learningAreaId,
  learningOutcomeIds,
  onOpenNextPlanning,
}) => {
  const teacherId = currentUser?.id || 'teacher_default';
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('DELIVERED');
  const [pacing, setPacing] = useState<PacingObservation>('APPROPRIATE');
  const [learnerResponse, setLearnerResponse] = useState<LearnerResponseObservation>('STRONG');
  const [resourceEffectiveness, setResourceEffectiveness] = useState<ResourceEffectiveness>('EFFECTIVE');
  const [whatWorked, setWhatWorked] = useState('');
  const [whatWasDifficult, setWhatWasDifficult] = useState('');
  const [submittedReview, setSubmittedReview] = useState<LessonReview | null>(null);
  const [evidenceSummary, setEvidenceSummary] = useState<LessonEvidenceSummary | null>(null);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const review = TeachingReflectionService.createLessonReview({
        schoolId,
        teacherId,
        classGroupId,
        teachingPlanId,
        teachingAllocationId,
        curriculumVersionId,
        learningAreaId,
        learningOutcomeIds,
        lessonDate: new Date().toISOString().split('T')[0],
        deliveryStatus,
      });

      TeachingReflectionService.recordReflection({
        schoolId,
        teacherId,
        lessonReviewId: review.id,
        pacing,
        learnerResponse,
        resourceEffectiveness,
        whatWorked,
        whatWasDifficult,
      });

      const summary = TeachingReflectionService.getLessonEvidenceSummary(review.id, schoolId);
      const insights = TeachingReflectionService.getAIInsights(review.id, schoolId);

      setSubmittedReview(review);
      setEvidenceSummary(summary);
      setAiInsights(insights);
      setIsSuccess(true);
    } catch (err: any) {
      alert(`Error saving review: ${err.message}`);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Lesson Review & Reflection</h2>
          <p className="text-xs text-slate-500 font-medium">Record observations and review actual classroom evidence from today's session.</p>
        </div>
        <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
          Phase 26 Reflective Loop
        </span>
      </div>

      {isSuccess && submittedReview && evidenceSummary ? (
        <div className="space-y-6 animate-fade-in">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-emerald-900">Lesson Review Saved Successfully</h3>
              <p className="text-xs text-emerald-700">Authoritative lesson record updated. Reflection recorded without mutating teaching plan.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center space-x-2 text-slate-500 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Attendance</span>
              </div>
              <p className="text-xl font-black text-slate-900">
                {evidenceSummary.attendanceCount.present} / {evidenceSummary.attendanceCount.total}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Learners present</p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center space-x-2 text-slate-500 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Participation</span>
              </div>
              <p className="text-xl font-black text-slate-900">{evidenceSummary.participationCount}</p>
              <p className="text-xs text-slate-500 mt-0.5">Active participants</p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center space-x-2 text-slate-500 mb-1">
                <FileText className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Assessments</span>
              </div>
              <p className="text-xl font-black text-slate-900">{evidenceSummary.assessmentEvidenceCount}</p>
              <p className="text-xs text-slate-500 mt-0.5">Responses recorded</p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center space-x-2 text-slate-500 mb-1">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold uppercase tracking-wider">Mastery Status</span>
              </div>
              <p className="text-xl font-black text-slate-900">
                {evidenceSummary.interpretationBreakdown.mastered} <span className="text-xs font-normal text-slate-500">Mastered</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{evidenceSummary.interpretationBreakdown.developing} Developing</p>
            </div>
          </div>

          {aiInsights && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-start space-x-3">
              <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900">AI Assistant Reflection Summary</h4>
                <p className="text-xs text-purple-800 mt-1 leading-relaxed">{aiInsights}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsSuccess(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Edit Reflection
            </button>
            {onOpenNextPlanning && (
              <button
                type="button"
                onClick={() => onOpenNextPlanning(submittedReview.id)}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl flex items-center space-x-2 shadow-sm transition-all"
              >
                <span>Proceed to Next-Lesson Planning</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmitReview} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Delivery Status</label>
              <select
                value={deliveryStatus}
                onChange={(e) => setDeliveryStatus(e.target.value as DeliveryStatus)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-slate-400"
              >
                <option value="DELIVERED">Delivered Successfully</option>
                <option value="PARTIALLY_DELIVERED">Partially Delivered</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="RESCHEDULED">Rescheduled</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Lesson Pacing</label>
              <select
                value={pacing}
                onChange={(e) => setPacing(e.target.value as PacingObservation)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-slate-400"
              >
                <option value="APPROPRIATE">Appropriate Pacing</option>
                <option value="TOO_FAST">Too Fast</option>
                <option value="TOO_SLOW">Too Slow</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Learner Response</label>
              <select
                value={learnerResponse}
                onChange={(e) => setLearnerResponse(e.target.value as LearnerResponseObservation)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-slate-400"
              >
                <option value="STRONG">Strong Engagement & Understanding</option>
                <option value="MIXED">Mixed Response / Varied Understanding</option>
                <option value="LIMITED">Limited Response / Struggling</option>
                <option value="UNCLEAR">Unclear / Needs Verification</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Resource Effectiveness</label>
              <select
                value={resourceEffectiveness}
                onChange={(e) => setResourceEffectiveness(e.target.value as ResourceEffectiveness)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-slate-400"
              >
                <option value="EFFECTIVE">Effective</option>
                <option value="PARTIALLY_EFFECTIVE">Partially Effective</option>
                <option value="NEEDS_CHANGE">Needs Revision / Replacement</option>
                <option value="NOT_REVIEWED">Not Reviewed</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">What Worked Well? (Optional)</label>
              <textarea
                value={whatWorked}
                onChange={(e) => setWhatWorked(e.target.value)}
                rows={2}
                placeholder="e.g. Group discussion actively engaged learners and clarified core concepts."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">What Was Difficult? (Optional)</label>
              <textarea
                value={whatWasDifficult}
                onChange={(e) => setWhatWasDifficult(e.target.value)}
                rows={2}
                placeholder="e.g. Learners struggled with independent problem solving without guided prompts."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-slate-400"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition-all flex items-center space-x-2"
            >
              <span>Save Lesson Review & View Evidence</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
