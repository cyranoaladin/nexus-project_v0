import OpenAI from 'openai';
import { AriaError } from '../../kernel/errors';
import {
  isAriaModelFallbackAuthorized,
  resolveAriaProviderCandidates,
  type AriaProviderCandidate,
} from './config';
import {
  DEFAULT_ARIA_MODEL_REQUIREMENTS,
  resolveAriaModelPolicy,
  type AriaModelRequirements,
} from './policy';
import { ARIA_PERFORMANCE_BUDGETS } from '../../domain/observability/performance-budgets';

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface AriaModelFallbackEvent {
  readonly fromProvider: AriaProviderCandidate['provider'];
  readonly toProvider: AriaProviderCandidate['provider'];
  readonly reasonCode: 'PRIMARY_PROVIDER_UNAVAILABLE';
}

export interface StreamChatOptions {
  /** Temporary compatibility guard: callers cannot override configured model selection. */
  readonly model?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly firstTokenTimeoutMs?: number;
  readonly requirements?: AriaModelRequirements;
  readonly onFallback?: (event: AriaModelFallbackEvent) => void;
}

export const ARIA_DEFAULT_TIMEOUT_MS = ARIA_PERFORMANCE_BUDGETS.totalModelTimeoutMs;

interface ExecutionSignal {
  readonly signal: AbortSignal;
  readonly timeoutReason: () => 'MODEL_TOTAL_TIMEOUT' | 'MODEL_FIRST_TOKEN_TIMEOUT' | null;
  readonly markFirstToken: () => void;
  readonly cleanup: () => void;
}

function createExecutionSignal(options: StreamChatOptions): ExecutionSignal {
  const timeoutMs = options.timeoutMs ?? ARIA_DEFAULT_TIMEOUT_MS;
  const firstTokenTimeoutMs = options.firstTokenTimeoutMs
    ?? Math.min(ARIA_PERFORMANCE_BUDGETS.firstTokenTimeoutMs, timeoutMs);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0
    || !Number.isFinite(firstTokenTimeoutMs) || firstTokenTimeoutMs <= 0
    || firstTokenTimeoutMs > timeoutMs) {
    throw new AriaError('INTERNAL_ERROR', 500, 'Configuration de délai ARIA invalide.', {
      reasonCode: 'MODEL_TIMEOUT_INVALID',
    });
  }
  const controller = new AbortController();
  let timeoutReason: 'MODEL_TOTAL_TIMEOUT' | 'MODEL_FIRST_TOKEN_TIMEOUT' | null = null;
  const totalTimeout = setTimeout(() => {
    timeoutReason = 'MODEL_TOTAL_TIMEOUT';
    controller.abort(timeoutReason);
  }, timeoutMs);
  const firstTokenTimeout = setTimeout(() => {
    timeoutReason = 'MODEL_FIRST_TOKEN_TIMEOUT';
    controller.abort(timeoutReason);
  }, firstTokenTimeoutMs);
  let firstTokenObserved = false;
  const onCallerAbort = () => controller.abort('USER_CANCELLED');

  if (options.signal?.aborted) controller.abort('USER_CANCELLED');
  else options.signal?.addEventListener('abort', onCallerAbort, { once: true });

  return {
    signal: controller.signal,
    timeoutReason: () => timeoutReason,
    markFirstToken: () => {
      if (firstTokenObserved) return;
      firstTokenObserved = true;
      clearTimeout(firstTokenTimeout);
    },
    cleanup: () => {
      clearTimeout(totalTimeout);
      clearTimeout(firstTokenTimeout);
      options.signal?.removeEventListener('abort', onCallerAbort);
    },
  };
}

function waitForProvider<T>(operation: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const complete = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      callback();
    };
    const onAbort = () => complete(() => reject(signal.reason));
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(operation).then(
      (value) => complete(() => resolve(value)),
      (error: unknown) => complete(() => reject(error)),
    );
  });
}

function classifyExecutionFailure(
  error: unknown,
  execution: ExecutionSignal,
  callerSignal: AbortSignal | undefined,
): AriaError {
  if (execution.timeoutReason()) {
    return new AriaError('MODEL_TIMEOUT', 504, 'Le modèle ARIA n’a pas répondu dans le délai autorisé.', {
      reasonCode: execution.timeoutReason(),
    });
  }
  if (callerSignal?.aborted) {
    if (
      callerSignal.reason === 'TURN_LEASE_LOST'
      || callerSignal.reason === 'TURN_HEARTBEAT_FAILED'
    ) {
      return new AriaError('INTERNAL_ERROR', 500, 'L’exécution ARIA a été interrompue.', {
        reasonCode: callerSignal.reason === 'TURN_LEASE_LOST'
          ? 'TURN_LEASE_LOST'
          : 'TURN_HEARTBEAT_FAILED',
      });
    }
    return new AriaError('USER_CANCELLED', 499, 'Génération ARIA annulée.', {
      reasonCode: 'USER_CANCELLED',
    });
  }
  if (error instanceof AriaError) return error;
  return new AriaError('MODEL_UNAVAILABLE', 503, 'Le modèle ARIA est temporairement indisponible.', {
    reasonCode: 'PROVIDER_REQUEST_FAILED',
  });
}

function createClient(candidate: AriaProviderCandidate): OpenAI {
  return new OpenAI({
    apiKey: candidate.apiKey,
    ...(candidate.baseURL ? { baseURL: candidate.baseURL } : {}),
  });
}

function selectCandidates(options: StreamChatOptions): readonly AriaProviderCandidate[] {
  const configured = resolveAriaProviderCandidates();
  const policy = resolveAriaModelPolicy({
    requirements: options.requirements ?? DEFAULT_ARIA_MODEL_REQUIREMENTS,
    candidates: configured,
    fallbackAuthorized: isAriaModelFallbackAuthorized(),
  });
  const selected = [policy.primary, ...policy.fallbacks].map((model) => {
    const candidate = configured.find((configuredCandidate) => configuredCandidate === model);
    if (!candidate) {
      throw new AriaError('INTERNAL_ERROR', 500, 'Politique modèle ARIA incohérente.', {
        reasonCode: 'MODEL_POLICY_CANDIDATE_LOST',
      });
    }
    return candidate;
  });
  if (options.model && options.model !== policy.primary.model) {
    throw new AriaError('MODEL_UNAVAILABLE', 503, 'Le modèle demandé ne respecte pas la politique ARIA.', {
      reasonCode: 'CALLER_MODEL_OVERRIDE_FORBIDDEN',
    });
  }
  return selected;
}

export function getAriaDefaultModel(): string {
  return selectCandidates({})[0].model;
}

/** The only provider execution path. JSON callers collect this same stream. */
export async function* streamChatCompletion(
  messages: readonly ChatMessage[],
  options: StreamChatOptions = {},
): AsyncGenerator<string, void, unknown> {
  const candidates = selectCandidates(options);
  const execution = createExecutionSignal(options);

  try {
    if (execution.signal.aborted) {
      throw classifyExecutionFailure(execution.signal.reason, execution, options.signal);
    }

    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
      const candidate = candidates[candidateIndex];
      let emitted = false;
      try {
        const response = await waitForProvider(
          createClient(candidate).chat.completions.create(
            {
              model: candidate.model,
              messages: messages.map((message) => ({ ...message })),
              max_tokens: options.maxTokens ?? 1_500,
              temperature: options.temperature ?? 0.7,
              stream: true,
            },
            { signal: execution.signal },
          ),
          execution.signal,
        );
        const iterator = response[Symbol.asyncIterator]();
        while (true) {
          const next = await waitForProvider(iterator.next(), execution.signal);
          if (next.done) return;
          const token = next.value.choices[0]?.delta?.content;
          if (token) {
            emitted = true;
            execution.markFirstToken();
            yield token;
          }
        }
      } catch (error: unknown) {
        const classified = classifyExecutionFailure(error, execution, options.signal);
        if (classified.code !== 'MODEL_UNAVAILABLE' || emitted) throw classified;
        const nextCandidate = candidates[candidateIndex + 1];
        if (!nextCandidate) throw classified;
        options.onFallback?.({
          fromProvider: candidate.provider,
          toProvider: nextCandidate.provider,
          reasonCode: 'PRIMARY_PROVIDER_UNAVAILABLE',
        });
      }
    }
  } finally {
    execution.cleanup();
  }
}

export async function callChatCompletion(
  messages: readonly ChatMessage[],
  options: StreamChatOptions = {},
): Promise<string> {
  let content = '';
  for await (const token of streamChatCompletion(messages, options)) content += token;
  return content;
}
