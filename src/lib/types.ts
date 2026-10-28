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

export interface SessionExercise {
  exerciseId: string;
  sets: SetEntry[];
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
}

export interface AppState {
  version: 1;
  exercises: Exercise[];
  templates: Template[];
  sessions: WorkoutSession[];
  activeSession?: WorkoutSession;
}

export const DEFAULT_REST_SECONDS = 90;
