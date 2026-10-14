import { ArrowRight, BookOpen, Box, Lightbulb, Users, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PROJECTS } from '../data/projectsData';
import { usePublishedContent } from '../lib/useCms';
import { ConceptCTA, ConceptFooter, ConceptHeading } from '../concept/InnerCommon';

const fallbackFaculty = [
  { mark:'FC', role:'Faculty Coordinator', text:'Official faculty details can be added after verification.' },
  { mark:'FM', role:'Faculty Mentor', text:'Academic guidance, collaboration and mentorship for student projects.' },
];
const fallbackTeams = [
  { mark:'CV',role:'Computer Vision',text:'Visual intelligence, image recognition and real-time systems.' },
  { mark:'NL',role:'NLP & GenAI',text:'Language models, retrieval and creative AI applications.' },
  { mark:'ML',role:'Machine Learning',text:'Applied models, prediction and problem solving.' },
  { mark:'OP',role:'Outreach & Operations',text:'Events, connections and a welcoming community.' },
];

export default function AboutPage() {
  const { items } = usePublishedContent({ page:'about' });
  const facultyItems = items.filter(item => item.type === 'page-section' && item.payload.group === 'faculty');
  const teamItems = items.filter(item => item.type === 'page-section' && item.payload.group === 'students');
  const projectItems = items.filter(item => item.type === 'project');
  const faculty = facultyItems.length ? facultyItems.map(item=>({
    mark:item.payload.mark || 'FC',role:item.title,text:item.body,
  })) : fallbackFaculty;
  const teams = teamItems.length ? teamItems.map(item=>({
    mark:item.payload.mark || 'AI',role:item.title,text:item.body,
  })) : fallbackTeams;
  const projects = projectItems.length ? projectItems.map(item=>({
    id:item.id,cat:item.excerpt,title:item.title,description:item.body,tags:item.payload.tags||[],
  })) : PROJECTS.map(item=>({
    id:item.id,cat:item.cat,title:item.title,description:item.d,tags:item.tags,
  }));

  return <main className="concept-page concept-about">
    <section className="concept-about-hero">
      <div className="concept-wrap concept-about-hero__grid">
        <div className="concept-about-hero__copy">
          <span className="concept-kicker">WHO WE ARE</span>
          <h1>About <em>AI Club.</em></h1>
          <p className="concept-about-hero__lead">A student-driven community for a brighter tomorrow.</p>
          <p>We bring curious minds together to explore artificial intelligence, learn from one another, and turn ideas into meaningful projects.</p>
          <Link className="concept-button concept-button--solid" to="/login">Join our community <ArrowRight size={16}/></Link>
        </div>
        <div className="concept-about-hero__photo">
          <img src="/concept/club-team.jpg" alt="Students collaborating as a team"/>
          <span>LEARN <i/> BUILD <i/> CONNECT</span>
        </div>
      </div>
    </section>

    <section className="concept-wrap concept-mission" aria-labelledby="concept-mission-heading">
      <div className="concept-mission__intro">
        <span className="concept-kicker">OUR MISSION</span>
        <h2 id="concept-mission-heading">Creating room for <em>what's next.</em></h2>
        <p>AI grows more meaningful when we learn together. Our club supports practical exploration, responsible ideas, and student-led creativity.</p>
      </div>
      <div className="concept-mission__pillars">
        <article><span className="concept-pillar-icon"><BookOpen size={24}/></span><h3>Learn</h3><p>Workshops, shared knowledge and opportunities to grow.</p></article>
        <article><span className="concept-pillar-icon"><Box size={24}/></span><h3>Build</h3><p>Hands-on experiments that turn curiosity into solutions.</p></article>
        <article><span className="concept-pillar-icon"><Users size={24}/></span><h3>Connect</h3><p>A supportive network of students, faculty and creators.</p></article>
      </div>
    </section>

    <section className="concept-wrap concept-people">
      <ConceptHeading kicker="OUR PEOPLE" description="The community grows through the people who guide it and the students who make it their own.">
        Guided by mentors.<br/><em>Driven by students.</em>
      </ConceptHeading>
      <div className="concept-people__groups">
        <div>
          <div className="concept-people__subhead"><h3>Faculty & mentors</h3><span>Guidance</span></div>
          <div className="concept-mentor-list">
            {faculty.map(item=><article className="concept-mentor" key={item.role}>
              <div className="concept-avatar concept-avatar--faculty" aria-hidden="true">{item.mark}</div>
              <div><span>FACULTY</span><h4>{item.role}</h4><p>{item.text}</p></div>
            </article>)}
          </div>
        </div>
        <div>
          <div className="concept-people__subhead"><h3>Student teams</h3><span>Collaboration</span></div>
          <div className="concept-team-grid">
            {teams.map((team,index)=><article className="concept-team" key={team.role}>
              <div className={'concept-avatar concept-avatar--'+index%4} aria-hidden="true">{team.mark}</div>
              <h4>{team.role}</h4><p>{team.text}</p>
            </article>)}
          </div>
        </div>
      </div>
    </section>

    <section className="concept-wrap concept-approach">
      <div className="concept-approach__copy">
        <span className="concept-kicker">FROM IDEA TO IMPACT</span>
        <h2>Think boldly.<br/><em>Build together.</em></h2>
        <p>Across different interests and skill levels, the club creates space to learn, test and share new approaches.</p>
      </div>
      <div className="concept-approach__visual">
        <img src="/concept/club-project.jpg" alt="A collaborative technology project in progress" loading="lazy"/>
        <span><Lightbulb size={17}/> IDEAS INTO ACTION</span>
      </div>
    </section>

    <section className="concept-wrap concept-projects-preview">
      <div className="concept-projects-preview__heading"><span className="concept-kicker">WHAT WE BUILD</span><h2>Projects in progress.</h2></div>
      <div className="concept-projects-preview__grid">
        {projects.slice(0,3).map((project,index)=><article key={project.id}>
          <div className="concept-projects-preview__icon"><Sparkles size={23}/><span>{String(index+1).padStart(2,'0')}</span></div>
          <small>{project.cat}</small><h3>{project.title}</h3><p>{project.description}</p>
        </article>)}
      </div>
      {!projectItems.length && <p className="concept-demo-note">Project examples are sample entries until official club projects are published.</p>}
    </section>
    <ConceptCTA title="Let's build a brighter tomorrow." subtitle="Wherever you are on your AI journey, there's a place to begin."/>
    <ConceptFooter/>
  </main>;
}
