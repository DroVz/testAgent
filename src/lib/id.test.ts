import { afterEach, describe, expect, it, vi } from 'vitest';
import { createId, fallbackId } from './id';

describe('createId', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('génère des ids uniques', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createId()));
    expect(ids.size).toBe(100);
  });

  it('utilise le repli si crypto.randomUUID est absent', () => {
    vi.stubGlobal('crypto', {});
    const id = createId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(10);
  });

  it('fallbackId génère des ids distincts', () => {
    expect(fallbackId()).not.toBe(fallbackId());
  });
});
