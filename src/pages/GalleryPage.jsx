import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Images, Trophy, X } from 'lucide-react';
import { GALLERY } from '../data/galleryData';
import { EVENTS } from '../data/eventsData';
import { ACHIEVEMENTS } from '../data/achievementsData';
import { get } from '../lib/api';
import { usePublishedContent } from '../lib/useCms';
import { conceptPhotos, ConceptCTA, ConceptFooter } from '../concept/InnerCommon';

const YEAR = new Date().getFullYear();
const CATEGORIES = ['All','Events','Workshops','Projects','Community'];
const classify = text => {
  const value = String(text || '').toLowerCase();
  if (/workshop|training|session|lab/.test(value)) return 'Workshops';
  if (/project|demo|prototype|research|build/.test(value)) return 'Projects';
  if (/community|people|team|visitor|collab|meet/.test(value)) return 'Community';
  return 'Events';
};

export default function GalleryPage({ embedded=false, initialMode='gallery' }) {
  const [mode, setMode] = useState(initialMode);
  const [category, setCategory] = useState('All');
  const [gallery, setGallery] = useState([]);
  const [selected, setSelected] = useState(null);
  const { items:content } = usePublishedContent({ page:'gallery' });

  useEffect(() => {
    let active = true;
    get('/api/public/gallery').then(data => {
      if (active) setGallery(data.items || []);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selected) return undefined;
    const onKey = event => { if (event.key === 'Escape') setSelected(null); };
    document.addEventListener('keydown',onKey);
    const scroll = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown',onKey);
      document.body.style.overflow = scroll;
    };
  }, [selected]);

  const photos = useMemo(() => gallery.length
    ? gallery.map((item,index) => ({
      id:item.id,
      image:item.public_url,
      title:item.title,
      category:item.category_name || 'Gallery',
      caption:item.caption || '',
      alt:item.alt_text || item.title,
      index,
    }))
    : (embedded ? [] : GALLERY).map((item,index) => ({
      id:item.id, image:conceptPhotos[index % conceptPhotos.length],
      title:item.t, category:item.c, caption:item.desc || '',
      alt:item.t, index, demo:true,
    })),[gallery,embedded]);

  const filtered = photos.filter(item => category === 'All' || classify(item.category) === category);
  const cmsEvents = content.filter(item => item.type === 'event');
  const events = cmsEvents.length ? cmsEvents.map(item => ({
    id:item.id,title:item.title,description:item.body,
    date:[item.payload.date,item.payload.month].filter(Boolean).join(' '),
    status:item.payload.completed ? 'Completed' : 'Upcoming',
  })) : EVENTS.map(item => ({
    id:item.id,title:item.t,description:item.desc,date:[item.d,item.mo].filter(Boolean).join(' '),
    status:item.s === 'up' ? 'Upcoming' : 'Completed',
  }));
  const cmsAchievements = content.filter(item => item.type === 'achievement');
  const achievements = cmsAchievements.length ? cmsAchievements.map(item => ({
    id:item.id,title:item.title,description:item.body,year:item.payload.year || YEAR,
  })) : (embedded ? [] : ACHIEVEMENTS).map(item => ({
    id:item.id,title:item.t,description:item.long,year:item.yr,
  }));

  function viewPhoto(delta) {
    if (!selected) return;
    const index = photos.findIndex(item => item.id === selected.id);
    setSelected(photos[(index + delta + photos.length) % photos.length]);
  }

  const Wrapper = embedded ? 'div' : 'main';
  return <Wrapper className={embedded ? 'concept-gallery concept-gallery--embedded' : 'concept-page concept-gallery'}>
    {!embedded && <section className="concept-gallery-hero">
      <div className="concept-wrap concept-gallery-hero__content">
        <div className="concept-hero-copy">
          <span className="concept-kicker concept-kicker--light">MOMENTS / PEOPLE / IDEAS</span>
          <h1>Moments from<br/><em>AI Club.</em></h1>
          <p>Workshops, projects, events and the people who make our community extraordinary.</p>
        </div>
        <span className="concept-gallery-hero__side">IDEAS<br/>PEOPLE<br/>IMPACT</span>
      </div>
    </section>}

    <section className="concept-wrap concept-gallery__body" aria-label="Gallery collection">
      {!embedded && <div className="concept-modes" role="group" aria-label="Gallery views">
        <button type="button" className={mode==='gallery'?'is-selected':''} onClick={()=>setMode('gallery')}><Images size={16}/> Photos</button>
        <button type="button" className={mode==='events'?'is-selected':''} onClick={()=>setMode('events')}><CalendarDays size={16}/> Events</button>
        <button type="button" className={mode==='achievements'?'is-selected':''} onClick={()=>setMode('achievements')}><Trophy size={16}/> Achievements</button>
      </div>}

      {mode === 'gallery' && <>
        <div className="concept-filter-row">
          <div className="concept-pills" role="group" aria-label="Filter photos by category">
            {CATEGORIES.map(item => <button type="button" key={item}
              className={category === item ? 'is-active' : ''}
              aria-pressed={category === item} onClick={()=>setCategory(item)}>{item}</button>)}
          </div>
          <span className="concept-results">{filtered.length} {filtered.length === 1 ? 'moment' : 'moments'}</span>
        </div>
        <div className="concept-photo-grid">
          {filtered.map((item,index) => <button
            type="button" className={'concept-photo-card concept-photo-card--'+(index%7)}
            key={item.id} onClick={()=>setSelected(item)}
            aria-label={'View photo: '+item.title}>
            <img src={item.image} alt={item.alt} loading={index < 4 ? 'eager' : 'lazy'}/>
            <span className="concept-photo-card__details">
              <span>{item.category}{item.demo ? ' · Demo' : ''}</span><strong>{item.title}</strong>
            </span>
            <span className="concept-photo-card__open" aria-hidden="true"><ArrowRight size={17}/></span>
          </button>)}
        </div>
        {!filtered.length && <div className="concept-empty">No photos in this category yet. Try another filter.</div>}
        {!embedded && !gallery.length && <p className="concept-demo-note">Preview images and captions are samples. Your published club photographs will appear here when available.</p>}
      </>}

      {mode==='events' && <div className="concept-info-list">
        {events.map((item,index)=><article key={item.id} className="concept-info-row">
          <span className="concept-info-index">{String(index+1).padStart(2,'0')}</span>
          <div><small>{item.status} · {item.date}</small><h2>{item.title}</h2><p>{item.description}</p></div>
          <CalendarDays size={24} aria-hidden="true"/>
        </article>)}
      </div>}
      {mode==='achievements' && <div className="concept-info-list">
        {!achievements.length && <div className="concept-empty">No published achievements yet.</div>}
        {achievements.map((item,index)=><article key={item.id} className="concept-info-row">
          <span className="concept-info-index">{String(index+1).padStart(2,'0')}</span>
          <div><small>Achievement · {item.year}</small><h2>{item.title}</h2><p>{item.description}</p></div>
          <Trophy size={24} aria-hidden="true"/>
        </article>)}
      </div>}
    </section>

    {!embedded && <><ConceptCTA title="More moments. Better tomorrows." subtitle="Every workshop, experiment and shared idea adds something to our story."/><ConceptFooter/></>}

    {selected && <div className="concept-lightbox" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setSelected(null);}}>
      <div className="concept-lightbox__dialog" role="dialog" aria-modal="true" aria-label={selected.title}>
        <button className="concept-lightbox__close" type="button" onClick={()=>setSelected(null)} aria-label="Close image"><X size={22}/></button>
        <img src={selected.image} alt={selected.alt}/>
        <div className="concept-lightbox__bottom">
          <button type="button" onClick={()=>viewPhoto(-1)} aria-label="Previous photo"><ArrowLeft size={21}/></button>
          <div><small>{selected.category}</small><strong>{selected.title}</strong>{selected.caption && <p>{selected.caption}</p>}</div>
          <button type="button" onClick={()=>viewPhoto(1)} aria-label="Next photo"><ArrowRight size={21}/></button>
        </div>
      </div>
    </div>}
  </Wrapper>;
}
