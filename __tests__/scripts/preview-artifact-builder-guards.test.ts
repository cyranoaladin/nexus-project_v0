import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  validateSourceSelection,
  validateRequiredStatusChecks,
  validateWorkflowQualification,
  validateRequiredPolicy,
  validateJitsiServerUrl,
  compiledBundleContainsConfiguredJitsiUrl,
  validateJitsiCspHeader,
} from '../../scripts/release/preview-artifact-builder-guards';
import { validateArchiveEntries } from '../../scripts/release/verify-preview-archive';

const sha = 'a'.repeat(40);
const required = [
  {
    context: 'CI Success',
    required: true,
    producer: { kind: 'GITHUB_ACTIONS_WORKFLOW', workflowPath: '.github/workflows/ci.yml' },
  },
  {
    context: 'GitGuardian Security Checks',
    required: true,
    producer: { kind: 'EXTERNAL_APP', appName: 'GitGuardian' },
  },
];

describe('Preview artifact builder source and provenance guards', () => {
  it('does not accept a caller-selected application SHA or configure a shared Node cache', () => {
    const workflow = readFileSync(resolve(__dirname, '../../.github/workflows/preview-artifact.yml'), 'utf8');
    expect(workflow).not.toContain('inputs.source_sha');
    expect(workflow).not.toMatch(/^\s+source_sha:/m);
    expect(workflow).toContain('ref: ${{ github.sha }}');
    expect(workflow).toContain('Deliberately no setup-node cache');
  });

  it('uses only the immutable workflow dispatch commit on main', () => {
    expect(validateSourceSelection({
      eventName: 'workflow_dispatch', ref: 'refs/heads/main', workflowSha: sha,
    })).toEqual([]);
    expect(validateSourceSelection({
      eventName: 'workflow_dispatch', ref: 'refs/heads/feature', workflowSha: sha,
    })).toContain('WORKFLOW_REF_NOT_MAIN');
    expect(validateSourceSelection({
      eventName: 'pull_request', ref: 'refs/heads/main', workflowSha: sha,
    })).toContain('WORKFLOW_EVENT_NOT_DISPATCH');
  });

  it('requires every protected status on the exact SHA from its declared producer', () => {
    const checks = [
      { name: 'CI Success', head_sha: sha, status: 'completed', conclusion: 'success', app: { name: 'GitHub Actions' }, started_at: '2026-09-30T10:00:00Z' },
      { name: 'GitGuardian Security Checks', head_sha: sha, status: 'completed', conclusion: 'success', app: { name: 'GitGuardian' }, started_at: '2026-09-30T10:00:00Z' },
      { name: 'Optional review bot', head_sha: sha, status: 'completed', conclusion: 'neutral', app: { name: 'Review Bot' }, started_at: '2026-09-30T10:00:00Z' },
    ];
    expect(validateRequiredStatusChecks(checks, required, sha).errors).toEqual([]);
    expect(validateRequiredStatusChecks(checks.slice(1), required, sha).errors)
      .toContain('REQUIRED_CHECK_MISSING:CI Success');
    expect(validateRequiredStatusChecks([
      { ...checks[0], conclusion: 'neutral' }, checks[1],
    ], required, sha).errors).toContain('REQUIRED_CHECK_NOT_SUCCESS:CI Success:neutral');
    expect(validateRequiredStatusChecks([
      { ...checks[0], head_sha: 'b'.repeat(40) }, checks[1],
    ], required, sha).errors).toContain('REQUIRED_CHECK_MISSING:CI Success');
    expect(validateRequiredStatusChecks([
      { ...checks[0], app: { name: 'Other App' } }, checks[1],
    ], required, sha).errors).toContain('REQUIRED_CHECK_WRONG_PRODUCER:CI Success');
  });

  it('requires a successful workflow run for the exact source SHA and declared workflow path', () => {
    const runs = [{
      head_sha: sha,
      path: '.github/workflows/ci.yml',
      event: 'push',
      status: 'completed',
      conclusion: 'success',
      head_branch: 'main',
    }];
    expect(validateWorkflowQualification(runs, '.github/workflows/ci.yml', sha).errors).toEqual([]);
    expect(validateWorkflowQualification(runs, '.github/workflows/ci.yml', 'b'.repeat(40)).errors)
      .toContain('QUALIFYING_WORKFLOW_RUN_MISSING');
    expect(validateWorkflowQualification([{ ...runs[0], conclusion: 'neutral' }], '.github/workflows/ci.yml', sha).errors)
      .toContain('QUALIFYING_WORKFLOW_RUN_MISSING');
  });

  it('fails closed when the check registry and current protection contexts differ', () => {
    expect(validateRequiredPolicy(required, {
      current: { rules: { requiredStatusChecks: { contexts: ['CI Success', 'GitGuardian Security Checks'] } } },
    }).errors).toEqual([]);
    expect(validateRequiredPolicy(required, {
      current: { rules: { requiredStatusChecks: { contexts: ['CI Success'] } } },
    }).errors).toContain('REQUIRED_CHECK_REGISTRY_RULESET_MISMATCH');
  });

  it('rejects unapproved Jitsi hostnames and proves the configured value is consumed in client JS', () => {
    expect(validateJitsiServerUrl('https://video.example.org')).toEqual([]);
    expect(validateJitsiServerUrl('https://jitsi-ci.nexus-e2e.test')).toContain('JITSI_URL_MUST_NOT_USE_TEST_OR_LOCAL_HOST');
    expect(validateJitsiServerUrl('https://meet.jit.si')).toContain('JITSI_URL_MUST_NOT_USE_PUBLIC_FALLBACK');
    expect(compiledBundleContainsConfiguredJitsiUrl([
      'const message="example.test is a fixture message";',
      'const activeServer="https://video.example.org";',
    ], 'https://video.example.org')).toBe(true);
    expect(compiledBundleContainsConfiguredJitsiUrl(['const activeServer="https://other.example.org";'], 'https://video.example.org'))
      .toBe(false);
    expect(validateJitsiCspHeader(
      "frame-src 'self' https://video.example.org https://*.jitsi.net",
      'https://video.example.org',
    )).toEqual([]);
    expect(validateJitsiCspHeader(
      "frame-src 'self' https://meet.jit.si",
      'https://video.example.org',
    )).toContain('JITSI_CSP_CONFIGURED_ORIGIN_MISSING');
    expect(validateJitsiCspHeader(
      "frame-src 'self' https://video.example.org https://meet.jit.si",
      'https://video.example.org',
    )).toContain('JITSI_CSP_PUBLIC_FALLBACK_ACTIVE');
    expect(validateJitsiCspHeader(
      "frame-src 'self' https://video.example.org https://meet.jit.si.attacker.example",
      'https://video.example.org',
    )).toEqual([]);
    expect(validateJitsiCspHeader(
      "frame-src 'self' https://video.example.org https://attacker.example/https://meet.jit.si",
      'https://video.example.org',
    )).toEqual([]);
  });

  it('requires a safe deployable archive with hidden standalone files and preserved executable modes', () => {
    const valid = [
      { path: './server.js', type: 'File', mode: 0o644 },
      { path: './.next/BUILD_ID', type: 'File', mode: 0o644 },
      { path: './.next/static', type: 'Directory', mode: 0o755 },
      { path: './public', type: 'Directory', mode: 0o755 },
      { path: './release-manifest.json', type: 'File', mode: 0o644 },
      { path: './node_modules/.bin/example', type: 'File', mode: 0o755 },
    ];
    expect(validateArchiveEntries(valid)).toEqual([]);
    expect(validateArchiveEntries(valid, new Map([['server.js', 0o755]])))
      .toContain('ARCHIVE_MODE_NOT_PRESERVED:server.js');
    expect(validateArchiveEntries(valid.filter((entry) => entry.path !== './.next/BUILD_ID')))
      .toContain('ARCHIVE_REQUIRED_PATH_MISSING:.next/BUILD_ID');
    expect(validateArchiveEntries([...valid, { path: '../../outside', type: 'File', mode: 0o644 }]))
      .toContain('ARCHIVE_PATH_TRAVERSAL:../../outside');
    expect(validateArchiveEntries([...valid, { path: './unsafe', type: 'File', mode: 0o666 }]))
      .toContain('ARCHIVE_WORLD_WRITABLE_ENTRY:unsafe');
  });
});
