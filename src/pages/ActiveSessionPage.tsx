import { Check, ChevronLeft, ChevronRight, Ellipsis, Pencil, StickyNote, TrendingUp, Undo2 } from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import ExercisePicker from '../components/ExercisePicker';
import NoteDialog from '../components/NoteDialog';
import NumberField from '../components/NumberField';
import RestTimer from '../components/RestTimer';
import { ToastHost, useToast } from '../components/Toast';
import {
  COLON,
  exerciseName,
  formatClock,
  formatCount,
  formatNewRecord,
  formatRemainingSets,
  formatSeconds,
  formatSetValues,
  inSentence,
  restSecondsFor,
} from '../lib/format';
import {
  MAX_REPS,
  MAX_WEIGHT,
  currentExerciseIndex,
  currentSetIndex,
  nextPendingIndex,
  pendingSetCount,
  validateSet as withSetValidated,
} from '../lib/session';
import { firstTimeText } from '../lib/programs';
import { keepLabel, keepToast, suggestionDetail, suggestionTitle } from '../lib/progression';
import { unlockRestChime } from '../lib/restChime';
import { isRestSoundEnabled, loadRestEndsAt, saveRestEndsAt } from '../lib/restTimer';
import { normalizeExerciseNote } from '../lib/storage';
import { countDoneSets, lastPerformance, recordGainedBy, sessionDurationMs, type LastPerformance } from '../lib/stats';
import type { SessionExercise } from '../lib/types';
import { useWakeLock } from '../lib/wakeLock';
import { useAppStore } from '../state/AppStore';

type Dialog = { kind: 'finish'; message: string } | { kind: 'empty' } | { kind: 'abandon' };

/** Pas des boutons −/+ de la série en cours (identity.md §4.6). */
const WEIGHT_STEP = 2.5;
const REPS_STEP = 1;

/** Écran plein de la séance en cours (/seance) : un exercice à la fois. */
export default function ActiveSessionPage() {
  const { state, actions } = useAppStore();
  const navigate = useNavigate();
  const toast = useToast();
  const session = state.activeSession;
  const [now, setNow] = useState(() => Date.now());
  // Le repos en cours est persisté (stockage de session) : il survit à un rechargement ou à un détour.
  const [restEndsAt, setRestEndsAt] = useState<number | null>(() => loadRestEndsAt(session?.id));
  const restSound = isRestSoundEnabled(state);
  // Écran allumé tant que la séance en cours est affichée ; relâché en la quittant (fin, abandon, détour).
  useWakeLock(session !== undefined);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [picking, setPicking] = useState(false);
  /** Exercice (id) dont la note est en cours d'écriture (lot 6). */
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  /** Note affichée : reçoit le focus après un enregistrement (lot 6). */
  const noteRef = useRef<HTMLParagraphElement>(null);
  /** Où rendre le focus à la fermeture du dialogue de note : la note enregistrée, sinon le bouton ⋯. */
  const focusNoteOnClose = useRef(false);
  /** Toast « Note effacée. » encore ouvert, et l'exercice qu'il vise. */
  const noteToast = useRef<{ toastId: number; exerciseId: string } | null>(null);
  /**
   * Série faite rouverte pour correction. Une correction n'est pas une validation : elle ne relance
   * pas le repos et ne change pas d'exercice. La série reste validée pendant la correction.
   */
  const [editing, setEditing] = useState<{ exIdx: number; setIdx: number } | null>(null);
  /**
   * Retour affiché dans le bas d'écran, et série dont la coche s'anime. `record` : phrase de record
   * annoncée au-dessus du retour (lot 5), jusqu'au retour suivant ; `seq` rejoue son « pulse ».
   */
  const [feedback, setFeedback] = useState<{
    text: string;
    exIdx?: number;
    setIdx?: number;
    record?: string;
    seq?: number;
  } | null>(null);
  const feedbackSeq = useRef(0);
  const heroRef = useRef<HTMLLIElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Toast d'annulation propre à la séance : il disparaît quand on quitte l'écran (fin, abandon),
  // pour ne pas masquer l'action principale de l'écran suivant. La suppression reste effective.
  const toastId = useRef<number | null>(null);
  const dismissToast = toast.dismiss;
  useEffect(
    () => () => {
      if (toastId.current !== null) dismissToast(toastId.current);
    },
    [dismissToast],
  );

  /**
   * Toast « Charge remise à … » : l'exercice visé, retrouvé par référence (l'objet de la séance juste
   * après « Rester à … ») pour « Annuler ». Dès que cet exercice change (série validée, valeur
   * modifiée) ou quitte la séance, le toast se ferme : « Annuler » n'aurait plus de sens.
   */
  const kept = useRef<{ toastId: number; index: number; exercise?: SessionExercise } | null>(null);
  useEffect(() => {
    const k = kept.current;
    if (!k || !session) return;
    if (!k.exercise) {
      // Premier rendu après « Rester à … » : l'exercice est encore à la même place.
      k.exercise = session.exercises[k.index];
      return;
    }
    if (!session.exercises.includes(k.exercise)) {
      dismissToast(k.toastId);
      kept.current = null;
    }
  }, [session, dismissToast]);

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

  // Exercice affiché (persisté dans la séance). Le sens de la transition est figé au moment où
  // l'exercice change : les autres rendus (tic du chrono…) ne rejouent pas l'animation.
  const exIdx = session ? currentExerciseIndex(session) : 0;
  const transition = useRef<{ index: number; direction: 'next' | 'prev' }>({ index: exIdx, direction: 'next' });
  if (transition.current.index !== exIdx) {
    transition.current = { index: exIdx, direction: exIdx > transition.current.index ? 'next' : 'prev' };
  }
  const direction = transition.current.direction;
  useEffect(() => {
    setMenuOpen(false);
  }, [exIdx]);

  // Note fermée : l'entrée du menu qui l'a ouverte n'existe plus. Après un enregistrement, le focus
  // va à la note affichée (le lecteur d'écran lit « Note : … ») ; sinon (Annuler, Échap, note
  // effacée), il revient au bouton ⋯.
  const noteWasOpen = useRef(false);
  useEffect(() => {
    if (noteFor !== null) noteWasOpen.current = true;
    else if (noteWasOpen.current) {
      noteWasOpen.current = false;
      const toNote = focusNoteOnClose.current;
      focusNoteOnClose.current = false;
      (toNote && noteRef.current ? noteRef.current : menuButtonRef.current)?.focus();
    }
  }, [noteFor]);

  // Menu ⋯ : fermeture au tap hors du menu et sur Échap (le focus revient au bouton ⋯).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    const onPointer = (e: PointerEvent | MouseEvent) => {
      const target = e.target as Element | null;
      if (!target || menuRef.current?.contains(target) || menuButtonRef.current?.contains(target)) return;
      setMenuOpen(false);
      // On ne vole pas le focus d'un champ ou d'un bouton qu'on vient de toucher.
      if (!target.closest('button, input, a, select, textarea')) menuButtonRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [menuOpen]);

  // Après chaque validation, le dock grandit (repos, annonce de record) : la carte de la série en cours
  // défile pour rester entière au-dessus de lui, « Dernière fois » comprise (iPhone SE). Sans
  // animation sous mouvement réduit, comme le défilement après ajout du lot 2.
  const validatedSeq = feedback?.seq;
  useEffect(() => {
    const card = heroRef.current;
    const dock = dockRef.current;
    if (validatedSeq === undefined || !card || !dock) return;
    card.style.scrollMarginBottom = `${dock.offsetHeight + 8}px`;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    card.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [validatedSeq]);

  if (!session) return <Navigate to="/seances" replace />;

  const total = session.exercises.length;
  // Crans de progression (pente 12°) : un par exercice, lu par .session-progress__track en CSS.
  const stepsStyle = { '--steps': total } as CSSProperties;
  const exercise = session.exercises[exIdx];
  const name = exercise ? exerciseName(state.exercises, exercise.exerciseId) : '';
  // Série en cours = première série non validée de l'exercice affiché.
  const setIdx = currentSetIndex(exercise);
  const isLastExercise = exIdx === total - 1;
  // Note de l'exercice (lot 6) : propre à l'exercice, la même à chaque séance.
  const note = exercise ? state.exercises.find((e) => e.id === exercise.exerciseId)?.note : undefined;
  // Au moins une série de l'exercice affiché est validée : la charge proposée est masquée.
  const started = exercise?.sets.some((s) => s.done) ?? false;
  const pending = pendingSetCount(session);
  // Crans de progression (lot 6) : un exercice est fait quand il n'a plus de série en attente
  // (un exercice sans série n'est pas en attente).
  const exerciseDone = session.exercises.map((e) => currentSetIndex(e) === -1);
  const doneExercises = exerciseDone.filter(Boolean).length;
  // Correction valide seulement si la série existe toujours, est faite et appartient à l'exercice affiché.
  const correcting =
    editing && editing.exIdx === exIdx && exercise?.sets[editing.setIdx]?.done ? editing.setIdx : -1;
  // Série mise en avant (grande carte) : celle en correction, sinon celle en cours.
  const heroIdx = correcting >= 0 ? correcting : setIdx;

  // Référence d'une série : la même série la dernière fois, sinon l'objectif de la séance type
  // (« Première fois : … » pour la série 1 en cours d'un exercice jamais fait ; dès qu'une série
  // est validée, « Objectif : … »).
  const referenceFor = (i: number): string | null => {
    if (!exercise) return null;
    const last = lastByExercise.get(exercise.exerciseId);
    if (last) {
      // Série au-delà de la dernière fois : on ne réutilise pas la valeur d'une autre série.
      if (i >= last.sets.length) return `Série en plus${COLON} ${formatCount(last.sets.length, 'série')} la dernière fois.`;
      return `Dernière fois${COLON} ${formatSetValues(last.sets[i].weight, last.sets[i].reps)}`;
    }
    const template = session.templateId ? state.templates.find((t) => t.id === session.templateId) : undefined;
    const target = template?.exercises.find((te) => te.exerciseId === exercise.exerciseId);
    if (!target) return null;
    const weight = target.targetWeight ?? 0;
    if (i === setIdx && !started) return firstTimeText(exercise.exerciseId, weight, target.targetReps);
    return `Objectif${COLON} ${formatSetValues(weight, target.targetReps)}`;
  };

  const validate = () => {
    if (!exercise || setIdx < 0) return;
    const n = setIdx + 1;
    // Plus rien à faire après cette série : pas de repos.
    const rest = pending > 1 ? restSecondsFor(session, state.templates, exercise.exerciseId) : 0;
    const exerciseFinished = exercise.sets.filter((s) => !s.done).length === 1;
    // Record (même définition que le récap) : calculé avant / après cette validation.
    const gained = recordGainedBy(session, withSetValidated(session, exIdx, setIdx), state.sessions, exercise.exerciseId);
    actions.validateSet(exIdx, setIdx);
    // iOS n'autorise le son qu'après un geste : on prépare le bip de fin de repos pendant ce tap.
    if (rest > 0 && restSound) unlockRestChime();
    setRestEndsAt(rest > 0 ? Date.now() + rest * 1000 : null);
    const restText = rest > 0 ? ` Repos${COLON} ${formatSeconds(rest)}.` : '';
    // Exercice fini : l'écran passe au prochain exercice en attente plus loin, ou reste là (le bouton
    // principal propose alors « Reprendre l’exercice N » ou « Terminer la séance ») ; on cite donc
    // l'exercice plutôt qu'un numéro de série.
    const text = exerciseFinished
      ? `Exercice terminé${COLON} ${inSentence(name)}.${restText}`
      : `Série ${n} validée.${restText}`;
    feedbackSeq.current += 1;
    setFeedback({
      text,
      exIdx,
      setIdx,
      record: gained ? formatNewRecord(name, gained) : undefined,
      seq: feedbackSeq.current,
    });
  };

  /** Fin de correction : rien d'autre ne change (ni repos ni exercice affiché). */
  const saveCorrection = () => {
    setEditing(null);
    setFeedback({ text: `Série ${correcting + 1} corrigée.` });
  };

  /** Suppression immédiate (série ou exercice), annulable 5 s par le toast. */
  const notifyRemoval = (message: string, snapshot: ReturnType<typeof actions.removeSet>) => {
    setFeedback(null);
    toastId.current = toast.show({ message, onUndo: snapshot && (() => actions.restore(snapshot)) });
  };

  /** « Rester à 80 kg » : valeurs de la dernière fois, annulable 5 s (« Annuler » remet la proposition). */
  const keepLast = () => {
    const suggestion = exercise?.suggestion;
    if (!suggestion) return;
    actions.keepLastLoad(exIdx);
    setFeedback(null);
    const target: NonNullable<typeof kept.current> = { toastId: 0, index: exIdx };
    target.toastId = toast.show({
      message: keepToast(suggestion),
      onUndo: () => {
        if (target.exercise) actions.reapplySuggestion(target.exercise, suggestion);
      },
      undoLabel: 'Annuler : remettre la proposition',
    });
    kept.current = target;
    toastId.current = target.toastId;
  };

  const goTo = (index: number) => {
    actions.goToExercise(index);
    setEditing(null);
    setFeedback(null);
  };

  const finish = () => {
    const id = session.id; // mémorisé avant que la séance ne quitte activeSession
    saveRestEndsAt(id, null);
    actions.finishSession();
    navigate(`/resume/${id}`, { replace: true });
  };

  /** Confirmation légère seulement s'il reste des séries ; la garde « séance vide » est inchangée. */
  const askFinish = () => {
    if (countDoneSets(session) === 0) setDialog({ kind: 'empty' });
    else if (pending > 0) {
      // Exercices en attente, dans l'ordre de la séance (lot 6) : on dit lesquels. Le même exercice
      // présent deux fois n'est nommé qu'une fois (par identifiant : deux exercices au même nom restent deux).
      const ids = [...new Set(session.exercises.filter((e) => currentSetIndex(e) !== -1).map((e) => e.exerciseId))];
      const names = ids.map((id) => exerciseName(state.exercises, id));
      setDialog({ kind: 'finish', message: formatRemainingSets(pending, names) });
    }
    else finish();
  };

  const abandon = () => {
    saveRestEndsAt(session.id, null);
    actions.abandonSession();
    navigate('/seances', { replace: true });
  };

  /** Action du menu ⋯ : ferme le menu et abandonne une éventuelle correction en cours. */
  const menuAction = (fn: () => void) => () => {
    setMenuOpen(false);
    setEditing(null);
    fn();
  };

  /** Note enregistrée : visible tout de suite, sans toast ; vide = effacée (toast « Annuler »). */
  const saveNote = (exerciseId: string, text: string) => {
    setNoteFor(null);
    const previous = state.exercises.find((e) => e.id === exerciseId)?.note;
    const next = normalizeExerciseNote(text);
    focusNoteOnClose.current = next !== undefined;
    if (next === previous) return;
    // Nouvelle note sur cet exercice : le « Annuler » d'un effacement précédent remettrait l'ancienne
    // note par-dessus. On ferme ce toast.
    if (noteToast.current?.exerciseId === exerciseId) {
      dismissToast(noteToast.current.toastId);
      noteToast.current = null;
    }
    actions.setExerciseNote(exerciseId, next);
    // Le retour du dock et le repos ne changent pas : seul le toast d'annulation s'affiche.
    if (next === undefined && previous !== undefined) {
      const id = toast.show({
        message: 'Note effacée.',
        onUndo: () => actions.setExerciseNote(exerciseId, previous),
        undoLabel: 'Annuler : remettre la note',
      });
      toastId.current = id;
      noteToast.current = { toastId: id, exerciseId };
    }
  };

  const neighbourName = (i: number) => {
    const ex = session.exercises[i];
    return ex ? exerciseName(state.exercises, ex.exerciseId) : '';
  };

  // Exercice affiché fini (lot 6) : le prochain en attente plus loin, sinon le premier plus haut
  // (« Reprendre l’exercice N »), sinon -1 (tout est validé : « Terminer la séance »).
  const pendingTarget = total > 0 && setIdx === -1 ? nextPendingIndex(session, exIdx) : -1;

  // Une seule action principale, fixée en bas de l'écran.
  const primary: { label: string; ariaLabel?: string; onClick: () => void } =
    total === 0
      ? { label: 'Ajouter un exercice', onClick: () => setPicking(true) }
      : correcting >= 0
        ? { label: 'Enregistrer la correction', onClick: saveCorrection }
        : setIdx >= 0
          ? { label: 'Valider la série', onClick: validate }
          : pendingTarget > exIdx
            ? // Comme le passage automatique : le prochain exercice qui a encore des séries à faire.
              { label: 'Exercice suivant', onClick: () => goTo(pendingTarget) }
            : pendingTarget !== -1
              ? {
                  label: `Reprendre l’exercice ${pendingTarget + 1}`,
                  ariaLabel: `Reprendre l’exercice ${pendingTarget + 1}${COLON} ${inSentence(neighbourName(pendingTarget))}`,
                  onClick: () => goTo(pendingTarget),
                }
              : { label: 'Terminer la séance', onClick: askFinish };
  const prevName = neighbourName(exIdx - 1);
  const nextName = neighbourName(exIdx + 1);

  return (
    <section className="page session">
      <header className="session__header">
        <div className="session__info">
          <h1 className="session__name">{session.name}</h1>
          <p className="session__clock">
            <span className="visually-hidden">Durée de la séance : </span>
            {formatClock(sessionDurationMs(session, new Date(now)))}
          </p>
        </div>
        {/* Toujours accessible mais secondaire ; masqué quand c'est devenu l'action principale. */}
        {primary.label !== 'Terminer la séance' && (
          <button type="button" className="btn btn--ghost session__finish" onClick={askFinish}>
            Terminer la séance
          </button>
        )}
      </header>

      {total === 0 ? (
        <>
          <p className="muted">Ajoute un premier exercice pour commencer.</p>
          {/* Sans exercice, pas de menu ⋯ : l'abandon reste accessible ici, discret. */}
          <button type="button" className="btn btn--danger-ghost session__abandon" onClick={() => setDialog({ kind: 'abandon' })}>
            Abandonner la séance
          </button>
        </>
      ) : (
        <>
          <div className="session-progress" style={stepsStyle}>
            <p className="session-progress__label">
              Exercice {exIdx + 1} sur {total}
            </p>
            <div
              className="session-progress__track"
              style={stepsStyle}
              role="progressbar"
              aria-label="Progression dans la séance"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={doneExercises}
              aria-valuetext={`Exercice ${exIdx + 1} sur ${total}, ${
                doneExercises === 0
                  ? 'aucun exercice terminé'
                  : formatCount(doneExercises, 'exercice terminé', 'exercices terminés')
              }`}
            >
              {/* Un cran par exercice : rempli = plus de série en attente ; le cran de l'exercice
                  affiché est plus haut et cerné d'encre (jamais l'accent). */}
              {exerciseDone.map((isDone, i) => (
                <span
                  key={i}
                  className={`session-progress__step${isDone ? ' session-progress__step--done' : ''}${
                    i === exIdx ? ' session-progress__step--current' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          <article key={exIdx} className={`session-exercise session-exercise--${direction}`} aria-label={name}>
            <div className="session-exercise__head">
              <h2 className="session-exercise__name">{name}</h2>
              <button
                ref={menuButtonRef}
                type="button"
                className="icon-btn"
                aria-label={`Options de ${name}`}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <Ellipsis size={24} aria-hidden="true" />
              </button>
            </div>

            {menuOpen && (
              <div className="session-menu" ref={menuRef}>
                <button type="button" className="btn btn--block" onClick={menuAction(() => actions.addSet(exIdx))}>
                  Ajouter une série
                </button>
                <button
                  type="button"
                  className="btn btn--block"
                  disabled={exercise.sets.length === 0}
                  onClick={menuAction(() => {
                    const last = exercise.sets.length - 1;
                    notifyRemoval(`Série ${last + 1} supprimée.`, actions.removeSet(exIdx, last));
                  })}
                >
                  Supprimer la dernière série
                </button>
                <button type="button" className="btn btn--block" onClick={menuAction(() => setPicking(true))}>
                  Ajouter un exercice
                </button>
                {/* Exercice supprimé de la bibliothèque pendant la séance : pas de note à écrire. */}
                {state.exercises.some((e) => e.id === exercise.exerciseId) && (
                  <button
                    type="button"
                    className="btn btn--block"
                    onClick={menuAction(() => setNoteFor(exercise.exerciseId))}
                  >
                    {note ? 'Modifier la note' : 'Ajouter une note'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--block btn--danger-outline"
                  onClick={menuAction(() =>
                    notifyRemoval(`Exercice retiré${COLON} ${inSentence(name)}.`, actions.removeSessionExercise(exIdx)),
                  )}
                >
                  Retirer cet exercice
                </button>
                <hr className="session-menu__separator" />
                <button
                  type="button"
                  className="btn btn--block btn--danger-ghost"
                  onClick={menuAction(() => setDialog({ kind: 'abandon' }))}
                >
                  Abandonner la séance
                </button>
              </div>
            )}

            {/* Note d'exercice (lot 6) : texte secondaire, affichée en entier (80 caractères au plus),
                sans accent ; elle reste affichée pendant tout l'exercice. Elle reçoit le focus après un
                enregistrement. */}
            {note && (
              <p ref={noteRef} className="exercise-note" tabIndex={-1}>
                <StickyNote size={20} aria-hidden="true" />
                <span className="exercise-note__text">
                  <span className="visually-hidden">Note{COLON} </span>
                  {note}
                </span>
              </p>
            )}

            {/* Charge proposée : note de coach en encre, lue avant la liste des séries ; sans accent ni vert. */}
            {/* Avant la première série validée seulement : ensuite, la référence « Dernière fois » de la
                carte suffit, et la place compte pendant le repos (iPhone SE). */}
            {exercise.suggestion && !started && (
              <div className="load-note">
                <p className="load-note__title">
                  <TrendingUp size={20} aria-hidden="true" />
                  {suggestionTitle(exercise.suggestion)}
                </p>
                <p className="load-note__detail">{suggestionDetail(exercise.suggestion)}</p>
                <button type="button" className="btn load-note__keep" onClick={keepLast}>
                  <Undo2 size={20} aria-hidden="true" />
                  {keepLabel(exercise.suggestion)}
                </button>
              </div>
            )}

            {exercise.sets.length === 0 && (
              <p className="muted">Aucune série. Ajoute une série depuis le menu Options.</p>
            )}

            <ol className="set-list" aria-label={`Séries de ${name}`}>
              {exercise.sets.map((s, i) => {
                const n = i + 1;
                const values = formatSetValues(s.weight, s.reps);
                if (i === heroIdx) {
                  // En cours (ou en correction) : carte bordée d'accent, chiffres en 40 px, −/+ et clavier en repli.
                  const reference = referenceFor(i);
                  return (
                    <li key={i} ref={heroRef} className="set-current" aria-current="step">
                      <p className="set-current__title">
                        <span>
                          Série {n} sur {exercise.sets.length}
                        </span>
                        <span className="set-current__state">{i === correcting ? 'En correction' : 'En cours'}</span>
                      </p>
                      <NumberField
                        label="Charge (kg)"
                        size="hero"
                        step={WEIGHT_STEP}
                        max={MAX_WEIGHT}
                        suffix="kg"
                        value={s.weight}
                        onChange={(weight) => actions.updateSet(exIdx, i, { weight })}
                      />
                      <NumberField
                        label="Reps"
                        size="hero"
                        kind="integer"
                        step={REPS_STEP}
                        max={MAX_REPS}
                        suffix="reps"
                        value={s.reps}
                        onChange={(reps) => actions.updateSet(exIdx, i, { reps })}
                      />
                      {reference && <p className="set-current__ref">{reference}</p>}
                    </li>
                  );
                }
                if (s.done) {
                  // Faite : compacte, remplie en encre + coche + « Faite » ; « Corriger » la rouvre.
                  const justDone = feedback?.exIdx === exIdx && feedback.setIdx === i;
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        className={`set-row set-row--done${justDone ? ' set-row--just-done' : ''}`}
                        aria-label={`Corriger la série ${n} : ${values}, faite`}
                        onClick={() => {
                          setEditing({ exIdx, setIdx: i });
                          setFeedback({ text: `Série ${n} en correction.` });
                        }}
                      >
                        <span className="set-row__num">{n}</span>
                        <span className="set-row__values">{values}</span>
                        <span className="set-row__state">
                          <Check className="set-row__check" size={20} strokeWidth={2.5} aria-hidden="true" />
                          Faite
                        </span>
                        <span className="set-row__edit">
                          <Pencil size={20} aria-hidden="true" />
                          Corriger
                        </span>
                      </button>
                    </li>
                  );
                }
                // À venir : contour + texte grisé + libellé.
                return (
                  <li key={i} className="set-row set-row--todo">
                    <span className="set-row__num">{n}</span>
                    <span className="set-row__values">{values}</span>
                    <span className="set-row__state">À venir</span>
                  </li>
                );
              })}
            </ol>
          </article>

          <div className="session-nav">
            {exIdx > 0 && (
              <button
                type="button"
                className="btn btn--ghost"
                aria-label={`Exercice précédent : ${prevName}`}
                onClick={() => goTo(exIdx - 1)}
              >
                <ChevronLeft size={20} aria-hidden="true" />
                Précédent
              </button>
            )}
            {!isLastExercise && primary.label !== 'Exercice suivant' && (
              <button
                type="button"
                className="btn btn--ghost session-nav__next"
                aria-label={`Exercice suivant : ${nextName}`}
                onClick={() => goTo(exIdx + 1)}
              >
                Suivant
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            )}
          </div>
        </>
      )}

      {/* Bas d'écran : retour d'action, minuteur de repos discret, action principale. */}
      <div ref={dockRef} className="session-dock">
        {/* Toast « Annuler » : au-dessus du bouton principal, jamais par-dessus. */}
        <ToastHost placement="inline" />
        {/* Zone annoncée toujours présente dans l'arbre (masquée visuellement quand elle est vide). */}
        {/* Record et retour dans le même élément : « Nouveau record en squat : 85 kg ! Série 2 validée. … » */}
        <div className={feedback ? 'session-dock__status' : 'visually-hidden'} role="status">
          {feedback?.record && (
            <>
              <p key={feedback.seq} className="session-dock__record">
                {feedback.record}
              </p>{' '}
            </>
          )}
          {feedback && <p className="session-dock__feedback">{feedback.text}</p>}
        </div>
        {restEndsAt !== null && (
          <RestTimer
            endsAt={restEndsAt}
            sound={restSound}
            onAdjust={(sec) => {
              // Repos repris après un rechargement : ce tap débloque aussi le son.
              if (restSound) unlockRestChime();
              setRestEndsAt((end) => (end === null ? end : Math.max(Date.now(), end + sec * 1000)));
            }}
            onDismiss={() => setRestEndsAt(null)}
          />
        )}
        <button
          type="button"
          className="btn btn--primary btn--lg btn--block"
          aria-label={primary.ariaLabel}
          onClick={primary.onClick}
        >
          {primary.label}
        </button>
      </div>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onSelect={(id) => {
            actions.addSessionExercise(id);
            setPicking(false);
            setFeedback(null);
          }}
        />
      )}

      {noteFor !== null && (
        <NoteDialog
          exerciseName={exerciseName(state.exercises, noteFor)}
          note={state.exercises.find((e) => e.id === noteFor)?.note}
          onSave={(text) => saveNote(noteFor, text)}
          onClear={() => saveNote(noteFor, '')}
          onCancel={() => setNoteFor(null)}
        />
      )}

      <ConfirmDialog
        open={dialog?.kind === 'finish'}
        title="Terminer la séance ?"
        message={dialog?.kind === 'finish' && dialog.message}
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
    </section>
  );
}
