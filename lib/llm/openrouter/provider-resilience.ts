import 'server-only';

import { z } from 'zod';

import capabilityBaseline from '@/content/bilans/model-policies/openrouter-capability-baseline-v1.1.json';

import { BILAN_MODEL_POLICY, BILAN_TRANSPORT_POLICY } from './policy';
import type { OpenRouterOutputTokenParameter } from './types';

const ProviderTagSchema = z.string().regex(
  /^[a-z0-9][a-z0-9._-]{1,79}(?:\/[a-z0-9][a-z0-9._-]{0,79})?$/,
);
const EndpointSchema = z.object({
  model_id: z.string().min(1).max(160),
  provider_name: z.string().trim().min(1).max(120),
  tag: ProviderTagSchema,
  supported_parameters: z.array(
    z.string().min(1).max(80),
  ).max(100),
}).passthrough();
const ZdrEndpointCatalogSchema = z.object({
  data: z.array(z.unknown()).max(10_000),
}).passthrough();
const ProviderCatalogSchema = z.object({
  data: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    slug: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/),
  }).passthrough()).max(1_000),
}).passthrough();

type ApprovedModel = keyof typeof BILAN_TRANSPORT_POLICY.outputTokenParameters;

const APPROVED_MODELS: readonly ApprovedModel[] = [
  BILAN_MODEL_POLICY.primaryModel,
  ...BILAN_MODEL_POLICY.fallbackModels,
];

const MODEL_ALIASES = new Map<ApprovedModel, ReadonlySet<string>>(
  APPROVED_MODELS.map((model) => {
    const baseline = capabilityBaseline.data.find(({ id }) => id === model);
    if (baseline === undefined) {
      throw new Error(`Missing capability baseline for ${model}.`);
    }
    return [model, new Set([model, baseline.canonical_slug])];
  }),
);

function modelForEndpoint(modelId: string): ApprovedModel | null {
  for (const [model, aliases] of MODEL_ALIASES) {
    if (aliases.has(modelId)) return model;
  }
  return null;
}

function isCompatibleEndpoint(
  model: ApprovedModel,
  supportedParameters: readonly string[],
): boolean {
  const supported = new Set(supportedParameters);
  return (
    supported.has('response_format')
    && supported.has('structured_outputs')
    && supported.has('reasoning')
    && supported.has(
      BILAN_TRANSPORT_POLICY.outputTokenParameters[model],
    )
  );
}

function compatibleEndpoints(catalog: unknown, providerCatalog: unknown) {
  const parsed = ZdrEndpointCatalogSchema.parse(catalog);
  const providers = ProviderCatalogSchema.parse(providerCatalog);
  const providerSlugs = new Map<string, string>();
  for (const provider of providers.data) {
    if (providerSlugs.has(provider.name)) {
      throw new Error('Duplicate OpenRouter provider name.');
    }
    providerSlugs.set(provider.name, provider.slug);
  }
  const seen = new Set<string>();
  const values = parsed.data.flatMap((rawEndpoint) => {
    if (
      rawEndpoint === null
      || typeof rawEndpoint !== 'object'
      || !('model_id' in rawEndpoint)
      || typeof rawEndpoint.model_id !== 'string'
    ) {
      return [];
    }
    const model = modelForEndpoint(rawEndpoint.model_id);
    if (model === null) return [];
    const endpoint = EndpointSchema.parse(rawEndpoint);
    if (!isCompatibleEndpoint(model, endpoint.supported_parameters)) return [];
    const providerRoutingSlug = providerSlugs.get(endpoint.provider_name);
    if (providerRoutingSlug === undefined) {
      throw new Error('Endpoint provider is absent from the provider catalog.');
    }
    const key = `${model}\0${endpoint.tag}`;
    if (seen.has(key)) {
      throw new Error('Duplicate OpenRouter endpoint provider tag.');
    }
    seen.add(key);
    return [{
      model,
      providerName: endpoint.provider_name,
      providerTag: endpoint.tag,
      providerRoutingSlug,
      outputTokenParameter:
        BILAN_TRANSPORT_POLICY.outputTokenParameters[model],
    }];
  });
  return values.sort((left, right) =>
    APPROVED_MODELS.indexOf(left.model)
      - APPROVED_MODELS.indexOf(right.model)
    || left.providerTag.localeCompare(right.providerTag));
}

export function buildProviderResilienceMatrix(
  catalog: unknown,
  providerCatalog: unknown,
) {
  const endpoints = compatibleEndpoints(catalog, providerCatalog);
  return APPROVED_MODELS.map((model) => {
    const outputTokenParameter: OpenRouterOutputTokenParameter =
      BILAN_TRANSPORT_POLICY.outputTokenParameters[model];
    const providers = endpoints
      .filter((endpoint) => endpoint.model === model)
      .map(({
        providerName: name,
        providerTag: tag,
        providerRoutingSlug: slug,
      }) => ({ name, tag, slug }));
    return Object.freeze({
      model,
      availableZdrProviders: Object.freeze(providers),
      dataCollectionDenyCompatible:
        'REQUEST_ENFORCEMENT_REQUIRED' as const,
      structuredOutputCompatible: providers.length > 0,
      reasoningLowCompatible: providers.length > 0,
      outputTokenParameter,
      preflightStatus: 'NOT_RUN' as const,
    });
  });
}

export function selectAlternativeProviderRoutes(
  catalog: unknown,
  providerCatalog: unknown,
  options: Readonly<{
    excludedProviderNames: readonly string[];
    maxCalls: number;
  }>,
) {
  if (
    !Number.isInteger(options.maxCalls)
    || options.maxCalls < 0
    || options.maxCalls > 2
  ) {
    throw new Error('Provider audit call cap must be between zero and two.');
  }
  const excluded = new Set(
    options.excludedProviderNames.map((value) => value.trim().toLowerCase()),
  );
  const selected: ReturnType<typeof compatibleEndpoints> = [];
  const selectedModels = new Set<string>();
  for (const endpoint of compatibleEndpoints(catalog, providerCatalog)) {
    if (
      selected.length >= options.maxCalls
      || selectedModels.has(endpoint.model)
      || excluded.has(endpoint.providerName.toLowerCase())
      || excluded.has(endpoint.providerTag.toLowerCase())
    ) {
      continue;
    }
    selected.push(endpoint);
    selectedModels.add(endpoint.model);
  }
  return selected;
}
