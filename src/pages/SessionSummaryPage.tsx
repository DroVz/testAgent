import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  exerciseName,
  formatDuration,
  formatNumber,
  formatOneRepMax,
  formatRecordSentence,
  formatSessionSummary,
  formatSetsSummary,
  formatMilestone,
  formatWeekLine,
  formatWeight,
} from '../lib/format';
import { sessionRank, weekCountAtSession, weeklyGoalOf } from '../lib/rhythm';
import {
  countDoneSets,
  detectNewRecords,
  sessionDurationMs,
  sessionVolume,
  strongestRecords,
  type RecordType,
} from '../lib/stats';
import { useAppStore } from '../state/AppStore';

/** Précision du record dans la phrase (le poids max est le record « par défaut »). */
const RECORD_KINDS: Record<RecordType, string | undefined> = {
  maxWeight: undefined,
  bestOneRepMax: '1RM estimé',
  bestVolume: 'volume',
};

/** Résumé d'une séance terminée (/resume/:id). */
export default function SessionSummaryPage() {
  const { id } = useParams();
  const { state, actions } = useAppStore();
  const navigate = useNavigate();
  const [applied, setApplied] = useState(false);
  const session = state.sessions.find((s) => s.id === id);
  // Une seule ligne par exercice (le record le plus parlant) : un « ! » par exercice, pas plus.
  const records = useMemo(
    () => (session ? strongestRecords(detectNewRecords(session, state.sessions)) : []),
    [session, state.sessions],
  );

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

  // Lot 3 : compte de la semaine au moment de cette séance (semaine en cours seulement), puis jalon.
  // Le rang ne dépend pas de la date du jour : le récap rouvert reste identique.
  const weekAtSession = weekCountAtSession(state.sessions, session.id);
  const weekLine = weekAtSession === undefined ? undefined : formatWeekLine(weekAtSession, weeklyGoalOf(state));
  const rank = sessionRank(state.sessions, session.id);
  const milestone = rank === undefined ? undefined : formatMilestone(rank);

  const template = session.templateId ? state.templates.find((t) => t.id === session.templateId) : undefined;

  return (
    <section className="page summary">
      {/* Titre = nom de la séance ; la phrase dit déjà « Séance terminée ». */}
      <h1 className="page__title">{session.name}</h1>
      <p className="summary-sentence">
        {formatSessionSummary(session.exercises.length, countDoneSets(session), sessionVolume(session))}
      </p>
      {(weekLine || milestone) && (
        <div className="summary-rhythm">
          {weekLine && <p className="muted summary-rhythm__line">{weekLine}</p>}
          {milestone && <p className="muted summary-rhythm__line">{milestone}</p>}
        </div>
      )}

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
            {records.map((r) => {
              // 1RM : même arrondi à 0,5 kg que dans Progrès (une seule fonction de formatage).
              const format = r.type === 'bestOneRepMax' ? formatOneRepMax : formatWeight;
              return (
                <li key={`${r.exerciseId}-${r.type}`} className="records__item">
                  {formatRecordSentence(exerciseName(state.exercises, r.exerciseId), format(r.value), RECORD_KINDS[r.type])}{' '}
                  <span className="muted">(avant {format(r.previous)})</span>
                </li>
              );
            })}
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

      {/* Action secondaire (contour), au-dessus du bas d'écran. */}
      {template &&
        (applied ? (
          <p className="muted summary__secondary" role="status">
            Séance type « {template.name} » mise à jour.
          </p>
        ) : (
          <button
            type="button"
            className="btn btn--block summary__secondary"
            onClick={() => {
              actions.applySessionToTemplate(session.id);
              setApplied(true);
            }}
          >
            Mettre à jour la séance type
          </button>
        ))}

      {/* Action principale collée en bas, au-dessus de la barre d'onglets (comme en séance). */}
      <div className="summary-dock">
        <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => navigate('/progres')}>
          Voir mes progrès
        </button>
      </div>
    </section>
  );
}
