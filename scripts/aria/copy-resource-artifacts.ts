import { createWriteStream } from 'node:fs';
import { lstat, mkdir, realpath, rename, rm } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { openVerifiedAriaResourceFile } from '@/lib/aria/infrastructure/resources/secure-open-linux';
import { listAriaResourceRecords } from '@/lib/aria/manifests/resource-registry';
import { assertLocalResourceArtifactsIntegrity } from '@/lib/aria/resources';

interface CopyAriaResourceArtifactsInput {
  readonly repositoryRoot: string;
  readonly standaloneRoot: string;
}

function isNodeError(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

async function assertRealCanonicalDirectory(path: string, reason: string): Promise<void> {
  try {
    const stat = await lstat(path);
    if (!stat.isDirectory() || await realpath(path) !== path) {
      throw new Error(reason);
    }
  } catch (error) {
    if (error instanceof Error && error.message === reason) throw error;
    throw new Error(reason);
  }
}

export function resolveAriaResourceCopyDestination(
  destinationRoot: string,
  relativePath: string,
): string {
  const destination = resolve(destinationRoot, relativePath);
  const contained = relative(destinationRoot, destination);
  if (!contained || contained.startsWith('..')) {
    throw new Error('ARIA_RESOURCE_COPY_PATH_INVALID');
  }
  return destination;
}

export interface AriaResourceCopyResult {
  readonly localResourcesCopied: number;
  readonly nonlocalResourcesSkippedByDesign: number;
}

export async function copyAriaResourceArtifacts(
  input: CopyAriaResourceArtifactsInput,
): Promise<AriaResourceCopyResult> {
  const repositoryRoot = resolve(input.repositoryRoot);
  const standaloneRoot = resolve(input.standaloneRoot);
  await assertRealCanonicalDirectory(repositoryRoot, 'ARIA_RESOURCE_COPY_REPOSITORY_ROOT_INVALID');
  await assertRealCanonicalDirectory(standaloneRoot, 'ARIA_RESOURCE_COPY_STANDALONE_ROOT_INVALID');

  const sourceRoot = resolve(repositoryRoot, 'programmes');
  const destinationRoot = resolve(standaloneRoot, 'programmes');

  await mkdir(destinationRoot, { recursive: true });
  await assertRealCanonicalDirectory(
    destinationRoot,
    'ARIA_RESOURCE_COPY_DESTINATION_INVALID',
  );
  let copied = 0;
  let skipped = 0;
  for (const resource of listAriaResourceRecords()) {
    for (const version of resource.versions) {
      // A RAG-governed ResourceVersion has no local artifact to copy — it is
      // never fabricated, and never silently folded into the same count as a
      // real local copy (Nexus Resource Registry v2, storage-aware).
      if (version.storage.provider !== 'NEXUS_REPOSITORY') {
        skipped += 1;
        continue;
      }
      const destination = resolveAriaResourceCopyDestination(
        destinationRoot,
        version.storage.relativePath,
      );
      const destinationParent = dirname(destination);
      await mkdir(destinationParent, { recursive: true });
      if (await realpath(destinationParent) !== destinationParent) {
        throw new Error('ARIA_RESOURCE_COPY_DESTINATION_INVALID');
      }
      try {
        const existing = await lstat(destination);
        if (!existing.isFile()) {
          throw new Error('ARIA_RESOURCE_COPY_DESTINATION_INVALID');
        }
      } catch (error) {
        if (!isNodeError(error, 'ENOENT')) throw error;
      }
      const temporary = join(
        destinationParent,
        `.${basename(destination)}.aria-copy-${process.pid}-${copied}`,
      );
      const opened = await openVerifiedAriaResourceFile({
        rootDirectory: sourceRoot,
        relativePath: version.storage.relativePath,
        expectedSizeBytes: version.sizeBytes,
        expectedSha256: version.contentSha256,
        expectedMimeType: version.mimeType,
      });
      try {
        await pipeline(
          opened.createReadStream(),
          createWriteStream(temporary, { flags: 'wx', mode: 0o444 }),
        );
        await rename(temporary, destination);
      } catch (error) {
        await rm(temporary, { force: true });
        throw error;
      } finally {
        await opened.close();
      }
      copied += 1;
    }
  }
  await assertLocalResourceArtifactsIntegrity(destinationRoot);
  return Object.freeze({ localResourcesCopied: copied, nonlocalResourcesSkippedByDesign: skipped });
}

export function readAriaResourceCopyArguments(
  argv: readonly string[],
): CopyAriaResourceArtifactsInput {
  let repositoryRoot = process.cwd();
  let standaloneRoot = resolve(repositoryRoot, '.next/standalone');
  const seen = new Set<string>();
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if ((option !== '--repository-root' && option !== '--standalone-root')
      || !value || seen.has(option)) {
      throw new Error('ARIA_RESOURCE_COPY_ARGUMENTS_INVALID');
    }
    seen.add(option);
    if (option === '--repository-root') repositoryRoot = resolve(value);
    else standaloneRoot = resolve(value);
  }
  if (!seen.has('--standalone-root')) standaloneRoot = resolve(repositoryRoot, '.next/standalone');
  return Object.freeze({ repositoryRoot, standaloneRoot });
}

export function ariaResourceCopyFailureReason(error: unknown): string {
  return error instanceof Error ? error.message : 'ARIA_RESOURCE_COPY_FAILED';
}

async function main(): Promise<void> {
  const result = await copyAriaResourceArtifacts(readAriaResourceCopyArguments(process.argv.slice(2)));
  process.stdout.write(`LOCAL_RESOURCES_COPIED=${result.localResourcesCopied}\n`);
  process.stdout.write(`NONLOCAL_RESOURCES_SKIPPED_BY_DESIGN=${result.nonlocalResourcesSkippedByDesign}\n`);
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${ariaResourceCopyFailureReason(error)}\n`);
    process.exitCode = 1;
  });
}
