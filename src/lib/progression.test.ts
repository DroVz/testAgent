import { describe, expect, it } from 'vitest';
import { NBSP } from './format';
import {
  isSuggestLoadEnabled,
  keepLabel,
  keepToast,
  suggestLoad,
  suggestionDetail,
  suggestionTitle,
} from './progression';
import { MAX_REPS, MAX_WEIGHT } from './session';
import type { SetEntry } from './types';

const done = (weight: number, reps: number): SetEntry => ({ weight, reps, done: true });
const target = (targetSets: number, targetReps: number) => ({ targetSets, targetReps });
/** Remplace l'espace insécable par une espace simple, pour des attentes lisibles. */
const plain = (text: string) => text.replaceAll(NBSP, ' ');

describe('suggestLoad : tableau de cas du lot 1 (vision-et-roadmap.md)', () => {
  it.each([
    ['3 × 8, 80×8 ×3 → 82,5 kg × 8', target(3, 8), [done(80, 8), done(80, 8), done(80, 8)], true, { toWeight: 82.5, toReps: 8 }],
    ['3 × 8, 80×10, 80×9, 80×8 → 82,5 kg × 8', target(3, 8), [done(80, 10), done(80, 9), done(80, 8)], true, { toWeight: 82.5, toReps: 8 }],
    ['3 × 8, une série à 7 → rien', target(3, 8), [done(80, 8), done(80, 8), done(80, 7)], true, undefined],
    ['4 × 8, 3 séries validées sur 4 → rien', target(4, 8), [done(80, 8), done(80, 8), done(80, 8)], true, undefined],
    ['3 × 8, charges différentes → rien', target(3, 8), [done(70, 8), done(75, 8), done(80, 8)], true, undefined],
    ['3 × 10, tractions 10, 12, 10 → 11 reps', target(3, 10), [done(0, 10), done(0, 12), done(0, 10)], true, { toWeight: 0, toReps: 11 }],
    ['3 × 8, aucune séance passée → rien', target(3, 8), undefined, true, undefined],
    ['3 × 8, séance libre → rien', undefined, [done(80, 8), done(80, 8), done(80, 8)], true, undefined],
    ['3 × 0 → rien', target(3, 0), [done(80, 8), done(80, 8), done(80, 8)], true, undefined],
  ] as const)('%s', (_label, t, last, enabled, expected) => {
    const result = suggestLoad({ target: t, last: last as SetEntry[] | undefined, enabled });
    if (expected === undefined) expect(result).toBeUndefined();
    else expect(result).toMatchObject(expected);
  });

  it('réglage coupé : jamais de suggestion', () => {
    expect(suggestLoad({ target: target(3, 8), last: [done(80, 8), done(80, 8), done(80, 8)], enabled: false })).toBeUndefined();
  });

  it('retient la charge et le minimum de reps de la dernière fois', () => {
    expect(suggestLoad({ target: target(3, 8), last: [done(80, 8), done(80, 8), done(80, 8)] })).toEqual({
      fromWeight: 80,
      fromReps: 8,
      toWeight: 82.5,
      toReps: 8,
      sameReps: true,
    });
    expect(suggestLoad({ target: target(3, 8), last: [done(80, 10), done(80, 9), done(80, 8)] })).toMatchObject({
      fromReps: 8,
      sameReps: false,
    });
  });

  it('plus de séries que l’objectif la dernière fois : suggestion si toutes ont réussi', () => {
    expect(suggestLoad({ target: target(2, 8), last: [done(60, 8), done(60, 8), done(60, 9)] })).toMatchObject({ toWeight: 62.5 });
  });

  it('plafonds : pas de suggestion au-delà de MAX_WEIGHT ni de MAX_REPS', () => {
    expect(suggestLoad({ target: target(1, 1), last: [done(MAX_WEIGHT - 2, 1)] })).toBeUndefined();
    expect(suggestLoad({ target: target(1, 1), last: [done(MAX_WEIGHT - 2.5, 1)] })).toMatchObject({ toWeight: MAX_WEIGHT });
    expect(suggestLoad({ target: target(1, 1), last: [done(0, MAX_REPS)] })).toBeUndefined();
  });

  it('pas de flottant parasite : 0,1 + 2,5 = 2,6', () => {
    expect(suggestLoad({ target: target(1, 5), last: [done(0.1, 5)] })?.toWeight).toBe(2.6);
  });
});

describe('textes de la note', () => {
  const loaded = suggestLoad({ target: target(3, 8), last: [done(80, 8), done(80, 8), done(80, 8)] })!;
  const loadedMixed = suggestLoad({ target: target(3, 8), last: [done(80, 10), done(80, 9), done(80, 8)] })!;
  const bodyweight = suggestLoad({ target: target(3, 10), last: [done(0, 10), done(0, 12), done(0, 10)] })!;
  const bodyweightSame = suggestLoad({ target: target(3, 10), last: [done(0, 10), done(0, 10), done(0, 10)] })!;

  it('charge', () => {
    expect(plain(suggestionTitle(loaded))).toBe('Charge proposée : 82,5 kg');
    expect(plain(suggestionDetail(loaded))).toBe('La dernière fois : 80 kg × 8 sur toutes les séries.');
    expect(plain(suggestionDetail(loadedMixed))).toBe('La dernière fois : 80 kg, 8 reps ou plus sur toutes les séries.');
    expect(plain(keepLabel(loaded))).toBe('Rester à 80 kg');
    expect(plain(keepToast(loaded))).toBe('Charge remise à 80 kg.');
  });

  it('poids du corps', () => {
    expect(plain(suggestionTitle(bodyweight))).toBe('Reps proposées : 11 reps');
    expect(plain(suggestionDetail(bodyweight))).toBe('La dernière fois : 10 reps ou plus sur toutes les séries.');
    expect(plain(suggestionDetail(bodyweightSame))).toBe('La dernière fois : 10 reps sur toutes les séries.');
    expect(plain(keepLabel(bodyweight))).toBe('Rester à 10 reps');
    expect(plain(keepToast(bodyweight))).toBe('Reps remises à 10 reps.');
  });

  it('espaces insécables entre nombre et unité, aucun « ! »', () => {
    expect(suggestionTitle(loaded)).toContain(`82,5${NBSP}kg`);
    for (const s of [loaded, loadedMixed, bodyweight]) {
      expect(suggestionTitle(s) + suggestionDetail(s) + keepLabel(s) + keepToast(s)).not.toContain('!');
    }
  });
});

describe('isSuggestLoadEnabled', () => {
  it('absent = activé', () => {
    expect(isSuggestLoadEnabled({})).toBe(true);
    expect(isSuggestLoadEnabled({ settings: {} })).toBe(true);
    expect(isSuggestLoadEnabled({ settings: { suggestLoad: true } })).toBe(true);
    expect(isSuggestLoadEnabled({ settings: { suggestLoad: false } })).toBe(false);
  });
});
