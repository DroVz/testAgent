import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { BACKUP_KEY } from './lib/backup';

// jsdom n'implémente pas le défilement : App remet la page en haut à chaque changement de route.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
// Ni scrollIntoView : la liste défile vers la séance ajoutée, l'écran de choix vers la première carte.
Element.prototype.scrollIntoView = vi.fn();

// Lot 5 : la date du dernier export (localStorage, hors état de l'app) ne passe pas d'un test à l'autre.
afterEach(() => {
  try {
    localStorage.removeItem(BACKUP_KEY);
  } catch {
    // Stockage indisponible : rien à effacer.
  }
});
