import React, { useState, useEffect } from 'react';
import { SchoolProfile, TeachingConfig } from '../types/school.ts';
import { SchoolMembership, TeacherTeachingContext } from '../types/teacherOnboarding.ts';
import { SchoolConfigService } from '../services/schoolConfigService.ts';
import { SchoolMembershipService } from '../services/schoolMembershipService.ts';
import { Search, Plus, Building2, Check, AlertTriangle, ArrowRight, BookOpen, GraduationCap, Calendar, ShieldCheck, ArrowLeft, X } from 'lucide-react';
import { KENYA_COUNTIES } from '../constants/kenyaCounties.ts';
import { CustomSelect } from './CustomSelect.tsx';
import { SchoolLevelSelector } from './SchoolLevelSelector.tsx';
import { CheckboxDropdown, CheckboxOption } from './CheckboxDropdown.tsx';

const GRADE_OPTIONS: CheckboxOption[] = [
  { value: 'Grade 1', label: 'Grade 1' },
  { value: 'Grade 2', label: 'Grade 2' },
  { value: 'Grade 3', label: 'Grade 3' },
  { value: 'Grade 4', label: 'Grade 4' },
  { value: 'Grade 5', label: 'Grade 5' },
  { value: 'Grade 6', label: 'Grade 6' },
  { value: 'Grade 7', label: 'Grade 7' },
  { value: 'Grade 8', label: 'Grade 8' },
  { value: 'Grade 9', label: 'Grade 9' },
  { value: 'Grade 10', label: 'Grade 10' },
];

const SUBJECT_OPTIONS: CheckboxOption[] = [
  { value: 'Integrated Science', label: 'Integrated Science' },
  { value: 'Mathematics', label: 'Mathematics' },
  { value: 'English', label: 'English' },
  { value: 'Kiswahili', label: 'Kiswahili' },
  { value: 'Creative Arts and Sports', label: 'Creative Arts and Sports' },
  { value: 'Agriculture and Nutrition', label: 'Agriculture and Nutrition' },
  { value: 'Social Studies', label: 'Social Studies' },
];

interface OnboardingModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onCompleted: (school: SchoolProfile, membership: SchoolMembership, context?: TeacherTeachingContext) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  userId,
  isOpen,
  onClose,
  onCompleted,
}) => {
  const [step, setStep] = useState<'DISCOVER' | 'CREATE' | 'DUPLICATE_WARN' | 'TEACHING_CONTEXT'>('DISCOVER');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SchoolProfile[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<SchoolProfile | null>(null);

  // New School Form State
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolType, setNewSchoolType] = useState('Primary');
  const [newCounty, setNewCounty] = useState('Nairobi City');
  const [duplicateMatches, setDuplicateMatches] = useState<SchoolProfile[]>([]);

  // Teaching Context State
  const [selectedGrades, setSelectedGrades] = useState<string[]>(['Grade 8']);
  const [selectedLearningAreas, setSelectedLearningAreas] = useState<string[]>(['Integrated Science']);
  const [selectedTerm, setSelectedTerm] = useState('Term 1');

  // Handle Escape key to predictably close the modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.trim().length > 0) {
      setSearchResults(SchoolConfigService.searchSchools(q));
    } else {
      setSearchResults([]);
    }
  };

  const handleJoinSchool = (school: SchoolProfile) => {
    try {
      const membership = SchoolMembershipService.requestJoinSchool(userId, school.id, 'TEACHER');
      setSelectedSchool(school);
      setStep('TEACHING_CONTEXT');
    } catch (err: any) {
      alert(err.message || 'Error joining school');
    }
  };

  const handleCheckAndCreateSchool = () => {
    if (!newSchoolName.trim()) {
      alert('Please enter a school name');
      return;
    }

    const check = SchoolConfigService.checkDuplicateSchool(newSchoolName);
    if (check.isDuplicateLikely) {
      setDuplicateMatches(check.matchingSchools);
      setStep('DUPLICATE_WARN');
      return;
    }

    executeCreateSchool();
  };

  const executeCreateSchool = () => {
    try {
      const { school, membership } = SchoolMembershipService.createSchoolWithMembership(userId, {
        name: newSchoolName,
        schoolType: newSchoolType,
        country: 'Kenya',
        county: newCounty,
      });

      setSelectedSchool(school);
      setStep('TEACHING_CONTEXT');
    } catch (err: any) {
      alert(err.message || 'Error creating school');
    }
  };

  const handleFinishContext = () => {
    if (!selectedSchool) return;

    const membership = SchoolMembershipService.getActiveSchoolMembership(userId)?.membership ||
      SchoolMembershipService.getMemberships(userId)[0];

    const context = SchoolMembershipService.setTeachingContext(userId, {
      schoolId: selectedSchool.id,
      teacherId: userId,
      gradeId: selectedGrades[0]?.toLowerCase().replace(' ', '-') || 'grade-8',
      learningAreaId: selectedLearningAreas[0] === 'Integrated Science' ? 'la-sci' : 'la-math',
      termId: selectedTerm,
    });

    onCompleted(selectedSchool, membership, context);
    onClose();
  };

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white border-2 border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 relative transition-all"
      >
        {/* TOP ESCAPE / NAVIGATION BAR */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
          <button
            type="button"
            onClick={step === 'DISCOVER' ? onClose : () => setStep('DISCOVER')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-300"
            aria-label={step === 'DISCOVER' ? 'Cancel and return to dashboard' : 'Back to school search'}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{step === 'DISCOVER' ? 'Back / Cancel' : 'Back'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal and return to dashboard"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: DISCOVER & JOIN */}
        {step === 'DISCOVER' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-100 rounded-xl border border-slate-200 text-purple-900">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h2 id="onboarding-modal-title" className="text-xl font-black text-slate-900">
                  Welcome to ECG! Find Your School
                </h2>
                <p className="text-sm text-slate-600">Search for your school or create a new school to get started.</p>
              </div>
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Search school by name (e.g., Lizzie Wanyoike, Hillside...)"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mb-6 space-y-3 max-h-60 overflow-y-auto pr-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Matching Schools ({searchResults.length})</p>
                {searchResults.map((school) => (
                  <div key={school.id} className="p-4 border border-slate-200 rounded-xl flex items-center justify-between bg-slate-50 hover:bg-purple-50/50 transition-colors">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{school.name}</p>
                      <p className="text-xs text-slate-500">{school.schoolType || 'Primary'} • {school.country || 'Kenya'}</p>
                    </div>
                    <button
                      onClick={() => handleJoinSchool(school)}
                      className="px-4 py-2 bg-[#3b1464] text-white font-bold text-xs rounded-lg border border-slate-200 hover:bg-[#2e1065] transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <span>Join School</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {searchQuery.trim().length > 0 && searchResults.length === 0 && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl mb-6 text-center text-xs text-amber-800">
                No existing school matched &quot;{searchQuery}&quot;. You can create it as a new school below!
              </div>
            )}

            {/* Action Option to Create New School and Cancel */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Can&apos;t find your school?</p>
                <p className="text-xs text-slate-500">Create a new school profile in 30 seconds.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 border border-slate-200 text-xs font-bold rounded-xl text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep('CREATE')}
                  className="px-4 py-2.5 bg-[#3b1464] text-white text-xs font-bold rounded-xl border border-slate-200 hover:bg-[#2e1065] transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create New School</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: CREATE NEW SCHOOL */}
        {step === 'CREATE' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-100 rounded-xl border border-slate-200 text-purple-900">
                <Plus className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Create a New School</h2>
                <p className="text-sm text-slate-600">You will be designated as the initial School Admin.</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">School Name *</label>
                <input
                  type="text"
                  value={newSchoolName}
                  onChange={(e) => setNewSchoolName(e.target.value)}
                  placeholder="e.g. St. Andrew's Academy"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Custom ECG SchoolLevelSelector Component */}
                <div>
                  <SchoolLevelSelector
                    value={newSchoolType}
                    onChange={(level) => setNewSchoolType(level)}
                    label="School Level"
                    id="new-school-level-selector"
                  />
                </div>

                <div>
                  <CustomSelect
                    label="County *"
                    options={KENYA_COUNTIES as unknown as string[]}
                    value={newCounty}
                    onChange={setNewCounty}
                    placeholder="Select a county"
                    searchable
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setStep('DISCOVER')}
                className="px-4 py-2 border border-slate-200 text-xs font-bold rounded-xl text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                onClick={handleCheckAndCreateSchool}
                className="px-6 py-2.5 bg-[#3b1464] text-white text-xs font-bold rounded-xl border border-slate-200 hover:bg-[#2e1065] flex items-center gap-2 shadow-sm"
              >
                <span>Continue to Teaching Setup</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* DUPLICATE WARNING MODAL */}
        {step === 'DUPLICATE_WARN' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-amber-100 rounded-xl border border-slate-200 text-amber-800">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Similar School Found</h2>
                <p className="text-sm text-slate-600">A school with a similar name already exists in ECG.</p>
              </div>
            </div>

            <div className="mb-6 space-y-3">
              <p className="text-xs font-bold text-slate-600">Existing matching schools:</p>
              {duplicateMatches.map((match) => (
                <div key={match.id} className="p-3 border border-slate-300 rounded-xl flex items-center justify-between bg-slate-50">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{match.name}</p>
                    <p className="text-xs text-slate-500">{match.schoolType} • {match.country}</p>
                  </div>
                  <button
                    onClick={() => handleJoinSchool(match)}
                    className="px-3 py-1.5 bg-[#3b1464] text-white text-xs font-semibold rounded-lg border border-slate-200 hover:bg-[#2e1065]"
                  >
                    Join Existing
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <button
                onClick={() => setStep('CREATE')}
                className="px-4 py-2 border border-slate-200 text-xs font-bold rounded-xl text-slate-700"
              >
                Edit Name
              </button>
              <button
                onClick={executeCreateSchool}
                className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl border border-slate-200 hover:bg-black"
              >
                Create New School Anyway
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: TEACHING CONTEXT SELECTION */}
        {step === 'TEACHING_CONTEXT' && selectedSchool && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-100 rounded-xl border border-slate-200 text-purple-900">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Configure Your Teaching Context</h2>
                <p className="text-sm text-slate-600">Active School: <strong className="text-purple-950">{selectedSchool.name}</strong></p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <CheckboxDropdown
                  label="Grade / Class"
                  options={GRADE_OPTIONS}
                  selectedValues={selectedGrades}
                  onChange={setSelectedGrades}
                  placeholder="Select grades"
                />
              </div>

              <div>
                <CheckboxDropdown
                  label="Learning Area / Subject"
                  options={SUBJECT_OPTIONS}
                  selectedValues={selectedLearningAreas}
                  onChange={setSelectedLearningAreas}
                  placeholder="Select subjects"
                />
              </div>

              <div>
                <CustomSelect
                  label="Academic Term"
                  options={['Term 1', 'Term 2', 'Term 3']}
                  value={selectedTerm}
                  onChange={setSelectedTerm}
                  placeholder="Select term"
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-slate-200">
              <button
                onClick={handleFinishContext}
                className="px-6 py-2.5 bg-[#3b1464] text-white text-xs font-bold rounded-xl border border-slate-200 hover:bg-[#2e1065] flex items-center gap-2 shadow-md"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Start Teaching Now</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

