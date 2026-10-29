import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  createDefaultState,
  exportFileName,
  exportState,
  loadState,
  parseAppState,
  saveState,
  validateImport,
  type StorageLike,
} from './storage';
import { appReducer, type AppAction } from '../state/appReducer';
import { createTemplate, createTemplateExercise } from './templates';
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
    ['poids > 1000 kg', (s) => {
      s.sessions[0].exercises[0].sets[0].weight = 1000.5;
      return s;
    }],
    ['reps > 1000', (s) => {
      s.sessions[0].exercises[0].sets[0].reps = 1001;
      return s;
    }],
    ['poids cible > 1000 kg', (s) => {
      s.templates[0].exercises[0].targetWeight = 2000;
      return s;
    }],
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

  it('aller-retour sans perte d’un état produit par le reducer', () => {
    const t0 = new Date('2026-03-01T10:00:00.000Z');
    const t1 = new Date('2026-03-01T11:00:00.000Z');
    const t2 = new Date('2026-03-02T10:00:00.000Z');
    const template = createTemplate(
      { name: 'Push', exercises: [createTemplateExercise('developpe-couche'), createTemplateExercise('dips')] },
      t0,
      't1',
    );
    const actions: AppAction[] = [
      { type: 'template/save', template },
      { type: 'exercise/addCustom', id: 'custom-1', name: 'Pull-over', muscleGroup: 'Dos' },
      { type: 'session/startFromTemplate', templateId: 't1', sessionId: 's1', now: t0 },
      { type: 'session/updateSet', exerciseIndex: 0, setIndex: 0, weight: 62.5, reps: 8 },
      { type: 'session/setDone', exerciseIndex: 0, setIndex: 0, done: true },
      { type: 'session/addExercise', exerciseId: 'custom-1' },
      { type: 'session/updateSet', exerciseIndex: 2, setIndex: 0, weight: 20, reps: 12 },
      { type: 'session/setDone', exerciseIndex: 2, setIndex: 0, done: true },
      { type: 'session/finish', now: t1 },
      { type: 'history/applyToTemplate', sessionId: 's1', now: t1 },
      { type: 'session/startFree', sessionId: 's2', now: t2 },
      { type: 'session/addExercise', exerciseId: 'squat' },
    ];
    const state = actions.reduce(appReducer, createDefaultState());
    // L'état contient bien chaque type de donnée.
    expect(state.templates[0].exercises[0].targetWeight).toBe(62.5);
    expect(state.sessions[0].exercises).toHaveLength(2);
    expect(state.exercises.some((e) => e.isCustom)).toBe(true);
    expect(state.activeSession?.exercises).toHaveLength(1);

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

describe('currentExerciseIndex (séance en cours)', () => {
  const withIndex = (value: unknown) => {
    const s = sampleState() as unknown as Record<string, unknown>;
    s.activeSession = {
      id: 's2',
      name: 'Libre',
      startedAt: '2026-01-03T10:00:00.000Z',
      exercises: [
        { exerciseId: 'squat', sets: [{ weight: 80, reps: 5, done: true }] },
        { exerciseId: 'dips', sets: [{ weight: 0, reps: 8, done: false }] },
      ],
      currentExerciseIndex: value,
    };
    return parseAppState(s);
  };

  it('données sans ce champ : acceptées, champ absent (rétrocompatible)', () => {
    const r = parseAppState(sampleState());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.activeSession).not.toHaveProperty('currentExerciseIndex');
  });

  it('valeur valide conservée, valeur trop grande bornée au dernier exercice', () => {
    const ok = withIndex(1);
    expect(ok.ok && ok.state.activeSession?.currentExerciseIndex).toBe(1);
    const big = withIndex(12);
    expect(big.ok && big.state.activeSession?.currentExerciseIndex).toBe(1);
  });

  it('séance sans exercice : index ramené à 0', () => {
    const s = sampleState() as unknown as Record<string, unknown>;
    s.activeSession = { id: 's2', name: 'Libre', startedAt: '2026-01-03T10:00:00.000Z', exercises: [], currentExerciseIndex: 3 };
    const r = parseAppState(s);
    expect(r.ok && r.state.activeSession?.currentExerciseIndex).toBe(0);
  });

  it('valeur invalide rejetée avec un message clair', () => {
    for (const bad of [-1, 1.5, '1', null]) {
      const r = withIndex(bad);
      expect(r.ok, String(bad)).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/activeSession\.currentExerciseIndex/);
    }
  });
});

describe('charge proposée et réglages (lot 1)', () => {
  const suggestion = { fromWeight: 80, fromReps: 8, toWeight: 82.5, toReps: 8, sameReps: true };
  const withSuggestion = (): AppState => ({
    ...createDefaultState(),
    activeSession: {
      id: 'a',
      name: 'Haut',
      startedAt: '2026-03-01T10:00:00.000Z',
      exercises: [{ exerciseId: 'developpe-couche', sets: [{ weight: 82.5, reps: 8, done: false }], suggestion }],
    },
    settings: { suggestLoad: false },
  });

  it('suggestion et réglage conservés à l’export puis à l’import', () => {
    const result = validateImport(exportState(withSuggestion()));
    expect(result.ok && result.state.activeSession?.exercises[0].suggestion).toEqual(suggestion);
    expect(result.ok && result.state.settings).toEqual({ suggestLoad: false });
  });

  it('export antérieur (sans settings ni suggestion) : importé sans erreur, réglage absent = activé', () => {
    const old = JSON.parse(exportState(sampleState()));
    delete old.settings;
    const result = validateImport(JSON.stringify(old));
    expect(result.ok).toBe(true);
    expect(result.ok && result.state).not.toHaveProperty('settings');
  });

  it('valeurs invalides rejetées avec un message clair', () => {
    const bad = withSuggestion() as unknown as { settings: unknown; activeSession: { exercises: { suggestion: unknown }[] } };
    bad.settings = { suggestLoad: 'oui' };
    expect(parseAppState(bad)).toEqual({ ok: false, error: 'settings.suggestLoad : booléen attendu' });
    const bad2 = withSuggestion() as unknown as { activeSession: { exercises: { suggestion: Record<string, unknown> }[] } };
    bad2.activeSession.exercises[0].suggestion.toWeight = -1;
    expect(parseAppState(bad2)).toMatchObject({ ok: false, error: expect.stringContaining('suggestion.toWeight') });
  });
});

describe('exportFileName', () => {
  it('muscutrack-AAAA-MM-JJ.json en date locale', () => {
    expect(exportFileName(new Date(2026, 0, 5, 23, 59))).toBe('muscutrack-2026-01-05.json');
    expect(exportFileName(new Date(2026, 11, 31))).toBe('muscutrack-2026-12-31.json');
  });
});
