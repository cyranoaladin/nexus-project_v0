import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve(__dirname, '../../scripts/release/verify-preview-client-config.mjs');

function fixture(mode: string, routeChunk: string, html: string, unrelatedChunk = '') {
  const directory = mkdtempSync(join(tmpdir(), 'preview-client-config-'));
  const routePath = join(directory, '.next/static/chunks/app/session/video/page.js');
  mkdirSync(join(directory, '.next/standalone'), { recursive: true });
  mkdirSync(join(directory, '.next/static/chunks/app/session/video'), { recursive: true });
  writeFileSync(join(directory, '.next/standalone/release-manifest.json'), JSON.stringify({ VIDEO_MODE: mode }));
  writeFileSync(join(directory, '.next/app-build-manifest.json'), JSON.stringify({
    pages: { '/session/video/page': ['static/chunks/app/session/video/page.js'] },
  }));
  writeFileSync(routePath, routeChunk);
  writeFileSync(join(directory, '.next/static/chunks/unrelated.js'), unrelatedChunk);
  writeFileSync(join(directory, 'mock-fetch.cjs'), `global.fetch = async () => ({ status: 200, text: async () => ${JSON.stringify(html)} });`);
  return directory;
}

function verify(directory: string, mode: string, url = '') {
  return execFileSync('node', ['-r', join(directory, 'mock-fetch.cjs'), script], {
    cwd: directory,
    env: { ...process.env, REQUESTED_VIDEO_MODE: mode, REQUESTED_JITSI_URL: url, PREVIEW_SMOKE_ORIGIN: 'http://localhost:3211' },
    encoding: 'utf8',
  });
}

describe('Preview compiled client mode attestation', () => {
  const directories: string[] = [];
  afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  it('accepts a disabled route whose compiled render contains the disabled mode', () => {
    const directory = fixture('DISABLED', 'route chunk', '<main data-video-mode="DISABLED"></main>');
    directories.push(directory);
    expect(verify(directory, 'DISABLED')).toContain('VIDEO_CLIENT_MODE=DISABLED');
  });

  it('rejects guard text or a marker in an unrelated chunk', () => {
    const directory = fixture('DISABLED', 'throw Error("data-video-mode DISABLED")',
      '<main>Unavailable</main>', 'return jsx("main",{"data-video-mode":"DISABLED"})');
    directories.push(directory);
    expect(() => verify(directory, 'DISABLED')).toThrow();
  });

  it('rejects a manifest or client mode that differs from dispatch', () => {
    const directory = fixture('JITSI', 'route chunk', '<main data-video-mode="DISABLED"></main>');
    directories.push(directory);
    expect(() => verify(directory, 'DISABLED')).toThrow();
  });

  it('checks the Jitsi mode rendered by the standalone server, not URL text in a chunk', () => {
    const directory = fixture('JITSI', 'route chunk', '<main data-video-mode="JITSI"></main>',
      'const guard="https://video.example.org"');
    directories.push(directory);
    expect(verify(directory, 'JITSI', 'https://video.example.org')).toContain('VIDEO_CLIENT_MODE=JITSI');
  });
});
