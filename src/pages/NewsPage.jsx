import { ArrowUpRight, Bell } from 'lucide-react';
import { EVENTS } from '../data/eventsData';
import { usePublishedContent } from '../lib/useCms';

export default function NewsPage() {
  const { items } = usePublishedContent({ page:'news' });
  const cmsNews = items.filter(item => ['news','announcement','event'].includes(item.type));
  const entries = cmsNews.length ? cmsNews.map(item => ({
    id:item.id,
    t:item.title,
    desc:item.body,
    d:item.payload.date || '',
    mo:item.payload.month || '',
    c:item.payload.category || item.type,
    featured:item.payload.featured || item.sort_order === 0,
  })) : EVENTS.map((item,index) => ({ ...item,featured:index === 0 }));

  const featured = entries.find(item => item.featured) || entries[0];
  const latest = entries.filter(item => item.id !== featured?.id);

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
          {featured && <article className="featured-news">
            <div><span className="news-chip"><Bell size={13}/> FEATURED UPDATE</span><h2>{featured.t}</h2><p>{featured.desc}</p><small>{featured.d} {featured.mo} · {featured.c}</small></div>
            <div className="feature-visual"><span>AI</span></div>
          </article>}

          <div className="news-heading"><h2>Latest</h2><span>Published by the AI Club team</span></div>
          <div className="news-list">
            {latest.map((item,index) => <article key={item.id}>
              <span className="news-index">{String(index+1).padStart(2,'0')}</span>
              <div><small>{item.mo} {item.d} · {item.c}</small><h3>{item.t}</h3><p>{item.desc}</p></div>
              <ArrowUpRight size={18}/>
            </article>)}
          </div>
        </div>
      </section>
    </main>
  );
}
