import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, LogOut, Menu, UserRound, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { workspacePath } from '../lib/auth-routing';
import useHeroEntrance from './useHeroEntrance';
import './PublicAccount.css';

const links = [['/', 'Home'], ['/gallery', 'Gallery'], ['/news', 'News'], ['/about', 'About']];

function initials(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'AI';
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const home = pathname === '/';
  const headerRef = useRef(null);
  const accountRef = useRef(null);
  useHeroEntrance(headerRef, home);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = e => { if (e.key === 'Escape') setOpen(false); };
    const resize = () => { if (window.innerWidth > 900) setOpen(false); };
    window.addEventListener('keydown', key);
    window.addEventListener('resize', resize);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', key); window.removeEventListener('resize', resize); };
  }, [open]);

  useEffect(() => {
    if (!accountOpen) return;
    const dismiss = event => {
      if (!accountRef.current?.contains(event.target)) setAccountOpen(false);
    };
    const escape = event => {
      if (event.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [accountOpen]);

  async function logout() {
    setAccountOpen(false);
    await signOut();
    navigate('/', { replace: true });
  }

  const displayName = session?.name?.trim() || session?.member_id || 'Member';
  const dashboardPath = session ? workspacePath(session) : '/login';

  return <header ref={headerRef} className="site-nav site-nav--reference">
    <Link to="/" className={'site-brand' + (home ? ' hero-appear hero-appear--scale' : '')} style={home ? { '--d': '.08s' } : undefined} onClick={() => { setOpen(false); setAccountOpen(false); }} aria-label="AI Club home">
      <span className="site-brand-mark"><img src="/ai-club-new-logo.png" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/ai-club-emblem.png'; }} alt="" aria-hidden="true"/></span><span><strong>AI CLUB</strong><small>SRI SHAKTHI</small></span>
    </Link>
    <nav id="site-primary-nav" className={open ? 'site-nav-links open' : 'site-nav-links'} aria-label="Primary navigation">
      {links.map(([to, label], index) => <Link key={to} to={to} className={(pathname === to ? 'active' : '') + (home ? ' hero-appear ' + (index % 2 ? 'hero-appear--soft' : 'hero-appear--scale') : '')} style={home ? { '--d': (.16 + index * .12).toFixed(2) + 's' } : undefined} onClick={() => { setOpen(false); setAccountOpen(false); }}>{label}</Link>)}
    </nav>
    {loading ? <div className="site-nav__account-loading" role="status" aria-label="Checking member session"/> : session ? (
      <div ref={accountRef} className={'site-nav__account' + (home ? ' hero-appear hero-appear--scale' : '')} style={home ? { '--d': '.34s' } : undefined}>
        <button type="button" className="site-nav__profile-trigger" onClick={() => { setOpen(false); setAccountOpen(current => !current); }} aria-haspopup="true" aria-expanded={accountOpen} aria-controls="site-account-panel" aria-label={'Account: ' + displayName}>
          <span className="site-nav__avatar" aria-hidden="true">{initials(displayName)}</span>
          <span className="site-nav__profile-name">{displayName}</span>
          <ChevronDown size={15} aria-hidden="true"/>
        </button>
        {accountOpen && <div id="site-account-panel" className="site-nav__account-panel">
          <div className="site-nav__account-identity"><strong>{displayName}</strong><span>{session.member_id}</span></div>
          <Link to={dashboardPath} onClick={() => setAccountOpen(false)}><LayoutDashboard size={17} aria-hidden="true"/> {session.must_change_password ? 'Update password' : 'My dashboard'}</Link>
          {session.role === 'student' && !session.must_change_password && <Link to="/student/profile" onClick={() => setAccountOpen(false)}><UserRound size={17} aria-hidden="true"/> My profile</Link>}
          <button type="button" onClick={logout}><LogOut size={17} aria-hidden="true"/> Sign out</button>
        </div>}
      </div>
    ) : <Link to="/login" onClick={() => setOpen(false)} className={'hero-intro__button hero-intro__button--primary site-nav__reference-cta' + (home ? ' hero-appear hero-appear--scale' : '')} style={home ? { '--d': '.34s' } : undefined}>Login</Link>}
    <button type="button" className={'site-menu-btn' + (home ? ' hero-appear hero-appear--scale' : '')} style={home ? { '--d': '.34s' } : undefined} onClick={() => { setAccountOpen(false); setOpen(v => !v); }} aria-controls="site-primary-nav" aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'}>{open ? <X size={20}/> : <Menu size={20}/>}</button>
  </header>;
}
