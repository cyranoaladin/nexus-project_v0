import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { importsOf } from './aria-boundary-helpers';

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

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

function browserDependencyViolations(entry: string): readonly string[] {
  const pending = [entry];
  const visited = new Set<string>();
  const violations: string[] = [];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const specifier of importsOf(current)) {
      if (specifier.startsWith('node:') || specifier === 'next/server') {
        violations.push(`${current} -> ${specifier}`);
        continue;
      }
      const local = resolveLocalModule(current, specifier);
      if (local && !visited.has(local)) pending.push(local);
    }
  }
  return violations.sort();
}

describe('ARIA frontend reachability and single-engine boundary', () => {
  it('H006 removes every orphaned or duplicate historical chat component', () => {
    for (const path of [
      'components/ui/aria-chat.tsx',
      'components/ui/aria-widget.tsx',
      'components/ui/aria-feedback.tsx',
      'components/ui/aria-comparison.tsx',
      'components/ui/aria-embedded-chat.tsx',
    ]) expect(existsSync(resolve(root, path))).toBe(false);
  });

  it('keeps one authenticated panel/engine and a thin dashboard launcher', () => {
    expect(source('app/dashboard/eleve/page.tsx')).toMatch(/AriaChatLauncher/);
    expect(source('components/aria/AriaChatLauncher.tsx')).toMatch(/AriaChatPanel/);
    expect(source('components/aria/AriaChatPanel.tsx')).toMatch(/useAriaConversation/);
  });

  it('keeps the public marketing page static with no product API client', () => {
    const marketing = source('app/plateforme-aria/page.tsx');
    expect(marketing).toMatch(/AriaMarketingDemo/);
    expect(marketing).not.toMatch(/\/api\/aria|AriaChatPanel|useAriaConversation/);
  });

  it('contains no authenticated hardcoded course catalog or implicit Maths/grade fallback', () => {
    const authenticated = [
      source('components/aria/AriaChatPanel.tsx'),
      source('components/aria/useAriaConversation.ts'),
      source('components/aria/AriaChatLauncher.tsx'),
      source('lib/aria/client.ts'),
    ].join('\n');
    expect(authenticated).not.toMatch(/eds-maths-(?:terminale|premiere)|TERMINALE.*fallback|COURSE_OPTIONS/);
  });

  it('keeps the complete browser client dependency graph free of Node and server transport modules', () => {
    expect(browserDependencyViolations('lib/aria/client.ts')).toEqual([]);
  });
});
