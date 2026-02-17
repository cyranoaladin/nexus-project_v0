/**
 * Invoice Status Transition Engine — Pure functions.
 *
 * Defines the allowed status transitions, action types, and validation logic.
 * No DB access, no side effects — testable in isolation.
 *
 * Transition graph:
 *   DRAFT → SENT
 *   DRAFT → CANCELLED
 *   SENT  → PAID
 *   SENT  → CANCELLED
 *   PAID  → (terminal)
 *   CANCELLED → (terminal)
 */

import type { InvoiceStatusType } from './types';
import { assertMillimes, MillimesValidationError } from './types';

// ─── Action Types ───────────────────────────────────────────────────────────

export type InvoiceAction = 'MARK_SENT' | 'MARK_PAID' | 'CANCEL';

export interface MarkSentMeta {
  note?: string | null;
}

export interface MarkPaidMeta {
  note?: string | null;
  payment: {
    method: string;
    reference?: string | null;
    paidAt?: string | null;
    amountPaid: number; // millimes
  };
}

export interface CancelMeta {
  note?: string | null;
  reason?: string | null;
}

export type ActionMeta = MarkSentMeta | MarkPaidMeta | CancelMeta;

export interface InvoiceActionRequest {
  action: InvoiceAction;
  meta?: ActionMeta;
}

// ─── Transition Map ─────────────────────────────────────────────────────────

/**
 * Allowed transitions: Map<currentStatus, Map<action, targetStatus>>.
 * If a (status, action) pair is not in the map, the transition is invalid.
 */
const TRANSITIONS: Record<string, Record<string, InvoiceStatusType>> = {
  DRAFT: {
    MARK_SENT: 'SENT',
    CANCEL: 'CANCELLED',
  },
  SENT: {
    MARK_PAID: 'PAID',
    CANCEL: 'CANCELLED',
  },
  // PAID and CANCELLED are terminal — no transitions allowed
};

// ─── Transition Result ──────────────────────────────────────────────────────

export interface TransitionResult {
  valid: boolean;
  noop?: boolean;
  targetStatus?: InvoiceStatusType;
  error?: string;
  httpStatus?: 409 | 422;
}

// ─── Pure Transition Validator ──────────────────────────────────────────────

/**
 * Validate a status transition. Pure function — no side effects.
 *
 * @param currentStatus - Current invoice status
 * @param action - Requested action
 * @param meta - Action metadata (payment info for MARK_PAID)
 * @param invoiceTotal - Invoice total in millimes (for MARK_PAID validation)
 * @returns TransitionResult with valid flag, target status, or error
 */
export function validateTransition(
  currentStatus: InvoiceStatusType,
  action: InvoiceAction,
  meta?: ActionMeta,
  invoiceTotal?: number
): TransitionResult {
  // Idempotence: if already in target status, return 200 no-op (no event)
  const IDEMPOTENT_MAP: Record<InvoiceAction, InvoiceStatusType> = {
    MARK_SENT: 'SENT',
    MARK_PAID: 'PAID',
    CANCEL: 'CANCELLED',
  };
  if (currentStatus === IDEMPOTENT_MAP[action]) {
    return { valid: true, noop: true, targetStatus: currentStatus };
  }

  // Check if transition exists
  const statusTransitions = TRANSITIONS[currentStatus];
  if (!statusTransitions || !statusTransitions[action]) {
    return {
      valid: false,
      error: `Transition invalide : ${currentStatus} → ${action}. ${
        currentStatus === 'PAID' ? 'Une facture payée ne peut plus être modifiée.' :
        currentStatus === 'CANCELLED' ? 'Une facture annulée ne peut plus être modifiée.' :
        `Action "${action}" non autorisée depuis le statut "${currentStatus}".`
      }`,
      httpStatus: 409,
    };
  }

  const targetStatus = statusTransitions[action];

  // MARK_PAID requires payment metadata
  if (action === 'MARK_PAID') {
    const paidMeta = meta as MarkPaidMeta | undefined;
    if (!paidMeta?.payment) {
      return {
        valid: false,
        error: 'Les informations de paiement sont requises pour marquer une facture comme payée.',
        httpStatus: 422,
      };
    }

    // Validate amountPaid is integer millimes
    try {
      assertMillimes(paidMeta.payment.amountPaid, 'payment.amountPaid');
    } catch (e) {
      if (e instanceof MillimesValidationError) {
        return { valid: false, error: e.message, httpStatus: 422 };
      }
      throw e;
    }

    // Validate amountPaid matches invoice total (strict — paiement complet uniquement)
    if (invoiceTotal !== undefined && paidMeta.payment.amountPaid !== invoiceTotal) {
      return {
        valid: false,
        error: `amountPaid doit être égal au total de la facture (paiement complet). Reçu: ${paidMeta.payment.amountPaid}, attendu: ${invoiceTotal}.`,
        httpStatus: 422,
      };
    }

    // Validate payment method
    if (!paidMeta.payment.method) {
      return {
        valid: false,
        error: 'Le mode de paiement est requis.',
        httpStatus: 422,
      };
    }
  }

  return { valid: true, targetStatus };
}

// ─── RBAC for status actions ────────────────────────────────────────────────

/**
 * Check if a role can perform status actions on invoices.
 * Only ADMIN and ASSISTANTE can change invoice status.
 */
export function canPerformStatusAction(role: string | undefined): boolean {
  return role === 'ADMIN' || role === 'ASSISTANTE';
}

/**
 * Get the target status for an action (without validation).
 * Returns null if the action is unknown.
 */
export function getTargetStatus(
  currentStatus: InvoiceStatusType,
  action: InvoiceAction
): InvoiceStatusType | null {
  return TRANSITIONS[currentStatus]?.[action] ?? null;
}

/**
 * Check if a status is terminal (no further transitions allowed).
 */
export function isTerminalStatus(status: InvoiceStatusType): boolean {
  return status === 'PAID' || status === 'CANCELLED';
}

/**
 * Get available actions for a given status.
 */
export function getAvailableActions(status: InvoiceStatusType): InvoiceAction[] {
  const transitions = TRANSITIONS[status];
  if (!transitions) return [];
  return Object.keys(transitions) as InvoiceAction[];
}
