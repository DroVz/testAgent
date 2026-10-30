import { describe, expect, it } from 'vitest';
import {
  BACKUP_KEY,
  BACKUP_REMINDER_THRESHOLD,
  backupReference,
  clearBackupInfo,
  isBackupReminderEnabled,
  loadBackupInfo,
  markExported,
  markImported,
  shouldShowBackupReminder,
  snoozeBackupReminder,
  unsavedCount,
  type BackupStorage,
} from './backup';
import type { WorkoutSession } from './types';

function memory(initial?: string, { failWrites = false } = {}) {
  const data: Record<string, string> = initial === undefined ? {} : { [BACKUP_KEY]: initial };
  const storage: BackupStorage = {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      if (failWrites) throw new Error('QuotaExceededError');
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
  return { storage, data };
}

/** Séance du jour `day` d'octobre 2026, 18 h ; `done = false` : terminée sans série validée. */
function session(id: string, day: number, done = true): WorkoutSession {
  return {
    id,
    name: id,
    startedAt: new Date(2026, 9, day, 18).toISOString(),
    endedAt: new Date(2026, 9, day, 19).toISOString(),
    exercises: [{ exerciseId: 'squat', sets: [{ weight: 100, reps: 5, done }] }],
  };
}

/** `n` séances comptées, du 1er au n-ième jour d'octobre. */
const sessions = (n: number) => Array.from({ length: n }, (_, i) => session(`s${i + 1}`, i + 1));
const at = (day: number, h = 20) => new Date(2026, 9, day, h).toISOString();

describe('sauvegarde : stockage de la clé muscutrack:sauvegarde', () => {
  it('absente, JSON invalide ou dates invalides : vide, sans exception', () => {
    expect(loadBackupInfo(memory().storage)).toEqual({});
    expect(loadBackupInfo(memory('{pas du json').storage)).toEqual({});
    expect(loadBackupInfo(memory('"texte"').storage)).toEqual({});
    expect(loadBackupInfo(memory('[1]').storage)).toEqual({});
    expect(loadBackupInfo(memory(JSON.stringify({ lastExportAt: 'hier', importedAt: 42, reminderSnoozedAt: null })).storage)).toEqual({});
    const throwing: BackupStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(loadBackupInfo(throwing)).toEqual({});
    expect(loadBackupInfo(undefined)).toEqual({});
  });

  it('écriture qui lève une exception : ignorée', () => {
    const { storage } = memory(undefined, { failWrites: true });
    expect(() => markExported(new Date(), storage)).not.toThrow();
    expect(() => markImported(new Date(), storage)).not.toThrow();
    expect(() => snoozeBackupReminder(new Date(), storage)).not.toThrow();
    const throwing: BackupStorage = { ...storage, removeItem: () => { throw new Error('no'); } };
    expect(() => clearBackupInfo(throwing)).not.toThrow();
  });

  it('export, import et report posent chacun leur date ; la réinitialisation supprime la clé', () => {
    const { storage, data } = memory();
    markExported(new Date(at(3)), storage);
    markImported(new Date(at(5)), storage);
    snoozeBackupReminder(new Date(at(7)), storage);
    expect(loadBackupInfo(storage)).toEqual({ lastExportAt: at(3), importedAt: at(5), reminderSnoozedAt: at(7) });
    clearBackupInfo(storage);
    expect(data[BACKUP_KEY]).toBeUndefined();
    expect(loadBackupInfo(storage)).toEqual({});
  });
});

describe('sauvegarde : séances non sauvegardées', () => {
  it('référence = la plus récente de lastExportAt et importedAt', () => {
    expect(backupReference({})).toBeUndefined();
    expect(backupReference({ lastExportAt: at(3) })).toBe(at(3));
    expect(backupReference({ lastExportAt: at(3), importedAt: at(5) })).toBe(at(5));
    expect(backupReference({ lastExportAt: at(9), importedAt: at(5) })).toBe(at(9));
  });

  it('ne compte que les séances comptées après la référence ; toutes sans référence', () => {
    const list = [...sessions(8), session('vide', 9, false)];
    expect(unsavedCount(list, {})).toBe(8);
    expect(unsavedCount(list, { lastExportAt: at(5) })).toBe(3);
    expect(unsavedCount(list, { lastExportAt: at(2), importedAt: at(6) })).toBe(2);
    // Horloge reculée : export « dans le futur », rien n'est compté.
    expect(unsavedCount(list, { lastExportAt: at(28) })).toBe(0);
  });
});

describe('sauvegarde : shouldShowBackupReminder', () => {
  const state = (n: number, settings?: { backupReminder?: boolean }) => ({ sessions: sessions(n), settings });

  it(`vrai à ${BACKUP_REMINDER_THRESHOLD} séances non sauvegardées, faux à 5`, () => {
    expect(shouldShowBackupReminder('s6', state(6), {})).toBe(true);
    expect(shouldShowBackupReminder('s5', state(5), {})).toBe(false);
    // Après un export, 3 séances : pas de carte ; 6 séances après : carte.
    expect(shouldShowBackupReminder('s8', state(8), { lastExportAt: at(5) })).toBe(false);
    expect(shouldShowBackupReminder('s11', state(11), { lastExportAt: at(5) })).toBe(true);
    // Import : pas de carte avant 6 nouvelles séances.
    expect(shouldShowBackupReminder('s10', state(10), { importedAt: at(5) })).toBe(false);
  });

  it('faux si le rappel est désactivé', () => {
    expect(isBackupReminderEnabled({})).toBe(true);
    expect(isBackupReminderEnabled({ settings: { backupReminder: false } })).toBe(false);
    expect(shouldShowBackupReminder('s8', state(8, { backupReminder: false }), {})).toBe(false);
  });

  it('faux si la séance du récap n’est pas la dernière séance comptée', () => {
    expect(shouldShowBackupReminder('s7', state(8), {})).toBe(false);
    expect(shouldShowBackupReminder('inconnue', state(8), {})).toBe(false);
    // Séance terminée sans série validée : non comptée, pas de carte sur son récap.
    const withEmpty = { sessions: [...sessions(8), session('vide', 9, false)] };
    expect(shouldShowBackupReminder('vide', withEmpty, {})).toBe(false);
    expect(shouldShowBackupReminder('s8', withEmpty, {})).toBe(true);
  });

  it('après « Plus tard », faux tant que 6 séances comptées n’ont pas suivi le report', () => {
    const snoozed = { reminderSnoozedAt: at(6, 20) };
    expect(shouldShowBackupReminder('s6', state(6), snoozed)).toBe(false);
    expect(shouldShowBackupReminder('s11', state(11), snoozed)).toBe(false);
    expect(shouldShowBackupReminder('s12', state(12), snoozed)).toBe(true);
  });
});
