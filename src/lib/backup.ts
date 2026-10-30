/**
 * Filet de sauvegarde (lot 5) : dates d'export / d'import propres à cet appareil, et rappel du récap.
 * Clé dédiée, hors de l'état de l'app et hors de l'export : ces dates décrivent l'appareil, pas les
 * données. Lecture ou écriture impossible : jamais d'exception, jamais de message.
 */
import { countedSessions } from './stats';
import type { AppSettings, WorkoutSession } from './types';

export const BACKUP_KEY = 'muscutrack:sauvegarde';

/** Séances comptées non sauvegardées à partir desquelles le récap propose un export (≈ 2 semaines). */
export const BACKUP_REMINDER_THRESHOLD = 6;

export interface BackupInfo {
  /** Date ISO du dernier export réussi sur cet appareil. */
  lastExportAt?: string;
  /** Date ISO du dernier import réussi. */
  importedAt?: string;
  /** Date ISO du dernier « Plus tard » sur la carte de rappel. */
  reminderSnoozedAt?: string;
}

export type BackupStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const FIELDS = ['lastExportAt', 'importedAt', 'reminderSnoozedAt'] as const;

function defaultStorage(): BackupStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

const isDate = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

/** Dates mémorisées ; clé absente, illisible ou valeurs qui ne sont pas des dates : vide. */
export function loadBackupInfo(storage: BackupStorage | undefined = defaultStorage()): BackupInfo {
  if (!storage) return {};
  try {
    const raw = storage.getItem(BACKUP_KEY);
    if (raw === null) return {};
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return {};
    const info: BackupInfo = {};
    for (const field of FIELDS) {
      const value = (data as Record<string, unknown>)[field];
      if (isDate(value)) info[field] = value;
    }
    return info;
  } catch {
    return {};
  }
}

function patch(change: BackupInfo, storage: BackupStorage | undefined): void {
  if (!storage) return;
  try {
    storage.setItem(BACKUP_KEY, JSON.stringify({ ...loadBackupInfo(storage), ...change }));
  } catch {
    // Stockage plein : le rappel pourra réapparaître, sans gravité.
  }
}

/** Export réussi (partage, téléchargement déclenché, copie réussie). */
export function markExported(now: Date = new Date(), storage: BackupStorage | undefined = defaultStorage()): void {
  patch({ lastExportAt: now.toISOString() }, storage);
}

/** Import réussi : les données importées existent dans un fichier. */
export function markImported(now: Date = new Date(), storage: BackupStorage | undefined = defaultStorage()): void {
  patch({ importedAt: now.toISOString() }, storage);
}

/** « Plus tard » sur la carte de rappel. */
export function snoozeBackupReminder(
  now: Date = new Date(),
  storage: BackupStorage | undefined = defaultStorage(),
): void {
  patch({ reminderSnoozedAt: now.toISOString() }, storage);
}

/** Réinitialisation : la clé est supprimée. */
export function clearBackupInfo(storage: BackupStorage | undefined = defaultStorage()): void {
  try {
    storage?.removeItem(BACKUP_KEY);
  } catch {
    // Stockage indisponible : rien à effacer.
  }
}

/** Date de référence : la plus récente de `lastExportAt` et `importedAt`, ou undefined. */
export function backupReference(info: BackupInfo): string | undefined {
  const dates = [info.lastExportAt, info.importedAt].filter(isDate);
  if (dates.length === 0) return undefined;
  return dates.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a));
}

/** Séances comptées commencées après `since` (toutes si `since` est absent). */
export function countedSessionsSince(sessions: WorkoutSession[], since: string | undefined): number {
  const counted = countedSessions(sessions);
  if (since === undefined) return counted.length;
  const t = Date.parse(since);
  return counted.filter((s) => Date.parse(s.startedAt) > t).length;
}

/** Séances comptées qui n'existent que sur ce téléphone (après la date de référence). */
export function unsavedCount(sessions: WorkoutSession[], info: BackupInfo): number {
  return countedSessionsSince(sessions, backupReference(info));
}

/** Réglage « Rappel de sauvegarde » ; absent = activé. */
export function isBackupReminderEnabled(state: { settings?: AppSettings }): boolean {
  return state.settings?.backupReminder !== false;
}

/**
 * La carte de rappel s'affiche sur le récap de `sessionId` si : le réglage est activé, la séance est
 * la séance comptée la plus récente, au moins 6 séances comptées sont non sauvegardées et, après un
 * « Plus tard », au moins 6 séances comptées ont suivi le report.
 */
export function shouldShowBackupReminder(
  sessionId: string,
  state: { sessions: WorkoutSession[]; settings?: AppSettings },
  info: BackupInfo,
): boolean {
  if (!isBackupReminderEnabled(state)) return false;
  const counted = countedSessions(state.sessions);
  if (counted.length === 0 || counted[counted.length - 1].id !== sessionId) return false;
  if (unsavedCount(state.sessions, info) < BACKUP_REMINDER_THRESHOLD) return false;
  if (info.reminderSnoozedAt !== undefined) {
    return countedSessionsSince(state.sessions, info.reminderSnoozedAt) >= BACKUP_REMINDER_THRESHOLD;
  }
  return true;
}
