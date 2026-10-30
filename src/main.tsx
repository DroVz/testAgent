import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import type { StorageLike } from './lib/storage';
import { isNative } from './platform';
import { createDurableStorage, createWebStorage } from './platform/storage';
import { hideSplash, scheduleSplashFallback, syncStatusBar } from './platform/systemUi';
import { AppStoreProvider } from './state/AppStore';
import './fonts.css';
import './styles.css';

function render(storage: StorageLike | undefined, loadWarning?: string) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppStoreProvider storage={storage} loadWarning={loadWarning}>
        <App />
      </AppStoreProvider>
    </StrictMode>,
  );
}

/** App iOS (lot 4) : le fichier de données est chargé avant le premier rendu, sous l'écran de lancement. */
async function startNative() {
  scheduleSplashFallback();
  syncStatusBar();
  const storage = createDurableStorage();
  const { warning } = await storage.hydrate();
  render(storage, warning);
  requestAnimationFrame(() => hideSplash());
}

// Web : rendu immédiat, sans rien attendre, comme avant le lot 4.
if (isNative()) void startNative();
else render(createWebStorage());
