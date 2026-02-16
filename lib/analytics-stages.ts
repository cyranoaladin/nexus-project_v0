/**
 * Analytics wrapper for Stages Février 2026
 * 
 * Events:
 * - stage_cta_click: { location: string, label: string }
 * - stage_select_academy: { academyId: string }
 * - stage_open_faq: { question: string }
 * - stage_scroll_depth: { depth: number }
 */

type AnalyticsEvent = 
  | { name: 'stage_cta_click'; params: { location: string; label: string } }
  | { name: 'stage_select_academy'; params: { academyId: string } }
  | { name: 'stage_open_faq'; params: { question: string } }
  | { name: 'stage_scroll_depth'; params: { depth: number } };

type AnalyticsWindow = Window & {
  gtag?: (command: 'event', eventName: string, params: Record<string, string | number>) => void;
};

/**
 * Track analytics event
 * No-op in development, can be connected to GTM/GA4/Plausible in production
 */
export function trackEvent(event: AnalyticsEvent): void {
  if (typeof window === 'undefined') return;

  // Development: log to console
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', event.name, event.params);
  }

  // Production: send to analytics service
  const analyticsWindow = window as AnalyticsWindow;
  if (analyticsWindow.gtag) {
    analyticsWindow.gtag('event', event.name, event.params);
  }

  // Alternative: custom analytics endpoint
  // fetch('/api/analytics', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(event)
  // }).catch(console.error);
}

// Convenience functions
export const analytics = {
  ctaClick: (location: string, label: string) => 
    trackEvent({ name: 'stage_cta_click', params: { location, label } }),
  
  selectAcademy: (academyId: string) => 
    trackEvent({ name: 'stage_select_academy', params: { academyId } }),
  
  openFaq: (question: string) => 
    trackEvent({ name: 'stage_open_faq', params: { question } }),
  
  scrollDepth: (depth: number) => 
    trackEvent({ name: 'stage_scroll_depth', params: { depth } })
};
