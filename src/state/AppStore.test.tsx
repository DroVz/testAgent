import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY, type StorageLike } from '../lib/storage';
import { AppStoreProvider, useAppStore, type AppStoreValue } from './AppStore';

function memoryStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  const storage: StorageLike = {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
  return { data, storage };
}

function setup(initial?: Record<string, string>) {
  const mem = memoryStorage(initial);
  const store: { current?: AppStoreValue } = {};
  function Probe() {
    store.current = useAppStore();
    return <p>{store.current.loadError ?? 'ok'}</p>;
  }
  render(
    <AppStoreProvider storage={mem.storage}>
      <Probe />
    </AppStoreProvider>,
  );
  return { ...mem, store };
}

describe('AppStoreProvider', () => {
  it('ne sauvegarde pas au démarrage puis sauvegarde à chaque changement', () => {
    const { data, store } = setup();
    expect(data[STORAGE_KEY]).toBeUndefined();
    act(() => {
      store.current!.actions.createTemplate({ name: 'Push' });
    });
    expect(JSON.parse(data[STORAGE_KEY]).templates[0].name).toBe('Push');
  });

  it('données corrompues : démarre avec l’état par défaut, signale l’erreur et ne les écrase pas', () => {
    const { data, store } = setup({ [STORAGE_KEY]: 'corrompu' });
    expect(screen.getByText(/illisibles/)).toBeInTheDocument();
    expect(store.current!.state.templates).toEqual([]);
    expect(data[STORAGE_KEY]).toBe('corrompu');
  });

  it('lève une erreur explicite hors du provider', () => {
    function Orphan() {
      useAppStore();
      return null;
    }
    // Erreur attendue : on évite le bruit de React et de jsdom dans la sortie des tests.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const swallow = (e: ErrorEvent) => e.preventDefault();
    window.addEventListener('error', swallow);
    expect(() => render(<Orphan />)).toThrow(/AppStoreProvider/);
    window.removeEventListener('error', swallow);
    spy.mockRestore();
  });
});
