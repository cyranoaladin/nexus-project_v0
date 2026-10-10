import { execFileSync } from 'node:child_process';

const SHA = /^[0-9a-f]{40}$/;
const ID = /^[a-z0-9][a-z0-9-]{2,79}$/;
const PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*[\r\n\0])[\w.\-\/[\]()]+$/;
const EXPECTED = new Set(['BLOCKING_EXPECTED', 'NON_BLOCKING_EXPECTED']);
const OUTCOMES = new Set(['BLOCK', 'CLEAN', 'MALFORMED', 'TIMEOUT', 'UNSUPPORTED']);
const DOMAINS = new Set(['correctness', 'security', 'governance', 'runtime']);
const MAX_PATCH_BYTES = 64 * 1024;

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validString = (value) => typeof value === 'string' && value.length > 0 && value.length <= 300;
const rate = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

export function validateCorpus(corpus) {
  if (!object(corpus) || corpus.schemaVersion !== 1 || !Array.isArray(corpus.cases) ||
      !['UNVETTED', 'VETTED'].includes(corpus.reviewStatus) ||
      corpus.cases.length < 40 || corpus.cases.length > 200) throw new Error('CORPUS_INVALID');
  const ids = new Set();
  const commits = new Set();
  let blocking = 0;
  let benign = 0;
  for (const item of corpus.cases) {
    if (!object(item) || !ID.test(item.id ?? '') || ids.has(item.id) ||
        !validString(item.family) || !validString(item.incident) ||
        !DOMAINS.has(item.domain) || !EXPECTED.has(item.expected) ||
        !['P0', 'P1', 'P2'].includes(item.severity) || !object(item.source) ||
        !SHA.test(item.source.commit ?? '') || commits.has(item.source.commit) ||
        !PATH.test(item.source.path ?? '') ||
        !['forward', 'reverse'].includes(item.source.direction) ||
        (item.expected === 'BLOCKING_EXPECTED') !== (item.source.direction === 'reverse')) {
      throw new Error('CORPUS_CASE_INVALID');
    }
    ids.add(item.id);
    commits.add(item.source.commit);
    if (item.expected === 'BLOCKING_EXPECTED') blocking += 1;
    else benign += 1;
  }
  if (blocking < 20 || benign < 20) throw new Error('CORPUS_CLASS_BALANCE_INVALID');
  return corpus;
}

/** Reconstruct from an immutable historical commit; never execute source code. */
export function materializeHistoricalCase(item, { repoRoot } = {}) {
  if (!object(item) || !object(item.source) || !SHA.test(item.source.commit ?? '') ||
      !PATH.test(item.source.path ?? '') ||
      !['forward', 'reverse'].includes(item.source.direction) ||
      typeof repoRoot !== 'string' || !repoRoot.startsWith('/')) {
    throw new Error('CORPUS_PROVENANCE_INVALID');
  }
  const { commit, path, direction } = item.source;
  const before = `${commit}^`;
  const from = direction === 'reverse' ? commit : before;
  const to = direction === 'reverse' ? before : commit;
  let diff;
  try {
    diff = execFileSync('git', ['diff', '--no-ext-diff', '--no-textconv', '--unified=3',
      from, to, '--', path], {
      cwd: repoRoot, encoding: 'utf8', maxBuffer: MAX_PATCH_BYTES + 1,
      timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    throw new Error('CORPUS_PATCH_UNAVAILABLE');
  }
  const hunk = diff.indexOf('\n@@ ');
  const patch = hunk < 0 ? '' : diff.slice(hunk + 1);
  const diffBytes = Buffer.byteLength(patch, 'utf8');
  if (!diff.startsWith('diff --git ') || !patch.startsWith('@@ ') ||
      diffBytes === 0 || diffBytes > MAX_PATCH_BYTES ||
      diff.includes('Binary files ') || diff.includes('GIT binary patch')) {
    throw new Error('CORPUS_PATCH_INVALID');
  }
  return { id: item.id, file: path, diff: patch, diffBytes };
}

/** No labels, incident descriptions, commits or expectations are sent to the reviewer. */
export function toModelData(evidence) {
  if (!object(evidence) || !PATH.test(evidence.file ?? '') ||
      typeof evidence.diff !== 'string' || !evidence.diff.startsWith('@@ ') ||
      Buffer.byteLength(evidence.diff, 'utf8') > MAX_PATCH_BYTES) throw new Error('MODEL_DATA_INVALID');
  return JSON.stringify({ changed_file: evidence.file, diff: evidence.diff });
}

export function validateThresholds(policy) {
  if (!object(policy) || policy.schemaVersion !== 1 ||
      !Number.isSafeInteger(policy.minimumBlockingCases) || policy.minimumBlockingCases < 20 ||
      !Number.isSafeInteger(policy.minimumBenignCases) || policy.minimumBenignCases < 20 ||
      !rate(policy.minimumDetectionRecall) || !rate(policy.minimumSecurityGovernanceRecall) ||
      policy.minimumDetectionRecall < 0.9 ||
      policy.minimumSecurityGovernanceRecall !== 1 ||
      !rate(policy.maximumFalsePositiveRate) || !rate(policy.maximumMalformedOutputRate) ||
      !rate(policy.maximumTimeoutRate) ||
      policy.maximumFalsePositiveRate > 0.05 ||
      policy.maximumMalformedOutputRate > 0.01 || policy.maximumTimeoutRate > 0.01 ||
      !Number.isSafeInteger(policy.maximumP95RuntimeMs) || policy.maximumP95RuntimeMs < 1 ||
      policy.maximumP95RuntimeMs > 480000 ||
      !Number.isSafeInteger(policy.maximumDiffBytes) || policy.maximumDiffBytes < 1 ||
      policy.maximumDiffBytes > MAX_PATCH_BYTES) {
    throw new Error('QUALIFICATION_THRESHOLDS_INVALID');
  }
  return policy;
}

function percentile(values, percentage) {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const rank = (ordered.length - 1) * percentage;
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  return ordered[lower] + (ordered[upper] - ordered[lower]) * (rank - lower);
}

export function scoreQualification(rawCorpus, responses, rawPolicy) {
  const corpus = validateCorpus(rawCorpus);
  const policy = validateThresholds(rawPolicy);
  const blocking = corpus.cases.filter((item) => item.expected === 'BLOCKING_EXPECTED');
  const benign = corpus.cases.filter((item) => item.expected === 'NON_BLOCKING_EXPECTED');
  if (!Array.isArray(responses) || responses.length !== corpus.cases.length ||
      new Set(responses.map((item) => item?.id)).size !== corpus.cases.length ||
      responses.some((item) => !object(item) || !OUTCOMES.has(item.outcome) ||
        !Number.isFinite(item.durationMs) || item.durationMs < 0 ||
        !Number.isSafeInteger(item.diffBytes) || item.diffBytes < 1)) {
    return { qualified: false, reason: 'EVIDENCE_INCOMPLETE_OR_INVALID', metrics: null };
  }
  const byId = new Map(responses.map((item) => [item.id, item]));
  if (corpus.cases.some((item) => !byId.has(item.id))) {
    return { qualified: false, reason: 'EVIDENCE_INCOMPLETE_OR_INVALID', metrics: null };
  }
  const critical = blocking.filter((item) => ['security', 'governance'].includes(item.domain));
  const recall = (items) => items.filter((item) => byId.get(item.id).outcome === 'BLOCK').length / items.length;
  const metrics = {
    detectionRecall: recall(blocking),
    securityGovernanceRecall: critical.length > 0 ? recall(critical) : null,
    falsePositiveRate: benign.filter((item) => byId.get(item.id).outcome === 'BLOCK').length / benign.length,
    malformedOutputRate: responses.filter((item) => item.outcome === 'MALFORMED').length / responses.length,
    timeoutRate: responses.filter((item) => item.outcome === 'TIMEOUT').length / responses.length,
    medianRuntimeMs: percentile(responses.map((item) => item.durationMs), 0.5),
    p95RuntimeMs: percentile(responses.map((item) => item.durationMs), 0.95),
    maxDiffSupportedBytes: Math.max(0, ...responses.filter((item) =>
      ['BLOCK', 'CLEAN'].includes(item.outcome)).map((item) => item.diffBytes)),
  };
  const qualified = blocking.length >= policy.minimumBlockingCases &&
    benign.length >= policy.minimumBenignCases &&
    metrics.detectionRecall >= policy.minimumDetectionRecall &&
    metrics.securityGovernanceRecall === policy.minimumSecurityGovernanceRecall &&
    metrics.falsePositiveRate <= policy.maximumFalsePositiveRate &&
    metrics.malformedOutputRate <= policy.maximumMalformedOutputRate &&
    metrics.timeoutRate <= policy.maximumTimeoutRate &&
    metrics.p95RuntimeMs <= policy.maximumP95RuntimeMs &&
    responses.every((item) => item.diffBytes <= policy.maximumDiffBytes) &&
    responses.every((item) => item.outcome !== 'UNSUPPORTED');
  return {
    qualified: qualified && corpus.reviewStatus === 'VETTED',
    thresholdsMet: qualified,
    reason: !qualified ? 'THRESHOLD_OR_COVERAGE_FAILED' :
      corpus.reviewStatus !== 'VETTED' ? 'CORPUS_VETTING_REQUIRED' : 'PASS',
    metrics,
  };
}
