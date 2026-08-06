import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { loadBilanPack } from '@/lib/bilans/catalog/load-pack';

const ROOT = process.cwd();
const TEMP = path.join(ROOT, '.tmp-entree-premiere-bank');
const SCRIPT = 'scripts/bilans/yaml-bank-to-pack.ts';
const SOURCE = 'data/bilans/banks/entree-premiere-maths-v1.yaml';
const CPS = 'data/bilans/cps/2de-maths-vers-premiere.v1.yaml';
const TEMPLATE = 'data/bilans/banks/entree-terminale-maths-v1.json';
const PROMPTS = 'content/bilans/prompts/entree-premiere-maths-v1';
const TSX = path.join(ROOT, 'node_modules/.bin/tsx');

function run(cps: string, output: string) {
  return spawnSync(TSX, [SCRIPT,
    '--source', SOURCE,
    '--cps', cps,
    '--template-pack', TEMPLATE,
    '--prompt-directory', PROMPTS,
    '--output', output,
  ], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0' } });
}

describe('banque de positionnement entrée en Première', () => {
  beforeAll(() => fs.mkdirSync(TEMP, { recursive: true }));
  afterAll(() => fs.rmSync(TEMP, { recursive: true, force: true }));

  test('la conversion est déterministe, fidèle et chargeable', () => {
    const first = path.join(TEMP, 'first.json');
    const second = path.join(TEMP, 'second.json');
    const one = run(CPS, first);
    const two = run(CPS, second);

    expect(one.status).toBe(0);
    expect(two.status).toBe(0);
    expect(fs.readFileSync(first)).toEqual(fs.readFileSync(second));

    const pack = loadBilanPack(path.relative(ROOT, first));
    expect(pack.slug).toBe('entree-premiere-maths-v1');
    expect(pack.level).toBe('PREMIERE');
    expect(pack.questionnaire.items).toHaveLength(18);
    expect(pack.scoring.domains).toHaveLength(9);
    expect(pack.status).toBe('DRAFT');
    expect(pack.review).toEqual({ validatedBy: null, validatedAt: null });
    expect(pack.reporting.rag.enabled).toBe(false);

    for (const item of pack.questionnaire.items) {
      expect(item.options.map((option) => option.id)).toEqual(['A', 'B', 'C', 'D']);
      expect(item.options.filter((option) => option.isCorrect)).toHaveLength(1);
    }
  });

  test('un catalogue dont le niveau cible diffère de la banque est refusé', () => {
    const incompatible = path.join(TEMP, 'incompatible-cps.yaml');
    fs.writeFileSync(
      incompatible,
      fs.readFileSync(path.join(ROOT, CPS), 'utf8').replace('targetLevel: PREMIERE', 'targetLevel: TERMINALE'),
      'utf8',
    );

    const result = run(incompatible, path.join(TEMP, 'incompatible.json'));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('targetLevel');
  });
});
