import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertStandaloneVideoMode } from '@/lib/video-mode-runtime';

describe('standalone runtime video-mode attestation', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nexus-video-mode-'));
    writeFileSync(join(root, 'server.js'), '/* disposable standalone marker */');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const manifest = (rootPath: string, mode: string) =>
    writeFileSync(join(rootPath, 'release-manifest.json'), JSON.stringify({ VIDEO_MODE: mode }));

  it('accepts matching explicit build and runtime modes', () => {
    manifest(root, 'DISABLED');
    expect(() => assertStandaloneVideoMode(root, { NEXT_PUBLIC_VIDEO_MODE: 'DISABLED' })).not.toThrow();
  });

  it('refuses a runtime mode different from the built client mode', () => {
    manifest(root, 'DISABLED');
    expect(() => assertStandaloneVideoMode(root, { NEXT_PUBLIC_VIDEO_MODE: 'JITSI' })).toThrow('VIDEO_MODE_MANIFEST_MISMATCH');
    expect(() => assertStandaloneVideoMode(root, {})).toThrow('VIDEO_MODE_MANIFEST_MISMATCH');
  });

  it('attests the JITSI origin compiled into the standalone', () => {
    writeFileSync(join(root, 'release-manifest.json'), JSON.stringify({
      VIDEO_MODE: 'JITSI',
      JITSI_ORIGIN: 'https://video.preview.example.org',
    }));
    const matching = {
      NEXT_PUBLIC_VIDEO_MODE: 'JITSI',
      NEXT_PUBLIC_JITSI_SERVER_URL: 'https://video.preview.example.org/',
    };
    expect(() => assertStandaloneVideoMode(root, matching)).not.toThrow();
    expect(() => assertStandaloneVideoMode(root, {
      ...matching,
      NEXT_PUBLIC_JITSI_SERVER_URL: 'https://another.preview.example.org',
    })).toThrow('JITSI_ORIGIN_MANIFEST_MISMATCH');
    expect(() => assertStandaloneVideoMode(root, {
      NEXT_PUBLIC_VIDEO_MODE: 'JITSI',
    })).toThrow('JITSI_ORIGIN_MANIFEST_MISMATCH');
  });

  it('refuses an explicit JITSI manifest without its compiled origin', () => {
    manifest(root, 'JITSI');
    expect(() => assertStandaloneVideoMode(root, {
      NEXT_PUBLIC_VIDEO_MODE: 'JITSI',
      NEXT_PUBLIC_JITSI_SERVER_URL: 'https://video.preview.example.org',
    })).toThrow('JITSI_ORIGIN_MANIFEST_MISSING');
  });

  it('refuses an absent or invalid manifest for an explicitly configured standalone', () => {
    expect(() => assertStandaloneVideoMode(root, { NEXT_PUBLIC_VIDEO_MODE: 'DISABLED' })).toThrow('VIDEO_MODE_MANIFEST_MISSING');
    manifest(root, 'INVALID');
    expect(() => assertStandaloneVideoMode(root, { NEXT_PUBLIC_VIDEO_MODE: 'DISABLED' })).toThrow('VIDEO_MODE_MANIFEST_INVALID');
  });

  it('preserves the old standalone contract when neither mode nor mode manifest exists', () => {
    expect(() => assertStandaloneVideoMode(root, {})).not.toThrow();
  });

  it('finds the delivered manifest beside server.js even when WorkingDirectory differs', () => {
    manifest(root, 'DISABLED');
    const otherCwd = mkdtempSync(join(tmpdir(), 'nexus-other-cwd-'));
    try {
      expect(() => assertStandaloneVideoMode(otherCwd, { NEXT_PUBLIC_VIDEO_MODE: 'DISABLED' }, join(root, 'server.js'))).not.toThrow();
      expect(() => assertStandaloneVideoMode(otherCwd, { NEXT_PUBLIC_VIDEO_MODE: 'JITSI' }, join(root, 'server.js'))).toThrow('VIDEO_MODE_MANIFEST_MISMATCH');
    } finally {
      rmSync(otherCwd, { recursive: true, force: true });
    }
  });
});
