import React, { useState } from 'react';
import { User } from '../types.ts';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebaseUtils';
import CustomSelect from './CustomSelect.tsx';

interface FeedbackPanelProps {
 currentUser: User | null;
}

const feedbackOptions = [
 'Bug Report',
 'Feature Suggestion',
 'General Comment',
 'Usability Issue',
 'API Key Error',
 'Generation Issue'
];

const FeedbackPanel: React.FC<FeedbackPanelProps> = ({ currentUser }) => {
 const [feedbackType, setFeedbackType] = useState('Bug Report');
 const [subject, setSubject] = useState('');
 const [details, setDetails] = useState('');
 const [suggestedFix, setSuggestedFix] = useState('');
 const [email, setEmail] = useState(currentUser?.email || '');
 const [isSubmitted, setIsSubmitted] = useState(false);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!subject.trim() || !details.trim()) {
 alert('Please fill in both the subject and details.');
 return;
 }

 const newFeedback = {
 type: feedbackType,
 subject,
 details,
 suggestedFix,
 user: currentUser ? { name: currentUser.name, email: currentUser.email || email } : { name: 'Anonymous', email },
 timestamp: new Date().toISOString(),
 status: 'New'
 };

 try {
 const feedbackRef = collection(db, 'feedback');
 await addDoc(feedbackRef, newFeedback);
 setIsSubmitted(true);
 } catch (error) {
 handleFirestoreError(error, OperationType.CREATE, 'feedback');
 alert("Sorry, there was an error saving your feedback.");
 }

 // Reset form after a delay
 setTimeout(() => {
 setIsSubmitted(false);
 setSubject('');
 setDetails('');
 }, 5000);
 };

 return (
 <div className="bg-white p-8 rounded-2xl border border-slate-200 max-w-2xl mx-auto animate-fade-in">
 <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Submit Feedback</h2>
 <p className="text-sm text-slate-500 mb-6 font-medium">
 We appreciate your input! Whether you've found a bug or have a great idea for a new feature, let us know.
 </p>

 {isSubmitted ? (
 <div className="text-center p-8 bg-mint border border-slate-200 rounded-xl">
 <h3 className="text-xl font-black text-emerald-800 uppercase tracking-tight">Thank You!</h3>
 <p className="text-slate-700 mt-2 font-medium">Your feedback has been submitted successfully.</p>
 </div>
 ) : (
 <form onSubmit={handleSubmit} className="space-y-6">
 <div>
 <CustomSelect
 options={feedbackOptions}
 value={feedbackType}
 onChange={(val) => setFeedbackType(val)}
 label="Feedback Type"
 variant="neo"
 />
 </div>

 <div>
 <label htmlFor="subject" className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1">Subject</label>
 <input
 type="text"
 id="subject"
 name="subject"
 value={subject}
 onChange={(e) => setSubject(e.target.value)}
 required
 className="mt-1 block w-full text-sm bg-white border border-slate-200 text-slate-900 rounded-xl p-3 focus:outline-none font-medium"
 placeholder="e.g., 'Image export fails for PDF'"
 />
 </div>

 <div>
 <label htmlFor="details" className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1">Details</label>
 <textarea
 id="details"
 name="details"
 value={details}
 onChange={(e) => setDetails(e.target.value)}
 required
 rows={6}
 className="mt-1 block w-full text-sm bg-white border border-slate-200 text-slate-900 rounded-xl p-3 focus:outline-none font-medium"
 placeholder="Please provide as much detail as possible. If reporting a bug, include the steps to reproduce it."
 />
 </div>
 
 <div>
 <label htmlFor="suggestedFix" className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1">Suggested Fix (Optional)</label>
 <textarea
 id="suggestedFix"
 name="suggestedFix"
 value={suggestedFix}
 onChange={(e) => setSuggestedFix(e.target.value)}
 rows={3}
 className="mt-1 block w-full text-sm bg-white border border-slate-200 text-slate-900 rounded-xl p-3 focus:outline-none font-medium"
 placeholder="Do you have an idea on how to fix this?"
 />
 </div>
 
 <div>
 <label htmlFor="email" className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1">Your Email (Optional)</label>
 <input
 type="email"
 id="email"
 name="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 className="mt-1 block w-full text-sm bg-white border border-slate-200 text-slate-900 rounded-xl p-3 focus:outline-none font-medium"
 placeholder="So we can follow up with you"
 />
 </div>

 <div className="text-right">
 <button
 type="submit"
 className="inline-flex justify-center py-3 px-8 border border-slate-200 text-sm font-black rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 uppercase tracking-widest transition-all"
 >
 Submit Feedback
 </button>
 </div>
 </form>
 )}
 </div>
 );
};

export default FeedbackPanel;