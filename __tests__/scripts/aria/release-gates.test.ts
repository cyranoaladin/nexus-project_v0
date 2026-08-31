import { inspectAriaSecuritySources, inspectRepositoryAriaSecurity } from '@/scripts/aria/check-security';
import {
  inspectAriaStaticManifestContract,
  resolveAriaRuntimeManifestConfiguration,
} from '@/scripts/aria/check-runtime-manifest';
import { inspectAriaPerformanceContract } from '@/scripts/aria/check-performance';
import { inspectAriaSourceArtifact } from '@/scripts/aria/check-production-artifact';
import { validateAriaCoverageEvidence } from '@/scripts/aria/check-coverage';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('ARIA C16 release gates', () => {
  it('rejects silent persistence catches, raw public errors, fake credentials and direct provider calls', () => {
    const findings = inspectAriaSecuritySources(new Map([
      ['lib/aria/application/bad.ts', 'save().catch(() => {})'],
      ['app/api/aria/bad/route.ts', 'return Response.json({ error: error.message })'],
      ['lib/aria/infrastructure/model/config.ts', "const key = OPENAI_API_KEY || 'ollama'"],
      ['lib/aria/application/direct.ts', 'const client = new OpenAI({ apiKey })'],
    ]));
    expect(findings.map(({ code }) => code).sort()).toEqual([
      'DIRECT_MODEL_CALL_OUTSIDE_GATEWAY',
      'FAKE_MODEL_CREDENTIAL_FALLBACK',
      'RAW_SERVER_ERROR_TO_CLIENT',
      'SILENT_EMPTY_CATCH',
    ]);
  });

  it('SECURITY_RAW_SERVER_ERROR_TAINT_FOLLOWS_CATCH_BINDING', () => {
    const findings = inspectAriaSecuritySources(new Map([
      ['app/api/aria/aliased/route.ts', `
        try { await provider(); }
        catch (err) {
          const leakedDetail = err.message;
          return NextResponse.json({ error: leakedDetail });
        }
      `],
      ['app/api/aria/safe/route.ts', `
        try { await provider(); }
        catch (cause) { return toAriaErrorResponse(cause, logger); }
      `],
    ]));
    expect(findings).toEqual([
      { path: 'app/api/aria/aliased/route.ts', code: 'RAW_SERVER_ERROR_TO_CLIENT' },
    ]);
  });

  it('rejects discarded persistence failures without banning safe parsing fallbacks', () => {
    const findings = inspectAriaSecuritySources(new Map([
      ['lib/aria/application/save.ts', 'repository.save().catch(() => undefined)'],
      ['e2e/helpers/db.ts', 'prisma.student.delete().catch(() => null)'],
      ['scripts/e2e/seed.ts', 'try { await tx.record.create({ data }); } catch { /* ignored */ }'],
      ['lib/aria/application/parse.ts', 'try { return JSON.parse(input); } catch { return null; }'],
    ]));
    expect(findings).toEqual([
      { path: 'e2e/helpers/db.ts', code: 'SILENT_EMPTY_CATCH' },
      { path: 'lib/aria/application/save.ts', code: 'SILENT_EMPTY_CATCH' },
      { path: 'scripts/e2e/seed.ts', code: 'SILENT_EMPTY_CATCH' },
    ]);
  });

  it('passes the current repository only when every ARIA security metric is zero', () => {
    expect(inspectRepositoryAriaSecurity()).toMatchObject({
      filesInspected: expect.any(Number),
      findings: [],
    });
  });

  it('keeps retrieval disabled when no promoted servable manifest is versioned', () => {
    expect(inspectAriaStaticManifestContract(process.cwd())).toEqual({
      status: 'NOT_CONFIGURED',
      reasonCode: 'SERVABLE_INDEX_NOT_PROMOTED',
      ragMappingSourcesOfTruth: 1,
      resourceIdentitySourcesOfTruth: 1,
      ragDocumentIdentitySourcesOfTruth: 1,
    });
  });

  it('uses the same runtime RAG configuration names as the conversation engine', () => {
    expect(resolveAriaRuntimeManifestConfiguration({
      ARIA_RAG_ENGINE_BASE_URL: 'http://127.0.0.1:4010',
      RAG_BFF_SERVICE_TOKEN: 'x'.repeat(32),
      ARIA_RAG_BASE_URL: 'https://legacy.invalid',
      ARIA_RAG_SERVICE_TOKEN: ['legacy', 'not', 'selected'].join('-'),
    })).toEqual({
      baseUrl: 'http://127.0.0.1:4010',
      serviceToken: 'x'.repeat(32),
    });
    expect(() => resolveAriaRuntimeManifestConfiguration({})).toThrow(
      'ARIA_RAG_RUNTIME_CONFIGURATION_REQUIRED',
    );
  });

  it('observes one context query, no write per token and all latency instrumentation points', () => {
    expect(inspectAriaPerformanceContract(process.cwd())).toEqual({
      contextDbOperations: 1,
      dbWritesPerToken: 0,
      instrumentation: [
        'RAG_LATENCY',
        'TIME_TO_FIRST_TOKEN',
        'GENERATION_DURATION',
        'TERMINAL_PERSISTENCE_DURATION',
      ],
    });
  });

  it('PERFORMANCE_CONTEXT_QUERY_COUNTER_COUNTS_ALL_PRISMA_OPERATIONS', () => {
    const root = mkdtempSync(join(tmpdir(), 'aria-performance-'));
    const conversation = join(root, 'lib/aria/application/conversation');
    mkdirSync(conversation, { recursive: true });
    writeFileSync(join(conversation, 'build-context.ts'), `
      export async function build(prisma: any) {
        return prisma.entitlement.findMany({ where: { active: true } });
      }
    `);
    writeFileSync(join(conversation, 'load-authorization-student.ts'), `
      export async function load(prisma: any) {
        return prisma.student.findUnique({ where: { id: 'student' } });
      }
    `);
    writeFileSync(join(conversation, 'run-conversation.ts'), `
      export async function run(dependencies: any) {
        const ragLatencyMs = 0;
        const timeToFirstTokenMs = 0;
        const generationDurationMs = 0;
        for await (const token of dependencies.streamModel()) { void token; }
        dependencies.telemetry.emit('FINALIZE', {});
        return { ragLatencyMs, timeToFirstTokenMs, generationDurationMs };
      }
    `);
    expect(inspectAriaPerformanceContract(root)).toMatchObject({
      contextDbOperations: 2,
      dbWritesPerToken: 0,
    });
  });

  it('proves every active resource version and ARIA route has a production source artifact', async () => {
    await expect(inspectAriaSourceArtifact(process.cwd())).resolves.toMatchObject({
      status: 'READY',
      ariaRouteCount: 9,
      activeResourceVersionCount: 3,
    });
  });

  it('rejects coverage artifacts that are stale or omit a required execution lane', () => {
    const complete = {
      schemaVersion: 1 as const,
      headSha: 'a'.repeat(40),
      lanes: ['application', 'database', 'concurrency'] as const,
      laneArtifacts: {
        application: '1'.repeat(64),
        database: '2'.repeat(64),
        concurrency: '3'.repeat(64),
      },
      coverageFinalSha256: '4'.repeat(64),
      coverageSummarySha256: '5'.repeat(64),
    };
    const artifactDigests = {
      ...complete.laneArtifacts,
      coverageFinal: complete.coverageFinalSha256,
      coverageSummary: complete.coverageSummarySha256,
    };
    expect(validateAriaCoverageEvidence(complete, 'a'.repeat(40), artifactDigests)).toEqual(complete);
    expect(() => validateAriaCoverageEvidence(complete, 'b'.repeat(40))).toThrow(
      'ARIA_COVERAGE_GATE_FAILED:STALE_HEAD',
    );
    expect(() => validateAriaCoverageEvidence({
      ...complete,
      lanes: ['application', 'database'],
      laneArtifacts: {
        application: '1'.repeat(64),
        database: '2'.repeat(64),
      },
    }, 'a'.repeat(40))).toThrow('ARIA_COVERAGE_GATE_FAILED:LANES');
    expect(() => validateAriaCoverageEvidence(
      complete,
      'a'.repeat(40),
      { ...artifactDigests, database: '9'.repeat(64) },
    )).toThrow('ARIA_COVERAGE_GATE_FAILED:ARTIFACT_TAMPERED:database');
  });
});
