import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PRIVACY_BLOCKS, PRIVACY_TITLE } from '../lib/privacyText';

/** Politique de confidentialité (/confidentialite), ouverte depuis Réglages › À propos (lot 4, §4.8). */
export default function ConfidentialitePage() {
  return (
    <section className="page">
      <Link to="/reglages" className="back-link">
        <ChevronLeft size={20} aria-hidden="true" />
        Réglages
      </Link>
      <h1 className="page__title">{PRIVACY_TITLE}</h1>
      <div className="card privacy-text">
        {PRIVACY_BLOCKS.map((block, i) => {
          const inner = (
            <>
              {block.strong && <strong>{block.strong}</strong>}
              {block.text}
            </>
          );
          return <p key={i}>{block.emphasis ? <em>{inner}</em> : inner}</p>;
        })}
      </div>
    </section>
  );
}
