import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../lib/storage';
import { createTemplate, createTemplateExercise } from '../lib/templates';
import type { AppState } from '../lib/types';
import { appReducer, type AppAction } from './appReducer';

const T0 = new Date('2026-03-01T10:00:00.000Z');
const T1 = new Date('2026-03-01T11:00:00.000Z');

function withTemplate(): AppState {
  const s = createDefaultState();
  s.templates.push(
    createTemplate({ name: 'Push', exercises: [createTemplateExercise('developpe-couche')] }, T0, 't1'),
  );
  return s;
}

const run = (state: AppState, ...actions: AppAction[]) => actions.reduce(appReducer, state);

describe('appReducer — séances types', () => {
  it('save / duplicate / delete', () => {
    let s = withTemplate();
    s = appReducer(s, { type: 'template/duplicate', id: 't1', newId: 't2', now: T1 });
    expect(s.templates.map((t) => t.name)).toEqual(['Push', 'Push (copie)']);
    s = appReducer(s, { type: 'template/delete', id: 't1' });
    expect(s.templates.map((t) => t.id)).toEqual(['t2']);
  });

  it('update', () => {
    const s = appReducer(withTemplate(), { type: 'template/update', id: 't1', patch: { name: 'Pecs' }, now: T1 });
    expect(s.templates[0]).toMatchObject({ name: 'Pecs', updatedAt: T1.toISOString() });
  });

  it('action sur un id inconnu → état inchangé', () => {
    const s = withTemplate();
    expect(appReducer(s, { type: 'template/update', id: 'x', patch: { name: 'Y' }, now: T1 })).toBe(s);
    expect(appReducer(s, { type: 'template/duplicate', id: 'x', newId: 'y', now: T1 })).toBe(s);
  });
});

describe('appReducer — exercices personnalisés', () => {
  it('ajoute, modifie et supprime un exercice personnalisé', () => {
    let s = createDefaultState();
    const n = s.exercises.length;
    s = appReducer(s, { type: 'exercise/addCustom', id: 'c1', name: ' Pull-over ', muscleGroup: 'Dos' });
    expect(s.exercises.at(-1)).toEqual({ id: 'c1', name: 'Pull-over', muscleGroup: 'Dos', isCustom: true });
    s = appReducer(s, { type: 'exercise/updateCustom', id: 'c1', name: 'Pullover', muscleGroup: 'Pectoraux' });
    expect(s.exercises.at(-1)?.muscleGroup).toBe('Pectoraux');
    s = appReducer(s, { type: 'exercise/deleteCustom', id: 'c1' });
    expect(s.exercises).toHaveLength(n);
  });

  it('refuse un nom vide et ne supprime pas un exercice par défaut', () => {
    const s = createDefaultState();
    expect(appReducer(s, { type: 'exercise/addCustom', id: 'c1', name: '  ', muscleGroup: 'Dos' })).toBe(s);
    const after = appReducer(s, { type: 'exercise/deleteCustom', id: 'squat' });
    expect(after.exercises).toHaveLength(s.exercises.length);
  });
});

describe('appReducer — séance en cours', () => {
  it('cycle complet : démarrer, saisir, valider, terminer', () => {
    const s = run(
      withTemplate(),
      { type: 'session/startFromTemplate', templateId: 't1', sessionId: 's1', now: T0 },
      { type: 'session/updateSet', exerciseIndex: 0, setIndex: 0, weight: 70, reps: 8 },
      { type: 'session/setDone', exerciseIndex: 0, setIndex: 0, done: true },
      { type: 'session/addExercise', exerciseId: 'dips' },
      { type: 'session/finish', now: T1 },
    );
    expect(s.activeSession).toBeUndefined();
    expect(s.sessions).toHaveLength(1);
    expect(s.sessions[0]).toMatchObject({ id: 's1', templateId: 't1', endedAt: T1.toISOString() });
    expect(s.sessions[0].exercises).toEqual([
      { exerciseId: 'developpe-couche', sets: [{ weight: 70, reps: 8, done: true }] },
    ]);
  });

  it('retire un exercice de la séance en cours', () => {
    const s = run(
      withTemplate(),
      { type: 'session/startFromTemplate', templateId: 't1', sessionId: 's1', now: T0 },
      { type: 'session/addExercise', exerciseId: 'dips' },
      { type: 'session/removeExercise', exerciseIndex: 0 },
    );
    expect(s.activeSession?.exercises.map((e) => e.exerciseId)).toEqual(['dips']);
  });

  it('ne démarre pas une seconde séance si une est en cours', () => {
    const s = appReducer(createDefaultState(), { type: 'session/startFree', sessionId: 'a', now: T0 });
    expect(appReducer(s, { type: 'session/startFree', sessionId: 'b', now: T1 })).toBe(s);
  });

  it('abandon : rien n’est enregistré', () => {
    const s = run(
      createDefaultState(),
      { type: 'session/startFree', sessionId: 'a', now: T0 },
      { type: 'session/abandon' },
    );
    expect(s.activeSession).toBeUndefined();
    expect(s.sessions).toEqual([]);
  });

  it('actions de séance sans séance active → état inchangé', () => {
    const s = createDefaultState();
    expect(appReducer(s, { type: 'session/addSet', exerciseIndex: 0 })).toBe(s);
    expect(appReducer(s, { type: 'session/finish', now: T1 })).toBe(s);
  });

  it('applique les poids réalisés à la séance type', () => {
    const s = run(
      withTemplate(),
      { type: 'session/startFromTemplate', templateId: 't1', sessionId: 's1', now: T0 },
      { type: 'session/updateSet', exerciseIndex: 0, setIndex: 1, weight: 72.5 },
      { type: 'session/setDone', exerciseIndex: 0, setIndex: 1, done: true },
      { type: 'session/finish', now: T1 },
      { type: 'history/applyToTemplate', sessionId: 's1', now: T1 },
    );
    expect(s.templates[0].exercises[0].targetWeight).toBe(72.5);
  });
});

describe('appReducer — mode un exercice à la fois', () => {
  it('validateSet passe à l’exercice suivant, goToExercise navigue (borné)', () => {
    const start = run(
      withTemplate(),
      { type: 'session/startFromTemplate', templateId: 't1', sessionId: 's1', now: T0 },
      { type: 'session/addExercise', exerciseId: 'dips' },
      { type: 'session/goToExercise', exerciseIndex: 0 },
    );
    expect(start.activeSession?.currentExerciseIndex).toBe(0);
    const s = run(
      start,
      { type: 'session/validateSet', exerciseIndex: 0, setIndex: 0 },
      { type: 'session/validateSet', exerciseIndex: 0, setIndex: 1 },
    );
    expect(s.activeSession?.currentExerciseIndex).toBe(0);
    const next = appReducer(s, { type: 'session/validateSet', exerciseIndex: 0, setIndex: 2 });
    expect(next.activeSession?.currentExerciseIndex).toBe(1);
    expect(next.activeSession?.exercises[0].sets.every((x) => x.done)).toBe(true);
    expect(appReducer(next, { type: 'session/goToExercise', exerciseIndex: 99 }).activeSession?.currentExerciseIndex).toBe(1);
    expect(appReducer(next, { type: 'session/goToExercise', exerciseIndex: 0 }).activeSession?.currentExerciseIndex).toBe(0);
  });

  it('sans séance active → état inchangé', () => {
    const s = createDefaultState();
    expect(appReducer(s, { type: 'session/validateSet', exerciseIndex: 0, setIndex: 0 })).toBe(s);
    expect(appReducer(s, { type: 'session/goToExercise', exerciseIndex: 1 })).toBe(s);
  });
});

describe('appReducer — historique et données', () => {
  it('supprime une séance de l’historique', () => {
    const s = run(
      createDefaultState(),
      { type: 'session/startFree', sessionId: 'a', now: T0 },
      { type: 'session/finish', now: T1 },
      { type: 'history/delete', sessionId: 'a' },
    );
    expect(s.sessions).toEqual([]);
  });

  it('replace et reset', () => {
    const other = withTemplate();
    expect(appReducer(createDefaultState(), { type: 'data/replace', state: other })).toBe(other);
    expect(appReducer(other, { type: 'data/reset' })).toEqual(createDefaultState());
  });
});
