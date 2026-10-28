import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import { exerciseName } from '../lib/format';
import type { Template } from '../lib/types';
import { useAppStore } from '../state/AppStore';

const PREVIEW_COUNT = 3;

export default function TemplatesPage() {
  const { state, actions } = useAppStore();
  const navigate = useNavigate();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Template | null>(null);
  const [resumeAsk, setResumeAsk] = useState(false);
  const active = state.activeSession;

  const start = (templateId?: string) => {
    if (active) {
      setResumeAsk(true);
      return;
    }
    if (templateId) actions.startSessionFromTemplate(templateId);
    else actions.startFreeSession();
    navigate('/seance');
  };

  const preview = (t: Template) => {
    const names = t.exercises.slice(0, PREVIEW_COUNT).map((e) => exerciseName(state.exercises, e.exerciseId));
    const rest = t.exercises.length - PREVIEW_COUNT;
    return names.join(' · ') + (rest > 0 ? ` +${rest}` : '');
  };

  const empty = state.templates.length === 0;

  return (
    <section className="page">
      <h1 className="page__title">Séances</h1>

      {empty ? (
        <div className="empty-state">
          <p className="empty-state__title">Aucune séance type pour l’instant</p>
          <p className="muted">
            Créez une séance type (ex. « Push », « Jambes ») avec vos exercices et objectifs, puis lancez-la en un
            tap à la salle. Vous pouvez aussi démarrer une séance libre.
          </p>
        </div>
      ) : (
        <ul className="template-list">
          {state.templates.map((t) => (
            <li key={t.id} className="card template-card">
              <div className="template-card__head">
                <div className="template-card__info">
                  <h2 className="template-card__name">{t.name}</h2>
                  <p className="muted template-card__meta">
                    {t.exercises.length} exercice{t.exercises.length > 1 ? 's' : ''}
                  </p>
                  {t.exercises.length > 0 && <p className="muted template-card__preview">{preview(t)}</p>}
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Options de ${t.name}`}
                  aria-expanded={menuFor === t.id}
                  onClick={() => setMenuFor(menuFor === t.id ? null : t.id)}
                >
                  ⋯
                </button>
              </div>
              {menuFor === t.id && (
                <div className="template-card__menu">
                  <button type="button" className="btn" onClick={() => navigate(`/seances/${t.id}`)}>
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      actions.duplicateTemplate(t.id);
                      setMenuFor(null);
                    }}
                  >
                    Dupliquer
                  </button>
                  <button type="button" className="btn btn--danger-outline" onClick={() => setToDelete(t)}>
                    Supprimer
                  </button>
                </div>
              )}
              <button
                type="button"
                className="btn btn--primary btn--lg btn--block"
                aria-label={`Démarrer ${t.name}`}
                onClick={() => start(t.id)}
              >
                Démarrer
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="stack">
        <Link to="/seances/nouvelle" className={`btn btn--block${empty ? ' btn--primary btn--lg' : ''}`}>
          + Nouvelle séance type
        </Link>
        <button type="button" className="btn btn--block" onClick={() => start()}>
          Séance libre
        </button>
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title="Supprimer la séance type ?"
        message={toDelete && `« ${toDelete.name} » sera supprimée. L’historique de vos séances est conservé.`}
        confirmLabel="Supprimer"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) actions.deleteTemplate(toDelete.id);
          setToDelete(null);
          setMenuFor(null);
        }}
      />

      <ConfirmDialog
        open={resumeAsk}
        title="Une séance est déjà en cours"
        message={active && `Terminez ou abandonnez « ${active.name} » avant d’en démarrer une autre.`}
        confirmLabel="Reprendre la séance"
        onCancel={() => setResumeAsk(false)}
        onConfirm={() => {
          setResumeAsk(false);
          navigate('/seance');
        }}
      />
    </section>
  );
}
