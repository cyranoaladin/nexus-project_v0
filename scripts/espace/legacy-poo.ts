/**
 * Pont vers l'archive historique du TP POO — lecture seule, rattachement manuel.
 *
 *   npx tsx scripts/espace/legacy-poo.ts inventory --db /var/lib/nexus-poo/traces.sqlite3 [--snapshot-out fichier.json]
 *   npx tsx scripts/espace/legacy-poo.ts plan --db <archive> --trace <id>  --student adam.c
 *   npx tsx scripts/espace/legacy-poo.ts plan --db <archive> --alias POO01 --student adam.c
 *   npx tsx scripts/espace/legacy-poo.ts link --db <archive> --trace <id> --student adam.c \
 *        --confirm 'LINK:<id>:adam.c' --as alaeddine --execute
 *
 * La source n'est jamais modifiée. `plan` n'écrit rien. `link` exige l'exécution
 * explicite ET le jeton de confirmation affiché par `plan`. Aucune association
 * n'est jamais déduite d'un nom, d'un alias ou d'un style de code.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { getDocumentStorageRoot } from '@/lib/documents/storage-root';
import { applyLink, planLink, type LinkInput } from '@/lib/espace/legacy/link';
import { LegacyTraceError, openLegacySource, parseLegacyTrace, summarizeTrace } from '@/lib/espace/legacy/reader';
import { prisma } from '@/lib/prisma';

function fail(message: string, code = 1): never {
  process.stderr.write(`ERREUR : ${message}\n`);
  process.exit(code);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({
    args: rest,
    options: {
      db: { type: 'string' },
      trace: { type: 'string' },
      alias: { type: 'string' },
      student: { type: 'string' },
      confirm: { type: 'string' },
      as: { type: 'string' },
      execute: { type: 'boolean', default: false },
      'snapshot-out': { type: 'string' },
    },
  });
  if (!values.db) fail('--db est obligatoire (chemin de l\'archive SQLite)');
  const reader = openLegacySource(values.db);
  const hashBefore = reader.fileSha256();

  try {
    if (command === 'inventory') {
      const rows = reader.list();
      const links = await prisma.espaceLegacyLink.findMany({ select: { legacyTraceId: true, student: { select: { username: true } } } });
      const linked = new Map(links.map((l) => [l.legacyTraceId, l.student.username]));
      process.stdout.write(`archive : ${values.db}\nSHA-256 : ${hashBefore}\ndépôts  : ${rows.length}\n`);
      const snapshot = rows.map((r) => {
        let summary = null;
        let problem: string | null = null;
        try {
          summary = summarizeTrace(parseLegacyTrace(reader.get(r.id)!.payload));
        } catch (e) {
          problem = e instanceof LegacyTraceError ? e.message : 'illisible';
        }
        const status = linked.has(r.id) ? `Associé à ${linked.get(r.id)}` : 'Non associé';
        process.stdout.write(`- ${r.id}  ${r.alias.padEnd(10)} ${r.received}  ${summary ? `${summary.completedSteps}/${summary.requiredSteps}` : '—'}  ${status}${problem ? `  (${problem})` : ''}\n`);
        return { id: r.id, alias: r.alias, groupe: r.groupe, session: r.session, received: r.received, sha: r.sha, summary, problem };
      });
      if (values['snapshot-out'] !== undefined || values['snapshot-out'] === '') {
        const target = values['snapshot-out'] || path.join(getDocumentStorageRoot(), 'espace', 'legacy', 'inventory.json');
        await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
        await writeFile(target, JSON.stringify({ generatedAt: new Date().toISOString(), sourceSha256: hashBefore, count: rows.length, traces: snapshot }, null, 2), { mode: 0o600 });
        process.stdout.write(`instantané (métadonnées, sans contenu) : ${target}\n`);
      }
      return;
    }

    if (command === 'plan' || command === 'link') {
      if (!values.student) fail('--student est obligatoire');
      const input: LinkInput = { traceId: values.trace, alias: values.alias, username: values.student };
      const plan = await planLink(prisma, reader, input);
      if (!plan.ok) {
        process.stderr.write(`REFUSÉ (${plan.refusal}) : ${plan.message}\n`);
        for (const c of plan.candidates ?? []) process.stderr.write(`  candidat : ${c.id}  reçu ${c.received}\n`);
        process.exitCode = 2;
        return;
      }
      process.stdout.write(
        `trace    : ${plan.traceId} (alias ${plan.alias}, reçue ${plan.receivedAt})\n` +
          `élève    : ${plan.student.name} (${plan.student.username})\n` +
          `contenu  : ${plan.summary.completedSteps}/${plan.summary.requiredSteps} étapes renseignées, étape courante ${plan.summary.currentStep}\n` +
          `état     : ${plan.alreadyLinked ? 'déjà rattachée à cet élève (rien à faire)' : 'à rattacher'}\n` +
          `jeton    : ${plan.confirmToken}\n`,
      );
      if (command === 'plan') {
        process.stdout.write('DRY-RUN : aucune écriture.\n');
        return;
      }
      if (!values.execute) fail('--execute est obligatoire pour rattacher');
      if (!values.confirm) fail('--confirm est obligatoire (jeton affiché ci-dessus)');
      if (!values.as) fail('--as <identifiant enseignant> est obligatoire (traçabilité)');
      const actor = await prisma.user.findUnique({ where: { username: values.as }, select: { id: true, role: true } });
      if (!actor || (actor.role !== 'COACH' && actor.role !== 'ADMIN')) fail('--as doit désigner un enseignant existant');
      const result = await applyLink(prisma, reader, input, values.confirm, actor.id);
      process.stdout.write(`OK. ${result.alreadyLinked ? 'Déjà rattachée.' : 'Rattachée.'} Source inchangée : ${result.sourceSha256Before === result.sourceSha256After ? 'oui' : 'NON'}.\n`);
      return;
    }

    fail('Commande inconnue. Utilisez : inventory | plan | link');
  } finally {
    const hashAfter = reader.fileSha256();
    reader.close();
    if (hashAfter !== hashBefore) process.stderr.write('ALERTE : le fichier source a changé pendant l\'exécution.\n');
  }
}

main()
  .catch((e) => {
    process.stderr.write(`ERREUR : ${e instanceof Error ? e.message : 'inconnue'}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
