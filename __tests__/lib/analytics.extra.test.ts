import { analytics as stageAnalytics, trackEvent } from '@/lib/analytics-stages';
import { sendEvent, track } from '@/lib/analytics';

describe('analytics extra', () => {
  it('does not throw in server env', () => {
    sendEvent({ name: 'page_view', params: { path: '/' } });
  });

  it('sends events to gtag and plausible in browser', () => {
    const gtag = jest.fn();
    const plausible = jest.fn();
    (globalThis as any).window = (globalThis as any).window || {};
    (globalThis as any).window.gtag = gtag;
    (globalThis as any).window.plausible = plausible;

    track.pageView('/home');
    track.paymentStart('clictopay', 100);

    expect(gtag).toHaveBeenCalled();
    expect(plausible).toHaveBeenCalled();
  });

  it('tracks stage events', () => {
    (globalThis as any).window = {
      gtag: jest.fn(),
    };

    stageAnalytics.ctaClick('hero', 'CTA');
    stageAnalytics.scrollDepth(50);
    trackEvent({ name: 'stage_open_faq', params: { question: 'Q?' } });
  });
});
