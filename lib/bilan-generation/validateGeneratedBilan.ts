// ─────────────────────────────────────────────────────────────────────────────
// lib/bilan-generation/validateGeneratedBilan.ts
// Quality gate: validates generated Markdown before saving.
// Logs only safe metadata — never the bilan content or student data.
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from '@/lib/logger';
import type { NormalizedBilanInput, PedagogicalProfile, ValidationIssue, QualityStatus } from './types';

const FORBIDDEN_TERMS = [
  'ton ferme',
  'données brutes',
  'le coach indique',
  'selon les données',
  'mock',
  'stub',
  'json',
  'intelligence artificielle',
  '\\bIA\\b',
  'prompt',
  'le modèle',
];

const REQUIRED_SECTIONS = [
  /^(?:##\s+|\*\*)1\./m,
  /^(?:##\s+|\*\*)2\./m,
  /^(?:##\s+|\*\*)3\./m,
  /^(?:##\s+|\*\*)4\./m,
  /^(?:##\s+|\*\*)5\./m,
  /^(?:##\s+|\*\*)6\./m,
];

const ACTIONABLE_KEYWORDS = [
  /\b(s'entraîner|entraîner|réviser|travailler|pratiquer|refaire|relire|chronométrer|fiches|annales|exercices|méthode|structurer|rédiger|vérifier|corriger)\b/gi,
];

const MIN_WORDS = 450;
const MAX_WORDS = 2500;

function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

function countActionableAdvice(markdown: string): number {
  let count = 0;
  for (const re of ACTIONABLE_KEYWORDS) {
    const matches = markdown.match(re);
    if (matches) count += matches.length;
  }
  return count;
}

function legacySimilarity(generated: string, legacy?: string): number {
  if (!legacy || legacy.trim().length < 50) return 0;
  const sentences = legacy
    .split(/[.!?]+/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 30);
  if (sentences.length === 0) return 0;

  const genLower = generated.toLowerCase();
  let matches = 0;
  for (const s of sentences) {
    // Check for 30-char substrings match
    const snippet = s.slice(0, 30);
    if (genLower.includes(snippet)) matches++;
  }
  return matches / sentences.length;
}

export type ValidationResult = {
  qualityStatus: QualityStatus;
  issues: ValidationIssue[];
};

export function validateGeneratedBilan(
  markdown: string,
  input: NormalizedBilanInput,
  profile: PedagogicalProfile,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. Empty
  if (!markdown || markdown.trim().length === 0) {
    issues.push('EMPTY');
    logger.warn({ bilanId: input.bilanId }, '[validate] EMPTY');
    return { qualityStatus: 'FAIL', issues };
  }

  const wordCount = countWords(markdown);

  // 2. Length
  if (wordCount < MIN_WORDS) {
    issues.push('TOO_SHORT');
    logger.warn({ bilanId: input.bilanId, wordCount, min: MIN_WORDS }, '[validate] TOO_SHORT');
  }
  if (wordCount > MAX_WORDS) {
    issues.push('TOO_LONG');
    logger.warn({ bilanId: input.bilanId, wordCount, max: MAX_WORDS }, '[validate] TOO_LONG');
  }

  // 3. Required sections
  const missingSections = REQUIRED_SECTIONS.filter(re => !re.test(markdown));
  if (missingSections.length > 0) {
    issues.push('MISSING_SECTIONS');
    logger.warn({ bilanId: input.bilanId, missing: missingSections.length }, '[validate] MISSING_SECTIONS');
  }

  // 4. Forbidden terms
  const lowerMarkdown = markdown.toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    const re = new RegExp(term, 'i');
    if (re.test(lowerMarkdown)) {
      issues.push('FORBIDDEN_TERM');
      logger.warn({ bilanId: input.bilanId, term }, '[validate] FORBIDDEN_TERM');
      break;
    }
  }

  // 5. Raw markdown bold titles instead of ## headings (warn only, not blocking)

  // 6. Legacy copy check
  const simScore = legacySimilarity(markdown, input.legacySummary);
  if (simScore > 0.4) {
    issues.push('LEGACY_COPY');
    logger.warn({ bilanId: input.bilanId, simScore }, '[validate] LEGACY_COPY');
  }

  // 7. Actionable advice count
  const adviceCount = countActionableAdvice(markdown);
  if (adviceCount < 4) {
    issues.push('NO_ACTIONABLE_ADVICE');
    logger.warn({ bilanId: input.bilanId, adviceCount }, '[validate] NO_ACTIONABLE_ADVICE');
  }

  // 8. At least 2 strengths (proxy: bullet points in section 2)
  const section2Match = markdown.match(/##\s+2\.[\s\S]+?(?=##\s+3\.|$)/);
  if (!section2Match || (section2Match[0].match(/^[-•*]/m) ?? []).length < 1) {
    if (!section2Match || section2Match[0].trim().split(/\n+/).length < 3) {
      issues.push('NO_STRENGTHS');
      logger.warn({ bilanId: input.bilanId }, '[validate] NO_STRENGTHS');
    }
  }

  // 9. At least 2 axes in section 3
  const section3Match = markdown.match(/##\s+3\.[\s\S]+?(?=##\s+4\.|$)/);
  if (!section3Match || section3Match[0].trim().split(/\n+/).length < 4) {
    issues.push('NO_WEAKNESSES');
    logger.warn({ bilanId: input.bilanId }, '[validate] NO_WEAKNESSES');
  }

  // 10. Score interpreted if final assessment exists
  if (
    input.finalAssessment?.approximateScore !== undefined &&
    profile.finalAssessmentReading?.score
  ) {
    const scoreStr = String(input.finalAssessment.approximateScore);
    if (!markdown.includes(scoreStr) && !markdown.match(/\d+\/20/)) {
      issues.push('SCORE_NOT_INTERPRETED');
      logger.warn({ bilanId: input.bilanId }, '[validate] SCORE_NOT_INTERPRETED');
    }
  }

  // 11. Violated doNotSay
  if (input.coachInputs.doNotSay) {
    const forbidden = input.coachInputs.doNotSay.toLowerCase().trim();
    if (forbidden.length > 5 && lowerMarkdown.includes(forbidden)) {
      issues.push('VIOLATED_DO_NOT_SAY');
      logger.warn({ bilanId: input.bilanId }, '[validate] VIOLATED_DO_NOT_SAY');
    }
  }

  // ── Determine quality status ─────────────────────────────────────────────

  const failIssues: ValidationIssue[] = ['EMPTY', 'TOO_SHORT', 'MISSING_SECTIONS', 'LEGACY_COPY', 'FORBIDDEN_TERM'];
  const warnIssues: ValidationIssue[] = ['TOO_LONG', 'NO_ACTIONABLE_ADVICE', 'NO_STRENGTHS', 'NO_WEAKNESSES', 'SCORE_NOT_INTERPRETED', 'VIOLATED_DO_NOT_SAY', 'RAW_MARKDOWN_BOLD_TITLES'];

  const hasFailure = issues.some(i => failIssues.includes(i));
  const hasWarning = issues.some(i => warnIssues.includes(i));

  const qualityStatus: QualityStatus = hasFailure ? 'FAIL' : hasWarning ? 'WARN' : 'PASS';

  logger.info(
    { bilanId: input.bilanId, qualityStatus, issueCount: issues.length, wordCount },
    '[validate] Validation complete',
  );

  return { qualityStatus, issues };
}
