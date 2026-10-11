/**
 * Provisioning de l'espace pédagogique (comptes, groupes, inscriptions).
 *
 *   npx tsx scripts/espace/provision.ts apply --roster liste.json                       # dry-run
 *   npx tsx scripts/espace/provision.ts apply --roster liste.json --execute --credentials-out /chemin/hors/depot/codes.txt
 *     (codes émis TEMPORAIRES : l'élève choisit le sien à la première connexion ; --keep-codes pour les rendre définitifs)
 *   npx tsx scripts/espace/provision.ts reset-pin --username adam.c --execute --credentials-out /chemin/codes.txt
 *   npx tsx scripts/espace/provision.ts disable   --username adam.c --execute
 *   npx tsx scripts/espace/provision.ts audit-activities                                # preflight : catalogue code ↔ base (lecture seule, code 1 si écart)
 *   npx tsx scripts/espace/provision.ts audit-accounts [--credentials /chemin/codes.txt]...   # état de connexion de TOUS les élèves (lecture seule ; les codes fournis ne sont jamais réaffichés)
 *   npx tsx scripts/espace/provision.ts sync-activities [--execute]                     # miroir DB du catalogue (nouveau parcours)
 *   npx tsx scripts/espace/provision.ts enable-technical --username val.b --execute --credentials-out /chemin/codes.txt   # réactive un compte val.* (jamais un vrai compte)
 *
 * Dry-run par défaut. Les codes personnels ne sont JAMAIS affichés : ils sont
 * écrits une seule fois dans un fichier 0600 créé hors du dépôt.
 */
import { readFileSync } from 'node:fs';
import { open, rm } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { prisma } from '@/lib/prisma';
import { formatPin } from '@/lib/espace/pin';
import {
  applyProvisioning,
  auditAccounts,
  auditActivities,
  disableAccount,
  enableTechnicalAccount,
  parseIssuedCredentialsFile,
  parseRoster,
  planProvisioning,
  resetStudentPin,
  syncActivities,
  type IssuedCredential,
} from '@/lib/espace/provisioning';
import { ACTIVITIES } from '@/lib/espace/catalog';

function fail(message: string): never {
  process.stderr.write(`ERREUR : ${message}\n`);
  process.exit(1);
}

async function openCredentialsFile(target: string | undefined) {
  if (!target) fail('--credentials-out est obligatoire avec --execute (fichier hors dépôt)');
  const resolved = path.resolve(target);
  if (resolved.startsWith(process.cwd() + path.sep)) fail('Le fichier de codes ne doit pas être dans le dépôt');
  // 'wx' : refuse d'écraser ; 0600 : lisible par le seul propriétaire.
  return { handle: await open(resolved, 'wx', 0o600), resolved };
}

async function writeCredentials(file: Awaited<ReturnType<typeof openCredentialsFile>>, list: IssuedCredential[]) {
  const lines = list.map((c) => `${c.displayName ?? ''};${c.username};${c.kind === 'ELEVE' ? formatPin(c.secret) : c.secret}`);
  await file.handle.writeFile(`# nom;identifiant;code personnel (élève) ou mot de passe initial (enseignant créé) — à transmettre hors dépôt puis détruire\n${lines.join('\n')}\n`);
  await file.handle.close();
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({
    args: rest,
    options: {
      roster: { type: 'string' },
      username: { type: 'string' },
      adopt: { type: 'boolean', default: false },
      // Par défaut les codes émis sont TEMPORAIRES (l'élève choisit le sien à la première connexion).
      'keep-codes': { type: 'boolean', default: false },
      execute: { type: 'boolean', default: false },
      'credentials-out': { type: 'string' },
      credentials: { type: 'string', multiple: true },
      'include-validation': { type: 'boolean', default: false },
    },
  });

  if (command === 'apply') {
    if (!values.roster) fail('--roster est obligatoire');
    const roster = parseRoster(JSON.parse(readFileSync(values.roster, 'utf8')));
    const plan = await planProvisioning(prisma, roster, { adopt: values.adopt });

    for (const u of plan.users) process.stdout.write(`${u.action.padEnd(17)} ${u.kind.padEnd(5)} ${u.username.padEnd(16)} ${u.firstName} ${u.lastName}${u.reason ? `  — ${u.reason}` : ''}\n`);
    process.stdout.write(`groupes à créer : ${plan.groupsToCreate.length} · inscriptions visées : ${plan.enrollmentsToCreate} · affectations visées : ${plan.assignmentsToCreate} (les lignes déjà présentes sont ignorées) · conflits : ${plan.conflicts.length}\n`);

    if (!values.execute) {
      process.stdout.write('DRY-RUN : aucune écriture. Relancez avec --execute pour appliquer.\n');
      return;
    }
    if (plan.conflicts.length > 0) fail('Conflits non résolus : rien n\'a été écrit');
    const file = await openCredentialsFile(values['credentials-out']);
    try {
      const { credentials } = await applyProvisioning(prisma, roster, { adopt: values.adopt, temporaryCodes: !values['keep-codes'] });
      await writeCredentials(file, credentials);
      process.stdout.write(`OK. ${credentials.length} code(s) émis dans ${file.resolved} (0600). Transmettez-les hors dépôt puis détruisez le fichier.\n`);
    } catch (e) {
      await file.handle.close().catch(() => undefined);
      await rm(file.resolved, { force: true });
      throw e;
    }
    return;
  }

  if (command === 'reset-pin') {
    if (!values.username) fail('--username est obligatoire');
    if (!values.execute) {
      process.stdout.write(`DRY-RUN : le code de ${values.username} serait réinitialisé et ses sessions révoquées. Ajoutez --execute.\n`);
      return;
    }
    const file = await openCredentialsFile(values['credentials-out']);
    const issued = await resetStudentPin(prisma, values.username);
    await writeCredentials(file, [issued]);
    process.stdout.write(`OK. Nouveau code écrit dans ${file.resolved} (0600).\n`);
    return;
  }

  if (command === 'disable') {
    if (!values.username) fail('--username est obligatoire');
    if (!values.execute) {
      process.stdout.write(`DRY-RUN : ${values.username} serait désactivé et ses sessions révoquées. Ajoutez --execute.\n`);
      return;
    }
    await disableAccount(prisma, values.username);
    process.stdout.write('OK. Compte désactivé, sessions révoquées.\n');
    return;
  }


  if (command === 'audit-accounts') {
    // Lecture seule : aucun code n'est affiché ; ceux des fichiers fournis ne servent qu'à une comparaison bcrypt.
    const issued = new Map<string, string>();
    // Fichiers fournis du plus ancien au plus récent : une réémission (reset) remplace le code précédent.
    for (const file of values.credentials ?? []) parseIssuedCredentialsFile(readFileSync(file, 'utf8'), path.basename(file), issued, { override: true });
    const { rows, unknownIssued } = await auditAccounts(prisma, issued);
    const shown = values['include-validation'] ? rows : rows.filter((r) => !r.validation);
    const order = ['CODE_EMIS_PERIME', 'SANS_CODE', 'DESACTIVE', 'JAMAIS_CONNECTE', 'CODE_CHANGE_PAR_ELEVE', 'CODE_EMIS_ACTIF', 'CODE_NON_FOURNI'] as const;
    for (const verdict of order) {
      const group = shown.filter((r) => r.verdict === verdict);
      if (group.length === 0) continue;
      process.stdout.write(`\n${verdict} (${group.length})\n`);
      for (const r of group) {
        const seance = r.publishedSessions > 0 ? ` · ${r.publishedSessions} séance(s) publiée(s)` : '';
        const setAt = r.pinSetAt ? ` · code posé le ${r.pinSetAt.toISOString().slice(0, 10)}` : '';
        process.stdout.write(`  ${r.username.padEnd(18)} ${r.displayName.padEnd(24)} ${r.enrollments.join(', ')}${seance}${setAt}\n`);
      }
    }
    for (const u of unknownIssued) process.stdout.write(`\nAVERTISSEMENT identifiant du fichier sans compte : ${u}\n`);
    const problems = shown.filter((r) => r.verdict === 'CODE_EMIS_PERIME' || r.verdict === 'SANS_CODE').length;
    process.stdout.write(`\n${shown.length} compte(s) élève · PROBLEMES=${problems} (CODE_EMIS_PERIME ou SANS_CODE)\n`);
    if (problems > 0 || unknownIssued.length > 0) process.exitCode = 1;
    return;
  }

  if (command === 'audit-activities') {
    const audit = await auditActivities(prisma);
    for (const w of audit.warnings) process.stdout.write(`AVERTISSEMENT ${w}\n`);
    for (const e of audit.errors) process.stdout.write(`ERREUR ${e}\n`);
    process.stdout.write(audit.errors.length === 0 ? 'CATALOGUE_DB_SYNC=PASS (aucun écart bloquant)\n' : `CATALOGUE_DB_SYNC=FAIL (${audit.errors.length} écart(s))\n`);
    if (audit.errors.length > 0) process.exitCode = 1;
    return;
  }

  if (command === 'enable-technical') {
    if (!values.username) fail('--username est obligatoire');
    if (!values.execute) {
      process.stdout.write(`DRY-RUN : le compte technique ${values.username} serait réactivé avec de nouveaux identifiants (réservé à val.*). Ajoutez --execute.\n`);
      return;
    }
    const file = await openCredentialsFile(values['credentials-out']);
    try {
      const issued = await enableTechnicalAccount(prisma, values.username);
      await writeCredentials(file, [issued]);
      process.stdout.write(`OK. ${values.username} réactivé ; identifiants écrits dans ${file.resolved} (0600). Refermer avec disable.\n`);
    } catch (e) {
      await file.handle.close().catch(() => undefined);
      await rm(file.resolved, { force: true });
      throw e;
    }
    return;
  }

  if (command === 'sync-activities') {
    // Le contenu reste dans le code ; la base ne porte qu'un miroir (clés étrangères des travaux). Un nouveau parcours
    // publié dans le code exige donc cette ligne avant la première ouverture par un élève. Idempotent, sans suppression.
    const present = new Set((await prisma.espaceActivity.findMany({ select: { slug: true } })).map((a) => a.slug));
    for (const a of ACTIVITIES) process.stdout.write(`${present.has(a.slug) ? 'présente ' : 'À CRÉER  '} ${a.slug}  (${a.stepsTotal} étapes, v${a.contentVersion})\n`);
    if (!values.execute) {
      process.stdout.write('DRY-RUN : aucune écriture. Ajoutez --execute pour synchroniser le miroir.\n');
      return;
    }
    const count = await syncActivities(prisma);
    process.stdout.write(`OK. ${count} activité(s) synchronisée(s) (création ou mise à jour des titres et du nombre d’étapes).\n`);
    return;
  }

  fail('Commande inconnue. Utilisez : apply | reset-pin | disable | enable-technical | audit-activities | sync-activities');
}

main()
  .catch((e) => {
    process.stderr.write(`ERREUR : ${e instanceof Error ? e.message : 'inconnue'}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
