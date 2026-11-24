import React, { useState, useEffect } from 'react';
import { User } from '../types.ts';
import { ClassLearningProgressService } from '../services/classLearningProgressService.ts';
import { ClassLearningProgress } from '../types/classLearningProgress.ts';
import { BarChart3, CheckCircle2, AlertTriangle, BookOpen, Clock, RefreshCw } from 'lucide-react';

interface ClassLearningProgressPanelProps {
  currentUser: User | null;
  schoolId: string;
  classGroupId: string;
  learningAreaId: string;
  teachingPlanId?: string;
}

export const ClassLearningProgressPanel: React.FC<ClassLearningProgressPanelProps> = ({
  currentUser,
  schoolId,
  classGroupId,
  learningAreaId,
  teachingPlanId,
}) => {
  const teacherId = currentUser?.id || 'teacher_default';
  const [progress, setProgress] = useState<ClassLearningProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadProgress();
  }, [schoolId, classGroupId, learningAreaId, teachingPlanId, teacherId]);

  const loadProgress = () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = ClassLearningProgressService.getClassLearningProgress({
        schoolId,
        teacherId,
        classGroupId,
        learningAreaId,
        teachingPlanId,
      });
      setProgress(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load class learning progress.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center text-slate-500 text-xs font-medium flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
        <span>Loading class learning progress & instructional health...</span>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-4 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-200 flex items-center justify-between">
        <span>{errorMsg}</span>
        <button
          type="button"
          onClick={loadProgress}
          className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg text-red-800 text-xs font-bold"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!progress) {
    return null;
  }

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'ON_TRACK':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'DELIVERY_LAG':
      case 'EVIDENCE_GAP':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'FOLLOW_UP_REQUIRED':
      case 'ATTENTION_REQUIRED':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-indigo-700 tracking-wider mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>Phase 28 • Class Learning Progress & Instructional Health</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Where is my class now?</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getHealthBadge(progress.instructionalHealth)}`}>
            Health: {progress.instructionalHealth}
          </span>
          <button
            type="button"
            onClick={loadProgress}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            title="Refresh progress"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress at a Glance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
          <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Planned Lessons</span>
          <p className="text-2xl font-black text-slate-900">{progress.plannedProgress.totalPlannedLessons}</p>
          <p className="text-xs text-slate-500">{progress.plannedProgress.totalPlannedOutcomes} learning outcomes planned</p>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
          <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Delivered Lessons</span>
          <p className="text-2xl font-black text-slate-900">{progress.deliveredProgress.totalDeliveredLessons}</p>
          <p className="text-xs text-slate-600 font-bold">{progress.deliveredProgress.deliveryPercentage}% delivery rate</p>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
          <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Evidenced Progress</span>
          <p className="text-2xl font-black text-slate-900">{progress.evidencedProgress.totalCompletedWithEvidence}</p>
          <p className="text-xs text-slate-600 font-bold">{progress.evidencedProgress.evidencePercentage}% review/evidence rate</p>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
          <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Coverage Variance</span>
          <p className="text-2xl font-black text-slate-900">{progress.coverageSummary.varianceStatus}</p>
          <p className="text-xs text-slate-500">{progress.coverageSummary.coveragePercentage}% curriculum coverage</p>
        </div>
      </div>

      <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs text-indigo-900 font-medium">
        <strong className="block font-bold mb-1 text-indigo-950">Instructional Health Summary:</strong>
        {progress.healthExplanation}
      </div>

      {/* Needs Attention */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>Needs Attention ({progress.attentionItems.length})</span>
        </h3>
        {progress.attentionItems.length > 0 ? (
          <div className="space-y-2">
            {progress.attentionItems.map((item) => (
              <div key={item.id} className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl flex items-start justify-between gap-4">
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-900">{item.traceability}</span>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">{item.severity}</span>
                  </div>
                  <p className="text-slate-800 font-medium">{item.reason}</p>
                  <p className="text-indigo-700 font-bold">Suggested Action: {item.suggestedAction}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>No unresolved attention items. Class is operating smoothly.</span>
          </div>
        )}
      </div>

      {/* Learning Outcome Evidence Breakdown */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-slate-600" />
          <span>Learning Outcome Evidence Status ({progress.outcomeSummaries.length})</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {progress.outcomeSummaries.map((outcome, idx) => (
            <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-slate-900">{outcome.learningOutcomeId}</span>
                <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-bold text-[10px]">{outcome.state}</span>
              </div>
              <p className="text-slate-600">Assessment Responses: <strong className="text-slate-900">{outcome.assessmentEvidenceCount}</strong></p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
