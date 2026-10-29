import { Check, ChevronLeft } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ToastHost, useToast } from '../components/Toast';
import { COLON, exerciseName, formatCount, formatEstimatedDuration, formatWeight } from '../lib/format';
import { BAR_WEIGHT, STARTER_PROGRAMS, buildProgramTemplates, isProgramAlreadyAdded } from '../lib/programs';
import { LOAD_STEP_KG } from '../lib/progression';
import { estimateTemplateMinutes } from '../lib/templates';
import { useAppStore } from '../state/AppStore';

/** État transmis à /seances après un ajout : id du toast à fermer si une séance démarre. */
export interface ProgramAddedState {
  programToastId: number;
}

/** Programmes de départ (/seances/programmes) : choix guidé, sans questionnaire (lot 2). */
export default function ProgramsPage() {
  const { state, actions } = useAppStore();
  const navigate = useNavigate();
  const toast = useToast();
  // Rien de présélectionné : le choix vient de l'utilisateur.
  const [selected, setSelected] = useState<string | null>(null);
  const added = useRef(false);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const names = state.templates.map((t) => t.name);

  const add = () => {
    const program = STARTER_PROGRAMS.find((p) => p.id === selected);
    // Tap en double : une seule création.
    if (!program || added.current) return;
    added.current = true;
    const templates = buildProgramTemplates(program, names);
    const ids = templates.map((t) => t.id);
    actions.addTemplates(templates);
    const programToastId = toast.show({
      message: `Programme ajouté${COLON} ${program.name} (${formatCount(templates.length, 'séance')}).`,
      undoLabel: 'Annuler l’ajout du programme',
      onUndo: () => actions.removeTemplates(ids),
    });
    navigate('/seances', { replace: true, state: { programToastId } satisfies ProgramAddedState });
  };

  // Groupe de boutons radio : les flèches déplacent le choix (une seule carte dans l'ordre de tabulation).
  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    e.preventDefault();
    const next = (index + delta + STARTER_PROGRAMS.length) % STARTER_PROGRAMS.length;
    setSelected(STARTER_PROGRAMS[next].id);
    cards.current[next]?.focus();
  };
  const focusable = selected ?? STARTER_PROGRAMS[0].id;

  return (
    <section className="page editor programs">
      <Link to="/seances" className="back-link editor__cancel">
        <ChevronLeft size={20} aria-hidden="true" />
        Retour aux séances
      </Link>
      <h1 className="page__title">Programmes de départ</h1>
      <p className="muted programs__intro">
        Choisis un programme. Ses séances s’ajoutent à ta liste, et tu pourras les modifier.
      </p>

      <div className="programs__list" role="radiogroup" aria-label="Programmes de départ">
        {STARTER_PROGRAMS.map((program, index) => {
          const checked = program.id === selected;
          const nameId = `program-${program.id}-name`;
          const detailsId = `program-${program.id}-details`;
          return (
            <button
              key={program.id}
              ref={(el) => {
                cards.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-labelledby={nameId}
              aria-describedby={detailsId}
              tabIndex={program.id === focusable ? 0 : -1}
              className={`card program-card${checked ? ' program-card--checked' : ''}`}
              onClick={() => setSelected(program.id)}
              onKeyDown={(e) => onKeyDown(e, index)}
            >
              <span className="program-card__head">
                <span id={nameId} className="program-card__name">
                  {program.name}
                </span>
                {checked && (
                  <span className="program-card__state">
                    <Check size={20} strokeWidth={2.5} aria-hidden="true" />
                    Choisi
                  </span>
                )}
              </span>
              <span id={detailsId} className="program-card__details">
                <span className="program-card__audience">{program.audience}</span>
                {program.templates.map((t) => (
                  <span key={t.name} className="program-card__template muted">
                    <span className="program-card__template-name">
                      {t.name} · {formatEstimatedDuration(estimateTemplateMinutes(t))}
                    </span>
                    <span>{t.exercises.map((e) => exerciseName(state.exercises, e.exerciseId)).join(' · ')}</span>
                  </span>
                ))}
                {isProgramAlreadyAdded(program, names) && (
                  <span className="program-card__already muted">Déjà dans tes séances.</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="muted programs__note">
        Les charges de départ sont légères{COLON} {formatWeight(BAR_WEIGHT)}, c’est la barre seule. Quand tu réussis
        toutes tes séries, l’app te propose {formatWeight(LOAD_STEP_KG)} de plus.
      </p>

      {/* Barre d'action fixe en bas, comme le constructeur : toast éventuel au-dessus, puis l'action principale. */}
      <div className="editor-dock">
        <ToastHost placement="inline" />
        <button type="button" className="btn btn--primary btn--lg btn--block" disabled={selected === null} onClick={add}>
          Ajouter ce programme
        </button>
      </div>
    </section>
  );
}
