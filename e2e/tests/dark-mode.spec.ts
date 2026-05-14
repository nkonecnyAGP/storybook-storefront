import { test, expect } from '@playwright/test';

test.describe('Dark mode toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Ensure we start in light mode by clearing any stored preference
    await page.evaluate(() => {
      localStorage.setItem('storybook-theme', 'light');
    });
    await page.reload();
    // Wait for the page to be fully loaded
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
  });

  test('clicking the theme toggle adds the "dark" class to the html element', async ({ page }) => {
    // Initially should NOT have "dark" class
    const htmlElement = page.locator('html');
    await expect(htmlElement).not.toHaveClass(/dark/);

    // Click the dark mode toggle button (it has aria-label="Toggle dark mode")
    await page.locator('button[aria-label="Toggle dark mode"]').click();

    // Now html should have "dark" class
    await expect(htmlElement).toHaveClass(/dark/);
  });

  test('clicking again removes the "dark" class', async ({ page }) => {
    const htmlElement = page.locator('html');

    // Click to enable dark mode
    await page.locator('button[aria-label="Toggle dark mode"]').click();
    await expect(htmlElement).toHaveClass(/dark/);

    // Click again to disable dark mode
    await page.locator('button[aria-label="Toggle dark mode"]').click();
    await expect(htmlElement).not.toHaveClass(/dark/);
  });
});
