import { createHash } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';

export const ARIA_RAG_CONTRACT_FILENAMES = Object.freeze([
  'internal-identity-envelope.json',
  'resource-registry-bootstrap-v1.json',
  'resource-registry-snapshot-v1.json',
  'retrieval-error.json',
  'retrieval-request.json',
  'retrieval-response.json',
  'servable-corpus-index-v1.json',
  'servable-corpus-manifest-v1.json',
] as const);

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const gitCommitSchema = z.string().regex(/^[0-9a-f]{40}$/);
const upstreamLockSchema = z.object({
  packageVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  schemas: z.record(z.object({
    $id: z.string().url(),
    sha256: sha256Schema,
  }).strict()),
}).strict();

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function stableJson(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export interface ImportRagContractsInput {
  readonly ragRepositoryRoot: string;
  readonly ragProducerCommit: string;
  readonly nexusRepositoryRoot: string;
  readonly check: boolean;
}

export function importRagContracts(input: ImportRagContractsInput): void {
  const producerCommit = gitCommitSchema.parse(input.ragProducerCommit);
  const sourceDirectory = join(input.ragRepositoryRoot, 'packages/contracts/schema');
  const sourceLock = upstreamLockSchema.parse(JSON.parse(readFileSync(
    join(sourceDirectory, 'contracts.lock.json'),
    'utf8',
  )));
  const targetDirectory = join(
    input.nexusRepositoryRoot,
    'data/aria/generated/rag-contracts/v1',
  );
  const lockPath = join(input.nexusRepositoryRoot, 'data/aria/rag/contracts.lock.json');
  const schemas: Record<string, { $id: string; sha256: string }> = {};
  const expectedFiles = new Map<string, Buffer>();

  for (const filename of ARIA_RAG_CONTRACT_FILENAMES) {
    const upstreamEntry = sourceLock.schemas[filename];
    if (!upstreamEntry) throw new Error(`RAG_CONTRACT_LOCK_ENTRY_MISSING:${filename}`);
    const bytes = readFileSync(join(sourceDirectory, filename));
    if (sha256(bytes) !== upstreamEntry.sha256) {
      throw new Error(`RAG_CONTRACT_SOURCE_DIGEST_MISMATCH:${filename}`);
    }
    const schema = z.object({ $id: z.string().url() }).passthrough().parse(
      JSON.parse(bytes.toString('utf8')),
    );
    if (schema.$id !== upstreamEntry.$id) {
      throw new Error(`RAG_CONTRACT_SOURCE_ID_MISMATCH:${filename}`);
    }
    schemas[filename] = upstreamEntry;
    expectedFiles.set(join(targetDirectory, filename), bytes);
  }

  expectedFiles.set(lockPath, stableJson({
    protocolVersion: 1,
    producerRepository: 'cyranoaladin/RAG',
    producerCommit,
    packageVersion: sourceLock.packageVersion,
    schemas,
  }));

  if (input.check) {
    for (const [path, expected] of expectedFiles) {
      let actual: Buffer;
      try {
        actual = readFileSync(path);
      } catch {
        throw new Error(`RAG_CONTRACT_IMPORT_MISSING:${path}`);
      }
      if (!actual.equals(expected)) throw new Error(`RAG_CONTRACT_IMPORT_DRIFT:${path}`);
    }
    return;
  }

  mkdirSync(targetDirectory, { recursive: true });
  mkdirSync(join(input.nexusRepositoryRoot, 'data/aria/rag'), { recursive: true });
  for (const [path, expected] of expectedFiles) writeFileSync(path, expected);
  for (const filename of ARIA_RAG_CONTRACT_FILENAMES) {
    const targetPath = join(targetDirectory, filename);
    if (!expectedFiles.has(targetPath)) rmSync(targetPath, { force: true });
  }
}

function requiredArgument(name: string, environmentName: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : process.env[environmentName];
  if (!value?.trim()) throw new Error(`${name} or ${environmentName} is required`);
  return value;
}

if (require.main === module) {
  const ragRepositoryRoot = resolve(requiredArgument(
    '--rag-repository-root',
    'ARIA_RAG_WORKTREE',
  ));
  if (!isAbsolute(ragRepositoryRoot)) throw new Error('RAG repository root must be absolute');
  importRagContracts({
    ragRepositoryRoot,
    ragProducerCommit: requiredArgument('--rag-producer-commit', 'ARIA_RAG_EXPECTED_SHA'),
    nexusRepositoryRoot: process.cwd(),
    check: process.argv.includes('--check'),
  });
}
