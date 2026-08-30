import {
  classifyBrowserConsole,
  classifyObservedHttpResponse,
} from '../../e2e/helpers/candidat-browser-diagnostics';

const BASE_URL = 'http://app-e2e:3000';

describe('candidat individuel browser diagnostics', () => {
  it('classe un doublon console Chromium Failed to fetch comme bruit réseau', () => {
    expect(classifyBrowserConsole(
      'http://app-e2e:3000/_next/static/chunks/auth.js',
      'AuthError: Failed to fetch',
      BASE_URL,
    )).toBe('NETWORK');
  });

  it('refuse toute réponse same-origin 500', () => {
    expect(classifyObservedHttpResponse({
      method: 'GET',
      status: 500,
      url: 'http://app-e2e:3000/api/health',
    }, 'wizard réel', BASE_URL)).toBe('APPLICATION');
  });

  it('accepte uniquement le 422 quote prévu par le scénario wizard', () => {
    expect(classifyObservedHttpResponse({
      method: 'POST',
      status: 422,
      url: 'http://app-e2e:3000/api/assistante/candidat-individuel/profils/profil-e2e/quote',
    }, 'wizard réel: publication', BASE_URL)).toBe('NETWORK');
  });

  it('refuse un 422 sur une autre URL du même scénario', () => {
    expect(classifyObservedHttpResponse({
      method: 'POST',
      status: 422,
      url: 'http://app-e2e:3000/api/assistante/candidat-individuel/simulate',
    }, 'wizard réel: publication', BASE_URL)).toBe('APPLICATION');
  });
});
