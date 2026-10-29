import { describe, expect, it } from 'vitest';
import {
  FREE_SESSION_NAME,
  MAX_REPS,
  MAX_WEIGHT,
  addExercise,
  addSet,
  applySessionToTemplate,
  clampExerciseIndex,
  createFreeSession,
  createSessionFromTemplate,
  currentExerciseIndex,
  currentSetIndex,
  finishSession,
  goToExercise,
  keepLastLoad,
  nextExerciseIndex,
  pendingSetCount,
  reapplySuggestion,
  removeExercise,
  removeSet,
  sanitizeReps,
  sanitizeWeight,
  setSetDone,
  updateSet,
  validateSet,
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

describe('charge proposée (lot 1)', () => {
  const benchHistory = (sets: SetEntry[]): WorkoutSession[] => [
    {
      id: 'h',
      templateId: 't1',
      name: 'Haut du corps',
      startedAt: '2026-02-28T10:00:00.000Z',
      endedAt: '2026-02-28T11:00:00.000Z',
      exercises: [{ exerciseId: 'developpe-couche', sets }],
    },
  ];
  const t38: Template = {
    ...template,
    exercises: [{ exerciseId: 'developpe-couche', targetSets: 3, targetReps: 8, targetWeight: 80, restSeconds: 90 }],
  };
  const success = benchHistory([set(80, 10, true), set(80, 9, true), set(80, 8, true)]);

  it('toutes les séries pré-remplies à la charge proposée, suggestion enregistrée dans l’exercice', () => {
    const s = createSessionFromTemplate(t38, success, NOW, 'x');
    expect(s.exercises[0].sets).toEqual([set(82.5, 8), set(82.5, 8), set(82.5, 8)]);
    expect(s.exercises[0].suggestion).toEqual({ fromWeight: 80, fromReps: 8, toWeight: 82.5, toReps: 8, sameReps: false });
  });

  it('réglage coupé ou échec : pré-remplissage inchangé, pas de champ suggestion', () => {
    for (const s of [
      createSessionFromTemplate(t38, success, NOW, 'x', false),
      createSessionFromTemplate(t38, benchHistory([set(80, 8, true), set(80, 8, true), set(80, 7, true)]), NOW, 'x'),
    ]) {
      expect(s.exercises[0]).not.toHaveProperty('suggestion');
      expect(s.exercises[0].sets.map((x) => x.weight)).toEqual([80, 80, 80]);
    }
  });

  it('exercice en double dans la séance type : chaque occurrence calculée avec son objectif', () => {
    const t = { ...t38, exercises: [t38.exercises[0], { ...t38.exercises[0], targetReps: 12 }] };
    const s = createSessionFromTemplate(t, success, NOW, 'x');
    expect(s.exercises[0].suggestion?.toWeight).toBe(82.5);
    expect(s.exercises[1]).not.toHaveProperty('suggestion');
  });

  it('jamais en séance libre ni pour un exercice ajouté à la volée', () => {
    expect(addExercise(createFreeSession(NOW, 'f'), 'developpe-couche', success).exercises[0]).not.toHaveProperty('suggestion');
  });

  it('keepLastLoad : séries non validées aux valeurs de la dernière fois, note retirée ; reapplySuggestion : retour', () => {
    let s = createSessionFromTemplate(t38, success, NOW, 'x');
    const suggestion = s.exercises[0].suggestion!;
    s = keepLastLoad(s, 0, success);
    expect(s.exercises[0]).not.toHaveProperty('suggestion');
    expect(s.exercises[0].sets).toEqual([set(80, 10), set(80, 9), set(80, 8)]);
    s = reapplySuggestion(s, 0, 'developpe-couche', suggestion);
    expect(s.exercises[0].suggestion).toEqual(suggestion);
    expect(s.exercises[0].sets).toEqual([set(82.5, 8), set(82.5, 8), set(82.5, 8)]);
    // Séries déjà validées : jamais touchées
    s = setSetDone(updateSet(s, 0, 0, { weight: 85 }), 0, 0, true);
    expect(keepLastLoad(s, 0, success).exercises[0].sets[0]).toEqual(set(85, 8, true));
    // Mauvais exercice à cet index : sans effet ; sans suggestion : sans effet
    const kept = keepLastLoad(s, 0, success);
    expect(reapplySuggestion(kept, 0, 'squat', suggestion)).toBe(kept);
    expect(keepLastLoad(kept, 0, success)).toBe(kept);
  });

  it('finishSession retire la suggestion', () => {
    let s = createSessionFromTemplate(t38, success, NOW, 'x');
    s = setSetDone(s, 0, 0, true);
    expect(finishSession(s, NOW).exercises[0]).not.toHaveProperty('suggestion');
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

  it('updateSet plafonne poids et reps', () => {
    const s = updateSet(base(), 0, 0, { weight: 5000, reps: 99999 });
    expect(s.exercises[0].sets[0]).toEqual(set(MAX_WEIGHT, MAX_REPS));
  });

  it('removeExercise retire l’exercice ciblé', () => {
    const b = addExercise(base(), 'tractions', []);
    const s = removeExercise(b, 0);
    expect(s.exercises.map((e) => e.exerciseId)).toEqual(['tractions']);
    expect(removeExercise(b, 5)).toBe(b);
    expect(removeExercise(b, -1)).toBe(b);
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
    removeExercise(b, 0);
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

describe('sanitizeWeight / sanitizeReps', () => {
  it('bornent à 0 et au plafond', () => {
    expect(sanitizeWeight(62.5)).toBe(62.5);
    expect(sanitizeWeight(-1)).toBe(0);
    expect(sanitizeWeight(Number.POSITIVE_INFINITY)).toBe(0);
    expect(sanitizeWeight(1000.5)).toBe(1000);
    expect(sanitizeReps(12.9)).toBe(12);
    expect(sanitizeReps(1001)).toBe(1000);
    expect(sanitizeReps(Number.NaN)).toBe(0);
  });
});

describe('mode séance « un exercice à la fois »', () => {
  const twoExercises = (current?: number): WorkoutSession => ({
    id: 'a',
    name: 'Push',
    startedAt: NOW.toISOString(),
    exercises: [
      { exerciseId: 'developpe-couche', sets: [set(60, 10), set(60, 10)] },
      { exerciseId: 'tractions', sets: [set(0, 8)] },
    ],
    ...(current !== undefined && { currentExerciseIndex: current }),
  });

  it('clampExerciseIndex borne l’index dans [0, n − 1]', () => {
    expect(clampExerciseIndex(3, -2)).toBe(0);
    expect(clampExerciseIndex(3, 7)).toBe(2);
    expect(clampExerciseIndex(3, 1.8)).toBe(1);
    expect(clampExerciseIndex(0, 4)).toBe(0);
    expect(clampExerciseIndex(3, Number.NaN)).toBe(0);
  });

  it('currentExerciseIndex : champ absent = 0 (données existantes), valeur hors bornes ramenée', () => {
    expect(currentExerciseIndex(twoExercises())).toBe(0);
    expect(currentExerciseIndex(twoExercises(1))).toBe(1);
    expect(currentExerciseIndex(twoExercises(9))).toBe(1);
  });

  it('goToExercise change l’exercice affiché (borné), sans copie inutile', () => {
    const s = twoExercises();
    expect(goToExercise(s, 1).currentExerciseIndex).toBe(1);
    expect(goToExercise(s, 5).currentExerciseIndex).toBe(1);
    expect(goToExercise(s, -1).currentExerciseIndex).toBe(0);
    const at1 = twoExercises(1);
    expect(goToExercise(at1, 1)).toBe(at1);
  });

  it('currentSetIndex = première série non validée, -1 si tout est fait', () => {
    expect(currentSetIndex({ exerciseId: 'x', sets: [set(1, 1, true), set(1, 1), set(1, 1)] })).toBe(1);
    expect(currentSetIndex({ exerciseId: 'x', sets: [set(1, 1, true), set(1, 1, false), set(1, 1, true)] })).toBe(1);
    expect(currentSetIndex({ exerciseId: 'x', sets: [set(1, 1, true)] })).toBe(-1);
    expect(currentSetIndex({ exerciseId: 'x', sets: [] })).toBe(-1);
    expect(currentSetIndex(undefined)).toBe(-1);
  });

  it('pendingSetCount compte les séries non validées de toute la séance', () => {
    expect(pendingSetCount(twoExercises())).toBe(3);
    expect(pendingSetCount(setSetDone(twoExercises(), 1, 0, true))).toBe(2);
  });

  it('validateSet : reste sur l’exercice tant qu’il reste des séries', () => {
    const s = validateSet(twoExercises(), 0, 0);
    expect(s.exercises[0].sets[0].done).toBe(true);
    expect(currentExerciseIndex(s)).toBe(0);
  });

  it('validateSet : dernière série de l’exercice → exercice suivant', () => {
    const s = validateSet(validateSet(twoExercises(), 0, 0), 0, 1);
    expect(s.currentExerciseIndex).toBe(1);
  });

  it('validateSet : dernier exercice → on y reste', () => {
    const s = validateSet(twoExercises(1), 1, 0);
    expect(s.exercises[1].sets[0].done).toBe(true);
    expect(currentExerciseIndex(s)).toBe(1);
  });

  it('validateSet : un exercice qui n’est pas affiché ne fait pas changer d’écran', () => {
    const s = validateSet(twoExercises(1), 0, 0);
    const done = validateSet(s, 0, 1);
    expect(currentExerciseIndex(done)).toBe(1);
  });

  it('validateSet : index invalide → séance inchangée', () => {
    const s = twoExercises();
    expect(validateSet(s, 0, 9)).toBe(s);
    expect(validateSet(s, 4, 0)).toBe(s);
  });

  it('addExercise affiche l’exercice ajouté', () => {
    const s = addExercise(twoExercises(), 'dips', []);
    expect(s.currentExerciseIndex).toBe(2);
  });

  it('removeExercise garde l’exercice affiché ou se replie sur un exercice existant', () => {
    // Retrait avant l'exercice affiché : l'index suit l'exercice.
    expect(removeExercise(twoExercises(1), 0).currentExerciseIndex).toBe(0);
    // Retrait de l'exercice affiché (le dernier) : on affiche le précédent.
    expect(removeExercise(twoExercises(1), 1).currentExerciseIndex).toBe(0);
    // Retrait après : inchangé.
    expect(removeExercise(twoExercises(0), 1).currentExerciseIndex).toBe(0);
  });

  it('finishSession retire l’index d’exercice affiché', () => {
    const done = finishSession(setSetDone(twoExercises(1), 1, 0, true), NOW);
    expect(done).not.toHaveProperty('currentExerciseIndex');
  });
});

describe('mode séance — cas limites', () => {
  const three = (current: number): WorkoutSession => ({
    id: 'b',
    name: 'Trois',
    startedAt: NOW.toISOString(),
    currentExerciseIndex: current,
    exercises: [
      { exerciseId: 'a', sets: [set(10, 10)] },
      { exerciseId: 'b', sets: [set(10, 10, true)] },
      { exerciseId: 'c', sets: [set(10, 10)] },
    ],
  });

  it('removeExercise de l’exercice affiché au milieu : celui qui prend sa place est affiché', () => {
    const s = removeExercise(three(1), 1);
    expect(s.exercises.map((e) => e.exerciseId)).toEqual(['a', 'c']);
    expect(s.currentExerciseIndex).toBe(1);
  });

  it('validateSet sur un exercice sans série : séance inchangée', () => {
    const s: WorkoutSession = { ...three(0), exercises: [{ exerciseId: 'a', sets: [] }] };
    expect(validateSet(s, 0, 0)).toBe(s);
  });

  it('validateSet sur une série déjà validée : séance inchangée (une correction n’est pas une validation)', () => {
    const s = three(1);
    expect(validateSet(s, 1, 0)).toBe(s);
  });

  it('nextExerciseIndex : prochain exercice avec des séries en attente, sinon le suivant', () => {
    expect(nextExerciseIndex(three(0), 0)).toBe(2);
    const allDone: WorkoutSession = {
      ...three(0),
      exercises: three(0).exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x, done: true })) })),
    };
    expect(nextExerciseIndex(allDone, 0)).toBe(1);
    expect(nextExerciseIndex(three(2), 2)).toBe(-1);
  });

  it('validateSet : passage auto au prochain exercice en attente (saute un exercice fini)', () => {
    expect(validateSet(three(0), 0, 0).currentExerciseIndex).toBe(2);
  });
});
