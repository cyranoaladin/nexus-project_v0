/**
 * Les lectures de copies ne doivent JAMAIS exposer le chemin de stockage privé.
 *
 * Défaut visé : `listDiagnosticAssignmentsForStudent`, `getOwnDiagnosticAssignments`
 * et `getOwnDiagnosticAssignment` utilisaient `include: { submissions: … }` sans
 * `select`, renvoyant donc la ligne `DiagnosticSubmission` complète —
 * `storageKey` compris (core-v2/prisma/schema.prisma). Or
 * `app/api/v2/student/diagnostics/assignments/route.ts` renvoie ce résultat
 * directement comme `data` : un élève mineur recevait le chemin de stockage
 * interne de ses propres copies.
 *
 * La route sœur documente pourtant l'invariant inverse : « the private storage
 * path is never included in the response, only in the server-side log for
 * operator diagnosis ».
 *
 * La correction est une projection POSITIVE à la source (liste blanche de
 * champs), et non une suppression tardive après sérialisation : un champ
 * sensible ajouté plus tard au modèle n'est alors jamais exposé par défaut.
 */
import {
  SUBMISSION_PUBLIC_FIELDS,
  assertNoPrivateStoragePath,
} from '@/lib/core-v2/services/diagnostics';

/** Champs du modèle qui ne doivent jamais traverser la frontière HTTP. */
const FORBIDDEN = ['storageKey'] as const;

describe('projection des copies de diagnostic', () => {
  test('la liste blanche ne contient aucun champ interdit', () => {
    for (const field of FORBIDDEN) {
      expect(Object.keys(SUBMISSION_PUBLIC_FIELDS)).not.toContain(field);
    }
  });

  test('la liste blanche expose bien ce dont l’interface a besoin', () => {
    for (const field of ['id', 'assignmentId', 'version', 'originalFilename',
      'mimeType', 'sizeBytes', 'sha256', 'status', 'createdAt'] as const) {
      expect(SUBMISSION_PUBLIC_FIELDS).toHaveProperty(field, true);
    }
  });

  test('la projection est positive : toutes les valeurs sont des inclusions explicites', () => {
    for (const [, value] of Object.entries(SUBMISSION_PUBLIC_FIELDS)) {
      expect(value).toBe(true);
    }
  });

  test('un chemin de stockage dans une charge utile est détecté', () => {
    expect(() => assertNoPrivateStoragePath({
      submissions: [{ id: 's1', storageKey: 'assignment-1/abcdef.pdf' }],
    })).toThrow(/PRIVATE_STORAGE_PATH_EXPOSED/);
  });

  test('une charge utile sans chemin de stockage passe', () => {
    expect(() => assertNoPrivateStoragePath({
      submissions: [{ id: 's1', originalFilename: 'copie.pdf', version: 1 }],
    })).not.toThrow();
  });

  test('la détection est récursive : un champ imbriqué profond est vu', () => {
    expect(() => assertNoPrivateStoragePath({
      a: { b: { c: [{ storageKey: 'x/y.pdf' }] } },
    })).toThrow(/PRIVATE_STORAGE_PATH_EXPOSED/);
  });

  test('la détection ne se laisse pas tromper par une valeur nulle', () => {
    // Une clé présente, même vide, reste une fuite de schéma interne.
    expect(() => assertNoPrivateStoragePath({ submissions: [{ storageKey: null }] }))
      .toThrow(/PRIVATE_STORAGE_PATH_EXPOSED/);
  });
});
