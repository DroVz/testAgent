import { BellRing } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NBSP, formatClock } from '../lib/format';
import { playRestChime } from '../lib/restChime';

export interface RestTimerProps {
  /** Timestamp (ms) de fin du repos : le décompte reste juste même si l'écran s'est mis en veille. */
  endsAt: number;
  /** Ajoute (ou retire si négatif) des secondes au repos. */
  onAdjust(seconds: number): void;
  /** Ferme le minuteur (Passer / Fermer). */
  onDismiss(): void;
  /** Bip à la fin du repos (réglage « Son en fin de repos »). */
  sound?: boolean;
  /** Horloge injectable pour les tests. */
  now?: () => number;
}

/** Minuteur de repos : compte à rebours, ±15 s, Passer ; vibration (et bip si activé) à la fin si disponible. */
export default function RestTimer({ endsAt, onAdjust, onDismiss, sound = false, now = Date.now }: RestTimerProps) {
  const [current, setCurrent] = useState(now);
  const vibratedFor = useRef<number | null>(null);

  useEffect(() => {
    let interval: number | undefined;
    const stop = () => {
      if (interval !== undefined) window.clearInterval(interval);
      interval = undefined;
    };
    const tick = () => {
      const t = now();
      setCurrent(t);
      // Repos terminé : plus besoin de rafraîchir.
      if (t >= endsAt) stop();
    };
    tick();
    if (now() < endsAt) interval = window.setInterval(tick, 250);
    // Au retour de veille, on recalcule immédiatement.
    document.addEventListener('visibilitychange', tick);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', tick);
    };
  }, [now, endsAt]);

  const remaining = Math.max(0, endsAt - current);
  const finished = remaining <= 0;

  useEffect(() => {
    if (finished && vibratedFor.current !== endsAt) {
      vibratedFor.current = endsAt;
      // Sans geste de l'utilisateur depuis le chargement, le navigateur refuse la vibration (et le signale en console).
      if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.([200, 100, 200]);
      // iOS ignore la vibration : bip court (le contexte audio a été débloqué au tap qui a lancé le repos).
      if (sound) playRestChime();
    }
  }, [finished, endsAt, sound]);

  return (
    <div className={`rest-timer${finished ? ' rest-timer--done' : ''}`} role="region" aria-label="Minuteur de repos">
      {finished ? (
        <p className="rest-timer__time" role="status">
          <BellRing size={24} aria-hidden="true" />
          Repos terminé.
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
              {`−15${NBSP}s`}
            </button>
            <button type="button" className="btn" onClick={() => onAdjust(15)} aria-label="Ajouter 15 secondes">
              {`+15${NBSP}s`}
            </button>
          </>
        )}
        <button type="button" className="btn" onClick={onDismiss}>
          {finished ? 'Série suivante' : 'Passer'}
        </button>
      </div>
    </div>
  );
}
