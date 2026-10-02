/**
 * Provisioning de l'espace pédagogique (comptes, groupes, inscriptions).
 *
 *   npx tsx scripts/espace/provision.ts apply --roster liste.json                       # dry-run
 *   npx tsx scripts/espace/provision.ts apply --roster liste.json --execute --credentials-out /chemin/hors/depot/codes.txt
 *   npx tsx scripts/espace/provision.ts reset-pin --username adam.c --execute --credentials-out /chemin/codes.txt
 *   npx tsx scripts/espace/provision.ts disable   --username adam.c --execute
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
  disableAccount,
  parseRoster,
  planProvisioning,
  resetStudentPin,
  type IssuedCredential,
} from '@/lib/espace/provisioning';

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
  const lines = list.map((c) => `${c.username};${c.kind === 'ELEVE' ? formatPin(c.secret) : c.secret}`);
  await file.handle.writeFile(`# username;secret — à transmettre hors dépôt puis détruire\n${lines.join('\n')}\n`);
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
      execute: { type: 'boolean', default: false },
      'credentials-out': { type: 'string' },
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
      const { credentials } = await applyProvisioning(prisma, roster, { adopt: values.adopt });
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

  fail('Commande inconnue. Utilisez : apply | reset-pin | disable');
}

main()
  .catch((e) => {
    process.stderr.write(`ERREUR : ${e instanceof Error ? e.message : 'inconnue'}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
