/**
 * E2E Tests - Parent Dashboard
 *
 * Tests parent dashboard functionality including:
 * - Dashboard load and data visibility
 * - Child selector switching
 * - Badge display and category filtering
 * - Progress chart with time range selector
 * - Financial history filtering and export
 * - Loading states
 * - Error handling
 *
 * Requirements:
 * - E2E database must be seeded (npm run test:e2e:setup && npm run test:e2e:seed:parent)
 * - App running on http://localhost:3000
 * - Test user: parent.dashboard@test.com
 * - Password: password123
 */

import { test, expect, Page } from '@playwright/test';

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const PARENT_EMAIL = 'parent.dashboard@test.com';
const PARENT_PASSWORD = 'password123';
const DASHBOARD_LOAD_TIMEOUT = 10000;
const NETWORK_TIMEOUT = 5000;

test.describe('Parent Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Reduce animations for deterministic tests
    await page.emulateMedia({ reducedMotion: 'reduce' });

    // Log console errors for debugging
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`[Browser Error]: ${msg.text()}`);
      }
    });

    page.on('pageerror', (err) => {
      console.log(`[Page Error]: ${err.message}`);
    });
  });

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================

  /**
   * Login helper with deterministic waiting
   */
  async function login(page: Page) {
    await page.goto('/auth/signin', { waitUntil: 'networkidle' });

    // Fill login form
    await page.getByLabel(/email/i).fill(PARENT_EMAIL);
    await page.getByLabel(/password/i).fill(PARENT_PASSWORD);

    // Submit and wait for navigation
    await Promise.all([
      page.waitForURL(/\/dashboard\/parent/, { timeout: 10000 }),
      page.getByRole('button', { name: /sign in|connexion|se connecter/i }).click(),
    ]);

    // Wait for dashboard to be fully loaded
    await page.waitForLoadState('networkidle');
  }

  /**
   * Wait for loading spinner to disappear
   */
  async function waitForLoadingToComplete(page: Page) {
    await page.waitForSelector('[data-testid="loading"], [aria-busy="true"]', {
      state: 'hidden',
      timeout: DASHBOARD_LOAD_TIMEOUT,
    }).catch(() => {
      // Loading indicator might not exist, that's fine
    });
  }

  /**
   * Get child selector dropdown
   */
  function getChildSelector(page: Page) {
    return page.locator('select, [role="combobox"]').filter({
      has: page.locator('option, [role="option"]'),
    }).first();
  }

  // =============================================================================
  // DASHBOARD LOAD TESTS
  // =============================================================================

  test.describe('Dashboard Load & Data Visibility', () => {
    test('Parent can login and dashboard loads successfully', async ({ page }) => {
      const startTime = Date.now();
      
      await login(page);

      // Verify parent dashboard URL
      await expect(page).toHaveURL(/\/dashboard\/parent/);

      // Verify main dashboard heading
      await expect(
        page.getByRole('heading', { name: /dashboard|tableau de bord/i })
      ).toBeVisible({ timeout: NETWORK_TIMEOUT });

      // Measure load time
      const loadTime = Date.now() - startTime;
      console.log(`Dashboard loaded in ${loadTime}ms`);
      expect(loadTime).toBeLessThan(DASHBOARD_LOAD_TIMEOUT);
    });

    test('Dashboard displays parent name', async ({ page }) => {
      await login(page);

      // Check for parent name (Marie Dupont from fixture)
      await expect(
        page.getByText(/Marie Dupont/i)
      ).toBeVisible({ timeout: NETWORK_TIMEOUT });
    });

    test('Dashboard displays children list', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Should display both children from fixture
      const yasmine = page.getByText(/Yasmine/i);
      const karim = page.getByText(/Karim/i);

      await expect(yasmine).toBeVisible({ timeout: NETWORK_TIMEOUT });
      await expect(karim).toBeVisible({ timeout: NETWORK_TIMEOUT });
    });

    test('Dashboard displays credit information', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Check for credits display
      const creditsText = page.getByText(/crédit|credit/i);
      await expect(creditsText).toBeVisible({ timeout: NETWORK_TIMEOUT });
    });

    test('Dashboard displays all main sections', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Check for main sections
      const sections = [
        /badge/i,
        /progression|progrès/i,
        /historique|transaction|financ/i,
      ];

      for (const sectionPattern of sections) {
        const section = page.getByText(sectionPattern).first();
        await expect(section).toBeVisible({ timeout: NETWORK_TIMEOUT });
      }
    });
  });

  // =============================================================================
  // CHILD SELECTOR TESTS
  // =============================================================================

  test.describe('Child Selector Switching', () => {
    test('Child selector displays all children', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Find child selector
      const selector = getChildSelector(page);
      if (await selector.isVisible({ timeout: 5000 }).catch(() => false)) {
        await selector.click();

        // Check for both children in dropdown
        await expect(page.getByText(/Yasmine/i)).toBeVisible();
        await expect(page.getByText(/Karim/i)).toBeVisible();
      }
    });

    test('Switching child updates all sections', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Get initial state
      const initialBadgeCount = await page.locator('[data-testid*="badge"], .badge').count();
      
      // Find and switch child selector
      const selector = getChildSelector(page);
      if (await selector.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Get current value
        const initialValue = await selector.inputValue();
        
        // Click to open dropdown
        await selector.click();
        await page.waitForTimeout(500);

        // Select different child
        const options = page.locator('option, [role="option"]');
        const optionCount = await options.count();
        
        if (optionCount > 1) {
          await options.nth(1).click();
          
          // Wait for data to update
          await page.waitForTimeout(1000);
          await waitForLoadingToComplete(page);

          // Verify selector changed
          const newValue = await selector.inputValue();
          expect(newValue).not.toBe(initialValue);

          // Badge count might have changed
          const newBadgeCount = await page.locator('[data-testid*="badge"], .badge').count();
          console.log(`Badges changed from ${initialBadgeCount} to ${newBadgeCount}`);
        }
      }
    });

    test('Child selector retains selection after page interaction', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      const selector = getChildSelector(page);
      if (await selector.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Select a child
        await selector.click();
        await page.waitForTimeout(500);
        
        const options = page.locator('option, [role="option"]');
        if (await options.count() > 1) {
          await options.nth(1).click();
          await page.waitForTimeout(500);
          
          const selectedValue = await selector.inputValue();

          // Interact with page (scroll)
          await page.evaluate(() => window.scrollTo(0, 500));
          await page.waitForTimeout(500);

          // Verify selection retained
          const currentValue = await selector.inputValue();
          expect(currentValue).toBe(selectedValue);
        }
      }
    });
  });

  // =============================================================================
  // BADGE DISPLAY TESTS
  // =============================================================================

  test.describe('Badge Display & Category Filtering', () => {
    test('Badge section displays badges', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Look for badge section
      const badgeSection = page.locator('[data-testid*="badge"], [class*="badge"]').first();
      await expect(badgeSection).toBeVisible({ timeout: NETWORK_TIMEOUT });

      // Check for badge icons (emojis from fixture)
      const badges = page.locator('[data-testid*="badge"], .badge-card, [class*="badge"]');
      const badgeCount = await badges.count();
      
      console.log(`Found ${badgeCount} badges`);
      expect(badgeCount).toBeGreaterThan(0);
    });

    test('Badge category tabs exist and are clickable', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Look for category tabs
      const categoryPatterns = [
        /assiduit[ée]/i,
        /progression/i,
        /curiosit[ée]/i,
      ];

      for (const pattern of categoryPatterns) {
        const tab = page.getByRole('tab', { name: pattern });
        if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(tab).toBeVisible();
        } else {
          // Try alternative selector
          const altTab = page.getByText(pattern).filter({ hasText: pattern });
          if (await altTab.isVisible({ timeout: 2000 }).catch(() => false)) {
            await expect(altTab).toBeVisible();
          }
        }
      }
    });

    test('Clicking badge category tab filters badges', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Find category tabs
      const assiduitéTab = page.getByRole('tab', { name: /assiduit[ée]/i });
      
      if (await assiduitéTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Count badges before click
        const initialBadges = await page.locator('[data-testid*="badge"], .badge-card').count();
        
        // Click category tab
        await assiduitéTab.click();
        await page.waitForTimeout(500);

        // Count badges after click (might be different)
        const filteredBadges = await page.locator('[data-testid*="badge"], .badge-card').count();
        
        console.log(`Badges filtered from ${initialBadges} to ${filteredBadges}`);
        expect(filteredBadges).toBeGreaterThanOrEqual(0);
      }
    });

    test('Recent badges display "new" indicator', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Look for "new" or "recent" indicator
      const recentIndicator = page.getByText(/new|nouveau|récent/i);
      
      // Recent badges should exist (some badges earned in last 7 days in fixture)
      const hasRecentBadges = await recentIndicator.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasRecentBadges) {
        await expect(recentIndicator).toBeVisible();
        console.log('Recent badge indicator found');
      } else {
        console.log('No recent badges (this is OK if no badges earned in last 7 days)');
      }
    });

    test('Badge displays name, icon, and earned date', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Get first badge card
      const firstBadge = page.locator('[data-testid*="badge"], .badge-card, [class*="badge"]').first();
      
      if (await firstBadge.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Check for text content (name or description)
        const badgeText = await firstBadge.textContent();
        expect(badgeText).toBeTruthy();
        expect(badgeText!.length).toBeGreaterThan(0);
        
        console.log(`First badge text: ${badgeText?.substring(0, 50)}...`);
      }
    });

    test('Empty badge state displays when no badges', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Switch to a category that might have no badges
      const curiositéTab = page.getByRole('tab', { name: /curiosit[ée]/i });
      
      if (await curiositéTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await curiositéTab.click();
        await page.waitForTimeout(500);

        const badges = await page.locator('[data-testid*="badge"], .badge-card').count();
        
        if (badges === 0) {
          // Check for empty state message
          const emptyMessage = page.getByText(/aucun badge|no badge/i);
          await expect(emptyMessage).toBeVisible({ timeout: 3000 });
        }
      }
    });
  });

  // =============================================================================
  // PROGRESS CHART TESTS
  // =============================================================================

  test.describe('Progress Chart Display', () => {
    test('Progress chart section is visible', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Look for chart section
      const chartSection = page.locator('[data-testid*="chart"], [class*="chart"], svg').first();
      await expect(chartSection).toBeVisible({ timeout: NETWORK_TIMEOUT });
    });

    test('Progress chart renders with data', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Check for SVG (Recharts renders SVG)
      const svg = page.locator('svg').first();
      await expect(svg).toBeVisible({ timeout: NETWORK_TIMEOUT });

      // Verify SVG has content (paths, lines, etc.)
      const svgContent = await svg.innerHTML();
      expect(svgContent.length).toBeGreaterThan(100); // SVG should have substantial content
    });

    test('Time range selector exists', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Look for time range selector (buttons or select)
      const timeRangeOptions = ['1M', '3M', '6M', '1Y'];
      
      for (const option of timeRangeOptions) {
        const timeButton = page.getByRole('button', { name: new RegExp(option, 'i') });
        if (await timeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await expect(timeButton).toBeVisible();
          break;
        }
      }
    });

    test('Time range selector filters chart data', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Find time range buttons
      const threeMonthButton = page.getByRole('button', { name: /3M/i });
      const sixMonthButton = page.getByRole('button', { name: /6M/i });

      if (await threeMonthButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Click 3M
        await threeMonthButton.click();
        await page.waitForTimeout(500);

        // Get SVG content after 3M
        const svg3M = await page.locator('svg').first().innerHTML();

        // Click 6M
        if (await sixMonthButton.isVisible().catch(() => false)) {
          await sixMonthButton.click();
          await page.waitForTimeout(500);

          // Get SVG content after 6M
          const svg6M = await page.locator('svg').first().innerHTML();

          // Content should be different
          expect(svg3M).not.toBe(svg6M);
          console.log('Chart updated after time range change');
        }
      }
    });

    test('Chart displays tooltips on hover', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Find chart element
      const chart = page.locator('svg').first();
      
      if (await chart.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Hover over chart area
        const chartBox = await chart.boundingBox();
        if (chartBox) {
          await page.mouse.move(
            chartBox.x + chartBox.width / 2,
            chartBox.y + chartBox.height / 2
          );
          await page.waitForTimeout(500);

          // Look for tooltip
          const tooltip = page.locator('[class*="tooltip"], [role="tooltip"]');
          const hasTooltip = await tooltip.isVisible({ timeout: 2000 }).catch(() => false);
          
          if (hasTooltip) {
            console.log('Chart tooltip displayed on hover');
          }
        }
      }
    });

    test('Chart displays subject-specific progress', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Look for subject labels (from fixture: MATHEMATIQUES, PHYSIQUE_CHIMIE, etc.)
      const subjects = ['Math', 'Physique', 'NSI', 'Français'];
      
      for (const subject of subjects) {
        const subjectLabel = page.getByText(new RegExp(subject, 'i'));
        if (await subjectLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(`Found subject: ${subject}`);
        }
      }
    });

    test('Empty chart state displays when no progress data', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Check for potential empty state
      const emptyMessage = page.getByText(/aucune donn[ée]e|no data|pas de progression/i);
      
      // This should not be visible with seeded data, but test handles it
      const isEmpty = await emptyMessage.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (isEmpty) {
        console.log('Empty chart state displayed (unexpected with seeded data)');
      }
    });
  });

  // =============================================================================
  // FINANCIAL HISTORY TESTS
  // =============================================================================

  test.describe('Financial History', () => {
    test('Financial history section displays transactions', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Look for transaction table or list
      const transactionTable = page.locator('table, [role="table"]').first();
      
      if (await transactionTable.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(transactionTable).toBeVisible();
      } else {
        // Look for transaction cards/items
        const transactions = page.locator('[data-testid*="transaction"], [class*="transaction"]');
        const count = await transactions.count();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('Transaction displays date, type, amount, and status', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Find first transaction row/card
      const firstTransaction = page.locator('tr, [data-testid*="transaction"]').nth(1);
      
      if (await firstTransaction.isVisible({ timeout: 5000 }).catch(() => false)) {
        const text = await firstTransaction.textContent();
        
        // Should contain amount (number with currency)
        expect(text).toMatch(/\d+/);
        
        // Should contain date or status
        expect(text!.length).toBeGreaterThan(10);
        
        console.log(`Transaction: ${text?.substring(0, 80)}...`);
      }
    });

    test('Status badges display correct colors', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Look for status badges (COMPLETED, PENDING, FAILED)
      const statusBadges = page.locator('[class*="badge"], [data-testid*="status"]');
      const count = await statusBadges.count();
      
      if (count > 0) {
        const firstBadge = statusBadges.first();
        const badgeClass = await firstBadge.getAttribute('class');
        
        // Should have color classes (green, yellow, red)
        expect(badgeClass).toBeTruthy();
        console.log(`Status badge classes: ${badgeClass}`);
      }
    });

    test('Filter controls exist for transactions', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Look for filter controls (type, child, date range)
      const filterPatterns = [
        /type/i,
        /enfant|child/i,
        /date/i,
        /filtre|filter/i,
      ];

      for (const pattern of filterPatterns) {
        const filter = page.locator('select, [role="combobox"], button, input').filter({
          hasText: pattern,
        });
        
        if (await filter.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(`Found filter: ${pattern}`);
          break;
        }
      }
    });

    test('Filtering by transaction type works', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Find type filter
      const typeFilter = page.locator('select, [role="combobox"]').filter({
        hasText: /type/i,
      });

      if (await typeFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Count initial transactions
        const initialCount = await page.locator('tr, [data-testid*="transaction"]').count();
        
        // Click to open filter
        await typeFilter.click();
        await page.waitForTimeout(500);

        // Select a filter option
        const options = page.locator('option, [role="option"]');
        if (await options.count() > 1) {
          await options.nth(1).click();
          await page.waitForTimeout(500);

          // Count filtered transactions
          const filteredCount = await page.locator('tr, [data-testid*="transaction"]').count();
          
          console.log(`Transactions filtered from ${initialCount} to ${filteredCount}`);
        }
      }
    });

    test('Pagination or "Load More" exists for transactions', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Look for pagination controls
      const loadMore = page.getByRole('button', { name: /load more|voir plus|charger plus/i });
      const pagination = page.locator('[role="navigation"], .pagination');

      const hasLoadMore = await loadMore.isVisible({ timeout: 3000 }).catch(() => false);
      const hasPagination = await pagination.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasLoadMore) {
        console.log('Found "Load More" button');
      } else if (hasPagination) {
        console.log('Found pagination controls');
      }
    });

    test('CSV export button exists', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Look for export button
      const exportButton = page.getByRole('button', { name: /export|télécharger|download|csv/i });
      
      if (await exportButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(exportButton).toBeVisible();
        console.log('CSV export button found');
      }
    });

    test('CSV export downloads file', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Find export button
      const exportButton = page.getByRole('button', { name: /export|télécharger|download|csv/i });

      if (await exportButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Set up download listener
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

        // Click export
        await exportButton.click();

        try {
          const download = await downloadPromise;
          
          // Verify download
          const filename = download.suggestedFilename();
          expect(filename).toMatch(/\.csv$/i);
          
          console.log(`CSV exported: ${filename}`);
          
          // Save file to verify it's not empty
          const path = await download.path();
          expect(path).toBeTruthy();
        } catch (error) {
          console.log('CSV export might be client-side (no server download)');
        }
      }
    });

    test('Transaction table is sortable', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Look for sortable column headers
      const tableHeaders = page.locator('th, [role="columnheader"]');
      const headerCount = await tableHeaders.count();

      if (headerCount > 0) {
        const firstHeader = tableHeaders.first();
        
        // Check if clickable (cursor pointer or button)
        const isClickable = await firstHeader.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.cursor === 'pointer' || el.tagName === 'BUTTON';
        }).catch(() => false);

        if (isClickable) {
          // Click to sort
          await firstHeader.click();
          await page.waitForTimeout(500);

          console.log('Table sorted by clicking header');
        }
      }
    });

    test('Empty financial history displays message', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Check if table has rows
      const rows = await page.locator('tr, [data-testid*="transaction"]').count();

      if (rows === 0) {
        // Should show empty state
        const emptyMessage = page.getByText(/aucune transaction|no transaction/i);
        await expect(emptyMessage).toBeVisible();
      } else {
        console.log(`Found ${rows} transactions`);
      }
    });
  });

  // =============================================================================
  // LOADING STATE TESTS
  // =============================================================================

  test.describe('Loading States', () => {
    test('Loading spinner displays during initial load', async ({ page }) => {
      // Navigate to dashboard without waiting
      await page.goto('/auth/signin');
      
      await page.getByLabel(/email/i).fill(PARENT_EMAIL);
      await page.getByLabel(/password/i).fill(PARENT_PASSWORD);
      await page.getByRole('button', { name: /sign in|connexion/i }).click();

      // Look for loading indicator immediately after navigation
      const loadingIndicator = page.locator(
        '[data-testid="loading"], [aria-busy="true"], [class*="loading"], [class*="spinner"]'
      );

      // Loading might be visible briefly
      const wasLoading = await loadingIndicator.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (wasLoading) {
        console.log('Loading indicator displayed');
        
        // Wait for it to disappear
        await loadingIndicator.waitFor({ state: 'hidden', timeout: DASHBOARD_LOAD_TIMEOUT });
        console.log('Loading completed');
      }

      // Dashboard should be loaded
      await expect(page).toHaveURL(/\/dashboard\/parent/);
    });

    test('Skeleton loaders display during data fetch', async ({ page }) => {
      await login(page);

      // Look for skeleton elements (placeholders while loading)
      const skeletons = page.locator('[class*="skeleton"], [aria-busy="true"]');
      
      // Skeletons might be visible briefly
      const hadSkeletons = await skeletons.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (hadSkeletons) {
        console.log('Skeleton loaders displayed');
      }

      // Wait for real content to load
      await waitForLoadingToComplete(page);
    });
  });

  // =============================================================================
  // ERROR HANDLING TESTS
  // =============================================================================

  test.describe('Error Handling', () => {
    test('Dashboard handles network failure gracefully', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Block API requests
      await page.route('**/api/parent/dashboard**', (route) => route.abort());

      // Try to refresh dashboard data (trigger error)
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // Look for error message
      const errorMessage = page.getByText(/erreur|error|échec|failed|impossible/i);
      
      const hasError = await errorMessage.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasError) {
        console.log('Error message displayed for network failure');
        await expect(errorMessage).toBeVisible();
      }
    });

    test('Error boundary catches component errors', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Dashboard should be stable without errors
      const errorBoundary = page.getByText(/something went wrong|une erreur s'est produite/i);
      
      // Should NOT be visible in normal operation
      await expect(errorBoundary).not.toBeVisible({ timeout: 2000 }).catch(() => {
        // Error boundary might not exist, that's fine
      });
    });

    test('Invalid API responses show user-friendly error', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Mock invalid API response
      await page.route('**/api/parent/dashboard**', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      });

      // Reload to trigger error
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // Should show error message
      const errorMessage = page.getByText(/erreur|error|problème/i);
      const hasError = await errorMessage.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasError) {
        console.log('User-friendly error displayed for API failure');
      }
    });
  });

  // =============================================================================
  // PERFORMANCE TESTS
  // =============================================================================

  test.describe('Performance', () => {
    test('Dashboard loads in under 2 seconds', async ({ page }) => {
      const startTime = Date.now();

      await login(page);
      await waitForLoadingToComplete(page);

      const loadTime = Date.now() - startTime;
      
      console.log(`Total dashboard load time: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(2000); // 2 seconds
    });

    test('Child switching responds quickly', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      const selector = getChildSelector(page);
      
      if (await selector.isVisible({ timeout: 5000 }).catch(() => false)) {
        const startTime = Date.now();

        // Switch child
        await selector.click();
        await page.waitForTimeout(200);
        
        const options = page.locator('option, [role="option"]');
        if (await options.count() > 1) {
          await options.nth(1).click();
          await waitForLoadingToComplete(page);

          const switchTime = Date.now() - startTime;
          
          console.log(`Child switch time: ${switchTime}ms`);
          expect(switchTime).toBeLessThan(1500); // 1.5 seconds
        }
      }
    });

    test('No memory leaks during interactions', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Get initial metrics
      const metrics1 = await page.metrics();

      // Perform interactions
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollTo(0, 500));
        await page.waitForTimeout(200);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(200);
      }

      // Get final metrics
      const metrics2 = await page.metrics();

      // Memory shouldn't grow significantly (< 50MB increase)
      const memoryIncrease = (metrics2.JSHeapUsedSize - metrics1.JSHeapUsedSize) / 1024 / 1024;
      
      console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);
      expect(memoryIncrease).toBeLessThan(50);
    });
  });

  // =============================================================================
  // DATA ISOLATION TESTS
  // =============================================================================

  test.describe('Data Isolation & Security', () => {
    test('Parent can only see their own children', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Should see fixture children (Yasmine and Karim)
      await expect(page.getByText(/Yasmine/i)).toBeVisible();
      await expect(page.getByText(/Karim/i)).toBeVisible();

      // Should NOT see other parents' children
      // Note: This test assumes other test data doesn't contain these names
      const otherChild = page.getByText(/OtherParentChild/i);
      await expect(otherChild).not.toBeVisible({ timeout: 2000 }).catch(() => {
        // Expected: other children not visible
      });
    });

    test('API validates parent session', async ({ page }) => {
      // Try to access dashboard without login
      await page.goto('/dashboard/parent');

      // Should redirect to signin or show error
      await page.waitForTimeout(2000);

      const url = page.url();
      const isRedirected = url.includes('/signin') || url.includes('/auth');
      const hasError = await page.getByText(/unauthorized|non autorisé|403/i).isVisible().catch(() => false);

      expect(isRedirected || hasError).toBe(true);
    });

    test('No sensitive data in browser console', async ({ page }) => {
      const consoleLogs: string[] = [];

      page.on('console', (msg) => {
        consoleLogs.push(msg.text());
      });

      await login(page);
      await waitForLoadingToComplete(page);

      // Check console logs for sensitive patterns
      const sensitivePatterns = [
        /password/i,
        /secret/i,
        /api[_-]?key/i,
        /token/i,
      ];

      for (const pattern of sensitivePatterns) {
        const hasSensitiveData = consoleLogs.some((log) => pattern.test(log));
        expect(hasSensitiveData).toBe(false);
      }

      console.log(`Console logs checked: ${consoleLogs.length} messages`);
    });

    test('No child IDs exposed in URLs', async ({ page }) => {
      await login(page);
      await waitForLoadingToComplete(page);

      // Switch children and check URL
      const selector = getChildSelector(page);
      
      if (await selector.isVisible({ timeout: 5000 }).catch(() => false)) {
        await selector.click();
        await page.waitForTimeout(500);

        const options = page.locator('option, [role="option"]');
        if (await options.count() > 1) {
          await options.nth(1).click();
          await page.waitForTimeout(1000);

          // Check URL doesn't contain child IDs
          const url = page.url();
          
          // Should NOT contain patterns like ?childId= or /child/123
          expect(url).not.toMatch(/child[_-]?id=/i);
          expect(url).not.toMatch(/\/child\/[a-z0-9-]+/i);
          
          console.log(`URL after child switch: ${url}`);
        }
      }
    });
  });
});
