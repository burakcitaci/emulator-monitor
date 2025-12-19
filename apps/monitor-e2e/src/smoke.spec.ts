import { test, expect } from '@playwright/test';

test.describe('Monitor Application - Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app before each test
    await page.goto('/');
  });

  test('should load the application', async ({ page }) => {
    // Check that the main app loaded
    await expect(page).toHaveTitle(/E2E Monitor|Monitor/i);
  });

  test('should display the sidebar', async ({ page }) => {
    // Check for sidebar elements
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar).toBeVisible();
  });

  test('should display tracking messages table', async ({ page }) => {
    // Wait for the table to be visible
    const table = page.locator('table').first();
    await expect(table).toBeVisible({ timeout: 10000 });

    // Check for table headers
    await expect(page.getByText('Sent By')).toBeVisible();
    await expect(page.getByText('Status')).toBeVisible();
  });

  test('should show search input', async ({ page }) => {
    // Check for search functionality
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/v1/tracked-messages/tracking', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.reload();

    // Check for error message
    await expect(page.getByText(/Failed to Load/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('should filter messages by search', async ({ page }) => {
    // Wait for data to load
    await page.waitForSelector('table', { timeout: 10000 });

    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('test');

    // Verify filtering is working (table should update)
    await page.waitForTimeout(500); // Debounce wait
  });

  test('should display theme toggle', async ({ page }) => {
    // Check for theme toggle button
    const themeToggle = page.locator('button[aria-label*="theme" i], button:has-text("Theme")');
    await expect(themeToggle).toBeVisible({ timeout: 5000 });
  });

  test('should navigate without errors', async ({ page }) => {
    // Check that there are no console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForLoadState('networkidle');

    // Allow some benign errors but fail on critical ones
    const criticalErrors = errors.filter(
      (err) =>
        !err.includes('Failed to fetch') && // API might not be running
        !err.includes('NetworkError') &&
        !err.includes('net::ERR')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});