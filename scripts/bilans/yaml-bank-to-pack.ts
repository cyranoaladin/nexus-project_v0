import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import Ajv2020 from 'ajv/dist/2020';
const { parse: parseYaml } = require(path.join(
  path.dirname(require.resolve('yaml/package.json')),
  'dist/index.js',
)) as typeof import('yaml');
import {
  assertBankRules,
  cpsCatalogSchema,
  type CpsCatalog,
  type SourceBank,
} from '@/lib/bilans/catalog/bank-validation';
import {
  computePromptChecksums,
  derivePackApproval,
  loadReviewRegistry,
  REVIEW_DIRECTORY,
  type ReviewRegistry,
} from '@/lib/bilans/catalog/review-registry';

type JsonRecord = Record<string, any>;

const PROMPT_FILES = {
  preAnalysis: 'pre-analysis.md',
  eleve: 'eleve.md',
  parents: 'parents.md',
  nexus: 'nexus.md',
  verifier: 'verifier.md',
} as const;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function repositoryPath(requestedPath: string): string {
  const root = process.cwd();
  const resolved = path.resolve(root, requestedPath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('BANK_PATH_OUTSIDE_REPOSITORY');
  }
  return resolved;
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function setArrayMaxItems(
  outputSchemas: JsonRecord,
  audience: 'eleve' | 'parents',
  field: 'priorites' | 'pointsAppui',
  maxItems: number,
): void {
  const schema = outputSchemas[audience];
  if (!isRecord(schema) || !isRecord(schema.properties) || !isRecord(schema.properties[field])) {
    throw new Error(`PACK_TEMPLATE_OUTPUT_SCHEMA_INVALID:${audience}.${field}`);
  }
  schema.properties[field].maxItems = maxItems;
}

function normalizeOptionKeys(source: JsonRecord): JsonRecord {
  const normalized = JSON.parse(JSON.stringify(source)) as JsonRecord;
  if (!Array.isArray(normalized.items)) throw new Error('BANK_ITEMS_INVALID');
  normalized.items = normalized.items.map((item: JsonRecord) => {
    if (!Array.isArray(item.options)) return item;
    const options = item.options.map((option: JsonRecord) => ({
      ...option,
      key: typeof option.key === 'string' ? option.key.toUpperCase() : option.key,
    }));
    const keys = options.map((option: JsonRecord) => option.key);
    if (new Set(keys).size !== keys.length) throw new Error(`BANK_OPTION_KEY_COLLISION:${String(item.id)}`);
    return { ...item, options };
  });
  return normalized;
}

function parseArguments(args: string[]) {
  const valueAfter = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const parsed = {
    source: valueAfter('--source'),
    cps: valueAfter('--cps'),
    templatePack: valueAfter('--template-pack'),
    promptDirectory: valueAfter('--prompt-directory'),
    output: valueAfter('--output'),
  };
  if (Object.values(parsed).some((value) => value === undefined) || args.length !== 10) return null;
  return parsed as Record<keyof typeof parsed, string>;
}

export function resolveCpsCatalog(bank: SourceBank, requestedPaths: string | readonly string[]): CpsCatalog {
  const paths = typeof requestedPaths === 'string' ? [requestedPaths] : [...requestedPaths];
  const nodes = new Map<string, CpsCatalog['nodes'][number]>();
  for (const requestedPath of paths) {
    const catalog = cpsCatalogSchema.parse(parseYaml(fs.readFileSync(repositoryPath(requestedPath), 'utf8')));
    for (const node of catalog.nodes) {
      const existing = nodes.get(node.id);
      if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(node)) {
        throw new Error(`CPS_NODE_DEFINITION_CONFLICT:${node.id}`);
      }
      nodes.set(node.id, node);
    }
  }
  const requestedNodeIds = [...new Set(bank.items.map(({ nodeCpsId }) => nodeCpsId))];
  return {
    schemaVersion: 'nexus-cps-catalog/v1',
    slug: `${bank.slug}-resolved`,
    version: 1,
    nodes: requestedNodeIds.flatMap((nodeId) => {
      const node = nodes.get(nodeId);
      return node === undefined ? [] : [node];
    }),
  };
}

export function buildPack(options: {
  sourcePath: string;
  cpsPath: string | readonly string[];
  templatePackPath: string;
  promptDirectory: string;
  reviewDirectory?: string;
  reviewRegistry?: ReviewRegistry | null;
  resolvedReviewerIds?: ReadonlySet<string>;
}): JsonRecord {
  const sourceText = fs.readFileSync(repositoryPath(options.sourcePath), 'utf8');
  const rawSource = parseYaml(sourceText) as unknown;
  if (!isRecord(rawSource)) throw new Error('BANK_SOURCE_INVALID');
  const source = normalizeOptionKeys(rawSource);

  const schema = JSON.parse(fs.readFileSync(repositoryPath('data/bilans/schemas/bank.schema.json'), 'utf8')) as object;
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  if (!validate(source)) {
    const failures = (validate.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message ?? error.keyword}`);
    throw new Error(`BANK_SCHEMA_INVALID\n${failures.join('\n')}`);
  }
  if (source.status !== 'DRAFT') throw new Error('BANK_SOURCE_MUST_BE_DRAFT');

  const catalog = resolveCpsCatalog(source as SourceBank, options.cpsPath);
  assertBankRules(source as SourceBank, catalog);
  const mismatchedTargets = catalog.nodes
    .filter((node) => node.targetLevel !== source.level)
    .map((node) => node.id);
  if (mismatchedTargets.length > 0) {
    throw new Error(`CPS_TARGET_LEVEL_MISMATCH:targetLevel=${String(source.level)}:${mismatchedTargets.join(',')}`);
  }
  const nodeById = new Map(catalog.nodes.map((node) => [node.id, node]));
  if (nodeById.size !== catalog.nodes.length) throw new Error('CPS_NODE_ID_DUPLICATE');
  const missingNodes = source.items
    .map((item: JsonRecord) => String(item.nodeCpsId))
    .filter((nodeId: string, index: number, all: string[]) => !nodeById.has(nodeId) && all.indexOf(nodeId) === index);
  if (missingNodes.length > 0) throw new Error(`BANK_CPS_NODE_UNKNOWN:${missingNodes.join(',')}`);

  const template = JSON.parse(fs.readFileSync(repositoryPath(options.templatePackPath), 'utf8')) as JsonRecord;
  const promptFiles = Object.fromEntries(Object.entries(PROMPT_FILES).map(([agent, fileName]) => {
    const relativePath = path.posix.join(options.promptDirectory.replaceAll(path.sep, '/'), fileName);
    const content = fs.readFileSync(repositoryPath(relativePath), 'utf8');
    return [agent, { path: relativePath, checksum: sha256(content) }];
  }));
  const promptChecksums = computePromptChecksums(options.promptDirectory);
  const registry = options.reviewRegistry === undefined
    ? loadReviewRegistry(source.slug, options.reviewDirectory ?? REVIEW_DIRECTORY)
    : options.reviewRegistry;
  const approval = derivePackApproval({
    slug: source.slug,
    packVersion: source.version,
    sourceChecksum: sha256(sourceText),
    promptChecksums,
    registry,
    resolvedReviewerIds: options.resolvedReviewerIds ?? new Set<string>(),
  });
  const domains = [...new Set(source.items.map((item: JsonRecord) => String(item.nodeCpsId).split('.')[2]))];
  const outputSchemas = JSON.parse(JSON.stringify(template.reporting.outputSchemas));
  if (!isRecord(outputSchemas)) throw new Error('PACK_TEMPLATE_OUTPUT_SCHEMAS_INVALID');
  setArrayMaxItems(outputSchemas, 'eleve', 'priorites', domains.length);
  setArrayMaxItems(outputSchemas, 'parents', 'pointsAppui', domains.length);
  setArrayMaxItems(outputSchemas, 'parents', 'priorites', domains.length);

  return {
    slug: source.slug,
    level: source.level,
    subject: source.subject,
    version: source.version,
    status: approval.status,
    review: approval.review,
    ...(source.delivery === undefined ? {} : { delivery: source.delivery }),
    questionnaire: {
      targetDurationMin: source.targetDurationMin,
      confidenceScale: template.questionnaire.confidenceScale,
      items: source.items.map((item: JsonRecord) => ({
        id: item.id,
        subject: source.subject,
        category: nodeById.get(item.nodeCpsId)?.label,
        domainId: String(item.nodeCpsId).split('.')[2],
        nodeCpsId: item.nodeCpsId,
        difficulty: item.difficulty,
        targetTimeSec: item.targetTimeSec,
        shortCorrection: item.shortCorrection,
        weight: item.difficulty,
        competencies: [item.nodeCpsId],
        questionText: item.statement,
        options: item.options.map((option: JsonRecord) => ({
          id: option.key,
          text: option.label,
          isCorrect: option.correct,
          ...(option.correct ? {} : { distractorRationale: option.distractorRationale }),
        })),
        explanation: item.shortCorrection,
      })),
    },
    scoring: { engine: 'facts.v1.0.1', domains },
    reporting: {
      rag: {
        enabled: false,
        decisionRef: source.level === 'TERMINALE'
          ? 'A56 — corpus RAG Terminale absent'
          : 'A56 — RAG désactivé tant que le corpus du niveau n’est pas validé',
        sources: [],
        topK: 0,
      },
      promptFiles,
      outputSchemas,
    },
    validation: template.validation,
  };
}

export function main(args: string[]): number {
  const parsed = parseArguments(args);
  if (parsed === null) {
    console.error('Usage: tsx scripts/bilans/yaml-bank-to-pack.ts --source <bank.yaml> --cps <catalog.yaml> --template-pack <pack.json> --prompt-directory <directory> --output <pack.json>');
    return 2;
  }
  try {
    const pack = buildPack({
      sourcePath: parsed.source,
      cpsPath: parsed.cps,
      templatePackPath: parsed.templatePack,
      promptDirectory: parsed.promptDirectory,
    });
    const output = repositoryPath(parsed.output);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const temporary = `${output}.yaml-bank-to-pack.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');
    fs.renameSync(temporary, output);
    console.log(`PACK_GENERATED=${pack.slug}:${pack.questionnaire.items.length}`);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
