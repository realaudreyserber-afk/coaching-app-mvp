import { test, expect } from '@playwright/test';

test.describe('V1 Extensions - Feature Flag Guards & UI', () => {
  test.beforeEach(async ({ page }) => {
    // Enable mock auth for all E2E tests
    await page.addInitScript(() => {
      window.localStorage.setItem('mock_user', 'true');
    });
  });

  test('should display "Module en cours de déploiement" when feature_barcode is disabled (default)', async ({ page }) => {
    // Go to the barcode scanner page
    await page.goto('/log/barcode');
    
    // Check that the not available state is rendered
    const title = page.locator('text=Module en cours de déploiement');
    await expect(title).toBeVisible();
    
    // Check that we can navigate back to dashboard
    const dashboardButton = page.locator('text=Retour au Dashboard');
    await expect(dashboardButton).toBeVisible();
  });

  test('should render scanner UI when feature_barcode is enabled via localStorage', async ({ page }) => {
    // Set feature flag in localStorage before loading the page
    await page.addInitScript(() => {
      window.localStorage.setItem('feature_barcode', 'true');
    });

    await page.goto('/log/barcode');

    // It should show the scanner interface instead of the deployment message
    const scanBtn = page.locator('text=Lancer le scanner');
    await expect(scanBtn).toBeVisible();

    const manualBtn = page.locator('text=Saisie manuelle');
    await expect(manualBtn).toBeVisible();
  });

  test('should display the Coach IA chat interface', async ({ page }) => {
    await page.goto('/coach');

    // Coach Page should be accessible and show header & online status
    const header = page.locator('text=Coach L\'Insociable');
    await expect(header).toBeVisible();

    const onlineIndicator = page.locator('text=En ligne');
    await expect(onlineIndicator).toBeVisible();

    // Input form elements should be present
    const input = page.getByPlaceholder("Pose ta question (ex: pates crues vs cuites ?)");
    await expect(input).toBeVisible();
  });

  test('should display "Module en cours de déploiement" for photo log by default', async ({ page }) => {
    await page.goto('/log/photo');
    const title = page.locator('text=Module en cours de déploiement');
    await expect(title).toBeVisible();
  });

  test('should render photo-to-meal page when feature_photo_meal is active', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('feature_photo_meal', 'true');
    });
    await page.goto('/log/photo');
    const header = page.locator('text=Photo-to-meal IA');
    await expect(header).toBeVisible();
    const actionText = page.locator('text=Prendre ou importer une photo');
    await expect(actionText).toBeVisible();
  });

  test('should display "Module en cours de déploiement" for body scanner by default', async ({ page }) => {
    await page.goto('/scanner');
    const title = page.locator('text=Module en cours de déploiement');
    await expect(title).toBeVisible();
  });

  test('should render body-scanner page when feature_body_scanner is active', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('feature_body_scanner', 'true');
    });
    await page.goto('/scanner');
    const header = page.locator('text=Body Scanner Photo IA');
    await expect(header).toBeVisible();
    const instructionText = page.locator('text=Prends 4 photos standardisées');
    await expect(instructionText).toBeVisible();
  });

  test('should not show fasting, micro-tasks, and streak on dashboard by default', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check greeting
    const greeting = page.locator('text=Salut Athlète Test !');
    await expect(greeting).toBeVisible();

    // Fasting card, daily tasks card, and streak indicators should NOT be visible
    const fastingTitle = page.locator('text=Jeûne Intermittent');
    await expect(fastingTitle).not.toBeVisible();

    const taskTitle = page.locator('text=Micro-tâche du jour');
    await expect(taskTitle).not.toBeVisible();

    const streakFire = page.locator('text=🔥');
    await expect(streakFire).not.toBeVisible();
  });

  test('should render fasting, micro-tasks, and streak on dashboard when their flags are active', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('feature_fasting', 'true');
      window.localStorage.setItem('feature_micro_tasks', 'true');
      window.localStorage.setItem('feature_streak', 'true');
    });

    await page.goto('/dashboard');

    // Fasting card should be visible
    const fastingTitle = page.locator('text=Jeûne Intermittent');
    await expect(fastingTitle).toBeVisible();
    const fastingStatus = page.getByText('Période de Jeûne active', { exact: true });
    await expect(fastingStatus).toBeVisible();

    // Daily tasks card should be visible
    const taskTitle = page.locator('text=Micro-tâche du jour');
    await expect(taskTitle).toBeVisible();
    const taskDesc = page.locator("text=Boit un grand verre d'eau plate dès le réveil.");
    await expect(taskDesc).toBeVisible();

    // Streak fire should be visible
    const streakFire = page.locator('text=🔥 5 jours');
    await expect(streakFire).toBeVisible();
  });

  test('should display "Module en cours de déploiement" for form-check, recipe-ocr, micronutrients, and bloodwork by default', async ({ page }) => {
    // Form check
    await page.goto('/log/form-check');
    await expect(page.locator('text=Module en cours de déploiement')).toBeVisible();

    // Recipe OCR
    await page.goto('/log/recipe');
    await expect(page.locator('text=Module en cours de déploiement')).toBeVisible();

    // Micronutrients
    await page.goto('/progress/micronutrients');
    await expect(page.locator('text=Module en cours de déploiement')).toBeVisible();

    // Bloodwork
    await page.goto('/log/bloodwork');
    await expect(page.locator('text=Module en cours de déploiement')).toBeVisible();
  });

  test('should render form-check, recipe-ocr, micronutrients, and bloodwork pages when their flags are active', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('feature_form_check', 'true');
      window.localStorage.setItem('feature_recipe_ocr', 'true');
      window.localStorage.setItem('feature_micronutrients', 'true');
      window.localStorage.setItem('feature_bloodwork_upload', 'true');
    });

    // Form check
    await page.goto('/log/form-check');
    await expect(page.locator('text=Form Check Vidéo')).toBeVisible();
    await expect(page.locator('text=Analyse ton mouvement')).toBeVisible();

    // Recipe OCR
    await page.goto('/log/recipe');
    await expect(page.locator('text=Import de Recette')).toBeVisible();
    await expect(page.locator('text=Numérise un livre ou écran')).toBeVisible();

    // Micronutrients
    await page.goto('/progress/micronutrients');
    await expect(page.locator('text=Suivi des Micronutriments')).toBeVisible();
    await expect(page.locator('text=Apports du jour J')).toBeVisible();

    // Bloodwork
    await page.goto('/log/bloodwork');
    await expect(page.locator('text=Bilan Sanguin')).toBeVisible();
    await expect(page.locator('text=Importe tes résultats labo')).toBeVisible();
  });

  test('should display "Module en cours de déploiement" for wearables and referral by default', async ({ page }) => {
    // Wearables
    await page.goto('/settings/connections');
    await expect(page.locator('text=Module en cours de déploiement')).toBeVisible();

    // Referral
    await page.goto('/settings/referral');
    await expect(page.locator('text=Module en cours de déploiement')).toBeVisible();
  });

  test('should render wearables and referral settings pages when their flags are active', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('feature_wearables', 'true');
      window.localStorage.setItem('feature_referral', 'true');
    });

    // Wearables Connections
    await page.goto('/settings/connections');
    await expect(page.locator('text=Connexions Santé')).toBeVisible();
    await expect(page.locator('text=Google Fit')).toBeVisible();

    // Referral portal
    await page.goto('/settings/referral');
    await expect(page.locator('text=Parrainage Premium')).toBeVisible();
    await expect(page.locator('text=INSDEV')).toBeVisible();
  });

  test('should display access denied for admin console when logged in as non-admin', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('mock_user', 'non-admin');
    });
    await page.goto('/admin');
    await expect(page.locator('text=Accès Réservé')).toBeVisible();
    await expect(page.locator('text=Accès refusé. Rôle administrateur requis.')).toBeVisible();
  });

  test('should display admin console dashboard when logged in as admin', async ({ page }) => {
    // Set admin user configuration using init script (mocking the email as admin)
    await page.addInitScript(() => {
      window.localStorage.setItem('mock_user', 'true');
    });

    await page.goto('/admin');
    await expect(page.locator('text=Console Admin')).toBeVisible();
    await expect(page.locator('text=Inscriptions totales')).toBeVisible();
    await expect(page.locator('text=Activité des cohortes')).toBeVisible();
  });
});

