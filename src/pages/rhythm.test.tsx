import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { STORAGE_KEY, createDefaultState, type StorageLike } from '../lib/storage';
import { createTemplate, createTemplateExercise } from '../lib/templates';
import type { AppSettings, AppState, WorkoutSession } from '../lib/types';
import { AppStoreProvider } from '../state/AppStore';

/** Lot 3 « Ton rythme » (docs/product/lot3-rythme.md, §8) : écrans Séances, Progrès, récap et Réglages. */

/** Aujourd'hui dans ces tests : mercredi 28 octobre 2026, 12:00 (semaine du lundi 26). */
const NOW = new Date(2026, 9, 28, 12, 0);

function memoryStorage(initial?: AppState) {
  const data: Record<string, string> = initial === undefined ? {} : { [STORAGE_KEY]: JSON.stringify(initial) };
  const storage: StorageLike = {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
  const saved = (): AppState => JSON.parse(data[STORAGE_KEY]);
  return { storage, saved, data };
}

function renderAt(hash: string, initial?: AppState) {
  window.location.hash = hash;
  const mem = memoryStorage(initial);
  const view = render(
    <AppStoreProvider storage={mem.storage}>
      <App />
    </AppStoreProvider>,
  );
  return { ...mem, ...view };
}

/** Séance terminée le `day` octobre 2026 à `hour` h ; `done` = au moins une série validée. */
function session(id: string, day: number, { hour = 18, done = true, month = 10 } = {}): WorkoutSession {
  return {
    id,
    name: `Séance ${id}`,
    startedAt: new Date(2026, month - 1, day, hour, 0).toISOString(),
    endedAt: new Date(2026, month - 1, day, hour + 1, 0).toISOString(),
    exercises: [{ exerciseId: 'squat', sets: [{ weight: 100, reps: 5, done }] }],
  };
}

function stateWith(sessions: WorkoutSession[], settings?: AppSettings, withTemplate = true): AppState {
  const s = createDefaultState();
  if (withTemplate) {
    s.templates.push(
      createTemplate({ name: 'Jambes', exercises: [createTemplateExercise('squat')] }, new Date(2026, 9, 1), 't1'),
    );
  }
  s.sessions.push(...sessions);
  if (settings) s.settings = settings;
  return s;
}

/** Texte avec espaces insécables ramenées à des espaces simples (lecture des attentes). */
const plain = (el: Element | null) => (el?.textContent ?? '').replace(/[  ]/g, ' ');
const weekLine = () => document.querySelector('.week-line');
const accentButtons = () => [...document.querySelectorAll('.btn--primary')].map((el) => plain(el).trim());

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('Séances : ligne de semaine (critères 11 à 13)', () => {
  it('objectif 3 : 1 séance, 3 séances (atteint), 4 séances (au-delà)', () => {
    renderAt('#/seances', stateWith([session('a', 26)], { weeklyGoal: 3 }));
    expect(plain(weekLine())).toBe('Cette semaine : 1 séance sur 3.');
    // Espaces insécables avant « : » et « séance ».
    expect(weekLine()!.textContent).toBe('Cette semaine : 1 séance sur 3.');
    cleanup();

    renderAt('#/seances', stateWith([session('a', 26), session('b', 27), session('c', 28, { hour: 8 })], { weeklyGoal: 3 }));
    expect(plain(weekLine())).toBe('Cette semaine : 3 séances sur 3. Objectif atteint.');
    cleanup();

    renderAt(
      '#/seances',
      stateWith([session('a', 26), session('b', 27), session('c', 28, { hour: 8 }), session('d', 28, { hour: 10 })], {
        weeklyGoal: 3,
      }),
    );
    expect(plain(weekLine())).toBe('Cette semaine : 4 séances. Objectif de 3 atteint.');
  });

  it('séance vide (aucune série validée) : non comptée', () => {
    renderAt('#/seances', stateWith([session('a', 26), session('vide', 27, { done: false })], { weeklyGoal: 3 }));
    expect(plain(weekLine())).toBe('Cette semaine : 1 séance sur 3.');
  });

  it('lundi suivant sans séance : le repère seul, rien sur la semaine écoulée', () => {
    vi.setSystemTime(new Date(2026, 10, 2, 9, 0));
    renderAt('#/seances', stateWith([session('a', 26), session('b', 27)], { weeklyGoal: 3 }));
    expect(plain(weekLine())).toBe('Objectif de la semaine : 3 séances.');
    expect(document.querySelectorAll('.week-line')).toHaveLength(1);
    expect(screen.queryByText(/Semaine dernière|atteint/)).not.toBeInTheDocument();
  });

  it('sans objectif : « Cette semaine : 2 séances. », et rien à 0 séance (état vide du lot 2 intact)', () => {
    renderAt('#/seances', stateWith([session('a', 26), session('b', 27)]));
    expect(plain(weekLine())).toBe('Cette semaine : 2 séances.');
    cleanup();

    renderAt('#/seances');
    expect(weekLine()).toBeNull();
    expect(screen.getByText('Aucune séance pour l’instant.')).toBeInTheDocument();
    expect(accentButtons()).toEqual(['Choisir un programme']);
  });

  it('liste vide mais historique conservé : la ligne reste rendue', () => {
    renderAt('#/seances', stateWith([session('a', 26)], { weeklyGoal: 2 }, false));
    expect(plain(weekLine())).toBe('Cette semaine : 1 séance sur 2.');
    expect(accentButtons()).toEqual(['Choisir un programme']);
  });

  it('la seule action accent reste « Démarrer la séance »', () => {
    renderAt('#/seances', stateWith([session('a', 26)], { weeklyGoal: 3 }));
    expect(accentButtons()).toEqual(['Démarrer la séance']);
    expect(weekLine()!.className).not.toMatch(/accent|primary/);
  });
});

describe('Progrès : tuiles, pastilles, bilan (critères 1, 14 à 16, 18)', () => {
  const tile = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement;
  const dots = () => [...document.querySelectorAll('.rhythm-dot')];

  it('tuiles en séances comptées : une séance terminée sans série validée n’apparaît nulle part', () => {
    renderAt('#/progres', stateWith([session('a', 26), session('vide', 27, { done: false }), session('b', 5)], { weeklyGoalAsked: true }));
    expect(tile('Séances')).toHaveTextContent('2');
    expect(tile('Cette semaine')).toHaveTextContent('1');
    expect(tile('Ce mois')).toHaveTextContent('2');
  });

  it('objectif « Aucun » : le nombre seul, aucune pastille', () => {
    renderAt('#/progres', stateWith([session('a', 26), session('b', 27)], { weeklyGoalAsked: true }));
    expect(tile('Cette semaine').textContent).toBe('2');
    expect(dots()).toHaveLength(0);
  });

  it('objectif 3, 2 séances : « 2 sur 3 », 3 pastilles dont 2 remplies, masquées aux lecteurs d’écran', () => {
    renderAt('#/progres', stateWith([session('a', 26), session('b', 27)], { weeklyGoal: 3, weeklyGoalAsked: true }));
    const week = tile('Cette semaine');
    expect(within(week).getByText('2 sur 3')).toHaveAttribute('aria-hidden', 'true');
    // Nom accessible porté par le texte, jamais par les pastilles.
    expect(week.querySelector('.visually-hidden')!.textContent).toBe('2 séances sur 3');
    expect(dots()).toHaveLength(3);
    expect(dots().filter((d) => d.classList.contains('rhythm-dot--done'))).toHaveLength(2);
    expect(week.querySelector('.rhythm-dots')).toHaveAttribute('aria-hidden', 'true');
    expect(within(week).queryByText('Objectif atteint')).not.toBeInTheDocument();
  });

  it('objectif 3, 4 séances : « 4 », 3 pastilles remplies et « Objectif atteint »', () => {
    const four = [session('a', 26), session('b', 27), session('c', 28, { hour: 8 }), session('d', 28, { hour: 10 })];
    renderAt('#/progres', stateWith(four, { weeklyGoal: 3, weeklyGoalAsked: true }));
    const week = tile('Cette semaine');
    expect(within(week).getByText('4')).toBeInTheDocument();
    expect(dots()).toHaveLength(3);
    expect(dots().every((d) => d.classList.contains('rhythm-dot--done'))).toBe(true);
    expect(within(week).getByText('Objectif atteint')).toBeInTheDocument();
  });

  it('historique vide avec objectif : « 0 sur 3 », 3 pastilles en contour, ni bilan ni proposition', () => {
    renderAt('#/progres', stateWith([], { weeklyGoal: 3, weeklyGoalAsked: true }));
    expect(within(tile('Cette semaine')).getByText('0 sur 3')).toBeInTheDocument();
    expect(dots()).toHaveLength(3);
    expect(dots().some((d) => d.classList.contains('rhythm-dot--done'))).toBe(false);
    expect(document.querySelector('.progress-review')).toBeNull();
    expect(screen.getByText('Pas encore de progression à afficher')).toBeInTheDocument();
  });

  it('bilan : semaine dernière puis mois, avec volume et records ; jamais l’objectif', () => {
    // Semaine dernière (19–25 oct.) : 3 séances, 14 520 kg, 1 record (la 3e bat le poids max de 120 kg).
    const sets = (...groups: [number, number, number][]) =>
      groups.flatMap(([count, weight, reps]) => Array.from({ length: count }, () => ({ weight, reps, done: true })));
    const big = (id: string, day: number, s: ReturnType<typeof sets>): WorkoutSession => ({
      ...session(id, day),
      exercises: [{ exerciseId: 'squat', sets: s }],
    });
    const sessions = [
      big('base', 5, sets([6, 120, 10])), // 7 200 kg
      big('l1', 19, sets([5, 100, 10])), // 5 000 kg
      big('l2', 21, sets([5, 100, 10])), // 5 000 kg
      big('l3', 23, sets([1, 125, 8], [4, 110, 8])), // 4 520 kg, record de poids
    ];
    renderAt('#/progres', stateWith(sessions, { weeklyGoal: 3, weeklyGoalAsked: true }));
    const lines = [...document.querySelectorAll('.progress-review p')].map(plain);
    expect(lines).toEqual(['Semaine dernière : 3 séances, 14 520 kg, 1 record.', 'Octobre : 4 séances, 21 720 kg, 1 record.']);
    expect(lines.join(' ')).not.toMatch(/objectif|sur 3/i);
  });

  it('bilan : semaine dernière omise si vide ; le 1er novembre sans séance, le mois affiché est octobre', () => {
    vi.setSystemTime(new Date(2026, 10, 1, 9, 0));
    renderAt('#/progres', stateWith([session('a', 5), session('b', 12)], { weeklyGoalAsked: true }));
    const lines = [...document.querySelectorAll('.progress-review p')].map(plain);
    expect(lines).toEqual(['Octobre : 2 séances, 1 000 kg.']);
  });

  it('aucun élément de Progrès en accent (hors état vide existant)', () => {
    renderAt('#/progres', stateWith([session('a', 26), session('b', 27)]));
    expect(accentButtons()).toEqual([]);
  });
});

describe('Progrès : proposition d’objectif (critère 17)', () => {
  const card = () => screen.queryByRole('heading', { name: /Combien de séances par semaine veux-tu viser/ });

  it('absente avec 0 ou 1 séance comptée, présente à 2', () => {
    renderAt('#/progres', stateWith([]));
    expect(card()).toBeNull();
    cleanup();
    renderAt('#/progres', stateWith([session('a', 26), session('vide', 27, { done: false })]));
    expect(card()).toBeNull();
    cleanup();
    renderAt('#/progres', stateWith([session('a', 26), session('b', 12)]));
    expect(card()).toBeInTheDocument();
    expect(screen.getByText('Un repère pour toi. Tu pourras le changer dans Réglages.')).toBeInTheDocument();
    expect(['2', '3', '4'].map((n) => screen.getByRole('button', { name: `${n} séances par semaine` }))).toHaveLength(3);
  });

  it('tap sur « 3 » : objectif enregistré, carte retirée, toast, pastilles visibles', () => {
    const { saved } = renderAt('#/progres', stateWith([session('a', 26), session('b', 12)]));
    fireEvent.click(screen.getByRole('button', { name: '3 séances par semaine' }));
    expect(card()).toBeNull();
    expect(plain(document.querySelector('.toast'))).toContain('Objectif enregistré : 3 séances par semaine.');
    expect(document.querySelector('.toast button')).toBeNull();
    expect(document.querySelectorAll('.rhythm-dot')).toHaveLength(3);
    expect(saved().settings).toEqual({ weeklyGoal: 3, weeklyGoalAsked: true });
  });

  it('« Plus tard » : carte retirée, sans toast, toujours absente après rechargement', () => {
    const { saved } = renderAt('#/progres', stateWith([session('a', 26), session('b', 12)]));
    fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(card()).toBeNull();
    expect(document.querySelector('.toast')).toBeNull();
    const after = saved();
    expect(after.settings).toEqual({ weeklyGoalAsked: true });
    cleanup();
    renderAt('#/progres', after);
    expect(card()).toBeNull();
    expect(document.querySelectorAll('.rhythm-dot')).toHaveLength(0);
  });

  it('absente si une valeur a déjà été choisie dans Réglages, même « Aucun »', () => {
    renderAt('#/reglages', stateWith([session('a', 26), session('b', 12)]));
    fireEvent.click(screen.getByRole('radio', { name: 'Aucun objectif' }));
    fireEvent.click(screen.getByRole('link', { name: 'Séances' }));
    fireEvent.click(screen.getByRole('link', { name: /Progrès/ }));
    expect(screen.getByRole('heading', { name: 'Progrès' })).toBeInTheDocument();
    expect(card()).toBeNull();
  });
});

describe('Récap : ligne de semaine et jalon (critères 19 à 21)', () => {
  const lines = () => [...document.querySelectorAll('.summary-rhythm__line')].map(plain);

  it('séance qui porte la semaine à 2 sur 3 ; récap plus ancien de la même semaine : compte à ce moment-là', () => {
    const state = stateWith([session('a', 26), session('b', 27), session('old', 5)], { weeklyGoal: 3 });
    renderAt('#/resume/b', state);
    expect(lines()).toEqual(['Cette semaine : 2 séances sur 3.']);
    // La ligne vient juste après la phrase de synthèse, avant les tuiles.
    const sentence = document.querySelector('.summary-sentence')!;
    expect(sentence.nextElementSibling).toHaveClass('summary-rhythm');
    cleanup();
    renderAt('#/resume/a', state);
    expect(lines()).toEqual(['Cette semaine : 1 séance sur 3.']);
  });

  it('sans objectif : la ligne s’affiche aussi (un fait) ; semaine écoulée : pas de ligne', () => {
    const state = stateWith([session('a', 26), session('b', 27), session('old', 5)]);
    renderAt('#/resume/b', state);
    expect(lines()).toEqual(['Cette semaine : 2 séances.']);
    cleanup();
    renderAt('#/resume/old', state);
    expect(lines()).toEqual(['Première séance enregistrée. Bienvenue.']);
  });

  it('jalons : 1re, 10e ; 11e sans ligne ; rang stable à la réouverture', () => {
    const many = Array.from({ length: 11 }, (_, i) => session(`s${i + 1}`, i + 1));
    const state = stateWith(many, { weeklyGoalAsked: true });
    renderAt('#/resume/s1', state);
    expect(lines()).toEqual(['Première séance enregistrée. Bienvenue.']);
    cleanup();
    renderAt('#/resume/s10', state);
    expect(lines()).toEqual(['10ᵉ séance enregistrée.']);
    cleanup();
    // Rouvert plus tard (une autre semaine, d'autres séances depuis) : même jalon.
    vi.setSystemTime(new Date(2026, 11, 20, 12, 0));
    renderAt('#/resume/s10', stateWith([...many, session('dec', 10, { month: 12 })], { weeklyGoalAsked: true }));
    expect(lines()).toEqual(['10ᵉ séance enregistrée.']);
    cleanup();
    renderAt('#/resume/s11', state);
    expect(lines()).toEqual([]);
  });

  it('séance sans série validée : ni ligne de semaine ni jalon', () => {
    renderAt('#/resume/vide', stateWith([session('vide', 27, { done: false })], { weeklyGoal: 3 }));
    expect(document.querySelector('.summary-rhythm')).toBeNull();
  });

  it('pas de « ! », pas d’icône ; « Voir mes progrès » reste la seule action accent', () => {
    renderAt('#/resume/a', stateWith([session('a', 26)], { weeklyGoal: 3 }));
    const block = document.querySelector('.summary-rhythm')!;
    expect(plain(block)).not.toContain('!');
    expect(block.querySelector('svg, img')).toBeNull();
    expect(accentButtons()).toEqual(['Voir mes progrès']);
  });
});

describe('Réglages : objectif par semaine (critères 22, 23, 25)', () => {
  const group = () => screen.getByRole('radiogroup', { name: 'Objectif par semaine' });

  it('7 choix, « Aucun » coché par défaut, choix enregistré au tap et conservé au rechargement', () => {
    const { saved } = renderAt('#/reglages', stateWith([]));
    const radios = within(group()).getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['Aucun', '1', '2', '3', '4', '5', '6']);
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Aucun objectif',
      '1 séance par semaine',
      ...[2, 3, 4, 5, 6].map((n) => `${n} séances par semaine`),
    ]);
    expect(screen.getByRole('radio', { name: 'Aucun objectif' })).toHaveAttribute('aria-checked', 'true');
    expect(group()).toHaveAccessibleDescription(
      'Un repère pour toi, que tu changes quand tu veux. Une semaine en dessous ne laisse aucune trace.',
    );

    fireEvent.click(screen.getByRole('radio', { name: '4 séances par semaine' }));
    expect(saved().settings).toEqual({ weeklyGoal: 4, weeklyGoalAsked: true });
    const after = saved();
    cleanup();
    renderAt('#/reglages', after);
    expect(screen.getByRole('radio', { name: '4 séances par semaine' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Aucun objectif' })).toHaveAttribute('aria-checked', 'false');
  });

  it('« Aucun » retire l’objectif ; le suggestLoad existant n’est pas touché', () => {
    const { saved } = renderAt('#/reglages', stateWith([], { suggestLoad: false, weeklyGoal: 2, weeklyGoalAsked: true }));
    fireEvent.click(screen.getByRole('radio', { name: 'Aucun objectif' }));
    expect(saved().settings).toEqual({ suggestLoad: false, weeklyGoalAsked: true });
  });

  it('navigation au clavier : flèches gauche / droite, un seul arrêt de tabulation', () => {
    const { saved } = renderAt('#/reglages', stateWith([], { weeklyGoal: 3, weeklyGoalAsked: true }));
    const three = screen.getByRole('radio', { name: '3 séances par semaine' });
    expect(within(group()).getAllByRole('radio').filter((r) => r.tabIndex === 0)).toEqual([three]);
    three.focus();
    fireEvent.keyDown(three, { key: 'ArrowRight' });
    expect(saved().settings?.weeklyGoal).toBe(4);
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: '4 séances par semaine' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Aucun objectif' }));
    expect(saved().settings).not.toHaveProperty('weeklyGoal');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(saved().settings?.weeklyGoal).toBe(6);
  });

  it('pastille choisie remplie en encre, jamais en accent', () => {
    renderAt('#/reglages', stateWith([], { weeklyGoal: 3, weeklyGoalAsked: true }));
    for (const r of within(group()).getAllByRole('radio')) {
      expect(r.className).toBe('goal-chip');
    }
  });

  it('réinitialisation : objectif « Aucun » et proposition de nouveau possible', () => {
    const { saved } = renderAt('#/reglages', stateWith([session('a', 26), session('b', 27)], { weeklyGoal: 3, weeklyGoalAsked: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser toutes les données' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tout effacer' }));
    expect(saved().settings).toBeUndefined();
    expect(screen.getByRole('radio', { name: 'Aucun objectif' })).toHaveAttribute('aria-checked', 'true');
  });
});
