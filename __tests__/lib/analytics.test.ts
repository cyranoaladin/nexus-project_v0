/**
 * Unit tests for lib/analytics.ts
 * Tests the unified analytics tracking system via gtag integration.
 */

import { track, sendEvent } from '@/lib/analytics';
import type { NexusEvent } from '@/lib/analytics';

describe('Analytics Tracking System', () => {
  let mockGtag: jest.Mock;

  beforeEach(() => {
    mockGtag = jest.fn();
    (window as any).gtag = mockGtag;
    delete (window as any).plausible;
  });

  afterEach(() => {
    delete (window as any).gtag;
    delete (window as any).plausible;
  });

  describe('sendEvent', () => {
    it('should send events via gtag', () => {
      const event: NexusEvent = {
        name: 'page_view',
        params: { path: '/offres', referrer: '/' },
      };

      sendEvent(event);

      expect(mockGtag).toHaveBeenCalledWith('event', 'page_view', {
        path: '/offres',
        referrer: '/',
      });
    });

    it('should call window.gtag if available', () => {
      sendEvent({ name: 'cta_click', params: { cta_text: 'Test', cta_location: 'hero' } });

      expect(mockGtag).toHaveBeenCalledWith('event', 'cta_click', {
        cta_text: 'Test',
        cta_location: 'hero',
      });
    });

    it('should call window.plausible if available', () => {
      const mockPlausible = jest.fn();
      (window as any).plausible = mockPlausible;

      sendEvent({ name: 'signin_success', params: { role: 'PARENT' } });

      expect(mockPlausible).toHaveBeenCalledWith('signin_success', {
        props: { role: 'PARENT' },
      });
    });

    it('should handle both gtag and plausible simultaneously', () => {
      const mockPlausible = jest.fn();
      (window as any).plausible = mockPlausible;

      sendEvent({ name: 'bilan_start', params: { programme: 'hybride' } });

      expect(mockGtag).toHaveBeenCalledTimes(1);
      expect(mockPlausible).toHaveBeenCalledTimes(1);
    });
  });

  describe('track convenience functions', () => {
    it('track.pageView sends page_view event', () => {
      track.pageView('/offres', '/');
      expect(mockGtag).toHaveBeenCalledWith('event', 'page_view', { path: '/offres', referrer: '/' });
    });

    it('track.ctaClick sends cta_click event', () => {
      track.ctaClick('hero', 'Bilan Gratuit', '/bilan-gratuit');
      expect(mockGtag).toHaveBeenCalledWith('event', 'cta_click', { cta_text: 'Bilan Gratuit', cta_location: 'hero', destination: '/bilan-gratuit' });
    });

    it('track.bilanStart sends bilan_start event', () => {
      track.bilanStart('hybride', 'offres');
      expect(mockGtag).toHaveBeenCalledWith('event', 'bilan_start', { programme: 'hybride', source: 'offres' });
    });

    it('track.bilanStep sends bilan_step event', () => {
      track.bilanStep(2, 'informations_eleve');
      expect(mockGtag).toHaveBeenCalledWith('event', 'bilan_step', { step_number: 2, step_name: 'informations_eleve' });
    });

    it('track.bilanSuccess sends bilan_success event', () => {
      track.bilanSuccess('parent-123');
      expect(mockGtag).toHaveBeenCalledWith('event', 'bilan_success', { parent_id: 'parent-123' });
    });

    it('track.bilanError sends bilan_error event', () => {
      track.bilanError('validation_failed');
      expect(mockGtag).toHaveBeenCalledWith('event', 'bilan_error', { error_type: 'validation_failed' });
    });

    it('track.signinAttempt sends signin_attempt event', () => {
      track.signinAttempt();
      expect(mockGtag).toHaveBeenCalledWith('event', 'signin_attempt', { method: 'credentials' });
    });

    it('track.signinSuccess sends signin_success event', () => {
      track.signinSuccess('ELEVE');
      expect(mockGtag).toHaveBeenCalledWith('event', 'signin_success', { role: 'ELEVE' });
    });

    it('track.signinError sends signin_error event', () => {
      track.signinError('invalid_credentials');
      expect(mockGtag).toHaveBeenCalledWith('event', 'signin_error', { error_type: 'invalid_credentials' });
    });

    it('track.offerView sends offer_view event', () => {
      track.offerView('homepage');
      expect(mockGtag).toHaveBeenCalledWith('event', 'offer_view', { source: 'homepage' });
    });

    it('track.quizComplete sends quiz_complete event', () => {
      track.quizComplete(['scolarise', 'bac', 'methodo'], 'Formule Hybride');
      expect(mockGtag).toHaveBeenCalledWith('event', 'quiz_complete', { answers: ['scolarise', 'bac', 'methodo'], recommendation: 'Formule Hybride' });
    });

    it('track.stageView sends stage_view event', () => {
      track.stageView('maths-bac-garanti', 'MATHS : ESSENTIELS BAC');
      expect(mockGtag).toHaveBeenCalledWith('event', 'stage_view', { stage_id: 'maths-bac-garanti', stage_title: 'MATHS : ESSENTIELS BAC' });
    });

    it('track.stageReserve sends stage_reserve event', () => {
      track.stageReserve('maths-bac-garanti', 502);
      expect(mockGtag).toHaveBeenCalledWith('event', 'stage_reserve', { stage_id: 'maths-bac-garanti', price: 502 });
    });

    it('track.sessionBook sends session_book event', () => {
      track.sessionBook(1, 'MATHEMATIQUES', 'Hélios');
      expect(mockGtag).toHaveBeenCalledWith('event', 'session_book', { subject: 'MATHEMATIQUES', coach: 'Hélios', credits: 1 });
    });

    it('track.ariaMessage sends aria_message event', () => {
      track.ariaMessage(150, 'MATHEMATIQUES');
      expect(mockGtag).toHaveBeenCalledWith('event', 'aria_message', { subject: 'MATHEMATIQUES', message_length: 150 });
    });

    it('track.ariaFeedback sends aria_feedback event', () => {
      track.ariaFeedback('positive', 'msg-123');
      expect(mockGtag).toHaveBeenCalledWith('event', 'aria_feedback', { rating: 'positive', message_id: 'msg-123' });
    });

    it('track.paymentStart sends payment_start event', () => {
      track.paymentStart('clictopay', 450);
      expect(mockGtag).toHaveBeenCalledWith('event', 'payment_start', { method: 'clictopay', amount: 450 });
    });

    it('track.scrollDepth sends scroll_depth event', () => {
      track.scrollDepth('/offres', 75);
      expect(mockGtag).toHaveBeenCalledWith('event', 'scroll_depth', { page: '/offres', depth: 75 });
    });

    it('track.bilanSubmit sends bilan_submit event', () => {
      track.bilanSubmit(['MATHEMATIQUES', 'NSI'], 'TERMINALE', 'hybride');
      expect(mockGtag).toHaveBeenCalledWith('event', 'bilan_submit', { subjects: ['MATHEMATIQUES', 'NSI'], grade: 'TERMINALE', modality: 'hybride' });
    });

    it('track.contactSubmit sends contact_submit event', () => {
      track.contactSubmit('parent', 'bilan', 'urgent', 'offres');
      expect(mockGtag).toHaveBeenCalledWith('event', 'contact_submit', { profile: 'parent', interest: 'bilan', urgency: 'urgent', source: 'offres' });
    });

    it('track.sessionCancel sends session_cancel event', () => {
      track.sessionCancel('sess-123', 'schedule_conflict');
      expect(mockGtag).toHaveBeenCalledWith('event', 'session_cancel', { session_id: 'sess-123', reason: 'schedule_conflict' });
    });

    it('track.paymentSuccess sends payment_success event', () => {
      track.paymentSuccess('clictopay', 450);
      expect(mockGtag).toHaveBeenCalledWith('event', 'payment_success', { method: 'clictopay', amount: 450 });
    });

    it('track.paymentError sends payment_error event', () => {
      track.paymentError('clictopay', 'card_declined');
      expect(mockGtag).toHaveBeenCalledWith('event', 'payment_error', { method: 'clictopay', error_type: 'card_declined' });
    });

    it('track.bilanPallier2Start sends bilan_pallier2_start event', () => {
      track.bilanPallier2Start('dashboard');
      expect(mockGtag).toHaveBeenCalledWith('event', 'bilan_pallier2_start', { source: 'dashboard' });
    });

    it('track.bilanPallier2Step sends bilan_pallier2_step event', () => {
      track.bilanPallier2Step(3, 'questions_maths');
      expect(mockGtag).toHaveBeenCalledWith('event', 'bilan_pallier2_step', { step_number: 3, step_name: 'questions_maths' });
    });

    it('track.bilanPallier2Success sends bilan_pallier2_success event', () => {
      track.bilanPallier2Success('student-456');
      expect(mockGtag).toHaveBeenCalledWith('event', 'bilan_pallier2_success', { student_id: 'student-456' });
    });

    it('track.bilanPallier2Error sends bilan_pallier2_error event', () => {
      track.bilanPallier2Error('timeout');
      expect(mockGtag).toHaveBeenCalledWith('event', 'bilan_pallier2_error', { error_type: 'timeout' });
    });
  });

  describe('edge cases', () => {
    it('should not throw when window.gtag is not a function', () => {
      (window as any).gtag = 'not-a-function';
      expect(() => track.pageView('/test')).not.toThrow();
    });

    it('should not throw when window.plausible is not a function', () => {
      (window as any).plausible = 42;
      expect(() => track.pageView('/test')).not.toThrow();
    });

    it('should handle undefined optional params', () => {
      track.bilanStart(undefined, undefined);
      expect(mockGtag).toHaveBeenCalledWith('event', 'bilan_start', { programme: undefined, source: undefined });
    });
  });
});
