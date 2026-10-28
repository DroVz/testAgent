import { DEFAULT_REST_SECONDS, type Exercise, type SetEntry, type Template, type WorkoutSession } from './types';

export const DELETED_EXERCISE_NAME = 'Exercice supprimé';

const pad2 = (n: number) => String(n).padStart(2, '0');

function wholeSeconds(ms: number): number {
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
}

/** Durée lisible : « 42 min », « 1 h 05 », « 0 min » pour moins d'une minute. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(wholeSeconds(ms) / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h} h ${pad2(m)}` : `${m} min`;
}

/** Chrono : « 12:34 », ou « 1:02:03 » au-delà d'une heure. */
export function formatClock(ms: number): string {
  const total = wholeSeconds(ms);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Date courte en français, ex. « mar. 27 oct. 2026 ». Accepte une date ISO ou un objet Date. */
export function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? '' : dateFormatter.format(d);
}

const shortDateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

/** Date abrégée pour un axe de graphique, ex. « 27 oct. ». */
export function formatShortDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? '' : shortDateFormatter.format(d);
}

const numberFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/** Nombre à la française (virgule décimale, 2 décimales max). */
export function formatNumber(n: number): string {
  return numberFormatter.format(Number.isFinite(n) ? n : 0);
}

/** Poids : « 62,5 kg ». */
export function formatWeight(kg: number): string {
  return `${formatNumber(kg)} kg`;
}

/** Une série en une ligne : « 72,5 kg × 8 », ou « 8 reps » au poids du corps. */
export function formatSetValues(weight: number, reps: number): string {
  return weight > 0 ? `${formatWeight(weight)} × ${formatNumber(reps)}` : formatCount(reps, 'rep');
}

/** Nombre + nom accordé : « 1 série », « 18 séries » (pluriel à partir de 2, règle française). */
export function formatCount(n: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(n)} ${Math.abs(n) >= 2 ? plural : singular}`;
}

/** Phrase de fin : « Séance terminée : 5 exercices, 18 séries, 6 240 kg soulevés. » */
export function formatSessionSummary(exercises: number, sets: number, volumeKg: number): string {
  return (
    `Séance terminée : ${formatCount(exercises, 'exercice')}, ${formatCount(sets, 'série')}, ` +
    `${formatWeight(volumeKg)} ${Math.abs(volumeKg) >= 2 ? 'soulevés' : 'soulevé'}.`
  );
}

/** Nom d'exercice dans une phrase : première lettre en minuscule (« Développé couché » → « développé couché »). */
export function inSentence(name: string): string {
  return name.charAt(0).toLocaleLowerCase('fr-FR') + name.slice(1);
}

/**
 * Phrase de record (seul endroit où le point d'exclamation est permis) :
 * « Nouveau record en développé couché : 82,5 kg ! ». `kind` précise le record s'il ne s'agit pas
 * du poids max (« Nouveau record de volume en squat : 1 650 kg ! »).
 */
export function formatRecordSentence(exercise: string, valueKg: number, kind?: string): string {
  return `Nouveau record${kind ? ` de ${kind}` : ''} en ${inSentence(exercise)} : ${formatWeight(valueKg)} !`;
}

/**
 * Résumé de séries. Séries identiques : « 3×10 @ 60 kg » (« 3×10 » au poids du corps).
 * Séries différentes : groupes consécutifs séparés par « · », ex. « 2×10 @ 60 kg · 1×8 @ 65 kg ».
 */
export function formatSetsSummary(sets: SetEntry[]): string {
  const groups: { count: number; weight: number; reps: number }[] = [];
  for (const s of sets) {
    const last = groups[groups.length - 1];
    if (last && last.weight === s.weight && last.reps === s.reps) last.count++;
    else groups.push({ count: 1, weight: s.weight, reps: s.reps });
  }
  return groups
    .map((g) => `${g.count}×${g.reps}${g.weight > 0 ? ` @ ${formatWeight(g.weight)}` : ''}`)
    .join(' · ');
}

/** Nom d'un exercice, ou « Exercice supprimé » s'il n'existe plus. */
export function exerciseName(exercises: Exercise[], id: string): string {
  return exercises.find((e) => e.id === id)?.name ?? DELETED_EXERCISE_NAME;
}

/** Temps de repos d'un exercice : celui de la séance type d'origine, sinon la valeur par défaut. */
export function restSecondsFor(session: WorkoutSession, templates: Template[], exerciseId: string): number {
  const template = session.templateId ? templates.find((t) => t.id === session.templateId) : undefined;
  return template?.exercises.find((e) => e.exerciseId === exerciseId)?.restSeconds ?? DEFAULT_REST_SECONDS;
}

/** Lit un nombre décimal saisi (virgule ou point). Renvoie null si vide ou invalide. */
export function parseDecimalInput(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d*\.?\d*$/.test(t) || t === '' || t === '.') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Lit un entier ≥ 0 saisi. Renvoie null si vide ou invalide. */
export function parseIntInput(text: string): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

/** Texte d'un nombre pour un champ de saisie (virgule décimale, sans séparateur de milliers). */
export function toInputText(n: number): string {
  return Number.isFinite(n) ? String(n).replace('.', ',') : '';
}

/** Normalise un texte pour la recherche : minuscules, sans accents ni espaces superflus. */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
