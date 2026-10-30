import { describe, expect, it, vi } from 'vitest';
import { SHARE_TITLE, requestPersistentStorage, shareTextFile, shouldShowIosInstallHint } from './webPlatform';

const abort = () => Object.assign(new Error('Share canceled'), { name: 'AbortError' });

describe('shareTextFile (feuille de partage)', () => {
  it('partage le fichier JSON (même nom, même contenu) quand canShare accepte les fichiers', async () => {
    const canShare = vi.fn(() => true);
    const share = vi.fn(() => Promise.resolve());
    const result = shareTextFile('{"version":1}', 'muscutrack-2026-10-30.json', undefined, { canShare, share });
    expect(result).not.toBeNull();
    await expect(result).resolves.toBe('shared');
    const data = (share.mock.calls[0] as unknown as [ShareData])[0];
    expect(data.title).toBe(SHARE_TITLE);
    const file = data.files![0];
    expect(file.name).toBe('muscutrack-2026-10-30.json');
    expect(file.type).toBe('application/json');
    expect(await file.text()).toBe('{"version":1}');
    expect(canShare).toHaveBeenCalledWith({ files: [file] });
  });

  it('annulation par l’utilisateur (AbortError) : « cancelled », pas de téléchargement', async () => {
    const share = vi.fn(() => Promise.reject(abort()));
    await expect(shareTextFile('x', 'a.json', 'T', { canShare: () => true, share })).resolves.toBe('cancelled');
  });

  it('autre refus : « failed » (l’appelant télécharge)', async () => {
    const share = vi.fn(() => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })));
    await expect(shareTextFile('x', 'a.json', 'T', { canShare: () => true, share })).resolves.toBe('failed');
  });

  it('API absente ou fichiers refusés : null tout de suite, share jamais appelé', () => {
    const share = vi.fn(() => Promise.resolve());
    expect(shareTextFile('x', 'a.json', 'T', undefined)).toBeNull();
    expect(shareTextFile('x', 'a.json', 'T', { share } as unknown as Navigator)).toBeNull();
    expect(shareTextFile('x', 'a.json', 'T', { share, canShare: () => false })).toBeNull();
    expect(
      shareTextFile('x', 'a.json', 'T', {
        share,
        canShare: () => {
          throw new TypeError('files');
        },
      }),
    ).toBeNull();
    expect(share).not.toHaveBeenCalled();
    // jsdom (navigateur sans Web Share) : comportement web inchangé.
    expect(shareTextFile('x', 'a.json')).toBeNull();
  });
});

describe('requestPersistentStorage', () => {
  it('demande la persistance si elle n’est pas déjà accordée', async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    await requestPersistentStorage({ persisted: () => Promise.resolve(false), persist });
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('déjà persistant : aucune demande', async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    await requestPersistentStorage({ persisted: () => Promise.resolve(true), persist });
    expect(persist).not.toHaveBeenCalled();
  });

  it('API absente ou en erreur : aucune exception', async () => {
    await expect(requestPersistentStorage(undefined)).resolves.toBeUndefined();
    await expect(requestPersistentStorage({})).resolves.toBeUndefined();
    await expect(
      requestPersistentStorage({ persisted: () => Promise.reject(new Error('x')), persist: () => Promise.resolve(true) }),
    ).resolves.toBeUndefined();
  });
});

describe('shouldShowIosInstallHint', () => {
  const IPHONE_SAFARI =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const IPHONE_CHROME =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
  const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
  const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
  const browser = () => ({ matches: false });
  const standaloneMedia = () => ({ matches: true });
  const nav = (userAgent: string, extra: { platform?: string; maxTouchPoints?: number; standalone?: boolean } = {}) => ({
    userAgent,
    maxTouchPoints: extra.maxTouchPoints ?? 0,
    platform: extra.platform,
    standalone: extra.standalone,
  });

  it('iPhone dans Safari, hors écran d’accueil : affichée', () => {
    expect(shouldShowIosInstallHint(nav(IPHONE_SAFARI, { standalone: false }), browser)).toBe(true);
    // iPadOS se présente comme un Mac tactile.
    expect(shouldShowIosInstallHint(nav(IPAD_DESKTOP, { platform: 'MacIntel', maxTouchPoints: 5 }), browser)).toBe(true);
  });

  it('déjà installée (standalone) : masquée', () => {
    expect(shouldShowIosInstallHint(nav(IPHONE_SAFARI, { standalone: true }), browser)).toBe(false);
    expect(shouldShowIosInstallHint(nav(IPHONE_SAFARI), standaloneMedia)).toBe(false);
  });

  it('Android, ordinateur, Chrome sur iPhone : masquée', () => {
    expect(shouldShowIosInstallHint(nav(ANDROID), browser)).toBe(false);
    expect(shouldShowIosInstallHint(nav(IPAD_DESKTOP, { platform: 'MacIntel', maxTouchPoints: 0 }), browser)).toBe(false);
    expect(shouldShowIosInstallHint(nav(IPHONE_CHROME), browser)).toBe(false);
    expect(shouldShowIosInstallHint(undefined, browser)).toBe(false);
    // jsdom.
    expect(shouldShowIosInstallHint()).toBe(false);
  });
});
