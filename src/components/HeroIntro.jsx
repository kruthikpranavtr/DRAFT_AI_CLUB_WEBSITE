import { useRef } from 'react';
import { BrainCircuit, Code2, MessageSquare, Users } from 'lucide-react';
import useHeroEntrance from './useHeroEntrance';
import './HeroIntro.css';

const highlights = [
  { Icon: BrainCircuit, label: 'Learn', detail: 'Hands-on AI sessions' },
  { Icon: Code2, label: 'Build', detail: 'Projects and experiments' },
  { Icon: Users, label: 'Connect', detail: 'A student community' },
];
export default function HeroIntro({ panel, onExplore, onChat, status }) {
  const copyRef = useRef(null);
  const highlightsRef = useRef(null);
  useHeroEntrance(copyRef);
  useHeroEntrance(highlightsRef);
  return <>
    <div className="hero-intro__copy" ref={copyRef}>
      <p className="hero-intro__badge hero-appear hero-appear--pop" style={{ '--d': '.22s' }}>
        <svg className="hero-intro__star hero-appear hero-appear--star" width="18" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ '--d': '.28s' }}><path d="M12 2.6C12.55 2.6 12.88 3.15 13.08 4.7c.62 4.7 1.52 5.6 6.22 6.22 1.55.2 2.1.53 2.1 1.08s-.55.88-2.1 1.08c-4.7.62-5.6 1.52-6.22 6.22-.2 1.55-.53 2.1-1.08 2.1s-.88-.55-1.08-2.1c-.62-4.7-1.52-5.6-6.22-6.22C3.15 12.88 2.6 12.55 2.6 12s.55-.88 2.1-1.08c4.7-.62 5.6-1.52 6.22-6.22C11.12 3.15 11.45 2.6 12 2.6Z"/></svg>
        {panel.eyebrow}
      </p>
      <h1 className="hero-intro__headline" id="story-title-home">{panel.title}</h1>
      <p className="hero-intro__lede hero-appear hero-appear--soft" style={{ '--d': '.82s', '--duration': '1.25s' }}>{panel.body}</p>
      <div className="hero-intro__actions">
        <button className="hero-intro__button hero-intro__button--primary hero-appear hero-appear--btn" style={{ '--d': '.96s' }} onClick={onExplore}>Explore the Club</button>
        <button className="hero-intro__button hero-intro__button--glass hero-appear hero-appear--side" style={{ '--d': '1.1s' }} onClick={onChat}>Talk to our AI <MessageSquare size={15}/></button>
      </div>
      <p className="hero-intro__scroll" role="status">{status}</p>
    </div>
    <dl className="hero-intro__highlights" ref={highlightsRef} aria-label="What happens at AI Club">
      {highlights.map(({ Icon, label, detail }, index) => <div className="hero-intro__highlight hero-appear hero-appear--stat" style={{ '--d': (1.12 + index * .16).toFixed(2) + 's' }} key={label}>
        <Icon size={20} aria-hidden="true"/><div><dt>{label}</dt><dd>{detail}</dd></div>
      </div>)}
    </dl>
  </>;
}
