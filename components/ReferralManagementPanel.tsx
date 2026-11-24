
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Referral } from '../types';

const ReferralManagementPanel: React.FC = () => {
 const [referrals, setReferrals] = useState<Referral[]>([]);

 useEffect(() => {
 const unsubscribe = onSnapshot(collection(db, 'referrals'), (snapshot) => {
  const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Referral));
  setReferrals(data);
 }, (error) => {
  console.error("ReferralManagementPanel onSnapshot error:", error);
 });
 return () => unsubscribe();
 }, []);

 return (
 <div className="bg-white border border-slate-200 rounded-2xl p-6">
  <h3 className="text-xl font-black text-slate-900 mb-4">Manage Referrals</h3>
  <table className="min-w-full divide-y-2 divide-black/10">
  <thead className="bg-mint">
   <tr>
   <th className="px-4 py-3 text-left text-[10px] font-bold">Referral ID</th>
   <th className="px-4 py-3 text-left text-[10px] font-bold">Inviter</th>
   <th className="px-4 py-3 text-left text-[10px] font-bold">Invitee Email</th>
   <th className="px-4 py-3 text-left text-[10px] font-bold">Status</th>
   </tr>
  </thead>
  <tbody className="divide-y divide-black/10">
   {referrals.map(ref => (
   <tr key={ref.id}>
    <td className="px-4 py-3 text-xs font-mono">{ref.id}</td>
    <td className="px-4 py-3 text-xs font-bold">{ref.inviterId}</td>
    <td className="px-4 py-3 text-xs font-bold">{ref.inviteeEmail}</td>
    <td className="px-4 py-3 text-xs font-bold">
    <span className={`px-2 py-1 rounded-full ${ref.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
     {ref.status}
    </span>
    </td>
   </tr>
   ))}
  </tbody>
  </table>
 </div>
 );
};

export default ReferralManagementPanel;
