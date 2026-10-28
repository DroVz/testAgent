import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { exerciseName, formatDuration, formatNumber, formatSetsSummary, formatWeight } from '../lib/format';
import { countDoneSets, detectNewRecords, sessionDurationMs, sessionVolume, type RecordType } from '../lib/stats';
import { useAppStore } from '../state/AppStore';

const RECORD_LABELS: Record<RecordType, string> = {
  maxWeight: 'Poids max',
  bestOneRepMax: '1RM estimé',
  bestVolume: 'Volume',
};

/** Résumé d'une séance terminée (/resume/:id). */
export default function SessionSummaryPage() {
  const { id } = useParams();
  const { state, actions } = useAppStore();
  const navigate = useNavigate();
  const [applied, setApplied] = useState(false);
  const session = state.sessions.find((s) => s.id === id);
  const records = useMemo(() => (session ? detectNewRecords(session, state.sessions) : []), [session, state.sessions]);

  if (!session) {
    return (
      <section className="page">
        <h1 className="page__title">Séance introuvable</h1>
        <Link to="/seances" className="btn">
          Retour aux séances
        </Link>
      </section>
    );
  }

  const template = session.templateId ? state.templates.find((t) => t.id === session.templateId) : undefined;

  return (
    <section className="page">
      <h1 className="page__title">Séance terminée</h1>
      <p className="muted">{session.name}</p>

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

      {records.length > 0 && (
        <div className="card records">
          <h2 className="section-title">Nouveaux records</h2>
          <ul className="records__list">
            {records.map((r) => (
              <li key={`${r.exerciseId}-${r.type}`} className="records__item">
                <strong>{exerciseName(state.exercises, r.exerciseId)}</strong> — {RECORD_LABELS[r.type]} :{' '}
                {formatWeight(r.value)} <span className="muted">(avant {formatWeight(r.previous)})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="summary-list">
        {session.exercises.map((e, i) => (
          <li key={`${e.exerciseId}-${i}`} className="summary-list__item">
            <span>{exerciseName(state.exercises, e.exerciseId)}</span>
            <span className="muted">{formatSetsSummary(e.sets)}</span>
          </li>
        ))}
      </ul>

      <div className="stack">
        {template &&
          (applied ? (
            <p className="muted" role="status">
              Séance type « {template.name} » mise à jour.
            </p>
          ) : (
            <button
              type="button"
              className="btn btn--block"
              onClick={() => {
                actions.applySessionToTemplate(session.id);
                setApplied(true);
              }}
            >
              Mettre à jour la séance type avec ces poids
            </button>
          ))}
        <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => navigate('/historique')}>
          Terminé
        </button>
      </div>
    </section>
  );
}
