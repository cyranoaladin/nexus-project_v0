#!/usr/bin/env -S npx tsx
/**
 * #273 account-deletion FK deletion-policy contract — DB ground truth vs
 * checked-in manifest.
 *
 * Replaces the prior one-off flow (a manually pasted `/tmp/fk_final_ground_truth.tsv`
 * plus scripts/db/build-fk-classification.mjs run by hand). This script IS
 * the generator/checker: it queries `pg_constraint` directly against a real,
 * fully-migrated Postgres for the exact, current, live set of foreign keys
 * pointing at users/students/parent_profiles/coach_profiles, normalizes them,
 * and compares against the checked-in manifest
 * (data/security/account-deletion-fk-manifest.json) — the single reviewed
 * source of truth for each FK's BUSINESS classification and expected
 * `ON DELETE` action.
 *
 * Required gate (all must hold for exit 0):
 *   DB_FKS == MANIFEST_FKS   (every FK constraint name matches, both ways)
 *   UNCLASSIFIED = 0         (every manifest entry has a valid category)
 *   STALE_MANIFEST = 0       (no manifest entry lacks a matching live DB constraint)
 *   MISSING_MANIFEST = 0     (no live DB constraint lacks a manifest entry)
 *   DUPLICATE_CONNAME = 0    (no constraint name appears twice in the manifest)
 *   ON_DELETE_MISMATCH = 0   (manifest's expected action matches the DB's live action)
 *   TOTAL == SUM(categories) (structural — computed from the same data, so
 *                             this can only fail if the script itself has a
 *                             bug, not from manual arithmetic drift)
 *
 * Usage: DATABASE_URL=postgresql://... npx tsx scripts/db/check-account-deletion-fk-manifest.ts
 * (assumes the target database is already fully migrated — this script does
 * not run migrations itself, matching how it is wired into the "Real DB
 * Integration" CI job, which migrates before this step runs.)
 *
 * Or: npm run db:check-account-deletion-fk-manifest
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const CATEGORIES = [
  'PURE_MEMBERSHIP_CASCADE_ALLOWED',
  'EPHEMERAL_CASCADE_ALLOWED',
  'HISTORICAL_RESTRICT',
  'FINANCIAL_RESTRICT',
  'AUDIT_RETAIN',
] as const;
type Category = (typeof CATEGORIES)[number];

type OnDeleteAction = 'CASCADE' | 'RESTRICT' | 'SET NULL' | 'NO ACTION' | 'SET DEFAULT';

interface ManifestFk {
  conname: string;
  childTable: string;
  parentTable: string;
  onDelete: OnDeleteAction;
  category: Category;
  justification?: Record<string, unknown>;
}

// Postgres's single-character confdeltype code -> the SQL action name Prisma
// (and this manifest) spells out in full.
const CONFDELTYPE_TO_ACTION: Record<string, OnDeleteAction> = {
  c: 'CASCADE',
  r: 'RESTRICT',
  n: 'SET NULL',
  a: 'NO ACTION',
  d: 'SET DEFAULT',
};

const PROTECTED_TABLES = ['users', 'students', 'parent_profiles', 'coach_profiles'];

const MANIFEST_PATH = join(process.cwd(), 'data/security/account-deletion-fk-manifest.json');

function fail(message: string): never {
  throw new Error(`ACCOUNT_DELETION_FK_MANIFEST_CHECK_FAILED:${message}`);
}

interface DbFk {
  conname: string;
  childTable: string;
  parentTable: string;
  onDelete: OnDeleteAction;
}

async function loadDbGroundTruth(prisma: PrismaClient): Promise<DbFk[]> {
  const rows = await prisma.$queryRaw<
    Array<{ conname: string; child_table: string; parent_table: string; confdeltype: string }>
  >`
    SELECT
      con.conname,
      child.relname AS child_table,
      parent.relname AS parent_table,
      con.confdeltype
    FROM pg_constraint con
    JOIN pg_class child ON child.oid = con.conrelid
    JOIN pg_class parent ON parent.oid = con.confrelid
    WHERE con.contype = 'f'
      AND parent.relname = ANY(${PROTECTED_TABLES})
    ORDER BY con.conname;
  `;

  return rows.map(row => {
    const onDelete = CONFDELTYPE_TO_ACTION[row.confdeltype];
    if (!onDelete) fail(`UNKNOWN_CONFDELTYPE:${row.conname}:${row.confdeltype}`);
    return { conname: row.conname, childTable: row.child_table, parentTable: row.parent_table, onDelete };
  });
}

function loadManifest(): ManifestFk[] {
  const raw = readFileSync(MANIFEST_PATH, 'utf8');
  return JSON.parse(raw) as ManifestFk[];
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  let dbFks: DbFk[];
  try {
    dbFks = await loadDbGroundTruth(prisma);
  } finally {
    await prisma.$disconnect();
  }
  const manifest = loadManifest();

  const dbByConname = new Map(dbFks.map(fk => [fk.conname, fk]));
  const manifestByConname = new Map<string, ManifestFk[]>();
  for (const fk of manifest) {
    const list = manifestByConname.get(fk.conname) ?? [];
    list.push(fk);
    manifestByConname.set(fk.conname, list);
  }

  const duplicateConnames = [...manifestByConname.entries()].filter(([, list]) => list.length > 1).map(([name]) => name);
  const unclassified = manifest.filter(fk => !CATEGORIES.includes(fk.category)).map(fk => fk.conname);
  const staleManifest = manifest.filter(fk => !dbByConname.has(fk.conname)).map(fk => fk.conname);
  const missingManifest = dbFks.filter(fk => !manifestByConname.has(fk.conname)).map(fk => fk.conname);
  const onDeleteMismatch = manifest
    .filter(fk => dbByConname.has(fk.conname) && dbByConname.get(fk.conname)!.onDelete !== fk.onDelete)
    .map(fk => `${fk.conname}:manifest=${fk.onDelete}:db=${dbByConname.get(fk.conname)!.onDelete}`);

  const byCategory: Record<Category, number> = Object.fromEntries(CATEGORIES.map(c => [c, 0])) as Record<
    Category,
    number
  >;
  for (const fk of manifest) {
    if (CATEGORIES.includes(fk.category)) byCategory[fk.category] += 1;
  }
  const sum = CATEGORIES.reduce((acc, c) => acc + byCategory[c], 0);

  console.log('=== #273 account-deletion FK manifest — DB ground truth check ===');
  console.log(`DB_FK_COUNT=${dbFks.length}`);
  console.log(`MANIFEST_FK_COUNT=${manifest.length}`);
  console.log(`TOTAL=${manifest.length}`);
  for (const category of CATEGORIES) {
    console.log(`  ${category}=${byCategory[category]}`);
  }
  console.log(`SUM(categories)=${sum}`);
  if (sum !== manifest.length) {
    fail(`TOTAL_SUM_MISMATCH:total=${manifest.length}:sum=${sum}`);
  }

  console.log(`DUPLICATE_CONNAME=${duplicateConnames.length}`);
  console.log(`UNCLASSIFIED=${unclassified.length}`);
  console.log(`STALE_MANIFEST=${staleManifest.length}`);
  console.log(`MISSING_MANIFEST=${missingManifest.length}`);
  console.log(`ON_DELETE_MISMATCH=${onDeleteMismatch.length}`);

  const problems: string[] = [];
  if (duplicateConnames.length) problems.push(`DUPLICATE_CONNAME:${duplicateConnames.join(',')}`);
  if (unclassified.length) problems.push(`UNCLASSIFIED:${unclassified.join(',')}`);
  if (staleManifest.length) problems.push(`STALE_MANIFEST:${staleManifest.join(',')}`);
  if (missingManifest.length) problems.push(`MISSING_MANIFEST:${missingManifest.join(',')}`);
  if (onDeleteMismatch.length) problems.push(`ON_DELETE_MISMATCH:${onDeleteMismatch.join(',')}`);

  if (problems.length > 0) {
    fail(problems.join(' | '));
  }

  console.log('DB_FKS == MANIFEST_FKS: YES');
  console.log('ACCOUNT_DELETION_FK_MANIFEST_CHECK: PASS');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
