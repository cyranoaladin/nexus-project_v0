import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const sourceFiles = (root: string): string[] => {
  const absoluteRoot = resolve(process.cwd(), root);
  return readdirSync(absoluteRoot, { withFileTypes: true }).flatMap((entry) => {
    const relative = `${root}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(relative);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [relative] : [];
  });
};

describe('canonical OpenRouter architecture boundary', () => {
  it('has one OpenRouter fetch implementation and no React consumer', () => {
    const productionFiles = ['app', 'components', 'lib', 'scripts']
      .flatMap(sourceFiles)
      .sort();
    const openRouterFetchFiles = productionFiles.filter((path) => {
      const source = read(path);
      return source.toLowerCase().includes('openrouter') && /\bfetch\s*\(/.test(source);
    });

    expect(openRouterFetchFiles).toEqual(['lib/llm/openrouter/client.ts']);
    expect(productionFiles.filter((path) => {
      const source = read(path);
      return /['"]use client['"]/.test(source)
        && source.includes('OPENROUTER_API_KEY');
    })).toEqual([]);
  });

  it('keeps the canonical engine independent from legacy Mistral and Chutes', () => {
    const engineSources = sourceFiles('lib/bilans/engine').map(read).join('\n');

    expect(engineSources).not.toMatch(/lib\/llm\/mistral/);
    expect(engineSources).not.toMatch(/generateBilanWithMistral/);
    expect(engineSources).not.toMatch(/ChutesClient|chutes-client/);
    expect(read('lib/bilans/engine/report-service.ts')).not.toMatch(
      /llm\/openrouter\/client|fetch\s*\(/i,
    );
  });

  it('keeps forbidden request keys out of the production payload builder', () => {
    const client = read('lib/llm/openrouter/client.ts');
    const payloadBuilder = client.slice(
      client.indexOf('const body: OpenRouterRequestBody'),
      client.indexOf('const startedAt'),
    );
    expect(payloadBuilder).not.toMatch(/\btemperature\s*:/);
    expect(payloadBuilder).not.toMatch(/\btop_p\s*:/);
    expect(payloadBuilder).not.toMatch(/\bseed\s*:/);
    expect(payloadBuilder).not.toMatch(/\btools\s*:/);
    expect(payloadBuilder).not.toMatch(/\bplugins\s*:/);
    expect(payloadBuilder).not.toMatch(/\bmodels\s*:/);
    expect(payloadBuilder).not.toMatch(/\busage\s*:/);
    expect(payloadBuilder).not.toContain('openrouter/auto');
    expect(payloadBuilder).not.toMatch(/-latest\b/);
  });

  it('uses the exact versioned retry plan without implicit model derivation', () => {
    const client = read('lib/llm/openrouter/client.ts');
    const policy = read(
      'content/bilans/model-policies/bilan-model-policy-v1.1.json',
    );

    expect(client).toContain(
      'BILAN_MODEL_POLICY.retryPolicy.attemptPlan',
    );
    expect(client).not.toMatch(
      /models\s*\[\s*Math\.min\s*\(\s*(?:index|attempt)/,
    );
    expect(policy).toContain('"id": "bilan-retry-policy"');
    expect(policy).toContain('"maxAttempts": 3');
  });

  it('keeps provider transport independent from Prisma and report workflows', () => {
    const providerSources = sourceFiles('lib/llm/openrouter')
      .map(read)
      .join('\n');

    expect(providerSources).not.toMatch(
      /@\/lib\/prisma|prisma\/schema|JobOutbox|report-service/,
    );
  });

  it('keeps the production container disabled and free of the legacy flag', () => {
    const productionCompose = read('docker-compose.prod.yml');

    expect(productionCompose).toContain(
      'BILAN_REPORT_GENERATION_MODE: ${BILAN_REPORT_GENERATION_MODE:-DISABLED}',
    );
    expect(productionCompose).not.toContain('BILAN_LLM_ENRICHMENT_ENABLED');
    expect(productionCompose).not.toMatch(
      /BILAN_OPENROUTER_(?:TEMPERATURE|TOP_P|SEED)/,
    );
  });
});
