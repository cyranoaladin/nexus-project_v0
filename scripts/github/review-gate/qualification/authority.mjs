import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SHA256 = /^[0-9a-f]{64}$/;
const SHA = /^[0-9a-f]{40}$/;
const BUNDLE_FILES = [
  'scripts/github/review-gate/policy.mjs',
  'scripts/github/review-gate/risk.mjs',
  'scripts/github/review-gate/decision.mjs',
  'scripts/github/review-gate/semantic.mjs',
  'scripts/github/review-gate/model-runner.mjs',
  'scripts/github/review-gate/qualification/corpus.json',
  'scripts/github/review-gate/qualification/harness.mjs',
  'scripts/github/review-gate/qualification/evaluate.mjs',
  'scripts/github/review-gate/qualification/thresholds.json',
  'scripts/github/review-gate/qualification/review-output.schema.json',
];

export function reviewerBundleSha256(repoRoot) {
  if (typeof repoRoot !== 'string' || !repoRoot.startsWith('/')) {
    throw new Error('REVIEWER_BUNDLE_ROOT_INVALID');
  }
  const hash = createHash('sha256');
  for (const name of BUNDLE_FILES) {
    hash.update(name);
    hash.update('\0');
    hash.update(readFileSync(resolve(repoRoot, name)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function selectQualifiedAuthority({ manifest, corpus, report,
  actualReportSha256, actualBundleSha256 } = {}) {
  if (manifest?.authorityStatus === 'UNQUALIFIED' && manifest.selectedModel === null) return null;
  const candidate = manifest?.candidates?.find((item) => item?.id === manifest.selectedModel);
  const evidence = manifest?.qualificationEvidence;
  if (manifest?.authorityStatus !== 'QUALIFIED' || !candidate ||
      corpus?.reviewStatus !== 'VETTED' || report?.qualified !== true ||
      report.thresholdsMet !== true || report.reason !== 'PASS' ||
      report.heldoutVerified !== true || report.corpusReviewStatus !== 'VETTED' ||
      report.candidateId !== candidate.id || report.modelSha256 !== candidate.sha256 ||
      !SHA.test(report.sourceSha ?? '') || report.sourceSha !== evidence?.sourceSha ||
      !SHA256.test(actualReportSha256 ?? '') || actualReportSha256 !== evidence?.reportSha256 ||
      !SHA256.test(actualBundleSha256 ?? '') || actualBundleSha256 !== evidence?.bundleSha256 ||
      report.bundleSha256 !== actualBundleSha256) {
    throw new Error('MODEL_AUTHORITY_UNPROVEN');
  }
  return candidate;
}

export function loadQualifiedAuthority(repoRoot) {
  if (typeof repoRoot !== 'string' || !repoRoot.startsWith('/')) {
    throw new Error('MODEL_AUTHORITY_ROOT_INVALID');
  }
  const path = (name) => resolve(repoRoot, `scripts/github/review-gate/qualification/${name}`);
  const manifest = JSON.parse(readFileSync(path('models.json'), 'utf8'));
  if (manifest.authorityStatus === 'UNQUALIFIED' && manifest.selectedModel === null) return null;
  const corpus = JSON.parse(readFileSync(path('corpus.json'), 'utf8'));
  const reportBytes = readFileSync(path('authority-report.json'));
  const report = JSON.parse(reportBytes.toString('utf8'));
  const actualReportSha256 = createHash('sha256').update(reportBytes).digest('hex');
  const actualBundleSha256 = reviewerBundleSha256(repoRoot);
  const candidate = selectQualifiedAuthority({ manifest, corpus, report,
    actualReportSha256, actualBundleSha256 });
  return { candidate, runtime: manifest.runtime };
}
