import React, { useState } from 'react';
import { TeacherAssignmentService } from '../services/teacherAssignmentService.ts';
import { ClassGroupService } from '../services/classGroupService.ts';
import { SchoolMembershipService } from '../services/schoolMembershipService.ts';
import { X, UserCheck, AlertCircle } from 'lucide-react';

interface AssignTeacherModalProps {
  schoolId: string;
  currentUserId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignTeacherModal: React.FC<AssignTeacherModalProps> = ({
  schoolId,
  currentUserId,
  onClose,
  onSuccess,
}) => {
  const [targetTeacherId, setTargetTeacherId] = useState('');
  const [gradeId, setGradeId] = useState('grade-3');
  const [classGroupId, setClassGroupId] = useState('');
  const [learningAreaId, setLearningAreaId] = useState('cre');
  const [academicYearId, setAcademicYearId] = useState('ay_lwps_2026');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const memberships = SchoolMembershipService.getSchoolMemberships(schoolId, currentUserId);
  const classGroups = ClassGroupService.getClassGroupsBySchool(schoolId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTeacherId) {
      setErrorMsg('Please select a teacher.');
      return;
    }
    setErrorMsg(null);

    try {
      TeacherAssignmentService.assignTeacher({
        schoolId,
        teacherId: targetTeacherId,
        gradeId,
        classGroupId: classGroupId || undefined,
        learningAreaId,
        academicYearId,
        requestingUserId: currentUserId,
      });
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to assign teacher.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 relative shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 text-emerald-800 font-black">
            <UserCheck className="w-5 h-5" />
            <h3 className="text-lg uppercase">Assign Teacher</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-300 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
              Select Teacher *
            </label>
            <select
              value={targetTeacherId}
              onChange={(e) => setTargetTeacherId(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm font-semibold bg-white"
              required
            >
              <option value="">-- Select Member Teacher --</option>
              {memberships.map((mem) => {
                const profile = SchoolMembershipService.getTeacherProfile(mem.userId);
                return (
                  <option key={mem.id} value={mem.userId}>
                    {profile.displayName} ({mem.role})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Grade *
              </label>
              <select
                value={gradeId}
                onChange={(e) => setGradeId(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-sm font-semibold bg-white"
              >
                <option value="grade-1">Grade 1</option>
                <option value="grade-2">Grade 2</option>
                <option value="grade-3">Grade 3</option>
                <option value="grade-4">Grade 4</option>
                <option value="grade-5">Grade 5</option>
                <option value="grade-6">Grade 6</option>
                <option value="grade-7">Grade 7</option>
                <option value="grade-8">Grade 8</option>
                <option value="grade-9">Grade 9</option>
                <option value="grade-10">Grade 10</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Class Stream
              </label>
              <select
                value={classGroupId}
                onChange={(e) => setClassGroupId(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-sm font-semibold bg-white"
              >
                <option value="">-- Grade Level (No Stream) --</option>
                {classGroups.map((cg) => (
                  <option key={cg.id} value={cg.id}>
                    {cg.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
              Learning Area (Subject) *
            </label>
            <select
              value={learningAreaId}
              onChange={(e) => setLearningAreaId(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm font-semibold bg-white"
            >
              <option value="cre">CRE (Christian Religious Education)</option>
              <option value="mathematics">Mathematics</option>
              <option value="english">English Language</option>
              <option value="kiswahili">Kiswahili</option>
              <option value="integrated-science">Integrated Science</option>
              <option value="social-studies">Social Studies</option>
              <option value="agriculture">Agriculture</option>
              <option value="creative-arts">Creative Arts</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="app-btn app-btn-primary text-xs px-5 py-2 font-bold"
            >
              Confirm Assignment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
