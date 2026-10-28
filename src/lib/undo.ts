import type { AppState, SessionExercise, SetEntry, Template, WorkoutSession } from './types';

/**
 * Annulation des suppressions (toast « Annuler », identity.md §4.8).
 *
 * Avant une suppression, on capture un instantané **ciblé** de ce qui va disparaître (l'entité et
 * sa position). L'annulation réinsère l'entité à sa place : l'état redevient strictement identique,
 * sans écraser les autres modifications faites entre-temps.
 */

/** Ce que l'utilisateur supprime. */
export type DeletionTarget =
  | { kind: 'template'; id: string }
  | { kind: 'historySession'; id: string }
  | { kind: 'sessionExercise'; exerciseIndex: number }
  | { kind: 'sessionSet'; exerciseIndex: number; setIndex: number };

/** Instantané ciblé permettant de restaurer une suppression. */
export type UndoSnapshot =
  | { kind: 'template'; index: number; template: Template }
  | { kind: 'historySession'; index: number; session: WorkoutSession }
  | {
      kind: 'sessionExercise';
      sessionId: string;
      exerciseIndex: number;
      exercise: SessionExercise;
      /** Valeur exacte du champ avant suppression (absent = undefined). */
      currentExerciseIndex: number | undefined;
    }
  | {
      kind: 'sessionSet';
      sessionId: string;
      exerciseIndex: number;
      /** Garde-fou : l'exercice à cette position doit toujours être le même. */
      exerciseId: string;
      setIndex: number;
      set: SetEntry;
    };

/** Instantané de ce que `target` va supprimer dans `state`, ou undefined si la cible n'existe pas. */
export function captureUndo(state: AppState, target: DeletionTarget): UndoSnapshot | undefined {
  switch (target.kind) {
    case 'template': {
      const index = state.templates.findIndex((t) => t.id === target.id);
      return index < 0 ? undefined : { kind: 'template', index, template: state.templates[index] };
    }
    case 'historySession': {
      const index = state.sessions.findIndex((s) => s.id === target.id);
      return index < 0 ? undefined : { kind: 'historySession', index, session: state.sessions[index] };
    }
    case 'sessionExercise': {
      const active = state.activeSession;
      const exercise = active?.exercises[target.exerciseIndex];
      if (!active || !exercise) return undefined;
      return {
        kind: 'sessionExercise',
        sessionId: active.id,
        exerciseIndex: target.exerciseIndex,
        exercise,
        currentExerciseIndex: active.currentExerciseIndex,
      };
    }
    case 'sessionSet': {
      const active = state.activeSession;
      const exercise = active?.exercises[target.exerciseIndex];
      const set = exercise?.sets[target.setIndex];
      if (!active || !exercise || !set) return undefined;
      return {
        kind: 'sessionSet',
        sessionId: active.id,
        exerciseIndex: target.exerciseIndex,
        exerciseId: exercise.exerciseId,
        setIndex: target.setIndex,
        set,
      };
    }
  }
}

/** Insère `item` à la position `index` (bornée) sans modifier la liste d'origine. */
export function insertAt<T>(list: T[], index: number, item: T): T[] {
  const at = Math.min(Math.max(0, index), list.length);
  return [...list.slice(0, at), item, ...list.slice(at)];
}

/**
 * Réinsère l'entité de l'instantané. Idempotent : sans effet si elle est déjà revenue (même id pour
 * une séance type ou une séance passée, même objet pour une série ou un exercice de la séance en
 * cours), ou si son contexte a disparu (séance terminée ou abandonnée, exercice déplacé…).
 */
export function restoreSnapshot(state: AppState, snapshot: UndoSnapshot): AppState {
  switch (snapshot.kind) {
    case 'template':
      if (state.templates.some((t) => t.id === snapshot.template.id)) return state;
      return { ...state, templates: insertAt(state.templates, snapshot.index, snapshot.template) };
    case 'historySession':
      if (state.sessions.some((s) => s.id === snapshot.session.id)) return state;
      return { ...state, sessions: insertAt(state.sessions, snapshot.index, snapshot.session) };
    case 'sessionExercise': {
      const active = state.activeSession;
      if (!active || active.id !== snapshot.sessionId || snapshot.exerciseIndex > active.exercises.length) return state;
      // Idempotent : l'instantané (même objet) est déjà dans la séance → rien à faire.
      if (active.exercises.includes(snapshot.exercise)) return state;
      const { currentExerciseIndex: _previous, ...rest } = active;
      const restored: WorkoutSession = {
        ...rest,
        exercises: insertAt(active.exercises, snapshot.exerciseIndex, snapshot.exercise),
      };
      // Le champ est remis tel quel (y compris absent) : l'exercice affiché redevient celui d'avant.
      if (snapshot.currentExerciseIndex !== undefined) restored.currentExerciseIndex = snapshot.currentExerciseIndex;
      return { ...state, activeSession: restored };
    }
    case 'sessionSet': {
      const active = state.activeSession;
      const exercise = active?.exercises[snapshot.exerciseIndex];
      if (
        !active ||
        !exercise ||
        active.id !== snapshot.sessionId ||
        exercise.exerciseId !== snapshot.exerciseId ||
        snapshot.setIndex > exercise.sets.length ||
        // Idempotent : la série restaurée (même objet) est déjà là → pas de doublon.
        exercise.sets.includes(snapshot.set)
      ) {
        return state;
      }
      const exercises = active.exercises.map((e, i) =>
        i === snapshot.exerciseIndex ? { ...e, sets: insertAt(e.sets, snapshot.setIndex, snapshot.set) } : e,
      );
      return { ...state, activeSession: { ...active, exercises } };
    }
  }
}
