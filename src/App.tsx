import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import HistoryPage from './pages/HistoryPage';
import ProgressPage from './pages/ProgressPage';
import SettingsPage from './pages/SettingsPage';
import TemplatesPage from './pages/TemplatesPage';
import { useAppStore } from './state/AppStore';

const TABS = [
  { to: '/seances', label: 'Séances' },
  { to: '/historique', label: 'Historique' },
  { to: '/progres', label: 'Progrès' },
  { to: '/reglages', label: 'Réglages' },
] as const;

export default function App() {
  const { loadError } = useAppStore();
  return (
    <HashRouter>
      <div className="app">
        {loadError && (
          <div className="banner banner--warning" role="alert">
            {loadError}
          </div>
        )}
        <main className="app__content">
          <Routes>
            <Route path="/seances" element={<TemplatesPage />} />
            <Route path="/historique" element={<HistoryPage />} />
            <Route path="/progres" element={<ProgressPage />} />
            <Route path="/reglages" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/seances" replace />} />
          </Routes>
        </main>
        <nav className="tabbar" aria-label="Navigation principale">
          {TABS.map((tab) => (
            <NavLink key={tab.to} to={tab.to} className="tabbar__item">
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </HashRouter>
  );
}
