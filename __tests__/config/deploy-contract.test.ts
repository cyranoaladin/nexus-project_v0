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

  it('keeps the legacy git-pull deploy helper at its deprecated location', () => {
    const deployScript = read('scripts/legacy/deploy-git-pull.sh');

    expect(deployScript).toContain('REMOTE_HOST="root@88.99.254.59"');
    expect(deployScript).toContain('REMOTE_DIR="/opt/nexus"');
    expect(deployScript).toContain('systemctl restart nexus-app');
    expect(deployScript).toContain('git checkout main');
    expect(deployScript).toContain('git pull origin main');
  });

  it('forbids destructive docker commands in active production scripts', () => {
    const activeScripts = [
      'scripts/legacy/deploy-git-pull.sh',
      'scripts/legacy/deploy-production-safe.sh',
    ];

    for (const scriptPath of activeScripts) {
      try {
        const script = read(scriptPath);
        expect(script).not.toMatch(/down --volumes/);
        expect(script).not.toMatch(/docker volume rm/);
        expect(script).not.toMatch(/system prune --volumes/);
      } catch (error) {
        // Script doesn't exist, that's fine
      }
    }
  });

  it('ensures legacy dangerous scripts are not in scripts/ root', () => {
    const dangerousPatterns = ['down --volumes', 'docker volume rm', 'system prune --volumes'];
    const scriptsDir = path.join(rootDir, 'scripts');

    const scriptFiles = fs.readdirSync(scriptsDir)
      .filter(file => file.endsWith('.sh'))
      .filter(file => !file.startsWith('.'));

    for (const file of scriptFiles) {
      const scriptPath = path.join(scriptsDir, file);
      const script = read(`scripts/${file}`);

      for (const pattern of dangerousPatterns) {
        expect(script).not.toMatch(new RegExp(pattern));
      }
    }
  });
});
