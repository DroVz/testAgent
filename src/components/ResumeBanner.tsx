import { Link } from 'react-router-dom';
import { useAppStore } from '../state/AppStore';

/** Bannière de reprise de la séance en cours (affichée hors de l'écran de séance). */
export default function ResumeBanner() {
  const { state } = useAppStore();
  if (!state.activeSession) return null;
  return (
    <Link to="/seance" className="resume-banner">
      <span className="resume-banner__text">
        Séance en cours <span className="resume-banner__name">· {state.activeSession.name}</span>
      </span>
      <span className="resume-banner__action">Reprendre</span>
    </Link>
  );
}
