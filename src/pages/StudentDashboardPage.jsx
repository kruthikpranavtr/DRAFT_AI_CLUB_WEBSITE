import { ArrowRight, BookOpenCheck, CalendarDays, CheckCircle2, Clock3, LockKeyhole, ShieldCheck, Sparkles, Target, Trophy, UserRoundCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import { useAuth } from '../context/AuthContext';

const LEVEL_NAMES = ['AI Foundations','Python Logic','Data Literacy','Machine Learning','Deep Learning','Applied AI','Responsible AI','Build Challenge'];

export default function StudentDashboardPage() {
  const { session } = useAuth();
  const [view, setView] = useState('overview');
  const completed = (() => {
    try { return JSON.parse(localStorage.getItem('ai-club-assessment-progress') || '[]'); }
    catch { return []; }
  })();
  const percent = Math.round(completed.length / LEVEL_NAMES.length * 100);
  const eligible = completed.length === LEVEL_NAMES.length;
  const currentLevel = Math.min(completed.length + 1, LEVEL_NAMES.length);

  return <DashboardShell role="student" view={view} onViewChange={setView}>
    {view === 'overview' && <>
      <PageHead eyebrow="STUDENT WORKSPACE" title={'Welcome, ' + session.name + '.'} text="Track your assessment pathway, club-entry status and upcoming learning activity."/>
      <div className="dash-grid dash-grid--4">
        <Stat icon={BookOpenCheck} value={completed.length + '/8'} label="Levels completed"/>
        <Stat icon={Target} value={percent + '%'} label="Assessment progress"/>
        <Stat icon={Trophy} value={eligible ? 'Ready' : 'In progress'} label="Entry status"/>
        <Stat icon={CalendarDays} value="03" label="Upcoming sessions"/>
      </div>

      <section className="dash-card dash-section">
        <div className="dash-section__head"><div><h2>Assessment pathway</h2><span>LEVEL {String(currentLevel).padStart(2,'0')} / 08</span></div><Link className="dash-action" to="/assessment">{eligible ? 'Review results' : 'Continue'} <ArrowRight size={15}/></Link></div>
        <div className="dash-progress-track"><span style={{width:percent + '%'}}/></div>
        <div className="dash-list">
          {LEVEL_NAMES.slice(Math.max(0,completed.length - 1),Math.min(LEVEL_NAMES.length,completed.length + 2)).map((name,index) => {
            const actualIndex = Math.max(0,completed.length - 1) + index;
            const done = completed.includes(actualIndex);
            const open = actualIndex === 0 || completed.includes(actualIndex - 1);
            return <div className="dash-list-item" key={name}><span className="dash-list-item__icon">{done ? <CheckCircle2 size={18}/> : open ? <Sparkles size={18}/> : <LockKeyhole size={17}/>}</span><div><h3>{name}</h3><p>{done ? 'Assessment passed' : open ? 'Ready to begin' : 'Complete the previous level to unlock'}</p></div><span>{done ? 'PASSED' : open ? 'AVAILABLE' : 'LOCKED'}</span></div>;
          })}
        </div>
      </section>

      <div className="dash-grid dash-grid--2">
        <section className="dash-card dash-section">
          <div className="dash-section__head"><h2>Upcoming activity</h2><span>THIS MONTH</span></div>
          <div className="dash-list">
            <ListItem icon={CalendarDays} title="Applied AI Lab" text="Hands-on model evaluation session" meta="OCT 18"/>
            <ListItem icon={Clock3} title="Build Circle" text="Peer project review and feedback" meta="OCT 23"/>
            <ListItem icon={Trophy} title="Demo Evening" text="Community project showcase" meta="OCT 30"/>
          </div>
        </section>
        <section className="dash-card dash-section">
          <div className="dash-section__head"><h2>Entry readiness</h2><span>{eligible ? 'COMPLETE' : 'ACTIVE'}</span></div>
          <div className="dash-notice"><ShieldCheck size={24}/><div><h3>{eligible ? 'Ready for faculty verification' : 'Keep progressing'}</h3><p>{eligible ? 'All eight levels are cleared. Your assessment record is ready for the final club-entry review.' : (8-completed.length) + ' assessment levels remain before your application can enter final review.'}</p></div></div>
        </section>
      </div>
    </>}

    {view === 'assessments' && <>
      <PageHead eyebrow="ASSESSMENT PATH" title="Eight levels of progress." text="Complete each assessment in sequence. Results on this demo are saved locally in your browser."/>
      <section className="dash-card dash-section">
        <div className="dash-section__head"><h2>All levels</h2><Link className="dash-action" to="/assessment">Open assessment <ArrowRight size={15}/></Link></div>
        <div className="dash-list">{LEVEL_NAMES.map((name,index) => {
          const done = completed.includes(index);
          const open = index === 0 || completed.includes(index - 1);
          return <div className="dash-list-item" key={name}><span className="dash-list-item__icon">{done ? <CheckCircle2 size={18}/> : open ? <BookOpenCheck size={18}/> : <LockKeyhole size={17}/>}</span><div><h3>{String(index+1).padStart(2,'0')} · {name}</h3><p>{done ? 'Passed and recorded on this device' : open ? 'Available now' : 'Locked until the previous level is passed'}</p></div><span>{done ? 'PASSED' : open ? 'START' : 'LOCKED'}</span></div>;
        })}</div>
      </section>
    </>}

    {view === 'membership' && <>
      <PageHead eyebrow="CLUB ENTRY" title="Your membership journey." text="The complete frontend view of your club-entry status and remaining requirements."/>
      <div className="dash-notice"><UserRoundCheck size={25}/><div><h3>{eligible ? 'Assessment requirement complete' : 'Assessment requirement in progress'}</h3><p>{eligible ? 'Your demo application is ready for administrator review.' : 'Pass all eight levels to unlock the verification stage.'}</p></div></div>
      <section className="dash-card dash-section">
        <div className="dash-section__head"><h2>Entry checklist</h2><span>{eligible ? '3 / 4 COMPLETE' : '2 / 4 COMPLETE'}</span></div>
        <div className="dash-list">
          <ListItem icon={CheckCircle2} title="Student account" text="Identity profile created" meta="COMPLETE"/>
          <ListItem icon={CheckCircle2} title="Interest profile" text="AI domains and learning goals recorded" meta="COMPLETE"/>
          <ListItem icon={eligible ? CheckCircle2 : Clock3} title="Eight-level assessment" text={eligible ? 'All assessment levels cleared' : percent + '% of pathway completed'} meta={eligible ? 'COMPLETE' : 'ACTIVE'}/>
          <ListItem icon={LockKeyhole} title="Faculty verification" text="Unlocked after assessment completion" meta={eligible ? 'PENDING' : 'LOCKED'}/>
        </div>
      </section>
    </>}
  </DashboardShell>;
}

function PageHead({ eyebrow, title, text }) { return <div className="dash-page-head"><div><span>{eyebrow}</span><h1>{title}</h1></div><p>{text}</p></div>; }
function Stat({ icon:Icon, value, label }) { return <article className="dash-card dash-stat"><span className="dash-stat__icon"><Icon size={19}/></span><strong>{value}</strong><span>{label}</span></article>; }
function ListItem({ icon:Icon, title, text, meta }) { return <div className="dash-list-item"><span className="dash-list-item__icon"><Icon size={18}/></span><div><h3>{title}</h3><p>{text}</p></div><span>{meta}</span></div>; }
