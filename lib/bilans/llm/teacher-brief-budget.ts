import { Prisma, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Budget mensuel atomique (§11 de l'incident P0).
 *
 * Le défaut audité : `spentUsd >= budget` était lu SANS verrou avant chaque
 * appel LLM — deux batches concurrents pouvaient chacun lire un solde
 * disponible obsolète et dépasser le plafond ensemble. Ici, réservation ET
 * vérification sont la MÊME instruction SQL (`UPDATE ... WHERE ... <=
 * budget`), atomique par construction : Postgres ne peut pas exécuter deux
 * UPDATE concurrents sur la même ligne sans les sérialiser, donc aucune
 * course n'est possible, sans verrou explicite ni transaction longue.
 */

export class TeacherBriefBudgetError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'TeacherBriefBudgetError';
  }
}

type BudgetDatabase = Pick<PrismaClient, '$queryRaw' | '$executeRaw' | 'teacherBriefMonthlyBudget'>;

function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Crée la ligne du mois si absente (idempotent — `ON CONFLICT DO NOTHING`). */
async function ensureMonthRow(database: BudgetDatabase, month: Date, budgetUsd: number): Promise<void> {
  await database.$executeRaw(Prisma.sql`
    INSERT INTO "canonical_teacher_brief_monthly_budgets" ("monthStart", "budgetUsd")
    VALUES (${month}, ${budgetUsd})
    ON CONFLICT ("monthStart") DO NOTHING
  `);
}

export type BudgetSnapshot = Readonly<{
  monthStart: Date;
  budgetUsd: number;
  spentUsd: number;
  reservedUsd: number;
  availableUsd: number;
}>;

export async function readBudgetSnapshot(
  budgetUsd: number,
  dependencies: Readonly<{ prisma?: BudgetDatabase; now?: () => Date }> = {},
): Promise<BudgetSnapshot> {
  const database = dependencies.prisma ?? prisma;
  const now = (dependencies.now ?? (() => new Date()))();
  const month = monthStart(now);
  await ensureMonthRow(database, month, budgetUsd);
  const row = await database.teacherBriefMonthlyBudget.findUniqueOrThrow({ where: { monthStart: month } });
  const spent = Number(row.spentUsd);
  const reserved = Number(row.reservedUsd);
  return Object.freeze({
    monthStart: month,
    budgetUsd: Number(row.budgetUsd),
    spentUsd: spent,
    reservedUsd: reserved,
    availableUsd: Math.max(0, Number(row.budgetUsd) - spent - reserved),
  });
}

/**
 * Réserve `amountUsd` de façon atomique. Retourne `false` (aucune ligne
 * affectée) si la réservation dépasserait le plafond — jamais d'exception
 * pour un dépassement normal, c'est un repli PLANCHER attendu, pas une
 * panne.
 */
export async function reserveBudget(
  amountUsd: number,
  budgetUsd: number,
  dependencies: Readonly<{ prisma?: BudgetDatabase; now?: () => Date }> = {},
): Promise<boolean> {
  const database = dependencies.prisma ?? prisma;
  const now = (dependencies.now ?? (() => new Date()))();
  const month = monthStart(now);
  await ensureMonthRow(database, month, budgetUsd);
  const affected = await database.$executeRaw(Prisma.sql`
    UPDATE "canonical_teacher_brief_monthly_budgets"
    SET "reservedUsd" = "reservedUsd" + ${amountUsd}
    WHERE "monthStart" = ${month}
      AND "spentUsd" + "reservedUsd" + ${amountUsd} <= "budgetUsd"
  `);
  return affected === 1;
}

/**
 * Régularise une réservation après usage réel connu : libère la réservation
 * et ajoute le coût réel comptabilisé. `actualUsd` peut être `null` quand le
 * coût réel est inconnu (ex. timeout avant réponse du fournisseur) — dans ce
 * cas la réservation est libérée mais RIEN n'est ajouté à `spentUsd` : le
 * coût inconnu reste visible via `costUnknown` sur la tentative journalisée
 * (`TeacherBriefAttempt`), jamais compté à zéro par défaut.
 */
export async function regularizeBudget(
  reservedUsd: number,
  actualUsd: number | null,
  dependencies: Readonly<{ prisma?: BudgetDatabase; now?: () => Date }> = {},
): Promise<void> {
  const database = dependencies.prisma ?? prisma;
  const now = (dependencies.now ?? (() => new Date()))();
  const month = monthStart(now);
  await database.$executeRaw(Prisma.sql`
    UPDATE "canonical_teacher_brief_monthly_budgets"
    SET "reservedUsd" = GREATEST(0, "reservedUsd" - ${reservedUsd}),
        "spentUsd" = "spentUsd" + ${actualUsd ?? 0}
    WHERE "monthStart" = ${month}
  `);
}

/**
 * Libère une réservation sans l'imputer à `spentUsd` — pour une réservation
 * abandonnée AVANT tout appel (ex. bilan devenu STALE_INPUT entre la mise en
 * file et le traitement).
 */
export async function releaseBudget(
  reservedUsd: number,
  dependencies: Readonly<{ prisma?: BudgetDatabase; now?: () => Date }> = {},
): Promise<void> {
  return regularizeBudget(reservedUsd, null, dependencies);
}
