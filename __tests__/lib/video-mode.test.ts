import { getVideoMode, parseDedicatedJitsiUrl, parseVideoMode } from '@/lib/video-mode';

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
    process.env.NEXT_PUBLIC_VIDEO_MODE = mode;
    expect(() => parseVideoMode(mode)).toThrow('VIDEO_MODE_INVALID');
    expect(() => getVideoMode()).toThrow('VIDEO_MODE_INVALID');
  });

  it.each([
    'https://meet.jit.si./',
    'https://localhost./',
    'https://video.test./',
    'https://[::1]/',
    'https://192.168.1.10/',
    'https://169.254.1.10/',
    ' https://video.nexusreussite.academy/',
    'https://video.nexusreussite.academy/ ',
  ])('refuses a public fallback or local Jitsi origin %s', (url) => {
    expect(() => parseDedicatedJitsiUrl(url)).toThrow('NEXT_PUBLIC_JITSI_SERVER_URL_INVALID');
  });

  it('normalizes an uppercase HTTPS scheme for explicit JITSI', () => {
    expect(parseDedicatedJitsiUrl('HTTPS://video.nexusreussite.academy/').origin)
      .toBe('https://video.nexusreussite.academy');
  });
});
