import { ChevronLeft, Trash } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { version } from '../../package.json';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { COLON, formatGoalOption } from '../lib/format';
import { isSuggestLoadEnabled } from '../lib/progression';
import { WEEKLY_GOALS, weeklyGoalOf } from '../lib/rhythm';
import { saveRestEndsAt } from '../lib/restTimer';
import { exportFileName, exportState, validateImport } from '../lib/storage';
import { MUSCLE_GROUPS, type AppState, type Exercise, type MuscleGroup, type WeeklyGoal } from '../lib/types';
import { useAppStore } from '../state/AppStore';
import { clearStoredExercise } from './ProgressPage';

/** Taille maximale acceptée pour un import (fichier ou texte collé). */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const TOO_LARGE = `Import impossible${COLON} les données dépassent la taille maximale de 5 Mo.`;
const SAVE_FAILED =
  `Échec de l’import${COLON} les données n’ont pas pu être enregistrées sur l’appareil (stockage plein ou indisponible).`;

/** Déclenche le téléchargement d'un fichier texte ; renvoie false si le navigateur ne le permet pas. */
function downloadText(text: string, filename: string): boolean {
  try {
    if (typeof URL.createObjectURL !== 'function') return false;
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
  } catch {
    return false;
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

function describeState(s: AppState): string {
  const custom = s.exercises.filter((e) => e.isCustom).length;
  return `${plural(s.sessions.length, 'séance')} dans l’historique, ${plural(s.templates.length, 'séance type')}, ${plural(custom, 'exercice personnalisé')}`;
}

type Dialog =
  | { kind: 'import'; state: AppState }
  | { kind: 'deleteExercise'; exercise: Exercise }
  | { kind: 'reset' };

/** Réglages : export / import, exercices personnalisés, réinitialisation (/reglages). */
export default function SettingsPage() {
  const { state, actions } = useAppStore();
  // Import et réinitialisation remplacent toutes les données : un toast « Annuler » encore affiché
  // n'a plus d'objet (le store refuse aussi de restaurer un instantané antérieur).
  const { dismiss: dismissToast } = useToast();
  const [exported, setExported] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importDone, setImportDone] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const exportRef = useRef<HTMLTextAreaElement>(null);

  const customExercises = state.exercises.filter((e) => e.isCustom);
  const suggestLoad = isSuggestLoadEnabled(state);
  const weeklyGoal = weeklyGoalOf(state);
  const goalOptions: (WeeklyGoal | undefined)[] = [undefined, ...WEEKLY_GOALS];
  const goalGroupRef = useRef<HTMLDivElement>(null);

  /** Radiogroup : les flèches déplacent le choix (et le focus), comme un groupe de boutons radio natif. */
  const onGoalKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const target = step !== undefined ? index + step : e.key === 'Home' ? 0 : e.key === 'End' ? goalOptions.length - 1 : null;
    if (target === null) return;
    e.preventDefault();
    const next = (target + goalOptions.length) % goalOptions.length;
    actions.setWeeklyGoal(goalOptions[next]);
    goalGroupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };

  const doExport = () => {
    const text = exportState(state);
    setExported(text);
    setExportMsg(
      downloadText(text, exportFileName())
        ? 'Fichier téléchargé. Tu peux aussi copier le texte ci-dessous.'
        : `Téléchargement indisponible sur ce navigateur${COLON} copie le texte ci-dessous.`,
    );
  };

  const copy = async () => {
    if (exported === null) return;
    try {
      if (!navigator.clipboard) throw new Error('Presse-papiers indisponible');
      await navigator.clipboard.writeText(exported);
      setExportMsg('Données copiées dans le presse-papiers.');
    } catch {
      exportRef.current?.focus();
      exportRef.current?.select();
      setExportMsg(`Copie automatique impossible${COLON} le texte est sélectionné, copie-le manuellement.`);
    }
  };

  const checkImport = (text: string) => {
    setImportDone(null);
    if (new Blob([text]).size > MAX_IMPORT_BYTES) {
      setImportError(TOO_LARGE);
      return;
    }
    const result = validateImport(text);
    if (!result.ok) {
      setImportError(`Import impossible${COLON} ${result.error}`);
      return;
    }
    setImportError(null);
    setDialog({ kind: 'import', state: result.state });
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de re-choisir le même fichier
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setImportDone(null);
      setImportError(TOO_LARGE);
      return;
    }
    try {
      checkImport(await file.text());
    } catch {
      setImportDone(null);
      setImportError(`Import impossible${COLON} impossible de lire ce fichier.`);
    }
  };

  const usage = (id: string) => {
    const templates = state.templates.filter((t) => t.exercises.some((e) => e.exerciseId === id)).length;
    const sessions = [...state.sessions, ...(state.activeSession ? [state.activeSession] : [])].filter((s) =>
      s.exercises.some((e) => e.exerciseId === id),
    ).length;
    return { templates, sessions };
  };

  return (
    <section className="page">
      {/* Page plein écran ouverte depuis l'onglet Séances : retour explicite. */}
      <Link to="/seances" className="back-link">
        <ChevronLeft size={20} aria-hidden="true" />
        Séances
      </Link>
      <h1 className="page__title">Réglages</h1>

      <div className="card settings-section">
        <h2 className="section-title">Séance</h2>
        <button
          type="button"
          role="switch"
          aria-checked={suggestLoad}
          aria-describedby="suggest-load-help"
          className="switch-row"
          onClick={() => actions.setSuggestLoad(!suggestLoad)}
        >
          <span className="switch-row__label">Suggérer la charge suivante</span>
          <span className="switch" aria-hidden="true">
            <span className="switch__thumb" />
          </span>
        </button>
        <p id="suggest-load-help" className="muted settings-section__text">
          Quand tu as réussi toutes tes séries, la séance suivante propose 2,5 kg de plus (ou 1 rep au poids du corps).
        </p>
        <span id="weekly-goal-label" className="switch-row__label settings-section__label">
          Objectif par semaine
        </span>
        <div
          ref={goalGroupRef}
          role="radiogroup"
          aria-labelledby="weekly-goal-label"
          aria-describedby="weekly-goal-help"
          className="goal-chips"
        >
          {goalOptions.map((g, i) => {
            const checked = g === weeklyGoal;
            return (
              <button
                key={g ?? 'aucun'}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={formatGoalOption(g)}
                tabIndex={checked ? 0 : -1}
                className="goal-chip"
                onClick={() => actions.setWeeklyGoal(g)}
                onKeyDown={(e) => onGoalKey(e, i)}
              >
                {g ?? 'Aucun'}
              </button>
            );
          })}
        </div>
        <p id="weekly-goal-help" className="muted settings-section__text">
          Un repère pour toi, que tu changes quand tu veux. Une semaine en dessous ne laisse aucune trace.
        </p>
      </div>

      <div className="card settings-section">
        <h2 className="section-title">Sauvegarde</h2>
        <p className="muted settings-section__text">
          Tes données sont stockées uniquement sur cet appareil, dans ce navigateur. Exporte-les régulièrement pour
          ne rien perdre (changement de téléphone, nettoyage du navigateur…).
        </p>
        <button type="button" className="btn btn--primary btn--block" onClick={doExport}>
          Exporter mes données
        </button>
        {exported !== null && (
          <>
            {exportMsg && (
              <p className="muted settings-section__text" role="status">
                {exportMsg}
              </p>
            )}
            <label htmlFor="export-text" className="visually-hidden">
              Données exportées (JSON)
            </label>
            <textarea id="export-text" ref={exportRef} className="input code-area" readOnly rows={6} value={exported} />
            <button type="button" className="btn btn--block" onClick={copy}>
              Copier
            </button>
          </>
        )}
      </div>

      <div className="card settings-section">
        <h2 className="section-title">Importer des données</h2>
        <p className="muted settings-section__text">
          L’import remplace toutes les données actuelles par celles du fichier.
        </p>
        <input
          id="import-file"
          type="file"
          accept=".json,application/json"
          className="visually-hidden file-input"
          onChange={onFile}
        />
        <label htmlFor="import-file" className="btn btn--block">
          Choisir un fichier .json
        </label>
        <label htmlFor="import-text" className="field__label">
          Ou colle le contenu exporté
        </label>
        <textarea
          id="import-text"
          className="input code-area"
          rows={4}
          value={pasted}
          placeholder='{ "version": 1, … }'
          onChange={(e) => setPasted(e.target.value)}
        />
        <button type="button" className="btn btn--block" disabled={pasted.trim() === ''} onClick={() => checkImport(pasted)}>
          Importer le texte
        </button>
        {importError && (
          <p className="field__error" role="alert">
            {importError}
          </p>
        )}
        {importDone && (
          <p className="muted" role="status">
            {importDone}
          </p>
        )}
      </div>

      <div className="card settings-section">
        <h2 className="section-title">Exercices personnalisés</h2>
        {customExercises.length === 0 ? (
          <p className="muted settings-section__text">
            Aucun exercice personnalisé. Tu peux en créer depuis le sélecteur d’exercices d’une séance.
          </p>
        ) : (
          <ul className="custom-list">
            {customExercises.map((e) => (
              <CustomExerciseRow
                key={e.id}
                exercise={e}
                onSave={(name, group) => actions.updateCustomExercise(e.id, name, group)}
                onDelete={() => setDialog({ kind: 'deleteExercise', exercise: e })}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="card settings-section">
        <h2 className="section-title">Zone sensible</h2>
        <button type="button" className="btn btn--block btn--danger-outline" onClick={() => setDialog({ kind: 'reset' })}>
          Réinitialiser toutes les données
        </button>
        {resetError && (
          <p className="field__error" role="alert">
            {resetError}
          </p>
        )}
      </div>

      <p className="muted settings-footer">MuscuTrack v{version} — données stockées localement sur cet appareil.</p>

      <ConfirmDialog
        open={dialog?.kind === 'import'}
        title="Remplacer toutes les données ?"
        message={
          dialog?.kind === 'import' && (
            <>
              <p>Données importées&nbsp;: {describeState(dialog.state)}.</p>
              <p>Tes données actuelles ({describeState(state)}) seront définitivement remplacées.</p>
              {state.activeSession && (
                <p>
                  <strong>La séance en cours « {state.activeSession.name} » sera perdue.</strong>
                </p>
              )}
            </>
          )
        }
        confirmLabel="Remplacer"
        danger
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          if (dialog?.kind === 'import') {
            dismissToast();
            if (actions.replaceState(dialog.state)) {
              setImportError(null);
              setImportDone(`Import réussi${COLON} ${describeState(dialog.state)}.`);
            } else {
              setImportDone(null);
              setImportError(SAVE_FAILED);
            }
            setPasted('');
            setExported(null);
          }
          setDialog(null);
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'deleteExercise'}
        title="Supprimer l’exercice ?"
        message={dialog?.kind === 'deleteExercise' && <DeleteExerciseMessage name={dialog.exercise.name} {...usage(dialog.exercise.id)} />}
        confirmLabel="Supprimer"
        danger
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          if (dialog?.kind === 'deleteExercise') actions.deleteCustomExercise(dialog.exercise.id);
          setDialog(null);
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'reset'}
        title="Réinitialiser toutes les données ?"
        message={`Séances types, historique, séance en cours et exercices personnalisés seront effacés. Cette action est irréversible${COLON} exporte tes données avant si besoin.`}
        confirmLabel="Tout effacer"
        danger
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          dismissToast();
          const ok = actions.resetState();
          clearStoredExercise();
          saveRestEndsAt(undefined, null);
          setExported(null);
          setImportDone(null);
          setResetError(ok ? null : 'Réinitialisation non enregistrée : le stockage de l’appareil est plein ou indisponible.');
          setDialog(null);
        }}
      />
    </section>
  );
}

function DeleteExerciseMessage({ name, templates, sessions }: { name: string; templates: number; sessions: number }) {
  const used = templates > 0 || sessions > 0;
  return (
    <>
      <p>« {name} » sera supprimé de la bibliothèque.</p>
      {used ? (
        <p>
          Il est utilisé dans{' '}
          {[templates > 0 && plural(templates, 'séance type'), sessions > 0 && plural(sessions, 'séance')]
            .filter(Boolean)
            .join(' et ')}
          {' '}: il y apparaîtra comme « Exercice supprimé ».
        </p>
      ) : (
        <p>Il n’est utilisé dans aucune séance.</p>
      )}
    </>
  );
}

function CustomExerciseRow({
  exercise,
  onSave,
  onDelete,
}: {
  exercise: Exercise;
  onSave(name: string, group: MuscleGroup): void;
  onDelete(): void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(exercise.name);
  const [group, setGroup] = useState<MuscleGroup>(exercise.muscleGroup);
  const [error, setError] = useState(false);
  const nameId = `custom-name-${exercise.id}`;
  const groupId = `custom-group-${exercise.id}`;

  if (!editing) {
    return (
      <li className="custom-list__item">
        <span className="custom-list__info">
          <span>{exercise.name}</span>
          <span className="muted custom-list__group">{exercise.muscleGroup}</span>
        </span>
        <button
          type="button"
          className="btn"
          aria-label={`Modifier ${exercise.name}`}
          onClick={() => {
            setName(exercise.name);
            setGroup(exercise.muscleGroup);
            setError(false);
            setEditing(true);
          }}
        >
          Modifier
        </button>
        <button type="button" className="icon-btn" aria-label={`Supprimer ${exercise.name}`} onClick={onDelete}>
          <Trash size={20} aria-hidden="true" />
        </button>
      </li>
    );
  }

  return (
    <li className="custom-list__item custom-list__item--editing">
      <div className="field">
        <label htmlFor={nameId} className="field__label">
          Nom
        </label>
        <input
          id={nameId}
          className="input"
          value={name}
          maxLength={60}
          aria-invalid={error}
          onChange={(e) => {
            setName(e.target.value);
            if (e.target.value.trim() !== '') setError(false);
          }}
        />
        {error && (
          <span className="field__error" role="alert">
            Le nom ne peut pas être vide.
          </span>
        )}
      </div>
      <div className="field">
        <label htmlFor={groupId} className="field__label">
          Groupe musculaire
        </label>
        <select id={groupId} className="input" value={group} onChange={(e) => setGroup(e.target.value as MuscleGroup)}>
          {MUSCLE_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <button type="button" className="btn" onClick={() => setEditing(false)}>
          Annuler
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            if (name.trim() === '') {
              setError(true);
              return;
            }
            onSave(name, group);
            setEditing(false);
          }}
        >
          Enregistrer
        </button>
      </div>
    </li>
  );
}
