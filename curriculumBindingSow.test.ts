import { CanonicalCurriculumService } from './services/canonicalCurriculumService.ts';
import { SchoolConfigService } from './services/schoolConfigService.ts';
import { ContentType, GeneratedContent, SchemeOfWorkData } from './types.ts';

describe('Phase 23 — SOW Curriculum Binding & KICD Fidelity Tests', () => {
  describe('I. Canonical Curriculum Source Lock & Provenance', () => {
    it('1. establishes CanonicalCurriculumService as authoritative active source', () => {
      const curriculum = CanonicalCurriculumService.getCurriculum();
      expect(curriculum.id).toBe('kicd-cbc-2026');
      expect(curriculum.framework).toBe('Competency-Based Education');
      expect(curriculum.country).toBe('Kenya');
      expect(curriculum.status).toBe('active');
    });

    it('2. verifies Grade 8 Integrated Science official KICD design provenance', () => {
      const status = CanonicalCurriculumService.getAuthorityStatus('Grade 8', 'Integrated Science');
      expect(status).toBe('AUTHORITATIVE_VERIFIED');

      const registry = CanonicalCurriculumService.getCoverageRegistry();
      const g8Record = registry.find(r => r.grade === 'Grade 8' && r.learningArea === 'Integrated Science');
      expect(g8Record).toBeDefined();
      expect(g8Record?.curriculumVersion).toBe('KICD Revised 2024');
      expect(g8Record?.provenanceStatus).toContain('ISBN 978-9914-52-947-0');
      expect(g8Record?.canonicalStatus).toBe('ACTIVE');
    });

    it('3. verifies Grade 6 Agriculture and Nutrition official KICD design provenance', () => {
      const status = CanonicalCurriculumService.getAuthorityStatus('Grade 6', 'Agriculture and Nutrition');
      expect(status).toBe('AUTHORITATIVE_VERIFIED');

      const registry = CanonicalCurriculumService.getCoverageRegistry();
      const g6Record = registry.find(r => r.grade === 'Grade 6' && r.learningArea === 'Agriculture and Nutrition');
      expect(g6Record).toBeDefined();
      expect(g6Record?.curriculumVersion).toBe('KICD Revised 2024');
      expect(g6Record?.canonicalStatus).toBe('ACTIVE');
    });
  });

  describe('II. Grade 8 Integrated Science Term-by-Term Curriculum Fidelity', () => {
    it('4. locks Term 1 strictly to Strand 1.0 (Mixtures, Elements and Compounds)', () => {
      const nodes = CanonicalCurriculumService.resolveCanonicalSowNodes('Grade 8', 'Integrated Science', ['Term 1']);
      expect(nodes.length).toBeGreaterThan(0);

      nodes.forEach(node => {
        expect(node.term).toBe('Term 1');
        expect(node.strandTitle).toBe('1.0 Mixtures, Elements and Compounds');
        expect(['1.1 Elements and Compounds', '1.2 Physical and chemical changes', '1.3 Classes of fire']).toContain(node.subStrandTitle);
      });
    });

    it('5. CRITICAL: locks Term 2 strictly to Strand 2.0 (Living Things and Their Environment) and CONTAINS ZERO Force and Energy', () => {
      const nodes = CanonicalCurriculumService.resolveCanonicalSowNodes('Grade 8', 'Integrated Science', ['Term 2']);
      expect(nodes.length).toBeGreaterThan(0);

      const forceEnergyNodes = nodes.filter(n => 
        n.strandTitle.toLowerCase().includes('force') || 
        n.strandTitle.toLowerCase().includes('energy') ||
        n.subStrandTitle.toLowerCase().includes('transformation of energy') ||
        n.subStrandTitle.toLowerCase().includes('pressure')
      );
      expect(forceEnergyNodes.length).toBe(0);

      nodes.forEach(node => {
        expect(node.term).toBe('Term 2');
        expect(node.strandTitle).toBe('2.0 Living Things and Their Environment');
        expect(['2.1 The Cell', '2.2 Movement of materials in and out of the cell', '2.3 Reproduction in human beings']).toContain(node.subStrandTitle);
      });
    });

    it('6. locks Term 3 strictly to Strand 3.0 (Force and Energy)', () => {
      const nodes = CanonicalCurriculumService.resolveCanonicalSowNodes('Grade 8', 'Integrated Science', ['Term 3']);
      expect(nodes.length).toBeGreaterThan(0);

      nodes.forEach(node => {
        expect(node.term).toBe('Term 3');
        expect(node.strandTitle).toBe('3.0 Force and Energy');
        expect(['3.1 Transformation of Energy', '3.2 Pressure']).toContain(node.subStrandTitle);
      });
    });

    it('7. resolves multi-term SOW nodes across Term 1, Term 2, and Term 3 with zero cross-term leakage', () => {
      const multiTermNodes = CanonicalCurriculumService.resolveCanonicalSowNodes('Grade 8', 'Integrated Science', ['Term 1', 'Term 2', 'Term 3']);
      expect(multiTermNodes.length).toBe(150); // Canonical KICD: 60 (Term 1) + 54 (Term 2) + 36 (Term 3) = 150 lessons

      const term1Nodes = multiTermNodes.filter(n => n.term === 'Term 1');
      const term2Nodes = multiTermNodes.filter(n => n.term === 'Term 2');
      const term3Nodes = multiTermNodes.filter(n => n.term === 'Term 3');

      expect(term1Nodes.length).toBe(60);
      expect(term2Nodes.length).toBe(54);
      expect(term3Nodes.length).toBe(36);

      term1Nodes.forEach(n => expect(n.strandTitle).toBe('1.0 Mixtures, Elements and Compounds'));
      term2Nodes.forEach(n => expect(n.strandTitle).toBe('2.0 Living Things and Their Environment'));
      term3Nodes.forEach(n => expect(n.strandTitle).toBe('3.0 Force and Energy'));
    });
  });

  describe('III. Grade 6 Agriculture and Nutrition Curriculum Fidelity', () => {
    it('8. locks Grade 6 Term 1 to Strand 1.0 Conservation of Resources', () => {
      const nodes = CanonicalCurriculumService.resolveCanonicalSowNodes('Grade 6', 'Agriculture and Nutrition', ['Term 1']);
      expect(nodes.length).toBe(32); // 11 + 11 + 10 lessons
      nodes.forEach(n => {
        expect(n.strandTitle).toBe('1.0 Conservation of Resources');
        expect(['1.1 Controlling Soil Erosion', '1.2 Conserving Water: Seedbeds', '1.3 Conserving wild animals: Using Physical Deterrents']).toContain(n.subStrandTitle);
      });
    });

    it('9. locks Grade 6 Term 2 to Strand 2.0 Food Production Processes', () => {
      const nodes = CanonicalCurriculumService.resolveCanonicalSowNodes('Grade 6', 'Agriculture and Nutrition', ['Term 2']);
      expect(nodes.length).toBe(36); // 12 + 11 + 13 lessons
      nodes.forEach(n => {
        expect(n.strandTitle).toBe('2.0 Food Production Processes');
        expect(['2.1 Rearing Small Domestic Animals', '2.2 Preserving Crop Products: Fruits and Vegetables', '2.3 Stewing and Baking Food']).toContain(n.subStrandTitle);
      });
    });

    it('10. locks Grade 6 Term 3 to Strands 3.0 Hygiene Practices & 4.0 Production Techniques', () => {
      const nodes = CanonicalCurriculumService.resolveCanonicalSowNodes('Grade 6', 'Agriculture and Nutrition', ['Term 3']);
      expect(nodes.length).toBe(52); // 9 + 12 + 16 + 15 lessons
      nodes.forEach(n => {
        expect(['3.0 Hygiene Practices', '4.0 Production Techniques']).toContain(n.strandTitle);
      });
    });
  });

  describe('IV. Specific Learning Outcomes & Pedagogical Structure', () => {
    it('11. embeds SMART outcomes categorized by Knowledge, Skills, and Attitudes', () => {
      const nodes = CanonicalCurriculumService.resolveCanonicalSowNodes('Grade 8', 'Integrated Science', ['Term 2']);
      const cellNode = nodes.find(n => n.subStrandTitle === '2.1 The Cell');
      expect(cellNode).toBeDefined();
      expect(cellNode?.learningOutcomesText).toContain('**Knowledge:**');
      expect(cellNode?.learningOutcomesText).toContain('**Skills:**');
      expect(cellNode?.learningOutcomesText).toContain('**Attitudes:**');
    });

    it('12. embeds Key Inquiry Questions from canonical curriculum', () => {
      const nodes = CanonicalCurriculumService.resolveCanonicalSowNodes('Grade 8', 'Integrated Science', ['Term 2']);
      const reproductionNode = nodes.find(n => n.subStrandTitle === '2.3 Reproduction in human beings');
      expect(reproductionNode).toBeDefined();
      expect(reproductionNode?.keyInquiryQuestions.length).toBeGreaterThan(0);
      expect(reproductionNode?.keyInquiryQuestions[0]).toContain('menstrual cycle');
    });
  });
});
