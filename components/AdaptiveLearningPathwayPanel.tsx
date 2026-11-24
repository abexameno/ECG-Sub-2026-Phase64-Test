import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  Shield,
  BookOpen,
  User,
  Plus,
  Play,
  Check,
  X,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { AdaptiveLearningPathway, LearnerLearningState } from '../types/adaptive.ts';
import { AdaptiveLearningPathwayService } from '../services/adaptiveLearningPathwayService.ts';
import { LearnerRosterService } from '../services/learnerRosterService.ts';
import { CanonicalCurriculumService } from '../services/canonicalCurriculumService.ts';
import { LearningOutcome } from '../types.ts';

interface AdaptiveLearningPathwayPanelProps {
  currentUserId: string;
  schoolId: string;
  classGroupId: string;
  className: string;
}

export const AdaptiveLearningPathwayPanel: React.FC<AdaptiveLearningPathwayPanelProps> = ({
  currentUserId,
  schoolId,
  classGroupId,
  className,
}) => {
  const [learners, setLearners] = useState<any[]>([]);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string>('');
  const [outcomes, setOutcomes] = useState<LearningOutcome[]>([]);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>('');

  const [learningState, setLearningState] = useState<LearnerLearningState | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [pathways, setPathways] = useState<AdaptiveLearningPathway[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadRosterAndOutcomes();
  }, [classGroupId, schoolId]);

  useEffect(() => {
    if (selectedLearnerId && selectedOutcomeId) {
      loadLearnerAnalysis();
    }
  }, [selectedLearnerId, selectedOutcomeId]);

  const loadRosterAndOutcomes = () => {
    const roster = LearnerRosterService.getLearnersForClassGroup(classGroupId, schoolId);
    setLearners(roster);
    if (roster.length > 0 && !selectedLearnerId) {
      setSelectedLearnerId(roster[0].id);
    }

    const allOutcomes = CanonicalCurriculumService.getLearningOutcomes('substrand-whole-numbers');
    setOutcomes(allOutcomes);
    if (allOutcomes.length > 0 && !selectedOutcomeId) {
      setSelectedOutcomeId(allOutcomes[0].id);
    }
  };

  const loadLearnerAnalysis = () => {
    try {
      setLoading(true);
      setError(null);
      const state = AdaptiveLearningPathwayService.deriveLearningState({
        schoolId,
        teacherId: currentUserId,
        learnerId: selectedLearnerId,
        classGroupId,
        learningOutcomeId: selectedOutcomeId,
      });
      setLearningState(state);

      const recs = AdaptiveLearningPathwayService.generateRecommendations({
        schoolId,
        teacherId: currentUserId,
        learnerId: selectedLearnerId,
        classGroupId,
        learningOutcomeId: selectedOutcomeId,
      });
      setRecommendations(recs);
    } catch (err: any) {
      setError(err.message || 'Failed to load learning state.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePathway = (optionType: any, objective: string) => {
    try {
      setError(null);
      const pathway = AdaptiveLearningPathwayService.createPathway({
        schoolId,
        teacherId: currentUserId,
        learnerId: selectedLearnerId,
        classGroupId,
        targetLearningOutcomeIds: [selectedOutcomeId],
        recommendedOptionType: optionType,
        objective,
        idempotencyKey: `path_${selectedLearnerId}_${selectedOutcomeId}_${Date.now()}`,
      });
      setPathways((prev) => [pathway, ...prev.filter((p) => p.id !== pathway.id)]);
      setSuccessMessage('Adaptive pathway proposed successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to create pathway.');
    }
  };

  const handleUpdateDecision = (pathwayId: string, decision: 'ACCEPT' | 'REJECT' | 'POSTPONE') => {
    try {
      setError(null);
      const updated = AdaptiveLearningPathwayService.updateTeacherDecision({
        schoolId,
        teacherId: currentUserId,
        pathwayId,
        decision,
      });
      setPathways((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSuccessMessage(`Pathway ${decision.toLowerCase()}ed successfully.`);
    } catch (err: any) {
      setError(err.message || 'Failed to update decision.');
    }
  };

  const handleDeliverStep = (pathwayId: string, stepId: string) => {
    try {
      setError(null);
      const updated = AdaptiveLearningPathwayService.deliverPathwayStep({
        schoolId,
        teacherId: currentUserId,
        pathwayId,
        stepId,
      });
      setPathways((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSuccessMessage('Pathway step delivered as TeachingActivity.');
    } catch (err: any) {
      setError(err.message || 'Failed to deliver step.');
    }
  };

  const handleCompleteStep = (pathwayId: string, stepId: string) => {
    try {
      setError(null);
      const updated = AdaptiveLearningPathwayService.completePathwayStep({
        schoolId,
        teacherId: currentUserId,
        pathwayId,
        stepId,
      });
      setPathways((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSuccessMessage('Pathway step completed.');
    } catch (err: any) {
      setError(err.message || 'Failed to complete step.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-600" />
            Adaptive Learning Pathways & Personalized Sequences
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Evidence-informed next-learning recommendations for {className}. Curriculum authority remains unchanged.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Learner</label>
            <select
              value={selectedLearnerId}
              onChange={(e) => setSelectedLearnerId(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {learners.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.displayName} ({l.learnerIdentifier || 'No ID'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Learning Outcome</label>
            <select
              value={selectedOutcomeId}
              onChange={(e) => setSelectedOutcomeId(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-xs truncate"
            >
              {outcomes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.code}: {o.statement.substring(0, 45)}...
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700 font-bold">
            &times;
          </button>
        </div>
      )}

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Derived Learning State */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            Derived Learning State
          </h3>

          {learningState ? (
            <div className="space-y-3">
              <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Current State</span>
                <p className="text-lg font-extrabold text-indigo-950 mt-0.5">{learningState.state.replace(/_/g, ' ')}</p>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-500">Phase 14 Interpretation</span>
                <p className="text-sm font-bold text-slate-800">{learningState.interpretationStatus}</p>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-500">Evidence Summary</span>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{learningState.evidenceSummary}</p>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-500">Support History</span>
                <p className="text-xs text-slate-600 mt-0.5">{learningState.supportHistorySummary}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select a learner and outcome to view state analysis.</p>
          )}
        </div>

        {/* Recommended Next Options */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 lg:col-span-2">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-600" />
            Next Learning Recommendations (Teacher-Controlled)
          </h3>

          {recommendations.length > 0 ? (
            <div className="space-y-4">
              {recommendations.map((rec) => (
                <div key={rec.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="inline-block px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-bold uppercase tracking-wide">
                        {rec.optionType.replace(/_/g, ' ')}
                      </span>
                      <span className="ml-2 text-xs font-semibold text-slate-500">
                        Evidence Basis: <span className="text-slate-800 font-bold">{rec.evidenceBasis}</span>
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">{new Date(rec.createdAt).toLocaleTimeString()}</span>
                  </div>

                  <p className="text-sm text-slate-800 font-medium">{rec.reason}</p>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      onClick={() => handleCreatePathway(rec.optionType, rec.reason)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Propose Pathway
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No active recommendations generated.</p>
          )}
        </div>
      </div>

      {/* Active & Proposed Pathways */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          Personalized Learning Pathways
        </h3>

        {pathways.length > 0 ? (
          <div className="space-y-4">
            {pathways.map((path) => (
              <div key={path.id} className="p-5 border border-slate-200 rounded-xl space-y-4 bg-slate-50/50">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-500">{path.id}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                          path.status === 'ACCEPTED' || path.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800'
                            : path.status === 'PROPOSED'
                            ? 'bg-amber-100 text-amber-800'
                            : path.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {path.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">Target Learner ID: {path.learnerId}</p>
                  </div>

                  {path.status === 'PROPOSED' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateDecision(path.id, 'ACCEPT')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Accept
                      </button>
                      <button
                        onClick={() => handleUpdateDecision(path.id, 'POSTPONE')}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                      >
                        <Clock className="w-3.5 h-3.5" /> Postpone
                      </button>
                      <button
                        onClick={() => handleUpdateDecision(path.id, 'REJECT')}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </div>

                {/* Steps */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pathway Steps</span>
                  {path.steps.map((step) => (
                    <div key={step.id} className="p-3 bg-white border border-slate-200 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center text-xs font-bold">
                            {step.sequence}
                          </span>
                          <span className="text-sm font-bold text-slate-800">{step.stepType.replace(/_/g, ' ')}</span>
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-medium">
                            Status: {step.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 pl-8">{step.objective}</p>
                      </div>

                      <div className="flex items-center gap-2 pl-8 md:pl-0">
                        {step.status === 'READY' && (
                          <button
                            onClick={() => handleDeliverStep(path.id, step.id)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                          >
                            <Play className="w-3.5 h-3.5" /> Deliver Activity
                          </button>
                        )}
                        {step.status === 'DELIVERED' && (
                          <button
                            onClick={() => handleCompleteStep(path.id, step.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Mark Completed
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No pathways created yet. Propose a pathway from recommendations above.</p>
        )}
      </div>
    </div>
  );
};
