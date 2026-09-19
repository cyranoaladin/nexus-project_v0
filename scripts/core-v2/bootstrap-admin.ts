/**
 * One-time Core v2 ADMIN bootstrap — the only way the FIRST administrator can
 * come into existence.
 *
 *   CORE_V2_DATABASE_URL=<core v2> \
 *   npx tsx scripts/core-v2/bootstrap-admin.ts \
 *     --email=<owner mailbox> --first-name=<given> --last-name=<family> [--execute]
 *
 * Why it must exist at all: every account-creating service in Core v2 pins its
 * role (PARENT, ELEVE, or — since `createStaffAccount` — ASSISTANTE/COACH),
 * and `inviteAccount` asserts ACCOUNT_INVITE on its actor. So the first
 * administrator can be invited by nobody. That circle is broken exactly once,
 * here, and never again.
 *
 * Fail-closed by construction:
 *   - refuses if ANY user with role ADMIN already exists, whatever its status,
 *     so the script cannot be replayed to mint a second bootstrap admin —
 *     BOOTSTRAP_ADMIN_DISABLED_FOREVER holds from the first successful run,
 *     not merely from the first activation;
 *   - refuses to write at all without --execute;
 *   - refuses --execute outside a disposable database unless the operator
 *     supplies OWNER_PRODUCTION_GO;
 *   - accepts no password and writes none: the account is born
 *     PENDING_ACTIVATION and gets its credential from `activateAccount`,
 *     i.e. canonical bcrypt with the canonical sessionVersion bump;
 *   - the raw activation token goes to the canonical e-mail outbox and is
 *     never printed, logged, or returned.
 *
 * Exit codes: 0 done (or dry run), 1 refused before writing anything.
 */
import { requireCoreV2Client, disconnectCoreV2Client } from '@/lib/core-v2/client';
import { appendAuditEvent } from '@/lib/core-v2/audit';
import { normalizeEmail } from '@/lib/core-v2/contact';
import { createServiceContext } from '@/lib/core-v2/services/context';
import { inviteAccount } from '@/lib/core-v2/services/account';
import { getTrustedApplicationOrigin } from '@/lib/auth/parent-activation';
import { deliverCoreV2Invitation } from '@/lib/email/core-v2-invitation';

function arg(name: string): string | undefined {
  const match = process.argv.find((a) => a.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : undefined;
}

function assertAuthorizedToWrite(): void {
  const disposable = process.env.NEXUS_DISPOSABLE_POSTGRES === '1';
  const ownerGo = process.env.OWNER_PRODUCTION_GO?.trim();
  if (!disposable && !ownerGo) {
    throw new Error(
      'BOOTSTRAP_ADMIN_REFUSED: --execute requires NEXUS_DISPOSABLE_POSTGRES=1 (rehearsal) ' +
        'or OWNER_PRODUCTION_GO (explicit owner authorization).',
    );
  }
}

async function main(): Promise<number> {
  const email = arg('email');
  const firstName = arg('first-name');
  const lastName = arg('last-name');
  const execute = process.argv.includes('--execute');
  if (!email || !firstName || !lastName) {
    console.error('usage: --email=<owner mailbox> --first-name=<given> --last-name=<family> [--execute]');
    return 1;
  }
  if (execute) assertAuthorizedToWrite();

  // Preflight the activation link BEFORE anything is written. The origin comes
  // from NEXTAUTH_URL and is rejected if absent or non-HTTPS; discovering that
  // after the ADMIN row exists would be unrecoverable — the invitation would
  // never be queued, the account could not sign in to resend it, and the
  // bootstrap would already have closed itself because an ADMIN now exists.
  const origin = getTrustedApplicationOrigin();

  const client = await requireCoreV2Client();

  // The replay guard. Read before anything else, and re-read inside the
  // transaction below so two concurrent runs cannot both pass it.
  const existing = await client.user.count({ where: { role: 'ADMIN' } });
  if (existing > 0) {
    throw new Error(
      `BOOTSTRAP_ADMIN_REFUSED: ${existing} ADMIN account(s) already exist. ` +
        'The bootstrap is one-time and is now permanently closed; create further staff ' +
        'through POST /api/v2/staff/staff-accounts.',
    );
  }

  if (!execute) {
    console.log(
      `[bootstrap-admin] DRY_RUN: no ADMIN exists; activation links would point at ${origin.origin}. ` +
        '--execute would create exactly one ADMIN and invite it. Nothing written.',
    );
    return 0;
  }

  const normalized = normalizeEmail(email);
  const created = await client.$transaction(async (tx) => {
    // Re-check under the transaction: the count above is advisory, this one
    // is the one that matters if two operators run the script at once.
    if ((await tx.user.count({ where: { role: 'ADMIN' } })) > 0) {
      throw new Error('BOOTSTRAP_ADMIN_REFUSED: an ADMIN appeared concurrently.');
    }
    const admin = await tx.user.create({
      data: { role: 'ADMIN', email: normalized, firstName, lastName },
    });
    await appendAuditEvent(tx, {
      // The bootstrap has no prior actor — that is the whole point — so the
      // new administrator is recorded as its own subject with a null actor
      // rather than borrowing somebody else's identity.
      actorUserId: null,
      action: 'staff.bootstrap_admin_created',
      subjectType: 'User',
      subjectId: admin.id,
      correlationId: `bootstrap-admin:${admin.id}`,
      metadata: { role: 'ADMIN' },
    });
    return admin;
  });

  // From here the new administrator is a legitimate actor and the ordinary
  // lifecycle takes over: invitation, then activation sets the password.
  const ctx = createServiceContext({ userId: created.id, role: 'ADMIN' }, { correlationId: `bootstrap-admin:${created.id}` });
  const issued = await inviteAccount(client, ctx, created.id);
  await deliverCoreV2Invitation({
    userId: created.id,
    role: 'ADMIN',
    email: issued.email,
    displayName: `${firstName} ${lastName}`.trim(),
    rawToken: issued.rawToken,
    tokenHash: issued.invitation.tokenHash,
    expiresAt: issued.invitation.expiresAt,
  });

  console.log(
    `[bootstrap-admin] created ADMIN ${created.id} (PENDING_ACTIVATION) and enqueued its activation e-mail. ` +
      `Token not shown here by design. Expires ${issued.invitation.expiresAt.toISOString()}. ` +
      'BOOTSTRAP_ADMIN_DISABLED_FOREVER=YES.',
  );
  return 0;
}

main()
  .then(async (code) => {
    await disconnectCoreV2Client().catch(() => undefined);
    process.exit(code);
  })
  .catch(async (error) => {
    console.error('[bootstrap-admin] REFUSED', error instanceof Error ? error.message : error);
    await disconnectCoreV2Client().catch(() => undefined);
    process.exit(1);
  });
