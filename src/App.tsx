import { X } from 'lucide-react';
import { useLayoutEffect } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import BrandHeader from './components/BrandHeader';
import ResumeBanner from './components/ResumeBanner';
import { ToastHost, ToastProvider, useToast } from './components/Toast';
import ActiveSessionPage from './pages/ActiveSessionPage';
import HistoryPage from './pages/HistoryPage';
import ProgramsPage from './pages/ProgramsPage';
import ProgressPage from './pages/ProgressPage';
import SessionDetailPage from './pages/SessionDetailPage';
import SessionSummaryPage from './pages/SessionSummaryPage';
import SettingsPage from './pages/SettingsPage';
import TemplateEditorPage from './pages/TemplateEditorPage';
import TemplatesPage from './pages/TemplatesPage';
import { useAppStore } from './state/AppStore';

/** 3 onglets (identity.md §1). Les Réglages s'ouvrent depuis l'en-tête de l'onglet Séances. */
const TABS = [
  { to: '/seances', label: 'Séances' },
  { to: '/historique', label: 'Historique' },
  { to: '/progres', label: 'Progrès' },
] as const;

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </HashRouter>
  );
}

function Shell() {
  const { loadError, saveFailed, actions } = useAppStore();
  const { pathname } = useLocation();
  const { dismissOnSessionStart } = useToast();
  // La séance en cours est un écran plein : pas de barre d'onglets ni de bannière de reprise.
  const isSession = pathname === '/seance';
  // Constructeur (/seances/nouvelle, /seances/:id) et programmes de départ (/seances/programmes) :
  // plein écran avec leur barre d'action fixe.
  const isEditor = /^\/seances\/[^/]+$/.test(pathname);
  // Réglages : page plein écran ouverte depuis Séances, avec retour « ‹ Séances ».
  const fullscreen = isSession || isEditor || pathname === '/reglages';
  // Séance et constructeur affichent le toast dans leur propre bas d'écran, au-dessus du bouton principal.
  const ownToastHost = isSession || isEditor;
  // Logotype en tête des 3 onglets uniquement (pas en séance, récap, détail, constructeur ni réglages).
  const isTab = TABS.some((tab) => tab.to === pathname);

  // Chaque écran s'ouvre en haut : sinon la séance démarrée depuis une liste défilée s'ouvre défilée
  // (nom de l'exercice et note hors de l'écran). Effet de mise en page : il passe avant les effets
  // des pages, qui peuvent ensuite faire défiler vers un élément (séance ajoutée).
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Entrée dans l'écran de séance (carte, séance libre, reprise) : les toasts liés à une action
  // qui ne doit plus s'annuler pendant une séance (ajout de programme) se ferment avant l'affichage.
  useLayoutEffect(() => {
    if (isSession) dismissOnSessionStart();
  }, [isSession, dismissOnSessionStart]);

  return (
    <div className="app">
      {loadError && (
        <div className="banner banner--warning banner--dismissible" role="alert">
          <span className="banner__text">{loadError}</span>
          <button
            type="button"
            className="icon-btn banner__close"
            aria-label="Fermer le message"
            onClick={actions.dismissLoadError}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      )}
      {saveFailed && (
        <div className="banner banner--danger" role="alert">
          Impossible d’enregistrer sur l’appareil (stockage plein ou indisponible). Exporte tes données depuis
          Réglages pour ne pas perdre tes dernières modifications.
        </div>
      )}
      {!isSession && <ResumeBanner />}
      <main className={`app__content${fullscreen ? ' app__content--fullscreen' : ''}`}>
        {isTab && <BrandHeader />}
        <Routes>
          <Route path="/seances" element={<TemplatesPage />} />
          <Route path="/seances/nouvelle" element={<TemplateEditorPage />} />
          <Route path="/seances/programmes" element={<ProgramsPage />} />
          <Route path="/seances/:id" element={<TemplateEditorPage />} />
          <Route path="/seance" element={<ActiveSessionPage />} />
          <Route path="/resume/:id" element={<SessionSummaryPage />} />
          <Route path="/historique" element={<HistoryPage />} />
          <Route path="/historique/:id" element={<SessionDetailPage />} />
          <Route path="/progres" element={<ProgressPage />} />
          <Route path="/reglages" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/seances" replace />} />
        </Routes>
      </main>
      {!ownToastHost && <ToastHost placement="floating" aboveTabbar={!fullscreen} />}
      {!fullscreen && (
        <nav className="tabbar" aria-label="Navigation principale">
          {TABS.map((tab) => (
            <NavLink key={tab.to} to={tab.to} className="tabbar__item">
              {tab.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
