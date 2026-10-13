import { BarChart3, BookOpenCheck, ChevronRight, FileImage, FileText, FolderOpen, Home, LayoutDashboard, LogOut, Menu, PanelsTopLeft, Settings, ShieldCheck, Users, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const studentItems = [
  ['overview','Overview',LayoutDashboard],
  ['assessments','Assessments',BookOpenCheck],
  ['membership','Membership',ShieldCheck],
];

const adminItems = [
  ['overview','Overview',LayoutDashboard],
  ['content','Content',FileText],
  ['pages','Pages & sections',PanelsTopLeft],
  ['gallery','Gallery',FileImage],
  ['files','Files',FolderOpen],
  ['users','Users & access',Users],
  ['settings','Website settings',Settings],
];

export default function DashboardShell({ role, view, onViewChange, children }) {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = role === 'admin' ? adminItems : studentItems;

  function choose(nextView) {
    onViewChange(nextView);
    setMenuOpen(false);
  }

  function logout() {
    signOut();
    navigate('/login', { replace:true });
  }

  return (
    <div className={'dash-app dash-app--' + role}>
      <aside className={'dash-sidebar' + (menuOpen ? ' is-open' : '')}>
        <div className="dash-brand">
          <img src="/ai-club-emblem.png" alt=""/>
          <span><strong>AI CLUB</strong><small>{role === 'admin' ? 'ADMIN CONSOLE' : 'STUDENT PORTAL'}</small></span>
        </div>
        <button className="dash-sidebar__close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={19}/></button>

        <nav aria-label={role + ' dashboard'}>
          <span className="dash-nav-label">WORKSPACE</span>
          {items.map(([id,label,Icon]) => <button className={view === id ? 'active' : ''} onClick={() => choose(id)} key={id}><Icon size={18}/><span>{label}</span><ChevronRight size={14}/></button>)}
        </nav>

        <div className="dash-sidebar__bottom">
          <Link to="/"><Home size={17}/> Public website</Link>
          <button onClick={logout}><LogOut size={17}/> Sign out</button>
        </div>
      </aside>

      <div className="dash-main">
        <header className="dash-topbar">
          <button className="dash-menu" onClick={() => setMenuOpen(true)} aria-label="Open dashboard menu"><Menu size={20}/></button>
          <div><span>{role === 'admin' ? 'ADMINISTRATION' : 'MEMBER WORKSPACE'}</span><strong>{view.charAt(0).toUpperCase() + view.slice(1)}</strong></div>
          <div className="dash-user">
            <span className="dash-role"><BarChart3 size={13}/>{role}</span>
            <div><strong>{session?.name}</strong><small>{session?.id}</small></div>
            <span className="dash-avatar">{role === 'admin' ? 'AD' : 'ST'}</span>
          </div>
        </header>
        <main className="dash-content">{children}</main>
      </div>
      {menuOpen && <button className="dash-overlay" onClick={() => setMenuOpen(false)} aria-label="Close menu"/>}
    </div>
  );
}
