import { COLON, NBSP } from './format';
import { DEFAULT_EXERCISES } from './defaultExercises';
import { MAX_REPS, MAX_WEIGHT, clampExerciseIndex } from './session';
import {
  MUSCLE_GROUPS,
  type AppSettings,
  type AppState,
  type Exercise,
  type LoadSuggestion,
  type SessionExercise,
  type SetEntry,
  type Template,
  type TemplateExercise,
  type WorkoutSession,
} from './types';

export const STORAGE_KEY = 'muscutrack:v1';

export type ParseResult = { ok: true; state: AppState } | { ok: false; error: string };

export interface LoadResult {
  state: AppState;
  /** Présent si les données stockées étaient illisibles (l'état par défaut est alors utilisé). */
  error?: string;
}

/** Sous-ensemble de l'API Storage utilisé (facilite les tests). */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function createDefaultState(): AppState {
  return {
    version: 1,
    exercises: DEFAULT_EXERCISES.map((e) => ({ ...e })),
    templates: [],
    sessions: [],
  };
}

// ---------- Validation ----------

class ValidationError extends Error {}

function fail(path: string, expected: string): never {
  throw new ValidationError(`${path}${COLON} ${expected} attendu`);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function obj(v: unknown, path: string): Record<string, unknown> {
  if (!isObject(v)) fail(path, 'objet');
  return v;
}

function str(v: unknown, path: string): string {
  if (typeof v !== 'string') fail(path, 'texte');
  return v;
}

function nonEmptyStr(v: unknown, path: string): string {
  const s = str(v, path);
  if (s.trim() === '') fail(path, 'texte non vide');
  return s;
}

function optStr(v: unknown, path: string): string | undefined {
  return v === undefined ? undefined : str(v, path);
}

function date(v: unknown, path: string): string {
  const s = str(v, path);
  if (Number.isNaN(Date.parse(s))) fail(path, 'date valide');
  return s;
}

function nonNegNumber(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) fail(path, 'nombre ≥ 0');
  return v;
}

function nonNegInt(v: unknown, path: string): number {
  const n = nonNegNumber(v, path);
  if (!Number.isInteger(n)) fail(path, 'entier ≥ 0');
  return n;
}

function weight(v: unknown, path: string): number {
  const n = nonNegNumber(v, path);
  if (n > MAX_WEIGHT) fail(path, `poids ≤ ${MAX_WEIGHT}${NBSP}kg`);
  return n;
}

function reps(v: unknown, path: string): number {
  const n = nonNegInt(v, path);
  if (n > MAX_REPS) fail(path, `répétitions ≤ ${MAX_REPS}`);
  return n;
}

function arr<T>(v: unknown, path: string, item: (x: unknown, p: string) => T): T[] {
  if (!Array.isArray(v)) fail(path, 'liste');
  return v.map((x, i) => item(x, `${path}[${i}]`));
}

function parseExercise(v: unknown, path: string): Exercise {
  const o = obj(v, path);
  const muscleGroup = o.muscleGroup as Exercise['muscleGroup'];
  if (!MUSCLE_GROUPS.includes(muscleGroup)) fail(`${path}.muscleGroup`, 'groupe musculaire connu');
  if (typeof o.isCustom !== 'boolean') fail(`${path}.isCustom`, 'booléen');
  return {
    id: nonEmptyStr(o.id, `${path}.id`),
    name: nonEmptyStr(o.name, `${path}.name`),
    muscleGroup,
    isCustom: o.isCustom,
  };
}

function parseTemplateExercise(v: unknown, path: string): TemplateExercise {
  const o = obj(v, path);
  const te: TemplateExercise = {
    exerciseId: nonEmptyStr(o.exerciseId, `${path}.exerciseId`),
    targetSets: nonNegInt(o.targetSets, `${path}.targetSets`),
    targetReps: reps(o.targetReps, `${path}.targetReps`),
    restSeconds: nonNegInt(o.restSeconds, `${path}.restSeconds`),
  };
  if (o.targetWeight !== undefined) {
    te.targetWeight = weight(o.targetWeight, `${path}.targetWeight`);
  }
  return te;
}

function parseTemplate(v: unknown, path: string): Template {
  const o = obj(v, path);
  return {
    id: nonEmptyStr(o.id, `${path}.id`),
    name: str(o.name, `${path}.name`),
    exercises: arr(o.exercises, `${path}.exercises`, parseTemplateExercise),
    createdAt: date(o.createdAt, `${path}.createdAt`),
    updatedAt: date(o.updatedAt, `${path}.updatedAt`),
  };
}

function parseSet(v: unknown, path: string): SetEntry {
  const o = obj(v, path);
  if (typeof o.done !== 'boolean') fail(`${path}.done`, 'booléen');
  return {
    weight: weight(o.weight, `${path}.weight`),
    reps: reps(o.reps, `${path}.reps`),
    done: o.done,
  };
}

function bool(v: unknown, path: string): boolean {
  if (typeof v !== 'boolean') fail(path, 'booléen');
  return v;
}

function parseSuggestion(v: unknown, path: string): LoadSuggestion {
  const o = obj(v, path);
  return {
    fromWeight: weight(o.fromWeight, `${path}.fromWeight`),
    fromReps: reps(o.fromReps, `${path}.fromReps`),
    toWeight: weight(o.toWeight, `${path}.toWeight`),
    toReps: reps(o.toReps, `${path}.toReps`),
    sameReps: bool(o.sameReps, `${path}.sameReps`),
  };
}

function parseSessionExercise(v: unknown, path: string): SessionExercise {
  const o = obj(v, path);
  const e: SessionExercise = {
    exerciseId: nonEmptyStr(o.exerciseId, `${path}.exerciseId`),
    sets: arr(o.sets, `${path}.sets`, parseSet),
  };
  // Optionnel (charge proposée, lot 1) : données antérieures sans ce champ acceptées.
  if (o.suggestion !== undefined) e.suggestion = parseSuggestion(o.suggestion, `${path}.suggestion`);
  return e;
}

/** Réglages optionnels : un export antérieur sans `settings` s'importe avec les valeurs par défaut. */
function parseSettings(v: unknown, path: string): AppSettings {
  const o = obj(v, path);
  const settings: AppSettings = {};
  if (o.suggestLoad !== undefined) settings.suggestLoad = bool(o.suggestLoad, `${path}.suggestLoad`);
  return settings;
}

function parseSession(v: unknown, path: string): WorkoutSession {
  const o = obj(v, path);
  const s: WorkoutSession = {
    id: nonEmptyStr(o.id, `${path}.id`),
    name: str(o.name, `${path}.name`),
    startedAt: date(o.startedAt, `${path}.startedAt`),
    exercises: arr(o.exercises, `${path}.exercises`, parseSessionExercise),
  };
  const templateId = optStr(o.templateId, `${path}.templateId`);
  if (templateId !== undefined) s.templateId = templateId;
  if (o.endedAt !== undefined) s.endedAt = date(o.endedAt, `${path}.endedAt`);
  const notes = optStr(o.notes, `${path}.notes`);
  if (notes !== undefined) s.notes = notes;
  // Optionnel (données antérieures sans ce champ acceptées) ; borné au nombre d'exercices.
  if (o.currentExerciseIndex !== undefined) {
    const index = nonNegInt(o.currentExerciseIndex, `${path}.currentExerciseIndex`);
    s.currentExerciseIndex = clampExerciseIndex(s.exercises.length, index);
  }
  return s;
}

function assertUniqueIds(items: { id: string }[], path: string): void {
  const seen = new Set<string>();
  for (const { id } of items) {
    if (seen.has(id)) throw new ValidationError(`${path}${COLON} identifiant en double « ${id} »`);
    seen.add(id);
  }
}

/**
 * Valide une valeur quelconque (ex. JSON parsé) et renvoie un état racine propre.
 * Les propriétés inconnues sont ignorées.
 */
export function parseAppState(raw: unknown): ParseResult {
  try {
    const o = obj(raw, 'données');
    if (o.version !== 1) fail('version', 'version 1');
    const exercises = arr(o.exercises, 'exercises', parseExercise);
    const templates = arr(o.templates, 'templates', parseTemplate);
    const sessions = arr(o.sessions, 'sessions', parseSession);
    assertUniqueIds(exercises, 'exercises');
    assertUniqueIds(templates, 'templates');
    assertUniqueIds(sessions, 'sessions');
    const state: AppState = { version: 1, exercises, templates, sessions };
    if (o.activeSession !== undefined && o.activeSession !== null) {
      state.activeSession = parseSession(o.activeSession, 'activeSession');
    }
    if (o.settings !== undefined && o.settings !== null) state.settings = parseSettings(o.settings, 'settings');
    return { ok: true, state };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Valide un texte JSON importé par l'utilisateur. */
export function validateImport(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Le contenu n’est pas un JSON valide.' };
  }
  const result = parseAppState(raw);
  return result.ok ? result : { ok: false, error: `Données invalides — ${result.error}` };
}

// ---------- Persistance ----------

function defaultStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** Charge l'état ; ne lève jamais d'exception. */
export function loadState(storage: StorageLike | undefined = defaultStorage()): LoadResult {
  if (!storage) return { state: createDefaultState() };
  let text: string | null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: createDefaultState(), error: 'Le stockage local est inaccessible.' };
  }
  if (text === null) return { state: createDefaultState() };
  const result = validateImport(text);
  if (result.ok) return { state: result.state };
  return {
    state: createDefaultState(),
    error: `Les données enregistrées sont illisibles et ont été ignorées. (${result.error})`,
  };
}

/** Sauvegarde l'état ; renvoie false en cas d'échec (quota, stockage indisponible…). */
export function saveState(
  state: AppState,
  storage: StorageLike | undefined = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Export JSON lisible de l'état. */
export function exportState(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

/** Nom du fichier d'export : « muscutrack-AAAA-MM-JJ.json » (date locale). */
export function exportFileName(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `muscutrack-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}
