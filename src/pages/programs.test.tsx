import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { TOAST_DURATION_MS } from '../components/Toast';
import { STORAGE_KEY, createDefaultState, type StorageLike } from '../lib/storage';
import { createTemplate, createTemplateExercise } from '../lib/templates';
import type { AppState, WorkoutSession } from '../lib/types';
import { AppStoreProvider } from '../state/AppStore';

/** Lot 2 : programmes de départ (docs/product/lot2-programmes.md). */

function renderApp(initial?: AppState) {
  const data: Record<string, string> = initial ? { [STORAGE_KEY]: JSON.stringify(initial) } : {};
  const storage: StorageLike = {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
  const saved = (): AppState => JSON.parse(data[STORAGE_KEY] ?? JSON.stringify(initial ?? createDefaultState()));
  render(
    <AppStoreProvider storage={storage}>
      <App />
    </AppStoreProvider>,
  );
  return { saved };
}

const T0 = new Date('2026-10-01T10:00:00Z');

function stateWith(...names: string[]): AppState {
  const s = createDefaultState();
  names.forEach((name, i) =>
    s.templates.push(createTemplate({ name, exercises: [createTemplateExercise('squat')] }, T0, `t${i + 1}`)),
  );
  return s;
}

/** Séance passée de Squat (3 × 8 à 20 kg) rattachée à `templateId`. */
function pastSession(templateId: string, name: string): WorkoutSession {
  return {
    id: `h-${templateId}`,
    templateId,
    name,
    startedAt: '2026-10-20T10:00:00.000Z',
    endedAt: '2026-10-20T11:00:00.000Z',
    exercises: [{ exerciseId: 'squat', sets: [1, 2, 3].map(() => ({ weight: 20, reps: 8, done: true })) }],
  };
}

const accents = () => [...document.querySelectorAll<HTMLElement>('.btn--primary')];
const toastEl = () => document.querySelector<HTMLElement>('.toast');
const radios = () => screen.getAllByRole('radio');
const addButton = () => screen.getByRole('button', { name: 'Ajouter ce programme' });
const unavailableButton = () => screen.getByRole('button', { name: 'Choisis un programme ci-dessus' });
const cardNames = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
const currentSet = () => document.querySelector<HTMLElement>('[aria-current="step"]')!;

function openPrograms() {
  fireEvent.click(screen.getByRole('link', { name: /Choisir un programme|Ajouter un programme de départ/ }));
}

function addProgram(name: string) {
  fireEvent.click(screen.getByRole('radio', { name }));
  fireEvent.click(addButton());
}

beforeEach(() => {
  window.location.hash = '';
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('lot 2 — parcours en 5 taps (§8)', () => {
  it('stockage vide → première série de Squat validée à 20 kg × 8, sans clavier', () => {
    const { saved } = renderApp();
    let taps = 0;
    const tap = (el: HTMLElement) => {
      taps++;
      fireEvent.click(el);
    };

    // Tap 0 : état vide, un seul accent
    expect(screen.getByText('Aucune séance pour l’instant.')).toBeInTheDocument();
    expect(screen.getByText('Commence avec un programme ou crée la tienne.')).toBeInTheDocument();
    expect(accents()).toHaveLength(1);

    // Tap 1 : « Choisir un programme »
    tap(screen.getByRole('link', { name: 'Choisir un programme' }));
    expect(window.location.hash).toBe('#/seances/programmes');
    expect(radios()).toHaveLength(3);
    for (const r of radios()) expect(r).toHaveAttribute('aria-checked', 'false');
    expect(unavailableButton()).toHaveAttribute('aria-disabled', 'true');

    // Tap 2 : carte « Full body »
    tap(screen.getByRole('radio', { name: 'Full body' }));
    expect(screen.getByRole('radio', { name: 'Full body' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Full body' })).toHaveTextContent('Choisi');
    expect(addButton()).toBeEnabled();
    expect(addButton()).not.toHaveAttribute('aria-disabled');

    // Tap 3 : « Ajouter ce programme »
    tap(addButton());
    expect(window.location.hash).toBe('#/seances');
    expect(toastEl()).toHaveTextContent('Programme ajouté : Full body (2 séances).');
    const first = screen.getAllByRole('listitem')[0];
    expect(within(first).getByRole('heading')).toHaveTextContent('Full body A');
    expect(within(first).getByText('Suggérée')).toBeInTheDocument();

    // Tap 4 : « Démarrer la séance » (Full body A)
    tap(screen.getByRole('button', { name: 'Démarrer la séance Full body A' }));
    expect(window.location.hash).toBe('#/seance');
    expect(screen.getByText('Exercice 1 sur 4')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Squat' })).toBeInTheDocument();
    expect(screen.getByLabelText('Charge (kg)')).toHaveValue('20');
    expect(screen.getByLabelText('Reps')).toHaveValue('8');
    expect(currentSet()).toHaveTextContent('Première fois : la barre seule (20 kg) × 8. Ajuste si besoin.');
    // Pas de charge proposée la première fois (aucun historique).
    expect(screen.queryByText(/Charge proposée/)).not.toBeInTheDocument();
    expect(toastEl()).toBeNull();

    // Tap 5 : « Valider la série »
    tap(screen.getByRole('button', { name: 'Valider la série' }));
    expect(screen.getByText('Série 1 validée. Repos : 120 s.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Passer' })).toBeInTheDocument();

    expect(taps).toBe(5);
    const active = saved().activeSession!;
    expect(active.name).toBe('Full body A');
    expect(active.exercises[0]).toMatchObject({ exerciseId: 'squat' });
    expect(active.exercises[0].sets[0]).toEqual({ weight: 20, reps: 8, done: true });
  });
});

describe('lot 2 — écran Séances', () => {
  it('état vide : « Choisir un programme » seul en accent, puis Créer / Séance libre en secondaire, pas de lien « Ajouter… »', () => {
    renderApp();
    const choose = screen.getByRole('link', { name: 'Choisir un programme' });
    expect(choose).toHaveClass('btn--primary', 'btn--lg', 'btn--block');
    expect(accents()).toEqual([choose]);
    expect(screen.getByRole('link', { name: 'Créer une séance' })).not.toHaveClass('btn--primary');
    expect(screen.getByRole('button', { name: 'Séance libre' })).not.toHaveClass('btn--primary');
    expect(screen.queryByRole('link', { name: 'Ajouter un programme de départ' })).not.toBeInTheDocument();
    // Ordre : Choisir, puis Créer, puis Séance libre
    const order = [choose, screen.getByRole('link', { name: 'Créer une séance' }), screen.getByRole('button', { name: 'Séance libre' })];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('état vide avec un historique : même écran', () => {
    const s = createDefaultState();
    s.sessions.push(pastSession('gone', 'Ancienne'));
    renderApp(s);
    expect(screen.getByText('Commence avec un programme ou crée la tienne.')).toBeInTheDocument();
    expect(accents().map((a) => a.textContent)).toEqual(['Choisir un programme']);
  });

  it('liste non vide : « Ajouter un programme de départ » secondaire, ouvre /seances/programmes', () => {
    renderApp(stateWith('Jambes'));
    const link = screen.getByRole('link', { name: 'Ajouter un programme de départ' });
    expect(link).not.toHaveClass('btn--primary');
    expect(link).toHaveClass('btn', 'btn--block');
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('link', { name: 'Choisir un programme' })).not.toBeInTheDocument();
    fireEvent.click(link);
    expect(window.location.hash).toBe('#/seances/programmes');
    expect(screen.getByRole('heading', { level: 1, name: 'Programmes de départ' })).toBeInTheDocument();
  });
});

describe('lot 2 — écran Programmes de départ', () => {
  it('route dédiée (pas une séance type « programmes »), textes exacts, pas d’en-tête de marque ni d’onglets', () => {
    window.location.hash = '#/seances/programmes';
    renderApp();
    expect(screen.getByRole('heading', { level: 1, name: 'Programmes de départ' })).toBeInTheDocument();
    expect(screen.queryByText('Séance type introuvable')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(document.querySelector('.brand-header')).toBeNull();
    // Intro révisée le 29/10 : la règle des charges (« barre seule ») est au-dessus des cartes.
    expect(document.querySelector('.programs__intro')?.textContent).toBe(
      'Choisis un programme. Ses séances s’ajoutent à ta liste, et tu pourras les modifier. Les charges partent de la barre seule (20\u00a0kg)\u202f; l’app te propose +2,5\u00a0kg quand tu réussis toutes tes séries.',
    );

    const group = screen.getByRole('radiogroup', { name: 'Programmes de départ' });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect(within(group).getAllByRole('radio').map((r) => within(r).getByText(/^(Full body|Haut \/ Bas|Poids du corps)$/).textContent)).toEqual([
      'Full body',
      'Haut / Bas',
      'Poids du corps',
    ]);

    const full = screen.getByRole('radio', { name: 'Full body' });
    expect(full).toHaveTextContent('2 à 3 séances par semaine, en alternant A et B. Idéal pour commencer.');
    expect(full).toHaveTextContent('Full body A · ≈ 30 min');
    expect(full).toHaveTextContent('Squat · Développé couché · Rowing barre · Crunch');
    expect(full).toHaveTextContent('Full body B · ≈ 30 min');
    expect(full).toHaveTextContent('Soulevé de terre roumain · Développé militaire · Tractions · Fentes');
    const upper = screen.getByRole('radio', { name: 'Haut / Bas' });
    expect(upper).toHaveTextContent('4 séances par semaine, en alternant les deux. Pour aller plus loin.');
    expect(upper).toHaveTextContent('Haut du corps · ≈ 40 min');
    expect(upper).toHaveTextContent('Développé couché · Rowing barre · Développé militaire · Tractions · Dips');
    expect(upper).toHaveTextContent('Bas du corps · ≈ 40 min');
    expect(upper).toHaveTextContent('Squat · Soulevé de terre roumain · Hip thrust · Fentes · Mollets debout');
    const bw = screen.getByRole('radio', { name: 'Poids du corps' });
    expect(bw).toHaveTextContent('Sans charge, à la maison ou au parc. Il te faut une barre de traction.');
    expect(bw).toHaveTextContent('Poids du corps · ≈ 35 min');
    expect(bw).toHaveTextContent('Pompes · Fentes · Dips · Tractions · Relevé de jambes');
    expect(screen.queryByText('Déjà dans tes séances.')).not.toBeInTheDocument();

    // La note sous les cartes est retirée (redondante avec l'intro).
    expect(screen.queryByText(/Les charges de départ sont légères/)).not.toBeInTheDocument();
    // « Pour qui » en texte secondaire, sous le nom.
    expect(full.querySelector('.program-card__audience')).toHaveClass('muted');
  });

  it('sélection : rien par défaut, une seule carte choisie, re-tap sans effet ; seul accent = « Ajouter ce programme »', () => {
    window.location.hash = '#/seances/programmes';
    renderApp();
    expect(screen.queryByText('Choisi')).not.toBeInTheDocument();
    // Rien de choisi : aucun aplat accent sur l'écran.
    expect(accents()).toEqual([]);

    fireEvent.click(screen.getByRole('radio', { name: 'Haut / Bas' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Full body' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Full body' }));
    expect(radios().map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(screen.getAllByText('Choisi')).toHaveLength(1);
    const full = screen.getByRole('radio', { name: 'Full body' });
    expect(full).toHaveClass('program-card--checked');
    expect(full.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(addButton()).toBeEnabled();
    // Aucune carte n'emprunte l'accent, choisie ou non.
    for (const r of radios()) {
      expect(r.className).not.toMatch(/primary|accent/);
      expect(r.querySelector('.btn--primary')).toBeNull();
    }
    expect(accents()).toEqual([addButton()]);
  });

  it('flèches du clavier : le choix se déplace dans le groupe', () => {
    window.location.hash = '#/seances/programmes';
    renderApp();
    expect(radios().map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    fireEvent.keyDown(radios()[0], { key: 'ArrowDown' });
    expect(radios()[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
    fireEvent.keyDown(radios()[1], { key: 'ArrowUp' });
    fireEvent.keyDown(radios()[0], { key: 'ArrowUp' });
    expect(radios()[2]).toHaveAttribute('aria-checked', 'true');
    // Début et Fin
    fireEvent.keyDown(radios()[2], { key: 'Home' });
    expect(radios()[0]).toHaveAttribute('aria-checked', 'true');
    expect(radios()[0]).toHaveFocus();
    fireEvent.keyDown(radios()[0], { key: 'End' });
    expect(radios()[2]).toHaveAttribute('aria-checked', 'true');
    expect(radios()[2]).toHaveFocus();
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, -1, 0]);
  });

  it('bouton indisponible : sans accent, dit ce qui manque, focalisable ; un tap mène à la première carte sans rien créer', () => {
    const { saved } = renderApp(stateWith('Jambes'));
    openPrograms();
    const button = unavailableButton();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(button).not.toHaveClass('btn--primary');
    expect(button).toHaveClass('btn', 'btn--lg', 'btn--block', 'btn--unavailable');
    expect(screen.queryByRole('button', { name: 'Ajouter ce programme' })).not.toBeInTheDocument();

    const scroll = vi.mocked(Element.prototype.scrollIntoView);
    scroll.mockClear();
    fireEvent.click(button);
    expect(radios()[0]).toHaveFocus();
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0]).toBe(radios()[0]);
    expect(scroll.mock.calls[0][0]).toMatchObject({ block: 'center' });
    expect(window.location.hash).toBe('#/seances/programmes');
    expect(saved().templates.map((t) => t.name)).toEqual(['Jambes']);
    expect(toastEl()).toBeNull();

    fireEvent.click(radios()[0]);
    expect(accents()).toEqual([addButton()]);
    expect(addButton()).toHaveClass('btn--primary');
  });

  it('« Retour aux séances » ramène à /seances sans rien créer', () => {
    const { saved } = renderApp(stateWith('Jambes'));
    openPrograms();
    fireEvent.click(screen.getByRole('radio', { name: 'Full body' }));
    const back = screen.getByRole('link', { name: 'Retour aux séances' });
    expect(back).toHaveClass('back-link');
    fireEvent.click(back);
    expect(window.location.hash).toBe('#/seances');
    expect(saved().templates.map((t) => t.name)).toEqual(['Jambes']);
    expect(toastEl()).toBeNull();
  });
});

describe('lot 2 — ajout et annulation', () => {
  it('ajoute à la fin sans toucher à l’existant ; toast 5 s ; retour arrière ne ramène pas au choix', () => {
    vi.useFakeTimers({ shouldAdvanceTime: false, toFake: ['setTimeout', 'clearTimeout'] });
    const initial = stateWith('Jambes');
    const { saved } = renderApp(initial);
    openPrograms();
    addProgram('Full body');
    expect(saved().templates.map((t) => t.name)).toEqual(['Jambes', 'Full body A', 'Full body B']);
    expect(saved().templates[0]).toEqual(initial.templates[0]);
    expect(saved().templates[1].exercises[0]).toEqual({ exerciseId: 'squat', targetSets: 3, targetReps: 8, targetWeight: 20, restSeconds: 120 });
    const toast = toastEl()!;
    expect(toast).toHaveTextContent('Programme ajouté : Full body (2 séances).');
    expect(toast.textContent).toContain('ajouté : Full body (2 séances).');
    expect(within(toast).getByRole('button', { name: 'Annuler l’ajout du programme' })).toHaveTextContent('Annuler');
    // Toast flottant au-dessus de la barre d'onglets
    expect(document.querySelector('.toast-region')).toHaveClass('toast-region--floating', 'toast-region--above-tabbar');

    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS);
    });
    expect(toastEl()).toBeNull();
    expect(saved().templates).toHaveLength(3);

    // replace: true → l'entrée /seances/programmes a été remplacée.
    act(() => {
      window.history.back();
    });
    expect(window.location.hash).not.toBe('#/seances/programmes');
  });

  it('tap rapide en double : une seule création', () => {
    const { saved } = renderApp();
    openPrograms();
    fireEvent.click(screen.getByRole('radio', { name: 'Full body' }));
    const button = addButton();
    fireEvent.click(button);
    fireEvent.click(button);
    expect(saved().templates.map((t) => t.name)).toEqual(['Full body A', 'Full body B']);
  });

  it('Poids du corps : « (1 séance) »', () => {
    renderApp();
    openPrograms();
    addProgram('Poids du corps');
    expect(toastEl()).toHaveTextContent('Programme ajouté : Poids du corps (1 séance).');
  });

  it('« Annuler » retire exactement les séances créées (y compris retour à l’état vide), sans second toast', () => {
    const initial = stateWith('Jambes');
    const { saved } = renderApp(initial);
    openPrograms();
    addProgram('Haut / Bas');
    expect(saved().templates).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Annuler l’ajout du programme' }));
    expect(saved().templates).toEqual(initial.templates);
    expect(toastEl()).toBeNull();
    expect(cardNames()).toEqual(['Jambes']);
  });

  it('« Annuler » depuis le stockage vide → état vide de nouveau', () => {
    const { saved } = renderApp();
    openPrograms();
    addProgram('Full body');
    fireEvent.click(screen.getByRole('button', { name: 'Annuler l’ajout du programme' }));
    expect(saved().templates).toEqual([]);
    expect(screen.getByText('Commence avec un programme ou crée la tienne.')).toBeInTheDocument();
  });

  it('démarrer une séance ferme le toast : l’ajout reste', () => {
    const { saved } = renderApp(stateWith('Jambes'));
    openPrograms();
    addProgram('Full body');
    expect(toastEl()).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Full body B' }));
    expect(window.location.hash).toBe('#/seance');
    expect(toastEl()).toBeNull();
    expect(saved().templates.map((t) => t.name)).toEqual(['Jambes', 'Full body A', 'Full body B']);
    expect(saved().activeSession?.name).toBe('Full body B');
  });

  it('séance libre aussi : le toast se ferme', () => {
    renderApp();
    openPrograms();
    addProgram('Full body');
    fireEvent.click(screen.getByRole('button', { name: 'Séance libre' }));
    expect(toastEl()).toBeNull();
  });

  it('bug du 29/10 : Historique puis retour Séances, « Démarrer » ferme quand même le toast ; « Annuler » ne touche pas la séance en cours', () => {
    const { saved } = renderApp();
    openPrograms();
    addProgram('Full body');
    expect(toastEl()).toHaveTextContent('Programme ajouté : Full body (2 séances).');
    // Onglet Historique, puis retour à Séances par l'onglet (nouvel état de navigation).
    fireEvent.click(screen.getByRole('link', { name: 'Historique' }));
    expect(window.location.hash).toBe('#/historique');
    fireEvent.click(screen.getByRole('link', { name: 'Séances' }));
    expect(window.location.hash).toBe('#/seances');
    expect(toastEl()).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Full body A' }));
    expect(window.location.hash).toBe('#/seance');
    expect(toastEl()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Annuler l’ajout du programme' })).not.toBeInTheDocument();
    expect(saved().templates.map((t) => t.name)).toEqual(['Full body A', 'Full body B']);
    expect(saved().activeSession?.templateId).toBe(saved().templates[0].id);
  });

  it('reprise d’une séance en cours (bannière) : le toast d’ajout se ferme aussi', () => {
    const s = stateWith('Jambes');
    s.activeSession = { id: 'a1', name: 'Séance libre', startedAt: T0.toISOString(), exercises: [] };
    const { saved } = renderApp(s);
    openPrograms();
    addProgram('Full body');
    expect(toastEl()).not.toBeNull();
    fireEvent.click(screen.getByRole('link', { name: /Séance en cours/ }));
    expect(window.location.hash).toBe('#/seance');
    expect(toastEl()).toBeNull();
    expect(saved().templates).toHaveLength(3);
  });

  it('les autres toasts (suppression) ne se ferment pas au démarrage d’une séance', () => {
    renderApp(stateWith('Jambes', 'Pecs'));
    fireEvent.click(screen.getByRole('button', { name: 'Options de Pecs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Jambes' }));
    expect(toastEl()).toHaveTextContent('Séance supprimée : Pecs.');
  });

  it('liste existante : après l’ajout, la première séance créée défile au centre (une seule fois)', () => {
    renderApp(stateWith('Jambes', 'Pecs', 'Dos', 'Bras'));
    openPrograms();
    fireEvent.click(screen.getByRole('radio', { name: 'Full body' }));
    const scroll = vi.mocked(Element.prototype.scrollIntoView);
    scroll.mockClear();
    vi.mocked(window.scrollTo).mockClear();
    fireEvent.click(addButton());
    expect(scroll).toHaveBeenCalledTimes(1);
    const target = scroll.mock.contexts[0] as HTMLElement;
    expect(within(target).getByRole('heading')).toHaveTextContent('Full body A');
    expect(scroll.mock.calls[0][0]).toMatchObject({ block: 'center' });
    // Le retour en haut (App) passe avant.
    expect(vi.mocked(window.scrollTo).mock.invocationCallOrder[0]).toBeLessThan(scroll.mock.invocationCallOrder[0]);
    // L'état de navigation est vidé : pas de second défilement.
    fireEvent.click(screen.getByRole('link', { name: 'Historique' }));
    fireEvent.click(screen.getByRole('link', { name: 'Séances' }));
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it('liste vide : pas de défilement (la séance créée est déjà en tête)', () => {
    renderApp();
    openPrograms();
    fireEvent.click(screen.getByRole('radio', { name: 'Full body' }));
    const scroll = vi.mocked(Element.prototype.scrollIntoView);
    scroll.mockClear();
    fireEvent.click(addButton());
    expect(scroll).not.toHaveBeenCalled();
  });

  it('avec un historique, la suggestion reste celle d’avant', () => {
    const s = stateWith('Jambes');
    s.sessions.push(pastSession('t1', 'Jambes'));
    renderApp(s);
    openPrograms();
    addProgram('Full body');
    const first = screen.getAllByRole('listitem')[0];
    expect(within(first).getByRole('heading')).toHaveTextContent('Jambes');
    expect(within(first).getByText('Suggérée')).toBeInTheDocument();
    expect(accents().map((a) => a.getAttribute('aria-label'))).toEqual(['Démarrer la séance Jambes']);
  });

  it('doublons : « (2) » puis « (3) » ; « Déjà dans tes séances. » dès le premier ajout', () => {
    const { saved } = renderApp();
    openPrograms();
    addProgram('Full body');
    openPrograms();
    expect(within(screen.getByRole('radio', { name: 'Full body' })).getByText('Déjà dans tes séances.')).toBeInTheDocument();
    expect(screen.getAllByText('Déjà dans tes séances.')).toHaveLength(1);
    addProgram('Full body');
    openPrograms();
    addProgram('Full body');
    expect(saved().templates.map((t) => t.name)).toEqual([
      'Full body A',
      'Full body B',
      'Full body A (2)',
      'Full body B (2)',
      'Full body A (3)',
      'Full body B (3)',
    ]);
  });

  it('séance en cours : l’ajout fonctionne, « Démarrer » ouvre ensuite la boîte « déjà en cours »', () => {
    const s = stateWith('Jambes');
    s.activeSession = { id: 'a1', name: 'Séance libre', startedAt: T0.toISOString(), exercises: [] };
    const { saved } = renderApp(s);
    openPrograms();
    addProgram('Poids du corps');
    expect(saved().templates.map((t) => t.name)).toEqual(['Jambes', 'Poids du corps']);
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Poids du corps' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Une séance est déjà en cours');
  });

  it('séance type issue d’un programme : se modifie, se duplique et se supprime comme les autres', () => {
    const { saved } = renderApp();
    openPrograms();
    addProgram('Full body');
    fireEvent.click(screen.getByRole('button', { name: 'Options de Full body A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dupliquer' }));
    expect(saved().templates.map((t) => t.name)).toContain('Full body A (copie)');

    fireEvent.click(screen.getByRole('button', { name: 'Options de Full body B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    expect(screen.getByRole('heading', { name: 'Modifier la séance type' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Nom' }), { target: { value: 'Jeudi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la séance' }));
    expect(saved().templates.map((t) => t.name)).toContain('Jeudi');

    fireEvent.click(screen.getByRole('button', { name: 'Options de Full body A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(toastEl()).toHaveTextContent('Séance supprimée : Full body A.');
    expect(saved().templates.map((t) => t.name)).toEqual(['Jeudi', 'Full body A (copie)']);
  });
});

describe('lot 2 — « Première fois » en séance (§7)', () => {
  it('poids du corps : « Première fois : 10 reps. Ajuste si besoin. » en série 1 seulement, puis « Objectif : … »', () => {
    renderApp();
    openPrograms();
    addProgram('Poids du corps');
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Poids du corps' }));
    expect(screen.getByRole('heading', { name: 'Pompes' })).toBeInTheDocument();
    expect(currentSet().textContent).toContain('Première fois : 10 reps. Ajuste si besoin.');
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    // Série 2 en cours : « Première fois » n'est plus vrai pour cet exercice.
    expect(currentSet()).toHaveTextContent('Série 2 sur 3');
    expect(currentSet()).toHaveTextContent('Objectif : 10 reps');
    expect(currentSet()).not.toHaveTextContent('Première fois');
  });

  it('à la barre : « la barre seule (20 kg) » en série 1, puis « Objectif : 20 kg × 8 » en série 2', () => {
    renderApp();
    openPrograms();
    addProgram('Full body');
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Full body A' }));
    expect(currentSet()).toHaveTextContent('Série 1 sur 3');
    expect(currentSet().textContent).toContain('Première fois : la barre seule (20 kg) × 8. Ajuste si besoin.');
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    expect(currentSet()).toHaveTextContent('Série 2 sur 3');
    expect(currentSet()).toHaveTextContent('Objectif : 20 kg × 8');
    expect(currentSet()).not.toHaveTextContent('Première fois');
  });

  it('autre charge (séance type perso) : « Première fois : vise 60 kg × 8. Ajuste si besoin. »', () => {
    const s = createDefaultState();
    s.templates.push(
      createTemplate(
        { name: 'Jambes', exercises: [{ ...createTemplateExercise('squat'), targetWeight: 60, targetReps: 8 }] },
        T0,
        't1',
      ),
    );
    renderApp(s);
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Jambes' }));
    expect(currentSet()).toHaveTextContent('Première fois : vise 60 kg × 8. Ajuste si besoin.');
  });

  it('série corrigée (non en cours) : « Objectif : … »', () => {
    renderApp();
    openPrograms();
    addProgram('Full body');
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Full body A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    fireEvent.click(screen.getByRole('button', { name: /Corriger la série 1/ }));
    expect(currentSet()).toHaveTextContent('En correction');
    expect(currentSet()).toHaveTextContent('Objectif : 20 kg × 8');
  });

  it('avec un historique : « Dernière fois : … »', () => {
    const s = stateWith('Jambes');
    s.sessions.push(pastSession('t1', 'Jambes'));
    s.settings = { suggestLoad: false };
    renderApp(s);
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Jambes' }));
    expect(currentSet()).toHaveTextContent('Dernière fois : 20 kg × 8');
    expect(currentSet()).not.toHaveTextContent('Première fois');
  });

  it('séance libre : aucune ligne de référence', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Séance libre' }));
    expect(document.querySelector('.set-current__ref')).toBeNull();
  });
});
