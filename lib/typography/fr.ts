/**
 * French typography formatter.
 *
 * Rules applied:
 * - Straight apostrophe (') → typographic right single quote (\u2019)
 * - Non-breaking space (\u00A0) before high punctuation (: ; ! ?)
 * - Non-breaking space inside « … » guillemets
 * - Three dots (...) → ellipsis (…)
 * - Space in "N %" → non-breaking space
 */
export function frenchTypography(input: string): string {
  let s = input;

  // Straight apostrophe (U+0027) → typographic right single quote (U+2019)
  // Use Unicode property escapes for French accented characters
  s = s.replace(/([\p{L}\p{N}])'([\p{L}\p{N}])/gu, '$1\u2019$2');

  // Non-breaking space before high punctuation
  s = s.replace(/ ([;:!?])/g, '\u00A0$1');

  // Non-breaking space inside guillemets
  s = s.replace(/«\s*/g, '«\u00A0');
  s = s.replace(/\s*»/g, '\u00A0»');

  // Three dots → ellipsis
  s = s.replace(/\.\.\./g, '…');

  // N % → N\u00A0%
  s = s.replace(/(\d)\s*%/g, '$1\u00A0%');

  return s;
}
