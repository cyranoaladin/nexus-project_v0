import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import packageJson from '@/package.json';
import { listAriaResourceRecords } from '@/lib/aria/manifests/resource-registry';
import { assertResourcesIntegrity } from '@/lib/aria/resources';
import {
  REQUIRED_ARIA_STANDALONE_ROUTE_KEYS,
  inspectAriaSourceArtifact,
  inspectAriaStandaloneArtifact,
  readAriaArtifactMode,
} from '@/scripts/aria/check-production-artifact';
import {
  ariaResourceCopyFailureReason,
  copyAriaResourceArtifacts,
  readAriaResourceCopyArguments,
  resolveAriaResourceCopyDestination,
} from '@/scripts/aria/copy-resource-artifacts';

function write(root: string, relativePath: string, content: string | Buffer): void {
  const absolute = join(root, relativePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}

function fixtureRoot(): string {
  return mkdtempSync(join(tmpdir(), 'aria-standalone-artifact-'));
}

function createValidStandalone(): string {
  const root = fixtureRoot();
  const standalone = join(root, '.next/standalone');
  write(standalone, 'server.js', 'module.exports = {};\n');
  const appPaths = Object.fromEntries(REQUIRED_ARIA_STANDALONE_ROUTE_KEYS.map((routeKey) => {
    const tracedPath = `app${routeKey}.js`;
    write(standalone, `.next/server/${tracedPath}`, 'module.exports = {};\n');
    write(
      standalone,
      `.next/server/${tracedPath}.nft.json`,
      `${JSON.stringify({ version: 1, files: [] })}\n`,
    );
    return [routeKey, tracedPath];
  }));
  write(
    standalone,
    '.next/server/app-paths-manifest.json',
    `${JSON.stringify(appPaths)}\n`,
  );
  for (const resource of listAriaResourceRecords()) {
    for (const version of resource.versions) {
      const destination = join(standalone, 'programmes', version.storage.relativePath);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(join(process.cwd(), 'programmes', version.storage.relativePath), destination);
    }
  }
  return root;
}

function createValidSource(): string {
  const root = fixtureRoot();
  for (const routeKey of REQUIRED_ARIA_STANDALONE_ROUTE_KEYS) {
    write(root, `app${routeKey}.ts`, 'export {};\n');
  }
  for (const resource of listAriaResourceRecords()) {
    for (const version of resource.versions) {
      const destination = join(root, 'programmes', version.storage.relativePath);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(join(process.cwd(), 'programmes', version.storage.relativePath), destination);
    }
  }
  return root;
}

describe('ARIA built standalone artifact gate', () => {
  it('CODEX_REGISTERED_RESOURCES_PACKAGED copies immutable Registry versions without deleting traced programme assets', async () => {
    const root = fixtureRoot();
    const standalone = join(root, '.next/standalone');
    write(standalone, 'programmes/unregistered.txt', 'must be removed');
    const result = spawnSync(
      join(process.cwd(), 'node_modules/.bin/tsx'),
      [
        join(process.cwd(), 'scripts/aria/copy-resource-artifacts.ts'),
        '--repository-root',
        process.cwd(),
        '--standalone-root',
        standalone,
      ],
      { encoding: 'utf8' },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ARIA_RESOURCE_ARTIFACTS_COPIED=5');
    expect(existsSync(join(standalone, 'programmes/unregistered.txt'))).toBe(true);
    await expect(assertResourcesIntegrity(join(standalone, 'programmes'))).resolves.toBeUndefined();

    const buildSequence =
      'tsx scripts/aria/copy-resource-artifacts.ts && tsx scripts/aria/check-production-artifact.ts --mode standalone';
    expect(packageJson.scripts.build).toContain(buildSequence);
    expect(packageJson.scripts['build:e2e']).toContain(buildSequence);
  });

  it('covers the in-process Registry copy, including replacement of an existing verified artifact', async () => {
    const root = fixtureRoot();
    const standalone = join(root, '.next/standalone');
    write(standalone, 'programmes/unregistered.txt', 'traced programme metadata');

    await expect(copyAriaResourceArtifacts({
      repositoryRoot: process.cwd(),
      standaloneRoot: standalone,
    })).resolves.toBe(5);
    await expect(copyAriaResourceArtifacts({
      repositoryRoot: process.cwd(),
      standaloneRoot: standalone,
    })).resolves.toBe(5);

    expect(existsSync(join(standalone, 'programmes/unregistered.txt'))).toBe(true);
    await expect(assertResourcesIntegrity(join(standalone, 'programmes'))).resolves.toBeUndefined();
  });

  it('fails closed for missing, non-directory and symlinked copy roots', async () => {
    const root = fixtureRoot();
    const standalone = join(root, 'standalone');
    mkdirSync(standalone);
    const repositoryFile = join(root, 'repository-file');
    writeFileSync(repositoryFile, 'not a directory');
    await expect(copyAriaResourceArtifacts({
      repositoryRoot: repositoryFile,
      standaloneRoot: standalone,
    })).rejects.toThrow('ARIA_RESOURCE_COPY_REPOSITORY_ROOT_INVALID');
    await expect(copyAriaResourceArtifacts({
      repositoryRoot: join(root, 'missing-repository'),
      standaloneRoot: standalone,
    })).rejects.toThrow('ARIA_RESOURCE_COPY_REPOSITORY_ROOT_INVALID');

    const standaloneFile = join(root, 'standalone-file');
    writeFileSync(standaloneFile, 'not a directory');
    await expect(copyAriaResourceArtifacts({
      repositoryRoot: process.cwd(),
      standaloneRoot: standaloneFile,
    })).rejects.toThrow('ARIA_RESOURCE_COPY_STANDALONE_ROOT_INVALID');

    const linkedStandalone = join(root, 'linked-standalone');
    symlinkSync(standalone, linkedStandalone);
    await expect(copyAriaResourceArtifacts({
      repositoryRoot: process.cwd(),
      standaloneRoot: linkedStandalone,
    })).rejects.toThrow('ARIA_RESOURCE_COPY_STANDALONE_ROOT_INVALID');
  });

  it('rejects symbolic destination entries and destination parents', async () => {
    const firstVersion = listAriaResourceRecords()[0]!.versions[0]!;
    const root = fixtureRoot();
    const standalone = join(root, 'standalone');
    mkdirSync(join(standalone, 'programmes'), { recursive: true });
    const outsideFile = join(root, 'outside.pdf');
    writeFileSync(outsideFile, '%PDF-outside');
    symlinkSync(
      outsideFile,
      join(standalone, 'programmes', firstVersion.storage.relativePath),
    );
    await expect(copyAriaResourceArtifacts({
      repositoryRoot: process.cwd(),
      standaloneRoot: standalone,
    })).rejects.toThrow('ARIA_RESOURCE_COPY_DESTINATION_INVALID');

    rmSync(join(standalone, 'programmes'), { recursive: true, force: true });
    mkdirSync(join(standalone, 'programmes'), { recursive: true });
    const outsideDirectory = join(root, 'outside-directory');
    mkdirSync(outsideDirectory);
    symlinkSync(
      outsideDirectory,
      join(standalone, 'programmes', 'automatismes-eds-premiere'),
    );
    await expect(copyAriaResourceArtifacts({
      repositoryRoot: process.cwd(),
      standaloneRoot: standalone,
    })).rejects.toThrow('ARIA_RESOURCE_COPY_DESTINATION_INVALID');
  });

  it('removes an exclusive-write temporary file after a copy collision', async () => {
    const root = fixtureRoot();
    const standalone = join(root, 'standalone');
    const programmes = join(standalone, 'programmes');
    mkdirSync(programmes, { recursive: true });
    const firstVersion = listAriaResourceRecords()[0]!.versions[0]!;
    const temporary = join(
      programmes,
      `.${firstVersion.storage.relativePath}.aria-copy-${process.pid}-0`,
    );
    writeFileSync(temporary, 'collision');

    await expect(copyAriaResourceArtifacts({
      repositoryRoot: process.cwd(),
      standaloneRoot: standalone,
    })).rejects.toThrow();
    expect(existsSync(temporary)).toBe(false);
  });

  it('validates copy destinations, CLI arguments and safe public failure reasons', () => {
    const root = fixtureRoot();
    const standalone = join(root, 'standalone');
    expect(resolveAriaResourceCopyDestination(root, 'nested/resource.pdf'))
      .toBe(join(root, 'nested/resource.pdf'));
    expect(() => resolveAriaResourceCopyDestination(root, ''))
      .toThrow('ARIA_RESOURCE_COPY_PATH_INVALID');
    expect(() => resolveAriaResourceCopyDestination(root, '../outside.pdf'))
      .toThrow('ARIA_RESOURCE_COPY_PATH_INVALID');

    expect(readAriaResourceCopyArguments([])).toEqual({
      repositoryRoot: process.cwd(),
      standaloneRoot: join(process.cwd(), '.next/standalone'),
    });
    expect(readAriaResourceCopyArguments(['--repository-root', root])).toEqual({
      repositoryRoot: root,
      standaloneRoot: join(root, '.next/standalone'),
    });
    expect(readAriaResourceCopyArguments(['--standalone-root', standalone])).toEqual({
      repositoryRoot: process.cwd(),
      standaloneRoot: standalone,
    });
    expect(readAriaResourceCopyArguments([
      '--repository-root', root,
      '--standalone-root', standalone,
    ])).toEqual({ repositoryRoot: root, standaloneRoot: standalone });
    expect(() => readAriaResourceCopyArguments(['--unknown', root]))
      .toThrow('ARIA_RESOURCE_COPY_ARGUMENTS_INVALID');
    expect(() => readAriaResourceCopyArguments(['--repository-root']))
      .toThrow('ARIA_RESOURCE_COPY_ARGUMENTS_INVALID');
    expect(() => readAriaResourceCopyArguments([
      '--repository-root', root,
      '--repository-root', root,
    ])).toThrow('ARIA_RESOURCE_COPY_ARGUMENTS_INVALID');
    expect(ariaResourceCopyFailureReason(new Error('safe-copy-failure'))).toBe('safe-copy-failure');
    expect(ariaResourceCopyFailureReason(null)).toBe('ARIA_RESOURCE_COPY_FAILED');
  });

  it('rejects a repository root that is not a real directory', async () => {
    const root = fixtureRoot();
    const repositoryFile = join(root, 'repository-file');
    writeFileSync(repositoryFile, 'not-a-directory');

    await expect(inspectAriaStandaloneArtifact(repositoryFile)).rejects.toThrow(
      'ARIA_STANDALONE_ROOT_INVALID',
    );
  });

  it('ARTIFACT_REJECTS_SYMLINKED_NEXT_PARENT', async () => {
    const root = createValidStandalone();
    const next = join(root, '.next');
    const outside = join(root, 'outside-next');
    renameSync(next, outside);
    symlinkSync(outside, next);

    await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
      'ARIA_STANDALONE_ROOT_INVALID',
    );
  });

  it('SOURCE_ARTIFACT_REJECTS_SYMLINKED_ROUTE_PARENT', async () => {
    const root = createValidSource();
    const ariaRoutes = join(root, 'app/api/aria');
    const outside = join(root, 'outside-aria-routes');
    renameSync(ariaRoutes, outside);
    symlinkSync(outside, ariaRoutes);

    await expect(inspectAriaSourceArtifact(root)).rejects.toThrow(
      'ARIA_SOURCE_ROUTE_MISSING:chat/route.ts',
    );
  });

  it('accepts exactly the nine traced routes and every immutable Registry version recursively', async () => {
    const root = createValidStandalone();
    write(root, '.next/standalone/programmes/unregistered/nested/evidence.pdf', '%PDF-extra');

    await expect(inspectAriaStandaloneArtifact(root)).resolves.toEqual({
      status: 'READY',
      tracedAriaRoutes: 9,
      resourceFiles: 6,
    });
  });

  it.each([
    ['missing', false],
    ['symbolic', true],
  ] as const)('rejects a %s standalone server entry point', async (_case, symbolic) => {
    const root = createValidStandalone();
    const server = join(root, '.next/standalone/server.js');
    rmSync(server);
    if (symbolic) {
      write(root, '.next/standalone/server-target.js', 'module.exports = {};\n');
      symlinkSync('server-target.js', server);
      expect(lstatSync(server).isSymbolicLink()).toBe(true);
    }
    await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
      'ARIA_STANDALONE_SERVER_MISSING',
    );
  });

  it('rejects a standalone server entry point with the wrong filesystem kind', async () => {
    const root = createValidStandalone();
    const server = join(root, '.next/standalone/server.js');
    rmSync(server);
    mkdirSync(server);

    await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
      'ARIA_STANDALONE_SERVER_MISSING',
    );
  });

  it.each([
    ['missing', false],
    ['symbolic', true],
  ] as const)('rejects a %s app-paths manifest', async (_case, symbolic) => {
    const root = createValidStandalone();
    const manifest = join(root, '.next/standalone/.next/server/app-paths-manifest.json');
    rmSync(manifest);
    if (symbolic) {
      write(root, '.next/standalone/.next/server/manifest-target.json', '{}\n');
      symlinkSync('manifest-target.json', manifest);
    }
    await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
      'ARIA_STANDALONE_APP_PATHS_MISSING',
    );
  });

  it('rejects a deceptive nine-route manifest when one canonical route is absent', async () => {
    const root = createValidStandalone();
    const manifestPath = join(root, '.next/standalone/.next/server/app-paths-manifest.json');
    const appPaths = Object.fromEntries(REQUIRED_ARIA_STANDALONE_ROUTE_KEYS.map((routeKey) => [
      routeKey,
      `app${routeKey}.js`,
    ]));
    delete appPaths['/api/aria/chat/route'];
    appPaths['/api/aria/deceptive/route'] = 'app/api/aria/deceptive/route.js';
    writeFileSync(manifestPath, `${JSON.stringify(appPaths)}\n`);

    await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
      'ARIA_STANDALONE_ROUTE_MISSING:/api/aria/chat/route',
    );
  });

  it.each(['missing', 'symbolic'] as const)(
    'rejects a %s traced route artifact',
    async (kind) => {
      const root = createValidStandalone();
      const route = join(root, '.next/standalone/.next/server/app/api/aria/chat/route.js');
      rmSync(route);
      if (kind === 'symbolic') {
        write(root, '.next/standalone/.next/server/app/api/aria/chat/target.js', 'module.exports = {};\n');
        symlinkSync('target.js', route);
      }
      await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
        'ARIA_STANDALONE_ROUTE_ARTIFACT_MISSING:/api/aria/chat/route',
      );
    },
  );

  it.each(['missing', 'symbolic'] as const)(
    'rejects a %s traced route NFT manifest',
    async (kind) => {
      const root = createValidStandalone();
      const trace = join(
        root,
        '.next/standalone/.next/server/app/api/aria/chat/route.js.nft.json',
      );
      rmSync(trace);
      if (kind === 'symbolic') {
        write(root, '.next/standalone/.next/server/app/api/aria/chat/trace-target.json', '{"version":1,"files":[]}\n');
        symlinkSync('trace-target.json', trace);
      }
      await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
        'ARIA_STANDALONE_ROUTE_TRACE_MISSING:/api/aria/chat/route',
      );
    },
  );

  it.each([
    ['malformed JSON', '{'],
    ['array root', '[]'],
    ['unsupported version', JSON.stringify({ version: 2, files: [] })],
    ['non-array files', JSON.stringify({ version: 1, files: {} })],
    ['non-string file', JSON.stringify({ version: 1, files: [42] })],
  ])('rejects a route NFT manifest with %s', async (_case, content) => {
    const root = createValidStandalone();
    write(
      root,
      '.next/standalone/.next/server/app/api/aria/chat/route.js.nft.json',
      content,
    );
    await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
      'ARIA_STANDALONE_ROUTE_TRACE_INVALID:/api/aria/chat/route',
    );
  });

  it('rejects a traced route reached through a symlinked parent directory', async () => {
    const root = createValidStandalone();
    const serverRoot = join(root, '.next/standalone/.next/server');
    const appRoot = join(serverRoot, 'app');
    const outside = join(root, 'outside-app');
    renameSync(appRoot, outside);
    symlinkSync(outside, appRoot);

    await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
      'ARIA_STANDALONE_ROUTE_ARTIFACT_MISSING:/api/aria/chat/route',
    );
  });

  it.each([
    ['invalid JSON', '{'],
    ['wrong shape', '[]'],
    ['non-string target', JSON.stringify({ '/api/aria/chat/route': 42 })],
  ])('rejects an app-paths manifest with %s', async (_case, content) => {
    const root = createValidStandalone();
    writeFileSync(
      join(root, '.next/standalone/.next/server/app-paths-manifest.json'),
      content,
    );
    await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
      'ARIA_STANDALONE_APP_PATHS_INVALID',
    );
  });

  it.each([
    ['absolute', '/tmp/route.js'],
    ['traversal', '../route.js'],
    ['backslash', 'app\\api\\aria\\chat\\route.js'],
    ['empty', ''],
    ['dot segment', './route.js'],
    ['empty segment', 'app//route.js'],
  ])('rejects an %s traced route target', async (_case, tracedPath) => {
    const root = createValidStandalone();
    const manifestPath = join(root, '.next/standalone/.next/server/app-paths-manifest.json');
    const appPaths = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, string>;
    appPaths['/api/aria/chat/route'] = tracedPath;
    writeFileSync(manifestPath, JSON.stringify(appPaths));
    await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
      'ARIA_STANDALONE_ROUTE_TRACE_INVALID:/api/aria/chat/route',
    );
  });

  it('rejects two canonical routes traced to the same artifact', async () => {
    const root = createValidStandalone();
    const manifestPath = join(root, '.next/standalone/.next/server/app-paths-manifest.json');
    const appPaths = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, string>;
    appPaths['/api/aria/chat/route'] = appPaths['/api/aria/conversations/route']!;
    writeFileSync(manifestPath, JSON.stringify(appPaths));
    await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
      'ARIA_STANDALONE_ROUTE_TRACE_COLLISION',
    );
  });

  it('rejects an ARIA route trace that captures repository test or coverage artifacts', async () => {
    const root = createValidStandalone();
    write(
      root,
      '.next/standalone/.next/server/app/api/aria/chat/route.js.nft.json',
      `${JSON.stringify({
        version: 1,
        files: [
          '../../../../../../__tests__/aria/private-fixture.json',
          '../../../../../../e2e/aria/private-fixture.json',
          '../../../../../../coverage/coverage-final.json',
          '../../../../../../.artifacts/aria/coverage/evidence.json',
        ],
      })}\n`,
    );

    await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
      'ARIA_STANDALONE_ROUTE_TRACE_FORBIDDEN:/api/aria/chat/route',
    );
  });

  it('rejects a route NFT entry that resolves outside the standalone root', async () => {
    const root = createValidStandalone();
    write(
      root,
      '.next/standalone/.next/server/app/api/aria/chat/route.js.nft.json',
      `${JSON.stringify({ version: 1, files: ['../../../../../../../outside.json'] })}\n`,
    );
    await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
      'ARIA_STANDALONE_ROUTE_TRACE_INVALID:/api/aria/chat/route',
    );
  });

  it.each([
    ['absolute', '/tmp/private.json'],
    ['backslash', 'runtime\\private.json'],
  ])('rejects an %s route NFT dependency path before filesystem access', async (_case, dependency) => {
    const root = createValidStandalone();
    write(
      root,
      '.next/standalone/.next/server/app/api/aria/chat/route.js.nft.json',
      `${JSON.stringify({ version: 1, files: [dependency] })}\n`,
    );

    await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
      'ARIA_STANDALONE_ROUTE_TRACE_INVALID:/api/aria/chat/route',
    );
  });

  it('rejects a traced route below a non-directory parent entry', async () => {
    const root = createValidStandalone();
    const appRoot = join(root, '.next/standalone/.next/server/app');
    rmSync(appRoot, { recursive: true });
    writeFileSync(appRoot, 'not-a-directory');

    await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
      'ARIA_STANDALONE_ROUTE_ARTIFACT_MISSING:/api/aria/chat/route',
    );
  });

  it.each(['missing', 'symbolic'] as const)(
    'rejects a %s in-root route NFT dependency',
    async (kind) => {
      const root = createValidStandalone();
      const dependency = join(root, '.next/standalone/runtime/safe-dependency.json');
      if (kind === 'symbolic') {
        write(root, '.next/standalone/runtime/dependency-target.json', '{}\n');
        mkdirSync(dirname(dependency), { recursive: true });
        symlinkSync('dependency-target.json', dependency);
      }
      write(
        root,
        '.next/standalone/.next/server/app/api/aria/chat/route.js.nft.json',
        `${JSON.stringify({
          version: 1,
          files: ['../../../../../../runtime/safe-dependency.json'],
        })}\n`,
      );

      await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
        'ARIA_STANDALONE_ROUTE_TRACE_ENTRY_INVALID:/api/aria/chat/route',
      );
    },
  );

  it('rejects a programmes root with the wrong filesystem kind', async () => {
    const root = createValidStandalone();
    const programmes = join(root, '.next/standalone/programmes');
    rmSync(programmes, { recursive: true });
    writeFileSync(programmes, 'not-a-directory');

    await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
      'ARIA_STANDALONE_PROGRAMMES_MISSING',
    );
  });

  it('does not classify dependency-owned test directories as repository artifacts', async () => {
    const root = createValidStandalone();
    write(root, '.next/standalone/node_modules/dependency/__tests__/fixture.json', '{}\n');
    write(
      root,
      '.next/standalone/.next/server/app/api/aria/chat/route.js.nft.json',
      `${JSON.stringify({
        version: 1,
        files: ['../../../../../../node_modules/dependency/__tests__/fixture.json'],
      })}\n`,
    );

    await expect(inspectAriaStandaloneArtifact(root)).resolves.toMatchObject({ status: 'READY' });
  });

  it('rejects an unexpected additional ARIA route', async () => {
    const root = createValidStandalone();
    const manifestPath = join(root, '.next/standalone/.next/server/app-paths-manifest.json');
    const appPaths = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, string>;
    appPaths['/api/aria/extra/route'] = 'app/api/aria/extra/route.js';
    writeFileSync(manifestPath, JSON.stringify(appPaths));
    await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
      'ARIA_STANDALONE_ROUTE_COUNT:10',
    );
  });

  it.each(['missing', 'symbolic'] as const)(
    'rejects a %s programmes root',
    async (kind) => {
      const root = createValidStandalone();
      const programmes = join(root, '.next/standalone/programmes');
      const outside = join(root, 'outside-programmes');
      if (kind === 'symbolic') renameSync(programmes, outside);
      else rmSync(programmes, { recursive: true });
      if (kind === 'symbolic') symlinkSync(outside, programmes);
      await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
        'ARIA_STANDALONE_PROGRAMMES_MISSING',
      );
    },
  );

  it('rejects an unregistered symlink nested in programmes', async () => {
    const root = createValidStandalone();
    const programmes = join(root, '.next/standalone/programmes');
    writeFileSync(join(root, 'outside-extra.pdf'), '%PDF-extra');
    symlinkSync(join(root, 'outside-extra.pdf'), join(programmes, 'unregistered-link.pdf'));
    await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
      'ARIA_STANDALONE_PROGRAMME_ENTRY_INVALID:unregistered-link.pdf',
    );
  });

  it.each(['missing', 'hash-drift', 'symbolic'] as const)(
    'rejects a Registry resource version that is %s in the standalone',
    async (kind) => {
      const root = createValidStandalone();
      const version = listAriaResourceRecords()[0]!.versions[0]!;
      const artifact = join(root, '.next/standalone/programmes', version.storage.relativePath);
      rmSync(artifact);
      if (kind === 'hash-drift') writeFileSync(artifact, Buffer.alloc(version.sizeBytes, 0x41));
      if (kind === 'symbolic') {
        const target = join(root, '.next/standalone/programmes/resource-target.pdf');
        copyFileSync(join(process.cwd(), 'programmes', version.storage.relativePath), target);
        symlinkSync(target, artifact);
      }
      await expect(inspectAriaStandaloneArtifact(root)).rejects.toThrow(
        `ARIA resource registry integrity failed for ${listAriaResourceRecords()[0]!.resourceId}`,
      );
    },
  );

  it('parses both explicit CLI forms and rejects missing, duplicate or unknown modes', () => {
    expect(readAriaArtifactMode(['--mode', 'source'])).toBe('source');
    expect(readAriaArtifactMode(['--mode=standalone'])).toBe('standalone');
    expect(() => readAriaArtifactMode([])).toThrow('ARIA_ARTIFACT_MODE_REQUIRED');
    expect(() => readAriaArtifactMode(['--mode', 'source', '--mode=standalone']))
      .toThrow('ARIA_ARTIFACT_MODE_REQUIRED');
    expect(() => readAriaArtifactMode(['--mode=invalid']))
      .toThrow('ARIA_ARTIFACT_MODE_REQUIRED');
    expect(() => readAriaArtifactMode(['--unknown']))
      .toThrow('ARIA_ARTIFACT_MODE_REQUIRED');
    expect(() => readAriaArtifactMode(['--mode']))
      .toThrow('ARIA_ARTIFACT_MODE_REQUIRED');
  });

  it('binds the final production gate to standalone and keeps source qualification explicit', () => {
    expect(packageJson.scripts['aria:artifact:check']).toBe(
      'tsx scripts/aria/check-production-artifact.ts --mode standalone',
    );
    expect(packageJson.scripts['aria:artifact:source-check']).toBe(
      'tsx scripts/aria/check-production-artifact.ts --mode source',
    );
  });
});
