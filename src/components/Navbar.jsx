import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const links = [
  ['/', 'Home'],
  ['/gallery', 'Gallery'],
  ['/about', 'About'],
  ['/news', 'News'],
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <header className="site-nav">
      <Link to="/" className="site-brand" onClick={() => setOpen(false)} aria-label="AI Club home">
        <span className="site-brand-mark">AI</span>
        <span>
          <strong>AI CLUB</strong>
          <small>SRI SHAKTHI</small>
        </span>
      </Link>

      <nav className={open ? 'site-nav-links open' : 'site-nav-links'} aria-label="Primary navigation">
        {links.map(([to, label]) => (
          <Link
            key={to}
            to={to}
            className={pathname === to ? 'active' : ''}
            onClick={() => setOpen(false)}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="site-nav-tag">IDEAS <i>→</i> BUILD <i>→</i> IMPACT</div>

      <button className="site-menu-btn" onClick={() => setOpen(v => !v)} aria-label="Toggle navigation">
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
    </header>
  );
}
