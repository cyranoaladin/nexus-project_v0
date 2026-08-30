import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { assertResourcesIntegrity } from '../../lib/aria/resources';
import {
  listActiveAriaResourceRecords,
  listAriaResourceRecords,
} from '../../lib/aria/manifests/resource-registry';

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

function assertRegularFile(path: string, reason: string): void {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(reason);
}

export async function inspectAriaSourceArtifact(repositoryRoot: string): Promise<Readonly<{
  status: 'READY';
  ariaRouteCount: number;
  activeResourceVersionCount: number;
}>> {
  const routeRoot = resolve(repositoryRoot, 'app/api/aria');
  for (const suffix of REQUIRED_ROUTE_SUFFIXES) {
    assertRegularFile(resolve(routeRoot, suffix), `ARIA_SOURCE_ROUTE_MISSING:${suffix}`);
  }
  await assertResourcesIntegrity(resolve(repositoryRoot, 'programmes'));
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
      else files.push(relative(root, absolute));
    }
  };
  visit(root);
  return files;
}

export async function inspectAriaStandaloneArtifact(repositoryRoot: string): Promise<Readonly<{
  status: 'READY';
  tracedAriaRoutes: number;
  resourceFiles: number;
}>> {
  const standalone = resolve(repositoryRoot, '.next/standalone');
  assertRegularFile(resolve(standalone, 'server.js'), 'ARIA_STANDALONE_SERVER_MISSING');
  const appPathsFile = resolve(standalone, '.next/server/app-paths-manifest.json');
  assertRegularFile(appPathsFile, 'ARIA_STANDALONE_APP_PATHS_MISSING');
  const appPaths = JSON.parse(readFileSync(appPathsFile, 'utf8')) as Record<string, string>;
  const tracedAriaRoutes = Object.keys(appPaths).filter((path) => path.startsWith('/api/aria/')).length;
  if (tracedAriaRoutes !== REQUIRED_ROUTE_SUFFIXES.length) {
    throw new Error(`ARIA_STANDALONE_ROUTE_COUNT:${tracedAriaRoutes}`);
  }
  const programmeRoot = resolve(standalone, 'programmes');
  await assertResourcesIntegrity(programmeRoot);
  const resourceFiles = recursivelyListFiles(programmeRoot).length;
  const registeredVersionFiles = listAriaResourceRecords().reduce(
    (total, resource) => total + resource.versions.length,
    0,
  );
  if (resourceFiles < registeredVersionFiles) {
    throw new Error('ARIA_STANDALONE_RESOURCE_ARTIFACT_INCOMPLETE');
  }
  return Object.freeze({ status: 'READY' as const, tracedAriaRoutes, resourceFiles });
}

function readMode(): 'source' | 'standalone' {
  const index = process.argv.indexOf('--mode');
  const mode = index >= 0 ? process.argv[index + 1] : undefined;
  if (mode === 'source' || mode === 'standalone') return mode;
  throw new Error('ARIA_ARTIFACT_MODE_REQUIRED');
}

async function main(): Promise<void> {
  const mode = readMode();
  const report = mode === 'source'
    ? await inspectAriaSourceArtifact(process.cwd())
    : await inspectAriaStandaloneArtifact(process.cwd());
  process.stdout.write(`ARIA_PRODUCTION_ARTIFACT=${report.status}\n`);
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

if (require.main === module) void main();
