/**
 * Manual/ops entrypoint for `queueDueAriaWorkshopReminders` (P7c) — same
 * shape as `drain-turn-recovery-outbox.ts`. Not called by anything
 * automatic yet: this lot's explicit scope is implementation + tests only,
 * no production deployment/mutation until the final ARIA production GO
 * (see queue-due-workshop-reminders.ts's own header comment for the
 * documented one-line future activation step). Registering this as a real
 * npm script gives ops a way to run it manually in the meantime, and is
 * also this module's real, legitimate reachability entrypoint (never test
 * files, per this repo's own H010 reachability boundary).
 */
import { prisma } from '../../lib/prisma';
import { queueDueAriaWorkshopReminders } from '../../lib/aria/application/workshop/queue-due-workshop-reminders';

export async function runQueueDueAriaWorkshopReminders(input: Readonly<{
  run?: typeof queueDueAriaWorkshopReminders;
  disconnect?: () => Promise<void>;
  write?: (value: string) => void;
  writeError?: (value: string) => void;
}> = {}): Promise<number> {
  const write = input.write ?? ((value: string) => process.stdout.write(value));
  const writeError = input.writeError ?? ((value: string) => process.stderr.write(value));
  let exitCode = 0;
  try {
    const result = await (input.run ?? queueDueAriaWorkshopReminders)();
    write(`${JSON.stringify(result)}\n`);
  } catch {
    writeError('ARIA_WORKSHOP_REMINDER_QUEUE_FAILED\n');
    exitCode = 1;
  } finally {
    try {
      await (input.disconnect ?? (() => prisma.$disconnect()))();
    } catch {
      writeError('ARIA_WORKSHOP_REMINDER_DISCONNECT_FAILED\n');
      exitCode = 1;
    }
  }
  return exitCode;
}

if (require.main === module) {
  void runQueueDueAriaWorkshopReminders().then((exitCode) => { process.exitCode = exitCode; });
}
