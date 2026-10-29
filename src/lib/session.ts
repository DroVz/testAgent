import { createId } from './id';
import { suggestLoad } from './progression';
import { doneSets, lastPerformance } from './stats';
import type { LoadSuggestion, SessionExercise, SetEntry, Template, WorkoutSession } from './types';

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

/** Valeurs de la dernière fois, série par série (la dernière série est répétée au-delà). */
function lastValuesAt(last: SetEntry[], i: number): Pick<SetEntry, 'weight' | 'reps'> {
  const src = last[Math.min(i, last.length - 1)];
  return { weight: src.weight, reps: src.reps };
}

/**
 * Exercice de séance type pré-rempli : `targetSets` séries (au moins 1). Avec une charge proposée,
 * toutes les séries la reprennent ; sinon valeurs de la dernière performance, sinon les objectifs.
 */
function prefillExercise(
  exerciseId: string,
  history: WorkoutSession[],
  target: { sets: number; reps: number; weight?: number },
  suggest: boolean,
  now: Date,
): SessionExercise {
  const count = Math.max(1, target.sets);
  const performance = lastPerformance(history, exerciseId);
  const last = performance?.sets;
  const suggestion = suggestLoad({
    target: { targetSets: target.sets, targetReps: target.reps },
    last,
    enabled: suggest,
    lastStartedAt: performance?.date,
    now,
  });
  const sets = Array.from({ length: count }, (_, i): SetEntry => {
    if (suggestion) return { weight: suggestion.toWeight, reps: suggestion.toReps, done: false };
    if (last) return { ...lastValuesAt(last, i), done: false };
    return { weight: target.weight ?? 0, reps: target.reps, done: false };
  });
  return suggestion ? { exerciseId, sets, suggestion } : { exerciseId, sets };
}

/**
 * Crée une séance à partir d'une séance type. `suggestLoadEnabled` : réglage « Suggérer la charge
 * suivante » (activé par défaut).
 */
export function createSessionFromTemplate(
  template: Template,
  history: WorkoutSession[],
  now: Date = new Date(),
  id: string = createId(),
  suggestLoadEnabled = true,
): WorkoutSession {
  return {
    id,
    templateId: template.id,
    name: template.name,
    startedAt: now.toISOString(),
    exercises: template.exercises.map((te) =>
      prefillExercise(
        te.exerciseId,
        history,
        { sets: te.targetSets, reps: te.targetReps, weight: te.targetWeight },
        suggestLoadEnabled,
        now,
      ),
    ),
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

/**
 * « Rester à 80 kg » : les séries non validées reprennent les valeurs de la dernière fois (série par
 * série, comme le pré-remplissage sans suggestion) et la note disparaît.
 */
export function keepLastLoad(session: WorkoutSession, exerciseIndex: number, history: WorkoutSession[]): WorkoutSession {
  const ex = session.exercises[exerciseIndex];
  if (!ex?.suggestion) return session;
  const { suggestion, ...rest } = ex;
  const last = lastPerformance(history, ex.exerciseId)?.sets;
  const values = (i: number) => (last ? lastValuesAt(last, i) : { weight: suggestion.fromWeight, reps: suggestion.fromReps });
  return mapExercise(session, exerciseIndex, () => ({
    ...rest,
    sets: ex.sets.map((s, i) => (s.done ? s : { ...s, ...values(i) })),
  }));
}

/**
 * « Annuler » après « Rester à … » : remet la note et les valeurs proposées sur les séries non validées.
 * L'exercice est retrouvé par référence (l'objet de la séance juste après « Rester à … »), pas par
 * index : il reste trouvé si un autre exercice a été retiré ou ajouté entre-temps. Sans effet s'il a
 * changé depuis (série validée ou modifiée) ou s'il n'est plus dans la séance.
 */
export function reapplySuggestion(
  session: WorkoutSession,
  exercise: SessionExercise,
  suggestion: LoadSuggestion,
): WorkoutSession {
  const exerciseIndex = session.exercises.indexOf(exercise);
  if (exerciseIndex === -1) return session;
  return mapExercise(session, exerciseIndex, (e) => ({
    ...e,
    suggestion,
    sets: e.sets.map((s) => (s.done ? s : { ...s, weight: suggestion.toWeight, reps: suggestion.toReps })),
  }));
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
 * et pose `endedAt`. L'index d'exercice affiché et les charges proposées (propres à la séance en
 * cours) sont retirés.
 */
export function finishSession(session: WorkoutSession, now: Date = new Date()): WorkoutSession {
  const { currentExerciseIndex: _displayed, ...rest } = session;
  return {
    ...rest,
    endedAt: now.toISOString(),
    exercises: session.exercises
      .map(({ suggestion: _suggestion, ...e }) => ({ ...e, sets: doneSets(e.sets) }))
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
