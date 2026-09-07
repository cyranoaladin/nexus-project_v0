import { inspectAriaSecuritySources, inspectRepositoryAriaSecurity } from '@/scripts/aria/check-security';
import {
  inspectAriaStaticManifestContract,
  resolveAriaRuntimeManifestConfiguration,
} from '@/scripts/aria/check-runtime-manifest';
import {
  formatAriaPerformanceQualification,
  inspectAriaPerformanceContract,
  measureAriaDeterministicPerformance,
} from '@/scripts/aria/check-performance';
import { inspectAriaSourceArtifact } from '@/scripts/aria/check-production-artifact';
import { validateAriaCoverageEvidence } from '@/scripts/aria/check-coverage';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const INSTRUMENTED_EXECUTION = `
  export async function run(dependencies: any) {
    const elapsed = (startedAt: number) => Math.max(0, dependencies.monotonicNow() - startedAt);
    let ragLatencyMs = elapsed(0);
    let timeToFirstTokenMs = elapsed(0);
    let generationDurationMs = elapsed(0);
    const finalizeStartedAt = 0;
    dependencies.telemetry.emit('RETRIEVAL', ragLatencyMs);
    for await (const token of dependencies.streamModel()) { void token; }
    dependencies.telemetry.emit('MODEL', generationDurationMs, { timeToFirstTokenMs });
    dependencies.telemetry.emit('FINALIZE', elapsed(finalizeStartedAt));
  }
`;

function performanceFixture(input: {
  readonly buildContext?: string;
  readonly loadStudent?: string;
  readonly execution?: string;
} = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'aria-performance-'));
  const conversation = join(root, 'lib/aria/application/conversation');
  mkdirSync(conversation, { recursive: true });
  writeFileSync(join(conversation, 'build-context.ts'), input.buildContext ?? 'export const build = () => null;');
  writeFileSync(join(conversation, 'load-authorization-student.ts'), input.loadStudent ?? 'export const load = () => null;');
  writeFileSync(join(conversation, 'run-conversation.ts'), input.execution ?? INSTRUMENTED_EXECUTION);
  return root;
}

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

  it('SECURITY_REJECTS_RESPONSE_CONSTRUCTOR_AND_LOCAL_SERIALIZER_ALIASES', () => {
    const findings = inspectAriaSecuritySources(new Map([
      ['app/api/aria/constructor/route.ts', `
        try { await provider(); }
        catch (error) { return new Response(error.message); }
      `],
      ['app/api/aria/local-serializer/route.ts', `
        function serializeAriaPublicError(value: unknown) { return value; }
        try { await provider(); }
        catch (error) { return Response.json(serializeAriaPublicError(error)); }
      `],
    ]));
    expect(findings).toEqual([
      { path: 'app/api/aria/constructor/route.ts', code: 'RAW_SERVER_ERROR_TO_CLIENT' },
      { path: 'app/api/aria/local-serializer/route.ts', code: 'RAW_SERVER_ERROR_TO_CLIENT' },
    ]);
  });

  it('SECURITY_ALLOWS_ONLY_CANONICAL_PUBLIC_ERROR_SERIALIZER', () => {
    const findings = inspectAriaSecuritySources(new Map([
      ['app/api/aria/canonical-serializer/route.ts', `
        import { serializeAriaPublicError as serializeSafeError }
          from '@/lib/aria/application/public-error';
        try { await provider(); }
        catch (error) {
          let body;
          body = serializeSafeError(error);
          return Response.json(body);
        }
      `],
    ]));
    expect(findings).toEqual([]);
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

  it('SECURITY_REJECTS_NAMED_EMPTY_PERSISTENCE_HANDLER', () => {
    const findings = inspectAriaSecuritySources(new Map([
      ['lib/aria/application/named-handler.ts', `
        const swallow = () => {};
        repository.save().catch(swallow);
      `],
      ['lib/aria/application/named-function-handler.ts', `
        function swallow() {}
        repository.save().catch(swallow);
      `],
    ]));

    expect(findings).toEqual([
      { path: 'lib/aria/application/named-function-handler.ts', code: 'SILENT_EMPTY_CATCH' },
      { path: 'lib/aria/application/named-handler.ts', code: 'SILENT_EMPTY_CATCH' },
    ]);
  });

  it('SECURITY_PERSISTENCE_HANDLER_RETURN_SHAPES_FAIL_CLOSED', () => {
    const findings = inspectAriaSecuritySources(new Map([
      ['lib/aria/application/return-empty.ts', 'repository.save().catch(() => { return; })'],
      ['lib/aria/application/return-null.ts', 'repository.save().catch(() => { return null; })'],
      ['lib/aria/application/return-undefined.ts', 'repository.save().catch(() => { return undefined; })'],
      ['lib/aria/application/non-function.ts', 'repository.save().catch(42)'],
    ]));

    expect(findings).toEqual([
      { path: 'lib/aria/application/return-empty.ts', code: 'SILENT_EMPTY_CATCH' },
      { path: 'lib/aria/application/return-null.ts', code: 'SILENT_EMPTY_CATCH' },
      { path: 'lib/aria/application/return-undefined.ts', code: 'SILENT_EMPTY_CATCH' },
    ]);
  });

  it('SECURITY_CANONICAL_IMPORT_AND_UNTRACKABLE_ASSIGNMENT_DO_NOT_TAINT_PUBLIC_ERRORS', () => {
    const findings = inspectAriaSecuritySources(new Map([
      ['app/api/aria/safe-unaliased/route.ts', `
        import { serializeAriaPublicError } from '@/lib/aria/application/public-error';
        try { await provider(); }
        catch (error) { return Response.json(serializeAriaPublicError(error)); }
      `],
      ['app/api/aria/untrackable-assignment/route.ts', `
        try { await provider(); }
        catch (error) {
          getBody().detail = error.message;
          return Response.json({ code: 'INTERNAL_ERROR' });
        }
      `],
    ]));

    expect(findings).toEqual([]);
  });

  it('SECURITY_PUBLIC_SERIALIZATION_COVERS_JSON_STRINGIFY_AND_ARGUMENTLESS_RESPONSE', () => {
    const findings = inspectAriaSecuritySources(new Map([
      ['app/api/aria/json-stringify/route.ts', `
        try { await provider(); }
        catch (error) { return new Response(JSON.stringify(error.message)); }
      `],
      ['app/api/aria/empty-response/route.ts', `
        try { await provider(); }
        catch (error) { void error; return new Response(); }
      `],
    ]));

    expect(findings).toEqual([
      { path: 'app/api/aria/json-stringify/route.ts', code: 'RAW_SERVER_ERROR_TO_CLIENT' },
    ]);
  });

  it('SECURITY_FINDINGS_SORT_BY_CODE_WHEN_PATHS_MATCH', () => {
    const findings = inspectAriaSecuritySources(new Map([
      ['lib/aria/application/same-path.ts', `
        const key = OPENAI_API_KEY || 'ollama';
        const client = new OpenAI({ apiKey: key });
      `],
    ]));

    expect(findings).toEqual([
      { path: 'lib/aria/application/same-path.ts', code: 'DIRECT_MODEL_CALL_OUTSIDE_GATEWAY' },
      { path: 'lib/aria/application/same-path.ts', code: 'FAKE_MODEL_CREDENTIAL_FALLBACK' },
    ]);
  });

  it('SECURITY_RAW_ERROR_TAINT_FOLLOWS_PROPERTY_ASSIGNMENT', () => {
    const findings = inspectAriaSecuritySources(new Map([
      ['app/api/aria/property-taint/route.ts', `
        try { await provider(); }
        catch (error) {
          const body = { code: 'INTERNAL_ERROR' };
          body.detail = error.message;
          return Response.json(body);
        }
      `],
    ]));

    expect(findings).toEqual([
      { path: 'app/api/aria/property-taint/route.ts', code: 'RAW_SERVER_ERROR_TO_CLIENT' },
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
      RAG_API_BASE_URL: 'http://127.0.0.1:4010',
      RAG_BFF_SERVICE_TOKEN: 'x'.repeat(32),
      RAG_MANIFEST_API_KEY: 'k'.repeat(32),
      ARIA_RAG_BASE_URL: 'https://legacy.invalid',
      ARIA_RAG_SERVICE_TOKEN: ['legacy', 'not', 'selected'].join('-'),
    })).toEqual({
      baseUrl: 'http://127.0.0.1:4010',
      serviceToken: 'x'.repeat(32),
      apiKey: 'k'.repeat(32),
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
        const elapsed = (startedAt: number) => dependencies.monotonicNow() - startedAt;
        const ragLatencyMs = elapsed(0);
        const timeToFirstTokenMs = elapsed(0);
        const generationDurationMs = elapsed(0);
        dependencies.telemetry.emit('RETRIEVAL', ragLatencyMs);
        for await (const token of dependencies.streamModel()) { void token; }
        dependencies.telemetry.emit('MODEL', generationDurationMs, { timeToFirstTokenMs });
        dependencies.telemetry.emit('FINALIZE', elapsed(0));
        return { ragLatencyMs, timeToFirstTokenMs, generationDurationMs };
      }
    `);
    expect(inspectAriaPerformanceContract(root)).toMatchObject({
      contextDbOperations: 2,
      dbWritesPerToken: 0,
    });
  });

  it('PERFORMANCE_REJECTS_CONTEXT_PRISMA_CALL_INSIDE_COLLECTION_LOOP', () => {
    const root = performanceFixture({
      buildContext: `
        export async function build(prisma: any, courseKeys: string[]) {
          for (const courseKey of courseKeys) {
            await prisma.course.findUnique({ where: { courseKey } });
          }
        }
      `,
    });
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_CONTEXT_QUERY_INSIDE_COLLECTION_LOOP');
  });

  it('PERFORMANCE_REJECTS_ALIASED_PRISMA_CALL_INSIDE_COLLECTION_LOOP', () => {
    const root = performanceFixture({
      buildContext: `
        export async function build(prisma: any, courseKeys: string[]) {
          const db = prisma;
          await Promise.all(courseKeys.map((courseKey) =>
            db.course.findUnique({ where: { courseKey } })));
        }
      `,
    });
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_CONTEXT_QUERY_INSIDE_COLLECTION_LOOP');
  });

  it('PERFORMANCE_REJECTS_TYPED_PRISMA_ALIAS_INSIDE_COLLECTION_LOOP', () => {
    const root = performanceFixture({
      buildContext: `
        export async function build(prisma: any, courseKeys: string[]) {
          const db = prisma as any;
          for (const courseKey of courseKeys) {
            await db.course.findUnique({ where: { courseKey } });
          }
        }
      `,
    });
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_CONTEXT_QUERY_INSIDE_COLLECTION_LOOP');
  });

  it('PERFORMANCE_REJECTS_PRISMA_QUERY_IN_NAMED_MAP_CALLBACK', () => {
    const root = performanceFixture({
      buildContext: `
        export async function build(prisma: any, courseKeys: string[]) {
          const loadCourse = (courseKey: string) =>
            prisma.course.findUnique({ where: { courseKey } });
          return Promise.all(courseKeys.map(loadCourse));
        }
      `,
    });
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_CONTEXT_QUERY_INSIDE_COLLECTION_LOOP');
  });

  it('PERFORMANCE_REJECTS_PRISMA_QUERY_IN_IMPORTED_CONTEXT_HELPER', () => {
    const root = performanceFixture({
      buildContext: `
        import { loadCourses } from './query-helper';
        export async function build(prisma: any, courseKeys: string[]) {
          return loadCourses(prisma, courseKeys);
        }
      `,
    });
    writeFileSync(join(root, 'lib/aria/application/conversation/query-helper.ts'), `
      export async function loadCourses(prisma: any, courseKeys: string[]) {
        return Promise.all(courseKeys.map((courseKey) =>
          prisma.course.findUnique({ where: { courseKey } })));
      }
    `);
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_CONTEXT_QUERY_INSIDE_COLLECTION_LOOP');
  });

  it('PERFORMANCE_REJECTS_PRISMA_QUERY_BEHIND_RUNTIME_BARREL_REEXPORT', () => {
    const root = performanceFixture({
      buildContext: `
        import { loadCourses } from './query-barrel';
        export async function build(prisma: any, courseKeys: string[]) {
          return loadCourses(prisma, courseKeys);
        }
      `,
    });
    writeFileSync(join(root, 'lib/aria/application/conversation/query-barrel.ts'),
      "export { loadCourses } from './query-helper';\n");
    writeFileSync(join(root, 'lib/aria/application/conversation/query-helper.ts'), `
      export async function loadCourses(db: any, courseKeys: string[]) {
        return Promise.all(courseKeys.map((courseKey) =>
          db.course.findUnique({ where: { courseKey } })));
      }
    `);
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_CONTEXT_QUERY_INSIDE_COLLECTION_LOOP');
  });

  it('PERFORMANCE_REJECTS_RENAMED_IMPORTED_PRISMA_HELPER', () => {
    const root = performanceFixture({
      buildContext: `
        import { loadCourses as fetchCourses } from './query-helper';
        export async function build(prisma: any, courseKeys: string[]) {
          return fetchCourses(prisma, courseKeys);
        }
      `,
    });
    writeFileSync(join(root, 'lib/aria/application/conversation/query-helper.ts'), `
      export async function loadCourses(db: any, courseKeys: string[]) {
        return Promise.all(courseKeys.map((courseKey) =>
          db.course.findUnique({ where: { courseKey } })));
      }
    `);
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_CONTEXT_QUERY_INSIDE_COLLECTION_LOOP');
  });

  it('PERFORMANCE_REJECTS_NAMESPACE_IMPORTED_PRISMA_HELPER', () => {
    const root = performanceFixture({
      buildContext: `
        import * as queries from './query-helper';
        export async function build(prisma: any, courseKeys: string[]) {
          return queries.loadCourses(prisma, courseKeys);
        }
      `,
    });
    writeFileSync(join(root, 'lib/aria/application/conversation/query-helper.ts'), `
      export async function loadCourses(db: any, courseKeys: string[]) {
        return Promise.all(courseKeys.map((courseKey) =>
          db.course.findUnique({ where: { courseKey } })));
      }
    `);
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_CONTEXT_QUERY_INSIDE_COLLECTION_LOOP');
  });

  it('PERFORMANCE_BINDING_RESOLUTION_IS_MODULE_SCOPED', () => {
    const root = performanceFixture({
      buildContext: `
        import { loadCourses as fetchCourses } from './query-helper';
        import './collision';
        export async function build(prisma: any, courseKeys: string[]) {
          return fetchCourses(prisma, courseKeys);
        }
      `,
    });
    writeFileSync(join(root, 'lib/aria/application/conversation/collision.ts'),
      "import { pure as fetchCourses } from './pure';\nvoid fetchCourses;\n");
    writeFileSync(join(root, 'lib/aria/application/conversation/pure.ts'),
      'export const pure = () => null;\n');
    writeFileSync(join(root, 'lib/aria/application/conversation/query-helper.ts'), `
      export async function loadCourses(db: any, courseKeys: string[]) {
        return Promise.all(courseKeys.map((courseKey) =>
          db.course.findUnique({ where: { courseKey } })));
      }
    `);
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_CONTEXT_QUERY_INSIDE_COLLECTION_LOOP');
  });

  it('PERFORMANCE_CONTEXT_FUNCTION_DEFINITIONS_ARE_MODULE_SCOPED_ON_NAME_COLLISION', () => {
    const root = performanceFixture({
      buildContext: `
        import { loadCourse as pureLoadCourse } from './safe-course-loader';
        export function build() { return pureLoadCourse(); }
      `,
      loadStudent: `
        import { loadCourse as queryCourse } from './query-course-loader';
        export function load(prisma: any) { return queryCourse(prisma); }
      `,
    });
    writeFileSync(join(root, 'lib/aria/application/conversation/safe-course-loader.ts'), `
      export function loadCourse(_value?: unknown) { return null; }
    `);
    writeFileSync(join(root, 'lib/aria/application/conversation/query-course-loader.ts'), `
      export function loadCourse(database: any) {
        return database.course.findUnique({ where: { id: 'course' } });
      }
    `);

    expect(inspectAriaPerformanceContract(root)).toMatchObject({ contextDbOperations: 1 });
  });

  it('PERFORMANCE_CONTEXT_IGNORES_UNCALLED_SAME_NAME_QUERY_HELPER', () => {
    const root = performanceFixture({
      buildContext: `
        import { loadCourse as unusedQueryCourse } from './query-course-loader';
        void unusedQueryCourse;
        export function build() { return null; }
      `,
      loadStudent: `
        import { loadCourse as pureLoadCourse } from './safe-course-loader';
        export function load(prisma: any) { return pureLoadCourse(prisma); }
      `,
    });
    writeFileSync(join(root, 'lib/aria/application/conversation/safe-course-loader.ts'), `
      export function loadCourse(_value?: unknown) { return null; }
    `);
    writeFileSync(join(root, 'lib/aria/application/conversation/query-course-loader.ts'), `
      export function loadCourse(database: any) {
        return database.course.findUnique({ where: { id: 'course' } });
      }
    `);

    expect(inspectAriaPerformanceContract(root)).toMatchObject({ contextDbOperations: 0 });
  });

  it('PERFORMANCE_REJECTS_PRISMA_QUERY_THROUGH_DESTRUCTURED_HELPER_PARAMETER', () => {
    const root = performanceFixture({
      buildContext: `
        function loadCourse({ course }: any, courseKeys: string[]) {
          return Promise.all(courseKeys.map((courseKey) =>
            course.findUnique({ where: { courseKey } })));
        }
        export function build(prisma: any, courseKeys: string[]) {
          return loadCourse(prisma, courseKeys);
        }
      `,
    });

    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_CONTEXT_QUERY_INSIDE_COLLECTION_LOOP');
  });

  it('PERFORMANCE_REJECTS_DEFAULT_IMPORTED_PRISMA_HELPER', () => {
    const root = performanceFixture({
      buildContext: `
        import loadCourses from './query-helper';
        export async function build(prisma: any, courseKeys: string[]) {
          return loadCourses(prisma, courseKeys);
        }
      `,
    });
    writeFileSync(join(root, 'lib/aria/application/conversation/query-helper.ts'), `
      export default async function fetchCourses(db: any, courseKeys: string[]) {
        return Promise.all(courseKeys.map((courseKey) =>
          db.course.findUnique({ where: { courseKey } })));
      }
    `);
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_CONTEXT_QUERY_INSIDE_COLLECTION_LOOP');
  });

  it('PERFORMANCE_COUNTS_PRISMA_TRANSACTION_CLIENT_OPERATIONS', () => {
    const root = performanceFixture({
      loadStudent: `
        import { prisma as db } from '@/lib/prisma';
        export async function load() {
          return db.$transaction(async (tx) => tx.student.findUnique({ where: { id: 'student' } }));
        }
      `,
    });
    expect(inspectAriaPerformanceContract(root)).toMatchObject({ contextDbOperations: 2 });
  });

  it('PERFORMANCE_IGNORES_NON_IDENTIFIER_TRANSACTION_RECEIVER', () => {
    const root = performanceFixture({
      loadStudent: `
        export async function load() {
          return getDatabase().$transaction(async (tx: any) =>
            tx.student.findUnique({ where: { id: 'student' } }));
        }
      `,
    });

    expect(inspectAriaPerformanceContract(root)).toMatchObject({ contextDbOperations: 0 });
  });

  it('PERFORMANCE_COUNTS_FUNCTION_EXPRESSION_TRANSACTION_CLIENT', () => {
    const root = performanceFixture({
      loadStudent: `
        import { prisma as db } from '@/lib/prisma';
        export async function load() {
          return db.$transaction(function (tx) {
            return tx.student.findUnique({ where: { id: 'student' } });
          });
        }
      `,
    });

    expect(inspectAriaPerformanceContract(root)).toMatchObject({ contextDbOperations: 2 });
  });

  it('PERFORMANCE_HANDLES_OMITTED_DESTRUCTURING_BINDING', () => {
    const root = performanceFixture({
      buildContext: `
        function helper([, value]: unknown[]) { return value; }
        export function build(prisma: unknown) { return helper([null, prisma]); }
      `,
    });

    expect(inspectAriaPerformanceContract(root)).toMatchObject({ contextDbOperations: 0 });
  });

  it('PERFORMANCE_FOLLOWS_STAR_REEXPORT_AFTER_EXTERNAL_EXPORT', () => {
    const root = performanceFixture({
      buildContext: `
        import { loadCourses } from './query-barrel';
        export function build(prisma: any, courseKeys: string[]) {
          return loadCourses(prisma, courseKeys);
        }
      `,
    });
    writeFileSync(join(root, 'lib/aria/application/conversation/query-barrel.ts'), `
      export { external } from 'external-package';
      export * from './query-helper';
    `);
    writeFileSync(join(root, 'lib/aria/application/conversation/query-helper.ts'), `
      export function loadCourses(db: any, courseKeys: string[]) {
        return Promise.all(courseKeys.map((courseKey) =>
          db.course.findUnique({ where: { courseKey } })));
      }
    `);

    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_CONTEXT_QUERY_INSIDE_COLLECTION_LOOP');
  });

  it('PERFORMANCE_FOLLOWS_DEFAULT_EXPORT_ASSIGNMENT', () => {
    const root = performanceFixture({
      buildContext: `
        import loadCourses from './query-helper';
        export function build(prisma: any, courseKeys: string[]) {
          return loadCourses(prisma, courseKeys);
        }
      `,
    });
    writeFileSync(join(root, 'lib/aria/application/conversation/query-helper.ts'), `
      async function loadCourses(db: any, courseKeys: string[]) {
        return Promise.all(courseKeys.map((courseKey) =>
          db.course.findUnique({ where: { courseKey } })));
      }
      export default loadCourses;
    `);

    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_CONTEXT_QUERY_INSIDE_COLLECTION_LOOP');
  });

  it.each([
    ['DIRECT', 'import { loadCourses } from \'./query-helper\';\nexport { loadCourses };'],
    ['RENAMED', 'import { loadCourses as queryCourses } from \'./query-helper\';\nexport { queryCourses as loadCourses };'],
  ] as const)('PERFORMANCE_FOLLOWS_LOCAL_%s_IMPORT_REEXPORT', (_case, barrel) => {
    const root = performanceFixture({
      buildContext: `
        import { loadCourses } from './query-barrel';
        export function build(prisma: any, courseKeys: string[]) {
          return loadCourses(prisma, courseKeys);
        }
      `,
    });
    writeFileSync(join(root, 'lib/aria/application/conversation/query-barrel.ts'), barrel);
    writeFileSync(join(root, 'lib/aria/application/conversation/query-helper.ts'), `
      export function loadCourses(db: any, courseKeys: string[]) {
        return Promise.all(courseKeys.map((courseKey) =>
          db.course.findUnique({ where: { courseKey } })));
      }
    `);

    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_CONTEXT_QUERY_INSIDE_COLLECTION_LOOP');
  });

  it('PERFORMANCE_FOLLOWS_LOCAL_DEFAULT_IMPORT_REEXPORT', () => {
    const root = performanceFixture({
      buildContext: `
        import loadCourses from './query-barrel';
        export function build(prisma: any, courseKeys: string[]) {
          return loadCourses(prisma, courseKeys);
        }
      `,
    });
    writeFileSync(join(root, 'lib/aria/application/conversation/query-barrel.ts'), `
      import loadCourses from './query-helper';
      export default loadCourses;
    `);
    writeFileSync(join(root, 'lib/aria/application/conversation/query-helper.ts'), `
      export default function loadCourses(db: any, courseKeys: string[]) {
        return Promise.all(courseKeys.map((courseKey) =>
          db.course.findUnique({ where: { courseKey } })));
      }
    `);

    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_CONTEXT_QUERY_INSIDE_COLLECTION_LOOP');
  });

  it('PERFORMANCE_EXPORT_RESOLUTION_TERMINATES_ON_CYCLE', () => {
    const root = performanceFixture({
      buildContext: `
        import { loadCourses } from './cycle-a';
        export function build() { return loadCourses; }
      `,
    });
    writeFileSync(join(root, 'lib/aria/application/conversation/cycle-a.ts'),
      "export * from './cycle-b';\n");
    writeFileSync(join(root, 'lib/aria/application/conversation/cycle-b.ts'),
      "export * from './cycle-a';\n");

    expect(inspectAriaPerformanceContract(root)).toMatchObject({ contextDbOperations: 0 });
  });

  it('PERFORMANCE_CONTEXT_HELPER_IGNORES_EXTRA_ARGUMENT_FOR_ROOT_PROPAGATION', () => {
    const root = performanceFixture({
      buildContext: `
        function loadStudent(db: any) {
          return db.student.findUnique({ where: { id: 'student' } });
        }
        export function build(prisma: any) { return loadStudent(prisma, 'extra'); }
      `,
    });

    expect(inspectAriaPerformanceContract(root)).toMatchObject({ contextDbOperations: 1 });
  });

  it('PERFORMANCE_COUNTS_TOP_LEVEL_PRISMA_CALL_WITHOUT_CALLBACK_OWNER', () => {
    const root = performanceFixture({
      buildContext: `
        prisma.course.findMany();
        export function build() { return null; }
      `,
    });

    expect(inspectAriaPerformanceContract(root)).toMatchObject({ contextDbOperations: 1 });
  });

  it('PERFORMANCE_REJECTS_ALIASED_REPOSITORY_WRITE_INSIDE_MODEL_LOOP', () => {
    const root = performanceFixture({
      execution: `
        export async function run(dependencies: any) {
          const elapsed = (startedAt: number) => dependencies.monotonicNow() - startedAt;
          let ragLatencyMs = elapsed(0);
          let timeToFirstTokenMs = elapsed(0);
          let generationDurationMs = elapsed(0);
          const persistence = dependencies.repository;
          dependencies.telemetry.emit('RETRIEVAL', ragLatencyMs);
          for await (const token of dependencies.streamModel()) {
            await persistence.checkpoint({ token });
          }
          dependencies.telemetry.emit('MODEL', generationDurationMs, { timeToFirstTokenMs });
          dependencies.telemetry.emit('FINALIZE', elapsed(0));
        }
      `,
    });
    expect(() => inspectAriaPerformanceContract(root)).toThrow('ARIA_DB_WRITES_PER_TOKEN:1');
  });

  it('PERFORMANCE_REJECTS_REPOSITORY_WRITE_INSIDE_ALIASED_MODEL_STREAM_LOOP', () => {
    const root = performanceFixture({
      execution: `
        export async function run(dependencies: any) {
          const elapsed = (startedAt: number) => dependencies.monotonicNow() - startedAt;
          let ragLatencyMs = elapsed(0);
          let timeToFirstTokenMs = elapsed(0);
          let generationDurationMs = elapsed(0);
          const stream = dependencies.streamModel();
          const persistence = dependencies.repository;
          dependencies.telemetry.emit('RETRIEVAL', ragLatencyMs);
          for await (const token of stream) { await persistence.checkpoint({ token }); }
          dependencies.telemetry.emit('MODEL', generationDurationMs, { timeToFirstTokenMs });
          dependencies.telemetry.emit('FINALIZE', elapsed(0));
        }
      `,
    });
    expect(() => inspectAriaPerformanceContract(root)).toThrow('ARIA_DB_WRITES_PER_TOKEN:1');
  });

  it('PERFORMANCE_REJECTS_TYPED_ALIASES_INSIDE_MODEL_STREAM_LOOP', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        'for await (const token of dependencies.streamModel()) { void token; }',
        `const stream = dependencies.streamModel() as AsyncIterable<string>;
         const persistence = dependencies.repository as any;
         for await (const token of stream) { await persistence.checkpoint({ token }); }`,
      ),
    });
    expect(() => inspectAriaPerformanceContract(root)).toThrow('ARIA_DB_WRITES_PER_TOKEN:1');
  });

  it('PERFORMANCE_REJECTS_REPOSITORY_WRITE_IN_HELPER_CALLED_FROM_MODEL_LOOP', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        'for await (const token of dependencies.streamModel()) { void token; }',
        `const persistence = dependencies.repository;
         const save = (token: string) => persistence.checkpoint({ token });
         for await (const token of dependencies.streamModel()) { await save(token); }`,
      ),
    });
    expect(() => inspectAriaPerformanceContract(root)).toThrow('ARIA_DB_WRITES_PER_TOKEN:1');
  });

  it('PERFORMANCE_REJECTS_IMPORTED_REPOSITORY_HELPER_CALLED_FROM_MODEL_LOOP', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION
        .replace('export async function run', "import { saveToken } from './save-helper';\nexport async function run")
        .replace(
          'for await (const token of dependencies.streamModel()) { void token; }',
          'for await (const token of dependencies.streamModel()) { await saveToken(dependencies.repository, token); }',
        ),
    });
    writeFileSync(join(root, 'lib/aria/application/conversation/save-helper.ts'), `
      export const saveToken = (persistence: any, token: string) =>
        persistence.checkpoint({ token });
    `);
    expect(() => inspectAriaPerformanceContract(root)).toThrow('ARIA_DB_WRITES_PER_TOKEN:1');
  });

  it('PERFORMANCE_STREAM_HELPER_DEFINITIONS_ARE_MODULE_SCOPED_ON_NAME_COLLISION', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION
        .replace('export async function run', `import { persist as purePersist } from './safe-persist';
          import { persist as writePersist } from './write-persist';
          void purePersist;
          export async function run`)
        .replace(
          'for await (const token of dependencies.streamModel()) { void token; }',
          'for await (const token of dependencies.streamModel()) { await writePersist(dependencies.repository, token); }',
        ),
    });
    writeFileSync(join(root, 'lib/aria/application/conversation/safe-persist.ts'), `
      export function persist(_value?: unknown) { return null; }
    `);
    writeFileSync(join(root, 'lib/aria/application/conversation/write-persist.ts'), `
      export function persist(repository: any, token: string) {
        return repository.checkpoint({ token });
      }
    `);

    expect(() => inspectAriaPerformanceContract(root)).toThrow('ARIA_DB_WRITES_PER_TOKEN:1');
  });

  it('PERFORMANCE_STREAM_IGNORES_UNCALLED_SAME_NAME_WRITE_HELPER', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION
        .replace('export async function run', `import { persist as unusedWrite } from './write-persist';
          import { persist as purePersist } from './safe-persist';
          void unusedWrite;
          export async function run`)
        .replace(
          'for await (const token of dependencies.streamModel()) { void token; }',
          'for await (const token of dependencies.streamModel()) { purePersist(token); }',
        ),
    });
    writeFileSync(join(root, 'lib/aria/application/conversation/safe-persist.ts'), `
      export function persist(_value?: unknown) { return null; }
    `);
    writeFileSync(join(root, 'lib/aria/application/conversation/write-persist.ts'), `
      export function persist(repository: any, token: string) {
        return repository.checkpoint({ token });
      }
    `);

    expect(inspectAriaPerformanceContract(root)).toMatchObject({ dbWritesPerToken: 0 });
  });

  it('PERFORMANCE_REJECTS_MODEL_LOOP_WRITE_THROUGH_DESTRUCTURED_REPOSITORY_PARAMETER', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        'for await (const token of dependencies.streamModel()) { void token; }',
        `function persist({ checkpoint }: any, token: string) {
           return checkpoint({ token });
         }
         for await (const token of dependencies.streamModel()) {
           await persist(dependencies.repository, token);
         }`,
      ),
    });

    expect(() => inspectAriaPerformanceContract(root)).toThrow('ARIA_DB_WRITES_PER_TOKEN:1');
  });

  it('PERFORMANCE_REJECTS_RENAMED_IMPORTED_REPOSITORY_HELPER', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION
        .replace('export async function run', "import { saveToken as persistToken } from './save-helper';\nexport async function run")
        .replace(
          'for await (const token of dependencies.streamModel()) { void token; }',
          'for await (const token of dependencies.streamModel()) { await persistToken(dependencies.repository, token); }',
        ),
    });
    writeFileSync(join(root, 'lib/aria/application/conversation/save-helper.ts'), `
      export const saveToken = (persistence: any, token: string) =>
        persistence.checkpoint({ token });
    `);
    expect(() => inspectAriaPerformanceContract(root)).toThrow('ARIA_DB_WRITES_PER_TOKEN:1');
  });

  it('PERFORMANCE_REJECTS_DEFAULT_IMPORTED_REPOSITORY_HELPER', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION
        .replace('export async function run', "import saveToken from './save-helper';\nexport async function run")
        .replace(
          'for await (const token of dependencies.streamModel()) { void token; }',
          'for await (const token of dependencies.streamModel()) { await saveToken(dependencies.repository, token); }',
        ),
    });
    writeFileSync(join(root, 'lib/aria/application/conversation/save-helper.ts'), `
      export default function persistToken(persistence: any, token: string) {
        return persistence.checkpoint({ token });
      }
    `);
    expect(() => inspectAriaPerformanceContract(root)).toThrow('ARIA_DB_WRITES_PER_TOKEN:1');
  });

  it('PERFORMANCE_REJECTS_BRACKET_REPOSITORY_WRITE_INSIDE_MODEL_LOOP', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        'for await (const token of dependencies.streamModel()) { void token; }',
        "for await (const token of dependencies.streamModel()) { await dependencies.repository['checkpoint']({ token }); }",
      ),
    });
    expect(() => inspectAriaPerformanceContract(root)).toThrow('ARIA_DB_WRITES_PER_TOKEN:1');
  });

  it('PERFORMANCE_REJECTS_ASSIGNMENT_ALIASES_INSIDE_MODEL_LOOP', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        'for await (const token of dependencies.streamModel()) { void token; }',
        `let stream: AsyncIterable<string>;
         let persistence: any;
         stream = dependencies.streamModel();
         persistence = dependencies.repository;
         for await (const token of stream) { await persistence.checkpoint({ token }); }`,
      ),
    });
    expect(() => inspectAriaPerformanceContract(root)).toThrow('ARIA_DB_WRITES_PER_TOKEN:1');
  });

  it('PERFORMANCE_FOLLOWS_SHORTHAND_AND_CHAINED_STREAM_ALIASES', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        'for await (const token of dependencies.streamModel()) { void token; }',
        `const { repository, streamModel } = dependencies;
         const persistence = repository;
         const model = streamModel;
         const modelAlias = model;
         const stream = modelAlias();
         const streamAlias = stream;
         for await (const token of streamAlias) {
           await persistence.checkpoint({ token });
         }`,
      ),
    });

    expect(() => inspectAriaPerformanceContract(root)).toThrow('ARIA_DB_WRITES_PER_TOKEN:1');
  });

  it('PERFORMANCE_FOLLOWS_CHAINED_ASSIGNMENT_ALIASES', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        'for await (const token of dependencies.streamModel()) { void token; }',
        `let repositoryA: any;
         let repositoryB: any;
         let modelA: any;
         let modelB: any;
         let streamA: AsyncIterable<string>;
         let streamB: AsyncIterable<string>;
         repositoryA = dependencies.repository;
         repositoryB = repositoryA;
         modelA = dependencies.streamModel;
         modelB = modelA;
         streamA = modelB();
         streamB = streamA;
         for await (const token of streamB) {
           await repositoryB.checkpoint({ token });
         }`,
      ),
    });

    expect(() => inspectAriaPerformanceContract(root)).toThrow('ARIA_DB_WRITES_PER_TOKEN:1');
  });

  it('PERFORMANCE_MODEL_LOOP_HELPER_IGNORES_EXTRA_ARGUMENT_FOR_ALIAS_PROPAGATION', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        'for await (const token of dependencies.streamModel()) { void token; }',
        `function persist(repository: any) { return repository.checkpoint({}); }
         for await (const token of dependencies.streamModel()) {
           await persist(dependencies.repository, token);
         }`,
      ),
    });

    expect(() => inspectAriaPerformanceContract(root)).toThrow('ARIA_DB_WRITES_PER_TOKEN:1');
  });

  it('PERFORMANCE_REJECTS_COMMENT_ONLY_INSTRUMENTATION', () => {
    const root = performanceFixture({
      execution: `
        export async function run(dependencies: any) {
          // ragLatencyMs timeToFirstTokenMs generationDurationMs emit('FINALIZE'
          for await (const token of dependencies.streamModel()) { void token; }
        }
      `,
    });
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_PERFORMANCE_INSTRUMENTATION_MISSING:RAG_LATENCY');
  });

  it('PERFORMANCE_REJECTS_UNRELATED_EVENT_EMITTER_INSTRUMENTATION', () => {
    const root = performanceFixture({
      execution: `
        export async function run(dependencies: any, fake: any) {
          let ragLatencyMs = 0;
          let timeToFirstTokenMs = 0;
          let generationDurationMs = 0;
          fake.emit('RETRIEVAL', ragLatencyMs);
          for await (const token of dependencies.streamModel()) { void token; }
          fake.emit('MODEL', generationDurationMs, { timeToFirstTokenMs });
          fake.emit('FINALIZE', elapsed(0));
        }
      `,
    });
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_PERFORMANCE_INSTRUMENTATION_MISSING:RAG_LATENCY');
  });

  it('PERFORMANCE_REJECTS_TELEMETRY_EVENT_WITHOUT_MEASURED_DURATION', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        "dependencies.telemetry.emit('FINALIZE', elapsed(finalizeStartedAt));",
        "dependencies.telemetry.emit('FINALIZE', {});",
      ),
    });
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_PERFORMANCE_INSTRUMENTATION_MISSING:TERMINAL_PERSISTENCE_DURATION');
  });

  it('PERFORMANCE_REJECTS_INSTRUMENTATION_OUTSIDE_EXECUTION_PATH', () => {
    const root = performanceFixture({
      execution: `
        function deadInstrumentation(dependencies: any) {
          let ragLatencyMs = 0;
          let timeToFirstTokenMs = 0;
          let generationDurationMs = 0;
          const elapsed = (_startedAt: number) => 1;
          dependencies.telemetry.emit('RETRIEVAL', ragLatencyMs);
          dependencies.telemetry.emit('MODEL', generationDurationMs, { timeToFirstTokenMs });
          dependencies.telemetry.emit('FINALIZE', elapsed(0));
        }
        export async function run(dependencies: any) {
          for await (const token of dependencies.streamModel()) { void token; }
        }
      `,
    });
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_PERFORMANCE_INSTRUMENTATION_MISSING:RAG_LATENCY');
  });

  it('PERFORMANCE_REJECTS_INSTRUMENTATION_IN_STATICALLY_DEAD_BRANCH', () => {
    const root = performanceFixture({
      execution: `
        export async function run(dependencies: any) {
          let ragLatencyMs = 0;
          let timeToFirstTokenMs = 0;
          let generationDurationMs = 0;
          const elapsed = (_startedAt: number) => 1;
          if (false) {
            dependencies.telemetry.emit('RETRIEVAL', ragLatencyMs);
            dependencies.telemetry.emit('MODEL', generationDurationMs, { timeToFirstTokenMs });
            dependencies.telemetry.emit('FINALIZE', elapsed(0));
          }
          for await (const token of dependencies.streamModel()) { void token; }
        }
      `,
    });
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_PERFORMANCE_INSTRUMENTATION_MISSING:RAG_LATENCY');
  });

  it('PERFORMANCE_REJECTS_UNCALLED_NESTED_TELEMETRY_HELPER', () => {
    const root = performanceFixture({
      execution: `
        export async function run(dependencies: any) {
          const dead = () => {
            let ragLatencyMs = 0;
            let timeToFirstTokenMs = 0;
            let generationDurationMs = 0;
            const elapsed = (_startedAt: number) => 1;
            dependencies.telemetry.emit('RETRIEVAL', ragLatencyMs);
            dependencies.telemetry.emit('MODEL', generationDurationMs, { timeToFirstTokenMs });
            dependencies.telemetry.emit('FINALIZE', elapsed(0));
          };
          for await (const token of dependencies.streamModel()) { void token; }
        }
      `,
    });
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_PERFORMANCE_INSTRUMENTATION_MISSING:RAG_LATENCY');
  });

  it('PERFORMANCE_REJECTS_TELEMETRY_AFTER_UNCONDITIONAL_RETURN', () => {
    const root = performanceFixture({
      execution: `
        export async function run(dependencies: any) {
          for await (const token of dependencies.streamModel()) { void token; }
          return;
          const elapsed = (startedAt: number) => dependencies.monotonicNow() - startedAt;
          let ragLatencyMs = elapsed(0);
          let timeToFirstTokenMs = elapsed(0);
          let generationDurationMs = elapsed(0);
          dependencies.telemetry.emit('RETRIEVAL', ragLatencyMs);
          dependencies.telemetry.emit('MODEL', generationDurationMs, { timeToFirstTokenMs });
          dependencies.telemetry.emit('FINALIZE', elapsed(0));
        }
      `,
    });
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_PERFORMANCE_INSTRUMENTATION_MISSING:RAG_LATENCY');
  });

  it('PERFORMANCE_REJECTS_TELEMETRY_AFTER_LITERAL_TRUE_RETURN', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        "dependencies.telemetry.emit('RETRIEVAL', ragLatencyMs);",
        "if (true) return;\ndependencies.telemetry.emit('RETRIEVAL', ragLatencyMs);",
      ),
    });
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_PERFORMANCE_INSTRUMENTATION_MISSING:RAG_LATENCY');
  });

  it('PERFORMANCE_REJECTS_HARDCODED_LATENCY_VALUES', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION
        .replace('let ragLatencyMs = elapsed(0);', 'let ragLatencyMs = 0;')
        .replace('let timeToFirstTokenMs = elapsed(0);', 'let timeToFirstTokenMs = 0;')
        .replace('let generationDurationMs = elapsed(0);', 'let generationDurationMs = 0;'),
    });
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_PERFORMANCE_INSTRUMENTATION_MISSING:RAG_LATENCY');
  });

  it('PERFORMANCE_REQUIRES_ELAPSED_TO_DERIVE_FROM_MONOTONIC_CLOCK', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        'const elapsed = (startedAt: number) => Math.max(0, dependencies.monotonicNow() - startedAt);',
        'const elapsed = (_startedAt: number) => 1;',
      ),
    });
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_PERFORMANCE_INSTRUMENTATION_MISSING:MONOTONIC_CLOCK');
  });

  it('PERFORMANCE_REJECTS_MONOTONIC_CLOCK_REFERENCE_WITHOUT_CALL', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        'const elapsed = (startedAt: number) => Math.max(0, dependencies.monotonicNow() - startedAt);',
        'const elapsed = (_startedAt: number) => { void dependencies.monotonicNow; return 1; };',
      ),
    });
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_PERFORMANCE_INSTRUMENTATION_MISSING:MONOTONIC_CLOCK');
  });

  it('PERFORMANCE_REJECTS_MONOTONIC_TIMESTAMP_AS_ELAPSED_DURATION', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        'const elapsed = (startedAt: number) => Math.max(0, dependencies.monotonicNow() - startedAt);',
        'const elapsed = (_startedAt: number) => dependencies.monotonicNow();',
      ),
    });
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_PERFORMANCE_INSTRUMENTATION_MISSING:MONOTONIC_CLOCK');
  });

  it('PERFORMANCE_REJECTS_OVERWRITTEN_LATENCY_BEFORE_EMIT', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        "dependencies.telemetry.emit('RETRIEVAL', ragLatencyMs);",
        "ragLatencyMs = 0;\ndependencies.telemetry.emit('RETRIEVAL', ragLatencyMs);",
      ),
    });
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_PERFORMANCE_INSTRUMENTATION_MISSING:RAG_LATENCY');
  });

  it('PERFORMANCE_REJECTS_QUERY_BUDGET_OVERFLOW', () => {
    const calls = Array.from({ length: 9 }, (_, index) =>
      `await prisma.course.findUnique({ where: { id: '${index}' } });`).join('\n');
    const root = performanceFixture({
      buildContext: `export async function build(prisma: any) { ${calls} }`,
    });
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_CONTEXT_QUERY_BUDGET_EXCEEDED:9');
  });

  it('PERFORMANCE_REJECTS_MISSING_INSTRUMENTATION', () => {
    const root = performanceFixture({
      execution: `
        export async function run(dependencies: any) {
          for await (const token of dependencies.streamModel()) { void token; }
          dependencies.telemetry.emit('FINALIZE', {});
        }
      `,
    });
    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_PERFORMANCE_INSTRUMENTATION_MISSING:RAG_LATENCY');
  });

  it('PERFORMANCE_FOLLOWS_DESTRUCTURED_PRISMA_DELEGATE', () => {
    const root = performanceFixture({
      buildContext: `
        export async function build(prisma: any, courseKeys: string[]) {
          const { course } = prisma;
          return Promise.all(courseKeys.map((courseKey) =>
            course.findUnique({ where: { courseKey } })));
        }
      `,
    });

    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_CONTEXT_QUERY_INSIDE_COLLECTION_LOOP');
  });

  it('PERFORMANCE_FOLLOWS_DESTRUCTURED_REPOSITORY_AND_STREAM_MODEL', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        'for await (const token of dependencies.streamModel()) { void token; }',
        `const { repository: persistence, streamModel: model } = dependencies;
         for await (const token of model()) { await persistence.checkpoint({ token }); }`,
      ),
    });

    expect(() => inspectAriaPerformanceContract(root)).toThrow('ARIA_DB_WRITES_PER_TOKEN:1');
  });

  it('PERFORMANCE_FOLLOWS_ASSIGNED_STREAM_FACTORY', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        'for await (const token of dependencies.streamModel()) { void token; }',
        `let model: typeof dependencies.streamModel;
         model = dependencies.streamModel;
         for await (const token of model()) {
           await dependencies.repository.checkpoint({ token });
         }`,
      ),
    });

    expect(() => inspectAriaPerformanceContract(root)).toThrow('ARIA_DB_WRITES_PER_TOKEN:1');
  });

  it('PERFORMANCE_IGNORES_UNCALLED_NESTED_WRITE_FUNCTION', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        'for await (const token of dependencies.streamModel()) { void token; }',
        `const persist = (token: string) => dependencies.repository.checkpoint({ token });
         for await (const token of dependencies.streamModel()) {
           const dead = () => persist(token);
           void dead;
         }`,
      ),
    });

    expect(inspectAriaPerformanceContract(root)).toMatchObject({ dbWritesPerToken: 0 });
  });

  it('PERFORMANCE_REJECTS_MISSING_EXECUTION_PATH', () => {
    const root = performanceFixture({
      execution: 'export async function run() { return null; }',
    });

    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_PERFORMANCE_EXECUTION_PATH_MISSING');
  });

  it.each([
    ['LITERAL_FALSE_ELSE', 'if (false) { return; } else {'],
    ['DYNAMIC_ELSE', 'if (dependencies.enabled) { void 0; } else {'],
  ] as const)('PERFORMANCE_TRAVERSES_%s_REACHABLE_BRANCH', (_name, opening) => {
    const root = performanceFixture({
      execution: `
        export async function run(dependencies: any) {
          const elapsed = (startedAt: number) => dependencies.monotonicNow() - startedAt;
          let ragLatencyMs = elapsed(0);
          let timeToFirstTokenMs = elapsed(0);
          let generationDurationMs = elapsed(0);
          for await (const token of dependencies.streamModel()) { void token; }
          ${opening}
            dependencies.telemetry.emit('RETRIEVAL', ragLatencyMs);
            dependencies.telemetry.emit('MODEL', generationDurationMs, { timeToFirstTokenMs });
            dependencies.telemetry.emit('FINALIZE', elapsed(0));
          }
        }
      `,
    });

    expect(inspectAriaPerformanceContract(root)).toMatchObject({ dbWritesPerToken: 0 });
  });

  it('PERFORMANCE_REACHABILITY_HANDLES_EMPTY_AND_TERMINAL_BRANCHES', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        "dependencies.telemetry.emit('FINALIZE', elapsed(finalizeStartedAt));",
        `dependencies.telemetry.emit('FINALIZE', elapsed(finalizeStartedAt));
         if (true) {}
         if (dependencies.done) { return; } else { throw new Error('done'); }`,
      ),
    });

    expect(inspectAriaPerformanceContract(root)).toMatchObject({ dbWritesPerToken: 0 });
  });

  it('PERFORMANCE_ACCEPTS_FUNCTION_EXPRESSION_WITH_NESTED_MONOTONIC_CALL', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        'const elapsed = (startedAt: number) => Math.max(0, dependencies.monotonicNow() - startedAt);',
        `const elapsed = function (startedAt: number) {
           return (dependencies.monotonicNow() + 0) - startedAt;
         };`,
      ),
    });

    expect(inspectAriaPerformanceContract(root)).toMatchObject({ dbWritesPerToken: 0 });
  });

  it('PERFORMANCE_REJECTS_TELEMETRY_WITH_MISSING_DURATION_ARGUMENT', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        "dependencies.telemetry.emit('RETRIEVAL', ragLatencyMs);",
        "dependencies.telemetry.emit('RETRIEVAL');",
      ),
    });

    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_PERFORMANCE_INSTRUMENTATION_MISSING:RAG_LATENCY');
  });

  it('PERFORMANCE_REJECTS_MISSING_ELAPSED_FUNCTION', () => {
    const root = performanceFixture({
      execution: INSTRUMENTED_EXECUTION.replace(
        'const elapsed = (startedAt: number) => Math.max(0, dependencies.monotonicNow() - startedAt);',
        'declare const elapsed: (startedAt: number) => number;',
      ),
    });

    expect(() => inspectAriaPerformanceContract(root))
      .toThrow('ARIA_PERFORMANCE_INSTRUMENTATION_MISSING:MONOTONIC_CLOCK');
  });

  it.each([Number.NaN, 4, 101, 5.5])(
    'PERFORMANCE_REJECTS_INVALID_MEASUREMENT_ITERATIONS_%s',
    (iterations) => {
      expect(() => measureAriaDeterministicPerformance(iterations))
        .toThrow('ARIA_PERFORMANCE_ITERATIONS_INVALID');
    },
  );

  it('PERFORMANCE_MEASURES_WITH_DEFAULT_ITERATION_COUNT', () => {
    const measured = measureAriaDeterministicPerformance();
    expect(Number.isFinite(measured.history100TurnsP95Ms)).toBe(true);
    expect(Number.isFinite(measured.sse500EventsP95Ms)).toBe(true);
    expect(measured.history100TurnsP95Ms).toBeGreaterThanOrEqual(0);
    expect(measured.sse500EventsP95Ms).toBeGreaterThanOrEqual(0);
  });

  it('PERFORMANCE_QUALIFICATION_FORMATS_OBSERVED_METRICS_AND_ENFORCES_EACH_BUDGET', () => {
    const contract = {
      contextDbOperations: 1,
      dbWritesPerToken: 0,
      instrumentation: [
        'RAG_LATENCY',
        'TIME_TO_FIRST_TOKEN',
        'GENERATION_DURATION',
        'TERMINAL_PERSISTENCE_DURATION',
      ],
    } as const;
    expect(formatAriaPerformanceQualification({
      contract,
      measured: { history100TurnsP95Ms: 1.25, sse500EventsP95Ms: 2.5 },
      fixtureOverheadP95Ms: 3,
    })).toBe([
      'ARIA_CONTEXT_DB_OPERATIONS_OBSERVED=1',
      'ARIA_DB_WRITES_PER_TOKEN=0',
      'ARIA_HISTORY_100_TURNS_P95_MS=1.250',
      'ARIA_SSE_500_EVENTS_P95_MS=2.500',
      'ARIA_LATENCY_INSTRUMENTATION=RAG_LATENCY,TIME_TO_FIRST_TOKEN,GENERATION_DURATION,TERMINAL_PERSISTENCE_DURATION',
      '',
    ].join('\n'));
    expect(() => formatAriaPerformanceQualification({
      contract,
      measured: { history100TurnsP95Ms: 3.1, sse500EventsP95Ms: 1 },
      fixtureOverheadP95Ms: 3,
    })).toThrow('ARIA_DETERMINISTIC_PERFORMANCE_BUDGET_EXCEEDED');
    expect(() => formatAriaPerformanceQualification({
      contract,
      measured: { history100TurnsP95Ms: 1, sse500EventsP95Ms: 3.1 },
      fixtureOverheadP95Ms: 3,
    })).toThrow('ARIA_DETERMINISTIC_PERFORMANCE_BUDGET_EXCEEDED');
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
