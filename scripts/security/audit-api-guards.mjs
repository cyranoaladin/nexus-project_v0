#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = process.cwd();
const apiRoot = join(root, 'app/api');
const outPath = join(root, 'docs/security/API_GUARD_INVENTORY.md');

function walk(dir) {
  const entries = readdirSync(dir).sort();
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walk(full));
    if (stat.isFile() && entry === 'route.ts') files.push(full);
  }
  return files;
}

function hasAny(source, patterns) {
  return patterns.some((pattern) => pattern.test(source));
}

function methodsOf(source) {
  const matches = [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE|OPTIONS|HEAD)\b/g)];
  return matches.map((match) => match[1]).join(', ') || '-';
}

function hasRateLimitGuard(source) {
  return hasAny(source, [
    /\bguardRateLimitAsync\s*\(/,
    /\bguardRateLimit\s*\(/,
    /\bcheckRateLimitAsync\s*\(/,
    /\bcheckRateLimit\s*\(/,
    /\brateLimitResponse\s*\(/,
    /\bRateLimitPresets\.[A-Za-z0-9_]+\s*\(/,
    /\bwithRateLimit\s*\(/,
    /\bapplyRateLimit\s*\(/,
    /\bpublicLeadRateLimit\s*\(/,
    /\benforceRateLimit\s*\(/,
  ]);
}

function sourceFor(file) {
  const source = readFileSync(file, 'utf8');
  const reexportMatches = [...source.matchAll(/export\s*\{\s*([^}]+)\s*\}\s*from\s*['"]([^'"]+)['"]/g)];
  if (reexportMatches.length === 0) return source;

  const importedSources = reexportMatches
    .map((match) => {
      const target = resolve(dirname(file), match[2]);
      const candidates = target.endsWith('.ts')
        ? [target]
        : [`${target}.ts`, `${target}/index.ts`];
      for (const candidate of candidates) {
        try {
          return readFileSync(candidate, 'utf8');
        } catch {
          // try next candidate
        }
      }
      return '';
    })
    .filter(Boolean);

  return [source, ...importedSources].join('\n');
}

function riskFor(route, source, dynamic, authGuard, roleGuard, ownership, zod) {
  const sensitivePath = /documents|invoice|billing|payment|bilan|assessment|aria|session|stage|coach|assistante|admin|parent|student|npc|submission|report/i.test(route);
  const mutation = /\b(POST|PATCH|PUT|DELETE)\b/.test(methodsOf(source));
  const staffRolesMatch = source.match(/requireAnyRole\s*\(\s*\[([^\]]*)\]/);
  const hasAdminAndAssistante = staffRolesMatch && /ADMIN/.test(staffRolesMatch[1]) && /ASSISTANTE/.test(staffRolesMatch[1]);
  const staffOnlyRoute = (
    /app\/api\/(admin|assistante)\//.test(route) || hasAdminAndAssistante
  ) && authGuard && roleGuard;
  const fixedPublicDocument = /app\/api\/public-documents\//.test(route) && methodsOf(source) === 'GET' && /const\s+FILE_NAME\b/.test(source);
  const disabledWebhook = /webhook/i.test(route) && /status:\s*501/.test(source) && /NOT_CONFIGURED|not configured|en cours de configuration/i.test(source);
  const deprecatedRoute = /status:\s*410/.test(source);
  const publicStageCatalog = /^app\/api\/stages(\/\[[^\]]+\])?\/route\.ts$/.test(route) && methodsOf(source) === 'GET';
  const staticStudentContent = /app\/api\/student\/automatismes\/series\/\[id\]\/route\.ts/.test(route) && methodsOf(source) === 'GET';

  if (fixedPublicDocument || deprecatedRoute || publicStageCatalog || staticStudentContent) return 'P2';
  if (disabledWebhook) return 'P1';
  if (dynamic && sensitivePath && authGuard && !ownership && !staffOnlyRoute) return 'P0';
  if (sensitivePath && !authGuard) return 'P0';
  if (mutation && sensitivePath && !zod) return 'P1';
  if (sensitivePath && authGuard && !roleGuard && !ownership) return 'P1';
  if (sensitivePath) return 'P2';
  return 'OK';
}

function notesFor(route, source, risk) {
  const notes = [];
  if (route.includes('/admin/')) notes.push('staff/admin');
  if (route.includes('/assistante/')) notes.push('assistante');
  if (route.includes('/coach/')) notes.push('coach');
  if (route.includes('/documents')) notes.push('documents/PII');
  if (/invoice|payment|billing/i.test(route)) notes.push('finance');
  if (/aria/i.test(route)) notes.push('ARIA');
  if (/assessment|bilan|report|submission/i.test(route)) notes.push('pédagogique sensible');
  if (risk === 'P0') notes.push('audit manuel prioritaire');
  if (/auth\(\)/.test(source) && !/require(Role|AnyRole|Auth|FeatureApi)|enforcePolicy/.test(source)) notes.push('guard manuel');
  return notes.join('; ') || '-';
}

const rows = walk(apiRoot).map((file) => {
  const source = sourceFor(file);
  const route = relative(root, file);
  const dynamic = /\[[^\]]+\]/.test(route) ? 'yes' : 'no';
  const authGuard = hasAny(source, [
    /\bauth\s*\(/,
    /\brequireAuth\b/,
    /\brequireRole\b/,
    /\brequireAnyRole\b/,
    /\benforcePolicy\b/,
    /\bgetActor\b/,
  ]) ? 'yes' : 'no';
  const roleGuard = hasAny(source, [
    /\brequireRole\b/,
    /\brequireAnyRole\b/,
    /\benforcePolicy\b/,
    /\bcanPerformStatusAction\b/,
    /\bcan\s*\(\s*role\s*,/,
    /session\.user\.role/,
    /UserRole\./,
  ]) ? 'yes' : 'no';
  const featureGuard = hasAny(source, [/\brequireFeatureApi\b/, /\brequireFeature\b/]) ? 'yes' : 'no';
  const zod = hasAny(source, [/\bzod\b/, /\bz\./, /\.parse\s*\(/, /\.safeParse\s*\(/]) ? 'yes' : 'no';
  const ownership = hasAny(source, [
    /userId\s*:\s*session\.user\.id/,
    /studentId\s*:\s*student\.id/,
    /parentId\s*:\s*session\.user\.id/,
    /coachId\s*:\s*session\.user\.id/,
    /student\s*:\s*\{[^}]*userId\s*:\s*session\.user\.id/s,
    /where\s*:\s*\{[^}]*id\s*:[^}]*userId/s,
    /\bbuildDocumentOwnershipWhere\b/,
    /\bhasDocumentOwnership\b/,
    /\bassertCoachCanAccessStudent\b/,
    /\bisCoachAssignedToStudent\b/,
    /\bcanReadSubmission\b/,
    /\bcanManageSubmissionDocuments\b/,
    /\bauthenticateAndAuthorize\b/,
    /\bverifyStageAccess\b/,
    /\bstageCoach\.findFirst\b/,
    /stage\s*:\s*\{\s*slug\s*:\s*stageSlug\s*\}/,
    /sessionBooking\.coachId\s*!==\s*coachUserId/,
    /sessionBooking\.coachId\s*!==\s*session\.user\.id/,
    /sessionBooking\.studentId\s*!==\s*session\.user\.id/,
    /sessionBooking\.parentId\s*!==\s*session\.user\.id/,
    /\bbuildInvoiceAccessWhere\b/,
    /\bbuildInvoiceScopeWhere\b/,
    /\bbuildAssessmentAccessWhere\b/,
    /\bbuildBilanReadWhere\b/,
    /\bbuildBilanWriteWhere\b/,
    /studentId\s*:\s*\{\s*in\s*:\s*childIds\s*\}/,
    /parentProfile\.findUnique\s*\([^]*userId\s*:\s*sessionOrError\.user\.id/s,
    /\brequireParentOwnsStudent\b/,
    /\brequireParentOwnsInvoice\b/,
    /\brequireCoachAssignedToStudent\b/,
    /\brequireStudentOwnsResource\b/,
    /\benforceOwnership\b/,
    /ownership/i,
  ]) ? 'yes' : 'no';
  const methods = methodsOf(source);
  const risk = riskFor(route, source, dynamic === 'yes', authGuard === 'yes', roleGuard === 'yes', ownership === 'yes', zod === 'yes');
  return { route, methods, dynamic, authGuard, roleGuard, featureGuard, zod, ownership, risk, notes: notesFor(route, source, risk) };
});

const priority = { P0: 0, P1: 1, P2: 2, OK: 3 };
const topRisks = [...rows]
  .sort((a, b) =>
    priority[a.risk] - priority[b.risk] ||
    (a.notes === '-' ? 1 : 0) - (b.notes === '-' ? 1 : 0) ||
    a.route.localeCompare(b.route)
  )
  .slice(0, 20);

const lines = [];
lines.push('# Inventaire initial des guards API');
lines.push('');
lines.push(`Généré le : ${new Date().toISOString()}`);
lines.push('');
lines.push('Lecture statique uniquement. La colonne `Ownership explicit` signale des indices de filtrage propriétaire dans le fichier; elle ne remplace pas un audit manuel IDOR.');
lines.push('');
lines.push('## Synthèse');
lines.push('');
for (const level of ['P0', 'P1', 'P2', 'OK']) {
  lines.push(`- ${level} : ${rows.filter((row) => row.risk === level).length}`);
}
lines.push(`- Total routes : ${rows.length}`);
lines.push('');
lines.push('## 20 routes à auditer en priorité');
lines.push('');
lines.push('| Route | Methods | Risk | Notes |');
lines.push('|---|---|---|---|');
for (const row of topRisks) {
  lines.push(`| \`${row.route}\` | ${row.methods} | ${row.risk} | ${row.notes} |`);
}
lines.push('');
lines.push('## Inventaire complet');
lines.push('');
lines.push('| Route | Methods | Dynamic param | Auth guard | Role guard | Feature guard | Zod | Ownership explicit | Risk | Notes |');
lines.push('|---|---|---|---|---|---|---|---|---|---|');
for (const row of rows) {
  lines.push(`| \`${row.route}\` | ${row.methods} | ${row.dynamic} | ${row.authGuard} | ${row.roleGuard} | ${row.featureGuard} | ${row.zod} | ${row.ownership} | ${row.risk} | ${row.notes} |`);
}
lines.push('');
lines.push('## Prochaines étapes');
lines.push('');
lines.push('- Revoir manuellement toutes les routes P0 dynamiques ou manipulant données personnelles, documents, factures, bilans, conversations et sessions.');
lines.push('- Ajouter des tests IDOR pour chaque route `[id]` qui retourne ou modifie une ressource propriétaire.');
lines.push('- Remplacer les guards manuels hétérogènes par des helpers RBAC/ownership explicites.');

writeFileSync(outPath, `${lines.join('\n')}\n`);
console.log(`Wrote ${relative(root, outPath)} (${rows.length} routes)`);
