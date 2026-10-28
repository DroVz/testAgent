import { useEffect, useId, useState } from 'react';
import { parseDecimalInput, parseIntInput, toInputText } from '../lib/format';

export interface NumberFieldProps {
  label: string;
  value: number;
  onChange(value: number): void;
  /** « decimal » (poids, virgule acceptée) ou « integer » (reps, séries, secondes). */
  kind?: 'decimal' | 'integer';
  /** Pas des boutons − / + ; aucun bouton si absent. */
  step?: number;
  min?: number;
  max?: number;
  /** Libellé visible (sinon uniquement pour les lecteurs d'écran). */
  showLabel?: boolean;
  suffix?: string;
}

/**
 * Champ numérique tactile. Le texte saisi est conservé localement (ex. « 62, » en cours de frappe) ;
 * la valeur n'est transmise que lorsqu'elle est valide.
 */
export default function NumberField({
  label,
  value,
  onChange,
  kind = 'decimal',
  step,
  min = 0,
  max,
  showLabel = false,
  suffix,
}: NumberFieldProps) {
  const id = useId();
  const parse = kind === 'decimal' ? parseDecimalInput : parseIntInput;
  const [text, setText] = useState(() => toInputText(value));

  // Valeur modifiée de l'extérieur (bouton −/+, store) : on resynchronise le texte.
  useEffect(() => {
    setText((current) => (parse(current) === value ? current : toInputText(value)));
  }, [value, parse]);

  const clamp = (n: number) => {
    const rounded = kind === 'integer' ? Math.round(n) : Math.round(n * 100) / 100;
    return Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, rounded));
  };

  const commit = (n: number) => {
    const next = clamp(n);
    setText(toInputText(next));
    if (next !== value) onChange(next);
  };

  const input = (
    <input
      id={id}
      className="number-field__input"
      type="text"
      inputMode={kind === 'decimal' ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={text}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        setText(e.target.value);
        const n = parse(e.target.value);
        if (n !== null) {
          const next = clamp(n);
          if (next !== value) onChange(next);
        }
      }}
      onBlur={() => {
        const n = parse(text);
        commit(n === null ? (text.trim() === '' ? min : value) : n);
      }}
    />
  );

  return (
    <div className="number-field">
      <label htmlFor={id} className={showLabel ? 'number-field__label' : 'visually-hidden'}>
        {label}
      </label>
      <div className="number-field__control">
        {step !== undefined && (
          <button
            type="button"
            className="number-field__btn"
            aria-label={`${label} : moins ${toInputText(step)}`}
            onClick={() => commit(value - step)}
          >
            −
          </button>
        )}
        {input}
        {suffix && <span className="number-field__suffix">{suffix}</span>}
        {step !== undefined && (
          <button
            type="button"
            className="number-field__btn"
            aria-label={`${label} : plus ${toInputText(step)}`}
            onClick={() => commit(value + step)}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
