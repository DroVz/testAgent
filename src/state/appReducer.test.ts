import { describe, expect, it } from 'vitest';
import { STARTER_PROGRAMS, buildProgramTemplates } from '../lib/programs';
import { createDefaultState } from '../lib/storage';
import { createTemplate, createTemplateExercise } from '../lib/templates';
import type { AppState } from '../lib/types';
import { captureUndo, type DeletionTarget } from '../lib/undo';
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

/** Ids prévisibles « p1 », « p2 »… */
function sequence() {
  let n = 0;
  return () => `p${++n}`;
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

  it('programme de départ : ajout à la fin en une action, annulation exacte et idempotente', () => {
    const before = withTemplate();
    const templates = buildProgramTemplates(STARTER_PROGRAMS[0], before.templates.map((t) => t.name), T1, sequence());
    const added = appReducer(before, { type: 'template/addMany', templates });
    expect(added.templates.map((t) => t.name)).toEqual(['Push', 'Full body A', 'Full body B']);
    expect(added.templates[0]).toBe(before.templates[0]);
    // Rejouer l'ajout ne crée pas de doublon d'id.
    expect(appReducer(added, { type: 'template/addMany', templates })).toBe(added);

    const undone = appReducer(added, { type: 'template/removeMany', ids: ['p1', 'p2'] });
    expect(undone.templates).toEqual(before.templates);
    // Second appel : rien ne change.
    expect(appReducer(undone, { type: 'template/removeMany', ids: ['p1', 'p2'] })).toBe(undone);
  });

  it('annuler l’ajout depuis un état vide revient à l’état vide ; une séance déjà supprimée est ignorée', () => {
    const empty = createDefaultState();
    const templates = buildProgramTemplates(STARTER_PROGRAMS[0], [], T1, sequence());
    let s = appReducer(empty, { type: 'template/addMany', templates });
    s = appReducer(s, { type: 'template/delete', id: 'p1' });
    s = appReducer(s, { type: 'template/removeMany', ids: ['p1', 'p2'] });
    expect(s.templates).toEqual([]);
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

describe('appReducer — son en fin de repos', () => {
  it('setRestSound enregistre le réglage sans toucher aux autres', () => {
    const s = run(createDefaultState(), { type: 'settings/setWeeklyGoal', goal: 3 }, { type: 'settings/setRestSound', enabled: false });
    expect(s.settings).toEqual({ weeklyGoal: 3, weeklyGoalAsked: true, restSound: false });
    expect(appReducer(s, { type: 'settings/setRestSound', enabled: true }).settings?.restSound).toBe(true);
  });
});

describe('appReducer — objectif par semaine (lot 3)', () => {
  it('setWeeklyGoal enregistre l’objectif et marque la question comme posée, sans toucher aux autres réglages', () => {
    const s = run(createDefaultState(), { type: 'settings/setSuggestLoad', enabled: false }, { type: 'settings/setWeeklyGoal', goal: 3 });
    expect(s.settings).toEqual({ suggestLoad: false, weeklyGoal: 3, weeklyGoalAsked: true });
  });

  it('« Aucun » retire settings.weeklyGoal (ni 0 ni null) et pose weeklyGoalAsked', () => {
    const s = run(createDefaultState(), { type: 'settings/setWeeklyGoal', goal: 4 }, { type: 'settings/setWeeklyGoal', goal: undefined });
    expect(s.settings).toEqual({ weeklyGoalAsked: true });
    expect(s.settings).not.toHaveProperty('weeklyGoal');
    // Choisir « Aucun » d'emblée compte aussi comme un choix.
    expect(appReducer(createDefaultState(), { type: 'settings/setWeeklyGoal', goal: undefined }).settings).toEqual({
      weeklyGoalAsked: true,
    });
  });

  it('« Non merci » : objectif inchangé (« Aucun »), proposition écartée', () => {
    const s = appReducer(createDefaultState(), { type: 'settings/dismissWeeklyGoalPrompt' });
    expect(s.settings).toEqual({ weeklyGoalAsked: true });
  });

  it('réinitialisation : objectif « Aucun » et proposition de nouveau possible', () => {
    const s = run(createDefaultState(), { type: 'settings/setWeeklyGoal', goal: 2 }, { type: 'data/reset' });
    expect(s.settings).toBeUndefined();
  });
});

describe('appReducer — annulation d’une suppression (toast « Annuler »)', () => {
  /** Supprime puis annule : l'état doit redevenir strictement identique. */
  function deleteThenUndo(before: AppState, target: DeletionTarget, action: AppAction): { deleted: AppState; restored: AppState } {
    const snapshot = captureUndo(before, target);
    expect(snapshot).toBeDefined();
    const deleted = appReducer(before, action);
    expect(deleted).not.toEqual(before);
    const restored = appReducer(deleted, { type: 'undo/restore', snapshot: snapshot! });
    return { deleted, restored };
  }

  /** 3 séances types, 3 séances passées, une séance en cours de 3 exercices (le 2e affiché). */
  function richState(): AppState {
    let s = createDefaultState();
    for (const [id, name] of [['t1', 'Push'], ['t2', 'Pull'], ['t3', 'Jambes']]) {
      s.templates.push(createTemplate({ name, exercises: [createTemplateExercise('squat')] }, T0, id));
    }
    for (const id of ['h1', 'h2', 'h3']) {
      s = run(s, { type: 'session/startFree', sessionId: id, now: T0 }, { type: 'session/finish', now: T1 });
    }
    s = run(
      s,
      { type: 'session/startFromTemplate', templateId: 't1', sessionId: 'live', now: T0 },
      { type: 'session/addExercise', exerciseId: 'dips' },
      { type: 'session/addExercise', exerciseId: 'tractions' },
      { type: 'session/goToExercise', exerciseIndex: 1 },
      // Série faite sur un exercice non affiché : pas de passage automatique.
      { type: 'session/validateSet', exerciseIndex: 0, setIndex: 0 },
    );
    return s;
  }

  it('séance type : revient à sa position exacte', () => {
    const before = richState();
    const { deleted, restored } = deleteThenUndo(before, { kind: 'template', id: 't2' }, { type: 'template/delete', id: 't2' });
    expect(deleted.templates.map((t) => t.id)).toEqual(['t1', 't3']);
    expect(restored).toStrictEqual(before);
  });

  it('séance de l’historique : revient à sa position exacte', () => {
    const before = richState();
    const { restored } = deleteThenUndo(before, { kind: 'historySession', id: 'h2' }, { type: 'history/delete', sessionId: 'h2' });
    expect(restored).toStrictEqual(before);
  });

  it('série en séance (la dernière, et une du milieu) : valeurs et état « faite » restaurés', () => {
    const before = richState();
    const last = before.activeSession!.exercises[0].sets.length - 1;
    expect(
      deleteThenUndo(before, { kind: 'sessionSet', exerciseIndex: 0, setIndex: last }, { type: 'session/removeSet', exerciseIndex: 0, setIndex: last })
        .restored,
    ).toStrictEqual(before);
    expect(
      deleteThenUndo(before, { kind: 'sessionSet', exerciseIndex: 1, setIndex: 0 }, { type: 'session/removeSet', exerciseIndex: 1, setIndex: 0 })
        .restored,
    ).toStrictEqual(before);
  });

  it('exercice en séance : position et currentExerciseIndex restaurés', () => {
    const before = richState();
    expect(before.activeSession?.currentExerciseIndex).toBe(1);
    for (const exerciseIndex of [0, 1, 2]) {
      const { deleted, restored } = deleteThenUndo(
        before,
        { kind: 'sessionExercise', exerciseIndex },
        { type: 'session/removeExercise', exerciseIndex },
      );
      expect(deleted.activeSession?.exercises).toHaveLength(2);
      expect(restored).toStrictEqual(before);
    }
  });

  it('exercice en séance sans currentExerciseIndex (séance ancienne) : le champ reste absent', () => {
    const before = richState();
    const { currentExerciseIndex: _drop, ...legacy } = before.activeSession!;
    before.activeSession = legacy;
    const { restored } = deleteThenUndo(before, { kind: 'sessionExercise', exerciseIndex: 0 }, { type: 'session/removeExercise', exerciseIndex: 0 });
    expect(restored).toStrictEqual(before);
    expect(restored.activeSession).not.toHaveProperty('currentExerciseIndex');
  });

  it('les autres modifications faites entre-temps sont conservées', () => {
    const before = richState();
    const snapshot = captureUndo(before, { kind: 'template', id: 't1' })!;
    const s = run(
      before,
      { type: 'template/delete', id: 't1' },
      { type: 'template/update', id: 't3', patch: { name: 'Legs' }, now: T1 },
      { type: 'undo/restore', snapshot },
    );
    expect(s.templates.map((t) => t.name)).toEqual(['Push', 'Pull', 'Legs']);
  });

  it('annulation sans objet → état inchangé (déjà restauré, séance terminée, exercice déplacé)', () => {
    const before = richState();
    const tpl = captureUndo(before, { kind: 'template', id: 't1' })!;
    expect(appReducer(before, { type: 'undo/restore', snapshot: tpl })).toBe(before);

    const set = captureUndo(before, { kind: 'sessionSet', exerciseIndex: 0, setIndex: 0 })!;
    const finished = run(before, { type: 'session/removeSet', exerciseIndex: 0, setIndex: 0 }, { type: 'session/finish', now: T1 });
    expect(appReducer(finished, { type: 'undo/restore', snapshot: set })).toBe(finished);

    const ex = captureUndo(before, { kind: 'sessionExercise', exerciseIndex: 2 })!;
    const other = run(before, { type: 'session/abandon' }, { type: 'session/startFree', sessionId: 'autre', now: T1 });
    expect(appReducer(other, { type: 'undo/restore', snapshot: ex })).toBe(other);

    // L'exercice à cette position a changé : on ne réinsère pas la série au mauvais endroit.
    const moved = run(before, { type: 'session/removeSet', exerciseIndex: 0, setIndex: 0 }, { type: 'session/removeExercise', exerciseIndex: 0 });
    expect(appReducer(moved, { type: 'undo/restore', snapshot: set })).toBe(moved);
  });

  it('idempotent : appliquer deux fois la même annulation ne crée pas de doublon', () => {
    const before = richState();
    const cases: [DeletionTarget, AppAction][] = [
      [{ kind: 'sessionSet', exerciseIndex: 0, setIndex: 1 }, { type: 'session/removeSet', exerciseIndex: 0, setIndex: 1 }],
      [{ kind: 'sessionExercise', exerciseIndex: 1 }, { type: 'session/removeExercise', exerciseIndex: 1 }],
      [{ kind: 'template', id: 't2' }, { type: 'template/delete', id: 't2' }],
      [{ kind: 'historySession', id: 'h2' }, { type: 'history/delete', sessionId: 'h2' }],
    ];
    for (const [target, action] of cases) {
      const snapshot = captureUndo(before, target)!;
      const once = run(before, action, { type: 'undo/restore', snapshot });
      const twice = appReducer(once, { type: 'undo/restore', snapshot });
      expect(twice, target.kind).toBe(once);
      expect(twice, target.kind).toStrictEqual(before);
    }
  });

  it('série supprimée, autre série du même exercice validée entre-temps, puis Annuler : les deux sont conservées', () => {
    const before = richState();
    // Exercice 0 : 3 séries (la 1re faite) + 1 ajoutée = 4 séries.
    const start = run(before, { type: 'session/addSet', exerciseIndex: 0 });
    const sets = start.activeSession!.exercises[0].sets;
    expect(sets.map((x) => x.done)).toEqual([true, false, false, false]);
    const snapshot = captureUndo(start, { kind: 'sessionSet', exerciseIndex: 0, setIndex: 2 })!;
    const s = run(
      start,
      { type: 'session/removeSet', exerciseIndex: 0, setIndex: 2 },
      // Validation d'une autre série du même exercice pendant le toast
      { type: 'session/updateSet', exerciseIndex: 0, setIndex: 1, weight: 72.5 },
      { type: 'session/validateSet', exerciseIndex: 0, setIndex: 1 },
      { type: 'undo/restore', snapshot },
    );
    const after = s.activeSession!.exercises[0].sets;
    expect(after).toHaveLength(4);
    // La validation faite entre-temps est conservée…
    expect(after[1]).toEqual({ ...sets[1], weight: 72.5, done: true });
    // …et la série supprimée revient à son index, avec ses valeurs.
    expect(after[2]).toBe(sets[2]);
    expect(after[0]).toBe(sets[0]);
    expect(after[3]).toBe(sets[3]);
    expect(s.activeSession!.currentExerciseIndex).toBe(start.activeSession!.currentExerciseIndex);
  });

  it('cible introuvable → pas d’instantané', () => {
    const s = richState();
    expect(captureUndo(s, { kind: 'template', id: 'x' })).toBeUndefined();
    expect(captureUndo(s, { kind: 'historySession', id: 'x' })).toBeUndefined();
    expect(captureUndo(s, { kind: 'sessionSet', exerciseIndex: 0, setIndex: 99 })).toBeUndefined();
    expect(captureUndo(createDefaultState(), { kind: 'sessionExercise', exerciseIndex: 0 })).toBeUndefined();
  });
});
