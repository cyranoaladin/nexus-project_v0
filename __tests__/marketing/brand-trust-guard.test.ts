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

const retiredLabelScanRoots = ['app', 'components', 'content', 'lib', 'data'];
const retiredLabelExcludedPathPrefixes = ['data/bilans/banks/_archive/'];

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

const retiredCandidatIndividuelLabels = [
  /Première Libre Essentiel/u,
  /Première Libre Accompagnée/u,
  /Terminale Libre Online/u,
  /Terminale Libre Mixte/u,
  /Terminale Libre Premium/u,
  /Essentiel, Mixte, Premium/u,
  /Pass Candidat Libre/u,
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

function excludeExplicitPedagogicalCounterExamples(file: string, source: string): string {
  if (!file.startsWith('content/bilans/prompts/')) return source;

  let fence: { marker: '`' | '~'; length: number } | null = null;
  let excludedHeadingLevel: number | null = null;

  return source
    .split('\n')
    .map((line) => {
      const fenceMatch = (fence === null
        ? /^ {0,3}(`{3,}|~{3,})[^\r\n]*$/u
        : /^ {0,3}(`{3,}|~{3,})[\t ]*$/u
      ).exec(line);
      if (fenceMatch) {
        const marker = fenceMatch[1][0] as '`' | '~';
        const length = fenceMatch[1].length;
        if (fence === null) {
          fence = { marker, length };
        } else if (fence.marker === marker && length >= fence.length) {
          fence = null;
        }
        return excludedHeadingLevel === null ? line : '';
      }

      if (fence === null) {
        const heading = /^(#{1,6})\s+(.+?)\s*$/u.exec(line);
        if (heading) {
          const level = heading[1].length;
          if (excludedHeadingLevel !== null && level <= excludedHeadingLevel) {
            excludedHeadingLevel = null;
          }
          if (level === 3 && heading[2] === 'Mauvaise formulation') {
            excludedHeadingLevel = level;
            return '';
          }
        }
      }

      return excludedHeadingLevel === null ? line : '';
    })
    .join('\n');
}

function sourceFor(file: string): string {
  return excludeExplicitPedagogicalCounterExamples(
    file,
    readFileSync(join(root, file), 'utf8'),
  );
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

function isRetiredLabelExcluded(file: string): boolean {
  return retiredLabelExcludedPathPrefixes.some((prefix) => file.startsWith(prefix));
}

function matchingFiles(
  patterns: RegExp[],
  scanRoots = recursiveScanRoots,
  excludeFile: (file: string) => boolean = isAllowlisted,
): string[] {
  return scanRoots
    .flatMap(listScannedFiles)
    .filter((file, index, files) => files.indexOf(file) === index)
    .filter((file) => !excludeFile(file))
    .filter((file) => patterns.some((pattern) => pattern.test(sourceFor(file))));
}

describe('Lot 1 T1.2 brand trust guardrails', () => {
  test('ignores only explicitly labelled pedagogical counter-examples', () => {
    const counterExample = [
      '# Prompt',
      'Texte autorisé.',
      '### Mauvaise formulation',
      'Nous garantissons une remise à niveau.',
    ].join('\n');
    const unlabelledClaim = '# Prompt\nNous garantissons une remise à niveau.';
    const claimAfterSection = [
      '# Prompt',
      '### Mauvaise formulation',
      'Nous garantissons une remise à niveau.',
      '## Règle suivante',
      'Nous garantissons aussi un résultat.',
    ].join('\n');
    const headingInsideFence = [
      '# Prompt',
      '```md',
      '### Mauvaise formulation',
      '```',
      'Nous garantissons une remise à niveau.',
    ].join('\n');
    const wrongHeadingLevel = '# Mauvaise formulation\nNous garantissons une remise à niveau.';
    const mixedFenceMarkers = [
      '# Prompt',
      '````md',
      '~~~',
      '### Mauvaise formulation',
      '````',
      'Nous garantissons une remise à niveau.',
    ].join('\n');
    const falseClosingFence = [
      '# Prompt',
      '````md',
      '````not-a-closing-fence',
      '### Mauvaise formulation',
      '````',
      'Nous garantissons une remise à niveau.',
    ].join('\n');

    expect(excludeExplicitPedagogicalCounterExamples('content/bilans/prompts/test/parents.md', counterExample))
      .not.toMatch(/Nous garantissons/i);
    expect(excludeExplicitPedagogicalCounterExamples('content/bilans/prompts/test/parents.md', unlabelledClaim))
      .toMatch(/Nous garantissons/i);
    expect(excludeExplicitPedagogicalCounterExamples('app/page.tsx', counterExample))
      .toMatch(/Nous garantissons/i);
    expect(excludeExplicitPedagogicalCounterExamples('content/bilans/prompts/test/parents.md', claimAfterSection))
      .toMatch(/Nous garantissons aussi/i);
    expect(excludeExplicitPedagogicalCounterExamples('content/bilans/prompts/test/parents.md', headingInsideFence))
      .toMatch(/Nous garantissons/i);
    expect(excludeExplicitPedagogicalCounterExamples('content/bilans/prompts/test/parents.md', wrongHeadingLevel))
      .toMatch(/Nous garantissons/i);
    expect(excludeExplicitPedagogicalCounterExamples('content/bilans/prompts/test/parents.md', mixedFenceMarkers))
      .toMatch(/Nous garantissons/i);
    expect(excludeExplicitPedagogicalCounterExamples('content/bilans/prompts/test/parents.md', falseClosingFence))
      .toMatch(/Nous garantissons/i);
  });

  test('recursive scan does not expose result guarantees or aggressive claims outside the documented allowlist', () => {
    expect(matchingFiles(forbiddenTrustClaims)).toEqual([]);
  });

  test('runtime sources do not expose retired candidat individuel labels', () => {
    expect(matchingFiles(
      retiredCandidatIndividuelLabels,
      retiredLabelScanRoots,
      isRetiredLabelExcluded,
    )).toEqual([]);
  });

  test('retired-label scan includes active docs routes and files from the trust allowlist', () => {
    const files = matchingFiles(
      [/Documentation Interne \(Read-only\)/u, /Le Vendeur ne garantit pas/u],
      retiredLabelScanRoots,
      isRetiredLabelExcluded,
    );

    expect(files).toEqual(expect.arrayContaining([
      'app/dashboard/assistante/docs/page.tsx',
      'app/conditions-generales/page.tsx',
    ]));
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
    const glob = require('glob');
    const candidates: string[] = glob.sync('{app,components}/**/*.tsx', {
      ignore: ['**/node_modules/**', '**/.next/**'],
    });

    // Two complementary checks:
    // (A) Positive: files importing getRules must use pricing-client
    // (B) Negative: NO client file anywhere imports group-rules (forbidden pattern)

    const clientFilesWithGetRules: string[] = [];
    const groupRulesViolations: string[] = [];

    for (const file of candidates) {
      const source = readFileSync(join(root, file), 'utf8');
      const firstLine = source.split('\n').find((l: string) => {
        const t = l.trim();
        return t !== '' && !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
      });
      const isClient = firstLine && (firstLine.trim() === "'use client';" || firstLine.trim() === '"use client";'
        || firstLine.trim() === "'use client'" || firstLine.trim() === '"use client"');
      if (!isClient) continue;

      // (B) Forbidden: no client file should import group-rules
      if (/group-rules/.test(source)) {
        groupRulesViolations.push(file);
      }

      // (A) Positive: files using getRules must import from pricing-client
      if (/\bgetRules\b/.test(source)) {
        clientFilesWithGetRules.push(file);
      }
    }

    // At least some client files use getRules (sanity check)
    expect(clientFilesWithGetRules.length).toBeGreaterThan(0);

    for (const file of clientFilesWithGetRules) {
      const source = sourceFor(file);
      expect(source).toMatch(/from ['"]@\/lib\/pricing-client['"]/);
    }

    // No client file anywhere uses the deleted group-rules module
    expect(groupRulesViolations).toEqual([]);
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
