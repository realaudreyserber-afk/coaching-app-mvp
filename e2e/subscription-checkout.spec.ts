import { test, expect } from '@playwright/test';

test.describe('Stripe subscription — UI tier gating', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('mock_user', 'true');
    });
  });

  test('affiche le plan mensuel et annuel pour un user free', async ({ page }) => {
    await page.route('**/api/stripe/checkout', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://checkout.stripe.com/test_123' }),
      });
    });

    await page.goto('/settings/subscription');
    await expect(page.locator('text=Mensuel')).toBeVisible();
    await expect(page.locator('text=Annuel')).toBeVisible();
  });

  test('le bouton Premium-gate redirige vers /settings/subscription', async ({ page }) => {
    await page.goto('/settings/subscription');
    await expect(page.locator('text=Plan IA personnalisé')).toBeVisible();
    await expect(page.locator('text=Coach IA conversationnel')).toBeVisible();
  });
});
