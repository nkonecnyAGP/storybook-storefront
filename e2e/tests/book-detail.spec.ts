import { test, expect } from '@playwright/test';

test.describe('Book detail page', () => {
  test('clicking a book card navigates to /book/:id', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible();

    const titleText = await page.getByRole('heading', { level: 3 }).first().textContent();
    await page.getByRole('heading', { level: 3 }).first().click();

    await expect(page).toHaveURL(/\/book\/.+/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(titleText!);
  });

  test('book detail page shows title, description, age range, and theme', async ({ page }) => {
    await page.goto('/book/luna-star-garden');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Luna and the Star Garden');
    await expect(page.getByText('discovers a garden where fallen stars')).toBeVisible();
    await expect(page.getByText('Ages 4-7')).toBeVisible();
    await expect(page.getByText('fantasy')).toBeVisible();
  });

  test('page reader shows "Page 1 of 5"', async ({ page }) => {
    await page.goto('/book/luna-star-garden');
    await expect(page.getByText('Page 1 of 5')).toBeVisible();
  });

  test('clicking "Next" advances to page 2', async ({ page }) => {
    await page.goto('/book/luna-star-garden');
    await expect(page.getByText('Page 1 of 5')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Page 2 of 5')).toBeVisible();
  });

  test('"Add to Cart" button works and shows "Added!" feedback', async ({ page }) => {
    await page.goto('/book/luna-star-garden');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Luna and the Star Garden');
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByRole('button', { name: 'Added!' })).toBeVisible();
  });
});
