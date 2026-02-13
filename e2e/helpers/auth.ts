import { Page } from '@playwright/test';

type UserType = 'parent' | 'student' | 'coach' | 'admin';

interface LoginOptions {
    navigate?: boolean;
    targetPath?: string;
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const CREDENTIALS: Record<UserType, { email: string; password: string }> = {
    parent: { email: 'parent.dashboard@test.com', password: 'password123' },
    student: { email: 'yasmine.dupont@test.com', password: 'password123' },
    coach: { email: 'helios@test.com', password: 'password123' },
    admin: { email: 'admin@test.com', password: 'password123' },
};

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
            const response = await page.request.get(`${BASE_URL}/api/auth/csrf`);
            const contentType = response.headers()['content-type'] || '';
            if (!response.ok() || !contentType.includes('application/json')) {
                const body = await response.text();
                throw new Error(`CSRF response not JSON (${response.status()}): ${body.slice(0, 200)}`);
            }
            const json = (await response.json()) as { csrfToken: string };
            return { json, response };
        } catch (error) {
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
    throw lastError instanceof Error ? lastError : new Error('Failed to fetch CSRF token');
}

async function setAuthCookies(page: Page, email: string, password: string, targetPath: string) {
    let lastError: unknown;

    for (let i = 0; i < 5; i += 1) {
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
                cookie.name.includes('next-auth.session-token')
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
                    domain: 'localhost',
                    path: cookie.path || '/',
                }))
                .filter((cookie) => cookie.name && cookie.value);

            await page.context().addCookies(authCookies);
            return;
        } catch (error) {
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, 750));
        }
    }

    throw lastError instanceof Error ? lastError : new Error('Failed to set auth cookies');
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

    await setAuthCookies(page, email, password, targetPath);

    if (navigate) {
        await page.goto(targetPath, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');
    }
}

export { ROLE_PATHS };
