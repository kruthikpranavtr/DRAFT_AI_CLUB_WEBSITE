import { ArrowUpRight } from 'lucide-react';
import { PROJECTS } from '../data/projectsData';

const faculty = [
  { mark:'FC', role:'Faculty Coordinator', text:'Official faculty profile details can be added here once verified.' },
  { mark:'FM', role:'Faculty Mentor', text:'Mentorship, approvals and academic guidance for club activities.' },
];

const studentTeams = [
  ['CV','Computer Vision','Vision systems, image models and real-time applications.'],
  ['NL','NLP & GenAI','Language models, retrieval systems and agent experiments.'],
  ['ML','Machine Learning','Applied ML, forecasting, tabular modelling and competitions.'],
  ['OR','Outreach & Operations','Events, collaborations, community and club operations.'],
];

export default function AboutPage() {
  return (
    <main className="cin-page sub-page">
      <section className="sub-hero about-hero">
        <div className="cin-shell">
          <div className="cin-section-label">AI CLUB / PEOPLE</div>
          <h1>AI is the technology.<br/><em>People are the network.</em></h1>
          <p>The club brings students and faculty together around practical learning, experimentation and collaborative building.</p>
        </div>
      </section>

      <section className="about-block">
        <div className="cin-shell">
          <div className="split-heading"><span>01</span><h2>Faculty</h2><p>Guidance and mentorship behind the community.</p></div>
          <div className="people-grid faculty-grid">
            {faculty.map(f=><article className="person-card" key={f.role}><div className="avatar-placeholder">{f.mark}</div><span>FACULTY</span><h3>{f.role}</h3><p>{f.text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="about-block alt">
        <div className="cin-shell">
          <div className="split-heading"><span>02</span><h2>Students</h2><p>Student teams organised around areas of interest.</p></div>
          <div className="people-grid">
            {studentTeams.map(([m,t,d])=><article className="person-card team" key={t}><div className="avatar-placeholder">{m}</div><span>STUDENT TEAM</span><h3>{t}</h3><p>{d}</p></article>)}
          </div>
        </div>
      </section>

      <section className="about-block projects-block">
        <div className="cin-shell">
          <div className="split-heading"><span>03</span><h2>Completed Projects</h2><p>The repository currently contains demo/showcase project data; replace these entries with verified completed projects when ready.</p></div>
          <div className="completed-projects">
            {PROJECTS.map((p,i)=><article className="completed-project" key={p.id}>
              <div className="project-num">0{i+1}</div>
              <div><span>{p.cat}</span><h3>{p.title}</h3><p>{p.d}</p><div className="tag-row">{p.tags.map(t=><b key={t}>{t}</b>)}</div></div>
              <ArrowUpRight size={20}/>
            </article>)}
          </div>
        </div>
      </section>
    </main>
  );
}
