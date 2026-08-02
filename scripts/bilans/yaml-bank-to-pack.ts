import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import Ajv2020 from 'ajv/dist/2020';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

type JsonRecord = Record<string, any>;

const PROMPT_FILES = {
  preAnalysis: 'pre-analysis.md',
  eleve: 'eleve.md',
  parents: 'parents.md',
  nexus: 'nexus.md',
  verifier: 'verifier.md',
} as const;

const cpsCatalogSchema = z.object({
  schemaVersion: z.literal('nexus-cps-catalog/v1'),
  slug: z.string().trim().min(1),
  version: z.number().int().positive(),
  nodes: z.array(z.object({
    id: z.string().trim().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/),
    label: z.string().trim().min(1),
    sourceLevel: z.literal('PREMIERE'),
    targetLevel: z.literal('TERMINALE'),
    pedagogicalRationale: z.string().trim().min(1),
  }).strict()).min(1),
}).strict();

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

function normalizeOptionKeys(source: JsonRecord): JsonRecord {
  const normalized = structuredClone(source) as JsonRecord;
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

export function buildPack(options: {
  sourcePath: string;
  cpsPath: string;
  templatePackPath: string;
  promptDirectory: string;
}): JsonRecord {
  const rawSource = parseYaml(fs.readFileSync(repositoryPath(options.sourcePath), 'utf8')) as unknown;
  if (!isRecord(rawSource)) throw new Error('BANK_SOURCE_INVALID');
  const source = normalizeOptionKeys(rawSource);

  const schema = JSON.parse(fs.readFileSync(repositoryPath('data/bilans/schemas/bank.schema.json'), 'utf8')) as object;
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  if (!validate(source)) {
    const failures = (validate.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message ?? error.keyword}`);
    throw new Error(`BANK_SCHEMA_INVALID\n${failures.join('\n')}`);
  }
  if (source.status !== 'DRAFT') throw new Error('BANK_SOURCE_MUST_BE_DRAFT');

  const catalog = cpsCatalogSchema.parse(parseYaml(fs.readFileSync(repositoryPath(options.cpsPath), 'utf8')));
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
  const domains = [...new Set(source.items.map((item: JsonRecord) => String(item.nodeCpsId).split('.')[2]))];

  return {
    slug: source.slug,
    level: source.level,
    subject: source.subject,
    version: source.version,
    status: 'DRAFT',
    review: { validatedBy: null, validatedAt: null },
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
      rag: { enabled: false, decisionRef: 'A56 — corpus RAG Terminale absent', sources: [], topK: 0 },
      promptFiles,
      outputSchemas: template.reporting.outputSchemas,
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
