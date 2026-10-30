import type { CapacitorConfig } from '@capacitor/cli';

/**
 * App iOS (lot 4, docs/product/lot4-app-store.md §4.1). Même `src/` que la PWA, construit par
 * `npm run build:native`. Aucune clé `server` : tout le contenu est dans le paquet de l'app,
 * rien n'est chargé depuis le réseau.
 */
const config: CapacitorConfig = {
  // Ne pourra plus changer après la première publication.
  appId: 'fr.muscutrack.app',
  appName: 'MuscuTrack',
  webDir: 'dist',
  plugins: {
    // Caché par le code après le chargement des données (src/platform/systemUi.ts).
    SplashScreen: { launchAutoHide: false, backgroundColor: '#F5F5FA' },
    // Rien n'est présenté quand l'app est au premier plan (lot 4, §4.3).
    LocalNotifications: { presentationOptions: [] },
  },
};

export default config;
