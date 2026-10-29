import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Critère 17 de docs/product/lot2-programmes.md (§8) : stockage vide, 390 × 844, première série
 * validée en 5 taps, sans clavier et sans défiler, en clair et en sombre.
 */

const STORAGE_KEY = 'muscutrack:v1';
const MIN_TARGET_PX = 48;

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`mode ${colorScheme === 'light' ? 'clair' : 'sombre'}`, () => {
    test.use({ colorScheme, viewport: { width: 390, height: 844 } });

    test('première série de Squat validée à 20 kg × 8 en 5 taps', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });

      await page.goto('./#/seances');
      await expect(page.getByText('Aucune séance pour l’instant.')).toBeVisible();
      expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
      expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(colorScheme === 'dark');

      let taps = 0;
      const tap = async (target: Locator) => {
        await expectTappableWithoutScroll(page, target);
        await target.tap();
        taps++;
      };

      // Tap 1 : « Choisir un programme »
      await tap(page.getByRole('link', { name: 'Choisir un programme' }));
      await expect(page).toHaveURL(/#\/seances\/programmes$/);
      await expect(page.getByRole('radio')).toHaveCount(3);
      await expect(page.getByText(/barre seule/)).toBeInViewport();

      // Tap 2 : carte « Full body »
      const fullBody = page.getByRole('radio', { name: 'Full body' });
      await tap(fullBody);
      await expect(fullBody).toHaveAttribute('aria-checked', 'true');

      // Tap 3 : « Ajouter ce programme »
      await tap(page.getByRole('button', { name: 'Ajouter ce programme' }));
      await expect(page).toHaveURL(/#\/seances$/);
      await expect(page.locator('.toast')).toContainText('Programme ajouté : Full body (2 séances).');

      // Tap 4 : « Démarrer la séance » (Full body A, suggérée)
      await tap(page.getByRole('button', { name: 'Démarrer la séance Full body A' }));
      await expect(page).toHaveURL(/#\/seance$/);
      await expect(page.getByRole('heading', { name: 'Squat' })).toBeVisible();
      await expect(page.locator('[aria-current="step"]')).toContainText(
        'Première fois : la barre seule (20 kg) × 8. Ajuste si besoin.',
      );
      // Le toast d'ajout est fermé dès l'entrée en séance.
      await expect(page.locator('.toast')).toHaveCount(0);

      // Tap 5 : « Valider la série »
      await tap(page.getByRole('button', { name: 'Valider la série' }));
      await expect(page.getByText('Série 1 validée. Repos : 120 s.')).toBeVisible();

      expect(taps).toBe(5);
      const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);
      expect(saved.activeSession.name).toBe('Full body A');
      expect(saved.activeSession.exercises[0].exerciseId).toBe('squat');
      expect(saved.activeSession.exercises[0].sets[0]).toEqual({ weight: 20, reps: 8, done: true });
      expect(errors).toEqual([]);
    });
  });
}

/**
 * La cible est visible sans défiler (page en haut, entièrement dans le viewport, non recouverte)
 * et fait au moins 48 × 48 px.
 */
async function expectTappableWithoutScroll(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  expect(await page.evaluate(() => window.scrollY), 'aucun défilement').toBe(0);
  const box = await target.boundingBox();
  expect(box, 'cible rendue').not.toBeNull();
  const { width, height } = page.viewportSize()!;
  expect(box!.y, 'haut de la cible dans l’écran').toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, 'bas de la cible dans l’écran').toBeLessThanOrEqual(height);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  expect(box!.height, 'hauteur ≥ 48 px').toBeGreaterThanOrEqual(MIN_TARGET_PX);
  expect(box!.width, 'largeur ≥ 48 px').toBeGreaterThanOrEqual(MIN_TARGET_PX);
  // Rien ne recouvre le centre de la cible (toast, barre fixe…).
  const onTop = await target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit !== null && el.contains(hit);
  });
  expect(onTop, 'cible non recouverte').toBe(true);
}
