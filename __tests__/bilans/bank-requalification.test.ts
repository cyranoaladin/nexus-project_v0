import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

import entryPack from '@/data/bilans/banks/entree-terminale-maths-v1.json';
import endPack from '@/data/bilans/banks/maths-terminale-bilan-v1.json';

const REMOVED = ['MATH-ANA-12', 'MATH-PROB-05', 'MATH-PROB-06', 'MATH-PROB-10'] as const;
const TRANSFERRED = ['MATH-ANA-01', 'MATH-PROB-01', 'MATH-PROB-02', 'MATH-PROB-03', 'MATH-PROB-04', 'MATH-PROB-07', 'MATH-PROB-09', 'MATH-PROB-11'] as const;
const EXPECTED_MAPPING = Object.fromEntries(TRANSFERRED.map((id, index) => [id, 'ETL-MAT-PRQ-' + String(index + 1).padStart(2, '0')]));

function readYaml(relativePath: string): any {
  const result = spawnSync(process.execPath, ['-e',
    "const Y=require('yaml');process.stdout.write(JSON.stringify(Y.parse(require('fs').readFileSync(0,'utf8'))))",
  ], { cwd: process.cwd(), encoding: 'utf8', input: fs.readFileSync(relativePath, 'utf8') });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}

describe('Terminale Maths bank requalification', () => {
  it('keeps the entry pack complete, draft and limited to eighteen items', () => {
    expect(entryPack.slug).toBe('entree-terminale-maths-v1');
    expect(entryPack.questionnaire.items).toHaveLength(18);
    expect(entryPack.status).toBe('DRAFT');
    expect(entryPack.review).toStrictEqual({ validatedBy: null, validatedAt: null });
  });

  it('keeps exactly thirty-eight end-of-Terminale items and excludes removed and transferred IDs', () => {
    const ids = endPack.questionnaire.items.map(({ id }) => id);
    expect(endPack.slug).toBe('maths-terminale-bilan-v1');
    expect(ids).toHaveLength(38);
    for (const id of [...REMOVED, ...TRANSFERRED]) expect(ids).not.toContain(id);
    expect(endPack.status).toBe('DRAFT');
    expect(endPack.review).toStrictEqual({ validatedBy: null, validatedAt: null });
  });

  it('keeps the end-bank metadata aligned without filling any frozen field', () => {
    const metadata = readYaml('data/bilans/banks/maths-terminale-bilan-v1.draft-metadata.yaml');
    expect(metadata.pack).toBe('maths-terminale-bilan-v1');
    expect(metadata.items.map((item: any) => item.id)).toEqual(endPack.questionnaire.items.map(({ id }) => id));
    expect(metadata.items).toHaveLength(38);
    expect(metadata.items.every((item: any) => String(item.nodeCpsId ?? '').trim() === '' && item.difficulty === null && item.targetTimeSec === null && String(item.shortCorrection ?? '').trim() === '')).toBe(true);
  });

  it('extracts eight incomplete prerequisites with an explicit historical ID mapping', () => {
    const metadata = readYaml('data/bilans/banks/entree-terminale-maths-probabilites.draft-metadata.yaml');
    expect(metadata.pack).toBe('entree-terminale-maths-v2');
    expect(metadata.items).toHaveLength(8);
    expect(Object.fromEntries(metadata.items.map((item: any) => [item.previousId, item.id]))).toStrictEqual(EXPECTED_MAPPING);
    expect(metadata.items.every((item: any) => item.nodeCpsId === '' && item.difficulty === null && item.targetTimeSec === null && item.shortCorrection === '')).toBe(true);
  });
});
