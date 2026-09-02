import { prisma } from '../../lib/prisma';
import { drainAriaTurnRecoveryOutbox } from '../../lib/aria/infrastructure/jobs/recovery-worker';

export async function runAriaTurnRecoveryDrain(input: Readonly<{
  drain?: typeof drainAriaTurnRecoveryOutbox;
  disconnect?: () => Promise<void>;
  write?: (value: string) => void;
  writeError?: (value: string) => void;
}> = {}): Promise<number> {
  const write = input.write ?? ((value: string) => process.stdout.write(value));
  const writeError = input.writeError ?? ((value: string) => process.stderr.write(value));
  let exitCode = 0;
  try {
    const result = await (input.drain ?? drainAriaTurnRecoveryOutbox)();
    write(`${JSON.stringify(result)}\n`);
  } catch {
    writeError('ARIA_TURN_RECOVERY_DRAIN_FAILED\n');
    exitCode = 1;
  } finally {
    try {
      await (input.disconnect ?? (() => prisma.$disconnect()))();
    } catch {
      writeError('ARIA_TURN_RECOVERY_DISCONNECT_FAILED\n');
      exitCode = 1;
    }
  }
  return exitCode;
}

if (require.main === module) {
  void runAriaTurnRecoveryDrain().then((exitCode) => { process.exitCode = exitCode; });
}
