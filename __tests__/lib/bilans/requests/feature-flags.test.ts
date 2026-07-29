import {
  BILAN_FEATURE_FLAG_NAMES,
  getBilanFeatureFlags,
} from '@/lib/bilans/requests/feature-flags';

describe('bilan server feature flags', () => {
  it('defines only the five private server flag names', () => {
    expect(BILAN_FEATURE_FLAG_NAMES).toEqual([
      'BILAN_CANONICAL_INTAKE_ENABLED',
      'BILAN_MATHS_TERMINALE_PILOT_ENABLED',
      'BILAN_PROVISIONAL_RESULTS_ENABLED',
      'BILAN_TEAM_REALTIME_ENABLED',
      'BILAN_LLM_ENRICHMENT_ENABLED',
    ]);
    expect(BILAN_FEATURE_FLAG_NAMES.every((name) => !name.startsWith('NEXT_PUBLIC_'))).toBe(true);
  });

  it('defaults every flag to false in test and production environments', () => {
    expect(getBilanFeatureFlags({ NODE_ENV: 'test' })).toEqual({
      canonicalIntakeEnabled: false,
      mathsTerminalePilotEnabled: false,
      provisionalResultsEnabled: false,
      teamRealtimeEnabled: false,
      llmEnrichmentEnabled: false,
    });
    expect(getBilanFeatureFlags({ NODE_ENV: 'production' })).toEqual({
      canonicalIntakeEnabled: false,
      mathsTerminalePilotEnabled: false,
      provisionalResultsEnabled: false,
      teamRealtimeEnabled: false,
      llmEnrichmentEnabled: false,
    });
  });

  it.each(['1', 'true'])('enables a flag only for the exact value %s', (enabledValue) => {
    expect(
      getBilanFeatureFlags({
        BILAN_CANONICAL_INTAKE_ENABLED: enabledValue,
        BILAN_MATHS_TERMINALE_PILOT_ENABLED: enabledValue,
        BILAN_PROVISIONAL_RESULTS_ENABLED: enabledValue,
        BILAN_TEAM_REALTIME_ENABLED: enabledValue,
        BILAN_LLM_ENRICHMENT_ENABLED: enabledValue,
      }),
    ).toEqual({
      canonicalIntakeEnabled: true,
      mathsTerminalePilotEnabled: true,
      provisionalResultsEnabled: true,
      teamRealtimeEnabled: true,
      llmEnrichmentEnabled: true,
    });
  });

  it.each(['TRUE', 'True', 'yes', 'on', '0', ' true ', '01', ''])(
    'keeps all flags disabled for %j',
    (disabledValue) => {
      expect(
        Object.values(
          getBilanFeatureFlags({
            BILAN_CANONICAL_INTAKE_ENABLED: disabledValue,
            BILAN_MATHS_TERMINALE_PILOT_ENABLED: disabledValue,
            BILAN_PROVISIONAL_RESULTS_ENABLED: disabledValue,
            BILAN_TEAM_REALTIME_ENABLED: disabledValue,
            BILAN_LLM_ENRICHMENT_ENABLED: disabledValue,
          }),
        ),
      ).toEqual([false, false, false, false, false]);
    },
  );
});
