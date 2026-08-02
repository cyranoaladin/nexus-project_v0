import { readFileSync } from 'node:fs';
import path from 'node:path';

const { parse: parseYaml } = require(path.join(
  path.dirname(require.resolve('yaml/package.json')),
  'dist/index.js',
)) as typeof import('yaml');

import { loadWaveManifest, repositoryPath } from '@/lib/bilans/catalog/wave-manifest';

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

type DashboardRow = Readonly<{
  slug: string;
  level: string;
  subject: string;
  complete: number;
  total: number;
  nodes: number;
  status: string;
  signature: string;
  validation: string;
  anomalies: readonly string[];
  kind: 'ACTIVE' | 'HISTORIQUE';
}>;

function dashboardRow(slug: string, requestedPath: string, format: 'pack-json' | 'metadata-yaml', kind: DashboardRow['kind']): DashboardRow {
  const raw = format === 'pack-json'
    ? JSON.parse(readFileSync(repositoryPath(requestedPath), 'utf8')) as unknown
    : parseYaml(readFileSync(repositoryPath(requestedPath), 'utf8')) as unknown;
  if (!isRecord(raw)) throw new Error(`PACK_STRUCTURE_INVALID:${slug}`);
  const questionnaire = isRecord(raw.questionnaire) ? raw.questionnaire : undefined;
  const items = format === 'pack-json' ? questionnaire?.items : raw.items;
  if (!Array.isArray(items)) throw new Error(`PACK_STRUCTURE_INVALID:${slug}:items`);
  const evaluated = evaluateCompleteness(items, format === 'pack-json' ? 'json' : 'yaml');
  const complete = evaluated.filter(({ missing }) => missing.length === 0).length;
  const nodes = new Set(items.flatMap((candidate) => isRecord(candidate) && nonEmptyString(candidate.nodeCpsId)
    ? [String(candidate.nodeCpsId)] : [])).size;
  const review = isRecord(raw.review) ? raw.review : undefined;
  const status = nonEmptyString(raw.status) ? String(raw.status) : 'METADONNEES_INCOMPLETES';
  const signed = review !== undefined && nonEmptyString(review.validatedBy) && nonEmptyString(review.validatedAt);
  const anomalies: string[] = [];
  if (kind === 'ACTIVE') {
    if (items.length !== 18) anomalies.push(`ITEMS_${items.length}_AU_LIEU_DE_18`);
    if (complete !== items.length) anomalies.push(`INCOMPLET_${complete}/${items.length}`);
    if (nodes !== 9) anomalies.push(`NOEUDS_${nodes}_AU_LIEU_DE_9`);
    if (status !== 'DRAFT') anomalies.push(`STATUT_${status}`);
    if (signed) anomalies.push('SIGNE_INTERDIT');
    const reporting = isRecord(raw.reporting) ? raw.reporting : undefined;
    const rag = reporting !== undefined && isRecord(reporting.rag) ? reporting.rag : undefined;
    if (rag?.enabled !== false) anomalies.push('RAG_NON_DESACTIVE');
  }
  return Object.freeze({
    slug,
    level: nonEmptyString(raw.level) ? String(raw.level) : '-',
    subject: nonEmptyString(raw.subject) ? String(raw.subject) : '-',
    complete,
    total: items.length,
    nodes,
    status,
    signature: signed ? 'SIGNE' : 'NON_SIGNE',
    validation: signed ? 'VALIDEE' : 'EN_ATTENTE',
    anomalies: Object.freeze(anomalies),
    kind,
  });
}

export function buildDashboard(manifestPath: string): readonly DashboardRow[] {
  const manifest = loadWaveManifest(manifestPath);
  const active = manifest.banks.map(({ slug, output }) => dashboardRow(slug, output, 'pack-json', 'ACTIVE'));
  const historical = manifest.historical.map(({ slug, source, format }) => dashboardRow(slug, source, format, 'HISTORIQUE'));
  if (active.length !== manifest.expectedActiveBanks) throw new Error(`ACTIVE_BANK_COUNT_INVALID:${active.length}`);
  return Object.freeze([...active, ...historical]);
}

function printDashboard(rows: readonly DashboardRow[]): void {
  console.log('| Type | Slug | Niveau | Matière | Complétude | Nœuds CPS | Statut | Signature | Validation | Anomalies |');
  console.log('| --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |');
  for (const row of rows) {
    console.log(`| ${row.kind} | ${row.slug} | ${row.level} | ${row.subject} | ${row.complete}/${row.total} | ${row.nodes} | ${row.status} | ${row.signature} | ${row.validation} | ${row.anomalies.join(', ') || '-'} |`);
  }
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
  if (args.includes('--all')) {
    const manifestIndex = args.indexOf('--manifest');
    const manifestPath = manifestIndex >= 0 ? args[manifestIndex + 1] : 'data/bilans/banks/wave1.manifest.json';
    if (manifestPath === undefined) return 2;
    try {
      const rows = buildDashboard(manifestPath);
      printDashboard(rows);
      const blocking = rows.filter(({ kind, anomalies }) => kind === 'ACTIVE' && anomalies.length > 0);
      console.log(`BANK_DASHBOARD=${rows.filter(({ kind }) => kind === 'ACTIVE').length}:ACTIVE:${blocking.length}:BLOCKING`);
      return blocking.length === 0 ? 0 : 1;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }
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
