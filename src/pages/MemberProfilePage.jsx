import { ArrowLeft,ExternalLink,UserRound } from 'lucide-react';
import { useEffect,useState } from 'react';
import { Link,useParams } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { StateMessage } from './StudentDashboardPage';

export default function MemberProfilePage() {
  const { session } = useAuth();
  const { id } = useParams();
  const [profile,setProfile] = useState(null);
  const [error,setError] = useState('');
  useEffect(() => {
    let active = true;
    api(`/api/members/${encodeURIComponent(id)}`).then(data => { if (active) setProfile(data.profile); }).catch(cause => { if (active) setError(cause.message); });
    return () => { active = false; };
  },[id]);

  return <DashboardShell section="Member profile"><Link className="portal-back" to={session.role === 'admin' ? '/admin/community' : '/student/members'}><ArrowLeft size={15}/> {session.role === 'admin' ? 'Community' : 'Member directory'}</Link>{error && <StateMessage tone="error">{error}</StateMessage>}{!profile && !error && <StateMessage>Loading member profile…</StateMessage>}{profile && <article className="dash-card portal-member-detail"><header>{profile.avatarUrl ? <img src={profile.avatarUrl} alt=""/> : <span><UserRound size={36}/></span>}<div><small>{profile.memberId}</small><h1>{profile.name}</h1><p>{[profile.department,profile.academicYear ? `Year ${profile.academicYear}` : ''].filter(Boolean).join(' · ') || 'Department and year not specified'}</p></div></header><section><h2>About</h2><p>{profile.description || 'This member has not added a description yet.'}</p></section><section><h2>Skills</h2><div className="portal-skills">{profile.skills.length ? profile.skills.map(skill => <span key={skill}>{skill}</span>) : <p>No skills listed yet.</p>}</div></section><section><h2>Links</h2><div className="portal-links"><ProfileLink href={profile.githubUrl} label="GitHub"/><ProfileLink href={profile.linkedinUrl} label="LinkedIn"/><ProfileLink href={profile.hackerrankUrl} label="HackerRank"/>{!profile.githubUrl && !profile.linkedinUrl && !profile.hackerrankUrl && <p>No profile links added yet.</p>}</div></section></article>}</DashboardShell>;
}

function ProfileLink({ href,label }) { return href ? <a href={href} target="_blank" rel="noreferrer">{label}<ExternalLink size={13}/></a> : null; }
