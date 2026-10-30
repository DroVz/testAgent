import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { STORAGE_KEY, createDefaultState, exportState, type StorageLike } from '../lib/storage';
import type { AppState } from '../lib/types';
import { STATE_FILE, createDurableStorage, type DurableStorage } from '../platform/storage';
import { AppStoreProvider } from '../state/AppStore';

/** Réglages dans l'app iOS (lot 4, §4.2 critère 11, §4.6) : plugins mockés. */

const mocks = vi.hoisted(() => {
  const files = new Map<string, string>();
  const missing = () => new Error('File does not exist');
  return {
    files,
    filesystem: {
      readFile: vi.fn(async ({ path }: { path: string }) => {
        if (!files.has(path)) throw missing();
        return { data: files.get(path)! };
      }),
      writeFile: vi.fn(async ({ path, data, directory }: { path: string; data: string; directory: string }) => {
        files.set(path, data);
        return { uri: `file:///${directory}/${path}` };
      }),
      rename: vi.fn(async ({ from, to }: { from: string; to: string }) => {
        if (!files.has(from)) throw missing();
        files.set(to, files.get(from)!);
        files.delete(from);
      }),
      stat: vi.fn(async ({ path }: { path: string }) => {
        if (!files.has(path)) throw missing();
        return {};
      }),
      deleteFile: vi.fn(async ({ path }: { path: string }) => {
        if (!files.delete(path)) throw missing();
      }),
    },
    share: vi.fn(async (_options: unknown) => ({ activityType: '' })),
  };
});

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' } }));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Library: 'LIBRARY', Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: mocks.filesystem,
}));
vi.mock('@capacitor/share', () => ({ Share: { share: mocks.share } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(() => Promise.resolve({ remove: async () => undefined })) } }));

function memoryStorage(initial?: AppState): StorageLike {
  const data: Record<string, string> = initial ? { [STORAGE_KEY]: JSON.stringify(initial) } : {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

function renderSettings(storage: StorageLike | DurableStorage) {
  window.location.hash = '#/reglages';
  return render(
    <AppStoreProvider storage={storage}>
      <App />
    </AppStoreProvider>,
  );
}

const withTemplate = (): AppState => ({
  ...createDefaultState(),
  templates: [
    { id: 't1', name: 'Push', exercises: [], createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z' },
  ],
});

beforeEach(() => {
  mocks.files.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Réglages › Sauvegarde (natif)', () => {
  it('export : fichier écrit dans le cache, feuille de partage ouverte, message de réussite', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 29, 10, 0));
    const createObjectURL = vi.fn(() => 'blob:x');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const state = withTemplate();
    renderSettings(memoryStorage(state));

    fireEvent.click(screen.getByRole('button', { name: 'Exporter mes données' }));

    expect(await screen.findByText('Sauvegarde prête. Garde-la dans Fichiers ou envoie-la où tu veux.')).toBeInTheDocument();
    expect(mocks.filesystem.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({ directory: 'CACHE', path: 'muscutrack-2026-10-29.json', data: exportState(state) }),
    );
    expect(mocks.share).toHaveBeenCalledWith({
      title: 'Sauvegarde MuscuTrack',
      files: ['file:///CACHE/muscutrack-2026-10-29.json'],
    });
    // Pas de téléchargement en natif ; le texte et « Copier » restent affichés.
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Données exportées (JSON)')).toHaveValue(exportState(state));
    expect(screen.getByRole('button', { name: 'Copier' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/navigateur/);
  });

  it('partage annulé : aucun message ; partage refusé : « Partage impossible »', async () => {
    renderSettings(memoryStorage());
    mocks.share.mockRejectedValueOnce(new Error('Share canceled'));
    fireEvent.click(screen.getByRole('button', { name: 'Exporter mes données' }));
    await waitFor(() => expect(mocks.share).toHaveBeenCalledTimes(1));
    await act(async () => undefined);
    expect(screen.getByLabelText('Données exportées (JSON)')).toBeInTheDocument();
    expect(screen.queryByText(/Partage impossible/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sauvegarde prête/)).not.toBeInTheDocument();

    mocks.share.mockRejectedValueOnce(new Error('Erreur inattendue'));
    fireEvent.click(screen.getByRole('button', { name: 'Exporter mes données' }));
    expect(await screen.findByText('Partage impossible. Tu peux copier le texte ci-dessous.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/navigateur/);
  });

  it('aucun texte qui parle du navigateur', () => {
    renderSettings(memoryStorage());
    expect(screen.getByText(/stockées uniquement sur cet appareil/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/navigateur/);
  });
});

describe('Réglages › Import et Réinitialiser (natif) : state.json écrit', () => {
  async function durable() {
    const storage = createDurableStorage();
    await storage.hydrate();
    return storage;
  }

  it('import : state.json contient les données importées', async () => {
    renderSettings(await durable());
    const imported = withTemplate();
    fireEvent.change(screen.getByRole('textbox', { name: 'Ou colle le contenu exporté' }), {
      target: { value: exportState(imported) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Importer le texte' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remplacer' }));

    await waitFor(() => expect(mocks.files.get(STATE_FILE)).toBeDefined());
    expect(JSON.parse(mocks.files.get(STATE_FILE)!)).toEqual(imported);
  });

  it('réinitialiser : state.json revient à l’état par défaut', async () => {
    mocks.files.set(STATE_FILE, JSON.stringify(withTemplate()));
    renderSettings(await durable());
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser toutes les données' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tout effacer' }));

    await waitFor(() => expect(JSON.parse(mocks.files.get(STATE_FILE)!)).toEqual(createDefaultState()));
  });
});
