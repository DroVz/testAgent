import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { STORAGE_KEY, createDefaultState, exportState, type StorageLike } from '../lib/storage';
import { createTemplate, createTemplateExercise } from '../lib/templates';
import type { AppState, WorkoutSession } from '../lib/types';
import { AppStoreProvider } from '../state/AppStore';
import { PROGRESS_EXERCISE_KEY } from './ProgressPage';

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

const dialog = () => within(screen.getByRole('dialog'));

function session(id: string, name: string, day: number, exercises: WorkoutSession['exercises'], notes?: string): WorkoutSession {
  const s: WorkoutSession = {
    id,
    name,
    startedAt: new Date(2026, 9, day, 18, 0).toISOString(),
    endedAt: new Date(2026, 9, day, 19, 5).toISOString(),
    exercises,
  };
  if (notes) s.notes = notes;
  return s;
}

/** Deux séances en octobre 2026 : le 5 (Squat + Développé couché) et le 26 (Squat). */
function stateWithHistory(): AppState {
  const s = createDefaultState();
  s.sessions.push(
    session('s-old', 'Full body', 5, [
      { exerciseId: 'squat', sets: [{ weight: 100, reps: 5, done: true }] },
      { exerciseId: 'developpe-couche', sets: [{ weight: 70, reps: 8, done: true }] },
    ]),
    session(
      's-new',
      'Jambes',
      26,
      [
        {
          exerciseId: 'squat',
          sets: [
            { weight: 110, reps: 5, done: true },
            { weight: 100, reps: 8, done: true },
          ],
        },
      ],
      'Bonne forme',
    ),
  );
  return s;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('historique', () => {
  it('état vide accueillant', () => {
    renderAt('#/historique');
    expect(screen.getByText('Aucune séance enregistrée')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aller aux séances' })).toBeInTheDocument();
  });

  it('liste du plus récent au plus ancien, avec durée, volume et nombre d’exercices', () => {
    renderAt('#/historique', stateWithHistory());
    const items = screen.getAllByRole('link', { name: /Full body|Jambes/ });
    expect(items.map((a) => a.querySelector('.history-item__name')?.textContent)).toEqual(['Jambes', 'Full body']);
    expect(items[0]).toHaveTextContent('1 h 05 · 1 350 kg · 1 exercice');
    expect(items[1]).toHaveTextContent('1 h 05 · 1 060 kg · 2 exercices');
  });

  it('détail d’une séance puis suppression avec confirmation', () => {
    const { saved } = renderAt('#/historique', stateWithHistory());
    fireEvent.click(screen.getByRole('link', { name: /Jambes/ }));
    expect(screen.getByRole('heading', { name: 'Jambes' })).toBeInTheDocument();
    const sets = screen.getByRole('list', { name: 'Séries de Squat' });
    expect(within(sets).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Série 1110 kg × 5',
      'Série 2100 kg × 8',
    ]);
    expect(screen.getByText('Bonne forme')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la séance' }));
    // Annuler ne supprime rien
    fireEvent.click(dialog().getByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('heading', { name: 'Jambes' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la séance' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Supprimer' }));
    expect(screen.getByRole('heading', { name: 'Historique' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Jambes/ })).not.toBeInTheDocument();
    expect(saved().sessions.map((s) => s.id)).toEqual(['s-old']);
  });

  it('identifiant inexistant : message et retour', () => {
    renderAt('#/historique/inconnu', stateWithHistory());
    expect(screen.getByRole('heading', { name: 'Séance introuvable' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Retour à l’historique' }));
    expect(screen.getByRole('heading', { name: 'Historique' })).toBeInTheDocument();
  });
});

describe('progrès', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 28, 12, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('état vide si aucun historique', () => {
    renderAt('#/progres');
    expect(screen.getByText('Pas encore de progression à afficher')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('stats globales, exercice par défaut, records et graphique', () => {
    renderAt('#/progres', stateWithHistory());
    const stat = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling;
    expect(stat('Séances')).toHaveTextContent('2');
    expect(stat('Cette semaine')).toHaveTextContent('1');
    expect(stat('Ce mois')).toHaveTextContent('2');

    // Exercice le plus récemment travaillé par défaut ; seuls les exercices avec historique sont proposés
    const select = screen.getByRole('combobox', { name: 'Exercice' });
    expect(select).toHaveValue('squat');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Développé couché', 'Squat']);

    expect(screen.getByRole('img')).toHaveAccessibleName(/^Poids max — Squat : 2 séances, dernière valeur 110 kg/);
    const prs = screen.getByRole('heading', { name: 'Records personnels' }).parentElement!;
    expect(within(prs).getByText('Meilleur poids').nextElementSibling).toHaveTextContent('110 kg');
    // 1RM : max(110 × (1 + 5/30), 100 × (1 + 8/30)) = 128,33 → arrondi au dixième
    expect(within(prs).getByText('Meilleur 1RM estimé').nextElementSibling).toHaveTextContent('128,3 kg');
    expect(within(prs).getByText('Meilleur volume (séance)').nextElementSibling).toHaveTextContent('1 350 kg');
  });

  it('bascule de métrique et sélection d’exercice mémorisée', () => {
    const { unmount } = renderAt('#/progres', stateWithHistory());
    const metric = within(screen.getByRole('group', { name: 'Métrique' }));
    fireEvent.click(metric.getByRole('button', { name: 'Volume' }));
    expect(metric.getByRole('button', { name: 'Volume' })).toHaveAttribute('aria-pressed', 'true');
    expect(metric.getByRole('button', { name: 'Poids max' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('img')).toHaveAccessibleName(/^Volume — Squat : .*1\s350 kg/);

    fireEvent.click(metric.getByRole('button', { name: '1RM estimé' }));
    expect(screen.getByRole('img')).toHaveAccessibleName(/^1RM estimé — Squat : .*128,3 kg/);

    fireEvent.change(screen.getByRole('combobox', { name: 'Exercice' }), { target: { value: 'developpe-couche' } });
    // Un seul point : graphique quand même, avec une indication
    expect(screen.getByRole('img')).toHaveAccessibleName(/Développé couché : 1 séance/);
    expect(screen.getByText(/Une seule séance pour l’instant/)).toBeInTheDocument();
    expect(localStorage.getItem(PROGRESS_EXERCISE_KEY)).toBe('developpe-couche');

    unmount();
    renderAt('#/progres', stateWithHistory());
    expect(screen.getByRole('combobox', { name: 'Exercice' })).toHaveValue('developpe-couche');
  });

  it('exercice mémorisé sans historique : retour à l’exercice par défaut', () => {
    localStorage.setItem(PROGRESS_EXERCISE_KEY, 'curl-biceps');
    renderAt('#/progres', stateWithHistory());
    expect(screen.getByRole('combobox', { name: 'Exercice' })).toHaveValue('squat');
  });
});

describe('réglages', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('export : téléchargement JSON nommé, texte affiché et copie', async () => {
    const createObjectURL = vi.fn(() => 'blob:muscutrack');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    const initial = stateWithHistory();
    renderAt('#/reglages', initial);
    expect(screen.getByText(/stockées uniquement sur cet appareil/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Exporter mes données' }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatch(/^muscutrack-\d{4}-\d{2}-\d{2}\.json$/);
    const text = screen.getByLabelText('Données exportées (JSON)');
    expect(text).toHaveAttribute('readonly');
    expect(JSON.parse((text as HTMLTextAreaElement).value)).toEqual(initial);

    fireEvent.click(screen.getByRole('button', { name: 'Copier' }));
    expect(await screen.findByText('Données copiées dans le presse-papiers.')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith((text as HTMLTextAreaElement).value);
  });

  it('export sans téléchargement ni presse-papiers : repli sur la sélection du texte', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: undefined }));
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    renderAt('#/reglages');
    fireEvent.click(screen.getByRole('button', { name: 'Exporter mes données' }));
    expect(screen.getByRole('status')).toHaveTextContent('Téléchargement indisponible');
    fireEvent.click(screen.getByRole('button', { name: 'Copier' }));
    expect(await screen.findByText(/le texte est sélectionné/)).toBeInTheDocument();
    expect(screen.getByLabelText('Données exportées (JSON)')).toHaveFocus();
  });

  it('import invalide : message clair, aucune donnée remplacée', () => {
    renderAt('#/reglages', stateWithHistory());
    const area = screen.getByRole('textbox', { name: 'Ou collez le contenu exporté' });
    expect(screen.getByRole('button', { name: 'Importer le texte' })).toBeDisabled();

    fireEvent.change(area, { target: { value: 'pas du json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Importer le texte' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Import impossible : Le contenu n’est pas un JSON valide.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.change(area, { target: { value: JSON.stringify({ version: 2 }) } });
    fireEvent.click(screen.getByRole('button', { name: 'Importer le texte' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Données invalides — version : version 1 attendu');
  });

  it('import valide (texte) : confirmation puis remplacement', () => {
    const { saved } = renderAt('#/reglages', stateWithHistory());
    const imported = createDefaultState();
    imported.templates.push(
      createTemplate({ name: 'Importée', exercises: [createTemplateExercise('squat')] }, new Date('2026-10-01T10:00:00Z'), 'ti'),
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Ou collez le contenu exporté' }), {
      target: { value: exportState(imported) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Importer le texte' }));
    expect(dialog().getByRole('heading', { name: 'Remplacer toutes les données ?' })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent('0 séance dans l’historique, 1 séance type');

    // Annuler : rien ne change
    fireEvent.click(dialog().getByRole('button', { name: 'Annuler' }));
    expect(saved().sessions).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Importer le texte' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Remplacer' }));
    expect(saved()).toEqual(imported);
    expect(screen.getByRole('status')).toHaveTextContent('Import réussi');
  });

  it('import par fichier ; une séance en cours est signalée dans la confirmation', async () => {
    const initial = stateWithHistory();
    initial.activeSession = { id: 'a1', name: 'Séance libre', startedAt: new Date().toISOString(), exercises: [] };
    const { saved } = renderAt('#/reglages', initial);
    const imported = createDefaultState();
    const file = new File([exportState(imported)], 'muscutrack-2026-10-01.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Choisir un fichier .json'), { target: { files: [file] } });

    expect(await screen.findByRole('dialog')).toHaveTextContent('La séance en cours « Séance libre » sera perdue.');
    fireEvent.click(dialog().getByRole('button', { name: 'Remplacer' }));
    expect(saved().sessions).toEqual([]);
    expect(saved().activeSession).toBeUndefined();
  });

  it('exercices personnalisés : renommer, changer de groupe, supprimer (usage signalé)', () => {
    const initial = stateWithHistory();
    initial.exercises.push({ id: 'custom-1', name: 'Pull-over', muscleGroup: 'Dos', isCustom: true });
    initial.templates.push(
      createTemplate({ name: 'Dos', exercises: [createTemplateExercise('custom-1')] }, new Date('2026-10-01T10:00:00Z'), 'td'),
    );
    const { saved } = renderAt('#/reglages', initial);

    fireEvent.click(screen.getByRole('button', { name: 'Modifier Pull-over' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nom' }), { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Le nom ne peut pas être vide.');
    fireEvent.change(screen.getByRole('textbox', { name: 'Nom' }), { target: { value: 'Pull-over haltère' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Groupe musculaire' }), { target: { value: 'Pectoraux' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(saved().exercises.find((e) => e.id === 'custom-1')).toMatchObject({
      name: 'Pull-over haltère',
      muscleGroup: 'Pectoraux',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer Pull-over haltère' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Il est utilisé dans 1 séance type');
    fireEvent.click(dialog().getByRole('button', { name: 'Supprimer' }));
    expect(saved().exercises.some((e) => e.id === 'custom-1')).toBe(false);
    expect(screen.getByText(/Aucun exercice personnalisé/)).toBeInTheDocument();
  });

  it('réinitialisation avec confirmation', () => {
    const { saved } = renderAt('#/reglages', stateWithHistory());
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser toutes les données' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Tout effacer' }));
    expect(saved()).toEqual(createDefaultState());
    expect(screen.getByText(/MuscuTrack v\d+\.\d+\.\d+/)).toBeInTheDocument();
  });
});
