import { expect, test } from '@playwright/test';

/**
 * Lot 4, §4.8 critère 4 : « Aucune donnée collectée ». Toutes les requêtes sont interceptées pendant
 * le parcours « première séance » (lot 2), la visite de chaque onglet, des Réglages et de la page
 * Confidentialité : aucune ne sort de l'origine locale (polices comprises).
 */

test('aucune requête hors de l’origine locale', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  const outside = () => requests.filter((url) => !url.startsWith(`${origin}/`) && !/^(data|blob):/.test(url));

  await page.goto('./#/seances');
  await expect(page.getByText('Aucune séance pour l’instant.')).toBeVisible();

  // Parcours « première séance » du lot 2.
  await page.getByRole('link', { name: 'Choisir un programme' }).tap();
  await page.getByRole('radio', { name: 'Full body' }).tap();
  await page.getByRole('button', { name: 'Ajouter ce programme' }).tap();
  await page.getByRole('button', { name: 'Démarrer la séance Full body A' }).tap();
  await expect(page.getByRole('heading', { name: 'Squat' })).toBeVisible();
  await page.getByRole('button', { name: 'Valider la série' }).tap();
  await expect(page.getByText('Série 1 validée. Repos : 120 s.')).toBeVisible();

  // Chaque onglet, les Réglages et la politique de confidentialité.
  await page.goto('./#/historique');
  await expect(page.getByRole('link', { name: 'Historique', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Progrès', exact: true }).tap();
  await expect(page).toHaveURL(/#\/progres$/);
  await page.getByRole('link', { name: 'Séances', exact: true }).tap();
  await expect(page).toHaveURL(/#\/seances$/);
  await page.getByRole('link', { name: 'Réglages' }).tap();
  await expect(page.getByRole('heading', { name: 'À propos' })).toBeVisible();
  await page.getByRole('link', { name: 'Confidentialité' }).tap();
  await expect(page.getByRole('heading', { level: 1, name: 'Confidentialité' })).toBeVisible();
  await expect(page.getByText('MuscuTrack ne collecte aucune donnée.')).toBeVisible();

  // Page publique autonome.
  await page.goto('./confidentialite.html');
  await expect(page.getByRole('heading', { level: 1, name: 'Confidentialité' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(requests.length).toBeGreaterThan(0);
  expect(outside()).toEqual([]);
});
