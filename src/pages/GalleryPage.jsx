import { useState } from 'react';
import { CalendarDays, Trophy, Images, ArrowUpRight } from 'lucide-react';
import { GALLERY } from '../data/galleryData';
import { EVENTS } from '../data/eventsData';
import { ACHIEVEMENTS } from '../data/achievementsData';

export default function GalleryPage() {
  const [tab, setTab] = useState('gallery');
  return (
    <main className="cin-page sub-page">
      <section className="sub-hero">
        <div className="cin-shell">
          <div className="cin-section-label">AI CLUB / ARCHIVE</div>
          <h1>Gallery,<br/><em>events & achievements.</em></h1>
          <p>A visual record of what the community builds, hosts and celebrates.</p>
          <div className="archive-tabs">
            <button className={tab==='gallery'?'active':''} onClick={()=>setTab('gallery')}><Images size={16}/> Gallery</button>
            <button className={tab==='events'?'active':''} onClick={()=>setTab('events')}><CalendarDays size={16}/> Events</button>
            <button className={tab==='achievements'?'active':''} onClick={()=>setTab('achievements')}><Trophy size={16}/> Achievements</button>
          </div>
        </div>
      </section>

      <section className="archive-body">
        <div className="cin-shell">
          {tab==='gallery' && <div className="gallery-masonry">
            {GALLERY.map((g,i)=><article className={'gallery-card g'+(i%5)} key={g.id}>
              <img src={`https://picsum.photos/seed/${g.seed}/900/700.jpg`} alt={g.t} loading="lazy"/>
              <div><span>{g.c}</span><h3>{g.t}</h3><p>{g.date}</p></div>
            </article>)}
          </div>}

          {tab==='events' && <div className="event-list">
            {EVENTS.map(e=><article className="event-card" key={e.id}>
              <div className="event-date"><b>{e.d}</b><span>{e.mo}</span></div>
              <div><span className="eyebrow">{e.s==='up'?'UPCOMING':'COMPLETED'} · {e.c}</span><h3>{e.t}</h3><p>{e.desc}</p></div>
              <ArrowUpRight size={18}/>
            </article>)}
          </div>}

          {tab==='achievements' && <div className="achievement-grid">
            {ACHIEVEMENTS.map(a=><article className="achievement-card" key={a.id}>
              <span className="year">{a.yr}</span><Trophy size={22}/><h3>{a.t}</h3><p>{a.long}</p><small>{a.meta}</small>
            </article>)}
          </div>}
        </div>
      </section>
    </main>
  );
}
