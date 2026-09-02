import document from '../../data/aria/testing/e2e-scenarios.v1.json';

const SCENARIO_KEYS = [
  'normalNsi',
  'ragUnavailable',
  'ragTimeout',
  'noResults',
  'modelUnavailable',
  'modelTimeout',
  'hostileAssistantOutput',
  'longStream',
  'cancelAfterFirstDelta',
  'retryAfterFirstDelta',
] as const;

type AriaE2EScenarioKey = (typeof SCENARIO_KEYS)[number];
type AriaE2EScenarios = Readonly<Record<AriaE2EScenarioKey, string>>;

function parseScenarios(value: unknown): AriaE2EScenarios {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('ARIA_E2E_SCENARIO_REGISTRY_INVALID');
  }
  const record = value as Record<string, unknown>;
  const scenarios = record.scenarios;
  if (record.schemaVersion !== 1 || !scenarios || typeof scenarios !== 'object'
    || Array.isArray(scenarios)) {
    throw new Error('ARIA_E2E_SCENARIO_REGISTRY_INVALID');
  }
  const entries = Object.entries(scenarios);
  if (
    entries.length !== SCENARIO_KEYS.length
    || entries.some(([key, prompt]) =>
      !SCENARIO_KEYS.includes(key as AriaE2EScenarioKey)
      || typeof prompt !== 'string'
      || prompt.trim() !== prompt
      || prompt.length < 20
      || /[\[\]]/.test(prompt))
    || new Set(entries.map(([, prompt]) => prompt)).size !== entries.length
  ) {
    throw new Error('ARIA_E2E_SCENARIO_REGISTRY_INVALID');
  }
  return Object.freeze(Object.fromEntries(entries)) as AriaE2EScenarios;
}

export const ARIA_E2E_SCENARIOS = parseScenarios(document);
