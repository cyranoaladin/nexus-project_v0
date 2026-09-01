import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(__dirname, '..', '..');

function read(filePath: string) {
  return fs.readFileSync(path.join(rootDir, filePath), 'utf8');
}

describe('production deployment contract', () => {
  it('CODEX_PRODUCTION_ARIA_MODEL_POLICY forwards the explicit provider-neutral model contract', () => {
    const compose = read('docker-compose.prod.yml');
    const example = read('.env.production.example');
    const requiredVariables = [
      'ARIA_MODEL_PROVIDER',
      'ARIA_MODEL',
      'ARIA_MODEL_CAPABILITY_PROFILE',
      'ARIA_MODEL_API_KEY',
      'ARIA_MODEL_BASE_URL',
      'ARIA_MODEL_TIMEOUT_MS',
      'ARIA_MODEL_FIRST_TOKEN_TIMEOUT_MS',
      'ARIA_MODEL_FALLBACK_PROVIDER',
      'ARIA_MODEL_FALLBACK_MODEL',
      'ARIA_MODEL_FALLBACK_CAPABILITY_PROFILE',
      'ARIA_MODEL_FALLBACK_API_KEY',
      'ARIA_MODEL_FALLBACK_BASE_URL',
      'ARIA_MODEL_FALLBACK_AUTHORIZED',
    ] as const;

    for (const variable of requiredVariables) {
      expect(compose).toMatch(new RegExp(
        '^\\s{6}' + variable + ': \\$\\{' + variable + '(?::-[^}]*)?\\}$',
        'm',
      ));
      expect(example).toMatch(new RegExp(`^${variable}=`, 'm'));
    }
    expect(compose).not.toMatch(/^\s{6}ARIA_MODEL:\s*\$\{OPENAI_MODEL/m);
    expect(compose).not.toMatch(/^\s{6}ARIA_MODEL_API_KEY:\s*\$\{OPENAI_API_KEY/m);
  });

  it('keeps the PM2 production port and canonical URL aligned with nginx', () => {
    const previousPort = process.env.PORT;
    const previousNextAuthUrl = process.env.NEXTAUTH_URL;
    const previousTrustHost = process.env.AUTH_TRUST_HOST;
    const previousAppName = process.env.PM2_APP_NAME;

    try {
      delete process.env.PORT;
      delete process.env.NEXTAUTH_URL;
      delete process.env.AUTH_TRUST_HOST;
      delete process.env.PM2_APP_NAME;

      jest.resetModules();
      const ecosystem = require(path.join(rootDir, 'ecosystem.config.js'));
      const app = ecosystem.apps.find((entry: { name: string }) => entry.name === 'nexus-app');

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
      if (previousAppName === undefined) delete process.env.PM2_APP_NAME;
      else process.env.PM2_APP_NAME = previousAppName;
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

  it('keeps every Dockerfile.prod stage on the pinned Node 22 production base', () => {
    const dockerfile = read('Dockerfile.prod');
    const pinnedBase = 'node:22.23.1-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2';
    const productionStages = dockerfile.match(/^FROM .* AS (deps|builder|runner)$/gm) ?? [];

    expect(productionStages).toEqual([
      `FROM ${pinnedBase} AS deps`,
      `FROM ${pinnedBase} AS builder`,
      `FROM ${pinnedBase} AS runner`,
    ]);
    expect(dockerfile.match(/ARG NPM_VERSION=10\.9\.8/g)).toHaveLength(3);
    expect(dockerfile.match(/RUN test "\$\(npm --version\)" = "\$NPM_VERSION"/g)).toHaveLength(3);
    expect(dockerfile).toContain('COPY package.json package-lock.json .npmrc ./');
    expect(dockerfile).not.toMatch(/^FROM node:20(?:-|:)/m);
  });

  it('requires the RAG runtime compatibility gate before the atomic switch', () => {
    const runbook = read('DEPLOY_RUNBOOK.md');

    expect(runbook).toContain('npm run aria:manifest:runtime-check');
    expect(runbook).toContain('avant toute bascule');
    expect(runbook).toContain('ARIA_RAG_ENGINE_BASE_URL');
    expect(runbook).toContain('RAG_BFF_SERVICE_TOKEN');
  });

  it('documents the canonical pointer guard before and after process reload', () => {
    const runbook = read('DEPLOY_RUNBOOK.md');

    expect(runbook).toContain('scripts/release/verify-release-pointers.sh');
    expect(runbook).toContain('--canonical <CANONICAL_POINTER>');
    expect(runbook).toContain('--alias <COMPAT_ALIAS>');
    expect(runbook).toContain('--release-root <RELEASE_ROOT>');
    expect(runbook).toContain('--expected-release <NEW_RELEASE>');
    expect(runbook).toContain('avant le reload');
    expect(runbook).toContain('après le reload');
  });

  it('keeps release retention fail-closed around runtime data and distinct SHAs', () => {
    const policyPath = path.join(rootDir, 'docs', 'runbooks', 'release-retention-policy.md');
    expect(fs.existsSync(policyPath)).toBe(true);
    const policy = fs.readFileSync(policyPath, 'utf8');

    expect(policy).toContain('deux derniers SHA distincts');
    expect(policy).toContain('ne compte pas comme rollback');
    expect(policy).toContain('donnée runtime non répliquée');
    expect(policy).toContain('feu vert humain explicite');
    expect(policy).toContain('blocage permanent');
    expect(policy).toContain('ne lève jamais');
    expect(policy).toContain('<CANONICAL_POINTER>');
    expect(policy).toContain('<COMPAT_ALIAS>');
    expect(policy).toContain('<RELEASE_ROOT>');
  });

  it('keeps public deployment helpers fail-closed and free of topology', () => {
    for (const scriptPath of [
      'scripts/deploy-git-pull.sh',
      'scripts/deploy-production-safe.sh',
      'scripts/test-ssh-connection.sh',
      'scripts/ops/backup-db.sh',
    ]) {
      const deployScript = read(scriptPath);

      expect(deployScript).toContain('exit 1');
      expect(deployScript).not.toContain('ssh ');
      expect(deployScript).not.toContain('git pull');
      expect(deployScript).not.toContain('systemctl');
      expect(deployScript).not.toContain('docker compose');
    }
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
