import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Export par la feuille de partage d'iOS (lot 4, §4.6). Le web garde le téléchargement : la page
 * ne passe par ici que dans l'app (`isNative()`).
 */

export const SHARE_TITLE = 'Sauvegarde MuscuTrack';

export type ShareOutcome = 'shared' | 'cancelled' | 'failed';

/** iOS rejette avec « Share canceled » quand l'utilisateur ferme la feuille : ce n'est pas une erreur. */
function isCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return /cancel/i.test(message);
}

/**
 * Écrit le fichier d'export dans le cache de l'app puis ouvre la feuille de partage.
 * Ne lève jamais d'exception.
 */
export async function shareExportFile(text: string, fileName: string): Promise<ShareOutcome> {
  let uri: string;
  try {
    ({ uri } = await Filesystem.writeFile({
      path: fileName,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    }));
  } catch {
    return 'failed';
  }
  try {
    await Share.share({ title: SHARE_TITLE, files: [uri] });
    return 'shared';
  } catch (error) {
    return isCancellation(error) ? 'cancelled' : 'failed';
  }
}
