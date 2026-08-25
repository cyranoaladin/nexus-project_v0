import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { loadBilanPack } from '@/lib/bilans/catalog/load-pack';

const ROOT = process.cwd();
const TEMP = path.join(ROOT, '.tmp-entree-terminale-maths-complementaires-bank');
const SCRIPT = 'scripts/bilans/yaml-bank-to-pack.ts';
const SOURCE = 'data/bilans/banks/entree-terminale-maths-complementaires-v1.yaml';
const CPS = 'data/bilans/cps/prerequis-maths-vers-terminale-complementaires.v1.yaml';
const TEMPLATE = 'data/bilans/banks/entree-terminale-maths-v1.json';
const PROMPTS = 'content/bilans/prompts/entree-terminale-maths-complementaires-v1';
const TSX = path.join(ROOT, 'node_modules/.bin/tsx');

function run(output: string) {
  return spawnSync(TSX, [SCRIPT,
    '--source', SOURCE,
    '--cps', CPS,
    '--template-pack', TEMPLATE,
    '--prompt-directory', PROMPTS,
    '--output', output,
  ], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0' } });
}

describe('banque de positionnement Terminale — mathématiques complémentaires', () => {
  beforeAll(() => fs.mkdirSync(TEMP, { recursive: true }));
  afterAll(() => fs.rmSync(TEMP, { recursive: true, force: true }));

  test('la conversion est déterministe, fidèle et chargeable', () => {
    const first = path.join(TEMP, 'first.json');
    const second = path.join(TEMP, 'second.json');
    const one = run(first);
    const two = run(second);

    expect(one.status).toBe(0);
    expect(two.status).toBe(0);
    expect(fs.readFileSync(first)).toEqual(fs.readFileSync(second));

    const pack = loadBilanPack(path.relative(ROOT, first));
    expect(pack.slug).toBe('entree-terminale-maths-complementaires-v1');
    expect(pack.level).toBe('TERMINALE');
    expect(pack.subject).toBe('MATHS_COMPLEMENTAIRES');
    expect(pack.questionnaire.items).toHaveLength(18);
    expect(pack.scoring.domains).toHaveLength(8);
    expect(pack.reporting.rag.enabled).toBe(false);

    for (const item of pack.questionnaire.items) {
      expect(new Set(item.options.map((option) => option.id))).toEqual(new Set(['A', 'B', 'C', 'D']));
      expect(item.options.filter((option) => option.isCorrect)).toHaveLength(1);
    }
  });

  test('le logarithme est explicitement un repérage anticipé de Terminale', () => {
    const pack = loadBilanPack('data/bilans/banks/entree-terminale-maths-complementaires-v1.json');
    const items = pack.questionnaire.items.filter(({ domainId }) => domainId === 'logarithme-reperage');
    expect(items).toHaveLength(2);
    expect(items.every(({ nodeCpsId }) => nodeCpsId.startsWith('terminale.'))).toBe(true);
  });
});
