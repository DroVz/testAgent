import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { STORAGE_KEY, createDefaultState, exportState, type StorageLike } from '../lib/storage';
import { createTemplate, createTemplateExercise } from '../lib/templates';
import type { AppState, WorkoutSession } from '../lib/types';
import { AppStoreProvider } from '../state/AppStore';
import { REST_TIMER_KEY } from '../lib/restTimer';
import { PROGRESS_EXERCISE_KEY } from './ProgressPage';
import { MAX_IMPORT_BYTES } from './SettingsPage';

function memoryStorage(initial?: AppState | string, { failWrites = false } = {}) {
  const data: Record<string, string> =
    initial === undefined ? {} : { [STORAGE_KEY]: typeof initial === 'string' ? initial : JSON.stringify(initial) };
  const storage: StorageLike = {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      if (failWrites) throw new Error('QuotaExceededError');
      data[k] = v;
    },
  };
  const saved = (): AppState => JSON.parse(data[STORAGE_KEY]);
  return { storage, saved };
}

function renderAt(hash: string, initial?: AppState | string, options?: { failWrites?: boolean }) {
  window.location.hash = hash;
  const mem = memoryStorage(initial, options);
  const { unmount } = render(
    <AppStoreProvider storage={mem.storage}>
      <App />
    </AppStoreProvider>,
  );
  return { ...mem, unmount };
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

  it('détail d’une séance puis suppression immédiate, annulable par le toast', () => {
    const { saved } = renderAt('#/historique', stateWithHistory());
    fireEvent.click(screen.getByRole('link', { name: /Jambes/ }));
    expect(screen.getByRole('heading', { name: 'Jambes' })).toBeInTheDocument();
    const sets = screen.getByRole('list', { name: 'Séries de Squat' });
    // Espace insécable entre le nombre et l'unité
    expect(within(sets).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Série 1110\u00a0kg × 5',
      'Série 2100\u00a0kg × 8',
    ]);
    expect(screen.getByText('Bonne forme')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la séance' }));
    // Plus de modale : suppression immédiate, retour à la liste, toast « Annuler »
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Historique' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Jambes/ })).not.toBeInTheDocument();
    expect(saved().sessions.map((s) => s.id)).toEqual(['s-old']);
    const toast = toastRegion();
    expect(toast).toHaveAttribute('role', 'status');
    expect(toast).toHaveTextContent('Séance supprimée : Jambes.');
    const undo = within(toast).getByRole('button', { name: 'Annuler la suppression' });
    expect(undo).toHaveTextContent('Annuler');
    fireEvent.click(undo);
    expect(saved().sessions.map((s) => s.id)).toEqual(['s-old', 's-new']);
    expect(screen.getByRole('link', { name: /Jambes/ })).toBeInTheDocument();
    // Zone toujours présente, vide une fois le toast fermé
    expect(toastRegion()).toBeEmptyDOMElement();
  });

  it('identifiant inexistant : message et retour', () => {
    renderAt('#/historique/inconnu', stateWithHistory());
    expect(screen.getByRole('heading', { name: 'Séance introuvable' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Retour à l’historique' }));
    expect(screen.getByRole('heading', { name: 'Historique' })).toBeInTheDocument();
  });
});

describe('progrès', () => {
  /** Graphique (« <métrique> — <exercice> : … ») : l'autre image de la page est le logotype de l'en-tête de marque. */
  const CHART = / — /;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 28, 12, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('état vide si aucun historique', () => {
    renderAt('#/progres');
    expect(screen.getByText('Pas encore de progression à afficher')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: CHART })).not.toBeInTheDocument();
    // Robuste au libellé : aucun graphique, et la seule image est le logotype de l'en-tête.
    expect(document.querySelector('.chart')).toBeNull();
    expect(screen.queryAllByRole('img').filter((img) => !img.closest('.brand-header'))).toEqual([]);
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

    // 1RM estimé par défaut, arrondi à 0,5 kg : 110 × (1 + 5/30) = 128,33 → 128,5 kg
    expect(screen.getByRole('img', { name: CHART })).toHaveAccessibleName(/^1RM estimé — Squat : 2 séances, dernière valeur 128,5\skg/);
    const prs = screen.getByRole('heading', { name: 'Records personnels' }).parentElement!;
    expect(within(prs).getByText('Meilleur poids').nextElementSibling).toHaveTextContent('110 kg');
    // 1RM : max(110 × (1 + 5/30), 100 × (1 + 8/30)) = 128,33 → arrondi à 0,5 kg
    expect(within(prs).getByText('Meilleur 1RM estimé').nextElementSibling).toHaveTextContent('128,5 kg');
    expect(within(prs).getByText('Meilleur volume (séance)').nextElementSibling).toHaveTextContent('1 350 kg');
  });

  it('bascule de métrique et sélection d’exercice mémorisée', () => {
    const { unmount } = renderAt('#/progres', stateWithHistory());
    const metric = within(screen.getByRole('group', { name: 'Métrique' }));
    // 1RM estimé par défaut ; choix secondaire sans accent
    expect(metric.getByRole('button', { name: '1RM estimé' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(metric.getByRole('button', { name: 'Volume' }));
    expect(metric.getByRole('button', { name: 'Volume' })).toHaveAttribute('aria-pressed', 'true');
    expect(metric.getByRole('button', { name: 'Poids max' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('img', { name: CHART })).toHaveAccessibleName(/^Volume — Squat : .*1\s350\skg/);

    fireEvent.click(metric.getByRole('button', { name: 'Poids max' }));
    expect(screen.getByRole('img', { name: CHART })).toHaveAccessibleName(/^Poids max — Squat : .*110\skg/);
    fireEvent.click(metric.getByRole('button', { name: '1RM estimé' }));
    expect(screen.getByRole('img', { name: CHART })).toHaveAccessibleName(/^1RM estimé — Squat : .*128,5\skg/);

    fireEvent.change(screen.getByRole('combobox', { name: 'Exercice' }), { target: { value: 'developpe-couche' } });
    // Un seul point : graphique quand même, avec une indication
    expect(screen.getByRole('img', { name: CHART })).toHaveAccessibleName(/Développé couché : 1 séance/);
    expect(screen.getByText(/Une seule séance pour l’instant/)).toBeInTheDocument();
    expect(localStorage.getItem(PROGRESS_EXERCISE_KEY)).toBe('developpe-couche');

    unmount();
    renderAt('#/progres', stateWithHistory());
    expect(screen.getByRole('combobox', { name: 'Exercice' })).toHaveValue('developpe-couche');
  });

  it('phrase qui résume au-dessus du graphique (première vs dernière valeur)', () => {
    renderAt('#/progres', stateWithHistory());
    // 1RM squat : 5 oct. 100 × (1 + 5/30) = 116,67 → 116,5 ; 26 oct. 128,33 → 128,5 : +12 kg en 3 semaines
    const sentence = document.querySelector('.progress-sentence');
    expect(sentence).toHaveTextContent('1RM estimé : +12 kg en 3 semaines');
    expect(sentence!.compareDocumentPosition(screen.getByRole('img', { name: CHART })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const metric = within(screen.getByRole('group', { name: 'Métrique' }));
    fireEvent.click(metric.getByRole('button', { name: 'Poids max' }));
    expect(document.querySelector('.progress-sentence')).toHaveTextContent('+10 kg en 3 semaines');
    // Un seul point
    fireEvent.change(screen.getByRole('combobox', { name: 'Exercice' }), { target: { value: 'developpe-couche' } });
    expect(document.querySelector('.progress-sentence')).toHaveTextContent('Première séance enregistrée');
  });

  it('baisse : le chiffre seul en 24 px, la relativisation dessous en texte secondaire', () => {
    const s = stateWithHistory();
    // Squat : 26 oct. 1RM 128,5 → ajout d'une séance le 27 oct. à 90 × 5 (1RM 105) : baisse
    s.sessions.push(session('s-down', 'Jambes', 27, [{ exerciseId: 'squat', sets: [{ weight: 90, reps: 5, done: true }] }]));
    renderAt('#/progres', s);
    const headline = document.querySelector('.progress-sentence');
    // 5 oct. 116,5 → 27 oct. 105 : −11,5 kg en 3 semaines
    expect(headline).toHaveTextContent(/^1RM estimé : −11,5 kg en 3 semaines$/);
    const note = document.querySelector('.progress-note');
    expect(note).toHaveTextContent('Ça arrive, la prochaine séance compte.');
    expect(note).toHaveClass('muted');
    expect(headline).not.toContainElement(note as HTMLElement);
  });

  it('records : même structure sur chaque ligne (libellé, valeur, date)', () => {
    renderAt('#/progres', stateWithHistory());
    const rows = document.querySelectorAll('.pr-list__row');
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.querySelector('.pr-list__label')).not.toBeNull();
      expect(row.querySelector('.pr-list__number')).not.toBeNull();
      expect(row.querySelector('.pr-list__date')).not.toBeNull();
    }
  });

  it('première visite : exercice principal de la dernière séance (le premier), pas un exercice secondaire', () => {
    const s = stateWithHistory();
    s.sessions.push(
      session('s-last', 'Dos', 27, [
        { exerciseId: 'tractions', sets: [{ weight: 0, reps: 8, done: true }] },
        { exerciseId: 'curl-barre', sets: [{ weight: 12, reps: 10, done: true }] },
      ]),
    );
    renderAt('#/progres', s);
    expect(screen.getByRole('combobox', { name: 'Exercice' })).toHaveValue('tractions');
  });

  it('plusieurs exercices supprimés : distingués dans le sélecteur', () => {
    const s = stateWithHistory();
    s.sessions.push(
      session('s-del', 'Ancienne', 12, [
        { exerciseId: 'custom-a', sets: [{ weight: 20, reps: 10, done: true }] },
        { exerciseId: 'custom-b', sets: [{ weight: 30, reps: 10, done: true }] },
      ]),
    );
    renderAt('#/progres', s);
    const options = within(screen.getByRole('combobox', { name: 'Exercice' }))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toContain('Exercice supprimé (1)');
    expect(options).toContain('Exercice supprimé (2)');
    expect(options).not.toContain('Exercice supprimé');
  });

  it('un seul exercice supprimé : libellé sans numéro', () => {
    const s = stateWithHistory();
    s.sessions.push(session('s-del', 'Ancienne', 12, [{ exerciseId: 'custom-a', sets: [{ weight: 20, reps: 10, done: true }] }]));
    renderAt('#/progres', s);
    const select = within(screen.getByRole('combobox', { name: 'Exercice' }));
    expect(select.getByRole('option', { name: 'Exercice supprimé' })).toBeInTheDocument();
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
    expect(pageStatus()).toHaveTextContent('Téléchargement indisponible');
    fireEvent.click(screen.getByRole('button', { name: 'Copier' }));
    expect(await screen.findByText(/le texte est sélectionné/)).toBeInTheDocument();
    expect(screen.getByLabelText('Données exportées (JSON)')).toHaveFocus();
  });

  it('import invalide : message clair, aucune donnée remplacée', () => {
    renderAt('#/reglages', stateWithHistory());
    const area = screen.getByRole('textbox', { name: 'Ou colle le contenu exporté' });
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
    fireEvent.change(screen.getByRole('textbox', { name: 'Ou colle le contenu exporté' }), {
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
    expect(pageStatus()).toHaveTextContent('Import réussi');
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

  it('import pendant un toast « Annuler » : le toast est fermé, rien n’est réinjecté', () => {
    const initial = stateWithHistory();
    initial.templates.push(
      createTemplate({ name: 'Push', exercises: [createTemplateExercise('squat')] }, new Date('2026-10-01T10:00:00Z'), 'tp'),
    );
    const { saved } = renderAt('#/seances', initial);
    fireEvent.click(screen.getByRole('button', { name: 'Options de Push' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    // Le toast suit vers Réglages
    fireEvent.click(screen.getByRole('link', { name: 'Réglages' }));
    expect(toastRegion()).toHaveTextContent('Séance supprimée : Push.');
    fireEvent.change(screen.getByRole('textbox', { name: 'Ou colle le contenu exporté' }), {
      target: { value: exportState(createDefaultState()) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Importer le texte' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Remplacer' }));
    expect(toastRegion()).toBeEmptyDOMElement();
    expect(saved().templates).toEqual([]);
  });

  it('réinitialisation pendant un toast « Annuler » : le toast est fermé', () => {
    const initial = stateWithHistory();
    initial.templates.push(
      createTemplate({ name: 'Push', exercises: [createTemplateExercise('squat')] }, new Date('2026-10-01T10:00:00Z'), 'tp'),
    );
    const { saved } = renderAt('#/seances', initial);
    fireEvent.click(screen.getByRole('button', { name: 'Options de Push' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    fireEvent.click(screen.getByRole('link', { name: 'Réglages' }));
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser toutes les données' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Tout effacer' }));
    expect(toastRegion()).toBeEmptyDOMElement();
    expect(saved()).toEqual(createDefaultState());
  });

  it('réinitialisation avec confirmation', () => {
    localStorage.setItem(PROGRESS_EXERCISE_KEY, 'squat');
    sessionStorage.setItem(REST_TIMER_KEY, JSON.stringify({ sessionId: 'a1', endsAt: Date.now() + 60_000 }));
    const { saved } = renderAt('#/reglages', stateWithHistory());
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser toutes les données' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Tout effacer' }));
    expect(saved()).toEqual(createDefaultState());
    expect(localStorage.getItem(PROGRESS_EXERCISE_KEY)).toBeNull();
    expect(sessionStorage.getItem(REST_TIMER_KEY)).toBeNull();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/MuscuTrack v\d+\.\d+\.\d+/)).toBeInTheDocument();
  });
  it('import trop volumineux (> 5 Mo) : refusé avec un message clair', () => {
    renderAt('#/reglages', stateWithHistory());
    const file = new File(['{}'], 'enorme.json', { type: 'application/json' });
    Object.defineProperty(file, 'size', { value: MAX_IMPORT_BYTES + 1 });
    const text = vi.spyOn(file, 'text');
    fireEvent.change(screen.getByLabelText('Choisir un fichier .json'), { target: { files: [file] } });
    expect(screen.getByRole('alert')).toHaveTextContent('dépassent la taille maximale de 5 Mo');
    expect(text).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('import dont la sauvegarde échoue : message d’échec, pas de « Import réussi »', () => {
    renderAt('#/reglages', stateWithHistory(), { failWrites: true });
    fireEvent.change(screen.getByRole('textbox', { name: 'Ou colle le contenu exporté' }), {
      target: { value: exportState(createDefaultState()) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Importer le texte' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Remplacer' }));
    expect(screen.queryByText(/Import réussi/)).not.toBeInTheDocument();
    expect(screen.getByText(/Échec de l’import/)).toBeInTheDocument();
  });

  it('bandeau de données illisibles : fermable, et masqué après un import réussi', () => {
    const { unmount } = renderAt('#/reglages', 'corrompu');
    expect(screen.getByText(/illisibles/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le message' }));
    expect(screen.queryByText(/illisibles/)).not.toBeInTheDocument();
    unmount();

    renderAt('#/reglages', 'corrompu');
    expect(screen.getByText(/illisibles/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Ou colle le contenu exporté' }), {
      target: { value: exportState(createDefaultState()) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Importer le texte' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Remplacer' }));
    expect(pageStatus()).toHaveTextContent('Import réussi');
    expect(screen.queryByText(/illisibles/)).not.toBeInTheDocument();
  });

  it('bandeau de données illisibles : masqué après une réinitialisation réussie', () => {
    renderAt('#/reglages', 'corrompu');
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser toutes les données' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Tout effacer' }));
    expect(screen.queryByText(/illisibles/)).not.toBeInTheDocument();
  });
});
