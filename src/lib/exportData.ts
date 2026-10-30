/**
 * Export des données, partagé par Réglages et le récap (lot 5) : feuille de partage si elle accepte
 * un fichier, sinon téléchargement. À appeler directement dans le geste de l'utilisateur.
 * Un partage réussi ou un téléchargement déclenché pose la date du dernier export.
 */
import { markExported } from './backup';
import { exportFileName, exportState } from './storage';
import type { AppState } from './types';
import { shareTextFile } from './webPlatform';

/**
 * shared : feuille de partage utilisée ; downloaded : téléchargement déclenché ; unavailable : ni
 * partage ni téléchargement (le texte reste à copier) ; cancelled : feuille fermée sans choix.
 */
export type ExportOutcome = 'shared' | 'downloaded' | 'unavailable' | 'cancelled';

export interface ExportResult {
  outcome: ExportOutcome;
  /** Texte JSON exporté. */
  text: string;
}

/** Déclenche le téléchargement d'un fichier texte ; renvoie false si le navigateur ne le permet pas. */
export function downloadText(text: string, filename: string): boolean {
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

/**
 * Lance l'export de `state`. `onResult` est appelé tout de suite sans feuille de partage (même geste,
 * même résultat qu'avant le lot), sinon quand la feuille se ferme.
 */
export function startExport(state: AppState, onResult: (result: ExportResult) => void): void {
  const text = exportState(state);
  const fileName = exportFileName();
  const download = () => {
    const ok = downloadText(text, fileName);
    if (ok) markExported();
    onResult({ outcome: ok ? 'downloaded' : 'unavailable', text });
  };
  const sharing = shareTextFile(text, fileName);
  if (!sharing) {
    download();
    return;
  }
  void sharing.then((outcome) => {
    // Feuille fermée sans choisir : rien ne change.
    if (outcome === 'cancelled') onResult({ outcome: 'cancelled', text });
    else if (outcome === 'failed') download();
    else {
      markExported();
      onResult({ outcome: 'shared', text });
    }
  });
}
