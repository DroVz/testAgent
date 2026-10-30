import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { COLON, NBSP, inSentence } from '../lib/format';
import { EXERCISE_NOTE_MAX } from '../lib/types';

/** Le compteur « 72 / 80 » n'apparaît qu'à partir de ce nombre de caractères. */
export const NOTE_COUNTER_FROM = 60;

export interface NoteDialogProps {
  /** Nom de l'exercice (titre « Note sur développé couché »). */
  exerciseName: string;
  /** Note existante (pré-remplit le champ ; ajoute « Effacer la note »). */
  note?: string;
  /** « Enregistrer la note » ou Entrée : texte brut du champ (nettoyé par l'appelant). */
  onSave(text: string): void;
  /** « Effacer la note ». */
  onClear(): void;
  onCancel(): void;
}

/**
 * Note d'exercice (lot 6) : même habillage que ConfirmDialog (Échap ou clic hors de la boîte =
 * annuler). Le champ reçoit le focus à l'ouverture ; l'appelant place le focus à la fermeture.
 * Ancré en haut de l'écran : le clavier iOS, posé par-dessus la page, ne cache pas les boutons.
 * Zone de texte de 2 lignes (on relit toute la note en l'écrivant), sans saut de ligne : Entrée
 * (avec ou sans Maj) enregistre.
 */
export default function NoteDialog({ exerciseName, note, onSave, onClear, onCancel }: NoteDialogProps) {
  const titleId = useId();
  const inputId = useId();
  const helpId = useId();
  const [text, setText] = useState(note ?? '');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous?.isConnected) previous.focus?.();
    };
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(text);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    // Pendant une composition (IME), Entrée valide la composition, pas la note.
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    onSave(text);
  };

  return (
    <div className="dialog-backdrop dialog-backdrop--top" onClick={onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="dialog__title">
          Note sur {inSentence(exerciseName)}
        </h2>
        <form onSubmit={submit}>
          <div className="field note-field">
            <label htmlFor={inputId} className="field__label">
              Note
            </label>
            <textarea
              ref={inputRef}
              id={inputId}
              rows={2}
              className="input note-field__input"
              value={text}
              maxLength={EXERCISE_NOTE_MAX}
              enterKeyHint="done"
              placeholder={`Ex.${COLON} siège au cran 4`}
              aria-describedby={helpId}
              onKeyDown={onKeyDown}
              // Une note tient sur une ligne logique : un saut de ligne collé devient une espace.
              onChange={(e) => setText(e.target.value.replace(/\r\n?|\n/g, ' ').slice(0, EXERCISE_NOTE_MAX))}
            />
            <div className="note-field__below">
              <p id={helpId} className="note-field__help">
                Réglage, prise ou consigne. Elle s’affichera à chaque séance.
              </p>
              {text.length >= NOTE_COUNTER_FROM && (
                <p className="note-field__counter">
                  {text.length}
                  {NBSP}/{NBSP}
                  {EXERCISE_NOTE_MAX}
                </p>
              )}
            </div>
          </div>
          <div className="dialog__actions">
            <button type="button" className="btn" onClick={onCancel}>
              Annuler
            </button>
            <button type="submit" className="btn btn--primary">
              Enregistrer la note
            </button>
          </div>
          {note !== undefined && (
            <button type="button" className="btn btn--block btn--danger-ghost note-field__clear" onClick={onClear}>
              Effacer la note
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
