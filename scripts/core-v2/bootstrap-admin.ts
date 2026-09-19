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
import { createServiceContext } from '@/lib/core-v2/services/context';
import { inviteAccount, resendInvitation } from '@/lib/core-v2/services/account';
import { bootstrapFirstAdmin } from '@/lib/core-v2/services/staff-account';
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
  const resend = process.argv.includes('--resend-invitation');
  if (!email || !firstName || !lastName) {
    console.error('usage: --email=<owner mailbox> --first-name=<given> --last-name=<family> [--resend-invitation] [--execute]');
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

  const admins = await client.user.findMany({ where: { role: 'ADMIN' }, select: { id: true, accountStatus: true, email: true } });

  // ── Recovery mode. The failure this exists for is real: the ADMIN row is
  // created, the invitation e-mail never reaches the owner (bad mailbox,
  // outbox down, message lost), and the account cannot sign in to ask for
  // another one — while the bootstrap has already closed itself. Without a
  // sanctioned way back in, the installation is bricked.
  //
  // It re-invites THE SAME account through the ordinary service. It never
  // creates a second ADMIN, never sets a password, never prints a token, and
  // refuses once the account is ACTIVE — from then on the ordinary
  // password-reset path is the way in, not this script.
  if (resend) {
    if (admins.length !== 1) {
      throw new Error(`BOOTSTRAP_ADMIN_REFUSED: --resend-invitation expects exactly one ADMIN, found ${admins.length}.`);
    }
    const [admin] = admins;
    if (admin.accountStatus !== 'PENDING_ACTIVATION') {
      throw new Error(
        `BOOTSTRAP_ADMIN_REFUSED: ADMIN ${admin.id} is ${admin.accountStatus}, not PENDING_ACTIVATION. ` +
          'An activated administrator recovers through the ordinary password-reset path, not through the bootstrap.',
      );
    }
    if (!execute) {
      console.log(`[bootstrap-admin] DRY_RUN: would revoke any open invitation for ADMIN ${admin.id} and issue exactly one new one. Nothing written.`);
      return 0;
    }
    const ctx = createServiceContext({ userId: admin.id, role: 'ADMIN' }, { correlationId: `bootstrap-admin-resend:${admin.id}` });
    const reissued = await resendInvitation(client, ctx, admin.id);
    await deliverCoreV2Invitation({
      userId: admin.id,
      role: 'ADMIN',
      email: reissued.email,
      displayName: `${firstName} ${lastName}`.trim(),
      rawToken: reissued.rawToken,
      tokenHash: reissued.invitation.tokenHash,
      expiresAt: reissued.invitation.expiresAt,
    });
    console.log(
      `[bootstrap-admin] re-issued the activation e-mail for ADMIN ${admin.id}. Any previous link is now revoked. ` +
        `Token not shown here by design. Expires ${reissued.invitation.expiresAt.toISOString()}.`,
    );
    return 0;
  }

  // ── Creation mode.
  if (admins.length > 0) {
    throw new Error(
      `BOOTSTRAP_ADMIN_REFUSED: ${admins.length} ADMIN account(s) already exist. ` +
        'The bootstrap is one-time and is now permanently closed; create further staff ' +
        'through POST /api/v2/staff/staff-accounts. If the first administrator never received ' +
        'its invitation, use --resend-invitation.',
    );
  }

  if (!execute) {
    console.log(
      `[bootstrap-admin] DRY_RUN: no ADMIN exists; activation links would point at ${origin.origin}. ` +
        '--execute would create exactly one ADMIN and invite it. Nothing written.',
    );
    return 0;
  }

  // Creation is the service's job, and its advisory lock — not this script's
  // — is what makes two concurrent runs safe.
  const created = await bootstrapFirstAdmin(client, { email, firstName, lastName });

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
