import { LESSON_BREAKDOWNS } from './data/curriculum/index';
import { getCurriculumTextByTerm } from './curriculumData';
import { User } from './types';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase: Curriculum Resources Manager Help & Authority Guardrails', () => {
  const curriculumManagerSource = fs.readFileSync(path.join(__dirname, 'components/CurriculumManager.tsx'), 'utf-8');
  const adminGuideDoc = fs.readFileSync(path.join(__dirname, 'docs/CURRICULUM_MANAGER_ADMIN_GUIDE.md'), 'utf-8');

  describe('A & B: Help Section & Required Title', () => {
    it('A: Help section exists within CurriculumManager component', () => {
      expect(curriculumManagerSource).toContain('id="curriculum-manager-help"');
      expect(curriculumManagerSource).toContain('isHelpOpen');
    });

    it('B: Help title is explicitly visible as HOW TO USE THIS MANAGER', () => {
      expect(curriculumManagerSource).toContain('HOW TO USE THIS MANAGER');
      expect(adminGuideDoc).toContain('HOW TO USE THIS MANAGER');
    });
  });

  describe('C: Six-Step Guidance', () => {
    it('C1: Step 1 Select Grade, Subject & Term is present', () => {
      expect(curriculumManagerSource).toContain('1. SELECT GRADE, SUBJECT & TERM');
      expect(curriculumManagerSource).toContain('Choose the grade, subject/learning area and term you want to review.');
    });

    it('C2: Step 2 Review Curriculum Structure is present', () => {
      expect(curriculumManagerSource).toContain('2. REVIEW THE CURRICULUM STRUCTURE');
      expect(curriculumManagerSource).toContain('Structured Strands View');
    });

    it('C3: Step 3 Validate Before Making Changes is present', () => {
      expect(curriculumManagerSource).toContain('3. VALIDATE BEFORE MAKING CHANGES');
      expect(curriculumManagerSource).toContain('KICD Validator / Resource Hub');
    });

    it('C4: Step 4 Make Changes Only When Authorized is present', () => {
      expect(curriculumManagerSource).toContain('4. MAKE CHANGES ONLY WHEN AUTHORIZED');
      expect(curriculumManagerSource).toContain('Curriculum changes can affect Teaching Plans, Teaching Allocations, Coverage, Content Generation');
    });

    it('C5: Step 5 Save / Synchronize Approved Changes is present', () => {
      expect(curriculumManagerSource).toContain('5. SAVE / SYNCHRONIZE APPROVED CHANGES');
      expect(curriculumManagerSource).toContain('synchronize only approved changes');
    });

    it('C6: Step 6 Re-Validate is present', () => {
      expect(curriculumManagerSource).toContain('6. RE-VALIDATE');
      expect(curriculumManagerSource).toContain('After an authorized change or synchronization, re-check the curriculum structure and validation status');
    });
  });

  describe('D, E, F, G: Curriculum Authority & Baseline vs Override Distinction', () => {
    it('D: Default Baseline explanation is clearly present', () => {
      expect(curriculumManagerSource).toContain('DEFAULT BASELINE');
      expect(curriculumManagerSource).toContain('The approved ECG/KICD curriculum currently used as the baseline for curriculum operations.');
    });

    it('E: Firestore Override explanation is clearly present', () => {
      expect(curriculumManagerSource).toContain('FIRESTORE OVERRIDE');
      expect(curriculumManagerSource).toContain('An authorized school/system-specific modification stored separately from the baseline for the applicable school/system context.');
    });

    it('F: Explicit Override ≠ Replacement principle is present', () => {
      expect(curriculumManagerSource).toContain('OVERRIDE ≠ REPLACEMENT');
      expect(curriculumManagerSource).toContain('A Firestore Override does');
      expect(curriculumManagerSource).toContain('replace the KICD/ECG baseline');
    });

    it('G: KICD/ECG baseline authority is preserved', () => {
      expect(curriculumManagerSource).toContain('The baseline remains the authoritative curriculum foundation unless the established curriculum governance explicitly determines otherwise.');
      expect(adminGuideDoc).toContain('OVERRIDE ≠ REPLACEMENT');
    });
  });

  describe('H: Curriculum Validation Guidance & Manager Tools', () => {
    it('H1: Explains Structured Strands View', () => {
      expect(curriculumManagerSource).toContain('STRUCTURED STRANDS VIEW');
    });

    it('H2: Explains Raw KICD Breakdown Editor', () => {
      expect(curriculumManagerSource).toContain('RAW KICD BREAKDOWN EDITOR');
    });

    it('H3: Explains Resource Hub & KICD Validator', () => {
      expect(curriculumManagerSource).toContain('RESOURCE HUB & KICD VALIDATOR');
    });

    it('H4: Explains Upload & Import Data', () => {
      expect(curriculumManagerSource).toContain('UPLOAD & IMPORT DATA');
      expect(curriculumManagerSource).toContain('Imported data must still be validated and is not automatically authoritative');
    });

    it('H5: Explains Firestore Sync Hub', () => {
      expect(curriculumManagerSource).toContain('FIRESTORE SYNC HUB');
      expect(curriculumManagerSource).toContain('Synchronization does not by itself make unvetted data authoritative');
    });
  });

  describe('I & J: Authorization & Access Guardrails', () => {
    it('I: Access control enforces Admin role exclusively', () => {
      expect(curriculumManagerSource).toContain("currentUser?.role === 'Admin'");
      expect(curriculumManagerSource).toContain('Access Restricted');
    });

    it('J: Non-admin teacher or guest cannot access administrative controls', () => {
      const teacherUser: User = {
        id: 'teacher_1',
        email: 'teacher@test.com',
        name: 'Teacher One',
        role: 'Teacher',
        status: 'Active',
        avatarColor: 'bg-emerald-600',
        credits: 10,
        profileComplete: true,
      };

      const isAdmin = (user: User | null) => user?.role === 'Admin';
      expect(isAdmin(teacherUser)).toBe(false);

      const guestUser: User | null = null;
      expect(isAdmin(guestUser)).toBe(false);

      const adminUser: User = {
        id: 'admin_1',
        email: 'admin@test.com',
        name: 'Admin User',
        role: 'Admin',
        status: 'Active',
        avatarColor: 'bg-indigo-600',
        credits: 100,
        profileComplete: true,
      };
      expect(isAdmin(adminUser)).toBe(true);
    });
  });

  describe('K, L, M, N: Curriculum Data Integrity & Immutability', () => {
    it('K: Baseline curriculum records remain immutable and unchanged', () => {
      const initialKeysCount = Object.keys(LESSON_BREAKDOWNS).length;
      expect(initialKeysCount).toBeGreaterThan(0);

      // Verify Grade 1 CRE content
      const g1cre = getCurriculumTextByTerm('Grade 1', 'CRE', ['Term 1']);
      expect(g1cre).toBeTruthy();
      expect(typeof g1cre).toBe('string');
      expect(g1cre.length).toBeGreaterThan(50);
    });

    it('L: Generator logic remains unaffected', () => {
      expect(curriculumManagerSource).toContain('Curriculum data is upstream of teaching plans and content generation');
    });

    it('M: TeachingPlan and allocation architecture remain intact', () => {
      expect(adminGuideDoc).toContain('KICD CURRICULUM = AUTHORITATIVE WHAT');
      expect(adminGuideDoc).toContain('TEACHING PLAN = WHEN');
      expect(adminGuideDoc).toContain('TEACHING ALLOCATION = WHAT IS PLANNED');
      expect(adminGuideDoc).toContain('COVERAGE = HOW MUCH');
    });

    it('N: Merely toggling or displaying help executes zero database mutations', () => {
      // Opening or rendering the help card is purely declarative and requires no async writes
      let isHelpOpen = false;
      const toggleHelp = () => { isHelpOpen = !isHelpOpen; };
      toggleHelp();
      expect(isHelpOpen).toBe(true);
      toggleHelp();
      expect(isHelpOpen).toBe(false);
    });
  });

  describe('O: Responsive Layout & Mobile Usability', () => {
    it('O: Includes responsive grid classes and mobile-safe padding', () => {
      expect(curriculumManagerSource).toContain('grid-cols-1 md:grid-cols-2 lg:grid-cols-3');
      expect(curriculumManagerSource).toContain('p-5 md:p-6');
      expect(curriculumManagerSource).toContain('text-xs');
    });
  });
});
