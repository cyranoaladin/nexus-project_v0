/**
 * Nexus Réussite — Analytics Tracking System
 *
 * Unified event tracking for conversion, engagement, and product analytics.
 * Supports GA4/GTM via window.gtag, and logs to console in development.
 *
 * Usage:
 *   import { track } from '@/lib/analytics';
 *   track.ctaClick('hero', 'Commencer mon Bilan Gratuit');
 *   track.bilanStart('hybride');
 *   track.signinSuccess('PARENT');
 */

/** All trackable event types with their required parameters */
type NexusEvent =
  | { name: 'page_view'; params: { path: string; referrer?: string } }
  | { name: 'cta_click'; params: { cta_text: string; cta_location: string; destination?: string } }
  | { name: 'bilan_start'; params: { source?: string; programme?: string } }
  | { name: 'bilan_step'; params: { step_number: number; step_name: string } }
  | { name: 'bilan_submit'; params: { subjects: string[]; grade?: string; modality?: string } }
  | { name: 'bilan_success'; params: { parent_id?: string } }
  | { name: 'bilan_error'; params: { error_type: string } }
  | { name: 'signin_attempt'; params: { method: string } }
  | { name: 'signin_success'; params: { role: string } }
  | { name: 'signin_error'; params: { error_type: string } }
  | { name: 'offer_view'; params: { source?: string } }
  | { name: 'quiz_complete'; params: { answers: string[]; recommendation: string } }
  | { name: 'stage_view'; params: { stage_id: string; stage_title: string } }
  | { name: 'stage_reserve'; params: { stage_id: string; price: number } }
  | { name: 'session_book'; params: { subject?: string; coach?: string; credits: number } }
  | { name: 'session_cancel'; params: { session_id: string; reason?: string } }
  | { name: 'aria_message'; params: { subject?: string; message_length: number } }
  | { name: 'aria_feedback'; params: { rating: 'positive' | 'negative'; message_id?: string } }
  | { name: 'payment_start'; params: { method: string; amount: number } }
  | { name: 'payment_success'; params: { method: string; amount: number } }
  | { name: 'payment_error'; params: { method: string; error_type: string } }
  | { name: 'scroll_depth'; params: { page: string; depth: number } };

/**
 * Send an analytics event.
 * - Development: logs to console
 * - Production: sends to GA4 via gtag if available
 */
function sendEvent(event: NexusEvent): void {
  if (typeof window === 'undefined') return;

  // Development: structured console log
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `%c[Analytics] ${event.name}`,
      'color: #2EE9F6; font-weight: bold;',
      event.params
    );
  }

  // GA4 / GTM integration
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag === 'function') {
    gtag('event', event.name, event.params);
  }

  // Plausible integration (if present)
  const plausible = (window as unknown as { plausible?: (...args: unknown[]) => void }).plausible;
  if (typeof plausible === 'function') {
    plausible(event.name, { props: event.params });
  }
}

/** Convenience tracking functions with typed parameters */
export const track = {
  /** Track a page view */
  pageView: (path: string, referrer?: string) =>
    sendEvent({ name: 'page_view', params: { path, referrer } }),

  /** Track a CTA click */
  ctaClick: (cta_location: string, cta_text: string, destination?: string) =>
    sendEvent({ name: 'cta_click', params: { cta_text, cta_location, destination } }),

  /** Track bilan gratuit funnel */
  bilanStart: (programme?: string, source?: string) =>
    sendEvent({ name: 'bilan_start', params: { programme, source } }),

  bilanStep: (step_number: number, step_name: string) =>
    sendEvent({ name: 'bilan_step', params: { step_number, step_name } }),

  bilanSubmit: (subjects: string[], grade?: string, modality?: string) =>
    sendEvent({ name: 'bilan_submit', params: { subjects, grade, modality } }),

  bilanSuccess: (parent_id?: string) =>
    sendEvent({ name: 'bilan_success', params: { parent_id } }),

  bilanError: (error_type: string) =>
    sendEvent({ name: 'bilan_error', params: { error_type } }),

  /** Track authentication */
  signinAttempt: (method = 'credentials') =>
    sendEvent({ name: 'signin_attempt', params: { method } }),

  signinSuccess: (role: string) =>
    sendEvent({ name: 'signin_success', params: { role } }),

  signinError: (error_type: string) =>
    sendEvent({ name: 'signin_error', params: { error_type } }),

  /** Track offer/stage views */
  offerView: (source?: string) =>
    sendEvent({ name: 'offer_view', params: { source } }),

  quizComplete: (answers: string[], recommendation: string) =>
    sendEvent({ name: 'quiz_complete', params: { answers, recommendation } }),

  stageView: (stage_id: string, stage_title: string) =>
    sendEvent({ name: 'stage_view', params: { stage_id, stage_title } }),

  stageReserve: (stage_id: string, price: number) =>
    sendEvent({ name: 'stage_reserve', params: { stage_id, price } }),

  /** Track sessions */
  sessionBook: (credits: number, subject?: string, coach?: string) =>
    sendEvent({ name: 'session_book', params: { subject, coach, credits } }),

  sessionCancel: (session_id: string, reason?: string) =>
    sendEvent({ name: 'session_cancel', params: { session_id, reason } }),

  /** Track ARIA interactions */
  ariaMessage: (message_length: number, subject?: string) =>
    sendEvent({ name: 'aria_message', params: { subject, message_length } }),

  ariaFeedback: (rating: 'positive' | 'negative', message_id?: string) =>
    sendEvent({ name: 'aria_feedback', params: { rating, message_id } }),

  /** Track payments */
  paymentStart: (method: string, amount: number) =>
    sendEvent({ name: 'payment_start', params: { method, amount } }),

  paymentSuccess: (method: string, amount: number) =>
    sendEvent({ name: 'payment_success', params: { method, amount } }),

  paymentError: (method: string, error_type: string) =>
    sendEvent({ name: 'payment_error', params: { method, error_type } }),

  /** Track scroll depth */
  scrollDepth: (page: string, depth: number) =>
    sendEvent({ name: 'scroll_depth', params: { page, depth } }),
};

export { sendEvent };
export type { NexusEvent };
