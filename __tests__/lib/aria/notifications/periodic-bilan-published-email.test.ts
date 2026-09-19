import { buildPeriodicBilanPublishedEmail } from '@/lib/aria/notifications/periodic-bilan-published-email';

describe('buildPeriodicBilanPublishedEmail', () => {
  const base = {
    parentDisplayName: 'Marie Dupont',
    studentFirstName: 'Mehdi',
    subject: 'MATHS',
    dashboardUrl: 'https://nexusreussite.academy/dashboard/parent/bilans/bilan-1',
  };

  it('names the real student and the real subject, and links to the real parent detail page', () => {
    const email = buildPeriodicBilanPublishedEmail(base);
    expect(email.subject).toContain('Mehdi');
    expect(email.text).toContain('MATHS');
    expect(email.text).toContain(base.dashboardUrl);
    expect(email.html).toContain(base.dashboardUrl);
  });

  it('never includes any pedagogical content — logistics only, real content stays behind the authenticated page', () => {
    const email = buildPeriodicBilanPublishedEmail(base);
    expect(email.text.toLowerCase()).not.toMatch(/forces|faiblesses|plan d'action|nexusmarkdown/);
  });
});
