import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { requestPersistentStorage } from './lib/webPlatform';
import { AppStoreProvider } from './state/AppStore';
import './fonts.css';
import './styles.css';

// Données locales : on demande au navigateur de ne pas les effacer (une fois, sans retour affiché).
void requestPersistentStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStoreProvider>
      <App />
    </AppStoreProvider>
  </StrictMode>,
);
