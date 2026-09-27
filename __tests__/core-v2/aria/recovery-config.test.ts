import {
  assertCoreV2AriaRecoveryConfiguration,
  CoreV2AriaRecoveryConfigError,
  getCoreV2AriaRecoveryPollIntervalMs,
  isCoreV2AriaConversationEnabled,
  isCoreV2AriaRecoveryWorkerEnabled,
} from '@/lib/core-v2/aria/recovery-config';

describe('Core v2 ARIA recovery configuration', () => {
  it.each(['true', 'TRUE', '1', 'on', ' On '])(
    'accepts explicit enablement value %s for conversation and worker together',
    (value) => {
      const environment = {
        CORE_V2_ARIA_CONVERSATION_ENABLED: value,
        CORE_V2_ARIA_RECOVERY_WORKER_ENABLED: value,
      };
      expect(isCoreV2AriaConversationEnabled(environment)).toBe(true);
      expect(isCoreV2AriaRecoveryWorkerEnabled(environment)).toBe(true);
      expect(() => assertCoreV2AriaRecoveryConfiguration(environment)).not.toThrow();
    },
  );

  it('rejects an enabled conversation when the recovery worker is disabled', () => {
    const environment = {
      CORE_V2_ARIA_CONVERSATION_ENABLED: 'true',
      CORE_V2_ARIA_RECOVERY_WORKER_ENABLED: 'false',
    };
    expect(() => assertCoreV2AriaRecoveryConfiguration(environment))
      .toThrow(CoreV2AriaRecoveryConfigError);
    expect(() => assertCoreV2AriaRecoveryConfiguration(environment))
      .toThrow('CORE_V2_ARIA_RECOVERY_WORKER_ENABLED must be enabled');
  });

  it.each(['249', '60001', '1.5', 'NaN', 'Infinity'])(
    'rejects unsafe poll interval %s',
    (interval) => {
      expect(() => getCoreV2AriaRecoveryPollIntervalMs({ CORE_V2_ARIA_RECOVERY_POLL_INTERVAL_MS: interval }))
        .toThrow(CoreV2AriaRecoveryConfigError);
    },
  );

  it('uses the default interval and accepts both safe boundaries', () => {
    expect(getCoreV2AriaRecoveryPollIntervalMs({})).toBe(1_000);
    expect(getCoreV2AriaRecoveryPollIntervalMs({ CORE_V2_ARIA_RECOVERY_POLL_INTERVAL_MS: '250' })).toBe(250);
    expect(getCoreV2AriaRecoveryPollIntervalMs({ CORE_V2_ARIA_RECOVERY_POLL_INTERVAL_MS: '60000' })).toBe(60_000);
  });
});
