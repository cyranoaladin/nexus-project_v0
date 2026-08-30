import { getCourse } from '@/lib/curriculum/catalog';
import type { AriaPedagogicalMode } from '../pedagogy/pedagogical-mode';
import { AriaError } from '../../errors';

export type AriaRetrievalPolicyKind =
  | 'NO_MODEL'
  | 'GENERAL_CHAT'
  | 'OPTIONAL_GROUNDING'
  | 'GROUNDED_REQUIRED'
  | 'RESOURCE_GROUNDED_REQUIRED';

export type AriaRagStatus =
  | 'NOT_CONFIGURED'
  | 'NO_RESULTS'
  | 'RUNTIME_UNAVAILABLE'
  | 'SUCCESS';

export interface AriaRequestedResourceContext {
  readonly resourceId: string;
  readonly resourceVersionId: string;
}

export interface ResolveAriaRetrievalPolicyInput {
  readonly task: AriaPedagogicalMode;
  readonly courseKey: string;
  readonly requestedResource?: AriaRequestedResourceContext;
  readonly agentRole: string;
  readonly visibility: 'STUDENT_PRIVATE' | 'COACH_VISIBLE' | 'PARENT_VISIBLE' | 'SYSTEM_ONLY';
  readonly capabilities: {
    readonly hasChat: boolean;
    readonly hasRagCorpus: boolean;
    readonly generalChatAllowed?: boolean;
  };
}

export interface ResolvedAriaRetrievalPolicy extends ResolveAriaRetrievalPolicyInput {
  readonly kind: AriaRetrievalPolicyKind;
  readonly policyVersion: 'aria-retrieval-v1';
  readonly reasonCode: string;
}

export function resolveAriaRetrievalPolicy(
  input: ResolveAriaRetrievalPolicyInput,
): ResolvedAriaRetrievalPolicy {
  if (!getCourse(input.courseKey)) {
    throw new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.');
  }
  if (input.agentRole !== 'TUTOR') {
    throw new AriaError('UNSUPPORTED', 422, 'Ce rôle ARIA ne peut pas exécuter cette tâche.');
  }

  let kind: AriaRetrievalPolicyKind;
  let reasonCode: string;
  if (input.visibility === 'SYSTEM_ONLY') {
    kind = 'NO_MODEL';
    reasonCode = 'VISIBILITY_FORBIDS_INTERACTIVE_MODEL';
  } else if (!input.capabilities.hasChat) {
    kind = 'NO_MODEL';
    reasonCode = 'COURSE_CHAT_CAPABILITY_DISABLED';
  } else if (input.requestedResource) {
    kind = 'RESOURCE_GROUNDED_REQUIRED';
    reasonCode = 'REQUESTED_RESOURCE_VERSION_MUST_GROUND';
  } else if (input.capabilities.hasRagCorpus && input.task === 'METHODOLOGY') {
    kind = 'OPTIONAL_GROUNDING';
    reasonCode = 'METHODOLOGY_CAN_USE_EXPLICIT_OPTIONAL_GROUNDING';
  } else if (input.capabilities.hasRagCorpus) {
    kind = 'GROUNDED_REQUIRED';
    reasonCode = 'COURSE_TASK_REQUIRES_PROVEN_CORPUS';
  } else if (input.capabilities.generalChatAllowed) {
    kind = 'GENERAL_CHAT';
    reasonCode = 'COURSE_EXPLICITLY_ALLOWS_GENERAL_CHAT';
  } else {
    kind = 'GROUNDED_REQUIRED';
    reasonCode = 'MISSING_CORPUS_MUST_FAIL_CLOSED';
  }

  return Object.freeze({
    ...input,
    kind,
    policyVersion: 'aria-retrieval-v1' as const,
    reasonCode,
  });
}

export interface AriaRetrievalOutcomeState {
  readonly status: AriaRagStatus;
  readonly hits?: readonly {
    readonly resourceId?: string;
    readonly resourceVersionId?: string;
  }[];
}

export interface AriaRetrievalDecision {
  readonly ragStatus: AriaRagStatus;
  readonly allowModel: boolean;
  readonly grounded: boolean;
  readonly downgradeReason?: 'RUNTIME_UNAVAILABLE_POLICY_AUTHORIZED';
}

function requiredGroundingFailure(status: AriaRagStatus): never {
  throw new AriaError(
    'RAG_UNAVAILABLE',
    503,
    'Le service documentaire requis est temporairement indisponible.',
    { ragStatus: status },
  );
}

export function decideAriaRetrievalOutcome(
  policy: ResolvedAriaRetrievalPolicy,
  state: AriaRetrievalOutcomeState,
): AriaRetrievalDecision {
  if (policy.kind === 'NO_MODEL') {
    return { ragStatus: state.status, allowModel: false, grounded: false };
  }
  if (policy.kind === 'GENERAL_CHAT') {
    return { ragStatus: state.status, allowModel: true, grounded: false };
  }
  if (policy.kind === 'OPTIONAL_GROUNDING') {
    if (state.status === 'SUCCESS') {
      return { ragStatus: state.status, allowModel: true, grounded: true };
    }
    return {
      ragStatus: state.status,
      allowModel: true,
      grounded: false,
      ...(state.status === 'RUNTIME_UNAVAILABLE'
        ? { downgradeReason: 'RUNTIME_UNAVAILABLE_POLICY_AUTHORIZED' as const }
        : {}),
    };
  }
  if (state.status !== 'SUCCESS') return requiredGroundingFailure(state.status);

  if (policy.kind === 'RESOURCE_GROUNDED_REQUIRED') {
    const expected = policy.requestedResource;
    const exactResourceHit = expected && state.hits?.some((hit) =>
      hit.resourceId === expected.resourceId
      && hit.resourceVersionId === expected.resourceVersionId);
    if (!exactResourceHit) return requiredGroundingFailure('SUCCESS');
  }
  return { ragStatus: state.status, allowModel: true, grounded: true };
}
