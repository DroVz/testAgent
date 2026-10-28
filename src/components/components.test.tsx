import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppStoreProvider, useAppStore } from '../state/AppStore';
import ConfirmDialog from './ConfirmDialog';
import ExercisePicker from './ExercisePicker';
import NumberField from './NumberField';
import RestTimer from './RestTimer';

describe('ConfirmDialog', () => {
  it('rien si fermée ; sinon dialogue accessible, focus sur Annuler, Échap = annuler', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <ConfirmDialog open={false} title="Supprimer ?" confirmLabel="Supprimer" onCancel={onCancel} onConfirm={onConfirm} />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(<ConfirmDialog open title="Supprimer ?" confirmLabel="Supprimer" onCancel={onCancel} onConfirm={onConfirm} />);
    expect(screen.getByRole('dialog', { name: 'Supprimer ?' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

function ControlledNumber(props: { kind?: 'decimal' | 'integer'; step?: number; initial: number; max?: number }) {
  const [value, setValue] = useState(props.initial);
  return (
    <>
      <NumberField label="Poids" kind={props.kind} step={props.step} max={props.max} value={value} onChange={setValue} />
      <output>{value}</output>
    </>
  );
}

describe('NumberField', () => {
  it('accepte la virgule et conserve la saisie en cours', () => {
    render(<ControlledNumber initial={60} />);
    const input = screen.getByLabelText('Poids');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    fireEvent.change(input, { target: { value: '62,' } });
    expect(input).toHaveValue('62,');
    expect(screen.getByRole('status')).toHaveTextContent('62');
    fireEvent.change(input, { target: { value: '62,5' } });
    expect(screen.getByRole('status')).toHaveTextContent('62.5');
  });

  it('saisie invalide : valeur conservée puis texte restauré au blur ; vide → 0', () => {
    render(<ControlledNumber initial={60} />);
    const input = screen.getByLabelText('Poids');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(screen.getByRole('status')).toHaveTextContent('60');
    fireEvent.blur(input);
    expect(input).toHaveValue('60');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('0');
    expect(screen.getByRole('status')).toHaveTextContent('0');
  });

  it('boutons −/+ et bornes', () => {
    render(<ControlledNumber initial={1} step={2.5} max={5} />);
    fireEvent.click(screen.getByRole('button', { name: 'Poids : moins 2,5' }));
    expect(screen.getByLabelText('Poids')).toHaveValue('0');
    fireEvent.click(screen.getByRole('button', { name: 'Poids : plus 2,5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Poids : plus 2,5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Poids : plus 2,5' }));
    expect(screen.getByLabelText('Poids')).toHaveValue('5');
  });

  it('mode entier : clavier numérique, décimales refusées', () => {
    render(<ControlledNumber kind="integer" initial={10} />);
    const input = screen.getByLabelText('Poids');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    fireEvent.change(input, { target: { value: '8,5' } });
    expect(screen.getByRole('status')).toHaveTextContent('10');
  });
});

describe('RestTimer', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('affiche le temps restant calculé depuis le timestamp de fin', () => {
    const onAdjust = vi.fn();
    const onDismiss = vi.fn();
    render(<RestTimer endsAt={100_000} now={() => 10_000} onAdjust={onAdjust} onDismiss={onDismiss} />);
    expect(screen.getByRole('timer')).toHaveTextContent('01:30');
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter 15 secondes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retirer 15 secondes' }));
    expect(onAdjust.mock.calls).toEqual([[15], [-15]]);
    fireEvent.click(screen.getByRole('button', { name: 'Passer' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('fin du repos : message et vibration (une seule fois)', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, vibrate });
    const { rerender } = render(<RestTimer endsAt={5_000} now={() => 10_000} onAdjust={() => {}} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Repos terminé');
    rerender(<RestTimer endsAt={5_000} now={() => 11_000} onAdjust={() => {}} onDismiss={() => {}} />);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('sans API de vibration : pas d’erreur', () => {
    vi.stubGlobal('navigator', { ...navigator, vibrate: undefined });
    render(<RestTimer endsAt={0} now={() => 1} onAdjust={() => {}} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('ExercisePicker', () => {
  function setup() {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const store: { names?: string[] } = {};
    function Probe() {
      store.names = useAppStore().state.exercises.map((e) => e.name);
      return null;
    }
    render(
      <AppStoreProvider storage={{ getItem: () => null, setItem: () => {} }}>
        <ExercisePicker onSelect={onSelect} onClose={onClose} />
        <Probe />
      </AppStoreProvider>,
    );
    return { onSelect, onClose, store };
  }

  const names = () => screen.getAllByRole('listitem').map((li) => li.querySelector('span')?.textContent);

  it('recherche insensible aux accents et filtre par groupe', () => {
    const { onSelect } = setup();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ELEVATIONS' } });
    expect(names()).toEqual(['Élévations latérales']);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'curl' } });
    fireEvent.click(screen.getByRole('button', { name: 'Jambes' }));
    expect(names()).toEqual(['Leg curl']);
    fireEvent.click(screen.getByRole('button', { name: 'Tous' }));
    expect(names()).toHaveLength(4);
    fireEvent.click(screen.getByText('Leg curl'));
    expect(onSelect).toHaveBeenCalledWith('leg-curl');
  });

  it('crée un exercice personnalisé', () => {
    const { onSelect, store } = setup();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Pull-over' } });
    expect(screen.getByText('Aucun exercice trouvé.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ Créer un exercice « Pull-over »' }));
    expect(screen.getByRole('textbox', { name: 'Nom de l’exercice' })).toHaveValue('Pull-over');
    fireEvent.change(screen.getByRole('combobox', { name: 'Groupe musculaire' }), { target: { value: 'Dos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer et ajouter' }));
    expect(store.names).toContain('Pull-over');
    expect(onSelect).toHaveBeenCalledWith(expect.stringMatching(/^custom-/));
  });

  it('Échap ferme le sélecteur', () => {
    const { onClose } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
