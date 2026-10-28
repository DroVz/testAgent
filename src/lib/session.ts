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
  // L'exercice ajouté devient l'exercice affiché : c'est celui qu'on veut faire.
  return {
    ...session,
    exercises: [...session.exercises, { exerciseId, sets }],
    currentExerciseIndex: session.exercises.length,
  };
}

/**
 * Retire un exercice de la séance (sans effet si l'index est invalide). L'exercice affiché
 * reste le même s'il est toujours là ; sinon on affiche celui qui prend sa place (ou le précédent).
 */
export function removeExercise(session: WorkoutSession, exerciseIndex: number): WorkoutSession {
  if (exerciseIndex < 0 || exerciseIndex >= session.exercises.length) return session;
  const current = currentExerciseIndex(session);
  const exercises = session.exercises.filter((_, i) => i !== exerciseIndex);
  const next = exerciseIndex < current ? current - 1 : current;
  return { ...session, exercises, currentExerciseIndex: clampExerciseIndex(exercises.length, next) };
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

// ---------- Mode séance « un exercice à la fois » ----------

/** Borne un index d'exercice dans [0, count − 1] (0 si aucun exercice ou valeur invalide). */
export function clampExerciseIndex(count: number, index: number): number {
  if (!Number.isFinite(index) || count <= 0) return 0;
  return Math.min(Math.max(0, Math.floor(index)), count - 1);
}

/** Index de l'exercice affiché (champ absent = 0), toujours borné. */
export function currentExerciseIndex(session: WorkoutSession): number {
  return clampExerciseIndex(session.exercises.length, session.currentExerciseIndex ?? 0);
}

/** Affiche un autre exercice (index borné). */
export function goToExercise(session: WorkoutSession, index: number): WorkoutSession {
  const next = clampExerciseIndex(session.exercises.length, index);
  return next === session.currentExerciseIndex ? session : { ...session, currentExerciseIndex: next };
}

/** Série en cours d'un exercice : la première série non validée, ou -1 si toutes sont faites. */
export function currentSetIndex(exercise: SessionExercise | undefined): number {
  return exercise ? exercise.sets.findIndex((s) => !s.done) : -1;
}

/** Nombre de séries non validées dans toute la séance. */
export function pendingSetCount(session: WorkoutSession): number {
  return session.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0);
}

/**
 * Exercice à afficher après `fromIndex` : le prochain qui a encore une série non validée,
 * sinon simplement le suivant. -1 s'il n'y a pas d'exercice après `fromIndex`.
 */
export function nextExerciseIndex(session: WorkoutSession, fromIndex: number): number {
  if (fromIndex + 1 >= session.exercises.length) return -1;
  for (let i = fromIndex + 1; i < session.exercises.length; i++) {
    if (currentSetIndex(session.exercises[i]) !== -1) return i;
  }
  return fromIndex + 1;
}

/**
 * Valide une série **non encore validée**. Si c'était la dernière série en attente de l'exercice
 * affiché, on passe au prochain exercice qui a des séries en attente (sinon au suivant).
 *
 * Une série déjà validée renvoie la séance inchangée : corriger une série faite n'est pas une
 * validation (pas de navigation) ; la correction passe par `updateSet`.
 */
export function validateSet(session: WorkoutSession, exerciseIndex: number, setIndex: number): WorkoutSession {
  const set = session.exercises[exerciseIndex]?.sets[setIndex];
  if (!set || set.done) return session;
  const next = setSetDone(session, exerciseIndex, setIndex, true);
  const exerciseDone = currentSetIndex(next.exercises[exerciseIndex]) === -1;
  const isDisplayed = exerciseIndex === currentExerciseIndex(session);
  const target = exerciseDone && isDisplayed ? nextExerciseIndex(next, exerciseIndex) : -1;
  return target === -1 ? next : { ...next, currentExerciseIndex: target };
}

/**
 * Termine la séance : retire les séries non validées et les exercices sans série validée,
 * et pose `endedAt`. L'index d'exercice affiché (propre à la séance en cours) est retiré.
 */
export function finishSession(session: WorkoutSession, now: Date = new Date()): WorkoutSession {
  const { currentExerciseIndex: _displayed, ...rest } = session;
  return {
    ...rest,
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
