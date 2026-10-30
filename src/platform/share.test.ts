import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  writeFile: vi.fn(async ({ path }: { path: string }) => ({ uri: `file:///Caches/${path}` })),
  share: vi.fn(async (_options: unknown) => ({ activityType: '' })),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' } }));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Library: 'LIBRARY', Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: { writeFile: mocks.writeFile },
}));
vi.mock('@capacitor/share', () => ({ Share: { share: mocks.share } }));

import { SHARE_TITLE, shareExportFile } from './share';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('export par la feuille de partage (natif)', () => {
  it('écrit le fichier dans le cache puis ouvre la feuille de partage avec son URI', async () => {
    await expect(shareExportFile('{ "version": 1 }', 'muscutrack-2026-10-29.json')).resolves.toBe('shared');
    expect(mocks.writeFile).toHaveBeenCalledWith({
      path: 'muscutrack-2026-10-29.json',
      data: '{ "version": 1 }',
      directory: 'CACHE',
      encoding: 'utf8',
    });
    expect(mocks.share).toHaveBeenCalledWith({
      title: 'Sauvegarde MuscuTrack',
      files: ['file:///Caches/muscutrack-2026-10-29.json'],
    });
    expect(SHARE_TITLE).toBe('Sauvegarde MuscuTrack');
  });

  it('feuille fermée par l’utilisateur : « cancelled », pas une erreur', async () => {
    mocks.share.mockRejectedValueOnce(new Error('Share canceled'));
    await expect(shareExportFile('{}', 'x.json')).resolves.toBe('cancelled');
  });

  it('autre refus du partage, ou écriture impossible : « failed », sans exception', async () => {
    mocks.share.mockRejectedValueOnce(new Error('Can’t share while sharing is in progress'));
    await expect(shareExportFile('{}', 'x.json')).resolves.toBe('failed');

    mocks.writeFile.mockRejectedValueOnce(new Error('disque plein'));
    await expect(shareExportFile('{}', 'x.json')).resolves.toBe('failed');
    expect(mocks.share).toHaveBeenCalledTimes(1);
  });
});
