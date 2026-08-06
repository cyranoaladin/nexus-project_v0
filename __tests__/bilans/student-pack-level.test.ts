import { readFileSync } from 'node:fs';

import { GradeLevel } from '@prisma/client';

import { loadWaveManifest } from '@/lib/bilans/catalog/wave-manifest';
import {
  assertStudentPackLevel,
  resolvePrismaGradeLevel,
} from '@/lib/bilans/api/student-pack-level';

type PackMetadata = Readonly<{ slug: string; level: string }>;

const manifest = loadWaveManifest('data/bilans/banks/wave1.manifest.json');
const packs = manifest.banks.map(({ output }) => (
  JSON.parse(readFileSync(output, 'utf8')) as PackMetadata
));
const representedLevels = [...new Set(packs.map(({ level }) => level))].sort();

describe('student to pack grade-level guard', () => {
  test('is driven by all 17 active manifest entries', () => {
    expect(packs).toHaveLength(manifest.expectedActiveBanks);
    expect(packs.map(({ slug }) => slug).sort()).toEqual(
      manifest.banks.map(({ slug }) => slug).sort(),
    );

    for (const pack of packs) {
      expect(resolvePrismaGradeLevel(pack.level)).toBe(pack.level);
      expect(assertStudentPackLevel(pack.level, pack.level)).toBe(pack.level);
    }
  });

  test('covers exactly the five levels represented by the manifest', () => {
    expect(representedLevels).toEqual([
      'PREMIERE',
      'QUATRIEME',
      'SECONDE',
      'TERMINALE',
      'TROISIEME',
    ]);
  });

  test('rejects every cross-level pair with the same stable application error', () => {
    const mismatches = representedLevels.flatMap((studentLevel) => (
      representedLevels
        .filter((packLevel) => packLevel !== studentLevel)
        .map((packLevel) => [studentLevel, packLevel] as const)
    ));

    expect(mismatches).toHaveLength(20);
    for (const [studentLevel, packLevel] of mismatches) {
      expect(() => assertStudentPackLevel(studentLevel, packLevel)).toThrow(
        'STUDENT_PACK_LEVEL_MISMATCH',
      );
    }
  });

  test.each([undefined, null, '', 'INCONNU', 'seconde']) (
    'fails closed for an absent or invalid Student level: %p',
    (studentLevel) => {
      expect(() => assertStudentPackLevel(studentLevel, 'SECONDE')).toThrow(
        'STUDENT_PACK_LEVEL_MISMATCH',
      );
    },
  );

  test('uses the Prisma enum as authority and rejects an unmapped pack level', () => {
    expect(Object.values(GradeLevel)).toContain('SECONDE');
    expect(() => resolvePrismaGradeLevel('SIXIEME')).toThrow('PACK_LEVEL_UNMAPPED:SIXIEME');
  });
});
