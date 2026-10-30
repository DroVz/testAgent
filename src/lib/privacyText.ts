import { COLON } from './format';

/**
 * Politique de confidentialité (lot 4, §4.8) : source unique du texte affiché dans l'app
 * (`ConfidentialitePage`) et dans la page publique `confidentialite.html` (injecté au build).
 *
 * Fichier importé par `vite.config.ts` : pas de dépendance au DOM ni à React.
 */

/** Date de publication de la politique : à renseigner par le propriétaire avant l'envoi en revue. */
export const PRIVACY_LAST_UPDATED = 'à compléter';
/** Adresse de contact (question 2 du lot 4) : à renseigner par le propriétaire. */
export const PRIVACY_CONTACT = 'à compléter';

export const PRIVACY_TITLE = 'Confidentialité';

/** Un bloc du texte : début en gras facultatif, suite, ou ligne entière en italique. */
export interface PrivacyBlock {
  strong?: string;
  /** Suite du bloc, avec son espace (ou son « : ») de jonction après la partie en gras. */
  text: string;
  emphasis?: boolean;
}

export const PRIVACY_BLOCKS: readonly PrivacyBlock[] = [
  { text: `Dernière mise à jour${COLON} ${PRIVACY_LAST_UPDATED}.`, emphasis: true },
  {
    strong: 'MuscuTrack ne collecte aucune donnée.',
    text: ' L’app n’a ni compte, ni serveur, ni publicité, ni outil de mesure d’audience. Elle ne se connecte pas à Internet.',
  },
  {
    strong: 'Ce qui est enregistré, et où.',
    text: ' Tes séances, séances types, exercices et réglages sont enregistrés uniquement sur ton téléphone. Personne d’autre que toi n’y a accès, pas même nous.',
  },
  {
    strong: 'Tiers.',
    text: ' Aucune donnée n’est transmise à un tiers. Si tu sauvegardes ton iPhone sur iCloud ou sur un ordinateur, cette sauvegarde peut contenir les données de l’app ; elle est alors gérée par Apple ou par toi, selon tes réglages.',
  },
  {
    strong: 'Notifications.',
    text: ' Les rappels et la fin de repos sont des notifications locales, programmées par le téléphone lui-même. Rien n’est envoyé.',
  },
  { strong: 'Export.', text: ' Quand tu exportes tes données, c’est toi qui choisis où le fichier va.' },
  {
    strong: 'Durée et suppression.',
    text: ` Les données restent tant que l’app est installée. Pour tout effacer${COLON} Réglages › Zone sensible › Réinitialiser, ou supprime l’app.`,
  },
  { strong: 'Contact', text: `${COLON} ${PRIVACY_CONTACT}.` },
];

/** Texte brut d'un bloc (comparaison app / page publique). */
export function privacyBlockText(block: PrivacyBlock): string {
  return `${block.strong ?? ''}${block.text}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Contenu HTML (titre et blocs) injecté dans `confidentialite.html` au build. */
export function renderPrivacyHtml(): string {
  const blocks = PRIVACY_BLOCKS.map((b) => {
    const inner = `${b.strong ? `<strong>${escapeHtml(b.strong)}</strong>` : ''}${escapeHtml(b.text)}`;
    return `      <p>${b.emphasis ? `<em>${inner}</em>` : inner}</p>`;
  });
  return [`      <h1>${escapeHtml(PRIVACY_TITLE)}</h1>`, ...blocks].join('\n');
}

/** Repère de `public/confidentialite.html` remplacé au build par le texte. */
export const PRIVACY_PLACEHOLDER = '<!--privacy:content-->';

/** Page publique complète : le modèle de `public/confidentialite.html`, texte injecté. */
export function buildPrivacyPage(template: string): string {
  if (!template.includes(PRIVACY_PLACEHOLDER)) throw new Error('confidentialite.html : repère du texte absent');
  return template.replace(PRIVACY_PLACEHOLDER, () => renderPrivacyHtml());
}
