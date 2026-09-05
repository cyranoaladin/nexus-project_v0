/**
 * L'aperçu produit ARIA (`/dashboard/admin/aria-preview`) est PRÉSENTATION
 * SEULEMENT : il ne doit jamais atteindre, même transitivement, le moteur
 * ARIA réel (conversation, gateway modèle, client RAG, dépôt Prisma des
 * conversations). Le chemin ARIA authentique reste unique.
 *
 * Réutilise le même marcheur de graphe d'imports que
 * `aria-frontend-boundary.test.ts` (`ARIA_PREVIEW_RUNTIME_IMPORTS=0`).
 *
 * Important : la liste interdite se vérifie sur le CHEMIN RÉSOLU de chaque
 * module visité, jamais sur la chaîne de caractères du spécificateur — un
 * import relatif (`./infrastructure/rag/manifest` depuis `lib/aria/rag.ts`)
 * se résout au même fichier qu'un import `@/lib/aria/infrastructure/...` et
 * doit être détecté de façon identique.
 */
import { existsSync, statSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { importsOf } from './aria-boundary-helpers';

const root = process.cwd();

/** Répertoires entiers qui sont, sans exception, le moteur runtime réel. */
const FORBIDDEN_PATH_PREFIXES: readonly string[] = [
  'lib/aria/application/',
  'lib/aria/infrastructure/',
  'lib/aria/domain/',
  'lib/aria/evaluation/',
  'lib/aria/transport/',
];

/** Fichiers précis du runtime réel (le reste de leur dossier peut être sûr). */
const FORBIDDEN_EXACT_FILES: readonly string[] = [
  'lib/aria.ts',
  'lib/aria-streaming.ts',
  'lib/prisma.ts',
  'lib/aria/rag.ts',
  'lib/aria/client.ts',
  'lib/aria/gateway.ts',
  'lib/rag-client.ts',
  'lib/aria/kernel/entitlements.ts',
];

/**
 * Feuilles pures sans aucune portée vers le runtime, déjà utilisées
 * légitimement par le manifeste de capacités ARIA (schéma de mode
 * pédagogique). Documentées explicitement plutôt que de bannir tout
 * `lib/aria/domain/` sans échappatoire.
 */
const ALLOWED_EXCEPTIONS: readonly string[] = [
  'lib/aria/domain/pedagogy/pedagogical-mode.ts',
];

function isForbidden(repoRelativePath: string): boolean {
  if (ALLOWED_EXCEPTIONS.includes(repoRelativePath)) return false;
  if (FORBIDDEN_EXACT_FILES.includes(repoRelativePath)) return true;
  return FORBIDDEN_PATH_PREFIXES.some((prefix) => repoRelativePath.startsWith(prefix));
}

function resolveLocalModule(importer: string, specifier: string): string | null {
  const base = specifier.startsWith('@/')
    ? specifier.slice(2)
    : specifier.startsWith('.')
      ? normalize(join(dirname(importer), specifier))
      : null;
  if (!base) return null;
  return [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]
    .find((candidate) => {
      const absolute = resolve(root, candidate);
      return existsSync(absolute) && statSync(absolute).isFile();
    }) ?? null;
}

function runtimeEngineViolations(entry: string): readonly string[] {
  const pending = [entry];
  const visited = new Set<string>();
  const violations: string[] = [];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    if (isForbidden(current)) {
      violations.push(current);
      continue;
    }
    for (const specifier of importsOf(current)) {
      const local = resolveLocalModule(current, specifier);
      if (local && !visited.has(local)) pending.push(local);
    }
  }
  return violations.sort();
}

describe('ARIA_PREVIEW_RUNTIME_IMPORTS=0', () => {
  it('keeps the preview workspace component free of the real ARIA runtime', () => {
    expect(runtimeEngineViolations('components/aria-preview/AriaPreviewWorkspace.tsx')).toEqual([]);
  });

  it('keeps the preview view-model free of the real ARIA runtime', () => {
    expect(runtimeEngineViolations('lib/aria-preview/view-model.ts')).toEqual([]);
  });

  it('keeps every lib/aria-preview module free of the real ARIA runtime', () => {
    for (const entry of [
      'lib/aria-preview/capability-status.ts',
      'lib/aria-preview/coverage-matrix.ts',
      'lib/aria-preview/labels.ts',
      'lib/aria-preview/rag-canonical-authority.ts',
    ]) {
      expect(runtimeEngineViolations(entry)).toEqual([]);
    }
  });

  it('sabotage proof: a directly forbidden entry point is caught on arrival', () => {
    // lib/aria/rag.ts is itself in FORBIDDEN_EXACT_FILES, so a preview module
    // importing it would be flagged immediately.
    const violations = runtimeEngineViolations('lib/aria/rag.ts');
    expect(violations).toContain('lib/aria/rag.ts');
  });

  it('sabotage proof: a non-forbidden module reaching the runtime only via a relative specifier is still caught', () => {
    // This fixture is NOT itself in the forbidden lists — unlike the test
    // above, isForbidden() returns false on arrival, so the walker must
    // actually resolve its relative import
    // ('../../../lib/aria/infrastructure/rag/manifest') to the real absolute
    // path and flag THAT. This is the scenario Cubic's review demonstrated
    // was previously unproven: `lib/aria/rag.ts` being in
    // FORBIDDEN_EXACT_FILES meant the walker never got far enough to
    // exercise relative-path resolution at all.
    const violations = runtimeEngineViolations(
      '__tests__/architecture/fixtures/relative-import-sabotage-stub.ts',
    );
    expect(violations).toContain('lib/aria/infrastructure/rag/manifest.ts');
  });

  it('sabotage proof: the model gateway and RAG client barrels are caught even with zero or relative-only imports', () => {
    // lib/aria/gateway.ts re-exports from './infrastructure/model/gateway'
    // (relative); lib/rag-client.ts has no local imports to walk into at
    // all. Both must be caught as forbidden entry points in their own right.
    expect(runtimeEngineViolations('lib/aria/gateway.ts')).toContain('lib/aria/gateway.ts');
    expect(runtimeEngineViolations('lib/rag-client.ts')).toContain('lib/rag-client.ts');
  });

  it('does not flag the pure pedagogical-mode leaf the capability manifest legitimately depends on', () => {
    expect(runtimeEngineViolations('lib/aria/domain/pedagogy/pedagogical-mode.ts')).toEqual([]);
  });
});
