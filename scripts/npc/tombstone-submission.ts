import { PrismaClient } from '@prisma/client';

import {
  formatTombstoneCliError,
  formatTombstoneCliSuccess,
  loadTombstoneCliInvocation,
} from '../../lib/npc/tombstone/cli';
import { executeNpcTombstone } from '../../lib/npc/tombstone/service';

async function main(): Promise<void> {
  // Read the root-owned manifest before constructing a database client. The
  // destructive service independently enforces UID and artifact scope before
  // opening its transaction.
  const args = await loadTombstoneCliInvocation(process.argv.slice(2));
  const prisma = new PrismaClient({ log: [] });
  try {
    const result = await executeNpcTombstone(prisma, args);
    process.stdout.write(formatTombstoneCliSuccess(result));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(formatTombstoneCliError(error));
  process.exitCode = 1;
});
