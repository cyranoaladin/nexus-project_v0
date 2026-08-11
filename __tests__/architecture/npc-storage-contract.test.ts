import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const MIGRATION_PATH =
  'prisma/migrations/20260811140000_add_npc_unavailable_integrity/migration.sql';
const REQUIRED_STORAGE_ROOT =
  '${NPC_STORAGE_ROOT:?NPC_STORAGE_ROOT is required}';

const DEPLOYMENT_FILES = [
  'docker-compose.npc.yml',
  'docker-compose.prod.yml',
  'docker-compose.e2e.yml',
  'services/npc-worker/Dockerfile',
] as const;

function read(relativePath: string): string {
  const absolutePath = resolve(ROOT, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : '';
}

function prismaBlock(kind: 'enum' | 'model', name: string): string {
  const schema = read('prisma/schema.prisma');
  const match = schema.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`));

  return match?.[1] ?? '';
}

function occurrences(source: string, value: string): number {
  return source.split(value).length - 1;
}

describe('NPC storage and unavailable-state architecture contract', () => {
  test('declares UNAVAILABLE and nullable integrity metadata in Prisma', () => {
    expect(prismaBlock('enum', 'CopySubmissionStatus')).toMatch(
      /^\s*UNAVAILABLE\s*$/m,
    );
    expect(prismaBlock('enum', 'CopyPageStatus')).toMatch(
      /^\s*UNAVAILABLE\s*$/m,
    );

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

  test('keeps the migration strictly additive and identifier-free', () => {
    const migration = read(MIGRATION_PATH);
    const executableSql = migration
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);

    expect(migration).not.toBe('');
    expect(executableSql).toHaveLength(5);
    expect(executableSql).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^ALTER TYPE /i),
        expect.stringMatching(/^ALTER TABLE /i),
      ]),
    );
    expect(
      executableSql.every((statement) => /^ALTER (?:TYPE|TABLE)\b/i.test(statement)),
    ).toBe(true);
    expect(migration).not.toMatch(/\b(?:UPDATE|INSERT|DELETE|MERGE)\b/i);
    expect(migration).not.toMatch(/\bc[a-z0-9]{24}\b/i);
    expect(migration).toMatch(
      /ALTER TYPE\s+"CopySubmissionStatus"\s+ADD VALUE\s+'UNAVAILABLE'/i,
    );
    expect(migration).toMatch(
      /ALTER TYPE\s+"CopyPageStatus"\s+ADD VALUE\s+'UNAVAILABLE'/i,
    );

    const addedColumns = [...migration.matchAll(/ADD COLUMN\s+"([^"]+)"/gi)];
    expect(addedColumns.map((match) => match[1])).toEqual([
      'unavailableReason',
      'unavailableAt',
      'unavailableReason',
      'unavailableAt',
      'sha256',
    ]);
    expect(migration).not.toMatch(/ADD COLUMN[^,;]*(?:NOT NULL|DEFAULT)/gi);
    expect(migration).toMatch(/"sha256"\s+IS\s+NULL/i);
    expect(migration).toMatch(/\[0-9a-fA-F\]\{64\}/);
  });

  test('uses only NPC_STORAGE_ROOT in active deployment configuration', () => {
    const deploymentSources = DEPLOYMENT_FILES.map((file) => read(file));
    const combined = deploymentSources.join('\n');

    expect(combined).not.toMatch(/\b(?:NPC_UPLOAD_DIR|UPLOAD_DIR)\b/);
    expect(combined).not.toContain('process.cwd()');
    expect(combined).not.toMatch(/\/var\/lib\/nexus\/uploads(?:\/copies)?/);
    expect(combined).not.toContain('/app/uploads/copies');

    const npcCompose = read('docker-compose.npc.yml');
    expect(occurrences(npcCompose, REQUIRED_STORAGE_ROOT)).toBeGreaterThanOrEqual(3);

    const prodCompose = read('docker-compose.prod.yml');
    expect(occurrences(prodCompose, REQUIRED_STORAGE_ROOT)).toBeGreaterThanOrEqual(6);
  });

  test('provides an isolated E2E storage volume with LLM disabled', () => {
    const e2eCompose = read('docker-compose.e2e.yml');

    expect(e2eCompose).toMatch(/^\s+NPC_STORAGE_ROOT:\s+\/mnt\/npc-storage-e2e\s*$/m);
    expect(e2eCompose).toMatch(/^\s+NPC_LLM_MODE:\s+["']?off["']?\s*$/m);
    expect(e2eCompose).toMatch(
      /^\s+- e2e-npc-storage:\/mnt\/npc-storage-e2e\s*$/m,
    );
    expect(e2eCompose).toMatch(/^\s{2}e2e-npc-storage:\s*$/m);
  });

  test('leaves storage provisioning to deployment, not the worker image', () => {
    const dockerfile = read('services/npc-worker/Dockerfile');

    expect(dockerfile).not.toContain('NPC_STORAGE_ROOT');
    expect(dockerfile).not.toMatch(/^\s*RUN\s+.*\bmkdir\b.*(?:npc|uploads)/im);
    expect(dockerfile).not.toMatch(
      /(?:\/[\w.-]+)*\/(?:npc-storage(?:-[\w.-]+)?|uploads|copies)(?=\/|\s|["']|$)/i,
    );
  });
});
