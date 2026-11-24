
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { User, Referral } from '../types';
import { Copy, Share2, Mail, MessageSquare } from 'lucide-react';

interface ReferralHubProps {
 currentUser: User | null;
}

const ReferralHub: React.FC<ReferralHubProps> = ({ currentUser }) => {
 const [referrals, setReferrals] = useState<Referral[]>([]);
 const [referralLink, setReferralLink] = useState('');

 useEffect(() => {
 if (!currentUser) return;
 setReferralLink(`${window.location.origin}/signup?ref=${currentUser.id}`);

 const q = query(collection(db, 'referrals'), where('inviterId', '==', currentUser.id));
 const unsubscribe = onSnapshot(q, (snapshot) => {
  const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Referral));
  setReferrals(data);
 }, (error) => {
  console.error("ReferralHub onSnapshot error:", error);
 });
 return () => unsubscribe();
 }, [currentUser]);

 const shareLink = (method: 'email' | 'whatsapp') => {
 const text = `Join Exameno and master CBC content creation! Use my link: ${referralLink}`;
 if (method === 'email') {
  window.location.href = `mailto:?subject=Join Exameno!&body=${encodeURIComponent(text)}`;
 } else {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
 }
 };

 const successfulReferrals = referrals.filter(ref => ref.status === 'completed').length;
 const earnedCredits = successfulReferrals * 10;

 return (
 <div className="space-y-6">
  <div className="grid grid-cols-2 gap-4">
  <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-center items-center">
   <span className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Total Successful</span>
   <span className="text-4xl font-black text-emerald-600">{successfulReferrals}</span>
  </div>
  <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-center items-center">
   <span className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Earned Credits</span>
   <span className="text-4xl font-black text-emerald-600">{earnedCredits}</span>
  </div>
  </div>

  <div className="bg-emerald-50 border-2 border-emerald-500 p-6 rounded-2xl">
  <h3 className="text-xl font-black text-emerald-900 mb-2">Invite Teachers & Earn Credits</h3>
  <p className="text-sm font-bold text-emerald-800 mb-6">Invite other teachers to join Exameno. For every teacher who signs up, both of you receive 10 free credits!</p>
  
  <div className="flex gap-2">
   <input type="text" value={referralLink} readOnly className="flex-1 p-3 rounded-lg border border-slate-200 font-mono text-xs" />
   <button onClick={() => navigator.clipboard.writeText(referralLink)} className="p-3 bg-black text-white rounded-lg"><Copy size={18} /></button>
  </div>
  <div className="flex gap-4 mt-4 flex-wrap">
   <button onClick={() => {
   if (navigator.share) {
    navigator.share({
    title: 'Join Exameno',
    text: 'Join Exameno and master CBC content creation!',
    url: referralLink
    }).catch(console.error);
   } else {
    navigator.clipboard.writeText(referralLink);
    alert("Link copied to clipboard!");
   }
   }} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs"><Share2 size={16} /> Share Link</button>
   <button onClick={() => shareLink('email')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs"><Mail size={16} /> Share via Email</button>
   <button onClick={() => shareLink('whatsapp')} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-bold text-xs"><MessageSquare size={16} /> Share via WhatsApp</button>
  </div>
  </div>

  <div className="bg-white border border-slate-200 rounded-2xl p-6">
  <h4 className="text-lg font-black text-slate-900 mb-4">Your Referrals</h4>
  <div className="space-y-2">
   {referrals.map(ref => {
   const dateObj = ref.completedAt || ref.createdAt;
   const dateStr = dateObj ? (typeof dateObj === 'object' && 'toDate' in dateObj ? (dateObj as any).toDate().toLocaleDateString() : new Date(dateObj as string).toLocaleDateString()) : 'Unknown date';
   
   return (
    <div key={ref.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200/10">
    <div className="flex flex-col">
     <span className="text-sm font-bold text-slate-800">{ref.inviteeEmail}</span>
     <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
     {ref.status === 'completed' ? 'Joined on ' : 'Invited on '}
     {dateStr}
     </span>
    </div>
    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${ref.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
     {ref.status}
    </span>
    </div>
   );
   })}
   {referrals.length === 0 && <p className="text-xs font-bold text-slate-400">No referrals yet.</p>}
  </div>
  </div>
 </div>
 );
};

export default ReferralHub;
