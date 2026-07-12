import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

/**
 * Garde charte lux-* — surfaces publiques indexées.
 *
 * Interdit `surface-darker` et `brand-accent` dans les pages/composants
 * publics. Allowlist décroissante des pages pas encore migrées, vidée
 * groupe par groupe. Le privé (dashboards, EAM, etc.) est hors périmètre.
 */

const root = process.cwd();

// Legacy tokens that must not appear on public surfaces
const LEGACY_TOKENS = [
  'surface-darker', 'brand-accent', 'brand-accent-dark',
  'bg-surface-card', 'bg-surface-elevated',
];

// Raw Tailwind palette tokens forbidden on migrated public surfaces
// (must use lux-* equivalents instead)
const RAW_PALETTE_TOKENS = [
  'bg-slate-950', 'bg-slate-900',
  'text-slate-200', 'text-slate-300', 'text-slate-400',
  'gold-400', 'gold-500', 'bg-gold-',
  'brand-primary',
];

// Public page files that are ALREADY migrated (must stay clean)
const MIGRATED_PUBLIC_PAGES = [
  'app/page.tsx', // home
  'app/HomePageClient.tsx',
  'app/offres/page.tsx',
  'app/offres/_components/OffersFiltersClient.tsx',
  'app/notre-centre/page.tsx',
  'app/accompagnement-scolaire/page.tsx',
  'app/plateforme-aria/page.tsx',
  'app/equipe/page.tsx',
  'app/contact/page.tsx',
  'app/recommandation/page.tsx',
  'app/bilan-gratuit/page.tsx',
  'app/ressources/page.tsx',
  'app/politique-confidentialite/page.tsx',
  'app/famille/page.tsx',
  'app/stages/[stageSlug]/page.tsx',
  'app/stages/[stageSlug]/inscription/page.tsx',
  'app/mentions-legales/page.tsx',
  'app/conditions-generales/page.tsx',
  'app/auth/signin/page.tsx',
  'app/auth/signin/SignInForm.tsx',
  'app/auth/activate/page.tsx',
  'app/auth/reset-password/page.tsx',
  'app/auth/mot-de-passe-oublie/page.tsx',
  'app/access-required/page.tsx',
  'app/not-found.tsx',
  'app/error.tsx',
  // Sitemap pages using shared lux components (LandingNiche, Stages2026Page)
  'app/stages/page.tsx',
  'app/stages/Stages2026Page.tsx',
  'app/stages/pre-rentree-2026/page.tsx',
  'app/grand-oral/page.tsx',
  'app/reussir-eaf/page.tsx',
  'app/candidat-libre-bac-francais/page.tsx',
  'app/preparation-bac-francais-tunis/page.tsx',
  'app/programme/maths-1ere/page.tsx',
  'app/recommandation/page.tsx',
  'app/recommandation/RecommandationClient.tsx',
  'app/equipe/page.tsx',
];

// Public shared components (chrome) already migrated
const MIGRATED_PUBLIC_COMPONENTS = [
  'components/layout/CorporateNavbar.tsx',
  'components/layout/CorporateFooter.tsx',
  'components/stages/StageInscriptionForm.tsx',
  'components/marketing/LandingNiche.tsx',
  'components/stages/PublicStageCard.tsx',
  'components/pre-rentree-2026/CampaignFAQ.tsx',
  'components/pre-rentree-2026/CampaignPageTracker.tsx',
  'components/pre-rentree-2026/FinalCampaignCTA.tsx',
  'components/pre-rentree-2026/NexusMethodSection.tsx',
  'components/pre-rentree-2026/PracticalInformation.tsx',
  'components/pre-rentree-2026/PreRentreeHero.tsx',
  'components/pre-rentree-2026/PricingSection.tsx',
  'components/pre-rentree-2026/ProgramsSection.tsx',
  'components/pre-rentree-2026/ScheduleSection.tsx',
  'components/pre-rentree-2026/StageConfigurator.tsx',
];

// Pages publiques PAS encore migrées — allowlist décroissante
// Retirer de cette liste au fur et à mesure des PR de migration
// ✅ ALLOWLIST VIDE — Lot C complet
const PUBLIC_ALLOWLIST: string[] = [];

describe('Public lux-* charte guard', () => {
  test('migrated public pages contain no legacy tokens', () => {
    const offenders: string[] = [];

    for (const file of [...MIGRATED_PUBLIC_PAGES, ...MIGRATED_PUBLIC_COMPONENTS]) {
      const fullPath = join(root, file);
      if (!existsSync(fullPath)) continue;
      const content = readFileSync(fullPath, 'utf-8');
      for (const token of LEGACY_TOKENS) {
        if (content.includes(token)) {
          offenders.push(`${file} contains '${token}'`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  test('migrated public pages contain no raw palette tokens (slate/gold/brand-primary)', () => {
    const offenders: string[] = [];

    for (const file of [...MIGRATED_PUBLIC_PAGES, ...MIGRATED_PUBLIC_COMPONENTS]) {
      const fullPath = join(root, file);
      if (!existsSync(fullPath)) continue;
      const content = readFileSync(fullPath, 'utf-8');
      for (const token of RAW_PALETTE_TOKENS) {
        if (content.includes(token)) {
          offenders.push(`${file} contains '${token}' (use lux-* equivalent)`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  test('allowlist only contains files that actually exist and still have legacy tokens', () => {
    const stale: string[] = [];

    for (const file of PUBLIC_ALLOWLIST) {
      const fullPath = join(root, file);
      if (!existsSync(fullPath)) {
        stale.push(`${file} does not exist`);
        continue;
      }
      const content = readFileSync(fullPath, 'utf-8');
      const hasLegacy = LEGACY_TOKENS.some((token) => content.includes(token));
      if (!hasLegacy) {
        stale.push(`${file} has no legacy tokens — remove from allowlist`);
      }
    }

    expect(stale).toEqual([]);
  });

  // text-lux-slate (#5A6B82) has only 3.17:1 contrast on lux-ink — below AA.
  // It's fine on light backgrounds (lux-white, lux-paper) but must not appear
  // on pages whose root is bg-lux-ink (dark surfaces).
  const DARK_BG_PUBLIC_FILES = [
    'app/famille/page.tsx',
    'app/stages/[stageSlug]/page.tsx',
    'app/stages/[stageSlug]/inscription/page.tsx',
    'app/mentions-legales/page.tsx',
    'app/conditions-generales/page.tsx',
    'components/stages/StageInscriptionForm.tsx',
    'components/stages/PublicStageCard.tsx',
    'app/auth/signin/page.tsx',
    'app/auth/signin/SignInForm.tsx',
    'app/auth/activate/page.tsx',
    'app/auth/reset-password/page.tsx',
    'app/auth/mot-de-passe-oublie/page.tsx',
    'app/access-required/page.tsx',
    'app/not-found.tsx',
    'app/error.tsx',
    'app/equipe/page.tsx',
  ];

  test('text-lux-slate must not appear on dark-background public surfaces (contrast < AA)', () => {
    const offenders: string[] = [];

    for (const file of DARK_BG_PUBLIC_FILES) {
      const fullPath = join(root, file);
      if (!existsSync(fullPath)) continue;
      const content = readFileSync(fullPath, 'utf-8');
      if (content.includes('text-lux-slate')) {
        offenders.push(`${file} uses text-lux-slate on dark bg (use text-lux-on-dark-subtle instead)`);
      }
    }

    expect(offenders).toEqual([]);
  });

  // lux-eyebrow resolves to text-lux-gold-deep (#7A6535) — 3.07:1 on lux-ink.
  // On light backgrounds (lux-white 5.61:1, lux-paper 5.37:1) it passes AA.
  // On dark backgrounds it FAILS AA for normal text (11px semibold).
  // Rule: bare "lux-eyebrow" (without a color override like text-lux-gold-wash)
  // must not appear in dark-bg public files.
  test('bare lux-eyebrow must not appear on dark-background public surfaces (contrast < AA)', () => {
    const offenders: string[] = [];

    for (const file of DARK_BG_PUBLIC_FILES) {
      const fullPath = join(root, file);
      if (!existsSync(fullPath)) continue;
      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match lux-eyebrow NOT followed by a color override on the same className
        if (
          line.includes('lux-eyebrow') &&
          !line.includes('text-lux-gold-wash') &&
          !line.includes('text-lux-gold"') &&
          !line.includes('text-lux-gold ') &&
          !line.includes('text-lux-gold}')
        ) {
          const relPath = file;
          offenders.push(`${relPath}:${i + 1} uses bare lux-eyebrow on dark bg (add text-lux-gold-wash or use inline text-lux-gold)`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  // global-error.tsx uses inline hex (no Tailwind token classes available when
  // the root layout crashes). Verify hex values match the lux palette.
  // Not included in MIGRATED/DARK_BG lists since those check Tailwind classes.
  test('global-error.tsx hex colors match lux palette', () => {
    const fullPath = join(root, 'app/global-error.tsx');
    if (!existsSync(fullPath)) return;
    const content = readFileSync(fullPath, 'utf-8');

    const LUX_PALETTE: Record<string, string> = {
      '#071A3A': 'lux-ink',
      '#F7F4ED': 'lux-ivory',
      '#C4BBA8': 'lux-on-dark-muted',
      '#97918A': 'lux-on-dark-subtle',
      '#BFA06A': 'lux-gold',
    };

    // Extract all hex colors from the file
    const hexPattern = /#[0-9A-Fa-f]{6}/g;
    const hexColors = [...new Set(content.match(hexPattern) ?? [])];
    const unknownHex = hexColors.filter((hex) => !LUX_PALETTE[hex.toUpperCase()]);

    expect(unknownHex).toEqual([]);
  });

  // Exhaustive filesystem guard: every public page.tsx (excluding
  // dashboard/api/auth/session) must be either in MIGRATED, in EXCLUDED
  // (noindex/redirect/dynamic-auth), or fail. This prevents new public
  // pages from slipping through without charte coverage.
  const EXCLUDED_FROM_CHARTE = [
    // noindex pages (parcours fonctionnel, pas marketing)
    'app/access-required/page.tsx',
    'app/bilan-gratuit/assessment/page.tsx',
    'app/bilan-gratuit/confirmation/page.tsx',
    'app/bilan-pallier2-maths/page.tsx',
    'app/bilan-pallier2-maths/confirmation/page.tsx',
    'app/bilan-pallier2-maths/resultat/[id]/page.tsx',
    'app/bilan-pallier2-maths/dashboard/page.tsx',
    'app/lamis/page.tsx',
    'app/programme/maths-1ere-stmg/page.tsx',
    'app/programme/maths-terminale/page.tsx',
    // redirects (no rendering)
    'app/conditions/page.tsx',
    'app/maths-1ere/page.tsx',
    'app/pre-rentree/page.tsx',
    // dynamic-auth (requires auth, not public marketing)
    'app/admin/directeur/page.tsx',
    'app/assessments/[id]/processing/page.tsx',
    'app/assessments/[id]/result/page.tsx',
  ];

  test('filesystem exhaustivity: every public page.tsx is covered', () => {
    const allPages = execSync(
      "find app -name 'page.tsx' -not -path '*/dashboard/*' -not -path '*/api/*' -not -path '*/auth/*' -not -path '*/session/*'",
      { encoding: 'utf-8', cwd: root },
    )
      .trim()
      .split('\n')
      .filter(Boolean);

    const allMigrated = [...MIGRATED_PUBLIC_PAGES, ...MIGRATED_PUBLIC_COMPONENTS];
    const uncovered: string[] = [];

    for (const page of allPages) {
      const isInMigrated = allMigrated.includes(page);
      const isExcluded = EXCLUDED_FROM_CHARTE.includes(page);
      if (!isInMigrated && !isExcluded) {
        uncovered.push(`${page} is NOT in MIGRATED nor EXCLUDED — add it to one list`);
      }
    }

    expect(uncovered).toEqual([]);
  });
});
