/**
 * PWA « au maximum » : API web facultatives (feuille de partage, stockage persistant, mode installé).
 * Chaque fonction se replie en silence quand l'API manque : jamais d'exception, jamais de message.
 * Les dépendances (navigator, matchMedia) sont injectables pour les tests.
 */

export const SHARE_TITLE = 'Sauvegarde MuscuTrack';

/** shared : feuille de partage utilisée ; cancelled : fermée par l'utilisateur ; failed : passer au téléchargement. */
export type ShareOutcome = 'shared' | 'cancelled' | 'failed';

type ShareNavigator = Pick<Navigator, 'share'> & { canShare?: Navigator['canShare'] };

function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

/**
 * Partage un fichier texte (JSON) par la feuille de partage du système, si elle accepte les fichiers.
 * Renvoie null tout de suite (sans rien ouvrir) si ce n'est pas possible : l'appelant télécharge alors
 * le fichier comme avant, dans le même geste. À appeler directement dans le geste de l'utilisateur.
 */
export function shareTextFile(
  text: string,
  fileName: string,
  title: string = SHARE_TITLE,
  nav: ShareNavigator | undefined = globalThis.navigator,
): Promise<ShareOutcome> | null {
  let file: File;
  try {
    if (!nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return null;
    file = new File([text], fileName, { type: 'application/json' });
    if (!nav.canShare({ files: [file] })) return null;
  } catch {
    return null;
  }
  try {
    return nav.share({ files: [file], title }).then(
      (): ShareOutcome => 'shared',
      // Feuille fermée sans choisir : ce n'est pas une erreur. Tout autre refus : téléchargement.
      (error: unknown): ShareOutcome => (isAbort(error) ? 'cancelled' : 'failed'),
    );
  } catch {
    return null;
  }
}

type PersistStorage = { persist?: () => Promise<boolean>; persisted?: () => Promise<boolean> };

/**
 * Demande au navigateur de ne pas effacer les données de l'app sous pression de stockage.
 * Une seule demande, au démarrage ; aucun retour affiché.
 */
export async function requestPersistentStorage(
  storage: PersistStorage | undefined = globalThis.navigator?.storage,
): Promise<void> {
  try {
    if (!storage || typeof storage.persist !== 'function') return;
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return;
    await storage.persist();
  } catch {
    // API refusée ou indisponible : rien à faire.
  }
}

type InstallNavigator = Pick<Navigator, 'userAgent' | 'maxTouchPoints'> & { platform?: string; standalone?: boolean };
type MatchMedia = (query: string) => { matches: boolean };

/**
 * Vrai sur iPhone / iPad dans Safari, hors mode installé (écran d'accueil) : on peut alors indiquer
 * comment ajouter l'app à l'écran d'accueil. Faux partout ailleurs (Android, ordinateur, autres navigateurs iOS).
 */
export function shouldShowIosInstallHint(
  nav: InstallNavigator | undefined = globalThis.navigator,
  matchMedia: MatchMedia | undefined = globalThis.matchMedia?.bind(globalThis),
): boolean {
  try {
    if (!nav) return false;
    const ua = nav.userAgent ?? '';
    // iPadOS se présente comme un Mac : on le reconnaît à l'écran tactile.
    const ios = /iPhone|iPad|iPod/.test(ua) || (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1);
    if (!ios) return false;
    // Chrome, Firefox, Edge, Opera sur iOS : le parcours d'installation diffère.
    if (!/Safari/.test(ua) || /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return false;
    if (nav.standalone === true) return false;
    if (matchMedia?.('(display-mode: standalone)').matches) return false;
    return true;
  } catch {
    return false;
  }
}
