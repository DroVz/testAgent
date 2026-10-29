import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { createId } from '../lib/id';
import { createDefaultState, loadState, saveState, type StorageLike } from '../lib/storage';
import { createTemplate, type TemplateInput } from '../lib/templates';
import type { AppState, LoadSuggestion, MuscleGroup, SessionExercise } from '../lib/types';
import { captureUndo, type DeletionTarget, type UndoSnapshot } from '../lib/undo';
import { appReducer } from './appReducer';

export interface AppActions {
  createTemplate(input: TemplateInput): string;
  updateTemplate(id: string, patch: Partial<TemplateInput>): void;
  duplicateTemplate(id: string): string;
  /** Supprime une séance type ; renvoie l'instantané permettant d'annuler (`restore`). */
  deleteTemplate(id: string): UndoSnapshot | undefined;
  moveTemplateExercise(id: string, index: number, direction: 'up' | 'down'): void;

  addCustomExercise(name: string, muscleGroup: MuscleGroup): string;
  updateCustomExercise(id: string, name: string, muscleGroup: MuscleGroup): void;
  deleteCustomExercise(id: string): void;

  startSessionFromTemplate(templateId: string): void;
  startFreeSession(): void;
  addSessionExercise(exerciseId: string): void;
  /** Retire un exercice de la séance en cours ; renvoie l'instantané permettant d'annuler. */
  removeSessionExercise(exerciseIndex: number): UndoSnapshot | undefined;
  addSet(exerciseIndex: number): void;
  /** Supprime une série de la séance en cours ; renvoie l'instantané permettant d'annuler. */
  removeSet(exerciseIndex: number, setIndex: number): UndoSnapshot | undefined;
  updateSet(exerciseIndex: number, setIndex: number, patch: { weight?: number; reps?: number }): void;
  setSetDone(exerciseIndex: number, setIndex: number, done: boolean): void;
  /** Valide une série ; passe à l'exercice suivant si c'était la dernière de l'exercice affiché. */
  validateSet(exerciseIndex: number, setIndex: number): void;
  /** Affiche un autre exercice de la séance (mode « un exercice à la fois »). */
  goToExercise(exerciseIndex: number): void;
  /** « Rester à 80 kg » : séries non validées aux valeurs de la dernière fois, note retirée. */
  keepLastLoad(exerciseIndex: number): void;
  /** « Annuler » après « Rester à … » : remet la note et les valeurs proposées. */
  reapplySuggestion(exercise: SessionExercise, suggestion: LoadSuggestion): void;
  finishSession(): void;
  abandonSession(): void;

  /** Supprime une séance de l'historique ; renvoie l'instantané permettant d'annuler. */
  deleteSession(sessionId: string): UndoSnapshot | undefined;
  applySessionToTemplate(sessionId: string): void;
  /**
   * Annule une suppression : l'entité revient à sa place exacte. Sans effet si les données ont été
   * remplacées depuis (import, réinitialisation) ou si l'instantané ne vient pas de ce store.
   */
  restore(snapshot: UndoSnapshot): void;

  /** Réglage « Suggérer la charge suivante » (séances démarrées ensuite). */
  setSuggestLoad(enabled: boolean): void;

  /** Remplace toutes les données et les sauvegarde immédiatement ; renvoie false si la sauvegarde a échoué. */
  replaceState(state: AppState): boolean;
  /** Revient à l'état par défaut et le sauvegarde immédiatement ; renvoie false si la sauvegarde a échoué. */
  resetState(): boolean;
  /** Masque le bandeau d'erreur de chargement. */
  dismissLoadError(): void;
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
  const [loadError, setLoadError] = useState(initial.error);
  // État courant pour capturer l'instantané d'une suppression (les actions sont stables).
  const stateRef = useRef(state);
  stateRef.current = state;
  /**
   * Génération des données : incrémentée à chaque remplacement complet (import, réinitialisation).
   * Un instantané pris avant ne peut plus être restauré : « Annuler » ne réinjecte rien dans des
   * données remplacées.
   */
  const generation = useRef(0);
  const snapshotGeneration = useRef(new WeakMap<UndoSnapshot, number>());

  useEffect(() => {
    // Pas de sauvegarde au démarrage : on n'écrase pas des données corrompues tant
    // que l'utilisateur n'a rien modifié.
    if (state === initial.state) return;
    setSaveFailed(!saveState(state, storage));
  }, [state, storage, initial.state]);

  const actions = useMemo<AppActions>(() => {
    const now = () => new Date();
    /** Capture ce qui va disparaître, puis supprime. */
    const remove = (target: DeletionTarget, action: Parameters<typeof dispatch>[0]): UndoSnapshot | undefined => {
      const snapshot = captureUndo(stateRef.current, target);
      if (snapshot) snapshotGeneration.current.set(snapshot, generation.current);
      dispatch(action);
      return snapshot;
    };
    /** Sauvegarde synchrone d'un état complet : en cas de succès, l'erreur de chargement n'a plus lieu d'être. */
    const replaceAndSave = (next: AppState): boolean => {
      generation.current += 1;
      const ok = saveState(next, storage);
      setSaveFailed(!ok);
      if (ok) setLoadError(undefined);
      dispatch({ type: 'data/replace', state: next });
      return ok;
    };
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
      deleteTemplate: (id) => remove({ kind: 'template', id }, { type: 'template/delete', id }),
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
      removeSessionExercise: (exerciseIndex) =>
        remove({ kind: 'sessionExercise', exerciseIndex }, { type: 'session/removeExercise', exerciseIndex }),
      addSet: (exerciseIndex) => dispatch({ type: 'session/addSet', exerciseIndex }),
      removeSet: (exerciseIndex, setIndex) =>
        remove({ kind: 'sessionSet', exerciseIndex, setIndex }, { type: 'session/removeSet', exerciseIndex, setIndex }),
      updateSet: (exerciseIndex, setIndex, patch) =>
        dispatch({ type: 'session/updateSet', exerciseIndex, setIndex, ...patch }),
      setSetDone: (exerciseIndex, setIndex, done) =>
        dispatch({ type: 'session/setDone', exerciseIndex, setIndex, done }),
      validateSet: (exerciseIndex, setIndex) => dispatch({ type: 'session/validateSet', exerciseIndex, setIndex }),
      goToExercise: (exerciseIndex) => dispatch({ type: 'session/goToExercise', exerciseIndex }),
      keepLastLoad: (exerciseIndex) => dispatch({ type: 'session/keepLastLoad', exerciseIndex }),
      reapplySuggestion: (exercise, suggestion) => dispatch({ type: 'session/reapplySuggestion', exercise, suggestion }),
      finishSession: () => dispatch({ type: 'session/finish', now: now() }),
      abandonSession: () => dispatch({ type: 'session/abandon' }),

      deleteSession: (sessionId) =>
        remove({ kind: 'historySession', id: sessionId }, { type: 'history/delete', sessionId }),
      applySessionToTemplate: (sessionId) => dispatch({ type: 'history/applyToTemplate', sessionId, now: now() }),
      restore: (snapshot) => {
        if (snapshotGeneration.current.get(snapshot) !== generation.current) return;
        dispatch({ type: 'undo/restore', snapshot });
      },

      setSuggestLoad: (enabled) => dispatch({ type: 'settings/setSuggestLoad', enabled }),
      replaceState: (next) => replaceAndSave(next),
      resetState: () => replaceAndSave(createDefaultState()),
      dismissLoadError: () => setLoadError(undefined),
    };
  }, [storage]);

  const value = useMemo<AppStoreValue>(
    () => ({ state, loadError, saveFailed, actions }),
    [state, loadError, saveFailed, actions],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error('useAppStore doit être utilisé dans <AppStoreProvider>.');
  return ctx;
}
