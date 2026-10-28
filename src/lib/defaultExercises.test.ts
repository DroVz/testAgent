import { describe, expect, it } from 'vitest';
import { DEFAULT_EXERCISES } from './defaultExercises';
import { MUSCLE_GROUPS } from './types';

describe('DEFAULT_EXERCISES', () => {
  it('contient environ 30 exercices', () => {
    expect(DEFAULT_EXERCISES.length).toBeGreaterThanOrEqual(28);
  });

  it('a des ids uniques au format slug', () => {
    const ids = DEFAULT_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('utilise uniquement des groupes musculaires valides et isCustom=false', () => {
    for (const e of DEFAULT_EXERCISES) {
      expect(MUSCLE_GROUPS).toContain(e.muscleGroup);
      expect(e.isCustom).toBe(false);
    }
  });
});
