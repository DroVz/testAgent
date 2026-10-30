import { useEffect } from 'react';

/**
 * Écran maintenu allumé pendant la séance en cours (Screen Wake Lock API).
 * Le navigateur relâche le verrou quand la page passe en arrière-plan : on le redemande quand elle
 * redevient visible. Sans l'API (ou en cas de refus), rien ne se passe.
 */

type WakeLockLike = { request(type: 'screen'): Promise<{ released: boolean; release(): Promise<void> }> };

export function useWakeLock(enabled: boolean, wakeLock: WakeLockLike | undefined = globalThis.navigator?.wakeLock): void {
  useEffect(() => {
    if (!enabled || !wakeLock || typeof wakeLock.request !== 'function') return;
    let sentinel: { released: boolean; release(): Promise<void> } | null = null;
    let pending = false;
    let disposed = false;

    const release = (s: { release(): Promise<void> }) => {
      try {
        s.release().catch(() => undefined);
      } catch {
        // Déjà relâché.
      }
    };

    const acquire = () => {
      if (disposed || pending || document.visibilityState !== 'visible') return;
      if (sentinel && !sentinel.released) return;
      pending = true;
      let request: Promise<{ released: boolean; release(): Promise<void> }>;
      try {
        request = wakeLock.request('screen');
      } catch {
        pending = false;
        return;
      }
      request.then(
        (s) => {
          pending = false;
          if (disposed) release(s);
          else sentinel = s;
        },
        () => {
          // Refus (économie d'énergie, page masquée…) : on réessaiera au prochain retour au premier plan.
          pending = false;
        },
      );
    };

    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', acquire);
      if (sentinel && !sentinel.released) release(sentinel);
      sentinel = null;
    };
  }, [enabled, wakeLock]);
}
