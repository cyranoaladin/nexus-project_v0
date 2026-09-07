import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { assertLocalResourceArtifactsIntegrity } from '../../lib/aria/resources';
import { listActiveAriaResourceRecords } from '../../lib/aria/manifests/resource-registry';

const REQUIRED_ROUTE_SUFFIXES = [
  'chat/route.ts',
  'conversations/[conversationId]/messages/route.ts',
  'conversations/route.ts',
  'curriculum/route.ts',
  'feedback/route.ts',
  'profile/route.ts',
  'resources/[resourceId]/versions/[resourceVersionId]/content/route.ts',
  'resources/route.ts',
  'turns/[turnId]/cancel/route.ts',
] as const;

export const REQUIRED_ARIA_STANDALONE_ROUTE_KEYS = Object.freeze(
  REQUIRED_ROUTE_SUFFIXES.map((suffix) => `/api/aria/${suffix.replace(/\.ts$/, '')}`),
);

function assertContainedRealEntry(
  root: string,
  path: string,
  kind: 'file' | 'directory',
  reason: string,
): void {
  try {
    const rootStat = lstatSync(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error(reason);
    const contained = relative(root, path);
    if (!contained || contained.startsWith('..') || isAbsolute(contained)) {
      throw new Error(reason);
    }
    const segments = contained.split(sep);
    let current = root;
    for (let index = 0; index < segments.length; index += 1) {
      current = join(current, segments[index]!);
      const stat = lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error(reason);
      const isFinal = index === segments.length - 1;
      if ((!isFinal && !stat.isDirectory())
        || (isFinal && kind === 'file' && !stat.isFile())
        || (isFinal && kind === 'directory' && !stat.isDirectory())) {
        throw new Error(reason);
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message === reason) throw error;
    throw new Error(reason);
  }
}

export async function inspectAriaSourceArtifact(repositoryRoot: string): Promise<Readonly<{
  status: 'READY';
  ariaRouteCount: number;
  activeResourceVersionCount: number;
}>> {
  const routeRoot = resolve(repositoryRoot, 'app/api/aria');
  for (const suffix of REQUIRED_ROUTE_SUFFIXES) {
    assertContainedRealEntry(
      repositoryRoot,
      resolve(routeRoot, suffix),
      'file',
      `ARIA_SOURCE_ROUTE_MISSING:${suffix}`,
    );
  }
  await assertLocalResourceArtifactsIntegrity(resolve(repositoryRoot, 'programmes'));
  const active = listActiveAriaResourceRecords();
  const activeResourceVersionCount = active.reduce(
    (total, resource) => total + resource.versions.filter((version) => version.status === 'ACTIVE').length,
    0,
  );
  if (activeResourceVersionCount !== active.length) {
    throw new Error('ARIA_ACTIVE_RESOURCE_VERSION_CARDINALITY_INVALID');
  }
  return Object.freeze({
    status: 'READY' as const,
    ariaRouteCount: REQUIRED_ROUTE_SUFFIXES.length,
    activeResourceVersionCount,
  });
}

function recursivelyListFiles(root: string): readonly string[] {
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(relative(root, absolute));
      else throw new Error(`ARIA_STANDALONE_PROGRAMME_ENTRY_INVALID:${relative(root, absolute)}`);
    }
  };
  visit(root);
  return files;
}

function parseAppPathsManifest(path: string): Readonly<Record<string, string>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error('ARIA_STANDALONE_APP_PATHS_INVALID');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
    || Object.values(parsed).some((value) => typeof value !== 'string')) {
    throw new Error('ARIA_STANDALONE_APP_PATHS_INVALID');
  }
  return parsed as Readonly<Record<string, string>>;
}

function resolveTracedRoute(serverRoot: string, tracedPath: string, routeKey: string): string {
  if (!tracedPath || isAbsolute(tracedPath) || tracedPath.includes('\\')) {
    throw new Error(`ARIA_STANDALONE_ROUTE_TRACE_INVALID:${routeKey}`);
  }
  const segments = tracedPath.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(`ARIA_STANDALONE_ROUTE_TRACE_INVALID:${routeKey}`);
  }
  const absolute = resolve(serverRoot, tracedPath);
  const withinServer = relative(serverRoot, absolute);
  if (!withinServer || withinServer.startsWith('..') || isAbsolute(withinServer)) {
    throw new Error(`ARIA_STANDALONE_ROUTE_TRACE_INVALID:${routeKey}`);
  }
  return absolute;
}

const FORBIDDEN_ROUTE_TRACE_SEGMENTS = new Set([
  '.artifacts',
  '__mocks__',
  '__tests__',
  'coverage',
  'e2e',
  'playwright-report',
  'test-results',
]);

function parseRouteTrace(path: string, routeKey: string): readonly string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`ARIA_STANDALONE_ROUTE_TRACE_INVALID:${routeKey}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`ARIA_STANDALONE_ROUTE_TRACE_INVALID:${routeKey}`);
  }
  const trace = parsed as { readonly version?: unknown; readonly files?: unknown };
  if (trace.version !== 1 || !Array.isArray(trace.files)
    || trace.files.some((file) => typeof file !== 'string' || !file)) {
    throw new Error(`ARIA_STANDALONE_ROUTE_TRACE_INVALID:${routeKey}`);
  }
  return trace.files as readonly string[];
}

function assertRouteTraceSafe(
  standaloneRoot: string,
  routeArtifact: string,
  routeKey: string,
): void {
  const tracePath = `${routeArtifact}.nft.json`;
  assertContainedRealEntry(
    standaloneRoot,
    tracePath,
    'file',
    `ARIA_STANDALONE_ROUTE_TRACE_MISSING:${routeKey}`,
  );
  for (const file of parseRouteTrace(tracePath, routeKey)) {
    if (isAbsolute(file) || file.includes('\\')) {
      throw new Error(`ARIA_STANDALONE_ROUTE_TRACE_INVALID:${routeKey}`);
    }
    const tracedFile = resolve(dirname(routeArtifact), file);
    const withinStandalone = relative(standaloneRoot, tracedFile);
    if (!withinStandalone || withinStandalone.startsWith('..') || isAbsolute(withinStandalone)) {
      throw new Error(`ARIA_STANDALONE_ROUTE_TRACE_INVALID:${routeKey}`);
    }
    const segments = withinStandalone.split(sep);
    if (segments[0] !== 'node_modules'
      && segments.some((segment) => FORBIDDEN_ROUTE_TRACE_SEGMENTS.has(segment))) {
      throw new Error(`ARIA_STANDALONE_ROUTE_TRACE_FORBIDDEN:${routeKey}`);
    }
    assertContainedRealEntry(
      standaloneRoot,
      tracedFile,
      'file',
      `ARIA_STANDALONE_ROUTE_TRACE_ENTRY_INVALID:${routeKey}`,
    );
  }
}

export async function inspectAriaStandaloneArtifact(repositoryRoot: string): Promise<Readonly<{
  status: 'READY';
  tracedAriaRoutes: number;
  resourceFiles: number;
}>> {
  const standalone = resolve(repositoryRoot, '.next/standalone');
  assertContainedRealEntry(
    repositoryRoot,
    standalone,
    'directory',
    'ARIA_STANDALONE_ROOT_INVALID',
  );
  assertContainedRealEntry(
    standalone,
    resolve(standalone, 'server.js'),
    'file',
    'ARIA_STANDALONE_SERVER_MISSING',
  );
  const serverRoot = resolve(standalone, '.next/server');
  const appPathsFile = resolve(serverRoot, 'app-paths-manifest.json');
  assertContainedRealEntry(
    standalone,
    appPathsFile,
    'file',
    'ARIA_STANDALONE_APP_PATHS_MISSING',
  );
  const appPaths = parseAppPathsManifest(appPathsFile);
  const ariaRouteKeys = Object.keys(appPaths).filter((path) => path.startsWith('/api/aria/'));
  for (const routeKey of REQUIRED_ARIA_STANDALONE_ROUTE_KEYS) {
    if (!ariaRouteKeys.includes(routeKey)) {
      throw new Error(`ARIA_STANDALONE_ROUTE_MISSING:${routeKey}`);
    }
  }
  if (ariaRouteKeys.length !== REQUIRED_ARIA_STANDALONE_ROUTE_KEYS.length) {
    throw new Error(`ARIA_STANDALONE_ROUTE_COUNT:${ariaRouteKeys.length}`);
  }
  const traceTargets = new Set<string>();
  for (const routeKey of REQUIRED_ARIA_STANDALONE_ROUTE_KEYS) {
    const tracedPath = appPaths[routeKey]!;
    const absolute = resolveTracedRoute(serverRoot, tracedPath, routeKey);
    assertContainedRealEntry(
      serverRoot,
      absolute,
      'file',
      `ARIA_STANDALONE_ROUTE_ARTIFACT_MISSING:${routeKey}`,
    );
    assertRouteTraceSafe(standalone, absolute, routeKey);
    traceTargets.add(absolute);
  }
  if (traceTargets.size !== REQUIRED_ARIA_STANDALONE_ROUTE_KEYS.length) {
    throw new Error('ARIA_STANDALONE_ROUTE_TRACE_COLLISION');
  }
  const programmeRoot = resolve(standalone, 'programmes');
  assertContainedRealEntry(
    standalone,
    programmeRoot,
    'directory',
    'ARIA_STANDALONE_PROGRAMMES_MISSING',
  );
  await assertLocalResourceArtifactsIntegrity(programmeRoot);
  const resourceFiles = recursivelyListFiles(programmeRoot).length;
  return Object.freeze({
    status: 'READY' as const,
    tracedAriaRoutes: ariaRouteKeys.length,
    resourceFiles,
  });
}

export function readAriaArtifactMode(argv: readonly string[]): 'source' | 'standalone' {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === '--mode') {
      const value = argv[index + 1];
      if (value !== undefined) values.push(value);
      index += 1;
    } else if (argument.startsWith('--mode=')) {
      values.push(argument.slice('--mode='.length));
    } else {
      throw new Error('ARIA_ARTIFACT_MODE_REQUIRED');
    }
  }
  if (values.length === 1 && (values[0] === 'source' || values[0] === 'standalone')) {
    return values[0];
  }
  throw new Error('ARIA_ARTIFACT_MODE_REQUIRED');
}

async function main(): Promise<void> {
  const mode = readAriaArtifactMode(process.argv.slice(2));
  const report = mode === 'source'
    ? await inspectAriaSourceArtifact(process.cwd())
    : await inspectAriaStandaloneArtifact(process.cwd());
  process.stdout.write(`ARIA_PRODUCTION_ARTIFACT=${report.status}\n`);
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

if (require.main === module) void main();
