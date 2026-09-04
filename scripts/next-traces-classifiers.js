/**
 * Pure classification helpers for validate-next-traces.js — extracted so
 * they can be unit-tested without executing the CLI script's filesystem
 * walk (which runs immediately at require-time otherwise).
 */
const path = require('node:path');

// Safe .env suffixes — files ending with these are not considered real secrets.
const envSafeSuffixes = ['.example', '.sample', '.template'];

function isRealEnvFile(filePath) {
  const name = path.basename(filePath);
  if (!/^\.env/i.test(name)) return false;
  // A `.diff` of an already-safe example/sample/template file (e.g. produced
  // by audit tooling comparing two branches' env templates) carries no more
  // risk than the file it diffs — strip a trailing .diff before the safety
  // check. This does NOT relax the check for a diff of a REAL .env file
  // (e.g. ".env.diff"), which still has no safe suffix once stripped.
  const nameForSafetyCheck = name.endsWith('.diff') ? name.slice(0, -'.diff'.length) : name;
  return !envSafeSuffixes.some((s) => nameForSafetyCheck.endsWith(s));
}

// Hard errors: actual secrets or unsafe content in traces.
// These indicate files that must NEVER be present in traced references.
const errorPatterns = [
  { pattern: /\.(pem|key|p12|pfx)$/i, reason: 'secret key file' },
  { pattern: null, test: isRealEnvFile, reason: 'real .env file' },
  { pattern: /(^|\/)\.worktrees(\/|$)/, reason: '.worktrees directory' },
  { pattern: /(^|\/)\.git(\/|$)/, reason: '.git directory' },
  { pattern: /(^|\/)e2e\/fixtures?(\/|$)/, reason: 'E2E fixture' },
  { pattern: /\.(bak|dump|sql\.gz)$/i, reason: 'backup or dump file' },
];

// Absolute local path patterns (never valid in traced references)
const absoluteLocalPattern = /^\/home\/|^\/Users\/|^C:\\Users\\/;

// Soft warnings: files that Next.js traces but typically doesn't ship to standalone.
// The standalone artifact audit verifies these are not physically present.
const warningPatterns = [
  { pattern: /(^|\/)__tests__(\/|$)/, reason: 'test file reference' },
  { pattern: /(^|\/)__mocks__(\/|$)/, reason: 'mock file reference' },
  { pattern: /(^|\/)e2e(\/|$)/, reason: 'e2e file reference' },
  { pattern: /(^|\/)fixtures?(\/|$)/, reason: 'fixture reference' },
];

function classifyFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (['.js', '.mjs', '.cjs'].includes(ext)) return 'javascript';
  if (['.ts', '.tsx'].includes(ext)) return 'typescript';
  if (['.json'].includes(ext)) return 'json';
  if (['.node'].includes(ext)) return 'native-addon';
  if (['.css', '.scss', '.sass'].includes(ext)) return 'style';
  if (['.wasm'].includes(ext)) return 'wasm';
  return 'other';
}

module.exports = {
  isRealEnvFile,
  errorPatterns,
  absoluteLocalPattern,
  warningPatterns,
  classifyFile,
};
