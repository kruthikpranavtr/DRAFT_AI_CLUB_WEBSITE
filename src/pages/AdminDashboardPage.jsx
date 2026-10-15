import { ArrowRight,Plus } from 'lucide-react';
import { useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { hasPermission,PERMISSIONS } from '../../shared/permissions';
import { PageHead,StateMessage } from './StudentDashboardPage';

export default function AdminDashboardPage() {
  const { session } = useAuth();
  const [overview,setOverview] = useState(null);
  const [error,setError] = useState('');
  const canManage = hasPermission(session,PERMISSIONS.MANAGE_STUDENTS);
  useEffect(() => {
    let active = true;
    api('/api/admin/overview').then(data => { if (active) setOverview(data); }).catch(cause => { if (active) setError(cause.message); });
    return () => { active = false; };
  },[]);
  return <DashboardShell section="Overview">
    <PageHead eyebrow="ADMINISTRATION" title="Club operations." text="A clear view of the club. The right tools to keep it running." action={canManage && <Link className="dash-action" to="/admin/students?create=1"><Plus size={16}/>Create student</Link>}/>
    {error && <StateMessage tone="error">{error}</StateMessage>}
    {!overview && !error && <StateMessage>Loading administration…</StateMessage>}
    {overview && <>
      <section className="dash-card portal-admin-overview"><div><span className="portal-eyebrow">STUDENT ADMINISTRATION</span><h2>Good communities start with people.</h2><p>Create student accounts, maintain official identities, and manage access securely.</p>{canManage ? <Link className="portal-text-link" to="/admin/students">Manage student accounts <ArrowRight size={16}/></Link> : <p className="portal-privacy-note">Student management is not included in your administrator permissions.</p>}</div><div className="portal-account-count"><strong>{overview.stats.students}</strong><span>Student accounts</span><small>Current platform total</small></div></section>
      <section className="portal-support-stats" aria-label="Current content and storage"><div><strong>{overview.stats.published}</strong><span>Published content</span></div><div><strong>{overview.stats.gallery}</strong><span>Gallery entries</span></div><div><strong>{overview.storageMode === 'object-storage' ? 'Object' : 'Local'}</strong><span>Media storage</span></div></section>
      <section className="dash-section portal-admin-guide"><div className="dash-section__head"><h2>Account handling, without ambiguity.</h2><span>SECURE BY DESIGN</span></div><ol><li><span>01</span><div><h3>Provision access</h3><p>Create a roll-number account. Deliver the temporary password through your approved out-of-band process.</p></div></li><li><span>02</span><div><h3>Keep identities accurate</h3><p>Official names and account status stay administrator-controlled. Students maintain their own profile details.</p></div></li><li><span>03</span><div><h3>Reset responsibly</h3><p>A password reset revokes all previous sessions and requires a new password at the next sign-in.</p></div></li></ol></section>
    </>}
  </DashboardShell>;
}
