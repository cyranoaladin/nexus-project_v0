/** @jest-environment node */
import { navigateDocument, reloadDocument } from '@/lib/browser-navigation';

describe('native document navigation boundary', () => {
  const location = { href: '', reload: jest.fn() };
  beforeEach(() => {
    location.href = '';
    location.reload.mockClear();
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { location } });
  });
  afterEach(() => { Reflect.deleteProperty(globalThis, 'window'); });

  it('writes the exact destination to the native location href', () => {
    navigateDocument('/offres#section-plateforme');
    expect(location.href).toBe('/offres#section-plateforme');
    expect(location.reload).not.toHaveBeenCalled();
  });
  it('requests one full native document reload', () => {
    reloadDocument();
    expect(location.reload).toHaveBeenCalledTimes(1);
    expect(location.href).toBe('');
  });
});
