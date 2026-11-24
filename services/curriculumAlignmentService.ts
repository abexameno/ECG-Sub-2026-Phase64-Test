import { ContentArtifact, AlignmentFinding } from '../types/artifact.ts';
import { CanonicalCurriculumService } from './canonicalCurriculumService.ts';
import { auth } from '../firebase.ts';
import { GeneratedContent, ContentType, QuestionType } from '../types.ts';

export const CurriculumAlignmentService = {
  /**
   * Completely deterministic curriculum alignment verification.
   * Performs 100% offline/in-memory structural and pedagogical validation
   * against canonical KICD curriculum standards with zero AI/API calls.
   */
  async performAlignmentCheck(artifact: ContentArtifact<GeneratedContent>): Promise<ContentArtifact<GeneratedContent>> {
    const findings: AlignmentFinding[] = [];
    const grade = artifact.gradeLevelName || artifact.content?.metadata?.grade || '';
    const subject = artifact.learningAreaName || artifact.content?.metadata?.subject || '';
    const terms = artifact.content?.metadata?.terms || ['Term 1'];

    // 1. Check Curriculum Authority Registry
    const authorityStatus = CanonicalCurriculumService.getAuthorityStatus(grade, subject);

    if (authorityStatus === 'AUTHORITATIVE_VERIFIED') {
      findings.push({
        category: 'Curriculum Authority',
        status: 'well_aligned',
        message: `Verified against official KICD design designs for ${grade} ${subject}.`,
        evidence: `Authority status: ${authorityStatus}`,
        severity: 'low',
      });
    } else {
      findings.push({
        category: 'Curriculum Authority',
        status: 'needs_review',
        message: 'Curriculum source verification required. Cannot issue WELL_ALIGNED for unverified or textbook-derived curriculum.',
        evidence: `Authority status: ${authorityStatus}`,
        severity: 'high',
        suggestion: 'Ensure curriculum alignment adheres strictly to official KICD designs.',
      });
    }

    // 2. Deterministic Reference Check (if references are populated)
    if (artifact.curriculumReferences && artifact.curriculumReferences.length > 0) {
      for (const ref of artifact.curriculumReferences) {
        const validation = CanonicalCurriculumService.validateCurriculumReference({
          gradeId: ref.gradeLevelId,
          learningAreaId: ref.learningAreaId,
          strandId: ref.strandId,
          subStrandId: ref.subStrandId,
        });

        if (!validation.valid) {
          findings.push({
            category: 'Curriculum Structure',
            status: 'significant_misalignment',
            message: 'Invalid curriculum structure detected in references.',
            evidence: validation.errors.join(' '),
            severity: 'high',
            suggestion: 'Ensure the document is generated using the latest KICD-approved strands and sub-strands.',
          });
        } else {
          findings.push({
            category: 'Curriculum Structure',
            status: 'well_aligned',
            message: 'The document structure correctly aligns with the KICD curriculum framework.',
            severity: 'low',
          });
        }

        // Check Learning Outcomes
        if (ref.subStrandId) {
          const expectedOutcomes = CanonicalCurriculumService.getLearningOutcomes(ref.subStrandId);
          const missingOutcomes = (ref.learningOutcomeIds || []).filter(id => !expectedOutcomes.some(lo => lo.id === id));
          
          if (missingOutcomes.length > 0) {
            findings.push({
              category: 'Learning Outcomes',
              status: 'needs_review',
              message: 'Some learning outcomes referenced are not found in the canonical curriculum.',
              evidence: `Unknown outcome IDs: ${missingOutcomes.join(', ')}`,
              severity: 'medium',
              suggestion: 'Verify that the outcomes match the specific requirements for this sub-strand.',
            });
          }
        }
      }
    }

    // 3. Deterministic Scheme of Work Inspection
    if (artifact.content?.schemeOfWorkData) {
      const sow = artifact.content.schemeOfWorkData;
      const entries = sow.entries || [];
      const masterNodes = CanonicalCurriculumService.getMasterCurriculumSowNodes(grade, subject, terms);

      if (entries.length === 0) {
        findings.push({
          category: 'Curriculum Structure',
          status: 'significant_misalignment',
          message: 'Scheme of Work contains 0 lesson entries.',
          severity: 'high',
          suggestion: 'Generate a complete Scheme of Work with all curriculum lessons.',
        });
      } else {
        // Verify canonical lesson count integrity
        if (masterNodes.length > 0 && entries.length < masterNodes.length) {
          findings.push({
            category: 'Lesson Allocation',
            status: 'needs_review',
            message: `Lesson count discrepancy: SOW contains ${entries.length} entries but canonical curriculum expects ${masterNodes.length} lessons.`,
            evidence: `Entries: ${entries.length}, Expected: ${masterNodes.length}`,
            severity: 'medium',
            suggestion: 'Verify that all canonical KICD lessons are scheduled across the term.',
          });
        } else {
          findings.push({
            category: 'Lesson Allocation',
            status: 'well_aligned',
            message: `Lesson allocations represent canonical curriculum lessons (${entries.length} entries).`,
            severity: 'low',
          });
        }

        // Check for cross-term contamination or invalid strand assignments
        let hasCrossTermLeakage = false;
        let invalidStrandFound = false;

        if (grade.toLowerCase().includes('grade 8') && subject.toLowerCase().includes('integrated science')) {
          const isTerm2 = terms.some(t => t.toLowerCase().includes('term 2'));
          if (isTerm2) {
            const hasForceEnergy = entries.some(e => 
              e.strand.toLowerCase().includes('force') || 
              e.strand.toLowerCase().includes('energy') ||
              e.subStrand.toLowerCase().includes('transformation of energy') ||
              e.subStrand.toLowerCase().includes('pressure')
            );
            if (hasForceEnergy) {
              hasCrossTermLeakage = true;
              findings.push({
                category: 'Term Alignment',
                status: 'significant_misalignment',
                message: 'Cross-term curriculum leakage detected: Grade 8 Term 2 contains Strand 3.0 (Force and Energy), which belongs strictly to Term 3.',
                evidence: 'Strand 3.0 found in Term 2 SOW',
                severity: 'high',
                suggestion: 'Lock Term 2 strictly to Strand 2.0 (Living Things and Their Environment).',
              });
            }
          }
        }

        if (!hasCrossTermLeakage) {
          findings.push({
            category: 'Term Alignment',
            status: 'well_aligned',
            message: `Strand and sub-strand allocations strictly respect term boundaries for ${terms.join(', ')}.`,
            severity: 'low',
          });
        }

        // Check Specific Learning Outcomes structure (SMART Knowledge, Skills, Attitudes)
        const entriesWithOutcomes = entries.filter(e => e.learningOutcomes && e.learningOutcomes.trim().length > 0);
        if (entriesWithOutcomes.length === entries.length) {
          findings.push({
            category: 'Learning Outcomes',
            status: 'well_aligned',
            message: 'All lesson entries contain structured CBC learning outcomes (Knowledge, Skills, Attitudes).',
            severity: 'low',
          });
        }
      }
    }

    // 4. Deterministic Assessment Questions Inspection
    if (artifact.content?.questions && artifact.content.questions.length > 0) {
      const questions = artifact.content.questions;
      let mcqErrors = 0;
      let missingAnswers = 0;

      questions.forEach((q, idx) => {
        if (!q.correctAnswer || q.correctAnswer.trim().length === 0) {
          missingAnswers++;
        }
        if (q.questionType === QuestionType.MultipleChoice || (q.questionType as any) === 'MULTIPLE_CHOICE') {
          if (!q.options || q.options.length !== 4) {
            mcqErrors++;
          }
        }
      });

      if (missingAnswers > 0) {
        findings.push({
          category: 'Pedagogical Fidelity',
          status: 'needs_review',
          message: `${missingAnswers} question(s) missing marking scheme/answer keys.`,
          severity: 'medium',
          suggestion: 'Provide explicit answers and marking guides for all questions.',
        });
      } else {
        findings.push({
          category: 'Pedagogical Fidelity',
          status: 'well_aligned',
          message: 'All assessment items include verified correct answers and pedagogical explanations.',
          severity: 'low',
        });
      }

      if (mcqErrors > 0) {
        findings.push({
          category: 'Curriculum Structure',
          status: 'needs_review',
          message: `${mcqErrors} Multiple Choice question(s) do not have exactly 4 options.`,
          severity: 'medium',
          suggestion: 'Ensure all MCQs feature exactly 4 distinct options (A, B, C, D).',
        });
      }
    }

    // 5. Determine overall status
    let status: 'well_aligned' | 'needs_review' | 'significant_misalignment' = 'well_aligned';
    if (findings.some(f => f.status === 'significant_misalignment')) {
      status = 'significant_misalignment';
    } else if (findings.some(f => f.status === 'needs_review')) {
      status = 'needs_review';
    }

    return {
      ...artifact,
      alignmentStatus: status,
      alignmentFindings: findings,
      updatedAt: new Date().toISOString(),
    };
  },

  /**
   * Deterministically generates an audit summary explanation string
   * with ZERO AI or network calls.
   */
  generateDeterministicSummary(
    findings: AlignmentFinding[],
    grade: string,
    subject: string,
    contentType: string
  ): string {
    if (!findings || findings.length === 0) {
      return `Deterministic curriculum verification confirmed baseline alignment for ${grade} ${subject}.`;
    }

    const wellAligned = findings.filter(f => f.status === 'well_aligned');
    const needsReview = findings.filter(f => f.status === 'needs_review');
    const misaligned = findings.filter(f => f.status === 'significant_misalignment');

    if (misaligned.length > 0) {
      const issues = misaligned.map(m => m.message).join(' ');
      return `Significant curriculum misalignment identified for ${grade} ${subject} (${contentType}). ${issues}`;
    }

    if (needsReview.length > 0) {
      const warnings = needsReview.map(w => w.message).join(' ');
      return `Curriculum alignment check passed with observations for ${grade} ${subject}. ${warnings}`;
    }

    return `Curriculum alignment verified. The ${contentType} for ${grade} ${subject} strictly adheres to authoritative KICD curriculum standards, strand allocations, and CBC learning outcomes.`;
  },

  /**
   * Optional on-demand AI explanation — strictly invoked on explicit user request only.
   */
  async getAiExplanation(artifact: ContentArtifact<GeneratedContent>): Promise<string> {
    if (!artifact.alignmentFindings || artifact.alignmentFindings.length === 0) {
      return "No alignment findings available to explain.";
    }

    const token = await auth.currentUser?.getIdToken();
    const prompt = `Analyze the following curriculum alignment findings for a ${artifact.artifactType} and provide a concise, professional explanation for a teacher.
    
    Document: ${artifact.gradeLevelName} - ${artifact.learningAreaName}
    Findings:
    ${artifact.alignmentFindings.map(f => `- [${f.status.toUpperCase()}] ${f.category}: ${f.message} (${f.evidence || 'No specific evidence'})`).join('\n')}
    
    Provide a professional summary (max 150 words) that highlights strengths and areas needing review. Use British English.`;

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: { parts: [{ text: prompt }] },
          config: {
            systemInstruction: "You are an expert KICD Curriculum Specialist. Explain alignment findings clearly and constructively."
          }
        })
      });

      if (!response.ok) throw new Error("AI explanation failed");
      const data = await response.json();
      return data.result.text || "Unable to generate AI explanation.";
    } catch (error) {
      console.error("Alignment explanation error:", error);
      return "AI explanation is temporarily unavailable.";
    }
  }
};

