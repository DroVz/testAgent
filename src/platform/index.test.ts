import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('@capacitor/core');
  vi.resetModules();
});

describe('détection de plateforme', () => {
  it('web (Vitest/jsdom, vrai @capacitor/core) : isNative() faux, plateforme « web »', async () => {
    const { isNative, platformName } = await import('./index');
    expect(isNative()).toBe(false);
    expect(platformName()).toBe('web');
  });

  it('natif (@capacitor/core mocké) : isNative() vrai, plateforme « ios », lus une fois', async () => {
    const isNativePlatform = vi.fn(() => true);
    const getPlatform = vi.fn(() => 'ios');
    vi.doMock('@capacitor/core', () => ({ Capacitor: { isNativePlatform, getPlatform } }));
    const { isNative, platformName } = await import('./index');
    expect(isNative()).toBe(true);
    expect(isNative()).toBe(true);
    expect(platformName()).toBe('ios');
    expect(platformName()).toBe('ios');
    expect(isNativePlatform).toHaveBeenCalledTimes(1);
    expect(getPlatform).toHaveBeenCalledTimes(1);
  });

  it('Capacitor qui lève une exception : repli web, sans exception', async () => {
    const unavailable = () => {
      throw new Error('indisponible');
    };
    vi.doMock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: unavailable, getPlatform: unavailable } }));
    const { isNative, platformName } = await import('./index');
    expect(isNative()).toBe(false);
    expect(platformName()).toBe('web');
  });
});
