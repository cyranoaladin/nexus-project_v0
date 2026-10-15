/** Isolated process driver; only validated disposable databases and loopback SMTP. */
import { assertDisposablePostgresUrl } from '../../helpers/disposable-postgres';
import { prisma } from '@/lib/prisma';
import { requireCoreV2Client, disconnectCoreV2Client } from '@/lib/core-v2/client';
import { drainEmailOutbox } from '@/lib/email/outbox-worker';
import { sendMail } from '@/lib/email/mailer';
import { accountInvitationDeliveryAuthority } from '@/lib/core-v2/accounts/invitation-delivery-authority';

async function main() {
  assertDisposablePostgresUrl(process.env.DATABASE_URL ?? '');
  const core = new URL(process.env.CORE_V2_DATABASE_URL ?? '');
  if (process.env.NEXUS_DISPOSABLE_POSTGRES !== '1' || core.protocol !== 'postgresql:'
    || !['localhost', '127.0.0.1'].includes(core.hostname)
    || !(core.pathname === '/core_v2_foundation_ci' || /^\/nexus_disposable_(?:[a-z0-9]+_)*test$/.test(core.pathname))
    || process.env.CORE_V2_AUTH_MODE !== 'V1_ONLY' || process.env.SMTP_HOST !== '127.0.0.1'
    || !process.send || !['crash-after-accept', 'restart'].includes(process.argv[2])) throw new Error('CRASH_DRIVER_REFUSED');
  const client = await requireCoreV2Client();
  try {
    const result = await drainEmailOutbox({ limit: 1, leaseDurationMs: 5_000 }, {
      accountInvitationAuthority: accountInvitationDeliveryAuthority(client),
      logger: { info: () => undefined, error: () => undefined },
      deliver: async (content, control) => {
        const sent = await sendMail(content, control);
        if (process.argv[2] === 'crash-after-accept') {
          process.send!({ event: 'SMTP_ACCEPTED' });
          await new Promise<void>(() => {});
        }
        return sent;
      },
    });
    process.send({ event: 'DRAIN_COMPLETED', ...result });
  } finally { await prisma.$disconnect(); await disconnectCoreV2Client(); }
}
main().then(() => { process.disconnect?.(); }).catch(async () => {
  console.error('CRASH_DRIVER_REFUSED');
  await prisma.$disconnect(); await disconnectCoreV2Client(); process.exitCode = 1; process.disconnect?.();
});
