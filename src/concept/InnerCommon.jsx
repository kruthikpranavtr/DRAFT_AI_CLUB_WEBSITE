import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import './InnerPages.css';

export const conceptPhotos = [
  '/concept/club-event.jpg',
  '/concept/club-workshop.jpg',
  '/concept/club-talk.jpg',
  '/concept/club-project.jpg',
  '/concept/club-learning.jpg',
  '/concept/club-collaboration.jpg',
  '/concept/club-team.jpg',
  '/concept/club-discussion.jpg',
  '/concept/club-presentation.jpg',
  '/concept/club-innovation.jpg',
];

export function ConceptFooter() {
  return <footer className="concept-footer">
    <div className="concept-wrap concept-footer__inner">
      <Link to="/" className="concept-footer__brand">
        <span className="concept-footer__symbol">AI</span>
        <span><strong>AI CLUB</strong><small>Ideas. People. Impact.</small></span>
      </Link>
      <nav aria-label="Footer navigation">
        <Link to="/">Home</Link><Link to="/gallery">Gallery</Link><Link to="/about">About</Link><Link to="/news">News</Link>
      </nav>
      <span className="concept-footer__note">Built by curious minds, for a brighter tomorrow.</span>
    </div>
  </footer>;
}

export function ConceptCTA({ title = 'Good ideas grow together.', subtitle = 'Explore a community where curiosity becomes something real.' }) {
  return <section className="concept-cta concept-wrap">
    <div className="concept-cta__copy"><span className="concept-kicker">BE PART OF THE STORY</span><h2>{title}</h2><p>{subtitle}</p></div>
    <Link className="concept-button concept-button--solid" to="/login">Join AI Club <ArrowRight size={17}/></Link>
  </section>;
}

export function ConceptHeading({ kicker, children, description }) {
  return <div className="concept-section-head">
    <div><span className="concept-kicker">{kicker}</span><h2>{children}</h2></div>
    {description && <p>{description}</p>}
  </div>;
}
