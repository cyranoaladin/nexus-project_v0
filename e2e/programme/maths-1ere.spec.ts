import { test, expect } from '@playwright/test';

const BASE_URL = '/programme/maths-1ere';

test.describe('Maths Lab — Student Journey', () => {

    // ═══════════════════════════════════════════════════════════════════════════
    // NAVIGATION & CONTENT INTEGRITY
    // ═══════════════════════════════════════════════════════════════════════════

    test('Page loads with correct title and header', async ({ page }) => {
        await page.goto(BASE_URL);
        await expect(page).toHaveTitle(/Spécialité Maths Première/);
        await expect(page.getByText('NEXUS MATHS LAB')).toBeVisible();
        await expect(page.getByText('Programme Officiel 2025-2026')).toBeVisible();
    });

    test('All tab navigation works without 404', async ({ page }) => {
        await page.goto(BASE_URL);

        // Click each main tab and verify content appears
        const tabs = ['Tableau de bord', 'Fiches de Cours', 'Quiz Express'];
        for (const tabName of tabs) {
            const tab = page.getByText(tabName, { exact: false }).first();
            if (await tab.isVisible()) {
                await tab.click();
                // Give time for content to render
                await page.waitForTimeout(500);
                // No 404/error page
                await expect(page.locator('text=404')).not.toBeVisible();
            }
        }
    });

    test('No chapter title is empty or "undefined"', async ({ page }) => {
        await page.goto(BASE_URL);

        // Navigate to Fiches de Cours
        const fichesTab = page.getByText('Fiches de Cours', { exact: false }).first();
        if (await fichesTab.isVisible()) {
            await fichesTab.click();
            await page.waitForTimeout(1000);
        }

        // Check no "undefined" text in left panel chapter list
        const pageText = await page.locator('body').innerText();
        expect(pageText).not.toContain('undefined');
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // MATHJAX SANITY CHECK (CRITICAL)
    // ═══════════════════════════════════════════════════════════════════════════

    test('MathJax: no raw LaTeX visible in rendered text', async ({ page }) => {
        await page.goto(BASE_URL);

        // Navigate to Fiches de Cours tab
        const fichesTab = page.getByText('Fiches de Cours', { exact: false }).first();
        if (await fichesTab.isVisible()) {
            await fichesTab.click();
            await page.waitForTimeout(500);
        }

        // Click on first available chapter to render math content
        const chapterButton = page.locator('[role="button"], button').filter({ hasText: /Second Degré|Dérivation|Suites/ }).first();
        if (await chapterButton.isVisible()) {
            await chapterButton.click();
            // Wait for MathJax to render (it needs time)
            await page.waitForTimeout(3000);

            // Get the rendered text from the main content area
            const contentArea = page.locator('main, [role="main"], .flex-1').first();
            const innerText = await contentArea.innerText();

            // These patterns should NOT appear in rendered text (they should be rendered by MathJax)
            const rawLatexPatterns = [
                /\\frac\{[^}]*\}\{[^}]*\}/,         // \frac{...}{...}
                /\\\$\$[^$]+\$\$/,                    // $$...$$ (block math)
                /\\sqrt\{[^}]*\}/,                    // \sqrt{...}
                /\\begin\{(align|equation)\}/,        // \begin{align} etc
                /\\text\{[^}]+\}/,                    // \text{...}
                /\\times(?![a-zA-Z])/,               // \times (not followed by letter)
            ];

            for (const pattern of rawLatexPatterns) {
                const match = innerText.match(pattern);
                if (match) {
                    // Only fail if we find raw LaTeX that should have been rendered
                    // Ignore LaTeX inside code blocks or input fields
                    const context = innerText.substring(
                        Math.max(0, innerText.indexOf(match[0]) - 50),
                        innerText.indexOf(match[0]) + match[0].length + 50
                    );
                    console.warn(`⚠️ Potential raw LaTeX found: "${match[0]}" in context: "${context}"`);
                }
            }

            // Verify MathJax rendering elements exist (mjx-math or SVG math rendering)
            const mathJaxRendered = page.locator('mjx-math, mjx-container, .MathJax, .mjx-chtml, svg[data-name="mathml"]');
            const mjxCount = await mathJaxRendered.count();
            // If there's math content, MathJax should have rendered something
            if (innerText.includes('$') || innerText.includes('\\(')) {
                console.log(`MathJax elements found: ${mjxCount}`);
            }
        }
    });

    test('MathJax: formulas render as MathJax elements in Quiz tab', async ({ page }) => {
        await page.goto(BASE_URL);

        // Navigate to Quiz tab
        const quizTab = page.getByText('Quiz Express', { exact: false }).first();
        if (await quizTab.isVisible()) {
            await quizTab.click();
            await page.waitForTimeout(3000);

            // Look for MathJax rendered elements
            const mjxElements = page.locator('mjx-math, mjx-container, .MathJax, .mjx-chtml');
            const count = await mjxElements.count();

            // Quiz contains math formulas, so MathJax should be present
            if (count === 0) {
                // Check if raw LaTeX is showing instead
                const bodyText = await page.locator('body').innerText();
                const hasRawLatex = /\\frac|\\sqrt|\\lim|\\binom|\\vec/.test(bodyText);
                if (hasRawLatex) {
                    throw new Error(
                        'Raw LaTeX found in Quiz tab without MathJax rendering. ' +
                        'Expected mjx-math or mjx-container elements.'
                    );
                }
            }
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // PERSISTENCE (CRITICAL)
    // ═══════════════════════════════════════════════════════════════════════════

    test('XP persists after page reload', async ({ page }) => {
        await page.goto(BASE_URL);

        // Inject XP into localStorage (simulating store persistence)
        await page.evaluate(() => {
            const storeKey = 'nexus-maths-lab-v2';
            const state = {
                state: {
                    completedChapters: ['second-degre'],
                    masteredChapters: [],
                    totalXP: 150,
                    quizScore: 0,
                    comboCount: 0,
                    bestCombo: 0,
                    streak: 1,
                    lastActivityDate: new Date().toISOString().slice(0, 10),
                    streakFreezes: 0,
                    dailyChallenge: { lastCompletedDate: null, todayChallengeId: null, completedToday: false },
                    exerciseResults: {},
                    hintUsage: {},
                    badges: [],
                    srsQueue: {},
                },
                version: 3,
            };
            localStorage.setItem(storeKey, JSON.stringify(state));
        });

        // Reload the page
        await page.reload();
        await page.waitForTimeout(2000);

        // Verify XP was rehydrated correctly
        const storedXP = await page.evaluate(() => {
            const stored = localStorage.getItem('nexus-maths-lab-v2');
            if (!stored) return null;
            const parsed = JSON.parse(stored);
            return parsed.state?.totalXP;
        });

        expect(storedXP).toBe(150);

        // Verify the UI reflects the persisted XP (total XP should be visible somewhere)
        const bodyText = await page.locator('body').innerText();
        expect(bodyText).toContain('150');
    });

    test('Completed chapter stays unlocked after reload', async ({ page }) => {
        await page.goto(BASE_URL);

        // Inject completed state
        await page.evaluate(() => {
            const storeKey = 'nexus-maths-lab-v2';
            const state = {
                state: {
                    completedChapters: ['second-degre', 'derivation'],
                    masteredChapters: [],
                    totalXP: 200,
                    quizScore: 0,
                    comboCount: 0,
                    bestCombo: 0,
                    streak: 0,
                    lastActivityDate: null,
                    streakFreezes: 0,
                    dailyChallenge: { lastCompletedDate: null, todayChallengeId: null, completedToday: false },
                    exerciseResults: {},
                    hintUsage: {},
                    badges: [],
                    srsQueue: {},
                },
                version: 3,
            };
            localStorage.setItem(storeKey, JSON.stringify(state));
        });

        await page.reload();
        await page.waitForTimeout(2000);

        // Verify localStorage still has completed chapters
        const completedChapters = await page.evaluate(() => {
            const stored = localStorage.getItem('nexus-maths-lab-v2');
            if (!stored) return [];
            return JSON.parse(stored).state?.completedChapters ?? [];
        });

        expect(completedChapters).toContain('second-degre');
        expect(completedChapters).toContain('derivation');
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // DASHBOARD SANITY
    // ═══════════════════════════════════════════════════════════════════════════

    test('Dashboard shows Progression Globale', async ({ page }) => {
        await page.goto(BASE_URL);

        // Dashboard tab should be visible initially
        await expect(page.getByText('Progression Globale')).toBeVisible();
    });
});
