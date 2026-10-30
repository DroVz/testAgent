import { expect, test, type Page } from '@playwright/test';

/**
 * Lot 5 (docs/product/lot5-sauvegarde-et-records.md) : record annoncé dans le dock pendant la séance,
 * puis carte de rappel de sauvegarde sur le récap de la 6ᵉ séance comptée, export en un tap.
 */

const STORAGE_KEY = 'muscutrack:v1';
const BACKUP_KEY = 'muscutrack:sauvegarde';

/** État par défaut enregistré par l'app, puis 5 séances de squat à 82,5 kg et une séance en cours. */
async function seed(page: Page) {
  await page.goto('./#/reglages');
  // Un premier choix fait enregistrer l'état complet par l'app.
  await page.getByRole('radiogroup', { name: 'Objectif par semaine' }).getByRole('radio', { name: 'Aucun objectif' }).tap();
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key) ?? 'null');
    const day = 86_400_000;
    state.sessions = Array.from({ length: 5 }, (_, i) => {
      const start = Date.now() - (10 - i) * day;
      return {
        id: `s${i + 1}`,
        name: 'Jambes',
        startedAt: new Date(start).toISOString(),
        endedAt: new Date(start + 3_600_000).toISOString(),
        exercises: [{ exerciseId: 'squat', sets: [{ weight: 82.5, reps: 5, done: true }] }],
      };
    });
    state.settings = {};
    state.activeSession = {
      id: 'live',
      name: 'Jambes',
      startedAt: new Date(Date.now() - 600_000).toISOString(),
      exercises: [
        {
          exerciseId: 'squat',
          sets: [
            { weight: 85, reps: 5, done: false },
            { weight: 85, reps: 5, done: false },
          ],
        },
      ],
    };
    localStorage.setItem(key, JSON.stringify(state));
  }, STORAGE_KEY);
  await page.reload();
}

test('record annoncé en séance, puis rappel de sauvegarde sur le récap et export en un tap', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  // Feuille de partage simulée (réussie) : l'export depuis le récap la passe.
  await page.addInitScript(() => {
    Object.assign(navigator, {
      canShare: () => true,
      share: () => Promise.resolve(),
      vibrate: () => {
        (window as unknown as { vibrated: boolean }).vibrated = true;
        return true;
      },
    });
  });
  await seed(page);

  // Séance : 85 kg bat 82,5 kg.
  await page.goto('./#/seance');
  await page.getByRole('button', { name: 'Valider la série' }).tap();
  const record = page.locator('.session-dock__record');
  await expect(record).toHaveText('Nouveau record en squat : 85 kg !');
  await expect(page.locator('.session-dock__feedback')).toHaveText('Série 1 validée. Repos : 90 s.');
  const style = await record.evaluate((el) => {
    const cs = getComputedStyle(el);
    const probe = document.createElement('span');
    probe.style.color = 'var(--success)';
    document.body.appendChild(probe);
    const success = getComputedStyle(probe).color;
    probe.remove();
    return {
      color: cs.color,
      success,
      background: cs.backgroundColor,
      fontSize: cs.fontSize,
      animations: el.getAnimations().map((a) => Number((a.effect?.getComputedTiming().duration as number) ?? 0)),
      sameStatus: el.parentElement?.getAttribute('role') === 'status' && el.parentElement.contains(document.querySelector('.session-dock__feedback')),
    };
  });
  expect(style.color).toBe(style.success);
  expect(style.background).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  expect(style.fontSize).toBe('16px');
  expect(style.sameStatus).toBe(true);
  expect(style.animations.length).toBeLessThanOrEqual(1);
  for (const d of style.animations) expect(d).toBeLessThanOrEqual(200);
  await expect(page.locator('.btn--primary')).toHaveCount(1);

  // Même charge à la série 2 : pas de nouvelle annonce.
  await page.getByRole('button', { name: 'Valider la série' }).tap();
  await expect(page.locator('.session-dock__feedback')).toHaveText('Exercice terminé : squat.');
  await expect(record).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { vibrated?: boolean }).vibrated ?? false)).toBe(false);

  // Fin de séance : 6ᵉ séance comptée, aucun export → carte de rappel après les records.
  await page.getByRole('button', { name: 'Terminer la séance' }).first().tap();
  await expect(page).toHaveURL(/#\/resume\/live/);
  await expect(page.locator('.records')).toContainText('Nouveau record en squat : 85 kg !');
  const card = page.locator('.backup-card');
  await expect(card).toContainText('Tes 6 séances n’existent que sur ce téléphone.');
  await expect(page.locator('.btn--primary')).toHaveText(['Voir mes progrès']);
  const exportBtn = card.getByRole('button', { name: 'Exporter mes données' });
  expect((await exportBtn.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await exportBtn.tap();
  await expect(card.getByRole('status')).toHaveText('Copie exportée.');
  await expect(card.getByRole('button')).toHaveCount(0);
  const info = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), BACKUP_KEY);
  expect(typeof info.lastExportAt).toBe('string');

  // Réglages : la ligne d'état le dit.
  await page.goto('./#/reglages');
  await expect(page.locator('.settings-section__status')).toHaveText('Dernier export : aujourd’hui.');
  await expect(page.getByRole('switch', { name: 'Rappel de sauvegarde' })).toHaveAttribute('aria-checked', 'true');
  expect(errors).toEqual([]);
});

test('à 375 × 667, le record de 1RM tient sur 2 lignes et « Valider la série » reste visible ; rien sous mouvement réduit', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#/reglages');
  await page.getByRole('radiogroup', { name: 'Objectif par semaine' }).getByRole('radio', { name: 'Aucun objectif' }).tap();
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key) ?? 'null');
    const start = Date.now() - 5 * 86_400_000;
    state.sessions = [
      {
        id: 'h',
        name: 'Haut',
        startedAt: new Date(start).toISOString(),
        endedAt: new Date(start + 3_600_000).toISOString(),
        exercises: [{ exerciseId: 'developpe-couche', sets: [{ weight: 80, reps: 1, done: true }] }],
      },
    ];
    // 75 kg × 7 : 1RM 92,5 kg > 80 kg ; poids max plus bas (75 < 80).
    state.activeSession = {
      id: 'live',
      name: 'Haut',
      startedAt: new Date(Date.now() - 600_000).toISOString(),
      exercises: [
        {
          exerciseId: 'developpe-couche',
          sets: [
            { weight: 75, reps: 7, done: false },
            { weight: 70, reps: 8, done: false },
          ],
        },
      ],
    };
    localStorage.setItem(key, JSON.stringify(state));
  }, STORAGE_KEY);
  await page.reload();
  await page.goto('./#/seance');
  await page.getByRole('button', { name: 'Valider la série' }).tap();
  const record = page.locator('.session-dock__record');
  await expect(record).toHaveText('Nouveau record de 1RM estimé en développé couché : 92,5 kg !');
  const layout = await record.evaluate((el) => {
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
    return {
      lines: Math.round(el.getBoundingClientRect().height / lineHeight),
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      animations: el.getAnimations().length,
    };
  });
  expect(layout.lines).toBeLessThanOrEqual(2);
  expect(layout.overflow).toBe(false);
  expect(layout.animations).toBe(0);
  const primary = page.getByRole('button', { name: 'Valider la série' });
  const box = (await primary.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(667);
  // La carte de la série en cours a défilé : sa référence reste au-dessus du dock (sans animation ici).
  expect(await refGapAboveDock(page)).toBeGreaterThanOrEqual(0);
});

/** Écart (px) entre le bas de la référence de la série en cours et le haut du dock (négatif = rognée). */
function refGapAboveDock(page: Page) {
  return page.evaluate(() => {
    const ref = document.querySelector('.set-current .set-current__ref')!.getBoundingClientRect();
    const dock = document.querySelector('.session-dock')!.getBoundingClientRect();
    return Math.round(dock.top - ref.bottom);
  });
}

test('à 375 × 667, après chaque validation, « Dernière fois » reste visible au-dessus du dock', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('./#/reglages');
  await page.getByRole('radiogroup', { name: 'Objectif par semaine' }).getByRole('radio', { name: 'Aucun objectif' }).tap();
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key) ?? 'null');
    const start = Date.now() - 5 * 86_400_000;
    const squat = (weight: number, done: boolean) => ({ weight, reps: 5, done });
    state.sessions = [
      {
        id: 'h',
        name: 'Jambes',
        startedAt: new Date(start).toISOString(),
        endedAt: new Date(start + 3_600_000).toISOString(),
        exercises: [{ exerciseId: 'squat', sets: [squat(82.5, true), squat(82.5, true), squat(82.5, true), squat(82.5, true)] }],
      },
    ];
    // Records à la série 1 (85 kg) et à la série 3 (87,5 kg) : le dock grandit d'une ligne verte.
    state.activeSession = {
      id: 'live',
      name: 'Jambes',
      startedAt: new Date(Date.now() - 600_000).toISOString(),
      exercises: [{ exerciseId: 'squat', sets: [squat(85, false), squat(85, false), squat(87.5, false), squat(87.5, false)] }],
    };
    localStorage.setItem(key, JSON.stringify(state));
  }, STORAGE_KEY);
  await page.reload();
  await page.goto('./#/seance');
  const record = page.locator('.session-dock__record');
  for (const [n, announced] of [
    [2, true],
    [3, false],
    [4, true],
  ] as const) {
    await page.getByRole('button', { name: 'Valider la série' }).tap();
    await expect(page.locator('.set-current__title')).toContainText(`Série ${n} sur 4`);
    await expect(record).toHaveCount(announced ? 1 : 0);
    await expect(page.locator('.set-current__ref')).toHaveText(/^Dernière fois/);
    // Défilement animé (mouvement non réduit) : on attend qu'il se termine.
    await expect.poll(() => refGapAboveDock(page)).toBeGreaterThanOrEqual(0);
  }
});

test('récap : 16 px au moins entre la carte de rappel et le dock, à 375 × 667 et à 390 × 844', async ({ page }) => {
  await seed(page);
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('./#/resume/s5');
    // Récap de la 5ᵉ séance (sans carte) : la liste respire aussi au-dessus du dock.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const listGap = await page.evaluate(
      () =>
        document.querySelector('.summary-dock')!.getBoundingClientRect().top -
        document.querySelector('.summary-list')!.getBoundingClientRect().bottom,
    );
    expect(listGap).toBeGreaterThanOrEqual(16);
  }
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('./#/seance');
  await page.getByRole('button', { name: 'Valider la série' }).tap();
  await page.getByRole('button', { name: 'Valider la série' }).tap();
  await page.getByRole('button', { name: 'Terminer la séance' }).first().tap();
  await expect(page.locator('.backup-card')).toBeVisible();
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const gap = await page.evaluate(
      () =>
        document.querySelector('.summary-dock')!.getBoundingClientRect().top -
        document.querySelector('.backup-card')!.getBoundingClientRect().bottom,
    );
    expect(gap).toBeGreaterThanOrEqual(16);
  }
});
