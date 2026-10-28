import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { createId } from '../lib/id';
import { loadState, saveState, type StorageLike } from '../lib/storage';
import { createTemplate, type TemplateInput } from '../lib/templates';
import type { AppState, MuscleGroup } from '../lib/types';
import { appReducer } from './appReducer';

export interface AppActions {
  createTemplate(input: TemplateInput): string;
  updateTemplate(id: string, patch: Partial<TemplateInput>): void;
  duplicateTemplate(id: string): string;
  deleteTemplate(id: string): void;
  moveTemplateExercise(id: string, index: number, direction: 'up' | 'down'): void;

  addCustomExercise(name: string, muscleGroup: MuscleGroup): string;
  updateCustomExercise(id: string, name: string, muscleGroup: MuscleGroup): void;
  deleteCustomExercise(id: string): void;

  startSessionFromTemplate(templateId: string): void;
  startFreeSession(): void;
  addSessionExercise(exerciseId: string): void;
  removeSessionExercise(exerciseIndex: number): void;
  addSet(exerciseIndex: number): void;
  removeSet(exerciseIndex: number, setIndex: number): void;
  updateSet(exerciseIndex: number, setIndex: number, patch: { weight?: number; reps?: number }): void;
  setSetDone(exerciseIndex: number, setIndex: number, done: boolean): void;
  finishSession(): void;
  abandonSession(): void;

  deleteSession(sessionId: string): void;
  applySessionToTemplate(sessionId: string): void;

  replaceState(state: AppState): void;
  resetState(): void;
}

export interface AppStoreValue {
  state: AppState;
  /** Message si les données stockées étaient illisibles au démarrage. */
  loadError?: string;
  /** Vrai si la dernière sauvegarde a échoué. */
  saveFailed: boolean;
  actions: AppActions;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children, storage }: { children: ReactNode; storage?: StorageLike }) {
  const [initial] = useState(() => loadState(storage));
  const [state, dispatch] = useReducer(appReducer, initial.state);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    // Pas de sauvegarde au démarrage : on n'écrase pas des données corrompues tant
    // que l'utilisateur n'a rien modifié.
    if (state === initial.state) return;
    setSaveFailed(!saveState(state, storage));
  }, [state, storage, initial.state]);

  const actions = useMemo<AppActions>(() => {
    const now = () => new Date();
    return {
      createTemplate(input) {
        const template = createTemplate(input, now(), createId());
        dispatch({ type: 'template/save', template });
        return template.id;
      },
      updateTemplate: (id, patch) => dispatch({ type: 'template/update', id, patch, now: now() }),
      duplicateTemplate(id) {
        const newId = createId();
        dispatch({ type: 'template/duplicate', id, newId, now: now() });
        return newId;
      },
      deleteTemplate: (id) => dispatch({ type: 'template/delete', id }),
      moveTemplateExercise: (id, index, direction) =>
        dispatch({ type: 'template/moveExercise', id, index, direction, now: now() }),

      addCustomExercise(name, muscleGroup) {
        const id = `custom-${createId()}`;
        dispatch({ type: 'exercise/addCustom', id, name, muscleGroup });
        return id;
      },
      updateCustomExercise: (id, name, muscleGroup) =>
        dispatch({ type: 'exercise/updateCustom', id, name, muscleGroup }),
      deleteCustomExercise: (id) => dispatch({ type: 'exercise/deleteCustom', id }),

      startSessionFromTemplate: (templateId) =>
        dispatch({ type: 'session/startFromTemplate', templateId, sessionId: createId(), now: now() }),
      startFreeSession: () => dispatch({ type: 'session/startFree', sessionId: createId(), now: now() }),
      addSessionExercise: (exerciseId) => dispatch({ type: 'session/addExercise', exerciseId }),
      removeSessionExercise: (exerciseIndex) => dispatch({ type: 'session/removeExercise', exerciseIndex }),
      addSet: (exerciseIndex) => dispatch({ type: 'session/addSet', exerciseIndex }),
      removeSet: (exerciseIndex, setIndex) => dispatch({ type: 'session/removeSet', exerciseIndex, setIndex }),
      updateSet: (exerciseIndex, setIndex, patch) =>
        dispatch({ type: 'session/updateSet', exerciseIndex, setIndex, ...patch }),
      setSetDone: (exerciseIndex, setIndex, done) =>
        dispatch({ type: 'session/setDone', exerciseIndex, setIndex, done }),
      finishSession: () => dispatch({ type: 'session/finish', now: now() }),
      abandonSession: () => dispatch({ type: 'session/abandon' }),

      deleteSession: (sessionId) => dispatch({ type: 'history/delete', sessionId }),
      applySessionToTemplate: (sessionId) => dispatch({ type: 'history/applyToTemplate', sessionId, now: now() }),

      replaceState: (next) => dispatch({ type: 'data/replace', state: next }),
      resetState: () => dispatch({ type: 'data/reset' }),
    };
  }, []);

  const value = useMemo<AppStoreValue>(
    () => ({ state, loadError: initial.error, saveFailed, actions }),
    [state, initial.error, saveFailed, actions],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error('useAppStore doit être utilisé dans <AppStoreProvider>.');
  return ctx;
}
