import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import LineChart from '../components/LineChart';
import { exerciseName, formatDate, formatNumber, formatWeight } from '../lib/format';
import {
  completedSessions,
  exerciseHistory,
  personalRecords,
  sessionsThisMonth,
  sessionsThisWeek,
  type ExerciseMetrics,
  type RecordValue,
} from '../lib/stats';
import { useAppStore } from '../state/AppStore';

type Metric = keyof ExerciseMetrics;

const METRICS: { key: Metric; label: string }[] = [
  { key: 'maxWeight', label: 'Poids max' },
  { key: 'bestOneRepMax', label: '1RM estimé' },
  { key: 'volume', label: 'Volume' },
];

/** Poids arrondi au dixième (le 1RM estimé a souvent beaucoup de décimales). */
const formatKg = (kg: number) => formatWeight(Math.round(kg * 10) / 10);

/** Dernier exercice consulté (préférence locale, non incluse dans l'export). */
export const PROGRESS_EXERCISE_KEY = 'muscutrack:progres-exercice';

function readStoredExercise(): string | null {
  try {
    return globalThis.localStorage?.getItem(PROGRESS_EXERCISE_KEY) ?? null;
  } catch {
    return null;
  }
}

function storeExercise(id: string): void {
  try {
    globalThis.localStorage?.setItem(PROGRESS_EXERCISE_KEY, id);
  } catch {
    // Préférence non essentielle : on ignore.
  }
}

/** Progression par exercice et statistiques globales (/progres). */
export default function ProgressPage() {
  const { state } = useAppStore();
  const completed = useMemo(() => completedSessions(state.sessions), [state.sessions]);

  // Exercices ayant au moins une série validée, triés par nom ; le plus récemment travaillé sert de défaut.
  const { options, mostRecent } = useMemo(() => {
    const ids: string[] = [];
    for (const s of completed) {
      for (const e of s.exercises) {
        if (e.sets.some((x) => x.done)) {
          const at = ids.indexOf(e.exerciseId);
          if (at >= 0) ids.splice(at, 1);
          ids.push(e.exerciseId);
        }
      }
    }
    const list = ids
      .map((id) => ({ id, name: exerciseName(state.exercises, id) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return { options: list, mostRecent: ids[ids.length - 1] };
  }, [completed, state.exercises]);

  const [chosen, setChosen] = useState<string | null>(readStoredExercise);
  const [metric, setMetric] = useState<Metric>('maxWeight');
  const selected = chosen !== null && options.some((o) => o.id === chosen) ? chosen : mostRecent;

  const history = useMemo(
    () => (selected ? exerciseHistory(state.sessions, selected) : []),
    [state.sessions, selected],
  );
  const records = useMemo(
    () => (selected ? personalRecords(state.sessions, selected) : {}),
    [state.sessions, selected],
  );
  const data = useMemo(() => history.map((p) => ({ date: p.date, value: p[metric] })), [history, metric]);

  const selectedName = selected ? exerciseName(state.exercises, selected) : '';
  const metricLabel = METRICS.find((m) => m.key === metric)?.label ?? '';

  return (
    <section className="page">
      <h1 className="page__title">Progrès</h1>

      <dl className="stat-grid">
        <div className="stat">
          <dt className="stat__label">Séances</dt>
          <dd className="stat__value">{formatNumber(completed.length)}</dd>
        </div>
        <div className="stat">
          <dt className="stat__label">Cette semaine</dt>
          <dd className="stat__value">{formatNumber(sessionsThisWeek(state.sessions))}</dd>
        </div>
        <div className="stat">
          <dt className="stat__label">Ce mois</dt>
          <dd className="stat__value">{formatNumber(sessionsThisMonth(state.sessions))}</dd>
        </div>
      </dl>

      {!selected ? (
        <div className="empty-state">
          <p className="empty-state__title">Pas encore de progression à afficher</p>
          <p className="muted">
            Terminez une séance avec au moins une série validée : vos courbes de poids, de 1RM estimé et de volume
            apparaîtront ici, avec vos records.
          </p>
          <Link to="/seances" className="btn btn--primary">
            Aller aux séances
          </Link>
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="progress-exercise" className="field__label">
              Exercice
            </label>
            <select
              id="progress-exercise"
              className="input"
              value={selected}
              onChange={(e) => {
                setChosen(e.target.value);
                storeExercise(e.target.value);
              }}
            >
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div className="segmented" role="group" aria-label="Métrique">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                className="segmented__btn"
                aria-pressed={metric === m.key}
                onClick={() => setMetric(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="card chart-card">
            <LineChart data={data} label={`${metricLabel} — ${selectedName}`} formatValue={formatKg} />
            {history.length === 1 && (
              <p className="muted chart-card__hint">Une seule séance pour l’instant : la courbe se dessinera à la suivante.</p>
            )}
          </div>

          <div className="card">
            <h2 className="section-title">Records personnels</h2>
            <dl className="pr-list">
              <RecordRow label="Meilleur poids" record={records.maxWeight} />
              <RecordRow label="Meilleur 1RM estimé" record={records.bestOneRepMax} />
              <RecordRow label="Meilleur volume (séance)" record={records.bestVolume} />
            </dl>
          </div>
        </>
      )}
    </section>
  );
}

function RecordRow({ label, record }: { label: string; record?: RecordValue }) {
  return (
    <div className="pr-list__row">
      <dt className="muted">{label}</dt>
      <dd className="pr-list__value">
        {record ? (
          <>
            <strong>{formatKg(record.value)}</strong>{' '}
            <span className="muted pr-list__date">{formatDate(record.date)}</span>
          </>
        ) : (
          <span className="muted">—</span>
        )}
      </dd>
    </div>
  );
}
