import { formatKenyanPhoneDisplay } from "../utils/phoneUtils";
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, CreditLog, SystemSettings } from '../types.ts';
import { mockUsageData } from '../data/mockUsageData.ts';
import { generateAnalyticsInsights } from '../services/geminiService.ts';
import MarkdownRenderer from '../utils/MarkdownRenderer.tsx';
import { auth, db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, getDoc, where, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebaseUtils';
import TeacherResourceHub from './TeacherResourceHub';
import CurriculumManager from './CurriculumManager';
import { EmailHistoryPanel } from './EmailHistoryPanel';
import ReferralManagementPanel from './ReferralManagementPanel';
import ReferralHub from './ReferralHub';
import NotificationManagementPanel from './NotificationManagementPanel';
import PollsManagementPanel from './PollsManagementPanel';
import { SchoolManagementPanel } from './SchoolManagementPanel';
import CustomSelect from './CustomSelect.tsx';
import { GuidedTourOverlay, startTour } from './GuidedTourOverlay';
import IllustrationEditor from './IllustrationEditor';
import AppBackupRestorePanel from './AppBackupRestorePanel';
import SystemConfigPanel from './SystemConfigPanel';
import { AdminDirectoryCsvManagement } from './AdminDirectoryCsvManagement';
import { Search, Plus, Edit2, Trash2, Download, Upload, Mail, MessageSquare, Wallet, ToggleLeft, ToggleRight, RefreshCw, CheckCircle2, AlertCircle, MessageCircle } from 'lucide-react';
import Papa from 'papaparse';
import { initialUsers } from '../data/mockUsers.ts';
import {
  normalizeTransactionStatus,
  getTransactionStatusLabel,
  getTransactionBadgeClasses,
  isTransactionPending,
  isTransactionVerified,
  isTransactionRejected,
  deduplicateAndSortTransactions,
  formatKenyanPhoneForWhatsApp,
  generateWhatsAppReceiptUrl,
} from '../utils/transactionStatus';

const jsonToCSV = (data: any[], fields?: string[]) => {
 if (data.length === 0 && !fields) return '';
 const headers = fields || Object.keys(data[0]);
 if (data.length === 0) return headers.join(',');
 const rows = data.map(row => headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(','));
 return [headers.join(','), ...rows].join('\n');
};

// ... (rest of the file)

// Helper to get initials for avatar
const getInitials = (name: string) => {
 const names = name.split(' ');
 if (names.length > 1) {
 return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
 }
 return name.substring(0, 2).toUpperCase();
};

// Helper to generate a random password
const generateRandomPassword = (length = 8) => {
 const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
 let pass = "";
 for (let i = 0; i < length; i++) {
 pass += chars.charAt(Math.floor(Math.random() * chars.length));
 }
 return pass;
};

// Helper to title case names
const toTitleCase = (str: string) => str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

interface FeedbackItem {
 id: string;
 type: string;
 subject: string;
 details: string;
 user: { name: string; email: string };
 timestamp: string;
 status: 'New' | 'Read' | 'Resolved';
 response?: string;
}

const getFullName = (user: User) => {
 if ((user as any).fullName) return (user as any).fullName;
 if (user.email === 'matthewkiarie2013@gmail.com') return 'Matthew Kiarie';
 if (user.email === 'messageinter9@gmail.com') return 'Rubyie Messageinter';
 return user.name;
};

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactElement; colorClass?: string }> = ({ title, value, icon, colorClass = "bg-white" }) => (
 <div className={`${colorClass} p-6 rounded-2xl border-[1px] border-slate-200`}>
 <div className="flex items-center">
 <div className="flex-shrink-0 rounded-lg p-3 mr-4 border-[1px] border-slate-200 bg-white text-slate-900">
 {icon}
 </div>
 <div>
 <dt className="text-xs font-semibold text-slate-600">{title}</dt>
 <dd className="mt-1 text-2xl font-bold text-slate-900">
 {value}
 </dd>
 </div>
 </div>
 </div>
);

const UserModal: React.FC<{ user?: User | null, onClose: () => void, onSave: (user: User) => void, currentUser: User }> = ({ user, onClose, onSave, currentUser }) => {
 const [formData, setFormData] = useState<Partial<User>>(user || {
 name: '',
 email: '',
 phoneNumber: '',
 role: 'Teacher',
 status: 'Active',
 accountType: 'Standard',
 schoolName: currentUser.schoolName,
 avatarColor: 'bg-gray-500',
 credits: 5
 });

 const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
 const { name, value } = e.target;
 
 if (name === 'accountType' && value === 'Demo') {
 const expiry = user?.expiryDate || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
 setFormData(prev => ({ ...prev, [name]: value, expiryDate: expiry, credits: 5 }));
 } else if (name === 'accountType' && value === 'Standard') {
 setFormData(prev => ({ ...prev, [name]: value, expiryDate: undefined }));
 } else {
 setFormData(prev => ({ ...prev, [name]: value }));
 }
 };

 const handleResetPassword = async () => {
 if (!formData.email) return;
 try {
 const { sendPasswordResetEmail } = await import('firebase/auth');
 await sendPasswordResetEmail(auth, formData.email);
 alert(`Password reset email sent to ${formData.email}`);
 } catch (err: any) {
 alert("Error: " + err.message);
 }
 };

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 onSave({ ...formData, id: user?.id || Date.now().toString() } as User);
 };

 return (
 <div className="fixed inset-0 bg-slate-500/20 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
 <div className="bg-mint p-0 rounded-2xl w-full max-w-md border border-slate-200 max-h-[90vh] overflow-y-auto animate-scale-up">
 <div className="p-8 border-b border-slate-200 bg-mint flex justify-between items-center">
 <h3 className="text-2xl font-bold text-slate-900">{user ? 'Edit Member' : 'New Member'}</h3>
 {user && (
 <button 
 type="button" 
 onClick={handleResetPassword}
 className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-[9px] text-slate-700 hover:text-emerald-700 font-bold transition-all"
 >
 Reset Key
 </button>
 )}
 </div>
 <form onSubmit={handleSubmit} className="p-8 space-y-6">
 <div>
 <label className="block text-[10px] font-bold text-slate-500 mb-2">Full Name</label>
 <input name="name" value={formData.name} onChange={handleChange} required className="block w-full rounded-xl border border-slate-200 bg-white text-slate-900 text-sm p-4 outline-none font-bold transition-all" />
 </div>
 <div>
 <label className="block text-[10px] font-bold text-slate-500 mb-2">Email Address</label>
 <input name="email" type="email" value={formData.email} onChange={handleChange} required className="block w-full rounded-xl border border-slate-200 bg-white text-slate-900 text-sm p-4 outline-none font-bold transition-all lowercase" />
 </div>
 <div className="grid grid-cols-2 gap-6">
 <div>
 <CustomSelect
 label="Role"
 options={[
 { value: 'Teacher', label: 'Teacher' },
 { value: 'School Admin', label: 'School Admin' },
 ...(currentUser.role === 'Admin' ? [{ value: 'Admin', label: 'Admin' }] : []),
 { value: 'Student', label: 'Student' }
 ]}
 value={formData.role || 'Teacher'}
 onChange={(val) => handleChange({ target: { name: 'role', value: val } } as any)}
 variant="neo"
 />
 </div>
 <div>
 <CustomSelect
 label="Status"
 options={[
 { value: 'Active', label: 'Active' },
 { value: 'Inactive', label: 'Inactive' }
 ]}
 value={formData.status || 'Active'}
 onChange={(val) => handleChange({ target: { name: 'status', value: val } } as any)}
 variant="neo"
 />
 </div>
 </div>
 <div>
 <CustomSelect
 label="Account Type"
 options={[
 { value: 'Standard', label: 'Standard Protocol' },
 { value: 'Demo', label: 'Demo (5 Day Cycle)' }
 ]}
 value={formData.accountType || 'Standard'}
 onChange={(val) => handleChange({ target: { name: 'accountType', value: val } } as any)}
 variant="neo"
 />
 </div>
 <div>
 <label className="block text-[10px] font-bold text-slate-500 mb-2">Credits</label>
 <div className="flex gap-4 items-center">
 <input 
 name="credits" 
 type="number" 
 value={formData.credits ?? 0} 
 onChange={(e) => setFormData(prev => ({ ...prev, credits: parseInt(e.target.value) || 0 }))} 
 className="block w-full rounded-xl border border-slate-200 bg-white text-slate-900 text-lg p-4 outline-none font-mono font-bold" 
 />
 <div className="flex flex-col gap-2">
 <button type="button" onClick={() => setFormData(p => ({ ...p, credits: (p.credits || 0) + 10 }))} className="px-4 py-2 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 rounded-xl text-[10px] font-bold border border-slate-200 transition-all">+10</button>
 <button type="button" onClick={() => setFormData(p => ({ ...p, credits: (p.credits || 0) + 50 }))} className="px-4 py-2 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 rounded-xl text-[10px] font-bold border border-slate-200 transition-all">+50</button>
 </div>
 </div>
 </div>

 <div>
 <label className="block text-[10px] font-bold text-slate-500 mb-2">Phone Number</label>
 <input name="phoneNumber" type="tel" value={formData.phoneNumber || ''} onChange={handleChange} placeholder="e.g. +254 7XX XXX XXX" className="block w-full rounded-xl border border-slate-200 bg-white text-slate-900 text-sm p-4 outline-none font-mono transition-all" />
 </div>
 <div>
 <label className="block text-[10px] font-bold text-slate-500 mb-2">School</label>
 <input name="schoolName" value={formData.schoolName} onChange={handleChange} disabled={currentUser.role !== 'Admin'} className="block w-full rounded-xl border border-slate-200 bg-white text-slate-900 text-sm p-4 outline-none disabled:opacity-50 font-bold transition-all" />
 </div>

 <div className="pt-8 flex gap-4">
 <button type="button" onClick={onClose} className="flex-1 py-4 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all">Cancel</button>
 <button type="submit" className="flex-[1.5] py-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 border border-slate-200 rounded-xl transition-all">Save</button>
 </div>
 </form>
 </div>
 </div>
 );
};

const UserHistoryModal: React.FC<{ user: User, onClose: () => void }> = ({ user, onClose }) => {
 const logs = user.creditLogs || [];
 const sortedLogs = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

 return (
 <div className="fixed inset-0 bg-slate-500/20 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
 <div className="bg-white p-0 rounded-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh] animate-scale-up">
 <div className="p-8 border-b border-slate-200 flex justify-between items-center bg-mint">
 <div>
 <h3 className="text-2xl font-bold text-slate-900">Activity Log</h3>
 <p className="text-sm text-emerald-900 font-bold">{user.name} &bull; {user.email}</p>
 </div>
 <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-xl transition-colors border border-slate-200">
 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
 </button>
 </div>
 
 <div className="flex-grow overflow-y-auto p-0 bg-mint">
 {logs.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-24 text-slate-400">
 <div className="w-20 h-20 bg-mint rounded-full flex items-center justify-center mb-6 border border-slate-200">
 <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-emerald-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
 </div>
 <p className="font-bold text-slate-900">No activity recorded</p>
 </div>
 ) : (
 <table className="min-w-full divide-y divide-black/10">
 <thead className="bg-mint sticky top-0 z-10">
 <tr>
 <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 border-b border-slate-200">Timestamp</th>
 <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 border-b border-slate-200">Action</th>
 <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-700 border-b border-slate-200">Delta</th>
 <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-700 border-b border-slate-200">Balance</th>
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-black/10">
 {sortedLogs.map((log) => (
 <tr key={log.id} className="hover:bg-mint/30 transition-colors">
 <td className="px-6 py-5 whitespace-nowrap">
 <span className="text-xs font-bold text-slate-900 block">{new Date(log.date).toLocaleDateString()}</span>
 <span className="text-[10px] font-medium text-slate-500">{new Date(log.date).toLocaleTimeString()}</span>
 </td>
 <td className="px-6 py-5 text-sm text-slate-900 font-bold">
 {log.action}
 </td>
 <td className={`px-6 py-5 whitespace-nowrap text-right text-sm font-bold ${log.creditsUsed > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
 {log.creditsUsed > 0 ? `+${log.creditsUsed}` : log.creditsUsed}
 </td>
 <td className="px-6 py-5 whitespace-nowrap text-right text-sm text-slate-900 font-mono font-bold">
 {log.balance}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </div>
 
 <div className="p-6 bg-mint border-t border-slate-200 flex justify-between items-center transition-all">
 <div className="flex flex-col">
 <span className="text-[10px] font-bold text-emerald-900">Available Balance</span>
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 bg-emerald-600 rounded-full border border-slate-200 animate-pulse"></div>
 <span className="text-2xl font-bold text-slate-900">
 {typeof user.credits === 'number' ? user.credits : '...'} <span className="text-xs">CR</span>
 </span>
 </div>
 </div>
 <button onClick={onClose} className="px-8 py-3.5 text-xs font-bold text-white bg-slate-900 border border-slate-200 rounded-xl hover:bg-black transition-all">Close Log</button>
 </div>
 </div>
 </div>
 );
};

const SystemSettingsPanel: React.FC = () => {
 const [settings, setSettings] = useState<SystemSettings>({
 welcomeCredits: 5,
 welcomeCreditsEnabled: true,
 creditCostSow: 2,
 creditCostCba: 2,
 creditCostLesson: 1,
 creditCostQuiz: 1,
 maintenanceMode: false,
 notificationMessage: "ECG is now live with enhanced AI features!",
 smtpHost: '',
 smtpPort: 587,
 smtpUser: '',
 smtpPass: '',
 smtpSecure: false,
 smtpFromEmail: '',
 smtpFromName: 'Exameno Support',
 welcomeEmailSubject: 'Welcome to Exameno CBE Content Generator 🚀',
 welcomeEmailBody: "Welcome to Exameno!"
 });
 const [isSaving, setIsSaving] = useState(false);

 useEffect(() => {
 const fetchSettings = async () => {
 try {
 const firebaseUser = auth.currentUser;
 if (firebaseUser) {
 const token = await firebaseUser.getIdToken();
 const res = await fetch('/api/admin/settings', {
 headers: { Authorization: `Bearer ${token}` }
 });
 if (res.ok) {
 const data = await res.json();
 setSettings(prev => ({
 ...prev,
 ...(data.global || {}),
 ...(data.emailSettings || {}),
 smtpPass: ''
 }));
 return;
 }
 }
 const globalRef = doc(db, 'settings', 'global');
 const globalSnap = await getDoc(globalRef);
 if (globalSnap.exists()) {
 setSettings(prev => ({ ...prev, ...globalSnap.data() }));
 }
 } catch (e: any) {
 console.warn("Could not fetch global settings for AdminPanel, utilizing local defaults:", e.message);
 }
 };
 fetchSettings();
 }, []);

 const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
 const { name, value, type } = e.target;
 const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
 setSettings(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value) || 0 : val }));
 };

 const handleSave = async () => {
 setIsSaving(true);
 try {
 const firebaseUser = auth.currentUser;
 if (!firebaseUser) {
 alert("Authentication required to save system settings.");
 return;
 }
 const token = await firebaseUser.getIdToken();
 const updatedAt = new Date().toISOString();
 
 const globalSettings = {
 welcomeCredits: settings.welcomeCredits,
 welcomeCreditsEnabled: settings.welcomeCreditsEnabled,
 creditCostSow: settings.creditCostSow,
 creditCostCba: settings.creditCostCba,
 creditCostLesson: settings.creditCostLesson,
 creditCostQuiz: settings.creditCostQuiz,
 maintenanceMode: settings.maintenanceMode,
 notificationMessage: settings.notificationMessage,
 updatedAt
 };

 const secretSettings: Record<string, any> = {
 smtpHost: settings.smtpHost,
 smtpPort: settings.smtpPort,
 smtpUser: settings.smtpUser,
 smtpSecure: settings.smtpSecure,
 smtpFromEmail: settings.smtpFromEmail,
 smtpFromName: settings.smtpFromName,
 welcomeEmailSubject: settings.welcomeEmailSubject,
 welcomeEmailBody: settings.welcomeEmailBody,
 updatedAt
 };
 if (settings.smtpPass && settings.smtpPass.trim() !== '' && settings.smtpPass !== '********') {
 secretSettings.smtpPass = settings.smtpPass;
 }

 const [globalRes, secretRes] = await Promise.all([
 fetch('/api/admin/settings', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
 body: JSON.stringify({ docId: 'global', settings: globalSettings })
 }),
 fetch('/api/admin/settings', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
 body: JSON.stringify({ docId: 'secrets', settings: secretSettings })
 })
 ]);

 if (!globalRes.ok || !secretRes.ok) {
 const errBody = await (!globalRes.ok ? globalRes : secretRes).json().catch(() => ({}));
 throw new Error(errBody.error || 'Failed to save system settings via backend');
 }

 alert("All settings synchronized successfully!");
 } catch (err: any) {
 console.error("Save settings error:", err);
 alert("Error syncing settings: " + (err.message || "Check permissions."));
 } finally {
 setIsSaving(false);
 }
 };

 return (
 <div className="max-w-4xl mx-auto space-y-10 animate-fade-in py-12">
 <div className="mb-6 p-4 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-between">
 <p className="text-sm font-bold text-slate-700">Need to see the tour again?</p>
 <button onClick={startTour} className="app-btn app-btn-secondary">Re-run Guided Tour</button>
 </div>
 <div className="bg-mint rounded-2xl border border-slate-200 overflow-hidden transition-all">
 <div className="p-10 border-b border-slate-200 bg-mint text-slate-900">
 <h3 className="text-3xl font-bold leading-none mb-2 text-slate-900">System Core Configuration</h3>
 <p className="text-[11px] font-bold text-emerald-800 opacity-90">Manipulate global constants and security protocols.</p>
 </div>
 
 <div className="p-10 space-y-12">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
 <div className="bg-white p-6 rounded-xl border border-slate-200">
 <label className="block text-[10px] font-bold text-slate-500 mb-4 pl-1">Bootstrap Credit Payload</label>
 <div className="flex gap-6 items-center">
 <input name="welcomeCredits" type="number" value={settings.welcomeCredits} onChange={handleChange} className="w-40 rounded-lg border border-slate-200 bg-white text-slate-900 px-5 py-3 font-bold text-sm outline-none transition-colors" />
 <label className="relative inline-flex items-center cursor-pointer group">
 <input type="checkbox" name="welcomeCreditsEnabled" checked={settings.welcomeCreditsEnabled} onChange={handleChange} className="sr-only peer" />
 <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none rounded-full border border-slate-200 peer peer-checked:after:translate-x-full peer-checked:after:border-slate-200 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border after:border-slate-200 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
 <span className="ml-3 text-[10px] font-bold text-slate-900">{settings.welcomeCreditsEnabled ? "Active" : "Offline"}</span>
 </label>
 </div>
 <p className="text-[10px] text-slate-500 mt-4 font-bold italic border-t border-slate-200/10 pt-3">Automatic injection into new account vectors.</p>
 </div>
 
 <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col justify-center">
 <label className="block text-[10px] font-bold text-slate-500 mb-4 pl-1">Global Lockdown [Maintenance]</label>
 <div className="flex items-center h-12">
 <label className="relative inline-flex items-center cursor-pointer group">
 <input type="checkbox" name="maintenanceMode" checked={settings.maintenanceMode} onChange={handleChange} className="sr-only peer" />
 <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none rounded-full border border-slate-200 peer peer-checked:after:translate-x-full peer-checked:after:border-slate-200 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border after:border-slate-200 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
 <span className="ml-3 text-[10px] font-bold text-slate-900">{settings.maintenanceMode ? "System Locked" : "Public Ready"}</span>
 </label>
 </div>
 </div>
 </div>

 <div className="space-y-8 pt-4">
 <div className="flex items-center gap-4">
 <span className="h-0.5 bg-black flex-1"></span>
 <h4 className="text-[11px] font-bold text-slate-400 whitespace-nowrap">Credit Consumption Matrix</h4>
 <span className="h-0.5 bg-black flex-1"></span>
 </div>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
 {[
 { label: 'SOW GEN', name: 'creditCostSow' },
 { label: 'CBA SYNC', name: 'creditCostCba' },
 { label: 'LESSON PLAN', name: 'creditCostLesson' },
 { label: 'QUIZ ENGINE', name: 'creditCostQuiz' }
 ].map(item => (
 <div key={item.name} className="relative group">
 <label className="block text-[9px] font-black text-slate-500 mb-2 uppercase tracking-widest pl-1">{item.label}</label>
 <div className="relative">
 <input name={item.name} type="number" value={(settings as any)[item.name]} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-5 py-4 font-black text-xl outline-none focus:bg-mint transition-colors" />
 <span className="absolute right-4 top-5 text-[8px] font-black text-slate-300">PTS</span>
 </div>
 </div>
 ))}
 </div>
 </div>

 <div className="space-y-4">
 <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Global Broadcast Notification</label>
 <div className="relative">
 <textarea name="notificationMessage" rows={3} value={settings.notificationMessage} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 bg-white text-slate-900 p-6 text-sm font-bold outline-none focus:bg-mint/5 transition-all" />
 <div className="absolute top-4 right-4 animate-pulse">
 <div className="w-2 h-2 bg-emerald-500 rounded-full border border-slate-200"></div>
 </div>
 </div>
 </div>

 <div className="pt-10 border-t-4 border-slate-200 space-y-10">
 <div className="flex items-center gap-4 text-slate-900 bg-mint p-6 rounded-2xl border border-slate-200">
 <div className="p-3 bg-white border border-slate-200 rounded-xl">
 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
 <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
 <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
 </svg>
 </div>
 <div>
 <h4 className="text-xl font-black uppercase tracking-tighter leading-none">Email Protocol Configuration</h4>
 <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800 opacity-60 mt-1">SMTP layer & auth vectors.</p>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 {[
 { label: 'SMTP ENDPOINT', name: 'smtpHost', type: 'text', placeholder: 'smtp.gmail.com' },
 { label: 'SOURCE IDENTIFIER', name: 'smtpUser', type: 'text', placeholder: 'user@domain.com' },
 { label: 'ENCRYPTION KEY (PASS)', name: 'smtpPass', type: 'password', placeholder: '********' },
 { label: 'FROM ALIAS', name: 'smtpFromName', type: 'text', placeholder: 'Exameno Support' }
 ].map(field => (
 <div key={field.name}>
 <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest pl-1">{field.label}</label>
 <input name={field.name} type={field.type} value={(settings as any)[field.name]} onChange={handleChange} placeholder={field.placeholder} className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 p-4 text-sm font-bold outline-none focus:bg-mint transition-colors" />
 </div>
 ))}
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest pl-1">GATE PORT</label>
 <input name="smtpPort" type="number" value={settings.smtpPort} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 p-4 text-sm font-bold outline-none focus:bg-mint transition-colors" />
 </div>
 <div className="flex items-center pt-8">
 <label className="flex items-center cursor-pointer group">
 <input type="checkbox" name="smtpSecure" checked={settings.smtpSecure} onChange={handleChange} className="w-6 h-6 text-emerald-600 bg-white border border-slate-200 rounded focus:ring-0" />
 <span className="ml-3 text-[11px] font-black text-slate-900 uppercase tracking-widest group-hover:text-emerald-700 transition-colors">SSL TIER</span>
 </label>
 </div>
 </div>
 <div>
 <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest pl-1">SENDER EMAIL VECTOR</label>
 <input name="smtpFromEmail" type="email" value={settings.smtpFromEmail} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 p-4 text-sm font-bold outline-none focus:bg-mint transition-colors" />
 </div>
 </div>

 <div className="space-y-10 pt-6 border-t-4 border-slate-200">
 <div className="flex items-center gap-4 text-indigo-900 bg-indigo-50 p-6 rounded-2xl border border-slate-200 ">
 <div className="p-3 bg-white border border-slate-200 rounded-xl">
 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
 <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.536 14.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zM14.95 5.05l.707.707a1 1 0 00-1.414 1.414l-.707-.707a1 1 0 001.414-1.414z" />
 </svg>
 </div>
 <div>
 <h4 className="text-xl font-black uppercase tracking-tighter leading-none">Welcome Protocol (Email)</h4>
 <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700 opacity-60 mt-1">Automatic outreach templates.</p>
 </div>
 </div>
 <div className="space-y-8">
 <div>
 <label className="block text-[10px] font-black text-slate-500 mb-3 uppercase tracking-widest pl-1">SUBJECT PROTOCOL</label>
 <input name="welcomeEmailSubject" type="text" value={settings.welcomeEmailSubject} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 bg-white text-slate-900 p-6 text-lg font-black tracking-tighter outline-none focus:bg-mint transition-all " />
 </div>
 <div>
 <label className="block text-[10px] font-black text-slate-500 mb-3 uppercase tracking-widest pl-1">MESSAGE CODESPACE (BODY)</label>
 <textarea name="welcomeEmailBody" rows={12} value={settings.welcomeEmailBody} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 bg-white text-slate-900 p-8 text-sm font-medium leading-relaxed outline-none focus:bg-mint/5 transition-all " />
 <p className="text-[10px] text-slate-400 mt-4 font-bold italic uppercase tracking-widest bg-slate-50 p-4 rounded-xl border border-slate-200/10">&bull; UTF-8 Encoding active. Line breaks will be preserved as &lt;br/&gt;.</p>
 </div>
 </div>
 </div>
 </div>
 </div>
 
 <div className="p-10 bg-mint border-t-4 border-slate-200 flex justify-between items-center">
 <div className="text-[11px] font-black text-emerald-800 uppercase tracking-widest opacity-60">Last Sync: {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : 'NEVER'}</div>
 <button 
 onClick={handleSave} 
 disabled={isSaving}
 className="px-12 py-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all disabled:opacity-50 border border-slate-200 text-sm"
 >
 {isSaving ? 'SYNCING...' : 'COMMIT CHANGES'}
 </button>
 </div>
 </div>
 </div>
 );
};


const EmailBroadcastPanel: React.FC<{ allUsers: User[], currentUser: User }> = ({ allUsers, currentUser }) => {
 const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
 const [subject, setSubject] = useState('');
 const [body, setBody] = useState('');
 const [isSending, setIsSending] = useState(false);
 const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

 const handleToggleUser = (userId: string) => {
 setSelectedUsers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
 };

 const handleSelectAll = () => {
 if (selectedUsers.length === allUsers.length) {
 setSelectedUsers([]);
 } else {
 setSelectedUsers(allUsers.map(u => u.id));
 }
 };

 const handleSend = async () => {
 if (!subject || !body || selectedUsers.length === 0) {
 alert("Subject, body and at least one recipient are required.");
 return;
 }

 setIsSending(true);
 setStatus(null);
 let successCount = 0;
 let failCount = 0;
 let lastErrorMessage = '';

 try {
 const firebaseUser = auth.currentUser;
 const token = firebaseUser ? await firebaseUser.getIdToken() : '';

 for (const userId of selectedUsers) {
 const user = allUsers.find(u => u.id === userId);
 if (!user?.email) continue;

 const response = await fetch('/api/admin/send-email', {
 method: 'POST',
 headers: { 
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${token}`
 },
 body: JSON.stringify({
 adminId: currentUser.id,
 adminEmail: currentUser.email,
 to: user.email,
 subject,
 body
 })
 });

 if (response.ok) {
 successCount++;
 } else {
 failCount++;
 try {
 const errData = await response.json();
 lastErrorMessage = errData.details || errData.error || `HTTP ${response.status}`;
 } catch (e) {
 lastErrorMessage = `HTTP ${response.status}`;
 }
 }
 }

 setStatus({ 
 type: failCount === 0 ? 'success' : 'error', 
 message: failCount === 0 
 ? `Broadcast complete. Sent: ${successCount}, Failed: ${failCount}`
 : `Broadcast complete. Sent: ${successCount}, Failed: ${failCount} (Reason: ${lastErrorMessage || 'Please verify SMTP core configurations'})`
 });
 if (failCount === 0) {
 setSubject('');
 setBody('');
 setSelectedUsers([]);
 }
 } catch (err: any) {
 setStatus({ type: 'error', message: `A technical error occurred during broadcast: ${err.message || err}` });
 } finally {
 setIsSending(false);
 }
 };

 return (
 <div className="max-w-5xl mx-auto space-y-6 py-8 animate-fade-in">
 <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
 <div className="p-8 border-b border-slate-200 bg-mint">
 <h3 className="text-2xl font-bold text-slate-900 tracking-tighter">Email Broadcast</h3>
 <p className="text-sm text-emerald-900 font-bold uppercase tracking-widest opacity-70">Send personalized manual emails to selected users.</p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 divide-y-2 md:divide-y-0 md:divide-x-2 divide-black">
 <div className="p-0 col-span-1 max-h-[650px] overflow-y-auto bg-slate-50">
 <div className="p-6 sticky top-0 bg-slate-50 z-10 border-b-2 border-slate-200 flex justify-between items-center">
 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Recipients ({selectedUsers.length})</h4>
 <button onClick={handleSelectAll} className="text-[10px] font-black text-emerald-700 hover:underline uppercase tracking-widest bg-mint border border-slate-200 px-2 py-1 rounded-lg">
 {selectedUsers.length === allUsers.length ? 'Deselect' : 'Select All'}
 </button>
 </div>
 <div className="p-4 space-y-3">
 {allUsers.map(user => (
 <label key={user.id} className={`flex items-center p-3 rounded-xl cursor-pointer transition-all border-2 ${selectedUsers.includes(user.id) ? 'bg-mint border-slate-200 ' : 'hover:bg-mint/40 border-transparent'}`}>
 <input 
 type="checkbox" 
 checked={selectedUsers.includes(user.id)} 
 onChange={() => handleToggleUser(user.id)}
 className="w-5 h-5 text-slate-900 rounded border border-slate-200 focus:ring-black"
 />
 <div className="ml-4 truncate">
 <div className="text-sm font-black text-slate-900 tracking-tight">{toTitleCase(getFullName(user))}</div>
 <div className="text-[10px] text-slate-500 truncate font-bold">{user.email}</div>
 </div>
 </label>
 ))}
 </div>
 </div>

 <div className="p-8 col-span-2 space-y-6 bg-white">
 {status && (
 <div className={`p-5 rounded-2xl text-sm font-black border border-slate-200 uppercase tracking-wide ${status.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
 {status.message}
 </div>
 )}

 <div className="space-y-5">
 <div>
 <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Subject Line</label>
 <input 
 type="text" 
 value={subject} 
 onChange={(e) => setSubject(e.target.value)}
 placeholder="Enter broadcast subject..."
 className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 p-4 text-sm font-black tracking-tight focus:ring-2 focus:ring-black outline-none"
 />
 </div>
 <div>
 <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Message Content</label>
 <textarea 
 rows={14} 
 value={body} 
 onChange={(e) => setBody(e.target.value)}
 placeholder="Compose your message here..."
 className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 p-5 text-sm font-medium leading-relaxed focus:ring-2 focus:ring-black outline-none"
 />
 <p className="text-[10px] text-slate-400 font-bold italic mt-2 uppercase tracking-widest">Line breaks will be preserved in the sent email.</p>
 </div>
 </div>

 <div className="pt-4 flex justify-end">
 <button 
 onClick={handleSend}
 disabled={isSending || selectedUsers.length === 0}
 className="flex items-center gap-3 px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all disabled:opacity-50 border border-slate-200 text-sm"
 >
 {isSending ? (
 <>
 <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 Sending Broadcast...
 </>
 ) : (
 <>
 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
 <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
 </svg>
 Broadcast Email
 </>
 )}
 </button>
 </div>
 </div>
 </div>
 </div>

 <div className="bg-amber-50 rounded-2xl border border-amber-300 p-6 flex items-start gap-4 ">
 <div className="p-3 bg-amber-100 rounded-xl text-amber-800">
 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
 </svg>
 </div>
 <div className="space-y-1">
 <h4 className="text-sm font-bold text-amber-900 uppercase tracking-wider">Troubleshooting Email Delivery Failures</h4>
 <p className="text-xs text-amber-800 leading-relaxed font-medium">
 If emails fail to send, please check the following configurations in the <span className="font-bold">System Settings</span> tab:
 </p>
 <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-1 font-semibold pl-1 pt-1">
 <li><span className="font-bold">Gmail Accounts:</span> Ensure you have generated and saved an <span className="underline">App Password</span> under your Google Account security settings. Your standard Gmail password will not work if 2-Step Verification is enabled.</li>
 <li><span className="font-bold">SMTP Endpoint:</span> Ensure <code className="bg-amber-100 px-1 py-0.5 rounded">smtpHost</code> is correct (e.g., <code className="bg-amber-100 px-1 py-0.5 rounded">smtp.gmail.com</code> for Gmail, <code className="bg-amber-100 px-1 py-0.5 rounded">smtp.mailgun.org</code> for Mailgun, etc.).</li>
 <li><span className="font-bold">SMTP Port:</span> Standard secure submission uses port <code className="bg-amber-100 px-1 py-0.5 rounded">587</code> with TLS, or <code className="bg-amber-100 px-1 py-0.5 rounded">465</code> with SSL.</li>
 </ul>
 </div>
 </div>
 </div>
 );
};


const CredentialsModal: React.FC<{ user: User, onClose: () => void }> = ({ user, onClose }) => {
 const [copied, setCopied] = useState(false);

 const handleCopy = () => {
 const text = `Username: ${user.username}\nPassword: ${user.password}\nLogin at: ${window.location.origin}`;
 navigator.clipboard.writeText(text).then(() => {
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 });
 };

 return (
 <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] backdrop-blur-md p-4">
 <div className="bg-white p-0 rounded-2xl w-full max-w-md border border-slate-200 overflow-hidden animate-scale-up">
 <div className="p-8 border-b-4 border-slate-200 bg-emerald-50 flex items-center gap-4">
 <div className="w-14 h-14 bg-emerald-100 rounded-2xl border border-slate-200 flex items-center justify-center ">
 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-700" viewBox="0 0 20 20" fill="currentColor">
 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
 </svg>
 </div>
 <div>
 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Access Granted</h3>
 <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mt-1">New entity successfully materialized.</p>
 </div>
 </div>
 
 <div className="p-8 space-y-6">
 <div className="bg-mint p-6 rounded-2xl space-y-5 border border-slate-200 ">
 <div className="space-y-1">
 <span className="text-slate-500 uppercase text-[9px] font-black tracking-widest">Login Identifier</span>
 <div className="text-lg font-black text-slate-900 select-all font-mono leading-none">{user.username}</div>
 </div>
 <div className="space-y-1">
 <span className="text-slate-500 uppercase text-[9px] font-black tracking-widest">Master Key</span>
 <div className="text-lg font-black text-slate-900 select-all font-mono leading-none tracking-tighter">{user.password}</div>
 </div>
 </div>

 <div className="text-[11px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed bg-slate-50 p-4 border-2 border-dashed border-slate-200/20 rounded-xl">
 &bull; Dispatch these credentials to the user immediately.<br/>
 &bull; The master key will be encrypted and hidden after this session.
 </div>

 <div className="flex gap-4">
 <button 
 onClick={handleCopy} 
 className={`flex-1 py-4 text-xs font-black rounded-xl transition-all border-[1px] border-slate-200 uppercase tracking-widest ${copied ? 'bg-mint text-emerald-900' : 'bg-white hover:bg-mint/30 text-slate-900'}`}
 >
 {copied ? 'Copied to Void' : 'Copy Payload'}
 </button>
 <button onClick={onClose} className="flex-1 py-4 text-xs font-black text-white bg-slate-900 hover:bg-black rounded-xl border border-slate-200 uppercase tracking-widest ">Finish</button>
 </div>
 </div>
 </div>
 </div>
 );
};



const AnalyticsDashboard: React.FC<{ currentUser: User, allUsers: User[], usageLogs: any[] }> = ({ currentUser, allUsers, usageLogs }) => {
 const [dateRange, setDateRange] = useState<'5' | '7' | '30' | 'all'>('all');
 const [logSearchTerm, setLogSearchTerm] = useState('');
 const [selectedUserId, setSelectedUserId] = useState<string | 'all'>('all');

 const schoolUserIds = useMemo(() => {
 if (currentUser.role === 'Admin') return null;
 return new Set<string>(allUsers.filter(user => user.schoolName === currentUser.schoolName).map(user => user.id));
 }, [currentUser, allUsers]);

 const availableUsers = useMemo(() => {
 if (currentUser.role === 'Admin') return allUsers;
 return allUsers.filter(u => u.schoolName === currentUser.schoolName);
 }, [allUsers, currentUser]);

 const filteredData = useMemo(() => {
 let data = usageLogs;
 if (dateRange !== 'all') {
 const days = parseInt(dateRange, 10);
 const cutoff = new Date();
 cutoff.setDate(cutoff.getDate() - days);
 data = data.filter(d => new Date(d.timestamp) >= cutoff);
 }
 
 if (currentUser.role !== 'Admin') {
 // Filter for school admin
 if (schoolUserIds) {
 data = data.filter(d => schoolUserIds.has(d.userId));
 }
 }
 
 if (logSearchTerm) {
 const lower = logSearchTerm.toLowerCase();
 data = data.filter(d => d.grade.toLowerCase().includes(lower) || d.subject.toLowerCase().includes(lower) || d.userName.toLowerCase().includes(lower));
 }

 if (selectedUserId !== 'all') {
 data = data.filter(d => d.userId === selectedUserId);
 }

 return data;
 }, [dateRange, logSearchTerm, currentUser, allUsers, schoolUserIds, selectedUserId]);
 
 return (
 <div className="space-y-8 animate-fade-in">
 <div className="flex flex-col md:flex-row gap-6 justify-between items-center bg-mint/10 border border-slate-200 p-6 rounded-2xl bg-white">
 <div className="flex flex-col md:flex-row gap-6 w-full">
 <div className="flex flex-col gap-2 flex-1">
 <CustomSelect
 label="Data Range"
 options={[
 { value: '5', label: 'Last 5 Cycles' },
 { value: '7', label: 'Last 7 Cycles' },
 { value: '30', label: 'Last 30 Cycles' },
 { value: 'all', label: 'Complete Era' }
 ]}
 value={dateRange}
 onChange={(val) => setDateRange(val as any)}
 variant="neo"
 />
 </div>
 <div className="flex flex-col gap-2 flex-1">
 <CustomSelect
 label="Entity Filter"
 options={[
 { value: 'all', label: 'All Entities' },
 ...availableUsers.map(u => ({ value: u.id, label: u.name }))
 ]}
 value={selectedUserId}
 onChange={(val) => setSelectedUserId(val)}
 searchable={availableUsers.length > 5}
 variant="neo"
 />
 </div>
 <div className="flex flex-col gap-2 flex-1 relative">
 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Search Identifier</label>
 <div className="relative">
 <input 
 type="text" 
 placeholder="Search logs..." 
 value={logSearchTerm}
 onChange={(e) => setLogSearchTerm(e.target.value)}
 className="pl-12 pr-4 py-4 text-xs font-black rounded-xl border border-slate-200 bg-white text-slate-900 w-full uppercase tracking-tighter outline-none focus:bg-mint transition-colors"
 />
 <Search className="h-5 w-5 absolute left-4 top-3.5 text-slate-400" />
 </div>
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
 <StatCard title="Total Generations" value={filteredData.length} icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
 <StatCard title="Active Users" value={new Set(filteredData.map(d => d.userId)).size} icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
 <StatCard title="Top Subject" value={
 Object.entries(filteredData.reduce((acc: any, curr) => { acc[curr.subject] = (acc[curr.subject] || 0) + 1; return acc; }, {})).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'N/A'
 } icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>} />
 <div className="bg-white border-[1px] border-slate-200 rounded-2xl overflow-hidden">
 <div className="p-6 border-b-[1px] border-slate-200 flex justify-between items-center bg-mint">
 <h3 className="text-2xl font-bold text-slate-900">Usage Logs</h3>
 <div className="flex items-center gap-2 bg-white px-4 py-2 border border-slate-200 rounded-xl">
 <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse border border-slate-200"></div>
 <span className="text-[10px] font-bold text-slate-900 leading-none">Live Metric Feed</span>
 </div>
 </div>
 <div className="max-h-[600px] overflow-y-auto">
 <table className="min-w-full divide-y divide-black/10">
 <thead className="bg-mint sticky top-0 z-10">
 <tr>
 <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-600 border-r border-slate-200/10">Time Vector</th>
 <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-600 border-r border-slate-200/10">Entity Identity</th>
 <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-600 border-r border-slate-200/10">Operation</th>
 <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-600">Metadata Context</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-black/5 bg-white">
 {filteredData.length > 0 ? filteredData.slice(0, 100).map((log) => (
 <tr key={log.id} className="hover:bg-mint/10 transition-colors group">
 <td className="px-6 py-5 whitespace-nowrap border-r border-slate-200/10">
 <div className="text-[11px] font-bold text-slate-900">
 {new Date(log.timestamp).toLocaleDateString()}
 </div>
 <div className="text-[10px] font-medium text-slate-400">
 {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
 </div>
 </td>
 <td className="px-6 py-5 whitespace-nowrap border-r border-slate-200/10">
 <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">{log.userName}</div>
 <div className="text-[9px] text-slate-400 font-mono font-bold mt-0.5">{log.userId?.substring(0, 12)}</div>
 </td>
 <td className="px-6 py-5 whitespace-nowrap border-r border-slate-200/10">
 <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-bold text-emerald-800">
 {log.contentType}
 </span>
 </td>
 <td className="px-6 py-5 whitespace-nowrap">
 <div className="text-xs font-bold text-slate-700">{log.grade} &bull; {log.subject}</div>
 <div className="text-[10px] text-slate-400 italic font-medium mt-1 truncate max-w-[200px]">"{log.topic || 'No Topic'}"</div>
 </td>
 </tr>
 )) : (
 <tr>
 <td colSpan={4} className="px-6 py-24 text-center text-slate-400 font-bold italic opacity-50 bg-slate-50/30">
 No metrics found matching criteria.
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div> </div>
 </div>
 );
};

const AdminPanel: React.FC<{ 
 currentUser: User, 
 allUsers: User[], 
 onUpdateUser: (user: User) => Promise<void>,
 onDeleteUser: (userId: string) => Promise<void>
}> = ({ currentUser, allUsers, onUpdateUser, onDeleteUser }) => {
 const adminTabs = currentUser.role === 'School Admin' 
 ? ['analytics'] 
 : ['users', 'schools', 'subscriptions', 'analytics', 'email', 'settings', 'feedback', 'curriculumManager', 'referrals', 'polls', 'notifications', 'diagrams', 'backup', 'systemConfig'];

 const [activeTab, setActiveTab] = useState<'users' | 'schools' | 'analytics' | 'subscriptions' | 'feedback' | 'curriculumManager' | 'settings' | 'email' | 'referrals' | 'polls' | 'notifications' | 'diagrams' | 'backup' | 'systemConfig'>(
 currentUser.role === 'School Admin' ? 'analytics' : 'users'
 );
 const [editingUser, setEditingUser] = useState<User | null>(null);
 const [viewingHistoryUser, setViewingHistoryUser] = useState<User | null>(null);
 const [feedbackResponses, setFeedbackResponses] = useState<{[key: string]: string}>({});
 const [isUserModalOpen, setIsUserModalOpen] = useState(false);
 const [searchTerm, setSearchTerm] = useState('');
 const [createdUser, setCreatedUser] = useState<User | null>(null);
 const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
 const [transactions, setTransactions] = useState<any[]>([]);
 const [transactionLoading, setTransactionLoading] = useState(false);
 const [transactionError, setTransactionError] = useState<string | null>(null);

 const pendingTransactionsCount = useMemo(() => {
  return transactions.filter((t: any) => {
   const s = (t.status || '').toString().toLowerCase();
   return s === 'pending' || s === 'pending_verification';
  }).length;
 }, [transactions]);
 const [usageLogs, setUsageLogs] = useState<any[]>([]);
 const [processingTransactionId, setProcessingTransactionId] = useState<string | null>(null);
 const [processingFeedbackId, setProcessingFeedbackId] = useState<string | null>(null);
 const [importProgress, setImportProgress] = useState<number>(0);
 const [importStatus, setImportStatus] = useState<string>('');
 const [isRefreshing, setIsRefreshing] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);

 const handleRefreshUsers = () => {
 setIsRefreshing(true);
 localStorage.removeItem('all_users_cache');
 localStorage.removeItem('all_users_last_fetched');
 window.location.reload();
 };

 const inviteUser = (user: User, method: 'email' | 'whatsapp') => {
 const inviteMessage = `You have been invited to join Exameno CBE Content Generator (ECG) Platform. ECG is a CBE aligned Content Generator for Schemes of Work, Lesson Plans and Notes, Exams Questions and ROWC. Join here: ${window.location.origin}`;
 
 if (method === 'whatsapp') {
 const phone = (user.phoneNumber || '').replace(/[^0-9]/g, '');
 window.open(`https://wa.me/${phone}?text=${encodeURIComponent(inviteMessage)}`, '_blank');
 } else {
 // Placeholder: for now just alert. Email implementation requires backend integration.
 alert(`Invite email sent to ${user.email} with message: ${inviteMessage}`);
 }
 };

 const exportCSV = () => {
 const data = allUsers.map(u => ({
 "First Name": u.name.split(' ')[0] || '',
 "Last Name": u.name.split(' ').slice(1).join(' ') || '',
 "Phone Number": u.phoneNumber || '',
 "Email Address": u.email,
 "School Name": u.schoolName || '',
 "Role": u.role,
 "Status": u.status,
 "Account Type": u.accountType,
 "Credits": u.credits
 }));
 const csv = jsonToCSV(data);
 const blob = new Blob([csv], { type: 'text/csv' });
 const url = window.URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'users.csv';
 a.click();
 };

 const downloadTemplate = () => {
 const fields = ["First Name", "Last Name", "Phone Number", "Email Address", "School Name", "Role", "Status", "Account Type", "Credits"];
 const csv = jsonToCSV([], fields);
 const blob = new Blob([csv], { type: 'text/csv' });
 const url = window.URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'user_template.csv';
 a.click();
 };

 const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 setImportProgress(10);
 setImportStatus('Parsing CSV file...');
 Papa.parse(file, {
 header: true,
 skipEmptyLines: true,
 transformHeader: (header) => header.trim(),
 complete: async (results: any) => {
 try {
 setImportProgress(50);
 setImportStatus('Uploading data...');
 const firebaseUser = auth.currentUser;
 const token = firebaseUser ? await firebaseUser.getIdToken() : "";
 
 const response = await fetch("/api/admin/import-users", {
 method: "POST",
 headers: { 
 "Content-Type": "application/json",
 "Authorization": `Bearer ${token}`
 },
 body: JSON.stringify({ users: results.data })
 });
 
 if (!response.ok) throw new Error("Failed to import users");
 
 const data = await response.json();
 setImportProgress(100);
 setImportStatus(`Successfully imported ${data.importCount} new profiles, updated ${data.updateCount} existing profiles.`);
 
      localStorage.removeItem("all_users_cache");
      localStorage.removeItem("all_users_last_fetched");
 setTimeout(() => {
 window.location.reload();
 }, 2000);
 } catch (err: any) {
 setImportProgress(0);
 setImportStatus('Import failed.');
 alert("Import failed: " + err.message);
 }
 }
 });
 };

 useEffect(() => {
 const fetchUsageLogs = async () => {
 try {
 const logsRef = collection(db, 'usage_logs');
 const q = query(logsRef, orderBy('timestamp', 'desc'));
 const snapshot = await getDocs(q);
 const logs = snapshot.docs.map(d => {
 const data = d.data() as any;
 let ts = data.timestamp;
 if (ts && typeof ts !== 'string') {
 try {
 ts = ts.toDate ? ts.toDate().toISOString() : new Date(ts.seconds * 1000).toISOString();
 } catch (e) {
 ts = new Date().toISOString();
 }
 }
 return { ...data, timestamp: ts, id: d.id };
 });
 setUsageLogs(logs);
 } catch (err: any) {
 console.log("Firestore Error in usage_logs fetch:", err);
 handleFirestoreError(err, OperationType.LIST, 'usage_logs');
 }
 };
 fetchUsageLogs();
 }, []);

 const userStats = useMemo(() => {
 const stats: Record<string, number> = {};
 usageLogs.forEach(log => {
 if (log.userId) {
 stats[log.userId] = (stats[log.userId] || 0) + 1;
 }
 });
 return stats;
 }, [usageLogs]);

 const handleTransactionUpdate = async (transactionId: string, status: 'success' | 'failed') => {
 // Reduced friction: only confirm for fails, or keep simple toggle
 if (status === 'failed' && !confirm(`Are you sure you want to decline this transaction?`)) return;
 if (status === 'success' && !confirm(`Approve this transaction and award credits?`)) return;
 
 setProcessingTransactionId(transactionId);
 try {
 const firebaseUser = auth.currentUser;
 const token = firebaseUser ? await firebaseUser.getIdToken() : '';

 const response = await fetch('/api/admin/transactions/update', {
 method: 'POST',
 headers: { 
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${token}`
 },
 body: JSON.stringify({
 transactionId,
 status,
 adminId: currentUser.id
 })
 });
 
 const result = await response.json();
 if (result.success) {
 setTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, status: status === 'success' ? 'VERIFIED' : 'REJECTED' } : t));
 fetchTransactions();
 } else {
 alert(`Error: ${result.error}`);
 }
 } catch (err) {
 console.error('Failed to update transaction:', err);
 alert('Failed to update transaction. Please check network connection.');
 } finally {
 setProcessingTransactionId(null);
 }
 };

  const handleSendWhatsAppReceipt = (t: any, transUser?: any) => {
    const isEmailAdmin = currentUser.email === 'abexameno@gmail.com';
    if (currentUser.role !== 'Admin' && !isEmailAdmin) {
      alert('Unauthorized: Administrator privilege required to send receipts.');
      return;
    }

    let customerPhone = transUser?.phoneNumber || t.phone || t.phoneNumber || '';
    if (!customerPhone) {
      const enteredPhone = prompt(
        `Enter customer WhatsApp phone number for ${toTitleCase(transUser?.name || 'Customer')} (${t.transactionNumber || t.id}):`,
        '07'
      );
      if (!enteredPhone) return;
      customerPhone = enteredPhone;
    }

    const cleanPhone = formatKenyanPhoneForWhatsApp(customerPhone);
    if (!cleanPhone || cleanPhone.length < 9) {
      alert('Invalid phone number. Please enter a valid Kenyan phone number (e.g. 0712345678 or 254712345678).');
      return;
    }

    const txDate = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 
      t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 
      (typeof t.createdAt === 'string' ? new Date(t.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));

    const url = generateWhatsAppReceiptUrl({
      transactionNumber: t.transactionNumber || t.id,
      amount: t.amount,
      userName: transUser?.name,
      userEmail: transUser?.email || t.userEmail,
      date: txDate,
    }, cleanPhone);

    window.open(url, '_blank');
  };

 const fetchTransactions = async () => {
 const isEmailAdmin = currentUser.email === 'abexameno@gmail.com';
 if (currentUser.role !== 'Admin' && !isEmailAdmin) return;

 setTransactionLoading(true);
 setTransactionError(null);
 try {
 const firebaseUser = auth.currentUser;
 if (!firebaseUser) {
 setTransactionError('Authentication required to view transactions.');
 setTransactionLoading(false);
 return;
 }
 const token = await firebaseUser.getIdToken();
 const response = await fetch('/api/admin/transactions', {
 headers: {
 'Authorization': `Bearer ${token}`
 }
 });
 if (response.status === 401 || response.status === 403) {
 setTransactionError('Unauthorized: Administrator access required to view transactions.');
 setTransactionLoading(false);
 return;
 }
 if (!response.ok) {
 const errorData = await response.json().catch(() => ({}));
 setTransactionError(errorData.error || `Server error (${response.status}) loading transactions.`);
 setTransactionLoading(false);
 return;
 }
 const data = await response.json();
 if (data.success && Array.isArray(data.transactions)) {
 setTransactions(deduplicateAndSortTransactions(data.transactions));
 } else {
 setTransactions([]);
 }
 } catch (err: any) {
 console.error('Error fetching admin transactions:', err);
 setTransactionError('Network or connection error loading transactions. Please retry.');
 } finally {
 setTransactionLoading(false);
 }
 };

 	useEffect(() => {
 		const isEmailAdmin = currentUser.email === 'abexameno@gmail.com';
 		if (currentUser.role !== 'Admin' && !isEmailAdmin) return;
 		if (activeTab === 'subscriptions' || transactions.length === 0) {
 			fetchTransactions();
 		}

    const handleFocus = () => {
      if (activeTab === 'subscriptions') {
        fetchTransactions();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
 	}, [currentUser.id, activeTab]);

 const fetchFeedback = async () => {
 try {
 const feedbackRef = collection(db, 'feedback');
 const q = query(feedbackRef, orderBy('timestamp', 'desc'));
 const snapshot = await getDocs(q);
 const items = snapshot.docs.map(d => {
 const data = d.data() as any;
 let ts = data.timestamp;
 if (ts && typeof ts !== 'string') {
 try {
 ts = ts.toDate ? ts.toDate().toISOString() : new Date(ts.seconds * 1000).toISOString();
 } catch (e) {
 ts = new Date().toISOString();
 }
 }
 return { ...data, timestamp: ts, id: d.id } as FeedbackItem;
 });
 setFeedback(items);
 } catch (err: any) {
 console.log("Firestore Error in feedback fetch:", err);
 handleFirestoreError(err, OperationType.LIST, 'feedback');
 }
 };

 useEffect(() => {
 fetchFeedback();
 }, []);

 const handleSeedMockUsers = async () => {
 if (import.meta.env.PROD) {
 alert("Demo user seeding is disabled in production.");
 return;
 }
 if (!window.confirm("Are you sure you want to seed the active Firestore collection with 4 standard CBC/CBE teacher profiles? This will populate the user directory instantly.")) {
 return;
 }
 try {
 const firebaseUser = auth.currentUser;
 if (!firebaseUser) throw new Error("Authentication required.");
 const token = await firebaseUser.getIdToken();
 const usersToSeed = initialUsers.filter(u => u.email !== currentUser.email);
 const res = await fetch('/api/admin/users/seed-demo', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`,
 },
 body: JSON.stringify({ users: usersToSeed }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 throw new Error(data.error || `HTTP ${res.status}`);
 }
 localStorage.removeItem('all_users_cache');
 localStorage.removeItem('all_users_last_fetched');
 alert("CBE Demo Teachers seeded successfully! Page will now reload to update the listings.");
 window.location.reload();
 } catch (err: any) {
 alert("Seeding failed: " + err.message);
 }
 };


 const filteredUsers = useMemo(() => {
 let users = allUsers;
 if (currentUser.role === 'School Admin') {
 users = users.filter(u => u.schoolName === currentUser.schoolName);
 }
 if (searchTerm) {
 const lower = searchTerm.toLowerCase();
 users = users.filter(u => u.name.toLowerCase().includes(lower) || u.email.toLowerCase().includes(lower));
 }
 // Sort by createdAt descending
 return [...users].sort((a, b) => {
 const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
 const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
 return dateB - dateA;
 });
 }, [allUsers, searchTerm, currentUser]);

 const handleSaveUser = async (user: User) => {
 const isNew = !allUsers.some(u => u.id === user.id);
 
 if (isNew) {
 const username = user.email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase() + Math.floor(Math.random() * 100);
 
 const newUserPayload = {
 ...user,
 id: user.id.toString(),
 username,
 credits: user.credits ?? 3,
 avatarColor: ['bg-blue-600', 'bg-green-600', 'bg-purple-600', 'bg-yellow-600', 'bg-red-600'][Math.floor(Math.random() * 5)],
 };
 delete (newUserPayload as any).password;
 
 try {
 const firebaseUser = auth.currentUser;
 if (!firebaseUser) throw new Error("Authentication required.");
 const token = await firebaseUser.getIdToken();
 const res = await fetch('/api/admin/users', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`,
 },
 body: JSON.stringify(newUserPayload),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 throw new Error(data.error || `Failed to create user (HTTP ${res.status})`);
 }
 localStorage.removeItem('all_users_cache');
 localStorage.removeItem('all_users_last_fetched');
 if (data.user) {
 await onUpdateUser(data.user);
 }
 setCreatedUser((data.user || newUserPayload) as User);
 } catch (err: any) {
 alert("Error creating user: " + (err.message || err));
 }
 } else {
 try {
 const firebaseUser = auth.currentUser;
 if (!firebaseUser) throw new Error("Authentication required.");
 const token = await firebaseUser.getIdToken();
 const updatePayload = {
 name: user.name,
 firstName: user.firstName,
 lastName: user.lastName,
 email: user.email,
 phoneNumber: user.phoneNumber,
 schoolName: user.schoolName,
 county: user.county,
 role: user.role,
 status: user.status,
 accountType: user.accountType,
 expiryDate: user.expiryDate,
 credits: user.credits,
 avatarColor: user.avatarColor,
 };
 const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
 method: 'PUT',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`,
 },
 body: JSON.stringify(updatePayload),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 throw new Error(data.error || `Failed to update user (HTTP ${res.status})`);
 }
 localStorage.removeItem('all_users_cache');
 localStorage.removeItem('all_users_last_fetched');
 await onUpdateUser(data.user || user);
 } catch (err: any) {
 alert("Error updating user: " + (err.message || err));
 }
 }
 
 setIsUserModalOpen(false);
 setEditingUser(null);
 };

 const handleDeleteUserClick = async (userId: string) => {
 if (window.confirm('Are you sure you want to delete this user?')) {
 try {
 const firebaseUser = auth.currentUser;
 if (!firebaseUser) throw new Error("Authentication required.");
 const token = await firebaseUser.getIdToken();
 const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
 method: 'DELETE',
 headers: {
 Authorization: `Bearer ${token}`,
 },
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 throw new Error(data.error || `Failed to delete user (HTTP ${res.status})`);
 }
 localStorage.removeItem('all_users_cache');
 localStorage.removeItem('all_users_last_fetched');
 await onDeleteUser(userId);
 } catch (err: any) {
 alert("Error deleting user: " + (err.message || err));
 }
 }
 };

 const handleEditCredits = async (user: User) => {
 const newCredits = prompt('Enter new credits:', user.credits?.toString() || '0');
 if (newCredits !== null) {
 const parsedCredits = parseInt(newCredits, 10);
 if (isNaN(parsedCredits) || parsedCredits < 0) {
 alert('Please enter a valid non-negative integer for credits.');
 return;
 }
 try {
 const firebaseUser = auth.currentUser;
 if (!firebaseUser) throw new Error('Authentication required.');
 const token = await firebaseUser.getIdToken();
 const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/credits`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`,
 },
 body: JSON.stringify({
 absoluteCredits: parsedCredits,
 reason: `Admin Credit Adjustment (${currentUser.name})`,
 }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 throw new Error(data.error || `Failed to adjust credits (HTTP ${res.status})`);
 }
 if (data.user) {
 await onUpdateUser(data.user);
 }
 } catch (err: any) {
 alert('Failed to update credits: ' + (err.message || err));
 }
 }
 };

 const handleToggleStatus = async (user: User) => {
 const nextStatus = user.status === 'Active' ? 'Inactive' : 'Active';
 try {
 const firebaseUser = auth.currentUser;
 if (!firebaseUser) throw new Error('Authentication required.');
 const token = await firebaseUser.getIdToken();
 const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/status`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`,
 },
 body: JSON.stringify({
 status: nextStatus,
 reason: `Admin Status Toggle (${currentUser.name})`,
 }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 throw new Error(data.error || `Failed to update status (HTTP ${res.status})`);
 }
 if (data.user) {
 await onUpdateUser(data.user);
 }
 } catch (err: any) {
 alert('Failed to toggle user status: ' + (err.message || err));
 }
 };

 const handleDeleteFeedback = async (id: string) => {
 if (!confirm('Are you sure you want to delete this feedback?')) return;
 setProcessingFeedbackId(id);
 try {
 const firebaseUser = auth.currentUser;
 if (!firebaseUser) throw new Error('Authentication required.');
 const token = await firebaseUser.getIdToken();
 const res = await fetch(`/api/admin/feedback/${encodeURIComponent(id)}`, {
 method: 'DELETE',
 headers: { Authorization: `Bearer ${token}` },
 });
 if (!res.ok) {
 const data = await res.json().catch(() => ({}));
 throw new Error(data.error || `HTTP ${res.status}`);
 }
 setFeedback(prev => prev.filter(f => f.id !== id));
 } catch (err: any) {
 alert('Failed to delete feedback: ' + (err.message || err));
 } finally {
 setProcessingFeedbackId(null);
 }
 };

 const handleUpdateFeedbackStatus = async (id: string, status: 'Read' | 'Resolved') => {
 setProcessingFeedbackId(id);
 try {
 const firebaseUser = auth.currentUser;
 if (!firebaseUser) throw new Error('Authentication required.');
 const token = await firebaseUser.getIdToken();
 const res = await fetch(`/api/admin/feedback/${encodeURIComponent(id)}`, {
 method: 'PUT',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`,
 },
 body: JSON.stringify({ status }),
 });
 if (!res.ok) {
 const data = await res.json().catch(() => ({}));
 throw new Error(data.error || `HTTP ${res.status}`);
 }
 setFeedback(prev => prev.map(f => f.id === id ? { ...f, status } : f));
 } catch (err: any) {
 alert('Failed to update feedback status: ' + (err.message || err));
 } finally {
 setProcessingFeedbackId(null);
 }
 };

 const handleRespondToFeedback = async (id: string) => {
 const response = feedbackResponses[id];
 if (!response?.trim()) return;
 setProcessingFeedbackId(id);
 try {
 const firebaseUser = auth.currentUser;
 if (!firebaseUser) throw new Error('Authentication required.');
 const token = await firebaseUser.getIdToken();
 const res = await fetch(`/api/admin/feedback/${encodeURIComponent(id)}`, {
 method: 'PUT',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`,
 },
 body: JSON.stringify({ response, status: 'Resolved' }),
 });
 if (!res.ok) {
 const data = await res.json().catch(() => ({}));
 throw new Error(data.error || `HTTP ${res.status}`);
 }
 setFeedback(prev => prev.map(f => f.id === id ? { ...f, response, status: 'Resolved' } : f));
 } catch (err: any) {
 alert('Failed to respond to feedback: ' + (err.message || err));
 } finally {
 setProcessingFeedbackId(null);
 setFeedbackResponses(prev => ({...prev, [id]: ''}));
 }
 };

 const getTabColors = (tabName: string, isActive: boolean) => {
  const colors: Record<string, { active: string; inactive: string }> = {
   users: { active: 'bg-blue-600 text-white ring-2 ring-black', inactive: 'bg-blue-50 text-blue-800 hover:bg-blue-100 border-blue-200' },
   analytics: { active: 'bg-emerald-600 text-white ring-2 ring-black', inactive: 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-200' },
   subscriptions: { active: 'bg-amber-600 text-white ring-2 ring-black', inactive: 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200' },
   email: { active: 'bg-violet-600 text-white ring-2 ring-black', inactive: 'bg-violet-50 text-violet-800 hover:bg-violet-100 border-violet-200' },
   settings: { active: 'bg-slate-700 text-white ring-2 ring-black', inactive: 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300' },
   feedback: { active: 'bg-rose-600 text-white ring-2 ring-black', inactive: 'bg-rose-50 text-rose-800 hover:bg-rose-100 border-rose-200' },
   curriculumManager: { active: 'bg-indigo-700 text-white ring-2 ring-black', inactive: 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border-indigo-200' },
   curriculum: { active: 'bg-indigo-600 text-white ring-2 ring-black', inactive: 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border-indigo-200' },
   referrals: { active: 'bg-teal-600 text-white ring-2 ring-black', inactive: 'bg-teal-50 text-teal-800 hover:bg-teal-100 border-teal-200' },
   systemConfig: { active: 'bg-[#3b1464] text-white ring-2 ring-black', inactive: 'bg-purple-50 text-purple-800 hover:bg-purple-100 border-purple-200' },
   polls: { active: 'bg-pink-600 text-white ring-2 ring-black', inactive: 'bg-pink-50 text-pink-800 hover:bg-pink-100 border-pink-200' },
   notifications: { active: 'bg-orange-600 text-white ring-2 ring-black', inactive: 'bg-orange-50 text-orange-800 hover:bg-orange-100 border-orange-200' },
   diagrams: { active: 'bg-cyan-600 text-white ring-2 ring-black', inactive: 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100 border-cyan-200' },
   backup: { active: 'bg-fuchsia-600 text-white ring-2 ring-black', inactive: 'bg-fuchsia-50 text-fuchsia-800 hover:bg-fuchsia-100 border-fuchsia-200' },
   schools: { active: 'bg-emerald-800 text-white ring-2 ring-black', inactive: 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-200' },
  };
  const defaultStyles = { active: 'bg-emerald-600 text-white ring-2 ring-black', inactive: 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300' };
  const tabStyle = colors[tabName] || defaultStyles;
  return isActive ? tabStyle.active : tabStyle.inactive;
 };

 return (
 <div className="space-y-6 animate-fade-in pb-12 p-6 border border-slate-200 rounded-2xl">
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-6 gap-6">
 <h1 className="text-3xl font-bold text-slate-900">Admin <span className="text-emerald-700">Panel</span></h1>
 <div className="flex flex-wrap gap-2 pb-2 md:pb-0 w-full md:w-auto scrollbar-hide overflow-x-auto snap-x">
 {adminTabs.map(tab => {
 const newCount = tab === 'feedback' ? feedback.filter(f => f.status === 'New').length : (tab === 'subscriptions' ? pendingTransactionsCount : 0);
 const tabClass = getTabColors(tab, activeTab === tab);
 return (
 <button
 key={tab}
 onClick={() => setActiveTab(tab as any)}
 className={`relative px-3 py-2 md:px-4 md:py-2.5 text-[10px] md:text-[11px] font-bold rounded-xl transition-all snap-start border border-slate-200 ${tabClass}`}
 >
 {tab === 'subscriptions' ? 'Transactions' : tab === 'diagrams' ? 'Diagram Studio' : tab === 'backup' ? 'Backup & Restore' : tab === 'curriculumManager' ? 'Curriculum & Resources' : tab === 'systemConfig' ? 'System Configuration' : tab.charAt(0).toUpperCase() + tab.slice(1)}
 {newCount > 0 && (
 <span className="absolute -top-2 -right-2 bg-rose-600 text-white text-[10px] min-w-[22px] h-6 px-1 flex items-center justify-center rounded-full border-2 border-white font-bold animate-bounce">
 {newCount}
 </span>
 )}
 </button>
 );
 })}
 </div>
 </div>

 {/* Admin Pending Payments Notification */}
 {pendingTransactionsCount > 0 ? (
  <div 
   data-testid="admin-pending-payments-banner"
   className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-950 shadow-sm"
  >
   <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-xl bg-amber-200/80 flex items-center justify-center flex-shrink-0 text-amber-800">
     <AlertCircle className="w-5 h-5" />
    </div>
    <div>
     <p className="text-sm font-black tracking-tight text-amber-950">
      Pending Payments: {pendingTransactionsCount}
     </p>
     <p className="text-xs text-amber-800 font-medium">
      Manual M-Pesa payment claims awaiting administrator verification and approval.
     </p>
    </div>
   </div>
   <button
    onClick={() => setActiveTab('subscriptions')}
    className="px-4 py-2 bg-[#3b1464] hover:bg-[#2e1065] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex-shrink-0 shadow-sm active:scale-95 cursor-pointer"
   >
    Review Transactions
   </button>
  </div>
 ) : (
  activeTab === 'subscriptions' && (
   <div 
    data-testid="admin-no-pending-payments"
    className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center gap-2 text-slate-600 text-xs font-medium"
   >
    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
    <span>No pending payments. All transactions have been reviewed.</span>
   </div>
  )
 )}

 {activeTab === 'users' && (
 <div className="space-y-6">
 <div className="app-card p-4 md:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
 <div className="relative w-full lg:w-96 group">
 <input 
 type="text" 
 placeholder="Search members by name or email..." 
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="app-input w-full pl-10"
 />
 <Search className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
 </div>
 <div className="flex flex-wrap gap-2 items-center w-full lg:w-auto">
 <button onClick={downloadTemplate} className="app-btn bg-blue-50 hover:bg-blue-100 text-blue-700 border border-slate-200 flex items-center gap-1.5 text-xs md:text-sm font-semibold rounded-lg">
 <Download className="h-4 w-4" /> Template
 </button>
 <button onClick={() => fileInputRef.current?.click()} className="app-btn bg-purple-50 hover:bg-purple-100 text-purple-700 border border-slate-200 flex items-center gap-1.5 text-xs md:text-sm font-semibold rounded-lg">
 <Upload className="h-4 w-4" /> Import
 </button>
 <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />
 <button onClick={exportCSV} className="app-btn bg-amber-50 hover:bg-amber-100 text-amber-700 border border-slate-200 flex items-center gap-1.5 text-xs md:text-sm font-semibold rounded-lg">
 <Download className="h-4 w-4" /> Export
 </button>
 <button onClick={handleRefreshUsers} disabled={isRefreshing} className="app-btn bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-slate-200 flex items-center gap-1.5 text-xs md:text-sm font-semibold rounded-lg">
 <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} /> Refresh
 </button>
 {!import.meta.env.PROD && (
 <button 
 onClick={handleSeedMockUsers} 
 className="app-btn bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-slate-200 flex items-center gap-1.5 text-xs md:text-sm font-semibold rounded-lg"
 title="Seed CBC mock teacher profiles for demonstration"
 >
 <Plus className="h-4 w-4" /> Seed Demo Accounts
 </button>
 )}
 <button 
 onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }} 
 className="app-btn app-btn-primary flex items-center gap-1.5 text-xs md:text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 border border-slate-200"
 >
 <Plus className="h-4 w-4" />
 Add new member
 </button>
 </div>
 {importStatus && (
 <div className="w-full space-y-2 mt-4 p-4 border border-slate-200 rounded-xl bg-white ">
 <div className="flex justify-between items-center text-xs font-bold text-slate-700">
 <span>{importStatus}</span>
 <span>{importProgress}%</span>
 </div>
 <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
 <div className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }}></div>
 </div>
 </div>
 )}
 </div>

 <div className="app-card overflow-hidden">
 {/* Desktop Table View */}
 <div className="hidden lg:block overflow-x-auto">
 <table className="min-w-full divide-y-4 divide-black">
 <thead className="bg-mint">
 <tr>
 <th className="px-6 py-6 text-left text-[10px] font-bold text-slate-700 border-r border-slate-200/10">Member Details</th>
 <th className="px-6 py-6 text-left text-[10px] font-bold text-slate-700 border-r border-slate-200/10">Phone</th>
 <th className="px-6 py-6 text-left text-[10px] font-bold text-slate-700 border-r border-slate-200/10">Role & School</th>
 <th className="px-6 py-6 text-left text-[10px] font-bold text-slate-700 border-r border-slate-200/10">Credits</th>
 <th className="px-6 py-6 text-left text-[10px] font-bold text-slate-700 border-r border-slate-200/10">Status</th>
 <th className="px-6 py-6 text-right text-[10px] font-bold text-slate-700">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y-2 divide-black/5 bg-white">
 {filteredUsers.map((user) => (
 <tr key={user.id} className="hover:bg-mint/10 transition-colors group">
 <td className="px-6 py-6 whitespace-nowrap border-r-2 border-slate-200/10">
 <div className="flex items-center">
 <div className={`flex-shrink-0 h-10 w-10 rounded-xl ${user.avatarColor} flex items-center justify-center text-white text-xs font-bold border border-slate-200 group-hover:scale-110 transition-transform`}>
 {getInitials(getFullName(user))}
 </div>
 <div className="ml-4 text-left">
 <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
 {getFullName(user)}
 </div>
 <div className="text-[10px] text-slate-400 font-bold mt-0.5">{user.email}</div>
 <div className="mt-1">
 <span className="text-[9px] font-bold text-slate-400">
 Joined {user.dateJoined ? new Date(user.dateJoined).toLocaleDateString() : (user.createdAt ? new Date(typeof (user.createdAt as any).seconds === 'number' ? (user.createdAt as any).seconds * 1000 : user.createdAt).toLocaleDateString() : 'N/A')}
 </span>
 </div>
 </div>
 </div>
 </td>
 <td className="px-6 py-6 whitespace-nowrap text-xs text-slate-900 font-bold border-r border-slate-200/10">
 {formatKenyanPhoneDisplay(user.phoneNumber) || user.phoneNumber || (user as any).phone || 'N/A'}
 </td>
 <td className="px-6 py-6 whitespace-nowrap border-r border-slate-200/10">
 <div className="text-[11px] font-bold text-slate-900 mb-1 select-none">
 <span className={`px-2 py-0.5 rounded border border-slate-200/20 ${
 user.role === 'Admin' ? 'bg-rose-100 text-rose-700' : 
 user.role === 'Teacher' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100'
 }`}>
 {user.role}
 </span>
 </div>
 <div className="text-[10px] text-slate-400 font-bold truncate max-w-[150px] opacity-70">{user.schoolName || 'Individual'}</div>
 </td>
 <td className="px-6 py-6 whitespace-nowrap border-r border-slate-200/10">
 <div className="flex items-center gap-3">
 <span className="text-sm font-bold text-slate-900 bg-mint px-3 py-1.5 rounded-xl border border-slate-200 font-mono">
 {typeof user.credits === 'number' ? user.credits : '...'}
 </span>
 <div className="flex flex-col">
 <button onClick={() => setViewingHistoryUser(user)} className="text-[9px] text-emerald-800 hover:underline font-bold text-left">Activity Log</button>
 <span className="text-[8px] text-slate-400 font-bold">({userStats[user.id] || 0} usage)</span>
 </div>
 </div>
 </td>
 <td className="px-6 py-6 whitespace-nowrap border-r border-slate-200/10">
 <span className={`px-3 py-1 inline-flex text-[9px] font-bold rounded-full border border-slate-200 ${user.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
 {user.status}
 </span>
 </td>
 <td className="px-6 py-6 whitespace-nowrap text-right text-sm font-black flex gap-1 justify-end">
 <button onClick={() => inviteUser(user, 'email')} className="p-2 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 rounded-lg transition-all" title="Invite via Email"><Mail className="h-4 w-4" /></button>
 <button onClick={() => inviteUser(user, 'whatsapp')} className="p-2 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 rounded-lg transition-all" title="Invite via WhatsApp"><MessageSquare className="h-4 w-4" /></button>
 <button onClick={() => handleEditCredits(user)} className="p-2 text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-all" title="Edit Credits"><Wallet className="h-4 w-4" /></button>
 <button onClick={() => handleToggleStatus(user)} className={`p-2 border border-slate-200 rounded-lg transition-all ${user.status === 'Active' ? 'text-rose-600 hover:text-rose-800 hover:bg-rose-50' : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'}`} title="Toggle Status">{user.status === 'Active' ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}</button>
 <button onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }} className="p-2 text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-all" title="Edit Profile"><Edit2 className="h-4 w-4" /></button>
 {currentUser.id !== user.id && (
 <button onClick={() => handleDeleteUserClick(user.id)} className="p-2 text-rose-400 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 rounded-lg transition-all" title="Delete Member"><Trash2 className="h-4 w-4" /></button>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {/* Mobile Card View */}
 <div className="lg:hidden divide-y-2 divide-black/10">
 {filteredUsers.length === 0 ? (
 <div className="p-16 text-center text-slate-400 font-black uppercase tracking-widest italic">No members found.</div>
 ) : filteredUsers.map((user) => (
 <div key={user.id} className="p-6 space-y-6 hover:bg-mint/10 transition-colors bg-white">
 <div className="flex justify-between items-start">
 <div className="flex items-center">
 <div className={`flex-shrink-0 h-14 w-14 rounded-2xl ${user.avatarColor} flex items-center justify-center text-white text-base font-bold border border-slate-200`}>
 {getInitials(getFullName(user))}
 </div>
 <div className="ml-5">
 <div className="text-lg font-bold text-slate-900 leading-tight flex items-center gap-2">
 {getFullName(user)}
 </div>
 <div className="text-xs text-slate-500 mt-1 font-bold">{user.email}</div>
 </div>
 </div>
 <span className={`px-3 py-1 text-[9px] font-bold rounded-full border border-slate-200 ${user.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
 {user.status}
 </span>
 </div>
 <div className="grid grid-cols-2 gap-6 bg-mint/20 p-5 rounded-2xl border border-slate-200 border-dashed">
 <div className="space-y-1">
 <div className="text-[9px] text-slate-500 font-bold">Joined On</div>
 <div className="text-xs font-bold text-slate-700">{user.createdAt ? new Date(typeof (user.createdAt as any).seconds === 'number' ? (user.createdAt as any).seconds * 1000 : user.createdAt).toLocaleDateString() : 'N/A'}</div>
 </div>
 <div className="space-y-1">
 <div className="text-[9px] text-slate-500 font-bold">User Role</div>
 <div className="text-xs font-bold text-indigo-700">{user.role}</div>
 </div>
 <div className="space-y-1">
 <div className="text-[9px] text-slate-500 font-bold">Available Credits</div>
 <div className="flex items-center gap-2">
 <span className="text-sm font-bold text-emerald-900 font-mono">
 {user.credits ?? 0} <span className="text-[9px]">CR</span>
 </span>
 <button onClick={() => setViewingHistoryUser(user)} className="text-[9px] text-indigo-700 hover:underline font-bold">Log</button>
 </div>
 </div>
 <div className="space-y-1">
 <div className="text-[9px] text-slate-500 font-bold">Phone</div>
 <div className="text-xs font-bold text-slate-700">{formatKenyanPhoneDisplay(user.phoneNumber) || user.phoneNumber || (user as any).phone || 'N/A'}</div>
 </div>
 <div className="col-span-2 space-y-1 pt-2 border-t border-slate-200/10">
 <div className="text-[9px] text-slate-500 font-bold">Organization / School</div>
 <div className="text-sm font-bold text-slate-900">{user.schoolName || 'Individual Member'}</div>
 </div>
 </div>

 <div className="flex gap-4 pt-2">
 <button 
 onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }} 
 className="flex-1 py-4 text-[10px] font-bold bg-white border border-slate-200 text-slate-900 rounded-xl hover:bg-mint transition-all"
 >
 Update Info
 </button>
 {currentUser.id !== user.id && (
 <button 
 onClick={() => handleDeleteUserClick(user.id)} 
 className="flex-1 py-4 text-[10px] font-bold bg-rose-50 border border-slate-200 text-rose-700 rounded-xl hover:bg-rose-100 transition-all"
 >
 Remove
 </button>
 )}
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}

 {activeTab === 'schools' && (
  <SchoolManagementPanel currentUser={currentUser} />
 )}

 {activeTab === 'analytics' && (
 <AnalyticsDashboard currentUser={currentUser} allUsers={allUsers} usageLogs={usageLogs} />
 )}

 {activeTab === 'email' && (
 <div className="space-y-8">
 <EmailBroadcastPanel allUsers={allUsers} currentUser={currentUser} />
 <EmailHistoryPanel />
 </div>
 )}

 {activeTab === 'referrals' && (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
 <div className="space-y-4">
 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">My Referral Hub</h3>
 <ReferralHub currentUser={currentUser} />
 </div>
 <div className="space-y-4">
 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Referral System Records</h3>
 <ReferralManagementPanel />
 </div>
 </div>
 )}

 {activeTab === 'notifications' && (
 <NotificationManagementPanel allUsers={allUsers} currentUser={currentUser} />
 )}

 {activeTab === 'polls' && (
 <PollsManagementPanel allUsers={allUsers} currentUser={currentUser} />
 )}
 
 {activeTab === 'subscriptions' && (
 <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
 <div className="p-6 border-b-4 border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center bg-mint gap-4">
 <div>
 <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Transaction Logs</h3>
 <p className="text-xs text-emerald-900 font-bold uppercase tracking-widest opacity-70">Review and approve credit Top-Ups.</p>
 </div>
 	<div className="flex items-center gap-2">
 		<button
 			onClick={() => fetchTransactions()}
 			disabled={transactionLoading}
 			className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 hover:bg-mint transition-all disabled:opacity-50 cursor-pointer"
 			title="Refresh Transactions"
 		>
 			<RefreshCw className={`w-3.5 h-3.5 ${transactionLoading ? "animate-spin text-emerald-600" : ""}`} />
 			<span>{transactionLoading ? "Refreshing..." : "Refresh"}</span>
 		</button>
 		<div className="flex items-center gap-2 bg-white px-4 py-2 border-[1px] border-slate-200 rounded-xl">
 			<div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse border-[1px] border-slate-200"></div>
 			<span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Gateway: M-Pesa</span>
 		</div>
 	</div>
 </div>
 <div className="overflow-x-auto hidden md:block">
 <table className="min-w-full divide-y-4 divide-black">
 <thead className="bg-mint">
 <tr>
 <th className="px-6 py-4 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest border-r-2 border-slate-200/10">Date & Time</th>
 <th className="px-6 py-4 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest border-r-2 border-slate-200/10">User Entity</th>
 <th className="px-6 py-4 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest border-r-2 border-slate-200/10">Amount (KES)</th>
 <th className="px-6 py-4 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest border-r-2 border-slate-200/10">Status</th>
 <th className="px-6 py-4 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest border-r-2 border-slate-200/10">Reference</th>
 <th className="px-6 py-4 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest border-r-2 border-slate-200/10">Audit</th>
 <th className="px-6 py-4 text-right text-[10px] font-black text-slate-600 uppercase tracking-widest">Action</th>
 </tr>
 </thead>
 <tbody className="divide-y-2 divide-black/5 bg-white">
 {transactionLoading ? (
 <tr>
 <td colSpan={7} className="px-6 py-16 text-center text-slate-500 font-bold uppercase tracking-widest animate-pulse">Loading transactions...</td>
 </tr>
 ) : transactionError ? (
 <tr>
 <td colSpan={7} className="px-6 py-12 text-center">
 <div className="max-w-md mx-auto p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
 <p className="text-xs font-bold text-rose-700">{transactionError}</p>
 <button 
 onClick={() => fetchTransactions()}
 className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-colors"
 >
 Retry
 </button>
 </div>
 </td>
 </tr>
 ) : transactions.length === 0 ? (
 <tr>
 <td colSpan={7} className="px-6 py-24 text-center text-slate-400 font-black uppercase tracking-widest italic">No transactions found.</td>
 </tr>
 ) : transactions.map((t: any) => {
 const transUser = allUsers.find(u => u.id === t.userId || (t.userEmail && u.email?.toLowerCase() === t.userEmail.toLowerCase()));
 const canonicalStatus = normalizeTransactionStatus(t.status);
 const isPending = isTransactionPending(t.status);
 const isVerified = isTransactionVerified(t.status);
 const badgeClasses = getTransactionBadgeClasses(t.status);
 const statusLabel = getTransactionStatusLabel(t.status, 'admin');

 return (
 <tr key={t.id} className="hover:bg-mint/10 transition-colors group">
 <td className="px-6 py-5 whitespace-nowrap border-r-2 border-slate-200/10">
 <div className="text-xs font-black text-slate-900">
 {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString() : 
 t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleDateString() : 
 (typeof t.createdAt === 'string' ? new Date(t.createdAt).toLocaleDateString() : 'N/A')}
 </div>
 <div className="text-[10px] font-bold text-slate-400 uppercase">
 {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleTimeString() : 
 t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleTimeString() : 
 (typeof t.createdAt === 'string' ? new Date(t.createdAt).toLocaleTimeString() : '')}
 </div>
 </td>
 <td className="px-6 py-5 whitespace-nowrap border-r-2 border-slate-200/10">
 <div className="text-sm font-normal text-slate-900 capitalize tracking-tight group-hover:text-emerald-700 transition-colors">{toTitleCase(transUser?.name || 'Unknown')}</div>
 <div className="text-[10px] text-slate-400 font-mono font-bold">{transUser?.phoneNumber || transUser?.email || 'No Phone'}</div>
 </td>
 <td className="px-6 py-5 whitespace-nowrap border-r border-slate-200/10">
 <div className="text-lg font-black text-emerald-700 tracking-tighter">
 {t.amount} <span className="text-[10px] text-slate-400">KES</span>
 </div>
 </td>
 <td className="px-6 py-5 whitespace-nowrap border-r border-slate-200/10">
 <span className={`px-3 py-1 inline-flex text-[9px] font-black uppercase rounded-full border border-slate-200 ${badgeClasses.full}`}>
 {statusLabel}
 </span>
 </td>
 <td className="px-6 py-5 whitespace-nowrap border-r border-slate-200/10 font-mono text-[10px] font-bold text-slate-500 uppercase">
 {t.transactionNumber || t.id}
 </td>
 <td className="px-6 py-5 whitespace-nowrap border-r border-slate-200/10">
  <span className={`px-2.5 py-1 inline-flex text-[9px] font-black uppercase rounded-lg border ${
   t.manuallyProcessed 
    ? 'bg-purple-50 text-purple-700 border-purple-200' 
    : 'bg-slate-100 text-slate-600 border-slate-200'
  }`}>
   {t.manuallyProcessed ? 'Manual' : 'Standard'}
  </span>
 </td>
 <td className="px-6 py-5 whitespace-nowrap text-right">
 {isPending && (
 <div className="flex justify-end gap-2">
 <button 
 disabled={processingTransactionId === t.id}
 onClick={() => handleTransactionUpdate(t.id, 'success')}
 className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-xl text-[10px] font-bold transition-all border border-slate-200 disabled:opacity-50 cursor-pointer"
 >
 {processingTransactionId === t.id ? '...' : 'Approve'}
 </button>
 <button 
 disabled={processingTransactionId === t.id}
 onClick={() => handleTransactionUpdate(t.id, 'failed')}
 className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-xl text-[10px] font-bold transition-all border border-slate-200 disabled:opacity-50 cursor-pointer"
 >
 {processingTransactionId === t.id ? '...' : 'Decline'}
 </button>
 </div>
 )}
 {isVerified && (
 <div className="flex justify-end">
 <button
   type="button"
   onClick={() => handleSendWhatsAppReceipt(t, transUser)}
   className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold transition-all shadow-sm active:scale-95 cursor-pointer border border-emerald-700"
   title="Send verified payment receipt to customer via WhatsApp"
 >
   <MessageCircle className="h-3.5 w-3.5" />
   <span>Send Receipt</span>
 </button>
 </div>
 )}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 <div className="md:hidden divide-y-4 divide-black">
 {transactionLoading ? (
 <div className="p-16 text-center text-slate-500 font-bold uppercase tracking-widest animate-pulse">Loading transactions...</div>
 ) : transactionError ? (
 <div className="p-8 text-center space-y-3 bg-rose-50">
 <p className="text-xs font-bold text-rose-700">{transactionError}</p>
 <button 
 onClick={() => fetchTransactions()}
 className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-black uppercase"
 >
 Retry
 </button>
 </div>
 ) : transactions.length === 0 ? (
 <div className="p-16 text-center text-slate-400 font-black uppercase tracking-widest italic">No transactions found.</div>
 ) : transactions.map((t: any) => {
 const transUser = allUsers.find(u => u.id === t.userId || (t.userEmail && u.email?.toLowerCase() === t.userEmail.toLowerCase()));
 const canonicalStatus = normalizeTransactionStatus(t.status);
 const isPending = isTransactionPending(t.status);
 const isVerified = isTransactionVerified(t.status);
 const badgeClasses = getTransactionBadgeClasses(t.status);
 const statusLabel = getTransactionStatusLabel(t.status, 'admin');

 return (
 <div key={t.id} className="p-6 space-y-4 bg-white hover:bg-mint/10 transition-colors border-[1px] border-slate-200">
 <div className="flex justify-between items-start">
 <div className="space-y-1">
 <div className="text-sm font-normal text-slate-900 capitalize tracking-tighter leading-none">{toTitleCase(transUser?.name || 'Unknown')}</div>
 <div className="text-[10px] text-slate-400 font-mono font-bold uppercase">
 {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString() : 
 t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleString() : 
 (typeof t.createdAt === 'string' ? new Date(t.createdAt).toLocaleString() : 'N/A')}
 </div>
 </div>
 <div className="text-right space-y-1">
 <div className="text-lg font-black text-emerald-700 leading-none">{t.amount} <span className="text-[9px]">KES</span></div>
 <span className={`px-3 py-1 inline-flex text-[9px] font-black uppercase rounded-full border border-slate-200 ${badgeClasses.full}`}>
 {statusLabel}
 </span>
 </div>
 </div>
 <div className="bg-mint/20 p-4 rounded-xl border border-slate-200 border-dashed flex justify-between items-center">
  <div className="flex flex-col gap-0.5 max-w-[60%]">
   <div className="text-slate-500 font-mono text-[9px] font-bold uppercase truncate">Ref: {t.transactionNumber || t.id}</div>
   <div className="text-[9px] font-bold text-slate-600 uppercase">
    Audit: <span className={t.manuallyProcessed ? "text-purple-700 font-black" : "text-slate-500"}>{t.manuallyProcessed ? 'Manual' : 'Standard'}</span>
   </div>
  </div>
 <div className="flex gap-2">
 {isPending && (
 <>
 <button 
 disabled={processingTransactionId === t.id}
 onClick={() => handleTransactionUpdate(t.id, 'success')}
 className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-[9px] font-black active:translate-x-0.5 active:translate-y-0.5 transition-all text-xs border border-slate-200 uppercase tracking-tighter disabled:opacity-50"
 >
 Approve
 </button>
 <button 
 disabled={processingTransactionId === t.id}
 onClick={() => handleTransactionUpdate(t.id, 'failed')}
 className="bg-rose-600 text-white px-3 py-2 rounded-lg text-[9px] font-black active:translate-x-0.5 active:translate-y-0.5 transition-all text-xs border border-slate-200 uppercase tracking-tighter disabled:opacity-50"
 >
 Reject
 </button>
 </>
 )}
 {isVerified && (
 <button
   type="button"
   onClick={() => handleSendWhatsAppReceipt(t, transUser)}
   className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-[9px] font-black flex items-center gap-1.5 transition-all text-xs border border-slate-200 uppercase tracking-tighter shadow-sm active:scale-95 cursor-pointer"
   title="Send receipt to customer via WhatsApp"
 >
   <MessageCircle className="h-3 w-3" />
   <span>Send Receipt</span>
 </button>
 )}
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {activeTab === 'feedback' && (
 <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
 <div className="p-6 border-b-4 border-slate-200 bg-mint flex justify-between items-center">
 <div>
 <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Feedback & Support</h3>
 <p className="text-xs text-emerald-900 font-bold uppercase tracking-widest opacity-70">Monitor user reports and system feedback.</p>
 </div>
 <div className="bg-white px-4 py-2 border border-slate-200 rounded-xl flex items-center gap-4">
 <button onClick={fetchFeedback} className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none hover:text-emerald-700 underline">Refresh</button>
 <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none border-l-2 border-slate-200 pl-4">Inbox: {feedback.length} items</span>
 </div>
 </div>

 {feedback.length === 0 ? (
 <div className="p-24 text-center text-slate-400 font-black uppercase tracking-widest italic">No feedback received.</div>
 ) : (
 <div className="bg-white overflow-hidden">
 {/* Desktop Table View */}
 <div className="hidden lg:block overflow-x-auto">
 <table className="min-w-full divide-y-4 divide-black">
 <thead className="bg-mint">
 <tr>
 <th className="px-6 py-4 text-left text-[10px] font-black text-slate-700 uppercase tracking-widest border-r-2 border-slate-200/10">Timestamp</th>
 <th className="px-6 py-4 text-left text-[10px] font-black text-slate-700 uppercase tracking-widest border-r-2 border-slate-200/10">Type</th>
 <th className="px-6 py-4 text-left text-[10px] font-black text-slate-700 uppercase tracking-widest border-r-2 border-slate-200/10">Classification & Content</th>
 <th className="px-6 py-4 text-left text-[10px] font-black text-slate-700 uppercase tracking-widest border-r-2 border-slate-200/10">Reporter Entity</th>
 <th className="px-6 py-4 text-left text-[10px] font-black text-slate-700 uppercase tracking-widest border-r-2 border-slate-200/10">Status</th>
 <th className="px-6 py-4 text-right text-[10px] font-black text-slate-700 uppercase tracking-widest">Process</th>
 </tr>
 </thead>
 <tbody className="divide-y-2 divide-black/5 bg-white">
 {feedback.map((item) => (
 <tr key={item.id} className="hover:bg-mint/10 transition-colors group">
 <td className="px-6 py-5 whitespace-nowrap border-r-2 border-slate-200/10">
 <div className="text-[11px] font-black text-slate-900 uppercase tracking-tighter">{new Date(item.timestamp).toLocaleDateString()}</div>
 <div className="text-[10px] font-bold text-slate-400 uppercase">{new Date(item.timestamp).toLocaleTimeString()}</div>
 </td>
 <td className="px-6 py-5 whitespace-nowrap border-r-2 border-slate-200/10">
 <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-emerald-800 uppercase tracking-widest ">
 {item.type}
 </span>
 </td>
 <td className="px-6 py-5 border-r-2 border-slate-200/10 max-w-sm">
 <div className="font-black text-sm text-slate-900 group-hover:text-emerald-700 transition-colors uppercase tracking-tight truncate">{item.subject}</div>
 <div className="text-[11px] text-slate-500 line-clamp-1 italic font-medium leading-relaxed mt-1 opacity-80">{item.details}</div>
 </td>
 <td className="px-6 py-5 whitespace-nowrap border-r-2 border-slate-200/10">
 <div className="text-xs font-black text-slate-900 uppercase tracking-tight">{item.user.name}</div>
 <div className="text-[10px] text-slate-400 font-bold">{item.user.email}</div>
 </td>
 <td className="px-6 py-5 whitespace-nowrap border-r-2 border-slate-200/10">
 <span className={`px-3 py-1 inline-flex text-[9px] font-black uppercase rounded-full border border-slate-200 ${
 item.status === 'New' ? 'bg-blue-100 text-blue-700' : 
 item.status === 'Read' ? 'bg-amber-100 text-amber-700' : 
 'bg-emerald-100 text-emerald-700'
 }`}>
 {item.status}
 </span>
 </td>
 <td className="px-6 py-5 whitespace-nowrap text-right">
 <div className="flex justify-end gap-2">
 <button 
 onClick={(e) => { e.stopPropagation(); handleDeleteFeedback(item.id); }}
 className="p-2 text-rose-500 hover:bg-rose-50 border-2 border-transparent hover:border-slate-200 rounded-xl transition-all"
 title="Flush Entry"
 >
 <Trash2 className="h-4 w-4" />
 </button>
 {item.status === 'Resolved' && item.response && (
 <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-[10px] text-emerald-900 font-medium">
 <span className="font-black">Admin Reply:</span> {item.response}
 </div>
 )}
 {item.status !== 'Resolved' && (
 <div className="flex flex-col gap-2">
 <input 
 type="text" 
 value={feedbackResponses[item.id] || ''} 
 onChange={(e) => setFeedbackResponses(prev => ({...prev, [item.id]: e.target.value}))}
 placeholder="Type response..."
 className="border border-slate-200 p-2 rounded-lg text-xs w-full"
 />
 <button 
 disabled={processingFeedbackId === item.id}
 onClick={() => handleRespondToFeedback(item.id)} 
 className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black transition-all border border-slate-200 uppercase tracking-widest disabled:opacity-50"
 >
 {processingFeedbackId === item.id ? '...' : 'Respond & Resolve'}
 </button>
 </div>
 )}
 {item.status === 'New' && (
 <button 
 disabled={processingFeedbackId === item.id}
 onClick={() => handleUpdateFeedbackStatus(item.id, 'Read')} 
 className="bg-white text-slate-700 px-4 py-2 rounded-xl text-[10px] font-black border border-slate-200 uppercase tracking-widest transition-all hover:bg-mint"
 >
 {processingFeedbackId === item.id ? '...' : 'Read'}
 </button>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {/* Mobile Feedback List */}
 <div className="lg:hidden divide-y-4 divide-black">
 {feedback.map((item) => (
 <div key={item.id} className="p-6 space-y-4 bg-white hover:bg-mint/10 transition-colors">
 <div className="flex justify-between items-start">
 <div className="space-y-1">
 <div className="flex items-center gap-2 mb-1">
 <span className="text-[8px] font-black uppercase text-emerald-800 bg-white border border-slate-200 px-2 py-0.5 rounded tracking-widest">{item.type}</span>
 <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{new Date(item.timestamp).toLocaleDateString()}</span>
 </div>
 <div className="text-sm font-black text-slate-900 uppercase tracking-tighter leading-tight">{item.subject}</div>
 </div>
 <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full border border-slate-200 ${
 item.status === 'New' ? 'bg-blue-100 text-blue-700' : 
 item.status === 'Read' ? 'bg-amber-100 text-amber-700' : 
 'bg-emerald-100 text-emerald-700'
 }`}>
 {item.status}
 </span>
 </div>
 
 <div className="text-[11px] text-slate-600 bg-mint/20 p-4 rounded-xl border border-slate-200 border-dashed italic leading-relaxed">
 "{item.details}"
 </div>
 
 <div className="flex justify-between items-center pt-2 border-t-2 border-slate-200/5">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-mint border border-slate-200 flex items-center justify-center text-sm font-black text-slate-900 uppercase ">
 {item.user.name.charAt(0)}
 </div>
 <div className="leading-none">
 <div className="text-xs font-black text-slate-900 uppercase tracking-tighter">{item.user.name}</div>
 <div className="text-[9px] text-slate-500 font-bold">{item.user.email}</div>
 </div>
 </div>
 
 <div className="flex gap-2">
 <button 
 onClick={(e) => { e.stopPropagation(); handleDeleteFeedback(item.id); }}
 disabled={processingFeedbackId === item.id}
 className="p-3 text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-slate-200 active: active:translate-x-0.5 active:translate-y-0.5 bg-white"
 >
 <Trash2 className="h-4 w-4" />
 </button>
 {item.status !== 'Resolved' && (
 <button 
 disabled={processingFeedbackId === item.id}
 onClick={() => handleUpdateFeedbackStatus(item.id, 'Resolved')} 
 className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active: active:translate-x-0.5 active:translate-y-0.5 border border-slate-200 disabled:opacity-50"
 >
 {processingFeedbackId === item.id ? '...' : 'Done'}
 </button>
 )}
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )}


 {activeTab === 'curriculumManager' && (
 <CurriculumManager currentUser={currentUser} />
 )}

 {activeTab === 'diagrams' && (
 <IllustrationEditor 
 initialPrompt=""
 initialSubject="Mathematics"
 initialTopic=""
 initialGrade="Grade 7"
 onBackToGenerator={() => setActiveTab('users')}
 />
 )}

 {activeTab === 'settings' && (
 <SystemSettingsPanel />
 )}

 {activeTab === 'backup' && (
 <AppBackupRestorePanel currentUser={currentUser} />
 )}

 {activeTab === 'systemConfig' && (
 <SystemConfigPanel />
 )}

 {isUserModalOpen && (
 <UserModal 
 key={editingUser ? editingUser.id : 'new'}
 user={editingUser} 
 onClose={() => setIsUserModalOpen(false)} 
 onSave={handleSaveUser}
 currentUser={currentUser}
 />
 )}

 {viewingHistoryUser && (
 <UserHistoryModal 
 user={viewingHistoryUser} 
 onClose={() => setViewingHistoryUser(null)} 
 />
 )}

 {createdUser && (
 <CredentialsModal 
 user={createdUser} 
 onClose={() => setCreatedUser(null)} 
 />
 )}
 </div>
 );
};


export default AdminPanel;