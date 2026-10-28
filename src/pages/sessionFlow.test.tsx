import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
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

beforeEach(() => {
  window.location.hash = '';
  sessionStorage.clear();
});

describe('parcours séance', () => {
  it('crée une séance type, la démarre, valide une série et termine → résumé', () => {
    const { saved } = renderApp();

    // État vide accueillant
    expect(screen.getByText('Aucune séance type pour l’instant')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: '+ Nouvelle séance type' }));
    expect(screen.getByRole('heading', { name: 'Nouvelle séance type' })).toBeInTheDocument();

    // Nom obligatoire
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Donnez un nom à la séance.');
    fireEvent.change(screen.getByRole('textbox', { name: 'Nom' }), { target: { value: 'Push' } });

    // Ajout d'un exercice : recherche insensible aux accents
    fireEvent.click(screen.getByRole('button', { name: '+ Ajouter un exercice' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    // Liste des séances types
    expect(screen.getByRole('heading', { name: 'Push' })).toBeInTheDocument();
    expect(screen.getByText('1 exercice')).toBeInTheDocument();
    expect(saved().templates[0].exercises[0]).toMatchObject({ targetSets: 2, restSeconds: 60 });

    // Démarrer : écran plein, sans barre d'onglets
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer Push' }));
    expect(screen.getByRole('heading', { name: 'Push' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Valider la série/ })).toHaveLength(2);

    // Saisie et validation d'une série → minuteur de repos
    fireEvent.change(screen.getByLabelText('Poids série 1 – Développé couché'), { target: { value: '62,5' } });
    fireEvent.change(screen.getByLabelText('Reps série 1 – Développé couché'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série 1' }));
    expect(screen.getByRole('button', { name: 'Valider la série 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'Minuteur de repos' })).toHaveTextContent('01:00');
    expect(saved().activeSession?.exercises[0].sets[0]).toEqual({ weight: 62.5, reps: 8, done: true });

    // Terminer → résumé
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Terminer' }));
    expect(screen.getByRole('heading', { name: 'Séance terminée' })).toBeInTheDocument();
    expect(screen.getByText('500 kg')).toBeInTheDocument();
    expect(saved().sessions).toHaveLength(1);
    expect(saved().activeSession).toBeUndefined();
    expect(saved().sessions[0].exercises[0].sets).toEqual([{ weight: 62.5, reps: 8, done: true }]);

    // Mise à jour de la séance type
    fireEvent.click(screen.getByRole('button', { name: 'Mettre à jour la séance type avec ces poids' }));
    expect(screen.getByRole('status')).toHaveTextContent('mise à jour');
    expect(saved().templates[0].exercises[0].targetWeight).toBe(62.5);

    fireEvent.click(screen.getByRole('button', { name: 'Terminé' }));
    expect(screen.getByRole('heading', { name: 'Historique' })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer Jambes' }));
    // Pré-rempli avec la dernière fois
    expect(screen.getByText('Dernière fois : 1×5 @ 100 kg')).toBeInTheDocument();
    expect(screen.getByLabelText('Poids série 1 – Squat')).toHaveValue('100');
    fireEvent.change(screen.getByLabelText('Poids série 1 – Squat'), { target: { value: '110' } });
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Terminer' }));
    expect(screen.getByRole('heading', { name: 'Nouveaux records' })).toBeInTheDocument();
    expect(screen.getByText(/Poids max : 110 kg/)).toBeInTheDocument();
  });

  it('abandon : rien n’est enregistré', () => {
    const { saved } = renderApp(stateWithTemplate());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer Jambes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série 1' }));
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
    fireEvent.click(screen.getByRole('button', { name: '+ Ajouter un exercice' }));
    fireEvent.click(dialog().getByText('Squat', { selector: 'span' }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }));
    expect(dialog().getByRole('heading', { name: 'Aucune série validée' })).toBeInTheDocument();

    // « Continuer » : la séance reste en cours
    fireEvent.click(dialog().getByRole('button', { name: 'Continuer' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Abandonner la séance' }));
    expect(screen.getByRole('heading', { name: 'Séances' })).toBeInTheDocument();
    expect(saved().sessions).toEqual([]);
    expect(saved().activeSession).toBeUndefined();
  });

  it('retire un exercice et gère les séries', () => {
    const { saved } = renderApp(stateWithTemplate());
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer Jambes' }));
    expect(screen.getAllByRole('button', { name: /^Valider la série/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: '+ Série' }));
    expect(screen.getAllByRole('button', { name: /^Valider la série/ })).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la série 4' }));
    expect(screen.getAllByRole('button', { name: /^Valider la série/ })).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Retirer Squat' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Retirer' }));
    expect(screen.queryByRole('heading', { name: 'Squat' })).not.toBeInTheDocument();
    expect(saved().activeSession?.exercises).toEqual([]);
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
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer Jambes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série 1' }));
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

  it('/seance sans séance active redirige vers /seances', () => {
    window.location.hash = '#/seance';
    renderApp();
    expect(screen.getByRole('heading', { name: 'Séances' })).toBeInTheDocument();
  });

  it('menu d’une séance type : dupliquer et supprimer avec confirmation', () => {
    const { saved } = renderApp(stateWithTemplate());
    fireEvent.click(screen.getByRole('button', { name: 'Options de Jambes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dupliquer' }));
    expect(screen.getByRole('heading', { name: 'Jambes (copie)' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Options de Jambes (copie)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Supprimer' }));
    expect(screen.queryByRole('heading', { name: 'Jambes (copie)' })).not.toBeInTheDocument();
    expect(saved().templates.map((t) => t.name)).toEqual(['Jambes']);
  });

  it('modifie une séance type existante', () => {
    const { saved } = renderApp(stateWithTemplate());
    fireEvent.click(screen.getByRole('button', { name: 'Options de Jambes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    expect(screen.getByRole('textbox', { name: 'Nom' })).toHaveValue('Jambes');
    fireEvent.change(screen.getByRole('textbox', { name: 'Nom' }), { target: { value: 'Legs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
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
