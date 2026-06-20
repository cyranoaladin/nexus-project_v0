/**
 * Report Quality Control Module
 * Prevents repetitions, copy-paste, and oversized sections in LLM-generated reports
 */

export class ReportQualityError extends Error {
  code = 'REPORT_QUALITY_FAILED';
  issues: string[];

  constructor(issues: string[]) {
    super('Report quality validation failed');
    this.issues = issues;
    Object.setPrototypeOf(this, ReportQualityError.prototype);
  }
}

/**
 * Normalize text for quality comparisons
 * - Lowercase
 * - Remove extra whitespace
 * - Remove final punctuation
 */
export function normalizeTextForQuality(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?;:,"'«»()]+$/, '')
    .replace(/^[«"'(-]+/, '');
}

/**
 * Split text into sentences (French-aware)
 */
export function splitIntoSentences(text: string): string[] {
  // Match sentences ending with . ! ? followed by space or end
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Count words in text (French-aware)
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Collect all text leaves from a nested object
 */
export function collectTextLeaves(value: unknown): string[] {
  const leaves: string[] = [];

  function collect(v: unknown) {
    if (typeof v === 'string' && v.trim().length > 0) {
      leaves.push(v.trim());
    } else if (Array.isArray(v)) {
      v.forEach(collect);
    } else if (typeof v === 'object' && v !== null) {
      Object.values(v).forEach(collect);
    }
  }

  collect(value);
  return leaves;
}

/**
 * Detect repeated text blocks with minimum word count
 */
export function detectRepeatedLongTextBlocks(value: unknown, minWords = 25): string[] {
  const texts = collectTextLeaves(value);
  const blocks = new Map<string, number>(); // normalized -> count
  const issues: string[] = [];

  for (const text of texts) {
    // Extract all possible substrings of sufficient length
    const words = text.split(/\s+/);

    if (words.length >= minWords) {
      // Check the entire text first
      const normalized = normalizeTextForQuality(text);
      const wordCount = countWords(normalized);

      if (wordCount >= minWords) {
        const current = blocks.get(normalized) || 0;
        blocks.set(normalized, current + 1);

        if (current + 1 > 1) {
          // Issue message without content - privacy protection
          issues.push(`Repeated long text block detected (>25 words)`);
        }
      }
    }
  }

  // Also check for partial overlaps between different texts
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const overlap = findLongestCommonSubstring(texts[i], texts[j]);
      if (overlap && countWords(overlap) >= minWords) {
        // Issue message without content - privacy protection
        const issue = `Repeated long text block detected across fields (>25 words)`;
        if (!issues.includes(issue)) {
          issues.push(issue);
        }
      }
    }
  }

  return issues;
}

/**
 * Find longest common substring between two texts (normalized)
 */
function findLongestCommonSubstring(a: string, b: string): string | null {
  const na = normalizeTextForQuality(a);
  const nb = normalizeTextForQuality(b);

  if (na.length < 10 || nb.length < 10) return null;

  // Simple LCS for word sequences
  const wordsA = na.split(/\s+/);
  const wordsB = nb.split(/\s+/);

  let maxLen = 0;
  let endIndex = 0;
  const dp: number[][] = Array(wordsA.length + 1)
    .fill(null)
    .map(() => Array(wordsB.length + 1).fill(0));

  for (let i = 1; i <= wordsA.length; i++) {
    for (let j = 1; j <= wordsB.length; j++) {
      if (wordsA[i - 1] === wordsB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > maxLen) {
          maxLen = dp[i][j];
          endIndex = i;
        }
      }
    }
  }

  if (maxLen >= 5) { // At least 5 consecutive words
    return wordsA.slice(endIndex - maxLen, endIndex).join(' ');
  }

  return null;
}

/**
 * Detect repeated sentences with minimum word count
 */
export function detectRepeatedSentences(value: unknown, minWords = 12): string[] {
  const texts = collectTextLeaves(value);
  const sentences = new Map<string, number>();
  const issues: string[] = [];

  for (const text of texts) {
    const sents = splitIntoSentences(text);
    for (const sent of sents) {
      const normalized = normalizeTextForQuality(sent);
      const wordCount = countWords(normalized);

      if (wordCount >= minWords) {
        const current = sentences.get(normalized) || 0;
        sentences.set(normalized, current + 1);

        if (current + 1 > 1) {
          // Issue message without content - privacy protection
          issues.push(`Repeated long sentence detected (>15 words)`);
        }
      }
    }
  }

  return issues;
}

type DetectOversizedArraysOptions = {
  ignoredPathPrefixes?: string[];
};

/**
 * Detect oversized arrays with configurable exclusions
 */
export function detectOversizedArrays(
  value: unknown,
  maxItems = 8,
  options?: DetectOversizedArraysOptions,
): string[] {
  const issues: string[] = [];
  const ignoredPrefixes = options?.ignoredPathPrefixes ?? [];

  function scan(path: string, v: unknown) {
    // Check if path should be ignored
    if (ignoredPrefixes.some(prefix => path.startsWith(prefix))) {
      return;
    }

    if (Array.isArray(v) && v.length > maxItems) {
      // Issue message with path but no content - privacy protection
      issues.push(`Oversized array detected at path: ${path}`);
    }

    if (typeof v === 'object' && v !== null) {
      for (const [key, val] of Object.entries(v)) {
        scan(path ? `${path}.${key}` : key, val);
      }
    }
  }

  scan('', value);
  return issues;
}

/**
 * Main validation function
 */
export function validateReportWritingQuality(value: unknown): { ok: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check for repeated long text blocks (>25 words)
  const repeatedBlocks = detectRepeatedLongTextBlocks(value, 25);
  issues.push(...repeatedBlocks);

  // Check for repeated long sentences (>15 words)
  const repeatedSentences = detectRepeatedSentences(value, 15);
  issues.push(...repeatedSentences);

  // Check for oversized arrays (>8 items), ignoring functional paths
  const oversizedArrays = detectOversizedArrays(value, 8, {
    ignoredPathPrefixes: ['qualityFlags'],
  });
  issues.push(...oversizedArrays);

  // Limit total issues to avoid log flooding
  const truncatedIssues = issues.slice(0, 10);

  return {
    ok: truncatedIssues.length === 0,
    issues: truncatedIssues,
  };
}
