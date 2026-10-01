import { getVideoMode, parseVideoMode } from '@/lib/video-mode';

describe('the single video availability contract', () => {
  const original = process.env.NEXT_PUBLIC_VIDEO_MODE;

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_VIDEO_MODE;
    else process.env.NEXT_PUBLIC_VIDEO_MODE = original;
  });

  it('retains legacy JITSI semantics when the mode is absent', () => {
    expect(parseVideoMode(undefined)).toBe('JITSI');
    delete process.env.NEXT_PUBLIC_VIDEO_MODE;
    expect(getVideoMode()).toBe('JITSI');
  });

  it.each(['DISABLED', 'JITSI'] as const)('accepts the explicit %s mode', (mode) => {
    process.env.NEXT_PUBLIC_VIDEO_MODE = mode;
    expect(parseVideoMode(mode)).toBe(mode);
    expect(getVideoMode()).toBe(mode);
  });

  it.each(['', 'disabled', 'JITSI_DISABLED', ' DISABLED '])('refuses an unknown or ambiguous mode %p', (mode) => {
    expect(() => parseVideoMode(mode)).toThrow('VIDEO_MODE_INVALID');
  });
});
