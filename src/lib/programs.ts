import { COLON, formatCount, formatNumber, formatSetValues, formatWeight } from './format';
import { createId } from './id';
import { createTemplate } from './templates';
import { DEFAULT_REST_SECONDS, type Template, type TemplateExercise } from './types';

/**
 * Programmes de départ (docs/product/lot2-programmes.md §3). Données pures, non stockées dans
 * `AppState` : un ajout crée des séances types ordinaires (modifiables, duplicables, supprimables).
 *
 * Charges de départ identiques dans toutes les salles (§2) : 20 kg à la barre (barre olympique à
 * vide), 0 au poids du corps (écrit explicitement). Aucune machine, poulie ni haltère.
 */

export interface StarterProgramTemplate {
  name: string;
  exercises: TemplateExercise[];
}

export interface StarterProgram {
  id: string;
  name: string;
  /** Texte « Pour qui ». */
  audience: string;
  templates: StarterProgramTemplate[];
}

/** Barre olympique à vide. */
export const BAR_WEIGHT = 20;

/**
 * Exercices de la bibliothèque qui se font à la barre olympique : à 20 kg, la charge est « la barre
 * seule ». Les ids viennent de `DEFAULT_EXERCISES` (stables).
 */
export const BARBELL_EXERCISE_IDS: ReadonlySet<string> = new Set([
  'developpe-couche',
  'developpe-incline',
  'developpe-militaire',
  'souleve-de-terre',
  'souleve-de-terre-roumain',
  'rowing-barre',
  'squat',
  'hip-thrust',
  'curl-barre',
  'barre-au-front',
]);

/**
 * Ligne « Première fois » de la série 1 d'un exercice jamais fait (spec §7, révisée le 29/10) :
 * - à la barre seule : « Première fois : la barre seule (20 kg) × 8. Ajuste si besoin. » ;
 * - au poids du corps : « Première fois : 8 reps. Ajuste si besoin. » ;
 * - sinon : « Première fois : vise 60 kg × 8. Ajuste si besoin. ».
 */
export function firstTimeText(exerciseId: string, weight: number, reps: number): string {
  let target: string;
  if (weight === BAR_WEIGHT && BARBELL_EXERCISE_IDS.has(exerciseId)) {
    target = `la barre seule (${formatWeight(weight)}) × ${formatNumber(reps)}`;
  } else if (weight <= 0) {
    target = formatCount(reps, 'rep');
  } else {
    target = `vise ${formatSetValues(weight, reps)}`;
  }
  return `Première fois${COLON} ${target}. Ajuste si besoin.`;
}
/** Repos des mouvements lourds (squat, développé couché, soulevé de terre roumain). */
const HEAVY_REST_SECONDS = 120;

const row = (exerciseId: string, targetSets: number, targetReps: number, targetWeight: number, restSeconds: number): TemplateExercise => ({
  exerciseId,
  targetSets,
  targetReps,
  targetWeight,
  restSeconds,
});

const R = DEFAULT_REST_SECONDS;
const H = HEAVY_REST_SECONDS;
const B = BAR_WEIGHT;

export const STARTER_PROGRAMS: readonly StarterProgram[] = [
  {
    id: 'full-body',
    name: 'Full body',
    audience: '2 à 3 séances par semaine, en alternant A et B. Idéal pour commencer.',
    templates: [
      {
        name: 'Full body A',
        exercises: [
          row('squat', 3, 8, B, H),
          row('developpe-couche', 3, 8, B, H),
          row('rowing-barre', 3, 10, B, R),
          row('crunch', 3, 15, 0, R),
        ],
      },
      {
        name: 'Full body B',
        exercises: [
          row('souleve-de-terre-roumain', 3, 10, B, H),
          row('developpe-militaire', 3, 8, B, R),
          row('tractions', 3, 5, 0, R),
          row('fentes', 3, 10, 0, R),
        ],
      },
    ],
  },
  {
    id: 'haut-bas',
    name: 'Haut / Bas',
    audience: '4 séances par semaine, en alternant les deux. Pour aller plus loin.',
    templates: [
      {
        name: 'Haut du corps',
        exercises: [
          row('developpe-couche', 4, 8, B, H),
          row('rowing-barre', 4, 8, B, R),
          row('developpe-militaire', 3, 10, B, R),
          row('tractions', 3, 5, 0, R),
          row('dips', 3, 8, 0, R),
        ],
      },
      {
        name: 'Bas du corps',
        exercises: [
          row('squat', 4, 8, B, H),
          row('souleve-de-terre-roumain', 3, 10, B, H),
          row('hip-thrust', 3, 10, B, R),
          row('fentes', 3, 10, 0, R),
          row('mollets-debout', 3, 15, 0, R),
        ],
      },
    ],
  },
  {
    id: 'poids-du-corps',
    name: 'Poids du corps',
    audience: 'Sans charge, à la maison ou au parc. Il te faut une barre de traction.',
    templates: [
      {
        name: 'Poids du corps',
        exercises: [
          row('pompes', 3, 10, 0, R),
          row('fentes', 3, 10, 0, R),
          row('dips', 3, 8, 0, R),
          row('tractions', 3, 5, 0, R),
          row('releve-de-jambes', 3, 10, 0, R),
        ],
      },
    ],
  },
];

/**
 * Premier nom libre (§6.1) : `name` s'il n'est pas pris, sinon « name (2) », « name (3) »…
 * Comparaison exacte après `trim`.
 */
export function uniqueTemplateName(name: string, taken: ReadonlySet<string>): string {
  const base = name.trim();
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Séances types à créer pour `program`, dans l'ordre du programme, avec des ids neufs et
 * `createdAt = updatedAt = now`. Les noms déjà pris (`existingNames`) et ceux créés dans le même
 * ajout reçoivent un suffixe « (2) », « (3) »…
 */
export function buildProgramTemplates(
  program: StarterProgram,
  existingNames: Iterable<string>,
  now: Date = new Date(),
  makeId: () => string = createId,
): Template[] {
  const taken = new Set([...existingNames].map((n) => n.trim()));
  return program.templates.map((t) => {
    const name = uniqueTemplateName(t.name, taken);
    taken.add(name);
    return createTemplate({ name, exercises: t.exercises.map((e) => ({ ...e })) }, now, makeId());
  });
}

/** Vrai si toutes les séances types du programme existent déjà sous leur nom exact (sans suffixe). */
export function isProgramAlreadyAdded(program: StarterProgram, existingNames: Iterable<string>): boolean {
  const names = new Set([...existingNames].map((n) => n.trim()));
  return program.templates.every((t) => names.has(t.name));
}
