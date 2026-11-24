import React from 'react';
import { Check, Users, GraduationCap } from 'lucide-react';

export const GeneratorHero: React.FC = () => {
  return (
    <div 
      id="generator-hero"
      className="bg-gradient-to-br from-[#1e1b4b] via-[#2e1065] to-[#3b1464] border border-purple-800/40 text-white rounded-2xl p-3.5 sm:p-5 lg:p-6 mb-4 sm:mb-5 shadow-xs relative overflow-hidden"
    >
      {/* Subtle green accent gradient overlays */}
      <div 
        className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" 
        aria-hidden="true"
      />
      <div 
        className="absolute -bottom-8 -left-8 w-32 h-32 sm:w-40 sm:h-40 bg-emerald-600/5 rounded-full blur-2xl pointer-events-none" 
        aria-hidden="true"
      />
      
      <div className="relative z-10 flex flex-col gap-3.5 sm:gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight text-white leading-tight">
              Exameno CBC Content Generator <span className="text-emerald-300 font-extrabold">(ECG)</span>
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-purple-200/90 mt-1 sm:mt-1.5 font-medium max-w-2xl leading-snug">
              Your AI Teaching Partner for Competency-Based Education
            </p>
          </div>

          {/* 3 Visual Trust Indicators (Non-interactive) */}
          <div 
            id="hero-trust-indicators"
            className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 pt-0.5 md:pt-0"
            aria-label="Trust indicators"
          >
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] sm:text-xs font-semibold text-white whitespace-nowrap">
              <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" aria-hidden="true" />
              <span>KICD-Aligned</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] sm:text-xs font-semibold text-white whitespace-nowrap">
              <Users className="w-3.5 h-3.5 text-purple-200 stroke-[2]" aria-hidden="true" />
              <span>Teacher-Focused</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] sm:text-xs font-semibold text-white whitespace-nowrap">
              <GraduationCap className="w-3.5 h-3.5 text-emerald-300 stroke-[2]" aria-hidden="true" />
              <span>Grades 1–10</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 my-0.5 sm:my-1 pointer-events-none" aria-hidden="true" />

        {/* Content Generation Coverage */}
        <div className="text-[11px] sm:text-xs md:text-sm text-purple-200/80 leading-relaxed font-medium">
          {/* Desktop Version */}
          <span className="hidden sm:inline">
            Create Schemes of Work • Lesson Plans • Lesson Notes • Record of Work Covered (ROWC) • Quizzes • Assessments & Exams
          </span>
          {/* Mobile Version */}
          <span 
            className="inline sm:hidden" 
            title="Create Schemes of Work, Lesson Plans, Lesson Notes, Record of Work Covered (ROWC), Quizzes, Assessments & Exams"
            aria-label="Create Schemes of Work, Lesson Plans, Lesson Notes, Record of Work Covered (ROWC), Quizzes, Assessments and Exams"
          >
            Create: Schemes of Work • Lesson Plans • Lesson Notes • ROWC • Quizzes • Assessments & Exams
          </span>
        </div>
      </div>
    </div>
  );
};

export default GeneratorHero;
