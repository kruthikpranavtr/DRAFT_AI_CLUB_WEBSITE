import { Camera,Save,Trash2 } from 'lucide-react';
import { useEffect,useId,useState } from 'react';
import DashboardShell from '../components/DashboardShell';
import { api } from '../lib/api';
import { PageHead,StateMessage } from './StudentDashboardPage';

const emptyProfile = { name:'',memberId:'',email:'',department:'',academicYear:'',githubUrl:'',linkedinUrl:'',hackerrankUrl:'',description:'',skills:[],avatarUrl:null };

export default function StudentProfilePage() {
  const [profile,setProfile] = useState(emptyProfile);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState(null);
  const [skillsInput,setSkillsInput] = useState('');
  const [photoBusy,setPhotoBusy] = useState(false);
  const [loadError,setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    api('/api/students/me/profile').then(data => { if (active) { setProfile(normalize(data.profile)); setSkillsInput(data.profile.skills.join(', ')); } })
      .catch(error => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  },[]);

  function change(field,value) { setProfile(current => ({ ...current,[field]:value })); setMessage(null); }

  async function save(event) {
    event.preventDefault();
    setSaving(true); setMessage(null);
    try {
      const data = await api('/api/students/me/profile',{ method:'PATCH',body:JSON.stringify({
        department:profile.department,academicYear:profile.academicYear ? Number(profile.academicYear) : null,
        githubUrl:profile.githubUrl || null,linkedinUrl:profile.linkedinUrl || null,hackerrankUrl:profile.hackerrankUrl || null,
        description:profile.description,skills:skillsInput.split(',').map(skill => skill.trim()).filter(Boolean),
      }) });
      setProfile(normalize(data.profile));
      setSkillsInput(data.profile.skills.join(', '));
      setMessage({ type:'success',text:'Profile saved.' });
    } catch (error) { setMessage({ type:'error',text:error.message }); }
    finally { setSaving(false); }
  }

  async function uploadPhoto(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const form = new FormData(); form.set('photo',file);
    setMessage(null); setPhotoBusy(true);
    try {
      const data = await api('/api/students/me/profile-photo',{ method:'POST',body:form });
      change('avatarUrl',`${data.avatarUrl}?v=${Date.now()}`);
      setMessage({ type:'success',text:'Profile photo updated.' });
    } catch (error) { setMessage({ type:'error',text:error.message }); }
    finally { input.value = ''; setPhotoBusy(false); }
  }

  async function removePhoto() {
    setMessage(null); setPhotoBusy(true);
    try {
      await api('/api/students/me/profile-photo',{ method:'DELETE' });
      change('avatarUrl',null);
      setMessage({ type:'success',text:'Profile photo removed.' });
    } catch (error) { setMessage({ type:'error',text:error.message }); }
    finally { setPhotoBusy(false); }
  }

  return <DashboardShell section="My profile">
    <PageHead eyebrow="MEMBER IDENTITY" title="Your member profile." text="A little about you, for the people you’ll build with. Visible to signed-in members only."/>
    {loadError ? <StateMessage tone="error">{loadError}</StateMessage> : loading ? <StateMessage>Loading your profile…</StateMessage> : <form className="portal-profile-layout" onSubmit={save}>
      <aside className="dash-card portal-avatar-card">
        <Avatar profile={profile}/><h2>{profile.name}</h2><p>{profile.memberId}</p>
        <label className="dash-action portal-file-button"><Camera size={15}/> {photoBusy ? 'Updating photo…' : 'Upload photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={photoBusy}/></label>
        {profile.avatarUrl && <button type="button" className="portal-secondary-button" onClick={removePhoto} disabled={photoBusy}><Trash2 size={14}/> Remove photo</button>}
        <small>JPEG, PNG, or WebP. Maximum 5 MB.</small>
      </aside>
      <section className="dash-card portal-form-card">
        <fieldset className="portal-form-group"><legend>Official identity</legend><div className="portal-form-grid">
          <Field label="Official name" value={profile.name} readOnly help="Only an administrator can change your official name."/>
          <Field label="Roll number" value={profile.memberId} readOnly/>
        </div></fieldset>
        <fieldset className="portal-form-group"><legend>Academic details</legend><div className="portal-form-grid">
          <Field label="Department" value={profile.department} onChange={value => change('department',value)} maxLength={120}/>
          <label className="portal-field"><span>Year</span><select value={profile.academicYear} onChange={event => change('academicYear',event.target.value)}><option value="">Not specified</option>{[1,2,3,4,5,6].map(year => <option value={year} key={year}>Year {year}</option>)}</select></label>
        </div></fieldset>
        <fieldset className="portal-form-group"><legend>Find me online</legend><div className="portal-form-grid">
          <Field label="GitHub URL" type="url" value={profile.githubUrl} onChange={value => change('githubUrl',value)} placeholder="https://github.com/username"/>
          <Field label="LinkedIn URL" type="url" value={profile.linkedinUrl} onChange={value => change('linkedinUrl',value)} placeholder="https://www.linkedin.com/in/username"/>
          <Field label="HackerRank URL (optional)" type="url" value={profile.hackerrankUrl} onChange={value => change('hackerrankUrl',value)} placeholder="https://www.hackerrank.com/username"/>
        </div></fieldset>
        <fieldset className="portal-form-group"><legend>Skills & interests</legend><div className="portal-form-grid">
          <Field label="Skills" value={skillsInput} onChange={value => { setSkillsInput(value); setMessage(null); }} placeholder="Python, Machine Learning, UI Design" help="Separate up to 20 skills with commas."/>
          <label className="portal-field portal-field--full"><span>Description</span><textarea rows="4" maxLength="2000" value={profile.description} onChange={event => change('description',event.target.value)} placeholder="Share your interests, current work, and what you hope to build with the club."/></label>
        </div></fieldset>
        <div className="portal-form-actions"><p className={message ? `is-${message.type}` : ''} role="status">{message?.text}</p><button className="dash-action" disabled={saving || photoBusy}><Save size={15}/>{saving ? 'Saving…' : 'Save profile'}</button></div>
      </section>
    </form>}
  </DashboardShell>;
}

function normalize(profile) { return { ...emptyProfile,...profile,academicYear:profile.academicYear || '',githubUrl:profile.githubUrl || '',linkedinUrl:profile.linkedinUrl || '',hackerrankUrl:profile.hackerrankUrl || '' }; }
function Avatar({ profile }) { return profile.avatarUrl ? <img className="portal-avatar" src={profile.avatarUrl} alt={`${profile.name} profile`}/> : <span className="portal-avatar portal-avatar--fallback">{profile.name.split(/\s+/).map(part => part[0]).join('').slice(0,2).toUpperCase()}</span>; }
function Field({ label,value,onChange,type='text',readOnly=false,placeholder='',help,maxLength }) { const id = useId(); return <div className="portal-field"><label htmlFor={id}>{label}</label><input id={id} aria-describedby={help ? `${id}-help` : undefined} type={type} value={value ?? ''} onChange={onChange ? event => onChange(event.target.value) : undefined} readOnly={readOnly} placeholder={placeholder} maxLength={maxLength}/>{help && <small id={`${id}-help`}>{help}</small>}</div>; }
