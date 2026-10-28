import { useEffect, useRef, useState } from 'react';
import { formatClock } from '../lib/format';

export interface RestTimerProps {
  /** Timestamp (ms) de fin du repos : le décompte reste juste même si l'écran s'est mis en veille. */
  endsAt: number;
  /** Ajoute (ou retire si négatif) des secondes au repos. */
  onAdjust(seconds: number): void;
  /** Ferme le minuteur (Passer / Fermer). */
  onDismiss(): void;
  /** Horloge injectable pour les tests. */
  now?: () => number;
}

/** Minuteur de repos : compte à rebours, ±15 s, Passer ; vibration à la fin si disponible. */
export default function RestTimer({ endsAt, onAdjust, onDismiss, now = Date.now }: RestTimerProps) {
  const [current, setCurrent] = useState(now);
  const vibratedFor = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => setCurrent(now());
    tick();
    const interval = window.setInterval(tick, 250);
    // Au retour de veille, on recalcule immédiatement.
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [now, endsAt]);

  const remaining = Math.max(0, endsAt - current);
  const finished = remaining <= 0;

  useEffect(() => {
    if (finished && vibratedFor.current !== endsAt) {
      vibratedFor.current = endsAt;
      navigator.vibrate?.([200, 100, 200]);
    }
  }, [finished, endsAt]);

  return (
    <div className={`rest-timer${finished ? ' rest-timer--done' : ''}`} role="region" aria-label="Minuteur de repos">
      {finished ? (
        <p className="rest-timer__time" role="status">
          Repos terminé !
        </p>
      ) : (
        <p className="rest-timer__time" role="timer" aria-live="off">
          <span className="rest-timer__label">Repos</span> {formatClock(Math.ceil(remaining / 1000) * 1000)}
        </p>
      )}
      <div className="rest-timer__actions">
        {!finished && (
          <>
            <button type="button" className="btn" onClick={() => onAdjust(-15)} aria-label="Retirer 15 secondes">
              −15 s
            </button>
            <button type="button" className="btn" onClick={() => onAdjust(15)} aria-label="Ajouter 15 secondes">
              +15 s
            </button>
          </>
        )}
        <button type="button" className="btn btn--primary" onClick={onDismiss}>
          {finished ? 'OK' : 'Passer'}
        </button>
      </div>
    </div>
  );
}
