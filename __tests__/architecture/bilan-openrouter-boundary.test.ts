import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

function sourceFiles(root: string): string[] {
  const absoluteRoot = resolve(process.cwd(), root);
  return readdirSync(absoluteRoot, { withFileTypes: true }).flatMap((entry) => {
    const relative = `${root}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(relative);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [relative] : [];
  });
}

describe('bilan provider architecture boundary', () => {
  it('permits OpenRouter imports only in the gateway and dedicated scripts', () => {
    const offenders = ['app', 'components', 'lib', 'scripts']
      .flatMap(sourceFiles)
      .filter((path) => {
        if (path === 'lib/bilans/llm/gateway.ts' || /^scripts\/bilans\/openrouter-/.test(path)) return false;
        const source = readFileSync(resolve(process.cwd(), path), 'utf8');
        return /(?:from|require\()['"]@?\/?(?:lib\/)?llm\/openrouter/.test(source);
      });

    expect(offenders).toEqual([]);
  });
});
