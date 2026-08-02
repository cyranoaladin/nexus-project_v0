import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';

const ROOT = process.cwd();
const PAGE = resolve(ROOT, 'app/bilan-gratuit/assessment/page.tsx');
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

function resolveImport(importer: string, specifier: string): string | null {
  let candidate: string;
  if (specifier.startsWith('@/')) candidate = resolve(ROOT, specifier.slice(2));
  else if (specifier.startsWith('.')) candidate = resolve(dirname(importer), specifier);
  else return null;

  const candidates = extname(candidate)
    ? [candidate]
    : [
        ...SOURCE_EXTENSIONS.map((extension) => `${candidate}${extension}`),
        ...SOURCE_EXTENSIONS.map((extension) => resolve(candidate, `index${extension}`)),
      ];

  return candidates.find((path) => existsSync(path)) ?? null;
}

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

function clientModuleGraph(entry: string): Map<string, string> {
  const visited = new Set<string>();
  const clientModules = new Map<string, string>();

  function visit(file: string, inheritedClientBoundary: boolean): void {
    const visitKey = `${file}:${inheritedClientBoundary}`;
    if (visited.has(visitKey)) return;
    visited.add(visitKey);

    const source = readFileSync(file, 'utf8');
    const isClient = inheritedClientBoundary || /^\s*['"]use client['"];?/m.test(source);
    if (isClient) clientModules.set(file, source);

    for (const specifier of importSpecifiers(source)) {
      const imported = resolveImport(file, specifier);
      if (imported) visit(imported, isClient);
    }
  }

  visit(entry, false);
  return clientModules;
}

describe('Canonical assessment client boundary', () => {
  test('keeps the legacy runner absent and mounts the Canonical seam server-side', () => {
    const source = readFileSync(PAGE, 'utf8');

    expect(source).not.toMatch(/^\s*['"]use client['"]/m);
    expect(source).not.toMatch(/components\/assessments\/AssessmentRunner|<AssessmentRunner\b/);
    expect(source).toContain('CanonicalAssessmentRunner');
    expect(source).toContain('CanonicalAssessmentWaiting');
  });

  test('keeps every correction marker and pack source out of the reachable client bundle', () => {
    const clientModules = clientModuleGraph(PAGE);
    const serializedClientBundle = [...clientModules.values()].join('\n');

    expect([...clientModules.keys()].some((path) => path.endsWith('CanonicalAssessmentRunner.tsx'))).toBe(true);
    expect(serializedClientBundle).not.toContain('isCorrect');
    expect(serializedClientBundle).not.toContain('explanation');
    expect(serializedClientBundle).not.toContain('distractorRationale');
    expect(serializedClientBundle).not.toContain('__CORRECT__');
    expect(serializedClientBundle).not.toContain('__RATIONALE__');
    expect(serializedClientBundle).not.toMatch(/data\/bilans\/banks|load-pack|pack-access/);
  });
});
