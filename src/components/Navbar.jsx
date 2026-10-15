import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import useHeroEntrance from './useHeroEntrance';
const links = [['/', 'Home'], ['/gallery', 'Gallery'], ['/news', 'News'], ['/about', 'About']];
export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const home = pathname === '/';
  const headerRef = useRef(null);
  useHeroEntrance(headerRef, home);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = e => { if (e.key === 'Escape') setOpen(false); };
    const resize = () => { if (window.innerWidth > 900) setOpen(false); };
    window.addEventListener('keydown', key); window.addEventListener('resize', resize);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', key); window.removeEventListener('resize', resize); };
  }, [open]);
  return <header ref={headerRef} className="site-nav site-nav--reference">
    <Link to="/" className={"site-brand" + (home ? " hero-appear hero-appear--scale" : "")} style={home ? { "--d": ".08s" } : undefined} onClick={() => setOpen(false)} aria-label="AI Club home">
      <span className="site-brand-mark"><img src="/ai-club-orbital-preview.webp" alt="" aria-hidden="true"/></span><span><strong>AI CLUB</strong><small>SRI SHAKTHI</small></span>
    </Link>
    <nav id="site-primary-nav" className={open ? 'site-nav-links open' : 'site-nav-links'} aria-label="Primary navigation">
      {links.map(([to, label], index) => <Link key={to} to={to} className={(pathname === to ? 'active' : '') + (home ? ' hero-appear ' + (index % 2 ? 'hero-appear--soft' : 'hero-appear--scale') : '')} style={home ? { '--d': (.16 + index * .12).toFixed(2) + 's' } : undefined} onClick={() => setOpen(false)}>{label}</Link>)}
    </nav>
    <Link to="/login" onClick={() => setOpen(false)} className={'hero-intro__button hero-intro__button--primary site-nav__reference-cta' + (home ? ' hero-appear hero-appear--scale' : '')} style={home ? { "--d": ".34s" } : undefined}>Login</Link>
    <button className={"site-menu-btn" + (home ? " hero-appear hero-appear--scale" : "")} style={home ? { "--d": ".34s" } : undefined} onClick={() => setOpen(v => !v)} aria-controls="site-primary-nav" aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'}>{open ? <X size={20}/> : <Menu size={20}/>}</button>
  </header>;
}
