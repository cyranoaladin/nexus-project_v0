import { Page } from '@playwright/test';
import { CREDS, type CredRole } from './credentials';
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
 * Jeton CSRF tel que le contexte le detient REELLEMENT.
 *
 * auth.js stocke `token|hash` dans le cookie et compare la partie gauche au
 * champ `csrfToken` du formulaire. Lire le cookie garantit que les deux
 * concordent, quel que soit ce qui s'est produit entre-temps.
 */
async function csrfTokenFromCookie(page: Page): Promise<string | null> {
    const cookie = (await page.context().cookies(BASE_URL)).find((c) => c.name.includes('csrf-token'));
    if (!cookie?.value) return null;
    return decodeURIComponent(cookie.value).split('|')[0] || null;
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

    // Le jeton ne vaut RIEN sans son cookie : auth.js compare les deux et
    // refuse le callback en `MissingCSRF` s'il manque. Or la reponse ne porte
    // pas toujours de `Set-Cookie` — elle n'en emet pas quand le contexte est
    // cense en detenir un deja. Poursuivre sans verifier laissait l'echec
    // apparaitre quarante lignes plus loin, sous la forme muette « no
    // session-token cookie », sans jamais nommer le CSRF.
    //
    // On verifie donc que le contexte detient bien le cookie. S'il manque, on
    // repart d'un etat propre et on redemande une emission — puis on echoue
    // franchement plutot que de tenter une connexion vouee au refus.
    const hasCsrfCookie = async () =>
        (await page.context().cookies(BASE_URL)).some((c) => c.name.includes('csrf-token'));

    if (!(await hasCsrfCookie())) {
        await page.context().clearCookies();
        const retry = await page.request.get(`${BASE_URL}/api/auth/csrf`, { timeout: 15_000 });
        const retryCookies = parseSetCookie(getSetCookieHeaders(retry))
            .map((cookie) => ({
                name: cookie.name,
                value: cookie.value,
                domain: BASE_URL_HOST,
                path: cookie.path || '/',
            }))
            .filter((c) => c.name && c.value);
        if (retryCookies.length > 0) {
            await page.context().addCookies(retryCookies);
        }
        if (!(await hasCsrfCookie())) {
            throw new Error(
                'CSRF cookie absent apres deux emissions : le callback serait refuse en MissingCSRF. '
                + `Cookies du contexte : ${(await page.context().cookies(BASE_URL)).map((c) => c.name).join(', ') || '(aucun)'}`,
            );
        }
        return ((await retry.json()) as { csrfToken: string }).csrfToken;
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
    //
    // Le jeton envoye est DERIVE DU COOKIE detenu a cet instant, et non de la
    // reponse JSON obtenue plus tot. auth.js compare les deux : la page reste
    // ouverte pendant l'operation et son sondage de session peut reemettre un
    // cookie entre la lecture du jeton et cet envoi. Le jeton devenait alors
    // orphelin et le callback etait refuse en `MissingCSRF` — echec
    // intermittent, d'autant plus frequent que les connexions se multiplient.
    // Lire le cookie ici supprime la course au lieu d'en attenuer les effets.
    const effectiveCsrfToken = (await csrfTokenFromCookie(page)) ?? csrfToken;

    const callbackResponse = await page.request.post(
        `${BASE_URL}/api/auth/callback/credentials`,
        {
            form: {
                csrfToken: effectiveCsrfToken,
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
        // Le callback a repondu 200/302 mais sans cookie de session : auth.js a
        // ACCEPTE la requete et REFUSE les identifiants. Sans le motif, l'echec
        // ne dit rien — on ne sait ni si le compte a ete modifie par une autre
        // spec, ni si une limite de debit a ete atteinte. On expose donc la
        // destination de la redirection et les cookies effectivement recus.
        const location = callbackResponse.headers()['location'] ?? '(aucune redirection)';
        const received = sessionCookies.map((c) => c.name).join(', ') || '(aucun)';
        throw new Error(
            `No session-token cookie returned for ${email} — HTTP ${status}, `
            + `redirection vers ${location}, cookies recus : ${received}`,
        );
    }
}

/**
 * Poll /api/auth/session until the expected user appears.
 */
export async function waitForAuthenticatedSession(page: Page, expectedEmail: string, attempts = 60) {
    // La prise d'effet d'une session est asynchrone : le cookie est pose, puis
    // `/api/auth/session` finit par le refleter. Le budget etait de 20 tentatives
    // a 300 ms, soit 6 s. Il suffisait a vide et pas sous charge : la suite
    // complete produisait des echecs intermittents « Unable to establish
    // authenticated session » que ni l'execution isolee ni les paires ne
    // reproduisaient. Le budget passe a 18 s — on attend une operation
    // asynchrone plus longtemps, on ne rejoue pas un test qui a echoue.
    let lastStatus = 0;
    let lastEmail: string | undefined;
    for (let i = 0; i < attempts; i += 1) {
        const res = await page.request.get(`${BASE_URL}/api/auth/session`, {
            timeout: 10_000,
            failOnStatusCode: false,
        });
        lastStatus = res.status();
        if (res.ok()) {
            try {
                const session = (await res.json()) as { user?: { email?: string } };
                lastEmail = session?.user?.email;
                if (session?.user?.email?.toLowerCase() === expectedEmail.toLowerCase()) {
                    return;
                }
            } catch {
                // ignore malformed JSON and retry
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
    }
    // Distinguer une attente trop courte d'une session reellement etablie sur
    // un AUTRE compte : sans cette information, les deux se ressemblent.
    throw new Error(
        `Unable to establish authenticated session for ${expectedEmail} — `
        + `dernier statut ${lastStatus}, dernier utilisateur vu : ${lastEmail ?? '(aucun)'}`,
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
    await page.context().clearCookies();
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
    await page.context().clearCookies();
    await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
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
