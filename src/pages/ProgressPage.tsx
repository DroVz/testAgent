import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import LineChart from '../components/LineChart';
import { useToast } from '../components/Toast';
import {
  DELETED_EXERCISE_NAME,
  NNBSP,
  exerciseName,
  formatDate,
  formatGoalOption,
  formatGoalSaved,
  formatMonthName,
  formatNumber,
  formatOneRepMax,
  formatPeriodSummary,
  formatProgressSentence,
  formatWeekTile,
  formatWeekTileCaption,
  formatWeekTileLabel,
  formatWeight,
  roundOneRepMax,
} from '../lib/format';
import { PROPOSED_GOALS, progressReview, shouldProposeWeeklyGoal, weeklyGoalOf } from '../lib/rhythm';
import {
  completedSessions,
  countedSessions,
  exerciseHistory,
  personalRecords,
  sessionsThisMonth,
  sessionsThisWeek,
  type ExerciseMetrics,
  type RecordValue,
} from '../lib/stats';
import { useAppStore } from '../state/AppStore';

type Metric = keyof ExerciseMetrics;

/** 1RM estimé par défaut (une seule courbe) ; les autres métriques restent un choix secondaire. */
const METRICS: { key: Metric; label: string; format(kg: number): string; round(kg: number): number }[] = [
  { key: 'bestOneRepMax', label: '1RM estimé', format: formatOneRepMax, round: roundOneRepMax },
  { key: 'maxWeight', label: 'Poids max', format: formatWeight, round: (kg) => kg },
  { key: 'volume', label: 'Volume', format: formatWeight, round: (kg) => kg },
];

/** Dernier exercice consulté (préférence locale, non incluse dans l'export). */
export const PROGRESS_EXERCISE_KEY = 'muscutrack:progres-exercice';

function readStoredExercise(): string | null {
  try {
    return globalThis.localStorage?.getItem(PROGRESS_EXERCISE_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Efface la préférence (réinitialisation des données). */
export function clearStoredExercise(): void {
  try {
    globalThis.localStorage?.removeItem(PROGRESS_EXERCISE_KEY);
  } catch {
    // Stockage indisponible : rien à effacer.
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
  const { state, actions } = useAppStore();
  const toast = useToast();
  const completed = useMemo(() => completedSessions(state.sessions), [state.sessions]);
  // Lot 3 : tuiles, bilan et proposition comptent les séances terminées avec au moins une série validée.
  const counted = useMemo(() => countedSessions(state.sessions), [state.sessions]);
  const review = useMemo(() => progressReview(state.sessions), [state.sessions]);
  const goal = weeklyGoalOf(state);
  const week = sessionsThisWeek(state.sessions);
  const proposeGoal = shouldProposeWeeklyGoal(state);
  const weekCaption = formatWeekTileCaption(week, goal);
  // Bilan : la ligne du mois en cours omet le compte (déjà dans la tuile « Ce mois »), le repli le garde.
  const lastWeekLine = review.lastWeek && formatPeriodSummary('Semaine dernière', review.lastWeek);
  const monthLine =
    review.month &&
    formatPeriodSummary(formatMonthName(review.month.monthStart), review.month, { count: !review.month.isCurrent });

  // Exercices ayant au moins une série validée, triés par nom. Par défaut : le premier exercice de la
  // dernière séance terminée (l'exercice principal de la séance, pas un exercice secondaire de fin).
  const { options, defaultId } = useMemo(() => {
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
    // Plusieurs exercices supprimés : numérotés pour rester distincts dans le sélecteur.
    const deleted = ids.filter((id) => !state.exercises.some((e) => e.id === id));
    const label = (id: string) => {
      const n = deleted.indexOf(id);
      if (n < 0) return exerciseName(state.exercises, id);
      return deleted.length > 1 ? `${DELETED_EXERCISE_NAME} (${n + 1})` : DELETED_EXERCISE_NAME;
    };
    const list = ids.map((id) => ({ id, name: label(id) })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const last = completed[completed.length - 1];
    const main = last?.exercises.find((e) => e.sets.some((x) => x.done))?.exerciseId;
    return { options: list, defaultId: main ?? ids[ids.length - 1] };
  }, [completed, state.exercises]);

  const [chosen, setChosen] = useState<string | null>(readStoredExercise);
  const [metric, setMetric] = useState<Metric>('bestOneRepMax');
  const selected = chosen !== null && options.some((o) => o.id === chosen) ? chosen : defaultId;

  const history = useMemo(
    () => (selected ? exerciseHistory(state.sessions, selected) : []),
    [state.sessions, selected],
  );
  const records = useMemo(
    () => (selected ? personalRecords(state.sessions, selected) : {}),
    [state.sessions, selected],
  );
  const data = useMemo(() => history.map((p) => ({ date: p.date, value: p[metric] })), [history, metric]);

  const selectedName = options.find((o) => o.id === selected)?.name ?? '';
  const metricInfo = METRICS.find((m) => m.key === metric) ?? METRICS[0];
  const metricLabel = metricInfo.label;
  // Phrase qui résume : première et dernière valeur de la période, arrondies comme à l'affichage.
  const sentence = formatProgressSentence(data, metricInfo.format, metricInfo.round);

  return (
    <section className="page">
      <h1 className="page__title">Progrès</h1>

      <dl className="stat-grid">
        <div className="stat">
          <dt className="stat__label">Séances</dt>
          <dd className="stat__value">{formatNumber(counted.length)}</dd>
        </div>
        <div className="stat">
          <dt className="stat__label">Cette semaine</dt>
          {goal === undefined ? (
            <dd className="stat__value">{formatNumber(week)}</dd>
          ) : (
            <dd className="stat__body">
              {/* Le texte porte l'information ; les pastilles ne font que la répéter. */}
              <span className="visually-hidden">{formatWeekTileLabel(week, goal)}</span>
              <span className="stat__value" aria-hidden="true">
                {formatWeekTile(week, goal)}
              </span>
              {/* À 0 séance : le repère en légende, pas de pastilles vides. */}
              {week > 0 && (
                <span className="rhythm-dots" aria-hidden="true">
                  {Array.from({ length: goal }, (_, i) => (
                    <span key={i} className={`rhythm-dot${i < week ? ' rhythm-dot--done' : ''}`} />
                  ))}
                </span>
              )}
              {/* « Objectif : 3 » redit le nom accessible ; « Objectif atteint » s'y ajoute. */}
              {weekCaption && (
                <span className="stat__caption" aria-hidden={week === 0 ? true : undefined}>
                  {weekCaption}
                </span>
              )}
            </dd>
          )}
        </div>
        <div className="stat">
          <dt className="stat__label">Ce mois</dt>
          <dd className="stat__value">{formatNumber(sessionsThisMonth(state.sessions))}</dd>
        </div>
      </dl>

      {(lastWeekLine || monthLine) && (
        <div className="progress-review">
          {lastWeekLine && <p className="muted">{lastWeekLine}</p>}
          {monthLine && <p className="muted">{monthLine}</p>}
        </div>
      )}

      {proposeGoal && (
        <div className="card goal-prompt">
          <h2 className="section-title">
            Combien de séances par semaine <span className="goal-prompt__keep">veux-tu</span> viser{NNBSP}?
          </h2>
          <p className="muted goal-prompt__text">Un repère pour toi. Tu pourras le régler à tout moment dans Réglages.</p>
          <div className="goal-chips">
            {PROPOSED_GOALS.map((g) => (
              <button
                key={g}
                type="button"
                className="goal-chip"
                aria-label={formatGoalOption(g)}
                onClick={() => {
                  actions.setWeeklyGoal(g);
                  toast.show({ message: formatGoalSaved(g) });
                }}
              >
                {g}
              </button>
            ))}
          </div>
          <button type="button" className="btn goal-prompt__later" onClick={actions.dismissWeeklyGoalPrompt}>
            Non merci
          </button>
        </div>
      )}

      {!selected ? (
        <div className="empty-state">
          <p className="empty-state__title">Pas encore de progression à afficher</p>
          <p className="muted">
            Termine une séance avec au moins une série validée&nbsp;: tes courbes de poids, de 1RM estimé et de volume
            apparaîtront ici, avec tes records.
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

          {sentence && (
            <div className="progress-summary">
              {/* Le chiffre seul en grand ; la relativisation éventuelle (baisse) dessous, discrète. */}
              <p className="progress-sentence">
                <span className="visually-hidden">{metricLabel} : </span>
                {sentence.headline}
              </p>
              {sentence.note && <p className="muted progress-note">{sentence.note}</p>}
            </div>
          )}

          <div className="card chart-card">
            <LineChart data={data} label={`${metricLabel} — ${selectedName}`} formatValue={metricInfo.format} />
            {history.length === 1 && (
              <p className="muted chart-card__hint">Une seule séance pour l’instant&nbsp;: la courbe se dessinera à la suivante.</p>
            )}
          </div>

          <div className="card">
            <h2 className="section-title">Records personnels</h2>
            <dl className="pr-list">
              <RecordRow label="Meilleur poids" record={records.maxWeight} format={formatWeight} />
              <RecordRow label="Meilleur 1RM estimé" record={records.bestOneRepMax} format={formatOneRepMax} />
              <RecordRow label="Meilleur volume (séance)" record={records.bestVolume} format={formatWeight} />
            </dl>
          </div>
        </>
      )}
    </section>
  );
}

function RecordRow({ label, record, format }: { label: string; record?: RecordValue; format(kg: number): string }) {
  return (
    // Même structure sur chaque ligne : libellé, puis valeur en grand, puis date.
    <div className="pr-list__row">
      <dt className="muted pr-list__label">{label}</dt>
      <dd className="pr-list__value">
        {record ? (
          <>
            <strong className="pr-list__number">{format(record.value)}</strong>
            <span className="muted pr-list__date">{formatDate(record.date)}</span>
          </>
        ) : (
          <span className="muted pr-list__number">—</span>
        )}
      </dd>
    </div>
  );
}
