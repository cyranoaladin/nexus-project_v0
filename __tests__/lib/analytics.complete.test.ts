/**
 * Analytics — Complete Test Suite
 *
 * Tests: track.* convenience functions, sendEvent
 * Note: sendEvent is a no-op in server environment (typeof window === 'undefined')
 *
 * Source: lib/analytics.ts
 */

import { track, sendEvent } from '@/lib/analytics';

// ─── sendEvent (server-side) ─────────────────────────────────────────────────

describe('sendEvent — server-side', () => {
  it('should not throw when window is undefined', () => {
    expect(() =>
      sendEvent({ name: 'page_view', params: { path: '/' } })
    ).not.toThrow();
  });
});

// ─── track convenience functions ─────────────────────────────────────────────

describe('track — convenience functions', () => {
  it('should have pageView function', () => {
    expect(typeof track.pageView).toBe('function');
    expect(() => track.pageView('/')).not.toThrow();
  });

  it('should have ctaClick function', () => {
    expect(typeof track.ctaClick).toBe('function');
    expect(() => track.ctaClick('hero', 'Start')).not.toThrow();
  });

  it('should have bilanStart function', () => {
    expect(typeof track.bilanStart).toBe('function');
    expect(() => track.bilanStart('hybride')).not.toThrow();
  });

  it('should have bilanStep function', () => {
    expect(typeof track.bilanStep).toBe('function');
    expect(() => track.bilanStep(1, 'identity')).not.toThrow();
  });

  it('should have bilanSubmit function', () => {
    expect(typeof track.bilanSubmit).toBe('function');
    expect(() => track.bilanSubmit(['MATHS'], 'terminale')).not.toThrow();
  });

  it('should have bilanSuccess function', () => {
    expect(typeof track.bilanSuccess).toBe('function');
    expect(() => track.bilanSuccess('parent-1')).not.toThrow();
  });

  it('should have bilanError function', () => {
    expect(typeof track.bilanError).toBe('function');
    expect(() => track.bilanError('validation')).not.toThrow();
  });

  it('should have signinAttempt function', () => {
    expect(typeof track.signinAttempt).toBe('function');
    expect(() => track.signinAttempt('credentials')).not.toThrow();
  });

  it('should have signinSuccess function', () => {
    expect(typeof track.signinSuccess).toBe('function');
    expect(() => track.signinSuccess('PARENT')).not.toThrow();
  });

  it('should have signinError function', () => {
    expect(typeof track.signinError).toBe('function');
    expect(() => track.signinError('invalid_credentials')).not.toThrow();
  });

  it('should have offerView function', () => {
    expect(typeof track.offerView).toBe('function');
    expect(() => track.offerView('homepage')).not.toThrow();
  });

  it('should have sessionBook function', () => {
    expect(typeof track.sessionBook).toBe('function');
    expect(() => track.sessionBook(1, 'MATHS')).not.toThrow();
  });

  it('should have sessionCancel function', () => {
    expect(typeof track.sessionCancel).toBe('function');
    expect(() => track.sessionCancel('sess-1', 'schedule_conflict')).not.toThrow();
  });

  it('should have ariaMessage function', () => {
    expect(typeof track.ariaMessage).toBe('function');
    expect(() => track.ariaMessage(50, 'MATHS')).not.toThrow();
  });

  it('should have ariaFeedback function', () => {
    expect(typeof track.ariaFeedback).toBe('function');
    expect(() => track.ariaFeedback('positive', 'msg-1')).not.toThrow();
  });

  it('should have paymentStart function', () => {
    expect(typeof track.paymentStart).toBe('function');
    expect(() => track.paymentStart('bank_transfer', 450)).not.toThrow();
  });

  it('should have paymentSuccess function', () => {
    expect(typeof track.paymentSuccess).toBe('function');
    expect(() => track.paymentSuccess('bank_transfer', 450)).not.toThrow();
  });

  it('should have paymentError function', () => {
    expect(typeof track.paymentError).toBe('function');
    expect(() => track.paymentError('bank_transfer', 'timeout')).not.toThrow();
  });

  it('should have scrollDepth function', () => {
    expect(typeof track.scrollDepth).toBe('function');
    expect(() => track.scrollDepth('/offres', 75)).not.toThrow();
  });

  it('should have bilanPallier2Start function', () => {
    expect(typeof track.bilanPallier2Start).toBe('function');
    expect(() => track.bilanPallier2Start('direct')).not.toThrow();
  });

  it('should have stageView function', () => {
    expect(typeof track.stageView).toBe('function');
    expect(() => track.stageView('stage-1', 'Académie Maths')).not.toThrow();
  });

  it('should have stageReserve function', () => {
    expect(typeof track.stageReserve).toBe('function');
    expect(() => track.stageReserve('stage-1', 750)).not.toThrow();
  });

  it('should have contactSubmit function', () => {
    expect(typeof track.contactSubmit).toBe('function');
    expect(() => track.contactSubmit('parent', 'hybride')).not.toThrow();
  });

  it('should have quizComplete function', () => {
    expect(typeof track.quizComplete).toBe('function');
    expect(() => track.quizComplete(['a', 'b'], 'hybride')).not.toThrow();
  });
});

// ─── track object structure ──────────────────────────────────────────────────

describe('track — structure', () => {
  it('should expose all expected tracking functions', () => {
    const expectedKeys = [
      'pageView', 'ctaClick', 'bilanStart', 'bilanStep', 'bilanSubmit',
      'bilanSuccess', 'bilanError', 'bilanPallier2Start', 'bilanPallier2Step',
      'bilanPallier2Success', 'bilanPallier2Error', 'signinAttempt',
      'signinSuccess', 'signinError', 'offerView', 'contactSubmit',
      'quizComplete', 'stageView', 'stageReserve', 'sessionBook',
      'sessionCancel', 'ariaMessage', 'ariaFeedback', 'paymentStart',
      'paymentSuccess', 'paymentError', 'scrollDepth',
    ];

    for (const key of expectedKeys) {
      expect(typeof (track as Record<string, unknown>)[key]).toBe('function');
    }
  });
});
