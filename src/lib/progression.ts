import { formatCount, formatSetValues, formatWeight } from './format';
import { MAX_REPS, MAX_WEIGHT } from './session';
import type { AppState, LoadSuggestion, SetEntry, TemplateExercise } from './types';

/** Pas de progression en charge (le même que les boutons −/+ de la série en cours). */
export const LOAD_STEP_KG = 2.5;

export interface SuggestionInput {
  /** Objectif de la séance type ; absent = séance libre ou exercice ajouté à la volée. */
  target?: Pick<TemplateExercise, 'targetSets' | 'targetReps'>;
  /** Séries validées de la dernière fois (`lastPerformance(...).sets`) ; absent = jamais fait. */
  last?: SetEntry[];
  /** Réglage « Suggérer la charge suivante » (activé par défaut). */
  enabled?: boolean;
}

/** Réglage « Suggérer la charge suivante » : absent = activé. */
export function isSuggestLoadEnabled(state: Pick<AppState, 'settings'>): boolean {
  return state.settings?.suggestLoad !== false;
}

/**
 * Double progression simple (docs/product/vision-et-roadmap.md, lot 1) : si toutes les séries de la
 * dernière fois (au moins `targetSets`) ont atteint `targetReps` à la même charge W, on propose
 * W + 2,5 kg × `targetReps` ; au poids du corps (W = 0), 1 rep de plus que le minimum de la dernière fois.
 * Sinon, pas de suggestion.
 */
export function suggestLoad({ target, last, enabled = true }: SuggestionInput): LoadSuggestion | undefined {
  if (!enabled || !target || !last || last.length === 0) return undefined;
  const { targetSets, targetReps } = target;
  if (targetReps < 1 || targetSets < 1 || last.length < targetSets) return undefined;
  const weight = last[0].weight;
  if (last.some((s) => s.weight !== weight || s.reps < targetReps)) return undefined;
  const minReps = Math.min(...last.map((s) => s.reps));
  const sameReps = last.every((s) => s.reps === minReps);
  const from = { fromWeight: weight, fromReps: minReps, sameReps };
  if (weight > 0) {
    const toWeight = Math.round((weight + LOAD_STEP_KG) * 100) / 100;
    return toWeight > MAX_WEIGHT ? undefined : { ...from, toWeight, toReps: targetReps };
  }
  const toReps = minReps + 1;
  return toReps > MAX_REPS ? undefined : { ...from, toWeight: 0, toReps };
}

const isBodyweight = (s: LoadSuggestion) => s.fromWeight === 0;

/** Ligne 1 de la note : « Charge proposée : 82,5 kg » ou « Reps proposées : 11 reps ». */
export function suggestionTitle(s: LoadSuggestion): string {
  return isBodyweight(s)
    ? `Reps proposées : ${formatCount(s.toReps, 'rep')}`
    : `Charge proposée : ${formatWeight(s.toWeight)}`;
}

/** Ligne 2 : ce qui a été fait la dernière fois, sur toutes les séries. */
export function suggestionDetail(s: LoadSuggestion): string {
  if (s.sameReps) return `La dernière fois : ${formatSetValues(s.fromWeight, s.fromReps)} sur toutes les séries.`;
  const reps = `${formatCount(s.fromReps, 'rep')} ou plus`;
  return isBodyweight(s)
    ? `La dernière fois : ${reps} sur toutes les séries.`
    : `La dernière fois : ${formatWeight(s.fromWeight)}, ${reps} sur toutes les séries.`;
}

/** Valeur de la dernière fois : « 80 kg » ou « 10 reps ». */
function previousValue(s: LoadSuggestion): string {
  return isBodyweight(s) ? formatCount(s.fromReps, 'rep') : formatWeight(s.fromWeight);
}

/** Bouton secondaire : « Rester à 80 kg » / « Rester à 10 reps ». */
export function keepLabel(s: LoadSuggestion): string {
  return `Rester à ${previousValue(s)}`;
}

/** Toast après « Rester à … » : « Charge remise à 80 kg. » / « Reps remises à 10 reps. ». */
export function keepToast(s: LoadSuggestion): string {
  return isBodyweight(s) ? `Reps remises à ${previousValue(s)}.` : `Charge remise à ${previousValue(s)}.`;
}
