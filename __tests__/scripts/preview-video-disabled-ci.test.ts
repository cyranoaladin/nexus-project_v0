import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
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
    const smoke = job.steps.find((step: { name: string }) => step.name === 'Smoke DISABLED standalone and authenticated browser');
    expect(job.services.postgres.env.POSTGRES_DB).toBe('nexus_disposable_video_test');
    expect(smoke.env.NEXUS_DISPOSABLE_POSTGRES).toBe('1');
    expect(new URL(smoke.env.DATABASE_URL).pathname).toBe('/nexus_disposable_video_test');
    expect(smoke.env.NEXT_PUBLIC_VIDEO_MODE).toBe('DISABLED');
    expect(smoke.env.NEXT_PUBLIC_JITSI_SERVER_URL).toBeUndefined();
    expect(smoke.env.JITSI_ROOM_SECRET).toBeUndefined();
    expect(smoke.run).toContain('verify-preview-client-config.mjs');
    expect(smoke.run).toContain('validateVideoCspHeader');
    expect(smoke.run).toContain('validateVideoPermissionsPolicyHeader');
    expect(job.steps.some((step: { run?: string }) => step.run?.includes('verify-video-disabled-browser.mjs'))).toBe(true);
    expect(smoke.run).toContain('node server.js &');
    expect(smoke.run).toContain('cd "$GITHUB_WORKSPACE"');
  });

  it.each([
    ['missing marker', 'postgresql://postgres@localhost:5432/nexus_disposable_video_test', undefined],
    ['production database', 'postgresql://postgres@localhost:5432/nexus_prod', '1'],
    ['remote host', 'postgresql://postgres@db.example.com:5432/nexus_disposable_video_test', '1'],
  ])('refuses fixture writes before browser or database access: %s', (_case, databaseUrl, marker) => {
    const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: databaseUrl };
    if (marker) env.NEXUS_DISPOSABLE_POSTGRES = marker;
    else delete env.NEXUS_DISPOSABLE_POSTGRES;
    const result = spawnSync(process.execPath, [
      resolve(__dirname, '../../scripts/testing/verify-video-disabled-browser.mjs'),
      'http://localhost:3211',
    ], { env, encoding: 'utf8', timeout: 5000 });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('VIDEO_BROWSER_DATABASE_NOT_DISPOSABLE');
    expect(result.stderr).not.toContain(databaseUrl);
  });

  it('pins the direct-join guards in the CI smoke that runs against the standalone', () => {
    const smoke = readFileSync(resolve(__dirname, '../../scripts/testing/verify-video-disabled-browser.mjs'), 'utf8');
    expect(smoke).toContain('prisma.sessionBooking.create(');
    expect(smoke).toContain('context.request.post(`${origin}/api/sessions/${fixtureBookingId}`)');
    expect(smoke).toContain("joinResponse.status() !== 503");
    expect(smoke).toContain("joinPayload.error !== 'VIDEO_DISABLED' || 'roomName' in joinPayload");
    expect(smoke).toContain('prisma.sessionBooking.findUnique(');
    expect(smoke).toContain('VIDEO_BROWSER_BOOKING_MUTATED');
    expect(smoke).toContain('prisma.sessionBooking.delete(');
  });

  it('keeps the disposable booking within one calendar day and always attempts user cleanup', () => {
    const smoke = readFileSync(resolve(__dirname, '../../scripts/testing/verify-video-disabled-browser.mjs'), 'utf8');
    expect(smoke).toContain('const endTime = `${hour}:59`');
    expect(smoke).toContain('duration: 59');
    const bookingDelete = smoke.indexOf('prisma.sessionBooking.delete(');
    const firstCleanupCatch = smoke.indexOf('} catch {', bookingDelete);
    const usersDelete = smoke.indexOf('prisma.user.deleteMany(', bookingDelete);
    expect(bookingDelete).toBeGreaterThan(-1);
    expect(firstCleanupCatch).toBeGreaterThan(bookingDelete);
    expect(usersDelete).toBeGreaterThan(firstCleanupCatch);
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
