import { toPreRentreeEntryLevel, track } from '@/lib/analytics';

describe('Pré-rentrée analytics contract', () => {
  it('normalizes only the three stable entry-level identifiers', () => {
    expect(toPreRentreeEntryLevel('SECONDE')).toBe('seconde');
    expect(toPreRentreeEntryLevel('PREMIERE')).toBe('premiere');
    expect(toPreRentreeEntryLevel('TERMINALE')).toBe('terminale');
    expect(() => toPreRentreeEntryLevel('TROISIEME')).toThrow('Unknown entry level');
  });

  it('emits the ten campaign events with normalized non-PII properties', () => {
    const gtag = jest.fn();
    (window as unknown as { gtag: jest.Mock }).gtag = gtag;

    track.preRentreePageView();
    track.preRentreeLevelSelected('premiere');
    track.preRentreeTrackSelected('premiere', 'generale');
    track.preRentreeSubjectSelected('premiere', 'mathematiques', 2);
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
    expect(calls[1]?.[2]).toEqual({ entry_level: 'premiere' });
    expect(calls[2]?.[2]).toEqual({ entry_level: 'premiere', normalized_track: 'generale' });
    expect(calls[3]?.[2]).toEqual({ entry_level: 'premiere', subject_code: 'mathematiques', subject_count: 2 });
    expect(calls[4]?.[2]).toEqual({ schedule_view_type: 'by_week' });
    expect(calls[5]?.[2]).toEqual({ entry_level: 'premiere', subject_code: 'mathematiques' });
    expect(calls[6]?.[2]).toEqual({ pack_code: 'pre2026-pack-2' });
    expect(calls[9]?.[2]).toEqual({ pack_code: 'pre2026-pack-2', entry_level: 'premiere', subject_count: 2 });
    expect(serialized).not.toMatch(/"level"|"track"|"subject"|"count"|"pack_id"|"view"/);
  });
});
