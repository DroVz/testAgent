import { expect, test } from '@playwright/test';

/**
 * Lot 3 « Ton rythme » (docs/product/lot3-rythme.md) : objectif de 3 choisi dans Réglages, une
 * séance faite (une série validée, puis terminée) → le récap et Séances affichent
 * « Cette semaine : 1 séance sur 3. ».
 */

const STORAGE_KEY = 'muscutrack:v1';
const WEEK_LINE = 'Cette semaine : 1 séance sur 3.';

test('objectif de 3 séances : ligne de semaine sur le récap et sur Séances', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  // Réglages › Objectif par semaine : 3.
  await page.goto('./#/reglages');
  const goal = page.getByRole('radiogroup', { name: 'Objectif par semaine' });
  await expect(goal.getByRole('radio', { name: 'Aucun objectif' })).toHaveAttribute('aria-checked', 'true');
  await goal.getByRole('radio', { name: '3 séances par semaine' }).tap();
  await expect(goal.getByRole('radio', { name: '3 séances par semaine' })).toHaveAttribute('aria-checked', 'true');

  // Séances : le repère, avant toute séance.
  await page.getByRole('link', { name: 'Séances' }).tap();
  await expect(page.locator('.week-line')).toHaveText('Objectif de la semaine : 3 séances.');

  // Une séance : programme de départ, première série validée, puis fin de séance.
  await page.getByRole('link', { name: 'Choisir un programme' }).tap();
  await page.getByRole('radio', { name: 'Full body' }).tap();
  await page.getByRole('button', { name: 'Ajouter ce programme' }).tap();
  await page.getByRole('button', { name: 'Démarrer la séance Full body A' }).tap();
  await page.getByRole('button', { name: 'Valider la série' }).tap();
  await expect(page.getByText('Série 1 validée.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Terminer la séance' }).first().tap();
  await page.getByRole('dialog').getByRole('button', { name: 'Terminer la séance' }).tap();

  // Récap : ligne de semaine sous la phrase de synthèse, puis le premier jalon.
  await expect(page).toHaveURL(/#\/resume\//);
  await expect(page.locator('.summary-rhythm__line').first()).toHaveText(WEEK_LINE);
  await expect(page.locator('.summary-rhythm__line').nth(1)).toHaveText('Première séance enregistrée. Bienvenue.');

  // Séances : même ligne.
  await page.getByRole('link', { name: 'Séances' }).tap();
  await expect(page).toHaveURL(/#\/seances$/);
  await expect(page.locator('.week-line')).toHaveText(WEEK_LINE);

  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);
  expect(saved.settings).toEqual({ weeklyGoal: 3, weeklyGoalAsked: true });
  expect(saved.sessions).toHaveLength(1);
  expect(errors).toEqual([]);
});
