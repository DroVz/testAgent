import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { normalizeSearch } from '../lib/format';
import { MUSCLE_GROUPS, type MuscleGroup } from '../lib/types';
import { useAppStore } from '../state/AppStore';

export interface ExercisePickerProps {
  onSelect(exerciseId: string): void;
  onClose(): void;
}

/**
 * Sélecteur d'exercice plein écran : recherche (insensible aux accents), filtre par groupe musculaire
 * et création d'un exercice personnalisé.
 */
export default function ExercisePicker({ onSelect, onClose }: ExercisePickerProps) {
  const { state, actions } = useAppStore();
  const titleId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState<MuscleGroup>('Autre');
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const q = normalizeSearch(query);
    return state.exercises
      .filter((e) => (group === null || e.muscleGroup === group) && normalizeSearch(e.name).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [state.exercises, query, group]);

  const startCreate = () => {
    setNewName(query.trim());
    setNewGroup(group ?? 'Autre');
    setCreating(true);
  };

  const create = () => {
    const name = newName.trim();
    if (name === '') return;
    onSelect(actions.addCustomExercise(name, newGroup));
  };

  return (
    <div className="picker" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="picker__header">
        <h2 id={titleId} className="picker__title">
          Ajouter un exercice
        </h2>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Fermer
        </button>
      </header>

      {creating ? (
        <form
          className="picker__create"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <label className="field">
            <span className="field__label">Nom de l’exercice</span>
            <input
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              maxLength={60}
            />
          </label>
          <label className="field">
            <span className="field__label">Groupe musculaire</span>
            <select className="input" value={newGroup} onChange={(e) => setNewGroup(e.target.value as MuscleGroup)}>
              {MUSCLE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <div className="row">
            <button type="button" className="btn" onClick={() => setCreating(false)}>
              Retour
            </button>
            <button type="submit" className="btn btn--primary" disabled={newName.trim() === ''}>
              Créer et ajouter
            </button>
          </div>
        </form>
      ) : (
        <>
          <input
            ref={searchRef}
            className="input picker__search"
            type="search"
            placeholder="Rechercher…"
            aria-label="Rechercher un exercice"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="chips" role="group" aria-label="Groupe musculaire">
            <button type="button" className="chip" aria-pressed={group === null} onClick={() => setGroup(null)}>
              Tous
            </button>
            {MUSCLE_GROUPS.map((g) => (
              <button key={g} type="button" className="chip" aria-pressed={group === g} onClick={() => setGroup(g)}>
                {g}
              </button>
            ))}
          </div>
          <ul className="picker__list">
            {results.map((e) => (
              <li key={e.id}>
                <button type="button" className="picker__item" onClick={() => onSelect(e.id)}>
                  <span>{e.name}</span>
                  <span className="muted picker__group">{e.muscleGroup}</span>
                </button>
              </li>
            ))}
          </ul>
          {results.length === 0 && <p className="muted picker__empty">Aucun exercice trouvé.</p>}
          <button type="button" className="btn btn--block" onClick={startCreate}>
            + Créer un exercice{query.trim() ? ` « ${query.trim()} »` : ''}
          </button>
        </>
      )}
    </div>
  );
}
