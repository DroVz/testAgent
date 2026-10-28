import { describe, expect, it } from 'vitest';
import { REST_TIMER_KEY, loadRestEndsAt, saveRestEndsAt, type RestStorage } from './restTimer';

function memory(): RestStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const throwing: RestStorage = {
  getItem: () => {
    throw new Error('refusé');
  },
  setItem: () => {
    throw new Error('refusé');
  },
  removeItem: () => {
    throw new Error('refusé');
  },
};

describe('minuteur de repos persistant', () => {
  it('enregistre puis relit le timestamp de fin pour la même séance', () => {
    const s = memory();
    saveRestEndsAt('s1', 5_000, s);
    expect(loadRestEndsAt('s1', 1_000, s)).toBe(5_000);
  });

  it('ignore une autre séance, un repos écoulé ou une donnée illisible', () => {
    const s = memory();
    saveRestEndsAt('s1', 5_000, s);
    expect(loadRestEndsAt('s2', 1_000, s)).toBeNull();
    expect(loadRestEndsAt('s1', 5_000, s)).toBeNull();
    expect(loadRestEndsAt(undefined, 1_000, s)).toBeNull();
    s.data[REST_TIMER_KEY] = '{oups';
    expect(loadRestEndsAt('s1', 1_000, s)).toBeNull();
    s.data[REST_TIMER_KEY] = JSON.stringify({ sessionId: 's1', endsAt: 'demain' });
    expect(loadRestEndsAt('s1', 1_000, s)).toBeNull();
  });

  it('null efface le repos', () => {
    const s = memory();
    saveRestEndsAt('s1', 5_000, s);
    saveRestEndsAt('s1', null, s);
    expect(s.data).toEqual({});
  });

  it('stockage absent ou en erreur : pas d’exception', () => {
    expect(() => saveRestEndsAt('s1', 5_000, throwing)).not.toThrow();
    expect(loadRestEndsAt('s1', 0, throwing)).toBeNull();
    expect(loadRestEndsAt('s1', 0, undefined)).toBeNull();
  });
});
