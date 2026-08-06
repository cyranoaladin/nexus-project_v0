import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import lexique from '@/data/bilans/lexique-interdit.json';
import { loadBilanPack } from '@/lib/bilans/catalog/load-pack';

const ROOT = process.cwd();
const TEMP = path.join(ROOT, '.tmp-entree-seconde-bank');
const SCRIPT = 'scripts/bilans/yaml-bank-to-pack.ts';
const SOURCE = 'data/bilans/banks/entree-seconde-maths-v1.yaml';
const CPS = 'data/bilans/cps/3e-maths-vers-seconde.v1.yaml';
const TEMPLATE = 'data/bilans/banks/entree-premiere-maths-v1.json';
const PROMPTS = 'content/bilans/prompts/entree-seconde-maths-v1';
const TRACKED = 'data/bilans/banks/entree-seconde-maths-v1.json';
const ARCHIVED_TEMPLATE = 'data/bilans/banks/_archive/seconde.maths.v1.yaml';
const TSX = path.join(ROOT, 'node_modules/.bin/tsx');

type SourceOption = {
  key: string;
  label: string;
  correct: boolean;
  distractorRationale?: string;
};

type SourceItem = {
  id: string;
  nodeCpsId: string;
  type: string;
  difficulty: number;
  targetTimeSec: number;
  statement: string;
  shortCorrection: string;
  options: SourceOption[];
};

type SourceBank = {
  level: string;
  targetDurationMin: number;
  items: SourceItem[];
};

function run(output: string) {
  return spawnSync(TSX, [SCRIPT,
    '--source', SOURCE,
    '--cps', CPS,
    '--template-pack', TEMPLATE,
    '--prompt-directory', PROMPTS,
    '--output', output,
  ], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0' } });
}

function readYaml<T>(relativePath: string): T {
  return parseYamlText<T>(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function parseYamlText<T>(content: string): T {
  const result = spawnSync(process.execPath, ['-e',
    "const YAML=require('yaml');process.stdout.write(JSON.stringify(YAML.parse(require('fs').readFileSync(0,'utf8'))))",
  ], { cwd: ROOT, encoding: 'utf8', input: content });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout) as T;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function stringsFrom(item: SourceItem): string {
  return [item.statement, item.shortCorrection, ...item.options.flatMap((option) => [
    option.label,
    option.distractorRationale ?? '',
  ])].join(' ');
}

describe('banque de positionnement entrée en Seconde', () => {
  beforeAll(() => fs.mkdirSync(TEMP, { recursive: true }));
  afterAll(() => fs.rmSync(TEMP, { recursive: true, force: true }));

  test('la conversion générique est déterministe, fidèle et chargeable', () => {
    const first = path.join(TEMP, 'first.json');
    const second = path.join(TEMP, 'second.json');
    const one = run(first);
    const two = run(second);

    expect(one.status).toBe(0);
    expect(two.status).toBe(0);
    expect(fs.readFileSync(first)).toEqual(fs.readFileSync(second));
    const unsignedGenerated = JSON.parse(fs.readFileSync(first, 'utf8'));
    const signedTracked = JSON.parse(fs.readFileSync(path.join(ROOT, TRACKED), 'utf8'));
    expect(unsignedGenerated).toEqual({
      ...signedTracked,
      status: 'DRAFT',
      review: { validatedBy: null, validatedAt: null },
    });

    const pack = loadBilanPack(path.relative(ROOT, first));
    expect(pack.slug).toBe('entree-seconde-maths-v1');
    expect(pack.level).toBe('SECONDE');
    expect(pack.questionnaire.items).toHaveLength(18);
    expect(pack.scoring.domains).toHaveLength(8);
    expect(pack.status).toBe('DRAFT');
    expect(pack.review).toEqual({ validatedBy: null, validatedAt: null });
    expect(pack.reporting.rag.enabled).toBe(false);

    for (const item of pack.questionnaire.items) {
      expect(item.options.map((option) => option.id)).toEqual(['A', 'B', 'C', 'D']);
      expect(item.options.filter((option) => option.isCorrect)).toHaveLength(1);
    }
  });

  test('la source satisfait les règles V1 à V14 applicables', () => {
    const source = readYaml<SourceBank>(SOURCE);
    const catalog = readYaml<{
      nodes: Array<{ id: string; sourceLevel: string; targetLevel: string; sequenceOrder: number; pedagogicalRationale: string }>;
    }>(CPS);
    const ids = source.items.map((item) => item.id);
    const nodeCounts = new Map<string, number>();
    const positions = [0, 0, 0, 0];
    const forbiddenTerms = Object.values(lexique.categories).flat();

    expect(source.items).toHaveLength(18);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[A-Z0-9]{2,3}-[A-Z]{3}-[A-Z0-9]{3,}-\d{2}$/);

    const catalogIds = new Set(catalog.nodes.map((node) => node.id));
    for (const item of source.items) {
      nodeCounts.set(item.nodeCpsId, (nodeCounts.get(item.nodeCpsId) ?? 0) + 1);
      expect(catalogIds.has(item.nodeCpsId)).toBe(true);
      expect([1, 2, 3]).toContain(item.difficulty);
      expect(item.type).toBe('QCM_SIMPLE');
      expect(item.options).toHaveLength(4);
      expect(item.options.filter((option) => option.correct)).toHaveLength(1);
      expect(item.shortCorrection.trim().length).toBeGreaterThan(0);
      expect(item.shortCorrection.length).toBeLessThanOrEqual(320);

      const correctPosition = item.options.findIndex((option) => option.correct);
      positions[correctPosition] += 1;
      for (const option of item.options.filter((candidate) => !candidate.correct)) {
        expect(option.distractorRationale?.trim().length).toBeGreaterThan(0);
      }

      const normalized = normalize(stringsFrom(item));
      expect(forbiddenTerms.filter((term) => normalized.includes(normalize(term)))).toEqual([]);
      expect(stringsFrom(item)).not.toMatch(/\b(?:M\.|Mme|Monsieur|Madame)\s+[A-ZÉÈÀÂÎÔÛ][a-zéèàâîôûç]+/);
      expect(stringsFrom(item)).not.toMatch(/\b(?:OpenAI|ChatGPT|OpenRouter|Google|Microsoft|Meta)\b/i);
    }

    expect(nodeCounts.size).toBe(9);
    expect([...nodeCounts.values()].every((count) => count >= 2 && count <= 6)).toBe(true);
    expect(catalog.nodes.every((node) => node.sourceLevel === 'TROISIEME')).toBe(true);
    expect(catalog.nodes.every((node) => node.targetLevel === 'SECONDE')).toBe(true);
    expect(catalog.nodes.map((node) => node.sequenceOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(catalog.nodes.every((node) => node.pedagogicalRationale.trim().length > 0)).toBe(true);
    expect(source.items.reduce((sum, item) => sum + item.targetTimeSec, 0))
      .toBeLessThanOrEqual(source.targetDurationMin * 60);
    expect(positions).toEqual([5, 5, 4, 4]);
    expect(Math.max(...positions) / source.items.length).toBeLessThanOrEqual(0.4);
  });

  test('le gabarit incomplet est archivé et absent des banques actives', () => {
    expect(fs.existsSync(path.join(ROOT, 'data/bilans/banks/seconde.maths.v1.yaml'))).toBe(false);
    const archived = fs.readFileSync(path.join(ROOT, ARCHIVED_TEMPLATE), 'utf8');
    expect(archived.startsWith('# OBSOLÈTE — remplacé par entree-seconde-maths-v1')).toBe(true);
    expect(parseYamlText<{ items: unknown[] }>(archived).items).toHaveLength(12);
  });
});
