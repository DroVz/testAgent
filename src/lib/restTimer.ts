/**
 * Persistance du minuteur de repos (timestamp de fin) pour qu'il survive à un rechargement
 * ou à un démontage de l'écran de séance. Stockage de session : jamais d'exception.
 */

export const REST_TIMER_KEY = 'muscutrack:repos';

export type RestStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): RestStorage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

/**
 * Timestamp de fin du repos enregistré pour cette séance, ou null (aucun, autre séance,
 * donnée illisible, ou repos déjà écoulé à `now`).
 */
export function loadRestEndsAt(
  sessionId: string | undefined,
  now: number = Date.now(),
  storage: RestStorage | undefined = defaultStorage(),
): number | null {
  if (!sessionId || !storage) return null;
  try {
    const raw = storage.getItem(REST_TIMER_KEY);
    if (raw === null) return null;
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    const { sessionId: id, endsAt } = data as Record<string, unknown>;
    if (id !== sessionId || typeof endsAt !== 'number' || !Number.isFinite(endsAt) || endsAt <= now) return null;
    return endsAt;
  } catch {
    return null;
  }
}

/** Enregistre (ou efface si `endsAt` est null) le repos en cours. */
export function saveRestEndsAt(
  sessionId: string | undefined,
  endsAt: number | null,
  storage: RestStorage | undefined = defaultStorage(),
): void {
  if (!storage) return;
  try {
    if (!sessionId || endsAt === null) storage.removeItem(REST_TIMER_KEY);
    else storage.setItem(REST_TIMER_KEY, JSON.stringify({ sessionId, endsAt }));
  } catch {
    // Stockage indisponible : le minuteur fonctionne quand même, sans persistance.
  }
}

/** Réglage « Son en fin de repos » ; absent = activé. */
export function isRestSoundEnabled(state: { settings?: { restSound?: boolean } }): boolean {
  return state.settings?.restSound !== false;
}
