import React, { useState, useRef, useEffect } from 'react';
import { SchoolDirectoryService } from '../services/schoolDirectoryService.ts';
import { 
  DirectoryCSVValidationResult, 
  DirectoryCSVImportResult, 
  DirectoryImportLogEntry 
} from '../types/schoolDirectory.ts';
import { KENYA_COUNTIES } from '../constants/kenyaCounties.ts';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Database, 
  Eye, 
  FileText, 
  RefreshCw, 
  ShieldAlert, 
  CheckCircle,
  X,
  Info
} from 'lucide-react';
import Papa from 'papaparse';

interface AdminDirectoryCsvManagementProps {
  onClose?: () => void;
}

export const AdminDirectoryCsvManagement: React.FC<AdminDirectoryCsvManagementProps> = ({ onClose }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<DirectoryCSVValidationResult | null>(null);
  const [rawParsedRows, setRawParsedRows] = useState<any[]>([]);
  
  // Progress state
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number; percentage: number }>({
    processed: 0,
    total: 0,
    percentage: 0
  });
  const [importResult, setImportResult] = useState<DirectoryCSVImportResult | null>(null);

  // Stats & History
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [importHistory, setImportHistory] = useState<DirectoryImportLogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<DirectoryImportLogEntry | null>(null);
  const [countySearch, setCountySearch] = useState('');
  const [showCoverageAudit, setShowCoverageAudit] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshMetadata = () => {
    setLastUpdated(SchoolDirectoryService.getLastUpdatedTimestamp());
    setImportHistory(SchoolDirectoryService.getImportHistory());
  };

  useEffect(() => {
    refreshMetadata();
  }, []);

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
    link.setAttribute('download', `kenya_school_directory_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const val = SchoolDirectoryService.validateAndPreviewCSV(text, selectedFile.name, selectedFile.size);
      setValidationResult(val);

      // Parse full raw rows for import step
      const lines = text.split('\n').filter(l => !l.startsWith('#') && l.trim().length > 0).join('\n');
      const parsed = Papa.parse(lines, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim()
      });
      setRawParsedRows((parsed.data || []) as any[]);
      setStep(2);
    };
    reader.readAsText(selectedFile);
  };

  const handleExecuteImport = async () => {
    if (!rawParsedRows || rawParsedRows.length === 0) return;
    setStep(4);
    setImporting(true);
    setProgress({ processed: 0, total: rawParsedRows.length, percentage: 0 });

    try {
      const res = await SchoolDirectoryService.importDirectoryFromCSV(
        rawParsedRows,
        file?.name || 'imported_schools.csv',
        (prog) => setProgress(prog)
      );
      setImportResult(res);
      refreshMetadata();
    } catch (err: any) {
      alert('Error importing directory CSV: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const resetUpload = () => {
    setStep(1);
    setFile(null);
    setValidationResult(null);
    setRawParsedRows([]);
    setImportResult(null);
    setProgress({ processed: 0, total: 0, percentage: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const qualityReport = SchoolDirectoryService.getDataQualityReport();

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-8 space-y-6 shadow-sm font-sans max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-[#3b1464] border border-purple-200 shadow-3xs">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">School Directory & CSV Data Management</h2>
            <p className="text-xs text-slate-500 font-medium">Administrative import, validation, template downloads, and national coverage monitoring</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-[#3b1464] border border-purple-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV Template</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
          >
            <Download className="w-4 h-4" />
            <span>Export Directory CSV</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Timestamp Bar */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600 font-medium">
          <Clock className="w-4 h-4 text-purple-700" />
          <span>
            <strong>Directory last updated:</strong>{' '}
            {lastUpdated ? (
              <span className="font-bold text-slate-900">{lastUpdated}</span>
            ) : (
              <span className="italic text-slate-400">No directory update recorded</span>
            )}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowCoverageAudit(!showCoverageAudit)}
          className="text-xs font-black text-[#3b1464] hover:underline flex items-center gap-1"
        >
          <Database className="w-3.5 h-3.5" />
          <span>{showCoverageAudit ? 'Hide Audit Statistics' : 'View National Coverage Audit'}</span>
        </button>
      </div>

      {/* WORKFLOW: CSV IMPORT STEPS */}
      <div className="bg-purple-50/40 border border-purple-100 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase text-[#3b1464] tracking-wider flex items-center gap-1.5">
            <Upload className="w-4 h-4" />
            Administrative CSV Import Pipeline
          </h3>
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-[#3b1464] border border-purple-200">
            Step {step} of 4
          </span>
        </div>

        {/* STEP 1: SELECT FILE */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-purple-200 rounded-2xl p-8 text-center bg-white/60 hover:bg-white transition-all space-y-3">
              <Upload className="w-8 h-8 text-purple-600 mx-auto" />
              <div>
                <p className="text-xs font-bold text-slate-800">Select or drop a CSV file containing school directory data</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Supports schoolName, NEMIS code, KNEC code, County, Sub-County, Ownership, and Assessment Flags</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="directory-csv-upload-input"
              />
              <label
                htmlFor="directory-csv-upload-input"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#3b1464] hover:bg-[#2d0e4e] text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm transition-all"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Choose CSV File</span>
              </label>
            </div>
          </div>
        )}

        {/* STEP 2: VALIDATE */}
        {step === 2 && validationResult && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-purple-700" />
                  {validationResult.fileName}
                </span>
                <span className="text-[10px] font-semibold text-slate-400">
                  {(validationResult.fileSize / 1024).toFixed(1)} KB
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
                <div className="p-2 bg-slate-50 rounded-lg">
                  <p className="text-[9px] uppercase font-bold text-slate-400">Rows Discovered</p>
                  <p className="text-sm font-black text-slate-900 mt-0.5">{validationResult.rowsDiscovered}</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg">
                  <p className="text-[9px] uppercase font-bold text-slate-400">Columns Detected</p>
                  <p className="text-sm font-black text-slate-900 mt-0.5">{validationResult.columnsDetected.length}</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg col-span-2">
                  <p className="text-[9px] uppercase font-bold text-slate-400">Validation Status</p>
                  <p className={`text-xs font-black mt-0.5 flex items-center justify-center gap-1 ${
                    validationResult.validationStatus === 'VALIDATED' ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {validationResult.validationStatus === 'VALIDATED' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>VALIDATED — Ready for Preview</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Validation Errors Detected</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {validationResult.validationErrors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1 text-[11px]">
                  <p className="font-bold flex items-center gap-1">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    Validation Errors:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 pl-1">
                    {validationResult.validationErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={resetUpload}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Cancel / Re-select
              </button>

              {validationResult.validationStatus === 'VALIDATED' && (
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-5 py-2 bg-[#3b1464] hover:bg-[#2d0e4e] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
                >
                  <Eye className="w-4 h-4" />
                  <span>Proceed to Preview</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: PREVIEW */}
        {step === 3 && validationResult && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <p className="text-xs text-slate-600 font-medium">
              Review sample records discovered in <strong>{validationResult.fileName}</strong> before committing to the directory database:
            </p>

            <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[9px]">
                    <th className="p-2.5">School Name</th>
                    <th className="p-2.5">County</th>
                    <th className="p-2.5">Sub-County</th>
                    <th className="p-2.5">NEMIS</th>
                    <th className="p-2.5">KNEC</th>
                    <th className="p-2.5">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {validationResult.previewRecords.map((rec, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{rec.schoolName}</td>
                      <td className="p-2.5 text-slate-700">{rec.county}</td>
                      <td className="p-2.5 text-slate-600">{rec.subCounty || 'Central'}</td>
                      <td className="p-2.5 font-mono text-slate-600">{rec.nemisCode || 'N/A'}</td>
                      <td className="p-2.5 font-mono text-slate-600">{rec.knecCode || 'N/A'}</td>
                      <td className="p-2.5 text-slate-600">{rec.schoolType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Back
              </button>

              <button
                type="button"
                onClick={handleExecuteImport}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
              >
                <Upload className="w-4 h-4" />
                <span>Execute Import ({rawParsedRows.length} Records)</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: IMPORT PROGRESS & RESULTS */}
        {step === 4 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {importing ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-center">
                <div className="flex items-center justify-center gap-2 text-xs font-black text-[#3b1464] uppercase tracking-wider">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>IMPORTING SCHOOLS</span>
                </div>

                {/* VISIBLE REAL PROGRESS BAR */}
                <div className="space-y-1.5">
                  <div className="w-full bg-slate-100 rounded-full h-4 border border-slate-200 overflow-hidden relative">
                    <div
                      className="bg-purple-900 h-full transition-all duration-200 ease-out rounded-full"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-bold text-slate-600">
                    <span>{progress.percentage}% complete</span>
                    <span>{progress.processed.toLocaleString()} / {progress.total.toLocaleString()} records processed</span>
                  </div>
                </div>
              </div>
            ) : importResult ? (
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2 text-emerald-900">
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <h4 className="text-sm font-black uppercase tracking-wide">IMPORT COMPLETE ✓</h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-emerald-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Discovered</p>
                    <p className="text-base font-black text-slate-900 mt-0.5">{importResult.totalDiscovered}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-emerald-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Created</p>
                    <p className="text-base font-black text-emerald-700 mt-0.5">+{importResult.recordsCreated}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-emerald-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Updated</p>
                    <p className="text-base font-black text-purple-900 mt-0.5">{importResult.recordsUpdated}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-emerald-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Duplicates Skipped</p>
                    <p className="text-base font-black text-slate-600 mt-0.5">{importResult.duplicatesDetected}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-emerald-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Rejected</p>
                    <p className="text-base font-black text-rose-700 mt-0.5">{importResult.recordsRejected}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-emerald-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Requiring Review</p>
                    <p className="text-base font-black text-amber-700 mt-0.5">{importResult.recordsRequiringReview}</p>
                  </div>
                </div>

                <div className="pt-2 text-right">
                  <button
                    type="button"
                    onClick={resetUpload}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-3xs"
                  >
                    Done / Upload Another
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* IMPORT HISTORY SECTION */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-purple-700" />
          Recent Import History
        </h3>

        {importHistory.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">No previous CSV import logs recorded.</p>
        ) : (
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white text-xs divide-y divide-slate-100">
            {importHistory.map((log) => (
              <div key={log.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50">
                <div>
                  <p className="font-bold text-slate-900">{log.fileName}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{log.timestamp}</p>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-slate-600 font-semibold">{log.recordsProcessed} processed</span>
                  <span className="text-emerald-700 font-bold">+{log.recordsImported} imported</span>
                  <button
                    type="button"
                    onClick={() => setSelectedLog(log)}
                    className="px-2.5 py-1 bg-purple-50 text-[#3b1464] hover:bg-purple-100 border border-purple-200 rounded-lg text-[10px] font-bold"
                  >
                    View Import Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NATIONAL COVERAGE AUDIT OVERLAY / PANEL */}
      {showCoverageAudit && (
        <div className="space-y-4 pt-4 border-t border-slate-200 animate-in fade-in duration-200">
          <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
            <Database className="w-4 h-4 text-[#3b1464]" />
            National Coverage & Quality Report
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-lg font-black text-slate-900">{qualityReport.nationalTotals.totalDirectorySchools}</p>
              <p className="text-[9px] uppercase font-bold text-slate-400">Total Directory</p>
            </div>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
              <p className="text-lg font-black text-purple-900">{qualityReport.nationalTotals.totalEcgActive}</p>
              <p className="text-[9px] uppercase font-bold text-purple-500">ECG Active</p>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-lg font-black text-emerald-800">{qualityReport.nationalTotals.totalVerifiedSourceBacked}</p>
              <p className="text-[9px] uppercase font-bold text-emerald-600">Verified Real Baseline</p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-lg font-black text-amber-700">{qualityReport.nationalTotals.totalDirectoryOnly}</p>
              <p className="text-[9px] uppercase font-bold text-amber-500">Directory Only</p>
            </div>
          </div>

          {/* 47 County Filterable Table */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-700">County Data Distribution (47 Counties)</span>
              <input
                type="text"
                placeholder="Filter county..."
                value={countySearch}
                onChange={(e) => setCountySearch(e.target.value)}
                className="w-36 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none"
              />
            </div>

            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white text-xs">
              {SchoolDirectoryService.getCountyCoverageReport()
                .filter(row => row.county.toLowerCase().includes(countySearch.toLowerCase()))
                .map(row => (
                  <div key={row.county} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                    <span className="font-bold text-slate-900">{row.county}</span>
                    <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500">
                      <span>Total: <strong className="text-slate-900">{row.total}</strong></span>
                      <span>Active: <strong className="text-purple-900">{row.ecgActive}</strong></span>
                      <span>NEMIS: <strong className="text-emerald-700">{row.nemisCoverage}</strong></span>
                      <span>KNEC: <strong className="text-emerald-700">{row.knecCoverage}</strong></span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* IMPORT LOG DETAIL MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-sm uppercase">Import Details</h3>
              <button onClick={() => setSelectedLog(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <p><strong>File:</strong> {selectedLog.fileName}</p>
              <p><strong>Timestamp:</strong> {selectedLog.timestamp}</p>
              <p><strong>Processed:</strong> {selectedLog.recordsProcessed}</p>
              <p><strong>Created:</strong> {selectedLog.stats.recordsCreated}</p>
              <p><strong>Updated:</strong> {selectedLog.stats.recordsUpdated}</p>
              <p><strong>Duplicates Skipped:</strong> {selectedLog.stats.duplicatesDetected}</p>
              <p><strong>Rejected:</strong> {selectedLog.stats.recordsRejected}</p>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
