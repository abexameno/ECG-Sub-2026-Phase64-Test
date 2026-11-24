import fs from 'fs';
import path from 'path';

describe('Phase 37A: ECG Master Architecture Diagram & Governance Documentation', () => {
  const masterDocPath = path.join(process.cwd(), 'docs', '00_ECG_MASTER_ARCHITECTURE.md');

  it('verifies that docs/00_ECG_MASTER_ARCHITECTURE.md exists and is non-empty', () => {
    expect(fs.existsSync(masterDocPath)).toBe(true);
    const content = fs.readFileSync(masterDocPath, 'utf8');
    expect(content.length).toBeGreaterThan(1000);
  });

  it('verifies that canonical terminology is defined exactly or with minor grammatical variation', () => {
    const content = fs.readFileSync(masterDocPath, 'utf8');

    expect(content).toMatch(/Curriculum.*WHAT/i);
    expect(content).toMatch(/School.*WHERE.*UNDER WHAT CONDITIONS/i);
    expect(content).toMatch(/Teaching Plan.*WHEN/i);
    expect(content).toMatch(/Teaching Allocation.*WHAT IS PLANNED/i);
    expect(content).toMatch(/Coverage.*HOW MUCH/i);
    expect(content).toMatch(/Gemini.*HOW.*ASSISTANCE/i);
    expect(content).toMatch(/ContentArtifact.*STRUCTURED RESULT/i);
    expect(content).toMatch(/Repository.*WHERE RESULT IS MANAGED/i);
    expect(content).toMatch(/Delivery.*HOW ARTIFACT IS PRESENTED/i);
    expect(content).toMatch(/Teaching Activity.*WHAT WAS ACTUALLY DELIVERED/i);
    expect(content).toMatch(/Learner Activity.*WHAT LEARNER INTERACTED WITH/i);
    expect(content).toMatch(/Completion Evidence.*WHAT WAS EXPLICITLY COMPLETED/i);
    expect(content).toMatch(/Progress.*DERIVED/i);
    expect(content).toMatch(/Assessment Evidence.*PERFORMANCE EVIDENCE/i);
    expect(content).toMatch(/Interpretation.*EVIDENCE-BASED LEARNING OUTCOME INTERPRETATION/i);
    expect(content).toMatch(/Teacher.*FINAL DECISION-MAKER/i);
    expect(content).toMatch(/Server.*AUTHORITY FOR SECURITY, ENTITLEMENT AND SYSTEM RULES/i);
  });

  it('verifies that the Master Mermaid Diagram source exists and contains all required nodes', () => {
    const content = fs.readFileSync(masterDocPath, 'utf8');

    // Ensure mermaid code block exists
    expect(content).toContain('```mermaid');
    expect(content).toContain('```');

    // Extract diagram block
    const mermaidMatch = content.match(/```mermaid([\s\S]*?)```/);
    expect(mermaidMatch).not.toBeNull();
    const diagram = mermaidMatch![1];

    // Check core nodes in diagram
    expect(diagram).toContain('KICD CURRICULUM');
    expect(diagram).toContain('SCHOOL / CONTEXT');
    expect(diagram).toContain('TEACHING PLAN');
    expect(diagram).toContain('TEACHING ALLOCATION');
    expect(diagram).toContain('CONTENT ARTIFACT');
    expect(diagram).toContain('REPOSITORY');
    expect(diagram).toContain('DELIVERY');
    expect(diagram).toContain('TEACHING ACTIVITY');
    expect(diagram).toContain('LEARNER ACTIVITY');
    expect(diagram).toContain('COMPLETION EVIDENCE');
    expect(diagram).toContain('PROGRESS');
    expect(diagram).toContain('ASSESSMENT EVIDENCE');
    expect(diagram).toContain('INTERPRETATION');
    expect(diagram).toContain('TEACHER');
    expect(diagram).toContain('ADJUST / PLAN');
    expect(diagram).toContain('GEMINI / AI');
    expect(diagram).toContain('SERVER AUTHORITY');
    expect(diagram).toContain('COVERAGE');
    expect(diagram).toContain('ELMS INTEGRATION BOUNDARY');
  });

  it('verifies that prohibited authority relationships are documented as forbidden', () => {
    const content = fs.readFileSync(masterDocPath, 'utf8');

    expect(content).toContain('Gemini → Curriculum Authority');
    expect(content).toContain('Client → Authorization');
    expect(content).toContain('Coverage → Curriculum Mutation');
    expect(content).toContain('Teaching Plan → Curriculum Mutation');
    expect(content).toContain('Content Generator → Curriculum');
    expect(content).toContain('ELMS → ECG Curriculum Authority');
    expect(content).toMatch(/FORBIDDEN/i);
  });

  it('verifies that non-equivalence principles are explicitly documented', () => {
    const content = fs.readFileSync(masterDocPath, 'utf8');

    expect(content).toContain('Curriculum ≠ Coverage');
    expect(content).toContain('Teaching Plan ≠ Curriculum');
    expect(content).toContain('Teaching Activity ≠ Completion Evidence');
    expect(content).toContain('Completion ≠ Mastery');
    expect(content).toContain('Assessment ≠ Curriculum Authority');
  });

  it('verifies that future phase governance rules are documented', () => {
    const content = fs.readFileSync(masterDocPath, 'utf8');

    expect(content).toContain('Future Phase Governance');
    expect(content).toMatch(/Every future implementation phase MUST be checked against/i);
  });
});
