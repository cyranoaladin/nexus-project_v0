import { CoreV2ConfigError } from '@/lib/core-v2/config';
import { assertAccountEmailHandoffSchema } from './email-handoff-schema';
import { registerProcessShutdownOnce } from '@/lib/runtime/process-shutdown-signals';
import { getAuthRolloutMode } from '@/lib/core-v2/auth/authority';
import { requireCoreV2Client } from '@/lib/core-v2/client';
import { getTrustedApplicationOrigin } from '@/lib/auth/parent-activation';
import { assertAccountEmailHandoffConfiguration } from '@/lib/email/account-handoff-envelope';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { drainAccountEmailHandoffs } from './email-handoff-worker';
import { transferAccountEmailHandoff } from './email-handoff-destination';

type SchedulerState = { timer?: NodeJS.Timeout; draining?: Promise<void>; stopping?: boolean };
const globalState = globalThis as typeof globalThis & { __accountEmailHandoffScheduler?: SchedulerState };
function state(): SchedulerState { globalState.__accountEmailHandoffScheduler ??= {}; return globalState.__accountEmailHandoffScheduler; }
function intervalMs(): number {
  const encoded = process.env.CORE_V2_ACCOUNT_EMAIL_POLL_INTERVAL_MS?.trim();
  if (encoded === undefined) return 5_000;
  if (!/^\d+$/.test(encoded)) throw new Error('ACCOUNT_EMAIL_POLL_INTERVAL_INVALID');
  const value = Number(encoded);
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 60_000) throw new Error('ACCOUNT_EMAIL_POLL_INTERVAL_INVALID');
  return value;
}

/**
 * Under V1_ONLY, Core v1 is the sole credential authority and the invitation is
 * provisioned through the V1 saga (v1-provisioning.ts), which needs a Core
 * database to record the link. No Core database configured means no Core
 * identities to provision: that is a normal V1-only deployment, not an error.
 */
function v1ProvisioningHasCore(): boolean {
  return Boolean(process.env.CORE_V2_DATABASE_URL?.trim());
}

/**
 * The genuine availability check that replaces the old blanket refusal under
 * V1_ONLY: an invitation request is accepted only if everything it needs to
 * finish exists, and refused up front otherwise (never half-started).
 */
export function assertAccountV1ProvisioningRuntimeConfiguration(): void {
  if (!v1ProvisioningHasCore()) throw new CoreV2ConfigError('ACCOUNT_V1_PROVISIONING_CORE_UNAVAILABLE');
  const emailKey = process.env.EMAIL_OUTBOX_ENCRYPTION_KEY?.trim();
  if (!emailKey || emailKey.length < 32) throw new CoreV2ConfigError('ACCOUNT_V1_PROVISIONING_EMAIL_UNCONFIGURED');
  try { getTrustedApplicationOrigin(); } catch { throw new CoreV2ConfigError('ACCOUNT_V1_PROVISIONING_ORIGIN_INVALID'); }
  intervalMs();
}

/**
 * The Core-credential handoff (HYBRID / V2_ONLY). Under V1_ONLY it stays a
 * deliberate fail-closed refusal: Core credentials would never be read. Callers
 * that only exist for Core credentials (the first-administrator CLI, which
 * cannot be provisioned through v1) rely on that. Invitation requests use
 * assertAccountInvitationRuntimeConfiguration (invitation-runtime.ts), which
 * knows the V1 saga.
 */
export function assertAccountEmailHandoffRuntimeConfiguration(): void {
  if (getAuthRolloutMode() === 'V1_ONLY') throw new CoreV2ConfigError('ACCOUNT_EMAIL_CORE_AUTH_DISABLED');
  assertAccountEmailHandoffConfiguration();
  intervalMs();
}

async function drainV1Provisioning(): Promise<void> {
  const { drainV1Provisioning: drain } = await import('./v1-provisioning-worker');
  const client = await requireCoreV2Client();
  const metrics = await drain(client, { now: () => new Date() });
  if (metrics.issued > 0) kickEmailOutboxDrain();
  console.info(JSON.stringify({ event: 'ACCOUNT_V1_PROVISIONING_METRICS', ...metrics }));
  if (metrics.failedFinal > 0) console.error(JSON.stringify({ event: 'ACCOUNT_V1_PROVISIONING_ATTENTION_REQUIRED', failedFinal: metrics.failedFinal }));
}

export function kickAccountEmailHandoffDrain(): void {
  const v1Authority = getAuthRolloutMode() === 'V1_ONLY';
  if (v1Authority && !v1ProvisioningHasCore()) return;
  const current = state();
  if (current.draining || current.stopping) return;
  current.draining = (async () => {
    if (v1Authority) { await drainV1Provisioning(); return; }
    const client = await requireCoreV2Client();
    const metrics = await drainAccountEmailHandoffs(client, { now: () => new Date(), transfer: transferAccountEmailHandoff });
    if (metrics.completed > 0) kickEmailOutboxDrain();
    console.info(JSON.stringify({ event: 'ACCOUNT_EMAIL_HANDOFF_METRICS', ...metrics }));
    if (metrics.failedFinal > 0) console.error(JSON.stringify({ event: 'ACCOUNT_EMAIL_HANDOFF_ATTENTION_REQUIRED', failedFinal: metrics.failedFinal }));
  })().catch(() => {
    console.error(JSON.stringify({ event: 'ACCOUNT_EMAIL_HANDOFF_DRAIN_FAILED', code: 'ACCOUNT_EMAIL_HANDOFF_DRAIN_FAILED' }));
  }).finally(() => { current.draining = undefined; });
}

export async function stopAccountEmailHandoffScheduler(): Promise<void> {
  const current = state();
  current.stopping = true;
  if (current.timer) clearInterval(current.timer);
  current.timer = undefined;
  await current.draining;
}

/**
 * Starts the account drain matching the credential authority. Core credentials
 * (HYBRID / V2_ONLY): the encrypted e-mail handoff. V1_ONLY: the provisioning
 * saga, but only when a Core database exists to provision into; a V1-only
 * deployment without one starts nothing and fails nothing.
 */
export async function startAccountEmailHandoffScheduler(): Promise<void> {
  const v1Authority = getAuthRolloutMode() === 'V1_ONLY';
  if (v1Authority && !v1ProvisioningHasCore()) return;
  if (v1Authority) assertAccountV1ProvisioningRuntimeConfiguration(); else assertAccountEmailHandoffRuntimeConfiguration();
  const client = await requireCoreV2Client();
  if (v1Authority) {
    const { assertAccountV1ProvisioningSchema } = await import('./v1-provisioning-schema');
    await assertAccountV1ProvisioningSchema(client);
    const { assertV1InvitationAuthoritySchema } = await import('@/lib/auth/v1-invitation-schema');
    await assertV1InvitationAuthoritySchema();
    const { registerAccountInvitationAuthority } = await import('@/lib/email/account-invitation-authority');
    const { accountInvitationDeliveryAuthority } = await import('./invitation-delivery-authority');
    registerAccountInvitationAuthority(accountInvitationDeliveryAuthority(client));
  } else {
    await assertAccountEmailHandoffSchema(client);
  }
  const current = state();
  current.stopping = false;
  if (!current.timer) {
    current.timer = setInterval(kickAccountEmailHandoffDrain, intervalMs());
    current.timer.unref?.();
    kickAccountEmailHandoffDrain();
  }
  registerProcessShutdownOnce('account-email-handoff-scheduler', () => { void stopAccountEmailHandoffScheduler(); });
}
