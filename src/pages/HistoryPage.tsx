import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatCount, formatDate, formatDuration, formatWeight } from '../lib/format';
import { completedSessions, sessionDurationMs, sessionVolume } from '../lib/stats';
import { useAppStore } from '../state/AppStore';

/** Liste des séances terminées, de la plus récente à la plus ancienne (/historique). */
export default function HistoryPage() {
  const { state } = useAppStore();
  const sessions = useMemo(() => completedSessions(state.sessions).reverse(), [state.sessions]);

  return (
    <section className="page">
      <h1 className="page__title">Historique</h1>

      {sessions.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__title">Aucune séance enregistrée</p>
          <p className="muted">
            Tes séances terminées apparaîtront ici, avec leur durée et le volume soulevé. Lance ta première séance
            depuis l’onglet « Séances ».
          </p>
          <Link to="/seances" className="btn btn--primary">
            Aller aux séances
          </Link>
        </div>
      ) : (
        <ul className="history-list">
          {sessions.map((s) => {
            const count = new Set(s.exercises.filter((e) => e.sets.some((x) => x.done)).map((e) => e.exerciseId)).size;
            return (
              <li key={s.id}>
                <Link to={`/historique/${s.id}`} className="card history-item">
                  <span className="history-item__head">
                    <span className="history-item__name">{s.name}</span>
                    <span className="muted history-item__date">{formatDate(s.startedAt)}</span>
                  </span>
                  <span className="muted history-item__meta">
                    {formatDuration(sessionDurationMs(s))} · {formatWeight(sessionVolume(s))} ·{' '}
                    {formatCount(count, 'exercice')}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
