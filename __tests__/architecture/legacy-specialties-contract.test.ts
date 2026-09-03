import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Garde de la phase EXPAND sur `students.specialties`.
 *
 * La colonne existe en production depuis `20260425094000_add_student_track_level_specialties`
 * et y porte des données réelles. Le modèle canonique est désormais
 * `StudentAcademicEnrollment` : plus aucun code canonique ne lit ni n'écrit la
 * colonne, mais elle est CONSERVÉE pour permettre un rollback sans perte.
 *
 *   SPECIALTIES_CONTRACT_STATUS=DEFERRED_SAFELY
 *   DATA_LOSS_RISK=0
 *
 * Ce test échoue si un DROP de la colonne réapparaît dans les migrations sans
 * qu'un lot CONTRACT dédié ait été mené. Le supprimer n'est légitime qu'avec la
 * preuve `LEGACY_SPECIALTIES_READERS=0` / `LEGACY_SPECIALTIES_WRITERS=0` sur la
 * lignée réellement déployée, et une sauvegarde de la colonne.
 */

const root = process.cwd();
const migrationsDir = join(root, 'prisma/migrations');

function migrationSqlFiles(): string[] {
  return readdirSync(migrationsDir)
    .map((entry) => join(migrationsDir, entry))
    .filter((entry) => statSync(entry).isDirectory())
    .map((dir) => join(dir, 'migration.sql'))
    .filter((file) => {
      try {
        return statSync(file).isFile();
      } catch {
        return false;
      }
    });
}

describe('legacy students.specialties — phase expand/contract', () => {
  test('aucune migration ne supprime la colonne héritée', () => {
    const offenders = migrationSqlFiles().filter((file) =>
      /DROP\s+COLUMN\s+"?specialties"?/i.test(readFileSync(file, 'utf8')),
    );

    expect(offenders).toEqual([]);
  });

  test('la migration SSOT conserve son backfill et ses gardes fail-closed', () => {
    const sql = readFileSync(
      join(migrationsDir, '20260828140000_academic_enrollment_ssot/migration.sql'),
      'utf8',
    );

    // Le backfill vers le modèle canonique reste en place…
    expect(sql).toContain('student_academic_enrollments');
    // …ainsi que les deux gardes qui interrompent la migration sur donnée inattendue.
    expect(sql).toContain('MIGRATION_BLOCKED_UNRESOLVED_LEGACY_SPECIALTIES');
    expect(sql).toContain('MIGRATION_BLOCKED_BACKFILL_SET_MISMATCH');
    // …et le statut de la phase est documenté dans la migration elle-même.
    expect(sql).toContain('SPECIALTIES_CONTRACT_STATUS=DEFERRED_SAFELY');
  });

  test('le schéma canonique ne déclare plus la colonne héritée', () => {
    const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');
    const studentModel = /model Student \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? '';

    expect(studentModel).not.toMatch(/^\s*specialties\s/m);
    expect(studentModel).toContain('academicEnrollments');
  });
});
