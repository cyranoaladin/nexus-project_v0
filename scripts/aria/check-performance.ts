import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import ts from 'typescript';
import {
  DEFAULT_ARIA_HISTORY_BUDGET,
  selectAriaPromptHistory,
  type AriaHistoryTurn,
} from '../../lib/aria/domain/conversation/history-budget';
import { ARIA_PERFORMANCE_BUDGETS } from '../../lib/aria/domain/observability/performance-budgets';
import { formatAriaSSEEvent } from '../../lib/aria/transport/sse-parser';

export interface AriaPerformanceContractReport {
  readonly contextDbOperations: number;
  readonly dbWritesPerToken: number;
  readonly instrumentation: readonly [
    'RAG_LATENCY',
    'TIME_TO_FIRST_TOKEN',
    'GENERATION_DURATION',
    'TERMINAL_PERSISTENCE_DURATION',
  ];
}

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

function callCount(ast: ts.SourceFile, expressionText: string): number {
  let count = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === expressionText) count += 1;
    node.forEachChild(visit);
  };
  visit(ast);
  return count;
}

function repositoryCallsInsideModelLoop(ast: ts.SourceFile): number {
  let count = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isForOfStatement(node) && node.awaitModifier) {
      const expression = node.expression.getText(ast);
      if (expression.includes('dependencies.streamModel')) {
        const body = node.statement.getText(ast);
        count += (body.match(/dependencies\.repository\./g) ?? []).length;
      }
    }
    node.forEachChild(visit);
  };
  visit(ast);
  return count;
}

export function inspectAriaPerformanceContract(repositoryRoot: string): AriaPerformanceContractReport {
  const contextPath = resolve(repositoryRoot, 'lib/aria/application/conversation/build-context.ts');
  const executionPath = resolve(repositoryRoot, 'lib/aria/application/conversation/run-conversation.ts');
  const contextSource = source(contextPath);
  const executionSource = source(executionPath);
  const contextAst = ts.createSourceFile(contextPath, contextSource, ts.ScriptTarget.Latest, true);
  const executionAst = ts.createSourceFile(executionPath, executionSource, ts.ScriptTarget.Latest, true);
  const contextDbOperations = callCount(contextAst, 'prisma.student.findUnique');
  const dbWritesPerToken = repositoryCallsInsideModelLoop(executionAst);
  const requiredInstrumentation = [
    ['ragLatencyMs', 'RAG_LATENCY'],
    ['timeToFirstTokenMs', 'TIME_TO_FIRST_TOKEN'],
    ['generationDurationMs', 'GENERATION_DURATION'],
    ["emit('FINALIZE'", 'TERMINAL_PERSISTENCE_DURATION'],
  ] as const;
  for (const [needle] of requiredInstrumentation) {
    if (!executionSource.includes(needle)) throw new Error(`ARIA_PERFORMANCE_INSTRUMENTATION_MISSING:${needle}`);
  }
  if (contextDbOperations > ARIA_PERFORMANCE_BUDGETS.contextDbOperationsMax) {
    throw new Error(`ARIA_CONTEXT_QUERY_BUDGET_EXCEEDED:${contextDbOperations}`);
  }
  if (dbWritesPerToken !== 0) throw new Error(`ARIA_DB_WRITES_PER_TOKEN:${dbWritesPerToken}`);
  return Object.freeze({
    contextDbOperations,
    dbWritesPerToken,
    instrumentation: Object.freeze(requiredInstrumentation.map(([, label]) => label)) as
      AriaPerformanceContractReport['instrumentation'],
  });
}

function percentile95(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

function fixtureTurns(): readonly AriaHistoryTurn[] {
  return Array.from({ length: 100 }, (_, index) => ({
    turnId: `turn-${String(index).padStart(3, '0')}`,
    createdAt: new Date(1_788_000_000_000 + index),
    user: { id: `user-${index}`, role: 'user' as const, content: `Question ${index}` },
    assistant: { id: `assistant-${index}`, role: 'assistant' as const, content: `Réponse ${index}` },
  }));
}

export function measureAriaDeterministicPerformance(iterations = 20): Readonly<{
  history100TurnsP95Ms: number;
  sse500EventsP95Ms: number;
}> {
  if (!Number.isSafeInteger(iterations) || iterations < 5 || iterations > 100) {
    throw new Error('ARIA_PERFORMANCE_ITERATIONS_INVALID');
  }
  const historyDurations: number[] = [];
  const sseDurations: number[] = [];
  const turns = fixtureTurns();
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let startedAt = performance.now();
    selectAriaPromptHistory(turns, DEFAULT_ARIA_HISTORY_BUDGET);
    historyDurations.push(performance.now() - startedAt);

    startedAt = performance.now();
    for (let index = 0; index < 500; index += 1) {
      formatAriaSSEEvent({ event: 'delta', data: { text: `token-${index}` } });
    }
    sseDurations.push(performance.now() - startedAt);
  }
  return Object.freeze({
    history100TurnsP95Ms: percentile95(historyDurations),
    sse500EventsP95Ms: percentile95(sseDurations),
  });
}

function main(): void {
  const contract = inspectAriaPerformanceContract(process.cwd());
  const measured = measureAriaDeterministicPerformance();
  if (measured.history100TurnsP95Ms > ARIA_PERFORMANCE_BUDGETS.fixtureOverheadP95Ms
    || measured.sse500EventsP95Ms > ARIA_PERFORMANCE_BUDGETS.fixtureOverheadP95Ms) {
    throw new Error('ARIA_DETERMINISTIC_PERFORMANCE_BUDGET_EXCEEDED');
  }
  process.stdout.write(`ARIA_CONTEXT_DB_OPERATIONS_OBSERVED=${contract.contextDbOperations}\n`);
  process.stdout.write(`ARIA_DB_WRITES_PER_TOKEN=${contract.dbWritesPerToken}\n`);
  process.stdout.write(`ARIA_HISTORY_100_TURNS_P95_MS=${measured.history100TurnsP95Ms.toFixed(3)}\n`);
  process.stdout.write(`ARIA_SSE_500_EVENTS_P95_MS=${measured.sse500EventsP95Ms.toFixed(3)}\n`);
  process.stdout.write(`ARIA_LATENCY_INSTRUMENTATION=${contract.instrumentation.join(',')}\n`);
}

if (require.main === module) main();
