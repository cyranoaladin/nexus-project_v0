/**
 * L'aperçu produit ARIA (`/dashboard/admin/aria-preview`) est PRÉSENTATION
 * SEULEMENT : il ne doit jamais atteindre, même transitivement, le moteur
 * ARIA réel (conversation, gateway modèle, client RAG, dépôt Prisma des
 * conversations). Le chemin ARIA authentique reste unique.
 *
 * Réutilise le même marcheur de graphe d'imports que
 * `aria-frontend-boundary.test.ts` (`ARIA_PREVIEW_RUNTIME_IMPORTS=0`).
 */
import { existsSync, statSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { importsOf } from './aria-boundary-helpers';

const root = process.cwd();

const FORBIDDEN_SPECIFIER_PATTERNS: readonly RegExp[] = [
  /^@\/lib\/aria\/application\//,
  /^@\/lib\/aria\/infrastructure\//,
  /^@\/lib\/aria\.ts?$/,
  /^@\/lib\/aria$/,
  /^@\/lib\/aria-streaming/,
  /^@\/lib\/prisma$/,
  /run-conversation/,
  /conversation-repository/,
];

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
    for (const specifier of importsOf(current)) {
      if (FORBIDDEN_SPECIFIER_PATTERNS.some((pattern) => pattern.test(specifier))) {
        violations.push(`${current} -> ${specifier}`);
        continue;
      }
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
});
