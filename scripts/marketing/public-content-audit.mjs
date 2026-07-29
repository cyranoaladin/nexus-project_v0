#!/usr/bin/env node
/**
 * Marketing content audit — scans RENDERED public pages, not just source.
 *
 * Rationale: final-public-release-audit.mjs proved that a source-only scan
 * misses anything assembled at render time (a value can come from data, a
 * component, or a template — the text a parent actually reads only exists
 * once rendered). This script fetches each public page from a running
 * server and scans the rendered HTML text, the same way a human visitor
 * would read it.
 *
 * NOT wired into CI, package.json, or any pre-deploy hook — prepared per
 * AGENTS.md §3 (canonical marketing promise) and an explicit request to
 * check content beyond what final-public-release-audit.mjs (scoped to the
 * Pré-rentrée campaign only) already covers. Requires an explicit decision
 * before it becomes a blocking gate — see docs/audits/2026-07-29-existing-auditors-inventory.md.
 *
 * Usage:
 *   node scripts/marketing/public-content-audit.mjs --base-url http://127.0.0.1:3000
 *
 * Optional: --save-html <dir> also saves each page's raw HTML under <dir>,
 * making this script double as the missing producer for
 * final-public-release-audit.mjs's `--rendered <capture-directory>` mode
 * (that mode has never had anything build its required input — see
 * docs/audits/2026-07-29-existing-auditors-inventory.md, section F1/I).
 * Example, running both audits against the same capture in one pass:
 *   node scripts/marketing/public-content-audit.mjs --base-url http://127.0.0.1:3000 --save-html /tmp/capture
 *   node scripts/pre-rentree/final-public-release-audit.mjs --rendered /tmp/capture
 *
 * Exit codes: 0 = no finding, 1 = at least one finding, 2 = usage/fetch error.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
function argValue(flag, fallback) {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : fallback;
}

const baseUrl = argValue('--base-url', 'http://127.0.0.1:3000').replace(/\/$/, '');
const saveHtmlDir = argValue('--save-html', null);

function htmlCapturePath(dir, pagePath) {
  const safeName = pagePath === '/' ? 'index' : pagePath.replace(/^\//, '').replace(/\//g, '__');
  return join(dir, `${safeName}.html`);
}

// Pages excluded from the "commercial page" siège/centre check — they are
// legal/administrative documents that AGENTS.md §2 explicitly allows to cite
// the Centre Urbain Nord siège social.
const LEGAL_DOCUMENT_PATHS = new Set([
  '/mentions-legales',
  '/conditions-generales',
  '/conditions',
  '/politique-confidentialite',
]);

// Pages excluded entirely from the marketing-language scan: authentication
// forms, technical redirects, and in-session tooling are not commercial copy.
const NON_COMMERCIAL_PATHS = new Set([
  '/access-required',
  '/auth/activate',
  '/auth/mot-de-passe-oublie',
  '/auth/reset-password',
  '/auth/signin',
  '/session/video',
  '/bilan-gratuit/assessment',
  '/bilan-gratuit/confirmation',
  '/bilan-pallier2-maths/confirmation',
  '/bilan-pallier2-maths/dashboard',
  '/conditions',
  '/conditions-generales',
  '/mentions-legales',
  '/politique-confidentialite',
]);

/**
 * Public static page routes, derived from `find app -name page.tsx` excluding
 * dashboard/api and dynamic segments. Dynamic routes ([stageSlug], etc.) are
 * NOT covered here — they require a valid slug to render and are out of
 * scope for this pass. See the report for the exact exclusion list.
 */
function discoverPublicPagePaths() {
  const output = execSync(
    "find app -name 'page.tsx' | grep -vE '^app/(dashboard|api)/|^app/\\(dashboard\\)/' | grep -v '\\[' | sort",
    { encoding: 'utf8' },
  );
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((filePath) => {
      const routePath = filePath
        .replace(/^app/, '')
        .replace(/\/page\.tsx$/, '')
        .replace(/\/\([^)]+\)/g, '');
      return routePath === '' ? '/' : routePath;
    });
}

// ─── Categories, patterns, and ownership per AGENTS.md §2-3 ────────────────

const CHECKS = [
  {
    category: 'resultat-garanti',
    label: 'Promesse de résultat / garantie / taux de réussite (AGENTS.md §3)',
    commercialOnly: true,
    patterns: [
      /100\s*%\s*(?:bac|réussite)/i,
      /garantie?\s+(?:de\s+)?(?:réussite|mention)/i,
      /mention\s+garantie/i,
      /taux\s+de\s+réussite\s+(?:de\s+)?\d/i,
      /\d+\s*%\s+de\s+réussite/i,
      /\b\d+\+?\s+mentions?\b/i,
      /\b\d+\+?\s+élèves?\s+suivis?\b/i,
      /réussite\s+(?:scolaire\s+)?garantie/i,
    ],
  },
  {
    category: 'essai-gratuit-sans-acces',
    label: '"Essayer gratuitement" sans accès gratuit réel',
    commercialOnly: true,
    // Flags the phrase for manual review — the script cannot itself verify
    // whether a free access path exists behind the CTA.
    patterns: [
      /essa(?:yer|i)\s+gratuit/i,
      /gratuit(?:e)?\s+pendant\s+\d+/i,
    ],
  },
  {
    category: 'urgence-artificielle',
    label: 'Compte à rebours / rareté artificielle non adossée à une donnée réelle',
    commercialOnly: true,
    patterns: [
      /il\s+ne\s+reste\s+(?:que\s+)?\d+\s+places?/i,
      /plus\s+que\s+\d+\s+places?/i,
      /dernière\s+chance/i,
      /places?\s+limitées?/i,
      /offre\s+(?:se\s+termine|expire)\s+(?:dans|le)/i,
    ],
  },
  {
    category: 'siege-centre-confusion',
    label: 'Centre Urbain Nord (siège social) mentionné sur une page commerciale',
    commercialOnly: true,
    excludeLegal: true,
    patterns: [/centre\s+urbain\s+nord/i],
  },
  {
    category: 'delai-non-instrumente',
    label: 'Promesse de délai non instrumentée',
    commercialOnly: true,
    patterns: [
      /r[ée]ponse\s+(?:sous|en)\s+\d+\s*(?:h|heures?|min|minutes?)/i,
      /sous\s+24\s*h(?:eures?)?\b/i,
      /r[ée]ponse\s+imm[ée]diate/i,
    ],
  },
  {
    category: 'nom-enseignant-publie',
    label: "Nom d'enseignant publié (rôles doivent rester abstraits — voir DEBTS.md/publication-decisions.owner.json)",
    commercialOnly: true,
    // Heuristic only: a title (Professeur/Enseignant/Coach/M./Mme) directly
    // followed by two capitalized words. Every match needs human review —
    // this pattern also fires on generic phrasing and must not be trusted
    // as a sole source of truth.
    patterns: [
      /\b(?:Professeur|Enseignant(?:e)?|Coach|M\.|Mme)\s+[A-ZÀ-Ý][a-zà-ÿ]+\s+[A-ZÀ-Ý][a-zà-ÿ]+\b/,
    ],
  },
];

function stripToVisibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

async function fetchRenderedText(path) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'follow' });
  if (!response.ok && response.status !== 404) {
    return { ok: false, status: response.status, text: '', html: '' };
  }
  const html = await response.text();
  return { ok: response.ok, status: response.status, text: stripToVisibleText(html), html };
}

async function main() {
  const pagePaths = discoverPublicPagePaths();
  const findings = [];
  const fetchErrors = [];

  for (const path of pagePaths) {
    const isCommercial = !NON_COMMERCIAL_PATHS.has(path);
    const isLegal = LEGAL_DOCUMENT_PATHS.has(path);

    let result;
    try {
      result = await fetchRenderedText(path);
    } catch (error) {
      fetchErrors.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (!result.ok) {
      fetchErrors.push(`${path}: HTTP ${result.status}`);
      continue;
    }

    if (saveHtmlDir) {
      const capturePath = htmlCapturePath(saveHtmlDir, path);
      mkdirSync(dirname(capturePath), { recursive: true });
      writeFileSync(capturePath, result.html, 'utf8');
    }

    for (const check of CHECKS) {
      if (check.commercialOnly && !isCommercial) continue;
      if (check.excludeLegal && isLegal) continue;

      // Collect every pattern's match first, then drop any match whose range
      // overlaps a match already kept for this (page, category) — several
      // patterns in the same category can match the same underlying phrase
      // (e.g. a specific "Réponse sous Xh" pattern and a generic "sous Xh"
      // one both firing on "Réponse sous 24 h ouvrées"), which must count as
      // ONE occurrence, not one per pattern.
      const rangesKept = [];
      for (const pattern of check.patterns) {
        pattern.lastIndex = 0;
        const match = pattern.exec(result.text);
        if (!match) continue;
        const start = match.index;
        const end = match.index + match[0].length;
        const overlaps = rangesKept.some(([keptStart, keptEnd]) => start < keptEnd && end > keptStart);
        if (overlaps) continue;
        rangesKept.push([start, end]);
        const context = result.text.slice(Math.max(0, start - 60), end + 60);
        findings.push(`${check.category}: ${path}: "${match[0]}" … context: "${context.trim()}"`);
      }
    }
  }

  if (fetchErrors.length > 0) {
    process.stderr.write(`Fetch errors (${fetchErrors.length}):\n${fetchErrors.join('\n')}\n\n`);
  }

  if (findings.length > 0) {
    process.stderr.write(`${findings.length} finding(s):\n${findings.join('\n')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`Public content audit: ${pagePaths.length} pages checked, 0 finding.\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 2;
});
