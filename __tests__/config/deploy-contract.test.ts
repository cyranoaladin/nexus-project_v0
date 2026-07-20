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

  it('uses the pinned Node 22.23.1 base image expected by production', () => {
    const dockerfile = read('Dockerfile');

    expect(dockerfile).toContain(
      'FROM node:22.23.1-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS base',
    );
    expect(dockerfile).not.toContain('FROM node:18-alpine AS base');
  });

  it('keeps the Alpine dependency proof on the same pinned base', () => {
    const verifier = read('Dockerfile.dependencies');

    expect(verifier).toContain(
      'FROM node:22.23.1-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2',
    );
    expect(verifier).toContain('COPY package.json package-lock.json .npmrc ./');
    expect(verifier).toContain('RUN npm ci');
    expect(verifier).toContain('npm audit --omit=dev --audit-level=high');
    expect(verifier).toContain('validate-npm-tree.js');
  });

  it('keeps the git-pull deploy helper aligned with the real production host and systemd service', () => {
    const deployScript = read('scripts/deploy-git-pull.sh');

    expect(deployScript).toContain('REMOTE_HOST="root@88.99.254.59"');
    expect(deployScript).toContain('REMOTE_DIR="/opt/nexus"');
    expect(deployScript).toContain('systemctl restart nexus-app');
    expect(deployScript).toContain('git checkout main');
    expect(deployScript).toContain('git pull origin main');
  });

  it('forbids destructive docker commands in active production scripts', () => {
    const activeScripts = [
      'scripts/deploy-git-pull.sh',
      'scripts/deploy-production-safe.sh',
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
      const script = read(`scripts/${file}`);

      for (const pattern of dangerousPatterns) {
        expect(script).not.toMatch(new RegExp(pattern));
      }
    }
  });

  it('requires an explicit release SHA for the builder gate', () => {
    const dockerfile = read('Dockerfile');
    const dockerignore = read('.dockerignore');
    const builderAndRunner = dockerfile.split('FROM base AS builder')[1];
    const [builderStage, runnerStage] = builderAndRunner.split('FROM base AS runner');

    expect(dockerignore.split(/\r?\n/)).toContain('.git');
    expect(builderStage).toContain('ARG RELEASE_SHA');
    expect(builderStage).not.toMatch(/ARG RELEASE_SHA\s*=/);
    expect(builderStage).toContain("grep -Eq '^[0-9a-fA-F]{40}([0-9a-fA-F]{24})?$'");
    expect(builderStage).toContain('RELEASE_SHA="$RELEASE_SHA" npm run build');
    expect(runnerStage).not.toContain('ENV RELEASE_SHA');
    expect(runnerStage).toContain(
      'COPY --from=builder /app/release-manifest.json ./release-manifest.json',
    );
  });
});
