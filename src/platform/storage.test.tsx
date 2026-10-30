import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { STORAGE_KEY, createDefaultState, exportState, loadState } from '../lib/storage';
import { MUSCLE_GROUPS, type AppState, type WorkoutSession } from '../lib/types';
import { AppStoreProvider, useAppStore, type AppStoreValue } from '../state/AppStore';
import {
  BACKUP_FILE,
  BACKUP_RESTORED_WARNING,
  STATE_FILE,
  TEMP_FILE,
  WRITE_DELAY_MS,
  createDurableStorage,
} from './storage';

/** Système de fichiers en mémoire (mock de `Filesystem`) et écouteurs de `App`. */
const fsMock = vi.hoisted(() => {
  const files = new Map<string, string>();
  const calls: string[] = [];
  const listeners: Record<string, () => void> = {};
  const missing = (path: string) => new Error(`File does not exist: ${path}`);
  const filesystem = {
    readFile: vi.fn(async ({ path }: { path: string }) => {
      calls.push(`readFile ${path}`);
      if (!files.has(path)) throw missing(path);
      return { data: files.get(path)! };
    }),
    writeFile: vi.fn(async ({ path, data }: { path: string; data: string }) => {
      calls.push(`writeFile ${path}`);
      files.set(path, data);
      return { uri: `file:///Library/${path}` };
    }),
    rename: vi.fn(async ({ from, to }: { from: string; to: string }) => {
      calls.push(`rename ${from} > ${to}`);
      if (!files.has(from)) throw missing(from);
      files.set(to, files.get(from)!);
      files.delete(from);
    }),
    stat: vi.fn(async ({ path }: { path: string }) => {
      if (!files.has(path)) throw missing(path);
      return { type: 'file', size: files.get(path)!.length };
    }),
    deleteFile: vi.fn(async ({ path }: { path: string }) => {
      calls.push(`deleteFile ${path}`);
      if (!files.has(path)) throw missing(path);
      files.delete(path);
    }),
  };
  return { files, calls, listeners, filesystem };
});

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' } }));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Library: 'LIBRARY', Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: fsMock.filesystem,
}));
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn((event: string, listener: () => void) => {
      fsMock.listeners[event] = listener;
      return Promise.resolve({ remove: async () => undefined });
    }),
  },
}));

const { files, calls, filesystem } = fsMock;

/** Laisse s'écouler les promesses en attente (écritures mockées). */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const day = (n: number) => new Date(2026, 6, 1 + n, 18, 0).toISOString();

function historySession(i: number): WorkoutSession {
  return {
    id: `s${i}`,
    name: `Séance ${i}`,
    templateId: `t${i % 5}`,
    startedAt: day(i),
    endedAt: new Date(Date.parse(day(i)) + 3_600_000).toISOString(),
    exercises: [
      {
        exerciseId: 'squat',
        sets: [
          { weight: 80 + (i % 4) * 2.5, reps: 8, done: true },
          { weight: 80, reps: 6, done: true },
        ],
      },
    ],
    ...(i % 7 === 0 ? { notes: 'Bonne forme' } : {}),
  };
}

/** État complet du critère 1 de §4.2. */
function fullState(): AppState {
  const base = createDefaultState();
  return {
    version: 1,
    exercises: [
      ...base.exercises,
      ...[1, 2, 3].map((i) => ({ id: `custom-${i}`, name: `Perso ${i}`, muscleGroup: MUSCLE_GROUPS[i], isCustom: true })),
    ],
    templates: [0, 1, 2, 3, 4].map((i) => ({
      id: `t${i}`,
      name: `Séance type ${i}`,
      exercises: [
        { exerciseId: 'squat', targetSets: 3, targetReps: 8, restSeconds: 120, targetWeight: 80 },
        { exerciseId: 'custom-1', targetSets: 3, targetReps: 10, restSeconds: 90 },
      ],
      createdAt: day(0),
      updatedAt: day(i),
    })),
    sessions: Array.from({ length: 60 }, (_, i) => historySession(i)),
    activeSession: {
      id: 'active',
      name: 'Séance type 0',
      templateId: 't0',
      startedAt: day(61),
      currentExerciseIndex: 1,
      exercises: [
        {
          exerciseId: 'squat',
          sets: [
            { weight: 82.5, reps: 8, done: true },
            { weight: 82.5, reps: 8, done: false },
          ],
          suggestion: { fromWeight: 80, fromReps: 8, toWeight: 82.5, toReps: 8, sameReps: true },
        },
        { exerciseId: 'custom-1', sets: [{ weight: 0, reps: 10, done: false }] },
      ],
    },
    settings: { suggestLoad: false, weeklyGoal: 3, weeklyGoalAsked: true },
  };
}

const stateWith = (name: string): AppState => ({ ...createDefaultState(), templates: [], sessions: [historySession(1)].map((s) => ({ ...s, name })) });

beforeEach(() => {
  files.clear();
  calls.length = 0;
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('stockage durable (natif) : lecture au démarrage', () => {
  it('migration complète sans perte depuis le localStorage de la WebView', async () => {
    const original = fullState();
    const legacy = JSON.stringify(original);
    localStorage.setItem(STORAGE_KEY, legacy);

    const storage = createDurableStorage();
    const result = await storage.hydrate();

    expect(result).toEqual({ source: 'migration' });
    expect(loadState(storage)).toEqual({ state: original });
    expect(files.get(STATE_FILE)).toBe(exportState(original));
    // Relu et comparé avant de devenir la source ; aucun fichier temporaire laissé.
    expect(calls).toContain(`readFile ${TEMP_FILE}`);
    expect(files.has(TEMP_FILE)).toBe(false);
    // Le localStorage reste comme filet, inchangé.
    expect(localStorage.getItem(STORAGE_KEY)).toBe(legacy);
  });

  it('migration relue différente : state.json n’est pas créé, les données restent chargées', async () => {
    const original = fullState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(original));
    filesystem.readFile.mockImplementationOnce(async () => {
      throw new Error('absent');
    }); // state.json
    filesystem.readFile.mockImplementationOnce(async () => {
      throw new Error('absent');
    }); // state.bak.json
    filesystem.readFile.mockImplementationOnce(async () => ({ data: 'tronqué' })); // relecture

    const storage = createDurableStorage();
    await storage.hydrate();

    expect(files.has(STATE_FILE)).toBe(false);
    expect(loadState(storage).state).toEqual(original);
  });

  it('deuxième lancement : state.json fait foi, même si le localStorage a changé', async () => {
    files.set(STATE_FILE, JSON.stringify(stateWith('Fichier')));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateWith('Ancien')));

    const storage = createDurableStorage();
    expect(await storage.hydrate()).toEqual({ source: 'state' });
    expect(loadState(storage).state.sessions[0].name).toBe('Fichier');
    expect(filesystem.writeFile).not.toHaveBeenCalled();
  });

  it('state.json illisible, sauvegarde valide : sauvegarde chargée et avertissement affiché', async () => {
    files.set(STATE_FILE, '{ tronqué');
    files.set(BACKUP_FILE, JSON.stringify(stateWith('Sauvegarde')));

    const storage = createDurableStorage();
    const { warning } = await storage.hydrate();
    expect(warning).toBe(BACKUP_RESTORED_WARNING);
    expect(loadState(storage)).toEqual({ state: stateWith('Sauvegarde') });

    window.location.hash = '#/historique';
    render(
      <AppStoreProvider storage={storage} loadWarning={warning}>
        <App />
      </AppStoreProvider>,
    );
    expect(
      screen.getByText('Les dernières modifications n’ont pas pu être relues. La sauvegarde précédente a été restaurée.'),
    ).toBeInTheDocument();
    await settle();
    expect(filesystem.writeFile).not.toHaveBeenCalled();
  });

  it('après restauration, l’écriture suivante ne remplace pas la sauvegarde valide par le fichier illisible', async () => {
    files.set(STATE_FILE, '{ tronqué');
    files.set(BACKUP_FILE, JSON.stringify(stateWith('Sauvegarde')));
    const storage = createDurableStorage();
    await storage.hydrate();

    storage.setItem(STORAGE_KEY, JSON.stringify(stateWith('Nouveau')));
    await storage.flush();

    expect(JSON.parse(files.get(STATE_FILE)!).sessions[0].name).toBe('Nouveau');
    expect(JSON.parse(files.get(BACKUP_FILE)!).sessions[0].name).toBe('Sauvegarde');
  });

  it('tout est illisible : état par défaut, avertissement « illisibles », aucun fichier écrit', async () => {
    files.set(STATE_FILE, 'corrompu');
    files.set(BACKUP_FILE, 'corrompu aussi');
    localStorage.setItem(STORAGE_KEY, 'illisible');

    const storage = createDurableStorage();
    await storage.hydrate();
    const store: { current?: AppStoreValue } = {};
    function Probe() {
      store.current = useAppStore();
      return <p>{store.current.loadError}</p>;
    }
    render(
      <AppStoreProvider storage={storage}>
        <Probe />
      </AppStoreProvider>,
    );
    expect(screen.getByText(/Les données enregistrées sont illisibles/)).toBeInTheDocument();
    expect(store.current!.state).toEqual(createDefaultState());
    await storage.flush();
    expect(filesystem.writeFile).not.toHaveBeenCalled();
    expect(filesystem.rename).not.toHaveBeenCalled();
    expect(files.get(STATE_FILE)).toBe('corrompu');
  });

  it('premier lancement (rien nulle part) : état par défaut, sans avertissement ni écriture', async () => {
    const storage = createDurableStorage();
    expect(await storage.hydrate()).toEqual({ source: 'empty' });
    expect(loadState(storage)).toEqual({ state: createDefaultState() });
    expect(filesystem.writeFile).not.toHaveBeenCalled();
  });

  it('localStorage illisible seul : avertissement « illisibles », rien n’est écrit', async () => {
    localStorage.setItem(STORAGE_KEY, 'illisible');
    const storage = createDurableStorage();
    expect(await storage.hydrate()).toEqual({ source: 'unreadable' });
    expect(loadState(storage).error).toMatch(/illisibles/);
    expect(filesystem.writeFile).not.toHaveBeenCalled();
  });
});

describe('stockage durable (natif) : écritures', () => {
  it('10 setItem en moins de 300 ms : une seule écriture, avec le dernier état', async () => {
    vi.useFakeTimers();
    const storage = createDurableStorage();
    await storage.hydrate();
    for (let i = 0; i < 10; i++) {
      storage.setItem(STORAGE_KEY, JSON.stringify(stateWith(`v${i}`)));
      await vi.advanceTimersByTimeAsync(20);
    }
    expect(filesystem.writeFile).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(WRITE_DELAY_MS);
    expect(filesystem.writeFile).toHaveBeenCalledTimes(1);
    expect(JSON.parse(files.get(STATE_FILE)!).sessions[0].name).toBe('v9');
  });

  it('deux écritures ne se chevauchent jamais', async () => {
    const storage = createDurableStorage();
    await storage.hydrate();
    let release!: () => void;
    filesystem.writeFile.mockImplementationOnce(async ({ path, data }) => {
      calls.push(`writeFile ${path}`);
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      files.set(path, data);
      return { uri: '' };
    });

    storage.setItem(STORAGE_KEY, JSON.stringify(stateWith('premier')));
    const first = storage.flush();
    await settle();
    storage.setItem(STORAGE_KEY, JSON.stringify(stateWith('second')));
    void storage.flush();
    await settle();
    // La première écriture est en cours : la seconde attend.
    expect(filesystem.writeFile).toHaveBeenCalledTimes(1);

    release();
    await first;
    expect(filesystem.writeFile).toHaveBeenCalledTimes(2);
    const order = calls.filter((c) => !c.startsWith('readFile'));
    expect(order.indexOf(`rename ${TEMP_FILE} > ${STATE_FILE}`)).toBeLessThan(order.lastIndexOf(`writeFile ${TEMP_FILE}`));
    expect(JSON.parse(files.get(STATE_FILE)!).sessions[0].name).toBe('second');
  });

  it('mise en arrière-plan (pause) : écriture immédiate de l’état en attente', async () => {
    vi.useFakeTimers();
    const storage = createDurableStorage();
    await storage.hydrate();
    storage.setItem(STORAGE_KEY, JSON.stringify(stateWith('en attente')));
    expect(filesystem.writeFile).not.toHaveBeenCalled();

    fsMock.listeners.pause();
    await vi.advanceTimersByTimeAsync(0);
    expect(filesystem.writeFile).toHaveBeenCalledTimes(1);
    expect(JSON.parse(files.get(STATE_FILE)!).sessions[0].name).toBe('en attente');
  });

  it('écriture atomique : tmp, puis state → bak, puis tmp → state', async () => {
    files.set(STATE_FILE, JSON.stringify(stateWith('avant')));
    const storage = createDurableStorage();
    await storage.hydrate();
    calls.length = 0;

    storage.setItem(STORAGE_KEY, JSON.stringify(stateWith('après')));
    await storage.flush();

    const sequence = calls.filter((c) => c.startsWith('writeFile') || c.startsWith('rename'));
    expect(sequence).toEqual([
      `writeFile ${TEMP_FILE}`,
      `rename ${STATE_FILE} > ${BACKUP_FILE}`,
      `rename ${TEMP_FILE} > ${STATE_FILE}`,
    ]);
    expect(JSON.parse(files.get(STATE_FILE)!).sessions[0].name).toBe('après');
    expect(JSON.parse(files.get(BACKUP_FILE)!).sessions[0].name).toBe('avant');
  });

  it('dossier muscutrack/ dans Library, créé au besoin', async () => {
    const storage = createDurableStorage();
    await storage.hydrate();
    storage.setItem(STORAGE_KEY, JSON.stringify(createDefaultState()));
    await storage.flush();
    expect(filesystem.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'muscutrack/state.tmp.json', directory: 'LIBRARY', recursive: true }),
    );
  });

  it('écriture refusée : onWriteError est appelé et le bandeau d’échec s’affiche', async () => {
    const storage = createDurableStorage();
    await storage.hydrate();
    filesystem.writeFile.mockRejectedValueOnce(new Error('plein'));
    const store: { current?: AppStoreValue } = {};
    function Probe() {
      store.current = useAppStore();
      return null;
    }
    window.location.hash = '#/historique';
    render(
      <AppStoreProvider storage={storage}>
        <Probe />
        <App />
      </AppStoreProvider>,
    );
    expect(screen.queryByText(/Impossible d’enregistrer sur l’appareil/)).not.toBeInTheDocument();

    act(() => {
      store.current!.actions.setSuggestLoad(false);
    });
    await act(() => storage.flush());

    expect(screen.getByText(/Impossible d’enregistrer sur l’appareil/)).toBeInTheDocument();
  });
});

describe('stockage web', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('localStorage comme avant, persistance demandée une seule fois, aucun appel à Filesystem', async () => {
    vi.resetModules();
    const { createWebStorage } = await import('./storage');
    const persist = vi.fn(() => Promise.resolve(true));
    vi.stubGlobal('navigator', { ...navigator, storage: { persist } });

    const storage = createWebStorage()!;
    expect(persist).not.toHaveBeenCalled();
    storage.setItem(STORAGE_KEY, JSON.stringify(stateWith('un')));
    storage.setItem(STORAGE_KEY, JSON.stringify(stateWith('deux')));
    expect(persist).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).sessions[0].name).toBe('deux');
    expect(storage.getItem(STORAGE_KEY)).toBe(localStorage.getItem(STORAGE_KEY));
    expect(loadState(storage).state.sessions[0].name).toBe('deux');
    for (const fn of Object.values(filesystem)) expect(fn).not.toHaveBeenCalled();
  });

  it('sans navigator.storage : aucune erreur', async () => {
    vi.resetModules();
    const { createWebStorage } = await import('./storage');
    vi.stubGlobal('navigator', { ...navigator, storage: undefined });
    expect(() => createWebStorage()!.setItem(STORAGE_KEY, '{}')).not.toThrow();
  });
});
