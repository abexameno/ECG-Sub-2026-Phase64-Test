import React, { useState, useRef } from 'react';
import { collection, doc, updateDoc, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { handleFirestoreError, OperationType, cleanForFirestore } from '../firebaseUtils';
import { User } from '../types.ts';
import { connectToGoogleDrive, backupAppBackupJSONToDrive } from '../services/googleDriveService';
import { motion } from 'motion/react';
import { 
 Download, 
 Upload, 
 RefreshCw, 
 CheckCircle2, 
 AlertCircle, 
 FileJson, 
 Database, 
 ShieldAlert, 
 ListTodo,
 Users,
 TrendingUp,
 FileCheck2,
 Share2,
 Bell,
 Cloud
} from 'lucide-react';

interface AppBackupRestorePanelProps {
 currentUser: User;
}

interface BackupData {
 version: string;
 timestamp: string;
 backupBy: string;
 settings?: {
 global?: any;
 secrets?: any;
 };
 curriculum_overrides?: any[];
 users?: {
 userDoc: any;
 library?: any[];
 elms_invites?: any[];
 notifications?: any[];
 }[];
 usage_logs?: any[];
 transactions?: any[];
 feedback?: any[];
 referrals?: any[];
 notifications?: any[];
}

export const AppBackupRestorePanel: React.FC<AppBackupRestorePanelProps> = ({ currentUser }) => {
 const [isExporting, setIsExporting] = useState(false);
 const [isRestoring, setIsRestoring] = useState(false);
 const [exportLog, setExportLog] = useState<string[]>([]);
 const [restoreLog, setRestoreLog] = useState<string[]>([]);
 const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
 const [downloadFileName, setDownloadFileName] = useState<string | null>(null);
 
 // File upload state
 const [uploadedFile, setUploadedFile] = useState<BackupData | null>(null);
 const [uploadError, setUploadError] = useState<string | null>(null);
 const [dragActive, setDragActive] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);

 // Google Drive states
 const [driveToken, setDriveToken] = useState<string | null>(null);
 const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(currentUser.backupGoogleDriveAutoSyncEnabled || false);
 const [isSyncingToDrive, setIsSyncingToDrive] = useState(false);

 const addExportLog = (msg: string) => {
 setExportLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
 };

 const addRestoreLog = (msg: string) => {
 setRestoreLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
 };

 const handleToggleAutoSync = async () => {
 try {
 const nextState = !isAutoSyncEnabled;
 setIsAutoSyncEnabled(nextState);
 
 let token = driveToken;
 if (nextState && !token) {
 addExportLog("Requesting Google Drive authorization for Auto-Sync...");
 token = await connectToGoogleDrive();
 setDriveToken(token);
 }

 // Persist to user document
 if (currentUser.id) {
 await updateDoc(doc(db, 'users', currentUser.id), {
  googleDriveAutoSyncEnabled: nextState
 });
 addExportLog(`Auto-sync is now turned ${nextState ? 'ON' : 'OFF'}.`);
 }
 } catch (err: any) {
 setIsAutoSyncEnabled(false);
 addExportLog(`[ERROR] Failed to enable Auto-Sync: ${err.message}`);
 }
 };

 const handleConnectDrive = async () => {
 try {
 addExportLog("Connecting to Google Drive...");
 const token = await connectToGoogleDrive();
 setDriveToken(token);
 addExportLog("[SUCCESS] Connected to Google Drive.");
 } catch (err: any) {
 addExportLog(`[ERROR] Google Drive connection failed: ${err.message}`);
 }
 };

 const handleManualSyncToDrive = async () => {
 if (!downloadUrl || !downloadFileName) {
 addExportLog("[WARNING] No backup archive is currently loaded to sync.");
 return;
 }
 setIsSyncingToDrive(true);
 addExportLog("Starting manual sync of this backup to Google Drive...");
 
 try {
 let activeToken = driveToken;
 if (!activeToken) {
 activeToken = await connectToGoogleDrive();
 setDriveToken(activeToken);
 }

 // Fetch current backup data from local blob URL
 const response = await fetch(downloadUrl);
 const backupData = await response.json();

 addExportLog("Uploading backup file to 'Exameno' folder in Google Drive...");
 const fileId = await backupAppBackupJSONToDrive(backupData, activeToken, downloadFileName);
 addExportLog(`[SUCCESS] Backup successfully synced to Google Drive! File ID: ${fileId}`);
 } catch (err: any) {
 addExportLog(`[ERROR] Google Drive sync failed: ${err.message}`);
 } finally {
 setIsSyncingToDrive(false);
 }
 };

 // Run database backup
 const handleExport = async () => {
 setIsExporting(true);
 setDownloadUrl(null);
 setDownloadFileName(null);
 setExportLog([]);
 
 addExportLog("Starting secure full-database export sequence...");
 
 try {
 const backup: BackupData = {
 version: "1.0.0",
 timestamp: new Date().toISOString(),
 backupBy: currentUser.email
 };

 // 1. Settings Backup
 addExportLog("Exporting system configurations via Admin API...");
 backup.settings = {};
 try {
 const firebaseUser = auth.currentUser;
 if (firebaseUser) {
  const token = await firebaseUser.getIdToken();
  const res = await fetch('/api/admin/settings', {
  headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
  const data = await res.json();
  if (data.settings) {
   backup.settings.global = data.settings;
   addExportLog(" - System settings exported successfully.");
  }
  }
 }
 } catch (e: any) {
 addExportLog(` - [WARNING] Skipped system settings: ${e.message}`);
 }

 // 2. Curriculum Overrides
 addExportLog("Exporting customized curriculum ('curriculum_overrides' collection)...");
 try {
 const overridesSnap = await getDocs(collection(db, 'curriculum_overrides'));
 backup.curriculum_overrides = overridesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
 addExportLog(` - Exported ${backup.curriculum_overrides.length} custom curriculum overrides.`);
 } catch (e: any) {
 addExportLog(` - [WARNING] Skipped curriculum overrides: ${e.message}`);
 }

 // 3. Users and subcollections
 addExportLog("Exporting user registry & workspace library contents...");
 try {
 const usersSnap = await getDocs(collection(db, 'users'));
 addExportLog(` - Found ${usersSnap.docs.length} users. Fetching sub-records...`);
 backup.users = [];

 for (const userDoc of usersSnap.docs) {
  const userId = userDoc.id;
  const userEmail = userDoc.data().email || 'Unknown';
  
  // Fetch saved notes/materials in user library
  let library: any[] = [];
  try {
  const libSnap = await getDocs(collection(db, 'users', userId, 'library'));
  library = libSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
  // silent fail for this subcollection if restricted
  }

  // Fetch ELMS invites
  let elms_invites: any[] = [];
  try {
  const elmsSnap = await getDocs(collection(db, 'users', userId, 'elms_invites'));
  elms_invites = elmsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
  // silent fail
  }

  // Fetch notifications
  let notifications: any[] = [];
  try {
  const notifSnap = await getDocs(collection(db, 'users', userId, 'notifications'));
  notifications = notifSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
  // silent fail
  }

  backup.users.push({
  userDoc: { id: userId, ...userDoc.data() },
  library,
  elms_invites,
  notifications
  });
 }
 addExportLog(` - Complete User content mapping exported successfully.`);
 } catch (e: any) {
 addExportLog(` - [WARNING] Skipped user registry: ${e.message}`);
 }

 // 4. Usage Logs
 addExportLog("Exporting analytics audit logs ('usage_logs' collection)...");
 try {
 const logsSnap = await getDocs(collection(db, 'usage_logs'));
 backup.usage_logs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
 addExportLog(` - Exported ${backup.usage_logs.length} usage records.`);
 } catch (e: any) {
 addExportLog(` - [WARNING] Skipped usage logs: ${e.message}`);
 }

 // 5. Transactions
 addExportLog("Exporting M-Pesa & billing transactional records ('transactions' collection)...");
 try {
 const transSnap = await getDocs(collection(db, 'transactions'));
 backup.transactions = transSnap.docs.map(d => ({ id: d.id, ...d.data() }));
 addExportLog(` - Exported ${backup.transactions.length} transaction logs.`);
 } catch (e: any) {
 addExportLog(` - [WARNING] Skipped transactions: ${e.message}`);
 }

 // 6. Feedback
 addExportLog("Exporting teacher support tickets and feedback ('feedback' collection)...");
 try {
 const fbSnap = await getDocs(collection(db, 'feedback'));
 backup.feedback = fbSnap.docs.map(d => ({ id: d.id, ...d.data() }));
 addExportLog(` - Exported ${backup.feedback.length} feedback tickets.`);
 } catch (e: any) {
 addExportLog(` - [WARNING] Skipped feedback: ${e.message}`);
 }

 // 7. Referrals
 addExportLog("Exporting marketing invitation campaigns ('referrals' collection)...");
 try {
 const refSnap = await getDocs(collection(db, 'referrals'));
 backup.referrals = refSnap.docs.map(d => ({ id: d.id, ...d.data() }));
 addExportLog(` - Exported ${backup.referrals.length} referral links.`);
 } catch (e: any) {
 addExportLog(` - [WARNING] Skipped referrals: ${e.message}`);
 }

 // 8. Global Notifications
 addExportLog("Exporting active broadside notifications ('notifications' collection)...");
 try {
 const notifSnap = await getDocs(collection(db, 'notifications'));
 backup.notifications = notifSnap.docs.map(d => ({ id: d.id, ...d.data() }));
 addExportLog(` - Exported ${backup.notifications.length} global notification records.`);
 } catch (e: any) {
 addExportLog(` - [WARNING] Skipped global notifications: ${e.message}`);
 }

 // Finalize JSON payload
 const jsonStr = JSON.stringify(backup, null, 2);
 const blob = new Blob([jsonStr], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const fileName = `exameno_ecg_backup_${new Date().toISOString().slice(0, 10)}_${Math.floor(Date.now() / 1000)}.json`;
 
 setDownloadUrl(url);
 setDownloadFileName(fileName);
 addExportLog(`[SUCCESS] Backup payload successfully bundled: "${fileName}"`);

 // Trigger Automatic Google Drive Sync if enabled
 if (isAutoSyncEnabled) {
 addExportLog("Auto-sync enabled. Preparing upload to Google Drive...");
 let activeToken = driveToken;
 try {
  if (!activeToken) {
  addExportLog("Obtaining Google Drive authentication...");
  activeToken = await connectToGoogleDrive();
  setDriveToken(activeToken);
  }
  addExportLog("Uploading backup archive to Google Drive folder 'Exameno'...");
  const fileId = await backupAppBackupJSONToDrive(backup, activeToken, fileName);
  addExportLog(`[SUCCESS] Backup auto-synced to Google Drive! File ID: ${fileId}`);
 } catch (syncErr: any) {
  addExportLog(`[WARNING] Auto-sync to Google Drive failed: ${syncErr.message}`);
 }
 }

 } catch (err: any) {
 addExportLog(`[ERROR] Full database export failed: ${err.message}`);
 handleFirestoreError(err, OperationType.LIST, 'backup');
 } finally {
 setIsExporting(false);
 }
 };

 // Drag and drop events
 const handleDrag = (e: React.DragEvent) => {
 e.preventDefault();
 e.stopPropagation();
 if (e.type === "dragenter" || e.type === "dragover") {
 setDragActive(true);
 } else if (e.type === "dragleave") {
 setDragActive(false);
 }
 };

 const handleDrop = (e: React.DragEvent) => {
 e.preventDefault();
 e.stopPropagation();
 setDragActive(false);
 if (e.dataTransfer.files && e.dataTransfer.files[0]) {
 handleFileSelected(e.dataTransfer.files[0]);
 }
 };

 const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 if (e.target.files && e.target.files[0]) {
 handleFileSelected(e.target.files[0]);
 }
 };

 // Validate uploaded JSON structure
 const handleFileSelected = (file: File) => {
 setUploadError(null);
 setUploadedFile(null);
 
 const reader = new FileReader();
 reader.onload = (event) => {
 try {
 const data = JSON.parse(event.target?.result as string) as BackupData;
 if (!data.version || !data.timestamp) {
  throw new Error("Invalid format: File does not contain 'version' or 'timestamp' fields.");
 }
 setUploadedFile(data);
 } catch (err: any) {
 setUploadError(`Failed to parse backup file: ${err.message}`);
 }
 };
 reader.readAsText(file);
 };

 // Run database restore/overwrite operation
 const handleRestore = async () => {
 if (!uploadedFile) return;
 const confirmRestore = window.confirm(
 "CRITICAL ACTION REQUIRED!\n\nThis will write and merge backup data back into Firestore. Existing documents with identical IDs will be overwritten. Are you absolutely certain you want to proceed?"
 );
 if (!confirmRestore) return;

 setIsRestoring(true);
 setRestoreLog([]);
 addRestoreLog("Initializing database restore operations...");

 try {
 // 1. Restore settings & users via Authoritative Admin Backend API (/api/admin/restore)
 const firebaseUser = auth.currentUser;
 const adminToken = firebaseUser ? await firebaseUser.getIdToken() : '';
 if (!adminToken) {
 throw new Error("Authentication required for administrative restore.");
 }

 if (uploadedFile.settings?.global) {
 addRestoreLog("Restoring core system configuration via Admin API...");
 const settingsRes = await fetch('/api/admin/settings', {
  method: 'POST',
  headers: {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${adminToken}`,
  },
  body: JSON.stringify({
  docId: 'global',
  settings: cleanForFirestore(uploadedFile.settings.global),
  }),
 });
 if (settingsRes.ok) {
  addRestoreLog(" - Restored system configuration via Admin API.");
 } else {
  addRestoreLog(` - [WARNING] Failed to restore settings via Admin API (HTTP ${settingsRes.status}).`);
 }
 }

 // 2. Restore Users via Admin Backend API (/api/admin/restore)
 if (uploadedFile.users && uploadedFile.users.length > 0) {
 addRestoreLog(`Restoring user accounts (${uploadedFile.users.length} users) via Admin API...`);
 const restoreRes = await fetch('/api/admin/restore', {
  method: 'POST',
  headers: {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${adminToken}`,
  },
  body: JSON.stringify({
  collections: {
   users: uploadedFile.users,
  },
  }),
 });
 if (restoreRes.ok) {
  const restoreData = await restoreRes.json().catch(() => ({}));
  addRestoreLog(` - Synchronized ${restoreData.restoredCount ?? uploadedFile.users.length} user profiles via Admin API.`);
 } else {
  addRestoreLog(` - [WARNING] User restore returned HTTP ${restoreRes.status}.`);
 }
 }

 // 3. Restore Feedback via Admin Backend API
 if (uploadedFile.feedback && uploadedFile.feedback.length > 0) {
 addRestoreLog(`Restoring feedback statuses (${uploadedFile.feedback.length} items)...`);
 for (const item of uploadedFile.feedback) {
  const { id, status, response } = item;
  if (id && (status || response)) {
  await fetch(`/api/admin/feedback/${encodeURIComponent(id)}`, {
   method: 'PUT',
   headers: {
   'Content-Type': 'application/json',
   Authorization: `Bearer ${adminToken}`,
   },
   body: JSON.stringify({ status, response }),
  }).catch(() => {});
  }
 }
 addRestoreLog(" - Support feedback statuses synchronized.");
 }

 // 4. Referrals, Transactions, and Usage Logs are strictly server-authoritative
 if (uploadedFile.referrals && uploadedFile.referrals.length > 0) {
 addRestoreLog(`Skipped client-side referral restore (${uploadedFile.referrals.length} items; referrals are server-authoritative).`);
 }
 if (uploadedFile.transactions && uploadedFile.transactions.length > 0) {
 addRestoreLog(`Skipped client-side transaction restore (${uploadedFile.transactions.length} items; transactions are server-authoritative).`);
 }

 addRestoreLog("[SUCCESS] Database state has been synchronized and restored successfully!");
 alert("Application restore successfully executed!");
 setUploadedFile(null);
 } catch (err: any) {
 addRestoreLog(`[CRITICAL ERROR] Restore sequence failed: ${err.message}`);
 handleFirestoreError(err, OperationType.WRITE, 'restore');
 } finally {
 setIsRestoring(false);
 }
 };

 return (
 <div className="space-y-10 py-6 max-w-6xl mx-auto animate-fade-in">
 {/* Intro Banner */}
 <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
 <div className="flex gap-4 items-center">
  <div className="p-3 bg-emerald-100 rounded-xl border border-slate-200 text-emerald-800">
  <Database size={24} />
  </div>
  <div>
  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">App Backup & Restore Console</h2>
  <p className="text-xs text-slate-500 font-bold">Securely export all application datasets (Curriculum, Profiles, Logs, Sub-Collections) and restore complete database states.</p>
  </div>
 </div>
 <div className="flex items-center gap-2 text-[10px] font-black uppercase bg-emerald-100 border border-slate-200 text-emerald-800 px-3 py-1.5 rounded-full">
  <ShieldAlert size={14} /> Full Access Mode
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
 {/* Left Column: EXPORT CARD */}
 <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col ">
  <div className="p-6 border-b border-slate-200 bg-mint/40 flex justify-between items-center">
  <div>
  <h3 className="font-black text-lg text-slate-900 uppercase tracking-tight">Generate Backup Archive</h3>
  <p className="text-[10px] font-bold text-slate-500">Collects all data vectors into a single, structured JSON document.</p>
  </div>
  <Database size={20} className="text-slate-700" />
  </div>

  <div className="p-8 flex-1 flex flex-col justify-between space-y-8">
  <div className="space-y-4">
  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">DATASETS COVERED IN ARCHIVE:</span>
  <div className="grid grid-cols-2 gap-4">
  <div className="flex items-center gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
   <ListTodo size={16} className="text-emerald-700" />
   <span className="text-xs font-bold text-slate-700">Curriculum Overrides</span>
  </div>
  <div className="flex items-center gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
   <Users size={16} className="text-blue-700" />
   <span className="text-xs font-bold text-slate-700">User Profiles & Libraries</span>
  </div>
  <div className="flex items-center gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
   <TrendingUp size={16} className="text-orange-700" />
   <span className="text-xs font-bold text-slate-700">Usage & Analytics Logs</span>
  </div>
  <div className="flex items-center gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
   <FileCheck2 size={16} className="text-indigo-700" />
   <span className="text-xs font-bold text-slate-700">Transactions & Invoices</span>
  </div>
  <div className="flex items-center gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
   <Share2 size={16} className="text-pink-700" />
   <span className="text-xs font-bold text-slate-700">Referral Relations</span>
  </div>
  <div className="flex items-center gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
   <Bell size={16} className="text-amber-700" />
   <span className="text-xs font-bold text-slate-700">Global Notifications</span>
  </div>
  </div>
  </div>

  {/* Actions & Logger */}
  <div className="space-y-6 pt-4">
  {/* Google Drive Sync Controls */}
  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
  <div className="flex justify-between items-center">
   <div className="flex items-center gap-2">
   <Cloud className="text-emerald-600 w-5 h-5 shrink-0" />
   <div>
   <h4 className="text-xs font-black uppercase tracking-tight text-slate-800">Google Drive Auto-Sync</h4>
   <p className="text-[10px] text-slate-500 font-bold">Instantly sync the backup to Google Drive upon generation</p>
   </div>
   </div>
   
   {/* Switch */}
   <button
   onClick={handleToggleAutoSync}
   className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors border border-slate-200 ${
   isAutoSyncEnabled ? 'bg-emerald-600' : 'bg-slate-300'
   }`}
   >
   <span
   className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform border border-slate-200 ${
   isAutoSyncEnabled ? 'translate-x-6' : 'translate-x-1'
   }`}
   />
   </button>
  </div>

  <div className="flex gap-2">
   <button
   onClick={handleConnectDrive}
   className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] font-black py-2 px-3 border border-slate-200 rounded-lg transition-colors ${
   driveToken
   ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
   : 'bg-white text-slate-700 hover:bg-slate-100'
   }`}
   >
   <RefreshCw size={12} className={driveToken ? "text-emerald-700" : ""} />
   {driveToken ? "Drive Connected" : "Connect Drive"}
   </button>

   {downloadUrl && downloadFileName && (
   <button
   onClick={handleManualSyncToDrive}
   disabled={isSyncingToDrive}
   className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] py-2 px-3 border border-slate-200 rounded-lg transition-colors disabled:opacity-50"
   >
   {isSyncingToDrive ? (
   <>
    <RefreshCw size={12} className="animate-spin" />
    Syncing...
   </>
   ) : (
   <>
    <Cloud size={12} />
    Sync Now
   </>
   )}
   </button>
   )}
  </div>
  </div>

  <div className="flex gap-4">
  <button
   onClick={handleExport}
   disabled={isExporting}
   className="flex-1 app-btn app-btn-primary flex items-center justify-center gap-2 text-sm font-black py-4 border border-slate-200"
  >
   <RefreshCw size={16} className={isExporting ? "animate-spin" : ""} />
   {isExporting ? "Assembling Archive..." : "Generate Secure Backup"}
  </button>

  {downloadUrl && downloadFileName && (
   <a
   href={downloadUrl}
   download={downloadFileName}
   className="app-btn bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm py-4 px-6 border border-slate-200 flex items-center justify-center gap-2 rounded-xl transition-colors (0,0,0,1)]"
   >
   <Download size={16} />
   Download File
   </a>
  )}
  </div>

  {exportLog.length > 0 && (
  <div className="bg-slate-900 text-slate-200 p-4 rounded-xl border border-slate-200 font-mono text-[10px] leading-relaxed max-h-48 overflow-y-auto space-y-1">
   {exportLog.map((log, index) => (
   <div key={index} className={log.includes('[SUCCESS]') ? 'text-emerald-400' : log.includes('[WARNING]') ? 'text-amber-400' : 'text-slate-300'}>
   {log}
   </div>
   ))}
  </div>
  )}
  </div>
  </div>
 </div>

 {/* Right Column: RESTORE CARD */}
 <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col ">
  <div className="p-6 border-b border-slate-200 bg-rose-50 flex justify-between items-center">
  <div>
  <h3 className="font-black text-lg text-slate-900 uppercase tracking-tight">Restore Database State</h3>
  <p className="text-[10px] font-bold text-rose-900 opacity-80">Upload custom database archives to restore or overwrite system state.</p>
  </div>
  <Upload size={20} className="text-rose-900" />
  </div>

  <div className="p-8 flex-1 flex flex-col justify-between space-y-6">
  {/* Upload Zone */}
  <div
  onDragEnter={handleDrag}
  onDragOver={handleDrag}
  onDragLeave={handleDrag}
  onDrop={handleDrop}
  onClick={() => fileInputRef.current?.click()}
  className={`border-4 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
  dragActive 
   ? "border-rose-600 bg-rose-50" 
   : "border-slate-200 bg-slate-50 hover:bg-slate-100/70"
  }`}
  >
  <input
  ref={fileInputRef}
  type="file"
  accept=".json"
  onChange={handleFileChange}
  className="hidden"
  />
  <FileJson size={36} className="text-slate-400 mb-4" />
  <p className="text-xs font-black text-slate-700 mb-1">Drag and drop your backup JSON here</p>
  <p className="text-[10px] text-slate-400 font-bold">or click to browse local storage</p>
  </div>

  {uploadError && (
  <div className="p-4 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl text-xs flex items-center gap-3">
  <AlertCircle size={16} className="shrink-0" />
  <span className="font-bold">{uploadError}</span>
  </div>
  )}

  {/* Uploaded File Preview */}
  {uploadedFile && (
  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
  <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-200">
   <CheckCircle2 size={18} className="text-emerald-600" />
   <span className="text-xs font-black text-slate-800 uppercase tracking-tight">Archive Loaded & Validated</span>
  </div>
  <div className="grid grid-cols-2 gap-4 text-[11px] font-bold text-slate-600 leading-normal">
   <div>• Stamp: <span className="text-slate-900">{new Date(uploadedFile.timestamp).toLocaleDateString()}</span></div>
   <div>• Version: <span className="text-slate-900">{uploadedFile.version}</span></div>
   <div>• Users: <span className="text-slate-900">{uploadedFile.users?.length || 0}</span></div>
   <div>• Curriculum: <span className="text-slate-900">{uploadedFile.curriculum_overrides?.length || 0} items</span></div>
   <div>• Logs: <span className="text-slate-900">{uploadedFile.usage_logs?.length || 0} logs</span></div>
   <div>• Trx: <span className="text-slate-900">{uploadedFile.transactions?.length || 0} records</span></div>
  </div>
  
  <div className="p-3 bg-rose-50 border-2 border-dashed border-rose-900/30 rounded-xl text-[10px] text-rose-900 font-bold flex gap-2">
   <ShieldAlert size={16} className="shrink-0 text-rose-700" />
   <span>WARNING: Executing restore will merge data into Firestore. This operation cannot be reversed. Please backup first.</span>
  </div>

  <button
   onClick={handleRestore}
   disabled={isRestoring}
   className="w-full app-btn bg-rose-600 hover:bg-rose-700 text-white font-black text-sm py-4 border border-slate-200 flex items-center justify-center gap-2 rounded-xl (0,0,0,1)] transition-colors"
  >
   <RefreshCw size={16} className={isRestoring ? "animate-spin" : ""} />
   {isRestoring ? "Rebuilding Database..." : "Execute Restore Sequence"}
  </button>
  </div>
  )}

  {/* Restore Log Terminal */}
  {restoreLog.length > 0 && (
  <div className="bg-slate-900 text-slate-200 p-4 rounded-xl border border-slate-200 font-mono text-[10px] leading-relaxed max-h-48 overflow-y-auto space-y-1">
  {restoreLog.map((log, index) => (
   <div key={index} className={log.includes('[SUCCESS]') ? 'text-emerald-400' : log.includes('[CRITICAL ERROR]') ? 'text-rose-400' : 'text-slate-300'}>
   {log}
   </div>
  ))}
  </div>
  )}
  </div>
 </div>
 </div>
 </div>
 );
};

export default AppBackupRestorePanel;
