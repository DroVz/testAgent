import { describe, expect, it } from 'vitest';
import { DEFAULT_EXERCISES } from './defaultExercises';
import { formatEstimatedDuration } from './format';
import {
  BARBELL_EXERCISE_IDS,
  STARTER_PROGRAMS,
  buildProgramTemplates,
  firstTimeText,
  isProgramAlreadyAdded,
  uniqueTemplateName,
} from './programs';
import { estimateTemplateMinutes } from './templates';

const T0 = new Date('2026-10-29T10:00:00.000Z');

/** Tableaux du §3 de docs/product/lot2-programmes.md : [exerciseId, séries, reps, charge, repos]. */
type Row = [string, number, number, number, number];
const EXPECTED: { id: string; name: string; audience: string; templates: { name: string; rows: Row[]; minutes: number }[] }[] = [
  {
    id: 'full-body',
    name: 'Full body',
    audience: '2 à 3 séances par semaine, en alternant A et B. Idéal pour commencer.',
    templates: [
      {
        name: 'Full body A',
        minutes: 30,
        rows: [
          ['squat', 3, 8, 20, 120],
          ['developpe-couche', 3, 8, 20, 120],
          ['rowing-barre', 3, 10, 20, 90],
          ['crunch', 3, 15, 0, 90],
        ],
      },
      {
        name: 'Full body B',
        minutes: 30,
        rows: [
          ['souleve-de-terre-roumain', 3, 10, 20, 120],
          ['developpe-militaire', 3, 8, 20, 90],
          ['tractions', 3, 5, 0, 90],
          ['fentes', 3, 10, 0, 90],
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
        minutes: 40,
        rows: [
          ['developpe-couche', 4, 8, 20, 120],
          ['rowing-barre', 4, 8, 20, 90],
          ['developpe-militaire', 3, 10, 20, 90],
          ['tractions', 3, 5, 0, 90],
          ['dips', 3, 8, 0, 90],
        ],
      },
      {
        name: 'Bas du corps',
        minutes: 40,
        rows: [
          ['squat', 4, 8, 20, 120],
          ['souleve-de-terre-roumain', 3, 10, 20, 120],
          ['hip-thrust', 3, 10, 20, 90],
          ['fentes', 3, 10, 0, 90],
          ['mollets-debout', 3, 15, 0, 90],
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
        minutes: 35,
        rows: [
          ['pompes', 3, 10, 0, 90],
          ['fentes', 3, 10, 0, 90],
          ['dips', 3, 8, 0, 90],
          ['tractions', 3, 5, 0, 90],
          ['releve-de-jambes', 3, 10, 0, 90],
        ],
      },
    ],
  },
];

const fullBody = STARTER_PROGRAMS[0];
const bodyweight = STARTER_PROGRAMS[2];

describe('programmes de départ — données', () => {
  it('3 programmes, 5 séances types, contenu exact du §3 (objets comparés à l’identique)', () => {
    expect(STARTER_PROGRAMS).toEqual(
      EXPECTED.map((p) => ({
        id: p.id,
        name: p.name,
        audience: p.audience,
        templates: p.templates.map((t) => ({
          name: t.name,
          exercises: t.rows.map(([exerciseId, targetSets, targetReps, targetWeight, restSeconds]) => ({
            exerciseId,
            targetSets,
            targetReps,
            targetWeight,
            restSeconds,
          })),
        })),
      })),
    );
    expect(STARTER_PROGRAMS.flatMap((p) => p.templates)).toHaveLength(5);
  });

  it('durées estimées par la formule actuelle (≈ 30 / 30 / 40 / 40 / 35 min)', () => {
    const minutes = STARTER_PROGRAMS.flatMap((p) => p.templates.map(estimateTemplateMinutes));
    expect(minutes).toEqual(EXPECTED.flatMap((p) => p.templates.map((t) => t.minutes)));
    expect(formatEstimatedDuration(minutes[0])).toBe('≈ 30 min');
  });

  it('tous les exercices existent dans la bibliothèque', () => {
    const ids = new Set(DEFAULT_EXERCISES.map((e) => e.id));
    for (const p of STARTER_PROGRAMS) {
      for (const t of p.templates) for (const e of t.exercises) expect(ids.has(e.exerciseId), e.exerciseId).toBe(true);
    }
  });

  it('charges de départ : 20 kg (barre seule) ou 0 (poids du corps), toujours écrites', () => {
    for (const p of STARTER_PROGRAMS) {
      for (const t of p.templates) {
        for (const e of t.exercises) {
          expect(e).toHaveProperty('targetWeight');
          expect([0, 20], `${t.name} / ${e.exerciseId}`).toContain(e.targetWeight);
        }
      }
    }
  });

  it('exercices écartés exprès : ni gainage ni soulevé de terre classique', () => {
    const used = STARTER_PROGRAMS.flatMap((p) => p.templates.flatMap((t) => t.exercises.map((e) => e.exerciseId)));
    expect(used).not.toContain('gainage');
    expect(used).not.toContain('souleve-de-terre');
  });
});

describe('buildProgramTemplates', () => {
  it('crée des séances types ordinaires : ids neufs, dates = now, exercices copiés', () => {
    let n = 0;
    const templates = buildProgramTemplates(fullBody, [], T0, () => `id-${++n}`);
    expect(templates.map((t) => [t.id, t.name])).toEqual([
      ['id-1', 'Full body A'],
      ['id-2', 'Full body B'],
    ]);
    for (const t of templates) {
      expect(t.createdAt).toBe(T0.toISOString());
      expect(t.updatedAt).toBe(T0.toISOString());
    }
    expect(templates[0].exercises).toEqual(fullBody.templates[0].exercises);
    // Copie : modifier la séance type créée ne touche pas aux données du programme.
    expect(templates[0].exercises[0]).not.toBe(fullBody.templates[0].exercises[0]);
    // 0 kg conservé (pas retiré par la normalisation).
    expect(templates[1].exercises[2]).toEqual({ exerciseId: 'tractions', targetSets: 3, targetReps: 5, targetWeight: 0, restSeconds: 90 });
  });

  it('ids distincts par défaut', () => {
    const [a, b] = buildProgramTemplates(fullBody, [], T0);
    expect(a.id).not.toBe(b.id);
  });

  it('doublons : « (2) », puis « (3) »', () => {
    const first = buildProgramTemplates(fullBody, [], T0).map((t) => t.name);
    const second = buildProgramTemplates(fullBody, first, T0).map((t) => t.name);
    expect(second).toEqual(['Full body A (2)', 'Full body B (2)']);
    const third = buildProgramTemplates(fullBody, [...first, ...second], T0).map((t) => t.name);
    expect(third).toEqual(['Full body A (3)', 'Full body B (3)']);
  });

  it('seul le nom compte : une séance renommée libère le nom ; règle appliquée séance par séance', () => {
    expect(buildProgramTemplates(fullBody, ['Lundi', 'Full body B'], T0).map((t) => t.name)).toEqual([
      'Full body A',
      'Full body B (2)',
    ]);
    expect(buildProgramTemplates(fullBody, ['Full body A'], T0).map((t) => t.name)).toEqual([
      'Full body A (2)',
      'Full body B',
    ]);
  });

  it('comparaison exacte après trim ; les noms créés dans le même ajout comptent', () => {
    expect(buildProgramTemplates(bodyweight, ['  Poids du corps  '], T0)[0].name).toBe('Poids du corps (2)');
    expect(buildProgramTemplates(bodyweight, ['poids du corps'], T0)[0].name).toBe('Poids du corps');
    expect(uniqueTemplateName('A', new Set(['A', 'A (2)']))).toBe('A (3)');
  });
});

describe('isProgramAlreadyAdded', () => {
  it('vrai seulement si tous les noms existent sous leur forme exacte', () => {
    expect(isProgramAlreadyAdded(fullBody, [])).toBe(false);
    expect(isProgramAlreadyAdded(fullBody, ['Full body A'])).toBe(false);
    expect(isProgramAlreadyAdded(fullBody, ['Full body A', 'Full body B'])).toBe(true);
    expect(isProgramAlreadyAdded(fullBody, ['Full body A (2)', 'Full body B (2)'])).toBe(false);
    expect(isProgramAlreadyAdded(fullBody, [' Full body A ', 'Full body B'])).toBe(true);
  });
});

describe('firstTimeText (§7 révisé le 29/10)', () => {
  const NBSP = ' ';
  it('à la barre seule : « la barre seule (20 kg) × 8 »', () => {
    expect(firstTimeText('squat', 20, 8)).toBe(`Première fois${NBSP}: la barre seule (20${NBSP}kg) × 8. Ajuste si besoin.`);
  });
  it('au poids du corps : « 8 reps »', () => {
    expect(firstTimeText('pompes', 0, 8)).toBe(`Première fois${NBSP}: 8${NBSP}reps. Ajuste si besoin.`);
  });
  it('autre charge, ou 20 kg sur un exercice qui ne se fait pas à la barre : « vise X kg × N »', () => {
    expect(firstTimeText('squat', 60, 8)).toBe(`Première fois${NBSP}: vise 60${NBSP}kg × 8. Ajuste si besoin.`);
    expect(firstTimeText('curl-halteres', 20, 10)).toBe(`Première fois${NBSP}: vise 20${NBSP}kg × 10. Ajuste si besoin.`);
  });
  it('tous les exercices à 20 kg des programmes sont reconnus comme exercices à la barre', () => {
    const ids = DEFAULT_EXERCISES.map((e) => e.id);
    for (const id of BARBELL_EXERCISE_IDS) expect(ids).toContain(id);
    for (const p of STARTER_PROGRAMS)
      for (const t of p.templates)
        for (const e of t.exercises) if (e.targetWeight === 20) expect(BARBELL_EXERCISE_IDS.has(e.exerciseId)).toBe(true);
  });
});
