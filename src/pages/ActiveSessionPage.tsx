import { Check, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import ExercisePicker from '../components/ExercisePicker';
import NumberField from '../components/NumberField';
import RestTimer from '../components/RestTimer';
import { exerciseName, formatClock, formatSetsSummary, restSecondsFor } from '../lib/format';
import { MAX_REPS, MAX_WEIGHT } from '../lib/session';
import { loadRestEndsAt, saveRestEndsAt } from '../lib/restTimer';
import { countDoneSets, lastPerformance, sessionDurationMs, type LastPerformance } from '../lib/stats';
import { useAppStore } from '../state/AppStore';

type Dialog =
  | { kind: 'finish' }
  | { kind: 'empty' }
  | { kind: 'abandon' }
  | { kind: 'removeExercise'; index: number; name: string };

/** Écran plein de la séance en cours (/seance). */
export default function ActiveSessionPage() {
  const { state, actions } = useAppStore();
  const navigate = useNavigate();
  const session = state.activeSession;
  const [now, setNow] = useState(() => Date.now());
  // Le repos en cours est persisté (stockage de session) : il survit à un rechargement ou à un détour.
  const [restEndsAt, setRestEndsAt] = useState<number | null>(() => loadRestEndsAt(session?.id));
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const sessionId = session?.id;
  useEffect(() => {
    if (sessionId) saveRestEndsAt(sessionId, restEndsAt);
  }, [sessionId, restEndsAt]);

  // « Dernière fois » : ne dépend que de l'historique et de la liste des exercices, pas des saisies en cours.
  const exerciseIdsKey = session?.exercises.map((e) => e.exerciseId).join('|') ?? '';
  const lastByExercise = useMemo(() => {
    const map = new Map<string, LastPerformance | undefined>();
    for (const id of exerciseIdsKey ? exerciseIdsKey.split('|') : []) {
      if (!map.has(id)) map.set(id, lastPerformance(state.sessions, id));
    }
    return map;
  }, [state.sessions, exerciseIdsKey]);

  if (!session) return <Navigate to="/seances" replace />;

  const toggleSet = (exIdx: number, setIdx: number, done: boolean) => {
    actions.setSetDone(exIdx, setIdx, done);
    if (done) {
      const rest = restSecondsFor(session, state.templates, session.exercises[exIdx].exerciseId);
      if (rest > 0) setRestEndsAt(Date.now() + rest * 1000);
    }
  };

  const askFinish = () => setDialog({ kind: countDoneSets(session) === 0 ? 'empty' : 'finish' });

  const finish = () => {
    const id = session.id; // mémorisé avant que la séance ne quitte activeSession
    saveRestEndsAt(id, null);
    actions.finishSession();
    navigate(`/resume/${id}`, { replace: true });
  };

  const abandon = () => {
    saveRestEndsAt(session.id, null);
    actions.abandonSession();
    navigate('/seances', { replace: true });
  };

  return (
    <section className={`page session${restEndsAt !== null ? ' session--with-timer' : ''}`}>
      <header className="session__header">
        <div>
          <h1 className="session__name">{session.name}</h1>
          <p className="session__clock">
            <span className="visually-hidden">Durée de la séance : </span>
            {formatClock(sessionDurationMs(session, new Date(now)))}
          </p>
        </div>
        <button type="button" className="btn" onClick={askFinish}>
          Terminer la séance
        </button>
      </header>

      {session.exercises.length === 0 && (
        <p className="muted">Ajoute un premier exercice pour commencer.</p>
      )}

      {session.exercises.map((ex, exIdx) => {
        const name = exerciseName(state.exercises, ex.exerciseId);
        const last = lastByExercise.get(ex.exerciseId);
        return (
          <article key={`${ex.exerciseId}-${exIdx}`} className="card session-exercise" aria-label={name}>
            <div className="session-exercise__head">
              <h2 className="session-exercise__name">{name}</h2>
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                aria-label={`Retirer ${name}`}
                onClick={() => setDialog({ kind: 'removeExercise', index: exIdx, name })}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            {last && <p className="muted session-exercise__last">Dernière fois : {formatSetsSummary(last.sets)}</p>}

            <div className="set-table" role="table" aria-label={`Séries de ${name}`}>
              <div className="set-row set-row--head" role="row">
                <span role="columnheader">#</span>
                <span role="columnheader">kg</span>
                <span role="columnheader">Reps</span>
                <span role="columnheader">
                  <span className="visually-hidden">Validée</span>
                </span>
                <span role="columnheader">
                  <span className="visually-hidden">Supprimer</span>
                </span>
              </div>
              {ex.sets.map((s, setIdx) => {
                const n = setIdx + 1;
                return (
                  <div key={setIdx} className={`set-row${s.done ? ' set-row--done' : ''}`} role="row">
                    <span className="set-row__num" role="cell">
                      {n}
                    </span>
                    <span role="cell">
                      <NumberField
                        label={`Poids série ${n} – ${name}`}
                        max={MAX_WEIGHT}
                        value={s.weight}
                        onChange={(weight) => actions.updateSet(exIdx, setIdx, { weight })}
                      />
                    </span>
                    <span role="cell">
                      <NumberField
                        label={`Reps série ${n} – ${name}`}
                        kind="integer"
                        max={MAX_REPS}
                        value={s.reps}
                        onChange={(reps) => actions.updateSet(exIdx, setIdx, { reps })}
                      />
                    </span>
                    <span role="cell">
                      <button
                        type="button"
                        className="check-btn"
                        aria-pressed={s.done}
                        aria-label={`Valider la série ${n}`}
                        onClick={() => toggleSet(exIdx, setIdx, !s.done)}
                      >
                        <Check size={24} aria-hidden="true" />
                      </button>
                    </span>
                    <span role="cell">
                      <button
                        type="button"
                        className="icon-btn icon-btn--small"
                        aria-label={`Supprimer la série ${n}`}
                        onClick={() => actions.removeSet(exIdx, setIdx)}
                      >
                        <X size={18} aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
            <button type="button" className="btn btn--block" onClick={() => actions.addSet(exIdx)}>
              <Plus size={20} aria-hidden="true" />
              Ajouter une série
            </button>
          </article>
        );
      })}

      <div className="stack">
        <button type="button" className="btn btn--block btn--lg" onClick={() => setPicking(true)}>
          <Plus size={20} aria-hidden="true" />
          Ajouter un exercice
        </button>
        <button type="button" className="btn btn--block btn--danger-outline" onClick={() => setDialog({ kind: 'abandon' })}>
          Abandonner la séance
        </button>
      </div>

      {restEndsAt !== null && (
        <RestTimer
          endsAt={restEndsAt}
          onAdjust={(sec) => setRestEndsAt((end) => (end === null ? end : Math.max(Date.now(), end + sec * 1000)))}
          onDismiss={() => setRestEndsAt(null)}
        />
      )}

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onSelect={(id) => {
            actions.addSessionExercise(id);
            setPicking(false);
          }}
        />
      )}

      <ConfirmDialog
        open={dialog?.kind === 'finish'}
        title="Terminer la séance ?"
        message="Les séries non validées seront ignorées."
        confirmLabel="Terminer la séance"
        cancelLabel="Continuer"
        onCancel={() => setDialog(null)}
        onConfirm={finish}
      />
      <ConfirmDialog
        open={dialog?.kind === 'empty'}
        title="Aucune série validée"
        message="Une séance sans série validée ne peut pas être enregistrée. Tu veux l’abandonner ?"
        confirmLabel="Abandonner la séance"
        cancelLabel="Continuer"
        danger
        onCancel={() => setDialog(null)}
        onConfirm={abandon}
      />
      <ConfirmDialog
        open={dialog?.kind === 'abandon'}
        title="Abandonner la séance ?"
        message="Rien ne sera enregistré."
        confirmLabel="Abandonner"
        cancelLabel="Continuer"
        danger
        onCancel={() => setDialog(null)}
        onConfirm={abandon}
      />
      <ConfirmDialog
        open={dialog?.kind === 'removeExercise'}
        title="Retirer l’exercice ?"
        message={dialog?.kind === 'removeExercise' && `« ${dialog.name} » et ses séries seront retirés de la séance.`}
        confirmLabel="Retirer"
        danger
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          if (dialog?.kind === 'removeExercise') actions.removeSessionExercise(dialog.index);
          setDialog(null);
        }}
      />
    </section>
  );
}
