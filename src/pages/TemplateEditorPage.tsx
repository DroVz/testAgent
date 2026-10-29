import { ArrowDown, ArrowUp, ChevronLeft, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import ExercisePicker from '../components/ExercisePicker';
import NumberField from '../components/NumberField';
import { ToastHost, useToast } from '../components/Toast';
import { COLON, exerciseName, inSentence } from '../lib/format';
import { MAX_REPS, MAX_WEIGHT } from '../lib/session';
import { createTemplateExercise } from '../lib/templates';
import type { Template, TemplateExercise } from '../lib/types';
import { insertAt } from '../lib/undo';
import { useAppStore } from '../state/AppStore';

/** Création (/seances/nouvelle) et modification (/seances/:id) d'une séance type. */
export default function TemplateEditorPage() {
  const { id } = useParams();
  const { state } = useAppStore();
  const template = id ? state.templates.find((t) => t.id === id) : undefined;

  if (id && !template) {
    return (
      <section className="page">
        <h1 className="page__title">Séance type introuvable</h1>
        <Link to="/seances" className="btn">
          Retour aux séances
        </Link>
      </section>
    );
  }
  // `key` : repart d'un brouillon neuf si on passe d'une séance type à une autre.
  return <Editor key={template?.id ?? 'new'} template={template} />;
}

function Editor({ template }: { template?: Template }) {
  const { state, actions } = useAppStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(template?.name ?? '');
  const [exercises, setExercises] = useState<TemplateExercise[]>(() => template?.exercises.map((e) => ({ ...e })) ?? []);
  const [nameError, setNameError] = useState(false);
  const [picking, setPicking] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [initial] = useState(() => JSON.stringify({ name: template?.name ?? '', exercises: template?.exercises ?? [] }));
  const dirty = JSON.stringify({ name, exercises }) !== initial;

  // Le retrait se fait sur le brouillon : son toast n'a plus de sens une fois le constructeur quitté.
  const toastId = useRef<number | null>(null);
  const dismissToast = toast.dismiss;
  useEffect(
    () => () => {
      if (toastId.current !== null) dismissToast(toastId.current);
    },
    [dismissToast],
  );

  /** Retrait immédiat, annulable 5 s : l'exercice revient à sa place, avec ses objectifs. */
  const removeExercise = (index: number, label: string) => {
    const removed = exercises[index];
    if (!removed) return;
    setExercises((list) => list.filter((_, j) => j !== index));
    toastId.current = toast.show({
      message: `Exercice retiré${COLON} ${inSentence(label)}.`,
      onUndo: () => setExercises((list) => insertAt(list, index, removed)),
    });
  };

  const cancel = () => {
    if (dirty) setConfirmLeave(true);
    else navigate('/seances');
  };

  const patch = (index: number, p: Partial<TemplateExercise>) =>
    setExercises((list) => list.map((e, i) => (i === index ? { ...e, ...p } : e)));

  const move = (index: number, delta: -1 | 1) =>
    setExercises((list) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const save = () => {
    if (name.trim() === '') {
      setNameError(true);
      return;
    }
    if (template) actions.updateTemplate(template.id, { name, exercises });
    else actions.createTemplate({ name, exercises });
    navigate('/seances');
  };

  return (
    <section className="page editor">
      {/* « Annuler » : lien discret en haut à gauche (confirmation s'il y a des modifications). */}
      <button type="button" className="back-link editor__cancel" onClick={cancel}>
        <ChevronLeft size={20} aria-hidden="true" />
        Annuler
      </button>
      <h1 className="page__title">{template ? 'Modifier la séance type' : 'Nouvelle séance type'}</h1>

      <div className="field">
        <label htmlFor="template-name" className="field__label">
          Nom
        </label>
        <input
          id="template-name"
          className="input"
          value={name}
          maxLength={60}
          placeholder="ex. Push, Jambes…"
          aria-invalid={nameError}
          aria-describedby={nameError ? 'template-name-error' : undefined}
          onChange={(e) => {
            setName(e.target.value);
            if (e.target.value.trim() !== '') setNameError(false);
          }}
        />
        {nameError && (
          <span id="template-name-error" className="field__error" role="alert">
            Donne un nom à la séance.
          </span>
        )}
      </div>

      {exercises.length === 0 && <p className="muted">Ajoute les exercices de cette séance.</p>}

      <ol className="editor-list">
        {exercises.map((te, i) => {
          const label = exerciseName(state.exercises, te.exerciseId);
          return (
            <li key={`${te.exerciseId}-${i}`} className="card editor-item">
              <div className="editor-item__head">
                <h2 className="editor-item__name">{label}</h2>
                <div className="editor-item__tools">
                  <button type="button" className="icon-btn" aria-label={`Monter ${label}`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={20} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Descendre ${label}`}
                    disabled={i === exercises.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={20} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Retirer ${label}`}
                    onClick={() => removeExercise(i, label)}
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="editor-item__fields">
                <NumberField label="Séries" showLabel kind="integer" step={1} min={1} max={20} value={te.targetSets} onChange={(v) => patch(i, { targetSets: v })} />
                <NumberField label="Reps" showLabel kind="integer" step={1} max={MAX_REPS} value={te.targetReps} onChange={(v) => patch(i, { targetReps: v })} />
                <NumberField
                  label="Poids (kg)"
                  showLabel
                  step={2.5}
                  max={MAX_WEIGHT}
                  value={te.targetWeight ?? 0}
                  onChange={(v) => patch(i, { targetWeight: v > 0 ? v : undefined })}
                />
                <NumberField label="Repos (s)" showLabel kind="integer" step={15} max={900} value={te.restSeconds} onChange={(v) => patch(i, { restSeconds: v })} />
              </div>
            </li>
          );
        })}
      </ol>

      <button type="button" className="btn btn--block editor__add" onClick={() => setPicking(true)}>
        <Plus size={20} aria-hidden="true" />
        Ajouter un exercice
      </button>

      {/* Barre d'action fixe en bas : toast éventuel au-dessus, puis l'action principale (56 px). */}
      <div className="editor-dock">
        <ToastHost placement="inline" />
        <button type="button" className="btn btn--primary btn--lg btn--block" onClick={save}>
          Enregistrer la séance
        </button>
      </div>

      <ConfirmDialog
        open={confirmLeave}
        title="Abandonner les modifications ?"
        message="Tes modifications non enregistrées seront perdues."
        confirmLabel="Abandonner"
        cancelLabel="Continuer l’édition"
        danger
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => navigate('/seances')}
      />

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onSelect={(exerciseId) => {
            setExercises((list) => [...list, createTemplateExercise(exerciseId)]);
            setPicking(false);
          }}
        />
      )}
    </section>
  );
}
