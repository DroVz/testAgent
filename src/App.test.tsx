import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { AppStoreProvider } from './state/AppStore';

describe('App', () => {
  it('affiche la barre d’onglets et navigue entre les pages', () => {
    window.location.hash = '';
    render(
      <AppStoreProvider storage={{ getItem: () => null, setItem: () => {} }}>
        <App />
      </AppStoreProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Séances' })).toBeInTheDocument();
    for (const label of ['Séances', 'Historique', 'Progrès', 'Réglages']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('link', { name: 'Progrès' }));
    expect(screen.getByRole('heading', { name: 'Progrès' })).toBeInTheDocument();
  });
});
