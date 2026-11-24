import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebaseUtils';

interface SentEmail {
 id: string;
 email: string;
 subject: string;
 type: string;
 sentAt: any;
}

const formatName = (email: string) => {
 const namePart = email.split('@')[0];
 return namePart.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export const EmailHistoryPanel: React.FC = () => {
 const [emails, setEmails] = useState<SentEmail[]>([]);
 const [error, setError] = useState<string | null>(null);

 useEffect(() => {
 const q = query(collection(db, 'sent_emails'), orderBy('sentAt', 'desc'));
 const unsubscribe = onSnapshot(q, (snapshot) => {
 const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SentEmail));
 setEmails(data);
 setError(null);
 }, (err) => {
 console.warn("Email history listener failed:", err);
 setError("Unable to sync email history. Admin permissions required.");
 // Log details using our global utility
 try {
 handleFirestoreError(err, OperationType.LIST, 'sent_emails');
 } catch (e) {
 // Prevent uncaught bubbling in snapshot
 }
 });
 return () => unsubscribe();
 }, []);

 return (
 <div className="bg-white p-8 border border-slate-200 rounded-2xl ">
 <h2 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-widest">Sent Email Notifications</h2>
 {error ? (
 <p className="text-xs text-red-500 font-bold uppercase">{error}</p>
 ) : (
 <div className="overflow-x-auto">
 <table className="min-w-full divide-y divide-black/10">
 <thead className="bg-mint">
 <tr>
 <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700">Timestamp</th>
 <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700">Recipient</th>
 <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700">Subject</th>
 <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700">Type</th>
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-black/10">
 {emails.map(email => (
 <tr key={email.id}>
 <td className="px-6 py-4 text-xs font-bold">{email.sentAt?.toDate().toLocaleString()}</td>
 <td className="px-6 py-4 text-xs font-bold">{formatName(email.email)}</td>
 <td className="px-6 py-4 text-xs font-bold truncate max-w-[200px]">{email.subject}</td>
 <td className="px-6 py-4 text-xs font-bold uppercase">{email.type}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 );
};
