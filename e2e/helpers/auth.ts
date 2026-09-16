import type { APIResponse, Page } from '@playwright/test';
import { CREDS } from './credentials';
import { resetDisposableE2ERateLimits } from './rate-limit';

export type UserType =
    | 'parent'
    | 'student'
    | 'student2'
    | 'studentSurvival'
    | 'coach'
    | 'coach2'
    | 'admin'
    | 'assistante'
    | 'ariaPersonasParent'
    | 'ariaTerminaleMaths'
    | 'ariaPremiereMaths'
    | 'ariaNsi'
    | 'ariaNsiPeer'
    | 'ariaStmgNoChat'
    | 'ariaIncompleteProfile'
    | 'ariaNotEntitled';

interface LoginOptions {
    navigate?: boolean;
    targetPath?: string;
}

// Keep E2E auth deterministic: do not rely on app NEXTAUTH_URL from random shells.
const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';
const BASE_URL_HOST = new URL(BASE_URL).hostname;

const CREDENTIALS = CREDS;

const ROLE_PATHS: Record<UserType, string> = {
    parent: '/dashboard/parent',
    ariaPersonasParent: '/dashboard/parent',
    student: '/dashboard/eleve',
    student2: '/dashboard/eleve',
    studentSurvival: '/dashboard/eleve',
    coach: '/dashboard/coach',
    coach2: '/dashboard/coach',
    admin: '/dashboard/admin',
    assistante: '/dashboard/assistante',
    ariaTerminaleMaths: '/dashboard/eleve',
    ariaPremiereMaths: '/dashboard/eleve',
    ariaNsi: '/dashboard/eleve',
    ariaNsiPeer: '/dashboard/eleve',
    ariaStmgNoChat: '/dashboard/eleve',
    ariaIncompleteProfile: '/dashboard/eleve',
    ariaNotEntitled: '/dashboard/eleve',
};

function parseSetCookie(setCookieHeader?: string | string[]) {
    if (!setCookieHeader) return [];
    const raw = Array.isArray(setCookieHeader) ? setCookieHeader.join(',') : setCookieHeader;
    return raw
        .split(/,(?=[^;]+?=)/)
        .map((cookieStr) => {
            const [pair, ...attrs] = cookieStr.split(';').map((part) => part.trim());
            const [name, value] = pair.split('=');
            const pathAttr = attrs.find((attr) => attr.toLowerCase().startsWith('path='));
            const path = pathAttr ? pathAttr.split('=')[1] : '/';
            if (!name || typeof value === 'undefined') {
                return null;
            }
            return { name, value, path };
        })
        .filter(
            (cookie): cookie is { name: string; value: string; path: string } => !!cookie
        );
}

function getSetCookieHeaders(response: { headersArray: () => { name: string; value: string }[] }) {
    return response
        .headersArray()
        .filter((header) => header.name.toLowerCase() === 'set-cookie')
        .map((header) => header.value);
}

/**
 * Fetch CSRF token and install its cookies into the browser context.
 * Returns the csrfToken string for use in form submissions.
 */
async function fetchCsrfAndInstall(page: Page): Promise<string> {
    const response = await page.request.get(`${BASE_URL}/api/auth/csrf`, {
        timeout: 15_000,
    });
    const contentType = response.headers()['content-type'] || '';
    if (!response.ok() || !contentType.includes('application/json')) {
        const body = await response.text();
        throw new Error(`CSRF response not JSON (${response.status()}): ${body.slice(0, 200)}`);
    }
    const json = (await response.json()) as { csrfToken: string };

    // Install CSRF cookies into browser context so all subsequent requests carry them
    const csrfCookies = parseSetCookie(getSetCookieHeaders(response))
        .map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
            domain: BASE_URL_HOST,
            path: cookie.path || '/',
        }))
        .filter((c) => c.name && c.value);

    if (csrfCookies.length > 0) {
        await page.context().addCookies(csrfCookies);
    }

    return json.csrfToken;
}

/**
 * Authenticate via the real NextAuth credentials flow:
 * GET /api/auth/csrf → install cookie → POST /api/auth/callback/credentials
 * ONE path, no fallback, no manual cookie headers.
 */
async function setAuthCookies(page: Page, email: string, password: string, targetPath: string) {
    // 1. Fetch CSRF token and install its cookie into the browser context
    const csrfToken = await fetchCsrfAndInstall(page);

    // 2. POST to credentials callback — page.request uses context cookies automatically
    const callbackResponse = await page.request.post(
        `${BASE_URL}/api/auth/callback/credentials`,
        {
            form: {
                csrfToken,
                email,
                password,
                callbackUrl: `${BASE_URL}${targetPath}`,
                json: 'true',
            },
            maxRedirects: 0, // Don't follow redirects (avoids CSRF-less redirect chains)
        }
    );

    // Accept 200 (JSON response) or 302 (redirect after auth)
    const status = callbackResponse.status();
    if (status !== 200 && status !== 302) {
        const body = await callbackResponse.text();
        throw new Error(`Auth callback failed (HTTP ${status}): ${body.slice(0, 200)}`);
    }

    // 3. Install session cookies from the callback response into context
    const sessionCookies = parseSetCookie(getSetCookieHeaders(callbackResponse))
        .map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
            domain: BASE_URL_HOST,
            path: cookie.path || '/',
        }))
        .filter((c) => c.name && c.value);

    if (sessionCookies.length > 0) {
        await page.context().addCookies(sessionCookies);
    }

    const hasSession = sessionCookies.some((c) => c.name.includes('session-token'));
    if (!hasSession) {
        throw new Error(`No session-token cookie returned for ${email}`);
    }
}

/**
 * Poll /api/auth/session until the expected user appears.
 */
export async function waitForAuthenticatedSession(page: Page, expectedEmail: string, attempts = 20) {
    for (let i = 0; i < attempts; i += 1) {
        let res: APIResponse | undefined;
        try {
            res = await page.request.get(`${BASE_URL}/api/auth/session`, {
                timeout: 10_000,
                failOnStatusCode: false,
            });
        } catch (error) {
            // A reset provides no session observation. Consume the existing
            // bounded GET budget; never replay the credentials/activation flow.
            // Inspect only the error summary, not Playwright's logged headers.
            if (!(error instanceof Error) || !/\bECONNRESET\b/.test(error.message.split('\n')[0])) throw error;
        }
        if (res?.ok()) {
            try {
                const session = (await res.json()) as { user?: { email?: string } };
                if (session?.user?.email?.toLowerCase() === expectedEmail.toLowerCase()) {
                    return;
                }
            } catch {
                // ignore malformed JSON and retry
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error(`Unable to establish authenticated session for ${expectedEmail}`);
}

/**
 * Start from a clean browser identity, deterministically. Navigating to
 * about:blank FIRST disposes the previous role's document: its client-side
 * session refresh (Auth.js re-issues the JWT cookie on /api/auth/session)
 * can otherwise land AFTER clearCookies() and resurrect the old session —
 * the next /auth/signin (which does `await auth()`) then redirects straight
 * back to that role's dashboard. Observed in CI as core-golden-family.spec
 * landing on /dashboard/assistante instead of /auth/signin?activated=true
 * (2026-09-10 main 223285f8, 2026-09-11 PR #234 b77bc149) and as
 * parent-canonical-report-access.spec timing out on the sign-in form while a
 * /dashboard/eleve navigation was still pending (2026-09-09).
 * The architecture guard __tests__/architecture/e2e-browser-session-isolation.test.ts
 * makes this the only way to clear cookies under e2e/.
 */
/**
 * Navigate to the sign-in form and PROVE we landed on it.
 *
 * `resetBrowserSession` clears the cookie jar and confirms with the server
 * that no session resolves. That check is necessary but not sufficient: it
 * proves the state at the instant it ran, and a session refresh still on the
 * wire from the previous role's document can land its Set-Cookie immediately
 * afterwards. A real CI trace showed the whole race inside 34ms —
 *
 *   19:32:26.819  200  /api/auth/session   (server: no session)
 *   19:32:26.853  307  /auth/signin        (server: you are admin)
 *   19:32:26.875  200  /dashboard
 *
 * — so `/auth/signin` (`await auth()`) redirected to the previous role's
 * dashboard and the sign-in textbox never appeared.
 *
 * No amount of pre-checking closes that window, because the check and the
 * navigation cannot be atomic. So this observes the OUTCOME instead: if the
 * navigation did not land on the form, the session was resurrected, and we
 * clear and try again. Bounded, deterministic, and driven by what actually
 * happened rather than by a proxy for it.
 */
export async function gotoSignInForm(page: Page, attempts = 3): Promise<void> {
    for (let attempt = 1; attempt <= attempts; attempt++) {
        await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
        if (new URL(page.url()).pathname.startsWith('/auth/signin')) return;

        // Redirected away: a straggler refresh re-issued the session cookie
        // between the clear and this navigation. Dispose and clear again.
        await resetBrowserSession(page);
    }

    throw new Error(
        `gotoSignInForm: /auth/signin redirected to ${page.url()} on all ${attempts} attempts. ` +
        'A previous role\'s session keeps being re-issued after the cookie jar is cleared.'
    );
}

export async function resetBrowserSession(page: Page): Promise<void> {
    // Dispose the previous document FIRST. Auth.js re-issues the JWT cookie on
    // the client-side /api/auth/session refresh, so a refresh still in flight
    // can land its Set-Cookie AFTER clearCookies() and resurrect the session;
    // the next `/auth/signin` render (`await auth()`) then redirects to that
    // role's dashboard instead of serving the form, and the sign-in textbox
    // never appears.
    await page.goto('about:blank');

    // about:blank stops NEW refreshes being issued, but it cannot recall one
    // already on the wire. So clear, then ask the server what it still sees
    // through this same cookie jar: the request is made after the clear, so a
    // resolved session can only mean a straggler landed in between. Clearing
    // again then converges, because no document remains to issue another.
    const context = page.context();
    let lastObserved = '';

    for (let attempt = 1; attempt <= 5; attempt++) {
        await context.clearCookies();

        const response = await page.request.get('/api/auth/session');
        const session = await response.json().catch(() => null);
        if (!session?.user) return;

        lastObserved = session.user.email ?? session.user.id ?? 'unknown identity';
    }

    throw new Error(
        `resetBrowserSession: the session cookie was re-issued on every one of 5 clears ` +
        `(the server still resolves ${lastObserved}). A client-side session refresh is ` +
        `outliving the document that issued it.`
    );
}

/**
 * Login as a specific user type for E2E tests.
 * Uses REAL NextAuth credentials flow: CSRF → callback → session.
 * NO fallback, NO stubs — if this fails, the test fails with a clear error.
 */
export async function loginAsUser(
    page: Page,
    userType: UserType,
    options: LoginOptions = {}
) {
    const { navigate = true, targetPath = ROLE_PATHS[userType] } = options;
    const { email, password } = CREDENTIALS[userType];

    await resetDisposableE2ERateLimits();
    // A role switch inside one test must start from a single, unambiguous
    // identity. Keeping the previous JWT alongside a newly issued cookie can
    // make RBAC assertions depend on cookie selection/order.
    await resetBrowserSession(page);
    await setAuthCookies(page, email, password, targetPath);
    await waitForAuthenticatedSession(page, email);

    if (navigate) {
        await page.goto(targetPath, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');
    }
}

/** Exercise the browser-visible credentials form using the same seed manifest. */
export async function loginViaSigninForm(page: Page, userType: UserType) {
    const { email, password } = CREDENTIALS[userType];
    const targetPath = ROLE_PATHS[userType];

    await resetDisposableE2ERateLimits();
    await resetBrowserSession(page);
    // Same race as signInAs: prove we landed on the form, do not assume it.
    await gotoSignInForm(page);
    await page.waitForFunction(() => {
        const email = document.querySelector<HTMLInputElement>('#email');
        const password = document.querySelector<HTMLInputElement>('#password');
        const isReactControlled = (element: HTMLInputElement | null) =>
            element !== null && Object.keys(element).some((key) => key.startsWith('__reactProps$'));
        return isReactControlled(email) && isReactControlled(password);
    });
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await Promise.all([
        page.waitForURL(`**${targetPath}**`, { timeout: 30_000 }),
        page.getByTestId('btn-signin').click(),
    ]);
    await waitForAuthenticatedSession(page, email);
}

/**
 * Sign out via the real NextAuth signout flow WITH CSRF.
 * GET /api/auth/csrf → POST /api/auth/signout with csrfToken.
 */
export async function logoutUser(page: Page) {
    const csrfToken = await fetchCsrfAndInstall(page);

    await page.request.post(`${BASE_URL}/api/auth/signout`, {
        form: { csrfToken },
        maxRedirects: 0,
    });

    await page.context().clearCookies();
}

export { ROLE_PATHS };
