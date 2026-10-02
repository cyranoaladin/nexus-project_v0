import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const riskConfig = require('./config.json');
const SHA = /^[0-9a-f]{40}$/;
const STATUSES = new Set(['added', 'modified', 'removed', 'renamed', 'copied', 'changed']);
const WORKFLOW = '.github/workflows/';

function validPath(path) {
  return typeof path === 'string' && path.length > 0 && !path.startsWith('/') &&
    !/[\\\x00-\x1f\x7f]/.test(path) &&
    path.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..');
}

function changedLines(patch) {
  return patch.split('\n').filter((line) =>
    /^[+-]/.test(line));
}

// A GitHub REST patch can be omitted or truncated independently of the file
// statistics. Never classify a partial patch as an ordinary change.
function completePatch(file) {
  if (![file.additions, file.deletions, file.changes].every((value) =>
    Number.isSafeInteger(value) && value >= 0) ||
      file.changes !== file.additions + file.deletions) return false;
  let oldLines = 0;
  let newLines = 0;
  let sawHunk = false;
  let additions = 0;
  let deletions = 0;
  const patchLines = file.patch.split('\n');
  for (const [index, line] of patchLines.entries()) {
    if (line.startsWith('@@')) {
      if (sawHunk && (oldLines !== 0 || newLines !== 0)) return false;
      const match = /^@@ -(?:0|[1-9]\d*)(?:,(0|[1-9]\d*))? \+(?:0|[1-9]\d*)(?:,(0|[1-9]\d*))? @@(?: .*)?$/.exec(line);
      if (!match) return false;
      oldLines = match[1] === undefined ? 1 : Number(match[1]);
      newLines = match[2] === undefined ? 1 : Number(match[2]);
      if (!Number.isSafeInteger(oldLines) || !Number.isSafeInteger(newLines)) return false;
      sawHunk = true;
    } else if (line.startsWith('+')) {
      if (!sawHunk) return false;
      additions += 1;
      newLines -= 1;
    } else if (line.startsWith('-')) {
      if (!sawHunk) return false;
      deletions += 1;
      oldLines -= 1;
    } else if (line.startsWith(' ')) {
      if (!sawHunk) return false;
      oldLines -= 1;
      newLines -= 1;
    } else if (line === '\\ No newline at end of file') {
      if (!sawHunk) return false;
    } else if (line !== '' || index !== patchLines.length - 1) {
      return false;
    }
    if (oldLines < 0 || newLines < 0) return false;
  }
  return sawHunk && oldLines === 0 && newLines === 0 &&
    additions === file.additions && deletions === file.deletions;
}

function pathReason(path) {
  if (path === '.github/CODEOWNERS' || path.startsWith('.github/governance/') ||
      path.startsWith('scripts/github/') || path.startsWith('__tests__/governance/') ||
      (path.startsWith(WORKFLOW) && /(?:^|[-_])review(?:[-_.])/i.test(path.slice(WORKFLOW.length))) ||
      path === '.github/workflows/governance-live-audit.yml') return 'GOV_SELF_MODIFICATION';
  if (path === '.github/workflows/ci.yml' || path === 'jest.config.governance.js') {
    return 'CI_PROTECTION_CHANGE';
  }
  if (path === '.github/workflows/preview-artifact.yml' ||
      /^\.github\/workflows\/.*(?:deploy|release).*\.ya?ml$/i.test(path) ||
      /^scripts\/(?:deploy(?:\/|[-.])|prepare-deployment\.sh)/i.test(path) ||
      path.startsWith('scripts/release/') || path === 'scripts/audit-production-artifact.js') {
    return 'PRODUCTION_DEPLOY_ACCESS_CHANGE';
  }
  if (path === 'scripts/security/check-versioned-credentials.mjs') {
    return 'CREDENTIAL_SURFACE_CHANGE';
  }
  if (/(?:^|\/)(?:secrets?|credentials?)(?:\/|[._-]|$)/i.test(path) ||
      /(?:^|\/)\.env(?:\.|$)/i.test(path)) return 'CREDENTIAL_SURFACE_CHANGE';
  return null;
}

function contentReasons(path, lines) {
  const delta = lines.join('\n');
  const added = lines.filter((line) => line.startsWith('+')).join('\n');
  const reasons = [];
  if (/\b[A-Z][A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|CREDENTIAL|API_KEY|PRIVATE_KEY)[A-Z0-9_]*\b\s*[:=]\s*['"]?[^\s'";]{12,}/i.test(added) ||
      /-----BEGIN\s+(?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(added)) {
    reasons.push('NEW_SECRET_VALUE');
  }
  if (/\bbypass[_-]?actors?\b|\b(?:new[_-]?governance[_-]?exception)\b/i.test(delta)) {
    reasons.push('NEW_GOVERNANCE_EXCEPTION_OR_BYPASS_ACTOR');
  }
  // A workflow's executable change can alter the Actions token or invoke new
  // code even when the diff does not literally mention a secret or permission.
  // Comment and display-name edits remain on the ordinary path.
  if (path.startsWith(WORKFLOW) && !pathReason(path) && lines.some((line) => {
    const content = line.slice(1).trim();
    return content.length > 0 && !content.startsWith('#') &&
      !/^(?:name|description):/.test(content);
  })) {
    reasons.push('PRIVILEGED_WORKFLOW_CHANGE');
  }
  if (path === 'package.json' &&
      /(?:test:governance|governance:audit|check-versioned-credentials|security:|ci:)/i.test(delta)) {
    reasons.push('CI_PROTECTION_CHANGE');
  }
  if (path.startsWith('prisma/migrations/') &&
      /\b(?:DROP\s+(?:TABLE|COLUMN|SCHEMA|INDEX|CONSTRAINT|TYPE)|TRUNCATE(?:\s+TABLE)?|DELETE\s+FROM|UPDATE\s+\S+\s+SET|ALTER\s+TABLE\s+\S+\s+ALTER\s+COLUMN)\b/i.test(delta)) {
    reasons.push('DESTRUCTIVE_OR_IRREVERSIBLE_DATA_CHANGE');
  }
  if (/\b(?:prisma|db)\.[A-Za-z_$][\w$]*\.(?:deleteMany|delete|updateMany)\s*\(/.test(added) ||
      /\b(?:DROP\s+(?:TABLE|COLUMN|SCHEMA)|TRUNCATE(?:\s+TABLE)?|DELETE\s+FROM)\b/i.test(added)) {
    reasons.push('DESTRUCTIVE_OR_IRREVERSIBLE_DATA_CHANGE');
  }
  return reasons;
}

function unclassified(reason) {
  return { classification: 'UNCLASSIFIED', humanExceptionRequired: true, reasons: [reason] };
}

export function classifyRisk(files) {
  if (!Array.isArray(files) || files.length === 0) return unclassified('DIFF_UNAVAILABLE');
  if (riskConfig.schemaVersion !== 1 || !Number.isSafeInteger(riskConfig.maxPatchBytes)) {
    return unclassified('RISK_CONFIG_INVALID');
  }
  const reasons = new Set();
  for (const file of files) {
    if (!file || !validPath(file.filename) || !STATUSES.has(file.status) ||
        ((file.status === 'renamed' || file.status === 'copied') && !validPath(file.previous_filename))) {
      return unclassified('DIFF_FILE_INVALID');
    }
    if (typeof file.patch !== 'string' || file.patch.length === 0) return unclassified('DIFF_INCOMPLETE');
    if (Buffer.byteLength(file.patch, 'utf8') > riskConfig.maxPatchBytes) {
      return unclassified('DIFF_OVERSIZED');
    }
    if (!completePatch(file)) return unclassified('DIFF_INCOMPLETE');
    const lines = changedLines(file.patch);
    if (lines.length === 0) return unclassified('DIFF_INCOMPLETE');
    for (const path of [file.filename, file.previous_filename].filter(Boolean)) {
      const reason = pathReason(path);
      if (reason) reasons.add(reason);
      for (const contentReason of contentReasons(path, lines)) reasons.add(contentReason);
      if (path.startsWith('prisma/migrations/') && !path.endsWith('.sql')) {
        return unclassified('MIGRATION_FORMAT_UNCLASSIFIED');
      }
    }
  }
  if (reasons.size === 0) return { classification: 'NORMAL', humanExceptionRequired: false, reasons: [] };
  return { classification: 'SENSITIVE', humanExceptionRequired: true, reasons: [...reasons] };
}

export function applicableHumanApproval({ headSha, reviews, reviewsComplete } = {}) {
  const absent = { approved: false, approver: null, reason: 'NO_APPLICABLE_APPROVAL' };
  if (!SHA.test(headSha ?? '') || reviewsComplete !== true || !Array.isArray(reviews) ||
      riskConfig.schemaVersion !== 1 || !Array.isArray(riskConfig.humanApprovers) ||
      !riskConfig.humanApprovers.every((approver) => typeof approver === 'string') ||
      reviews.some((review) => !Number.isSafeInteger(review?.id) || review.id <= 0 ||
        typeof review?.user?.login !== 'string' || typeof review.state !== 'string')) return absent;
  for (const approver of riskConfig.humanApprovers) {
    const decisive = reviews.filter((review) =>
      review.user.login.toLowerCase() === approver &&
      ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state));
    if (decisive.some((review) => !Number.isSafeInteger(review.id) || review.id <= 0) ||
        new Set(decisive.map((review) => review.id)).size !== decisive.length) return absent;
    const latest = [...decisive].sort((a, b) => b.id - a.id)[0];
    if (latest?.state === 'APPROVED' && latest.commit_id === headSha) {
      return { approved: true, approver, reason: 'APPLICABLE_APPROVAL' };
    }
  }
  return absent;
}
