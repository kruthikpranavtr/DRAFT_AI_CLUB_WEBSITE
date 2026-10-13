import { Activity, BarChart3, BookOpenCheck, CheckCircle2, Clock3, FileText, ShieldCheck, Sparkles, UserCheck, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import DashboardShell from '../components/DashboardShell';
import { useAuth } from '../context/AuthContext';

const INITIAL_APPLICANTS = [
  { id:'SSAC-026', name:'Aarav K', email:'aarav.k@srishakthi.ac.in', progress:100, status:'Pending review' },
  { id:'SSAC-031', name:'Diya R', email:'diya.r@srishakthi.ac.in', progress:100, status:'Pending review' },
  { id:'SSAC-044', name:'Nithin S', email:'nithin.s@srishakthi.ac.in', progress:88, status:'Assessment active' },
  { id:'SSAC-057', name:'Meera V', email:'meera.v@srishakthi.ac.in', progress:100, status:'Approved' },
];

const LEVELS = [
  ['AI Foundations',86],['Python Logic',78],['Data Literacy',72],['Machine Learning',64],
  ['Deep Learning',51],['Applied AI',45],['Responsible AI',39],['Build Challenge',28],
];

export default function AdminDashboardPage() {
  const { session } = useAuth();
  const [view, setView] = useState('overview');
  const [applicants, setApplicants] = useState(INITIAL_APPLICANTS);
  const pending = useMemo(() => applicants.filter(item => item.status === 'Pending review').length,[applicants]);

  function approve(id) {
    setApplicants(items => items.map(item => item.id === id ? {...item,status:'Approved'} : item));
  }

  return <DashboardShell role="admin" view={view} onViewChange={setView}>
    {view === 'overview' && <>
      <PageHead eyebrow="ADMIN CONTROL" title={'Good evening, ' + session.name + '.'} text="Monitor membership, assessments and published club content from one frontend workspace."/>
      <div className="dash-grid dash-grid--4">
        <Stat icon={Users} value="128" label="Student accounts"/>
        <Stat icon={BookOpenCheck} value="43" label="Active assessments"/>
        <Stat icon={Clock3} value={String(pending).padStart(2,'0')} label="Pending reviews"/>
        <Stat icon={CheckCircle2} value="31" label="Approved members"/>
      </div>
      <div className="dash-grid dash-grid--2">
        <section className="dash-card dash-section">
          <div className="dash-section__head"><h2>Applicants requiring attention</h2><button onClick={() => setView('applicants')}>VIEW ALL</button></div>
          <div className="dash-list">{applicants.filter(item => item.status !== 'Approved').slice(0,3).map(item => <ApplicantRow item={item} key={item.id}/>)}</div>
        </section>
        <section className="dash-card dash-section">
          <div className="dash-section__head"><h2>System activity</h2><span>LIVE DEMO</span></div>
          <div className="dash-list">
            <ListItem icon={UserCheck} title="Member approved" text="Meera V moved to active membership" meta="12 MIN"/>
            <ListItem icon={BookOpenCheck} title="Level completed" text="Aarav K cleared Build Challenge" meta="34 MIN"/>
            <ListItem icon={FileText} title="News updated" text="Applied AI Lab announcement published" meta="2 HRS"/>
          </div>
        </section>
      </div>
      <section className="dash-card dash-section">
        <div className="dash-section__head"><h2>Assessment completion</h2><button onClick={() => setView('assessments')}>FULL REPORT</button></div>
        <div className="dash-list">{LEVELS.slice(0,4).map(([name,value],index) => <div className="dash-list-item" key={name}><span className="dash-list-item__icon"><BarChart3 size={18}/></span><div><h3>{String(index+1).padStart(2,'0')} · {name}</h3><div className="dash-progress-track" style={{marginTop:9}}><span style={{width:value+'%'}}/></div></div><span>{value}%</span></div>)}</div>
      </section>
    </>}

    {view === 'applicants' && <>
      <PageHead eyebrow="ENTRY REVIEW" title="Student applicants." text="Review completed assessment pathways and simulate membership decisions locally."/>
      <section className="dash-card dash-section">
        <div className="dash-section__head"><h2>Application queue</h2><span>{pending} PENDING</span></div>
        <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>STUDENT</th><th>PROGRESS</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{applicants.map(item => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.email} · {item.id}</small></td><td>{item.progress}%</td><td><span className="dash-chip">{item.status}</span></td><td>{item.status === 'Pending review' ? <button onClick={() => approve(item.id)}>Approve member</button> : <button>View profile</button>}</td></tr>)}</tbody></table></div>
      </section>
      <div className="dash-notice"><ShieldCheck size={24}/><div><h3>Frontend demonstration</h3><p>Approval actions update this screen only. The production version must record decisions through authenticated server APIs and an audit log.</p></div></div>
    </>}

    {view === 'assessments' && <>
      <PageHead eyebrow="ASSESSMENT ANALYTICS" title="Eight-level performance." text="A complete mock reporting view for the club-entry assessment pathway."/>
      <section className="dash-card dash-section">
        <div className="dash-section__head"><h2>Level completion rate</h2><span>128 STUDENTS</span></div>
        <div className="dash-list">{LEVELS.map(([name,value],index) => <div className="dash-list-item" key={name}><span className="dash-list-item__icon"><BookOpenCheck size={18}/></span><div><h3>Level {index+1} · {name}</h3><div className="dash-progress-track" style={{marginTop:9}}><span style={{width:value+'%'}}/></div></div><span>{value}%</span></div>)}</div>
      </section>
    </>}

    {view === 'content' && <>
      <PageHead eyebrow="SITE CONTENT" title="Publishing overview." text="Review the public-facing areas managed by the club team. Editing will connect to the backend CMS later."/>
      <div className="dash-grid dash-grid--2">
        <ContentCard icon={FileText} title="News & announcements" count="06 published" status="Current"/>
        <ContentCard icon={Sparkles} title="Homepage story" count="04 cinematic chapters" status="Current"/>
        <ContentCard icon={Activity} title="Events archive" count="08 entries" status="Review"/>
        <ContentCard icon={ShieldCheck} title="Assessment content" count="08 active levels" status="Current"/>
      </div>
    </>}
  </DashboardShell>;
}

function PageHead({ eyebrow, title, text }) { return <div className="dash-page-head"><div><span>{eyebrow}</span><h1>{title}</h1></div><p>{text}</p></div>; }
function Stat({ icon:Icon, value, label }) { return <article className="dash-card dash-stat"><span className="dash-stat__icon"><Icon size={19}/></span><strong>{value}</strong><span>{label}</span></article>; }
function ListItem({ icon:Icon, title, text, meta }) { return <div className="dash-list-item"><span className="dash-list-item__icon"><Icon size={18}/></span><div><h3>{title}</h3><p>{text}</p></div><span>{meta}</span></div>; }
function ApplicantRow({ item }) { return <div className="dash-list-item"><span className="dash-list-item__icon"><Users size={18}/></span><div><h3>{item.name}</h3><p>{item.id} · {item.progress}% complete</p></div><span>{item.status.toUpperCase()}</span></div>; }
function ContentCard({ icon:Icon, title, count, status }) { return <article className="dash-card dash-section"><span className="dash-stat__icon"><Icon size={19}/></span><div className="dash-section__head" style={{margin:'20px 0 0'}}><div><h2>{title}</h2><span>{count}</span></div><span className="dash-chip">{status}</span></div></article>; }
