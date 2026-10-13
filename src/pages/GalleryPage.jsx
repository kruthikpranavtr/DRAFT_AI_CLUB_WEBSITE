import { useEffect, useState } from 'react';
import { CalendarDays, Trophy, Images, ArrowUpRight } from 'lucide-react';
import { GALLERY } from '../data/galleryData';
import { EVENTS } from '../data/eventsData';
import { ACHIEVEMENTS } from '../data/achievementsData';
import { get } from '../lib/api';
import { usePublishedContent } from '../lib/useCms';

const CURRENT_YEAR = new Date().getFullYear();

export default function GalleryPage() {
  const [tab,setTab] = useState('gallery');
  const [gallery,setGallery] = useState([]);
  const { items:cmsItems } = usePublishedContent({ page:'gallery' });

  useEffect(() => {
    let active = true;
    get('/api/public/gallery').then(data => { if (active) setGallery(data.items); }).catch(() => {});
    return () => { active = false; };
  },[]);

  const galleryItems = gallery.length ? gallery.map(item => ({
    id:item.id,image:item.public_url,t:item.title,c:item.category_name || 'Gallery',date:item.caption,alt:item.alt_text,
  })) : GALLERY.map(item => ({ ...item,image:`https://picsum.photos/seed/${item.seed}/900/700.jpg`,alt:item.t }));

  const cmsEvents = cmsItems.filter(item => item.type === 'event');
  const events = cmsEvents.length ? cmsEvents.map(item => ({
    id:item.id,d:item.payload.date || '',mo:item.payload.month || '',s:item.payload.completed ? 'done' : 'up',
    c:item.payload.category || 'Event',t:item.title,desc:item.body,
  })) : EVENTS;

  const cmsAchievements = cmsItems.filter(item => item.type === 'achievement');
  const achievements = cmsAchievements.length ? cmsAchievements.map(item => ({
    id:item.id,yr:item.payload.year || CURRENT_YEAR,t:item.title,long:item.body,meta:item.excerpt,
  })) : ACHIEVEMENTS;

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

      <section className="archive-body"><div className="cin-shell">
        {tab==='gallery' && <div className="gallery-masonry">{galleryItems.map((item,index)=><article className={'gallery-card g'+(index%5)} key={item.id}>
          <img src={item.image} alt={item.alt} loading="lazy"/><div><span>{item.c}</span><h3>{item.t}</h3><p>{item.date}</p></div>
        </article>)}</div>}
        {tab==='events' && <div className="event-list">{events.map(item=><article className="event-card" key={item.id}>
          <div className="event-date"><b>{item.d}</b><span>{item.mo}</span></div><div><span className="eyebrow">{item.s==='up'?'UPCOMING':'COMPLETED'} · {item.c}</span><h3>{item.t}</h3><p>{item.desc}</p></div><ArrowUpRight size={18}/>
        </article>)}</div>}
        {tab==='achievements' && <div className="achievement-grid">{achievements.map(item=><article className="achievement-card" key={item.id}>
          <span className="year">{item.yr}</span><Trophy size={22}/><h3>{item.t}</h3><p>{item.long}</p><small>{item.meta}</small>
        </article>)}</div>}
      </div></section>
    </main>
  );
}
