import { Page } from '@playwright/test';
import { CREDS, type CredRole } from './credentials';

type UserType = 'parent' | 'student' | 'student2' | 'studentSurvival' | 'coach' | 'coach2' | 'admin' | 'assistante';

interface LoginOptions {
    navigate?: boolean;
    targetPath?: string;
}

// Keep E2E auth deterministic: do not rely on app NEXTAUTH_URL from random shells.
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const BASE_URL_HOST = new URL(BASE_URL).hostname;

const CREDENTIALS = CREDS;

const ROLE_PATHS: Record<UserType, string> = {
    parent: '/dashboard/parent',
    student: '/dashboard/eleve',
    student2: '/dashboard/eleve',
    studentSurvival: '/dashboard/eleve',
    coach: '/dashboard/coach',
    coach2: '/dashboard/coach',
    admin: '/dashboard/admin',
    assistante: '/dashboard/assistante',
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
async function waitForAuthenticatedSession(page: Page, expectedEmail: string, attempts = 20) {
    for (let i = 0; i < attempts; i += 1) {
        const res = await page.request.get(`${BASE_URL}/api/auth/session`, {
            timeout: 10_000,
            failOnStatusCode: false,
        });
        if (res.ok()) {
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

    await setAuthCookies(page, email, password, targetPath);
    await waitForAuthenticatedSession(page, email);

    if (navigate) {
        await page.goto(targetPath, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');
    }
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
