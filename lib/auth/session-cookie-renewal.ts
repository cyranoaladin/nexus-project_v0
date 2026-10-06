/**
 * With the JWT strategy, Auth.js re-issues the session cookie on every
 * authenticated `GET /api/auth/session`. A read that is still in flight when
 * `POST /api/auth/signout` deletes the cookie then lands afterwards and writes
 * it back: the user who just signed out is signed in again (measured: cookie
 * present and a live server session 5 s after logout, while the UI showed the
 * "vérification indisponible" notice). middleware.ts already strips Set-Cookie
 * for page routes for the same reason; this closes the last route that renews.
 *
 * Applied to the GET handler only. Every sign-in here is a POST (credentials
 * providers only), so no GET on the auth API has a legitimate reason to write
 * a session token; an OAuth or email provider added later would have to
 * revisit this. Only a session-token cookie carrying a value is withheld.
 * Deletions (empty value or Max-Age=0) still pass, so revocation and normal
 * cookie retirement keep working. The session therefore lasts the Auth.js
 * maxAge from sign-in instead of sliding with every read.
 */
const SESSION_TOKEN_COOKIE = /^(?:__Secure-)?authjs\.session-token(?:\.\d+)?=([^;]*)/;

export function isSessionTokenRenewal(setCookie: string): boolean {
  const match = SESSION_TOKEN_COOKIE.exec(setCookie);
  if (!match) return false;
  return match[1] !== '' && !/;\s*max-age=0\s*(?:;|$)/i.test(setCookie);
}

export function withoutSessionCookieRenewal<R extends Request>(handler: (request: R) => Promise<Response>) {
  return async (request: R): Promise<Response> => {
    const response = await handler(request);
    const cookies = response.headers.getSetCookie();
    const kept = cookies.filter((value) => !isSessionTokenRenewal(value));
    if (kept.length === cookies.length) return response;
    const headers = new Headers(response.headers);
    headers.delete('set-cookie');
    for (const value of kept) headers.append('set-cookie', value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  };
}
