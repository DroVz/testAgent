import {
  addExercise,
  addSet,
  applySessionToTemplate,
  createFreeSession,
  createSessionFromTemplate,
  finishSession,
  goToExercise,
  keepLastLoad,
  reapplySuggestion,
  removeExercise,
  removeSet,
  setSetDone,
  updateSet,
  validateSet,
} from '../lib/session';
import { isSuggestLoadEnabled } from '../lib/progression';
import { createDefaultState, normalizeExerciseNote } from '../lib/storage';
import {
  deleteTemplate,
  duplicateTemplate,
  moveTemplateExercise,
  updateTemplate,
  upsertTemplate,
  type TemplateInput,
} from '../lib/templates';
import type {
  AppSettings,
  AppState,
  Exercise,
  LoadSuggestion,
  MuscleGroup,
  SessionExercise,
  Template,
  WeeklyGoal,
  WorkoutSession,
} from '../lib/types';
import { restoreSnapshot, type UndoSnapshot } from '../lib/undo';

/**
 * Actions du store. Les valeurs non déterministes (`now`, `id`) sont fournies dans l'action
 * pour que le reducer reste pur.
 */
export type AppAction =
  // Séances types
  | { type: 'template/save'; template: Template }
  | { type: 'template/update'; id: string; patch: Partial<TemplateInput>; now: Date }
  | { type: 'template/duplicate'; id: string; newId: string; now: Date }
  | { type: 'template/delete'; id: string }
  /** Ajout groupé à la fin de la liste (programme de départ). */
  | { type: 'template/addMany'; templates: Template[] }
  /** Retrait groupé par ids (annulation de l'ajout d'un programme) ; sans effet si aucun n'existe. */
  | { type: 'template/removeMany'; ids: string[] }
  | { type: 'template/moveExercise'; id: string; index: number; direction: 'up' | 'down'; now: Date }
  // Exercices personnalisés
  | { type: 'exercise/addCustom'; id: string; name: string; muscleGroup: MuscleGroup }
  | { type: 'exercise/updateCustom'; id: string; name: string; muscleGroup: MuscleGroup }
  | { type: 'exercise/deleteCustom'; id: string }
  /**
   * Note d'exercice (lot 6), sur tout exercice (bibliothèque ou personnalisé). Nettoyée par `trim()` ;
   * vide ou absente = champ retiré.
   */
  | { type: 'exercise/setNote'; id: string; note: string | undefined }
  // Séance en cours
  | { type: 'session/startFromTemplate'; templateId: string; sessionId: string; now: Date }
  | { type: 'session/startFree'; sessionId: string; now: Date }
  | { type: 'session/addExercise'; exerciseId: string }
  | { type: 'session/removeExercise'; exerciseIndex: number }
  | { type: 'session/addSet'; exerciseIndex: number }
  | { type: 'session/removeSet'; exerciseIndex: number; setIndex: number }
  | { type: 'session/updateSet'; exerciseIndex: number; setIndex: number; weight?: number; reps?: number }
  | { type: 'session/setDone'; exerciseIndex: number; setIndex: number; done: boolean }
  | { type: 'session/validateSet'; exerciseIndex: number; setIndex: number }
  | { type: 'session/goToExercise'; exerciseIndex: number }
  | { type: 'session/keepLastLoad'; exerciseIndex: number }
  | { type: 'session/reapplySuggestion'; exercise: SessionExercise; suggestion: LoadSuggestion }
  | { type: 'session/finish'; now: Date }
  | { type: 'session/abandon' }
  // Historique
  | { type: 'history/delete'; sessionId: string }
  | { type: 'history/applyToTemplate'; sessionId: string; now: Date }
  // Annulation d'une suppression (toast « Annuler »)
  | { type: 'undo/restore'; snapshot: UndoSnapshot }
  // Réglages
  | { type: 'settings/setSuggestLoad'; enabled: boolean }
  /** Objectif par semaine ; undefined = « Aucun » (le champ est retiré). Marque la question comme posée. */
  | { type: 'settings/setWeeklyGoal'; goal: WeeklyGoal | undefined }
  /** « Non merci » sur la carte de proposition : elle ne revient plus. */
  | { type: 'settings/dismissWeeklyGoalPrompt' }
  | { type: 'settings/setRestSound'; enabled: boolean }
  | { type: 'settings/setBackupReminder'; enabled: boolean }
  // Données
  | { type: 'data/replace'; state: AppState }
  | { type: 'data/reset' };

function withActive(state: AppState, fn: (s: WorkoutSession) => WorkoutSession): AppState {
  if (!state.activeSession) return state;
  const next = fn(state.activeSession);
  return next === state.activeSession ? state : { ...state, activeSession: next };
}

function withTemplate(state: AppState, id: string, fn: (t: Template) => Template): AppState {
  const t = state.templates.find((x) => x.id === id);
  if (!t) return state;
  const next = fn(t);
  return next === t ? state : { ...state, templates: upsertTemplate(state.templates, next) };
}

function updateCustomExercise(state: AppState, id: string, fn: (e: Exercise) => Exercise): AppState {
  return {
    ...state,
    exercises: state.exercises.map((e) => (e.id === id && e.isCustom ? fn(e) : e)),
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'template/save':
      return { ...state, templates: upsertTemplate(state.templates, action.template) };
    case 'template/update':
      return withTemplate(state, action.id, (t) => updateTemplate(t, action.patch, action.now));
    case 'template/duplicate': {
      const src = state.templates.find((t) => t.id === action.id);
      if (!src) return state;
      return { ...state, templates: [...state.templates, duplicateTemplate(src, action.now, action.newId)] };
    }
    case 'template/delete':
      return { ...state, templates: deleteTemplate(state.templates, action.id) };
    case 'template/addMany': {
      // Pas de doublon d'id : un ajout rejoué ne crée rien de plus.
      const fresh = action.templates.filter((t) => !state.templates.some((x) => x.id === t.id));
      return fresh.length === 0 ? state : { ...state, templates: [...state.templates, ...fresh] };
    }
    case 'template/removeMany': {
      const ids = new Set(action.ids);
      const templates = state.templates.filter((t) => !ids.has(t.id));
      return templates.length === state.templates.length ? state : { ...state, templates };
    }
    case 'template/moveExercise':
      return withTemplate(state, action.id, (t) =>
        moveTemplateExercise(t, action.index, action.direction, action.now),
      );

    case 'exercise/addCustom': {
      const name = action.name.trim();
      if (name === '' || state.exercises.some((e) => e.id === action.id)) return state;
      return {
        ...state,
        exercises: [...state.exercises, { id: action.id, name, muscleGroup: action.muscleGroup, isCustom: true }],
      };
    }
    case 'exercise/updateCustom': {
      const name = action.name.trim();
      if (name === '') return state;
      return updateCustomExercise(state, action.id, (e) => ({ ...e, name, muscleGroup: action.muscleGroup }));
    }
    case 'exercise/setNote': {
      const note = normalizeExerciseNote(action.note);
      const target = state.exercises.find((e) => e.id === action.id);
      if (!target || target.note === note) return state;
      return {
        ...state,
        exercises: state.exercises.map((e) => {
          if (e !== target) return e;
          const { note: _previous, ...rest } = e;
          return note === undefined ? rest : { ...rest, note };
        }),
      };
    }
    case 'exercise/deleteCustom':
      return { ...state, exercises: state.exercises.filter((e) => !(e.id === action.id && e.isCustom)) };

    case 'session/startFromTemplate': {
      if (state.activeSession) return state;
      const template = state.templates.find((t) => t.id === action.templateId);
      if (!template) return state;
      return {
        ...state,
        activeSession: createSessionFromTemplate(
          template,
          state.sessions,
          action.now,
          action.sessionId,
          isSuggestLoadEnabled(state),
        ),
      };
    }
    case 'session/startFree':
      if (state.activeSession) return state;
      return { ...state, activeSession: createFreeSession(action.now, action.sessionId) };
    case 'session/addExercise':
      return withActive(state, (s) => addExercise(s, action.exerciseId, state.sessions));
    case 'session/removeExercise':
      return withActive(state, (s) => removeExercise(s, action.exerciseIndex));
    case 'session/addSet':
      return withActive(state, (s) => addSet(s, action.exerciseIndex));
    case 'session/removeSet':
      return withActive(state, (s) => removeSet(s, action.exerciseIndex, action.setIndex));
    case 'session/updateSet':
      return withActive(state, (s) =>
        updateSet(s, action.exerciseIndex, action.setIndex, { weight: action.weight, reps: action.reps }),
      );
    case 'session/setDone':
      return withActive(state, (s) => setSetDone(s, action.exerciseIndex, action.setIndex, action.done));
    case 'session/validateSet':
      return withActive(state, (s) => validateSet(s, action.exerciseIndex, action.setIndex));
    case 'session/goToExercise':
      return withActive(state, (s) => goToExercise(s, action.exerciseIndex));
    case 'session/keepLastLoad':
      return withActive(state, (s) => keepLastLoad(s, action.exerciseIndex, state.sessions));
    case 'session/reapplySuggestion':
      return withActive(state, (s) => reapplySuggestion(s, action.exercise, action.suggestion));
    case 'session/finish': {
      if (!state.activeSession) return state;
      const finished = finishSession(state.activeSession, action.now);
      return { ...state, sessions: [...state.sessions, finished], activeSession: undefined };
    }
    case 'session/abandon':
      return { ...state, activeSession: undefined };

    case 'history/delete':
      return { ...state, sessions: state.sessions.filter((s) => s.id !== action.sessionId) };
    case 'history/applyToTemplate': {
      const session = state.sessions.find((s) => s.id === action.sessionId);
      if (!session?.templateId) return state;
      return withTemplate(state, session.templateId, (t) => applySessionToTemplate(t, session, action.now));
    }

    case 'undo/restore':
      return restoreSnapshot(state, action.snapshot);

    case 'settings/setSuggestLoad':
      // S'applique aux séances démarrées ensuite : la séance en cours n'est pas modifiée.
      return { ...state, settings: { ...state.settings, suggestLoad: action.enabled } };
    case 'settings/setWeeklyGoal': {
      // « Aucun » retire le champ : ni 0 ni null stocké.
      const settings: AppSettings = { ...state.settings, weeklyGoalAsked: true };
      if (action.goal === undefined) delete settings.weeklyGoal;
      else settings.weeklyGoal = action.goal;
      return { ...state, settings };
    }
    case 'settings/dismissWeeklyGoalPrompt':
      return { ...state, settings: { ...state.settings, weeklyGoalAsked: true } };
    case 'settings/setRestSound':
      return { ...state, settings: { ...state.settings, restSound: action.enabled } };
    case 'settings/setBackupReminder': {
      // Réactiver retire le champ (absent = activé).
      const settings: AppSettings = { ...state.settings };
      if (action.enabled) delete settings.backupReminder;
      else settings.backupReminder = false;
      return { ...state, settings };
    }

    case 'data/replace':
      return action.state;
    case 'data/reset':
      return createDefaultState();
  }
}
