import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom n'implémente pas le défilement : App remet la page en haut à chaque changement de route.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
// Ni scrollIntoView : la liste défile vers la séance ajoutée, l'écran de choix vers la première carte.
Element.prototype.scrollIntoView = vi.fn();
