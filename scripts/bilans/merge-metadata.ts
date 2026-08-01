import fs from 'node:fs';
import path from 'node:path';

import { parse as parseYaml } from 'yaml';

import { evaluateCompleteness } from './check-pack-completeness';

type JsonRecord = Record<string, any>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function repositoryPath(requestedPath: string): string {
  const root = process.cwd();
  const resolved = path.resolve(root, requestedPath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('METADATA_PATH_OUTSIDE_REPOSITORY');
  }
  return resolved;
}

function parseArguments(args: string[]): { metadataPath: string; packPath: string } | null {
  const valueAfter = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const metadataPath = valueAfter('--metadata');
  const packPath = valueAfter('--pack');
  if (!metadataPath || !packPath || args.length !== 4) return null;
  return { metadataPath, packPath };
}

function assertIdentity(metadata: JsonRecord, pack: JsonRecord): void {
  if (metadata.pack !== pack.slug) throw new Error(`METADATA_PACK_MISMATCH:${String(metadata.pack)}:${String(pack.slug)}`);
  if (metadata.version !== pack.version) {
    throw new Error(`METADATA_VERSION_MISMATCH:${String(metadata.version)}:${String(pack.version)}`);
  }
  if (!Array.isArray(metadata.items) || !isRecord(pack.questionnaire) || !Array.isArray(pack.questionnaire.items)) {
    throw new Error('METADATA_STRUCTURE_INVALID');
  }
  if (metadata.items.length !== pack.questionnaire.items.length) throw new Error('METADATA_ITEM_COUNT_MISMATCH');

  const metadataById = new Map<string, JsonRecord>();
  for (const candidate of metadata.items) {
    if (!isRecord(candidate) || typeof candidate.id !== 'string' || metadataById.has(candidate.id)) {
      throw new Error(`METADATA_ITEM_ID_INVALID:${String(candidate?.id)}`);
    }
    metadataById.set(candidate.id, candidate);
  }

  for (const packItem of pack.questionnaire.items as JsonRecord[]) {
    const item = metadataById.get(packItem.id);
    if (!item) throw new Error(`METADATA_ITEM_MISSING:${String(packItem.id)}`);
    if (item.enonce !== packItem.questionText) throw new Error(`METADATA_STATEMENT_MISMATCH:${String(packItem.id)}`);
    if (item.domainId !== packItem.domainId) throw new Error(`METADATA_DOMAIN_MISMATCH:${String(packItem.id)}`);
    if (!Array.isArray(item.options) || !Array.isArray(packItem.options) || item.options.length !== packItem.options.length) {
      throw new Error(`METADATA_OPTIONS_MISMATCH:${String(packItem.id)}`);
    }
    const optionsByKey = new Map(item.options.map((option: JsonRecord) => [option.key, option]));
    for (const packOption of packItem.options as JsonRecord[]) {
      const option = optionsByKey.get(packOption.id);
      if (
        !isRecord(option)
        || option.label !== packOption.text
        || option.correct !== packOption.isCorrect
      ) {
        throw new Error(`METADATA_OPTION_MISMATCH:${String(packItem.id)}.${String(packOption.id)}`);
      }
    }
  }
}

function merge(metadata: JsonRecord, pack: JsonRecord): JsonRecord {
  const merged = structuredClone(pack) as JsonRecord;
  const reviewBefore = JSON.stringify(pack.review);
  const metadataById = new Map((metadata.items as JsonRecord[]).map((item) => [item.id, item]));

  merged.questionnaire.items = (merged.questionnaire.items as JsonRecord[]).map((item) => {
    const source = metadataById.get(item.id);
    if (!source) throw new Error(`METADATA_ITEM_MISSING:${String(item.id)}`);
    const optionsByKey = new Map((source.options as JsonRecord[]).map((option) => [option.key, option]));
    return {
      ...item,
      nodeCpsId: source.nodeCpsId,
      difficulty: source.difficulty,
      targetTimeSec: source.targetTimeSec,
      shortCorrection: source.shortCorrection,
      options: (item.options as JsonRecord[]).map((option) => option.isCorrect
        ? option
        : { ...option, distractorRationale: optionsByKey.get(option.id)?.distractorRationale }),
    };
  });

  if (JSON.stringify(merged.review) !== reviewBefore) throw new Error('METADATA_REVIEW_MUTATION_FORBIDDEN');
  return merged;
}

export function main(args: string[]): number {
  const parsed = parseArguments(args);
  if (parsed === null) {
    console.error('Usage: tsx scripts/bilans/merge-metadata.ts --metadata <metadata.yaml> --pack <pack.json>');
    return 2;
  }

  try {
    const metadataPath = repositoryPath(parsed.metadataPath);
    const packPath = repositoryPath(parsed.packPath);
    const metadata = parseYaml(fs.readFileSync(metadataPath, 'utf8')) as unknown;
    const pack = JSON.parse(fs.readFileSync(packPath, 'utf8')) as unknown;
    if (!isRecord(metadata) || !isRecord(pack) || !Array.isArray(metadata.items)) {
      throw new Error('METADATA_STRUCTURE_INVALID');
    }

    const results = evaluateCompleteness(metadata.items, 'yaml');
    const incomplete = results.filter(({ missing }) => missing.length > 0);
    if (incomplete.length > 0) {
      console.error('METADATA_INCOMPLETE');
      for (const result of incomplete) {
        for (const field of result.missing) console.error(`${result.id}.${field}`);
      }
      return 1;
    }

    assertIdentity(metadata, pack);
    const merged = merge(metadata, pack);
    const temporaryPath = `${packPath}.metadata-merge.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(merged, null, 2)}\n`, { encoding: 'utf8', mode: fs.statSync(packPath).mode });
    fs.renameSync(temporaryPath, packPath);
    console.log(`PACK_MERGED=${results.length}/${results.length}`);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
