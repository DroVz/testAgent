import {
  countedSessions,
  detectNewRecords,
  sessionVolume,
  startOfMonth,
  startOfWeek,
  strongestRecords,
} from './stats';
import type { AppSettings, WeeklyGoal, WorkoutSession } from './types';

/**
 * Lot 3 « Ton rythme » (docs/product/lot3-rythme.md) : objectif hebdo choisi, bilan, jalons.
 * Calculs purs, `now` injecté ; rien n'est stocké, tout se recalcule depuis les séances.
 */

export { countedSessions };

/** Objectifs proposés : 1 à 6 séances par semaine (pas de 7 : un jour de repos reste un repère). */
export const WEEKLY_GOALS: readonly WeeklyGoal[] = [1, 2, 3, 4, 5, 6];

/** Pastilles de la carte de proposition (Progrès). */
export const PROPOSED_GOALS: readonly WeeklyGoal[] = [2, 3, 4];

/** Seuil de séances comptées à partir duquel l'objectif est proposé une fois. */
export const GOAL_PROMPT_MIN_SESSIONS = 2;

export function isWeeklyGoal(v: unknown): v is WeeklyGoal {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 6;
}

/** Objectif actuel ; undefined = « Aucun ». */
export function weeklyGoalOf(state: { settings?: AppSettings }): WeeklyGoal | undefined {
  const goal = state.settings?.weeklyGoal;
  return isWeeklyGoal(goal) ? goal : undefined;
}

export interface Period {
  /** Inclus. */
  from: Date;
  /** Exclu. */
  to: Date;
}

/** Semaine de `now` : lundi 00:00 → lundi suivant 00:00 (heure locale, `setDate` : juste aux changements d'heure). */
export function weekRange(now: Date = new Date()): Period {
  const from = startOfWeek(now);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return { from, to };
}

/** Semaine complète précédant celle de `now`. */
export function previousWeekRange(now: Date = new Date()): Period {
  const { from: to } = weekRange(now);
  const from = new Date(to);
  from.setDate(from.getDate() - 7);
  return { from, to };
}

/** Mois civil de `now` : 1er 00:00 → 1er du mois suivant 00:00 (heure locale). */
export function monthRange(now: Date = new Date()): Period {
  const from = startOfMonth(now);
  return { from, to: new Date(from.getFullYear(), from.getMonth() + 1, 1) };
}

/** Mois civil précédant celui de `now`. */
export function previousMonthRange(now: Date = new Date()): Period {
  const { from: to } = monthRange(now);
  return { from: new Date(to.getFullYear(), to.getMonth() - 1, 1), to };
}

/** Une séance appartient à la période qui contient son `startedAt`. */
export function startsIn(session: WorkoutSession, { from, to }: Period): boolean {
  const t = Date.parse(session.startedAt);
  return t >= from.getTime() && t < to.getTime();
}

function countedIn(sessions: WorkoutSession[], period: Period): WorkoutSession[] {
  return countedSessions(sessions).filter((s) => startsIn(s, period));
}

/** Séances comptées dans la semaine de `now` (une séance datée dans le futur attend sa semaine). */
export function weekCount(sessions: WorkoutSession[], now: Date = new Date()): number {
  return countedIn(sessions, weekRange(now)).length;
}

export interface PeriodSummary {
  count: number;
  /** kg. */
  volume: number;
  /** Un record au plus par exercice et par séance, comme dans le récap. */
  records: number;
}

/** Bilan de [from, to[ ; les records se comparent à tout l'historique antérieur à chaque séance. */
export function periodSummary(sessions: WorkoutSession[], from: Date, to: Date): PeriodSummary {
  const inPeriod = countedIn(sessions, { from, to });
  return {
    count: inPeriod.length,
    volume: inPeriod.reduce((sum, s) => sum + sessionVolume(s), 0),
    records: inPeriod.reduce((n, s) => n + strongestRecords(detectNewRecords(s, sessions)).length, 0),
  };
}

export interface ProgressReview {
  /** Semaine dernière, absente si elle compte 0 séance. */
  lastWeek?: PeriodSummary;
  /**
   * Mois en cours (`isCurrent: true`) s'il compte au moins 1 séance ; sinon, du 1er au 7 seulement,
   * le mois précédent (`isCurrent: false`) s'il compte au moins 1 séance ; sinon absent. On ne met
   * pas une période passée à côté d'une période en cours vide (identity §9.3).
   */
  month?: PeriodSummary & { monthStart: Date; isCurrent: boolean };
}

/** Bilan affiché sous les tuiles de Progrès (§4.2). Ne mentionne jamais l'objectif. */
export function progressReview(sessions: WorkoutSession[], now: Date = new Date()): ProgressReview {
  const review: ProgressReview = {};
  const week = previousWeekRange(now);
  const lastWeek = periodSummary(sessions, week.from, week.to);
  if (lastWeek.count > 0) review.lastWeek = lastWeek;
  const current = monthRange(now);
  const month = periodSummary(sessions, current.from, current.to);
  if (month.count > 0) {
    review.month = { ...month, monthStart: current.from, isCurrent: true };
  } else if (now.getDate() <= 7) {
    // Début de mois : le mois précédent, pour que le 1er ne soit pas vide.
    const previous = previousMonthRange(now);
    const summary = periodSummary(sessions, previous.from, previous.to);
    if (summary.count > 0) review.month = { ...summary, monthStart: previous.from, isCurrent: false };
  }
  return review;
}

/** Jalons : 1, 10, 25, 50, 100, puis tous les 100. */
export function isMilestone(rank: number): boolean {
  return rank === 1 || rank === 10 || rank === 25 || rank === 50 || (rank >= 100 && rank % 100 === 0);
}

/** Rang (à partir de 1) parmi les séances comptées, par `startedAt` ; undefined si non comptée. Indépendant de `now`. */
export function sessionRank(sessions: WorkoutSession[], sessionId: string): number | undefined {
  const index = countedSessions(sessions).findIndex((s) => s.id === sessionId);
  return index < 0 ? undefined : index + 1;
}

/**
 * Compte de la semaine au moment de cette séance (récap) : séances comptées de sa semaine commencées
 * au plus tard en même temps qu'elle. undefined si la séance n'est pas comptée ou si sa semaine n'est
 * pas la semaine en cours (une semaine passée ne se compare jamais à l'objectif).
 */
export function weekCountAtSession(
  sessions: WorkoutSession[],
  sessionId: string,
  now: Date = new Date(),
): number | undefined {
  const counted = countedSessions(sessions);
  const session = counted.find((s) => s.id === sessionId);
  if (!session) return undefined;
  const week = weekRange(now);
  if (!startsIn(session, week)) return undefined;
  // Liste triée par `startedAt` : les séances jusqu'à celle-ci (même départage que le rang).
  const index = counted.indexOf(session);
  return counted.slice(0, index + 1).filter((s) => startsIn(s, week)).length;
}

/** Carte de proposition d'objectif (Progrès, §5.2) : objectif « Aucun », jamais demandé, ≥ 2 séances comptées. */
export function shouldProposeWeeklyGoal(state: { settings?: AppSettings; sessions: WorkoutSession[] }): boolean {
  if (weeklyGoalOf(state) !== undefined || state.settings?.weeklyGoalAsked === true) return false;
  return countedSessions(state.sessions).length >= GOAL_PROMPT_MIN_SESSIONS;
}
