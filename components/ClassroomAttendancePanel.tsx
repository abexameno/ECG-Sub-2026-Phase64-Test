import React, { useState, useEffect } from 'react';
import {
  LearnerAttendanceStatus,
  LearnerParticipationStatus,
  LearnerParticipation,
  AttendanceSummary,
} from '../types/attendance.ts';
import { LearnerParticipationService } from '../services/learnerParticipationService.ts';
import { LearnerRosterService } from '../services/learnerRosterService.ts';
import { CheckCircle2, XCircle, Clock, AlertCircle, UserCheck, RefreshCw, MessageSquare, Save } from 'lucide-react';

interface ClassroomAttendancePanelProps {
  currentUserId: string;
  schoolId: string;
  classGroupId: string;
  className: string;
  academicYearId: string;
  termId?: string;
  teachingActivityId?: string;
  teachingAllocationId?: string;
  lessonDate?: string; // defaults to today (YYYY-MM-DD)
  onAttendanceSaved?: () => void;
}

export const ClassroomAttendancePanel: React.FC<ClassroomAttendancePanelProps> = ({
  currentUserId,
  schoolId,
  classGroupId,
  className,
  academicYearId,
  termId,
  teachingActivityId,
  teachingAllocationId,
  lessonDate,
  onAttendanceSaved,
}) => {
  const todayStr = lessonDate || new Date().toISOString().split('T')[0];

  const [rosterLearners, setRosterLearners] = useState<any[]>([]);
  const [attendanceState, setAttendanceState] = useState<
    Record<
      string,
      {
        attendanceStatus: LearnerAttendanceStatus;
        participationStatus: LearnerParticipationStatus;
        notes: string;
        recordId?: string;
        isCorrected?: boolean;
      }
    >
  >({});

  const [isSaved, setIsSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showNotesMap, setShowNotesMap] = useState<Record<string, boolean>>({});

  // Load roster and existing attendance on mount or when props change
  useEffect(() => {
    try {
      setErrorMsg(null);
      const learners = LearnerRosterService.getLearnersForClassGroup(classGroupId, schoolId);
      setRosterLearners(learners);

      let summary: AttendanceSummary | null = null;
      try {
        summary = LearnerParticipationService.getAttendanceForLesson({
          schoolId,
          requestingUserId: currentUserId,
          classGroupId,
          lessonDate: todayStr,
          teachingActivityId,
        });
      } catch {
        // Attendance not yet recorded
      }

      const initialMap: Record<
        string,
        {
          attendanceStatus: LearnerAttendanceStatus;
          participationStatus: LearnerParticipationStatus;
          notes: string;
          recordId?: string;
          isCorrected?: boolean;
        }
      > = {};

      learners.forEach((l) => {
        const existing = summary?.records.find((r: LearnerParticipation) => r.learnerId === l.id);
        if (existing) {
          initialMap[l.id] = {
            attendanceStatus: existing.attendanceStatus,
            participationStatus: existing.participationStatus,
            notes: existing.notes || '',
            recordId: existing.id,
            isCorrected: existing.recordState === 'CORRECTED',
          };
        } else {
          initialMap[l.id] = {
            attendanceStatus: 'PRESENT',
            participationStatus: 'PRESENT',
            notes: '',
          };
        }
      });

      setAttendanceState(initialMap);
      if (summary && summary.records.length > 0) {
        setIsSaved(true);
      } else {
        setIsSaved(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load classroom roster.');
    }
  }, [schoolId, classGroupId, todayStr, teachingActivityId, currentUserId]);

  // Handle Mark All Present
  const handleMarkAllPresent = () => {
    setErrorMsg(null);
    try {
      const records = LearnerParticipationService.markAllPresentQuick({
        schoolId,
        teacherId: currentUserId,
        classGroupId,
        teachingActivityId,
        teachingAllocationId,
        lessonDate: todayStr,
        academicYearId,
        termId,
      });

      const nextMap = { ...attendanceState };
      records.forEach((r) => {
        nextMap[r.learnerId] = {
          attendanceStatus: 'PRESENT',
          participationStatus: 'PRESENT',
          notes: r.notes || '',
          recordId: r.id,
          isCorrected: r.recordState === 'CORRECTED',
        };
      });

      setAttendanceState(nextMap);
      setIsSaved(true);
      if (onAttendanceSaved) onAttendanceSaved();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to mark all present.');
    }
  };

  // Handle updating an individual learner's status locally
  const handleStatusChange = (learnerId: string, status: LearnerAttendanceStatus) => {
    setIsSaved(false);
    setAttendanceState((prev) => ({
      ...prev,
      [learnerId]: {
        ...prev[learnerId],
        attendanceStatus: status,
        participationStatus:
          status === 'PRESENT'
            ? prev[learnerId]?.participationStatus === 'NOT_RECORDED'
              ? 'PRESENT'
              : prev[learnerId]?.participationStatus
            : 'NOT_RECORDED',
      },
    }));
  };

  // Handle participation toggle
  const handleParticipationToggle = (learnerId: string) => {
    setIsSaved(false);
    setAttendanceState((prev) => {
      const current = prev[learnerId];
      if (!current) return prev;

      const nextPart: LearnerParticipationStatus =
        current.participationStatus === 'PARTICIPATED' ? 'PRESENT' : 'PARTICIPATED';

      return {
        ...prev,
        [learnerId]: {
          ...current,
          participationStatus: nextPart,
          attendanceStatus: current.attendanceStatus === 'ABSENT' ? 'PRESENT' : current.attendanceStatus,
        },
      };
    });
  };

  // Handle Note input
  const handleNoteChange = (learnerId: string, noteText: string) => {
    setIsSaved(false);
    setAttendanceState((prev) => ({
      ...prev,
      [learnerId]: {
        ...prev[learnerId],
        notes: noteText,
      },
    }));
  };

  // Save all current attendance entries
  const handleSaveAttendance = () => {
    setErrorMsg(null);
    try {
      const entries = Object.entries(attendanceState).map(([learnerId, data]) => ({
        learnerId,
        attendanceStatus: data.attendanceStatus,
        participationStatus: data.participationStatus,
        notes: data.notes || undefined,
      }));

      LearnerParticipationService.recordAttendanceBatch({
        schoolId,
        teacherId: currentUserId,
        classGroupId,
        teachingActivityId,
        teachingAllocationId,
        lessonDate: todayStr,
        academicYearId,
        termId,
        records: entries,
      });

      setIsSaved(true);
      if (onAttendanceSaved) onAttendanceSaved();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save attendance.');
    }
  };

  // Compute stats
  const totalCount = rosterLearners.length;
  const presentCount = Object.values(attendanceState).filter((s) => s.attendanceStatus === 'PRESENT').length;
  const absentCount = Object.values(attendanceState).filter((s) => s.attendanceStatus === 'ABSENT').length;
  const lateCount = Object.values(attendanceState).filter((s) => s.attendanceStatus === 'LATE').length;
  const excusedCount = Object.values(attendanceState).filter((s) => s.attendanceStatus === 'EXCUSED').length;
  const participatedCount = Object.values(attendanceState).filter(
    (s) => s.participationStatus === 'PARTICIPATED' || s.participationStatus === 'COMPLETED_ACTIVITY'
  ).length;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-1 rounded-md uppercase tracking-wider">
              Classroom Attendance & Participation
            </span>
            <span className="text-slate-500 font-mono text-xs font-bold">{todayStr}</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-1">{className}</h2>
          <p className="text-xs text-slate-500 font-medium">
            Record classroom presence and optional participation engagement without modifying mastery.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllPresent}
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all border border-slate-200 shadow-sm"
          >
            <UserCheck className="w-4 h-4" />
            <span>Mark All Present</span>
          </button>

          <button
            onClick={handleSaveAttendance}
            disabled={isSaved}
            className={`text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all border ${
              isSaved
                ? 'bg-slate-100 text-slate-500 border-slate-300 cursor-not-allowed'
                : 'bg-slate-900 hover:bg-black text-white border-slate-200 shadow-sm'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>{isSaved ? 'Saved' : 'Save Attendance'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Summary Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
          <span className="text-xl font-black text-slate-900">{totalCount}</span>
          <p className="text-[10px] text-slate-500 font-extrabold uppercase mt-0.5">Total Roster</p>
        </div>
        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
          <span className="text-xl font-black text-emerald-700">{presentCount}</span>
          <p className="text-[10px] text-emerald-800 font-extrabold uppercase mt-0.5">Present</p>
        </div>
        <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-center">
          <span className="text-xl font-black text-red-700">{absentCount}</span>
          <p className="text-[10px] text-red-800 font-extrabold uppercase mt-0.5">Absent</p>
        </div>
        <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-center">
          <span className="text-xl font-black text-amber-700">{lateCount}</span>
          <p className="text-[10px] text-amber-800 font-extrabold uppercase mt-0.5">Late</p>
        </div>
        <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-center">
          <span className="text-xl font-black text-blue-700">{excusedCount}</span>
          <p className="text-[10px] text-blue-800 font-extrabold uppercase mt-0.5">Excused</p>
        </div>
        <div className="bg-purple-50 p-3 rounded-xl border border-purple-200 text-center">
          <span className="text-xl font-black text-purple-700">{participatedCount}</span>
          <p className="text-[10px] text-purple-800 font-extrabold uppercase mt-0.5">Participated</p>
        </div>
      </div>

      {/* Roster Attendance Table */}
      {rosterLearners.length === 0 ? (
        <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs font-medium">
          No learners found in the active class roster.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
          {rosterLearners.map((learner, idx) => {
            const state = attendanceState[learner.id] || {
              attendanceStatus: 'PRESENT',
              participationStatus: 'PRESENT',
              notes: '',
            };

            const isParticipated =
              state.participationStatus === 'PARTICIPATED' || state.participationStatus === 'COMPLETED_ACTIVITY';

            return (
              <div key={learner.id} className="p-3.5 bg-white space-y-2 hover:bg-slate-50/80 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Learner Info */}
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 text-xs font-black flex items-center justify-center border border-slate-200">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-extrabold text-slate-900">{learner.displayName}</p>
                        {state.isCorrected && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                            Corrected
                          </span>
                        )}
                      </div>
                      {learner.learnerIdentifier && (
                        <p className="text-xs text-slate-500 font-mono">ID: {learner.learnerIdentifier}</p>
                      )}
                    </div>
                  </div>

                  {/* Attendance Controls */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Status Buttons */}
                    <button
                      type="button"
                      onClick={() => handleStatusChange(learner.id, 'PRESENT')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        state.attendanceStatus === 'PRESENT'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      Present
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStatusChange(learner.id, 'ABSENT')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        state.attendanceStatus === 'ABSENT'
                          ? 'bg-red-600 text-white border-red-700 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      Absent
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStatusChange(learner.id, 'LATE')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        state.attendanceStatus === 'LATE'
                          ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      Late
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStatusChange(learner.id, 'EXCUSED')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        state.attendanceStatus === 'EXCUSED'
                          ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      Excused
                    </button>

                    {/* Participation Toggle */}
                    <button
                      type="button"
                      onClick={() => handleParticipationToggle(learner.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 ${
                        isParticipated
                          ? 'bg-purple-100 text-purple-900 border-purple-300 font-extrabold'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}
                      title="Optional participation tag"
                    >
                      <span>Participated</span>
                      {isParticipated && <span>✓</span>}
                    </button>

                    {/* Note Toggle */}
                    <button
                      type="button"
                      onClick={() =>
                        setShowNotesMap((prev) => ({
                          ...prev,
                          [learner.id]: !prev[learner.id],
                        }))
                      }
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg border border-transparent hover:border-slate-200"
                      title="Add note"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Optional Note Row */}
                {(showNotesMap[learner.id] || state.notes) && (
                  <div className="pt-1">
                    <input
                      type="text"
                      placeholder="Add optional teacher note (e.g. Joined after first exercise)..."
                      value={state.notes}
                      onChange={(e) => handleNoteChange(learner.id, e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-medium"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
