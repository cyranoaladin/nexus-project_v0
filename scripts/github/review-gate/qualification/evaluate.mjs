import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseSemanticResponse } from '../semantic.mjs';
import { runThreePassReview } from '../model-runner.mjs';
import { materializeHistoricalCase, scoreQualification, validateCorpus } from './harness.mjs';
import { reviewerBundleSha256 } from './authority.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(readFileSync(join(here, name), 'utf8'));

export function classifyModelCase({ file, outputs } = {}) {
  if (typeof file !== 'string' || !outputs ||
      Object.keys(outputs).length !== 3 ||
      !['correctness', 'security', 'runtime'].every((pass) => Object.hasOwn(outputs, pass))) {
    return 'MALFORMED';
  }
  const findings = [];
  for (const pass of ['correctness', 'security', 'runtime']) {
    const parsed = parseSemanticResponse(outputs[pass], new Set([file]));
    if (!parsed) return 'MALFORMED';
    findings.push(...parsed.blocking_findings);
  }
  return findings.length > 0 ? 'BLOCK' : 'CLEAN';
}

export async function evaluateCandidate({ candidateId, modelPath, binaryPath,
  repoRoot, outputPath } = {}) {
  const manifest = load('models.json');
  const corpus = validateCorpus(load('corpus.json'));
  const thresholds = load('thresholds.json');
  const candidate = manifest.candidates.find((item) => item.id === candidateId);
  if (!candidate || ![modelPath, binaryPath, repoRoot, outputPath].every((item) =>
    typeof item === 'string' && item.startsWith('/'))) throw new Error('EVALUATION_CONFIG_INVALID');
  const responses = [];
  for (const item of corpus.cases) {
    const source = materializeHistoricalCase(item, { repoRoot });
    const start = performance.now();
    let outcome;
    let failureReason = null;
    try {
      // A reversed fix is a synthetic regression, not the historical fix
      // commit. Give the model a stable case identifier without falsely
      // presenting the fixing commit as the reviewed head.
      const caseSha = createHash('sha1').update(source.diff).digest('hex');
      const outputs = await runThreePassReview({ headSha: caseSha,
        files: [{ filename: item.source.path, patch: source.diff }],
        modelPath, binaryPath, schemaPath: join(here, 'review-output.schema.json'),
        contextTokens: candidate.contextTokens });
      outcome = classifyModelCase({ file: item.source.path, outputs });
    } catch (error) {
      const allowedReasons = new Set(['MODEL_TIMEOUT', 'DIFF_UNSUPPORTED',
        'MODEL_MISSING_RUNTIME_LIBRARY', 'MODEL_SCHEMA_REJECTED',
        'MODEL_ARGUMENT_REJECTED', 'MODEL_LOAD_FAILED', 'MODEL_PROCESS_FAILED',
        'MODEL_OUTPUT_TOO_LARGE', 'MODEL_START_FAILED', 'MODEL_CONFIG_INVALID',
        'MODEL_EXECUTION_FAILED']);
      failureReason = allowedReasons.has(error?.message) ? error.message : 'UNCLASSIFIED_FAILURE';
      outcome = error?.message === 'MODEL_TIMEOUT' ? 'TIMEOUT' :
        error?.message === 'DIFF_UNSUPPORTED' ? 'UNSUPPORTED' : 'MALFORMED';
    }
    responses.push({ id: item.id, outcome, diffBytes: source.diffBytes,
      durationMs: Math.round(performance.now() - start), failureReason });
  }
  const assessment = scoreQualification(corpus, responses, thresholds);
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot,
    encoding: 'utf8', timeout: 10_000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const report = {
    sourceSha, bundleSha256: reviewerBundleSha256(repoRoot), heldoutVerified: false,
    candidateId, modelSource: candidate.source, modelRevision: candidate.revision,
    modelSha256: candidate.sha256, runtimeRevision: manifest.runtime.revision,
    runtimeArchiveSha256: manifest.runtime.archiveSha256,
    corpusReviewStatus: corpus.reviewStatus, corpusSize: corpus.cases.length,
    ...assessment, responses,
  };
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return report;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const report = await evaluateCandidate({ candidateId: process.argv[2],
      modelPath: process.env.REVIEW_GATE_MODEL_PATH,
      binaryPath: process.env.REVIEW_GATE_BINARY_PATH,
      repoRoot: resolve(process.env.GITHUB_WORKSPACE ?? '.'),
      outputPath: resolve(process.env.REVIEW_GATE_REPORT_PATH ?? 'review-gate-model-report.json') });
    process.stdout.write(`${JSON.stringify({ candidateId: report.candidateId,
      qualified: report.qualified, thresholdsMet: report.thresholdsMet,
      reason: report.reason, metrics: report.metrics })}\n`);
  } catch (error) {
    process.stderr.write(`MODEL_QUALIFICATION_FAILED=${error?.message ?? 'UNKNOWN'}\n`);
    process.exitCode = 1;
  }
}
