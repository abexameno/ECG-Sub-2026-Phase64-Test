import React, { useState } from 'react';
import { TeacherTeachingOverview } from '../types/teachingAssignment.ts';
import { LearnerRosterService } from '../services/learnerRosterService.ts';
import { SchoolMembershipService } from '../services/schoolMembershipService.ts';
import { ClassroomAttendancePanel } from './ClassroomAttendancePanel.tsx';
import { LearnerEngagementInterventionPanel } from './LearnerEngagementInterventionPanel.tsx';
import { LearnerDifferentiatedSupportPanel } from './LearnerDifferentiatedSupportPanel.tsx';
import { AdaptiveLearningPathwayPanel } from './AdaptiveLearningPathwayPanel.tsx';
import { ClassDifferentiationPanel } from './ClassDifferentiationPanel.tsx';
import { Users, Calendar, Play, CheckCircle, AlertTriangle, UserPlus, FileText, Award, UserCheck, ShieldAlert, BookOpen, Sparkles, Network, ArrowLeft } from 'lucide-react';

interface ClassWorkspacePanelProps {
  currentUserId: string;
  overview: TeacherTeachingOverview;
  initialTab?: 'today' | 'attendance' | 'intervention' | 'support' | 'adaptive' | 'differentiation' | 'roster' | 'performance';
  onBackToDashboard?: () => void;
  onNavigateToGenerator?: (grade: string, subject: string) => void;
  onStartLesson?: (todayLesson: any) => void;
  onLearnersUpdated?: () => void;
}

export const ClassWorkspacePanel: React.FC<ClassWorkspacePanelProps> = ({
  currentUserId,
  overview,
  initialTab,
  onBackToDashboard,
  onNavigateToGenerator,
  onStartLesson,
  onLearnersUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'today' | 'attendance' | 'intervention' | 'support' | 'adaptive' | 'differentiation' | 'roster' | 'performance'>(initialTab || 'today');

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [showAddLearnerInput, setShowAddLearnerInput] = useState(false);
  const [newLearnerName, setNewLearnerName] = useState('');
  const [newLearnerId, setNewLearnerId] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeClass = overview.activeClassGroup;
  const activeAssign = overview.activeAssignment;
  const activeSchool = overview.activeSchool;
  const learners = overview.activeLearners;
  const perf = overview.performanceSummary;

  const userReadModel = SchoolMembershipService.getTeacherSchoolReadModel(currentUserId);
  const isSchoolAdmin = userReadModel.activeMembership?.role === 'SCHOOL_ADMIN' || userReadModel.activeMembership?.role === 'SUPER_ADMIN' || userReadModel.activeMembership?.role === 'ACADEMIC_ADMIN';

  if (!activeClass || !activeAssign || !activeSchool) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 font-medium">
        Select a class from the list to view your workspace.
      </div>
    );
  }

  const handleAddLearnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLearnerName.trim()) return;
    setErrorMsg(null);
    try {
      LearnerRosterService.addLearner({
        schoolId: activeSchool.id,
        displayName: newLearnerName.trim(),
        learnerIdentifier: newLearnerId.trim() || undefined,
        classGroupId: activeClass.id,
        academicYearId: activeClass.academicYearId,
        requestingUserId: currentUserId,
      });
      setNewLearnerName('');
      setNewLearnerId('');
      setShowAddLearnerInput(false);
      if (onLearnersUpdated) onLearnersUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add learner.');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="inline-flex items-center gap-1 text-xs font-bold text-purple-900 hover:text-purple-950 mb-2 py-1 px-2.5 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Today's Dashboard</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="bg-purple-100 text-purple-950 text-xs font-black px-2.5 py-1 rounded-md uppercase tracking-wider border border-purple-200">
              {activeAssign.learningAreaId.toUpperCase().replace('-', ' ')}
            </span>
            <span className="text-slate-500 font-bold text-xs uppercase">{activeAssign.gradeId}</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-1">{activeClass.name}</h2>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            School: {activeSchool.name} • {learners.length} Active Learners
          </p>
        </div>

        {/* Action Button to Generate SOW or Lesson Plan */}
        <div className="flex items-center gap-2">
          {onNavigateToGenerator && (
            <button
              onClick={() => onNavigateToGenerator(activeAssign.gradeId, activeAssign.learningAreaId)}
              className="app-btn app-btn-primary text-xs px-3.5 py-2 font-bold flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4" />
              <span>Generate SOW / Lesson Plan</span>
            </button>
          )}
        </div>
      </div>

      {/* Workspace Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('today')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'today'
              ? 'border-[#3b1464] text-purple-950 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Today's Lesson</span>
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'attendance'
              ? 'border-[#3b1464] text-purple-950 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Attendance & Participation</span>
        </button>

        <button
          onClick={() => setActiveTab('intervention')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'intervention'
              ? 'border-amber-600 text-amber-900 bg-amber-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>Needs Review / Follow-Up</span>
        </button>

        <button
          onClick={() => setActiveTab('support')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'support'
              ? 'border-indigo-600 text-indigo-900 bg-indigo-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4 text-indigo-600" />
          <span>Differentiated Support</span>
        </button>

        <button
          onClick={() => setActiveTab('adaptive')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'adaptive'
              ? 'border-purple-600 text-purple-900 bg-purple-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span>Adaptive Pathways</span>
        </button>

        <button
          onClick={() => setActiveTab('differentiation')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'differentiation'
              ? 'border-blue-600 text-blue-900 bg-blue-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Network className="w-4 h-4 text-blue-600" />
          <span>Class Differentiation</span>
        </button>

        <button
          onClick={() => setActiveTab('roster')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'roster'
              ? 'border-[#3b1464] text-purple-950 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Class Roster ({learners.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('performance')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'performance'
              ? 'border-[#3b1464] text-purple-950 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Evidence & Performance</span>
        </button>
      </div>

      {/* Tab 1: Today's Lesson */}
      {activeTab === 'today' && (
        <div className="space-y-4">
          <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase text-purple-950 bg-purple-200/80 px-2.5 py-1 rounded">
                Scheduled Today
              </span>
              <span className="text-xs text-slate-600 font-semibold">
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>

            <h3 className="text-lg font-black text-slate-900 mb-1">
              {activeAssign.learningAreaId.toUpperCase().replace('-', ' ')} — {activeClass.name}
            </h3>
            <p className="text-xs text-slate-600 font-medium mb-4">
              Curriculum Strand: Strand 1 · Specific Learning Outcomes: KICD Aligned Target Lesson
            </p>

            <div className="flex flex-wrap gap-3">
              {onStartLesson && (
                <button
                  onClick={() => onStartLesson(overview.todayLesson)}
                  className="bg-[#3b1464] hover:bg-[#2e1065] text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 border border-slate-200 shadow-sm transition-all"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start Classroom Delivery</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('attendance')}
                className="bg-white hover:bg-purple-50/40 text-slate-800 px-4 py-2.5 rounded-xl font-bold text-xs border border-slate-300 transition-all flex items-center gap-1.5"
              >
                <UserCheck className="w-4 h-4 text-purple-900" />
                <span>Mark Classroom Attendance</span>
              </button>

              {onNavigateToGenerator && (
                <button
                  onClick={() => onNavigateToGenerator(activeAssign.gradeId, activeAssign.learningAreaId)}
                  className="bg-white hover:bg-slate-100 text-slate-800 px-4 py-2.5 rounded-xl font-bold text-xs border border-slate-300 transition-all"
                >
                  Create Teaching Material
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Attendance & Participation */}
      {activeTab === 'attendance' && (
        <ClassroomAttendancePanel
          currentUserId={currentUserId}
          schoolId={activeSchool.id}
          classGroupId={activeClass.id}
          className={activeClass.name}
          academicYearId={activeClass.academicYearId}
          termId={activeAssign.termId}
          teachingActivityId={overview.todayLesson?.activityId}
          teachingAllocationId={overview.todayLesson?.teachingAllocationId}
        />
      )}

      {/* Tab: Needs Review / Intervention */}
      {activeTab === 'intervention' && (
        <LearnerEngagementInterventionPanel
          currentUserId={currentUserId}
          schoolId={activeSchool.id}
          classGroupId={activeClass.id}
          className={activeClass.name}
        />
      )}

      {/* Tab: Differentiated Learning & Support */}
      {activeTab === 'support' && (
        <LearnerDifferentiatedSupportPanel
          currentUserId={currentUserId}
          schoolId={activeSchool.id}
          classGroupId={activeClass.id}
          className={activeClass.name}
        />
      )}

      {/* Tab: Adaptive Learning Pathways */}
      {activeTab === 'adaptive' && (
        <AdaptiveLearningPathwayPanel
          currentUserId={currentUserId}
          schoolId={activeSchool.id}
          classGroupId={activeClass.id}
          className={activeClass.name}
        />
      )}

      {/* Tab: Class Differentiation & Learning Groups */}
      {activeTab === 'differentiation' && (
        <ClassDifferentiationPanel
          currentUserId={currentUserId}
          schoolId={activeSchool.id}
          classGroupId={activeClass.id}
          className={activeClass.name}
        />
      )}

      {/* Tab 2: Class Roster */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Learner List ({learners.length})
            </h3>

            {isSchoolAdmin && !showAddLearnerInput && (
              <button
                onClick={() => setShowAddLearnerInput(true)}
                className="app-btn app-btn-primary text-xs px-3 py-1.5 font-bold flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Learner</span>
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-200">
              {errorMsg}
            </div>
          )}

          {showAddLearnerInput && (
            <form onSubmit={handleAddLearnerSubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-300 space-y-3">
              <h4 className="text-xs font-extrabold uppercase text-slate-800">Add New Learner to {activeClass.name}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Learner Full Name *"
                  value={newLearnerName}
                  onChange={(e) => setNewLearnerName(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm bg-white font-medium"
                  required
                />
                <input
                  type="text"
                  placeholder="Learner Identifier (Optional e.g. ADM-001)"
                  value={newLearnerId}
                  onChange={(e) => setNewLearnerId(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm bg-white font-medium"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddLearnerInput(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="app-btn app-btn-primary text-xs px-4 py-1.5 font-bold"
                >
                  Save Learner
                </button>
              </div>
            </form>
          )}

          {learners.length === 0 ? (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs font-medium">
              No learners have been added to {activeClass.name} yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 border rounded-xl overflow-hidden">
              {learners.map((learner, index) => (
                <div key={learner.id} className="p-3 bg-white flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-950 text-xs font-black flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{learner.displayName}</p>
                      {learner.learnerIdentifier && (
                        <p className="text-xs text-slate-500 font-mono">ID: {learner.learnerIdentifier}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                    Active
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Performance & Evidence */}
      {activeTab === 'performance' && perf && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
              <span className="text-2xl font-black text-slate-900">{perf.evidenceCount}</span>
              <p className="text-xs text-slate-500 font-bold uppercase mt-1">Total Evidence</p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-center">
              <span className="text-2xl font-black text-emerald-700">{perf.strongCount}</span>
              <p className="text-xs text-emerald-800 font-bold uppercase mt-1">Strong</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-center">
              <span className="text-2xl font-black text-blue-700">{perf.developingCount}</span>
              <p className="text-xs text-blue-800 font-bold uppercase mt-1">Developing</p>
            </div>
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-center">
              <span className="text-2xl font-black text-amber-700">{perf.emergingCount + perf.insufficientCount}</span>
              <p className="text-xs text-amber-800 font-bold uppercase mt-1">Emerging / Needs Focus</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-medium">
            💡 Performance and assessment metrics are automatically compiled from Phase 12–14 learner evidence records.
          </div>
        </div>
      )}
    </div>
  );
};
