import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { extname, join } from 'path';

const root = process.cwd();

const recursiveScanRoots = [
  'app',
  'components',
  'content',
  'lib',
  'data/pricing.canonical.json',
];

const deadFabricationArtifacts = [
  'components/ui/testimonials-section.tsx',
  'components/sections/testimonials-section.tsx',
  'components/sections/testimonials-section-gsap.tsx',
  'components/ui/offers-comparison.tsx',
  'components/ui/guarantee-seal.tsx',
  'public/images/sceau_garantie_reussite.png',
];

const scannedExtensions = new Set(['.ts', '.tsx', '.json', '.md', '.mdx', '.js']);

const excludedDirectories = new Set([
  '.next',
  'node_modules',
]);

const forbiddenTrustClaims = [
  /Nous garantissons/i,
  /Garantie Bac/i,
  /Garantie Mention/i,
  /Garantie Parcoursup/i,
  /garanti dès/i,
  /garantir les meilleurs résultats/i,
  /garantir un suivi personnalisé/i,
  /Attention individualisée garantie/i,
  /Bac Obtenu ou Remboursé/i,
  /garantie de réussite/i,
  /Mention garantie/i,
  /nos garanties et notre accompagnement/i,
  /Satisfaction Garantie/i,
  /Remboursement intégral si vous n(?:&apos;|'|’)êtes pas satisfait/i,
  /rareté est réelle/i,
  /garantir votre place/i,
  /Meilleur rendement pédagogique/i,
  /La différence est mesurable/i,
  /nous nous engageons sur leurs résultats/i,
  /nous ne recrutons que l(?:'|’)élite/i,
  /L(?:&apos;|'|’)excellence pédagogique augmentée par l(?:&apos;|'|’)Intelligence Artificielle/i,
];

const hardcodedGroupSizeClaims = [
  /(?:groupe|groupes)[^.\n]{0,90}\b5\b[^.\n]{0,40}(?:élèves|eleves|max|maximum)/i,
  /\b5\b\s*(?:élèves|eleves)\b/i,
  /\b(?:3|4)\b\s*inscrits/i,
  /dès\s*(?:3|4)\b/i,
  /\b(?:3|4)\b\s+pour\s+le\s+Brevet/i,
];

const brandRangeClaims = [
  /Odyssée/i,
  /Cortex/i,
  /Studio Flex/i,
  /Académies Nexus/i,
  /bac-garanti/i,
];

const invalidGroupMinOpenReads = [
  /group_min_open\.brevet/,
  /\bbrevetMinOpen\b/,
];

const scanAllowlist: Array<{ file: string; reason: string }> = [
  // Legal page must explicitly state that Nexus does not guarantee exam results.
  { file: 'app/conditions-generales/page.tsx', reason: 'legal non-guarantee clause' },
  // Privacy page mentions testimonials only to say Nexus does not publish personal data that way.
  { file: 'app/politique-confidentialite/page.tsx', reason: 'privacy non-use of testimonials' },
  // Third-party math engine package name, not a public Nexus range.
  { file: 'app/programme/maths-1ere/lib/math-engine.ts', reason: '@cortex-js package import' },
  // Lightweight client mirror of pricing group rules, equivalence-tested against the canonical loader.
  { file: 'lib/group-rules.ts', reason: 'canonical GROUP_RULES client mirror' },
];

function sourceFor(file: string): string {
  return readFileSync(join(root, file), 'utf8');
}

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

function isAllowlisted(file: string): boolean {
  return scanAllowlist.some((entry) => entry.file === file);
}

function matchingFiles(patterns: RegExp[]): string[] {
  return recursiveScanRoots
    .flatMap(listScannedFiles)
    .filter((file, index, files) => files.indexOf(file) === index)
    .filter((file) => !isAllowlisted(file))
    .filter((file) => patterns.some((pattern) => pattern.test(sourceFor(file))));
}

describe('Lot 1 T1.2 brand trust guardrails', () => {
  test('recursive scan does not expose result guarantees or aggressive claims outside the documented allowlist', () => {
    expect(matchingFiles(forbiddenTrustClaims)).toEqual([]);
  });

  test('famille page remains a server component', () => {
    expect(sourceFor('app/famille/page.tsx')).not.toMatch(/^['"]use client['"];?\s*$/m);
  });

  test('public group-size claims interpolate pricing rules instead of hardcoding 5/4/3 in copy', () => {
    expect(matchingFiles(hardcodedGroupSizeClaims)).toEqual([]);
  });

  test('group opening thresholds use canonical keys and never read the missing brevet key', () => {
    expect(matchingFiles(invalidGroupMinOpenReads)).toEqual([]);
  });

  test('client marketing surfaces read group rules from canonical SSOT (lib/pricing-client), not a duplicate', () => {
    const clientFiles = [
      'app/equipe/page.tsx',
      'app/HomePageClient.tsx',
      'components/marketing/acadomia-inspired.tsx',
      'components/premium/MethodSection.tsx',
    ];

    for (const file of clientFiles) {
      const source = sourceFor(file);
      // Must use getRules() from lib/pricing-client (client-safe SSOT subset)
      expect(source).toMatch(/\bgetRules\b/);
      expect(source).toMatch(/from ['"]@\/lib\/pricing-client['"]/);
      // Must NOT import from the deleted duplicate
      expect(source).not.toContain('group-rules');
    }
  });

  test('legacy range names are not exposed in active app or component copy', () => {
    expect(matchingFiles(brandRangeClaims)).toEqual([]);
  });

  test('famille page does not contain fabricated testimonials, ratings or unverifiable stats', () => {
    const source = sourceFor('app/famille/page.tsx');
    const forbidden = [
      /\btestimonials\b/i,
      /\bStar\b/,
      /Mme Ben Ali|M\. Cherif|Mme Guesmi/i,
      /92\s*%/,
      /\+150/,
      /Taux de réussite/i,
      /Années d(?:&apos;|'|’)expertise cumulée/i,
    ];

    for (const pattern of forbidden) {
      expect(source).not.toMatch(pattern);
    }
  });

  test('team content cannot reintroduce testimonial, quote or rating payloads', () => {
    const source = sourceFor('content/team.json');
    expect(source).not.toMatch(/"testimonial"|"testimonials"|"quote"|"rating"|"reviews"/i);
  });

  test('dead testimonial and guarantee components are removed instead of left as reintroduction traps', () => {
    for (const file of deadFabricationArtifacts) {
      expect(existsSync(join(root, file))).toBe(false);
    }
  });
});
