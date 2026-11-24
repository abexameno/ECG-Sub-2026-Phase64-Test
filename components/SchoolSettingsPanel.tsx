import React, { useState, useEffect, useMemo } from 'react';
import { SchoolProfile, TeachingConfig } from '../types/school.ts';
import { SchoolMembership, MembershipRole, SchoolConfigChangeImpact } from '../types/teacherOnboarding.ts';
import { User } from '../types.ts';
import { SchoolConfigService } from '../services/schoolConfigService.ts';
import { SchoolMembershipService } from '../services/schoolMembershipService.ts';
import { 
  Building2, Settings, Users, Shield, Check, X, AlertTriangle, 
  UserCheck, UserX, UserMinus, Plus, Save, Archive, RefreshCw, 
  ChevronDown, AlertCircle, Info, Lock
} from 'lucide-react';
import { SchoolLevelSelector } from './SchoolLevelSelector.tsx';
import { KENYA_COUNTIES } from '../constants/kenyaCounties.ts';

interface SchoolSettingsPanelProps {
  schoolId?: string;
  currentUserId: string;
  currentUser?: User;
  onProfileUpdated?: (updatedSchool: SchoolProfile) => void;
  onCloseModal?: () => void;
}

export const SchoolSettingsPanel: React.FC<SchoolSettingsPanelProps> = ({
  schoolId: initialSchoolId = 'lwps',
  currentUserId,
  currentUser,
  onProfileUpdated,
  onCloseModal,
}) => {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(initialSchoolId);
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'TEACHING_CONFIG' | 'MEMBERS' | 'DANGER'>('PROFILE');

  // Load available schools for switcher
  const [refreshKey, setRefreshKey] = useState(0);

  const availableSchools = useMemo(() => {
    return SchoolConfigService.getAllSchools({ includeInactive: true, includeMerged: true });
  }, [refreshKey]);

  // Current active school profile
  const [school, setSchool] = useState<SchoolProfile>(() => SchoolConfigService.getSchoolProfile(selectedSchoolId));

  // Sync state when selectedSchoolId changes
  useEffect(() => {
    const p = SchoolConfigService.getSchoolProfile(selectedSchoolId);
    setSchool(p);
    setName(p.name);
    setSchoolType(p.schoolType || 'Primary');
    setCountry(p.country || 'Kenya');
    setCounty(p.county || 'Nairobi City');
    setLessonsPerWeek(p.teachingConfig.lessonsPerWeek);
    setLessonDurationMinutes(p.teachingConfig.lessonDurationMinutes);
    setTeachingWeeksPerTerm(p.teachingConfig.teachingWeeksPerTerm);
    setCapacityImpact(null);
  }, [selectedSchoolId, refreshKey]);

  // Form states
  const [name, setName] = useState(school.name);
  const [schoolType, setSchoolType] = useState(school.schoolType || 'Primary');
  const [country, setCountry] = useState(school.country || 'Kenya');
  const [county, setCounty] = useState(school.county || 'Nairobi City');

  // Teaching Config state
  const [lessonsPerWeek, setLessonsPerWeek] = useState(school.teachingConfig.lessonsPerWeek);
  const [lessonDurationMinutes, setLessonDurationMinutes] = useState(school.teachingConfig.lessonDurationMinutes);
  const [teachingWeeksPerTerm, setTeachingWeeksPerTerm] = useState(school.teachingConfig.teachingWeeksPerTerm);
  const [capacityImpact, setCapacityImpact] = useState<SchoolConfigChangeImpact | null>(null);

  // Members state
  const [memberships, setMemberships] = useState<SchoolMembership[]>([]);
  const [memberFilter, setMemberFilter] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  // Notification message
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showArchiveConfirmModal, setShowArchiveConfirmModal] = useState(false);
  const [deactivationReason, setDeactivationReason] = useState('');
  const [confirmNameInput, setConfirmNameInput] = useState('');

  // Add School Form State
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolType, setNewSchoolType] = useState('Primary');
  const [newSchoolCounty, setNewSchoolCounty] = useState('Nairobi City');
  const [newLessonsPerWeek, setNewLessonsPerWeek] = useState(5);
  const [newTeachingWeeks, setNewTeachingWeeks] = useState(13);
  const [isCreating, setIsCreating] = useState(false);

  // Authorization checks
  const isPlatformAdmin = currentUser?.role === 'Admin' || currentUser?.email === 'abexameno@gmail.com';
  const isSchoolAdmin = useMemo(() => {
    if (isPlatformAdmin) return true;
    return SchoolMembershipService.validateAccess(currentUserId, selectedSchoolId, 'SCHOOL_ADMIN');
  }, [isPlatformAdmin, currentUserId, selectedSchoolId]);

  // Load members
  useEffect(() => {
    try {
      const list = SchoolMembershipService.getSchoolMemberships(selectedSchoolId, currentUserId);
      setMemberships(list);
    } catch (err: any) {
      console.warn('Could not load school memberships:', err.message);
    }
  }, [selectedSchoolId, currentUserId, refreshKey]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = SchoolConfigService.updateSchoolProfile(selectedSchoolId, {
        name,
        schoolType,
        country,
        county,
      }, currentUserId);

      setSchool(updated);
      setRefreshKey(prev => prev + 1);
      setMessage({ type: 'success', text: 'School profile updated successfully.' });
      if (onProfileUpdated) onProfileUpdated(updated);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update school profile' });
    }
  };

  const handleSaveTeachingConfig = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const impact = SchoolConfigService.updateTeachingConfig(selectedSchoolId, {
        lessonsPerWeek: Number(lessonsPerWeek),
        lessonDurationMinutes: Number(lessonDurationMinutes),
        teachingWeeksPerTerm: Number(teachingWeeksPerTerm),
      }, currentUserId);

      setCapacityImpact(impact);
      const updated = SchoolConfigService.getSchoolProfile(selectedSchoolId);
      setSchool(updated);
      setRefreshKey(prev => prev + 1);

      if (impact.reviewRequired) {
        setMessage({
          type: 'warning',
          text: impact.capacityWarning || 'Teaching capacity changed. Existing teaching plans require review.',
        });
      } else {
        setMessage({ type: 'success', text: 'Teaching configuration updated successfully.' });
      }
      if (onProfileUpdated) onProfileUpdated(updated);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update teaching configuration' });
    }
  };

  const handleArchiveSchool = () => {
    if (confirmNameInput.trim().toLowerCase() !== school.name.trim().toLowerCase()) {
      setMessage({ type: 'error', text: `Name confirmation mismatch. Please type '${school.name}' exactly.` });
      return;
    }

    try {
      const deactivated = SchoolConfigService.deactivateSchool(selectedSchoolId, currentUserId, deactivationReason);
      setSchool(deactivated);
      setShowArchiveConfirmModal(false);
      setConfirmNameInput('');
      setDeactivationReason('');
      setRefreshKey(prev => prev + 1);
      setMessage({ type: 'warning', text: `School "${school.name}" has been safely archived/deactivated.` });
      if (onProfileUpdated) onProfileUpdated(deactivated);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to archive school profile' });
    }
  };

  const handleReactivateSchool = () => {
    try {
      const reactivated = SchoolConfigService.reactivateSchool(selectedSchoolId, currentUserId);
      setSchool(reactivated);
      setRefreshKey(prev => prev + 1);
      setMessage({ type: 'success', text: `School "${school.name}" has been reactivated.` });
      if (onProfileUpdated) onProfileUpdated(reactivated);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to reactivate school profile' });
    }
  };

  const handleCreateSchool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim()) return;

    setIsCreating(true);
    try {
      const created = SchoolConfigService.createSchool({
        name: newSchoolName.trim(),
        schoolType: newSchoolType,
        country: 'Kenya',
        county: newSchoolCounty,
        teachingConfig: {
          lessonsPerWeek: Number(newLessonsPerWeek),
          lessonDurationMinutes: 40,
          teachingWeeksPerTerm: Number(newTeachingWeeks),
          revisionWeeks: 1,
          assessmentWeeks: 1,
        }
      }, currentUserId);

      // Create admin membership
      try {
        SchoolMembershipService.addTeacherMembership({
          userId: currentUserId,
          schoolId: created.id,
          role: 'SCHOOL_ADMIN',
          status: 'ACTIVE',
        });
      } catch (err) {
        console.warn('Membership creation notice:', err);
      }

      setShowAddModal(false);
      setNewSchoolName('');
      setRefreshKey(prev => prev + 1);
      setSelectedSchoolId(created.id);
      setMessage({ type: 'success', text: `School profile "${created.name}" created successfully.` });
      if (onProfileUpdated) onProfileUpdated(created);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create school profile' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleApprove = (membershipId: string) => {
    try {
      SchoolMembershipService.approveMembership(membershipId, currentUserId);
      setMemberships(SchoolMembershipService.getSchoolMemberships(selectedSchoolId, currentUserId));
      setMessage({ type: 'success', text: 'Teacher membership approved.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleReject = (membershipId: string) => {
    try {
      SchoolMembershipService.rejectMembership(membershipId, currentUserId);
      setMemberships(SchoolMembershipService.getSchoolMemberships(selectedSchoolId, currentUserId));
      setMessage({ type: 'success', text: 'Teacher membership request rejected.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleSuspend = (membershipId: string) => {
    try {
      SchoolMembershipService.suspendMembership(membershipId, currentUserId);
      setMemberships(SchoolMembershipService.getSchoolMemberships(selectedSchoolId, currentUserId));
      setMessage({ type: 'warning', text: 'Teacher membership suspended.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleChangeRole = (membershipId: string, newRole: MembershipRole) => {
    try {
      SchoolMembershipService.changeRole(membershipId, newRole, currentUserId);
      setMemberships(SchoolMembershipService.getSchoolMemberships(selectedSchoolId, currentUserId));
      setMessage({ type: 'success', text: `Role updated to ${newRole}.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const filteredMembers = memberships.filter(m => {
    if (memberFilter === 'ALL') return true;
    return m.status === memberFilter;
  });

  return (
    <div className="bg-white border-2 border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8 max-w-5xl mx-auto space-y-6 font-sans relative">
      {/* Top Header & Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 border border-slate-200 rounded-xl text-emerald-900 shrink-0">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">{school.name}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                school.status === 'deactivated' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                school.status === 'merged' ? 'bg-slate-100 text-slate-600 border border-slate-300' :
                'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}>
                {school.status === 'deactivated' ? 'Archived' : school.status || 'Active'}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              School Profiles & Timetable Capacity Management
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* School Selector Dropdown */}
          <div className="relative">
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer pr-8"
            >
              {availableSchools.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.status === 'deactivated' ? '(Archived)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2.5 bg-[#3b1464] hover:bg-[#2e1065] text-white text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add School</span>
          </button>

          {onCloseModal && (
            <button
              type="button"
              onClick={onCloseModal}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
              title="Close Settings"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {!isSchoolAdmin ? (
        <div className="p-8 bg-amber-50 border-2 border-slate-200 rounded-2xl text-center space-y-2">
          <Shield className="h-10 w-10 text-amber-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">School Admin Access Required</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            You must have School Administrator or Platform Administrator rights to modify configuration for "{school.name}".
          </p>
        </div>
      ) : (
        <>
          {/* Tab Navigation */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 border border-slate-200 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('PROFILE')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'PROFILE' ? 'bg-white border border-slate-200 shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Profile & Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('TEACHING_CONFIG')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'TEACHING_CONFIG' ? 'bg-white border border-slate-200 shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Teaching Schedule
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('MEMBERS')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'MEMBERS' ? 'bg-white border border-slate-200 shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Members ({memberships.length})</span>
                {memberships.some(m => m.status === 'PENDING') && (
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('DANGER')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'DANGER' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:text-rose-900'
                }`}
              >
                Status & Archiving
              </button>
            </div>
          </div>

          {/* Messages */}
          {message && (
            <div className={`p-4 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-semibold ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' :
              message.type === 'warning' ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}>
              <div className="flex items-center gap-2">
                {message.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />}
                {message.type === 'success' && <Check className="h-4 w-4 text-emerald-700 shrink-0" />}
                {message.type === 'error' && <X className="h-4 w-4 text-rose-700 shrink-0" />}
                <span>{message.text}</span>
              </div>
              <button type="button" onClick={() => setMessage(null)} className="text-current opacity-70 hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* TAB 1: PROFILE */}
          {activeTab === 'PROFILE' && (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">School Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <SchoolLevelSelector
                    value={schoolType}
                    onChange={(level) => setSchoolType(level)}
                    label="School Level"
                    id="edit-school-level-selector"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">County</label>
                  <select
                    value={county}
                    onChange={(e) => setCounty(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {KENYA_COUNTIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Curriculum Framework</label>
                  <input
                    type="text"
                    value={school.curriculumSystem || 'Kenya Competency-Based Curriculum (CBC)'}
                    disabled
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-sm text-slate-600 font-medium cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-700 text-white font-bold text-xs rounded-xl border border-slate-200 hover:bg-emerald-800 flex items-center gap-2 cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Profile Changes</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: TEACHING CONFIG */}
          {activeTab === 'TEACHING_CONFIG' && (
            <form onSubmit={handleSaveTeachingConfig} className="space-y-5">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                Teaching configuration rules dictate lesson capacity and scheme of work calculations across all subjects in <strong>{school.name}</strong>. Editing school-wide defaults does not overwrite existing generated SOW versions.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lessons per Week</label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={lessonsPerWeek}
                    onChange={(e) => setLessonsPerWeek(Number(e.target.value))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lesson Duration (Minutes)</label>
                  <input
                    type="number"
                    min="30"
                    max="90"
                    value={lessonDurationMinutes}
                    onChange={(e) => setLessonDurationMinutes(Number(e.target.value))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Teaching Weeks per Term</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={teachingWeeksPerTerm}
                    onChange={(e) => setTeachingWeeksPerTerm(Number(e.target.value))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>
              </div>

              {capacityImpact && capacityImpact.reviewRequired && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 text-xs text-amber-900">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Capacity Impact Notice</p>
                    <p className="mt-0.5">{capacityImpact.capacityWarning}</p>
                    <p className="mt-1 text-[11px] text-amber-800">
                      Total Term Capacity: <strong>{capacityImpact.newConfig.lessonsPerWeek * capacityImpact.newConfig.teachingWeeksPerTerm} slots</strong> (Changed by {capacityImpact.capacityChangeSlots} slots).
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-700 text-white font-bold text-xs rounded-xl border border-slate-200 hover:bg-emerald-800 flex items-center gap-2 cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>Update Teaching Configuration</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: MEMBERS */}
          {activeTab === 'MEMBERS' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(['ALL', 'PENDING', 'ACTIVE', 'SUSPENDED'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setMemberFilter(f)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer ${
                        memberFilter === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <p className="text-xs font-semibold text-slate-500">
                  Total Members: {filteredMembers.length}
                </p>
              </div>

              <div className="space-y-3">
                {filteredMembers.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500">
                    No members match the selected filter.
                  </div>
                ) : (
                  filteredMembers.map(mem => (
                    <div key={mem.id} className="p-4 border border-slate-200 rounded-xl flex items-center justify-between bg-slate-50">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900">User ID: {mem.userId}</p>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                            mem.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                            mem.status === 'PENDING' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}>
                            {mem.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">Role: <strong className="text-slate-800">{mem.role}</strong></p>
                      </div>

                      <div className="flex items-center gap-2">
                        {mem.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApprove(mem.id)}
                              className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-bold rounded-lg border border-slate-200 flex items-center gap-1 hover:bg-emerald-800 cursor-pointer"
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(mem.id)}
                              className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg border border-slate-200 flex items-center gap-1 hover:bg-rose-700 cursor-pointer"
                            >
                              <UserX className="h-3.5 w-3.5" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}

                        {mem.status === 'ACTIVE' && (
                          <>
                            <select
                              value={mem.role}
                              onChange={(e) => handleChangeRole(mem.id, e.target.value as MembershipRole)}
                              className="px-2 py-1 text-xs font-semibold border border-slate-200 rounded-lg bg-white cursor-pointer"
                            >
                              <option value="TEACHER">TEACHER</option>
                              <option value="ACADEMIC_ADMIN">ACADEMIC_ADMIN</option>
                              <option value="SCHOOL_ADMIN">SCHOOL_ADMIN</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleSuspend(mem.id)}
                              className="px-2.5 py-1 bg-amber-600 text-white text-xs font-semibold rounded-lg border border-slate-200 cursor-pointer"
                              title="Suspend Membership"
                            >
                              Suspend
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: STATUS & ARCHIVING */}
          {activeTab === 'DANGER' && (
            <div className="space-y-6">
              <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2.5">
                  <Archive className="w-5 h-5 text-rose-700 shrink-0" />
                  <h3 className="text-sm font-black text-rose-900 uppercase tracking-tight">
                    Archive / Deactivate School Profile
                  </h3>
                </div>
                <p className="text-xs text-rose-800 leading-relaxed font-medium">
                  Archiving deactivates "{school.name}" from active selection dropdowns. Existing generated resources, teaching plans, SOW versions, and teacher memberships remain safely preserved in the database.
                </p>

                {school.status === 'deactivated' ? (
                  <div className="pt-2">
                    <p className="text-xs font-bold text-slate-700 mb-2">
                      This school profile is currently archived (Deactivated by {school.deactivatedBy || 'Administrator'} on {school.deactivatedAt ? new Date(school.deactivatedAt).toLocaleDateString() : 'N/A'}).
                    </p>
                    <button
                      type="button"
                      onClick={handleReactivateSchool}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black rounded-xl border border-emerald-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Reactivate School Profile</span>
                    </button>
                  </div>
                ) : (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowArchiveConfirmModal(true)}
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl border border-rose-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Archive className="w-4 h-4" />
                      <span>Archive "{school.name}"</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: ARCHIVE CONFIRMATION */}
      {showArchiveConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-700">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Confirm School Profile Archiving</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to archive <strong>{school.name}</strong>? This profile will be hidden from active school dropdowns. All historical resources and SOW versions will be preserved.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Type <strong>{school.name}</strong> to confirm:
              </label>
              <input
                type="text"
                value={confirmNameInput}
                onChange={(e) => setConfirmNameInput(e.target.value)}
                placeholder={school.name}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-rose-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Reason for Deactivation (Optional):
              </label>
              <input
                type="text"
                value={deactivationReason}
                onChange={(e) => setDeactivationReason(e.target.value)}
                placeholder="e.g. Consolidated, closed, or legacy duplicate"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setShowArchiveConfirmModal(false); setConfirmNameInput(''); }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmNameInput.trim().toLowerCase() !== school.name.trim().toLowerCase()}
                onClick={handleArchiveSchool}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Confirm Deactivation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW SCHOOL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateSchool} className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 max-w-lg w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#3b1464]" />
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Create New School Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">School Name *</label>
              <input
                type="text"
                value={newSchoolName}
                onChange={(e) => setNewSchoolName(e.target.value)}
                placeholder="e.g. St. Francis Junior Secondary School"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <SchoolLevelSelector
                  value={newSchoolType}
                  onChange={(val) => setNewSchoolType(val)}
                  label="School Level"
                  id="new-school-level-selector"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">County</label>
                <select
                  value={newSchoolCounty}
                  onChange={(e) => setNewSchoolCounty(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                >
                  {KENYA_COUNTIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Teaching Weeks / Term</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={newTeachingWeeks}
                  onChange={(e) => setNewTeachingWeeks(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Lessons per Week</label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={newLessonsPerWeek}
                  onChange={(e) => setNewLessonsPerWeek(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating || !newSchoolName.trim()}
                className="px-5 py-2.5 bg-[#3b1464] hover:bg-[#2e1065] disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-xs"
              >
                {isCreating ? 'Creating...' : 'Create School Profile'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
