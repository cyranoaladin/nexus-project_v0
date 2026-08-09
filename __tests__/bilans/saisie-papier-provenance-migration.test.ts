/**
 * Contrat de la migration de provenance, et frontière du moteur de scoring.
 *
 * La migration est additive et rend la provenance immuable au niveau du
 * schéma. Le scoring, lui, ne doit jamais la lire : c'est ce qui garantit
 * qu'une saisie papier et une passation en ligne sont calculées par le même
 * code, sans branche.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION = resolve(
  process.cwd(),
  'prisma/migrations/20260808153000_add_canonical_attempt_provenance/migration.sql',
);

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(MIGRATION, 'utf8');

describe('Migration de provenance — additive', () => {
  test('n’ajoute que des colonnes et ne détruit rien', () => {
    for (const column of ['provenance', 'enteredById', 'enteredAt']) {
      expect(migration).toContain(`ADD COLUMN IF NOT EXISTS "${column}"`);
    }
    expect(migration).not.toMatch(/\b(DROP TABLE|DROP COLUMN|DROP CONSTRAINT|DELETE FROM|TRUNCATE|RENAME)\b/i);
    // Le DDL sur une table protégée est permis ; une réécriture de lignes ne
    // l'est pas. Aucun UPDATE ne doit figurer dans cette migration.
    expect(migration).not.toMatch(/^\s*UPDATE\s/im);
  });

  test('crée le type de provenance sans écraser un type existant', () => {
    expect(migration).toContain(`CREATE TYPE "CanonicalAttemptProvenance" AS ENUM ('EN_LIGNE', 'SAISIE_PAPIER')`);
    expect(migration).toContain("SELECT 1 FROM pg_type WHERE typname = 'CanonicalAttemptProvenance'");
  });

  test('qualifie les lignes antérieures comme passations en ligne', () => {
    expect(migration).toMatch(/"provenance"[^\n]*NOT NULL DEFAULT 'EN_LIGNE'/);
  });

  test('interdit une provenance sans audit, et un audit sans provenance', () => {
    expect(migration).toContain('canonical_assessment_attempts_provenance_audit_check');
    expect(migration).toContain(`"provenance" = 'EN_LIGNE' AND "enteredById" IS NULL AND "enteredAt" IS NULL`);
    expect(migration).toContain(`"provenance" = 'SAISIE_PAPIER' AND "enteredById" IS NOT NULL AND "enteredAt" IS NOT NULL`);
  });

  /**
   * Le piège du handoff : la table est append-only, la valeur doit venir de
   * l'INSERT. Ce trigger le rend vrai même en DRAFT — contrairement aux
   * réponses, qu'un brouillon peut modifier. L'origine d'une donnée n'est pas
   * un état de travail.
   */
  test('rend la provenance immuable dès la création, y compris en DRAFT', () => {
    expect(migration).toContain('NEW."provenance" IS DISTINCT FROM OLD."provenance"');
    expect(migration).toContain('NEW."enteredById" IS DISTINCT FROM OLD."enteredById"');
    expect(migration).toContain('NEW."enteredAt" IS DISTINCT FROM OLD."enteredAt"');
    expect(migration).toContain('provenance is set at creation and can never be updated');

    // Le garde de provenance précède le garde de cycle de vie : il n'est donc
    // conditionné par aucun statut.
    const guard = migration.indexOf('NEW."provenance" IS DISTINCT FROM OLD."provenance"');
    const lifecycle = migration.indexOf('illegal canonical assessment attempt lifecycle transition');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(lifecycle);
  });

  test('conserve intégralement les transitions de cycle de vie existantes', () => {
    for (const transition of [
      `(OLD."status" IN ('IN_PROGRESS', 'DRAFT') AND NEW."status" IN ('SUBMITTED', 'INVALIDATED'))`,
      `(OLD."status" = 'SUBMITTED' AND NEW."status" IN ('SCORED', 'SCORING_FAILED', 'INVALIDATED'))`,
      `(OLD."status" = 'COACH_VALIDATED' AND NEW."status" = 'PUBLISHED')`,
    ]) {
      expect(migration).toContain(transition);
    }
    expect(migration).toContain('submitted canonical assessment provenance is immutable');
  });

  test('le schéma Prisma déclare les mêmes colonnes que la migration', () => {
    const model = schema.match(/model CanonicalAssessmentAttempt \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(model).toMatch(/provenance\s+CanonicalAttemptProvenance\s+@default\(EN_LIGNE\)/);
    expect(model).toMatch(/enteredById\s+String\?/);
    expect(model).toMatch(/enteredAt\s+DateTime\?/);
    expect(schema).toContain('enum CanonicalAttemptProvenance');
    expect(schema).toMatch(/enum CanonicalAttemptProvenance \{\s*\n\s*EN_LIGNE\s*\n\s*SAISIE_PAPIER\s*\n\}/);
  });
});

describe('Frontière du scoring — la provenance n’entre pas dans le calcul', () => {
  const SCORING_PIPELINE = [
    'lib/bilans/facts/compute-facts.ts',
    'lib/bilans/facts/fact-sheet.ts',
    'lib/bilans/worker/scoring.ts',
    'lib/bilans/worker/score-job.ts',
    'lib/bilans/render/report.ts',
  ];

  test.each(SCORING_PIPELINE)('%s ignore la provenance', (path) => {
    const source = readFileSync(resolve(process.cwd(), path), 'utf8');
    expect(source).not.toMatch(/SAISIE_PAPIER|EN_LIGNE|provenance|enteredBy/i);
  });

  test('la passation en ligne et la saisie papier partagent les mêmes invariants', () => {
    const submit = readFileSync(resolve(process.cwd(), 'lib/bilans/api/submit-attempt.ts'), 'utf8');
    const paper = readFileSync(resolve(process.cwd(), 'lib/bilans/api/paper-entry.ts'), 'utf8');
    const patch = readFileSync(resolve(process.cwd(), 'lib/bilans/api/patch-answers.ts'), 'utf8');

    // Une seule définition de « copie complète » et un seul déclencheur de
    // scoring, importés par les deux chemins.
    for (const source of [submit, paper]) {
      expect(source).toContain("from './submission-core'");
      expect(source).toContain('assertAttemptComplete');
      expect(source).toContain('enqueueScoreJob');
      // Aucun chemin ne pose lui-même le job : il passe par la fonction
      // partagée.
      expect(source).not.toMatch(/jobType:\s*'SCORE_ATTEMPT'/);
    }
    // Une seule fusion de réponses, partagée par les deux chemins d'écriture.
    expect(patch).toContain('mergeAttemptAnswers');
    const entry = readFileSync(resolve(process.cwd(), 'lib/bilans/saisie-papier/entry.ts'), 'utf8');
    expect(entry).toContain('mergeAttemptAnswers');
  });

  test('la saisie papier ne réimplémente aucun moteur', () => {
    const paper = readFileSync(resolve(process.cwd(), 'lib/bilans/api/paper-entry.ts'), 'utf8');
    const entry = readFileSync(resolve(process.cwd(), 'lib/bilans/saisie-papier/entry.ts'), 'utf8');
    for (const source of [paper, entry]) {
      expect(source).not.toMatch(/computeFacts|buildFactSheet|buildWorkerScoring|globalScore/);
    }
  });
});

describe('Passation en ligne — non-régression', () => {
  test('déclare explicitement sa provenance à la création', () => {
    const create = readFileSync(resolve(process.cwd(), 'lib/bilans/api/create-attempt.ts'), 'utf8');
    expect(create).toContain("provenance: 'EN_LIGNE'");
    expect(create).not.toContain('SAISIE_PAPIER');
  });

  /**
   * Élargir la complétude à `confidence: null` ne doit rien ouvrir en ligne :
   * la validation d'entrée du PATCH reste la barrière, et elle impose une
   * certitude sur toute réponse sélectionnée.
   */
  test('exige toujours une certitude sur une réponse sélectionnée en ligne', () => {
    const patch = readFileSync(resolve(process.cwd(), 'lib/bilans/api/patch-answers.ts'), 'utf8');
    const selected = patch.match(/const selectedAnswerSchema = z\.object\(\{[\s\S]*?\}\)\.strict\(\);/)?.[0] ?? '';
    expect(selected).toContain('optionId: z.string().min(1)');
    expect(selected).toContain('z.literal(1)');
    expect(selected).not.toContain('z.null()');
  });
});
