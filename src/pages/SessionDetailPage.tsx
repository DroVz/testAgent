import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { exerciseName, formatCount, formatDate, formatDuration, formatNumber, formatWeight } from '../lib/format';
import { countDoneSets, doneSets, exerciseVolume, sessionDurationMs, sessionVolume } from '../lib/stats';
import { useAppStore } from '../state/AppStore';

/** Détail d'une séance de l'historique (/historique/:id). */
export default function SessionDetailPage() {
  const { id } = useParams();
  const { state, actions } = useAppStore();
  const navigate = useNavigate();
  const toast = useToast();
  const session = state.sessions.find((s) => s.id === id && s.endedAt !== undefined);

  if (!session) {
    return (
      <section className="page">
        <h1 className="page__title">Séance introuvable</h1>
        <p className="muted">Cette séance n’existe pas ou a été supprimée.</p>
        <Link to="/historique" className="btn">
          Retour à l’historique
        </Link>
      </section>
    );
  }

  const exercises = session.exercises.filter((e) => doneSets(e.sets).length > 0);

  return (
    <section className="page">
      <Link to="/historique" className="back-link">
        <ArrowLeft size={20} aria-hidden="true" />
        Historique
      </Link>
      <h1 className="page__title">{session.name}</h1>
      <p className="muted">{formatDate(session.startedAt)}</p>

      <dl className="stat-grid">
        <div className="stat">
          <dt className="stat__label">Durée</dt>
          <dd className="stat__value">{formatDuration(sessionDurationMs(session))}</dd>
        </div>
        <div className="stat">
          <dt className="stat__label">Volume</dt>
          <dd className="stat__value">{formatWeight(sessionVolume(session))}</dd>
        </div>
        <div className="stat">
          <dt className="stat__label">Séries</dt>
          <dd className="stat__value">{formatNumber(countDoneSets(session))}</dd>
        </div>
      </dl>

      {exercises.length === 0 && <p className="muted">Aucune série validée dans cette séance.</p>}

      <ul className="detail-list">
        {exercises.map((e, i) => {
          const name = exerciseName(state.exercises, e.exerciseId);
          return (
            <li key={`${e.exerciseId}-${i}`} className="card detail-exercise">
              <div className="detail-exercise__head">
                <h2 className="detail-exercise__name">{name}</h2>
                <span className="muted">{formatWeight(exerciseVolume(e))}</span>
              </div>
              <ol className="detail-sets" aria-label={`Séries de ${name}`}>
                {doneSets(e.sets).map((s, j) => (
                  <li key={j} className="detail-sets__item">
                    <span className="muted">Série {j + 1}</span>
                    <span>
                      {s.weight > 0 ? `${formatWeight(s.weight)} × ${s.reps}` : `${formatCount(s.reps, 'rep')} (poids du corps)`}
                    </span>
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
      </ul>

      {session.notes && session.notes.trim() !== '' && (
        <div className="card detail-notes">
          <h2 className="section-title">Notes</h2>
          <p className="detail-notes__text">{session.notes}</p>
        </div>
      )}

      <div className="stack">
        {/* Suppression immédiate, annulable 5 s par le toast (qui suit vers l'historique). */}
        <button
          type="button"
          className="btn btn--block btn--danger-outline"
          onClick={() => {
            const snapshot = actions.deleteSession(session.id);
            navigate('/historique', { replace: true });
            toast.show({ message: `Séance supprimée : ${session.name}.`, onUndo: snapshot && (() => actions.restore(snapshot)) });
          }}
        >
          Supprimer la séance
        </button>
      </div>
    </section>
  );
}
