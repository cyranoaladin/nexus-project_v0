import { PrismaClient } from '@prisma/client';
import { assertDisposableE2eDatabase } from './disposable-database';

const DATABASE_URL = process.env.E2E_DATABASE_URL ?? process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('[E2E] E2E_DATABASE_URL, TEST_DATABASE_URL, or DATABASE_URL must be set — no hardcoded fallback.');
}

assertDisposableE2eDatabase(DATABASE_URL);

let prisma: PrismaClient | null = null;
function getPrisma() {
  if (!prisma) prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  return prisma;
}

export async function getProfilCandidatById(id: string) {
  return getPrisma().profilCandidat.findUnique({ where: { id } });
}

export async function countProfilsCandidatsByStudentOrDefault() {
  return getPrisma().profilCandidat.count();
}

export async function getQuoteWithLines(id: string) {
  return getPrisma().quote.findUnique({ where: { id }, include: { lines: true } });
}

export async function countQuotesByProfilId(profilId: string) {
  return getPrisma().quote.count({ where: { profilId } });
}

export async function disconnectCandidatIndividuelDb() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
