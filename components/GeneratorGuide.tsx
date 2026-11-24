import React from 'react';
import { FileText, GraduationCap, Calendar, Sparkles, ArrowRight } from 'lucide-react';

export const GeneratorGuide: React.FC = () => {
  const steps = [
    {
      number: '1',
      title: 'CONTENT TYPE',
      desc: 'Choose what you want to create.',
      icon: <FileText className="w-4 h-4 text-purple-900" aria-hidden="true" />,
      accentColor: 'border-purple-200 bg-purple-50/60',
    },
    {
      number: '2',
      title: 'CLASS & TERM',
      desc: 'Select grade, subject and academic term.',
      icon: <GraduationCap className="w-4 h-4 text-purple-900" aria-hidden="true" />,
      accentColor: 'border-purple-200 bg-purple-50/60',
    },
    {
      number: '3',
      title: 'SCHEDULE & TOPICS',
      desc: 'Configure teaching weeks and lessons per week where applicable, then select curriculum topics.',
      icon: <Calendar className="w-4 h-4 text-purple-900" aria-hidden="true" />,
      accentColor: 'border-purple-200 bg-purple-50/60',
    },
    {
      number: '4',
      title: 'GENERATE',
      desc: 'Create and review your resource.',
      icon: <Sparkles className="w-4 h-4 text-emerald-700" aria-hidden="true" />,
      accentColor: 'border-emerald-200 bg-emerald-50/60',
    },
  ];

  return (
    <div 
      id="generator-get-started-card"
      className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 mb-5 shadow-xs relative overflow-hidden"
    >
      <div className="mb-3 sm:mb-4">
        <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#3b1464]" />
          GET STARTED
        </h2>
        <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
          Choose your content type, grade, subject and academic term. Configure your school schedule, select curriculum topics, then generate your resource.
        </p>
      </div>

      {/* 4-Step Workflow with Desktop Connectors and Mobile Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-3.5 relative">
        {steps.map((step, idx) => (
          <div key={step.title} className="relative flex items-center">
            <div className={`w-full rounded-xl border p-2.5 sm:p-3 ${step.accentColor} transition-all`}>
              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                <span className="w-5 h-5 rounded-full bg-[#3b1464] text-white flex items-center justify-center text-[10px] font-black flex-shrink-0">
                  {step.number}
                </span>
                <div className="p-1 rounded-md bg-white border border-slate-200/80 shadow-2xs">
                  {step.icon}
                </div>
              </div>
              <h3 className="text-xs font-black text-slate-900 tracking-tight leading-tight">
                {step.title}
              </h3>
              <p className="text-[11px] text-slate-600 font-medium leading-snug mt-0.5 line-clamp-2">
                {step.desc}
              </p>
            </div>

            {/* Desktop visual connector arrow: decorative, non-interactive, aria-hidden */}
            {idx < steps.length - 1 && (
              <div 
                className="hidden lg:flex absolute -right-2.5 xl:-right-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none select-none"
                aria-hidden="true"
              >
                <div className="w-5 h-5 rounded-full bg-white border border-purple-200 shadow-2xs flex items-center justify-center text-purple-700">
                  <ArrowRight className="w-3 h-3 stroke-[2.25]" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GeneratorGuide;

