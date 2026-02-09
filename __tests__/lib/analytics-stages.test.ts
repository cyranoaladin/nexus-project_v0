import { trackEvent, analytics } from '@/lib/analytics-stages';

describe('Analytics Stages', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    // Ensure window is defined (jsdom)
    delete (window as any).gtag;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('trackEvent', () => {
    it('should log event in development mode', () => {
      trackEvent({ name: 'stage_cta_click', params: { location: 'hero', label: 'CTA' } });
      expect(consoleSpy).toHaveBeenCalledWith('[Analytics]', 'stage_cta_click', { location: 'hero', label: 'CTA' });
    });

    it('should call gtag when available', () => {
      const mockGtag = jest.fn();
      (window as any).gtag = mockGtag;

      trackEvent({ name: 'stage_select_academy', params: { academyId: 'academy-1' } });
      expect(mockGtag).toHaveBeenCalledWith('event', 'stage_select_academy', { academyId: 'academy-1' });
    });

    it('should not call gtag when not available', () => {
      delete (window as any).gtag;
      trackEvent({ name: 'stage_open_faq', params: { question: 'test?' } });
      // Should not throw
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('analytics convenience functions', () => {
    it('ctaClick should track stage_cta_click event', () => {
      analytics.ctaClick('header', 'Sign Up');
      expect(consoleSpy).toHaveBeenCalledWith('[Analytics]', 'stage_cta_click', { location: 'header', label: 'Sign Up' });
    });

    it('selectAcademy should track stage_select_academy event', () => {
      analytics.selectAcademy('academy-42');
      expect(consoleSpy).toHaveBeenCalledWith('[Analytics]', 'stage_select_academy', { academyId: 'academy-42' });
    });

    it('openFaq should track stage_open_faq event', () => {
      analytics.openFaq('How does it work?');
      expect(consoleSpy).toHaveBeenCalledWith('[Analytics]', 'stage_open_faq', { question: 'How does it work?' });
    });

    it('scrollDepth should track stage_scroll_depth event', () => {
      analytics.scrollDepth(75);
      expect(consoleSpy).toHaveBeenCalledWith('[Analytics]', 'stage_scroll_depth', { depth: 75 });
    });
  });
});
