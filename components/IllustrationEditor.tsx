import React, { useState, useEffect } from 'react';
import { CustomSelect } from './CustomSelect.tsx';
import { motion } from 'motion/react';
import { 
 Sparkles, 
 Save, 
 Code, 
 RefreshCw, 
 Trash2, 
 Edit2, 
 Check, 
 Download, 
 Layers, 
 BookOpen, 
 Copy, 
 Maximize2,
 Bookmark,
 ChevronRight,
 Info
} from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc, query, orderBy } from 'firebase/firestore';

interface IllustrationEditorProps {
 initialPrompt?: string;
 initialSubject?: string;
 initialTopic?: string;
 initialGrade?: string;
 onBackToGenerator?: () => void;
 onClose?: () => void;
}

interface SavedIllustration {
 id: string;
 title: string;
 subject: string;
 topic: string;
 grade: string;
 svg: string;
 prompt: string;
 createdAt: string;
}

export default function IllustrationEditor({
 initialPrompt = '',
 initialSubject = 'Mathematics',
 initialTopic = '',
 initialGrade = 'Grade 7',
 onBackToGenerator
}: IllustrationEditorProps) {
 // Input form state
 const [subject, setSubject] = useState(initialSubject);
 const [grade, setGrade] = useState(initialGrade);
 const [topic, setTopic] = useState(initialTopic);
 const [prompt, setPrompt] = useState(initialPrompt);
 
 // App states
 const [illustrationSvg, setIllustrationSvg] = useState<string>('');
 const [isLoading, setIsLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 
 // Editor mode state
 const [activeCanvasTab, setActiveCanvasTab] = useState<'preview' | 'code'>('preview');
 const [manualCode, setManualCode] = useState<string>('');
 
 // Prompt refinement adjustments state
 const [refinementPrompt, setRefinementPrompt] = useState('');
 
 // Media Bank state
 const [savedIllustrations, setSavedIllustrations] = useState<SavedIllustration[]>([]);
 const [saving, setSaving] = useState(false);
 const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
 const [savingTitle, setSavingTitle] = useState('');
 const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
 const [editingTitleValue, setEditingTitleValue] = useState('');

 // Loaded confirmation toasts
 const [toastMessage, setToastMessage] = useState<string | null>(null);

 // Quick preset templates
 const presets = [
 {
 label: 'Fraction Wedge Chart',
 subject: 'Mathematics',
 topic: 'Fractions',
 prompt: 'A circular fraction chart dividing a pie into 4 pieces, with 3 parts colored in bright mint green (#dbf7eb) and 1 part in light grey (#f1f5f9). Use a sharp dark border and a neat legend showing the fraction 3/4.'
 },
 {
 label: 'Coordinate Plane (Grid)',
 subject: 'Mathematics',
 topic: 'Geometry',
 prompt: 'A pristine grid coordinate plane showing X and Y Cartesian axes with ticks from -5 to 5. Plot a simple geometric green triangle with coordinates (1,1), (4,1), and (2,4) clearly labeled.'
 },
 {
 label: 'Circuit Diagram',
 subject: 'Science',
 topic: 'Electricity',
 prompt: 'A neat electrical circuit with a 12V DC battery connected to a resistor component (labeled R = 5 Ohms) and an open switch key, using standard schematic electrical icons and elegant blue connectors.'
 },
 {
 label: 'Plant Cell structure',
 subject: 'Science',
 topic: 'Biology',
 prompt: 'A simplified diagram of a biological Plant Cell displaying a prominent cell wall, green chloroplast organelles, and a large central vacuole with clean pointer lines and text labels of cell parts.'
 },
 {
 label: 'Chemical Distillation',
 subject: 'Science',
 topic: 'Chemistry',
 prompt: 'A simple chemical apparatus displaying a beaker filled with colorful liquid heated by a Bunsen burner flame on a tripod stand, labeled clearly with temperature scale markings.'
 }
 ];

 // Load Saved Illustrations on Mount
 useEffect(() => {
 fetchMediaBank();
 }, []);

 const fetchMediaBank = async () => {
 const user = auth.currentUser;
 if (!user) return;

 try {
 const mediaRef = collection(db, 'users', user.uid, 'illustrations');
 const q = query(mediaRef, orderBy('createdAt', 'desc'));
 const snapshot = await getDocs(q);
 const items = snapshot.docs.map(d => ({
 id: d.id,
 ...d.data()
 })) as SavedIllustration[];
 setSavedIllustrations(items);
 } catch (e: any) {
 console.warn('Error fetching media bank items:', e.message);
 }
 };

 const showToast = (msg: string) => {
 setToastMessage(msg);
 setTimeout(() => setToastMessage(null), 3000);
 };

 const handleApplyPreset = (preset: typeof presets[0]) => {
 setSubject(preset.subject);
 setTopic(preset.topic);
 setPrompt(preset.prompt);
 showToast(`Preset "${preset.label}" loaded!`);
 };

 // Safe SVG rendering guard (cleanup outer wrappers/markers/notes)
 const sanitizeSvg = (rawSvg: string): string => {
 let clean = rawSvg.trim();
 // Strip possible markdown ticks codeblocks like ```xml or ```svg
 if (clean.startsWith('```')) {
 clean = clean.replace(/^```[a-zA-Z]*\n/, '');
 if (clean.endsWith('```')) {
 clean = clean.slice(0, -3);
 }
 }
 clean = clean.trim();
 
 // Ensure SVG xmlns and correct markup are preserved
 if (!clean.includes('<svg')) {
 // Create fallback outer box wrapper if needed
 clean = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">${clean}</svg>`;
 }
 return clean;
 };

 // Generate pipeline caller
 const handleGenerateIllustration = async (customPrompt?: string) => {
 const promptText = customPrompt || prompt;
 if (!promptText.trim()) {
 setError('Please provide a description of the diagram you wish to generate.');
 return;
 }

 setIsLoading(true);
 setError(null);
 setIllustrationSvg('');

 try {
 const user = auth.currentUser;
 if (!user) {
 throw new Error('Authentication token required. Please sign in again.');
 }
 
 const token = await user.getIdToken();

 const response = await fetch('/api/illustrations/generate', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${token}`
 },
 body: JSON.stringify({
 prompt: promptText,
 subject,
 topic,
 grade
 })
 });

 if (!response.ok) {
 let errorData;
 try {
 const text = await response.text();
 errorData = JSON.parse(text);
 } catch {
 errorData = { details: 'Server connection timeout or invalid response.' };
 }
 throw new Error(errorData.details || errorData.error || 'Server error occurred during SVG generation pipeline.');
 }

 let data;
 try {
 const text = await response.text();
 data = JSON.parse(text);
 } catch (e) {
 throw new Error('Invalid JSON received from API. Server may be unreachable.');
 }
 
 if (data && data.illustration_svg) {
 const cleanSvg = sanitizeSvg(data.illustration_svg);
 setIllustrationSvg(cleanSvg);
 setManualCode(cleanSvg);
 setSavingTitle(`${topic || 'CBC'} Diagram`);
 showToast('Vector diagram generated successfully!');
 } else {
 throw new Error('Invalid instruction format received from generator workspace.');
 }
 } catch (e: any) {
 console.error('[Diagram Generation Failure]:', e);
 setError(e.message || 'An unexpected error occurred during generation. Please try again.');
 } finally {
 setIsLoading(false);
 }
 };

 // Fine-tuning refinement prompt handler
 const handleApplyRefinement = async () => {
 if (!refinementPrompt.trim()) return;
 if (!illustrationSvg) {
 setError('Please generate a base diagram first before requesting micro-adjustments.');
 return;
 }

 const modifiedPrompt = `You must make modifications to the existing SVG below. 
 CURRENT SVG:
 ${illustrationSvg}
 
 USER REQUESTED MODIFICATIONS:
 ${refinementPrompt}
 
 Incorporate the modified elements precisely. Keep the exact viewBox "0 0 400 300", ensure nice color styling and clear pointer labels styled nicely. Return only the updated SVG.`;

 setRefinementPrompt('');
 await handleGenerateIllustration(modifiedPrompt);
 };

 // Edit SVG Manual Code Apply
 const handleApplyManualCode = () => {
 try {
 const sanitized = sanitizeSvg(manualCode);
 setIllustrationSvg(sanitized);
 setManualCode(sanitized);
 showToast('Manual SVG edits applied to preview!');
 setActiveCanvasTab('preview');
 } catch (err: any) {
 setError(`XML Parsing issue: ${err.message}`);
 }
 };

 // Save to Media Bank (Firestore)
 const handleSaveToMediaBank = async () => {
 if (!illustrationSvg) {
 showToast('Cannot save an empty canvas!');
 return;
 }
 const user = auth.currentUser;
 if (!user) {
 showToast('You must be authenticated to save to media bank.');
 return;
 }

 setSaving(true);
 const finalTitle = savingTitle.trim() || `${topic || 'CBC'} Diagram`;

 try {
 const mediaRef = collection(db, 'users', user.uid, 'illustrations');
 const docId = activeMediaId || `ill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
 const docRef = doc(mediaRef, docId);

 const savedData: SavedIllustration = {
 id: docId,
 title: finalTitle,
 subject,
 topic: topic || 'General',
 grade,
 svg: illustrationSvg,
 prompt: prompt || 'Created via Studio',
 createdAt: new Date().toISOString()
 };

 await setDoc(docRef, savedData, { merge: true });
 showToast('Saved to your Question Media Bank!');
 setActiveMediaId(docId);
 fetchMediaBank();
 } catch (e: any) {
 console.error('Firestore save failed:', e);
 setError(`Failed to save: ${e.message}`);
 } finally {
 setSaving(false);
 }
 };

 // Load saved item from media library
 const handleLoadSavedItem = (item: SavedIllustration) => {
 setIllustrationSvg(item.svg);
 setManualCode(item.svg);
 setSubject(item.subject);
 setTopic(item.topic);
 setGrade(item.grade);
 setSavingTitle(item.title);
 setPrompt(item.prompt);
 setActiveMediaId(item.id);
 showToast(`Loaded "${item.title}" successfully.`);
 };

 // Delete from Media Bank
 const handleDeleteSavedItem = async (id: string, e: React.MouseEvent) => {
 e.stopPropagation();
 if (!window.confirm('Are you absolutely sure you want to delete this vector diagram?')) return;

 const user = auth.currentUser;
 if (!user) return;

 try {
 await deleteDoc(doc(db, 'users', user.uid, 'illustrations', id));
 if (activeMediaId === id) {
 setActiveMediaId(null);
 setIllustrationSvg('');
 setManualCode('');
 }
 showToast('Diagram removed from Media Bank.');
 fetchMediaBank();
 } catch (err: any) {
 console.error('Delete illustration failed:', err);
 }
 };

 // Inline rename saved item title
 const handleRenameSavedItem = async (id: string, titleName: string) => {
 const user = auth.currentUser;
 if (!user) return;

 try {
 const docRef = doc(db, 'users', user.uid, 'illustrations', id);
 await updateDoc(docRef, { title: titleName });
 setEditingTitleId(null);
 fetchMediaBank();
 showToast('Diagram renamed successfully.');
 } catch (err: any) {
 console.error('Rename failed:', err);
 }
 };

 // Copy SVG Code Utility
 const handleCopyCode = () => {
 navigator.clipboard.writeText(illustrationSvg);
 showToast('SVG XML Markup code copied to clipboard!');
 };

 // Download SVG file
 const handleDownloadFile = () => {
 const blob = new Blob([illustrationSvg], { type: 'image/svg+xml;charset=utf-8' });
 const blobUrl = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = blobUrl;
 link.download = `${savingTitle.toLowerCase().replace(/\s+/g, '_') || 'cbc_diagram'}.svg`;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 URL.revokeObjectURL(blobUrl);
 showToast('SVG file downloaded to your device!');
 };

 return (
 <div className="bg-white border border-slate-200 rounded-2xl p-6 min-h-[600px] animate-fade-in relative">
 {/* Toast message indicator */}
 {toastMessage && (
 <div className="absolute top-4 right-4 z-50 bg-slate-900 border border-slate-200 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 animate-bounce">
 <Check className="w-4 h-4 text-emerald-400" />
 {toastMessage}
 </div>
 )}

 {/* Header Panel */}
 <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4 mb-6">
 <div>
 <div className="flex items-center gap-2 text-emerald-800 font-black text-xs uppercase tracking-widest mb-1">
 <Layers className="w-4 h-4" />
 <span>KICD-CBE Visuals Workspace</span>
 </div>
 <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Automated Diagram & SVG Studio</h1>
 </div>
 {onBackToGenerator && (
 <button 
 onClick={onBackToGenerator}
 className="mt-3 md:mt-0 px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-black uppercase tracking-widest transition"
 >
 ← Back to Generator
 </button>
 )}
 </div>

 {/* Workspace Outer layout */}
 <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
 
 {/* Left Column Controls - span 5 */}
 <div className="xl:col-span-5 space-y-6">
 
 <div className="border border-slate-200 p-4 rounded-2xl bg-mint/40 space-y-4">
 <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
 <BookOpen className="w-4 h-4 text-slate-700" />
 1. Curriculum Parameters
 </h3>
 
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Subject</label>
 <CustomSelect
 options={["Mathematics", "Science", "Agriculture", "Biology", "Chemistry", "Physics"]}
 value={subject}
 onChange={val => setSubject(val)}
 variant="default"
 placeholder="Select Subject"
 />
 </div>

 <div>
 <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Grade Level</label>
 <CustomSelect
 options={Array.from({ length: 10 }, (_, i) => `Grade ${i + 1}`)}
 value={grade}
 onChange={val => setGrade(val)}
 variant="default"
 placeholder="Select Grade"
 />
 </div>
 </div>

 <div>
 <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Topic / Sub-Strand</label>
 <input 
 type="text" 
 value={topic} 
 onChange={e => setTopic(e.target.value)}
 placeholder="e.g. Chemical Apparatus, Angles, Circuits"
 className="w-full bg-white p-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none"
 />
 </div>

 <div>
 <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Detailed Vector Description (Prompt)</label>
 <textarea 
 value={prompt}
 onChange={e => setPrompt(e.target.value)}
 placeholder="e.g. Draw a green right-angled triangle with side dimensions labeled 3cm, 4cm, 5cm."
 rows={3}
 className="w-full bg-white p-3 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-700 "
 />
 </div>

 <button
 onClick={() => handleGenerateIllustration()}
 className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white border border-slate-200 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50"
 disabled={isLoading || !prompt.trim()}
 >
 {isLoading ? (
 <>
 <RefreshCw className="w-4 h-4 animate-spin" />
 Generating Vector SVG...
 </>
 ) : (
 <>
 <Sparkles className="w-4 h-4 text-amber-300" />
 Generate Dynamic Diagram
 </>
 )}
 </button>
 </div>

 {/* Quick presets list */}
 <div className="border border-slate-200 p-4 rounded-2xl bg-white space-y-3">
 <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-200/10">
 <Layers className="w-4 h-4 text-slate-600" />
 Teacher Diagram Presets
 </h3>
 <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto no-scrollbar">
 {presets.map((p, idx) => (
 <button
 key={idx}
 onClick={() => handleApplyPreset(p)}
 className="text-left w-full p-2.5 rounded-lg border border-slate-200/10 hover:border-slate-200 bg-slate-50 hover:bg-mint/45 text-xs transition flex justify-between items-center group font-medium text-slate-700"
 >
 <span>{p.label}</span>
 <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition" />
 </button>
 ))}
 </div>
 </div>

 {/* Prompt micro-adjustments refinement */}
 {illustrationSvg && (
 <div className="border border-slate-200 p-4 rounded-2xl bg-slate-50 space-y-3">
 <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
 <RefreshCw className="w-4 h-4 text-emerald-800" />
 Micro-Adjustments & Regeneration
 </h3>
 <p className="text-[10px] text-slate-600 leading-tight">
 Refine the diagram interactively (e.g., "color the triangle blue and scale it", "add a title label at the top", "increase text font weight").
 </p>
 <div className="flex gap-2">
 <textarea
 value={refinementPrompt}
 onChange={e => setRefinementPrompt(e.target.value)}
 placeholder="e.g. Color the pieces blue instead of green"
 rows={2}
 className="flex-grow p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none"
 />
 <button
 onClick={handleApplyRefinement}
 disabled={isLoading || !refinementPrompt.trim()}
 className="px-4 bg-slate-900 border border-slate-200 text-white text-xs hover:bg-slate-800 rounded-xl transition flex flex-col justify-center items-center font-black uppercase tracking-wider disabled:opacity-40"
 >
 Refine
 </button>
 </div>
 </div>
 )}

 </div>

 {/* Right Column: Micro-Canvas Viewport - span 7 */}
 <div className="xl:col-span-7 space-y-6">
 
 <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-950 flex flex-col min-h-[460px]">
 {/* Tab header */}
 <div className="bg-slate-900 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
 <div className="flex gap-2">
 <button
 onClick={() => setActiveCanvasTab('preview')}
 className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeCanvasTab === 'preview' ? 'bg-slate-800 text-emerald-400 border border-emerald-900/30' : 'text-slate-400 hover:text-slate-200'}`}
 >
 Visual Canvas
 </button>
 <button
 onClick={() => {
 setActiveCanvasTab('code');
 if (illustrationSvg && !manualCode) setManualCode(illustrationSvg);
 }}
 className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeCanvasTab === 'code' ? 'bg-slate-800 text-emerald-400 border border-emerald-900/30' : 'text-slate-400 hover:text-slate-200'}`}
 >
 <span className="flex items-center gap-1">
 <Code className="w-3.5 h-3.5" />
 SVG Code manually
 </span>
 </button>
 </div>

 {illustrationSvg && (
 <div className="flex gap-2">
 <button
 onClick={handleCopyCode}
 className="p-1.5 bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg border border-slate-200/20 hover:border-slate-200/50 transition"
 title="Copy SVG Code"
 >
 <Copy className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={handleDownloadFile}
 className="p-1.5 bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg border border-slate-200/20 hover:border-slate-200/50 transition"
 title="Download SVG"
 >
 <Download className="w-3.5 h-3.5" />
 </button>
 </div>
 )}
 </div>

 {/* Error state */}
 {error && (
 <div className="m-4 p-4 bg-rose-950/45 border-l-4 border-rose-500 rounded-lg text-rose-300 text-xs">
 <h4 className="font-bold uppercase tracking-wide mb-1">Canvas Renderer Issue</h4>
 <p>{error}</p>
 </div>
 )}

 {/* Canvas Body container */}
 <div className="flex-grow flex items-center justify-center p-6 relative bg-slate-900 min-h-[300px]">
 
 {/* Skeleton loading animation while generating */}
 {isLoading && (
 <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/90 gap-4">
 {/* Custom geometry skeleton animation */}
 <svg className="w-48 h-36 opacity-75 animate-pulse text-emerald-500/25" viewBox="0 0 200 150">
 <rect x="10" y="10" width="180" height="130" rx="4" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
 <circle cx="50" cy="75" r="25" fill="none" stroke="currentColor" strokeWidth="2" />
 <polygon points="120,40 170,110 100,110" fill="none" stroke="currentColor" strokeWidth="2" />
 <line x1="10" y1="120" x2="190" y2="120" stroke="currentColor" strokeWidth="1.5" />
 </svg>
 <span className="text-xs font-black uppercase text-emerald-400 tracking-widest animate-pulse">
 Rendering High-Contrast Vector...
 </span>
 </div>
 )}

 {activeCanvasTab === 'preview' ? (
 illustrationSvg ? (
 <div 
 className="w-full max-w-[400px] aspect-[4/3] bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-center overflow-hidden inline-svg-viewport"
 dangerouslySetInnerHTML={{ __html: illustrationSvg }}
 />
 ) : (
 <div className="text-center text-slate-500 max-w-sm flex flex-col items-center gap-3">
 <div className="bg-slate-800 p-4 rounded-full border border-slate-200">
 <Sparkles className="w-8 h-8 text-slate-600" />
 </div>
 <p className="text-xs font-black uppercase tracking-widest text-slate-400">Canvas Is Empty</p>
 <p className="text-[11px] text-slate-500">Configure parameters on the left and draw curriculum-aligned vector diagrams instantly.</p>
 </div>
 )
 ) : (
 /* Raw manual editing workspace */
 <div className="w-full h-full flex flex-col gap-3 min-h-[350px]">
 <textarea
 value={manualCode}
 onChange={e => setManualCode(e.target.value)}
 className="w-full flex-grow p-4 bg-slate-950 font-mono text-[11px] text-emerald-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-700 border border-slate-200 h-[280px]"
 placeholder="Provide raw manual xml svg markup code and edit directly..."
 />
 <div className="flex justify-end gap-2">
 <button
 onClick={handleApplyManualCode}
 className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 border border-slate-200 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition"
 >
 Apply Manual Code Changes
 </button>
 </div>
 </div>
 )}
 </div>

 {/* Save Controls & Name field */}
 {illustrationSvg && (
 <div className="bg-slate-900 border-t border-slate-200 p-4 flex flex-col sm:flex-row gap-3 items-center">
 <div className="w-full sm:flex-grow">
 <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Diagram File Title</label>
 <input 
 type="text" 
 value={savingTitle} 
 onChange={e => setSavingTitle(e.target.value)}
 placeholder="e.g. Plants Cell Structure, Trigonometry triangle"
 className="w-full bg-slate-800 p-2 rounded-xl text-white text-xs font-bold border border-slate-200/30 focus:outline-none focus:border-emerald-500"
 />
 </div>
 <div className="w-full sm:w-auto shrink-0 self-end">
 <button
 onClick={handleSaveToMediaBank}
 disabled={saving}
 className="w-full px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 border border-slate-200 text-white text-xs font-black uppercase tracking-widest rounded-xl transition flex items-center justify-center gap-1.5"
 >
 <Save className="w-4 h-4" />
 {saving ? 'Saving...' : 'Save to Question Media Bank'}
 </button>
 </div>
 </div>
 )}
 </div>

 {/* Persistent Question Media Bank section */}
 <div className="border border-slate-200 rounded-2xl bg-white p-6 space-y-4">
 <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
 <Bookmark className="w-4 h-4 text-emerald-800" />
 Your Saved Question Media Bank ({savedIllustrations.length})
 </h3>
 
 {savedIllustrations.length === 0 ? (
 <div className="text-center p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-500">
 <Info className="w-6 h-6 mx-auto mb-2 text-slate-400" />
 <p className="text-xs font-bold">No saved diagrams found in your Media Bank.</p>
 <p className="text-[10px] text-slate-400 mt-1">Generated models can be saved permanently for future textbook materials or syllabus exams.</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[300px] overflow-y-auto no-scrollbar">
 {savedIllustrations.map(item => (
 <div 
 key={item.id} 
 onClick={() => handleLoadSavedItem(item)}
 className={`cursor-pointer rounded-xl border p-3 hover:border-slate-200 transition bg-slate-50 relative group ${activeMediaId === item.id ? 'border-emerald-600 ring-2 ring-emerald-600/30' : 'border-slate-200/10 hover:border-slate-200'}`}
 >
 {/* Tiny visual thumbnail */}
 <div className="aspect-[4/3] w-full bg-white rounded border border-slate-200/5 mb-2 overflow-hidden flex items-center justify-center p-1">
 <div 
 className="w-full h-full flex items-center justify-center pointer-events-none svg-thumbnail-container"
 dangerouslySetInnerHTML={{ __html: item.svg }}
 />
 </div>

 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
 {item.subject} • {item.grade}
 </div>

 {editingTitleId === item.id ? (
 <input
 type="text"
 value={editingTitleValue}
 onChange={e => setEditingTitleValue(e.target.value)}
 onBlur={() => handleRenameSavedItem(item.id, editingTitleValue)}
 onKeyDown={e => {
 if (e.key === 'Enter') handleRenameSavedItem(item.id, editingTitleValue);
 else if (e.key === 'Escape') setEditingTitleId(null);
 }}
 autoFocus
 onClick={e => e.stopPropagation()}
 className="w-full bg-white p-1 border border-slate-200 rounded text-[11px] font-bold"
 />
 ) : (
 <div className="font-bold text-[11px] text-slate-800 truncate flex items-center justify-between">
 <span className="truncate">{item.title}</span>
 <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-slate-50 pl-1">
 <button
 onClick={(e) => {
 e.stopPropagation();
 setEditingTitleId(item.id);
 setEditingTitleValue(item.title);
 }}
 className="p-1 hover:bg-slate-200 rounded text-slate-600"
 title="Rename Diagram"
 >
 <Edit2 className="w-3 h-3" />
 </button>
 <button
 onClick={(e) => handleDeleteSavedItem(item.id, e)}
 className="p-1 hover:bg-rose-100 rounded text-rose-600"
 title="Delete Diagram"
 >
 <Trash2 className="w-3 h-3" />
 </button>
 </div>
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </div>

 </div>

 </div>

 </div>
 );
}
