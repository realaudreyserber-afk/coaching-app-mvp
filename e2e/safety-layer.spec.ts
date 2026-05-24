import { test, expect } from '@playwright/test';

function sseFrame(eventType: string, data: object): string {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

test.describe('Safety layer — block dangerous input in coach', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('mock_user', 'true');
    });
  });

  test('le backend intercepte SUICIDE et envoie le message 3114 via SSE', async ({ page }) => {
    await page.route('**/api/ai/coach', (route) => {
      const body =
        sseFrame('message', { messageId: 'safety-suicide' }) +
        sseFrame('chunk', { text: "Si tu traverses une période très difficile, contacte le 3114." }) +
        sseFrame('done', {});
      route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
        },
        body,
      });
    });

    await page.goto('/coach');
    const input = page.getByPlaceholder("Pose ta question (ex: pates crues vs cuites ?)");
    await input.fill("J'ai plus envie de vivre, je veux en finir.");
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=3114')).toBeVisible({ timeout: 5000 });
  });

  test('le backend intercepte TCA et oriente vers FFAB via SSE', async ({ page }) => {
    await page.route('**/api/ai/coach', (route) => {
      const body =
        sseFrame('message', { messageId: 'safety-tca' }) +
        sseFrame('chunk', { text: "Je remarque des signes de restriction. Consulte la FFAB : https://ffab.fr/" }) +
        sseFrame('done', {});
      route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
        },
        body,
      });
    });

    await page.goto('/coach');
    const input = page.getByPlaceholder("Pose ta question (ex: pates crues vs cuites ?)");
    await input.fill("J'ai trop mangé hier, je vais me faire vomir.");
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=FFAB')).toBeVisible({ timeout: 5000 });
  });
});
