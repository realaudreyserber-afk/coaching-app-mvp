import { test, expect } from '@playwright/test';

test.describe('MVP — Onboarding parcours', () => {
  test('user mock_user="no-profile" est redirigé vers /onboarding depuis /dashboard', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('mock_user', 'no-profile');
    });
    await page.goto('/dashboard');
    await page.waitForURL(/\/onboarding/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test('user mock_user="true" (hasProfile=true) accède au dashboard', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('mock_user', 'true');
    });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('progress bar à 1/6 pour user no-profile sur /onboarding/1', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('mock_user', 'no-profile');
    });
    await page.goto('/onboarding/1');
    await expect(page.locator('text=Étape 1 sur 6')).toBeVisible({ timeout: 10000 });
  });
});
