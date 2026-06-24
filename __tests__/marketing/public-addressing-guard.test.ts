import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { extname, join } from 'path';

const root = process.cwd();
const scannedExtensions = new Set(['.ts', '.tsx', '.mdx']);
const scanRoots = [
  'app',
  'components/layout',
  'components/marketing',
  'components/premium',
  'components/sections',
  'content',
];

const studentSurfaceAllowlist: Array<{ prefix: string; reason: string }> = [
  { prefix: 'app/dashboard/eleve', reason: 'surface eleve authentifiee' },
  { prefix: 'app/lamis', reason: 'surface eleve noindex' },
  { prefix: 'app/programme', reason: 'programme eleve authentifie' },
  { prefix: 'components/aria', reason: 'assistant pedagogique eleve' },
  { prefix: 'components/dashboard/eleve', reason: 'surface eleve authentifiee' },
  { prefix: 'components/programme', reason: 'programme eleve authentifie' },
];

function listFiles(target: string): string[] {
  const absolute = join(root, target);
  if (!existsSync(absolute)) return [];
  const stat = statSync(absolute);
  if (stat.isFile()) {
    return scannedExtensions.has(extname(target)) ? [target] : [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
    const child = `${target}/${entry.name}`;
    if (entry.isDirectory()) files.push(...listFiles(child));
    else if (scannedExtensions.has(extname(child))) files.push(child);
  }
  return files;
}

function isStudentSurface(file: string): boolean {
  return studentSurfaceAllowlist.some((entry) => file.startsWith(entry.prefix));
}

function isPublicMarketingSurface(file: string): boolean {
  if (!file.endsWith('/page.tsx') && !file.endsWith('/layout.tsx')) {
    return !file.startsWith('app/');
  }

  return ![
    'app/api/',
    'app/admin/',
    'app/auth/',
    'app/dashboard/',
    'app/session/',
    'app/assessments/',
    'app/bilan-pallier2-maths/',
  ].some((prefix) => file.startsWith(prefix));
}

function sourceFor(file: string): string {
  return readFileSync(join(root, file), 'utf8');
}

describe('public marketing address guard', () => {
  test('public marketing surfaces do not address families with tu/ton/ta/tes/toi', () => {
    const tuPattern = /(?<![\p{L}\p{N}_])(?:tu|ton|ta|tes|toi)(?![\p{L}\p{N}_])/iu;
    const offenders = scanRoots
      .flatMap(listFiles)
      .filter((file, index, files) => files.indexOf(file) === index)
      .filter(isPublicMarketingSurface)
      .filter((file) => !isStudentSurface(file))
      .filter((file) => tuPattern.test(sourceFor(file)));

    expect(offenders).toEqual([]);
  });
});
