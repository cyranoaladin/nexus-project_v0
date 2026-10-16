/**
 * Ordonnanceur de la file WhatsApp.
 *
 * Même principe que celui des e-mails : un battement périodique draine la
 * file, et une sollicitation immédiate est déclenchée après chaque commande
 * pour que la notification parte dans la seconde plutôt qu'au prochain tour.
 *
 * Le drainage ne réclame rien tant que les identifiants Meta sont absents :
 * le battement tourne alors à vide, sans bruit et sans coût.
 */
import { drainWhatsAppOutbox } from './outbox';

type SchedulerState = { timer?: NodeJS.Timeout; draining?: Promise<unknown> };
const globalState = globalThis as typeof globalThis & { __nexusWhatsAppOutboxScheduler?: SchedulerState };

function state(): SchedulerState {
  globalState.__nexusWhatsAppOutboxScheduler ??= {};
  return globalState.__nexusWhatsAppOutboxScheduler;
}

function intervalMs(): number {
  const value = Number(process.env.WHATSAPP_OUTBOX_POLL_INTERVAL_MS || 15_000);
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 10 * 60_000) return 15_000;
  return value;
}

/** Draine sans jamais laisser une erreur remonter au cycle d'ordonnancement. */
async function drainOnce(): Promise<void> {
  const current = state();
  if (current.draining) return current.draining.then(() => undefined);
  current.draining = drainWhatsAppOutbox().catch((error) => {
    console.error('[whatsapp/outbox] drainage interrompu', error instanceof Error ? error.message : error);
  });
  try {
    await current.draining;
  } finally {
    current.draining = undefined;
  }
}

/** Sollicitation immédiate, après qu'une commande a été validée en base. */
export function kickWhatsAppOutboxDrain(): void {
  void drainOnce();
}

export function startWhatsAppOutboxScheduler(): void {
  const current = state();
  if (current.timer) return;
  current.timer = setInterval(() => void drainOnce(), intervalMs());
  current.timer.unref?.();
}

export function stopWhatsAppOutboxScheduler(): void {
  const current = state();
  if (!current.timer) return;
  clearInterval(current.timer);
  current.timer = undefined;
}
