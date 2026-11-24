import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, X, GraduationCap, School, BookOpen } from 'lucide-react';

export interface SchoolLevelOption {
  id: string;
  name: string;
  gradeRange: string;
  description: string;
}

export const SCHOOL_LEVEL_OPTIONS: SchoolLevelOption[] = [
  {
    id: 'Primary',
    name: 'Primary',
    gradeRange: 'Grade 1–6',
    description: 'Foundational & Intermediate primary curriculum (Grades 1 to 6)',
  },
  {
    id: 'Junior Secondary',
    name: 'Junior Secondary',
    gradeRange: 'Grade 7–9',
    description: 'Junior secondary educational cycle (Grades 7 to 9)',
  },
  {
    id: 'Senior Secondary',
    name: 'Senior Secondary',
    gradeRange: 'Grade 10–12',
    description: 'Senior school specialization pathways (Grades 10 to 12)',
  },
  {
    id: 'Comprehensive',
    name: 'Comprehensive',
    gradeRange: 'Grade 1–10',
    description: 'Combined primary through junior secondary & senior cycle (Grades 1 to 10)',
  },
];

interface SchoolLevelSelectorProps {
  value: string;
  onChange: (level: string) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
}

export const SchoolLevelSelector: React.FC<SchoolLevelSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  id = 'school-level-selector',
  label = 'School Level',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Normalize selected option
  const selectedOption = SCHOOL_LEVEL_OPTIONS.find(
    (opt) => opt.id.toLowerCase() === value.toLowerCase()
  ) || SCHOOL_LEVEL_OPTIONS[0];

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="relative w-full">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-bold text-slate-700 mb-1"
        >
          {label} *
        </label>
      )}

      {/* Trigger Button: Custom ECG UI (No native <select>) */}
      <button
        type="button"
        id={id}
        ref={triggerRef}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`${label}: currently selected ${selectedOption.name} (${selectedOption.gradeRange})`}
        className={`w-full min-h-[44px] px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-left text-sm font-medium flex items-center justify-between transition-all focus:outline-none focus:ring-2 focus:ring-purple-400 ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'cursor-pointer hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <GraduationCap className="w-4 h-4 text-purple-900 flex-shrink-0" />
          <span className="font-bold text-slate-900 truncate">
            {selectedOption.name}
          </span>
          <span className="text-xs text-slate-500 font-semibold truncate hidden xs:inline sm:inline">
            ({selectedOption.gradeRange})
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0 ml-2" />
      </button>

      {/* Custom Modal / Bottom Sheet */}
      {isOpen && (
        <div
          role="presentation"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 transition-opacity animate-in fade-in duration-150"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="school-level-title"
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border-t-2 sm:border-2 border-slate-200 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 transition-transform animate-in slide-in-from-bottom-4 duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 border border-slate-200 text-purple-950 flex items-center justify-center">
                  <School className="w-4 h-4" />
                </div>
                <div>
                  <h3
                    id="school-level-title"
                    className="text-sm font-black uppercase tracking-wider text-slate-900"
                  >
                    Select School Level
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Choose the grade span for this school profile
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close selector"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Options List */}
            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-0.5">
              {SCHOOL_LEVEL_OPTIONS.map((option) => {
                const isSelected =
                  option.id.toLowerCase() === selectedOption.id.toLowerCase();

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelect(option.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between min-h-[52px] group ${
                      isSelected
                        ? 'border-purple-900 bg-purple-50/70 shadow-sm'
                        : 'border-slate-300 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex-1 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900">
                          {option.name}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                            isSelected
                              ? 'bg-purple-900 text-white'
                              : 'bg-slate-100 text-slate-700 group-hover:bg-slate-200'
                          }`}
                        >
                          {option.gradeRange}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium leading-relaxed">
                        {option.description}
                      </p>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-purple-900 text-white'
                          : 'border border-slate-300 group-hover:border-slate-400'
                      }`}
                    >
                      {isSelected ? (
                        <Check className="w-4 h-4 stroke-[3]" />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Cancel Action */}
            <div className="mt-5 pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
