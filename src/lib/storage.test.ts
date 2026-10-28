import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  createDefaultState,
  exportState,
  loadState,
  parseAppState,
  saveState,
  validateImport,
  type StorageLike,
} from './storage';
import type { AppState } from './types';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

function sampleState(): AppState {
  const s = createDefaultState();
  s.templates.push({
    id: 't1',
    name: 'Push',
    exercises: [{ exerciseId: 'developpe-couche', targetSets: 3, targetReps: 10, targetWeight: 60, restSeconds: 90 }],
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
  });
  s.sessions.push({
    id: 's1',
    templateId: 't1',
    name: 'Push',
    startedAt: '2026-01-02T10:00:00.000Z',
    endedAt: '2026-01-02T11:00:00.000Z',
    exercises: [{ exerciseId: 'developpe-couche', sets: [{ weight: 62.5, reps: 8, done: true }] }],
    notes: 'Bonne séance',
  });
  s.activeSession = {
    id: 's2',
    name: 'Libre',
    startedAt: '2026-01-03T10:00:00.000Z',
    exercises: [],
  };
  return s;
}

describe('createDefaultState', () => {
  it('contient la bibliothèque et des listes vides', () => {
    const s = createDefaultState();
    expect(s.version).toBe(1);
    expect(s.exercises.length).toBeGreaterThan(25);
    expect(s.templates).toEqual([]);
    expect(s.sessions).toEqual([]);
    expect(s.activeSession).toBeUndefined();
  });

  it('renvoie des copies indépendantes', () => {
    const a = createDefaultState();
    a.exercises[0].name = 'Modifié';
    expect(createDefaultState().exercises[0].name).not.toBe('Modifié');
  });
});

describe('loadState / saveState', () => {
  it('renvoie l’état par défaut sans erreur si rien n’est stocké', () => {
    const r = loadState(memoryStorage());
    expect(r.error).toBeUndefined();
    expect(r.state).toEqual(createDefaultState());
  });

  it('fait un aller-retour sans perte', () => {
    const storage = memoryStorage();
    const state = sampleState();
    expect(saveState(state, storage)).toBe(true);
    expect(Object.keys(storage.data)).toEqual([STORAGE_KEY]);
    const r = loadState(storage);
    expect(r.error).toBeUndefined();
    expect(r.state).toEqual(state);
  });

  it('JSON corrompu → état par défaut + erreur, sans planter', () => {
    const r = loadState(memoryStorage({ [STORAGE_KEY]: '{pas du json' }));
    expect(r.state).toEqual(createDefaultState());
    expect(r.error).toMatch(/illisibles/);
  });

  it('forme invalide → état par défaut + erreur', () => {
    const r = loadState(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 1, exercises: 'x' }) }));
    expect(r.state).toEqual(createDefaultState());
    expect(r.error).toBeDefined();
  });

  it('stockage qui lève une exception → état par défaut + erreur', () => {
    const r = loadState({
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
    });
    expect(r.state).toEqual(createDefaultState());
    expect(r.error).toBeDefined();
  });

  it('saveState renvoie false si le stockage échoue', () => {
    const ok = saveState(createDefaultState(), {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
    });
    expect(ok).toBe(false);
  });

  it('fonctionne avec localStorage par défaut', () => {
    localStorage.clear();
    const state = sampleState();
    expect(saveState(state)).toBe(true);
    expect(loadState().state).toEqual(state);
    localStorage.clear();
  });
});

describe('parseAppState', () => {
  it('accepte un état valide et ignore les propriétés inconnues', () => {
    const raw = { ...sampleState(), extra: 42 };
    const r = parseAppState(raw);
    expect(r.ok).toBe(true);
    if (r.ok) expect('extra' in r.state).toBe(false);
  });

  it('accepte activeSession null', () => {
    const r = parseAppState({ ...createDefaultState(), activeSession: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.activeSession).toBeUndefined();
  });

  const invalid: [string, (s: AppState) => unknown][] = [
    ['version inconnue', (s) => ({ ...s, version: 2 })],
    ['non objet', () => [1, 2]],
    ['groupe musculaire inconnu', (s) => ({ ...s, exercises: [{ ...s.exercises[0], muscleGroup: 'Cou' }] })],
    ['poids négatif', (s) => {
      s.sessions[0].exercises[0].sets[0].weight = -1;
      return s;
    }],
    ['reps non entier', (s) => {
      s.sessions[0].exercises[0].sets[0].reps = 2.5;
      return s;
    }],
    ['poids NaN (sérialisé null)', (s) => JSON.parse(JSON.stringify(s).replace('"weight":62.5', '"weight":null'))],
    ['date invalide', (s) => {
      s.sessions[0].startedAt = 'hier';
      return s;
    }],
    ['ids en double', (s) => ({ ...s, sessions: [s.sessions[0], s.sessions[0]] })],
    ['done manquant', (s) => {
      delete (s.sessions[0].exercises[0].sets[0] as Partial<{ done: boolean }>).done;
      return s;
    }],
    ['template sans restSeconds', (s) => {
      delete (s.templates[0].exercises[0] as Partial<{ restSeconds: number }>).restSeconds;
      return s;
    }],
  ];

  it.each(invalid)('rejette : %s', (_, mutate) => {
    const r = parseAppState(mutate(sampleState()));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });
});

describe('validateImport / exportState', () => {
  it('l’export est réimportable à l’identique', () => {
    const state = sampleState();
    const r = validateImport(exportState(state));
    expect(r).toEqual({ ok: true, state });
  });

  it('rejette un texte non JSON avec un message clair', () => {
    const r = validateImport('hello');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/JSON/);
  });

  it('rejette un JSON de mauvaise forme', () => {
    const r = validateImport('{"version":1}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Données invalides/);
  });
});
