import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const script = resolve(__dirname, '../../scripts/check-production-build-env.js');

function check(video: Record<string, string | undefined>, e2e = false) {
  const directory = mkdtempSync(join(tmpdir(), 'preview-build-env-'));
  try {
    return execFileSync('node', [script, ...(e2e ? ['--mode=e2e'] : [])], {
      cwd: directory,
      env: { PATH: process.env.PATH, NODE_ENV: 'production', ...video },
      encoding: 'utf8',
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('production build video configuration', () => {
  it('builds explicit DISABLED without any Jitsi URL or room secret', () => {
    expect(check({ NEXT_PUBLIC_VIDEO_MODE: 'DISABLED' })).toContain('BUILD_ENV_CHECK=PASS');
  });

  it('rejects DISABLED with a supplied URL', () => {
    expect(() => check({ NEXT_PUBLIC_VIDEO_MODE: 'DISABLED', NEXT_PUBLIC_JITSI_SERVER_URL: 'https://video.example.org' }))
      .toThrow(/BUILD_VIDEO_CONFIG_INVALID:JITSI_URL_FORBIDDEN_WHEN_VIDEO_DISABLED/);
  });

  it('requires Jitsi config for JITSI and legacy absent mode', () => {
    expect(() => check({ NEXT_PUBLIC_VIDEO_MODE: 'JITSI' }))
      .toThrow(/BUILD_VIDEO_CONFIG_INVALID:JITSI_URL_REQUIRED/);
    expect(() => check({}))
      .toThrow(/BUILD_VIDEO_CONFIG_INVALID:LEGACY_JITSI_URL_REQUIRED/);
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
    expect(() => check({ NEXT_PUBLIC_VIDEO_MODE: 'UNKNOWN' }))
      .toThrow(/BUILD_VIDEO_CONFIG_INVALID:VIDEO_MODE_INVALID/);
    expect(() => check({ NEXT_PUBLIC_VIDEO_MODE: '' }))
      .toThrow(/BUILD_VIDEO_CONFIG_INVALID:VIDEO_MODE_REQUIRED/);
    expect(() => check({
      NEXT_PUBLIC_VIDEO_MODE: 'JITSI',
      NEXT_PUBLIC_JITSI_SERVER_URL: 'https://meet.jit.si',
      JITSI_ROOM_SECRET: 'x'.repeat(32),
    })).toThrow(/BUILD_VIDEO_CONFIG_INVALID:JITSI_URL_MUST_NOT_USE_PUBLIC_FALLBACK/);
  });

  it('uses Next dotenv precedence when the process does not override the mode', () => {
    const directory = mkdtempSync(join(tmpdir(), 'preview-build-env-'));
    try {
      writeFileSync(join(directory, '.env'), 'NEXT_PUBLIC_VIDEO_MODE=JITSI\n');
      writeFileSync(join(directory, '.env.production'), 'NEXT_PUBLIC_VIDEO_MODE=JITSI\n');
      writeFileSync(join(directory, '.env.local'), 'NEXT_PUBLIC_VIDEO_MODE=DISABLED\n');
      const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, NODE_ENV: 'production' };
      expect(execFileSync('node', [script], { cwd: directory, env, encoding: 'utf8' }))
        .toContain('BUILD_ENV_CHECK=PASS');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('validates the expanded dotenv value that Next compiles', () => {
    const directory = mkdtempSync(join(tmpdir(), 'preview-build-env-'));
    try {
      writeFileSync(join(directory, '.env.production'), 'NEXT_PUBLIC_VIDEO_MODE=${PREVIEW_VIDEO_MODE}\n');
      expect(execFileSync('node', [script], {
        cwd: directory,
        env: { PATH: process.env.PATH, NODE_ENV: 'production', PREVIEW_VIDEO_MODE: 'DISABLED' },
        encoding: 'utf8',
      })).toContain('BUILD_ENV_CHECK=PASS');
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

  it('rejects a whitespace-only legacy Jitsi URL before producing an artifact', () => {
    expect(() => check({ NEXT_PUBLIC_JITSI_SERVER_URL: '   ' }))
      .toThrow(/BUILD_VIDEO_CONFIG_INVALID:LEGACY_JITSI_URL_REQUIRED/);
  });
});
