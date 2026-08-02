import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import trackedPack from '@/data/bilans/banks/entree-terminale-maths-v1.json';
import { loadBilanPack } from '@/lib/bilans/catalog/load-pack';

const ROOT = process.cwd();
const TEMP = path.join(ROOT, '.tmp-yaml-bank-to-pack');
const SCRIPT = 'scripts/bilans/yaml-bank-to-pack.ts';
const SOURCE = 'data/bilans/banks/entree-terminale-maths-v1.yaml';
const CPS = 'data/bilans/cps/1re-maths-vers-terminale.v1.yaml';
const TEMPLATE = 'data/bilans/banks/maths-terminale-bilan-v1.json';
const PROMPTS = 'content/bilans/prompts/entree-terminale-maths-v1';
const TSX = path.join(ROOT, 'node_modules/.bin/tsx');

function run(source: string, output: string) {
  return spawnSync(TSX, [SCRIPT,
    '--source', source,
    '--cps', CPS,
    '--template-pack', TEMPLATE,
    '--prompt-directory', PROMPTS,
    '--output', output,
  ], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0' } });
}

function yaml(action: 'parse' | 'stringify', value: string | unknown): any {
  const code = action === 'parse'
    ? "const Y=require('yaml');process.stdout.write(JSON.stringify(Y.parse(require('fs').readFileSync(0,'utf8'))))"
    : "const Y=require('yaml');process.stdout.write(Y.stringify(JSON.parse(require('fs').readFileSync(0,'utf8'))))";
  const result = spawnSync(process.execPath, ['-e', code], {
    cwd: ROOT,
    encoding: 'utf8',
    input: action === 'parse' ? value as string : JSON.stringify(value),
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return action === 'parse' ? JSON.parse(result.stdout) : result.stdout;
}

function readYaml(relativePath: string): any {
  return yaml('parse', fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function tempFile(name: string, content?: string): string {
  fs.mkdirSync(TEMP, { recursive: true });
  const target = path.join(TEMP, name);
  if (content !== undefined) fs.writeFileSync(target, content, 'utf8');
  return path.relative(ROOT, target);
}

afterAll(() => fs.rmSync(TEMP, { recursive: true, force: true }));

describe('deterministic YAML bank conversion', () => {
  it('produces the tracked pack byte-for-byte on two runs', () => {
    const first = tempFile('first.json');
    const second = tempFile('second.json');
    expect(run(SOURCE, first).status).toBe(0);
    expect(run(SOURCE, second).status).toBe(0);
    const firstBytes = fs.readFileSync(path.join(ROOT, first), 'utf8');
    expect(firstBytes).toBe(fs.readFileSync(path.join(ROOT, second), 'utf8'));
    expect(firstBytes).toBe(JSON.stringify(trackedPack, null, 2) + '\n');
  });

  it('normalizes option keys while preserving labels and the correct option', () => {
    const source = readYaml(SOURCE);
    for (const [index, item] of source.items.entries()) {
      const converted = trackedPack.questionnaire.items[index];
      expect(converted.options.map((option) => option.id)).toEqual(item.options.map((option: any) => option.key.toUpperCase()));
      expect(converted.options.map((option) => option.text)).toEqual(item.options.map((option: any) => option.label));
      expect(converted.options.find((option) => option.isCorrect)?.text)
        .toBe(item.options.find((option: any) => option.correct)?.label);
    }
  });

  it('always creates a DRAFT pack with null review fields', () => {
    expect(trackedPack.status).toBe('DRAFT');
    expect(trackedPack.review).toStrictEqual({ validatedBy: null, validatedAt: null });
    expect(loadBilanPack('data/bilans/banks/entree-terminale-maths-v1.json').questionnaire.items).toHaveLength(18);

    const source = readYaml(SOURCE);
    source.review = { validatedBy: 'INTERDIT', validatedAt: '2026-08-02T00:00:00.000Z' };
    const malicious = tempFile('malicious.yaml', yaml('stringify', source));
    const output = tempFile('malicious.json');
    const result = run(malicious, output);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('BANK_SCHEMA_INVALID');
    expect(fs.existsSync(path.join(ROOT, output))).toBe(false);
  });

  it('fails V2 when a bank node is absent from the CPS catalog', () => {
    const source = readYaml(SOURCE);
    source.items[0].nodeCpsId = '1re.maths.noeud.inconnu';
    const unknown = tempFile('unknown-node.yaml', yaml('stringify', source));
    const result = run(unknown, tempFile('unknown-node.json'));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('BANK_CPS_NODE_UNKNOWN:1re.maths.noeud.inconnu');
  });

  it('covers all nine catalogued nodes and respects the announced duration', () => {
    const source = readYaml(SOURCE);
    const catalog = readYaml(CPS);
    expect(new Set(source.items.map((item: any) => item.nodeCpsId))).toEqual(new Set(catalog.nodes.map((node: any) => node.id)));
    expect(source.items.reduce((sum: number, item: any) => sum + item.targetTimeSec, 0)).toBe(1160);
    expect(1160).toBeLessThanOrEqual(source.targetDurationMin * 60);
  });
});
