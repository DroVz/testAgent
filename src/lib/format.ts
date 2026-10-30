import { isMilestone, type PeriodSummary } from './rhythm';
import type { RecordType } from './stats';
import { DEFAULT_REST_SECONDS, type Exercise, type SetEntry, type Template, type WorkoutSession } from './types';

export const DELETED_EXERCISE_NAME = 'Exercice supprimé';

/** Espace insécable entre un nombre et son unité (« 80 kg », « 90 s ») : jamais coupés en fin de ligne. */
export const NBSP = String.fromCharCode(0xa0);

/** Espace fine insécable (U+202F), avant « ! » : le point d'exclamation ne part jamais seul à la ligne. */
export const NNBSP = String.fromCharCode(0x202f);

/** Deux-points précédé d’une espace insécable (« Repos : 90 s ») : jamais de « : » seul en début de ligne. */
export const COLON = `${NBSP}:`;

/** Point d'exclamation précédé d'une espace fine insécable. */
export const BANG = `${NNBSP}!`;

const pad2 = (n: number) => String(n).padStart(2, '0');

function wholeSeconds(ms: number): number {
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
}

/** Durée lisible : « 42 min », « 1 h 05 », « < 1 min » pour moins d'une minute (jamais « 0 min »). */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(wholeSeconds(ms) / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}${NBSP}h${NBSP}${pad2(m)}`;
  return m === 0 ? `<${NBSP}1${NBSP}min` : `${m}${NBSP}min`;
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

/** Poids : « 62,5 kg » (espace insécable). */
export function formatWeight(kg: number): string {
  return `${formatNumber(kg)}${NBSP}kg`;
}

/** 1RM estimé arrondi à 0,5 kg (l'estimation n'a pas plus de précision que ça). */
export function roundOneRepMax(kg: number): number {
  return Number.isFinite(kg) ? Math.round(kg * 2) / 2 : 0;
}

/** 1RM estimé affiché : « 128,5 kg ». Seule fonction de formatage du 1RM (récap, records, progrès). */
export function formatOneRepMax(kg: number): string {
  return formatWeight(roundOneRepMax(kg));
}

/** Une série en une ligne : « 72,5 kg × 8 », ou « 8 reps » au poids du corps. */
export function formatSetValues(weight: number, reps: number): string {
  return weight > 0 ? `${formatWeight(weight)} × ${formatNumber(reps)}` : formatCount(reps, 'rep');
}

/** Nombre + nom accordé : « 1 série », « 18 séries » (pluriel à partir de 2, règle française ; espace insécable). */
export function formatCount(n: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(n)}${NBSP}${Math.abs(n) >= 2 ? plural : singular}`;
}

/** Secondes : « 90 s » (espace insécable). */
export function formatSeconds(seconds: number): string {
  return `${formatNumber(seconds)}${NBSP}s`;
}

/** Phrase de fin : « Séance terminée : 5 exercices, 18 séries, 6 240 kg soulevés. » */
export function formatSessionSummary(exercises: number, sets: number, volumeKg: number): string {
  return (
    `Séance terminée${COLON} ${formatCount(exercises, 'exercice')}, ${formatCount(sets, 'série')}, ` +
    `${formatWeight(volumeKg)} ${Math.abs(volumeKg) >= 2 ? 'soulevés' : 'soulevé'}.`
  );
}

/**
 * Nom d'exercice dans une phrase : première lettre en minuscule (« Développé couché » → « développé couché »).
 * Un sigle en tête (au moins deux lettres, toutes en capitales : « RDL », « EZ ») est laissé tel quel.
 */
export function inSentence(name: string): string {
  const firstWord = name.split(/[\s\-'’]/)[0];
  const letters = firstWord.replace(/[^\p{L}]/gu, '');
  if (letters.length >= 2 && letters === letters.toLocaleUpperCase('fr-FR')) return name;
  return name.charAt(0).toLocaleLowerCase('fr-FR') + name.slice(1);
}

/**
 * Confirmation de fin avec des séries en attente (lot 6, §2.4) : « Il reste 3 séries non validées,
 * en développé incliné. Terminer quand même ? » ; deux exercices : « … en développé incliné et curl
 * haltères. … » ; trois ou plus : « … sur 3 exercices. … ». `names` : noms des exercices en attente,
 * un par exercice (doublons déjà retirés par l'appelant, par identifiant), dans l'ordre de la séance
 * (mis en minuscule par `inSentence`).
 */
export function formatRemainingSets(count: number, names: string[]): string {
  const unique = names.map(inSentence);
  const where =
    unique.length === 0
      ? ''
      : unique.length === 1
        ? `, en ${unique[0]}`
        : unique.length === 2
          ? `, en ${unique[0]} et ${unique[1]}`
          : `, sur ${formatCount(unique.length, 'exercice')}`;
  return `Il reste ${formatCount(count, 'série non validée', 'séries non validées')}${where}. Terminer quand même ?`;
}

/**
 * Phrase de record (seul endroit où le point d'exclamation est permis) :
 * « Nouveau record en développé couché : 82,5 kg ! ». `kind` précise le record s'il ne s'agit pas
 * du poids max (« Nouveau record de volume en squat : 1 650 kg ! »). La valeur peut être déjà
 * formatée (ex. `formatOneRepMax`), sinon elle passe par `formatWeight`.
 */
export function formatRecordSentence(exercise: string, value: number | string, kind?: string): string {
  const text = typeof value === 'string' ? value : formatWeight(value);
  return `Nouveau record${kind ? ` de ${kind}` : ''} en ${inSentence(exercise)}${COLON} ${text}${BANG}`;
}

/** Précision du record dans la phrase (le poids max est le record « par défaut ») : récap et séance. */
export const RECORD_KINDS: Record<RecordType, string | undefined> = {
  maxWeight: undefined,
  bestOneRepMax: '1RM estimé',
  bestVolume: 'volume',
};

/**
 * Phrase d'un nouveau record, identique au récap et en séance : « Nouveau record de 1RM estimé en
 * développé couché : 92,5 kg ! » (1RM arrondi comme `formatOneRepMax`).
 */
export function formatNewRecord(exercise: string, record: { type: RecordType; value: number }): string {
  const format = record.type === 'bestOneRepMax' ? formatOneRepMax : formatWeight;
  return formatRecordSentence(exercise, format(record.value), RECORD_KINDS[record.type]);
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

const DAY_MS = 24 * 60 * 60 * 1000;

/** Nombre de jours calendaires (heure locale) entre deux dates ; jamais négatif. */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / DAY_MS));
}

/**
 * Dernier passage d'une séance type : « Jamais faite », « Faite aujourd’hui », « Faite hier »,
 * « Faite il y a 3 jours », « Faite il y a 2 semaines », « Faite il y a 3 mois ».
 */
export function formatLastDone(lastDone: string | Date | undefined, now: Date = new Date()): string {
  if (lastDone === undefined) return 'Jamais faite';
  const d = typeof lastDone === 'string' ? new Date(lastDone) : lastDone;
  if (Number.isNaN(d.getTime())) return 'Jamais faite';
  const days = calendarDaysBetween(d, now);
  if (days === 0) return 'Faite aujourd’hui';
  if (days === 1) return 'Faite hier';
  if (days < 14) return `Faite il y a ${formatCount(days, 'jour')}`;
  if (days < 60) return `Faite il y a ${formatCount(Math.floor(days / 7), 'semaine')}`;
  return `Faite il y a ${formatNumber(Math.floor(days / 30))}${NBSP}mois`;
}

/** Durée estimée d'une séance type : « ≈ 45 min », « ≈ 1 h 15 ». */
export function formatEstimatedDuration(minutes: number): string {
  return `≈${NBSP}${formatDuration(minutes * 60_000)}`;
}

/**
 * Période entre deux dates pour une phrase, avec sa préposition : « en 5 jours », « en 8 semaines »
 * (« depuis » pour une stagnation). Deux dates le même jour : « aujourd’hui » si c'est aujourd'hui,
 * sinon « le même jour ».
 */
function formatSpan(from: Date, to: Date, now: Date, preposition: 'en' | 'depuis'): string {
  const days = calendarDaysBetween(from, to);
  if (days === 0) return calendarDaysBetween(to, now) === 0 && to <= now ? 'aujourd’hui' : 'le même jour';
  if (days < 7) return `${preposition} ${formatCount(days, 'jour')}`;
  return `${preposition} ${formatCount(Math.round(days / 7), 'semaine')}`;
}

export interface ProgressPoint {
  /** Date ISO. */
  date: string;
  value: number;
}

export interface ProgressSummary {
  /** Le chiffre, affiché en grand : « +7,5 kg en 8 semaines ». */
  headline: string;
  /** Relativisation éventuelle, affichée dessous en texte secondaire (baisse). */
  note?: string;
}

/** Relativisation d'une baisse : elle constate puis rassure, sans reproche. */
export const DECLINE_NOTE = 'Ça arrive, la prochaine séance compte.';

/**
 * Résumé de la progression d'une métrique : compare la première et la dernière valeur de la
 * période (valeurs arrondies comme à l'affichage via `round`).
 * - hausse : « +7,5 kg en 8 semaines » ;
 * - égalité : « Stable depuis 4 semaines » ;
 * - baisse, sans culpabiliser : « −5 kg en 3 semaines » + note « Ça arrive, la prochaine séance compte. » ;
 * - deux points le même jour : « +5 kg aujourd’hui » / « +5 kg le même jour » ;
 * - un seul point : « Première séance sur cet exercice » (le jalon du récap garde « Première séance
 *   enregistrée. ») ; aucun point : null.
 */
export function formatProgressSentence(
  points: ProgressPoint[],
  format: (value: number) => string = formatWeight,
  round: (value: number) => number = (v) => v,
  now: Date = new Date(),
): ProgressSummary | null {
  if (points.length === 0) return null;
  if (points.length === 1) return { headline: 'Première séance sur cet exercice' };
  const first = points[0];
  const last = points[points.length - 1];
  const delta = round(last.value) - round(first.value);
  const from = new Date(first.date);
  const to = new Date(last.date);
  // Écart arrondi pour éviter « 0,30000000000000004 ».
  const amount = Math.round(Math.abs(delta) * 100) / 100;
  if (amount === 0) return { headline: `Stable ${formatSpan(from, to, now, 'depuis')}` };
  const span = formatSpan(from, to, now, 'en');
  if (delta > 0) return { headline: `+${format(amount)} ${span}` };
  return { headline: `−${format(amount)} ${span}`, note: DECLINE_NOTE };
}

// ---------- Rythme (lot 3) : on montre ce qui est fait, jamais ce qui manque ----------

/** « Objectif atteint », insécable (ligne de semaine et légende de tuile). */
const GOAL_REACHED = `Objectif${NBSP}atteint`;

/**
 * Ligne de semaine (Séances, récap) ; `goal` undefined = « Aucun ».
 * « Cette semaine : 2 séances sur 3. », « … 3 séances sur 3. Objectif atteint. »,
 * « Cette semaine : 4 séances. Objectif de 3 atteint. ». À 0 séance : le repère
 * (« Objectif de la semaine : 3 séances. »), ou rien (undefined) sans objectif.
 * La phrase finale ne se coupe jamais : insécables entre tous ses mots.
 */
export function formatWeekLine(count: number, goal?: number): string | undefined {
  const done = formatCount(count, 'séance');
  if (goal === undefined) return count > 0 ? `Cette semaine${COLON} ${done}.` : undefined;
  if (count === 0) return `Objectif de la semaine${COLON} ${formatCount(goal, 'séance')}.`;
  if (count < goal) return `Cette semaine${COLON} ${done} sur ${formatNumber(goal)}.`;
  if (count === goal) return `Cette semaine${COLON} ${done} sur ${formatNumber(goal)}. ${GOAL_REACHED}.`;
  return `Cette semaine${COLON} ${done}. Objectif${NBSP}de${NBSP}${formatNumber(goal)}${NBSP}atteint.`;
}

/**
 * Valeur de la tuile « Cette semaine » : « 2 sur 3 », ou le nombre seul (sans objectif, au-delà,
 * ou à 0 : on annonce le repère dans la légende, pas « 0 sur 3 »).
 */
export function formatWeekTile(count: number, goal?: number): string {
  return goal !== undefined && count > 0 && count <= goal
    ? `${formatNumber(count)} sur ${formatNumber(goal)}`
    : formatNumber(count);
}

/** Nom accessible de la tuile : « 2 séances sur 3 », « 4 séances », « 0 séance, objectif 3 séances ». */
export function formatWeekTileLabel(count: number, goal?: number): string {
  const done = formatCount(count, 'séance');
  if (goal === undefined) return done;
  if (count === 0) return `${done}, objectif ${formatCount(goal, 'séance')}`;
  return count <= goal ? `${done} sur ${formatNumber(goal)}` : done;
}

/**
 * Légende sous la tuile « Cette semaine » : « Objectif : 3 » à 0 séance, « Objectif atteint »
 * dès que compte ≥ objectif ; undefined sans objectif ou entre les deux.
 */
export function formatWeekTileCaption(count: number, goal?: number): string | undefined {
  if (goal === undefined) return undefined;
  if (count === 0) return `Objectif${COLON}${NBSP}${formatNumber(goal)}`;
  return count >= goal ? GOAL_REACHED : undefined;
}

const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'long' });

/** Nom du mois, majuscule initiale, sans année : « Octobre ». */
export function formatMonthName(date: Date): string {
  const name = monthFormatter.format(date);
  return name.charAt(0).toLocaleUpperCase('fr-FR') + name.slice(1);
}

/**
 * Bilan : « Semaine dernière : 3 séances, 14 520 kg, 1 record. » Volume et records à 0 omis ;
 * jamais de mention de l'objectif. `count: false` (mois en cours, dont la tuile « Ce mois » donne
 * déjà le compte) : « Octobre : 49 755 kg, 10 records. », undefined si volume et records valent 0.
 */
export function formatPeriodSummary(
  label: string,
  summary: PeriodSummary,
  { count = true }: { count?: boolean } = {},
): string | undefined {
  const parts = count ? [formatCount(summary.count, 'séance')] : [];
  if (summary.volume > 0) parts.push(formatWeight(summary.volume));
  if (summary.records > 0) parts.push(formatCount(summary.records, 'record'));
  if (parts.length === 0) return undefined;
  // Le dernier segment ne part jamais seul à la ligne (« 3 records. ») : insécable après la dernière virgule.
  const last = parts.pop()!;
  const head = parts.join(', ');
  return `${label}${COLON} ${head ? `${head},${NBSP}` : ''}${last}.`;
}

/** Jalon du récap : « Première séance enregistrée. Bienvenue. », « 10ᵉ séance enregistrée. » ; undefined hors seuil. */
export function formatMilestone(rank: number): string | undefined {
  if (!isMilestone(rank)) return undefined;
  if (rank === 1) return 'Première séance enregistrée. Bienvenue.';
  return `${formatNumber(rank)}ᵉ séance enregistrée.`;
}

/** Nom accessible d'un choix d'objectif : « Aucun objectif », « 1 séance par semaine ». */
export function formatGoalOption(goal: number | undefined): string {
  return goal === undefined ? 'Aucun objectif' : `${formatCount(goal, 'séance')} par semaine`;
}

/** Toast après un choix dans la carte de proposition : « Objectif enregistré : 3 séances par semaine. » */
export function formatGoalSaved(goal: number): string {
  return `Objectif enregistré${COLON} ${formatGoalOption(goal)}.`;
}

// ---------- Sauvegarde (lot 5) : un fait, jamais de durée dans le rappel ----------

/**
 * Ligne d'état de Réglages : « Aucun export pour l’instant. », « Dernier export : aujourd’hui. »,
 * « … hier. », « … il y a 5 jours. », « … il y a 3 semaines. », « … il y a 4 mois. »
 * (mêmes paliers que `formatLastDone`).
 */
export function formatLastExport(lastExportAt: string | Date | undefined, now: Date = new Date()): string {
  const d = lastExportAt === undefined ? undefined : typeof lastExportAt === 'string' ? new Date(lastExportAt) : lastExportAt;
  if (d === undefined || Number.isNaN(d.getTime())) return 'Aucun export pour l’instant.';
  const days = calendarDaysBetween(d, now);
  const prefix = `Dernier export${COLON}`;
  if (days === 0) return `${prefix} aujourd’hui.`;
  if (days === 1) return `${prefix} hier.`;
  if (days < 14) return `${prefix} il y a ${formatCount(days, 'jour')}.`;
  if (days < 60) return `${prefix} il y a ${formatCount(Math.floor(days / 7), 'semaine')}.`;
  return `${prefix} il y a ${formatNumber(Math.floor(days / 30))}${NBSP}mois.`;
}

/** « 1 séance enregistrée depuis. », « 4 séances enregistrées depuis. » ; undefined à 0. */
export function formatSinceExport(count: number): string | undefined {
  if (count <= 0) return undefined;
  return `${formatCount(count, 'séance')} ${count >= 2 ? 'enregistrées' : 'enregistrée'} depuis.`;
}

/**
 * Carte de rappel du récap, ligne 1 : « Tes 8 séances n’existent que sur ce téléphone. » sans date
 * de référence, « Tes 6 dernières séances n’existent que sur ce téléphone. » sinon.
 */
export function formatBackupReminder(unsavedCount: number, hasReference: boolean): string {
  const sessions = hasReference
    ? `${formatNumber(unsavedCount)}${NBSP}dernières séances`
    : formatCount(unsavedCount, 'séance');
  return `Tes ${sessions} n’existent que sur ce téléphone.`;
}

/** Carte de rappel du récap, ligne 2. */
export const BACKUP_REMINDER_DETAIL = 'Exporte une copie pour les garder en cas de perte ou de changement de téléphone.';
