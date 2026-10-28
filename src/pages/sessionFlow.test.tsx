import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOAST_DURATION_MS } from '../components/Toast';
import App from '../App';
import { MAX_WEIGHT } from '../lib/session';
import { STORAGE_KEY, createDefaultState, type StorageLike } from '../lib/storage';
import { createTemplate, createTemplateExercise } from '../lib/templates';
import type { AppState } from '../lib/types';
import { AppStoreProvider } from '../state/AppStore';

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

function renderApp(initial?: AppState) {
  const mem = memoryStorage(initial);
  const { unmount } = render(
    <AppStoreProvider storage={mem.storage}>
      <App />
    </AppStoreProvider>,
  );
  return { ...mem, unmount };
}

function stateWithTemplate(): AppState {
  const s = createDefaultState();
  s.templates.push(
    createTemplate({ name: 'Jambes', exercises: [createTemplateExercise('squat')] }, new Date('2026-10-01T10:00:00Z'), 't1'),
  );
  return s;
}

const dialog = () => within(screen.getByRole('dialog'));
/** Zones `role="status"` de la page, hors zone du toast (toujours présente, vide sans toast). */
const pageStatus = () => {
  const list = screen.getAllByRole('status').filter((el) => !el.classList.contains('toast-region'));
  if (list.length !== 1) throw new Error(`${list.length} zones status hors toast`);
  return list[0];
};
/** Zone du toast. */
const toastRegion = () => {
  const el = document.querySelector<HTMLElement>('.toast-region');
  if (!el) throw new Error('Pas de zone de toast');
  return el;
};

/** Toast « Annuler » (un seul à la fois). */
const toastEl = () => {
  const el = document.querySelector<HTMLElement>('.toast');
  if (!el) throw new Error('Aucun toast');
  return el;
};
const undo = () => fireEvent.click(within(toastEl()).getByRole('button', { name: 'Annuler la suppression' }));
/** Lignes de séries de l'exercice affiché. */
const seriesOf = (name: string) => within(screen.getByRole('list', { name: `Séries de ${name}` })).getAllByRole('listitem');
/** Série en cours (mise en avant). */
const currentSet = () => {
  const el = document.querySelector<HTMLElement>('[aria-current="step"]');
  if (!el) throw new Error('Aucune série en cours');
  return el;
};

/** Séance type « Haut » : Développé couché (2 séries) puis Tractions (2 séries). */
function stateWithTwoExercises(): AppState {
  const s = createDefaultState();
  s.templates.push(
    createTemplate(
      {
        name: 'Haut',
        exercises: [
          { ...createTemplateExercise('developpe-couche'), targetSets: 2, targetWeight: 60 },
          { ...createTemplateExercise('tractions'), targetSets: 2, targetReps: 8 },
        ],
      },
      new Date('2026-10-01T10:00:00Z'),
      't2',
    ),
  );
  return s;
}

beforeEach(() => {
  window.location.hash = '';
  sessionStorage.clear();
});

describe('parcours séance', () => {
  it('crée une séance type, la démarre, valide une série et termine → résumé', () => {
    const { saved } = renderApp();

    // État vide accueillant
    expect(screen.getByText('Aucune séance pour l’instant.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Créer une séance' }));
    expect(screen.getByRole('heading', { name: 'Nouvelle séance type' })).toBeInTheDocument();

    // Nom obligatoire
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la séance' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Donne un nom à la séance.');
    fireEvent.change(screen.getByRole('textbox', { name: 'Nom' }), { target: { value: 'Push' } });

    // Ajout d'un exercice : recherche insensible aux accents
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un exercice' }));
    fireEvent.change(dialog().getByRole('searchbox', { name: 'Rechercher un exercice' }), {
      target: { value: 'developpe couche' },
    });
    fireEvent.click(dialog().getByText('Développé couché', { selector: 'span' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Développé couché' })).toBeInTheDocument();

    // Objectifs : 2 séries, repos 60 s
    fireEvent.change(screen.getByLabelText('Séries'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Repos (s) : moins 15' }));
    fireEvent.click(screen.getByRole('button', { name: 'Repos (s) : moins 15' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la séance' }));

    // Liste des séances types
    expect(screen.getByRole('heading', { name: 'Push' })).toBeInTheDocument();
    expect(screen.getByText(/^1 exercice · ≈ 5 min$/)).toBeInTheDocument();
    expect(screen.getByText('Jamais faite')).toBeInTheDocument();
    expect(saved().templates[0].exercises[0]).toMatchObject({ targetSets: 2, restSeconds: 60 });

    // Démarrer : écran plein, sans barre d'onglets, un seul exercice affiché
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Push' }));
    expect(screen.getByRole('heading', { name: 'Push' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByText('Exercice 1 sur 1')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Progression dans la séance' })).toHaveAttribute('aria-valuenow', '1');
    expect(seriesOf('Développé couché')).toHaveLength(2);
    expect(currentSet()).toHaveTextContent('Série 1 sur 2');
    expect(currentSet()).toHaveTextContent('En cours');
    // Objectif rappelé faute d'historique
    expect(currentSet()).toHaveTextContent('Objectif : 10 reps');

    // Saisie au clavier (repli) et validation d'une série → retour + minuteur de repos
    fireEvent.change(screen.getByLabelText('Charge (kg)'), { target: { value: '62,5' } });
    fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    expect(screen.getByRole('button', { name: /^Corriger la série 1 : 62,5\skg × 8, faite$/ })).toHaveTextContent('Faite');
    expect(screen.getByText('Série 1 validée. Repos : 60 s.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Minuteur de repos' })).toHaveTextContent('01:00');
    expect(currentSet()).toHaveTextContent('Série 2 sur 2');
    expect(saved().activeSession?.exercises[0].sets[0]).toEqual({ weight: 62.5, reps: 8, done: true });

    // Terminer (secondaire) avec une série restante → confirmation légère → résumé
    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    expect(dialog().getByText('Il reste 1 série non validée. Terminer quand même ?')).toBeInTheDocument();
    fireEvent.click(dialog().getByRole('button', { name: 'Terminer la séance' }));
    // Récap : titre = nom de la séance, la phrase dit « Séance terminée » (plus de doublon)
    expect(screen.getByRole('heading', { level: 1, name: 'Push' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Séance terminée' })).not.toBeInTheDocument();
    expect(screen.getByText('Séance terminée : 1 exercice, 1 série, 500 kg soulevés.')).toBeInTheDocument();
    expect(screen.getByText('500 kg')).toBeInTheDocument();
    expect(saved().sessions).toHaveLength(1);
    expect(saved().activeSession).toBeUndefined();
    expect(saved().sessions[0].exercises[0].sets).toEqual([{ weight: 62.5, reps: 8, done: true }]);
    expect(saved().sessions[0]).not.toHaveProperty('currentExerciseIndex');

    // « Voir mes progrès » (principal) avant « Mettre à jour la séance type » (secondaire, contour)
    const progress = screen.getByRole('button', { name: 'Voir mes progrès' });
    const update = screen.getByRole('button', { name: 'Mettre à jour la séance type' });
    expect(progress).toHaveClass('btn--primary');
    // Action principale dans le bas d'écran collé ; la secondaire (contour) au-dessus, dans le contenu
    expect(progress.closest('.summary-dock')).not.toBeNull();
    expect(update).not.toHaveClass('btn--primary');
    expect(update.closest('.summary-dock')).toBeNull();
    fireEvent.click(update);
    expect(pageStatus()).toHaveTextContent('mise à jour');
    expect(saved().templates[0].exercises[0].targetWeight).toBe(62.5);

    fireEvent.click(screen.getByRole('button', { name: 'Voir mes progrès' }));
    expect(screen.getByRole('heading', { name: 'Progrès' })).toBeInTheDocument();
  });

  it('affiche les nouveaux records dans le résumé', () => {
    const initial = stateWithTemplate();
    initial.sessions.push({
      id: 'old',
      templateId: 't1',
      name: 'Jambes',
      startedAt: '2026-10-01T10:00:00.000Z',
      endedAt: '2026-10-01T11:00:00.000Z',
      exercises: [{ exerciseId: 'squat', sets: [{ weight: 100, reps: 5, done: true }] }],
    });
    renderApp(initial);
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Jambes' }));
    // Pré-rempli avec la dernière fois, rappelée dans la série en cours
    expect(currentSet()).toHaveTextContent('Dernière fois : 100 kg × 5');
    expect(screen.getByLabelText('Charge (kg)')).toHaveValue('100');
    fireEvent.change(screen.getByLabelText('Charge (kg)'), { target: { value: '110' } });
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Terminer la séance' }));
    expect(screen.getByRole('heading', { name: 'Nouveaux records' })).toBeInTheDocument();
    // Poids max, 1RM et volume battus : une seule ligne (le poids max), un seul « ! »
    expect(screen.getAllByText(/^Nouveau record/)).toHaveLength(1);
    expect(screen.getByText(/^Nouveau record en squat : 110 kg !/)).toBeInTheDocument();
  });

  it('récap : record de 1RM arrondi à 0,5 kg, comme dans Progrès', () => {
    const initial = stateWithTemplate();
    initial.sessions.push({
      id: 'old',
      templateId: 't1',
      name: 'Jambes',
      startedAt: '2026-10-01T10:00:00.000Z',
      endedAt: '2026-10-01T11:00:00.000Z',
      exercises: [{ exerciseId: 'squat', sets: [{ weight: 100, reps: 5, done: true }] }],
    });
    renderApp(initial);
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Jambes' }));
    // Même charge, une rep de plus : seul le 1RM (et le volume) progresse
    fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Terminer la séance' }));
    // 100 × (1 + 7/30) = 123,33 → 123,5 ; avant 100 × (1 + 5/30) = 116,67 → 116,5
    expect(screen.getByText(/^Nouveau record de 1RM estimé en squat : 123,5 kg !/)).toHaveTextContent('(avant 116,5 kg)');
  });

  it('abandon : rien n’est enregistré', () => {
    const { saved } = renderApp(stateWithTemplate());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Jambes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    // « Abandonner la séance » : dernière entrée du menu ⋯ (plus de gros bouton rouge à l'écran)
    expect(screen.queryByRole('button', { name: 'Abandonner la séance' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Options de Squat' }));
    const items = document.querySelectorAll('.session-menu .btn');
    expect(items[items.length - 1]).toHaveTextContent('Abandonner la séance');
    fireEvent.click(screen.getByRole('button', { name: 'Abandonner la séance' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Abandonner' }));
    expect(screen.getByRole('heading', { name: 'Séances' })).toBeInTheDocument();
    expect(saved().sessions).toEqual([]);
    expect(saved().activeSession).toBeUndefined();
    expect(screen.queryByText(/Séance en cours/)).not.toBeInTheDocument();
  });

  it('garde « séance vide » : propose d’abandonner au lieu d’enregistrer', () => {
    const { saved } = renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Séance libre' }));
    expect(screen.getByRole('heading', { name: 'Séance libre' })).toBeInTheDocument();

    // Ajout d'un exercice à la volée, sans valider de série
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un exercice' }));
    fireEvent.click(dialog().getByText('Squat', { selector: 'span' }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    expect(dialog().getByRole('heading', { name: 'Aucune série validée' })).toBeInTheDocument();

    // « Continuer » : la séance reste en cours
    fireEvent.click(dialog().getByRole('button', { name: 'Continuer' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Abandonner la séance' }));
    expect(screen.getByRole('heading', { name: 'Séances' })).toBeInTheDocument();
    expect(saved().sessions).toEqual([]);
    expect(saved().activeSession).toBeUndefined();
  });

  it('menu ⋯ : ajoute / supprime une série, ajoute et retire un exercice (plus de croix par série)', () => {
    const { saved } = renderApp(stateWithTemplate());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Jambes' }));
    expect(seriesOf('Squat')).toHaveLength(3);
    // Plus aucune suppression directe sur les lignes de série
    expect(screen.queryByRole('button', { name: /^Supprimer la série/ })).not.toBeInTheDocument();

    const menu = screen.getByRole('button', { name: 'Options de Squat' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    for (const label of ['Ajouter une série', 'Supprimer la dernière série', 'Ajouter un exercice', 'Retirer cet exercice']) {
      expect(screen.getByRole('button', { name: label })).toBeVisible();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une série' }));
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(seriesOf('Squat')).toHaveLength(4);

    fireEvent.click(menu);
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la dernière série' }));
    expect(seriesOf('Squat')).toHaveLength(3);
    expect(saved().activeSession?.exercises[0].sets).toHaveLength(3);
    // Suppression immédiate, sans modale, annoncée par un toast
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toastEl()).toHaveTextContent('Série 4 supprimée.');

    // Ajouter un exercice depuis le menu → il devient l'exercice affiché
    fireEvent.click(screen.getByRole('button', { name: 'Options de Squat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un exercice' }));
    fireEvent.click(dialog().getByText('Dips', { selector: 'span' }));
    expect(screen.getByText('Exercice 2 sur 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dips' })).toBeInTheDocument();

    // Retirer cet exercice : immédiat (plus de modale), toast « Annuler »
    fireEvent.click(screen.getByRole('button', { name: 'Options de Dips' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retirer cet exercice' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dips' })).not.toBeInTheDocument();
    expect(screen.getByText('Exercice 1 sur 1')).toBeInTheDocument();
    expect(toastEl()).toHaveTextContent('Exercice retiré : dips.');

    fireEvent.click(screen.getByRole('button', { name: 'Options de Squat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retirer cet exercice' }));
    expect(screen.queryByRole('heading', { name: 'Squat' })).not.toBeInTheDocument();
    expect(saved().activeSession?.exercises).toEqual([]);
    // Un seul toast : le nouveau remplace l'ancien
    expect(document.querySelectorAll('.toast')).toHaveLength(1);
    expect(toastEl()).toHaveTextContent('Exercice retiré : squat.');
  });

  it('bannière de reprise et redirection sans séance active', () => {
    const initial = stateWithTemplate();
    initial.activeSession = {
      id: 'a1',
      templateId: 't1',
      name: 'Jambes',
      startedAt: new Date().toISOString(),
      exercises: [{ exerciseId: 'squat', sets: [{ weight: 80, reps: 5, done: false }] }],
    };
    renderApp(initial);
    // Démarrer une autre séance propose de reprendre celle en cours
    fireEvent.click(screen.getByRole('button', { name: 'Séance libre' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Annuler' }));

    fireEvent.click(screen.getByRole('link', { name: /Séance en cours/ }));
    expect(screen.getByRole('heading', { name: 'Jambes' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Séance en cours/ })).not.toBeInTheDocument();
  });

  it('le minuteur de repos survit à un rechargement de l’écran de séance', () => {
    const first = renderApp(stateWithTemplate());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Jambes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    expect(screen.getByRole('region', { name: 'Minuteur de repos' })).toBeInTheDocument();
    const saved = first.saved();
    first.unmount();

    window.location.hash = '#/seance';
    renderApp(saved);
    expect(screen.getByRole('region', { name: 'Minuteur de repos' })).toHaveTextContent(/01:(29|30)/);
    fireEvent.click(screen.getByRole('button', { name: 'Passer' }));
    expect(screen.queryByRole('region', { name: 'Minuteur de repos' })).not.toBeInTheDocument();
    expect(sessionStorage.length).toBe(0);
  });

  it('un exercice à la fois : validation → exercice suivant, précédent, dernier exercice → Terminer', () => {
    const { saved } = renderApp(stateWithTwoExercises());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Haut' }));
    expect(screen.getByText('Exercice 1 sur 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Développé couché' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Tractions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Exercice précédent/ })).not.toBeInTheDocument();
    // États : en cours + à venir (libellés, pas seulement la couleur)
    expect(seriesOf('Développé couché')[1]).toHaveTextContent('À venir');

    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    expect(screen.getByText('Exercice 1 sur 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    // Dernière série validée → passage automatique à l'exercice suivant
    expect(screen.getByText('Exercice 2 sur 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tractions' })).toBeInTheDocument();
    // Exercice fini : le message ne cite pas un numéro de série de l'exercice précédent
    expect(screen.getByText('Exercice terminé : développé couché. Repos : 90 s.')).toBeInTheDocument();
    expect(saved().activeSession?.currentExerciseIndex).toBe(1);

    // Exercice précédent : toutes ses séries sont faites → l'action principale propose la suite
    const previous = screen.getByRole('button', { name: 'Exercice précédent : Développé couché' });
    expect(previous).toHaveTextContent('Précédent');
    fireEvent.click(previous);
    expect(screen.getByRole('heading', { name: 'Développé couché' })).toBeInTheDocument();
    expect(seriesOf('Développé couché').every((li) => li.textContent?.includes('Faite'))).toBe(true);
    expect(screen.queryByRole('button', { name: 'Valider la série' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Exercice suivant' }));
    expect(screen.getByRole('heading', { name: 'Tractions' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    // Dernière série du dernier exercice → le bouton principal devient « Terminer la séance » (un seul)
    expect(screen.getByText('Exercice terminé : tractions.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Minuteur de repos' })).not.toBeInTheDocument();
    const finishButtons = screen.getAllByRole('button', { name: 'Terminer la séance' });
    expect(finishButtons).toHaveLength(1);
    expect(finishButtons[0]).toHaveClass('btn--primary');
    // Tout est validé : pas de confirmation
    fireEvent.click(finishButtons[0]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Séparateur de milliers français (espace fine insécable).
    expect(screen.getByText(/^Séance terminée : 2 exercices, 4 séries, 1\s200 kg soulevés\.$/)).toBeInTheDocument();
  });

  it('exercice suivant sans tout valider, puis Terminer avec confirmation du nombre restant', () => {
    renderApp(stateWithTwoExercises());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Haut' }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    const next = screen.getByRole('button', { name: 'Exercice suivant : Tractions' });
    expect(next).toHaveTextContent('Suivant');
    fireEvent.click(next);
    expect(screen.getByText('Exercice 2 sur 2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Exercice suivant/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    expect(dialog().getByText('Il reste 3 séries non validées. Terminer quand même ?')).toBeInTheDocument();
    fireEvent.click(dialog().getByRole('button', { name: 'Continuer' }));
    expect(screen.getByText('Exercice 2 sur 2')).toBeInTheDocument();
  });

  it('série en cours : −/+ par pas de 2,5 kg et 1 rep, plancher à 0, saisie clavier en repli', () => {
    const { saved } = renderApp(stateWithTwoExercises());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Haut' }));
    const weight = screen.getByLabelText('Charge (kg)');
    const reps = screen.getByLabelText('Reps');
    expect(weight).toHaveValue('60');
    expect(reps).toHaveValue('10');

    fireEvent.click(screen.getByRole('button', { name: 'Charge (kg) : plus 2,5' }));
    expect(weight).toHaveValue('62,5');
    fireEvent.click(screen.getByRole('button', { name: 'Charge (kg) : moins 2,5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Charge (kg) : moins 2,5' }));
    expect(weight).toHaveValue('57,5');
    fireEvent.click(screen.getByRole('button', { name: 'Reps : plus 1' }));
    expect(reps).toHaveValue('11');
    fireEvent.click(screen.getByRole('button', { name: 'Reps : moins 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reps : moins 1' }));
    expect(reps).toHaveValue('9');
    expect(saved().activeSession?.exercises[0].sets[0]).toEqual({ weight: 57.5, reps: 9, done: false });

    // Plancher 0
    fireEvent.change(weight, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Charge (kg) : moins 2,5' }));
    expect(weight).toHaveValue('0');
    fireEvent.change(reps, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reps : moins 1' }));
    expect(reps).toHaveValue('0');

    // Saisie clavier en repli : décimales avec virgule
    expect(weight).toHaveAttribute('inputmode', 'decimal');
    fireEvent.change(weight, { target: { value: '72,25' } });
    fireEvent.blur(weight);
    expect(saved().activeSession?.exercises[0].sets[0].weight).toBe(72.25);

    // Chiffres héros 40 px : champ en variante « hero »
    expect(weight.closest('.number-field')).toHaveClass('number-field--hero');
  });

  it('corriger une série faite : ni repos relancé, ni changement d’exercice', () => {
    const { saved } = renderApp(stateWithTwoExercises());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Haut' }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    expect(currentSet()).toHaveTextContent('Série 2 sur 2');
    const timerBefore = screen.getByRole('region', { name: 'Minuteur de repos' }).textContent;
    const restBefore = sessionStorage.getItem('muscutrack:repos');

    // La ligne faite dit qu'on peut la corriger (icône + libellé)
    const done = screen.getByRole('button', { name: /^Corriger la série 1/ });
    expect(done).toHaveTextContent('Corriger');
    fireEvent.click(done);
    expect(screen.getByText('Série 1 en correction.')).toBeInTheDocument();
    expect(currentSet()).toHaveTextContent('Série 1 sur 2');
    expect(currentSet()).toHaveTextContent('En correction');
    // La série reste validée pendant la correction
    expect(saved().activeSession?.exercises[0].sets[0].done).toBe(true);
    expect(screen.queryByRole('button', { name: 'Valider la série' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Charge (kg) : plus 2,5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la correction' }));
    expect(screen.getByText('Série 1 corrigée.')).toBeInTheDocument();
    expect(saved().activeSession?.exercises[0].sets[0]).toEqual({ weight: 62.5, reps: 10, done: true });
    // Repos inchangé, même exercice, la série en cours redevient la 2
    expect(sessionStorage.getItem('muscutrack:repos')).toBe(restBefore);
    expect(screen.getByRole('region', { name: 'Minuteur de repos' }).textContent?.slice(0, 5)).toBe(timerBefore?.slice(0, 5));
    expect(screen.getByText('Exercice 1 sur 2')).toBeInTheDocument();
    expect(currentSet()).toHaveTextContent('Série 2 sur 2');
  });

  it('corriger la dernière série d’un exercice fini ne fait pas changer d’exercice', () => {
    const { saved } = renderApp(stateWithTwoExercises());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Haut' }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    fireEvent.click(screen.getByRole('button', { name: 'Passer' }));
    fireEvent.click(screen.getByRole('button', { name: /^Exercice précédent/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Corriger la série 2/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Reps : moins 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la correction' }));
    expect(screen.getByRole('heading', { name: 'Développé couché' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Minuteur de repos' })).not.toBeInTheDocument();
    expect(saved().activeSession?.currentExerciseIndex).toBe(0);
    expect(saved().activeSession?.exercises[0].sets[1]).toEqual({ weight: 60, reps: 9, done: true });
  });

  it('la transition reste « précédent » sur les rendus suivants (pas d’animation rejouée)', () => {
    renderApp(stateWithTwoExercises());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Haut' }));
    fireEvent.click(screen.getByRole('button', { name: /^Exercice suivant/ }));
    const article = () => document.querySelector('.session-exercise');
    expect(article()).toHaveClass('session-exercise--next');
    fireEvent.click(screen.getByRole('button', { name: /^Exercice précédent/ }));
    expect(article()).toHaveClass('session-exercise--prev');
    // Rendus sans changement d'exercice (menu, saisie, tic du chrono) : le sens ne change pas
    fireEvent.click(screen.getByRole('button', { name: 'Options de Développé couché' }));
    fireEvent.click(screen.getByRole('button', { name: 'Charge (kg) : plus 2,5' }));
    expect(article()).toHaveClass('session-exercise--prev');
  });

  it('menu ⋯ : se ferme sur Échap (focus rendu au bouton) et au tap extérieur', () => {
    renderApp(stateWithTwoExercises());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Haut' }));
    const menu = screen.getByRole('button', { name: 'Options de Développé couché' });
    fireEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveFocus();

    fireEvent.click(menu);
    expect(screen.getByRole('button', { name: 'Ajouter une série' })).toBeInTheDocument();
    // Un tap dans le menu ne le ferme pas ; un tap sur la carte « En cours » le ferme
    fireEvent.pointerDown(document.querySelector('.session-menu')!);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    fireEvent.pointerDown(currentSet());
    expect(menu).toHaveAttribute('aria-expanded', 'false');
  });

  it('série ajoutée au-delà de la dernière fois : pas de fausse référence', () => {
    const initial = stateWithTwoExercises();
    initial.sessions.push({
      id: 'old',
      templateId: 't2',
      name: 'Haut',
      startedAt: '2026-10-01T10:00:00.000Z',
      endedAt: '2026-10-01T11:00:00.000Z',
      exercises: [{ exerciseId: 'developpe-couche', sets: [{ weight: 70, reps: 8, done: true }, { weight: 72.5, reps: 6, done: true }] }],
    });
    renderApp(initial);
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Haut' }));
    fireEvent.click(screen.getByRole('button', { name: 'Options de Développé couché' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une série' }));
    expect(currentSet()).toHaveTextContent('Dernière fois : 70 kg × 8');
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    expect(currentSet()).toHaveTextContent('Dernière fois : 72,5 kg × 6');
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    expect(currentSet()).toHaveTextContent('Série 3 sur 3');
    expect(currentSet()).toHaveTextContent('Série en plus : 2 séries la dernière fois.');
    expect(currentSet()).not.toHaveTextContent('Dernière fois :');
  });

  it('passage auto : saute un exercice déjà terminé', () => {
    const initial = stateWithTwoExercises();
    initial.activeSession = {
      id: 'a',
      templateId: 't2',
      name: 'Haut',
      startedAt: new Date().toISOString(),
      currentExerciseIndex: 0,
      exercises: [
        { exerciseId: 'developpe-couche', sets: [{ weight: 60, reps: 10, done: false }] },
        { exerciseId: 'tractions', sets: [{ weight: 0, reps: 8, done: true }] },
        { exerciseId: 'dips', sets: [{ weight: 0, reps: 10, done: false }] },
      ],
    };
    window.location.hash = '#/seance';
    renderApp(initial);
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    expect(screen.getByText('Exercice 3 sur 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dips' })).toBeInTheDocument();
  });

  it('séance libre vide : abandon accessible sans menu, zone de retour présente dans l’arbre', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Séance libre' }));
    const status = pageStatus();
    expect(status).toBeEmptyDOMElement();
    expect(status).toHaveClass('visually-hidden');
    // Zone du toast présente et vide, dans le bas d'écran
    expect(toastRegion()).toBeEmptyDOMElement();
    expect(toastRegion().closest('.session-dock')).not.toBeNull();
    const abandonButton = screen.getByRole('button', { name: 'Abandonner la séance' });
    expect(abandonButton).toHaveClass('btn--danger-ghost');
    fireEvent.click(abandonButton);
    expect(dialog().getByRole('heading', { name: 'Abandonner la séance ?' })).toBeInTheDocument();
  });

  it('charge au plafond : « + » ne dépasse pas MAX_WEIGHT', () => {
    const { saved } = renderApp(stateWithTwoExercises());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Haut' }));
    const weight = screen.getByRole('textbox', { name: 'Charge (kg)' });
    fireEvent.change(weight, { target: { value: String(MAX_WEIGHT) } });
    fireEvent.click(screen.getByRole('button', { name: 'Charge (kg) : plus 2,5' }));
    expect(weight).toHaveValue(String(MAX_WEIGHT));
    expect(saved().activeSession?.exercises[0].sets[0].weight).toBe(MAX_WEIGHT);
  });

  it('un rechargement ramène au même exercice et à la même série', () => {
    const first = renderApp(stateWithTwoExercises());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Haut' }));
    fireEvent.click(screen.getByRole('button', { name: /^Exercice suivant/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    const saved = first.saved();
    expect(saved.activeSession?.currentExerciseIndex).toBe(1);
    first.unmount();

    window.location.hash = '#/seance';
    renderApp(saved);
    expect(screen.getByText('Exercice 2 sur 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tractions' })).toBeInTheDocument();
    expect(currentSet()).toHaveTextContent('Série 2 sur 2');
  });

  it('séance enregistrée avant ce mode (sans currentExerciseIndex) : reprise au premier exercice', () => {
    const initial = stateWithTwoExercises();
    initial.activeSession = {
      id: 'old',
      templateId: 't2',
      name: 'Haut',
      startedAt: new Date().toISOString(),
      exercises: [
        { exerciseId: 'developpe-couche', sets: [{ weight: 60, reps: 10, done: true }, { weight: 60, reps: 10, done: false }] },
        { exerciseId: 'tractions', sets: [{ weight: 0, reps: 8, done: false }] },
      ],
    };
    window.location.hash = '#/seance';
    renderApp(initial);
    expect(screen.getByText('Exercice 1 sur 2')).toBeInTheDocument();
    expect(currentSet()).toHaveTextContent('Série 2 sur 2');
  });

  it('/seance sans séance active redirige vers /seances', () => {
    window.location.hash = '#/seance';
    renderApp();
    expect(screen.getByRole('heading', { name: 'Séances' })).toBeInTheDocument();
  });

  it('menu d’une séance type : dupliquer, supprimer (immédiat) puis annuler', () => {
    const { saved } = renderApp(stateWithTemplate());
    fireEvent.click(screen.getByRole('button', { name: 'Options de Jambes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dupliquer' }));
    expect(screen.getByRole('heading', { name: 'Jambes (copie)' })).toBeInTheDocument();

    // Supprimer la première : plus de modale, toast « Séance supprimée : Jambes. »
    const before = saved();
    fireEvent.click(screen.getByRole('button', { name: 'Options de Jambes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Jambes' })).not.toBeInTheDocument();
    expect(saved().templates.map((t) => t.name)).toEqual(['Jambes (copie)']);
    expect(toastRegion()).toHaveAttribute('role', 'status');
    expect(toastRegion()).toContainElement(toastEl());
    expect(toastEl()).toHaveTextContent('Séance supprimée : Jambes.');

    // Annuler : elle revient à sa place, état strictement identique
    undo();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Jambes', 'Jambes (copie)']);
    expect(saved()).toEqual(before);
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('modifie une séance type existante', () => {
    const { saved } = renderApp(stateWithTemplate());
    fireEvent.click(screen.getByRole('button', { name: 'Options de Jambes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    expect(screen.getByRole('textbox', { name: 'Nom' })).toHaveValue('Jambes');
    // Constructeur plein écran : pas de barre d'onglets ; « Annuler » en lien en haut à gauche ;
    // « Enregistrer la séance » (56 px, accent, pleine largeur) dans la barre fixe du bas.
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Enregistrer la séance' });
    const cancel = screen.getByRole('button', { name: 'Annuler' });
    expect(save).toHaveClass('btn--primary', 'btn--lg', 'btn--block');
    expect(save.closest('.editor-dock')).not.toBeNull();
    expect(cancel).toHaveClass('back-link');
    expect(cancel.closest('.editor-dock')).toBeNull();
    expect(cancel.compareDocumentPosition(screen.getByRole('heading', { level: 1 })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Nom' }), { target: { value: 'Legs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la séance' }));
    expect(saved().templates[0].name).toBe('Legs');
  });

  it('éditeur : séries ≥ 1 et « Annuler » demande confirmation s’il y a des modifications', () => {
    const { saved } = renderApp(stateWithTemplate());
    fireEvent.click(screen.getByRole('button', { name: 'Options de Jambes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));

    // Sans modification : retour direct
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('heading', { name: 'Séances' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Options de Jambes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: 'Séries : moins 1' }));
    expect(screen.getByLabelText('Séries')).toHaveValue('1');

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(dialog().getByRole('heading', { name: 'Abandonner les modifications ?' })).toBeInTheDocument();
    fireEvent.click(dialog().getByRole('button', { name: 'Continuer l’édition' }));
    expect(screen.getByLabelText('Séries')).toHaveValue('1');

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Abandonner' }));
    expect(screen.getByRole('heading', { name: 'Séances' })).toBeInTheDocument();
    expect(saved().templates[0].exercises[0].targetSets).toBe(3);
  });
});

describe('toast « Annuler » (lot 3)', () => {
  afterEach(() => vi.useRealTimers());

  it('séance : « Supprimer la dernière série » puis Annuler restaure la série et ses valeurs', () => {
    const { saved } = renderApp(stateWithTwoExercises());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Haut' }));
    fireEvent.click(screen.getByRole('button', { name: 'Charge (kg) : plus 2,5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    // Retour sur l'exercice 1 (2 séries faites), dont on supprime la dernière
    fireEvent.click(screen.getByRole('button', { name: /^Exercice précédent/ }));
    const before = saved().activeSession;
    fireEvent.click(screen.getByRole('button', { name: 'Options de Développé couché' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la dernière série' }));
    expect(seriesOf('Développé couché')).toHaveLength(1);
    expect(toastEl()).toHaveTextContent('Série 2 supprimée.');
    // Toast dans le bas d'écran, au-dessus du bouton principal (jamais par-dessus)
    const dock = document.querySelector('.session-dock')!;
    const primary = within(dock as HTMLElement).getByRole('button', { name: 'Exercice suivant' });
    expect(dock.contains(toastEl())).toBe(true);
    expect(toastEl().compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    undo();
    expect(seriesOf('Développé couché')).toHaveLength(2);
    expect(saved().activeSession).toEqual(before);
    expect(screen.getByRole('button', { name: /^Corriger la série 2 : 60\skg × 10, faite$/ })).toBeInTheDocument();
  });

  it('séance : « Retirer cet exercice » puis Annuler restaure sa position et l’exercice affiché', () => {
    const { saved } = renderApp(stateWithTwoExercises());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Haut' }));
    fireEvent.click(screen.getByRole('button', { name: /^Exercice suivant/ }));
    const before = saved().activeSession;
    expect(before?.currentExerciseIndex).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Options de Tractions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retirer cet exercice' }));
    expect(screen.getByText('Exercice 1 sur 1')).toBeInTheDocument();
    expect(toastEl()).toHaveTextContent('Exercice retiré : tractions.');

    undo();
    expect(screen.getByText('Exercice 2 sur 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tractions' })).toBeInTheDocument();
    expect(saved().activeSession).toEqual(before);
  });

  it('historique : suppression depuis le détail, le toast suit vers la liste, Annuler restaure', () => {
    const initial = stateWithTemplate();
    initial.sessions.push(
      { id: 'h1', templateId: 't1', name: 'Jambes', startedAt: '2026-10-01T10:00:00.000Z', endedAt: '2026-10-01T11:00:00.000Z', exercises: [{ exerciseId: 'squat', sets: [{ weight: 100, reps: 5, done: true }] }] },
      { id: 'h2', name: 'Libre', startedAt: '2026-10-02T10:00:00.000Z', endedAt: '2026-10-02T11:00:00.000Z', exercises: [{ exerciseId: 'dips', sets: [{ weight: 0, reps: 10, done: true }] }] },
    );
    window.location.hash = '#/historique/h1';
    const { saved } = renderApp(initial);
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la séance' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Historique' })).toBeInTheDocument();
    expect(saved().sessions.map((x) => x.id)).toEqual(['h2']);
    expect(toastEl()).toHaveTextContent('Séance supprimée : Jambes.');
    // Toast flottant au-dessus de la barre d'onglets
    expect(toastRegion()).toHaveClass('toast-region--floating', 'toast-region--above-tabbar');

    undo();
    expect(saved()).toEqual(initial);
    expect(screen.getByRole('link', { name: /Jambes/ })).toBeInTheDocument();
  });

  it('constructeur : retirer un exercice puis Annuler le remet à sa place avec ses objectifs', () => {
    const initial = createDefaultState();
    initial.templates.push(
      createTemplate(
        {
          name: 'Haut',
          exercises: [
            { ...createTemplateExercise('developpe-couche'), targetSets: 5 },
            { ...createTemplateExercise('tractions'), targetReps: 6 },
            createTemplateExercise('dips'),
          ],
        },
        new Date('2026-10-01T10:00:00Z'),
        't1',
      ),
    );
    window.location.hash = '#/seances/t1';
    renderApp(initial);
    const names = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    fireEvent.click(screen.getByRole('button', { name: 'Retirer Tractions' }));
    expect(names()).toEqual(['Développé couché', 'Dips']);
    expect(toastEl()).toHaveTextContent('Exercice retiré : tractions.');
    // Toast dans la barre fixe, au-dessus de « Enregistrer la séance »
    expect(toastEl().closest('.editor-dock')).not.toBeNull();

    undo();
    expect(names()).toEqual(['Développé couché', 'Tractions', 'Dips']);
    expect(screen.getAllByLabelText('Reps').map((el) => (el as HTMLInputElement).value)).toEqual(['10', '6', '10']);
    // Rien n'a changé : « Annuler » (quitter) ne demande pas de confirmation
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('heading', { name: 'Séances' })).toBeInTheDocument();
  });

  it('se ferme seul après 5 s ; la suppression reste effective', () => {
    vi.useFakeTimers();
    const { saved } = renderApp(stateWithTemplate());
    fireEvent.click(screen.getByRole('button', { name: 'Options de Jambes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(toastEl()).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS - 100);
    });
    expect(document.querySelector('.toast')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(document.querySelector('.toast')).toBeNull();
    expect(saved().templates).toEqual([]);
  });

  it('naviguer ailleurs pendant le toast : la suppression reste effective', () => {
    const { saved } = renderApp(stateWithTemplate());
    fireEvent.click(screen.getByRole('button', { name: 'Options de Jambes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    fireEvent.click(screen.getByRole('link', { name: 'Historique' }));
    expect(screen.getByRole('heading', { name: 'Historique' })).toBeInTheDocument();
    expect(saved().templates).toEqual([]);
  });

  it('séance : le toast disparaît quand on quitte l’écran (fin de séance), la suppression reste', () => {
    const { saved } = renderApp(stateWithTwoExercises());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Haut' }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    fireEvent.click(screen.getByRole('button', { name: 'Options de Développé couché' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la dernière série' }));
    expect(toastEl()).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Terminer la séance' }));
    expect(screen.getByRole('button', { name: 'Voir mes progrès' })).toBeInTheDocument();
    expect(document.querySelector('.toast')).toBeNull();
    expect(saved().sessions[0].exercises[0].sets).toHaveLength(1);
  });
});

describe('restes des revues', () => {
  it('« Exercice suivant » (bouton principal) saute un exercice déjà terminé, comme le passage auto', () => {
    const initial = stateWithTwoExercises();
    initial.activeSession = {
      id: 'a',
      templateId: 't2',
      name: 'Haut',
      startedAt: new Date().toISOString(),
      currentExerciseIndex: 0,
      exercises: [
        { exerciseId: 'developpe-couche', sets: [{ weight: 60, reps: 10, done: true }] },
        { exerciseId: 'tractions', sets: [{ weight: 0, reps: 8, done: true }] },
        { exerciseId: 'dips', sets: [{ weight: 0, reps: 10, done: false }] },
      ],
    };
    window.location.hash = '#/seance';
    renderApp(initial);
    const primary = screen.getByRole('button', { name: 'Exercice suivant' });
    expect(primary).toHaveClass('btn--primary');
    fireEvent.click(primary);
    expect(screen.getByText('Exercice 3 sur 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dips' })).toBeInTheDocument();
  });

  it('correction en cours puis action du menu ⋯ : la correction est abandonnée', () => {
    const { saved } = renderApp(stateWithTwoExercises());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la séance Haut' }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    fireEvent.click(screen.getByRole('button', { name: /^Corriger la série 1/ }));
    expect(currentSet()).toHaveTextContent('En correction');
    fireEvent.click(screen.getByRole('button', { name: 'Options de Développé couché' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une série' }));
    // Retour à la série en cours ; la série 1 reste faite, avec ses valeurs
    expect(currentSet()).toHaveTextContent('Série 2 sur 3');
    expect(currentSet()).toHaveTextContent('En cours');
    expect(screen.getByRole('button', { name: 'Valider la série' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer la correction' })).not.toBeInTheDocument();
    expect(saved().activeSession?.exercises[0].sets[0]).toEqual({ weight: 60, reps: 10, done: true });
  });
});

describe('onglet Séances (lot 4)', () => {
  afterEach(() => vi.useRealTimers());

  function stateWithThreeTemplates(): AppState {
    const s = createDefaultState();
    const at = new Date('2026-10-01T10:00:00Z');
    s.templates.push(
      createTemplate({ name: 'Push', exercises: [{ ...createTemplateExercise('developpe-couche'), targetSets: 4 }] }, at, 'ta'),
      createTemplate({ name: 'Pull', exercises: [createTemplateExercise('tractions'), createTemplateExercise('rowing-barre')] }, at, 'tb'),
      createTemplate({ name: 'Jambes', exercises: [createTemplateExercise('squat')] }, at, 'tc'),
    );
    const done = (id: string, templateId: string, day: number) => ({
      id,
      templateId,
      name: id,
      startedAt: new Date(2026, 9, day, 18).toISOString(),
      endedAt: new Date(2026, 9, day, 19).toISOString(),
      exercises: [{ exerciseId: 'squat', sets: [{ weight: 100, reps: 5, done: true }] }],
    });
    // Push faite il y a 3 jours, Pull il y a 7 jours, Jambes jamais
    s.sessions.push(done('s1', 'ta', 25), done('s2', 'tb', 21));
    return s;
  }

  it('cartes : nombre d’exercices, durée estimée, dernier passage ; un seul bouton accent', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 28, 12, 0));
    renderApp(stateWithThreeTemplates());
    const cards = screen.getAllByRole('listitem');
    // La carte suggérée (Pull) passe en tête ; les autres gardent leur ordre (Push, Jambes)
    expect(cards.map((c) => within(c).getByRole('heading').textContent)).toEqual(['Pull', 'Push', 'Jambes']);
    expect(cards[0]).toHaveTextContent(/2 exercices · ≈ 15 min/);
    expect(cards[0]).toHaveTextContent('Faite il y a 7 jours');
    expect(cards[1]).toHaveTextContent(/1 exercice · ≈ 10 min/);
    expect(cards[1]).toHaveTextContent('Faite il y a 3 jours');
    expect(cards[2]).toHaveTextContent('Jamais faite');

    // Accent unique : la séance faite il y a le plus longtemps (Pull)
    const accents = document.querySelectorAll('.btn--primary');
    expect(accents).toHaveLength(1);
    expect(accents[0]).toHaveAccessibleName('Démarrer la séance Pull');
    expect(accents[0]).toHaveTextContent('Démarrer la séance');
    expect(within(cards[0]).getByText('Suggérée')).toBeInTheDocument();
    for (const name of ['Push', 'Jambes']) {
      const btn = screen.getByRole('button', { name: `Démarrer la séance ${name}` });
      expect(btn).toHaveTextContent(/^Démarrer$/);
      expect(btn).not.toHaveClass('btn--primary');
    }
    // « Créer une séance » en contour quand des séances existent
    expect(screen.getByRole('link', { name: 'Créer une séance' })).not.toHaveClass('btn--primary');
  });

  it('état vide : « Créer une séance » est l’unique accent', () => {
    renderApp();
    const accents = document.querySelectorAll('.btn--primary');
    expect(accents).toHaveLength(1);
    expect(accents[0]).toHaveTextContent('Créer une séance');
  });

  it('Réglages : bouton nommé dans l’en-tête, page plein écran, retour « Séances » ; export en 2 taps', () => {
    renderApp(stateWithTemplate());
    const settings = screen.getByRole('link', { name: 'Réglages' });
    expect(settings.closest('.page-header')).not.toBeNull();
    expect(settings.querySelector('svg')).not.toBeNull();
    fireEvent.click(settings); // tap 1
    expect(screen.getByRole('heading', { name: 'Réglages' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exporter mes données' })).toBeInTheDocument(); // tap 2
    fireEvent.click(screen.getByRole('link', { name: 'Séances' }));
    expect(screen.getByRole('heading', { name: 'Séances' })).toBeInTheDocument();
  });
});
