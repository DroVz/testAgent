import { expect, test, type Page } from '@playwright/test';

/**
 * Lot 3, corrections après revue (docs/product/lot3-rythme.md, §12) : refus « Non merci » à contour
 * (critères 17 et 30), ligne du mois sur une ligne à 375 px (critère 28), « Objectif atteint. » qui
 * ne se coupe pas à 375 px (critère 12 bis). Horloge fixée au jeudi 29 octobre 2026, 20 h, Paris.
 */

const STORAGE_KEY = 'muscutrack:v1';
const NOW = new Date('2026-10-29T20:00:00+01:00');

test.use({ timezoneId: 'Europe/Paris' });

interface SeedSession {
  id: string;
  /** Date locale, sans décalage : « 2026-10-26T18:00 ». */
  at: string;
  weight: number;
}

/** État par défaut (exercices inclus) enregistré par l'app, puis séances et réglages injectés. */
async function seed(page: Page, sessions: SeedSession[], settings: Record<string, unknown>) {
  await page.clock.setFixedTime(NOW);
  await page.goto('./#/reglages');
  // Un premier choix fait enregistrer l'état complet par l'app ; les réglages sont remplacés ensuite.
  await page.getByRole('radiogroup', { name: 'Objectif par semaine' }).getByRole('radio', { name: 'Aucun objectif' }).tap();
  await page.evaluate(
    ({ key, sessions, settings }) => {
      const state = JSON.parse(localStorage.getItem(key) ?? 'null');
      state.sessions = sessions.map((s) => {
        // Sans décalage, la date se lit en heure locale (Europe/Paris).
        const start = new Date(s.at);
        return {
          id: s.id,
          name: 'Full body A',
          startedAt: start.toISOString(),
          endedAt: new Date(start.getTime() + 3_600_000).toISOString(),
          exercises: [{ exerciseId: 'squat', sets: Array.from({ length: 5 }, () => ({ weight: s.weight, reps: 5, done: true })) }],
        };
      });
      state.settings = settings;
      localStorage.setItem(key, JSON.stringify(state));
    },
    { key: STORAGE_KEY, sessions, settings },
  );
  // Relit l'état injecté (l'app en mémoire ne doit pas l'écraser).
  await page.reload();
}

/** Nombre de lignes occupées par `text` dans l'élément (rectangles de la plage, par ordonnée). */
async function lineCount(page: Page, selector: string, text?: string) {
  return page.locator(selector).evaluate((el, text) => {
    const node = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE) as Text;
    const content = node.data;
    const from = text === undefined ? 0 : content.indexOf(text);
    if (from < 0) throw new Error(`« ${text} » absent de « ${content} »`);
    const range = document.createRange();
    range.setStart(node, from);
    range.setEnd(node, text === undefined ? content.length : from + text.length);
    return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
  }, text);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`carte de proposition, ${scheme} : « Non merci » à contour, ≥ 48 px, définitif`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await seed(page, [{ id: 'a', at: '2026-10-19T18:00', weight: 60 }, { id: 'b', at: '2026-10-26T18:00', weight: 60 }], {});
    await page.goto('./#/progres');
    await page.reload();

    const card = page.locator('.goal-prompt');
    await expect(card.getByText('Un repère pour toi. Tu pourras le régler à tout moment dans Réglages.')).toBeVisible();
    await expect(page.getByText('Plus tard')).toHaveCount(0);
    const refuse = card.getByRole('button', { name: 'Non merci' });
    await expect(refuse).not.toHaveClass(/btn--ghost/);
    const style = await refuse.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { color: cs.borderTopColor, width: cs.borderTopWidth, marginLeft: cs.marginLeft, height: el.getBoundingClientRect().height };
    });
    expect(style.color).not.toMatch(/transparent|rgba\(\d+, \d+, \d+, 0\)/);
    expect(style.width).toBe('1px');
    expect(style.marginLeft).toBe('0px');
    expect(style.height).toBeGreaterThanOrEqual(48);
    // Progrès : aucun aplat accent.
    await expect(page.locator('.btn--primary')).toHaveCount(0);

    await refuse.tap();
    await expect(card).toHaveCount(0);
    await expect(page.locator('.toast')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Progrès' })).toBeVisible();
    await expect(page.locator('.goal-prompt')).toHaveCount(0);
  });
}

test.describe('375 × 667', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('Progrès : la ligne du mois en cours, sans le compte, tient sur une ligne', async ({ page }) => {
    // Profil (b) : lundi, mercredi, vendredi en octobre, charge en hausse (un record par séance).
    const days = [2, 5, 7, 9, 12, 14, 16, 19, 21, 23, 26, 28];
    const sessions = days.map((d, i) => ({ id: `o${d}`, at: `2026-10-${String(d).padStart(2, '0')}T18:00`, weight: 100 + 2.5 * i }));
    await seed(page, sessions, { weeklyGoal: 3, weeklyGoalAsked: true });
    await page.goto('./#/progres');
    await page.reload();

    const month = page.locator('.progress-review p', { hasText: /^Octobre/ });
    await expect(month).toHaveText(/^Octobre\s:\s\d+\s\d+\skg,\s\d+\srecords\.$/);
    await expect(month).not.toContainText('séance');
    expect(await lineCount(page, '.progress-review p:last-child')).toBe(1);
  });

  test('« Objectif atteint. » ne se coupe pas, sur le récap et sur Séances', async ({ page }) => {
    const sessions = [
      { id: 'w1', at: '2026-10-26T18:00', weight: 100 },
      { id: 'w2', at: '2026-10-27T18:00', weight: 100 },
      { id: 'w3', at: '2026-10-29T18:00', weight: 100 },
    ];
    await seed(page, sessions, { weeklyGoal: 3, weeklyGoalAsked: true });
    const line = 'Cette semaine : 3 séances sur 3. Objectif atteint.';

    await page.goto('./#/resume/w3');
    await page.reload();
    await expect(page.locator('.summary-rhythm__line').first()).toHaveText(line);
    expect(await lineCount(page, '.summary-rhythm__line', 'Objectif atteint.')).toBe(1);

    await page.goto('./#/seances');
    await expect(page.locator('.week-line')).toHaveText(line);
    expect(await lineCount(page, '.week-line', 'Objectif atteint.')).toBe(1);
  });
});
