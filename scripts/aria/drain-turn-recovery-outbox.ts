import { prisma } from '../../lib/prisma';
import { drainAriaTurnRecoveryOutbox } from '../../lib/aria/infrastructure/jobs/recovery-worker';

async function main(): Promise<void> {
  const result = await drainAriaTurnRecoveryOutbox();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async () => {
    process.stderr.write('ARIA_TURN_RECOVERY_DRAIN_FAILED\n');
    await prisma.$disconnect();
    process.exitCode = 1;
  });
