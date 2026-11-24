import React from 'react';
import { SchoolMembership } from '../types/teacherOnboarding.ts';
import { SchoolConfigService } from '../services/schoolConfigService.ts';
import { Building2, Check, Plus, ArrowRight } from 'lucide-react';

interface SchoolSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  memberships: SchoolMembership[];
  activeSchoolId?: string;
  onSelectSchool: (schoolId: string) => void;
  onOpenOnboarding: () => void;
}

export const SchoolSwitchModal: React.FC<SchoolSwitchModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
  memberships,
  activeSchoolId,
  onSelectSchool,
  onOpenOnboarding,
}) => {
  if (!isOpen) return null;

  const activeMemberships = memberships.filter(m => m.status === 'ACTIVE');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white border-2 border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 bg-purple-100 border border-slate-200 rounded-xl text-purple-950">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">Switch Active School</h3>
            <p className="text-xs text-slate-500 font-medium">Select the school teaching context to switch to.</p>
          </div>
        </div>

        <div className="space-y-3 mb-6 max-h-64 overflow-y-auto pr-1">
          {activeMemberships.map((mem) => {
            const school = SchoolConfigService.getSchoolProfile(mem.schoolId);
            const isCurrent = mem.schoolId === activeSchoolId;

            return (
              <div
                key={mem.id}
                onClick={() => {
                  onSelectSchool(mem.schoolId);
                  onClose();
                }}
                className={`p-3.5 border rounded-xl cursor-pointer flex items-center justify-between transition-colors ${
                  isCurrent ? 'bg-purple-50 border-purple-900 shadow-sm' : 'border-slate-300 bg-slate-50 hover:bg-purple-50/40 hover:border-slate-200'
                }`}
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">{school.name}</p>
                  <p className="text-xs text-slate-500 font-medium">{school.schoolType || 'Primary'} • Role: {mem.role}</p>
                </div>
                {isCurrent && (
                  <div className="p-1 bg-[#3b1464] text-white rounded-full">
                    <Check className="h-4 w-4 stroke-[3]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => {
              onClose();
              onOpenOnboarding();
            }}
            className="px-4 py-2 bg-[#3b1464] text-white text-xs font-bold rounded-xl border border-slate-200 hover:bg-[#2e1065] flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Join or Create School</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-xs font-bold rounded-xl text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
