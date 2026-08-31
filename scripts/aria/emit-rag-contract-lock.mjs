import { appendFileSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCK_PATH = 'data/aria/rag/contracts.lock.json';
const REPOSITORY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;

export function parseRagContractProducerLock(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('ARIA_RAG_CONTRACT_LOCK_INVALID');
  }
  const { producerRepository, producerCommit } = value;
  if (
    typeof producerRepository !== 'string'
    || !REPOSITORY_PATTERN.test(producerRepository)
    || typeof producerCommit !== 'string'
    || !COMMIT_PATTERN.test(producerCommit)
  ) {
    throw new Error('ARIA_RAG_CONTRACT_LOCK_INVALID');
  }
  return Object.freeze({ producerRepository, producerCommit });
}

export function readRagContractProducerLock(repositoryRoot = process.cwd()) {
  const lock = JSON.parse(readFileSync(resolve(repositoryRoot, LOCK_PATH), 'utf8'));
  return parseRagContractProducerLock(lock);
}

export function emitRagContractProducerLock(input = {}) {
  const repositoryRoot = input.repositoryRoot ?? process.cwd();
  const outputPath = input.outputPath ?? process.env.GITHUB_OUTPUT;
  if (typeof outputPath !== 'string' || !isAbsolute(outputPath)) {
    throw new Error('ARIA_RAG_CONTRACT_GITHUB_OUTPUT_INVALID');
  }
  const lock = readRagContractProducerLock(repositoryRoot);
  appendFileSync(
    outputPath,
    `producer_repository=${lock.producerRepository}\nproducer_commit=${lock.producerCommit}\n`,
    { encoding: 'utf8' },
  );
  return lock;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  emitRagContractProducerLock();
}
