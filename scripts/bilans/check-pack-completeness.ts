import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parse as parseYaml } from 'yaml';

type JsonRecord = Record<string, unknown>;
export type MetadataSource = 'json' | 'yaml';

export type CompletenessResult = Readonly<{
  id: string;
  missing: readonly string[];
}>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function completeRationale(value: unknown): boolean {
  return nonEmptyString(value) && String(value).trim().toUpperCase() !== 'A REMPLACER';
}

export function missingMetadataFields(item: JsonRecord, source: MetadataSource): string[] {
  const missing: string[] = [];
  if (!nonEmptyString(item.nodeCpsId)) missing.push('nodeCpsId');
  if (![1, 2, 3].includes(item.difficulty as number)) missing.push('difficulty');
  if (!Number.isInteger(item.targetTimeSec) || Number(item.targetTimeSec) < 15 || Number(item.targetTimeSec) > 300) {
    missing.push('targetTimeSec');
  }
  if (!nonEmptyString(item.shortCorrection)) missing.push('shortCorrection');

  if (Array.isArray(item.options)) {
    item.options.forEach((candidate, index) => {
      if (!isRecord(candidate)) return;
      const isCorrect = source === 'yaml' ? candidate.correct : candidate.isCorrect;
      if (isCorrect !== false || completeRationale(candidate.distractorRationale)) return;
      const rawId = source === 'yaml' ? candidate.key : candidate.id;
      const optionId = nonEmptyString(rawId) ? String(rawId) : String(index + 1);
      missing.push(`options.${optionId}.distractorRationale`);
    });
  }
  return missing;
}

export function evaluateCompleteness(items: readonly unknown[], source: MetadataSource): CompletenessResult[] {
  return items.map((candidate, index) => {
    if (!isRecord(candidate)) return { id: `item[${index}]`, missing: ['item object'] };
    return {
      id: nonEmptyString(candidate.id) ? String(candidate.id) : `item[${index}]`,
      missing: missingMetadataFields(candidate, source),
    };
  });
}

function parseArguments(args: string[]): { source: MetadataSource; requestedPath: string } | null {
  const remaining = [...args];
  let source: MetadataSource = 'json';
  const sourceIndex = remaining.indexOf('--source');
  if (sourceIndex >= 0) {
    const requestedSource = remaining[sourceIndex + 1];
    if (requestedSource !== 'json' && requestedSource !== 'yaml') return null;
    source = requestedSource;
    remaining.splice(sourceIndex, 2);
  }
  if (remaining.length !== 1) return null;
  return { source, requestedPath: remaining[0] };
}

function readItems(requestedPath: string, source: MetadataSource): unknown[] {
  const filePath = path.resolve(process.cwd(), requestedPath);
  const text = readFileSync(filePath, 'utf8');
  const raw = source === 'yaml' ? parseYaml(text) as unknown : JSON.parse(text) as unknown;
  if (!isRecord(raw)) throw new Error('PACK_STRUCTURE_INVALID: root must be an object');
  const items = source === 'yaml'
    ? raw.items
    : isRecord(raw.questionnaire) ? raw.questionnaire.items : undefined;
  if (!Array.isArray(items)) {
    throw new Error(`PACK_STRUCTURE_INVALID: ${source === 'yaml' ? 'items' : 'questionnaire.items'} must be an array`);
  }
  return items;
}

export function main(args: string[]): number {
  const parsed = parseArguments(args);
  if (parsed === null) {
    console.error('Usage: tsx scripts/bilans/check-pack-completeness.ts [--source json|yaml] <source>');
    return 2;
  }

  try {
    const results = evaluateCompleteness(readItems(parsed.requestedPath, parsed.source), parsed.source);
    const complete = results.filter(({ missing }) => missing.length === 0).length;
    console.log(`PACK_COMPLETENESS=${complete}/${results.length}`);
    for (const result of results) {
      if (result.missing.length > 0) console.log(`${result.id}: ${result.missing.join(', ')}`);
    }
    return complete === results.length ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
