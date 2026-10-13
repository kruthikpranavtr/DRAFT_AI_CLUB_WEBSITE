import { ArrowUpRight } from 'lucide-react';
import { PROJECTS } from '../data/projectsData';
import { usePublishedContent } from '../lib/useCms';

const fallbackFaculty = [
  { mark:'FC', role:'Faculty Coordinator', text:'Official faculty profile details can be added here once verified.' },
  { mark:'FM', role:'Faculty Mentor', text:'Mentorship, approvals and academic guidance for club activities.' },
];
const fallbackTeams = [
  ['CV','Computer Vision','Vision systems, image models and real-time applications.'],
  ['NL','NLP & GenAI','Language models, retrieval systems and agent experiments.'],
  ['ML','Machine Learning','Applied ML, forecasting, tabular modelling and competitions.'],
  ['OR','Outreach & Operations','Events, collaborations, community and club operations.'],
];

export default function AboutPage() {
  const { items } = usePublishedContent({ page:'about' });
  const facultyEntries = items.filter(item => item.type === 'page-section' && item.payload.group === 'faculty');
  const teamEntries = items.filter(item => item.type === 'page-section' && item.payload.group === 'students');
  const projectEntries = items.filter(item => item.type === 'project');

  const faculty = facultyEntries.length ? facultyEntries.map(item => ({
    mark:item.payload.mark || 'FC',role:item.title,text:item.body,
  })) : fallbackFaculty;
  const studentTeams = teamEntries.length ? teamEntries.map(item => [
    item.payload.mark || 'AI',item.title,item.body,
  ]) : fallbackTeams;
  const projects = projectEntries.length ? projectEntries.map(item => ({
    id:item.id,cat:item.excerpt,title:item.title,d:item.body,tags:item.payload.tags || [],
  })) : PROJECTS;

  return (
    <main className="cin-page sub-page">
      <section className="sub-hero about-hero"><div className="cin-shell">
        <div className="cin-section-label">AI CLUB / PEOPLE</div>
        <h1>AI is the technology.<br/><em>People are the network.</em></h1>
        <p>The club brings students and faculty together around practical learning, experimentation and collaborative building.</p>
      </div></section>

      <section className="about-block"><div className="cin-shell">
        <div className="split-heading"><span>01</span><h2>Faculty</h2><p>Guidance and mentorship behind the community.</p></div>
        <div className="people-grid faculty-grid">{faculty.map(item => <article className="person-card" key={item.role}>
          <div className="avatar-placeholder">{item.mark}</div><span>FACULTY</span><h3>{item.role}</h3><p>{item.text}</p>
        </article>)}</div>
      </div></section>

      <section className="about-block alt"><div className="cin-shell">
        <div className="split-heading"><span>02</span><h2>Students</h2><p>Student teams organised around areas of interest.</p></div>
        <div className="people-grid">{studentTeams.map(([mark,title,description]) => <article className="person-card team" key={title}>
          <div className="avatar-placeholder">{mark}</div><span>STUDENT TEAM</span><h3>{title}</h3><p>{description}</p>
        </article>)}</div>
      </div></section>

      <section className="about-block projects-block"><div className="cin-shell">
        <div className="split-heading"><span>03</span><h2>Completed Projects</h2><p>Published project work from the AI Club community.</p></div>
        <div className="completed-projects">{projects.map((item,index) => <article className="completed-project" key={item.id}>
          <div className="project-num">{String(index+1).padStart(2,'0')}</div>
          <div><span>{item.cat}</span><h3>{item.title}</h3><p>{item.d}</p><div className="tag-row">{item.tags.map(tag => <b key={tag}>{tag}</b>)}</div></div>
          <ArrowUpRight size={20}/>
        </article>)}</div>
      </div></section>
    </main>
  );
}
