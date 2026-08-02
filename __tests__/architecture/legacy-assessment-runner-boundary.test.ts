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

describe('legacy assessment public boundary', () => {
  test('keeps the legacy page unconditionally closed by the server with a 404', () => {
    const source = readFileSync(PAGE, 'utf8');

    expect(source).not.toMatch(/^\s*['"]use client['"]/m);
    expect(source).toMatch(/import\s+\{\s*notFound\s*\}\s+from\s+['"]next\/navigation['"]/);
    expect(source).toMatch(/export default function BilanAssessmentPage\(\): never\s*\{\s*notFound\(\);\s*\}/);
    expect(source).not.toContain('AssessmentRunner');
    expect(source).not.toContain('process.env');
  });

  test('keeps correction markers out of every client module reachable from the page', () => {
    const clientModules = clientModuleGraph(PAGE);
    const serializedClientBundle = [...clientModules.values()].join('\n');

    expect([...clientModules.keys()]).toEqual([]);
    expect(serializedClientBundle).not.toContain('isCorrect');
    expect(serializedClientBundle).not.toContain('explanation');
  });
});
