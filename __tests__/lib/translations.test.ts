import { translations } from '@/lib/translations';

function collectKeys(obj: any, prefix = ''): string[] {
  const keys: string[] = [];
  Object.entries(obj).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...collectKeys(value, path));
    } else {
      keys.push(path);
    }
  });
  return keys;
}

describe('translations', () => {
  it('keeps fr and en structures aligned', () => {
    const frKeys = collectKeys(translations.fr).sort();
    const enKeys = collectKeys(translations.en).sort();
    expect(enKeys).toEqual(frKeys);
  });
});
