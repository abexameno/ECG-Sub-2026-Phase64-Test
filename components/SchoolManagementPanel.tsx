import React, { useState, useMemo, useEffect } from 'react';
import { SchoolProfile } from '../types/school.ts';
import { KenyaSchoolDirectoryRecord, DirectoryImportLogEntry } from '../types/schoolDirectory.ts';
import { SchoolConfigService } from '../services/schoolConfigService.ts';
import { SchoolDirectoryService } from '../services/schoolDirectoryService.ts';
import { AdminDirectoryCsvManagement } from './AdminDirectoryCsvManagement.tsx';
import { SchoolSettingsPanel } from './SchoolSettingsPanel.tsx';
import { User } from '../types.ts';
import { KENYA_COUNTIES } from '../constants/kenyaCounties.ts';
import { auth } from '../firebase.ts';
import { formatAuditLogsAsCsv } from '../services/exportService.ts';
import { formatAuditReportAsPdf } from '../services/pdfService.ts';
import { ACADEMIC_TERMS_2026 } from '../constants/academicCalendar.ts';
import { 
  School, 
  Search, 
  ShieldAlert, 
  GitMerge, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Plus, 
  Upload, 
  Download, 
  FileSpreadsheet, 
  Filter, 
  Check, 
  ChevronRight, 
  X, 
  Clock, 
  MapPin,
  FileText,
  Loader2,
  AlertCircle,
  Calendar,
  Printer
} from 'lucide-react';
import { motion } from 'motion/react';

interface SchoolManagementPanelProps {
  currentUser: User;
}

export const SchoolManagementPanel: React.FC<SchoolManagementPanelProps> = ({ currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'duplicates' | 'coverage' | 'export_logs'>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [merging, setMerging] = useState<string | null>(null);
  const [selectedSchoolIdForSettings, setSelectedSchoolIdForSettings] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Export Logs State & Reporting
  const [exportLogs, setExportLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logSearch, setLogSearch] = useState('');
  const [logFilterType, setLogFilterType] = useState('');
  const [logFilterGrade, setLogFilterGrade] = useState('');
  const [logDatePreset, setLogDatePreset] = useState<'all' | 'term_1' | 'term_2' | 'term_3' | 'custom'>('all');
  const [logStartDate, setLogStartDate] = useState('');
  const [logEndDate, setLogEndDate] = useState('');
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isReportTruncated, setIsReportTruncated] = useState(false);

  useEffect(() => {
    if (logDatePreset === 'term_1') {
      setLogStartDate('2026-01-06');
      setLogEndDate('2026-04-10');
    } else if (logDatePreset === 'term_2') {
      setLogStartDate('2026-05-04');
      setLogEndDate('2026-08-07');
    } else if (logDatePreset === 'term_3') {
      setLogStartDate('2026-08-31');
      setLogEndDate('2026-11-20');
    } else if (logDatePreset === 'all') {
      setLogStartDate('');
      setLogEndDate('');
    }
  }, [logDatePreset]);

  const fetchExportLogs = async () => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Authentication required. Please log in.');
      }

      const params = new URLSearchParams();
      if (logFilterType) params.append('contentType', logFilterType);
      if (logFilterGrade) params.append('grade', logFilterGrade);
      if (logStartDate) params.append('startDate', logStartDate);
      if (logEndDate) params.append('endDate', logEndDate);
      params.append('isReport', 'true');

      const res = await fetch(`/api/admin/portfolio-exports?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch export logs.');
      }

      const data = await res.json();
      setExportLogs(data.logs || []);
      setIsReportTruncated(!!data.isTruncated);
    } catch (err: any) {
      setLogsError(err.message || 'Unable to load export logs. Please check your administrative permissions.');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'export_logs') {
      fetchExportLogs();
    }
  }, [activeTab, logFilterType, logFilterGrade, logStartDate, logEndDate]);

  const filteredExportLogs = useMemo(() => {
    if (!logSearch.trim()) return exportLogs;
    const q = logSearch.toLowerCase().trim();
    return exportLogs.filter(item =>
      (item.teacherName && item.teacherName.toLowerCase().includes(q)) ||
      (item.subjects && item.subjects.some((s: string) => s.toLowerCase().includes(q))) ||
      (item.resourceTypes && item.resourceTypes.some((t: string) => t.toLowerCase().includes(q)))
    );
  }, [exportLogs, logSearch]);

  const exportLogStats = useMemo(() => {
    const totalPackages = filteredExportLogs.length;
    const totalDocumentsMerged = filteredExportLogs.reduce((sum, item) => sum + (item.resourceCount || 0), 0);
    const activeTeachers = new Set(filteredExportLogs.map(item => item.teacherName)).size;
    return { totalPackages, totalDocumentsMerged, activeTeachers };
  }, [filteredExportLogs]);

  const getDateRangeLabel = () => {
    if (logDatePreset === 'term_1') return 'Term 1 (2026-01-06 to 2026-04-10)';
    if (logDatePreset === 'term_2') return 'Term 2 (2026-05-04 to 2026-08-07)';
    if (logDatePreset === 'term_3') return 'Term 3 (2026-08-31 to 2026-11-20)';
    if (logDatePreset === 'custom' && (logStartDate || logEndDate)) {
      return `${logStartDate || 'Beginning'} to ${logEndDate || 'Present'}`;
    }
    return 'All Dates';
  };

  const handleExportCsvReport = () => {
    if (filteredExportLogs.length === 0) return;
    setIsExportingCsv(true);
    try {
      const schoolName = currentUser?.schoolName || 'Exameno School';
      const dateLabel = getDateRangeLabel();
      const csvData = formatAuditLogsAsCsv(filteredExportLogs, schoolName, dateLabel, {
        isTruncated: isReportTruncated,
        maxLimit: 1000
      });

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `exameno-portfolio-audit-report-${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('CSV Export Error:', err);
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleExportPdfReport = async () => {
    if (filteredExportLogs.length === 0) return;
    setIsExportingPdf(true);
    try {
      const schoolName = currentUser?.schoolName || 'Exameno School';
      const dateLabel = getDateRangeLabel();

      await formatAuditReportAsPdf(filteredExportLogs, {
        schoolName,
        dateRangeText: dateLabel,
        generatedAt: new Date().toISOString(),
        totalPackages: exportLogStats.totalPackages,
        totalDocumentsMerged: exportLogStats.totalDocumentsMerged,
        activeTeachers: exportLogStats.activeTeachers,
        isTruncated: isReportTruncated,
        maxLimit: 1000
      });
    } catch (err: any) {
      console.error('PDF Export Error:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Modals
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportHistoryModal, setShowImportHistoryModal] = useState(false);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [activeSelectorModal, setActiveSelectorModal] = useState<'county' | 'type' | 'ownership' | 'educationLevel' | 'ecgStatus' | 'regCounty' | 'regType' | null>(null);
  const [selectorSearch, setSelectorSearch] = useState('');

  // Filters State
  const [filters, setFilters] = useState<{
    county: string;
    subCounty: string;
    schoolType: string;
    ownership: string;
    educationLevel: string;
    ecgStatus: string;
  }>({
    county: '',
    subCounty: '',
    schoolType: '',
    ownership: '',
    educationLevel: '',
    ecgStatus: ''
  });

  // Add School Form State
  const [regName, setRegName] = useState('');
  const [regType, setRegType] = useState('Primary');
  const [regCounty, setRegCounty] = useState('Nairobi City');
  const [regSubCounty, setRegSubCounty] = useState('');
  const [regOwnership, setRegOwnership] = useState('Government/Public');
  const [regNemis, setRegNemis] = useState('');
  const [regKnec, setRegKnec] = useState('');

  // Directory Metadata
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [importHistory, setImportHistory] = useState<DirectoryImportLogEntry[]>([]);

  const refreshMetadata = () => {
    setLastUpdated(SchoolDirectoryService.getLastUpdatedTimestamp());
    setImportHistory(SchoolDirectoryService.getImportHistory());
  };

  useEffect(() => {
    refreshMetadata();
  }, [refreshKey]);

  // Load ECG active schools and directory records
  const ecgSchools = useMemo(() => {
    return SchoolConfigService.getAllSchoolsForAdmin();
  }, [refreshKey]);

  const directoryRecords = useMemo(() => {
    return SchoolDirectoryService.getAllDirectoryRecords();
  }, [refreshKey]);

  const duplicates = useMemo(() => {
    return SchoolConfigService.findDuplicateCandidates();
  }, [refreshKey]);

  // Consolidated Search + Filter logic across BOTH datasets
  const unifiedResults = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    // 1. Filter ECG Tenant Schools
    const matchedEcg = ecgSchools.filter(s => {
      const matchSearch = !q || (
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.schoolCode && s.schoolCode.toLowerCase().includes(q)) ||
        (s.county && s.county.toLowerCase().includes(q))
      );
      const matchCounty = !filters.county || s.county === filters.county;
      const matchStatus = !filters.ecgStatus || (
        filters.ecgStatus === 'ECG_ACTIVE' && s.status === 'active'
      ) || (
        filters.ecgStatus === 'MERGED' && s.status === 'merged'
      );
      return matchSearch && matchCounty && matchStatus;
    });

    const ecgItems = matchedEcg.map(s => ({
      id: s.id,
      name: s.name,
      county: s.county || 'Unspecified',
      subCounty: '',
      officialCode: s.schoolCode || s.id,
      nemisCode: '',
      knecCode: '',
      status: s.status === 'merged' ? 'MERGED' : 'ECG_ACTIVE',
      isEcgTenant: true,
      rawEcgSchool: s,
      rawDirRecord: null as KenyaSchoolDirectoryRecord | null
    }));

    // 2. Filter Directory Records (excluding items already matched as ECG tenants)
    const ecgTenantIds = new Set(ecgSchools.map(s => s.id));
    
    const matchedDir = directoryRecords.filter(d => {
      const isClaimed = d.claimedBySchoolId && ecgTenantIds.has(d.claimedBySchoolId);
      if (isClaimed) return false;

      const matchSearch = !q || (
        d.schoolName.toLowerCase().includes(q) ||
        d.directorySchoolId.toLowerCase().includes(q) ||
        (d.county && d.county.toLowerCase().includes(q)) ||
        (d.subCounty && d.subCounty.toLowerCase().includes(q)) ||
        (d.officialSchoolCode && d.officialSchoolCode.toLowerCase().includes(q)) ||
        (d.nemisCode && d.nemisCode.toLowerCase().includes(q)) ||
        (d.knecCode && d.knecCode.toLowerCase().includes(q))
      );

      const matchCounty = !filters.county || d.county === filters.county;
      const matchSubCounty = !filters.subCounty || (d.subCounty && d.subCounty.toLowerCase().includes(filters.subCounty.toLowerCase()));
      const matchType = !filters.schoolType || (d.schoolType && d.schoolType.toLowerCase().includes(filters.schoolType.toLowerCase()));
      const matchOwnership = !filters.ownership || (d.ownership && d.ownership.toLowerCase().includes(filters.ownership.toLowerCase()));
      const matchEducationLevel = !filters.educationLevel || (d.educationLevel && d.educationLevel.toLowerCase().includes(filters.educationLevel.toLowerCase()));
      const matchEcgStatus = !filters.ecgStatus || d.ecgStatus === filters.ecgStatus || d.verificationStatus === filters.ecgStatus;

      return matchSearch && matchCounty && matchSubCounty && matchType && matchOwnership && matchEducationLevel && matchEcgStatus;
    });

    const dirItems = matchedDir.map(d => ({
      id: d.directorySchoolId,
      name: d.schoolName,
      county: d.county || 'Unspecified',
      subCounty: d.subCounty || '',
      officialCode: d.officialSchoolCode || d.directorySchoolId,
      nemisCode: d.nemisCode || '',
      knecCode: d.knecCode || '',
      status: d.verificationStatus === 'UNVERIFIED' ? 'UNVERIFIED' : (d.ecgStatus || 'DIRECTORY_ONLY'),
      isEcgTenant: false,
      rawEcgSchool: null as SchoolProfile | null,
      rawDirRecord: d
    }));

    return [...ecgItems, ...dirItems];
  }, [ecgSchools, directoryRecords, searchTerm, filters, refreshKey]);

  // Statistics KPI calculations
  const stats = useMemo(() => {
    const total = ecgSchools.length + directoryRecords.filter(d => !d.claimedBySchoolId).length;
    const activeCount = ecgSchools.filter(s => s.status === 'active').length;
    const directoryOnlyCount = directoryRecords.filter(d => d.ecgStatus === 'DIRECTORY_ONLY' && !d.claimedBySchoolId).length;
    const unverifiedCount = directoryRecords.filter(d => d.verificationStatus === 'UNVERIFIED' || d.ecgStatus === 'UNVERIFIED').length;
    const needsReviewCount = duplicates.length;

    return {
      total,
      activeCount,
      directoryOnlyCount,
      unverifiedCount,
      needsReviewCount
    };
  }, [ecgSchools, directoryRecords, duplicates]);

  // Actions
  const handleDownloadTemplate = () => {
    const csvContent = SchoolDirectoryService.getCSVTemplate();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'kenya_school_directory_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    const csvContent = SchoolDirectoryService.exportDirectoryToCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `kenya_schools_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMerge = (sourceId: string, targetId: string) => {
    if (!window.confirm('Are you sure you want to merge these school records? This will consolidate memberships and update school references.')) {
      return;
    }

    setMerging(sourceId);
    try {
      const result = SchoolConfigService.mergeSchools({
        sourceSchoolId: sourceId,
        targetSchoolId: targetId,
        mergedByUserId: currentUser.id,
        notes: `Administrative merge initiated by ${currentUser.name}.`
      });

      if (result.success) {
        setSuccessMessage(result.message);
        setRefreshKey(prev => prev + 1);
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to merge schools');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setMerging(null);
    }
  };

  const handleRegisterMissingSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) return;

    setIsSubmitting(true);
    try {
      const activeProfile = await SchoolDirectoryService.registerMissingSchool(
        {
          name: regName.trim(),
          schoolType: regType,
          county: regCounty,
          subCounty: regSubCounty || undefined,
          officialSchoolCode: regNemis.trim() || regKnec.trim() || undefined
        },
        currentUser.id
      );

      setSuccessMessage(`School "${activeProfile.name}" registered successfully.`);
      setShowAddModal(false);
      setRegName('');
      setRegSubCounty('');
      setRegNemis('');
      setRegKnec('');
      setRefreshKey(prev => prev + 1);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to register school.');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaimAndActivate = async (record: KenyaSchoolDirectoryRecord) => {
    try {
      await SchoolDirectoryService.claimAndActivateSchool(record.directorySchoolId, currentUser.id);
      setSuccessMessage(`Activated school "${record.schoolName}" successfully.`);
      setRefreshKey(prev => prev + 1);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to claim school.');
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-6 font-sans">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2.5">
            <School className="w-7 h-7 text-[#3b1464]" />
            <span>SCHOOLS</span>
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-1">
            Manage ECG schools, discover schools in the Kenya National School Registry, and manage school records.
          </p>
        </div>

        {/* TOP ADMIN ACTIONS */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2.5 bg-[#3b1464] hover:bg-[#2e1065] text-white text-xs font-black rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add School</span>
          </button>
          <button
            onClick={() => setShowCsvModal(true)}
            className="px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={handleDownloadTemplate}
            className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <span>CSV Template</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ALERT MESSAGES */}
      {successMessage && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="text-xs font-bold">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800"><X className="w-4 h-4" /></button>
        </motion.div>
      )}

      {errorMessage && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span className="text-xs font-bold">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-800"><X className="w-4 h-4" /></button>
        </motion.div>
      )}

      {/* SCHOOL OVERVIEW KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 p-4 rounded-xl">
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Total Schools</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.total.toLocaleString()}</p>
          <p className="text-[9px] text-slate-400 font-medium mt-0.5">National Registry & Tenants</p>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl">
          <p className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">ECG Active</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{stats.activeCount.toLocaleString()}</p>
          <p className="text-[9px] text-emerald-600 font-medium mt-0.5">Active School Tenants</p>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl">
          <p className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">Directory Only</p>
          <p className="text-2xl font-black text-indigo-700 mt-1">{stats.directoryOnlyCount.toLocaleString()}</p>
          <p className="text-[9px] text-indigo-600 font-medium mt-0.5">Verified Reference Data</p>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl">
          <p className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Unverified</p>
          <p className="text-2xl font-black text-amber-700 mt-1">{stats.unverifiedCount.toLocaleString()}</p>
          <p className="text-[9px] text-amber-600 font-medium mt-0.5">Self-Registered Profiles</p>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl col-span-2 md:col-span-1">
          <p className="text-[10px] font-black uppercase text-rose-700 tracking-wider">Needs Review</p>
          <p className="text-2xl font-black text-rose-700 mt-1">{stats.needsReviewCount.toLocaleString()}</p>
          <p className="text-[9px] text-rose-600 font-medium mt-0.5">Potential Duplicates</p>
        </div>
      </div>

      {/* VIEW SUB-TABS */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'all' ? 'bg-[#3b1464] text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            All Schools ({unifiedResults.length.toLocaleString()})
          </button>

          <button
            onClick={() => setActiveTab('duplicates')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'duplicates' ? 'bg-[#3b1464] text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <GitMerge className="w-3.5 h-3.5" />
            <span>Duplicate Review ({duplicates.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('coverage')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'coverage' ? 'bg-[#3b1464] text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Directory Quality & Coverage</span>
          </button>

          <button
            onClick={() => setActiveTab('export_logs')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'export_logs' ? 'bg-[#3b1464] text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export Logs</span>
          </button>
        </div>

        {/* TIMESTAMP & IMPORT HISTORY TRIGGER */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>DIRECTORY LAST UPDATED:</span>
            <strong className="text-slate-800">{lastUpdated || 'No directory update recorded'}</strong>
          </div>

          <button
            onClick={() => setShowImportHistoryModal(true)}
            className="text-[10px] font-bold text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Import History ({importHistory.length})</span>
          </button>
        </div>
      </div>

      {/* VIEW: ALL SCHOOLS UNIFIED SEARCH & LIST */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          {/* UNIFIED SEARCH + FILTER BAR */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search schools by name, NEMIS/UIC, KNEC code, county..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-sm"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowFilterDrawer(true)}
              className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeFilterCount > 0 ? 'bg-purple-50 border-purple-300 text-[#3b1464]' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 bg-[#3b1464] text-white rounded-full text-[10px] font-black flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* ACTIVE FILTER BADGES */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {filters.county && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 border border-purple-200 text-[#3b1464] text-[10px] font-bold rounded-lg">
                  County: {filters.county}
                  <button onClick={() => setFilters(f => ({ ...f, county: '' }))} className="hover:text-rose-600"><X className="w-3 h-3" /></button>
                </span>
              )}
              {filters.schoolType && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 border border-purple-200 text-[#3b1464] text-[10px] font-bold rounded-lg">
                  Type: {filters.schoolType}
                  <button onClick={() => setFilters(f => ({ ...f, schoolType: '' }))} className="hover:text-rose-600"><X className="w-3 h-3" /></button>
                </span>
              )}
              {filters.ownership && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 border border-purple-200 text-[#3b1464] text-[10px] font-bold rounded-lg">
                  Ownership: {filters.ownership}
                  <button onClick={() => setFilters(f => ({ ...f, ownership: '' }))} className="hover:text-rose-600"><X className="w-3 h-3" /></button>
                </span>
              )}
              {filters.ecgStatus && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 border border-purple-200 text-[#3b1464] text-[10px] font-bold rounded-lg">
                  Status: {filters.ecgStatus}
                  <button onClick={() => setFilters(f => ({ ...f, ecgStatus: '' }))} className="hover:text-rose-600"><X className="w-3 h-3" /></button>
                </span>
              )}
              <button
                onClick={() => setFilters({ county: '', subCounty: '', schoolType: '', ownership: '', educationLevel: '', ecgStatus: '' })}
                className="text-[10px] font-black text-rose-600 hover:underline ml-1 cursor-pointer"
              >
                Clear All
              </button>
            </div>
          )}

          {/* UNIFIED RESULTS TABLE */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-wider">
                    <th className="px-6 py-3.5">School Details</th>
                    <th className="px-6 py-3.5 text-center">County / Location</th>
                    <th className="px-6 py-3.5 text-center">Identifiers</th>
                    <th className="px-6 py-3.5 text-center">Unified Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unifiedResults.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-black text-slate-900 text-sm">{item.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                          <span>ID: {item.id}</span>
                          {item.officialCode && <span>• Code: {item.officialCode}</span>}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <div className="font-bold text-slate-800">{item.county}</div>
                        {item.subCounty && <div className="text-[10px] text-slate-500 font-medium">{item.subCounty}</div>}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <div className="space-y-0.5">
                          {item.nemisCode && <div className="text-[10px] font-bold text-slate-700">NEMIS: {item.nemisCode}</div>}
                          {item.knecCode && <div className="text-[10px] font-bold text-slate-700">KNEC: {item.knecCode}</div>}
                          {!item.nemisCode && !item.knecCode && <span className="text-[10px] text-slate-400 italic">—</span>}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          item.status === 'ECG_ACTIVE' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          item.status === 'DIRECTORY_ONLY' ? 'bg-purple-100 text-purple-900 border border-purple-200' :
                          item.status === 'UNVERIFIED' ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                          item.status === 'MERGED' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                          'bg-indigo-100 text-indigo-900 border border-indigo-200'
                        }`}>
                          {item.status === 'ECG_ACTIVE' ? 'ECG ACTIVE' :
                           item.status === 'DIRECTORY_ONLY' ? 'DIRECTORY ONLY' :
                           item.status === 'UNVERIFIED' ? 'UNVERIFIED' :
                           item.status === 'MERGED' ? 'MERGED' : item.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {item.isEcgTenant ? (
                            <button
                              onClick={() => setSelectedSchoolIdForSettings(item.id)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                            >
                              Manage School
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (item.rawDirRecord) {
                                  handleClaimAndActivate(item.rawDirRecord);
                                }
                              }}
                              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <span>Claim & Activate</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {unifiedResults.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">
                        No school records found matching your search and filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: DUPLICATE REVIEW */}
      {activeTab === 'duplicates' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-bold text-amber-900 text-xs uppercase tracking-wider">Duplicate Review Active</div>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                Review potential duplicate school profiles across active ECG school tenants and Kenya National School Directory records. Resolving duplicate candidates merges user memberships and ensures one canonical school record.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            {duplicates.map((candidate) => (
              <div key={candidate.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      candidate.confidence === 'high' ? 'bg-emerald-600 text-white' :
                      candidate.confidence === 'medium' ? 'bg-amber-500 text-white' : 'bg-slate-500 text-white'
                    }`}>
                      {candidate.confidence} Confidence
                    </span>
                    <span className="text-xs text-slate-600 font-bold">{candidate.reason}</span>
                  </div>

                  <button 
                    disabled={merging === candidate.schoolA.id || merging === candidate.schoolB.id}
                    onClick={() => {
                      const sourceId = candidate.schoolA.id === candidate.recommendedCanonicalId ? candidate.schoolB.id : candidate.schoolA.id;
                      const targetId = candidate.recommendedCanonicalId;
                      handleMerge(sourceId, targetId);
                    }}
                    className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    {merging === candidate.schoolA.id || merging === candidate.schoolB.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <GitMerge className="w-3.5 h-3.5" />
                    )}
                    Resolve & Merge
                  </button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Candidate A */}
                  <div className={`p-4 rounded-xl border ${candidate.schoolA.id === candidate.recommendedCanonicalId ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Candidate A</div>
                    <div className="font-black text-slate-900 text-sm">{candidate.schoolA.name}</div>
                    <div className="text-xs text-slate-500 font-mono mt-1">ID: {candidate.schoolA.id}</div>
                    <div className="mt-3 text-xs text-slate-600 font-medium">County: {candidate.schoolA.county || 'Unspecified'}</div>
                  </div>

                  {/* Candidate B */}
                  <div className={`p-4 rounded-xl border ${candidate.schoolB.id === candidate.recommendedCanonicalId ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Candidate B</div>
                    <div className="font-black text-slate-900 text-sm">{candidate.schoolB.name}</div>
                    <div className="text-xs text-slate-500 font-mono mt-1">ID: {candidate.schoolB.id}</div>
                    <div className="mt-3 text-xs text-slate-600 font-medium">County: {candidate.schoolB.county || 'Unspecified'}</div>
                  </div>
                </div>
              </div>
            ))}

            {duplicates.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl py-16 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <div className="text-base font-bold text-slate-900">Directory Clean</div>
                <p className="text-xs text-slate-500">No duplicate school candidate records detected at this time.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: COVERAGE & QUALITY */}
      {activeTab === 'coverage' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight mb-2">47 Kenya County Coverage Audit</h3>
            <p className="text-xs text-slate-600 font-medium mb-6">
              National directory school counts and verification status breakdown across Kenya's 47 counties.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {KENYA_COUNTIES.map((county) => {
                const count = directoryRecords.filter(d => d.county === county).length;
                const active = ecgSchools.filter(s => s.county === county && s.status === 'active').length;
                return (
                  <div key={county} className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-xs font-black text-slate-800 truncate">{county}</p>
                    <div className="flex items-center justify-between mt-2 text-[10px] font-bold">
                      <span className="text-slate-500">Total: {count}</span>
                      <span className="text-emerald-700">Active: {active}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CSV IMPORT WORKFLOW */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#3b1464]" />
                <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Import School Directory CSV</h2>
              </div>
              <button
                type="button"
                onClick={() => { setShowCsvModal(false); refreshMetadata(); }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <AdminDirectoryCsvManagement onClose={() => { setShowCsvModal(false); refreshMetadata(); }} />
          </div>
        </div>
      )}

      {/* MODAL: ADD / REGISTER MISSING SCHOOL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleRegisterMissingSchool} className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 max-w-lg w-full relative animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#3b1464]" />
                <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Add / Register Missing School</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">School Name *</label>
              <input
                type="text"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="e.g. Alliance High School"
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
                  <span>{regType}</span>
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
                  <span className="truncate">{regCounty}</span>
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
                  placeholder="e.g. Kikuyu"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Ownership</label>
                <select
                  value={regOwnership}
                  onChange={(e) => setRegOwnership(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  <option value="Government/Public">Public / Government</option>
                  <option value="Private">Private</option>
                  <option value="Community/Mission">Community / Mission</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">NEMIS Code (Optional)</label>
                <input
                  type="text"
                  value={regNemis}
                  onChange={(e) => setRegNemis(e.target.value)}
                  placeholder="NEMIS Code"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">KNEC Code (Optional)</label>
                <input
                  type="text"
                  value={regKnec}
                  onChange={(e) => setRegKnec(e.target.value)}
                  placeholder="KNEC Code"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-[#3b1464] hover:bg-[#2e1065] text-white text-xs font-black rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Registering...' : 'Register School'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: IMPORT HISTORY */}
      {showImportHistoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto relative animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#3b1464]" />
                <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Directory Import History</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowImportHistoryModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {importHistory.map((log) => (
                <div key={log.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-slate-900">{log.fileName}</p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      {new Date(log.timestamp).toLocaleString()} • {log.recordsProcessed.toLocaleString()} rows processed
                    </p>
                  </div>

                  <div className="text-right text-[10px] font-bold">
                    <span className="text-emerald-700">{log.stats?.recordsCreated || log.recordsImported} Created</span>
                    {log.stats?.recordsUpdated ? <span className="text-indigo-700 ml-2">{log.stats.recordsUpdated} Updated</span> : null}
                  </div>
                </div>
              ))}

              {importHistory.length === 0 && (
                <div className="py-12 text-center text-xs text-slate-500 italic">
                  No directory import log entries recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW: PORTFOLIO EXPORT AUDIT LOGS */}
      {activeTab === 'export_logs' && (
        <div className="space-y-6">
          {/* HEADER & SUMMARY KPIS */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#3b1464]" />
                <span>Portfolio Export Audit Logs</span>
              </h2>
              <p className="text-xs text-slate-600 font-medium mt-1">
                Read-only audit trail of merged content packages generated by teachers in your school.
              </p>
            </div>

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-purple-50/60 border border-purple-100 p-4 rounded-xl">
                <p className="text-[10px] font-black uppercase text-[#3b1464] tracking-wider">Total Packages Exported</p>
                <p className="text-2xl font-black text-[#3b1464] mt-1">{exportLogStats.totalPackages.toLocaleString()}</p>
                <p className="text-[9px] text-purple-700 font-medium mt-0.5">Verified Merged PDF Bundles</p>
              </div>

              <div className="bg-emerald-50/60 border border-emerald-100 p-4 rounded-xl">
                <p className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">Total Documents Merged</p>
                <p className="text-2xl font-black text-emerald-800 mt-1">{exportLogStats.totalDocumentsMerged.toLocaleString()}</p>
                <p className="text-[9px] text-emerald-700 font-medium mt-0.5">Individual Resources Included</p>
              </div>

              <div className="bg-indigo-50/60 border border-indigo-100 p-4 rounded-xl">
                <p className="text-[10px] font-black uppercase text-indigo-800 tracking-wider">Active Exporting Teachers</p>
                <p className="text-2xl font-black text-indigo-800 mt-1">{exportLogStats.activeTeachers.toLocaleString()}</p>
                <p className="text-[9px] text-indigo-700 font-medium mt-0.5">Authorized Staff Members</p>
              </div>
            </div>
          </div>

          {/* CONTROLS & FILTERS */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={logSearch}
                onChange={e => setLogSearch(e.target.value)}
                placeholder="Filter by teacher name, subject, or type..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#3b1464]/20 focus:border-[#3b1464]"
              />
              {logSearch && (
                <button onClick={() => setLogSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={logDatePreset}
                onChange={e => setLogDatePreset(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Dates</option>
                <option value="term_1">Term 1 (2026-01-06 to 2026-04-10)</option>
                <option value="term_2">Term 2 (2026-05-04 to 2026-08-07)</option>
                <option value="term_3">Term 3 (2026-08-31 to 2026-11-20)</option>
                <option value="custom">Custom Date Range</option>
              </select>

              {logDatePreset === 'custom' && (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="date"
                    value={logStartDate}
                    onChange={e => setLogStartDate(e.target.value)}
                    className="bg-transparent text-xs text-slate-700 focus:outline-none"
                    placeholder="Start Date"
                  />
                  <span className="text-slate-400 text-[10px]">to</span>
                  <input
                    type="date"
                    value={logEndDate}
                    onChange={e => setLogEndDate(e.target.value)}
                    className="bg-transparent text-xs text-slate-700 focus:outline-none"
                    placeholder="End Date"
                  />
                </div>
              )}

              <select
                value={logFilterType}
                onChange={e => setLogFilterType(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="">All Resource Types</option>
                <option value="lesson_plan">Lesson Plan</option>
                <option value="scheme_of_work">Scheme of Work</option>
                <option value="lesson_notes">Lesson Notes</option>
                <option value="assessment">Assessment / Exam</option>
              </select>

              <select
                value={logFilterGrade}
                onChange={e => setLogFilterGrade(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="">All Grades</option>
                {Array.from({ length: 10 }).map((_, i) => (
                  <option key={i + 1} value={`Grade ${i + 1}`}>{`Grade ${i + 1}`}</option>
                ))}
              </select>

              <button
                onClick={fetchExportLogs}
                disabled={logsLoading}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={handleExportCsvReport}
                disabled={logsLoading || filteredExportLogs.length === 0 || isExportingCsv}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Export filtered audit log report as CSV spreadsheet"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handleExportPdfReport}
                disabled={logsLoading || filteredExportLogs.length === 0 || isExportingPdf}
                className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-[#3b1464] border border-purple-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Generate printable PDF audit report"
              >
                <Printer className="w-3.5 h-3.5 text-[#3b1464]" />
                <span>Print PDF</span>
              </button>
            </div>
          </div>

          {/* ERROR STATE */}
          {logsError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs font-bold flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{logsError}</span>
            </div>
          )}

          {/* TRUNCATION NOTICE BANNER */}
          {isReportTruncated && !logsLoading && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  <strong>Notice:</strong> This report reached the maximum limit of 1,000 records for the selected period. Filter by a narrower date range or specific term for a complete ledger.
                </span>
              </div>
            </div>
          )}

          {/* LOADING SKELETON STATE */}
          {logsLoading && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#3b1464] animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-600">Retrieving authorized export audit ledger...</p>
            </div>
          )}

          {/* EMPTY STATE */}
          {!logsLoading && !logsError && filteredExportLogs.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <FileText className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-tight">No portfolio exports recorded for this school yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                When authorized teachers in your school export merged PDF portfolios, audit records will automatically register here.
              </p>
            </div>
          )}

          {/* LOGS LIST / TABLE */}
          {!logsLoading && !logsError && filteredExportLogs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                      <th className="py-3 px-4">Teacher Name</th>
                      <th className="py-3 px-4">Export Date & Time</th>
                      <th className="py-3 px-4">Resources</th>
                      <th className="py-3 px-4">Content Types</th>
                      <th className="py-3 px-4">Grades & Subjects</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredExportLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-purple-100 text-[#3b1464] font-black text-[10px] flex items-center justify-center flex-shrink-0">
                            {log.teacherName.charAt(0).toUpperCase()}
                          </div>
                          <span>{log.teacherName}</span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                          {new Date(log.generatedAt).toLocaleString('en-GB', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[10px] font-extrabold">
                            {log.resourceCount} {log.resourceCount === 1 ? 'doc' : 'docs'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {log.resourceTypes.length > 0 ? log.resourceTypes.map((t: string) => t.replace(/_/g, ' ')).join(', ') : 'Mixed Content'}
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          <div className="text-[11px] font-bold text-slate-800">{log.grades.join(', ') || 'N/A'}</div>
                          <div className="text-[10px] text-slate-500">{log.subjects.join(', ') || 'General'}</div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-black">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                            <span>{log.status || 'Authorized Export'}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AUDIT DISCLAIMER */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-start gap-2.5 text-[11px] text-slate-600">
            <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Audit Disclaimer:</strong> Status indicates server authorization and audit logging. Client-side browser download delivery is managed on the teacher's local device.
            </span>
          </div>
        </div>
      )}

      {/* MODAL / DRAWER: CUSTOM ECG PWA FILTER SELECTOR */}
      {showFilterDrawer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white border-2 border-slate-200 rounded-t-3xl sm:rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto relative animate-in slide-in-from-bottom duration-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-[#3b1464]" />
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Directory Filters</h3>
              </div>
              <button
                onClick={() => setShowFilterDrawer(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">County</label>
                <button
                  type="button"
                  onClick={() => setActiveSelectorModal('county')}
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between cursor-pointer"
                >
                  <span>{filters.county || 'All Counties'}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">School Type</label>
                <button
                  type="button"
                  onClick={() => setActiveSelectorModal('type')}
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between cursor-pointer"
                >
                  <span>{filters.schoolType || 'All Types'}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Ownership</label>
                <button
                  type="button"
                  onClick={() => setActiveSelectorModal('ownership')}
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between cursor-pointer"
                >
                  <span>{filters.ownership || 'All Ownership'}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">ECG Unified Status</label>
                <button
                  type="button"
                  onClick={() => setActiveSelectorModal('ecgStatus')}
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between cursor-pointer"
                >
                  <span>{filters.ecgStatus || 'All Statuses'}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => {
                  setFilters({ county: '', subCounty: '', schoolType: '', ownership: '', educationLevel: '', ecgStatus: '' });
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                Reset Filters
              </button>

              <button
                onClick={() => setShowFilterDrawer(false)}
                className="px-6 py-2.5 bg-[#3b1464] hover:bg-[#2e1065] text-white text-xs font-black rounded-xl shadow-sm cursor-pointer"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM OVERLAY SELECTOR MODAL (COUNTIES, TYPES, ETC) */}
      {activeSelectorModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 max-w-md w-full max-h-[80vh] flex flex-col relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">
                Select {activeSelectorModal.replace('reg', '')}
              </h4>
              <button
                onClick={() => { setActiveSelectorModal(null); setSelectorSearch(''); }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(activeSelectorModal === 'county' || activeSelectorModal === 'regCounty') && (
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search 47 counties..."
                  value={selectorSearch}
                  onChange={(e) => setSelectorSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
            )}

            <div className="overflow-y-auto space-y-1.5 flex-1 pr-1">
              {(activeSelectorModal === 'county' || activeSelectorModal === 'regCounty') && (
                <>
                  {activeSelectorModal === 'county' && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilters(f => ({ ...f, county: '' }));
                        setActiveSelectorModal(null);
                        setSelectorSearch('');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl border border-slate-100 hover:bg-slate-50 text-xs font-medium text-slate-700 flex justify-between cursor-pointer"
                    >
                      <span>All Counties</span>
                      {!filters.county && <Check className="w-4 h-4 text-[#3b1464]" />}
                    </button>
                  )}
                  {KENYA_COUNTIES.filter(c => c.toLowerCase().includes(selectorSearch.toLowerCase())).map(county => {
                    const isSelected = activeSelectorModal === 'county' ? filters.county === county : regCounty === county;
                    return (
                      <button
                        key={county}
                        type="button"
                        onClick={() => {
                          if (activeSelectorModal === 'county') setFilters(f => ({ ...f, county }));
                          else setRegCounty(county);
                          setActiveSelectorModal(null);
                          setSelectorSearch('');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl border text-xs flex items-center justify-between transition-all cursor-pointer ${
                          isSelected ? 'bg-purple-50 text-[#3b1464] border-purple-200 font-bold' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-100 font-medium'
                        }`}
                      >
                        <span>{county}</span>
                        {isSelected && <Check className="w-4 h-4 text-[#3b1464]" />}
                      </button>
                    );
                  })}
                </>
              )}

              {activeSelectorModal === 'type' && [
                { label: 'All Types', val: '' },
                { label: 'Primary School', val: 'Primary' },
                { label: 'Junior Secondary School', val: 'Junior Secondary' },
                { label: 'Secondary School', val: 'Secondary' },
                { label: 'Special Needs Institution', val: 'Special Needs' },
              ].map(opt => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    setFilters(f => ({ ...f, schoolType: opt.val }));
                    setActiveSelectorModal(null);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl border text-xs flex items-center justify-between transition-all cursor-pointer ${
                    filters.schoolType === opt.val ? 'bg-purple-50 text-[#3b1464] border-purple-200 font-bold' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-100 font-medium'
                  }`}
                >
                  <span>{opt.label}</span>
                  {filters.schoolType === opt.val && <Check className="w-4 h-4 text-[#3b1464]" />}
                </button>
              ))}

              {activeSelectorModal === 'regType' && [
                'Primary', 'Junior Secondary', 'Secondary', 'Special Needs'
              ].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setRegType(val);
                    setActiveSelectorModal(null);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl border text-xs flex items-center justify-between transition-all cursor-pointer ${
                    regType === val ? 'bg-purple-50 text-[#3b1464] border-purple-200 font-bold' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-100 font-medium'
                  }`}
                >
                  <span>{val}</span>
                  {regType === val && <Check className="w-4 h-4 text-[#3b1464]" />}
                </button>
              ))}

              {activeSelectorModal === 'ownership' && [
                { label: 'All Ownership', val: '' },
                { label: 'Public / Government', val: 'Government/Public' },
                { label: 'Private', val: 'Private' },
                { label: 'Community / Mission', val: 'Community/Mission' },
              ].map(opt => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    setFilters(f => ({ ...f, ownership: opt.val }));
                    setActiveSelectorModal(null);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl border text-xs flex items-center justify-between transition-all cursor-pointer ${
                    filters.ownership === opt.val ? 'bg-purple-50 text-[#3b1464] border-purple-200 font-bold' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-100 font-medium'
                  }`}
                >
                  <span>{opt.label}</span>
                  {filters.ownership === opt.val && <Check className="w-4 h-4 text-[#3b1464]" />}
                </button>
              ))}

              {activeSelectorModal === 'ecgStatus' && [
                { label: 'All Statuses', val: '' },
                { label: 'ECG Active', val: 'ECG_ACTIVE' },
                { label: 'Directory Only', val: 'DIRECTORY_ONLY' },
                { label: 'Unverified', val: 'UNVERIFIED' },
                { label: 'Merged', val: 'MERGED' },
              ].map(opt => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    setFilters(f => ({ ...f, ecgStatus: opt.val }));
                    setActiveSelectorModal(null);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl border text-xs flex items-center justify-between transition-all cursor-pointer ${
                    filters.ecgStatus === opt.val ? 'bg-purple-50 text-[#3b1464] border-purple-200 font-bold' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-100 font-medium'
                  }`}
                >
                  <span>{opt.label}</span>
                  {filters.ecgStatus === opt.val && <Check className="w-4 h-4 text-[#3b1464]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SCHOOL SETTINGS & MANAGE PROFILE */}
      {selectedSchoolIdForSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl animate-in zoom-in-95 duration-150">
            <SchoolSettingsPanel
              schoolId={selectedSchoolIdForSettings}
              currentUserId={currentUser.id}
              currentUser={currentUser}
              onCloseModal={() => {
                setSelectedSchoolIdForSettings(null);
                setRefreshKey(prev => prev + 1);
              }}
              onProfileUpdated={() => {
                setRefreshKey(prev => prev + 1);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
