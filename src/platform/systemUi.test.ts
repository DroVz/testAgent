import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  native: true,
  hide: vi.fn(() => Promise.resolve()),
  setStyle: vi.fn((_options: unknown) => Promise.resolve()),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mocks.native, getPlatform: () => (mocks.native ? 'ios' : 'web') },
}));
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: mocks.hide } }));
vi.mock('@capacitor/status-bar', () => ({
  StatusBar: { setStyle: mocks.setStyle },
  Style: { Dark: 'DARK', Light: 'LIGHT' },
}));

/** Faux `matchMedia('(prefers-color-scheme: dark)')`, avec changement de thème. */
function fakeColorScheme(dark: boolean) {
  const listeners: (() => void)[] = [];
  const query = {
    matches: dark,
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => query));
  return {
    set(next: boolean) {
      query.matches = next;
      listeners.forEach((fn) => fn());
    },
  };
}

/** Module rechargé : `isNative()` est lu une fois par chargement. */
async function load(native: boolean) {
  mocks.native = native;
  vi.resetModules();
  return import('./systemUi');
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('barre d’état et écran de lancement (natif)', () => {
  it('texte sombre en thème clair, clair en thème sombre, suivi des changements', async () => {
    const scheme = fakeColorScheme(false);
    const { syncStatusBar } = await load(true);
    syncStatusBar();
    expect(mocks.setStyle).toHaveBeenLastCalledWith({ style: 'LIGHT' });
    scheme.set(true);
    expect(mocks.setStyle).toHaveBeenLastCalledWith({ style: 'DARK' });
    scheme.set(false);
    expect(mocks.setStyle).toHaveBeenLastCalledWith({ style: 'LIGHT' });
  });

  it('hideSplash cache l’écran de lancement une seule fois', async () => {
    const { hideSplash } = await load(true);
    hideSplash();
    hideSplash();
    expect(mocks.hide).toHaveBeenCalledTimes(1);
  });

  it('au plus tard 3 s après le démarrage, l’écran de lancement est caché', async () => {
    vi.useFakeTimers();
    const { scheduleSplashFallback, SPLASH_MAX_MS } = await load(true);
    expect(SPLASH_MAX_MS).toBe(3000);
    scheduleSplashFallback();
    vi.advanceTimersByTime(2999);
    expect(mocks.hide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(mocks.hide).toHaveBeenCalledTimes(1);
  });

  it('plugin en échec : aucune exception', async () => {
    fakeColorScheme(true);
    mocks.hide.mockImplementationOnce(() => Promise.reject(new Error('indisponible')));
    mocks.setStyle.mockImplementationOnce(() => {
      throw new Error('indisponible');
    });
    const { hideSplash, syncStatusBar } = await load(true);
    expect(() => {
      syncStatusBar();
      hideSplash();
    }).not.toThrow();
  });
});

describe('barre d’état et écran de lancement (web)', () => {
  it('rien : aucun appel aux plugins', async () => {
    vi.useFakeTimers();
    fakeColorScheme(true);
    const { hideSplash, scheduleSplashFallback, syncStatusBar } = await load(false);
    syncStatusBar();
    scheduleSplashFallback();
    hideSplash();
    vi.advanceTimersByTime(5000);
    expect(mocks.setStyle).not.toHaveBeenCalled();
    expect(mocks.hide).not.toHaveBeenCalled();
  });
});
