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
            email: 'parent.dashboard@test.com',
            password: 'password123',
        },
        student: {
            email: 'yasmine.dupont@test.com',
            password: 'password123',
        },
        coach: {
            email: 'helios@test.com',
            password: 'password123',
        },
    };

    const { email, password } = credentials[userType];

    // Navigate to signin page
    await page.goto('/auth/signin', { waitUntil: 'networkidle' });

    // Fill in credentials
    await page.getByLabel(/email/i).fill(email);
    await page.getByPlaceholder('Votre mot de passe').fill(password);

    // Submit form
    await page.getByRole('button', { name: /accéder|sign in|connexion/i }).click();

    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}
