import fs from 'node:fs';
import path from 'node:path';

import rawPack from '@/data/bilans/banks/maths-terminale-v1.json';
import { loadBilanPack, loadValidatedPack } from '@/lib/bilans/catalog/load-pack';

const TEMP_DIRECTORY = path.join(process.cwd(), '.tmp-bilan-pack-tests');

function clonePack(): typeof rawPack {
  return JSON.parse(JSON.stringify(rawPack)) as typeof rawPack;
}

function writePack(name: string, value: unknown): string {
  fs.mkdirSync(TEMP_DIRECTORY, { recursive: true });
  const absolutePath = path.join(TEMP_DIRECTORY, name);
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return path.relative(process.cwd(), absolutePath);
}

afterAll(() => fs.rmSync(TEMP_DIRECTORY, { recursive: true, force: true }));

describe('fail-closed bilan pack loader', () => {
  it('loads the real draft pack and verifies all fifty questions and prompt checksums', () => {
    const pack = loadBilanPack('data/bilans/banks/maths-terminale-v1.json');

    expect(pack.status).toBe('DRAFT');
    expect(pack.review).toEqual({ validatedBy: null, validatedAt: null });
    expect(pack.questionnaire.items).toHaveLength(50);
    expect(Object.keys(pack.reporting.promptFiles)).toHaveLength(5);
  });

  it('rejects a changed prompt checksum', () => {
    const broken = clonePack();
    broken.reporting.promptFiles.eleve.checksum = '0'.repeat(64);

    expect(() => loadBilanPack(writePack('bad-checksum.json', broken))).toThrow(/checksum/i);
  });

  it('never turns the real draft pack into a ValidatedPack', () => {
    expect(() => loadValidatedPack('data/bilans/banks/maths-terminale-v1.json')).toThrow(/validation/i);
  });

  it.each([
    { validatedBy: null, validatedAt: null },
    { validatedBy: '', validatedAt: '2026-08-01T10:00:00.000Z' },
    { validatedBy: 'FIXTURE — JAMAIS UN ENSEIGNANT', validatedAt: '1970-01-01T00:00:00.000Z' },
  ])('rejects absent, empty or fixture pedagogical approval', (review) => {
    const candidate = { ...clonePack(), status: 'VALIDATED', review };
    expect(() => loadValidatedPack(writePack(`rejected-${String(review.validatedBy)}.json`, candidate))).toThrow();
  });

  it('constructs a ValidatedPack only from named, dated approval read from the pack', () => {
    const candidate = {
      ...clonePack(),
      status: 'VALIDATED',
      review: {
        validatedBy: 'Enseignante de mathématiques, qualification vérifiée',
        validatedAt: '2026-08-01T10:00:00.000Z',
      },
    };
    expect(loadValidatedPack(writePack('validated.json', candidate))).toMatchObject({
      status: 'VALIDATED',
      review: candidate.review,
    });
  });
});
