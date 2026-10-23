import { ArrowRight,CheckCircle2 } from 'lucide-react';
import { useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useStudentAssessments } from '../lib/useStudentAssessments';

export default function StudentDashboardPage() {
  const { session } = useAuth();
  const {items:assessments,loading:assessmentsLoading,error:assessmentsError}=useStudentAssessments();
  const [data,setData] = useState(null);
  const [error,setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([api('/api/students/me/profile'),api('/api/members?limit=1')])
      .then(([profile,members]) => { if (active) setData({ profile:profile.profile,total:members.total }); })
      .catch(cause => { if (active) setError(cause.message); });
    return () => { active = false; };
  },[]);

  return <DashboardShell section="Overview">
    <PageHead eyebrow="STUDENT WORKSPACE" title="Your workspace." text={`Welcome back, ${session.name}. Make yourself known. Find your people.`}/>
    {error && <StateMessage tone="error">{error}</StateMessage>}
    {!data && !error && <StateMessage>Loading your workspace…</StateMessage>}
    {data && <>
      <div className="portal-overview-grid">
        <section className="dash-card portal-identity-panel">
          <div className="portal-identity"><div className="portal-overview-avatar">{data.profile.avatarUrl ? <img src={data.profile.avatarUrl} alt=""/> : <span aria-hidden="true">{session.name.slice(0,1)}</span>}</div><div><span className="portal-eyebrow">YOUR MEMBER PROFILE</span><h2>{data.profile.name}</h2><p className="portal-metadata">{data.profile.memberId}</p><p>{[data.profile.department,data.profile.academicYear ? `Year ${data.profile.academicYear}` : ''].filter(Boolean).join(' · ') || 'Add your academic details'}</p></div></div>
          <div className="portal-completion"><div className="dash-section__head"><h3>Profile completeness</h3><strong>{profileCompletion(data.profile)}%</strong></div><div className="dash-progress-track" role="progressbar" aria-label="Profile completeness" aria-valuenow={profileCompletion(data.profile)} aria-valuemin={0} aria-valuemax={100}><span style={{ width:`${profileCompletion(data.profile)}%` }}/></div><p>{missingFields(data.profile).length ? `Still to add: ${missingFields(data.profile).join(', ')}.` : 'Your profile is complete. Keep it up to date as you learn and build.'}</p><Link className="dash-action" to="/student/profile">Edit profile <ArrowRight size={16}/></Link></div>
        </section>
        <section className="dash-card portal-directory-summary"><span className="portal-eyebrow">THE COMMUNITY</span><h2>People worth knowing.</h2><p><strong className="portal-inline-count">{data.total}</strong> active {data.total === 1 ? 'member' : 'members'} in the private directory.</p><p>Discover shared skills and interests through member profiles.</p><Link className="portal-text-link" to="/student/members">Browse members <ArrowRight size={16}/></Link><div className="portal-privacy-note">For signed-in members only.<br/>Your profile and photo stay private.</div></section>
      </div>
      <section className="dash-card dash-section" aria-label="Your available assessments">
        <div className="dash-section__head"><h2>Assessments</h2><span>{assessmentsError?'NOT AVAILABLE':assessmentsLoading?'CHECKING':assessments.length+' PUBLISHED'}</span></div>
        {assessmentsError&&<StateMessage tone="error">{assessmentsError}</StateMessage>}
        {assessmentsLoading&&!assessmentsError&&<p>Checking your assessments...</p>}
        {!assessmentsLoading&&!assessmentsError&&(assessments.length ? <>
          <p>{assessments.length} published assessment{assessments.length!==1?'s':''} available to you.</p>
          <div className="portal-assessment-summary">{assessments.slice(0,3).map(a=><div key={a.id}><strong>{a.title}</strong><span>{a.availability==='upcoming'?'Upcoming':a.availability==='active'?'Open now':'Closed'}</span></div>)}</div>
        </> : <p>No assessments available yet. New assessments will appear here once published.</p>)}
        <Link className="portal-text-link" to="/student/assessments">View assessments <ArrowRight size={16}/></Link>
      </section>
      <section className="dash-card dash-section">
        <div className="dash-notice"><CheckCircle2 size={20} aria-hidden="true"/><div><h3>Your account is secured</h3><p>Password setup is complete. Contact an administrator if you lose access. A password reset ends all previous sessions.</p></div><span className="dash-chip is-active">Active</span></div>
      </section>
    </>}
  </DashboardShell>;
}

export function PageHead({ eyebrow,title,text,action }) {
  return <div className="dash-page-head"><div><span className="portal-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{text}</p></div>{action && <div className="portal-head-action">{action}</div>}</div>;
}

export function StateMessage({ children,tone = 'loading' }) {
  return <div className={`dash-card dash-empty portal-state is-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}

function profileCompletion(profile) {
  const fields = [profile.department,profile.academicYear,profile.githubUrl,profile.linkedinUrl,profile.description,profile.avatarUrl,profile.skills.length];
  return Math.round(fields.filter(Boolean).length / fields.length * 100);
}

function missingFields(profile) {
  return [[profile.department,'department'],[profile.academicYear,'year'],[profile.githubUrl,'GitHub'],[profile.linkedinUrl,'LinkedIn'],[profile.description,'description'],[profile.avatarUrl,'photo'],[profile.skills.length,'skills']].filter(([value]) => !value).map(([,label]) => label);
}
