import React, { useState } from 'react';
import { User } from '../types.ts';
import HelpGuide from './HelpGuide';
import FeedbackPanel from './FeedbackPanel';
import { HelpCircle, MessageSquare, ChevronRight } from 'lucide-react';

interface SupportFeedbackPanelProps {
  currentUser: User | null;
}

const SupportFeedbackPanel: React.FC<SupportFeedbackPanelProps> = ({ currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'help' | 'feedback'>('help');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveSubTab('help')}
            className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeSubTab === 'help'
                ? 'bg-purple-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Help Guide</span>
          </button>
          <button
            onClick={() => setActiveSubTab('feedback')}
            className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeSubTab === 'feedback'
                ? 'bg-purple-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Contact & Feedback</span>
          </button>
        </div>

        <div className="p-4 sm:p-8 bg-slate-50">
          {activeSubTab === 'help' ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <HelpGuide />
              
              <div className="mt-8 p-6 bg-white border border-slate-200 rounded-2xl text-center space-y-4">
                <h3 className="text-lg font-black text-slate-900 uppercase">Still need help?</h3>
                <p className="text-sm text-slate-600 font-medium">
                  Can't find what you're looking for? Reach out to our support team directly.
                </p>
                <button
                  onClick={() => setActiveSubTab('feedback')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#3b1464] text-white text-xs font-black rounded-xl border border-slate-200 uppercase tracking-widest hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                >
                  Send a Message
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <FeedbackPanel currentUser={currentUser} />
              
              <div className="mt-8 p-6 bg-[#3b1464] border border-slate-200 rounded-2xl text-white space-y-4">
                <h3 className="text-lg font-black uppercase tracking-tight">Technical Support</h3>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <p className="text-sm text-purple-100 font-medium max-w-md">
                    For urgent account or payment issues, you can also contact our administrator directly on WhatsApp.
                  </p>
                  <a
                    href="https://wa.me/254717713493"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-[#3b1464] text-xs font-black rounded-xl border border-slate-200 uppercase tracking-widest hover:bg-slate-50 transition-all"
                  >
                    WhatsApp Support
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="text-center py-4">
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">
          Exameno CBE Content Generator • Support Center
        </p>
      </div>
    </div>
  );
};

export default SupportFeedbackPanel;
