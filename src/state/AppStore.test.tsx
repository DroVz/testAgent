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

  it('replaceState / resetState sauvegardent immédiatement et effacent l’erreur de chargement', () => {
    const { data, store } = setup({ [STORAGE_KEY]: 'corrompu' });
    expect(store.current!.loadError).toBeDefined();
    let ok = false;
    act(() => {
      ok = store.current!.actions.resetState();
    });
    expect(ok).toBe(true);
    expect(store.current!.loadError).toBeUndefined();
    expect(JSON.parse(data[STORAGE_KEY]).version).toBe(1);
  });

  it('replaceState renvoie false si la sauvegarde échoue (erreur de chargement conservée)', () => {
    const store: { current?: AppStoreValue } = {};
    function Probe() {
      store.current = useAppStore();
      return null;
    }
    const storage: StorageLike = {
      getItem: () => 'corrompu',
      setItem: () => {
        throw new Error('plein');
      },
    };
    render(
      <AppStoreProvider storage={storage}>
        <Probe />
      </AppStoreProvider>,
    );
    let ok = true;
    act(() => {
      ok = store.current!.actions.replaceState({ ...store.current!.state, templates: [] });
    });
    expect(ok).toBe(false);
    expect(store.current!.saveFailed).toBe(true);
    expect(store.current!.loadError).toBeDefined();
  });

  it('dismissLoadError masque l’erreur de chargement', () => {
    const { store } = setup({ [STORAGE_KEY]: 'corrompu' });
    act(() => store.current!.actions.dismissLoadError());
    expect(store.current!.loadError).toBeUndefined();
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
