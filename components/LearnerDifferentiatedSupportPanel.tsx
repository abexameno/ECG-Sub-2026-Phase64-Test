import React, { useState, useEffect } from 'react';
import {
  LearnerSupportNeed,
  LearnerSupportPlan,
  SupportStrategy,
  SupportIntensity,
  SupportOutcomeDecision,
} from '../types/support.ts';
import { LearnerDifferentiatedSupportService } from '../services/learnerDifferentiatedSupportService.ts';
import { LearnerRosterService } from '../services/learnerRosterService.ts';
import { CanonicalCurriculumService } from '../services/canonicalCurriculumService.ts';
import { ContentArtifact } from '../types.ts';
import {
  Sparkles,
  BookOpen,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  UserCheck,
  Users,
  Search,
  PlusCircle,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';

interface LearnerDifferentiatedSupportPanelProps {
  currentUserId: string;
  schoolId: string;
  classGroupId: string;
  className: string;
}

export const LearnerDifferentiatedSupportPanel: React.FC<LearnerDifferentiatedSupportPanelProps> = ({
  currentUserId,
  schoolId,
  classGroupId,
  className,
}) => {
  const [needs, setNeeds] = useState<LearnerSupportNeed[]>([]);
  const [plans, setPlans] = useState<LearnerSupportPlan[]>([]);
  const [learners, setLearners] = useState<any[]>([]);
  const [outcomes, setOutcomes] = useState<any[]>([]);

  // Filters & State
  const [activeSubTab, setActiveSubTab] = useState<'needs' | 'plans' | 'create_plan' | 'group_plan'>('needs');
  const [selectedLearnerId, setSelectedLearnerId] = useState<string>('all');
  const [selectedNeedId, setSelectedNeedId] = useState<string | null>(null);

  // Form states
  const [newNeedLearnerId, setNewNeedLearnerId] = useState<string>('');
  const [newNeedOutcomeId, setNewNeedOutcomeId] = useState<string>('');
  const [newNeedReason, setNewNeedReason] = useState<string>('');

  // Plan creation states
  const [planStrategy, setPlanStrategy] = useState<SupportStrategy>('GUIDED_PRACTICE');
  const [planIntensity, setPlanIntensity] = useState<SupportIntensity>('ADDITIONAL_SUPPORT');
  const [planObjective, setPlanObjective] = useState<string>('Provide step-by-step guidance to reinforce concept understanding.');
  const [planDate, setPlanDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [planNotes, setPlanNotes] = useState<string>('');

  // Group support states
  const [selectedGroupLearnerIds, setSelectedGroupLearnerIds] = useState<string[]>([]);

  // Search/AI state
  const [existingResources, setExistingResources] = useState<ContentArtifact[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Error/Success feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [schoolId, classGroupId, currentUserId]);

  const loadData = () => {
    try {
      const classNeeds = LearnerDifferentiatedSupportService.getSupportNeedsForClass({
        schoolId,
        teacherId: currentUserId,
        classGroupId,
      });
      setNeeds(classNeeds);

      const classPlans = LearnerDifferentiatedSupportService.getSupportPlansForClass({
        schoolId,
        teacherId: currentUserId,
        classGroupId,
      });
      setPlans(classPlans);

      const roster = LearnerRosterService.getLearnersForClassGroup(classGroupId, schoolId);
      setLearners(roster);

      const allOutcomes = CanonicalCurriculumService.getLearningOutcomes('substrand-whole-numbers');
      setOutcomes(allOutcomes);

      if (roster.length > 0 && !newNeedLearnerId) {
        setNewNeedLearnerId(roster[0].id);
      }
      if (allOutcomes.length > 0 && !newNeedOutcomeId) {
        setNewNeedOutcomeId(allOutcomes[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error loading differentiated support data');
    }
  };

  const handleCreateNeed = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      LearnerDifferentiatedSupportService.createSupportNeed({
        schoolId,
        teacherId: currentUserId,
        learnerId: newNeedLearnerId,
        classGroupId,
        learningOutcomeId: newNeedOutcomeId,
        sourceType: 'TEACHER_OBSERVATION',
        reason: newNeedReason.trim() || 'Teacher observed specific learning need during classroom practice.',
      });
      setSuccessMsg('Support need successfully identified.');
      setNewNeedReason('');
      loadData();
      setActiveSubTab('needs');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create support need.');
    }
  };

  const handleSearchResources = (outcomeId: string) => {
    try {
      const res = LearnerDifferentiatedSupportService.searchExistingResources({
        schoolId,
        teacherId: currentUserId,
        learningOutcomeId: outcomeId,
      });
      setExistingResources(res);
    } catch {
      setExistingResources([]);
    }
  };

  const handleGenerateAIResource = (outcomeId: string) => {
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const artifact = LearnerDifferentiatedSupportService.generateSupportContent({
        schoolId,
        teacherId: currentUserId,
        classGroupId,
        gradeLevelId: 'grade-8',
        learningAreaId: 'la-sci',
        learningOutcomeId: outcomeId,
        strategy: planStrategy,
        intensity: planIntensity,
        objective: planObjective,
      });
      setSelectedArtifactId(artifact.id);
      setSuccessMsg(`AI Support Material generated and saved: ${artifact.id}`);
      handleSearchResources(outcomeId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate AI support content.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreatePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNeedId) {
      setErrorMsg('Please select a support need first.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);

    const need = needs.find((n) => n.id === selectedNeedId);
    if (!need) return;

    try {
      LearnerDifferentiatedSupportService.createSupportPlan({
        schoolId,
        teacherId: currentUserId,
        learnerId: need.learnerId,
        classGroupId,
        supportNeedId: need.id,
        learningOutcomeIds: [need.learningOutcomeId],
        strategy: planStrategy,
        intensity: planIntensity,
        objective: planObjective,
        plannedDate: planDate,
        notes: planNotes,
        artifactId: selectedArtifactId,
      });
      setSuccessMsg('Support plan successfully created.');
      loadData();
      setActiveSubTab('plans');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create support plan.');
    }
  };

  const handleCreateGroupPlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedGroupLearnerIds.length === 0) {
      setErrorMsg('Please select at least one learner for group support.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { groupAssignment } = LearnerDifferentiatedSupportService.createGroupSupport({
        schoolId,
        teacherId: currentUserId,
        classGroupId,
        learnerIds: selectedGroupLearnerIds,
        learningOutcomeId: newNeedOutcomeId,
        strategy: planStrategy,
        intensity: planIntensity,
        objective: planObjective,
        plannedDate: planDate,
        notes: planNotes,
        artifactId: selectedArtifactId,
      });
      setSuccessMsg(`Group support plan (${groupAssignment.id}) created for ${selectedGroupLearnerIds.length} learners.`);
      loadData();
      setActiveSubTab('plans');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create group support.');
    }
  };

  const handleDeliverPlan = (planId: string) => {
    try {
      LearnerDifferentiatedSupportService.deliverSupportPlan({
        schoolId,
        teacherId: currentUserId,
        supportPlanId: planId,
      });
      setSuccessMsg('Support plan marked as delivered.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to deliver support plan.');
    }
  };

  const handleReviewOutcome = (planId: string, decision: SupportOutcomeDecision) => {
    try {
      LearnerDifferentiatedSupportService.reviewSupportOutcome({
        schoolId,
        teacherId: currentUserId,
        supportPlanId: planId,
        decision,
        notes: `Outcome decision recorded: ${decision}`,
      });
      setSuccessMsg(`Support outcome recorded: ${decision}`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to review support outcome.');
    }
  };

  const filteredNeeds = needs.filter((n) => selectedLearnerId === 'all' || n.learnerId === selectedLearnerId);
  const filteredPlans = plans.filter((p) => selectedLearnerId === 'all' || p.learnerId === selectedLearnerId);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-indigo-900 text-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-800 text-indigo-200 text-xs font-black px-2.5 py-0.5 rounded uppercase tracking-wider">
              Phase 23 Differentiated Learning
            </span>
            <span className="text-indigo-300 font-bold text-xs">{className}</span>
          </div>
          <h2 className="text-xl font-black mt-1">Differentiated Learning & Learner Support</h2>
          <p className="text-xs text-indigo-200 font-medium mt-0.5">
            Targeted remediation, scaffolded practice, and extension support grounded in evidence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('create_plan')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all border border-indigo-400"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Identify Need / Create Plan</span>
          </button>
          <button
            onClick={() => setActiveSubTab('group_plan')}
            className="bg-indigo-800 hover:bg-indigo-700 text-indigo-100 font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all border border-indigo-600"
          >
            <Users className="w-4 h-4" />
            <span>Group Support</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-800 text-xs font-bold rounded-xl border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Learner Selector & SubTabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('needs')}
            className={`px-3.5 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'needs' ? 'bg-indigo-100 text-indigo-900 border border-indigo-300' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-indigo-700" />
            <span>Identified Needs ({needs.filter((n) => n.status === 'OPEN').length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('plans')}
            className={`px-3.5 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'plans' ? 'bg-indigo-100 text-indigo-900 border border-indigo-300' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4 text-indigo-700" />
            <span>Support Plans ({plans.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500">Learner:</label>
          <select
            value={selectedLearnerId}
            onChange={(e) => setSelectedLearnerId(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
          >
            <option value="all">All Class Learners ({learners.length})</option>
            {learners.map((l) => (
              <option key={l.id} value={l.id}>
                {l.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SubTab 1: Identified Needs */}
      {activeSubTab === 'needs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Identified Learning Needs
            </h3>
          </div>

          {filteredNeeds.length === 0 ? (
            <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200 text-center text-slate-500 font-medium text-xs">
              No learning needs identified for this selection.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredNeeds.map((need) => {
                const lrn = learners.find((l) => l.id === need.learnerId);
                return (
                  <div key={need.id} className="p-4 bg-white rounded-xl border border-slate-300 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="bg-amber-100 text-amber-900 font-extrabold text-xs px-2.5 py-1 rounded">
                          {need.sourceType.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{lrn?.displayName || need.learnerId}</span>
                      </div>
                      <span
                        className={`text-xs font-black px-2.5 py-0.5 rounded ${
                          need.status === 'OPEN'
                            ? 'bg-red-100 text-red-800'
                            : need.status === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {need.status}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-slate-700">{need.reason}</p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-[11px] text-slate-500">Outcome: {need.learningOutcomeId}</span>
                      {need.status === 'OPEN' && (
                        <button
                          onClick={() => {
                            setSelectedNeedId(need.id);
                            handleSearchResources(need.learningOutcomeId);
                            setActiveSubTab('create_plan');
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all"
                        >
                          Create Support Plan
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SubTab 2: Support Plans */}
      {activeSubTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Active & Delivered Support Plans
            </h3>
          </div>

          {filteredPlans.length === 0 ? (
            <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200 text-center text-slate-500 font-medium text-xs">
              No support plans created for this selection.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredPlans.map((plan) => {
                const lrn = learners.find((l) => l.id === plan.learnerId);
                return (
                  <div key={plan.id} className="p-5 bg-white rounded-xl border border-slate-300 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="bg-indigo-100 text-indigo-900 font-extrabold text-xs px-2.5 py-0.5 rounded">
                            {plan.strategy.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs font-bold text-slate-900">{lrn?.displayName || plan.learnerId}</span>
                        </div>
                        <p className="text-xs font-medium text-slate-600 mt-1">{plan.objective}</p>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-xs font-black px-2.5 py-1 rounded ${
                            plan.status === 'PLANNED'
                              ? 'bg-amber-100 text-amber-900'
                              : plan.status === 'DELIVERED'
                              ? 'bg-blue-100 text-blue-900'
                              : plan.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {plan.status}
                        </span>
                        <p className="text-[11px] text-slate-500 mt-1">Planned: {plan.plannedDate}</p>
                      </div>
                    </div>

                    {plan.notes && (
                      <div className="p-3 bg-slate-50 rounded-lg text-xs font-medium text-slate-700">
                        Notes: {plan.notes}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <div className="flex items-center gap-2">
                        {plan.status === 'PLANNED' && (
                          <button
                            onClick={() => handleDeliverPlan(plan.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all"
                          >
                            Mark Delivered
                          </button>
                        )}

                        {plan.status === 'DELIVERED' && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-600">Review Outcome:</span>
                            <button
                              onClick={() => handleReviewOutcome(plan.id, 'RESOLVED')}
                              className="bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-xs px-2.5 py-1 rounded-lg"
                            >
                              Resolved
                            </button>
                            <button
                              onClick={() => handleReviewOutcome(plan.id, 'MONITOR')}
                              className="bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold text-xs px-2.5 py-1 rounded-lg"
                            >
                              Monitor
                            </button>
                            <button
                              onClick={() => handleReviewOutcome(plan.id, 'REASSESS')}
                              className="bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs px-2.5 py-1 rounded-lg"
                            >
                              Reassess
                            </button>
                          </div>
                        )}
                      </div>

                      <span className="text-[11px] text-slate-400 font-mono">ID: {plan.id}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SubTab 3: Create Support Need & Plan */}
      {activeSubTab === 'create_plan' && (
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-300 space-y-6">
          <h3 className="text-base font-black text-slate-900">1. Identify Support Need or Select Existing</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Learner *</label>
              <select
                value={newNeedLearnerId}
                onChange={(e) => setNewNeedLearnerId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs font-bold bg-white"
              >
                {learners.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Learning Outcome *</label>
              <select
                value={newNeedOutcomeId}
                onChange={(e) => {
                  setNewNeedOutcomeId(e.target.value);
                  handleSearchResources(e.target.value);
                }}
                className="w-full px-3 py-2 border rounded-lg text-xs font-bold bg-white"
              >
                {outcomes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id}: {o.statement.substring(0, 45)}...
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Observation Reason</label>
              <input
                type="text"
                placeholder="Reason or evidence gap..."
                value={newNeedReason}
                onChange={(e) => setNewNeedReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs font-medium bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCreateNeed}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg"
            >
              Record Need First
            </button>
          </div>

          <hr className="border-slate-200" />

          <h3 className="text-base font-black text-slate-900">2. Configure Differentiated Support Strategy</h3>

          <form onSubmit={handleCreatePlanSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Strategy *</label>
                <select
                  value={planStrategy}
                  onChange={(e) => setPlanStrategy(e.target.value as SupportStrategy)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-bold bg-white"
                >
                  <option value="RETEACH_CONCEPT">Reteach Concept</option>
                  <option value="GUIDED_PRACTICE">Guided Practice</option>
                  <option value="ADDITIONAL_PRACTICE">Additional Practice</option>
                  <option value="SCAFFOLDED_ACTIVITY">Scaffolded Activity</option>
                  <option value="EXAMPLE_AND_MODELLING">Worked Example & Modelling</option>
                  <option value="PEER_SUPPORTED_ACTIVITY">Peer Supported Activity</option>
                  <option value="EXTENSION_ACTIVITY">Extension Activity</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Intensity *</label>
                <select
                  value={planIntensity}
                  onChange={(e) => setPlanIntensity(e.target.value as SupportIntensity)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-bold bg-white"
                >
                  <option value="STANDARD">Standard</option>
                  <option value="ADDITIONAL_SUPPORT">Additional Support</option>
                  <option value="INTENSIVE_SUPPORT">Intensive Support</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Objective *</label>
                <input
                  type="text"
                  value={planObjective}
                  onChange={(e) => setPlanObjective(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-medium bg-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Planned Date *</label>
                <input
                  type="date"
                  value={planDate}
                  onChange={(e) => setPlanDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-medium bg-white"
                  required
                />
              </div>
            </div>

            {/* AI Generation or Search */}
            <div className="p-4 bg-white rounded-xl border border-slate-300 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800">Support Material (Reuse or AI Generate)</span>
                <button
                  type="button"
                  onClick={() => handleGenerateAIResource(newNeedOutcomeId)}
                  disabled={isGenerating}
                  className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isGenerating ? 'Generating...' : 'Generate AI Support Material'}</span>
                </button>
              </div>

              {existingResources.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-slate-500">Reusable School Resources:</p>
                  <div className="divide-y divide-slate-100 border rounded-lg max-h-32 overflow-y-auto">
                    {existingResources.map((res) => (
                      <label key={res.id} className="p-2 flex items-center gap-2 hover:bg-slate-50 text-xs font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="resource"
                          value={res.id}
                          checked={selectedArtifactId === res.id}
                          onChange={() => setSelectedArtifactId(res.id)}
                        />
                        <span>{res.id} ({res.artifactType})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveSubTab('needs')}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2 rounded-lg"
              >
                Save Support Plan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SubTab 4: Group Support Plan */}
      {activeSubTab === 'group_plan' && (
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-300 space-y-6">
          <h3 className="text-base font-black text-slate-900">Create Small-Group Differentiated Support</h3>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">Select Group Learners *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-white p-3 rounded-xl border border-slate-300 max-h-48 overflow-y-auto">
              {learners.map((l) => (
                <label key={l.id} className="flex items-center gap-2 text-xs font-medium cursor-pointer p-1.5 hover:bg-slate-50 rounded">
                  <input
                    type="checkbox"
                    checked={selectedGroupLearnerIds.includes(l.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedGroupLearnerIds([...selectedGroupLearnerIds, l.id]);
                      } else {
                        setSelectedGroupLearnerIds(selectedGroupLearnerIds.filter((id) => id !== l.id));
                      }
                    }}
                  />
                  <span>{l.displayName}</span>
                </label>
              ))}
            </div>
          </div>

          <form onSubmit={handleCreateGroupPlanSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Learning Outcome *</label>
                <select
                  value={newNeedOutcomeId}
                  onChange={(e) => setNewNeedOutcomeId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-bold bg-white"
                >
                  {outcomes.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.id}: {o.statement.substring(0, 40)}...
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Strategy *</label>
                <select
                  value={planStrategy}
                  onChange={(e) => setPlanStrategy(e.target.value as SupportStrategy)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-bold bg-white"
                >
                  <option value="SMALL_GROUP_SUPPORT">Small Group Support</option>
                  <option value="GUIDED_PRACTICE">Guided Group Practice</option>
                  <option value="PEER_SUPPORTED_ACTIVITY">Peer Supported Activity</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveSubTab('plans')}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2 rounded-lg"
              >
                Create Group Support ({selectedGroupLearnerIds.length} Learners)
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
