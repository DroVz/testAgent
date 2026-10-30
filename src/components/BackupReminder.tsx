import { Check, Share } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  backupReference,
  loadBackupInfo,
  shouldShowBackupReminder,
  snoozeBackupReminder,
  unsavedCount,
} from '../lib/backup';
import { startExport } from '../lib/exportData';
import { BACKUP_REMINDER_DETAIL, formatBackupReminder } from '../lib/format';
import type { AppState } from '../lib/types';

type Phase = 'ask' | 'exported' | 'unavailable' | 'snoozed';

/**
 * Rappel de sauvegarde du récap (lot 5) : un fait, ce qu'on y gagne, l'export en un tap.
 * Conditions recalculées à chaque rendu (un export fait ailleurs fait disparaître la carte).
 */
export default function BackupReminder({ state, sessionId }: { state: AppState; sessionId: string }) {
  const [phase, setPhase] = useState<Phase>('ask');
  const statusRef = useRef<HTMLParagraphElement>(null);

  // Le bouton touché disparaît (export réussi ou impossible) : le focus va sur le message, pas sur body.
  useEffect(() => {
    if (phase === 'exported' || phase === 'unavailable') statusRef.current?.focus();
  }, [phase]);

  if (phase === 'snoozed') return null;
  // Après l'export, la carte reste (avec son message) même si ses conditions ne sont plus remplies.
  const info = loadBackupInfo();
  if (phase !== 'exported' && !shouldShowBackupReminder(sessionId, state, info)) return null;

  const onExport = () =>
    startExport(state, ({ outcome }) => {
      if (outcome === 'shared' || outcome === 'downloaded') setPhase('exported');
      else if (outcome === 'unavailable') setPhase('unavailable');
      // Feuille fermée sans choix : rien ne change.
    });

  const statusClass =
    phase === 'exported'
      ? 'backup-card__text backup-card__done'
      : phase === 'unavailable'
        ? 'muted backup-card__detail'
        : 'visually-hidden';

  return (
    <div className="card backup-card">
      {phase !== 'exported' && (
        <p className="backup-card__text">
          {formatBackupReminder(unsavedCount(state.sessions, info), backupReference(info) !== undefined)}
        </p>
      )}
      {/* Zone annoncée présente (vide) dès le premier rendu de la carte : VoiceOver lit ce qui s'y ajoute. */}
      <p ref={statusRef} className={statusClass} role="status" tabIndex={-1}>
        {phase === 'exported' && (
          <>
            <Check size={20} aria-hidden="true" />
            Copie exportée.
          </>
        )}
        {phase === 'unavailable' && 'Export impossible depuis cet écran. Ouvre Réglages pour copier tes données.'}
      </p>
      {phase === 'unavailable' && (
        <Link to="/reglages" className="btn btn--block">
          Ouvrir Réglages
        </Link>
      )}
      {phase === 'ask' && (
        <>
          <p className="muted backup-card__detail">{BACKUP_REMINDER_DETAIL}</p>
          <button type="button" className="btn btn--block" onClick={onExport}>
            <Share size={20} aria-hidden="true" />
            Exporter mes données
          </button>
        </>
      )}
      {phase !== 'exported' && (
        <button
          type="button"
          className="btn backup-card__later"
          onClick={() => {
            snoozeBackupReminder();
            setPhase('snoozed');
          }}
        >
          Plus tard
        </button>
      )}
    </div>
  );
}
