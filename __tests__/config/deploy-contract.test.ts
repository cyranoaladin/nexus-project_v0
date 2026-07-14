import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(__dirname, '..', '..');

function read(filePath: string) {
  return fs.readFileSync(path.join(rootDir, filePath), 'utf8');
}

describe('production deployment contract', () => {
  it('keeps the PM2 production port and canonical URL aligned with nginx', () => {
    const previousPort = process.env.PORT;
    const previousNextAuthUrl = process.env.NEXTAUTH_URL;
    const previousTrustHost = process.env.AUTH_TRUST_HOST;

    try {
      delete process.env.PORT;
      delete process.env.NEXTAUTH_URL;
      delete process.env.AUTH_TRUST_HOST;

      jest.resetModules();
      const ecosystem = require(path.join(rootDir, 'ecosystem.config.js'));
      const app = ecosystem.apps.find((entry: { name: string }) => entry.name === 'nexus-prod');

      expect(app).toBeDefined();
      expect(app.env.PORT).toBe(3001);
      expect(app.env.NEXTAUTH_URL).toBe('https://nexusreussite.academy');
      expect(app.env.AUTH_TRUST_HOST).toBe('true');
    } finally {
      if (previousPort === undefined) delete process.env.PORT;
      else process.env.PORT = previousPort;
      if (previousNextAuthUrl === undefined) delete process.env.NEXTAUTH_URL;
      else process.env.NEXTAUTH_URL = previousNextAuthUrl;
      if (previousTrustHost === undefined) delete process.env.AUTH_TRUST_HOST;
      else process.env.AUTH_TRUST_HOST = previousTrustHost;
    }
  });

  it('uses the Node 20 base image expected by production', () => {
    const dockerfile = read('Dockerfile');
    expect(dockerfile).toContain('FROM node:20-alpine AS base');
    expect(dockerfile).not.toContain('FROM node:18-alpine AS base');
  });

  it('has five legacy deploy scripts in scripts/legacy/', () => {
    const legacyScripts = [
      'scripts/legacy/deploy-git-pull.sh',
      'scripts/legacy/deploy-files-only.sh',
      'scripts/legacy/deploy-incremental.sh',
      'scripts/legacy/deploy-production-safe.sh',
      'scripts/legacy/deploy.sh',
    ];
    for (const s of legacyScripts) {
      expect(fs.existsSync(path.join(rootDir, s))).toBe(true);
    }
  });

  it('has no old deploy scripts at scripts/ root', () => {
    const oldNames = [
      'deploy-git-pull.sh',
      'deploy-files-only.sh',
      'deploy-incremental.sh',
      'deploy-production-safe.sh',
      'deploy.sh',
    ];
    for (const name of oldNames) {
      expect(fs.existsSync(path.join(rootDir, 'scripts', name))).toBe(false);
    }
  });

  it('build-immutable-release.sh is the only active release builder', () => {
    const builder = read('scripts/release/build-immutable-release.sh');
    expect(builder).toContain('npm run release:build');
    expect(builder).toContain('RELEASE_SHA');
    expect(builder).toContain('id -un');
    expect(builder).toContain('mktemp -d');
    expect(builder).toContain('trap cleanup');
    expect(builder).not.toContain('ln -snf');
    expect(builder).not.toContain('pm2 reload');
  });

  it('forbids destructive docker commands in legacy scripts', () => {
    const legacyScripts = [
      'scripts/legacy/deploy-git-pull.sh',
      'scripts/legacy/deploy-production-safe.sh',
    ];
    for (const scriptPath of legacyScripts) {
      try {
        const script = read(scriptPath);
        expect(script).not.toMatch(/down --volumes/);
        expect(script).not.toMatch(/docker volume rm/);
        expect(script).not.toMatch(/system prune --volumes/);
      } catch { /* script may not exist */ }
    }
  });

  it('ensures no dangerous patterns in scripts/ root .sh files', () => {
    const dangerousPatterns = ['down --volumes', 'docker volume rm', 'system prune --volumes'];
    const scriptsDir = path.join(rootDir, 'scripts');
    const scriptFiles = fs.readdirSync(scriptsDir)
      .filter(file => file.endsWith('.sh'))
      .filter(file => !file.startsWith('.'));

    for (const file of scriptFiles) {
      const script = read(`scripts/${file}`);
      for (const pattern of dangerousPatterns) {
        expect(script).not.toMatch(new RegExp(pattern));
      }
    }
  });
});
