/**
 * Génère `types/enums.ts` à partir de `prisma/schema.prisma`.
 *
 * ── Pourquoi ce générateur existe ────────────────────────────────────────────
 * `types/enums.ts` se présentait comme un miroir des enums Prisma, maintenu à
 * la main. Il avait dérivé sans que rien ne le signale : `GradeLevel` avait
 * perdu `QUATRIEME`, `Subject` avait perdu `MATHS_EXPERTES`. Le code client
 * consommant ce miroir voyait donc une réalité scolaire fausse.
 *
 * Le miroir est désormais GÉNÉRÉ, et `npm run enums:check` échoue si le
 * fichier committé diffère de ce que produit le schéma.
 *
 * Usage :
 *   npx tsx scripts/codegen/generate-client-enums.ts           (écrit)
 *   npx tsx scripts/codegen/generate-client-enums.ts --check   (vérifie)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SCHEMA_PATH = path.join(process.cwd(), 'prisma/schema.prisma');
const OUTPUT_PATH = path.join(process.cwd(), 'types/enums.ts');

/**
 * Enums réellement nécessaires aux composants client.
 *
 * C'est une liste EXPLICITE et non « tous les enums » : le bundle client n'a
 * pas à embarquer les 65 enums du schéma. Ajouter une entrée ici est un acte
 * délibéré ; en retirer une aussi.
 */
const MIRRORED_ENUMS = [
  { name: 'UserRole', section: null },
  { name: 'SubscriptionStatus', section: null },
  { name: 'ServiceType', section: null },
  { name: 'Subject', section: null },
  { name: 'GradeLevel', section: null },
  { name: 'AcademicTrack', section: null },
  { name: 'StmgPathway', section: null },
  { name: 'SessionStatus', section: null },
  { name: 'PaymentType', section: null },
  { name: 'PaymentStatus', section: null },
  { name: 'CopySubmissionStatus', section: 'NPC — NEXUS PEDAGOGY COCKPIT' },
  { name: 'AssessmentSourceType', section: null },
  { name: 'CopyPageStatus', section: null },
  { name: 'AiJobType', section: null },
  { name: 'AiJobStatus', section: null },
  { name: 'AiJobPriority', section: null },
  { name: 'PedagogicalReportStatus', section: null },
  { name: 'ReportVisibility', section: null },
  { name: 'FeedbackType', section: null },
] as const;

/** Extrait les membres d'un enum du schéma Prisma. */
function parseEnumMembers(schema: string, enumName: string): string[] {
  const pattern = new RegExp(`^enum\\s+${enumName}\\s*\\{([^}]*)\\}`, 'm');
  const match = schema.match(pattern);
  if (!match) {
    throw new Error(
      `Enum "${enumName}" absent de prisma/schema.prisma. ` +
        'Retirez-le de MIRRORED_ENUMS ou corrigez le schéma.',
    );
  }

  return match[1]
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter((line) => line.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(line));
}

function render(schema: string): string {
  const lines: string[] = [
    '// ⚠️  FICHIER GÉNÉRÉ — NE PAS ÉDITER À LA MAIN.',
    '//',
    '// Source de vérité : prisma/schema.prisma',
    '// Régénérer      : npm run enums:generate',
    '// Vérifier       : npm run enums:check  (échoue si ce fichier a dérivé)',
    '//',
    "// Ces enums sont des miroirs client : ils permettent aux composants 'use client'",
    "// d'utiliser les valeurs d'enum sans importer @prisma/client dans le bundle.",
    '',
  ];

  for (const entry of MIRRORED_ENUMS) {
    const members = parseEnumMembers(schema, entry.name);
    if (members.length === 0) {
      throw new Error(`Enum "${entry.name}" est vide dans le schéma Prisma.`);
    }

    if (entry.section) {
      lines.push(
        '// ═══════════════════════════════════════════════════════════════════════════════',
        `// ${entry.section}`,
        '// ═══════════════════════════════════════════════════════════════════════════════',
        '',
      );
    }

    lines.push(`export enum ${entry.name} {`);
    lines.push(...members.map((member) => `  ${member} = '${member}',`));
    lines.push('}', '');
  }

  return lines.join('\n');
}

function main(): void {
  const schema = readFileSync(SCHEMA_PATH, 'utf-8');
  const generated = render(schema);
  const checkOnly = process.argv.includes('--check');

  if (!checkOnly) {
    writeFileSync(OUTPUT_PATH, generated);
    console.log(`✓ types/enums.ts généré (${MIRRORED_ENUMS.length} enums miroir)`);
    return;
  }

  const current = readFileSync(OUTPUT_PATH, 'utf-8');
  if (current === generated) {
    console.log(`ENUM_SYNC_CHECK=PASS (${MIRRORED_ENUMS.length} enums miroir alignés)`);
    return;
  }

  console.error('ENUM_SYNC_CHECK=FAIL');
  console.error('types/enums.ts a dérivé de prisma/schema.prisma.');
  console.error('Corrigez avec : npm run enums:generate');

  // Diff lisible : montrer les enums dont les membres diffèrent.
  for (const entry of MIRRORED_ENUMS) {
    const expected = parseEnumMembers(schema, entry.name);
    const block = current.match(
      new RegExp(`export enum ${entry.name} \\{([^}]*)\\}`, 'm'),
    );
    const actual = block
      ? block[1]
          .split('\n')
          .map((line) => line.trim().split('=')[0].trim())
          .filter(Boolean)
      : [];

    const missing = expected.filter((member) => !actual.includes(member));
    const extra = actual.filter((member) => !expected.includes(member));
    if (missing.length > 0 || extra.length > 0) {
      console.error(
        `  ${entry.name}: manquants=[${missing.join(', ')}] en trop=[${extra.join(', ')}]`,
      );
    }
  }

  process.exit(1);
}

main();
