import { fireEvent, render, screen, within } from '@testing-library/react';
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
    // 3 onglets : Séances · Historique · Progrès (Réglages = bouton de l'en-tête de Séances)
    const nav = within(screen.getByRole('navigation', { name: 'Navigation principale' }));
    expect(nav.getAllByRole('link').map((a) => a.textContent)).toEqual(['Séances', 'Historique', 'Progrès']);
    expect(nav.queryByRole('link', { name: 'Réglages' })).not.toBeInTheDocument();
    fireEvent.click(nav.getByRole('link', { name: 'Progrès' }));
    expect(screen.getByRole('heading', { name: 'Progrès' })).toBeInTheDocument();
  });

  it('la route /reglages continue de fonctionner (plein écran, retour vers Séances)', () => {
    window.location.hash = '#/reglages';
    render(
      <AppStoreProvider storage={{ getItem: () => null, setItem: () => {} }}>
        <App />
      </AppStoreProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Réglages' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Séances' }));
    expect(screen.getByRole('heading', { name: 'Séances' })).toBeInTheDocument();
  });
});
