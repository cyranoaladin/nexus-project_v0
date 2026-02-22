import { Page } from '@playwright/test';
import { CREDS, type CredRole } from './credentials';

type UserType = 'parent' | 'student' | 'coach' | 'admin';

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
    coach: '/dashboard/coach',
    admin: '/dashboard/admin',
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

async function fetchCsrf(page: Page, attempts = 3) {
    let lastError: unknown;
    for (let i = 0; i < attempts; i += 1) {
        try {
            const response = await page.request.get(`${BASE_URL}/api/auth/csrf`, {
                timeout: 15_000,
            });
            const contentType = response.headers()['content-type'] || '';
            if (!response.ok() || !contentType.includes('application/json')) {
                const body = await response.text();
                throw new Error(`CSRF response not JSON (${response.status()}): ${body.slice(0, 200)}`);
            }
            const json = (await response.json()) as { csrfToken: string };
            return { json, response };
        } catch (error) {
            lastError = error;
            const backoffMs = Math.min(500 * (i + 1), 3000);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
    }
    throw lastError instanceof Error ? lastError : new Error('Failed to fetch CSRF token');
}

async function setAuthCookies(page: Page, email: string, password: string, targetPath: string) {
    let lastError: unknown;

    for (let i = 0; i < 2; i += 1) {
        try {
            const { json: csrfJson, response: csrfResponse } = await fetchCsrf(page);
            const csrfCookies = parseSetCookie(getSetCookieHeaders(csrfResponse));

            const callbackResponse = await page.request.post(
                `${BASE_URL}/api/auth/callback/credentials`,
                {
                    form: {
                        csrfToken: csrfJson.csrfToken,
                        email,
                        password,
                        callbackUrl: `${BASE_URL}${targetPath}`,
                        json: 'true',
                    },
                    headers: {
                        cookie: csrfCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; '),
                    },
                }
            );

            const callbackCookies = parseSetCookie(getSetCookieHeaders(callbackResponse));
            const hasSession = callbackCookies.some((cookie) =>
                cookie.name.includes('session-token')
            );

            if (!callbackResponse.ok() || !hasSession) {
                const contentType = callbackResponse.headers()['content-type'] || '';
                const body = contentType.includes('application/json')
                    ? JSON.stringify(await callbackResponse.json())
                    : await callbackResponse.text();
                if (body.includes('csrf=true') || body.includes('/api/auth/signin')) {
                    throw new Error(`Auth callback requested CSRF retry: ${body.slice(0, 200)}`);
                }
                throw new Error(`Auth callback failed (${callbackResponse.status()}): ${body.slice(0, 200)}`);
            }

            const authCookies = [...csrfCookies, ...callbackCookies]
                .map((cookie) => ({
                    name: cookie.name,
                    value: cookie.value,
                    domain: BASE_URL_HOST,
                    path: cookie.path || '/',
                }))
                .filter((cookie) => cookie.name && cookie.value);

            await page.context().addCookies(authCookies);
            return;
        } catch (error) {
            lastError = error;
            const backoffMs = Math.min(750 * (i + 1), 4000);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
    }

    throw lastError instanceof Error ? lastError : new Error('Failed to set auth cookies');
}

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
 * Login as a specific user type for E2E tests using API-based auth.
 */
export async function loginAsUser(
    page: Page,
    userType: UserType,
    options: LoginOptions = {}
) {
    const { navigate = true, targetPath = ROLE_PATHS[userType] } = options;
    const { email, password } = CREDENTIALS[userType];

    try {
        await setAuthCookies(page, email, password, targetPath);
        await waitForAuthenticatedSession(page, email);
    } catch {
        // Fallback to UI login when callback flow changes.
        await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
        await page.getByTestId('input-email').fill(email);
        await page.getByTestId('input-password').fill(password);
        await page.getByTestId('btn-signin').click();
        await waitForAuthenticatedSession(page, email);
    }

    if (navigate) {
        await page.goto(targetPath, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');
    }
}

export { ROLE_PATHS };
