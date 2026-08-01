import { readFileSync } from 'node:fs';
import path from 'node:path';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function missingFields(item: JsonRecord): string[] {
  const missing: string[] = [];
  if (!nonEmptyString(item.nodeCpsId)) missing.push('nodeCpsId');
  if (![1, 2, 3].includes(item.difficulty as number)) missing.push('difficulty');
  if (!Number.isInteger(item.targetTimeSec) || Number(item.targetTimeSec) < 15 || Number(item.targetTimeSec) > 300) {
    missing.push('targetTimeSec');
  }
  if (!nonEmptyString(item.shortCorrection)) missing.push('shortCorrection');

  if (Array.isArray(item.options)) {
    item.options.forEach((candidate, index) => {
      if (!isRecord(candidate) || candidate.isCorrect !== false || nonEmptyString(candidate.distractorRationale)) return;
      const optionId = nonEmptyString(candidate.id) ? String(candidate.id) : String(index + 1);
      missing.push(`options.${optionId}.distractorRationale`);
    });
  }
  return missing;
}

const requestedPath = process.argv[2];
if (!requestedPath) {
  console.error('Usage: tsx scripts/bilans/check-pack-completeness.ts <pack.json>');
  process.exit(2);
}

const packPath = path.resolve(process.cwd(), requestedPath);
const raw = JSON.parse(readFileSync(packPath, 'utf8')) as unknown;
if (!isRecord(raw) || !isRecord(raw.questionnaire) || !Array.isArray(raw.questionnaire.items)) {
  console.error('PACK_STRUCTURE_INVALID: questionnaire.items must be an array');
  process.exit(1);
}

const results = raw.questionnaire.items.map((candidate, index) => {
  if (!isRecord(candidate)) return { id: `item[${index}]`, missing: ['item object'] };
  return {
    id: nonEmptyString(candidate.id) ? String(candidate.id) : `item[${index}]`,
    missing: missingFields(candidate),
  };
});
const complete = results.filter(({ missing }) => missing.length === 0).length;

console.log(`PACK_COMPLETENESS=${complete}/${results.length}`);
for (const result of results) {
  if (result.missing.length > 0) console.log(`${result.id}: ${result.missing.join(', ')}`);
}

if (complete !== results.length) process.exitCode = 1;
