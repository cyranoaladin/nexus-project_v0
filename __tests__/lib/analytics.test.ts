/**
 * Unit tests for lib/analytics.ts
 * Tests the unified analytics tracking system
 */

import { track, sendEvent } from '@/lib/analytics';
import type { NexusEvent } from '@/lib/analytics';

describe('Analytics Tracking System', () => {
  let consoleSpy: jest.SpyInstance;
  let originalEnv: string | undefined;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    originalEnv = process.env.NODE_ENV;
    // Set to development so events are logged
    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: 'development' },
    });
    // Clean up any gtag/plausible mocks
    delete (window as any).gtag;
    delete (window as any).plausible;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: originalEnv },
    });
  });

  describe('sendEvent', () => {
    it('should log events in development mode', () => {
      const event: NexusEvent = {
        name: 'page_view',
        params: { path: '/offres', referrer: '/' },
      };

      sendEvent(event);

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Analytics] page_view'),
        expect.any(String),
        { path: '/offres', referrer: '/' }
      );
    });

    it('should call window.gtag if available', () => {
      const mockGtag = jest.fn();
      (window as any).gtag = mockGtag;

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
      const mockGtag = jest.fn();
      const mockPlausible = jest.fn();
      (window as any).gtag = mockGtag;
      (window as any).plausible = mockPlausible;

      sendEvent({ name: 'bilan_start', params: { programme: 'hybride' } });

      expect(mockGtag).toHaveBeenCalledTimes(1);
      expect(mockPlausible).toHaveBeenCalledTimes(1);
    });
  });

  describe('track convenience functions', () => {
    it('track.pageView sends page_view event', () => {
      track.pageView('/offres', '/');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('page_view'),
        expect.any(String),
        { path: '/offres', referrer: '/' }
      );
    });

    it('track.ctaClick sends cta_click event', () => {
      track.ctaClick('hero', 'Bilan Gratuit', '/bilan-gratuit');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('cta_click'),
        expect.any(String),
        { cta_text: 'Bilan Gratuit', cta_location: 'hero', destination: '/bilan-gratuit' }
      );
    });

    it('track.bilanStart sends bilan_start event', () => {
      track.bilanStart('hybride', 'offres');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('bilan_start'),
        expect.any(String),
        { programme: 'hybride', source: 'offres' }
      );
    });

    it('track.bilanStep sends bilan_step event', () => {
      track.bilanStep(2, 'informations_eleve');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('bilan_step'),
        expect.any(String),
        { step_number: 2, step_name: 'informations_eleve' }
      );
    });

    it('track.bilanSuccess sends bilan_success event', () => {
      track.bilanSuccess('parent-123');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('bilan_success'),
        expect.any(String),
        { parent_id: 'parent-123' }
      );
    });

    it('track.bilanError sends bilan_error event', () => {
      track.bilanError('validation_failed');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('bilan_error'),
        expect.any(String),
        { error_type: 'validation_failed' }
      );
    });

    it('track.signinAttempt sends signin_attempt event', () => {
      track.signinAttempt();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('signin_attempt'),
        expect.any(String),
        { method: 'credentials' }
      );
    });

    it('track.signinSuccess sends signin_success event', () => {
      track.signinSuccess('ELEVE');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('signin_success'),
        expect.any(String),
        { role: 'ELEVE' }
      );
    });

    it('track.signinError sends signin_error event', () => {
      track.signinError('invalid_credentials');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('signin_error'),
        expect.any(String),
        { error_type: 'invalid_credentials' }
      );
    });

    it('track.offerView sends offer_view event', () => {
      track.offerView('homepage');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('offer_view'),
        expect.any(String),
        { source: 'homepage' }
      );
    });

    it('track.quizComplete sends quiz_complete event', () => {
      track.quizComplete(['scolarise', 'bac', 'methodo'], 'Formule Hybride');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('quiz_complete'),
        expect.any(String),
        { answers: ['scolarise', 'bac', 'methodo'], recommendation: 'Formule Hybride' }
      );
    });

    it('track.stageView sends stage_view event', () => {
      track.stageView('maths-bac-garanti', 'MATHS : ESSENTIELS BAC');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('stage_view'),
        expect.any(String),
        { stage_id: 'maths-bac-garanti', stage_title: 'MATHS : ESSENTIELS BAC' }
      );
    });

    it('track.stageReserve sends stage_reserve event', () => {
      track.stageReserve('maths-bac-garanti', 502);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('stage_reserve'),
        expect.any(String),
        { stage_id: 'maths-bac-garanti', price: 502 }
      );
    });

    it('track.sessionBook sends session_book event', () => {
      track.sessionBook(1, 'MATHEMATIQUES', 'Hélios');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('session_book'),
        expect.any(String),
        { subject: 'MATHEMATIQUES', coach: 'Hélios', credits: 1 }
      );
    });

    it('track.ariaMessage sends aria_message event', () => {
      track.ariaMessage(150, 'MATHEMATIQUES');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('aria_message'),
        expect.any(String),
        { subject: 'MATHEMATIQUES', message_length: 150 }
      );
    });

    it('track.ariaFeedback sends aria_feedback event', () => {
      track.ariaFeedback('positive', 'msg-123');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('aria_feedback'),
        expect.any(String),
        { rating: 'positive', message_id: 'msg-123' }
      );
    });

    it('track.paymentStart sends payment_start event', () => {
      track.paymentStart('clictopay', 450);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('payment_start'),
        expect.any(String),
        { method: 'clictopay', amount: 450 }
      );
    });

    it('track.scrollDepth sends scroll_depth event', () => {
      track.scrollDepth('/offres', 75);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('scroll_depth'),
        expect.any(String),
        { page: '/offres', depth: 75 }
      );
    });

    it('track.bilanSubmit sends bilan_submit event', () => {
      track.bilanSubmit(['MATHEMATIQUES', 'NSI'], 'TERMINALE', 'hybride');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('bilan_submit'),
        expect.any(String),
        { subjects: ['MATHEMATIQUES', 'NSI'], grade: 'TERMINALE', modality: 'hybride' }
      );
    });

    it('track.contactSubmit sends contact_submit event', () => {
      track.contactSubmit('parent', 'bilan', 'urgent', 'offres');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('contact_submit'),
        expect.any(String),
        { profile: 'parent', interest: 'bilan', urgency: 'urgent', source: 'offres' }
      );
    });

    it('track.sessionCancel sends session_cancel event', () => {
      track.sessionCancel('sess-123', 'schedule_conflict');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('session_cancel'),
        expect.any(String),
        { session_id: 'sess-123', reason: 'schedule_conflict' }
      );
    });

    it('track.paymentSuccess sends payment_success event', () => {
      track.paymentSuccess('clictopay', 450);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('payment_success'),
        expect.any(String),
        { method: 'clictopay', amount: 450 }
      );
    });

    it('track.paymentError sends payment_error event', () => {
      track.paymentError('clictopay', 'card_declined');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('payment_error'),
        expect.any(String),
        { method: 'clictopay', error_type: 'card_declined' }
      );
    });

    it('track.bilanPallier2Start sends bilan_pallier2_start event', () => {
      track.bilanPallier2Start('dashboard');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('bilan_pallier2_start'),
        expect.any(String),
        { source: 'dashboard' }
      );
    });

    it('track.bilanPallier2Step sends bilan_pallier2_step event', () => {
      track.bilanPallier2Step(3, 'questions_maths');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('bilan_pallier2_step'),
        expect.any(String),
        { step_number: 3, step_name: 'questions_maths' }
      );
    });

    it('track.bilanPallier2Success sends bilan_pallier2_success event', () => {
      track.bilanPallier2Success('student-456');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('bilan_pallier2_success'),
        expect.any(String),
        { student_id: 'student-456' }
      );
    });

    it('track.bilanPallier2Error sends bilan_pallier2_error event', () => {
      track.bilanPallier2Error('timeout');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('bilan_pallier2_error'),
        expect.any(String),
        { error_type: 'timeout' }
      );
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
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('bilan_start'),
        expect.any(String),
        { programme: undefined, source: undefined }
      );
    });
  });
});
