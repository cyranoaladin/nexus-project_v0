/**
 * Regression guard for #273 (zero-debt go-live audit, DELETE-1..5): every
 * foreign key that points at User, Student, ParentProfile, or CoachProfile
 * was enumerated against real `pg_constraint` data and classified into
 * exactly one of PURE_MEMBERSHIP_CASCADE_ALLOWED, EPHEMERAL_CASCADE_ALLOWED,
 * HISTORICAL_RESTRICT, FINANCIAL_RESTRICT, or AUDIT_RETAIN — see
 * data/security/account-deletion-fk-manifest.json (the checked-in, reviewed
 * business classification) and lib/security/account-deletion-guard.ts.
 *
 * This is the FAST, no-DB half of the guard: it parses prisma/schema.prisma
 * statically (so it runs in the "Unit Tests" CI job on every commit),
 * reconstructs each relation's real Postgres constraint name the same way
 * Prisma does (`{childTable}_{fkColumnName}_fkey`), and fails if:
 *  - a relation into one of the 4 protected models exists in the schema but
 *    its reconstructed constraint name is not in the checked-in manifest
 *    (drift: a new relation was added without an explicit, reviewed
 *    classification), or
 *  - a manifest FK's onDelete action in the schema no longer matches what
 *    was classified (drift: someone silently changed Restrict back to
 *    Cascade, or vice versa, without updating the manifest/guard).
 *
 * The AUTHORITATIVE half — exact DB ground truth via real `pg_constraint`,
 * catching drift this static parser cannot see at all (e.g. a hand-written
 * SQL migration that never touched schema.prisma) — is
 * scripts/db/check-account-deletion-fk-manifest.ts, wired into the CI "Real
 * DB Integration" job.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import manifest from '../../data/security/account-deletion-fk-manifest.json';

type ClassifiedFk = {
  conname: string;
  childTable: string;
  parentTable: string;
  onDelete: 'CASCADE' | 'RESTRICT' | 'SET NULL' | 'NO ACTION' | 'SET DEFAULT';
  category:
    | 'PURE_MEMBERSHIP_CASCADE_ALLOWED'
    | 'EPHEMERAL_CASCADE_ALLOWED'
    | 'HISTORICAL_RESTRICT'
    | 'FINANCIAL_RESTRICT'
    | 'AUDIT_RETAIN';
};

const CLASSIFIED = manifest as ClassifiedFk[];
const CLASSIFIED_BY_CONNAME = new Map(CLASSIFIED.map((fk) => [fk.conname, fk]));
const PROTECTED_MODELS = new Set(['User', 'Student', 'ParentProfile', 'CoachProfile']);

const PRISMA_ON_DELETE_TO_SQL: Record<string, ClassifiedFk['onDelete']> = {
  Cascade: 'CASCADE',
  Restrict: 'RESTRICT',
  SetNull: 'SET NULL',
  NoAction: 'NO ACTION',
  SetDefault: 'SET DEFAULT',
};

type SchemaRelation = {
  model: string;
  childTable: string;
  fkColumn: string;
  targetModel: string;
  onDelete: ClassifiedFk['onDelete'];
  conname: string;
};

// Prisma constraint names it cannot derive mechanically from this parser:
// this one predates a field rename (the Prisma field is now
// `cancellationRequestedByActorId`, but the underlying constraint — created
// before that rename, and never renamed itself, which is normal: renaming a
// Prisma field alone does not emit a migration — is still named for the
// field's old name, `cancellationActor`).
const CONNAME_OVERRIDES: Record<string, string> = {
  aria_conversation_turns_cancellationRequestedByActorId_fkey: 'aria_conversation_turns_cancellationActor_fkey',
};

function parseSchemaRelations(schemaSource: string): SchemaRelation[] {
  const relations: SchemaRelation[] = [];
  const modelBlocks = schemaSource.split(/^model\s+/m).slice(1);

  for (const block of modelBlocks) {
    const nameMatch = block.match(/^(\w+)\s*\{/);
    if (!nameMatch) continue;
    const model = nameMatch[1];
    const body = block.slice(block.indexOf('{') + 1, block.search(/^\}/m));
    const bodyLines = body.split('\n');

    // Prisma defaults a table's Postgres name to the model name unless
    // @@map(...) overrides it — every model in this schema does override it.
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    const childTable = mapMatch ? mapMatch[1] : model;

    // A relation's `fields: [x]` names the PRISMA field, not the DB column —
    // the real constraint name uses the column (its own `@map(...)` if one
    // exists, else the field name verbatim).
    const columnNameOf = (fieldName: string): string => {
      const fieldLine = bodyLines.find((line) => new RegExp(`^\\s*${fieldName}\\b`).test(line));
      const fieldMap = fieldLine?.match(/@map\("([^"]+)"\)/);
      return fieldMap ? fieldMap[1] : fieldName;
    };
    // Prisma's default onDelete, when not explicit, is Restrict for a
    // required (non-nullable) relation scalar and SetNull for an optional
    // one — never Cascade and never Postgres's raw NoAction.
    const isOptionalField = (fieldName: string): boolean => {
      const fieldLine = bodyLines.find((line) => new RegExp(`^\\s*${fieldName}\\s`).test(line));
      return /^\s*\S+\s+\S+\?/.test(fieldLine ?? '');
    };

    for (const rawLine of bodyLines) {
      const relationMatch = rawLine.match(/^\s*\w+\s+(\w+)\??\s+@relation\([^)]*fields:\s*\[(\w+)\][^)]*\)/);
      if (!relationMatch) continue;
      const [, targetModel, fkField] = relationMatch;
      if (!PROTECTED_MODELS.has(targetModel)) continue;

      const onDeleteMatch = rawLine.match(/onDelete:\s*(\w+)/);
      const defaultOnDelete: ClassifiedFk['onDelete'] = isOptionalField(fkField) ? 'SET NULL' : 'RESTRICT';
      const onDelete = onDeleteMatch ? PRISMA_ON_DELETE_TO_SQL[onDeleteMatch[1]] : defaultOnDelete;
      if (!onDelete) throw new Error(`Unrecognized onDelete action on ${model}.${fkField}: ${rawLine}`);

      const fkColumn = columnNameOf(fkField);
      const conname = `${childTable}_${fkColumn}_fkey`;
      relations.push({
        model,
        childTable,
        fkColumn,
        targetModel,
        onDelete,
        conname: CONNAME_OVERRIDES[conname] ?? conname,
      });
    }
  }
  return relations;
}

describe('#273 account-deletion FK inventory — no silent drift', () => {
  const schemaSource = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
  const relations = parseSchemaRelations(schemaSource);

  it('finds exactly as many relations as the manifest classifies', () => {
    // An exact count, not a loose floor: tables that don't follow the
    // `{childTable}_{fkColumn}_fkey` convention (legacy tables predating
    // @@map, e.g. "SessionBooking"/"CoachAvailability", which keep their
    // original PascalCase table name) fall back to the model name itself as
    // childTable above, which reconstructs their real constraint name
    // correctly too — verified empirically: this parser's count matches the
    // real `pg_constraint` count (scripts/db/check-account-deletion-fk-manifest.ts)
    // exactly. A mismatch here means either a relation was added/removed in
    // the schema without updating the manifest, or this parser's
    // reconstruction logic itself needs a new special case — investigate,
    // don't loosen this back into a floor.
    expect(relations.length).toBe(CLASSIFIED.length);
  });

  it('has zero UNKNOWN classifications in the checked-in allowlist', () => {
    const categories = new Set([
      'PURE_MEMBERSHIP_CASCADE_ALLOWED',
      'EPHEMERAL_CASCADE_ALLOWED',
      'HISTORICAL_RESTRICT',
      'FINANCIAL_RESTRICT',
      'AUDIT_RETAIN',
    ]);
    const unknown = CLASSIFIED.filter((fk) => !categories.has(fk.category));
    expect(unknown).toEqual([]);
  });

  it.each(relations.map((r) => [r.conname, r] as const))(
    '%s has a reviewed classification matching its current onDelete action',
    (_conname, relation) => {
      const classified = CLASSIFIED_BY_CONNAME.get(relation.conname);
      if (!classified) {
        throw new Error(
          `${relation.model}.${relation.fkColumn} -> ${relation.targetModel} (expected constraint ` +
            `"${relation.conname}") has no reviewed classification. If this is a new relation, add it to ` +
            'data/security/account-deletion-fk-manifest.json with an explicit category (verify against real ' +
            '`pg_constraint` via scripts/db/check-account-deletion-fk-manifest.ts) and, if it protects real ' +
            'history, add its constraint name to lib/security/account-deletion-guard.ts.',
        );
      }
      if (classified.onDelete !== relation.onDelete) {
        throw new Error(
          `${relation.conname} was classified as ${classified.category} expecting onDelete=` +
            `${classified.onDelete}, but the schema now declares onDelete=${relation.onDelete}. If this ` +
            'change is intentional, update the classification (and, for a HISTORICAL_RESTRICT/' +
            'FINANCIAL_RESTRICT/AUDIT_RETAIN entry silently reverted to Cascade, this is exactly the ' +
            'silent-cascade-reintroduction this guard exists to catch — do not change it without a new ' +
            'reviewed migration).',
        );
      }
    },
  );
});
