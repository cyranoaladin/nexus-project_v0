import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { extname, join } from 'path';

const root = process.cwd();

const scanRoots = ['app', 'components'];
const scannedExtensions = new Set(['.ts', '.tsx']);
const excludedDirectories = new Set(['.next', 'node_modules']);

function listScannedFiles(target: string): string[] {
  const absolute = join(root, target);
  if (!existsSync(absolute)) return [];
  const stat = statSync(absolute);
  if (stat.isFile()) {
    return scannedExtensions.has(extname(target)) ? [target] : [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(absolute)) {
    if (excludedDirectories.has(entry)) continue;
    const child = `${target}/${entry}`;
    const childStat = statSync(join(root, child));
    if (childStat.isDirectory()) {
      files.push(...listScannedFiles(child));
    } else if (scannedExtensions.has(extname(child))) {
      files.push(child);
    }
  }
  return files;
}

function sourceFor(file: string): string {
  return readFileSync(join(root, file), 'utf8');
}

function anchorFromHref(href: string): string | null {
  if (!href.startsWith('#') && !href.startsWith('/')) return null;
  const hashIndex = href.indexOf('#');
  if (hashIndex === -1) return null;
  const rawAnchor = href.slice(hashIndex + 1).split(/[?&/]/)[0];
  return rawAnchor || null;
}

function isCssHexColor(href: string): boolean {
  return /^#[0-9A-Fa-f]{3,8}$/.test(href);
}

function collectCanonicalPricingIds(): Set<string> {
  const pricing = JSON.parse(sourceFor('data/pricing.canonical.json'));
  const ids = new Set<string>();

  function visit(value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;

    const record = value as Record<string, unknown>;
    for (const key of ['id', 'format_id', 'edition_id']) {
      if (typeof record[key] === 'string') {
        ids.add(record[key]);
      }
    }
    Object.values(record).forEach(visit);
  }

  visit(pricing);
  return ids;
}

function collectLiteralIds(files: string[]): Set<string> {
  const ids = new Set<string>();
  const idPattern = /\bid\s*=\s*["'`]([A-Za-z0-9_-]+)["'`]/g;
  const configIdPattern = /\bid\s*:\s*["'`]([A-Za-z0-9_-]+)["'`]/g;

  for (const file of files) {
    const source = sourceFor(file);
    for (const match of source.matchAll(idPattern)) {
      ids.add(match[1]);
    }
    for (const match of source.matchAll(configIdPattern)) {
      ids.add(match[1]);
    }
  }

  return ids;
}

describe('internal anchor link integrity', () => {
  test('literal internal href anchors resolve to a literal id in active app or component code', () => {
    const files = scanRoots
      .flatMap(listScannedFiles)
      .filter((file, index, allFiles) => allFiles.indexOf(file) === index);
    const ids = collectLiteralIds(files);
    collectCanonicalPricingIds().forEach((id) => ids.add(id));
    const internalAnchorStringPattern = /["'`]((?:\/[\p{L}0-9_./?=&%-]+)?#[\p{L}][\p{L}0-9_-]+)["'`]/gu;
    const missing: string[] = [];

    for (const file of files) {
      const source = sourceFor(file);
      for (const match of source.matchAll(internalAnchorStringPattern)) {
        const href = match[1];
        if (isCssHexColor(href)) continue;
        const anchor = anchorFromHref(href);
        if (anchor && !ids.has(anchor)) {
          missing.push(`${file}: ${href} -> #${anchor}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
