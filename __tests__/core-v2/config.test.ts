import { CoreV2ConfigError, getOrganizationTimezone, isValidIanaTimezone } from '@/lib/core-v2/config';

describe('Core v2 organization configuration — no silent defaults', () => {
  test('missing CORE_V2_ORGANIZATION_TIMEZONE is refused, not defaulted', () => {
    expect(() => getOrganizationTimezone({})).toThrow(CoreV2ConfigError);
    expect(() => getOrganizationTimezone({ CORE_V2_ORGANIZATION_TIMEZONE: '   ' })).toThrow(CoreV2ConfigError);
  });

  test('an invalid IANA zone is refused', () => {
    expect(() => getOrganizationTimezone({ CORE_V2_ORGANIZATION_TIMEZONE: 'Mars/Olympus' })).toThrow(CoreV2ConfigError);
    expect(isValidIanaTimezone('Not/AZone')).toBe(false);
  });

  test('a valid zone is returned verbatim (trimmed)', () => {
    expect(getOrganizationTimezone({ CORE_V2_ORGANIZATION_TIMEZONE: ' Europe/Paris ' })).toBe('Europe/Paris');
    expect(isValidIanaTimezone('Africa/Tunis')).toBe(true);
  });
});
