import { trackEvent, analytics } from '@/lib/analytics-stages';

describe('Analytics Stages', () => {
  let mockGtag: jest.Mock;

  beforeEach(() => {
    mockGtag = jest.fn();
    (window as any).gtag = mockGtag;
  });

  afterEach(() => {
    delete (window as any).gtag;
  });

  describe('trackEvent', () => {
    it('should send event via gtag', () => {
      trackEvent({ name: 'stage_cta_click', params: { location: 'hero', label: 'CTA' } });
      expect(mockGtag).toHaveBeenCalledWith('event', 'stage_cta_click', { location: 'hero', label: 'CTA' });
    });

    it('should call gtag when available', () => {
      trackEvent({ name: 'stage_select_academy', params: { academyId: 'academy-1' } });
      expect(mockGtag).toHaveBeenCalledWith('event', 'stage_select_academy', { academyId: 'academy-1' });
    });

    it('should not throw when gtag is not available', () => {
      delete (window as any).gtag;
      expect(() => trackEvent({ name: 'stage_open_faq', params: { question: 'test?' } })).not.toThrow();
    });
  });

  describe('analytics convenience functions', () => {
    it('ctaClick should track stage_cta_click event', () => {
      analytics.ctaClick('header', 'Sign Up');
      expect(mockGtag).toHaveBeenCalledWith('event', 'stage_cta_click', { location: 'header', label: 'Sign Up' });
    });

    it('selectAcademy should track stage_select_academy event', () => {
      analytics.selectAcademy('academy-42');
      expect(mockGtag).toHaveBeenCalledWith('event', 'stage_select_academy', { academyId: 'academy-42' });
    });

    it('openFaq should track stage_open_faq event', () => {
      analytics.openFaq('How does it work?');
      expect(mockGtag).toHaveBeenCalledWith('event', 'stage_open_faq', { question: 'How does it work?' });
    });

    it('scrollDepth should track stage_scroll_depth event', () => {
      analytics.scrollDepth(75);
      expect(mockGtag).toHaveBeenCalledWith('event', 'stage_scroll_depth', { depth: 75 });
    });
  });
});
