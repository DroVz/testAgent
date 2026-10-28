import { Ellipsis, Plus, Settings } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { exerciseName, formatCount, formatEstimatedDuration, formatLastDone } from '../lib/format';
import { suggestedTemplateId, templateLastDoneAt } from '../lib/stats';
import { estimateTemplateMinutes } from '../lib/templates';
import type { Template } from '../lib/types';
import { useAppStore } from '../state/AppStore';

const PREVIEW_COUNT = 3;

export default function TemplatesPage() {
  const { state, actions } = useAppStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [resumeAsk, setResumeAsk] = useState(false);
  const active = state.activeSession;
  // Une seule action accent : « Démarrer la séance » sur la séance type la plus probable.
  const suggested = useMemo(() => suggestedTemplateId(state.templates, state.sessions), [state.templates, state.sessions]);
  // La carte suggérée (qui porte l'action principale) est affichée en premier ; l'ordre enregistré
  // des autres séances types ne change pas.
  const ordered = useMemo(
    () => [...state.templates].sort((a, b) => Number(b.id === suggested) - Number(a.id === suggested)),
    [state.templates, suggested],
  );

  /** Suppression immédiate, annulable 5 s par le toast. */
  const remove = (t: Template) => {
    const snapshot = actions.deleteTemplate(t.id);
    setMenuFor(null);
    toast.show({ message: `Séance supprimée : ${t.name}.`, onUndo: snapshot && (() => actions.restore(snapshot)) });
  };

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
      <header className="page-header">
        <h1 className="page__title">Séances</h1>
        {/* Réglages (export, import…) : bouton nommé et visible, pas un menu caché. */}
        <Link to="/reglages" className="btn btn--ghost page-header__action">
          <Settings size={20} aria-hidden="true" />
          Réglages
        </Link>
      </header>

      {empty ? (
        <div className="empty-state">
          <p className="empty-state__title">Aucune séance pour l’instant.</p>
          <p className="muted">Crée la première en 1 minute, ou démarre une séance libre.</p>
        </div>
      ) : (
        <ul className="template-list">
          {ordered.map((t) => {
            const featured = t.id === suggested;
            const minutes = estimateTemplateMinutes(t);
            return (
              <li key={t.id} className={`card template-card${featured ? ' template-card--featured' : ''}`}>
                <div className="template-card__head">
                  <div className="template-card__info">
                    {featured && <p className="template-card__badge">Suggérée</p>}
                    <h2 className="template-card__name">{t.name}</h2>
                    <p className="muted template-card__meta">
                      {formatCount(t.exercises.length, 'exercice')}
                      {minutes > 0 && ` · ${formatEstimatedDuration(minutes)}`}
                    </p>
                    <p className="muted template-card__meta">
                      {formatLastDone(templateLastDoneAt(state.sessions, t.id))}
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
                    <Ellipsis size={24} aria-hidden="true" />
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
                    <button type="button" className="btn btn--danger-outline" onClick={() => remove(t)}>
                      Supprimer
                    </button>
                  </div>
                )}
                {featured ? (
                  <button
                    type="button"
                    className="btn btn--primary btn--lg btn--block"
                    aria-label={`Démarrer la séance ${t.name}`}
                    onClick={() => start(t.id)}
                  >
                    Démarrer la séance
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--block"
                    aria-label={`Démarrer la séance ${t.name}`}
                    onClick={() => start(t.id)}
                  >
                    Démarrer
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="stack">
        <Link to="/seances/nouvelle" className={`btn btn--block${empty ? ' btn--primary btn--lg' : ''}`}>
          <Plus size={20} aria-hidden="true" />
          Créer une séance
        </Link>
        <button type="button" className="btn btn--block" onClick={() => start()}>
          Séance libre
        </button>
      </div>

      <ConfirmDialog
        open={resumeAsk}
        title="Une séance est déjà en cours"
        message={active && `Termine ou abandonne « ${active.name} » avant d’en démarrer une autre.`}
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
