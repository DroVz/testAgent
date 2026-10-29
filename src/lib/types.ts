export const MUSCLE_GROUPS = [
  'Pectoraux',
  'Dos',
  'Jambes',
  'Épaules',
  'Biceps',
  'Triceps',
  'Abdos',
  'Autre',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  isCustom: boolean;
}

export interface TemplateExercise {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  targetWeight?: number;
  /** Temps de repos en secondes (défaut 90). */
  restSeconds: number;
}

export interface Template {
  id: string;
  name: string;
  exercises: TemplateExercise[];
  /** Date ISO. */
  createdAt: string;
  /** Date ISO. */
  updatedAt: string;
}

export interface SetEntry {
  /** Poids en kg, ≥ 0, décimales autorisées. */
  weight: number;
  /** Répétitions, entier ≥ 0. */
  reps: number;
  done: boolean;
}

/**
 * Charge proposée (lot 1) : la dernière fois, toutes les séries ont atteint l'objectif à `fromWeight`.
 * `fromReps` = plus petit nombre de reps de la dernière fois ; `sameReps` : toutes au même nombre.
 */
export interface LoadSuggestion {
  fromWeight: number;
  fromReps: number;
  toWeight: number;
  toReps: number;
  sameReps: boolean;
}

export interface SessionExercise {
  exerciseId: string;
  sets: SetEntry[];
  /** Charge proposée à la création de la séance ; retirée par « Rester à … » et à la fin de la séance. */
  suggestion?: LoadSuggestion;
}

export interface WorkoutSession {
  id: string;
  templateId?: string;
  name: string;
  /** Date ISO. */
  startedAt: string;
  /** Date ISO, absente tant que la séance est en cours. */
  endedAt?: string;
  exercises: SessionExercise[];
  notes?: string;
  /**
   * Séance en cours uniquement : index de l'exercice affiché (mode « un exercice à la fois »).
   * Optionnel (rétrocompatible) ; absent = 0 ; retiré à la fin de la séance.
   */
  currentExerciseIndex?: number;
}

export interface AppSettings {
  /** « Suggérer la charge suivante » ; absent = activé. */
  suggestLoad?: boolean;
}

export interface AppState {
  version: 1;
  exercises: Exercise[];
  templates: Template[];
  sessions: WorkoutSession[];
  activeSession?: WorkoutSession;
  /** Réglages ; absent (anciens exports) = valeurs par défaut. */
  settings?: AppSettings;
}

export const DEFAULT_REST_SECONDS = 90;
