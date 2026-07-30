import 'server-only';

export const BILAN_FEATURE_FLAG_NAMES = [
  'BILAN_CANONICAL_INTAKE_ENABLED',
  'BILAN_MATHS_TERMINALE_PILOT_ENABLED',
  'BILAN_PROVISIONAL_RESULTS_ENABLED',
  'BILAN_TEAM_REALTIME_ENABLED',
] as const;

export type BilanFeatureFlagName = (typeof BILAN_FEATURE_FLAG_NAMES)[number];

type BilanFeatureFlagEnvironment = Partial<Record<BilanFeatureFlagName, string | undefined>> & {
  NODE_ENV?: string;
};

export type BilanFeatureFlags = Readonly<{
  canonicalIntakeEnabled: boolean;
  mathsTerminalePilotEnabled: boolean;
  provisionalResultsEnabled: boolean;
  teamRealtimeEnabled: boolean;
}>;

function isEnabled(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

export function getBilanFeatureFlags(
  environment: BilanFeatureFlagEnvironment = process.env,
): BilanFeatureFlags {
  return {
    canonicalIntakeEnabled: isEnabled(environment.BILAN_CANONICAL_INTAKE_ENABLED),
    mathsTerminalePilotEnabled: isEnabled(environment.BILAN_MATHS_TERMINALE_PILOT_ENABLED),
    provisionalResultsEnabled: isEnabled(environment.BILAN_PROVISIONAL_RESULTS_ENABLED),
    teamRealtimeEnabled: isEnabled(environment.BILAN_TEAM_REALTIME_ENABLED),
  };
}
