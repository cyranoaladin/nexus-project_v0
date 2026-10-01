import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  validateSourceSelection,
  validateRequiredStatusChecks,
  validateGitGuardianMergeEvidence,
  validateWorkflowQualification,
  validateRequiredPolicy,
  validateJitsiServerUrl,
  compiledBundleContainsConfiguredJitsiUrl,
  validateJitsiCspHeader,
  validateVideoDispatch,
  validateVideoCspHeader,
  validateVideoPermissionsPolicyHeader,
} from '../../scripts/release/preview-artifact-builder-guards';
import { validateArchiveEntries } from '../../scripts/release/verify-preview-archive';

const sha = 'a'.repeat(40);
const required = [
  {
    context: 'CI Success',
    required: true,
    producer: { kind: 'GITHUB_ACTIONS_WORKFLOW', workflowPath: '.github/workflows/ci.yml', integrationId: 15368 },
  },
  {
    context: 'GitGuardian Security Checks',
    required: true,
    producer: { kind: 'EXTERNAL_APP', appName: 'GitGuardian', integrationId: 46505 },
  },
];

describe('Preview artifact builder source and provenance guards', () => {
  it('does not accept a caller-selected application SHA or configure a shared Node cache', () => {
    const workflow = readFileSync(resolve(__dirname, '../../.github/workflows/preview-artifact.yml'), 'utf8');
    expect(workflow).not.toContain('inputs.source_sha');
    expect(workflow).not.toMatch(/^\s+source_sha:/m);
    expect(workflow).toContain('ref: ${{ github.sha }}');
    expect(workflow).toContain('Deliberately no setup-node cache');
    expect(workflow).toMatch(/^  pull-requests: read$/m);
  });

  it('dispatches with an explicit video mode and carries it through build and provenance', () => {
    const workflow = readFileSync(resolve(__dirname, '../../.github/workflows/preview-artifact.yml'), 'utf8');
    expect(workflow).toMatch(/preview_video_mode:\n\s+description:.*\n\s+required: true\n\s+type: string/);
    expect(workflow).toMatch(/preview_jitsi_server_url:\n\s+description:.*\n\s+required: false/);
    expect(workflow).toContain('validateVideoDispatch(process.env.REQUESTED_VIDEO_MODE, process.env.REQUESTED_JITSI_URL)');
    expect(workflow).toContain('NEXT_PUBLIC_VIDEO_MODE: ${{ inputs.preview_video_mode }}');
    expect(workflow).toContain('NEXT_PUBLIC_VIDEO_MODE: process.env.NEXT_PUBLIC_VIDEO_MODE');
    expect(workflow).toContain('manifest.VIDEO_MODE !== process.env.NEXT_PUBLIC_VIDEO_MODE');
    expect(workflow).toContain('validateVideoCspHeader');
    expect(workflow).toContain('validateVideoPermissionsPolicyHeader');
    expect(workflow).not.toContain('for key in NEXTAUTH_SECRET RATE_LIMIT_KEY_SECRET JITSI_ROOM_SECRET');
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
      { name: 'CI Success', head_sha: sha, status: 'completed', conclusion: 'success', app: { id: 15368, name: 'GitHub Actions' }, started_at: '2026-09-30T10:00:00Z' },
      { name: 'GitGuardian Security Checks', head_sha: sha, status: 'completed', conclusion: 'success', app: { id: 46505, name: 'GitGuardian' }, started_at: '2026-09-30T10:00:00Z' },
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
    expect(validateRequiredStatusChecks([
      checks[0], { ...checks[1], app: { id: 1, name: 'GitGuardian' } },
    ], required, sha).errors).toContain('REQUIRED_CHECK_WRONG_PRODUCER:GitGuardian Security Checks');
  });

  it('accepts authentic GitGuardian PR evidence only for an identical merged tree', () => {
    const baseSha = 'b'.repeat(40);
    const headSha = 'c'.repeat(40);
    const treeSha = 'd'.repeat(40);
    const evidence = {
      sourceSha: sha,
      repository: 'cyranoaladin/nexus-project_v0',
      mergeCommit: {
        sha,
        parents: [{ sha: baseSha }, { sha: headSha }],
        commit: { tree: { sha: treeSha } },
      },
      associatedPullRequests: [{
        number: 328,
        state: 'closed',
        merged_at: '2026-09-30T20:23:29Z',
        merge_commit_sha: sha,
        head: { sha: headSha, repo: { full_name: 'cyranoaladin/nexus-project_v0' } },
        base: { sha: baseSha, ref: 'main', repo: { full_name: 'cyranoaladin/nexus-project_v0' } },
      }],
      headCommit: { sha: headSha, commit: { tree: { sha: treeSha } } },
      headCheckRuns: [{
        id: 110058061838,
        name: 'GitGuardian Security Checks',
        head_sha: headSha,
        status: 'completed',
        conclusion: 'success',
        app: { id: 46505, name: 'GitGuardian' },
        started_at: '2026-09-30T19:23:47Z',
      }],
      requirement: required[1],
    };
    expect(validateGitGuardianMergeEvidence(evidence)).toEqual({
      passed: true, errors: [], pullRequestNumber: 328, headSha, checkRunId: 110058061838,
    });
    expect(validateGitGuardianMergeEvidence({ ...evidence, sourceSha: 'e'.repeat(40) }).passed).toBe(false);
    expect(validateGitGuardianMergeEvidence({ ...evidence, headCommit: {
      sha: headSha, commit: { tree: { sha: 'e'.repeat(40) } },
    } }).passed).toBe(false);
    expect(validateGitGuardianMergeEvidence({ ...evidence, associatedPullRequests: [] }).passed).toBe(false);
    expect(validateGitGuardianMergeEvidence({ ...evidence, associatedPullRequests: [
      ...evidence.associatedPullRequests, ...evidence.associatedPullRequests,
    ] }).passed).toBe(false);
    expect(validateGitGuardianMergeEvidence({ ...evidence, associatedPullRequests: [
      ...evidence.associatedPullRequests,
      { ...evidence.associatedPullRequests[0], number: 329, merge_commit_sha: 'e'.repeat(40) },
    ] }).passed).toBe(false);
    expect(validateGitGuardianMergeEvidence({ ...evidence, associatedPullRequests: [{
      ...evidence.associatedPullRequests[0], head: {
        ...evidence.associatedPullRequests[0].head, sha: 'e'.repeat(40),
      },
    }] }).passed).toBe(false);
    expect(validateGitGuardianMergeEvidence({ ...evidence, associatedPullRequests: [{
      ...evidence.associatedPullRequests[0], base: {
        ...evidence.associatedPullRequests[0].base, sha: 'e'.repeat(40),
      },
    }] }).passed).toBe(false);
    expect(validateGitGuardianMergeEvidence({ ...evidence, headCheckRuns: [] }).passed).toBe(false);
    expect(validateGitGuardianMergeEvidence({ ...evidence, headCheckRuns: [{
      ...evidence.headCheckRuns[0], app: { id: 1, name: 'GitGuardian' },
    }] }).passed).toBe(false);
    expect(validateGitGuardianMergeEvidence({ ...evidence, headCheckRuns: [{
      ...evidence.headCheckRuns[0], conclusion: 'failure',
    }] }).passed).toBe(false);
    expect(validateGitGuardianMergeEvidence({ ...evidence, headCheckRuns: [
      evidence.headCheckRuns[0],
      { ...evidence.headCheckRuns[0], id: 2, conclusion: 'failure', started_at: '2026-09-30T19:25:00Z' },
    ] }).passed).toBe(false);
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
    expect(validateJitsiServerUrl('https://video.example')).toContain('JITSI_URL_MUST_NOT_USE_TEST_OR_LOCAL_HOST');
    expect(validateJitsiServerUrl('https://video.invalid')).toContain('JITSI_URL_MUST_NOT_USE_TEST_OR_LOCAL_HOST');
    expect(validateJitsiServerUrl('https://127.0.0.1')).toContain('JITSI_URL_MUST_NOT_USE_TEST_OR_LOCAL_HOST');
    expect(validateJitsiServerUrl('https://video.example.org/path')).toContain('JITSI_URL_MUST_BE_PUBLIC_HTTPS_BASE_URL');
    expect(validateJitsiServerUrl(' https://video.example.org')).toContain('JITSI_URL_MUST_BE_PUBLIC_HTTPS_BASE_URL');
    expect(validateJitsiServerUrl('https://video.example.org\n')).toContain('JITSI_URL_MUST_BE_PUBLIC_HTTPS_BASE_URL');
    expect(validateJitsiServerUrl('https://meet.jit.si')).toContain('JITSI_URL_MUST_NOT_USE_PUBLIC_FALLBACK');
    expect(validateJitsiServerUrl('https://meet.jit.si./')).toContain('JITSI_URL_MUST_NOT_USE_PUBLIC_FALLBACK');
    for (const url of [
      'https://localhost./', 'https://video.test./', 'https://[::1]/',
      'https://10.1.2.3/', 'https://100.64.1.1/', 'https://169.254.1.10/',
      'https://172.16.1.1/', 'https://192.168.1.10/', 'https://[fc00::1]/',
      'https://[fe80::1]/', 'https://[::ffff:127.0.0.1]/',
    ]) {
      expect(validateJitsiServerUrl(url)).toContain('JITSI_URL_MUST_NOT_USE_TEST_OR_LOCAL_HOST');
    }
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
    expect(validateJitsiCspHeader("frame-src 'self'", 'not-a-url'))
      .toContain('JITSI_CSP_CONFIGURED_ORIGIN_INVALID');
  });

  it('requires an explicit dispatch mode and refuses ambiguous Jitsi settings', () => {
    expect(validateVideoDispatch('DISABLED', '')).toEqual([]);
    expect(validateVideoDispatch('JITSI', 'https://video.example.org')).toEqual([]);
    expect(validateVideoDispatch(undefined, '')).toContain('VIDEO_MODE_REQUIRED');
    expect(validateVideoDispatch('UNKNOWN', '')).toContain('VIDEO_MODE_INVALID');
    expect(validateVideoDispatch('DISABLED', 'https://video.example.org')).toContain('JITSI_URL_FORBIDDEN_WHEN_VIDEO_DISABLED');
    expect(validateVideoDispatch('JITSI', '')).toContain('JITSI_URL_REQUIRED');
    expect(validateVideoDispatch('JITSI', 'not-a-url')).toContain('JITSI_URL_INVALID');
    expect(validateVideoDispatch('JITSI', 'https://meet.jit.si')).toContain('JITSI_URL_MUST_NOT_USE_PUBLIC_FALLBACK');
  });

  it('checks CSP grants according to the explicitly built video mode', () => {
    expect(validateVideoCspHeader(undefined, 'DISABLED', '')).toContain('VIDEO_CSP_MISSING');
    expect(validateVideoCspHeader("script-src 'self'", 'DISABLED', ''))
      .toContain('VIDEO_CSP_FRAME_SRC_MISSING');
    expect(validateVideoCspHeader("frame-src 'self'", 'DISABLED', ''))
      .toContain('VIDEO_CSP_SCRIPT_SRC_MISSING');
    expect(validateVideoCspHeader("frame-src 'self'; script-src 'self'", 'DISABLED', '')).toEqual([]);
    expect(validateVideoCspHeader("frame-src 'self' https://meet.jit.si", 'DISABLED', ''))
      .toContain('JITSI_CSP_EXTERNAL_ORIGIN_ACTIVE_WHEN_DISABLED');
    expect(validateVideoCspHeader("frame-src 'self'; script-src 'self' https://meet.jit.si", 'DISABLED', ''))
      .toContain('JITSI_CSP_EXTERNAL_ORIGIN_ACTIVE_WHEN_DISABLED');
    expect(validateVideoCspHeader("frame-src 'self'; script-src 'self'; connect-src 'self' wss:", 'DISABLED', ''))
      .toContain('JITSI_CSP_WEBSOCKET_ACTIVE_WHEN_DISABLED');
    expect(validateVideoCspHeader("frame-src 'self' https://video.example.org; script-src 'self' https://video.example.org; connect-src 'self' wss://video.example.org", 'JITSI', 'https://video.example.org'))
      .toEqual([]);
    expect(validateVideoCspHeader("frame-src 'self'", 'JITSI', 'https://video.example.org'))
      .toContain('JITSI_CSP_CONFIGURED_ORIGIN_MISSING');
    expect(validateVideoCspHeader("frame-src 'self' https://video.example.org; script-src 'self'", 'JITSI', 'https://video.example.org'))
      .toContain('JITSI_CSP_SCRIPT_ORIGIN_MISSING');
    expect(validateVideoCspHeader("frame-src 'self' https://video.example.org https://*.jitsi.net; script-src 'self' https://video.example.org", 'JITSI', 'https://video.example.org'))
      .toContain('JITSI_CSP_UNAPPROVED_ORIGIN');
    expect(validateVideoCspHeader("frame-src 'self' https://video.example.org; script-src 'self' https://video.example.org https://meet.jit.si", 'JITSI', 'https://video.example.org'))
      .toContain('JITSI_CSP_UNAPPROVED_ORIGIN');
    expect(validateVideoCspHeader("frame-src 'self' https://video.example.org; script-src 'self' https://video.example.org; connect-src 'self' wss:", 'JITSI', 'https://video.example.org'))
      .toContain('JITSI_CSP_UNAPPROVED_WEBSOCKET');
    expect(validateVideoCspHeader("frame-src 'self' https://video.example.org; script-src 'self' https://video.example.org; connect-src 'self'", 'JITSI', 'https://video.example.org'))
      .toContain('JITSI_CSP_CONFIGURED_WEBSOCKET_MISSING');
  });

  it('checks camera and microphone delegation for the configured mode', () => {
    expect(validateVideoPermissionsPolicyHeader(undefined, 'DISABLED', ''))
      .toContain('VIDEO_PERMISSIONS_POLICY_MISSING');
    expect(validateVideoPermissionsPolicyHeader('camera=(self), microphone=(self), geolocation=()', 'DISABLED', ''))
      .toEqual([]);
    expect(validateVideoPermissionsPolicyHeader('camera=(), microphone=()', 'DISABLED', ''))
      .toContain('VIDEO_PERMISSIONS_POLICY_CAMERA_MIC_MISSING');
    expect(validateVideoPermissionsPolicyHeader('camera=(self "https://meet.jit.si"), microphone=(self)', 'DISABLED', ''))
      .toContain('JITSI_PERMISSION_EXTERNAL_ORIGIN_ACTIVE_WHEN_DISABLED');
    expect(validateVideoPermissionsPolicyHeader('camera=(self "https://video.example.org"), microphone=(self "https://video.example.org")', 'JITSI', 'https://video.example.org'))
      .toEqual([]);
    expect(validateVideoPermissionsPolicyHeader('camera=(self), microphone=(self)', 'JITSI', 'https://video.example.org'))
      .toContain('JITSI_PERMISSION_CONFIGURED_ORIGIN_MISSING');
    expect(validateVideoPermissionsPolicyHeader('camera=(self "https://video.example.org" *), microphone=(self "https://video.example.org")', 'JITSI', 'https://video.example.org'))
      .toContain('JITSI_PERMISSION_UNAPPROVED_ORIGIN');
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
