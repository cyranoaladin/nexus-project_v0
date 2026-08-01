export type BilanModelPolicy = Readonly<{
  schemaVersion: 'nexus-bilan-model-policy/v1';
  allowedModels: readonly string[];
}>;

export function requireAllowedBilanModel(
  policy: Readonly<{ schemaVersion: string; allowedModels: readonly string[] }>,
  configuredModel: string | undefined,
): string {
  if (
    policy.schemaVersion !== 'nexus-bilan-model-policy/v1'
    || !configuredModel
    || !policy.allowedModels.includes(configuredModel)
  ) {
    throw new Error('BILAN_MODEL_NOT_ALLOWLISTED');
  }
  return configuredModel;
}
