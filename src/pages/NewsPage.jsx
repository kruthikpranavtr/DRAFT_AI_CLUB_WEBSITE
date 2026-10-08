import { ArrowUpRight, Bell } from 'lucide-react';
import { EVENTS } from '../data/eventsData';

export default function NewsPage() {
  const upcoming = EVENTS.filter(e => e.s === 'up');
  const completed = EVENTS.filter(e => e.s === 'done');

  return (
    <main className="cin-page sub-page">
      <section className="sub-hero news-hero">
        <div className="cin-shell">
          <div className="cin-section-label">AI CLUB / SIGNAL</div>
          <h1>News from<br/><em>inside the network.</em></h1>
          <p>Announcements, event updates and club activity in one editorial feed.</p>
        </div>
      </section>

      <section className="news-body">
        <div className="cin-shell">
          {upcoming[0] && <article className="featured-news">
            <div><span className="news-chip"><Bell size={13}/> FEATURED UPDATE</span><h2>{upcoming[0].t}</h2><p>{upcoming[0].desc}</p><small>{upcoming[0].d} {upcoming[0].mo} · {upcoming[0].c}</small></div>
            <div className="feature-visual"><span>AI</span></div>
          </article>}

          <div className="news-heading"><h2>Latest</h2><span>Repository-backed demo content</span></div>
          <div className="news-list">
            {[...upcoming.slice(1), ...completed].map((e,i)=><article key={e.id}>
              <span className="news-index">{String(i+1).padStart(2,'0')}</span>
              <div><small>{e.mo} {e.d} · {e.c}</small><h3>{e.t}</h3><p>{e.desc}</p></div>
              <ArrowUpRight size={18}/>
            </article>)}
          </div>
        </div>
      </section>
    </main>
  );
}
