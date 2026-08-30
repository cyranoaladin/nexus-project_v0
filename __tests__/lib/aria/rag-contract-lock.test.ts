import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const EXPECTED_SCHEMAS = [
  'internal-identity-envelope.json',
  'resource-registry-bootstrap-v1.json',
  'resource-registry-snapshot-v1.json',
  'retrieval-error.json',
  'retrieval-request.json',
  'retrieval-response.json',
  'servable-corpus-index-v1.json',
  'servable-corpus-manifest-v1.json',
] as const;

const digestSchema = z.string().regex(/^[0-9a-f]{64}$/);
const lockSchema = z.object({
  protocolVersion: z.literal(1),
  producerRepository: z.literal('cyranoaladin/RAG'),
  producerCommit: z.string().regex(/^[0-9a-f]{40}$/),
  packageVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  schemas: z.record(z.object({
    $id: z.string().url(),
    sha256: digestSchema,
  }).strict()),
}).strict();

describe('ARIA imported RAG contracts lock', () => {
  it('pins every authoritative schema byte-for-byte to one companion commit', () => {
    const root = join(process.cwd(), 'data/aria/generated/rag-contracts/v1');
    const lock = lockSchema.parse(JSON.parse(readFileSync(
      join(process.cwd(), 'data/aria/rag/contracts.lock.json'),
      'utf8',
    )));

    expect(Object.keys(lock.schemas).sort()).toEqual([...EXPECTED_SCHEMAS].sort());
    for (const filename of EXPECTED_SCHEMAS) {
      const bytes = readFileSync(join(root, filename));
      const schema = JSON.parse(bytes.toString('utf8')) as { $id?: string };
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        lock.schemas[filename]?.sha256,
      );
      expect(schema.$id).toBe(lock.schemas[filename]?.$id);
    }
  });
});
