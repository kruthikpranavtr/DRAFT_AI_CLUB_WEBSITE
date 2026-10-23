import { Bell,ClipboardList,Images,Trophy,Home,LayoutDashboard,LogOut,Menu,UserRound,UsersRound,MessagesSquare,ShieldCheck,Newspaper } from 'lucide-react';
import { useEffect,useRef,useState } from 'react';
import { Link,useLocation,useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasPermission,PERMISSIONS } from '../../shared/permissions';
import { useUnreadNotifications } from '../lib/useNotifications';
import DashboardSheet from './DashboardSheet';
import './Dashboard.css';

const navigation = {
  student:[['/student/dashboard','Overview',LayoutDashboard],['/student/community','Community',MessagesSquare],['/student/assessments','Assessments',ClipboardList],['/student/achievements','Achievements',Trophy],['/student/gallery','Gallery',Images],['/student/profile','My profile',UserRound]],
  admin:[['/admin/dashboard','Overview',LayoutDashboard],['/notifications','Notifications',Bell],['/admin/news','News management',Newspaper,PERMISSIONS.CONTENT_NEWS],['/admin/community','Community',MessagesSquare],['/admin/moderation','Moderation',ShieldCheck,PERMISSIONS.MODERATE_COMMUNITY],['/admin/assessments','Assessments',ClipboardList],['/admin/students','Students',UsersRound,PERMISSIONS.MANAGE_STUDENTS]],
};

export default function DashboardShell({ section='Overview',children }) {
  const { session,signOut } = useAuth();
  const { unread } = useUnreadNotifications(session?.id);
  const role = session?.role || 'student';
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen,setMenuOpen] = useState(false);
  const menuTrigger = useRef(null);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width:901px)');
    const closeOnDesktop = event => { if (event.matches) setMenuOpen(false); };
    desktop.addEventListener('change',closeOnDesktop);
    return () => desktop.removeEventListener('change',closeOnDesktop);
  },[]);
  async function logout() {
    await signOut();
    navigate('/login',{ replace:true });
  }
  const sidebarProps = { role,session,unread,pathname:location.pathname,logout,onNavigate:() => setMenuOpen(false) };
  return <div className={`dash-app dash-app--${role}`}>
    <a className="dash-skip" href="#workspace-content">Skip to workspace</a>
    <aside className="dash-sidebar"><SidebarContent {...sidebarProps}/></aside>
    <div className="dash-main">
      <header className="dash-topbar">
        <button ref={menuTrigger} className="dash-menu portal-icon-button" onClick={() => setMenuOpen(true)} aria-label="Open dashboard menu" aria-haspopup="dialog" aria-expanded={menuOpen}><Menu size={20}/></button>
        <div className="dash-breadcrumb"><span>{role === 'admin' ? 'Administration' : 'Member workspace'}</span><span aria-hidden="true">/</span><strong>{section}</strong></div>
        <Link to="/notifications" className={`dash-notification-link${location.pathname === '/notifications' ? ' is-active' : ''}`} aria-current={location.pathname === '/notifications' ? 'page' : undefined} aria-label={unread > 0 ? `Open notifications, ${unread} unread` : 'Open notifications'}><Bell size={19} aria-hidden="true"/>{unread>0&&<span className="dash-notification-badge" aria-hidden="true">{unread>99?'99+':unread}</span>}</Link>
        <div className="dash-user"><div><strong>{session?.name}</strong><small>{session?.member_id}</small></div><span className="dash-avatar" aria-hidden="true">{session?.name?.split(/\s+/).map(word => word[0]).join('').slice(0,2).toUpperCase()}</span></div>
      </header>
      <main className="dash-content" id="workspace-content" tabIndex={-1}>{children}</main>
    </div>
    {menuOpen && <DashboardSheet title="Workspace navigation" eyebrow="AI CLUB" navigation returnFocusRef={menuTrigger} onClose={() => setMenuOpen(false)}><SidebarContent {...sidebarProps}/></DashboardSheet>}
  </div>;
}

function SidebarContent({ role,session,unread,pathname,logout,onNavigate }) {
  return <>
    <Link to={role === 'admin' ? '/admin/dashboard' : '/student/dashboard'} className="dash-brand" onClick={onNavigate}><img src="/ai-club-new-logo.png" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = "/ai-club-emblem.png"; }} alt=""/><span><strong>AI CLUB</strong><small>{role === 'admin' ? 'ADMINISTRATION' : 'STUDENT PORTAL'}</small></span></Link>
    <nav aria-label={role === 'admin' ? 'Administrator dashboard' : 'Student dashboard'}><span className="dash-nav-label">WORKSPACE</span>{navigation[role].filter(([, , ,permission]) => !permission || hasPermission(session,permission)).map(([to,label,Icon]) => {
      const active = pathname === to || ((to.endsWith('/members') || to.endsWith('/community')) && pathname.startsWith(to+'/'));
      return <Link key={to} to={to} aria-current={active ? 'page' : undefined} className={active ? 'active' : ''} onClick={onNavigate}><Icon size={18} aria-hidden="true"/><span>{label}</span>{label==='Notifications'&&unread>0&&<span className="dash-notification-count">{unread>99?'99+':unread}</span>}</Link>;
    })}</nav>
    <div className="dash-sidebar__bottom"><div className="dash-sidebar__identity"><span className="dash-nav-label">{role === 'admin' ? 'ADMINISTRATOR' : 'STUDENT MEMBER'}</span><strong>{session?.member_id}</strong></div><Link to="/" onClick={onNavigate}><Home size={17} aria-hidden="true"/> Public website</Link><button onClick={logout}><LogOut size={17} aria-hidden="true"/> Sign out</button></div>
  </>;
}
