import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { TOAST_DURATION_MS } from '../components/Toast';
import { STORAGE_KEY, createDefaultState, exportState, validateImport, type StorageLike } from '../lib/storage';
import { createTemplate, createTemplateExercise } from '../lib/templates';
import type { AppState, SetEntry, WorkoutSession } from '../lib/types';
import { AppStoreProvider } from '../state/AppStore';

/** Lot 6 : revenir aux exercices sautés, note par exercice. */

function memoryStorage(initial?: AppState) {
  const data: Record<string, string> = initial ? { [STORAGE_KEY]: JSON.stringify(initial) } : {};
  const storage: StorageLike = {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
  const saved = (): AppState => JSON.parse(data[STORAGE_KEY]);
  return { storage, saved };
}

function renderAt(hash: string, initial?: AppState) {
  window.location.hash = hash;
  const mem = memoryStorage(initial);
  const { unmount } = render(
    <AppStoreProvider storage={mem.storage}>
      <App />
    </AppStoreProvider>,
  );
  return { ...mem, unmount };
}

const done = (weight: number, reps: number): SetEntry => ({ weight, reps, done: true });
const todo = (weight: number, reps: number): SetEntry => ({ weight, reps, done: false });

/** Séance type « Haut » : développé couché, développé incliné, curl haltères (2 séries chacun). */
function stateWithThree(): AppState {
  const s = createDefaultState();
  s.templates.push(
    createTemplate(
      {
        name: 'Haut',
        exercises: ['developpe-couche', 'developpe-incline', 'curl-halteres'].map((id) => ({
          ...createTemplateExercise(id),
          targetSets: 2,
        })),
      },
      new Date('2026-10-01T10:00:00Z'),
      't3',
    ),
  );
  s.templates.push(
    createTemplate({ name: 'Jambes', exercises: [createTemplateExercise('squat')] }, new Date('2026-10-01T10:00:00Z'), 'tj'),
  );
  return s;
}

/** Séance en cours (déjà démarrée) sur des exercices donnés. */
function withActive(exercises: WorkoutSession['exercises'], current = 0, base = createDefaultState()): AppState {
  base.activeSession = {
    id: 'a',
    name: 'Séance',
    startedAt: new Date().toISOString(),
    currentExerciseIndex: current,
    exercises,
  };
  return base;
}

const primary = () => {
  const el = document.querySelector<HTMLButtonElement>('.session-dock .btn--primary');
  if (!el) throw new Error('Pas de bouton principal');
  return el;
};
const dialog = () => within(screen.getByRole('dialog'));
const validate = (times = 1) => {
  for (let i = 0; i < times; i++) fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
};
const openMenu = (name: string) => fireEvent.click(screen.getByRole('button', { name: `Options de ${name}` }));
const noteEl = () => document.querySelector<HTMLElement>('.exercise-note');
const toastEl = () => document.querySelector<HTMLElement>('.toast');

beforeEach(() => {
  window.location.hash = '';
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('lot 6 — revenir aux exercices sautés', () => {
  it('critère 4 : « Suivant » sur l’exercice 1, 2 et 3 validés → « Reprendre l’exercice 1 », puis Terminer', () => {
    renderAt('', stateWithThree());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Haut' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exercice suivant : Développé incliné' }));
    validate(2);
    expect(screen.getByText('Exercice 3 sur 3')).toBeInTheDocument();
    validate(2);
    // L'écran reste sur l'exercice 3 (aucun exercice en attente plus loin).
    expect(screen.getByText('Exercice 3 sur 3')).toBeInTheDocument();
    expect(screen.getByText(/^Exercice terminé : curl haltères\. Repos : 90\ss\.$/)).toBeInTheDocument();
    const resume = screen.getByRole('button', { name: /^Reprendre l’exercice 1\s:\sdéveloppé couché$/ });
    expect(resume).toBe(primary());
    expect(resume).toHaveTextContent(/^Reprendre l’exercice 1$/);
    // « Terminer la séance » reste disponible en secondaire, dans l'en-tête.
    expect(screen.getByRole('button', { name: 'Terminer la séance' })).not.toHaveClass('btn--primary');
    // Un seul aplat accent à l'écran.
    expect(document.querySelectorAll('.btn--primary')).toHaveLength(1);

    fireEvent.click(resume);
    expect(screen.getByText('Exercice 1 sur 3')).toBeInTheDocument();
    expect(document.querySelector('.session-exercise--prev')).not.toBeNull();
    expect(primary()).toHaveTextContent('Valider la série');
    validate(2);
    // Toutes les séries validées : « Terminer la séance » devient le principal, sans changer d'exercice.
    expect(screen.getByText('Exercice 1 sur 3')).toBeInTheDocument();
    const finish = screen.getAllByRole('button', { name: 'Terminer la séance' });
    expect(finish).toHaveLength(1);
    expect(finish[0]).toBe(primary());
  });

  it('critère 5 : tout validé puis « Précédent » jusqu’à l’exercice 1 → « Terminer la séance »', () => {
    renderAt('', stateWithThree());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Haut' }));
    validate(6);
    expect(screen.getByText('Exercice 3 sur 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Exercice précédent/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Exercice précédent/ }));
    expect(screen.getByText('Exercice 1 sur 3')).toBeInTheDocument();
    expect(primary()).toHaveTextContent('Terminer la séance');
    expect(screen.getAllByRole('button', { name: 'Terminer la séance' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Exercice suivant' })).not.toBeInTheDocument();
  });

  it('exercices 2 et 4 sautés, sur le 3 : passage au 4, puis « Reprendre l’exercice 2 » ; « Suivant » reste visible', () => {
    const ex = (id: string, pending: boolean) => ({ exerciseId: id, sets: [pending ? todo(10, 10) : done(10, 10)] });
    renderAt(
      '#/seance',
      withActive(
        [
          ex('squat', false),
          ex('developpe-incline', true),
          ex('dips', true),
          ex('tractions', true),
          ex('crunch', false),
        ],
        2,
      ),
    );
    validate();
    expect(screen.getByText('Exercice 4 sur 5')).toBeInTheDocument();
    validate();
    expect(screen.getByText('Exercice 4 sur 5')).toBeInTheDocument();
    expect(primary()).toHaveAccessibleName(/^Reprendre l’exercice 2\s:\sdéveloppé incliné$/);
    expect(screen.getByRole('button', { name: 'Exercice suivant : Crunch' })).toHaveTextContent('Suivant');
  });

  it('exercice sans série : jamais proposé par « Reprendre »', () => {
    renderAt('#/seance', withActive([{ exerciseId: 'squat', sets: [] }, { exerciseId: 'dips', sets: [todo(0, 10)] }], 1));
    validate();
    expect(primary()).toHaveTextContent('Terminer la séance');
  });

  it('critère 6 : message de fin qui nomme l’exercice en attente', () => {
    renderAt(
      '#/seance',
      withActive([
        { exerciseId: 'developpe-couche', sets: [done(60, 10), todo(60, 10)] },
        { exerciseId: 'developpe-incline', sets: [todo(40, 10), todo(40, 10), todo(40, 10)] },
      ]),
    );
    validate();
    expect(screen.getByText('Exercice 2 sur 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    expect(dialog().getByText('Il reste 3 séries non validées, en développé incliné. Terminer quand même ?')).toBeInTheDocument();
    fireEvent.click(dialog().getByRole('button', { name: 'Continuer' }));
  });

  it('exercice en attente retiré : absent du message de fin ; « Annuler » le remet', () => {
    renderAt(
      '#/seance',
      withActive([
        { exerciseId: 'squat', sets: [done(100, 5)] },
        { exerciseId: 'dips', sets: [todo(0, 10)] },
        { exerciseId: 'crunch', sets: [todo(0, 10)] },
      ], 1),
    );
    openMenu('Dips');
    fireEvent.click(screen.getByRole('button', { name: 'Retirer cet exercice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    expect(dialog().getByText('Il reste 1 série non validée, en crunch. Terminer quand même ?')).toBeInTheDocument();
    fireEvent.click(dialog().getByRole('button', { name: 'Continuer' }));
    fireEvent.click(within(toastEl()!).getByRole('button', { name: 'Annuler la suppression' }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    expect(dialog().getByText('Il reste 2 séries non validées, en dips et crunch. Terminer quand même ?')).toBeInTheDocument();
  });

  it('même exercice deux fois en attente : nommé une seule fois ; deux exercices au même nom restent deux', () => {
    const base = createDefaultState();
    base.exercises.push({ id: 'custom-squat', name: 'Squat', muscleGroup: 'Jambes', isCustom: true });
    renderAt(
      '#/seance',
      withActive(
        [
          { exerciseId: 'dips', sets: [done(0, 10)] },
          { exerciseId: 'squat', sets: [todo(100, 5)] },
          { exerciseId: 'squat', sets: [todo(80, 8)] },
        ],
        0,
        base,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    expect(dialog().getByText('Il reste 2 séries non validées, en squat. Terminer quand même ?')).toBeInTheDocument();
    fireEvent.click(dialog().getByRole('button', { name: 'Continuer' }));
  });

  it('deux exercices distincts au même nom : les deux sont comptés', () => {
    const base = createDefaultState();
    base.exercises.push({ id: 'custom-squat', name: 'Squat', muscleGroup: 'Jambes', isCustom: true });
    renderAt(
      '#/seance',
      withActive(
        [
          { exerciseId: 'dips', sets: [done(0, 10)] },
          { exerciseId: 'squat', sets: [todo(100, 5)] },
          { exerciseId: 'custom-squat', sets: [todo(80, 8)] },
        ],
        0,
        base,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    expect(dialog().getByText('Il reste 2 séries non validées, en squat et squat. Terminer quand même ?')).toBeInTheDocument();
  });

  it('exercice ajouté à la volée, puis « Reprendre » l’exercice sauté', () => {
    renderAt('', stateWithThree());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Haut' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exercice suivant : Développé incliné' }));
    openMenu('Développé incliné');
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un exercice' }));
    fireEvent.change(dialog().getByRole('searchbox', { name: 'Rechercher un exercice' }), { target: { value: 'dips' } });
    fireEvent.click(dialog().getByText('Dips', { selector: 'span' }));
    // L'exercice ajouté devient l'exercice affiché.
    expect(screen.getByText('Exercice 4 sur 4')).toBeInTheDocument();
    validate();
    // Exercice 4 fini : l'exercice 1 (sauté) attend, avant les exercices 2 et 3.
    expect(screen.getByText('Exercice 4 sur 4')).toBeInTheDocument();
    expect(primary()).toHaveAccessibleName(/^Reprendre l’exercice 1\s:\sdéveloppé couché$/);
    fireEvent.click(primary());
    expect(screen.getByText('Exercice 1 sur 4')).toBeInTheDocument();
    validate(2);
    // Passage automatique au prochain exercice en attente plus loin.
    expect(screen.getByText('Exercice 2 sur 4')).toBeInTheDocument();
    expect(primary()).toHaveTextContent('Valider la série');
  });

  it('dernière série en attente de l’exercice affiché supprimée : bouton recalculé, pas de passage automatique', () => {
    renderAt(
      '#/seance',
      withActive([
        { exerciseId: 'squat', sets: [done(100, 5), todo(100, 5)] },
        { exerciseId: 'dips', sets: [todo(0, 10)] },
      ]),
    );
    openMenu('Squat');
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la dernière série' }));
    expect(screen.getByText('Exercice 1 sur 2')).toBeInTheDocument();
    expect(primary()).toHaveTextContent(/^Exercice suivant$/);
    fireEvent.click(within(toastEl()!).getByRole('button', { name: 'Annuler la suppression' }));
    expect(primary()).toHaveTextContent('Valider la série');
  });

  it('dernière série en attente supprimée, exercice en attente plus haut : « Reprendre », sans recul automatique', () => {
    renderAt(
      '#/seance',
      withActive(
        [
          { exerciseId: 'squat', sets: [todo(100, 5)] },
          { exerciseId: 'dips', sets: [done(0, 10), todo(0, 10)] },
        ],
        1,
      ),
    );
    openMenu('Dips');
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la dernière série' }));
    expect(screen.getByText('Exercice 2 sur 2')).toBeInTheDocument();
    expect(primary()).toHaveAccessibleName(/^Reprendre l’exercice 1\s:\ssquat$/);
  });

  it('correction sur un exercice fini, puis « Reprendre »', () => {
    renderAt(
      '#/seance',
      withActive(
        [
          { exerciseId: 'squat', sets: [todo(100, 5)] },
          { exerciseId: 'dips', sets: [done(0, 10), done(0, 10)] },
        ],
        1,
      ),
    );
    expect(primary()).toHaveTextContent('Reprendre l’exercice 1');
    fireEvent.click(screen.getByRole('button', { name: /^Corriger la série 2/ }));
    expect(primary()).toHaveTextContent('Enregistrer la correction');
    fireEvent.click(primary());
    // Une correction n'est pas une validation : même exercice, « Reprendre » revient.
    expect(screen.getByText('Série 2 corrigée.')).toBeInTheDocument();
    expect(screen.getByText('Exercice 2 sur 2')).toBeInTheDocument();
    expect(primary()).toHaveAccessibleName(/^Reprendre l’exercice 1\s:\ssquat$/);
    fireEvent.click(primary());
    expect(screen.getByText('Exercice 1 sur 2')).toBeInTheDocument();
    expect(primary()).toHaveTextContent('Valider la série');
  });

  it('critère 7 : après un rechargement, même exercice et même bouton principal', () => {
    const first = renderAt(
      '#/seance',
      withActive([
        { exerciseId: 'developpe-couche', sets: [todo(60, 10)] },
        { exerciseId: 'dips', sets: [todo(0, 10)] },
      ], 1),
    );
    validate();
    expect(primary()).toHaveTextContent('Reprendre l’exercice 1');
    const saved = first.saved();
    first.unmount();
    renderAt('#/seance', saved);
    expect(screen.getByText('Exercice 2 sur 2')).toBeInTheDocument();
    expect(primary()).toHaveAccessibleName(/^Reprendre l’exercice 1\s:\sdéveloppé couché$/);
  });
});

describe('lot 6 — crans de progression : ce qui est fait, pas la position', () => {
  const track = () => screen.getByRole('progressbar', { name: 'Progression dans la séance' });
  const steps = () => [...track().querySelectorAll('.session-progress__step')];
  const filled = () => steps().map((el) => el.classList.contains('session-progress__step--done'));
  const current = () => steps().findIndex((el) => el.classList.contains('session-progress__step--current'));
  const ex = (id: string, pending: boolean) => ({ exerciseId: id, sets: [pending ? todo(10, 10) : done(10, 10)] });

  it('sur l’exercice 5, exercice 2 en attente : le cran 2 n’est pas rempli', () => {
    renderAt(
      '#/seance',
      withActive(
        [ex('squat', false), ex('developpe-incline', true), ex('dips', false), ex('tractions', false), ex('crunch', false)],
        4,
      ),
    );
    expect(steps()).toHaveLength(5);
    expect(filled()).toEqual([true, false, true, true, true]);
    expect(current()).toBe(4);
    expect(document.querySelectorAll('.session-progress__step--current')).toHaveLength(1);
    expect(track()).toHaveAttribute('aria-valuemin', '0');
    expect(track()).toHaveAttribute('aria-valuemax', '5');
    expect(track()).toHaveAttribute('aria-valuenow', '4');
    expect(track()).toHaveAttribute('aria-valuetext', 'Exercice 5 sur 5, 4\u00a0exercices terminés');
    // Le cran de l'exercice affiché ne porte jamais l'accent.
    expect(track().innerHTML).not.toMatch(/accent|primary/);

    // « Reprendre » : l'exercice 2 affiché, les crans ne changent pas.
    fireEvent.click(primary());
    expect(filled()).toEqual([true, false, true, true, true]);
    expect(current()).toBe(1);
    expect(track()).toHaveAttribute('aria-valuetext', 'Exercice 2 sur 5, 4\u00a0exercices terminés');
    // Tout validé, « Terminer la séance » principal : 5 crans remplis sur l'exercice 2.
    validate();
    expect(primary()).toHaveTextContent('Terminer la séance');
    expect(filled()).toEqual([true, true, true, true, true]);
    expect(current()).toBe(1);
  });

  it('début de séance : aucun cran rempli ; un exercice sans série n’est pas en attente', () => {
    renderAt('#/seance', withActive([ex('squat', true), { exerciseId: 'dips', sets: [] }, ex('crunch', true)]));
    expect(filled()).toEqual([false, true, false]);
    expect(current()).toBe(0);
    expect(track()).toHaveAttribute('aria-valuetext', 'Exercice 1 sur 3, 1\u00a0exercice terminé');
  });

  it('aucun exercice fait : « aucun exercice terminé »', () => {
    renderAt('#/seance', withActive([ex('squat', true), ex('crunch', true)]));
    expect(track()).toHaveAttribute('aria-valuenow', '0');
    expect(track()).toHaveAttribute('aria-valuetext', 'Exercice 1 sur 2, aucun exercice terminé');
  });
});

describe('lot 6 — note par exercice', () => {
  const squatSession = (sets: SetEntry[] = [todo(100, 5), todo(100, 5)], base?: AppState) =>
    withActive([{ exerciseId: 'squat', sets }], 0, base);

  const writeNote = (text: string) => {
    openMenu('Squat');
    fireEvent.click(screen.getByRole('button', { name: /^(Ajouter une note|Modifier la note)$/ }));
    fireEvent.change(dialog().getByRole('textbox', { name: 'Note' }), { target: { value: text } });
    fireEvent.click(dialog().getByRole('button', { name: 'Enregistrer la note' }));
  };

  it('critère 9 : menu → « Ajouter une note » → enregistrée sous le nom, sans toast ; puis « Modifier la note »', () => {
    const { saved } = renderAt('#/seance', squatSession());
    expect(noteEl()).toBeNull();
    openMenu('Squat');
    const entries = [...document.querySelectorAll('.session-menu button')].map((b) => b.textContent);
    expect(entries.indexOf('Ajouter une note')).toBe(entries.indexOf('Ajouter un exercice') + 1);
    expect(entries.indexOf('Retirer cet exercice')).toBe(entries.indexOf('Ajouter une note') + 1);
    expect(screen.getByRole('button', { name: 'Ajouter une note' })).toHaveClass('btn', 'btn--block');
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une note' }));

    // Le menu est fermé, le dialogue s'ouvre avec le focus dans le champ.
    expect(document.querySelector('.session-menu')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Note sur squat' })).toHaveAttribute('aria-modal', 'true');
    const input = dialog().getByRole('textbox', { name: 'Note' });
    expect(input).toHaveFocus();
    // Zone de texte de 2 lignes (lot 6, revue design n° 4).
    expect(input.tagName).toBe('TEXTAREA');
    expect(input).toHaveAttribute('rows', '2');
    expect(input).toHaveClass('note-field__input');
    expect(input).toHaveAttribute('enterkeyhint', 'done');
    expect(input).toHaveAttribute('placeholder', 'Ex. : siège au cran 4');
    expect(input).toHaveAccessibleDescription('Réglage, prise ou consigne. Elle s’affichera à chaque séance.');
    // Un seul aplat accent dans le dialogue ; pas de « Effacer la note » sans note.
    expect(screen.getByRole('dialog').querySelectorAll('.btn--primary')).toHaveLength(1);
    expect(dialog().getByRole('button', { name: 'Enregistrer la note' })).toHaveClass('btn--primary');
    expect(dialog().getByRole('button', { name: 'Annuler' })).not.toHaveClass('btn--primary');
    expect(dialog().queryByRole('button', { name: 'Effacer la note' })).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Siège au cran 4' } });
    fireEvent.click(dialog().getByRole('button', { name: 'Enregistrer la note' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Focus rendu à la note enregistrée (le lecteur d'écran lit « Note : … »).
    const note = noteEl()!;
    expect(note).toHaveFocus();
    expect(note).toHaveAttribute('tabindex', '-1');
    expect(note).toHaveTextContent(/^Note : Siège au cran 4$/);
    expect(note.querySelector('.visually-hidden')).toHaveTextContent('Note :');
    expect(note.querySelector('svg.lucide-sticky-note')).toHaveAttribute('aria-hidden', 'true');
    // Sous le nom, au-dessus de la liste des séries.
    expect(note.previousElementSibling).toHaveClass('session-exercise__head');
    expect(note.className).not.toMatch(/accent|success|primary/);
    // Ni toast ni retour dans le dock.
    expect(toastEl()).toBeNull();
    expect(document.querySelector('.session-dock__feedback')).toBeNull();
    expect(saved().exercises.find((e) => e.id === 'squat')?.note).toBe('Siège au cran 4');

    openMenu('Squat');
    expect(screen.getByRole('button', { name: 'Modifier la note' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ajouter une note' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Modifier la note' }));
    expect(dialog().getByRole('textbox', { name: 'Note' })).toHaveValue('Siège au cran 4');
    expect(dialog().getByRole('button', { name: 'Effacer la note' })).toHaveClass('btn--danger-ghost');
  });

  it('Entrée enregistre ; Échap et clic hors de la boîte annulent', () => {
    renderAt('#/seance', squatSession());
    openMenu('Squat');
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une note' }));
    fireEvent.change(dialog().getByRole('textbox', { name: 'Note' }), { target: { value: 'Brouillon' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(noteEl()).toBeNull();
    expect(screen.getByRole('button', { name: 'Options de Squat' })).toHaveFocus();

    openMenu('Squat');
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une note' }));
    fireEvent.click(document.querySelector('.dialog-backdrop')!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Entrée enregistre, sans saut de ligne (le défaut de la touche est empêché).
    openMenu('Squat');
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une note' }));
    const area = dialog().getByRole('textbox', { name: 'Note' });
    fireEvent.change(area, { target: { value: 'Coudes rentrés' } });
    expect(fireEvent.keyDown(area, { key: 'Enter' })).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(noteEl()).toHaveTextContent(/^Note : Coudes rentrés$/);
    expect(noteEl()).toHaveFocus();

    // Maj+Entrée fait la même chose qu'Entrée : enregistre, sans saut de ligne.
    openMenu('Squat');
    fireEvent.click(screen.getByRole('button', { name: 'Modifier la note' }));
    const again = dialog().getByRole('textbox', { name: 'Note' });
    fireEvent.change(again, { target: { value: 'Coudes rentrés, dos plat' } });
    expect(fireEvent.keyDown(again, { key: 'Enter', shiftKey: true })).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(noteEl()).toHaveTextContent(/^Note : Coudes rentrés, dos plat$/);

    // Un saut de ligne collé devient une espace.
    openMenu('Squat');
    fireEvent.click(screen.getByRole('button', { name: 'Modifier la note' }));
    const pasted = dialog().getByRole('textbox', { name: 'Note' });
    fireEvent.change(pasted, { target: { value: 'Ligne 1\nLigne 2' } });
    expect(pasted).toHaveValue('Ligne 1 Ligne 2');
    fireEvent.keyDown(document, { key: 'Escape' });

    openMenu('Squat');
    fireEvent.click(screen.getByRole('button', { name: 'Modifier la note' }));
    const input = dialog().getByRole('textbox', { name: 'Note' });
    fireEvent.change(input, { target: { value: 'Prise serrée' } });
    fireEvent.submit(input.closest('form')!);
    expect(noteEl()).toHaveTextContent('Prise serrée');
  });

  it('critère 11 : 80 caractères au plus, compteur dès 60 (pas à 59), espaces retirées', () => {
    const { saved } = renderAt('#/seance', squatSession());
    openMenu('Squat');
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une note' }));
    const input = dialog().getByRole('textbox', { name: 'Note' });
    expect(input).toHaveAttribute('maxLength', '80');
    fireEvent.change(input, { target: { value: 'a'.repeat(59) } });
    expect(document.querySelector('.note-field__counter')).toBeNull();
    fireEvent.change(input, { target: { value: 'a'.repeat(60) } });
    expect(document.querySelector('.note-field__counter')?.textContent).toBe('60\u00a0/\u00a080');
    fireEvent.change(input, { target: { value: 'a'.repeat(72) } });
    expect(document.querySelector('.note-field__counter')).toHaveTextContent(/^72\s\/\s80$/);
    // Un 81ᵉ caractère (collé) est refusé.
    fireEvent.change(input, { target: { value: 'b'.repeat(81) } });
    expect(input).toHaveValue('b'.repeat(80));

    fireEvent.change(input, { target: { value: '   Coudes rentrés  ' } });
    fireEvent.click(dialog().getByRole('button', { name: 'Enregistrer la note' }));
    expect(saved().exercises.find((e) => e.id === 'squat')?.note).toBe('Coudes rentrés');
  });

  it('critère 12 : « Effacer la note » → toast « Note effacée. », « Annuler » rétablit le texte exact ; champ absent', () => {
    const { saved } = renderAt('#/seance', squatSession());
    writeNote('Barre au cran 6, pieds largeur épaules');
    openMenu('Squat');
    fireEvent.click(screen.getByRole('button', { name: 'Modifier la note' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Effacer la note' }));
    expect(noteEl()).toBeNull();
    expect(saved().exercises.find((e) => e.id === 'squat')).not.toHaveProperty('note');
    expect(toastEl()).toHaveTextContent('Note effacée.');
    fireEvent.click(within(toastEl()!).getByRole('button', { name: 'Annuler : remettre la note' }));
    expect(noteEl()).toHaveTextContent('Barre au cran 6, pieds largeur épaules');
    expect(saved().exercises.find((e) => e.id === 'squat')?.note).toBe('Barre au cran 6, pieds largeur épaules');
  });

  it('nouvelle note après un effacement : le toast « Note effacée. » se ferme, « Annuler » ne l’écrase pas', () => {
    const { saved } = renderAt('#/seance', squatSession());
    writeNote('Ancienne note');
    writeNote('');
    expect(toastEl()).toHaveTextContent('Note effacée.');
    writeNote('Nouvelle note');
    expect(toastEl()).toBeNull();
    expect(noteEl()).toHaveTextContent('Nouvelle note');
    expect(saved().exercises.find((e) => e.id === 'squat')?.note).toBe('Nouvelle note');
  });

  it('effacement : le focus revient au bouton ⋯ (plus de note à l’écran)', () => {
    renderAt('#/seance', squatSession());
    writeNote('Poulie : trou 3');
    expect(noteEl()).toHaveFocus();
    openMenu('Squat');
    fireEvent.click(screen.getByRole('button', { name: 'Modifier la note' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Effacer la note' }));
    expect(noteEl()).toBeNull();
    expect(screen.getByRole('button', { name: 'Options de Squat' })).toHaveFocus();
  });

  it('exercice supprimé de la bibliothèque : pas d’entrée « Ajouter une note »', () => {
    renderAt('#/seance', withActive([{ exerciseId: 'disparu', sets: [todo(20, 10)] }]));
    fireEvent.click(screen.getByRole('button', { name: /^Options de / }));
    expect(screen.getByRole('button', { name: 'Ajouter un exercice' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /note/i })).not.toBeInTheDocument();
  });

  it('critère 12 : enregistrer un champ vide efface aussi ; « Annuler » disparaît après 5 s', () => {
    vi.useFakeTimers();
    const { saved } = renderAt('#/seance', squatSession());
    writeNote('Poulie : trou 3');
    writeNote('   ');
    expect(noteEl()).toBeNull();
    expect(toastEl()).toHaveTextContent('Note effacée.');
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS);
    });
    expect(toastEl()).toBeNull();
    expect(saved().exercises.find((e) => e.id === 'squat')).not.toHaveProperty('note');
  });

  it('champ vide sans note : rien ne se passe (ni toast ni changement)', () => {
    renderAt('#/seance', squatSession());
    writeNote('');
    expect(noteEl()).toBeNull();
    expect(toastEl()).toBeNull();
  });

  it('le dialogue ne touche ni au minuteur de repos ni au retour du dock', () => {
    renderAt('#/seance', squatSession());
    validate();
    expect(screen.getByRole('region', { name: 'Minuteur de repos' })).toBeInTheDocument();
    const feedback = document.querySelector('.session-dock__feedback')?.textContent;
    writeNote('Siège au cran 4');
    writeNote('');
    expect(screen.getByRole('region', { name: 'Minuteur de repos' })).toBeInTheDocument();
    expect(document.querySelector('.session-dock__feedback')?.textContent).toBe(feedback);
  });

  it('ouvrir la note abandonne une correction en cours', () => {
    renderAt('#/seance', squatSession([done(100, 5), todo(100, 5)]));
    fireEvent.click(screen.getByRole('button', { name: /^Corriger la série 1/ }));
    expect(screen.getByText('En correction')).toBeInTheDocument();
    openMenu('Squat');
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une note' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('En correction')).not.toBeInTheDocument();
  });

  it('critère 10 : la note revient dans une autre séance type, une séance libre, après rechargement, export et import', () => {
    const first = renderAt('', stateWithThree());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Jambes' }));
    writeNote('Barre au cran 6');
    fireEvent.click(screen.getByRole('button', { name: /^Options de Squat/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Abandonner la séance' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Abandonner' }));
    const saved = first.saved();
    first.unmount();

    // Rechargement, puis séance libre avec le même exercice.
    renderAt('#/seances', saved);
    fireEvent.click(screen.getByRole('button', { name: /séance libre/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un exercice' }));
    fireEvent.change(dialog().getByRole('searchbox', { name: 'Rechercher un exercice' }), { target: { value: 'squat' } });
    fireEvent.click(dialog().getByText('Squat', { selector: 'span' }));
    expect(noteEl()).toHaveTextContent('Barre au cran 6');

    // Export puis import : la note revient.
    const r = validateImport(exportState(saved));
    expect(r.ok && r.state.exercises.find((e) => e.id === 'squat')?.note).toBe('Barre au cran 6');
  });

  it('même exercice deux fois : la même note aux deux endroits, modifiée à l’un, modifiée à l’autre', () => {
    renderAt(
      '#/seance',
      withActive([
        { exerciseId: 'squat', sets: [todo(100, 5)] },
        { exerciseId: 'squat', sets: [todo(80, 8)] },
      ]),
    );
    writeNote('Barre au cran 6');
    fireEvent.click(screen.getByRole('button', { name: /^Exercice suivant/ }));
    expect(screen.getByText('Exercice 2 sur 2')).toBeInTheDocument();
    expect(noteEl()).toHaveTextContent('Barre au cran 6');
    writeNote('Barre au cran 5');
    fireEvent.click(screen.getByRole('button', { name: /^Exercice précédent/ }));
    expect(noteEl()).toHaveTextContent('Barre au cran 5');
  });

  it('critère 14 : note sur un exercice personnalisé', () => {
    const base = createDefaultState();
    base.exercises.push({ id: 'custom-1', name: 'Pull-over', muscleGroup: 'Dos', isCustom: true });
    const { saved } = renderAt('#/seance', withActive([{ exerciseId: 'custom-1', sets: [todo(20, 12)] }], 0, base));
    openMenu('Pull-over');
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une note' }));
    expect(screen.getByRole('dialog', { name: 'Note sur pull-over' })).toBeInTheDocument();
    fireEvent.change(dialog().getByRole('textbox', { name: 'Note' }), { target: { value: 'Poulie : trou 3' } });
    fireEvent.click(dialog().getByRole('button', { name: 'Enregistrer la note' }));
    expect(noteEl()).toHaveTextContent('Poulie : trou 3');
    expect(saved().exercises.find((e) => e.id === 'custom-1')?.note).toBe('Poulie : trou 3');
  });

  it('critère 15 : la note reste affichée après la série 1, contrairement à « Charge proposée »', () => {
    const base = createDefaultState();
    base.templates.push(
      createTemplate(
        { name: 'Jambes', exercises: [{ ...createTemplateExercise('squat'), targetSets: 2, targetReps: 5 }] },
        new Date('2026-10-01T10:00:00Z'),
        'tj',
      ),
    );
    const yesterday = Date.now() - 24 * 3600 * 1000;
    base.sessions.push({
      id: 'p1',
      templateId: 'tj',
      name: 'Jambes',
      startedAt: new Date(yesterday).toISOString(),
      endedAt: new Date(yesterday + 3600 * 1000).toISOString(),
      exercises: [{ exerciseId: 'squat', sets: [done(100, 5), done(100, 5)] }],
    });
    base.exercises = base.exercises.map((e) => (e.id === 'squat' ? { ...e, note: 'Barre au cran 6' } : e));
    renderAt('#/seances', base);
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Jambes' }));
    expect(document.querySelector('.load-note')).not.toBeNull();
    // Ordre : nom, note, charge proposée.
    expect(noteEl()?.nextElementSibling).toHaveClass('load-note');
    validate();
    expect(document.querySelector('.load-note')).toBeNull();
    expect(noteEl()).toHaveTextContent('Barre au cran 6');
  });

  it('note absente de l’Historique et du constructeur', () => {
    const base = createDefaultState();
    base.exercises = base.exercises.map((e) => (e.id === 'squat' ? { ...e, note: 'Barre au cran 6' } : e));
    base.templates.push(
      createTemplate({ name: 'Jambes', exercises: [createTemplateExercise('squat')] }, new Date('2026-10-01T10:00:00Z'), 'tj'),
    );
    renderAt('#/seances/tj', base);
    expect(screen.queryByText('Barre au cran 6')).not.toBeInTheDocument();
  });
});
