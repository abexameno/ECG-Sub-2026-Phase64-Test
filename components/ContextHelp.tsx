import React, { useState } from 'react';
import { Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ContextHelpProps {
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const ContextHelp: React.FC<ContextHelpProps> = ({ title, content, position = 'bottom' }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block ml-1.5">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-emerald-600 transition-colors focus:outline-none"
        title="What is this?"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-[60]" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: position === 'top' ? 10 : -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: position === 'top' ? 10 : -10 }}
              className={`absolute z-[70] w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-4 pointer-events-auto ${
                position === 'bottom' ? 'top-full mt-2 left-1/2 -translate-x-1/2' :
                position === 'top' ? 'bottom-full mb-2 left-1/2 -translate-x-1/2' :
                position === 'left' ? 'right-full mr-2 top-1/2 -translate-y-1/2' :
                'left-full ml-2 top-1/2 -translate-y-1/2'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">{title}</h4>
                <button onClick={() => setIsOpen(false)}>
                  <X className="w-3 h-3 text-slate-400" />
                </button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                {content}
              </p>
              
              {/* Arrow */}
              <div className={`absolute w-3 h-3 bg-white border-l border-t border-slate-200 rotate-45 ${
                position === 'bottom' ? '-top-1.5 left-1/2 -translate-x-1/2' :
                position === 'top' ? '-bottom-1.5 left-1/2 -translate-x-1/2' :
                position === 'left' ? '-right-1.5 top-1/2 -translate-y-1/2 border-l-0 border-t-0 border-r border-b' :
                '-left-1.5 top-1/2 -translate-y-1/2'
              }`} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
