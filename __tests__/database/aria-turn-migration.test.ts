/** @jest-environment node */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('ARIA M1 turn lifecycle migration contract', () => {
  const root = process.cwd();
  const migrationDirectory = readdirSync(resolve(root, 'prisma/migrations')).find((name) =>
    name.endsWith('_aria_turn_lifecycle_expand'),
  );

  it('defines one execution lifecycle and the additive lineage models', () => {
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
});
