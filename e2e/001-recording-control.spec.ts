import { expect, test } from '@playwright/test';

test.describe('recording control', () => {
  test('starts and stops recording from the main controls', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /recording/i })).toBeVisible();
    await expect(page.getByRole('status')).toContainText(/idle/i);

    await expect(page.getByRole('button', { name: /start recording/i })).toBeVisible();
    await page.getByRole('button', { name: /start recording/i }).click();

    await expect(page.getByRole('status')).toContainText(/recording/i);
    await expect(page.getByRole('button', { name: /stop recording/i })).toBeVisible();

    await page.getByRole('button', { name: /stop recording/i }).click();

    await expect(page.getByRole('status')).toContainText(/idle/i);
    await expect(page.getByRole('button', { name: /start recording/i })).toBeVisible();
  });

  test('shows an error when the backend cannot reach OBS', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /start recording/i }).click();

    await expect(page.getByRole('alert')).toContainText(/unable to start recording|obs/i);
    await expect(page.getByRole('status')).not.toContainText(/recording/i);
  });
});

