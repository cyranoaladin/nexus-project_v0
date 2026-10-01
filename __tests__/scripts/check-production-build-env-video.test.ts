import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const script = resolve(__dirname, '../../scripts/check-production-build-env.js');

function check(video: Record<string, string | undefined>, e2e = false) {
  const env = { ...process.env };
  delete env.NEXT_PUBLIC_VIDEO_MODE;
  delete env.NEXT_PUBLIC_JITSI_SERVER_URL;
  delete env.JITSI_ROOM_SECRET;
  Object.assign(env, video);
  for (const [key, value] of Object.entries(video)) if (value === undefined) delete env[key];
  return execFileSync('node', [script, ...(e2e ? ['--mode=e2e'] : [])], {
    cwd: resolve(__dirname, '../..'),
    env,
    encoding: 'utf8',
  });
}

describe('production build video configuration', () => {
  it('builds explicit DISABLED without any Jitsi URL or room secret', () => {
    expect(check({ NEXT_PUBLIC_VIDEO_MODE: 'DISABLED' })).toContain('BUILD_ENV_CHECK=PASS');
  });

  it('rejects DISABLED with a supplied URL', () => {
    expect(() => check({ NEXT_PUBLIC_VIDEO_MODE: 'DISABLED', NEXT_PUBLIC_JITSI_SERVER_URL: 'https://video.example.org' }))
      .toThrow();
  });

  it('requires Jitsi config for JITSI and legacy absent mode', () => {
    expect(() => check({ NEXT_PUBLIC_VIDEO_MODE: 'JITSI' })).toThrow();
    expect(() => check({})).toThrow();
  });

  it('accepts a dedicated HTTPS origin and room secret for JITSI', () => {
    expect(check({
      NEXT_PUBLIC_VIDEO_MODE: 'JITSI',
      NEXT_PUBLIC_JITSI_SERVER_URL: 'https://video.example.org',
      JITSI_ROOM_SECRET: 'x'.repeat(32),
    })).toContain('BUILD_ENV_CHECK=PASS');
    expect(check({ NEXT_PUBLIC_VIDEO_MODE: 'JITSI', NEXT_PUBLIC_JITSI_SERVER_URL: 'https://video.example.org' }))
      .toContain('BUILD_ENV_CHECK=PASS'); // Room secret is server-only and checked at startup.
  });

  it('rejects an unknown mode and a public Jitsi fallback', () => {
    expect(() => check({ NEXT_PUBLIC_VIDEO_MODE: 'UNKNOWN' })).toThrow();
    expect(() => check({ NEXT_PUBLIC_VIDEO_MODE: '' })).toThrow(/VIDEO_MODE_REQUIRED/);
    expect(() => check({
      NEXT_PUBLIC_VIDEO_MODE: 'JITSI',
      NEXT_PUBLIC_JITSI_SERVER_URL: 'https://meet.jit.si',
      JITSI_ROOM_SECRET: 'x'.repeat(32),
    })).toThrow();
  });

  it('uses Next dotenv precedence when the process does not override the mode', () => {
    const directory = mkdtempSync(join(tmpdir(), 'preview-build-env-'));
    try {
      writeFileSync(join(directory, '.env'), 'NEXT_PUBLIC_VIDEO_MODE=JITSI\n');
      writeFileSync(join(directory, '.env.production'), 'NEXT_PUBLIC_VIDEO_MODE=JITSI\n');
      writeFileSync(join(directory, '.env.local'), 'NEXT_PUBLIC_VIDEO_MODE=DISABLED\n');
      const env = { ...process.env };
      delete env.NEXT_PUBLIC_VIDEO_MODE;
      delete env.NEXT_PUBLIC_JITSI_SERVER_URL;
      delete env.JITSI_ROOM_SECRET;
      expect(execFileSync('node', [script], { cwd: directory, env, encoding: 'utf8' }))
        .toContain('BUILD_ENV_CHECK=PASS');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('allows only the E2E Jitsi fixture in the disposable e2e build lane', () => {
    expect(check({
      NEXT_PUBLIC_VIDEO_MODE: 'JITSI',
      NEXT_PUBLIC_JITSI_SERVER_URL: 'https://jitsi-ci.nexus-e2e.test',
      JITSI_ROOM_SECRET: 'x'.repeat(32),
    }, true)).toContain('BUILD_ENV_CHECK=PASS');
  });

  it('preserves the legacy absent-mode build with its existing test fixture', () => {
    const fixtureUrl = 'https://jitsi-ci.nexus-e2e.test';
    expect(check({ NEXT_PUBLIC_JITSI_SERVER_URL: fixtureUrl }))
      .toContain('BUILD_ENV_CHECK=PASS');
    expect(() => check({ NEXT_PUBLIC_VIDEO_MODE: 'JITSI', NEXT_PUBLIC_JITSI_SERVER_URL: fixtureUrl }))
      .toThrow();
  });
});
