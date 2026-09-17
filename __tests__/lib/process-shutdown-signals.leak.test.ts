/**
 * Regression for the `MaxListenersExceededWarning: 11 SIGTERM/SIGINT
 * listeners added to [process]` seen in CI Unit Tests jobs (99369030377,
 * 99271018645, 99258320401). Mechanism: each Jest test file runs in a fresh
 * `globalThis` (so a `globalThis.__flag` "registered once" guard resets per
 * file) while `process` is the ONE real process object shared by every file
 * in a worker — so every file that touches the module adds another
 * `process.once('SIGTERM'|'SIGINT')` pair that never fires and never goes
 * away. This test simulates N files in one worker: fresh globalThis state +
 * fresh module registry each round, same `process`.
 */
jest.mock('@/lib/bilans/worker/drain-outbox', () => ({
  drainScoreAttemptJobs: jest.fn(async () => ({})),
  drainGenerateReportJobs: jest.fn(async () => ({})),
}));
jest.mock('@/lib/bilans/staff/notification-service', () => ({
  maybeSendAssistantDigest: jest.fn(async () => ({ sent: false })),
}));
jest.mock('@/lib/email/outbox-worker', () => ({
  drainEmailOutbox: jest.fn(async () => ({})),
  maintainEmailOutbox: jest.fn(async () => ({ failedFinal: 0, oldAmbiguous: 0 })),
}));
jest.mock('@/lib/whatsapp/invitation-worker', () => ({ drainWhatsAppInvitations: jest.fn(async () => undefined) }));
jest.mock('@/lib/whatsapp/invitation-outbox', () => ({ assertWhatsAppOutboxEncryptionConfiguration: jest.fn() }));
jest.mock('@/lib/whatsapp/meta-provider', () => ({ getMetaWhatsAppConfig: jest.fn(() => ({})) }));

const ROUNDS = 5;

type Scenario = {
  name: string;
  modulePath: string;
  globalKeys: string[];
  env?: Record<string, string>;
  exercise: (mod: Record<string, any>) => Promise<unknown> | void;
  teardown?: (mod: Record<string, any>) => Promise<unknown> | void;
};

const scenarios: Scenario[] = [
  {
    name: 'rate-limit runtime (getStore → registerShutdownHandlers)',
    modulePath: '@/lib/rate-limit/runtime',
    globalKeys: ['__nexusRateLimitState'],
    exercise: (m) => m.guardRateLimitValueAsync({ preset: 'api', keySuffix: 'leak-probe', dimension: 'ip', value: '203.0.113.1' }),
    teardown: (m) => m.resetRateLimitRuntimeForTests(),
  },
  {
    name: 'bilan worker scheduler',
    modulePath: '@/lib/bilans/worker/scheduler',
    globalKeys: ['__nexusBilanWorkerScheduler'],
    env: { BILAN_WORKER_ENABLED: 'true', BILAN_WORKER_POLL_INTERVAL_MS: '60000' },
    exercise: (m) => m.startBilanWorkerScheduler(),
    teardown: (m) => m.stopBilanWorkerScheduler(),
  },
  {
    name: 'email outbox scheduler',
    modulePath: '@/lib/email/outbox-scheduler',
    globalKeys: ['__nexusEmailOutboxScheduler'],
    env: {
      EMAIL_OUTBOX_WORKER_ENABLED: 'true',
      EMAIL_OUTBOX_ENCRYPTION_KEY: 'x'.repeat(32),
      SMTP_HOST: 'smtp.invalid',
      SMTP_FROM: 'noreply@example.invalid',
      EMAIL_OUTBOX_POLL_INTERVAL_MS: '60000',
    },
    exercise: (m) => m.startEmailOutboxScheduler(),
    teardown: (m) => m.stopEmailOutboxScheduler(),
  },
  {
    name: 'whatsapp outbox scheduler',
    modulePath: '@/lib/whatsapp/invitation-scheduler',
    globalKeys: ['__nexusWhatsAppOutboxScheduler'],
    env: {
      WHATSAPP_OUTBOX_WORKER_ENABLED: 'true',
      WHATSAPP_META_APP_SECRET: 'y'.repeat(32),
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'z'.repeat(16),
      WHATSAPP_OUTBOX_POLL_INTERVAL_MS: '60000',
    },
    exercise: (m) => m.startParentWhatsAppOutboxScheduler(),
    teardown: (m) => m.stopParentWhatsAppOutboxScheduler(),
  },
];

function listenerTotal(): number {
  return process.listenerCount('SIGTERM') + process.listenerCount('SIGINT');
}

describe('process SIGTERM/SIGINT shutdown listeners register once per process, not once per test file', () => {
  const savedEnv = { ...process.env };
  afterEach(() => {
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
  });

  test.each(scenarios)('$name', async (scenario) => {
    Object.assign(process.env, scenario.env ?? {});
    const before = listenerTotal();
    for (let round = 0; round < ROUNDS; round += 1) {
      for (const key of scenario.globalKeys) delete (globalThis as Record<string, unknown>)[key];
      let mod!: Record<string, any>;
      jest.isolateModules(() => {
        mod = jest.requireActual(scenario.modulePath) as Record<string, any>;
      });
      await scenario.exercise(mod);
      await scenario.teardown?.(mod);
    }
    const added = listenerTotal() - before;
    // At most one SIGTERM + one SIGINT listener for the whole process, however
    // many "files" (module instances with a fresh globalThis) evaluated it.
    expect(added).toBeLessThanOrEqual(2);
  });
});
