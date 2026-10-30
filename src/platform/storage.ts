import { App } from '@capacitor/app';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { STORAGE_KEY, exportState, validateImport, type DeferredStorageLike, type StorageLike } from '../lib/storage';
import type { AppState } from '../lib/types';

/**
 * Stockage durable (lot 4, §4.2).
 *
 * - App iOS : l'état vit dans un fichier JSON du dossier `Library` de l'app (jamais purgé par iOS,
 *   contrairement au `localStorage` de la WebView). `AppStore` garde son interface synchrone : il lit
 *   et écrit un miroir en mémoire, préchargé avant le premier rendu (`hydrate`), qui écrit le fichier
 *   après coup (regroupé sur 300 ms, une écriture à la fois, écriture immédiate à la mise en
 *   arrière-plan).
 * - Web : `localStorage`, comme avant ; le navigateur est prié une fois de ne pas purger les données.
 */

export const DATA_DIR = 'muscutrack';
export const STATE_FILE = `${DATA_DIR}/state.json`;
export const BACKUP_FILE = `${DATA_DIR}/state.bak.json`;
export const TEMP_FILE = `${DATA_DIR}/state.tmp.json`;
export const WRITE_DELAY_MS = 300;

export const BACKUP_RESTORED_WARNING =
  'Les dernières modifications n’ont pas pu être relues. La sauvegarde précédente a été restaurée.';

/** Sous-ensemble de `Filesystem` utilisé (mocké dans les tests). */
export type FilesystemLike = Pick<typeof Filesystem, 'readFile' | 'writeFile' | 'rename' | 'stat' | 'deleteFile'>;

export interface DurableStorageDeps {
  filesystem: FilesystemLike;
  /** Abonnement à la mise en arrière-plan de l'app (`App.addListener('pause')`). */
  onPause(listener: () => void): void;
  /** Ancien stockage (`localStorage` de la WebView), lu seulement pour la migration. */
  legacyStorage(): Pick<Storage, 'getItem'> | undefined;
}

export interface HydrateResult {
  source: 'state' | 'backup' | 'migration' | 'empty' | 'unreadable';
  /** Avertissement à afficher au démarrage (bandeau de chargement existant). */
  warning?: string;
}

export interface DurableStorage extends DeferredStorageLike {
  /** Charge le fichier de données dans le miroir. Ne lève jamais d'exception. */
  hydrate(): Promise<HydrateResult>;
}

type ReadOutcome = { status: 'read'; text: string } | { status: 'missing' } | { status: 'error' };

/** État connu de `state.json` : absent, valide, ou présent mais illisible. */
type StateFile = 'absent' | 'valid' | 'invalid';

function safeLocalStorage(): Storage | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

const defaultDeps: DurableStorageDeps = {
  filesystem: Filesystem,
  onPause(listener) {
    try {
      App.addListener('pause', listener).catch(() => undefined);
    } catch {
      // Plugin indisponible : l'écriture regroupée suffit.
    }
  },
  legacyStorage: safeLocalStorage,
};

export function createDurableStorage(deps: DurableStorageDeps = defaultDeps): DurableStorage {
  const { filesystem: fs } = deps;
  const directory = Directory.Library;
  let mirror: string | null = null;
  const others = new Map<string, string>();
  let stateFile: StateFile = 'absent';
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | null = null;
  let onWriteError: (() => void) | null = null;

  async function read(path: string): Promise<ReadOutcome> {
    try {
      const { data } = await fs.readFile({ path, directory, encoding: Encoding.UTF8 });
      return { status: 'read', text: typeof data === 'string' ? data : '' };
    } catch {
      // Absent, ou présent mais impossible à lire ?
      try {
        await fs.stat({ path, directory });
        return { status: 'error' };
      } catch {
        return { status: 'missing' };
      }
    }
  }

  /** Texte lu s'il est un état valide, sinon null. */
  const validText = (outcome: ReadOutcome): string | null =>
    outcome.status === 'read' && validateImport(outcome.text).ok ? outcome.text : null;

  async function removeQuietly(path: string): Promise<void> {
    try {
      await fs.deleteFile({ path, directory });
    } catch {
      // Déjà absent.
    }
  }

  /** Écriture atomique : `state.tmp.json`, puis `state.json` → `state.bak.json`, puis tmp → `state.json`. */
  async function writeAtomic(text: string): Promise<void> {
    await fs.writeFile({ path: TEMP_FILE, data: text, directory, encoding: Encoding.UTF8, recursive: true });
    if (stateFile === 'valid') {
      // Sans dépendre du comportement de `rename` sur une destination existante.
      await removeQuietly(BACKUP_FILE);
      await fs.rename({ from: STATE_FILE, to: BACKUP_FILE, directory, toDirectory: directory });
      stateFile = 'absent';
    } else if (stateFile === 'invalid') {
      // Un `state.json` illisible ne remplace jamais une sauvegarde valide.
      await removeQuietly(STATE_FILE);
      stateFile = 'absent';
    }
    await fs.rename({ from: TEMP_FILE, to: STATE_FILE, directory, toDirectory: directory });
    stateFile = 'valid';
  }

  async function drain(): Promise<void> {
    while (pending !== null) {
      const text = pending;
      pending = null;
      try {
        await writeAtomic(text);
      } catch {
        try {
          onWriteError?.();
        } catch {
          // Jamais d'exception vers l'écran.
        }
      }
    }
  }

  function flush(): Promise<void> {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (!running) {
      running = drain().finally(() => {
        running = null;
      });
    }
    return running;
  }

  function schedule(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void flush();
    }, WRITE_DELAY_MS);
  }

  /** Migration du `localStorage` de la WebView : écrite, relue et comparée avant de devenir la source. */
  async function migrate(text: string): Promise<void> {
    try {
      await fs.writeFile({ path: TEMP_FILE, data: text, directory, encoding: Encoding.UTF8, recursive: true });
      const back = await read(TEMP_FILE);
      if (back.status !== 'read' || back.text !== text) return;
      await fs.rename({ from: TEMP_FILE, to: STATE_FILE, directory, toDirectory: directory });
      stateFile = 'valid';
    } catch {
      // `state.json` n'existe pas : la migration sera retentée au prochain lancement, et les
      // données restent chargées (et dans le `localStorage`, jamais supprimé).
    }
  }

  async function load(): Promise<HydrateResult> {
    const state = await read(STATE_FILE);
    const stateText = validText(state);
    if (stateText !== null) {
      mirror = stateText;
      stateFile = 'valid';
      return { source: 'state' };
    }
    stateFile = state.status === 'missing' ? 'absent' : 'invalid';

    const backup = await read(BACKUP_FILE);
    const backupText = validText(backup);
    if (backupText !== null) {
      mirror = backupText;
      return { source: 'backup', warning: BACKUP_RESTORED_WARNING };
    }

    if (state.status !== 'missing' || backup.status !== 'missing') {
      // Fichiers présents mais illisibles : le `localStorage` n'est plus jamais relu une fois le
      // fichier créé. Le texte illisible passe au store, qui affiche l'avertissement existant et
      // n'écrit rien tant que l'utilisateur ne modifie rien.
      mirror = state.status === 'read' ? state.text : backup.status === 'read' ? backup.text : '';
      return { source: 'unreadable' };
    }

    let legacy: string | null = null;
    try {
      legacy = deps.legacyStorage()?.getItem(STORAGE_KEY) ?? null;
    } catch {
      legacy = null;
    }
    if (legacy === null) return { source: 'empty' };
    const parsed = validateImport(legacy);
    if (!parsed.ok) {
      mirror = legacy;
      return { source: 'unreadable' };
    }
    // Même contenu que le localStorage (rien n’est retiré), au format de l’export.
    const text = exportState(JSON.parse(legacy) as AppState);
    await migrate(text);
    mirror = text;
    return { source: 'migration' };
  }

  return {
    async hydrate() {
      deps.onPause(() => {
        void flush();
      });
      try {
        return await load();
      } catch {
        return { source: 'empty' };
      }
    },
    getItem(key) {
      return key === STORAGE_KEY ? mirror : (others.get(key) ?? null);
    },
    setItem(key, value) {
      if (key !== STORAGE_KEY) {
        others.set(key, value);
        return;
      }
      mirror = value;
      pending = value;
      schedule();
    },
    flush,
    setWriteErrorHandler(handler) {
      onWriteError = handler;
    },
  };
}

let persistAsked = false;

/** Demande au navigateur, une seule fois, de ne pas purger les données (sans message, résultat ignoré). */
function requestPersistOnce(): void {
  if (persistAsked) return;
  persistAsked = true;
  try {
    const request = globalThis.navigator?.storage?.persist?.();
    request?.catch(() => undefined);
  } catch {
    // Rien : demande facultative.
  }
}

/**
 * Stockage web : `localStorage`, comme avant le lot 4 (undefined s'il est inaccessible, comme le
 * stockage par défaut de `loadState`), plus la demande de stockage persistant à la première sauvegarde.
 */
export function createWebStorage(): StorageLike | undefined {
  const ls = safeLocalStorage();
  if (!ls) return undefined;
  return {
    getItem: (key) => ls.getItem(key),
    setItem(key, value) {
      ls.setItem(key, value);
      requestPersistOnce();
    },
  };
}
