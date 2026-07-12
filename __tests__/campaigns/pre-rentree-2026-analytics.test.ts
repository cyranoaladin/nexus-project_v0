import { track } from '@/lib/analytics';

describe('Pré-rentrée analytics contract', () => {
  it('emits the ten campaign events with normalized non-PII properties', () => {
    const gtag = jest.fn();
    (window as unknown as { gtag: jest.Mock }).gtag = gtag;

    track.preRentreePageView();
    track.preRentreeLevelSelected('premiere');
    track.preRentreeTrackSelected('generale');
    track.preRentreeSubjectSelected('mathematiques', 2);
    track.preRentreeScheduleViewed('by_week');
    track.preRentreeProgramViewed('premiere', 'mathematiques');
    track.preRentreePriceSummaryViewed('pre2026-pack-2');
    track.preRentreeBilanClicked('configurator_summary', 'pre2026-pack-2');
    track.preRentreeWhatsAppClicked('configurator_summary', 'pre2026-pack-2');
    track.preRentreePreregistrationStarted('pre2026-pack-2', 'premiere', 2);

    const calls = gtag.mock.calls;
    expect(calls.map((call) => call[1])).toEqual([
      'pre_rentree_page_view',
      'pre_rentree_level_selected',
      'pre_rentree_track_selected',
      'pre_rentree_subject_selected',
      'pre_rentree_schedule_viewed',
      'pre_rentree_program_viewed',
      'pre_rentree_price_summary_viewed',
      'pre_rentree_bilan_clicked',
      'pre_rentree_whatsapp_clicked',
      'pre_rentree_preregistration_started',
    ]);
    const serialized = JSON.stringify(calls);
    expect(serialized).not.toMatch(/name|email|phone|telephone|school|establishment|parent_id|student_id/i);
  });
});
