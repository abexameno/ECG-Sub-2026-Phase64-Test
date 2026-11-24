import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, School, Settings, BookOpen, CheckCircle2, ChevronRight, X } from 'lucide-react';

interface WelcomeGuideProps {
  onComplete: (dontShowAgain: boolean) => void;
  onSkip: () => void;
}

export const WelcomeGuide: React.FC<WelcomeGuideProps> = ({ onComplete, onSkip }) => {
  const [step, setStep] = useState(1);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const steps = [
    {
      id: 1,
      title: "SCHOOL",
      description: "Set up or join your school context.",
      icon: <School className="w-8 h-8 text-emerald-600" />,
      color: "bg-emerald-50"
    },
    {
      id: 2,
      title: "SETTINGS",
      description: "Choose the content type, grade, subject and term.",
      icon: <Settings className="w-8 h-8 text-purple-600" />,
      color: "bg-purple-50"
    },
    {
      id: 3,
      title: "TOPICS",
      description: "Select the curriculum topics you want to cover.",
      icon: <BookOpen className="w-8 h-8 text-blue-600" />,
      color: "bg-blue-50"
    },
    {
      id: 4,
      title: "GENERATE",
      description: "Review your settings and generate your teaching resource.",
      icon: <Sparkles className="w-8 h-8 text-amber-600" />,
      color: "bg-amber-50"
    }
  ];

  const handleNext = () => {
    if (step < steps.length) {
      setStep(step + 1);
    } else {
      onComplete(dontShowAgain);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200"
      >
        <div className="p-6 md:p-8">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#3b1464] rounded-lg flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">WELCOME TO ECG</h2>
            </div>
            <button onClick={onSkip} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <p className="text-slate-600 font-medium mb-8 leading-relaxed">
            ECG helps you prepare CBC-aligned teaching resources using your school and teaching context.
          </p>

          <div className="space-y-6 mb-8">
            <AnimatePresence mode="wait">
              <motion.div 
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex gap-4 items-start"
              >
                <div className={`p-4 rounded-2xl ${steps[step-1].color} border border-slate-100 flex-shrink-0 shadow-sm`}>
                  {steps[step-1].icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="flex items-center justify-center w-5 h-5 bg-slate-900 text-white text-[10px] font-bold rounded-full">
                      {step}
                    </span>
                    <h3 className="font-black text-slate-900 text-sm tracking-wide uppercase">
                      {steps[step-1].title}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium">
                    {steps[step-1].description}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-1.5 mb-8">
            {steps.map(s => (
              <div 
                key={s.id} 
                className={`h-1.5 rounded-full transition-all duration-300 ${s.id === step ? 'w-8 bg-[#3b1464]' : s.id < step ? 'w-4 bg-emerald-500' : 'w-4 bg-slate-200'}`}
              />
            ))}
          </div>

          <div className="space-y-4">
            <button 
              onClick={handleNext}
              className="w-full py-4 bg-[#3b1464] hover:bg-[#2e1065] text-white font-black rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-2 group shadow-lg"
            >
              <span className="tracking-widest">{step === steps.length ? 'GET STARTED' : 'CONTINUE'}</span>
              <ChevronRight className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${step === steps.length ? 'hidden' : ''}`} />
              {step === steps.length && <CheckCircle2 className="w-5 h-5" />}
            </button>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={dontShowAgain}
                    onChange={(e) => setDontShowAgain(e.target.checked)}
                  />
                  <div className={`w-5 h-5 border-2 rounded-md transition-all ${dontShowAgain ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white'}`}>
                    {dontShowAgain && <CheckCircle2 className="w-4 h-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                  </div>
                </div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-700 transition-colors">DON'T SHOW THIS AGAIN</span>
              </label>
              
              <button onClick={onSkip} className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest">
                SKIP FOR NOW
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
