/** One deployment profile, shared by monitoring and the manifest gate. */
export function resolveDeploymentRagProfile(
  environment: Readonly<Record<string, string | undefined>>,
): 'CORE_ONLY' | 'RAG_ENABLED' {
  return environment.RAG_API_BASE_URL?.trim() ? 'RAG_ENABLED' : 'CORE_ONLY';
}
