import { Page } from '@playwright/test';

/**
 * Login as a specific user type for E2E tests
 * Uses the actual NextAuth login API to get real session cookies
 */
export async function loginAsUser(
    page: Page,
    userType: 'parent' | 'student' | 'coach'
) {
    const credentials = {
        parent: {
            email: 'parent@example.com',
            password: 'admin123',
        },
        student: {
            email: 'student@example.com',
            password: 'admin123',
        },
        coach: {
            email: 'coach@example.com',
            password: 'admin123',
        },
    };

    const { email, password } = credentials[userType];

    // Navigate to signin page
    await page.goto('/auth/signin');

    // Fill in credentials
    await page.fill('#email', email);
    await page.fill('#password', password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}
