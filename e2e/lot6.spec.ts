import { expect, test, type Page } from '@playwright/test';

/**
 * Lot 6 (docs/product/lot6-en-salle.md) : un exercice sauté est repris avant la fin ; la note
 * d'exercice est écrite, relue à la séance suivante, effacée puis rétablie par « Annuler ».
 */

const STORAGE_KEY = 'muscutrack:v1';

/** État par défaut enregistré par l'app, complété par `patch` (exécuté dans la page). */
async function seed(page: Page, patch: (state: Record<string, unknown>) => void) {
  await page.goto('./#/reglages');
  // Un premier choix fait enregistrer l'état complet par l'app.
  await page.getByRole('radiogroup', { name: 'Objectif par semaine' }).getByRole('radio', { name: 'Aucun objectif' }).tap();
  await page.evaluate(
    ({ key, fn }) => {
      const state = JSON.parse(localStorage.getItem(key) ?? 'null');
      // `patch` est transmis en texte (les fonctions ne traversent pas page.evaluate).
      new Function('state', `(${fn})(state)`)(state);
      localStorage.setItem(key, JSON.stringify(state));
    },
    { key: STORAGE_KEY, fn: patch.toString() },
  );
  await page.reload();
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

/** Aucune cible < 48 px parmi les boutons visibles, aucun débordement horizontal. */
async function checkLayout(page: Page) {
  const result = await page.evaluate(() => {
    const small = [...document.querySelectorAll<HTMLElement>('button, input')]
      .filter((el) => el.offsetParent !== null && !el.closest('.visually-hidden'))
      .filter((el) => el.getBoundingClientRect().height < 48)
      .map((el) => el.textContent || el.getAttribute('aria-label'));
    return { small, overflow: document.documentElement.scrollWidth > window.innerWidth };
  });
  expect(result.small).toEqual([]);
  expect(result.overflow).toBe(false);
}

const primary = (page: Page) => page.locator('.session-dock .btn--primary');

/** Crans de la barre de progression : rempli (encre) ou non, hauteur, contour, et les couleurs de référence. */
async function progressSteps(page: Page) {
  return page.evaluate(() => {
    const probe = (value: string) => {
      const span = document.createElement('span');
      span.style.color = value;
      document.body.appendChild(span);
      const color = getComputedStyle(span).color;
      span.remove();
      return color;
    };
    const ink = probe('var(--text)');
    const border = probe('var(--border)');
    const accent = probe('var(--accent)');
    const steps = [...document.querySelectorAll<HTMLElement>('.session-progress__step')].map((el) => {
      const cs = getComputedStyle(el);
      return {
        filled: cs.backgroundColor === ink,
        grey: cs.backgroundColor === border,
        height: Math.round(el.getBoundingClientRect().height),
        ringed: cs.boxShadow.includes('inset') && cs.boxShadow.startsWith(ink),
        accent: cs.backgroundColor === accent || cs.boxShadow.includes(accent),
      };
    });
    const bar = document.querySelector('[role="progressbar"]')!;
    return { steps, valueText: bar.getAttribute('aria-valuetext') };
  });
}

test('exercice sauté puis repris ; note créée, relue à la séance suivante, effacée puis « Annuler »', async ({ page }) => {
  const errors = watchErrors(page);
  await seed(page, (state) => {
    const now = new Date().toISOString();
    state.templates = [
      {
        id: 'haut',
        name: 'Haut',
        exercises: ['developpe-couche', 'developpe-incline', 'curl-halteres'].map((exerciseId) => ({
          exerciseId,
          targetSets: 1,
          targetReps: 10,
          targetWeight: 20,
          restSeconds: 60,
        })),
        createdAt: now,
        updatedAt: now,
      },
    ];
  });

  await page.goto('./#/seances');
  await page.getByRole('button', { name: 'Démarrer la séance Haut' }).tap();
  await expect(page.getByText('Exercice 1 sur 3')).toBeVisible();

  // La machine est prise : on saute l'exercice 1.
  await page.getByRole('button', { name: 'Exercice suivant : Développé incliné' }).tap();
  await expect(page.getByText('Exercice 2 sur 3')).toBeVisible();

  // Note sur le développé incliné.
  await page.getByRole('button', { name: 'Options de Développé incliné' }).tap();
  await page.getByRole('button', { name: 'Ajouter une note' }).tap();
  const dialog = page.getByRole('dialog', { name: 'Note sur développé incliné' });
  await expect(dialog).toBeVisible();
  const input = dialog.getByRole('textbox', { name: 'Note' });
  await expect(input).toBeFocused();
  await expect(dialog.locator('.btn--primary')).toHaveText(['Enregistrer la note']);
  await checkLayout(page);
  await input.fill('Siège au cran 4');
  await dialog.getByRole('button', { name: 'Enregistrer la note' }).tap();
  await expect(dialog).toHaveCount(0);
  const note = page.locator('.exercise-note');
  await expect(note).toHaveText('Note : Siège au cran 4');
  await expect(page.locator('.toast')).toHaveCount(0);
  // Le focus va à la note, sans contour visible.
  await expect(note).toBeFocused();
  expect(await note.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none');

  // Exercices 2 et 3 faits : l'app rend l'exercice 1.
  await page.getByRole('button', { name: 'Valider la série' }).tap();
  await expect(page.getByText('Exercice 3 sur 3')).toBeVisible();
  await page.getByRole('button', { name: 'Valider la série' }).tap();
  await expect(page.getByText('Exercice 3 sur 3')).toBeVisible();
  await expect(primary(page)).toHaveText('Reprendre l’exercice 1');
  await expect(page.getByRole('button', { name: /^Reprendre l’exercice 1\s:\sdéveloppé couché$/ })).toBeVisible();
  await expect(page.locator('.btn--primary')).toHaveCount(1);
  await checkLayout(page);

  // Crans : ce qui est fait, pas la position. Exercice 1 en attente = gris ; exercice affiché (3) repéré à l'encre.
  const onLast = await progressSteps(page);
  expect(onLast.steps.map((st) => st.filled)).toEqual([false, true, true]);
  expect(onLast.steps[0].grey).toBe(true);
  expect(onLast.steps.map((st) => st.height)).toEqual([8, 8, 12]);
  expect(onLast.steps.some((st) => st.accent)).toBe(false);
  expect(onLast.valueText).toBe('Exercice 3 sur 3, 2\u00a0exercices terminés');

  // Rechargement : même écran, même libellé.
  await page.reload();
  await expect(page.getByText('Exercice 3 sur 3')).toBeVisible();
  await expect(primary(page)).toHaveText('Reprendre l’exercice 1');

  await primary(page).tap();
  await expect(page.getByText('Exercice 1 sur 3')).toBeVisible();
  const resumed = await progressSteps(page);
  expect(resumed.steps.map((st) => st.filled)).toEqual([false, true, true]);
  // Exercice affiché encore en attente : gris, plus haut et cerné d'encre.
  expect(resumed.steps[0]).toMatchObject({ grey: true, height: 12, ringed: true, accent: false });
  await page.getByRole('button', { name: 'Valider la série' }).tap();
  // Plus rien en attente : « Terminer la séance » est le principal, sans confirmation.
  await expect(primary(page)).toHaveText('Terminer la séance');
  expect((await progressSteps(page)).steps.map((st) => st.filled)).toEqual([true, true, true]);
  await expect(page.getByRole('button', { name: 'Terminer la séance' })).toHaveCount(1);
  await primary(page).tap();
  await expect(page).toHaveURL(/#\/resume\//);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Séance suivante : la note est là.
  await page.goto('./#/seances');
  await page.getByRole('button', { name: 'Démarrer la séance Haut' }).tap();
  await page.getByRole('button', { name: 'Exercice suivant : Développé incliné' }).tap();
  await expect(note).toHaveText('Note : Siège au cran 4');

  // Effacer, puis « Annuler » : le texte exact revient.
  await page.getByRole('button', { name: 'Options de Développé incliné' }).tap();
  await page.getByRole('button', { name: 'Modifier la note' }).tap();
  await expect(input).toHaveValue('Siège au cran 4');
  await dialog.getByRole('button', { name: 'Effacer la note' }).tap();
  await expect(note).toHaveCount(0);
  const toast = page.locator('.toast');
  await expect(toast).toContainText('Note effacée.');
  const stored = () =>
    page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? 'null').exercises.find((e: { id: string }) => e.id === 'developpe-incline'),
      STORAGE_KEY,
    );
  expect(await stored()).not.toHaveProperty('note');
  await toast.getByRole('button', { name: 'Annuler : remettre la note' }).tap();
  await expect(note).toHaveText('Note : Siège au cran 4');
  expect((await stored()).note).toBe('Siège au cran 4');

  expect(errors).toEqual([]);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`à 375 × 667 (${colorScheme}), note de 80 caractères, charge proposée et 4 séries : « Valider la série » visible`, async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await seed(page, (state) => {
      const now = Date.now();
      const iso = (t: number) => new Date(t).toISOString();
      state.templates = [
        {
          id: 'jambes',
          name: 'Jambes',
          exercises: [{ exerciseId: 'squat', targetSets: 4, targetReps: 5, targetWeight: 80, restSeconds: 90 }],
          createdAt: iso(now),
          updatedAt: iso(now),
        },
      ];
      const start = now - 3 * 86_400_000;
      state.sessions = [
        {
          id: 'p1',
          templateId: 'jambes',
          name: 'Jambes',
          startedAt: iso(start),
          endedAt: iso(start + 3_600_000),
          exercises: [{ exerciseId: 'squat', sets: Array.from({ length: 4 }, () => ({ weight: 80, reps: 5, done: true })) }],
        },
      ];
      const exercises = state.exercises as { id: string; note?: string }[];
      // 80 caractères : la longueur maximale.
      exercises.find((e) => e.id === 'squat')!.note = 'Barre au cran 6, pieds largeur épaules, descendre sous la parallèle, buste gainé';
    });
    await page.goto('./#/seances');
    await page.getByRole('button', { name: 'Démarrer la séance Jambes' }).tap();
    await expect(page.locator('.load-note')).toBeVisible();

    const note = page.locator('.exercise-note');
    const info = await note.evaluate((el) => {
      const text = el.querySelector('.exercise-note__text')!;
      const cs = getComputedStyle(el);
      const probe = (value: string) => {
        const span = document.createElement('span');
        span.style.color = value;
        document.body.appendChild(span);
        const color = getComputedStyle(span).color;
        span.remove();
        return color;
      };
      return {
        length: text.textContent!.replace(/^Note\s:\s/, '').length,
        lines: Math.round(text.getBoundingClientRect().height / parseFloat(cs.lineHeight)),
        // Le texte tient entier dans ses 2 lignes (rien de rogné par le plafond de 2 lignes).
        clipped: text.scrollHeight > text.clientHeight + 1,
        color: cs.color,
        muted: probe('var(--text-muted)'),
        accent: probe('var(--accent)'),
        success: probe('var(--success)'),
        background: cs.backgroundColor,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        iconHidden: el.querySelector('svg')?.getAttribute('aria-hidden'),
      };
    });
    expect(info.length).toBe(80);
    expect(info.lines).toBeLessThanOrEqual(2);
    expect(info.clipped).toBe(false);
    expect(info.color).toBe(info.muted);
    expect(info.color).not.toBe(info.accent);
    expect(info.color).not.toBe(info.success);
    expect(info.background).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(info.fontSize).toBe('16px');
    expect(info.fontWeight).toBe('400');
    expect(info.iconHidden).toBe('true');

    // « Valider la série » entièrement visible sans défiler, un seul aplat accent.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const box = (await page.getByRole('button', { name: 'Valider la série' }).boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(667);
    await expect(page.locator('.btn--primary')).toHaveCount(1);
    await checkLayout(page);

    // Pendant le repos, la carte en cours reste au-dessus du dock ; la note reste affichée.
    await page.getByRole('button', { name: 'Valider la série' }).tap();
    await expect(page.getByRole('region', { name: 'Minuteur de repos' })).toBeVisible();
    await expect(page.locator('.load-note')).toHaveCount(0);
    await expect(note).toBeVisible();
    const gap = await page.evaluate(() => {
      const card = document.querySelector('.set-current')!.getBoundingClientRect();
      const dock = document.querySelector('.session-dock')!.getBoundingClientRect();
      return Math.round(dock.top - card.bottom);
    });
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

/** Hauteur recouverte par le clavier iOS (mesurée dans la revue design du lot 6). */
const IOS_KEYBOARD = [
  { width: 390, height: 844, keyboardTop: 508 },
  { width: 375, height: 667, keyboardTop: 407 },
];
const UPPER_NOTE = 'POULIE HAUTE : TROU 3, MAINS EN SUPINATION, COUDES FIXÉS, 3 S EN DESCENTE LENTE.';
const LOWER_NOTE = 'Barre au cran 6, pieds largeur épaules, descendre sous la parallèle, buste gainé';

for (const { width, height, keyboardTop } of IOS_KEYBOARD) {
  test(`à ${width} × ${height} : dialogue de note au-dessus du clavier iOS, note de 80 majuscules entière`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seed(page, (state) => {
      const now = new Date().toISOString();
      state.templates = [
        {
          id: 'haut',
          name: 'Haut',
          exercises: [{ exerciseId: 'developpe-couche', targetSets: 3, targetReps: 10, targetWeight: 60, restSeconds: 90 }],
          createdAt: now,
          updatedAt: now,
        },
      ];
    });
    expect(UPPER_NOTE).toHaveLength(80);
    expect(LOWER_NOTE).toHaveLength(80);
    await page.goto('./#/seances');
    await page.getByRole('button', { name: 'Démarrer la séance Haut' }).tap();

    // Ajout : le dialogue est ancré en haut, ses boutons tiennent au-dessus du clavier.
    const options = page.getByRole('button', { name: 'Options de Développé couché' });
    await options.tap();
    await page.getByRole('button', { name: 'Ajouter une note' }).tap();
    const dialog = page.getByRole('dialog', { name: 'Note sur développé couché' });
    const input = dialog.getByRole('textbox', { name: 'Note' });
    await expect(input).toBeFocused();
    // Zone de texte de 2 lignes, sans poignée. Une note de 80 caractères en demande 3 à cette largeur :
    // la zone défile d'une ligne, l'écran de séance l'affiche ensuite entière.
    await input.fill(LOWER_NOTE);
    const area = await input.evaluate((el) => ({
      tag: el.tagName,
      rows: (el as HTMLTextAreaElement).rows,
      resize: getComputedStyle(el).resize,
      // Deux lignes de 24 px visibles.
      visibleLines: Math.round((el.clientHeight - parseFloat(getComputedStyle(el).paddingTop) * 2) / 24),
    }));
    expect(area).toEqual({ tag: 'TEXTAREA', rows: 2, resize: 'none', visibleLines: 2 });
    await input.fill(UPPER_NOTE);
    await expect(dialog.getByText(/^80\s\/\s80$/)).toBeVisible();
    for (const name of ['Annuler', 'Enregistrer la note']) {
      const box = (await dialog.getByRole('button', { name }).boundingBox())!;
      expect(box.y + box.height, name).toBeLessThanOrEqual(keyboardTop);
    }
    // Entrée enregistre, sans saut de ligne.
    await input.press('Enter');
    await expect(dialog).toHaveCount(0);
    const note = page.locator('.exercise-note');
    await expect(note).toBeFocused();

    // Note entière : rien de rogné, 3 lignes au plus ; « Valider la série » entièrement visible.
    const shown = await note.evaluate((el) => {
      const text = el.querySelector('.exercise-note__text')!;
      return {
        text: text.textContent!.replace(/^Note\s:\s/, ''),
        lines: Math.round(text.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)),
        clipped: text.scrollHeight > text.clientHeight + 1,
      };
    });
    expect(shown.text).toBe(UPPER_NOTE);
    expect(shown.clipped).toBe(false);
    expect(shown.lines).toBeLessThanOrEqual(3);
    const validate = (await page.getByRole('button', { name: 'Valider la série' }).boundingBox())!;
    expect(validate.y).toBeGreaterThanOrEqual(0);
    expect(validate.y + validate.height).toBeLessThanOrEqual(height);

    // Modification : « Effacer la note » aussi reste au-dessus du clavier.
    await options.tap();
    await page.getByRole('button', { name: 'Modifier la note' }).tap();
    await expect(input).toHaveValue(UPPER_NOTE);
    for (const name of ['Annuler', 'Enregistrer la note', 'Effacer la note']) {
      const box = (await dialog.getByRole('button', { name }).boundingBox())!;
      expect(box.y + box.height, name).toBeLessThanOrEqual(keyboardTop);
    }
    await checkLayout(page);
    await dialog.getByRole('button', { name: 'Effacer la note' }).tap();
    await expect(note).toHaveCount(0);
    await expect(options).toBeFocused();
    expect(errors).toEqual([]);
  });
}
