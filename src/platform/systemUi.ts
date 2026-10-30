import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isNative } from './index';

/**
 * Barre d'état et écran de lancement de l'app iOS (lot 4, §4.1). Web : rien (les
 * `<meta name="theme-color">` d'index.html suffisent).
 */

/** Délai maximal d'affichage de l'écran de lancement, même si le chargement traîne. */
export const SPLASH_MAX_MS = 3000;

const DARK_QUERY = '(prefers-color-scheme: dark)';
let splashHidden = false;

/** Cache l'écran de lancement (une fois). Sans effet sur le web ; jamais d'exception. */
export function hideSplash(): void {
  if (!isNative() || splashHidden) return;
  splashHidden = true;
  try {
    SplashScreen.hide().catch(() => undefined);
  } catch {
    // Plugin indisponible.
  }
}

/** Filet : l'écran de lancement disparaît au plus tard `SPLASH_MAX_MS` après le démarrage. */
export function scheduleSplashFallback(): void {
  if (!isNative()) return;
  setTimeout(hideSplash, SPLASH_MAX_MS);
}

/**
 * Texte de la barre d'état : sombre en thème clair, clair en thème sombre, mis à jour à chaque
 * changement de `prefers-color-scheme`.
 */
export function syncStatusBar(): void {
  if (!isNative() || typeof window.matchMedia !== 'function') return;
  const query = window.matchMedia(DARK_QUERY);
  const apply = () => {
    try {
      // Style.Dark : texte clair (fond sombre) ; Style.Light : texte sombre (fond clair).
      StatusBar.setStyle({ style: query.matches ? Style.Dark : Style.Light }).catch(() => undefined);
    } catch {
      // Plugin indisponible.
    }
  };
  apply();
  query.addEventListener?.('change', apply);
}
