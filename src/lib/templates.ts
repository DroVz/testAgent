import { createId } from './id';
import { sanitizeReps, sanitizeWeight } from './session';
import { DEFAULT_REST_SECONDS, type Template, type TemplateExercise } from './types';

export const DEFAULT_TEMPLATE_NAME = 'Nouvelle séance';

export interface TemplateInput {
  name: string;
  exercises?: TemplateExercise[];
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  return trimmed === '' ? DEFAULT_TEMPLATE_NAME : trimmed;
}

/** Normalise les objectifs (entiers ≥ 0, poids ≥ 0, repos par défaut 90 s). */
export function normalizeTemplateExercise(te: TemplateExercise): TemplateExercise {
  const out: TemplateExercise = {
    exerciseId: te.exerciseId,
    targetSets: sanitizeReps(te.targetSets),
    targetReps: sanitizeReps(te.targetReps),
    restSeconds: Number.isFinite(te.restSeconds) ? sanitizeReps(te.restSeconds) : DEFAULT_REST_SECONDS,
  };
  if (te.targetWeight !== undefined && Number.isFinite(te.targetWeight)) {
    out.targetWeight = sanitizeWeight(te.targetWeight);
  }
  return out;
}

/** Objectifs par défaut pour un exercice ajouté à une séance type. */
export function createTemplateExercise(exerciseId: string): TemplateExercise {
  return { exerciseId, targetSets: 3, targetReps: 10, restSeconds: DEFAULT_REST_SECONDS };
}

export function createTemplate(
  input: TemplateInput,
  now: Date = new Date(),
  id: string = createId(),
): Template {
  const iso = now.toISOString();
  return {
    id,
    name: normalizeName(input.name),
    exercises: (input.exercises ?? []).map(normalizeTemplateExercise),
    createdAt: iso,
    updatedAt: iso,
  };
}

export function updateTemplate(
  template: Template,
  patch: Partial<TemplateInput>,
  now: Date = new Date(),
): Template {
  return {
    ...template,
    ...(patch.name !== undefined && { name: normalizeName(patch.name) }),
    ...(patch.exercises !== undefined && { exercises: patch.exercises.map(normalizeTemplateExercise) }),
    updatedAt: now.toISOString(),
  };
}

export function duplicateTemplate(
  template: Template,
  now: Date = new Date(),
  id: string = createId(),
): Template {
  return createTemplate(
    { name: `${template.name} (copie)`, exercises: template.exercises.map((e) => ({ ...e })) },
    now,
    id,
  );
}

export function deleteTemplate(templates: Template[], id: string): Template[] {
  return templates.filter((t) => t.id !== id);
}

/** Remplace la séance type de même id, ou l'ajoute à la fin. */
export function upsertTemplate(templates: Template[], template: Template): Template[] {
  return templates.some((t) => t.id === template.id)
    ? templates.map((t) => (t.id === template.id ? template : t))
    : [...templates, template];
}

/** Déplace un exercice d'un cran vers le haut ou le bas (sans effet aux extrémités). */
export function moveTemplateExercise(
  template: Template,
  index: number,
  direction: 'up' | 'down',
  now: Date = new Date(),
): Template {
  const target = direction === 'up' ? index - 1 : index + 1;
  const list = template.exercises;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return template;
  const exercises = [...list];
  [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
  return { ...template, exercises, updatedAt: now.toISOString() };
}
