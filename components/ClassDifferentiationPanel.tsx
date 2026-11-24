import React, { useState, useEffect } from 'react';
import {
  Users,
  PlusCircle,
  CheckCircle,
  Play,
  Pause,
  Archive,
  UserPlus,
  UserMinus,
  Sparkles,
  BookOpen,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { LearningGroup, LearningGroupMembership, LearningGroupSuggestion } from '../types/differentiation.ts';
import { ClassDifferentiationService } from '../services/classDifferentiationService.ts';
import { LearnerRosterService } from '../services/learnerRosterService.ts';
import { CanonicalCurriculumService } from '../services/canonicalCurriculumService.ts';

interface ClassDifferentiationPanelProps {
  currentUserId: string;
  schoolId: string;
  classGroupId: string;
  className: string;
}

export const ClassDifferentiationPanel: React.FC<ClassDifferentiationPanelProps> = ({
  currentUserId,
  schoolId,
  classGroupId,
  className,
}) => {
  const [activeTab, setActiveTab] = useState<'suggestions' | 'groups' | 'create'>('suggestions');
  const [suggestions, setSuggestions] = useState<LearningGroupSuggestion[]>([]);
  const [groups, setGroups] = useState<LearningGroup[]>([]);
  const [learners, setLearners] = useState<any[]>([]);
  const [outcomes, setOutcomes] = useState<any[]>([]);

  // Form state for manual group creation
  const [groupName, setGroupName] = useState('');
  const [groupPurpose, setGroupPurpose] = useState<any>('GUIDED_PRACTICE');
  const [selectedOutcomeId, setSelectedOutcomeId] = useState('');
  const [groupObjective, setGroupObjective] = useState('');
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Selected group details
  const [selectedGroup, setSelectedGroup] = useState<LearningGroup | null>(null);
  const [groupMemberships, setGroupMemberships] = useState<LearningGroupMembership[]>([]);

  useEffect(() => {
    loadData();
  }, [schoolId, classGroupId, currentUserId]);

  const loadData = () => {
    try {
      const roster = LearnerRosterService.getLearnersForClassGroup(classGroupId, schoolId);
      setLearners(roster);

      const curriculum = CanonicalCurriculumService.getCurriculum();
      // Gather some outcomes from curriculum
      const allOutcomes: any[] = [];
      const subStrandIds = ['substrand-whole-numbers', 'substrand-fractions', 'substrand-length'];
      for (const ssId of subStrandIds) {
        allOutcomes.push(...CanonicalCurriculumService.getLearningOutcomes(ssId));
      }
      setOutcomes(allOutcomes);
      if (allOutcomes.length > 0 && !selectedOutcomeId) {
        setSelectedOutcomeId(allOutcomes[0].id);
      }

      const activeGroups = ClassDifferentiationService.getGroupsForClass(schoolId, currentUserId, classGroupId);
      setGroups(activeGroups);
    } catch (err: any) {
      setError(err.message || 'Failed to load differentiation data');
    }
  };

  const handleGenerateSuggestions = () => {
    if (!selectedOutcomeId) return;
    setLoading(true);
    setError(null);
    try {
      const sugs = ClassDifferentiationService.generateSuggestions({
        schoolId,
        teacherId: currentUserId,
        classGroupId,
        learningOutcomeId: selectedOutcomeId,
      });
      setSuggestions(sugs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptSuggestion = (sug: LearningGroupSuggestion) => {
    try {
      const { group } = ClassDifferentiationService.createLearningGroup({
        schoolId,
        teacherId: currentUserId,
        classGroupId,
        academicYearId: 'ay-2026',
        learningAreaId: 'la-sci',
        curriculumVersionId: CanonicalCurriculumService.getCurriculum().version,
        name: sug.suggestedName,
        purpose: sug.purpose,
        learningOutcomeIds: [sug.learningOutcomeId],
        objective: sug.rationale,
        learnerIds: sug.learnerIds,
        idempotencyKey: `sug_${sug.id}_${Date.now()}`,
      });
      setSuccessMessage(`Successfully created group "${group.name}" from suggestion!`);
      loadData();
      setActiveTab('groups');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateManualGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName || selectedLearnerIds.length === 0 || !selectedOutcomeId) {
      setError('Please provide a group name, select a learning outcome, and select at least one learner.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      ClassDifferentiationService.createLearningGroup({
        schoolId,
        teacherId: currentUserId,
        classGroupId,
        academicYearId: 'ay-2026',
        learningAreaId: 'la-sci',
        curriculumVersionId: CanonicalCurriculumService.getCurriculum().version,
        name: groupName,
        purpose: groupPurpose,
        learningOutcomeIds: [selectedOutcomeId],
        objective: groupObjective || 'Targeted group instruction',
        learnerIds: selectedLearnerIds,
        idempotencyKey: `manual_${Date.now()}`,
      });
      setSuccessMessage('Learning group created successfully!');
      setGroupName('');
      setSelectedLearnerIds([]);
      setGroupObjective('');
      loadData();
      setActiveTab('groups');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGroupDetails = (group: LearningGroup) => {
    setSelectedGroup(group);
    try {
      const mems = ClassDifferentiationService.getGroupMemberships(group.id, schoolId, currentUserId);
      setGroupMemberships(mems);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeliverInstruction = (groupId: string) => {
    try {
      ClassDifferentiationService.deliverGroupInstruction({
        schoolId,
        teacherId: currentUserId,
        groupId,
      });
      setSuccessMessage('Group instruction delivered and logged as TeachingActivity!');
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateStatus = (groupId: string, status: any) => {
    try {
      ClassDifferentiationService.updateGroupStatus({
        schoolId,
        teacherId: currentUserId,
        groupId,
        status,
      });
      setSuccessMessage(`Group status updated to ${status}`);
      loadData();
      if (selectedGroup && selectedGroup.id === groupId) {
        setSelectedGroup({ ...selectedGroup, status });
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Class Differentiation & Learning Groups</h2>
          <p className="text-sm text-slate-600">
            Create temporary instructional groups for class {className} without altering permanent learner records.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'suggestions'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Suggested Groups
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'groups'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Active Groups ({groups.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'create'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <PlusCircle className="w-4 h-4 inline mr-1" /> Create Group
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 text-sm">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-emerald-700 text-sm">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* SUGGESTIONS TAB */}
      {activeTab === 'suggestions' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Select Learning Outcome for Analysis
              </label>
              <select
                value={selectedOutcomeId}
                onChange={(e) => setSelectedOutcomeId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                {outcomes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code}: {o.statement}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleGenerateSuggestions}
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm flex items-center gap-2 shadow-xs transition-colors shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              Generate Suggestions
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {suggestions.map((sug) => (
              <div key={sug.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full uppercase tracking-wider">
                      {sug.purpose.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-slate-500">{sug.learnerIds.length} learners suggested</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">{sug.suggestedName}</h3>
                  <p className="text-sm text-slate-600 mb-4">{sug.rationale}</p>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium">Strategy: {sug.suggestedStrategy}</span>
                  <button
                    onClick={() => handleAcceptSuggestion(sug)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <CheckCircle className="w-4 h-4" /> Accept & Create Group
                  </button>
                </div>
              </div>
            ))}
            {suggestions.length === 0 && (
              <div className="col-span-2 text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-500">
                <Users className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                <p>No suggestions generated yet. Select a learning outcome and click Generate Suggestions.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ACTIVE GROUPS TAB */}
      {activeTab === 'groups' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-md font-bold text-slate-900">Active Class Groups</h3>
            <div className="space-y-3">
              {groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => handleOpenGroupDetails(group)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedGroup?.id === group.id
                      ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-md uppercase">
                      {group.purpose.replace(/_/g, ' ')}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      group.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {group.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900">{group.name}</h4>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">{group.objective}</p>
                </div>
              ))}
              {groups.length === 0 && (
                <p className="text-sm text-slate-500 italic">No learning groups created for this class yet.</p>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            {selectedGroup ? (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                      {selectedGroup.purpose.replace(/_/g, ' ')}
                    </span>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{selectedGroup.name}</h3>
                    <p className="text-sm text-slate-600 mt-1">{selectedGroup.objective}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeliverInstruction(selectedGroup.id)}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" /> Deliver Group Lesson
                    </button>
                    {selectedGroup.status === 'ACTIVE' ? (
                      <button
                        onClick={() => handleUpdateStatus(selectedGroup.id, 'PAUSED')}
                        className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-medium rounded-lg"
                      >
                        <Pause className="w-3.5 h-3.5 inline mr-1" /> Pause
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(selectedGroup.id, 'ACTIVE')}
                        className="px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-medium rounded-lg"
                      >
                        Resume
                      </button>
                    )}
                    <button
                      onClick={() => handleUpdateStatus(selectedGroup.id, 'ARCHIVED')}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <h4 className="text-sm font-bold text-slate-900 mb-3">Group Members ({groupMemberships.filter(m => m.status === 'ACTIVE').length})</h4>
                  <div className="space-y-2">
                    {groupMemberships.filter(m => m.status === 'ACTIVE').map((mem) => {
                      const learner = learners.find((l) => l.id === mem.learnerId);
                      return (
                        <div key={mem.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                              {learner?.name?.substring(0, 2).toUpperCase() || 'L'}
                            </div>
                            <div>
                              <span className="font-medium text-slate-900">{learner?.name || mem.learnerId}</span>
                              <span className="block text-xs text-slate-500">Joined: {new Date(mem.joinedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              ClassDifferentiationService.removeLearnerFromGroup({
                                schoolId,
                                teacherId: currentUserId,
                                groupId: selectedGroup.id,
                                learnerId: mem.learnerId,
                                reason: 'Teacher reassignment',
                              });
                              handleOpenGroupDetails(selectedGroup);
                            }}
                            className="text-red-600 hover:text-red-800 text-xs font-medium px-2.5 py-1 rounded-md bg-red-50 hover:bg-red-100 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-xl border border-slate-200 text-slate-500">
                <BookOpen className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                <p>Select a group from the list to view members and teaching actions.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE GROUP TAB */}
      {activeTab === 'create' && (
        <form onSubmit={handleCreateManualGroup} className="bg-white p-8 rounded-xl border border-slate-200 shadow-xs max-w-2xl mx-auto space-y-6">
          <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Create Temporary Learning Group</h3>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Group Name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Guided Addition Practice"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Instructional Purpose</label>
              <select
                value={groupPurpose}
                onChange={(e) => setGroupPurpose(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="GUIDED_PRACTICE">Guided Practice</option>
                <option value="REINFORCEMENT">Reinforcement</option>
                <option value="CORE_LEARNING">Core Learning</option>
                <option value="REVIEW">Review</option>
                <option value="EXTENSION">Extension</option>
                <option value="TARGETED_INSTRUCTION">Targeted Instruction</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Learning Outcome</label>
              <select
                value={selectedOutcomeId}
                onChange={(e) => setSelectedOutcomeId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                {outcomes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code}: {o.statement}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Group Objective / Notes</label>
            <textarea
              value={groupObjective}
              onChange={(e) => setGroupObjective(e.target.value)}
              rows={3}
              placeholder="Describe the objective for this group session..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Select Learners ({selectedLearnerIds.length} selected)</label>
            <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
              {learners.map((learner) => {
                const isSelected = selectedLearnerIds.includes(learner.id);
                return (
                  <label
                    key={learner.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLearnerIds([...selectedLearnerIds, learner.id]);
                          } else {
                            setSelectedLearnerIds(selectedLearnerIds.filter((id) => id !== learner.id));
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-900">{learner.name}</span>
                    </div>
                    <span className="text-xs text-slate-500">ID: {learner.id}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setActiveTab('groups')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-xs transition-colors"
            >
              Create Learning Group
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
