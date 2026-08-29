import {
  canConnectToTestDb,
  createTestParent,
  createTestStudent,
  setupTestDatabase,
  testPrisma,
} from '../setup/test-database';

describe('real database test factories', () => {
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await canConnectToTestDb();
  });

  beforeEach(async () => {
    if (dbAvailable) {
      await setupTestDatabase();
    }
  });

  afterAll(async () => {
    if (dbAvailable) {
      await setupTestDatabase();
    }
    await testPrisma.$disconnect();
  });

  it('persists the canonical grade level for a default student', async () => {
    if (!dbAvailable) {
      throw new Error('PostgreSQL is required for the database factory contract');
    }

    const { parentProfile } = await createTestParent();
    const { student } = await createTestStudent(parentProfile.id);

    expect(student.gradeLevel).toBe('TERMINALE');
  });
});
