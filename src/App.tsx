import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ResumeBanner from './components/ResumeBanner';
import ActiveSessionPage from './pages/ActiveSessionPage';
import HistoryPage from './pages/HistoryPage';
import ProgressPage from './pages/ProgressPage';
import SessionDetailPage from './pages/SessionDetailPage';
import SessionSummaryPage from './pages/SessionSummaryPage';
import SettingsPage from './pages/SettingsPage';
import TemplateEditorPage from './pages/TemplateEditorPage';
import TemplatesPage from './pages/TemplatesPage';
import { useAppStore } from './state/AppStore';

const TABS = [
  { to: '/seances', label: 'Séances' },
  { to: '/historique', label: 'Historique' },
  { to: '/progres', label: 'Progrès' },
  { to: '/reglages', label: 'Réglages' },
] as const;

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}

function Shell() {
  const { loadError, saveFailed, actions } = useAppStore();
  const { pathname } = useLocation();
  // La séance en cours est un écran plein : pas de barre d'onglets ni de bannière de reprise.
  const fullscreen = pathname === '/seance';

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
            ✕
          </button>
        </div>
      )}
      {saveFailed && (
        <div className="banner banner--danger" role="alert">
          La sauvegarde a échoué (stockage plein ou indisponible) : vos dernières modifications risquent d’être
          perdues.
        </div>
      )}
      {!fullscreen && <ResumeBanner />}
      <main className={`app__content${fullscreen ? ' app__content--fullscreen' : ''}`}>
        <Routes>
          <Route path="/seances" element={<TemplatesPage />} />
          <Route path="/seances/nouvelle" element={<TemplateEditorPage />} />
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
