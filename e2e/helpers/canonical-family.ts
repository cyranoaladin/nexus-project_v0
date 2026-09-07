import type { Browser } from '@playwright/test';
import { loginAsUser } from './auth';
import { BASE_URL, mutationHeaders } from './golden-family';

/**
 * Task 20 (post-#217-merge E2E convergence) — canonical staff-qualification
 * step for E2E fixtures that used to rely on `/bilan-gratuit` directly
 * creating a real `User(PARENT)`/`Student`. Task 4 changed `/bilan-gratuit`
 * to create a `FamilyRequest(type=BILAN_GRATUIT)` instead (Amendement 7):
 * staff must list, then convert it — `POST
 * /api/assistante/family-requests/[requestId]/convert`, which calls the
 * canonical `createFamily()` service in `mode: 'PAPER_ENTRY'` (see that
 * route: email activation is NOT a legacy path for this origin — it is the
 * canonical channel `createFamily()` uses whenever `contactEmail` is
 * present, exactly the same as production staff qualifying a real lead).
 *
 * Runs in its OWN isolated browser context (never the test's own `page`):
 * a staff session must never leak into the parent/student browser context
 * under test. The context is always closed before returning, success or
 * failure.
 */
export async function convertBilanGratuitRequest(
  browser: Browser,
  contactEmail: string,
): Promise<{ requestId: string; parentUserId: string; studentIds: string[] }> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await loginAsUser(page, 'assistante', { navigate: false });

    const listResponse = await page.request.get(
      `${BASE_URL}/api/assistante/family-requests?type=BILAN_GRATUIT&status=SUBMITTED`,
    );
    if (listResponse.status() !== 200) {
      throw new Error(`FAMILY_REQUESTS_LIST_FAILED_${listResponse.status()}: ${await listResponse.text()}`);
    }
    const { items } = (await listResponse.json()) as {
      items: Array<{ id: string; contactEmail: string | null }>;
    };
    const match = items.find((item) => item.contactEmail === contactEmail);
    if (!match) {
      throw new Error(`FAMILY_REQUEST_NOT_FOUND_FOR_EMAIL: ${contactEmail}`);
    }

    const convertResponse = await page.request.post(
      `${BASE_URL}/api/assistante/family-requests/${match.id}/convert`,
      { headers: mutationHeaders() },
    );
    if (convertResponse.status() !== 200) {
      throw new Error(`FAMILY_REQUEST_CONVERT_FAILED_${convertResponse.status()}: ${await convertResponse.text()}`);
    }
    const body = (await convertResponse.json()) as {
      requestId: string;
      parentUserId: string;
      studentIds: string[];
    };
    return body;
  } finally {
    await context.close();
  }
}
