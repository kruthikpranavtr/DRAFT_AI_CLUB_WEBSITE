import { useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import useHeroEntrance from './useHeroEntrance';
import './HeroIntro.css';

export default function HeroIntro({ panel, onExplore, onChat, status }) {
  const copyRef = useRef(null);
  useHeroEntrance(copyRef);
  return <>
    <div className="hero-intro__copy" ref={copyRef}>
      <h1 className="hero-intro__headline" id="story-title-home">{panel.title}</h1>
      <p className="hero-intro__lede hero-appear hero-appear--soft" style={{ '--d': '.82s', '--duration': '1.25s' }}>{panel.body}</p>
      <div className="hero-intro__actions">
        <button className="hero-intro__button hero-intro__button--primary hero-appear hero-appear--btn" style={{ '--d': '.96s' }} onClick={onExplore}>Explore the Club</button>
        <button className="hero-intro__button hero-intro__button--glass hero-appear hero-appear--side" style={{ '--d': '1.1s' }} onClick={onChat}>Talk to our AI <MessageSquare size={15}/></button>
      </div>
      <p className="hero-intro__scroll" role="status">{status}</p>
    </div>
  </>;
}
