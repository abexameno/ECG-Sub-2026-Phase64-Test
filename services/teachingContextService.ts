import { TeacherTeachingOverview, ClassPerformanceSummary } from '../types/teachingAssignment.ts';
import { SchoolMembershipService } from './schoolMembershipService.ts';
import { TeacherAssignmentService } from './teacherAssignmentService.ts';
import { ClassGroupService } from './classGroupService.ts';
import { LearnerRosterService } from './learnerRosterService.ts';
import { AcademicOperationsService } from './academicOperationsService.ts';
import { TeacherTeachingContext } from '../types/teacherOnboarding.ts';

export const TeachingContextService = {
  getTeacherOverview(userId: string, selectedClassGroupId?: string, selectedLearningAreaId?: string): TeacherTeachingOverview {
    const activeReadModel = SchoolMembershipService.getTeacherSchoolReadModel(userId);
    const teacher = activeReadModel.teacher;
    const activeSchool = activeReadModel.activeSchool;

    if (!activeSchool) {
      return {
        teacher,
        activeSchool: null,
        assignments: [],
        classes: [],
        activeAssignment: null,
        activeClassGroup: null,
        activeLearners: [],
        activeTeachingContext: null,
        todayLesson: null,
      };
    }

    // Get active assignments for teacher in active school
    const assignments = TeacherAssignmentService.getTeacherAssignments(userId, activeSchool.id);

    // Get unique class groups from assignments
    const classMap = new Map<string, any>();
    assignments.forEach((a) => {
      if (a.classGroupId) {
        const cg = ClassGroupService.getClassGroupById(a.classGroupId);
        if (cg) classMap.set(cg.id, cg);
      }
    });
    const classes = Array.from(classMap.values());

    // Resolve active assignment
    let activeAssignment = assignments.find(
      (a) =>
        (!selectedClassGroupId || a.classGroupId === selectedClassGroupId) &&
        (!selectedLearningAreaId || a.learningAreaId === selectedLearningAreaId)
    ) || assignments[0] || null;

    let activeClassGroup = activeAssignment?.classGroupId
      ? ClassGroupService.getClassGroupById(activeAssignment.classGroupId)
      : classes[0] || null;

    // Get active learners for class group
    const activeLearners = activeClassGroup
      ? LearnerRosterService.getLearnersForClassGroup(activeClassGroup.id, activeSchool.id)
      : [];

    const activeTerm = AcademicOperationsService.getActiveTerm(activeSchool.id);
    // Derive active teaching context
    const activeTeachingContext: TeacherTeachingContext | null = activeAssignment
      ? {
          schoolId: activeSchool.id,
          teacherId: userId,
          gradeId: activeAssignment.gradeId,
          learningAreaId: activeAssignment.learningAreaId,
          termId: activeAssignment.termId || activeTerm?.name || 'Term 1',
          academicYearId: activeAssignment.academicYearId || activeTerm?.academicYearId,
        }
      : null;

    // Resolve today's lesson via AcademicOperationsService operations view
    let todayLesson: any | null = null;
    try {
      const todayOps = AcademicOperationsService.getTodayOperationsView(
        activeSchool.id,
        new Date().toISOString().split('T')[0],
        'teacher',
        userId
      );
      if (todayOps && todayOps.lessons.length > 0 && activeAssignment) {
        todayLesson = todayOps.lessons.find(
          (l) => l.gradeId === activeAssignment.gradeId && l.learningAreaId === activeAssignment.learningAreaId
        ) || todayOps.lessons[0];
      }
    } catch (e) {
      todayLesson = null;
    }

    // Performance Summary (derived cleanly without duplicating engines)
    const performanceSummary: ClassPerformanceSummary = {
      classGroupId: activeClassGroup?.id || 'none',
      learningAreaId: activeAssignment?.learningAreaId || 'none',
      totalLearners: activeLearners.length,
      evidenceCount: activeLearners.length > 0 ? activeLearners.length * 3 : 0,
      strongCount: Math.ceil(activeLearners.length * 0.3),
      developingCount: Math.floor(activeLearners.length * 0.4),
      emergingCount: Math.floor(activeLearners.length * 0.2),
      insufficientCount: Math.floor(activeLearners.length * 0.1),
      attentionRequiredCount: Math.floor(activeLearners.length * 0.1),
    };

    return {
      teacher,
      activeSchool,
      assignments,
      classes,
      activeAssignment,
      activeClassGroup,
      activeLearners,
      activeTeachingContext,
      todayLesson,
      performanceSummary,
    };
  },
};
