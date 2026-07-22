import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const sourcePath = join(root, 'content/pre-rentree-2026/week-one-campaign.fr.json');
const outputRoot = join(root, 'assets/campaigns/pre-rentree-2026/week-one');

describe('Pré-rentrée 2026 week-one campaign kit', () => {
  it('contains final channel copy, testable hooks, CTA, UTM and proofs', () => {
    const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
    const publication = source.mainPublication;

    expect(publication.hooks).toHaveLength(3);
    expect(publication.ctas).toHaveLength(2);
    expect(publication.facebook.body.length).toBeGreaterThan(500);
    expect(publication.instagram.body.length).toBeGreaterThan(250);
    expect(publication.metaAds.body.length).toBeGreaterThan(120);
    expect(publication.whatsappShare.body.length).toBeGreaterThan(180);
    expect(publication.hashtags.length).toBeGreaterThanOrEqual(5);
    expect(publication.altText.length).toBeGreaterThan(80);
    expect(publication.whatsappPrefill.length).toBeGreaterThan(80);
    expect(publication.utm).toMatchObject({
      source: expect.any(String),
      medium: expect.any(String),
      campaign: 'pre_rentree_2026',
    });
    expect(publication.proofIds.length).toBeGreaterThan(0);
  });

  it('defines eight complete carousel slides and three three-frame Story sequences', () => {
    const source = JSON.parse(readFileSync(sourcePath, 'utf8'));

    expect(source.carousel.slides).toHaveLength(8);
    expect(source.carousel.slides.every((slide: Record<string, unknown>) => (
      typeof slide.title === 'string' && typeof slide.body === 'string'
      && typeof slide.altText === 'string' && typeof slide.proofIds !== 'undefined'
    ))).toBe(true);
    expect(source.stories.sequences).toHaveLength(3);
    expect(source.stories.sequences.flatMap((sequence: { frames: unknown[] }) => sequence.frames)).toHaveLength(9);
    expect(source.stories.sequences.every((sequence: { frames: Array<Record<string, unknown>> }) => (
      sequence.frames.every((frame) => frame.text && frame.durationSeconds && frame.interaction && frame.cta && frame.altText)
    ))).toBe(true);
  });

  it('defines a timed Reel with full voice-over, production instructions and subtitles', () => {
    const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
    const reel = source.reel;

    expect(reel.durationSeconds).toBeGreaterThanOrEqual(25);
    expect(reel.durationSeconds).toBeLessThanOrEqual(35);
    expect(reel.voiceOver.length).toBeGreaterThan(350);
    expect(reel.timeline.length).toBeGreaterThanOrEqual(6);
    expect(reel.timeline[0].start).toBe(0);
    expect(reel.timeline.at(-1).end).toBe(reel.durationSeconds);
    expect(reel.timeline.every((item: Record<string, unknown>) => (
      item.plan && item.voiceOver && item.onScreenText && item.transition && item.editing
    ))).toBe(true);
    expect(reel.safeZones).toMatchObject({ top: expect.any(Number), bottom: expect.any(Number) });
    expect(reel.mediaNeeded.length).toBeGreaterThanOrEqual(4);
    expect(reel.caption.length).toBeGreaterThan(150);
  });

  it('defines a complete seven-day calendar with no unsupported testimonial', () => {
    const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
    const days = source.calendar.days;

    expect(days).toHaveLength(7);
    expect(days.map((day: { day: string }) => day.day)).toEqual(['J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7']);
    expect(days.every((day: Record<string, unknown>) => (
      day.date && day.time && day.channel && day.audience && day.level
      && day.funnelStage && day.objective && day.assetId && day.body
      && day.cta && day.utm && day.whatsappScriptId && day.expectedKpi
    ))).toBe(true);
    expect(days.find((day: { day: string }) => day.day === 'J6').body).not.toMatch(/témoignage|avis parent/i);
  });

  it('contains no internal vocabulary, SNT or hidden benefit in public copy', () => {
    const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
    const publicCopy = JSON.stringify({
      mainPublication: source.mainPublication,
      carousel: source.carousel,
      stories: source.stories,
      reel: source.reel,
      calendar: source.calendar,
    });

    expect(publicCopy).not.toMatch(/\b(?:Gate|REVIEW|blocked|owner|placeholder)\b/i);
    expect(publicCopy).not.toMatch(/SNT/i);
    expect(publicCopy).not.toMatch(/manuel offert|remise annuelle|réduction annuelle|10\s*%/i);
    expect(publicCopy).not.toMatch(/garanti|garantie de résultat|places très limitées/i);
  });

  it('references a generated manifest and all primary deliverables', () => {
    const expected = [
      'manifest.json',
      'copy/publication-copy.json',
      'calendar/week-one-calendar.json',
      'calendar/week-one-calendar.csv',
      'calendar/week-one-calendar.pdf',
      'carousel/carousel-week-one.pdf',
      'reel/reel-motion-design.mp4',
      'reel/reel-fr.srt',
      'reel/reel-storyboard.pdf',
      'reel/reel-cover.png',
    ];
    expect(expected.every((path) => existsSync(join(outputRoot, path)))).toBe(true);
  });
});
