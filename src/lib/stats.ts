import type { SessionExercise, SetEntry, WorkoutSession } from './types';

/** 1RM estimé (Epley). reps = 1 → poids ; reps ≤ 0 ou valeur non finie → 0. */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function doneSets(sets: SetEntry[]): SetEntry[] {
  return sets.filter((s) => s.done);
}

export function setVolume(set: SetEntry): number {
  return set.weight * set.reps;
}

/** Volume (Σ poids × reps) des séries validées d'un exercice de séance. */
export function exerciseVolume(exercise: SessionExercise): number {
  return doneSets(exercise.sets).reduce((sum, s) => sum + setVolume(s), 0);
}

/** Volume total des séries validées d'une séance. */
export function sessionVolume(session: WorkoutSession): number {
  return session.exercises.reduce((sum, e) => sum + exerciseVolume(e), 0);
}

/** Nombre de séries validées d'une séance. */
export function countDoneSets(session: WorkoutSession): number {
  return session.exercises.reduce((n, e) => n + doneSets(e.sets).length, 0);
}

/** Durée en ms (jusqu'à `now` si la séance n'est pas terminée). Jamais négative. */
export function sessionDurationMs(session: WorkoutSession, now: Date = new Date()): number {
  const start = Date.parse(session.startedAt);
  const end = session.endedAt ? Date.parse(session.endedAt) : now.getTime();
  return Math.max(0, end - start);
}

/** Séances terminées triées de la plus ancienne à la plus récente. */
export function completedSessions(sessions: WorkoutSession[]): WorkoutSession[] {
  return sessions
    .filter((s) => s.endedAt !== undefined)
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
}

/** Toutes les séries validées d'un exercice dans une séance (l'exercice peut apparaître plusieurs fois). */
function doneSetsFor(session: WorkoutSession, exerciseId: string): SetEntry[] {
  return session.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => doneSets(e.sets));
}

export interface ExerciseMetrics {
  maxWeight: number;
  bestOneRepMax: number;
  volume: number;
}

function metricsOf(sets: SetEntry[]): ExerciseMetrics {
  return {
    maxWeight: Math.max(0, ...sets.map((s) => s.weight)),
    bestOneRepMax: Math.max(0, ...sets.map((s) => estimateOneRepMax(s.weight, s.reps))),
    volume: sets.reduce((sum, s) => sum + setVolume(s), 0),
  };
}

export interface ExerciseHistoryPoint extends ExerciseMetrics {
  sessionId: string;
  /** Date ISO de début de séance. */
  date: string;
}

/** Historique d'un exercice : un point par séance terminée comportant au moins une série validée. */
export function exerciseHistory(sessions: WorkoutSession[], exerciseId: string): ExerciseHistoryPoint[] {
  const points: ExerciseHistoryPoint[] = [];
  for (const s of completedSessions(sessions)) {
    const sets = doneSetsFor(s, exerciseId);
    if (sets.length === 0) continue;
    points.push({ sessionId: s.id, date: s.startedAt, ...metricsOf(sets) });
  }
  return points;
}

export interface RecordValue {
  value: number;
  sessionId: string;
  date: string;
}

export interface PersonalRecords {
  maxWeight?: RecordValue;
  bestOneRepMax?: RecordValue;
  bestVolume?: RecordValue;
}

/** Records personnels d'un exercice (en cas d'égalité, la première occurrence est retenue). */
export function personalRecords(sessions: WorkoutSession[], exerciseId: string): PersonalRecords {
  const records: PersonalRecords = {};
  const keep = (key: keyof PersonalRecords, value: number, p: ExerciseHistoryPoint) => {
    if (value > 0 && (records[key] === undefined || value > records[key].value)) {
      records[key] = { value, sessionId: p.sessionId, date: p.date };
    }
  };
  for (const p of exerciseHistory(sessions, exerciseId)) {
    keep('maxWeight', p.maxWeight, p);
    keep('bestOneRepMax', p.bestOneRepMax, p);
    keep('bestVolume', p.volume, p);
  }
  return records;
}

export interface LastPerformance {
  sessionId: string;
  date: string;
  sets: SetEntry[];
}

/**
 * Séries validées de la séance terminée la plus récente contenant l'exercice
 * (avec au moins une série validée), ou undefined.
 */
export function lastPerformance(
  sessions: WorkoutSession[],
  exerciseId: string,
): LastPerformance | undefined {
  const ordered = completedSessions(sessions);
  for (let i = ordered.length - 1; i >= 0; i--) {
    const sets = doneSetsFor(ordered[i], exerciseId);
    if (sets.length > 0) {
      return { sessionId: ordered[i].id, date: ordered[i].startedAt, sets: sets.map((s) => ({ ...s })) };
    }
  }
  return undefined;
}

export type RecordType = 'maxWeight' | 'bestOneRepMax' | 'bestVolume';

export interface NewRecord {
  exerciseId: string;
  type: RecordType;
  value: number;
  previous: number;
}

/**
 * Records battus par `session` par rapport aux séances terminées antérieures
 * (commencées avant elle). Un exercice sans historique antérieur ne génère pas de record ;
 * s'il a un historique dont le meilleur est 0 (ex. poids du corps), toute valeur > 0 est un record
 * (précédent = 0).
 */
export function detectNewRecords(session: WorkoutSession, history: WorkoutSession[]): NewRecord[] {
  const start = Date.parse(session.startedAt);
  const previous = history.filter((s) => s.id !== session.id && Date.parse(s.startedAt) < start);
  const exerciseIds = [...new Set(session.exercises.map((e) => e.exerciseId))];
  const result: NewRecord[] = [];

  for (const exerciseId of exerciseIds) {
    const sets = doneSetsFor(session, exerciseId);
    if (sets.length === 0) continue;
    if (exerciseHistory(previous, exerciseId).length === 0) continue;
    const prs = personalRecords(previous, exerciseId);
    const current = metricsOf(sets);
    const checks: [RecordType, number][] = [
      ['maxWeight', current.maxWeight],
      ['bestOneRepMax', current.bestOneRepMax],
      ['bestVolume', current.volume],
    ];
    for (const [type, value] of checks) {
      const prev = prs[type]?.value ?? 0;
      if (value > prev) {
        result.push({ exerciseId, type, value, previous: prev });
      }
    }
  }
  return result;
}

/**
 * Ordre de préférence quand un exercice bat plusieurs records : le poids max d'abord (c'est le
 * chiffre réellement soulevé, celui que l'utilisateur voit), puis le 1RM (estimé, donc dérivé),
 * puis le volume (qui dépend surtout du nombre de séries).
 */
const RECORD_PRIORITY: RecordType[] = ['maxWeight', 'bestOneRepMax', 'bestVolume'];

/** Un seul record par exercice, le plus significatif ; l'ordre des exercices est conservé. */
export function strongestRecords(records: NewRecord[]): NewRecord[] {
  const best = new Map<string, NewRecord>();
  for (const r of records) {
    const current = best.get(r.exerciseId);
    if (!current || RECORD_PRIORITY.indexOf(r.type) < RECORD_PRIORITY.indexOf(current.type)) {
      best.set(r.exerciseId, r);
    }
  }
  return [...best.values()];
}

/** Début de semaine (lundi 00:00, heure locale). */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - offset);
  return d;
}

/** Début de mois (1er à 00:00, heure locale). */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function countBetween(sessions: WorkoutSession[], from: Date, to: Date): number {
  return completedSessions(sessions).filter((s) => {
    const t = Date.parse(s.startedAt);
    return t >= from.getTime() && t < to.getTime();
  }).length;
}

/** Nombre de séances terminées dans la semaine courante (lundi → dimanche). */
export function sessionsThisWeek(sessions: WorkoutSession[], now: Date = new Date()): number {
  const from = startOfWeek(now);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return countBetween(sessions, from, to);
}

/** Nombre de séances terminées dans le mois civil courant. */
export function sessionsThisMonth(sessions: WorkoutSession[], now: Date = new Date()): number {
  const from = startOfMonth(now);
  const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  return countBetween(sessions, from, to);
}

/** Date ISO de la dernière séance terminée issue de la séance type, ou undefined si jamais faite. */
export function templateLastDoneAt(sessions: WorkoutSession[], templateId: string): string | undefined {
  let best: string | undefined;
  for (const s of sessions) {
    if (s.templateId !== templateId || s.endedAt === undefined) continue;
    if (best === undefined || Date.parse(s.startedAt) > Date.parse(best)) best = s.startedAt;
  }
  return best;
}

/**
 * Séance type la plus probable pour aujourd'hui : parmi celles déjà faites, celle qui n'a pas été
 * faite depuis le plus longtemps ; si aucune n'a été faite, la première. undefined si la liste est vide.
 */
export function suggestedTemplateId(templates: { id: string }[], sessions: WorkoutSession[]): string | undefined {
  let pick: { id: string; at: number } | undefined;
  for (const t of templates) {
    const last = templateLastDoneAt(sessions, t.id);
    if (last === undefined) continue;
    const at = Date.parse(last);
    if (pick === undefined || at < pick.at) pick = { id: t.id, at };
  }
  return pick?.id ?? templates[0]?.id;
}
