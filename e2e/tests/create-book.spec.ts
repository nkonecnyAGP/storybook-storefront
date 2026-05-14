import { test, expect } from '@playwright/test';

test.describe('Create book wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/create');
  });

  test('loads with step 1 (theme selection)', async ({ page }) => {
    // Step 1 heading
    await expect(page.locator('h2', { hasText: 'Choose a Theme' })).toBeVisible();

    // The progress indicator should show step 1 active (the first circle with "1")
    const step1Circle = page.locator('div.rounded-full', { hasText: '1' }).first();
    await expect(step1Circle).toBeVisible();

    // Theme option buttons should be visible (e.g. "Adventure", "Fantasy")
    await expect(page.locator('button', { hasText: 'Adventure' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Fantasy' })).toBeVisible();
  });

  test('selecting a theme and clicking Next goes to step 2', async ({ page }) => {
    // Click "Adventure" theme
    await page.locator('button', { hasText: 'Adventure' }).click();

    // Click Next
    const nextButton = page.locator('button', { hasText: 'Next' });
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    // Step 2 should show "Build Your Cast"
    await expect(page.locator('h2', { hasText: 'Build Your Cast' })).toBeVisible();
  });

  test('entering primary character name, selecting age range, and clicking Next goes to step 3', async ({ page }) => {
    // Step 1: select theme
    await page.locator('button', { hasText: 'Adventure' }).click();
    await page.locator('button', { hasText: 'Next' }).click();

    // Step 2: enter primary character name
    await expect(page.locator('h2', { hasText: 'Build Your Cast' })).toBeVisible();
    // The cast builder starts with one primary character row (name + descriptor).
    // Use the placeholder to disambiguate the name input from the descriptor input.
    const nameInput = page.locator('input[placeholder*="Name"]').first();
    await nameInput.fill('Luna');

    // Select age range
    await page.locator('button', { hasText: 'Ages 4-7' }).click();

    // Click Next
    const nextButton = page.locator('button', { hasText: 'Next' });
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    // Step 3 should show "Any Special Requests?"
    await expect(page.locator('h2', { hasText: 'Any Special Requests?' })).toBeVisible();
  });

  test('summary shows the chosen theme, cast, and age range', async ({ page }) => {
    // Step 1: select theme
    await page.locator('button', { hasText: 'Fantasy' }).click();
    await page.locator('button', { hasText: 'Next' }).click();

    // Step 2: enter primary character name and age
    await page.locator('input[placeholder*="Name"]').first().fill('Sparkle');
    await page.locator('button', { hasText: 'Ages 3-6' }).click();
    await page.locator('button', { hasText: 'Next' }).click();

    // Step 3: verify summary
    await expect(page.locator('h2', { hasText: 'Any Special Requests?' })).toBeVisible();

    // The "Your Book" summary section should contain the chosen values
    const summary = page.locator('.bg-purple-50, .dark\\:bg-purple-900\\/20').first();
    await expect(summary.locator('text=fantasy')).toBeVisible();
    await expect(summary.locator('text=Sparkle')).toBeVisible();
    await expect(summary.locator('text=3-6')).toBeVisible();

    // The Generate button should be visible (we do NOT click it)
    await expect(page.locator('button', { hasText: 'Generate My Story' })).toBeVisible();
  });

  test('adding an antagonist and a supporting character', async ({ page }) => {
    await page.locator('button', { hasText: 'Adventure' }).click();
    await page.locator('button', { hasText: 'Next' }).click();
    await expect(page.locator('h2', { hasText: 'Build Your Cast' })).toBeVisible();

    // Add an antagonist row
    await page.locator('button', { hasText: 'Add antagonist' }).click();
    // Add a supporting character row
    await page.locator('button', { hasText: 'Add supporting character' }).click();

    // We should now have 3 name inputs (primary + antagonist + supporting)
    const nameInputs = page.locator('input[placeholder*="Name"]');
    await expect(nameInputs).toHaveCount(3);
  });
});
