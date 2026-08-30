import { source, sourceFilesUnder } from './aria-boundary-helpers';

describe('H004 ARIA lifecycle and feedback single sources of truth', () => {
  it('binds execution lifecycle to AriaConversationTurn and projects only assistant legacy status', () => {
    const schema = source('prisma/schema.prisma');
    const migration = source('prisma/migrations/20260830123000_aria_turn_lifecycle_expand/migration.sql');
    expect(schema).toMatch(/model AriaConversationTurn[\s\S]*status\s+AriaConversationTurnStatus/);
    expect(migration).toMatch(/NEW\."turnRole" = 'ASSISTANT'/);
    expect(migration).toMatch(/NEW\."turnRole" = 'USER' AND NEW\.status <> 'COMPLETED'/);
    expect(migration).toMatch(/WHERE "turnId" = NEW\.id[\s\S]{0,100}"turnRole" = 'ASSISTANT'/);
  });

  it('keeps one AriaFeedback row per message/student', () => {
    const schema = source('prisma/schema.prisma');
    expect(schema).toMatch(/model AriaFeedback[\s\S]*@@unique\(\[messageId, studentId\]\)/);
  });

  it('keeps legacy selectedCourseKeys out of every application runtime module', () => {
    const violations = sourceFilesUnder('app', 'components', 'lib')
      .filter((path) => /\bselectedCourseKeys\b/.test(source(path)));
    expect(violations).toEqual([]);
  });
});
