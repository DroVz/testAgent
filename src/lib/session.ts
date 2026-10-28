import { createId } from './id';
import { doneSets, lastPerformance } from './stats';
import type { SessionExercise, SetEntry, Template, WorkoutSession } from './types';

export const FREE_SESSION_NAME = 'Séance libre';

/** Poids maximal accepté (kg). */
export const MAX_WEIGHT = 1000;
/** Nombre maximal de répétitions accepté. */
export const MAX_REPS = 1000;

/** Normalise un poids : nombre fini ≥ 0 (sinon 0), plafonné à MAX_WEIGHT. Décimales conservées. */
export function sanitizeWeight(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.min(value, MAX_WEIGHT) : 0;
}

/** Normalise des répétitions : entier ≥ 0 (sinon 0), plafonné à MAX_REPS. */
export function sanitizeReps(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), MAX_REPS) : 0;
}

/**
 * Séries pré-remplies pour un exercice de séance type : `targetSets` séries (au moins 1),
 * valeurs de la dernière performance si elle existe, sinon les objectifs.
 */
function prefillSets(
  exerciseId: string,
  history: WorkoutSession[],
  target: { sets: number; reps: number; weight?: number },
): SetEntry[] {
  const count = Math.max(1, target.sets);
  const last = lastPerformance(history, exerciseId);
  return Array.from({ length: count }, (_, i) => {
    if (last) {
      const src = last.sets[Math.min(i, last.sets.length - 1)];
      return { weight: src.weight, reps: src.reps, done: false };
    }
    return { weight: target.weight ?? 0, reps: target.reps, done: false };
  });
}

/** Crée une séance à partir d'une séance type. */
export function createSessionFromTemplate(
  template: Template,
  history: WorkoutSession[],
  now: Date = new Date(),
  id: string = createId(),
): WorkoutSession {
  return {
    id,
    templateId: template.id,
    name: template.name,
    startedAt: now.toISOString(),
    exercises: template.exercises.map((te) => ({
      exerciseId: te.exerciseId,
      sets: prefillSets(te.exerciseId, history, {
        sets: te.targetSets,
        reps: te.targetReps,
        weight: te.targetWeight,
      }),
    })),
  };
}

/** Crée une séance libre vide. */
export function createFreeSession(
  now: Date = new Date(),
  id: string = createId(),
  name: string = FREE_SESSION_NAME,
): WorkoutSession {
  return { id, name, startedAt: now.toISOString(), exercises: [] };
}

function mapExercise(
  session: WorkoutSession,
  exerciseIndex: number,
  fn: (e: SessionExercise) => SessionExercise,
): WorkoutSession {
  if (exerciseIndex < 0 || exerciseIndex >= session.exercises.length) return session;
  return {
    ...session,
    exercises: session.exercises.map((e, i) => (i === exerciseIndex ? fn(e) : e)),
  };
}

function mapSet(
  session: WorkoutSession,
  exerciseIndex: number,
  setIndex: number,
  fn: (s: SetEntry) => SetEntry,
): WorkoutSession {
  const ex = session.exercises[exerciseIndex];
  if (!ex || setIndex < 0 || setIndex >= ex.sets.length) return session;
  return mapExercise(session, exerciseIndex, (e) => ({
    ...e,
    sets: e.sets.map((s, i) => (i === setIndex ? fn(s) : s)),
  }));
}

/**
 * Ajoute un exercice à la volée, pré-rempli avec les séries de la dernière performance
 * (non validées), sinon une série vide.
 */
export function addExercise(
  session: WorkoutSession,
  exerciseId: string,
  history: WorkoutSession[],
): WorkoutSession {
  const last = lastPerformance(history, exerciseId);
  const sets: SetEntry[] = last
    ? last.sets.map((s) => ({ weight: s.weight, reps: s.reps, done: false }))
    : [{ weight: 0, reps: 0, done: false }];
  return { ...session, exercises: [...session.exercises, { exerciseId, sets }] };
}

/** Retire un exercice de la séance (sans effet si l'index est invalide). */
export function removeExercise(session: WorkoutSession, exerciseIndex: number): WorkoutSession {
  if (exerciseIndex < 0 || exerciseIndex >= session.exercises.length) return session;
  return { ...session, exercises: session.exercises.filter((_, i) => i !== exerciseIndex) };
}

/** Ajoute une série recopiant les valeurs de la dernière série de l'exercice (non validée). */
export function addSet(session: WorkoutSession, exerciseIndex: number): WorkoutSession {
  return mapExercise(session, exerciseIndex, (e) => {
    const prev = e.sets[e.sets.length - 1];
    const next: SetEntry = prev
      ? { weight: prev.weight, reps: prev.reps, done: false }
      : { weight: 0, reps: 0, done: false };
    return { ...e, sets: [...e.sets, next] };
  });
}

export function removeSet(
  session: WorkoutSession,
  exerciseIndex: number,
  setIndex: number,
): WorkoutSession {
  return mapExercise(session, exerciseIndex, (e) => ({
    ...e,
    sets: e.sets.filter((_, i) => i !== setIndex),
  }));
}

/** Met à jour poids et/ou reps d'une série (valeurs normalisées). */
export function updateSet(
  session: WorkoutSession,
  exerciseIndex: number,
  setIndex: number,
  patch: Partial<Pick<SetEntry, 'weight' | 'reps'>>,
): WorkoutSession {
  return mapSet(session, exerciseIndex, setIndex, (s) => ({
    ...s,
    ...(patch.weight !== undefined && { weight: sanitizeWeight(patch.weight) }),
    ...(patch.reps !== undefined && { reps: sanitizeReps(patch.reps) }),
  }));
}

/** Valide (done = true) ou dévalide une série. */
export function setSetDone(
  session: WorkoutSession,
  exerciseIndex: number,
  setIndex: number,
  done: boolean,
): WorkoutSession {
  return mapSet(session, exerciseIndex, setIndex, (s) => ({ ...s, done }));
}

/**
 * Termine la séance : retire les séries non validées et les exercices sans série validée,
 * et pose `endedAt`.
 */
export function finishSession(session: WorkoutSession, now: Date = new Date()): WorkoutSession {
  return {
    ...session,
    endedAt: now.toISOString(),
    exercises: session.exercises
      .map((e) => ({ ...e, sets: doneSets(e.sets) }))
      .filter((e) => e.sets.length > 0),
  };
}

/**
 * Met à jour la séance type avec les poids réalisés : pour chaque exercice présent dans la
 * séance, `targetWeight` devient le poids max des séries validées. Le reste est inchangé.
 */
export function applySessionToTemplate(
  template: Template,
  session: WorkoutSession,
  now: Date = new Date(),
): Template {
  let changed = false;
  const exercises = template.exercises.map((te) => {
    const sets = session.exercises
      .filter((e) => e.exerciseId === te.exerciseId)
      .flatMap((e) => doneSets(e.sets));
    if (sets.length === 0) return te;
    const weight = Math.max(...sets.map((s) => s.weight));
    if (weight === te.targetWeight) return te;
    changed = true;
    return { ...te, targetWeight: weight };
  });
  return changed ? { ...template, exercises, updatedAt: now.toISOString() } : template;
}
