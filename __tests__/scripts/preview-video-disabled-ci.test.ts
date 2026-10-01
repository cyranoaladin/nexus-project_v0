import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

const workflowPath = resolve(__dirname, '../../.github/workflows/ci.yml');

describe('Preview DISABLED production-build CI lane', () => {
  it('runs a separate explicit DISABLED production build and gates CI Success', () => {
    const workflow = yaml.load(readFileSync(workflowPath, 'utf8')) as any;
    const job = workflow.jobs['preview-video-disabled'];
    expect(job).toBeDefined();
    expect(job['runs-on']).toBe('ubuntu-24.04');
    expect(workflow.jobs['ci-success'].needs).toContain('preview-video-disabled');
    const build = job.steps.find((step: { name: string }) => step.name === 'Build explicit DISABLED production artifact');
    expect(build.run).toBe('npm run build');
    expect(build.env.NEXT_PUBLIC_VIDEO_MODE).toBe('DISABLED');
    expect(build.env.NEXT_PUBLIC_JITSI_SERVER_URL).toBeUndefined();
    expect(build.env.JITSI_ROOM_SECRET).toBeUndefined();
    expect(job.steps.some((step: { run?: string }) => step.run === 'npm ci')).toBe(true);
    expect(job.steps.some((step: { run?: string }) => step.run?.includes('npx prisma migrate deploy'))).toBe(true);
    expect(job.steps.some((step: { run?: string }) => step.run?.includes('playwright install --with-deps chromium'))).toBe(true);
    const smoke = job.steps.find((step: { name: string }) => step.name === 'Smoke DISABLED standalone and unauthenticated browser');
    expect(smoke.env.NEXT_PUBLIC_VIDEO_MODE).toBe('DISABLED');
    expect(smoke.env.NEXT_PUBLIC_JITSI_SERVER_URL).toBeUndefined();
    expect(smoke.env.JITSI_ROOM_SECRET).toBeUndefined();
    expect(smoke.run).toContain('verify-preview-client-config.mjs');
    expect(smoke.run).toContain('validateVideoCspHeader');
    expect(smoke.run).toContain('validateVideoPermissionsPolicyHeader');
    expect(job.steps.some((step: { run?: string }) => step.run?.includes('verify-video-disabled-browser.mjs'))).toBe(true);
  });

  it('keeps the existing legacy JITSI Production Build job', () => {
    const workflow = yaml.load(readFileSync(workflowPath, 'utf8')) as any;
    const build = workflow.jobs.build;
    expect(build.name).toBe('Production Build');
    const buildStep = build.steps.find((step: { name: string }) => step.name === 'Build Next.js production bundle');
    expect(buildStep.env.NEXT_PUBLIC_JITSI_SERVER_URL).toBe('https://jitsi-ci.nexus-e2e.test');
    expect(buildStep.env.NEXT_PUBLIC_VIDEO_MODE).toBeUndefined();
  });
});
