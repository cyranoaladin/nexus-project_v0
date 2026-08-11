/** @jest-environment node */

import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import ts from 'typescript';
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
const CANONICAL_COPY_PAGE_WRITER = 'lib/npc/copy-page-writer.ts';

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

function discoverActiveApplicationRuntimeModules(): string[] {
  const excludedDirectories = new Set([
    ...SCAN_EXCLUDED_DIRECTORIES,
    '__mocks__',
    '__tests__',
    'archive',
    'audit',
    'e2e',
    'prisma',
    'public',
  ]);
  const discovered: string[] = [];

  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && !excludedDirectories.has(entry.name)) {
          visit(absolutePath);
        }
      } else if (
        entry.isFile() &&
        /\.(?:[cm]?[jt]s|[jt]sx)$/.test(entry.name)
      ) {
        discovered.push(relative(ROOT, absolutePath));
      }
    }
  };
  visit(ROOT);

  return discovered.sort();
}

const COPY_PAGE_WRITE_OPERATIONS = new Set([
  'create',
  'upsert',
  'createMany',
  'createManyAndReturn',
]);
const COPY_PAGE_NESTED_WRITE_OPERATIONS = new Set([
  'create',
  'createMany',
  'upsert',
  'connectOrCreate',
]);

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isParenthesizedExpression(expression)
  ) {
    return unwrapExpression(expression.expression);
  }

  return expression;
}

function propertyNameText(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return undefined;
}

function propertyExpression(
  object: ts.ObjectLiteralExpression,
  propertyName: string,
): ts.Expression | undefined {
  for (const property of object.properties) {
    if (ts.isPropertyAssignment(property) && propertyNameText(property.name) === propertyName) {
      return property.initializer;
    }
    if (ts.isShorthandPropertyAssignment(property) && property.name.text === propertyName) {
      return property.name;
    }
  }

  return undefined;
}

type PrismaWriteFinding = {
  kind: 'delegate' | 'nested';
  path: string;
  line: number;
  operation: string;
};

function isGeneratedPrismaDeclaration(node: ts.Node): boolean {
  return node.getSourceFile().fileName.replaceAll('\\', '/').includes(
    '/node_modules/.prisma/client/',
  );
}

function prismaDelegateCall(
  call: ts.CallExpression,
  checker: ts.TypeChecker,
): { model: string; operation: string } | null {
  const declaration = checker.getResolvedSignature(call)?.declaration;
  if (!declaration || !isGeneratedPrismaDeclaration(declaration)) return null;

  let owner: ts.Node | undefined = declaration;
  while (owner && !ts.isInterfaceDeclaration(owner)) owner = owner.parent;
  if (!owner || !ts.isInterfaceDeclaration(owner)) return null;

  const match = owner.name.text.match(/^([A-Za-z0-9_$]+)Delegate$/);
  if (!match) return null;
  if (!ts.isMethodSignature(declaration) && !ts.isMethodDeclaration(declaration)) {
    return null;
  }
  const operation = propertyNameText(declaration.name);

  return operation ? { model: match[1], operation } : null;
}

function identifierInitializer(
  expression: ts.Expression,
  checker: ts.TypeChecker,
  seenSymbols: Set<ts.Symbol>,
): ts.Expression | null {
  const unwrapped = unwrapExpression(expression);
  if (!ts.isIdentifier(unwrapped)) return unwrapped;

  let symbol = checker.getSymbolAtLocation(unwrapped);
  if (!symbol) return unwrapped;
  if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  if (seenSymbols.has(symbol)) return null;
  seenSymbols.add(symbol);

  for (const declaration of symbol.declarations ?? []) {
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      return identifierInitializer(declaration.initializer, checker, seenSymbols);
    }
    if (ts.isShorthandPropertyAssignment(declaration)) {
      const valueSymbol = checker.getShorthandAssignmentValueSymbol(declaration);
      const valueDeclaration = valueSymbol?.valueDeclaration;
      if (valueDeclaration && ts.isVariableDeclaration(valueDeclaration) && valueDeclaration.initializer) {
        return identifierInitializer(valueDeclaration.initializer, checker, seenSymbols);
      }
    }
  }

  return unwrapped;
}

function inspectNestedPageWrites(
  expression: ts.Expression,
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  findings: PrismaWriteFinding[],
  seenSymbols = new Set<ts.Symbol>(),
  insidePages = false,
): void {
  const resolved = identifierInitializer(expression, checker, seenSymbols);
  if (!resolved) return;

  if (ts.isArrayLiteralExpression(resolved)) {
    for (const element of resolved.elements) {
      if (ts.isSpreadElement(element)) {
        inspectNestedPageWrites(
          element.expression,
          checker,
          sourceFile,
          findings,
          new Set(seenSymbols),
          insidePages,
        );
      } else {
        inspectNestedPageWrites(
          element,
          checker,
          sourceFile,
          findings,
          new Set(seenSymbols),
          insidePages,
        );
      }
    }
    return;
  }

  if (!ts.isObjectLiteralExpression(resolved)) return;
  for (const property of resolved.properties) {
    if (ts.isSpreadAssignment(property)) {
      inspectNestedPageWrites(
        property.expression,
        checker,
        sourceFile,
        findings,
        new Set(seenSymbols),
        insidePages,
      );
      continue;
    }

    const name = property.name && propertyNameText(property.name);
    const initializer = ts.isPropertyAssignment(property)
      ? property.initializer
      : ts.isShorthandPropertyAssignment(property)
        ? property.name
        : undefined;
    if (!name || !initializer) continue;

    if (insidePages && COPY_PAGE_NESTED_WRITE_OPERATIONS.has(name)) {
      findings.push({
        kind: 'nested',
        path: relative(ROOT, sourceFile.fileName),
        line: sourceFile.getLineAndCharacterOfPosition(property.getStart()).line + 1,
        operation: `CopySubmission.pages.${name}`,
      });
    }

    inspectNestedPageWrites(
      initializer,
      checker,
      sourceFile,
      findings,
      new Set(seenSymbols),
      name === 'pages',
    );
  }
}

function inspectPrismaCopyPageWrites(
  program: ts.Program,
  sourceFiles: ts.SourceFile[],
): PrismaWriteFinding[] {
  const checker = program.getTypeChecker();
  const findings: PrismaWriteFinding[] = [];

  for (const sourceFile of sourceFiles) {
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const delegate = prismaDelegateCall(node, checker);
        if (
          delegate?.model === 'CopyPage' &&
          COPY_PAGE_WRITE_OPERATIONS.has(delegate.operation)
        ) {
          findings.push({
            kind: 'delegate',
            path: relative(ROOT, sourceFile.fileName),
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            operation: `CopyPage.${delegate.operation}`,
          });
        }
        if (delegate?.model === 'CopySubmission' && node.arguments[0]) {
          inspectNestedPageWrites(
            node.arguments[0],
            checker,
            sourceFile,
            findings,
          );
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  return findings;
}

function compilerOptions(): ts.CompilerOptions {
  const config = ts.readConfigFile(join(ROOT, 'tsconfig.json'), ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  return ts.parseJsonConfigFileContent(config.config, ts.sys, ROOT).options;
}

function inspectRuntimePrismaWrites(): PrismaWriteFinding[] {
  const fileNames = discoverActiveApplicationRuntimeModules();
  const program = ts.createProgram({
    rootNames: fileNames.map((file) => join(ROOT, file)),
    options: compilerOptions(),
  });
  const sourceFiles = fileNames.map((file) => {
    const sourceFile = program.getSourceFile(join(ROOT, file));
    if (!sourceFile) throw new Error(`TypeScript did not load ${file}`);
    return sourceFile;
  });

  return inspectPrismaCopyPageWrites(program, sourceFiles);
}

const FIXTURE_PRISMA_DECLARATIONS = `
  interface CopyPageCreateData { documentType?: string }
  interface ExplicitCopyPageCreateData extends CopyPageCreateData { documentType: string }
  interface CopyPageDelegate {
    create(args: { data: CopyPageCreateData }): unknown;
    createMany(args: { data: CopyPageCreateData | CopyPageCreateData[] }): unknown;
    createManyAndReturn(args: { data: CopyPageCreateData | CopyPageCreateData[] }): unknown;
    upsert(args: { create: CopyPageCreateData; update: unknown; where: unknown }): unknown;
  }
  interface CopyPageNestedWrites {
    create?: unknown;
    createMany?: unknown;
    upsert?: unknown;
    connectOrCreate?: unknown;
  }
  interface CopySubmissionDelegate {
    create(args: { data: { pages?: CopyPageNestedWrites } }): unknown;
  }
  declare const tx: {
    copyPage: CopyPageDelegate;
    copySubmission: CopySubmissionDelegate;
  };
`;

const FIXTURE_CANONICAL_DECLARATIONS = `
  declare function createCopyPage(
    client: { copyPage: CopyPageDelegate },
    args: { data: ExplicitCopyPageCreateData },
  ): unknown;
`;

function inspectFixture(source: string): {
  findings: PrismaWriteFinding[];
  diagnostics: readonly ts.Diagnostic[];
} {
  const fixturePath = join(ROOT, 'fixture.ts');
  const prismaPath = join(ROOT, 'node_modules/.prisma/client/fixture.d.ts');
  const canonicalPath = join(ROOT, 'canonical.d.ts');
  const sources = new Map([
    [fixturePath, source],
    [prismaPath, FIXTURE_PRISMA_DECLARATIONS],
    [canonicalPath, FIXTURE_CANONICAL_DECLARATIONS],
  ]);
  const options: ts.CompilerOptions = {
    noLib: true,
    strict: true,
    target: ts.ScriptTarget.ESNext,
  };
  const host = ts.createCompilerHost(options);
  const defaultGetSourceFile = host.getSourceFile.bind(host);
  host.fileExists = (fileName) => sources.has(fileName) || ts.sys.fileExists(fileName);
  host.readFile = (fileName) => sources.get(fileName) ?? ts.sys.readFile(fileName);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const fixtureSource = sources.get(fileName);
    return fixtureSource === undefined
      ? defaultGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)
      : ts.createSourceFile(fileName, fixtureSource, languageVersion, true);
  };
  const program = ts.createProgram({
    rootNames: [...sources.keys()],
    options,
    host,
  });
  const fixture = program.getSourceFile(fixturePath);
  if (!fixture) throw new Error('Missing semantic fixture');

  return {
    findings: inspectPrismaCopyPageWrites(program, [fixture]),
    diagnostics: program.getSemanticDiagnostics(fixture),
  };
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

  test('allows exactly the four raw CopyPage writes in the canonical typed boundary', () => {
    const findings = inspectRuntimePrismaWrites();

    expect(findings.map(({ kind, path, operation }) => ({ kind, path, operation })))
      .toEqual([
        {
          kind: 'delegate',
          path: CANONICAL_COPY_PAGE_WRITER,
          operation: 'CopyPage.create',
        },
        {
          kind: 'delegate',
          path: CANONICAL_COPY_PAGE_WRITER,
          operation: 'CopyPage.createMany',
        },
        {
          kind: 'delegate',
          path: CANONICAL_COPY_PAGE_WRITER,
          operation: 'CopyPage.createManyAndReturn',
        },
        {
          kind: 'delegate',
          path: CANONICAL_COPY_PAGE_WRITER,
          operation: 'CopyPage.upsert',
        },
      ]);
  });

  test.each([
    ['direct delegate', `tx.copyPage.create({ data: {} });`],
    ['delegate alias', `const delegate = tx.copyPage; delegate.create({ data: {} });`],
    ['indexed delegate access', `tx['copyPage']['create']({ data: {} });`],
    [
      'nested relational create',
      `tx.copySubmission.create({ data: { pages: { create: {} } } });`,
    ],
  ])('semantic CopyPage guard detects %s', (_label, source) => {
    const { findings } = inspectFixture(source);

    expect(findings).toHaveLength(1);
  });

  test.each([
    [
      'direct createManyAndReturn delegate',
      `tx.copyPage.createManyAndReturn({ data: [{}] });`,
    ],
    [
      'aliased createManyAndReturn delegate',
      `const delegate = tx.copyPage; delegate.createManyAndReturn({ data: [{}] });`,
    ],
    [
      'indexed createManyAndReturn delegate',
      `tx['copyPage']['createManyAndReturn']({ data: [{}] });`,
    ],
  ])('semantic CopyPage guard detects %s', (_label, source) => {
    const { findings } = inspectFixture(source);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.operation).toBe('CopyPage.createManyAndReturn');
  });

  test('semantic CopyPage guard accepts a payload variable through the typed boundary', () => {
    const { findings, diagnostics } = inspectFixture(`
      const payload = { data: { documentType: 'SUBJECT' } };
      createCopyPage(tx, payload);
    `);

    expect(diagnostics).toEqual([]);
    expect(findings).toEqual([]);
  });

  test('typed CopyPage boundary rejects a payload variable without documentType', () => {
    const { diagnostics } = inspectFixture(`
      const payload = { data: {} };
      createCopyPage(tx, payload);
    `);

    expect(diagnostics.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    ).join('\n')).toContain('documentType');
  });

  test('semantic CopyPage guard ignores homonymous non-Prisma objects', () => {
    const { findings } = inspectFixture(`
      const homonymous = {
        copyPage: { create(_args: unknown) { return null; } },
        copySubmission: { create(_args: unknown) { return null; } },
      };
      homonymous.copyPage.create({ data: {} });
      homonymous.copySubmission.create({ data: { pages: { create: {} } } });
    `);

    expect(findings).toEqual([]);
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
