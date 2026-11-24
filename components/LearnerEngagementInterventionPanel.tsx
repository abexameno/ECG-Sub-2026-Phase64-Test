import React, { useState, useEffect } from 'react';
import {
  LearnerAttentionSignal,
  LearnerFollowUp,
  FollowUpActionType,
  ClassInterventionSummary,
  AttentionSignalStatus,
} from '../types/intervention.ts';
import { LearnerEngagementInterventionService } from '../services/learnerEngagementInterventionService.ts';
import { LearnerRosterService } from '../services/learnerRosterService.ts';
import { Learner } from '../types/teachingAssignment.ts';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  MessageSquare,
  Calendar,
  ShieldAlert,
  Edit3,
  XCircle,
  RefreshCw,
  UserCheck,
  Check,
} from 'lucide-react';

interface LearnerEngagementInterventionPanelProps {
  currentUserId: string;
  schoolId: string;
  classGroupId: string;
  className: string;
}

export const LearnerEngagementInterventionPanel: React.FC<LearnerEngagementInterventionPanelProps> = ({
  currentUserId,
  schoolId,
  classGroupId,
  className,
}) => {
  const [summary, setSummary] = useState<ClassInterventionSummary | null>(null);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [signals, setSignals] = useState<LearnerAttentionSignal[]>([]);
  const [followUps, setFollowUps] = useState<LearnerFollowUp[]>([]);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'NEEDS_REVIEW' | 'OPEN_SIGNALS' | 'FOLLOW_UPS' | 'COMPLETED'>('NEEDS_REVIEW');
  const [searchTerm, setSearchTerm] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Modal / Form state for Creating Follow-up
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [targetLearnerForFollowUp, setTargetLearnerForFollowUp] = useState<Learner | null>(null);
  const [targetSignalId, setTargetSignalId] = useState<string | undefined>(undefined);
  const [actionType, setActionType] = useState<FollowUpActionType>('CHECK_IN_WITH_LEARNER');
  const [followUpDate, setFollowUpDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState<string>('');

  // Flag Learner Modal State
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagLearnerId, setFlagLearnerId] = useState<string>('');
  const [flagReason, setFlagReason] = useState<string>('');

  const loadData = () => {
    try {
      const roster = LearnerRosterService.getLearnersForClassGroup(classGroupId, schoolId);
      setLearners(roster);

      const classSummary = LearnerEngagementInterventionService.getClassSummary({
        schoolId,
        teacherId: currentUserId,
        classGroupId,
      });
      setSummary(classSummary);

      const sigs = LearnerEngagementInterventionService.getAttentionSignalsForClass({
        schoolId,
        teacherId: currentUserId,
        classGroupId,
      });
      setSignals(sigs);

      const fols = LearnerEngagementInterventionService.getFollowUpsForClass({
        schoolId,
        teacherId: currentUserId,
        classGroupId,
      });
      setFollowUps(fols);
    } catch (err) {
      console.error('Failed to load engagement and intervention data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [schoolId, classGroupId, currentUserId]);

  const handleGenerateSignals = () => {
    setIsGenerating(true);
    try {
      LearnerEngagementInterventionService.generateSignalsForClass({
        schoolId,
        teacherId: currentUserId,
        classGroupId,
      });
      loadData();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenFollowUpModal = (learner: Learner, signalId?: string) => {
    setTargetLearnerForFollowUp(learner);
    setTargetSignalId(signalId);
    setActionType('CHECK_IN_WITH_LEARNER');
    setFollowUpDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setShowFollowUpModal(true);
  };

  const handleSaveFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetLearnerForFollowUp) return;

    LearnerEngagementInterventionService.createFollowUp({
      schoolId,
      teacherId: currentUserId,
      classGroupId,
      learnerId: targetLearnerForFollowUp.id,
      attentionSignalId: targetSignalId,
      actionType,
      followUpDate,
      notes: notes.trim() || undefined,
    });

    setShowFollowUpModal(false);
    loadData();
  };

  const handleCompleteFollowUp = (followUpId: string) => {
    LearnerEngagementInterventionService.completeFollowUp({
      schoolId,
      teacherId: currentUserId,
      followUpId,
    });
    loadData();
  };

  const handleAcknowledgeSignal = (signalId: string) => {
    LearnerEngagementInterventionService.acknowledgeSignal({
      schoolId,
      teacherId: currentUserId,
      signalId,
    });
    loadData();
  };

  const handleDismissSignal = (signalId: string) => {
    const reason = prompt('Reason for dismissing this review signal (optional):') || 'Reviewed by teacher';
    LearnerEngagementInterventionService.dismissSignal({
      schoolId,
      teacherId: currentUserId,
      signalId,
      reason,
    });
    loadData();
  };

  const handleSaveFlagLearner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagLearnerId || !flagReason.trim()) return;

    LearnerEngagementInterventionService.createTeacherFlagSignal({
      schoolId,
      teacherId: currentUserId,
      classGroupId,
      learnerId: flagLearnerId,
      reason: flagReason.trim(),
    });

    setShowFlagModal(false);
    setFlagReason('');
    setFlagLearnerId('');
    loadData();
  };

  // Filtered Learners List
  const filteredLearners = learners.filter((learner) => {
    const matchesSearch =
      learner.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      learner.id.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    const learnerSigs = signals.filter((s) => s.learnerId === learner.id && s.status !== 'DISMISSED');
    const learnerFols = followUps.filter((f) => f.learnerId === learner.id);

    const hasOpenSignals = learnerSigs.some((s) => s.status === 'OPEN' || s.status === 'FOLLOW_UP_REQUIRED');
    const hasOpenFollowUps = learnerFols.some((f) => f.status === 'OPEN' || f.status === 'IN_PROGRESS');
    const hasCompletedFollowUps = learnerFols.some((f) => f.status === 'COMPLETED');

    if (filter === 'NEEDS_REVIEW') return hasOpenSignals || hasOpenFollowUps;
    if (filter === 'OPEN_SIGNALS') return hasOpenSignals;
    if (filter === 'FOLLOW_UPS') return hasOpenFollowUps;
    if (filter === 'COMPLETED') return hasCompletedFollowUps;
    return true;
  });

  const getActionLabel = (type: FollowUpActionType): string => {
    switch (type) {
      case 'CHECK_IN_WITH_LEARNER':
        return 'Check In with Learner';
      case 'REVIEW_LEARNING_ACTIVITY':
        return 'Review Learning Activity';
      case 'PROVIDE_ADDITIONAL_PRACTICE':
        return 'Provide Additional Practice';
      case 'RETEACH_CONCEPT':
        return 'Reteach Concept';
      case 'PAIR_WITH_PEER':
        return 'Pair with Peer';
      case 'MONITOR_NEXT_LESSON':
        return 'Monitor Next Lesson';
      case 'REVIEW_ASSESSMENT':
        return 'Review Assessment Evidence';
      default:
        return 'Other Follow-Up Action';
    }
  };

  return (
    <div className="space-y-6 text-slate-800">
      {/* Overview & Quick Stats Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <span>Learner Engagement & Follow-Up — {className}</span>
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Identify explainable attention signals derived from attendance, activity, and evidence, and record targeted teacher actions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateSignals}
              disabled={isGenerating}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>Scan Signals</span>
            </button>

            <button
              onClick={() => {
                if (learners.length > 0) setFlagLearnerId(learners[0].id);
                setShowFlagModal(true);
              }}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 text-slate-600" />
              <span>Flag Learner</span>
            </button>
          </div>
        </div>

        {/* Metric Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200">
          <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl">
            <div className="text-xs text-amber-800 font-medium">Needs Review</div>
            <div className="text-2xl font-bold text-amber-900 mt-0.5">{summary?.needsReviewCount || 0}</div>
          </div>
          <div className="bg-blue-50/80 border border-blue-200 p-3 rounded-xl">
            <div className="text-xs text-blue-800 font-medium">Open Signals</div>
            <div className="text-2xl font-bold text-blue-900 mt-0.5">{summary?.openSignalsCount || 0}</div>
          </div>
          <div className="bg-indigo-50/80 border border-indigo-200 p-3 rounded-xl">
            <div className="text-xs text-indigo-800 font-medium">Open Follow-Ups</div>
            <div className="text-2xl font-bold text-indigo-900 mt-0.5">{summary?.openFollowUpsCount || 0}</div>
          </div>
          <div className="bg-emerald-50/80 border border-emerald-200 p-3 rounded-xl">
            <div className="text-xs text-emerald-800 font-medium">Completed Follow-Ups</div>
            <div className="text-2xl font-bold text-emerald-900 mt-0.5">{summary?.completedFollowUpsCount || 0}</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(['NEEDS_REVIEW', 'ALL', 'OPEN_SIGNALS', 'FOLLOW_UPS', 'COMPLETED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                filter === tab
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {tab === 'NEEDS_REVIEW' && 'Needs Review'}
              {tab === 'ALL' && `All Roster (${learners.length})`}
              {tab === 'OPEN_SIGNALS' && 'Open Signals'}
              {tab === 'FOLLOW_UPS' && 'Active Follow-Ups'}
              {tab === 'COMPLETED' && 'Completed'}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search learner..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Roster & Signals List */}
      <div className="space-y-3">
        {filteredLearners.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-slate-500 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-slate-700">No learners match the current review filter.</p>
            <p className="text-slate-500 mt-1">
              Click &quot;Scan Signals&quot; above to recalculate deterministic attention rules across attendance and evidence.
            </p>
          </div>
        ) : (
          filteredLearners.map((learner) => {
            const learnerSigs = signals.filter((s) => s.learnerId === learner.id && s.status !== 'DISMISSED');
            const learnerFols = followUps.filter((f) => f.learnerId === learner.id);

            const hasActiveNeeds = learnerSigs.length > 0 || learnerFols.some((f) => f.status === 'OPEN' || f.status === 'IN_PROGRESS');

            return (
              <div
                key={learner.id}
                className={`bg-white border rounded-2xl p-4 transition-all shadow-sm ${
                  hasActiveNeeds ? 'border-amber-200 ring-1 ring-amber-100' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{learner.displayName}</span>
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
                        {learner.id}
                      </span>
                      {hasActiveNeeds && (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                          Needs Review
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenFollowUpModal(learner)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Follow Up</span>
                  </button>
                </div>

                {/* Attention Signals Section */}
                {learnerSigs.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Observed Signals
                    </div>
                    {learnerSigs.map((sig) => (
                      <div
                        key={sig.id}
                        className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                sig.severity === 'ATTENTION'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {sig.signalType.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-slate-700 font-medium">{sig.reason}</span>
                          </div>
                          {sig.sourceReferences.length > 0 && (
                            <div className="text-[10px] text-slate-500">
                              Evidence references: {sig.sourceReferences.join(', ')}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-center">
                          {sig.status === 'OPEN' && (
                            <button
                              onClick={() => handleAcknowledgeSignal(sig.id)}
                              className="text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded-lg"
                            >
                              Acknowledge
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenFollowUpModal(learner, sig.id)}
                            className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200/80 px-2.5 py-1 rounded-lg"
                          >
                            Add Action
                          </button>
                          <button
                            onClick={() => handleDismissSignal(sig.id)}
                            className="text-[11px] text-slate-400 hover:text-slate-600 p-1"
                            title="Dismiss Signal"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Follow-Up Actions Section */}
                {learnerFols.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Teacher Follow-Up Records
                    </div>
                    {learnerFols.map((fol) => (
                      <div
                        key={fol.id}
                        className={`border rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${
                          fol.status === 'COMPLETED'
                            ? 'bg-emerald-50/50 border-emerald-200/60'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                fol.status === 'COMPLETED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {fol.status}
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                              {getActionLabel(fol.actionType)}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 flex items-center gap-2">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              Follow-up: {fol.followUpDate}
                            </span>
                            {fol.notes && (
                              <span className="flex items-center gap-1 italic text-slate-500">
                                <MessageSquare className="w-3 h-3" />
                                &quot;{fol.notes}&quot;
                              </span>
                            )}
                          </div>
                        </div>

                        {fol.status !== 'COMPLETED' && fol.status !== 'CANCELLED' && (
                          <button
                            onClick={() => handleCompleteFollowUp(fol.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 self-end sm:self-center"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Mark Complete</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Create Follow-Up Action */}
      {showFollowUpModal && targetLearnerForFollowUp && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="font-bold text-slate-900 text-base">Record Teacher Follow-Up Action</h4>
              <button
                onClick={() => setShowFollowUpModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Recording a follow-up for <strong className="text-slate-900">{targetLearnerForFollowUp.displayName}</strong>.
            </p>

            <form onSubmit={handleSaveFollowUp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Action Type</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as FollowUpActionType)}
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="CHECK_IN_WITH_LEARNER">Check In with Learner</option>
                  <option value="REVIEW_LEARNING_ACTIVITY">Review Learning Activity</option>
                  <option value="PROVIDE_ADDITIONAL_PRACTICE">Provide Additional Practice</option>
                  <option value="RETEACH_CONCEPT">Reteach Concept</option>
                  <option value="PAIR_WITH_PEER">Pair with Peer</option>
                  <option value="MONITOR_NEXT_LESSON">Monitor Next Lesson</option>
                  <option value="REVIEW_ASSESSMENT">Review Assessment Evidence</option>
                  <option value="OTHER">Other Classroom Support</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Follow-Up Date</label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Teacher Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record concise, observable classroom notes..."
                  rows={3}
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1 italic">
                  Note: Record observable classroom information only. Do not record sensitive medical or psychological data.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowFollowUpModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  Save Follow-Up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Flag Learner */}
      {showFlagModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="font-bold text-slate-900 text-base">Flag Learner for Teacher Attention</h4>
              <button
                onClick={() => setShowFlagModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFlagLearner} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Learner</label>
                <select
                  value={flagLearnerId}
                  onChange={(e) => setFlagLearnerId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-emerald-500"
                >
                  {learners.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.displayName} ({l.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Flag</label>
                <textarea
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  placeholder="Explain why teacher follow-up or review is recommended..."
                  rows={3}
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowFlagModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  Create Flag Signal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
