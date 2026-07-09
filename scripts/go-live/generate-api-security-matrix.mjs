#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const inventoryPath = join(root, 'docs/security/API_GUARD_INVENTORY.md');
const outPath = join(root, 'docs/go-live/api-security-matrix.full.md');

const inventory = readFileSync(inventoryPath, 'utf8');

const fullInventory = inventory.split('## Inventaire complet')[1] ?? '';

const rows = fullInventory
  .split('\n')
  .filter((line) => line.startsWith('| `app/api/') && line.includes('/route.ts` |'))
  .map((line) => {
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    const routeFile = cells[0].replace(/`/g, '');
    return {
      routeFile,
      route: `/${routeFile.replace(/^app\//, '').replace(/\/route\.ts$/, '')}`,
      methods: cells[1],
      dynamic: cells[2],
      authGuard: cells[3],
      roleGuard: cells[4],
      featureGuard: cells[5],
      zod: cells[6],
      ownershipDetected: cells[7],
      priority: cells[8],
      notes: cells[9] || '-',
    };
  });

const domainRules = [
  [/invoice|facturation|billing/i, 'Facturation'],
  [/payment|clictopay/i, 'Paiement'],
  [/document|pdf|files/i, 'Documents'],
  [/bilan|assessment|diagnostic|report/i, 'Bilans/assessments'],
  [/aria|rag/i, 'ARIA/RAG'],
  [/npc|submission|upload/i, 'NPC'],
  [/stage/i, 'Stages'],
  [/admin/i, 'Admin'],
  [/assistante/i, 'Assistante'],
  [/coach/i, 'Coach'],
  [/parent/i, 'Parent'],
  [/student|eleve/i, 'Élève'],
  [/auth|activate|reset-password/i, 'Auth'],
  [/contact|newsletter|notify/i, 'Leads/messages'],
];

const sensitiveRules = [
  [/invoice|payment|billing|facturation/i, 'Facture/paiement'],
  [/document|pdf|files|upload/i, 'Document/fichier'],
  [/bilan|assessment|diagnostic|report|submission/i, 'Données pédagogiques mineur'],
  [/aria|conversation|message/i, 'Conversation IA'],
  [/student|eleve|parent|coach|assistante|admin|user/i, 'PII/utilisateur'],
  [/stage|reservation|session/i, 'Réservation/session'],
  [/contact|newsletter|notify/i, 'Lead/contact'],
];

const p0DomainOrder = [
  'Documents',
  'Facturation',
  'Paiement',
  'Bilans/assessments',
  'NPC',
  'Coach',
  'Stages',
  'Assistante',
  'Auth',
  'ARIA/RAG',
  'Admin',
  'Parent',
  'Élève',
  'Leads/messages',
];

function escapeCell(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\s+/g, ' ')
    .trim();
}

function domainFor(route, notes) {
  const haystack = `${route} ${notes}`;
  return domainRules.find(([pattern]) => pattern.test(haystack))?.[1] ?? 'Autre';
}

function sensitiveFor(route, notes) {
  const haystack = `${route} ${notes}`;
  const labels = sensitiveRules
    .filter(([pattern]) => pattern.test(haystack))
    .map(([, label]) => label);
  return labels.length ? [...new Set(labels)].join(', ') : 'À vérifier';
}

function publicAuthFor(row) {
  if (row.authGuard === 'yes') return 'Auth';
  if (/webhook/i.test(row.route)) return 'Public webhook';
  if (/contact|newsletter|notify|bilan-gratuit$|stages\/\[stageSlug\]\/inscrire|assessments\/submit|public-documents|student\/activate/i.test(row.route)) {
    return 'Public';
  }
  return 'Public/À vérifier';
}

function roleFor(row) {
  const route = row.route;
  if (row.roleGuard !== 'yes') return row.authGuard === 'yes' ? 'À vérifier' : 'N/A';
  if (/\/admin\//.test(route)) return 'Admin/staff';
  if (/\/assistante\//.test(route)) return 'Assistante';
  if (/\/coach\//.test(route)) return 'Coach';
  if (/\/parent\//.test(route)) return 'Parent';
  if (/\/student\/|\/eleve\//.test(route)) return 'Élève';
  if (/\/aria\//.test(route)) return 'Élève/abonné à vérifier';
  return 'Rôle détecté, à qualifier';
}

function ownershipRequired(row, domain, sensitiveData) {
  if (row.dynamic === 'yes') return 'Oui';
  if (row.authGuard === 'yes' && /Document|Facture|paiement|Données pédagogiques|Conversation|PII|Réservation/.test(sensitiveData)) {
    return 'Oui';
  }
  if (row.publicAuth.startsWith?.('Public')) return 'N/A';
  if (['Admin', 'Leads/messages', 'Autre'].includes(domain)) return 'À vérifier';
  return 'À vérifier';
}

function rateLimitDetected(routeFile) {
  const full = join(root, routeFile);
  if (!existsSync(full)) return 'À vérifier';
  const source = readFileSync(full, 'utf8');
  return (
    /\bguardRateLimitAsync\s*\(/.test(source) ||
    /\bguardRateLimit\s*\(/.test(source) ||
    /\bcheckRateLimitAsync\s*\(/.test(source) ||
    /\bcheckRateLimit\s*\(/.test(source) ||
    /\brateLimitResponse\s*\(/.test(source) ||
    /\bRateLimitPresets\.[A-Za-z0-9_]+\s*\(/.test(source) ||
    /\bwithRateLimit\s*\(/.test(source) ||
    /\bapplyRateLimit\s*\(/.test(source) ||
    /\bpublicLeadRateLimit\s*\(/.test(source) ||
    /\benforceRateLimit\s*\(/.test(source)
  )
    ? 'Oui'
    : 'Non';
}

function actionFor(row, domain, rateLimit) {
  if (row.priority === 'OK') return 'Maintenir tests de non-régression';
  if (row.priority === 'P0') {
    if (domain === 'Paiement') return 'Lot 1/4 : signature, idempotence, auth et non-exposition publique';
    if (domain === 'Facturation') return 'Lot 1 : ownership facture/PDF + tests IDOR';
    if (domain === 'Documents') return 'Lot 1 : ownership strict, path no-leak, tests IDOR';
    if (domain === 'Bilans/assessments') return 'Lot 1 : auth/token signé + ownership résultats';
    if (domain === 'NPC') return 'Lot 1 : traversal + ownership soumission/document';
    if (domain === 'Stages') return 'Lot 1 : scope stage, role staff, anti-spam public';
    if (domain === 'Coach') return 'Lot 1 : assignment actif obligatoire';
    if (domain === 'Assistante') return 'Lot 1 : périmètre assistante + audit IDOR';
    if (domain === 'Auth') return 'Lot 1 : token, expiration, rate limit';
    if (rateLimit === 'Non' && publicAuthFor(row).startsWith('Public')) return 'Lot 1 : ajouter rate limit public';
    return 'Lot 1 : audit manuel prioritaire + tests IDOR';
  }
  if (row.priority === 'P1') return 'Durcir avant bêta élargie';
  if (row.priority === 'PUBLIC') {
    return rateLimit === 'Non' ? 'Ajouter rate limit public' : 'Maintenir tests de non-régression';
  }
  return 'Suivi qualité P2';
}

const enriched = rows.map((row) => {
  const domain = domainFor(row.route, row.notes);
  const sensitiveData = sensitiveFor(row.route, row.notes);
  const publicAuth = publicAuthFor(row);
  const ownershipRequiredValue = ownershipRequired({ ...row, publicAuth }, domain, sensitiveData);
  const rateLimit = rateLimitDetected(row.routeFile);
  return {
    ...row,
    domain,
    sensitiveData,
    publicAuth,
    roleRequired: roleFor(row),
    ownershipRequired: ownershipRequiredValue,
    rateLimit,
    action: actionFor(row, domain, rateLimit),
  };
});

const counts = ['P0', 'P1', 'PUBLIC', 'P2', 'OK'].map((priority) => [
  priority,
  enriched.filter((row) => row.priority === priority).length,
]);

const topPriority = enriched.some((row) => row.priority === 'P0') ? 'P0' : 'P1';
const top20 = enriched
  .filter((row) => row.priority === topPriority)
  .sort((a, b) => {
    const domainDelta = p0DomainOrder.indexOf(a.domain) - p0DomainOrder.indexOf(b.domain);
    if (domainDelta !== 0) return domainDelta;
    return a.route.localeCompare(b.route);
  })
  .slice(0, 20);

const lines = [];
lines.push('# Annexe matrice API sécurité complète');
lines.push('');
lines.push(`Source : \`${inventoryPath.replace(`${root}/`, '')}\`.`);
lines.push(`Généré le : ${new Date().toISOString()}.`);
lines.push('');
lines.push('Lecture statique uniquement : `Auth guard détecté`, `Role guard détecté`, `Zod détecté` et `Ownership requis` sont des indices de pilotage. `À vérifier` signifie qu’aucune preuve suffisante n’a été établie dans ce lot.');
lines.push('');
lines.push('## Synthèse');
lines.push('');
lines.push('| Priorité | Nombre |');
lines.push('| --- | ---: |');
for (const [priority, count] of counts) lines.push(`| ${priority} | ${count} |`);
lines.push(`| Total | ${enriched.length} |`);
lines.push('');
lines.push(`## Top 20 à corriger en priorité (${topPriority})`);
lines.push('');
lines.push('| Priorité | Route | Domaine | Risque dominant | Action Lot suivant |');
lines.push('| --- | --- | --- | --- | --- |');
for (const row of top20) {
  lines.push(`| ${row.priority} | \`${row.route}\` | ${row.domain} | ${escapeCell(row.sensitiveData)} | ${escapeCell(row.action)} |`);
}
lines.push('');
lines.push('## Matrice route par route');
lines.push('');
lines.push('| Priorité | Route | Méthodes | Domaine | Public/Auth | Rôle requis | Ownership requis | Auth guard détecté | Role guard détecté | Zod détecté | Rate limit détecté | Données sensibles | Action Lot suivant |');
lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const row of enriched) {
  lines.push([
    row.priority,
    `\`${row.route}\``,
    row.methods,
    row.domain,
    row.publicAuth,
    row.roleRequired,
    row.ownershipRequired,
    row.authGuard === 'yes' ? 'Oui' : 'Non',
    row.roleGuard === 'yes' ? 'Oui' : 'Non',
    row.zod === 'yes' ? 'Oui' : 'Non',
    row.rateLimit,
    row.sensitiveData,
    row.action,
  ].map(escapeCell).join(' | ').replace(/^/, '| ').concat(' |'));
}
lines.push('');
lines.push('## Limites');
lines.push('');
lines.push('- Les guards détectés proviennent de motifs statiques ; ils ne prouvent pas l’absence d’IDOR.');
lines.push('- Le rate limiting est détecté par motifs de code locaux ; une protection middleware, reverse proxy ou provider externe reste `À vérifier` sans preuve runtime.');
lines.push('- Les routes `OK` ne sont pas déclarées go-live ready ; elles sont seulement moins prioritaires dans l’inventaire statique.');

writeFileSync(outPath, `${lines.join('\n')}\n`);
console.log(`Wrote ${outPath.replace(`${root}/`, '')} (${enriched.length} routes)`);
console.log(counts.map(([priority, count]) => `${priority}: ${count}`).join(', '));
