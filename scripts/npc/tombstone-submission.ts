import { PrismaClient } from '@prisma/client';

import {
  formatTombstoneCliError,
  formatTombstoneCliSuccess,
  parseAndValidateTombstoneCliArgs,
} from '../../lib/npc/tombstone/cli';
import { executeNpcTombstone } from '../../lib/npc/tombstone/service';

async function main(): Promise<void> {
  // Validate UID and export scope before constructing a database client. The
  // production entrypoint exposes no dependency-injection bypass.
  const args = parseAndValidateTombstoneCliArgs(process.argv.slice(2));
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
