import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEMPLATE_NAME,
  createTemplate,
  createTemplateExercise,
  deleteTemplate,
  duplicateTemplate,
  estimateTemplateMinutes,
  moveTemplateExercise,
  updateTemplate,
  upsertTemplate,
} from './templates';
import type { Template } from './types';

const T0 = new Date('2026-01-01T00:00:00.000Z');
const T1 = new Date('2026-01-02T00:00:00.000Z');

const sample = (): Template =>
  createTemplate(
    {
      name: 'Jambes',
      exercises: ['squat', 'leg-curl', 'mollets-debout'].map(createTemplateExercise),
    },
    T0,
    't1',
  );

describe('createTemplate', () => {
  it('crée une séance type avec dates et id', () => {
    expect(sample()).toMatchObject({
      id: 't1',
      name: 'Jambes',
      createdAt: T0.toISOString(),
      updatedAt: T0.toISOString(),
    });
    expect(sample().exercises[0]).toEqual({ exerciseId: 'squat', targetSets: 3, targetReps: 10, restSeconds: 90 });
  });

  it('nom vide → nom par défaut, nom rogné', () => {
    expect(createTemplate({ name: '   ' }, T0, 'x').name).toBe(DEFAULT_TEMPLATE_NAME);
    expect(createTemplate({ name: ' Push ' }, T0, 'x').name).toBe('Push');
  });

  it('normalise les objectifs invalides', () => {
    const t = createTemplate(
      {
        name: 'X',
        exercises: [
          { exerciseId: 'squat', targetSets: -2, targetReps: 7.6, targetWeight: -10, restSeconds: Number.NaN },
        ],
      },
      T0,
      'x',
    );
    expect(t.exercises[0]).toEqual({
      exerciseId: 'squat',
      targetSets: 0,
      targetReps: 7,
      targetWeight: 0,
      restSeconds: 90,
    });
  });
});

describe('updateTemplate', () => {
  it('modifie nom et exercices, met à jour updatedAt seulement', () => {
    const t = updateTemplate(sample(), { name: 'Jambes lourdes', exercises: [createTemplateExercise('squat')] }, T1);
    expect(t.name).toBe('Jambes lourdes');
    expect(t.exercises).toHaveLength(1);
    expect(t.createdAt).toBe(T0.toISOString());
    expect(t.updatedAt).toBe(T1.toISOString());
  });

  it('patch partiel conserve le reste', () => {
    const t = updateTemplate(sample(), { name: 'Autre' }, T1);
    expect(t.exercises).toEqual(sample().exercises);
  });
});

describe('duplicateTemplate', () => {
  it('copie avec nouvel id, suffixe « (copie) » et exercices indépendants', () => {
    const src = sample();
    const copy = duplicateTemplate(src, T1, 't2');
    expect(copy.id).toBe('t2');
    expect(copy.name).toBe('Jambes (copie)');
    expect(copy.exercises).toEqual(src.exercises);
    expect(copy.exercises[0]).not.toBe(src.exercises[0]);
    expect(copy.createdAt).toBe(T1.toISOString());
  });
});

describe('deleteTemplate / upsertTemplate', () => {
  it('supprime par id', () => {
    const a = sample();
    const b = duplicateTemplate(a, T1, 't2');
    expect(deleteTemplate([a, b], 't1')).toEqual([b]);
    expect(deleteTemplate([a, b], 'inconnu')).toEqual([a, b]);
  });

  it('upsert remplace ou ajoute', () => {
    const a = sample();
    const renamed = updateTemplate(a, { name: 'Z' }, T1);
    expect(upsertTemplate([a], renamed)).toEqual([renamed]);
    const b = duplicateTemplate(a, T1, 't2');
    expect(upsertTemplate([a], b)).toEqual([a, b]);
  });
});

describe('moveTemplateExercise', () => {
  const ids = (t: Template) => t.exercises.map((e) => e.exerciseId);

  it('monte et descend', () => {
    expect(ids(moveTemplateExercise(sample(), 1, 'up', T1))).toEqual(['leg-curl', 'squat', 'mollets-debout']);
    expect(ids(moveTemplateExercise(sample(), 1, 'down', T1))).toEqual(['squat', 'mollets-debout', 'leg-curl']);
    expect(moveTemplateExercise(sample(), 1, 'down', T1).updatedAt).toBe(T1.toISOString());
  });

  it('sans effet aux extrémités ou hors limites', () => {
    const t = sample();
    expect(moveTemplateExercise(t, 0, 'up', T1)).toBe(t);
    expect(moveTemplateExercise(t, 2, 'down', T1)).toBe(t);
    expect(moveTemplateExercise(t, 7, 'up', T1)).toBe(t);
  });
});

describe('estimateTemplateMinutes', () => {
  const t = (exercises: { targetSets: number; restSeconds: number }[]) => ({
    exercises: exercises.map((e) => ({ ...createTemplateExercise('squat'), ...e })),
  });

  it('séries × (40 s d’effort + repos de l’exercice), arrondi aux 5 min', () => {
    // 3 × (40 + 90) = 390 s = 6,5 min → 5 ; + 4 × (40 + 120) = 640 s → 1 030 s = 17,2 min → 15
    expect(estimateTemplateMinutes(t([{ targetSets: 3, restSeconds: 90 }]))).toBe(5);
    expect(estimateTemplateMinutes(t([{ targetSets: 3, restSeconds: 90 }, { targetSets: 4, restSeconds: 120 }]))).toBe(15);
    // 5 exercices × 4 séries × (40 + 90) = 2 600 s = 43,3 min → 45
    expect(estimateTemplateMinutes(t(Array.from({ length: 5 }, () => ({ targetSets: 4, restSeconds: 90 }))))).toBe(45);
  });

  it('jamais 0 dès qu’il y a une série ; 0 sans exercice', () => {
    expect(estimateTemplateMinutes(t([{ targetSets: 1, restSeconds: 0 }]))).toBe(5);
    expect(estimateTemplateMinutes(t([]))).toBe(0);
    expect(estimateTemplateMinutes(t([{ targetSets: 0, restSeconds: 90 }]))).toBe(0);
  });
});
