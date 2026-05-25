import { test, expect } from '@playwright/test';

test.describe('Coach IA — SSE streaming', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('mock_user', 'true');
    });
  });

  test('affiche l\'interface coach et accepte une saisie', async ({ page }) => {
    await page.goto('/coach');
    await expect(page.locator('text=Coach L\'Insociable')).toBeVisible();
    await expect(page.locator('text=En ligne')).toBeVisible();
    const input = page.getByPlaceholder("Pose ta question (ex: pates crues vs cuites ?)");
    await expect(input).toBeVisible();
    await input.fill('Combien de protéines par jour ?');
    await expect(input).toHaveValue('Combien de protéines par jour ?');
  });

  test('le bouton submit est désactivé quand le champ est vide', async ({ page }) => {
    await page.goto('/coach');
    const submit = page.locator('button[type="submit"]');
    await expect(submit).toBeDisabled();
  });

  test('demande Accept: text/event-stream lors de l\'envoi', async ({ page }) => {
    await page.goto('/coach');
    const input = page.getByPlaceholder("Pose ta question (ex: pates crues vs cuites ?)");
    await input.fill('Test SSE');

    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('/api/ai/coach') && req.method() === 'POST'
    );
    await page.locator('button[type="submit"]').click();
    const request = await requestPromise;
    expect(request.headers()['accept']).toContain('text/event-stream');
  });
});
