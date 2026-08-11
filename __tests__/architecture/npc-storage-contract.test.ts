/** @jest-environment node */

import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  CopyPageStatus as ClientCopyPageStatus,
  CopySubmissionStatus as ClientCopySubmissionStatus,
} from '@/types/enums';

const ROOT = process.cwd();
const MIGRATION_PATH =
  'prisma/migrations/20260811140000_add_npc_unavailable_integrity/migration.sql';
const REQUIRED_STORAGE_ROOT =
  '${NPC_STORAGE_ROOT:?NPC_STORAGE_ROOT is required}';
const E2E_STORAGE_ROOT = '/mnt/npc-storage-e2e';
const E2E_STORAGE_VOLUME = 'e2e-npc-storage';

const EXPECTED_CONTAINER_SURFACES = [
  'Dockerfile',
  'Dockerfile.dependencies',
  'Dockerfile.e2e',
  'Dockerfile.playwright',
  'Dockerfile.prod',
  'docker-compose.e2e.yml',
  'docker-compose.npc.yml',
  'docker-compose.prod.local-domain.override.yml',
  'docker-compose.prod.override.yml',
  'docker-compose.prod.yml',
  'docker-compose.test.yml',
  'docker-compose.yml',
  'services/npc-worker/Dockerfile',
  'tools/pdf-generator/Dockerfile',
] as const;

const SCAN_EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.next',
  '.worktrees',
  'academic-luxury-design',
  'coverage',
  'docs',
  'nexus-src',
  'node_modules',
]);

const EXPECTED_MIGRATION_STATEMENTS = [
  'ALTER TYPE "CopySubmissionStatus" ADD VALUE \'UNAVAILABLE\'',
  'ALTER TYPE "CopyPageStatus" ADD VALUE \'UNAVAILABLE\'',
  'ALTER TABLE "copy_submissions" ADD COLUMN "unavailableReason" TEXT, ADD COLUMN "unavailableAt" TIMESTAMP(3)',
  'ALTER TABLE "copy_pages" ADD COLUMN "unavailableReason" TEXT, ADD COLUMN "unavailableAt" TIMESTAMP(3), ADD COLUMN "sha256" TEXT',
  'ALTER TABLE "copy_pages" ADD CONSTRAINT "copy_pages_sha256_format_check" CHECK ("sha256" IS NULL OR "sha256" ~ \'^[0-9a-fA-F]{64}$\')',
] as const;

type ComposeVolume =
  | string
  | {
      type?: string;
      source?: string;
      target?: string;
      read_only?: boolean;
      bind?: { create_host_path?: boolean };
    };

type ComposeService = {
  environment?: Record<string, unknown> | string[];
  volumes?: ComposeVolume[];
};

type ComposeFile = {
  services?: Record<string, ComposeService>;
  volumes?: Record<string, unknown>;
};

function readRequired(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

function prismaBlock(kind: 'enum' | 'model', name: string): string {
  const schema = readRequired('prisma/schema.prisma');
  const match = schema.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`));

  if (!match) {
    throw new Error(`Missing Prisma ${kind} ${name}`);
  }

  return match[1];
}

function prismaEnumValues(name: string): string[] {
  return prismaBlock('enum', name)
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/)[0]);
}

function normalizeSqlStatements(sql: string): string[] {
  return sql
    .replace(/^\s*--.*$/gm, '')
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function isContainerSurface(fileName: string): boolean {
  return (
    /^Dockerfile(?:\..+)?$/.test(fileName) ||
    /^docker-compose(?:\..+)?\.ya?ml$/.test(fileName)
  );
}

function discoverContainerSurfaces(
  directory = ROOT,
  discovered: string[] = [],
): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SCAN_EXCLUDED_DIRECTORIES.has(entry.name)) {
        discoverContainerSurfaces(join(directory, entry.name), discovered);
      }
      continue;
    }

    if (entry.isFile() && isContainerSurface(entry.name)) {
      discovered.push(relative(ROOT, join(directory, entry.name)));
    }
  }

  return discovered.sort();
}

function discoverRuntimeFiles(
  directory: string,
  discovered: string[] = [],
): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      discoverRuntimeFiles(absolutePath, discovered);
    } else if (
      entry.isFile() &&
      /\.(?:[cm]?[jt]s|[jt]sx)$/.test(entry.name)
    ) {
      discovered.push(relative(ROOT, absolutePath));
    }
  }

  return discovered;
}

function discoverActiveNpcRuntimeModules(): string[] {
  const roots = [
    'app/api/npc',
    'app/dashboard/coach/npc',
    'app/dashboard/eleve/npc',
    'app/dashboard/parent/npc',
    'components/npc',
    'lib/npc',
    'services/npc-worker',
  ];
  return [
    'instrumentation.ts',
    'next.config.mjs',
    ...roots.flatMap((root) => discoverRuntimeFiles(join(ROOT, root))),
  ].sort();
}

function parseCompose(relativePath: string): ComposeFile {
  return parseYaml(readRequired(relativePath)) as ComposeFile;
}

function requireService(compose: ComposeFile, serviceName: string): ComposeService {
  const service = compose.services?.[serviceName];
  if (!service) {
    throw new Error(`Missing Compose service ${serviceName}`);
  }
  return service;
}

function environmentValue(service: ComposeService, variable: string): unknown {
  if (Array.isArray(service.environment)) {
    const matches = service.environment.filter((entry) =>
      entry.startsWith(`${variable}=`),
    );
    expect(matches).toHaveLength(1);
    return matches[0].slice(variable.length + 1);
  }

  return service.environment?.[variable];
}

function expectStorageBind(service: ComposeService, readOnly: boolean): void {
  const storageMounts = (service.volumes ?? []).filter(
    (volume) =>
      typeof volume === 'string'
        ? volume.includes('NPC_STORAGE_ROOT')
        : volume.source === REQUIRED_STORAGE_ROOT ||
          volume.target === REQUIRED_STORAGE_ROOT,
  );

  expect(storageMounts).toEqual([
    {
      type: 'bind',
      source: REQUIRED_STORAGE_ROOT,
      target: REQUIRED_STORAGE_ROOT,
      read_only: readOnly,
      bind: { create_host_path: false },
    },
  ]);
}

describe('NPC storage and unavailable-state architecture contract', () => {
  test('keeps Prisma and client-side NPC status enums synchronized', () => {
    expect(prismaEnumValues('CopySubmissionStatus')).toEqual(
      Object.values(ClientCopySubmissionStatus),
    );
    expect(prismaEnumValues('CopyPageStatus')).toEqual(
      Object.values(ClientCopyPageStatus),
    );
    expect(Object.values(ClientCopySubmissionStatus)).toContain('UNAVAILABLE');
    expect(Object.values(ClientCopyPageStatus)).toContain('UNAVAILABLE');
  });

  test('declares nullable unavailable and integrity metadata in Prisma', () => {
    const submission = prismaBlock('model', 'CopySubmission');
    expect(submission).toMatch(/^\s*unavailableReason\s+String\?\s*$/m);
    expect(submission).toMatch(/^\s*unavailableAt\s+DateTime\?\s*$/m);

    const page = prismaBlock('model', 'CopyPage');
    expect(page).toMatch(/^\s*unavailableReason\s+String\?\s*$/m);
    expect(page).toMatch(/^\s*unavailableAt\s+DateTime\?\s*$/m);
    expect(page).toMatch(/^\s*sha256\s+String\?\s*$/m);
    expect(page).toMatch(
      /^\s*documentType\s+CorrectionDocumentType\s+@default\(STUDENT_COPY\)\s*$/m,
    );
  });

  test('allows only the reviewed additive migration statements', () => {
    const migration = readRequired(MIGRATION_PATH);

    expect(normalizeSqlStatements(migration)).toEqual(
      EXPECTED_MIGRATION_STATEMENTS,
    );
    expect(migration).not.toMatch(
      /\b(?:DROP|RENAME|TRUNCATE|UPDATE|INSERT|DELETE|MERGE)\b|\bALTER\s+COLUMN\b/i,
    );
    expect(migration).not.toMatch(/\bc[a-z0-9]{24}\b/i);
  });

  test('scans every active container surface for legacy NPC storage contracts', () => {
    const containerSurfaces = discoverContainerSurfaces();
    expect(containerSurfaces).toEqual(
      expect.arrayContaining([...EXPECTED_CONTAINER_SURFACES]),
    );

    const e2eLiteralUsers: string[] = [];
    for (const file of containerSurfaces) {
      const source = readRequired(file);
      if (source.includes(E2E_STORAGE_ROOT)) {
        e2eLiteralUsers.push(file);
      }

      const sourceWithoutAllowedE2eRoot =
        file === 'docker-compose.e2e.yml'
          ? source.replaceAll(E2E_STORAGE_ROOT, '')
          : source;

      expect(sourceWithoutAllowedE2eRoot).not.toMatch(
        /\b(?:NPC_UPLOAD_DIR|UPLOAD_DIR)\b|process\.cwd\(\)|(?:^|[\s"'=:])\/(?:[\w.-]+\/)*(?:npc(?:-storage(?:-[\w.-]+)?)?|uploads\/copies|copies)(?:\/[\w.-]+)*(?=$|[\s"',:])/im,
      );

      if (basename(file).startsWith('Dockerfile')) {
        expect(source).not.toContain('NPC_STORAGE_ROOT');
      }
    }

    expect(e2eLiteralUsers).toEqual(['docker-compose.e2e.yml']);
  });

  test('runs the NPC worker with the same unprivileged uid as the app', () => {
    const workerDockerfile = readRequired('services/npc-worker/Dockerfile');
    const userDeclaration = workerDockerfile.indexOf('USER nextjs');
    const command = workerDockerfile.indexOf(
      'CMD ["./node_modules/.bin/tsx", "services/npc-worker/index.ts"]',
    );

    expect(workerDockerfile).toMatch(
      /addgroup\s+--system\s+--gid\s+1001\s+nodejs/,
    );
    expect(workerDockerfile).toMatch(
      /adduser\s+--system\s+--uid\s+1001\s+--ingroup\s+nodejs\s+nextjs/,
    );
    expect(workerDockerfile).toContain('COPY tsconfig.json ./');
    expect(userDeclaration).toBeGreaterThan(-1);
    expect(command).toBeGreaterThan(userDeclaration);
    expect(workerDockerfile).not.toMatch(/chown\s+-R\s+(?:\/|\/app)\b/);
  });

  test('scans every active NPC runtime module for legacy storage contracts', () => {
    const runtimeModules = discoverActiveNpcRuntimeModules();

    expect(runtimeModules).toEqual(
      expect.arrayContaining([
        'instrumentation.ts',
        'next.config.mjs',
        'lib/npc/config.ts',
        'lib/npc/pdf-converter.ts',
        'lib/npc/storage.ts',
        'services/npc-worker/index.ts',
      ]),
    );

    for (const file of runtimeModules) {
      const source = readRequired(file);
      const storageSource =
        file === 'next.config.mjs'
          ? source.replace(/outputFileTracingRoot:\s*process\.cwd\(\),?/, '')
          : source;
      expect(storageSource).not.toMatch(/\b(?:NPC_UPLOAD_DIR|UPLOAD_DIR)\b/);
      expect(storageSource).not.toMatch(/process\.cwd\(\)/);
      expect(storageSource).not.toMatch(
        /(?:^|[\s"'=:])\/(?:var|mnt|srv|data|opt|home|tmp)\/(?:[\w.-]+\/)*(?:npc(?:-storage(?:-[\w.-]+)?)?|uploads(?:\/copies)?|copies)(?:\/[\w.-]+)*(?=$|[\s"',:)])/im,
      );
      expect(storageSource).not.toMatch(/(?:^|[\s"'])uploads\/copies(?:\/|$)/im);
    }
  });

  test('requires a non-creating persistent bind for NPC and production services', () => {
    const npcWorker = requireService(
      parseCompose('docker-compose.npc.yml'),
      'npc-worker',
    );
    expect(environmentValue(npcWorker, 'NPC_STORAGE_ROOT')).toBe(
      REQUIRED_STORAGE_ROOT,
    );
    expectStorageBind(npcWorker, true);

    const production = parseCompose('docker-compose.prod.yml');
    const app = requireService(production, 'nexus-app');
    expect(environmentValue(app, 'NPC_STORAGE_ROOT')).toBe(
      REQUIRED_STORAGE_ROOT,
    );
    expectStorageBind(app, false);

    const productionWorker = requireService(production, 'npc-worker');
    expect(environmentValue(productionWorker, 'NPC_STORAGE_ROOT')).toBe(
      REQUIRED_STORAGE_ROOT,
    );
    expectStorageBind(productionWorker, true);
  });

  test('uses only the disposable named storage root in E2E with LLM disabled', () => {
    const e2e = parseCompose('docker-compose.e2e.yml');
    const app = requireService(e2e, 'app-e2e');

    expect(environmentValue(app, 'NPC_STORAGE_ROOT')).toBe(E2E_STORAGE_ROOT);
    expect(environmentValue(app, 'NPC_LLM_MODE')).toBe('off');
    expect(
      (app.volumes ?? []).filter(
        (volume) => {
          if (typeof volume === 'string') {
            return (
              volume.includes(E2E_STORAGE_VOLUME) ||
              volume.includes(E2E_STORAGE_ROOT)
            );
          }
          return (
            volume.source === E2E_STORAGE_VOLUME ||
            volume.target === E2E_STORAGE_ROOT
          );
        },
      ),
    ).toEqual([`${E2E_STORAGE_VOLUME}:${E2E_STORAGE_ROOT}`]);
    expect(
      Object.keys(e2e.volumes ?? {}).filter((volume) => volume.includes('npc')),
    ).toEqual([E2E_STORAGE_VOLUME]);
    expect(e2e.volumes?.[E2E_STORAGE_VOLUME]).toBeNull();
  });

  test('leaves NPC storage provisioning to deployment, not the worker image', () => {
    const dockerfile = readRequired('services/npc-worker/Dockerfile');

    expect(dockerfile).not.toContain('NPC_STORAGE_ROOT');
    expect(dockerfile).not.toMatch(/^\s*RUN\s+.*\bmkdir\b.*(?:npc|uploads)/im);
  });
});
