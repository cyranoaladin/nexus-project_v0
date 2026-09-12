import { buildWorkshopReminderEmail } from '@/lib/aria/notifications/workshop-reminder-email';

describe('buildWorkshopReminderEmail', () => {
  const base = {
    parentDisplayName: 'Marie Dupont',
    studentFirstName: 'Mehdi',
    workshopTitle: 'Révisions suites numériques',
    scheduledDateLabel: '3 octobre 2026',
    startTime: '14:00',
    endTime: '15:30',
    location: null,
    dashboardUrl: 'https://nexusreussite.academy/dashboard/parent/enfant/student-1',
  };

  it('names the real student, the real workshop, and the real schedule, and reads as a reminder', () => {
    const email = buildWorkshopReminderEmail(base);
    expect(email.subject.toLowerCase()).toContain('rappel');
    expect(email.subject).toContain('Mehdi');
    expect(email.text).toContain('Révisions suites numériques');
    expect(email.text).toContain('3 octobre 2026');
    expect(email.text).toContain('14:00');
    expect(email.text).toContain('15:30');
    expect(email.html).toContain(base.dashboardUrl);
  });

  it('includes the location when provided, and omits it cleanly when null', () => {
    const withLocation = buildWorkshopReminderEmail({ ...base, location: 'Salle A' });
    expect(withLocation.text).toContain('Salle A');

    const withoutLocation = buildWorkshopReminderEmail(base);
    expect(withoutLocation.text).not.toContain('(');
  });

  it('never mentions private chat or pedagogical content — logistics only', () => {
    const email = buildWorkshopReminderEmail(base);
    expect(email.text.toLowerCase()).not.toMatch(/conversation|chat|message privé/);
  });
});
