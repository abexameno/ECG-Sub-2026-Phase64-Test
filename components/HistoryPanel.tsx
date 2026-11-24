
import React from 'react';
import { User, UsageLog } from '../types.ts';
import { mockUsageData } from '../data/mockUsageData.ts';
import { Share2 } from 'lucide-react';

interface HistoryPanelProps {
 currentUser: User;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ currentUser }) => {
 const userHistory = mockUsageData
 .filter(log => log.userId === currentUser.id)
 .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

 return (
 <div className="space-y-6 max-w-4xl mx-auto py-8">
 <div className="flex justify-between items-center border-b border-slate-200 pb-4">
 <div>
 <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Activity History</h2>
 <p className="text-sm text-slate-500 font-medium mt-1">Timeline of your generated content</p>
 </div>
 <div className="flex items-center gap-4">
 <button className="px-4 py-2 bg-emerald-600 text-white border border-slate-200 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase hover:bg-emerald-700 transition-colors">
 <Share2 className="h-4 w-4" />
 Referral Program
 </button>
 <div className="bg-mint px-6 py-2 rounded-xl border border-slate-200 ">
 <span className="text-2xl font-black text-emerald-800">{userHistory.length}</span>
 <span className="text-[10px] text-slate-600 ml-2 uppercase font-black tracking-widest">Total</span>
 </div>
 </div>
 </div>

 {userHistory.length === 0 ? (
 <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
 <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No activities found yet.</p>
 </div>
 ) : (
 <div className="space-y-4">
 {userHistory.map((log) => (
 <div key={log.id} className="bg-white p-5 rounded-2xl border border-slate-200 flex justify-between items-center hover:bg-mint/30 transition-colors">
 <div>
 <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{log.topic || 'General Topic'}</h4>
 <div className="text-[10px] text-slate-500 mt-1 uppercase font-black tracking-widest flex gap-2">
 <span className="text-emerald-700">{log.grade}</span> • <span>{log.subject}</span> • <span className="text-slate-400">{log.contentType}</span>
 </div>
 </div>
 <div className="text-right">
 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg border border-slate-200/10">
 {new Date(log.timestamp).toLocaleDateString()}
 </span>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
};

export default HistoryPanel;
