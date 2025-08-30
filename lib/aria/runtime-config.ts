// lib/aria/runtime-config.ts
// Runtime configuration for ARIA features (in-memory; optional Redis in future)

let _config = {
  amplify: true,
};

export type AriaRuntimeConfig = typeof _config;

export function getAriaConfig(): AriaRuntimeConfig {
  return { ..._config };
}

export function setAriaConfig(partial: Partial<AriaRuntimeConfig>) {
  _config = { ..._config, ...partial };
  return getAriaConfig();
}
