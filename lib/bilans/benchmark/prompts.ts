import 'server-only';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

import { sha256Canonical } from '@/lib/llm/openrouter/hash';
import {
  REPORT_NEXUS_DRAFT_JSON_SCHEMA,
  REPORT_PARENT_DRAFT_JSON_SCHEMA,
  REPORT_STUDENT_DRAFT_JSON_SCHEMA,
} from './report-contracts';

const PromptAudienceSchema = z.enum(['PARENT', 'STUDENT', 'NEXUS']);
const PromptMetadataSchema = z.object({
  id: z.string().regex(/^bilan-report-(?:parent|student|nexus)$/),
  version: z.literal('1'),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  audience: PromptAudienceSchema,
  allowedFields: z.array(z.string()).min(1),
  forbiddenClaims: z.array(z.string()).min(1),
  outputSchemaVersion: z.string().min(1),
  outputSchemaChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  compatiblePolicies: z.array(z.string()).min(1),
}).strict();

const HEADER = /<!-- nexus-prompt-metadata\n([\s\S]*?)\n-->\n\n([\s\S]*)$/u;

const SCHEMA_BY_AUDIENCE = {
  PARENT: REPORT_PARENT_DRAFT_JSON_SCHEMA,
  STUDENT: REPORT_STUDENT_DRAFT_JSON_SCHEMA,
  NEXUS: REPORT_NEXUS_DRAFT_JSON_SCHEMA,
} as const;

export function loadVersionedReportPrompt(
  audience: z.infer<typeof PromptAudienceSchema>,
) {
  const filename = `report-${audience.toLowerCase()}-v1.md`;
  const source = readFileSync(
    resolve(process.cwd(), 'content/bilans/prompts', filename),
    'utf8',
  );
  const match = HEADER.exec(source);
  if (match === null) throw new Error('REPORT_PROMPT_INVALID');
  const metadata = PromptMetadataSchema.parse(JSON.parse(match[1]));
  const body = match[2].trimEnd();
  const { checksum: _checksum, ...checksumValues } = metadata;
  if (
    metadata.audience !== audience
    || metadata.outputSchemaChecksum !== sha256Canonical(
      SCHEMA_BY_AUDIENCE[audience],
    )
    || metadata.checksum !== sha256Canonical({
      metadata: checksumValues,
      body,
    })
  ) {
    throw new Error('REPORT_PROMPT_CHECKSUM_MISMATCH');
  }
  return Object.freeze({
    metadata: Object.freeze(metadata),
    body,
  });
}
