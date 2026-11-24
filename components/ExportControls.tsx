
import React, { useState } from 'react';
import { GeneratedContent, ExportFormat, ExportHeaderInfo, AssessmentExportType, ContentType, User, ContentArtifact } from '../types.ts';
import { formatAsDocx, generateFilename, formatAsExcel, formatAsCsv, formatAsPptx, formatAsMoodleXml } from '../services/exportService.ts';
import { formatAsPdf } from '../services/pdfService.ts';
import { ICONS } from '../constants.tsx';

const downloadBlob = (blob: Blob, filename: string) => {
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = filename;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
};

interface ExportControlsProps {
 content: GeneratedContent;
 layout?: 'row' | 'column' | 'compact';
 headerInfo?: ExportHeaderInfo;
 setHeaderInfo?: React.Dispatch<React.SetStateAction<ExportHeaderInfo>>;
 assessmentExportType?: AssessmentExportType;
 setAssessmentExportType?: React.Dispatch<React.SetStateAction<AssessmentExportType>>;
 currentUser?: User | null;
 artifact?: ContentArtifact;
}

export const ExportControls: React.FC<ExportControlsProps> = ({ 
 content, 
 layout = 'row', 
 headerInfo: controlledHeaderInfo, 
 setHeaderInfo: setControlledHeaderInfo, 
 assessmentExportType: controlledExportType, 
 setAssessmentExportType: setControlledExportType,
 currentUser,
 artifact
}) => {
 const [internalExportType, setInternalExportType] = useState<AssessmentExportType>(AssessmentExportType.QuestionsAndAnswers);
 const [internalHeaderInfo, setInternalHeaderInfo] = useState<ExportHeaderInfo>({
 includeHeader: false,
 schoolName: artifact?.schoolName || 'Exameno ECG',
 gradeLevel: content.metadata?.grade || '',
 subject: content.metadata?.subject || '',
 term: content.metadata?.term || '',
 contentType: content.metadata?.contentType || '',
 teacherName: '',
 fontFamily: 'Arial',
 layoutColumns: 'one',
 spacing: 'normal',
 tableStyle: 'lightHorizontalLines',
 pageMargins: 'normal',
 includeAudit: false,
 includeRubric: false,
 includeSummary: false,
 includeBody: true,
 });
 const [isLoading, setIsLoading] = useState<ExportFormat | null>(null);

 const isExportTypeControlled = controlledExportType !== undefined && setControlledExportType !== undefined;
 const assessmentExportType = isExportTypeControlled ? controlledExportType : internalExportType;
 const setAssessmentExportType = isExportTypeControlled ? setControlledExportType : setInternalExportType;

 const isHeaderInfoControlled = controlledHeaderInfo !== undefined && setControlledHeaderInfo !== undefined;
 const headerInfo = isHeaderInfoControlled ? controlledHeaderInfo : internalHeaderInfo;
 const setHeaderInfo = isHeaderInfoControlled ? setControlledHeaderInfo : setInternalHeaderInfo;
 
 const handleExport = async (format: ExportFormat) => {
 if (!content || isLoading) return;

 const hasContentToExport = content.body || (content.questions && content.questions.length > 0) || content.schemeOfWorkData || content.rowcData;
 if (!hasContentToExport) {
 alert("There is no generated content to export yet.");
 return;
 }

 setIsLoading(format);
 
 try {
 switch (format) {
 case ExportFormat.PDF:
 await formatAsPdf(content, assessmentExportType, headerInfo, artifact);
 break;
 case ExportFormat.Word:
 const docxBlob = await formatAsDocx(content, assessmentExportType, headerInfo);
 downloadBlob(docxBlob, generateFilename(content, 'docx', assessmentExportType));
 break;
 case ExportFormat.Excel:
 const excelBlob = await formatAsExcel(content, assessmentExportType, headerInfo);
 downloadBlob(excelBlob, generateFilename(content, 'xlsx', assessmentExportType));
 break;
 case ExportFormat.CSV:
 const csvString = await formatAsCsv(content);
 const csvBlob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
 downloadBlob(csvBlob, generateFilename(content, 'csv'));
 break;
 case ExportFormat.PowerPoint:
 const pptBlob = await formatAsPptx(content, headerInfo);
 downloadBlob(pptBlob, generateFilename(content, 'pptx')); 
 break;
 case ExportFormat.MoodleXML:
 const moodleXmlString = formatAsMoodleXml(content);
 const moodleXmlBlob = new Blob([moodleXmlString], { type: 'application/xml;charset=utf-8;' });
 downloadBlob(moodleXmlBlob, generateFilename(content, 'xml'));
 break;
 }
 } catch (error) {
 console.error(`Export error (${format}):`, error);
 alert(`Export failed for ${format}. Please try again.`);
 } finally {
 setIsLoading(null);
 }
 };

 const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
 const { name, value, type } = e.target;
 const isCheckbox = type === 'checkbox';
 const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;
 setHeaderInfo(prev => ({
 ...prev,
 [name]: isCheckbox ? checked : value,
 }));
 };
 
 const isAssessment = content.questions && content.questions.length > 0;
 const isTabular = !!(content.schemeOfWorkData || content.rowcData);
 const isSOW = content.metadata?.contentType === ContentType.SchemeOfWork || !!content.schemeOfWorkData;
 
 const isEducatorOrAdmin = !currentUser || ['Admin', 'School Admin', 'Teacher'].includes(currentUser.role);

 const buttons = [
 { format: ExportFormat.PDF, icon: ICONS.pdf, className: "bg-red-600 hover:bg-red-700 border-red-700", label: "PDF", description: "Best for printing and sharing" },
 !isSOW && { format: ExportFormat.Word, icon: ICONS.word, className: "bg-blue-600 hover:bg-blue-700 border-blue-700", label: "Word", description: "Editable document" },
 (isAssessment || isTabular) && { format: ExportFormat.Excel, icon: ICONS.excel, className: "bg-green-600 hover:bg-green-700 border-green-700", label: "Excel", description: "Data and tables" },
 isAssessment && isEducatorOrAdmin && { format: ExportFormat.MoodleXML, icon: ICONS.moodle, className: "bg-amber-600 hover:bg-amber-700 border-amber-700", label: "Moodle XML", description: "For LMS import" }
 ].filter(Boolean);
 
 return (
 <div className="space-y-6">
 <div className="mb-4">
 <h3 className="text-lg font-semibold text-gray-900">Export Document</h3>
 <p className="text-sm text-gray-500 mb-4">Download your content in your preferred format.</p>
 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
 {buttons.map((btn: any) => btn && (
 <button 
 key={btn.format} 
 onClick={() => handleExport(btn.format as ExportFormat)} 
 disabled={!!isLoading}
 className={`flex flex-col items-start justify-center p-4 text-white rounded-xl transition-all hover:shadow-md hover:-translate-y-0.5 border ${btn.className} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
 >
 <div className="flex items-center text-base font-bold mb-1">
 <span className="mr-2">{btn.icon}</span> {btn.label}
 </div>
 <span className="text-xs opacity-90 text-left font-medium">{btn.description}</span>
 {isLoading === btn.format && (
 <div className="mt-2 text-xs font-semibold animate-pulse">Exporting...</div>
 )}
 </button>
 ))}
 </div>
 </div>

 {layout === 'row' && (
 <div className="space-y-6 pt-6 border-t border-slate-200">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 {isAssessment && (
 <fieldset>
 <legend className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Assessment Options</legend>
 <div className="space-y-2">
 {Object.values(AssessmentExportType).map((type) => (
 <div key={type} className="flex items-center">
 <input
 id={`export-type-${type}`}
 name="assessmentExportType"
 type="radio"
 value={type}
 checked={assessmentExportType === type}
 onChange={() => setAssessmentExportType(type)}
 className="h-4 w-4 text-emerald-600 border-slate-200 focus:ring-emerald-500"
 />
 <label htmlFor={`export-type-${type}`} className="ml-2 block text-sm text-gray-700">{type}</label>
 </div>
 ))}
 {content.body && (
 <div className="flex items-center pt-2 mt-2 border-t border-slate-200">
 <input 
 id="includeBody" 
 name="includeBody" 
 type="checkbox" 
 checked={headerInfo.includeBody !== false} 
 onChange={handleHeaderChange} 
 className="h-4 w-4 rounded border-slate-200 text-emerald-600 focus:ring-emerald-500" 
 />
 <label htmlFor="includeBody" className="ml-2 block text-sm text-gray-700">
 Include Content Body
 </label>
 </div>
 )}
 </div>
 </fieldset>
 )}

 {(content.auditReport || content.summary || content.rubric) && (
 <fieldset>
 <legend className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Document Extras</legend>
 <div className="space-y-2">
 {content.summary && (
 <div className="flex items-center">
 <input id="includeSummary" name="includeSummary" type="checkbox" checked={headerInfo.includeSummary} onChange={handleHeaderChange} className="h-4 w-4 rounded border-slate-200 text-emerald-600 focus:ring-emerald-500" />
 <label htmlFor="includeSummary" className="ml-2 block text-sm text-gray-700">Include Executive Summary</label>
 </div>
 )}
 {content.auditReport && (
 <div className="flex items-center">
 <input id="includeAudit" name="includeAudit" type="checkbox" checked={headerInfo.includeAudit} onChange={handleHeaderChange} className="h-4 w-4 rounded border-slate-200 text-emerald-600 focus:ring-emerald-500" />
 <label htmlFor="includeAudit" className="ml-2 block text-sm text-gray-700">Include AI Audit Report</label>
 </div>
 )}
 {content.rubric && (
 <div className="flex items-center">
 <input id="includeRubric" name="includeRubric" type="checkbox" checked={headerInfo.includeRubric} onChange={handleHeaderChange} className="h-4 w-4 rounded border-slate-200 text-emerald-600 focus:ring-emerald-500" />
 <label htmlFor="includeRubric" className="ml-2 block text-sm text-gray-700">Include Grading Rubric</label>
 </div>
 )}
 </div>
 </fieldset>
 )}
 </div>
 </div>
 )}
 </div>
 );
};
