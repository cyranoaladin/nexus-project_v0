import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  REPORT_NEXUS_DRAFT_JSON_SCHEMA,
  REPORT_NEXUS_JSON_SCHEMA,
  REPORT_PARENT_DRAFT_JSON_SCHEMA,
  REPORT_PARENT_JSON_SCHEMA,
  REPORT_STUDENT_DRAFT_JSON_SCHEMA,
  REPORT_STUDENT_JSON_SCHEMA,
} from '../../lib/bilans/benchmark/report-contracts';
import { sha256Canonical } from '../../lib/llm/openrouter/hash';

const ROOT = process.cwd();
const CHECK_ONLY = process.argv.includes('--check');
const HEADER = /<!-- nexus-prompt-metadata\n([\s\S]*?)\n-->\n\n([\s\S]*)$/u;

const SCHEMAS = [
  ['report-parent-v1.schema.json', REPORT_PARENT_JSON_SCHEMA],
  ['report-student-v1.schema.json', REPORT_STUDENT_JSON_SCHEMA],
  ['report-nexus-v1.schema.json', REPORT_NEXUS_JSON_SCHEMA],
  ['report-parent-draft-v1.schema.json', REPORT_PARENT_DRAFT_JSON_SCHEMA],
  ['report-student-draft-v1.schema.json', REPORT_STUDENT_DRAFT_JSON_SCHEMA],
  ['report-nexus-draft-v1.schema.json', REPORT_NEXUS_DRAFT_JSON_SCHEMA],
] as const;

const DRAFT_BY_AUDIENCE = new Map([
  ['PARENT', REPORT_PARENT_DRAFT_JSON_SCHEMA],
  ['STUDENT', REPORT_STUDENT_DRAFT_JSON_SCHEMA],
  ['NEXUS', REPORT_NEXUS_DRAFT_JSON_SCHEMA],
]);

function expectedSchemaText(schema: Readonly<Record<string, unknown>>): string {
  return `${JSON.stringify(schema, null, 2)}\n`;
}

function assertOrWrite(path: string, expected: string): void {
  if (CHECK_ONLY) {
    const actual = readFileSync(path, 'utf8');
    if (actual !== expected) throw new Error(`Generated asset drift: ${path}`);
    return;
  }
  writeFileSync(path, expected, { encoding: 'utf8', mode: 0o644 });
}

for (const [filename, schema] of SCHEMAS) {
  assertOrWrite(
    resolve(ROOT, 'content/bilans/schemas', filename),
    expectedSchemaText(schema),
  );
}

for (const audience of ['PARENT', 'STUDENT', 'NEXUS'] as const) {
  const filename = `report-${audience.toLowerCase()}-v1.md`;
  const path = resolve(ROOT, 'content/bilans/prompts', filename);
  const source = readFileSync(path, 'utf8');
  const match = HEADER.exec(source);
  if (match === null) throw new Error(`Invalid prompt envelope: ${filename}`);
  const metadata = JSON.parse(match[1]) as Record<string, unknown>;
  const body = match[2].trimEnd();
  const schema = DRAFT_BY_AUDIENCE.get(audience);
  if (schema === undefined) throw new Error('Missing audience schema.');
  metadata.outputSchemaChecksum = sha256Canonical(schema);
  const { checksum: _oldChecksum, ...checksumValues } = metadata;
  metadata.checksum = sha256Canonical({
    metadata: checksumValues,
    body,
  });
  const expected = [
    '<!-- nexus-prompt-metadata',
    JSON.stringify(metadata, null, 2),
    '-->',
    '',
    body,
    '',
  ].join('\n');
  assertOrWrite(path, expected);
}

process.stdout.write(
  `REPORT_CONTRACT_ASSETS=${CHECK_ONLY ? 'VALID' : 'GENERATED'}\n`,
);
