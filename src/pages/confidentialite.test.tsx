import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { PRIVACY_BLOCKS, buildPrivacyPage, privacyBlockText } from '../lib/privacyText';
import { AppStoreProvider } from '../state/AppStore';
import ConfidentialitePage from './ConfidentialitePage';
import { MemoryRouter } from 'react-router-dom';

/** Réglages › À propos et page Confidentialité (lot 4, §4.8), sur le web ; export web inchangé (§4.6). */

const mocks = vi.hoisted(() => ({
  share: vi.fn(),
  writeFile: vi.fn(),
}));
vi.mock('@capacitor/share', () => ({ Share: { share: mocks.share } }));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Library: 'LIBRARY', Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: { writeFile: mocks.writeFile },
}));

function renderAt(hash: string) {
  window.location.hash = hash;
  return render(
    <AppStoreProvider storage={{ getItem: () => null, setItem: () => undefined }}>
      <App />
    </AppStoreProvider>,
  );
}

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Réglages › À propos', () => {
  it('version, lien « Confidentialité » vers #/confidentialite, puis retour à Réglages', () => {
    renderAt('#/reglages');
    const about = screen.getByRole('heading', { name: 'À propos' }).parentElement!;
    expect(within(about).getByText('Version 1.0.0')).toBeInTheDocument();
    const link = within(about).getByRole('link', { name: 'Confidentialité' });
    expect(link).toHaveAttribute('href', '#/confidentialite');

    fireEvent.click(link);
    expect(window.location.hash).toBe('#/confidentialite');
    expect(screen.getByRole('heading', { level: 1, name: 'Confidentialité' })).toBeInTheDocument();
    const blocks = document.querySelectorAll('.privacy-text p');
    expect(blocks).toHaveLength(8);
    expect(screen.getByText('MuscuTrack ne collecte aucune donnée.')).toBeInTheDocument();
    // Plein écran : pas de barre d'onglets.
    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Réglages' }));
    expect(window.location.hash).toBe('#/reglages');
    expect(screen.getByRole('heading', { level: 1, name: 'Réglages' })).toBeInTheDocument();
  });
});

describe('texte de la politique', () => {
  it('8 blocs, typographie du projet (espace insécable avant « : », apostrophes typographiques, pas de « ! »)', () => {
    expect(PRIVACY_BLOCKS).toHaveLength(8);
    for (const block of PRIVACY_BLOCKS) {
      const text = privacyBlockText(block);
      expect(text).not.toMatch(/ :|'|!/);
    }
  });

  it('page de l’app et confidentialite.html : même texte (source unique)', () => {
    render(
      <MemoryRouter>
        <ConfidentialitePage />
      </MemoryRouter>,
    );
    const appText = [screen.getByRole('heading', { level: 1 }), ...document.querySelectorAll('.privacy-text p')].map(
      (el) => normalize(el.textContent ?? ''),
    );

    const template = readFileSync(join(process.cwd(), 'public', 'confidentialite.html'), 'utf8');
    const page = new DOMParser().parseFromString(buildPrivacyPage(template), 'text/html');
    const publicText = [...page.querySelectorAll('main h1, main p')].map((el) => normalize(el.textContent ?? ''));

    expect(publicText).toEqual(appText);
    expect(publicText).toHaveLength(9);
  });
});

describe('Réglages › Sauvegarde (web) : export inchangé', () => {
  it('téléchargement, sans feuille de partage ni Filesystem', () => {
    const createObjectURL = vi.fn(() => 'blob:muscutrack');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderAt('#/reglages');
    expect(screen.getByText(/dans ce navigateur/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Exporter mes données' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Fichier téléchargé. Tu peux aussi copier le texte ci-dessous.')).toBeInTheDocument();
    expect(mocks.share).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });
});
