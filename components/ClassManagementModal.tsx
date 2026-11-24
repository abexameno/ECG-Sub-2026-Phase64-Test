import React, { useState } from 'react';
import { ClassGroupService } from '../services/classGroupService.ts';
import { LearnerRosterService } from '../services/learnerRosterService.ts';
import { X, Plus, AlertCircle, CheckCircle } from 'lucide-react';

interface ClassManagementModalProps {
  schoolId: string;
  currentUserId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ClassManagementModal: React.FC<ClassManagementModalProps> = ({
  schoolId,
  currentUserId,
  onClose,
  onSuccess,
}) => {
  const [gradeId, setGradeId] = useState('grade-3');
  const [className, setClassName] = useState('Grade 3A');
  const [academicYearId, setAcademicYearId] = useState('ay_lwps_2026');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) {
      setErrorMsg('Class name is required.');
      return;
    }
    setErrorMsg(null);

    try {
      ClassGroupService.createClassGroup({
        schoolId,
        name: className.trim(),
        gradeId,
        academicYearId,
        requestingUserId: currentUserId,
      });
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create class.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 relative shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 text-emerald-800 font-black">
            <Plus className="w-5 h-5" />
            <h3 className="text-lg uppercase">Create Class Group</h3>
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

        <form onSubmit={handleCreateClass} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
              Select Grade / Academic Level *
            </label>
            <select
              value={gradeId}
              onChange={(e) => {
                setGradeId(e.target.value);
                setClassName(`${e.target.value.replace('grade-', 'Grade ')}A`);
              }}
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
              Class / Stream Name *
            </label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g. Grade 3A, Grade 3 East, or Grade 3"
              className="w-full px-3 py-2 border rounded-xl text-sm font-semibold bg-white"
              required
            />
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
              Create Class Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
