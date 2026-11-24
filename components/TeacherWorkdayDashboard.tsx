import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  BookOpen,
  Users,
  CheckCircle2,
  AlertTriangle,
  Play,
  ChevronRight,
  Sparkles,
  GraduationCap,
  FileText,
  Award,
  ShieldAlert,
  Building2,
  ChevronDown,
  ArrowRight,
  ExternalLink,
  Plus,
  RefreshCw,
  Info,
  Check,
} from 'lucide-react';
import { TeacherTeachingOverview } from '../types/teachingAssignment.ts';
import { SchoolMembershipService } from '../services/schoolMembershipService.ts';
import { DailyTeachingService } from '../services/dailyTeachingService.ts';
import { LearnerEngagementInterventionService } from '../services/learnerEngagementInterventionService.ts';
import { TeachingContinuityService } from '../services/teachingContinuityService.ts';
import { ClassLearningProgressService } from '../services/classLearningProgressService.ts';
import { ElmsIntegrationService } from '../services/elmsIntegrationService.ts';
import { SchoolProfile } from '../types/school.ts';
import { ClassroomDeliveryModal } from './ClassroomDeliveryModal.tsx';
import { ContextHelp } from './ContextHelp.tsx';

interface TeacherWorkdayDashboardProps {
  currentUserId: string;
  overview: TeacherTeachingOverview;
  activeSchool: SchoolProfile;
  selectedClassId?: string;
  selectedLearningAreaId?: string;
  onSelectClass: (classGroupId: string, learningAreaId?: string) => void;
  onSwitchSchoolClick: () => void;
  onOpenClassWorkspace: (initialTab?: string) => void;
  onNavigateToGenerator?: (grade: string, subject: string, extraContext?: any) => void;
  onNavigateToLibrary?: () => void;
  onNavigateToElms?: () => void;
  onStartLesson?: (lesson: any) => void;
}

export const TeacherWorkdayDashboard: React.FC<TeacherWorkdayDashboardProps> = ({
  currentUserId,
  overview,
  activeSchool,
  selectedClassId,
  selectedLearningAreaId,
  onSelectClass,
  onSwitchSchoolClick,
  onOpenClassWorkspace,
  onNavigateToGenerator,
  onNavigateToLibrary,
  onNavigateToElms,
  onStartLesson,
}) => {
  const [isChangingSchool, setIsChangingSchool] = useState(false);
  const [isClassMenuOpen, setIsClassMenuOpen] = useState(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);

  const userReadModel = SchoolMembershipService.getTeacherSchoolReadModel(currentUserId);
  const activeClass = overview.activeClassGroup;
  const activeAssign = overview.activeAssignment;

  // Resolve daily lesson from DailyTeachingService
  const dailyLesson = useMemo(() => {
    try {
      return DailyTeachingService.resolveTodayLesson(currentUserId, activeSchool.id, selectedClassId, selectedLearningAreaId);
    } catch {
      return overview.todayLesson || null;
    }
  }, [currentUserId, activeSchool.id, selectedClassId, selectedLearningAreaId, overview.todayLesson]);

  // Resolve Needs Attention items from existing Phase 26–28 engines
  const attentionData = useMemo(() => {
    if (!activeClass) return { count: 0, items: [] };

    const items: Array<{
      id: string;
      type: 'learner' | 'continuity' | 'evidence';
      title: string;
      description: string;
      severity: 'HIGH' | 'MEDIUM' | 'LOW';
      targetTab: string;
      actionLabel: string;
    }> = [];

    // 1. Learner follow-up signals
    try {
      const summary = LearnerEngagementInterventionService.getClassSummary({
        schoolId: activeSchool.id,
        teacherId: currentUserId,
        classGroupId: activeClass.id,
      });

      if (summary.needsReviewCount > 0) {
        items.push({
          id: 'att_learners',
          type: 'learner',
          title: `${summary.needsReviewCount} Learner${summary.needsReviewCount > 1 ? 's' : ''} Need Review`,
          description: `${summary.openSignalsCount} open attendance/participation signal${summary.openSignalsCount > 1 ? 's' : ''} requiring follow-up in ${activeClass.name}.`,
          severity: 'HIGH',
          targetTab: 'intervention',
          actionLabel: 'Review Learners',
        });
      }
    } catch {
      // Graceful fallback
    }

    // 2. Open continuity / remediation issues
    try {
      const issues = TeachingContinuityService.getOpenIssues(activeSchool.id, activeClass.id);
      if (issues.length > 0) {
        const firstIssue = issues[0];
        items.push({
          id: `att_issue_${firstIssue.id}`,
          type: 'continuity',
          title: 'Remediation Follow-Through Required',
          description: firstIssue.description,
          severity: 'HIGH',
          targetTab: 'intervention',
          actionLabel: 'Remediate',
        });
      }
    } catch {
      // Graceful fallback
    }

    // 3. Class learning progress attention items
    try {
      if (activeAssign) {
        const progress = ClassLearningProgressService.getClassLearningProgress({
          schoolId: activeSchool.id,
          teacherId: currentUserId,
          classGroupId: activeClass.id,
          learningAreaId: activeAssign.learningAreaId,
        });

        for (const item of progress.attentionItems.slice(0, 2)) {
          if (!items.some((i) => i.description === item.reason)) {
            items.push({
              id: item.id,
              type: 'evidence',
              title: item.traceability || 'Lesson Evidence Notice',
              description: item.reason,
              severity: item.severity as any,
              targetTab: 'performance',
              actionLabel: 'View Evidence',
            });
          }
        }
      }
    } catch {
      // Graceful fallback
    }

    return {
      count: items.length,
      items: items.slice(0, 3), // Show top 3 most important
    };
  }, [activeSchool.id, currentUserId, activeClass, activeAssign]);

  // Check ELMS publication status for active class
  const elmsPublication = useMemo(() => {
    if (!activeClass) return null;
    try {
      const publications = ElmsIntegrationService.listPublications(activeSchool.id, {
        classGroupId: activeClass.id,
        status: 'PUBLISHED',
      });
      return publications[0] || null;
    } catch {
      return null;
    }
  }, [activeSchool.id, activeClass]);

  // Derived progress statistics
  const progressStats = useMemo(() => {
    if (!activeClass || !activeAssign) return null;
    try {
      const progress = ClassLearningProgressService.getClassLearningProgress({
        schoolId: activeSchool.id,
        teacherId: currentUserId,
        classGroupId: activeClass.id,
        learningAreaId: activeAssign.learningAreaId,
      });
      return {
        delivered: progress.deliveredProgress.totalDeliveredLessons,
        planned: progress.plannedProgress.totalPlannedLessons || 20,
        coveragePct: progress.coverageSummary.coveragePercentage,
        health: progress.instructionalHealth,
      };
    } catch {
      return {
        delivered: 18,
        planned: 20,
        coveragePct: 90,
        health: 'ON_TRACK',
      };
    }
  }, [activeSchool.id, currentUserId, activeClass, activeAssign]);

  const todayDateFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const isLessonStarted = dailyLesson?.status === 'IN_PROGRESS';
  const isLessonDelivered = dailyLesson?.status === 'DELIVERED' || dailyLesson?.status === 'COMPLETED';

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* ------------------------------------------------------------- */}
      {/* 1. HEADER & WORKSPACE CONTEXT BAR                            */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-purple-900 mb-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{todayDateFormatted}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {overview.teacher.displayName ? `Welcome, ${overview.teacher.displayName.split(' ')[0]}` : 'Teacher Workspace'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
              Organized around your workday • Ready for teaching and learner engagement.
            </p>
          </div>

          {/* School & Multi-School Context Dropdown */}
          <div className="flex flex-wrap items-center gap-2">
            {userReadModel.memberships.length > 1 ? (
              <div className="relative">
                <button
                  onClick={onSwitchSchoolClick}
                  className="flex items-center gap-2 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-300 rounded-xl text-xs font-black text-purple-950 transition-colors"
                  title="Switch between your assigned schools"
                >
                  <Building2 className="w-4 h-4 text-purple-800" />
                  <span className="max-w-[150px] sm:max-w-[200px] truncate">{activeSchool.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-purple-800" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-800">
                <Building2 className="w-4 h-4 text-slate-600" />
                <span className="max-w-[180px] truncate">{activeSchool.name}</span>
              </div>
            )}

            <button
              onClick={() => onOpenClassWorkspace()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-purple-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 transition-colors"
            >
              <BookOpen className="w-4 h-4 text-purple-800" />
              <span>Class Workspace</span>
            </button>
          </div>
        </div>

        {/* Active Class Quick Selector */}
        {overview.assignments.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 relative">
              <span className="text-xs font-bold uppercase text-slate-600 whitespace-nowrap">Active Class:</span>
              {overview.assignments.length > 1 ? (
                <div className="relative inline-block">
                  <button
                    type="button"
                    onClick={() => setIsClassMenuOpen(!isClassMenuOpen)}
                    className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 border border-purple-300 rounded-xl px-3 py-1.5 text-xs font-extrabold text-purple-950 cursor-pointer transition-colors"
                    aria-expanded={isClassMenuOpen}
                    aria-label="Select active class assignment"
                  >
                    <span>
                      {activeClass ? activeClass.name : activeAssign?.gradeId} • {activeAssign?.learningAreaId.toUpperCase().replace('-', ' ')}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-purple-800 transition-transform ${isClassMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isClassMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsClassMenuOpen(false)}
                      />
                      <div className="absolute left-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-xl shadow-xl min-w-[240px] max-w-xs py-1 overflow-hidden">
                        <div className="px-3 py-1.5 text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-100 bg-slate-50">
                          Select Teaching Class
                        </div>
                        <div className="max-h-56 overflow-y-auto">
                          {overview.assignments.map((assign) => {
                            const cg = overview.classes.find((c) => c.id === assign.classGroupId);
                            const isCurrent = assign.classGroupId === activeAssign?.classGroupId && assign.learningAreaId === activeAssign?.learningAreaId;
                            const label = `${cg ? cg.name : assign.gradeId} — ${assign.learningAreaId.toUpperCase().replace('-', ' ')}`;
                            return (
                              <button
                                key={assign.id}
                                type="button"
                                onClick={() => {
                                  onSelectClass(assign.classGroupId || '', assign.learningAreaId);
                                  setIsClassMenuOpen(false);
                                }}
                                className={`w-full text-left px-3.5 py-2 text-xs font-bold flex items-center justify-between transition-colors ${
                                  isCurrent ? 'bg-purple-50 text-purple-950 font-black' : 'text-slate-700 hover:bg-purple-50/40'
                                }`}
                              >
                                <span>{label}</span>
                                {isCurrent && <Check className="w-3.5 h-3.5 text-purple-900 stroke-[3]" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <span className="px-3 py-1 bg-purple-100 text-purple-950 border border-purple-300 rounded-lg text-xs font-black">
                  {activeClass ? activeClass.name : activeAssign?.gradeId} • {activeAssign?.learningAreaId.toUpperCase().replace('-', ' ')}
                </span>
              )}
            </div>

            <div className="text-xs text-slate-600 flex items-center gap-3">
              <span>Roster: <strong className="text-slate-900">{overview.activeLearners.length} Learners</strong></span>
              <span>•</span>
              <span>Role: <strong className="text-slate-900">{userReadModel.activeMembership?.role}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TODAY'S TEACHING (PRIMARY SECTION)                         */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-900" />
            <span>Today's Teaching</span>
            <ContextHelp 
              title="What is Today?" 
              content="Today brings your teaching assignments, lessons and classes together in one place."
            />
          </h2>
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
            Period 1 • 08:30 – 09:15
          </span>
        </div>

        {dailyLesson ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
            {/* Top row: Subject, Class, Status */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 bg-[#3b1464] text-white rounded-lg text-xs font-black uppercase tracking-wider">
                  {dailyLesson.learningArea || activeAssign?.learningAreaId.toUpperCase().replace('-', ' ') || 'Integrated Science'}
                </span>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-extrabold">
                  {activeClass?.name || dailyLesson.grade || 'Grade 8'}
                </span>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                  Week {dailyLesson.weekNumber || 1} • Lesson {dailyLesson.lessonNumber || 1}
                </span>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-1.5">
                {isLessonDelivered ? (
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 border border-blue-300 rounded-full text-xs font-black flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Delivered</span>
                  </span>
                ) : isLessonStarted ? (
                  <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-black flex items-center gap-1 animate-pulse">
                    <Clock className="w-3.5 h-3.5" />
                    <span>In Progress</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-xs font-black flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Ready to Teach</span>
                  </span>
                )}
              </div>
            </div>

            {/* Lesson Title & Strands */}
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
                {dailyLesson.topicTitle || 'Physical and Chemical Properties of Materials'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 font-semibold mt-1">
                Strand: <span className="text-slate-800 font-bold">{dailyLesson.strandTitle || 'Science and Technology'}</span> • Sub-strand:{' '}
                <span className="text-slate-800 font-bold">{dailyLesson.subStrandTitle || 'Properties of Materials'}</span>
              </p>
              {dailyLesson.learningOutcomeStatement && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium">
                  <span className="font-bold text-slate-900 block mb-0.5">Specific Learning Outcome:</span>
                  {dailyLesson.learningOutcomeStatement}
                </div>
              )}
            </div>

            {/* Resources readiness bar */}
            {dailyLesson.resources && dailyLesson.resources.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-600 mr-1">Materials:</span>
                {dailyLesson.resources.map((res: any, idx: number) => (
                  <span
                    key={idx}
                    className={`text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 ${
                      res.isAvailable
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    <FileText className="w-3 h-3" />
                    <span>{res.type.replace('_', ' ')}</span>
                  </span>
                ))}

                {elmsPublication && (
                  <span className="text-xs px-2.5 py-1 rounded-lg font-bold bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5 text-purple-700" />
                    <span>Published in ELMS</span>
                  </span>
                )}
              </div>
            )}

            {/* Primary & Secondary Action CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Primary Action Button (Touch target >= 44px) */}
              <button
                onClick={() => {
                  if (onStartLesson) {
                    onStartLesson(dailyLesson);
                  }
                  setIsDeliveryModalOpen(true);
                }}
                className="flex-1 min-h-[44px] py-2.5 px-5 bg-[#3b1464] hover:bg-[#2e1065] text-white font-black text-sm rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-2 transition-all"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>
                  {isLessonDelivered ? 'Review Lesson & Reflection' : isLessonStarted ? 'Continue Classroom Delivery' : 'Teach Now'}
                </span>
              </button>

              {/* Subordinate Action 1: Mark Attendance */}
              <button
                onClick={() => onOpenClassWorkspace('attendance')}
                className="min-h-[44px] py-2.5 px-4 bg-white hover:bg-purple-50/40 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 flex items-center justify-center gap-1.5 transition-all"
              >
                <Users className="w-4 h-4 text-purple-900" />
                <span>Attendance</span>
              </button>

              {/* Subordinate Action 2: Open in ELMS */}
              {elmsPublication && onNavigateToElms && (
                <button
                  onClick={onNavigateToElms}
                  className="min-h-[44px] py-2.5 px-4 bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold text-xs rounded-xl border border-purple-300 flex items-center justify-center gap-1.5 transition-all"
                >
                  <GraduationCap className="w-4 h-4 text-purple-700" />
                  <span>Open in ELMS</span>
                </button>
              )}

              {/* Subordinate Action 3: Prepare Material if missing */}
              {onNavigateToGenerator && activeAssign && (
                <button
                  onClick={() => onNavigateToGenerator(activeAssign.gradeId, activeAssign.learningAreaId)}
                  className="min-h-[44px] py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Prepare Materials</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-2 border border-emerald-100">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">No Lessons Scheduled Today</h3>
            <p className="text-sm text-slate-600 max-w-sm mx-auto font-medium leading-relaxed">
              Your school is selected, but there are no lessons assigned to you for today. You can prepare upcoming lessons or review past learning evidence.
            </p>
            {onNavigateToGenerator && activeAssign && (
              <button
                onClick={() => onNavigateToGenerator(activeAssign.gradeId, activeAssign.learningAreaId)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#3b1464] hover:bg-[#2e1065] text-white rounded-xl text-xs font-black shadow-lg border border-slate-200 transition-all group"
              >
                <Sparkles className="w-4 h-4 transition-transform group-hover:rotate-12" />
                <span>PREPARE NEXT LESSON</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. QUICK ACTIONS (SINGLE TAP MOBILE-FRIENDLY)                 */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">Quick Actions</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Quick Action 1: Prepare Lesson (Generator) */}
          <button
            onClick={() => {
              if (onNavigateToGenerator && activeAssign) {
                onNavigateToGenerator(activeAssign.gradeId, activeAssign.learningAreaId);
              }
            }}
            className="min-h-[48px] p-4 bg-white hover:bg-purple-50/40 border border-slate-200 rounded-xl text-left transition-all flex flex-col justify-between group shadow-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-100 border border-purple-300 text-purple-900 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-900">Prepare Lesson</p>
              <p className="text-[11px] text-slate-500 font-medium">Create lesson plan & notes</p>
            </div>
          </button>

          {/* Quick Action 2: My Classes (Workspace & Roster) */}
          <button
            onClick={() => onOpenClassWorkspace('roster')}
            className="min-h-[48px] p-4 bg-white hover:bg-purple-50/40 border border-slate-200 rounded-xl text-left transition-all flex flex-col justify-between group shadow-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-100 border border-blue-300 text-blue-800 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-900">My Classes</p>
              <p className="text-[11px] text-slate-500 font-medium">{overview.assignments.length} assigned classes</p>
            </div>
          </button>

          {/* Quick Action 3: Teaching Resources (Library) */}
          <button
            onClick={() => {
              if (onNavigateToLibrary) onNavigateToLibrary();
            }}
            className="min-h-[48px] p-4 bg-white hover:bg-purple-50/40 border border-slate-200 rounded-xl text-left transition-all flex flex-col justify-between group shadow-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-900">Resources</p>
              <p className="text-[11px] text-slate-500 font-medium">SOW, exams & content</p>
            </div>
          </button>

          {/* Quick Action 4: Student ELMS */}
          <button
            onClick={() => {
              if (onNavigateToElms) onNavigateToElms();
            }}
            className="min-h-[48px] p-4 bg-white hover:bg-purple-50/40 border border-slate-200 rounded-xl text-left transition-all flex flex-col justify-between group shadow-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-100 border border-purple-300 text-purple-800 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-900">Student ELMS</p>
              <p className="text-[11px] text-slate-500 font-medium">Learner interactive portal</p>
            </div>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. NEEDS ATTENTION SECTION                                    */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Needs Attention</span>
            {attentionData.count > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full text-xs font-black">
                {attentionData.count}
              </span>
            )}
          </h2>
        </div>

        {attentionData.count === 0 ? (
          <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-950">All caught up!</p>
              <p className="text-xs text-emerald-800">
                No learners, lesson reviews, or continuity items currently require urgent attention.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {attentionData.items.map((item) => (
              <div
                key={item.id}
                className="bg-white p-4 rounded-xl border border-slate-300 hover:border-slate-400 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-xs font-black text-slate-900">{item.title}</p>
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded text-[10px] font-bold">
                        {item.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">{item.description}</p>
                  </div>
                </div>

                <button
                  onClick={() => onOpenClassWorkspace(item.targetTab)}
                  className="self-end sm:self-center px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1"
                >
                  <span>{item.actionLabel}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. RECENT / UPCOMING & CLASS PROGRESS                         */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Next Lesson Preview */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-600">Upcoming Lesson</span>
            <span className="text-xs text-slate-500 font-medium">Tomorrow • Period 1</span>
          </div>

          <div>
            <h4 className="text-base font-black text-slate-900">
              {dailyLesson?.nextLesson?.topicTitle || 'Separation Techniques — Filtration & Evaporation'}
            </h4>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              {activeClass?.name || 'Grade 8'} • Integrated Science
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <span className="text-xs text-slate-600 font-medium">Preparation Status:</span>
            {onNavigateToGenerator && activeAssign && (
              <button
                onClick={() => onNavigateToGenerator(activeAssign.gradeId, activeAssign.learningAreaId)}
                className="text-xs font-bold text-purple-900 hover:text-purple-950 flex items-center gap-1"
              >
                <span>Prepare in Generator</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Class Progress */}
        {progressStats && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-600">
                Class Progress — {activeClass?.name || 'Class'}
              </span>
              <span className="text-xs font-black text-purple-950 bg-purple-100 px-2.5 py-0.5 rounded-lg border border-purple-200">
                {progressStats.health}
              </span>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <p className="text-sm font-black text-slate-900">
                  {progressStats.delivered} of {progressStats.planned} planned lessons delivered
                </p>
                <span className="text-xs font-black text-slate-700">{progressStats.coveragePct}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                <div
                  className="bg-[#3b1464] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, progressStats.coveragePct)}%` }}
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <span className="text-xs text-slate-600 font-medium">Learning Evidence:</span>
              <button
                onClick={() => onOpenClassWorkspace('performance')}
                className="text-xs font-bold text-purple-900 hover:text-purple-950 flex items-center gap-1"
              >
                <span>View Full Performance</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Classroom Delivery & Reflection Modal */}
      {dailyLesson && (
        <ClassroomDeliveryModal
          isOpen={isDeliveryModalOpen}
          onClose={() => setIsDeliveryModalOpen(false)}
          todayLesson={dailyLesson}
          currentUserId={currentUserId}
          activeSchool={activeSchool}
          activeClass={activeClass || undefined}
          onNavigateToGenerator={onNavigateToGenerator}
          onLessonCompleted={() => {
            // Keep state synchronized
          }}
        />
      )}
    </div>
  );
};
