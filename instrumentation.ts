/**
 * Next.js Instrumentation Hook — runs once at server startup.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on the server (not edge runtime), skip during build phase
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  ) {
    const { assertNpcStorageReady } = await import('./lib/npc/storage-root');
    try {
      assertNpcStorageReady({ capability: 'read-write' });
    } catch {
      // Next logs and swallows rejected instrumentation hooks. Terminating here
      // is the process-level fail-closed boundary before any listener is ready.
      console.error('NPC_STORAGE_PREFLIGHT_FAILED');
      process.exit(1);
    }

    const { validateEnv } = await import('./lib/env-validation');
    validateEnv();

    // Every scheduler below uses the canonical Prisma client. Establish the
    // connection before any background drain can race the database startup.
    const { prisma } = await import('./lib/prisma');
    try {
      await prisma.$connect();
    } catch {
      console.error('DATABASE_STARTUP_PREFLIGHT_FAILED');
      process.exit(1);
    }

    // Load BusinessConfig snapshot into memory at startup.
    // Without this, getOverride() returns null for all keys until an
    // admin triggers ensureFresh() via /api/admin/config — meaning all
    // DB overrides are invisible after a server restart.
    // Await ensures the snapshot is populated BEFORE the first request.
    // loadConfigSnapshot handles errors internally (logs + serves fallbacks),
    // so this await never throws — but it guarantees deterministic startup.
    const { loadConfigSnapshot } = await import('./lib/config');
    await loadConfigSnapshot();

    // Cohérence du stockage des documents. Une racine absente est créée — c'est
    // le cas normal d'un environnement neuf. Une racine qu'on ne peut pas rendre
    // utilisable fait en revanche échouer le démarrage, plutôt que d'attendre le
    // premier téléversement d'une famille. Les données hors racine ne bloquent
    // pas : elles sont journalisées pour qu'un humain traite l'héritage.
    const { ensureDocumentStorageReady } = await import('./lib/documents/storage-health');
    const storageHealth = ensureDocumentStorageReady();
    for (const stray of storageHealth.dataOutsideRoot) {
      console.warn(
        `[storage] ${stray.fileCount} fichier(s) hors de la racine canonique : ${stray.path}`,
      );
    }

    const { startEmailOutboxScheduler } = await import('./lib/email/outbox-scheduler');
    startEmailOutboxScheduler();

    const { startParentWhatsAppOutboxScheduler } = await import('./lib/whatsapp/invitation-scheduler');
    startParentWhatsAppOutboxScheduler();

    const { startBilanWorkerScheduler } = await import('./lib/bilans/worker/scheduler');
    startBilanWorkerScheduler();

    const { startAriaTurnRecoveryScheduler } = await import(
      './lib/aria/infrastructure/jobs/recovery-scheduler'
    );
    try {
      startAriaTurnRecoveryScheduler();
    } catch {
      // Next can swallow a rejected instrumentation hook. Exit is the
      // process-level boundary that prevents Turn writes without recovery.
      console.error('ARIA_TURN_RECOVERY_WORKER_PREFLIGHT_FAILED');
      process.exit(1);
    }
  }
}
