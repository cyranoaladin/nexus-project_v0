/**
 * Enregistre la validation pédagogique des items du candidat libre.
 *
 * La preuve est **dans les grilles relues** : ce script les lit, il ne demande
 * pas confirmation. Chaque item n'est enregistré que si son verdict est
 * exactement `OK`, et il l'est **au nom du relecteur de sa grille** — jamais au
 * nom de l'opérateur qui lance la commande.
 *
 * Il s'arrête à la première exception plutôt que d'enregistrer une validation
 * partielle : un verdict manquant, `À CORRIGER`, ou un décompte qui ne
 * correspond pas suffit à tout annuler. Valider en bloc à l'aveugle ôterait
 * tout sens à la traçabilité.
 *
 *   npx tsx scripts/diagnostics/record-item-validations.ts --grids <répertoire>
 *   npx tsx scripts/diagnostics/record-item-validations.ts --grids <répertoire> --apply
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

import { CANDIDATE_DIAGNOSTIC_MODULES } from '../../lib/diagnostics/candidat-libre/definition.public';
import { computeItemChecksum } from '../../lib/diagnostics/candidat-libre/item-checksum';

/**
 * Les clés de correction sont lues par analyse du fichier plutôt qu'importées :
 * `answer-key.server.ts` porte `server-only`, qui interdit l'import hors du
 * runtime Next. Le contenu lu est identique.
 */
function loadAnswerKeys(): Record<string, unknown> {
  const file = path.join(process.cwd(), 'lib/diagnostics/candidat-libre/answer-key.server.ts');
  const source = readFileSync(file, 'utf8');
  const start = source.indexOf('{', source.indexOf('CANDIDATE_DIAGNOSTIC_ANSWER_KEYS'));
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(source.slice(start, i + 1)) as Record<string, unknown>;
    }
  }
  throw new Error('ANSWER_KEYS_UNPARSEABLE');
}

/** Qui a réellement relu quoi. Le relecteur enregistré vient d'ici, pas de l'opérateur. */
export const GRID_REVIEWERS: Readonly<Record<string, string>> = Object.freeze({
  'mathematiques': 'cyranoaladin',
  'nsi': 'cyranoaladin',
  'grand-oral': 'cyranoaladin',
  'ses': 'M. Marsani',
  'francais-academique': 'Lamia',
  'tronc-commun': 'Lamia',
});

export const EXPECTED_ITEM_COUNTS: Readonly<Record<string, number>> = Object.freeze({
  'mathematiques': 28,
  'nsi': 26,
  'ses': 22,
  'francais-academique': 24,
  'tronc-commun': 26,
  'grand-oral': 12,
});

export type GridVerdict = Readonly<{ itemId: string; verdict: string; note: string }>;

/** Extrait un verdict par item. Un tableau absent devient un verdict vide, donc bloquant. */
export function parseGrid(markdown: string): readonly GridVerdict[] {
  const blocks = markdown.split(/\n### /).slice(1);
  const out: GridVerdict[] = [];
  for (const block of blocks) {
    const id = /^`([^`]+)`/.exec(block);
    if (!id) continue;
    const table = /\|\s*Verdict\s*\|\s*Remarque\s*\|\s*\n\|[-\s|]+\|\s*\n\|([^|]*)\|([^|]*)\|/.exec(block);
    out.push({
      itemId: id[1],
      verdict: table ? table[1].trim() : '',
      note: table ? table[2].trim() : '',
    });
  }
  return out;
}

type Problem = Readonly<{ moduleKey: string; itemId?: string; detail: string }>;

export function auditGrids(
  read: (moduleKey: string) => string,
): Readonly<{ problems: readonly Problem[]; validated: readonly Readonly<{
  itemId: string; moduleKey: string; reviewerName: string;
}>[] }> {
  const problems: Problem[] = [];
  const validated: { itemId: string; moduleKey: string; reviewerName: string }[] = [];

  for (const [moduleKey, expected] of Object.entries(EXPECTED_ITEM_COUNTS)) {
    let verdicts: readonly GridVerdict[];
    try {
      verdicts = parseGrid(read(moduleKey));
    } catch {
      problems.push({ moduleKey, detail: 'grille illisible ou absente' });
      continue;
    }

    if (verdicts.length !== expected) {
      problems.push({ moduleKey, detail: `${verdicts.length} items lus, ${expected} attendus` });
    }

    const definition = CANDIDATE_DIAGNOSTIC_MODULES.find((m) => m.key === moduleKey);
    const known = new Set((definition?.questions ?? []).map((q) => q.id));

    for (const { itemId, verdict, note } of verdicts) {
      if (!known.has(itemId)) {
        problems.push({ moduleKey, itemId, detail: 'item inconnu de la banque' });
        continue;
      }
      if (verdict === 'OK') {
        validated.push({ itemId, moduleKey, reviewerName: GRID_REVIEWERS[moduleKey] });
        continue;
      }
      problems.push({
        moduleKey,
        itemId,
        detail: verdict === '' ? 'verdict manquant' : `verdict « ${verdict} »${note ? ` — ${note}` : ''}`,
      });
    }
  }

  return { problems, validated };
}

async function main(): Promise<void> {
  const gridsIndex = process.argv.indexOf('--grids');
  if (gridsIndex === -1 || !process.argv[gridsIndex + 1]) {
    process.stderr.write('Usage : --grids <répertoire> [--apply]\n');
    process.exitCode = 2;
    return;
  }
  const gridsDir = process.argv[gridsIndex + 1];
  const apply = process.argv.includes('--apply');

  const { problems, validated } = auditGrids((moduleKey) =>
    readFileSync(path.join(gridsDir, `${moduleKey}.md`), 'utf8'));

  if (problems.length > 0) {
    process.stderr.write(`GATE FERMÉ — ${problems.length} exception(s), rien n'est enregistré :\n`);
    for (const p of problems) {
      process.stderr.write(`  - ${p.moduleKey}${p.itemId ? `/${p.itemId}` : ''} : ${p.detail}\n`);
    }
    process.exitCode = 1;
    return;
  }

  const byReviewer = validated.reduce<Record<string, number>>((acc, v) => {
    acc[v.reviewerName] = (acc[v.reviewerName] ?? 0) + 1;
    return acc;
  }, {});
  process.stdout.write(`${apply ? 'ENREGISTREMENT' : 'SIMULATION'} — ${validated.length} items validés\n`);
  for (const [reviewer, count] of Object.entries(byReviewer)) {
    process.stdout.write(`  ${reviewer} : ${count}\n`);
  }

  if (!apply) {
    process.stdout.write("\nAucune écriture. Relancer avec --apply pour enregistrer.\n");
    return;
  }

  const answerKeys = loadAnswerKeys();
  const prisma = new PrismaClient();
  try {
    for (const item of validated) {
      const definition = CANDIDATE_DIAGNOSTIC_MODULES.find((m) => m.key === item.moduleKey);
      const question = definition?.questions.find((q) => q.id === item.itemId);
      if (!question) throw new Error(`ITEM_INTROUVABLE:${item.itemId}`);
      const itemChecksum = computeItemChecksum(
        question as never,
        answerKeys[item.itemId],
      );
      await prisma.candidateDiagnosticItemValidation.upsert({
        where: { itemId: item.itemId },
        create: { ...item, itemChecksum },
        update: { reviewerName: item.reviewerName, itemChecksum, validatedAt: new Date() },
      });
    }
    process.stdout.write(`\n${validated.length} validations enregistrées.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
