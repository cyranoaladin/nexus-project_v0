// Real PostgreSQL lanes must exercise the generated Prisma client, not the
// repository-wide unit-test proxy installed by jest.setup.js.
jest.unmock('@/lib/prisma');
