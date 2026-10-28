import { describe, expect, it } from 'vitest';
import {
  FREE_SESSION_NAME,
  addExercise,
  addSet,
  applySessionToTemplate,
  createFreeSession,
  createSessionFromTemplate,
  finishSession,
  removeSet,
  setSetDone,
  updateSet,
} from './session';
import type { SetEntry, Template, WorkoutSession } from './types';

const NOW = new Date('2026-03-01T10:00:00.000Z');
const set = (weight: number, reps: number, done = false): SetEntry => ({ weight, reps, done });

const template: Template = {
  id: 't1',
  name: 'Haut du corps',
  exercises: [
    { exerciseId: 'developpe-couche', targetSets: 3, targetReps: 10, targetWeight: 60, restSeconds: 90 },
    { exerciseId: 'tractions', targetSets: 2, targetReps: 8, restSeconds: 120 },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const history: WorkoutSession[] = [
  {
    id: 'old',
    name: 'Ancienne',
    startedAt: '2026-02-20T10:00:00.000Z',
    endedAt: '2026-02-20T11:00:00.000Z',
    exercises: [{ exerciseId: 'developpe-couche', sets: [set(62.5, 10, true), set(62.5, 8, true)] }],
  },
];

function base(): WorkoutSession {
  return {
    id: 's',
    name: 'S',
    startedAt: NOW.toISOString(),
    exercises: [{ exerciseId: 'squat', sets: [set(100, 5), set(100, 5)] }],
  };
}

describe('createSessionFromTemplate', () => {
  const s = createSessionFromTemplate(template, history, NOW, 'new');

  it('reprend id, templateId, nom et date', () => {
    expect(s).toMatchObject({ id: 'new', templateId: 't1', name: 'Haut du corps', startedAt: NOW.toISOString() });
    expect(s.endedAt).toBeUndefined();
  });

  it('pré-remplit avec la dernière performance (dernière série répétée si besoin)', () => {
    expect(s.exercises[0].sets).toEqual([set(62.5, 10), set(62.5, 8), set(62.5, 8)]);
  });

  it('sinon utilise les objectifs (poids 0 si absent)', () => {
    expect(s.exercises[1].sets).toEqual([set(0, 8), set(0, 8)]);
  });

  it('au moins une série même si targetSets = 0', () => {
    const t = { ...template, exercises: [{ ...template.exercises[1], targetSets: 0 }] };
    expect(createSessionFromTemplate(t, [], NOW, 'x').exercises[0].sets).toHaveLength(1);
  });

  it('génère un id par défaut', () => {
    expect(createSessionFromTemplate(template, []).id).toBeTruthy();
  });
});

describe('createFreeSession', () => {
  it('crée une séance vide', () => {
    expect(createFreeSession(NOW, 'f')).toEqual({
      id: 'f',
      name: FREE_SESSION_NAME,
      startedAt: NOW.toISOString(),
      exercises: [],
    });
  });
});

describe('édition de la séance', () => {
  it('addExercise : pré-remplit avec la dernière performance', () => {
    const s = addExercise(createFreeSession(NOW, 'f'), 'developpe-couche', history);
    expect(s.exercises).toEqual([{ exerciseId: 'developpe-couche', sets: [set(62.5, 10), set(62.5, 8)] }]);
  });

  it('addExercise : une série vide si jamais fait', () => {
    const s = addExercise(createFreeSession(NOW, 'f'), 'tractions', history);
    expect(s.exercises[0].sets).toEqual([set(0, 0)]);
  });

  it('addSet recopie la dernière série, non validée', () => {
    let s = setSetDone(base(), 0, 1, true);
    s = addSet(s, 0);
    expect(s.exercises[0].sets).toHaveLength(3);
    expect(s.exercises[0].sets[2]).toEqual(set(100, 5));
  });

  it('addSet sur un exercice sans série', () => {
    const s = addSet({ ...base(), exercises: [{ exerciseId: 'squat', sets: [] }] }, 0);
    expect(s.exercises[0].sets).toEqual([set(0, 0)]);
  });

  it('removeSet', () => {
    const s = removeSet(updateSet(base(), 0, 0, { weight: 80 }), 0, 0);
    expect(s.exercises[0].sets).toEqual([set(100, 5)]);
  });

  it('updateSet normalise les valeurs', () => {
    let s = updateSet(base(), 0, 0, { weight: 82.5, reps: 6 });
    expect(s.exercises[0].sets[0]).toEqual(set(82.5, 6));
    s = updateSet(s, 0, 0, { weight: -5, reps: 3.7 });
    expect(s.exercises[0].sets[0]).toEqual(set(0, 3));
    s = updateSet(s, 0, 0, { weight: Number.NaN, reps: Number.NaN });
    expect(s.exercises[0].sets[0]).toEqual(set(0, 0));
  });

  it('valider / dévalider', () => {
    let s = setSetDone(base(), 0, 0, true);
    expect(s.exercises[0].sets[0].done).toBe(true);
    s = setSetDone(s, 0, 0, false);
    expect(s.exercises[0].sets[0].done).toBe(false);
  });

  it('indices invalides : séance inchangée', () => {
    const b = base();
    expect(updateSet(b, 5, 0, { weight: 1 })).toBe(b);
    expect(setSetDone(b, 0, 9, true)).toBe(b);
    expect(addSet(b, -1)).toBe(b);
  });

  it('ne mute pas la séance d’origine', () => {
    const b = base();
    const snapshot = structuredClone(b);
    updateSet(b, 0, 0, { weight: 1 });
    setSetDone(b, 0, 0, true);
    addSet(b, 0);
    removeSet(b, 0, 0);
    expect(b).toEqual(snapshot);
  });
});

describe('finishSession', () => {
  it('retire les séries non validées et exercices vides, pose endedAt', () => {
    let s = createSessionFromTemplate(template, history, NOW, 'x');
    s = setSetDone(s, 0, 0, true);
    s = setSetDone(s, 0, 2, true);
    const end = new Date('2026-03-01T11:00:00.000Z');
    const f = finishSession(s, end);
    expect(f.endedAt).toBe(end.toISOString());
    expect(f.exercises).toEqual([
      { exerciseId: 'developpe-couche', sets: [set(62.5, 10, true), set(62.5, 8, true)] },
    ]);
  });
});

describe('applySessionToTemplate', () => {
  const done: WorkoutSession = {
    id: 'x',
    templateId: 't1',
    name: 'Haut du corps',
    startedAt: NOW.toISOString(),
    endedAt: NOW.toISOString(),
    exercises: [{ exerciseId: 'tractions', sets: [set(5, 8, true), set(10, 6, true), set(20, 1, false)] }],
  };
  const later = new Date('2026-03-02T00:00:00.000Z');

  it('met à jour targetWeight avec le poids max validé', () => {
    const t = applySessionToTemplate(template, done, later);
    expect(t.exercises[1].targetWeight).toBe(10);
    expect(t.exercises[0]).toBe(template.exercises[0]);
    expect(t.updatedAt).toBe(later.toISOString());
    expect(t.exercises[1].targetReps).toBe(8);
  });

  it('renvoie la même séance type si rien ne change', () => {
    const same = { ...done, exercises: [{ exerciseId: 'developpe-couche', sets: [set(60, 10, true)] }] };
    expect(applySessionToTemplate(template, same, later)).toBe(template);
  });
});
