import React, { useState, useEffect } from 'react';
import { TeachingContextService } from '../services/teachingContextService.ts';
import { SchoolMembershipService } from '../services/schoolMembershipService.ts';
import { SchoolConfigService } from '../services/schoolConfigService.ts';
import { SchoolDirectoryService } from '../services/schoolDirectoryService.ts';
import { KENYA_COUNTIES } from '../constants/kenyaCounties.ts';
import { ClassWorkspacePanel } from './ClassWorkspacePanel.tsx';
import { TeacherWorkdayDashboard } from './TeacherWorkdayDashboard.tsx';
import { SchoolSwitchModal } from './SchoolSwitchModal.tsx';
import { OnboardingModal } from './OnboardingModal.tsx';
import { AssignTeacherModal } from './AssignTeacherModal.tsx';
import { ClassManagementModal } from './ClassManagementModal.tsx';
import { AdminDirectoryCsvManagement } from './AdminDirectoryCsvManagement.tsx';
import { DirectoryFilters } from '../types/schoolDirectory.ts';
import { BookOpen, Users, School, ChevronRight, Plus, Calendar, AlertCircle, ArrowLeft, LayoutDashboard, Info, Search, CheckCircle, Shield, ArrowRight, Sparkles, Database, Filter, Building, MapPin, Check, RefreshCw, FileSpreadsheet, X } from 'lucide-react';
import { ContextHelp } from './ContextHelp.tsx';

interface TeacherTeachingViewProps {
  currentUserId: string;
  initialViewMode?: 'my-school' | 'dashboard' | 'workspace';
  onNavigateToGenerator?: (grade: string, subject: string, extraContext?: any) => void;
  onNavigateToLibrary?: () => void;
  onNavigateToElms?: () => void;
  onStartLesson?: (todayLesson: any) => void;
}

export const TeacherTeachingView: React.FC<TeacherTeachingViewProps> = ({
  currentUserId,
  initialViewMode = 'my-school',
  onNavigateToGenerator,
  onNavigateToLibrary,
  onNavigateToElms,
  onStartLesson,
}) => {
  const [viewMode, setViewMode] = useState<'my-school' | 'dashboard' | 'workspace'>(initialViewMode);
  const [workspaceInitialTab, setWorkspaceInitialTab] = useState<any>('today');
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined);
  const [selectedLearningAreaId, setSelectedLearningAreaId] = useState<string | undefined>(undefined);
  const [showSchoolSwitch, setShowSchoolSwitch] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);

  const overview = TeachingContextService.getTeacherOverview(currentUserId, selectedClassId, selectedLearningAreaId);
  const userReadModel = SchoolMembershipService.getTeacherSchoolReadModel(currentUserId);
  const isSchoolAdmin = userReadModel.activeMembership?.role === 'SCHOOL_ADMIN' || userReadModel.activeMembership?.role === 'SUPER_ADMIN' || userReadModel.activeMembership?.role === 'ACADEMIC_ADMIN';

  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<DirectoryFilters>({
    county: '',
    subCounty: '',
    schoolType: '',
    ownership: '',
    educationLevel: '',
    nemisCode: '',
    knecCode: '',
  });
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [showCsvAdminModal, setShowCsvAdminModal] = useState(false);
  const [activeSelectorModal, setActiveSelectorModal] = useState<'county' | 'schoolType' | 'ownership' | 'educationLevel' | 'regCounty' | 'regType' | null>(null);
  const [selectorSearchQuery, setSelectorSearchQuery] = useState('');

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [pipelineStats, setPipelineStats] = useState<any | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [claimingSchool, setClaimingSchool] = useState<any | null>(null);
  const [registeringSchool, setRegisteringSchool] = useState(false);

  // Custom Claim Overrides
  const [claimGrades, setClaimGrades] = useState<string[]>(['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8']);
  const [claimSubjects, setClaimSubjects] = useState<string[]>(['la-sci', 'la-math', 'la-eng', 'la-kis']);

  // Custom Registration Form State
  const [regName, setRegName] = useState('');
  const [regType, setRegType] = useState('Primary');
  const [regCounty, setRegCounty] = useState('Nairobi City');
  const [regSubCounty, setRegSubCounty] = useState('');
  const [regCode, setRegCode] = useState('');

  // Report & coverage state
  const [showReports, setShowReports] = useState(false);
  const [countySearch, setCountySearch] = useState('');

  // Search effect
  useEffect(() => {
    const fetchDir = async () => {
      const res = await SchoolDirectoryService.searchDirectory(searchQuery, filters);
      setSearchResults(res);
    };
    fetchDir();
  }, [searchQuery, filters]);

  const activeFilterCount = Object.values(filters).filter(v => Boolean(v && v.trim())).length;

  const handleClearFilters = () => {
    setFilters({
      county: '',
      subCounty: '',
      schoolType: '',
      ownership: '',
      educationLevel: '',
      nemisCode: '',
      knecCode: '',
    });
  };

  const handleRunPipeline = async () => {
    setIsImporting(true);
    try {
      const stats = await SchoolDirectoryService.runImportPipeline();
      setPipelineStats(stats);
      const res = await SchoolDirectoryService.searchDirectory(searchQuery);
      setSearchResults(res);
    } catch (err: any) {
      alert('Error running pipeline: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClaimAndActivate = async (dirSchoolId: string) => {
    try {
      await SchoolDirectoryService.claimAndActivateSchool(dirSchoolId, currentUserId, {
        gradesOffered: claimGrades,
        learningAreasOffered: claimSubjects
      });
      window.location.reload();
    } catch (err: any) {
      alert('Error claiming school: ' + err.message);
    }
  };

  const handleRegisterMissing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) {
      alert('School name is required');
      return;
    }
    try {
      await SchoolDirectoryService.registerMissingSchool({
        name: regName,
        schoolType: regType,
        county: regCounty,
        subCounty: regSubCounty,
        officialSchoolCode: regCode,
        gradesOffered: claimGrades,
        learningAreasOffered: claimSubjects
      }, currentUserId);
      window.location.reload();
    } catch (err: any) {
      alert('Error registering school: ' + err.message);
    }
  };

  if (viewMode === 'my-school') {
    const handleSwitchSchool = (schoolId: string) => {
      SchoolMembershipService.setActiveSchool(currentUserId, schoolId);
      window.location.reload();
    };

    const handleJoinSchool = (schoolId: string) => {
      SchoolMembershipService.addTeacherMembership({
        userId: currentUserId,
        schoolId: schoolId,
        role: 'TEACHER',
        status: 'ACTIVE',
      });
      SchoolMembershipService.setActiveSchool(currentUserId, schoolId);
      window.location.reload();
    };

    return (
      <div className="space-y-6 font-sans max-w-5xl mx-auto p-4 sm:p-6 bg-slate-50/50 rounded-3xl border border-slate-200 shadow-3xs">
        {/* Title Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-[#3b1464] font-black border border-purple-200 shadow-2xs">
              <School className="w-6 h-6 text-[#3b1464]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">MY SCHOOL</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Find and connect your school, or manage your active school context.</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {overview.activeSchool && (
              <button
                type="button"
                onClick={() => setViewMode('dashboard')}
                className="bg-[#3b1464] hover:bg-[#2e1065] text-white px-4 py-2.5 rounded-xl font-bold text-xs border border-slate-200/20 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Go to Teaching Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 1. TOP SUMMARY: ACTIVE SCHOOL & AUTHORIZED MEMBERSHIPS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Active Profile Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-3xs space-y-3">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Active School Context
            </h2>

            {overview.activeSchool ? (
              <div className="space-y-2 text-xs">
                <div>
                  <h3 className="text-sm font-black text-slate-900">{overview.activeSchool.name}</h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-purple-50 text-[#3b1464] border border-purple-200/50 rounded-md">
                      {overview.activeSchool.schoolType || 'Primary'}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200/50 rounded-md">
                      County: {overview.activeSchool.county || 'N/A'}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/50 rounded-md">
                      ACTIVE
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-3 px-3 bg-amber-50/60 border border-amber-200/60 rounded-xl text-slate-600 text-xs">
                <p className="font-bold text-amber-900">No active school connected.</p>
                <p className="text-[11px] text-amber-800/80">Search the Kenya National Registry below to find and connect your school.</p>
              </div>
            )}
          </div>

          {/* Your Schools List */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-3xs space-y-3">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#3b1464]" />
              Connected Schools ({userReadModel.memberships.length})
            </h2>

            {userReadModel.memberships.length === 0 ? (
              <p className="py-2 text-slate-400 text-xs italic">
                No connected schools yet. Search below to claim or join your school.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-28 overflow-y-auto pr-1">
                {userReadModel.memberships.map((mem) => {
                  const sch = SchoolConfigService.getSchoolProfile(mem.schoolId);
                  if (!sch) return null;
                  const isActive = overview.activeSchool?.id === sch.id;
                  return (
                    <div key={mem.id} className="py-1.5 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{sch.name}</p>
                        <span className="text-[9px] font-black uppercase text-purple-900 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded">
                          {mem.role}
                        </span>
                      </div>

                      {!isActive && mem.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => handleSwitchSchool(sch.id)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex-shrink-0"
                        >
                          Switch Context
                        </button>
                      )}
                      {isActive && (
                        <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          Active
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 2. CORE VISUAL CENTER: FIND YOUR SCHOOL & SEARCH REGISTRY */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-1.5">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight flex items-center justify-center gap-2">
              <Search className="w-5 h-5 text-[#3b1464]" />
              KENYA NATIONAL SCHOOL REGISTRY
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Search the official directory to connect, claim, or switch your active teaching school.
            </p>
          </div>

          {/* Prominent Search Bar + Filter Trigger */}
          <div className="max-w-2xl mx-auto space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by school name, NEMIS/UIC, KNEC code or county..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400/40 focus:border-[#3b1464] transition-all shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowFilterDrawer(true)}
                className={`px-4 py-3 rounded-2xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs ${
                  activeFilterCount > 0
                    ? 'bg-purple-100 text-[#3b1464] border-purple-300'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[#3b1464] text-white text-[10px] font-black flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Active Filter Pills Display */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Active Filters:</span>
                {filters.county && (
                  <span className="text-[10px] font-bold bg-purple-50 text-[#3b1464] border border-purple-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    County: {filters.county}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters(f => ({ ...f, county: '' }))} />
                  </span>
                )}
                {filters.subCounty && (
                  <span className="text-[10px] font-bold bg-purple-50 text-[#3b1464] border border-purple-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    Sub-County: {filters.subCounty}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters(f => ({ ...f, subCounty: '' }))} />
                  </span>
                )}
                {filters.schoolType && (
                  <span className="text-[10px] font-bold bg-purple-50 text-[#3b1464] border border-purple-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    Type: {filters.schoolType}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters(f => ({ ...f, schoolType: '' }))} />
                  </span>
                )}
                {filters.ownership && (
                  <span className="text-[10px] font-bold bg-purple-50 text-[#3b1464] border border-purple-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    Ownership: {filters.ownership}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters(f => ({ ...f, ownership: '' }))} />
                  </span>
                )}
                {filters.educationLevel && (
                  <span className="text-[10px] font-bold bg-purple-50 text-[#3b1464] border border-purple-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    Level: {filters.educationLevel}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters(f => ({ ...f, educationLevel: '' }))} />
                  </span>
                )}
                {filters.nemisCode && (
                  <span className="text-[10px] font-bold bg-purple-50 text-[#3b1464] border border-purple-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    NEMIS: {filters.nemisCode}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters(f => ({ ...f, nemisCode: '' }))} />
                  </span>
                )}
                {filters.knecCode && (
                  <span className="text-[10px] font-bold bg-purple-50 text-[#3b1464] border border-purple-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    KNEC: {filters.knecCode}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFilters(f => ({ ...f, knecCode: '' }))} />
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-[10px] font-bold text-rose-600 hover:underline ml-auto cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {/* Search Results Display Area */}
          <div className="max-w-2xl mx-auto space-y-3">
            {!searchQuery.trim() && activeFilterCount === 0 ? (
              <div className="py-12 px-6 text-center bg-slate-50/80 border border-dashed border-slate-200 rounded-3xl space-y-3">
                <Search className="w-10 h-10 text-purple-600/40 mx-auto" />
                <div>
                  <p className="text-sm font-black text-slate-800">Find your school</p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                    Type a school name, county, NEMIS/UIC, or KNEC code above to search Kenya's official school directory.
                  </p>
                </div>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="py-10 px-6 text-center bg-slate-50 rounded-3xl border border-slate-200 space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-bold text-slate-800">No matching schools found</p>
                <p className="text-xs text-slate-400">
                  Try adjusting your search terms or clearing filters. If your school is not listed, you can register it below.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {searchResults.map((rec) => {
                  const isEcgActive = rec.ecgStatus === 'ECG_ACTIVE';
                  const isMember = isEcgActive && rec.ecgSchoolId && userReadModel.memberships.some(m => m.schoolId === rec.ecgSchoolId);
                  
                  return (
                    <div key={rec.directorySchoolId} className="p-4 bg-white border border-slate-200 hover:border-purple-200 rounded-2xl space-y-3 transition-all text-xs shadow-2xs">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-extrabold text-slate-900 text-sm">{rec.schoolName}</p>
                          <p className="text-[11px] text-slate-500 font-bold mt-0.5 flex flex-wrap gap-1">
                            <span>{rec.county}</span> • <span>{rec.subCounty || 'Central'}</span>
                            {rec.schoolType && <span>• {rec.schoolType}</span>}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium mt-1">
                            NEMIS: {rec.nemisCode || rec.uic || 'N/A'} • KNEC: {rec.knecCode || 'N/A'} • Ownership: {rec.ownership || rec.institutionCategory || 'Public'}
                          </p>
                        </div>

                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                          isEcgActive 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {isEcgActive ? 'ECG ACTIVE' : 'DIRECTORY ONLY'}
                        </span>
                      </div>
                      
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                        {isEcgActive ? (
                          isMember ? (
                            <span className="text-[11px] font-black text-emerald-600 uppercase flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" />
                              Joined & Active
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleJoinSchool(rec.ecgSchoolId!)}
                              className="px-4 py-2 bg-[#3b1464] hover:bg-[#2d0e4e] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                            >
                              Join / Switch
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setClaimingSchool(rec);
                              setRegisteringSchool(false);
                            }}
                            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded-xl transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
                          >
                            <span>Claim & Activate</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Onboarding Trigger: Can't find your school? */}
          <div className="pt-4 border-t border-slate-100 text-center space-y-2">
            <p className="text-xs text-slate-600 font-medium">
              Can't find your school in the registry?
            </p>
            <button
              type="button"
              onClick={() => {
                setRegisteringSchool(true);
                setClaimingSchool(null);
              }}
              className="px-5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add a School</span>
            </button>
          </div>
        </div>

        {/* CUSTOM ECG WEB FILTER MODAL */}
        {showFilterDrawer && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full relative animate-in zoom-in-95 duration-150 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-[#3b1464]" />
                  <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Directory Filters</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilterDrawer(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* County Filter Trigger */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">County</label>
                  <button
                    type="button"
                    onClick={() => setActiveSelectorModal('county')}
                    className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between transition-all cursor-pointer"
                  >
                    <span>{filters.county || 'All Counties'}</span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                {/* Sub-County Filter Input */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Sub-County</label>
                  <input
                    type="text"
                    placeholder="Enter sub-county name..."
                    value={filters.subCounty || ''}
                    onChange={(e) => setFilters(f => ({ ...f, subCounty: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                  />
                </div>

                {/* School Type Trigger */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">School Type</label>
                  <button
                    type="button"
                    onClick={() => setActiveSelectorModal('schoolType')}
                    className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between transition-all cursor-pointer"
                  >
                    <span>{filters.schoolType || 'All School Types'}</span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                {/* Ownership Trigger */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Ownership</label>
                  <button
                    type="button"
                    onClick={() => setActiveSelectorModal('ownership')}
                    className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between transition-all cursor-pointer"
                  >
                    <span>{filters.ownership || 'All Ownership'}</span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                {/* Education Level Trigger */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Education Level</label>
                  <button
                    type="button"
                    onClick={() => setActiveSelectorModal('educationLevel')}
                    className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between transition-all cursor-pointer"
                  >
                    <span>{filters.educationLevel || 'All Education Levels'}</span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                {/* NEMIS / UIC Code Input */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">NEMIS / UIC Code</label>
                  <input
                    type="text"
                    placeholder="Enter NEMIS code..."
                    value={filters.nemisCode || ''}
                    onChange={(e) => setFilters(f => ({ ...f, nemisCode: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                  />
                </div>

                {/* KNEC Code Input */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">KNEC Code</label>
                  <input
                    type="text"
                    placeholder="Enter KNEC code..."
                    value={filters.knecCode || ''}
                    onChange={(e) => setFilters(f => ({ ...f, knecCode: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                >
                  Clear All
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilterDrawer(false)}
                  className="px-5 py-2.5 bg-[#3b1464] hover:bg-[#2d0e4e] text-white text-xs font-black rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOM SELECTION MODAL */}
        {activeSelectorModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-5 max-w-md w-full relative animate-in zoom-in-95 duration-150 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  {activeSelectorModal === 'county' || activeSelectorModal === 'regCounty' ? 'Select County' :
                   activeSelectorModal === 'schoolType' || activeSelectorModal === 'regType' ? 'Select School Type' :
                   activeSelectorModal === 'ownership' ? 'Select Ownership' :
                   'Select Education Level'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSelectorModal(null);
                    setSelectorSearchQuery('');
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {(activeSelectorModal === 'county' || activeSelectorModal === 'regCounty') && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search 47 counties..."
                    value={selectorSearchQuery}
                    onChange={(e) => setSelectorSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                  />
                </div>
              )}

              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {activeSelectorModal === 'county' && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilters(f => ({ ...f, county: '' }));
                      setActiveSelectorModal(null);
                      setSelectorSearchQuery('');
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                      !filters.county ? 'bg-purple-50 text-[#3b1464] border-purple-200 font-bold' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-100 font-medium'
                    }`}
                  >
                    <span>All Counties</span>
                    {!filters.county && <Check className="w-4 h-4 text-[#3b1464]" />}
                  </button>
                )}

                {(activeSelectorModal === 'county' || activeSelectorModal === 'regCounty') &&
                  KENYA_COUNTIES
                    .filter(c => c.toLowerCase().includes(selectorSearchQuery.toLowerCase()))
                    .map(countyName => {
                      const isSelected = activeSelectorModal === 'county' ? filters.county === countyName : regCounty === countyName;
                      return (
                        <button
                          key={countyName}
                          type="button"
                          onClick={() => {
                            if (activeSelectorModal === 'county') {
                              setFilters(f => ({ ...f, county: countyName }));
                            } else {
                              setRegCounty(countyName);
                            }
                            setActiveSelectorModal(null);
                            setSelectorSearchQuery('');
                          }}
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                            isSelected ? 'bg-purple-50 text-[#3b1464] border-purple-200 font-bold' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-100 font-medium'
                          }`}
                        >
                          <span>{countyName}</span>
                          {isSelected && <Check className="w-4 h-4 text-[#3b1464]" />}
                        </button>
                      );
                    })
                }

                {(activeSelectorModal === 'schoolType' || activeSelectorModal === 'regType') && [
                  { label: 'All School Types', val: '' },
                  { label: 'Primary (Grade 1-6)', val: 'Primary' },
                  { label: 'Junior Secondary (Grade 7-9)', val: 'Junior Secondary' },
                  { label: 'Senior Secondary (Grade 10)', val: 'Secondary' },
                  { label: 'Special Needs Institution', val: 'Special Needs' },
                ].map(opt => {
                  if (activeSelectorModal === 'regType' && !opt.val) return null;
                  const isSelected = activeSelectorModal === 'schoolType' ? filters.schoolType === opt.val : regType === opt.val;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        if (activeSelectorModal === 'schoolType') {
                          setFilters(f => ({ ...f, schoolType: opt.val }));
                        } else {
                          setRegType(opt.val);
                        }
                        setActiveSelectorModal(null);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                        isSelected ? 'bg-purple-50 text-[#3b1464] border-purple-200 font-bold' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-100 font-medium'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-[#3b1464]" />}
                    </button>
                  );
                })}

                {activeSelectorModal === 'ownership' && [
                  { label: 'All Ownership', val: '' },
                  { label: 'Public / Government', val: 'Government/Public' },
                  { label: 'Private', val: 'Private' },
                  { label: 'Community / Mission', val: 'Community/Mission' },
                ].map(opt => {
                  const isSelected = filters.ownership === opt.val;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        setFilters(f => ({ ...f, ownership: opt.val }));
                        setActiveSelectorModal(null);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                        isSelected ? 'bg-purple-50 text-[#3b1464] border-purple-200 font-bold' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-100 font-medium'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-[#3b1464]" />}
                    </button>
                  );
                })}

                {activeSelectorModal === 'educationLevel' && [
                  { label: 'All Education Levels', val: '' },
                  { label: 'Pre-Primary', val: 'Pre-Primary' },
                  { label: 'Primary', val: 'Primary' },
                  { label: 'Junior Secondary', val: 'Junior Secondary' },
                  { label: 'Senior Secondary', val: 'Secondary' },
                ].map(opt => {
                  const isSelected = filters.educationLevel === opt.val;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        setFilters(f => ({ ...f, educationLevel: opt.val }));
                        setActiveSelectorModal(null);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                        isSelected ? 'bg-purple-50 text-[#3b1464] border-purple-200 font-bold' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-100 font-medium'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-[#3b1464]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* CLAIM CONFIRMATION MODAL/DRAWER */}
        {claimingSchool && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 max-w-lg w-full relative animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-emerald-50 rounded-xl text-emerald-700 border border-emerald-200">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Claim & Activate on ECG</h2>
                  <p className="text-xs text-slate-500">Confirm authoritative school details and set preferences</p>
                </div>
              </div>

              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <p className="font-extrabold text-slate-950 text-sm">{claimingSchool.schoolName}</p>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400">County Location</p>
                    <p className="font-bold">{claimingSchool.county}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400">Official Code</p>
                    <p className="font-bold">{claimingSchool.officialSchoolCode || claimingSchool.nemisCode || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400">Institution Category</p>
                    <p className="font-bold">{claimingSchool.institutionCategory} ({claimingSchool.ownership})</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400">Education Level</p>
                    <p className="font-bold">{claimingSchool.educationLevel}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-600 font-medium">
                  By claiming this school, you will be assigned as the <strong>founding School Admin</strong>. This allows you to manage classes, teachers, and assign teaching responsibilities.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => setClaimingSchool(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleClaimAndActivate(claimingSchool.directorySchoolId)}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                >
                  <span>Confirm Activation</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* REGISTER MISSING SCHOOL FORM */}
        {registeringSchool && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <form onSubmit={handleRegisterMissing} className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 max-w-lg w-full relative animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-purple-50 rounded-xl text-purple-950 border border-purple-200">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Register a Missing School</h2>
                  <p className="text-xs text-slate-500">Add a new school profile to our directory and activate your tenant</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">School Name *</label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Alliance Girls High School"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Education Level *</label>
                    <button
                      type="button"
                      onClick={() => setActiveSelectorModal('regType')}
                      className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between transition-all cursor-pointer"
                    >
                      <span>{regType || 'Select Type'}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">County *</label>
                    <button
                      type="button"
                      onClick={() => setActiveSelectorModal('regCounty')}
                      className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between transition-all cursor-pointer"
                    >
                      <span className="truncate">{regCounty || 'Select County'}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Subcounty</label>
                    <input
                      type="text"
                      value={regSubCounty}
                      onChange={(e) => setRegSubCounty(e.target.value)}
                      placeholder="e.g. Westlands"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Official School Code</label>
                    <input
                      type="text"
                      value={regCode}
                      onChange={(e) => setRegCode(e.target.value)}
                      placeholder="e.g. KNEC-2026-X"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRegisteringSchool(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                >
                  <span>Register & Activate</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {showOnboarding && (
          <OnboardingModal
            userId={currentUserId}
            isOpen={showOnboarding}
            onClose={() => setShowOnboarding(false)}
            onCompleted={(school, membership, context) => {
              SchoolMembershipService.setActiveSchool(currentUserId, school.id);
              setShowOnboarding(false);
              window.location.reload();
            }}
          />
        )}

        {showCsvAdminModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-150 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#3b1464]" />
                  <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">CSV Directory Management</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCsvAdminModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <AdminDirectoryCsvManagement />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!overview.activeSchool) {
    return (
      <div className="max-w-4xl mx-auto p-8 bg-white border border-slate-200 rounded-3xl shadow-sm text-center my-8 font-sans">
        <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-purple-100 shadow-inner">
          <School className="w-10 h-10 text-[#3b1464]" />
        </div>
        <h2 className="text-2xl font-black uppercase text-slate-900 mb-3 tracking-tight">Your teaching starts with your school</h2>
        <p className="text-slate-600 max-w-md mx-auto mb-8 font-medium leading-relaxed">
          Join or set up your school to see your teaching assignments, classes and daily lessons here.
        </p>
        <button
          onClick={() => setShowOnboarding(true)}
          className="w-full sm:w-auto px-8 py-4 bg-[#3b1464] hover:bg-[#2e1065] text-white font-black rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-2 mx-auto shadow-lg group"
        >
          <span>JOIN OR SET UP SCHOOL</span>
          <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </button>
        <p className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          You can change your school later
        </p>

        {showOnboarding && (
          <OnboardingModal
            userId={currentUserId}
            isOpen={showOnboarding}
            onClose={() => setShowOnboarding(false)}
            onCompleted={() => {
              setShowOnboarding(false);
              window.location.reload();
            }}
          />
        )}
      </div>
    );
  }

  // Workday Dashboard View (Primary Mobile-First View)
  if (viewMode === 'dashboard') {
    return (
      <>
        <TeacherWorkdayDashboard
          currentUserId={currentUserId}
          overview={overview}
          activeSchool={overview.activeSchool}
          selectedClassId={selectedClassId}
          selectedLearningAreaId={selectedLearningAreaId}
          onSelectClass={(classGroupId, learningAreaId) => {
            setSelectedClassId(classGroupId);
            setSelectedLearningAreaId(learningAreaId);
          }}
          onSwitchSchoolClick={() => setShowSchoolSwitch(true)}
          onOpenClassWorkspace={(initialTab) => {
            if (initialTab) setWorkspaceInitialTab(initialTab);
            setViewMode('workspace');
          }}
          onNavigateToGenerator={onNavigateToGenerator}
          onNavigateToLibrary={onNavigateToLibrary}
          onNavigateToElms={onNavigateToElms}
          onStartLesson={onStartLesson}
        />

        {/* Modals */}
        {showSchoolSwitch && (
          <SchoolSwitchModal
            isOpen={showSchoolSwitch}
            currentUserId={currentUserId}
            memberships={userReadModel.memberships}
            activeSchoolId={userReadModel.activeSchool?.id}
            onClose={() => setShowSchoolSwitch(false)}
            onSelectSchool={(schoolId) => {
              SchoolMembershipService.setActiveSchool(currentUserId, schoolId);
              setShowSchoolSwitch(false);
              window.location.reload();
            }}
            onOpenOnboarding={() => {
              setShowSchoolSwitch(false);
              setShowOnboarding(true);
            }}
          />
        )}

        {showAssignModal && overview.activeSchool && (
          <AssignTeacherModal
            schoolId={overview.activeSchool.id}
            currentUserId={currentUserId}
            onClose={() => setShowAssignModal(false)}
            onSuccess={() => {
              setShowAssignModal(false);
              window.location.reload();
            }}
          />
        )}

        {showClassModal && overview.activeSchool && (
          <ClassManagementModal
            schoolId={overview.activeSchool.id}
            currentUserId={currentUserId}
            onClose={() => setShowClassModal(false)}
            onSuccess={() => {
              setShowClassModal(false);
              window.location.reload();
            }}
          />
        )}
      </>
    );
  }

  // Detailed Class Workspace View
  return (
    <div className="space-y-6 font-sans">
      {/* View Switcher & Context Bar */}
      <div className="bg-[#3b1464] text-white p-4 sm:p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <button
            onClick={() => setViewMode('dashboard')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-900 hover:bg-purple-800 text-white rounded-xl text-xs font-bold mb-2 transition-colors border border-purple-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Today's Dashboard</span>
          </button>
          <div className="flex items-center gap-2 text-purple-200 text-xs font-bold uppercase tracking-wider mb-1">
            <School className="w-4 h-4" />
            <span>{overview.activeSchool.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">Class Teaching Workspace</h1>
          <p className="text-purple-100/80 text-xs sm:text-sm mt-0.5">
            Role: <span className="font-bold text-white">{userReadModel.activeMembership?.role}</span> • {overview.teacher.displayName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setViewMode('dashboard')}
            className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl font-bold text-xs border border-white/20 transition-all flex items-center gap-1.5"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Today's View</span>
          </button>

          {userReadModel.memberships.length > 1 && (
            <button
              onClick={() => setShowSchoolSwitch(true)}
              className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl font-bold text-xs border border-white/20 transition-all"
            >
              Switch School
            </button>
          )}

          {isSchoolAdmin && (
            <>
              <button
                onClick={() => setShowClassModal(true)}
                className="bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold border border-emerald-500 flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>New Class</span>
              </button>
              <button
                onClick={() => setShowAssignModal(true)}
                className="bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold border border-emerald-500 flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Assign</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Teacher Workspace: Cards or Workspace Panel */}
      {overview.assignments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center max-w-2xl mx-auto shadow-sm">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-100">
            <Users className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-xl font-black text-slate-900 mb-3 uppercase tracking-tight">My Teaching Assignments</h3>
          <p className="text-slate-600 text-sm mb-8 font-medium leading-relaxed">
            No classes or teaching assignments have been assigned to you yet.
          </p>
          {isSchoolAdmin ? (
            <button
              onClick={() => setShowAssignModal(true)}
              className="w-full sm:w-auto px-6 py-3.5 bg-[#3b1464] hover:bg-[#2e1065] text-white font-black rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-2 mx-auto shadow-lg"
            >
              <Plus className="w-5 h-5" />
              <span>ASSIGN TEACHING RESPONSIBILITY</span>
            </button>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3 justify-center">
              <Info className="w-5 h-5 text-[#3b1464]" />
              <p className="text-xs font-bold text-slate-700">
                Please contact your school administrator to assign your classes and subjects.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: My Authorized Classes List */}
          <div className="space-y-4">
            <h2 className="text-lg font-black uppercase text-slate-900 tracking-wide flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-600" />
              <span>My Classes ({overview.assignments.length})</span>
            </h2>

            <div className="space-y-2.5">
              {overview.assignments.map((assign) => {
                const cg = overview.classes.find((c) => c.id === assign.classGroupId);
                const className = cg ? cg.name : assign.gradeId;
                const isSelected =
                  overview.activeAssignment?.id === assign.id ||
                  (selectedClassId === assign.classGroupId && selectedLearningAreaId === assign.learningAreaId);

                return (
                  <button
                    key={assign.id}
                    onClick={() => {
                      setSelectedClassId(assign.classGroupId);
                      setSelectedLearningAreaId(assign.learningAreaId);
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-600 shadow-sm font-bold text-emerald-950'
                        : 'bg-white border-slate-200 hover:border-slate-400 text-slate-800'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-black uppercase text-emerald-700 tracking-wider block mb-0.5">
                        {assign.learningAreaId.toUpperCase().replace('-', ' ')}
                      </span>
                      <p className="text-base font-extrabold">{className}</p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Year: {assign.academicYearId}
                      </p>
                    </div>
                    <ChevronRight className={`w-5 h-5 ${isSelected ? 'text-emerald-700' : 'text-slate-400'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column (2 cols): Selected Class Workspace Panel */}
          <div className="lg:col-span-2">
            <ClassWorkspacePanel
              currentUserId={currentUserId}
              overview={overview}
              initialTab={workspaceInitialTab}
              onBackToDashboard={() => setViewMode('dashboard')}
              onNavigateToGenerator={onNavigateToGenerator}
              onStartLesson={onStartLesson}
              onLearnersUpdated={() => {
                setSelectedClassId(overview.activeClassGroup?.id);
              }}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      {showSchoolSwitch && (
        <SchoolSwitchModal
          isOpen={showSchoolSwitch}
          currentUserId={currentUserId}
          memberships={userReadModel.memberships}
          activeSchoolId={userReadModel.activeSchool?.id}
          onClose={() => setShowSchoolSwitch(false)}
          onSelectSchool={(schoolId) => {
            SchoolMembershipService.setActiveSchool(currentUserId, schoolId);
            setShowSchoolSwitch(false);
            window.location.reload();
          }}
          onOpenOnboarding={() => {
            setShowSchoolSwitch(false);
            setShowOnboarding(true);
          }}
        />
      )}

      {showAssignModal && overview.activeSchool && (
        <AssignTeacherModal
          schoolId={overview.activeSchool.id}
          currentUserId={currentUserId}
          onClose={() => setShowAssignModal(false)}
          onSuccess={() => {
            setShowAssignModal(false);
            window.location.reload();
          }}
        />
      )}

      {showClassModal && overview.activeSchool && (
        <ClassManagementModal
          schoolId={overview.activeSchool.id}
          currentUserId={currentUserId}
          onClose={() => setShowClassModal(false)}
          onSuccess={() => {
            setShowClassModal(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
};

