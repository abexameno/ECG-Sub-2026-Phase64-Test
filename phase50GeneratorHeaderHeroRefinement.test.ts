import * as fs from 'fs';
import * as path from 'path';
import { SchoolConfigService } from './services/schoolConfigService';
import { CONTENT_TYPES } from './constants';
import { SystemSettings, ContentType } from './types';

describe('Phase 50: Generator UX Verification & Visual Refinement (ECG v1.0.5 RC)', () => {
  const appSource = fs.readFileSync(path.join(__dirname, 'App.tsx'), 'utf-8');
  const headerSource = fs.readFileSync(path.join(__dirname, 'components/Header.tsx'), 'utf-8');
  const heroSource = fs.readFileSync(path.join(__dirname, 'components/GeneratorHero.tsx'), 'utf-8');
  const guideSource = fs.readFileSync(path.join(__dirname, 'components/GeneratorGuide.tsx'), 'utf-8');
  const formSource = fs.readFileSync(path.join(__dirname, 'components/GeneratorForm.tsx'), 'utf-8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
  const docSource = fs.readFileSync(path.join(__dirname, 'docs/50_GENERATOR_UX_VERIFICATION_AND_VISUAL_REFINEMENT.md'), 'utf-8');

  // Item 1: Correct phase/version documentation
  describe('1. Phase and Version Documentation Consistency', () => {
    it('documents authoritative Phase 50 rather than invented phase numbers', () => {
      expect(docSource).toContain('Phase 50: Generator UX Verification & Visual Refinement');
      expect(docSource).toContain('No separate "Phase 51" was ever created');
    });

    it('documents target release as v1.0.5 RC with v1.0.4 remaining current production', () => {
      expect(packageJson.version).toBe('1.0.5');
      expect(appSource).toContain("const APP_VERSION = '1.0.5';");
      expect(docSource).toContain('v1.0.5 release candidate');
      expect(docSource).toContain('Production remains v1.0.4');
    });
  });

  // Item 2: Actual mobile navigation is Generator / Today / Library / ELMS / More
  describe('2. Actual Mobile Bottom Navigation Verification', () => {
    it('verifies primary tabs are Generator, Today, Library, and ELMS with correct mobileLabels', () => {
      expect(appSource).toContain("id: 'home', label: 'Generator', mobileLabel: \"Generator\"");
      expect(appSource).toContain("id: 'my-teaching', label: \"Today's Teaching\", mobileLabel: \"Today\"");
      expect(appSource).toContain("id: 'library', label: 'My Library', mobileLabel: \"Library\"");
      expect(appSource).toContain("id: 'student-elms', label: 'Student ELMS', mobileLabel: \"ELMS\"");
    });

    it('renders the 5th mobile navigation item as More', () => {
      expect(appSource).toContain('<span className="text-[11px] leading-tight mt-0.5 tracking-tight">More</span>');
      expect(appSource).toContain('setIsMobileMoreOpen(true)');
    });
  });

  // Item 2b: Top Navigation More Button Styling Refinement
  describe('2b. Top Navigation More Button Styling Refinement', () => {
    it('verifies the top navigation More button has ECG purple background, white text, and light icons', () => {
      expect(appSource).toContain('bg-[#3b1464]');
      expect(appSource).toContain('text-white');
      expect(appSource).toContain('h-11');
      expect(appSource).toContain('rounded-xl');
      expect(appSource).toContain('ChevronDown');
    });
  });

  // Items 3–7: Four workflow icons render
  describe('3-7. Workflow Icons Implementation', () => {
    it('Item 3: imports consistent icon components from lucide-react', () => {
      expect(guideSource).toContain("import { FileText, GraduationCap, Calendar, Sparkles, ArrowRight } from 'lucide-react';");
    });

    it('Item 4: renders the content-type icon for Step 1', () => {
      expect(guideSource).toContain('<FileText className="w-4 h-4 text-purple-900" aria-hidden="true" />');
    });

    it('Item 5: renders the class-and-term icon for Step 2', () => {
      expect(guideSource).toContain('<GraduationCap className="w-4 h-4 text-purple-900" aria-hidden="true" />');
    });

    it('Item 6: renders the schedule-and-topics icon for Step 3', () => {
      expect(guideSource).toContain('<Calendar className="w-4 h-4 text-purple-900" aria-hidden="true" />');
    });

    it('Item 7: renders Sparkles/generation icon for Step 4 (GENERATE)', () => {
      expect(guideSource).toContain('<Sparkles className="w-4 h-4 text-emerald-700" aria-hidden="true" />');
    });
  });

  // Items 8–10: Desktop connectors & mobile adaptability
  describe('8-10. Workflow Connectors & Adaptability', () => {
    it('Item 8: renders desktop connectors indicating workflow progression', () => {
      expect(guideSource).toContain('ArrowRight');
      expect(guideSource).toContain('w-5 h-5 rounded-full bg-white border border-purple-200');
    });

    it('Item 9: ensures connectors are decorative and do not interfere with interaction', () => {
      expect(guideSource).toContain('pointer-events-none');
      expect(guideSource).toContain('select-none');
      expect(guideSource).toContain('aria-hidden="true"');
    });

    it('Item 10: adapts connectors on narrow screens (hidden on mobile)', () => {
      expect(guideSource).toContain('hidden lg:flex absolute');
    });
  });

  // Item 11: Hero uses approved gradient styling
  describe('11. Hero Visual Refinement & Subtle Green Accents', () => {
    it('uses deep indigo to purple background gradient', () => {
      expect(heroSource).toContain('bg-gradient-to-br from-[#1e1b4b] via-[#2e1065] to-[#3b1464]');
    });

    it('includes restrained, subtle emerald/green accent overlays without neon or excessive glow', () => {
      expect(heroSource).toContain('bg-emerald-500/10 rounded-full blur-3xl');
      expect(heroSource).toContain('bg-emerald-600/5 rounded-full blur-2xl');
      expect(heroSource).not.toContain('animate-pulse');
      expect(heroSource).not.toContain('animate-spin');
    });
  });

  // Item 12: Hero approved copy remains unchanged
  describe('12. Hero Copy Preservation', () => {
    it('contains exact approved title, subtitle, and trust indicators', () => {
      expect(heroSource).toContain('Exameno CBC Content Generator');
      expect(heroSource).toContain('(ECG)');
      expect(heroSource).toContain('Your AI Teaching Partner for Competency-Based Education');
      expect(heroSource).toContain('KICD-Aligned');
      expect(heroSource).toContain('Teacher-Focused');
      expect(heroSource).toContain('Grades 1–10');
      expect(heroSource).not.toContain('AI-Powered');
    });

    it('verifies content generation coverage description with ROWC is present', () => {
      expect(heroSource).toContain('Create Schemes of Work • Lesson Plans • Lesson Notes • Record of Work Covered (ROWC) • Quizzes • Assessments & Exams');
      expect(heroSource).toContain('Create: Schemes of Work • Lesson Plans • Lesson Notes • ROWC • Quizzes • Assessments & Exams');
    });

    it('strictly does not restore prohibited slogans', () => {
      expect(heroSource).not.toContain('Better Teaching, Brighter Future');
      expect(heroSource).not.toContain('ECG is now live');
      expect(appSource).not.toContain('Better Teaching, Brighter Future');
    });
  });

  // Item 13: GET STARTED copy remains unchanged
  describe('13. GET STARTED Copy Preservation', () => {
    it('maintains exact approved GET STARTED title, description, and steps', () => {
      expect(guideSource).toContain('GET STARTED');
      expect(guideSource).toContain('Choose your content type, grade, subject and academic term. Configure your school schedule, select curriculum topics, then generate your resource.');
      expect(guideSource).toContain('Choose what you want to create.');
      expect(guideSource).toContain('Select grade, subject and academic term.');
      expect(guideSource).toContain('Configure teaching weeks and lessons per week where applicable, then select curriculum topics.');
      expect(guideSource).toContain('Create and review your resource.');
    });
  });

  // Items 14–20: Responsive layout and mobile screen checks
  describe('14-20. Responsive Spacing & Viewport Adaptation', () => {
    it('Item 14: guards against horizontal overflow', () => {
      expect(guideSource).toContain('overflow-hidden');
      expect(heroSource).toContain('overflow-hidden');
      expect(guideSource).toContain('grid grid-cols-2 lg:grid-cols-4');
    });

    it('Items 15-20: supports mobile viewports 320px, 360px, 375px, 390px, 412px, 430px', () => {
      // 2x2 grid ensures 4 cards never cram horizontally onto small screens
      expect(guideSource).toContain('grid-cols-2 lg:grid-cols-4');
      // Compact padding and text sizing
      expect(guideSource).toContain('p-3.5 sm:p-5');
      expect(heroSource).toContain('p-3.5 sm:p-5 lg:p-6');
      expect(appSource).toContain('py-4 sm:py-6 px-3.5 sm:px-6');
    });
  });

  // Items 21–25: Core functionality, school selection & ContextHelp preserved
  describe('21-25. Core Functionality & Component Preservation', () => {
    it('Item 21 & 22: preserves generator controls and generation flow', () => {
      expect(appSource).toContain('handleGenerateContent');
      expect(appSource).toContain('generationProgress');
      expect(formSource).toContain('onSubmit={handleSubmitWithValidation}');
      expect(CONTENT_TYPES).toContain(ContentType.LessonPlan);
      expect(CONTENT_TYPES).toContain(ContentType.Assessment);
    });

    it('Item 23: keeps bottom navigation and drawer fully functional', () => {
      expect(appSource).toContain("setActiveTab(tab.id as any)");
      expect(appSource).toContain("setIsMobileMoreOpen(true)");
    });

    it('Item 24: preserves dynamic, school-agnostic configuration', () => {
      const allSchools = SchoolConfigService.getAllSchools();
      expect(allSchools.length).toBeGreaterThan(0);
      expect(formSource).toContain('YOUR SCHOOL');
      expect(formSource).not.toContain('Lizzie Wanyoike Preparatory School (Hardcoded)');
    });

    it('Item 25: preserves ContextHelp component integration', () => {
      expect(formSource).toContain('<ContextHelp');
      expect(formSource).toContain('title="Content Type"');
      expect(formSource).toContain('title="Grade Level"');
      expect(formSource).toContain('title="Subject"');
    });
  });
});
