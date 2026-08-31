/** @jest-environment node */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('ARIA M1 turn lifecycle migration contract', () => {
  const root = process.cwd();
  const migrationDirectory = readdirSync(resolve(root, 'prisma/migrations')).find((name) =>
    name.endsWith('_aria_turn_lifecycle_expand'),
  );

  it('D016 defines one execution lifecycle and the additive lineage models', () => {
    expect(migrationDirectory).toBeTruthy();
    const schema = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');
    const migration = readFileSync(
      resolve(root, 'prisma/migrations', migrationDirectory!, 'migration.sql'),
      'utf8',
    );

    expect(schema).toContain('model AriaConversationTurn');
    expect(schema).toContain('enum AriaConversationTurnStatus');
    expect(schema).toContain('enum AriaConversationContextState');
    expect(schema).toContain('model AriaDataMigrationRun');
    expect(schema).toContain('model AriaDataMigrationRowAudit');
    expect(schema).toContain('model AriaEntitlementScope');
    expect(migration).toContain('aria_conversation_turns_one_active_per_conversation');
    expect(migration).toContain('aria_conversation_turns_actor_subject_use_case_client_request_key');
    expect(migration).toContain('aria_messages_turnId_turnRole_key');
    expect(migration).toContain('aria_conversations_active_course_check');
    expect(migration).toContain('aria_data_migration_rows_before_image_allowlist_check');
    expect(migration).toContain('aria_turn_message_status_guard');
    expect(migration).toContain('aria_turn_status_projection');
  });

  it('projects lifecycle status to assistant compatibility rows only', () => {
    const migration = readFileSync(
      resolve(root, 'prisma/migrations', migrationDirectory!, 'migration.sql'),
      'utf8',
    );

    expect(migration).toContain(`NEW."turnRole" = 'ASSISTANT'`);
    expect(migration).toContain(`NEW."turnRole" = 'USER'`);
    expect(migration).toContain(`NEW.status <> 'COMPLETED'`);
    expect(migration).toContain(`AND "turnRole" = 'ASSISTANT'`);
    expect(migration).not.toMatch(/UPDATE "aria_messages"[\s\S]{0,200}WHERE "turnId" = NEW\.id\s*;/);
  });

  it('B3_MIGRATION_180000_FAILS_CLOSED_ON_PRE_LINEAGE_APPLY_ROWS', () => {
    const lineageDirectory = readdirSync(resolve(root, 'prisma/migrations')).find((name) =>
      name.endsWith('_aria_backfill_apply_lineage_guard'),
    );
    expect(lineageDirectory).toBeTruthy();
    const migration = readFileSync(
      resolve(root, 'prisma/migrations', lineageDirectory!, 'migration.sql'),
      'utf8',
    );
    const preflight = migration.indexOf('ARIA APPLY lineage guard requires zero pre-existing APPLY runs');
    const triggerInstall = migration.indexOf('CREATE FUNCTION "aria_migration_run_require_apply_prerequisite"');

    expect(preflight).toBeGreaterThanOrEqual(0);
    expect(preflight).toBeLessThan(triggerInstall);
    expect(migration.slice(0, triggerInstall)).toMatch(
      /EXISTS\s*\([\s\S]*FROM public\."aria_data_migration_runs"[\s\S]*mode = 'APPLY'/,
    );
  });

  it('B2_MIGRATION_INSTALLS_STRICT_MESSAGE_AUDIT_AND_TERMINAL_EVIDENCE_GUARDS', () => {
    const auditGuardDirectory = readdirSync(resolve(root, 'prisma/migrations')).find((name) =>
      name.endsWith('_aria_turn_backfill_audit_guard'),
    );
    expect(auditGuardDirectory).toBeTruthy();
    const migration = readFileSync(
      resolve(root, 'prisma/migrations', auditGuardDirectory!, 'migration.sql'),
      'utf8',
    );

    expect(migration).toContain('aria_message_group_before_image_valid');
    expect(migration).toContain('aria_turn_apply_require_terminal_evidence');
    expect(migration).toContain('aria_turn_v2_identity_sha256');
    expect(migration).toContain('aria_turn_v2_source_fingerprint');
    expect(migration).toContain('aria_turn_v2_ambiguous_cluster_sha256');
    expect(migration).toContain('aria_turn_v2_run_matches_planner');
    expect(migration).toContain('eligible_source_total <> expanded_total');
    expect(migration).toContain('prior_source_overlap_total <> 0');
    expect(migration).toContain('run_target_total <> NEW."deterministicCount"');
    expect(migration).toContain('pg_catalog.sha256(pg_catalog.convert_to(');
    expect(migration).toContain('source_conversation."contextState" IS DISTINCT FROM \'ACTIVE\'');
    expect(migration).toContain('source_conversation."courseKey" IS NULL');
    expect(migration).toMatch(/'clusterId'[\s\S]*'createdAts'[\s\S]*'messageIds'[\s\S]*'reason'[\s\S]*'roles'[\s\S]*'statuses'/);
    expect(migration).toContain('NEW."scannedCount" <> (2 * NEW."deterministicCount")');
    expect(migration).toMatch(/classification IS DISTINCT FROM 'DETERMINISTIC_BACKFILL'[\s\S]*"targetTable" IS NOT NULL/);
    expect(migration).toContain('aria_turn_apply_terminal_evidence');
  });
});
