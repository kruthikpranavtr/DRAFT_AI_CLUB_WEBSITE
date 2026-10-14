import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Newspaper, Search, X } from 'lucide-react';
import { EVENTS } from '../data/eventsData';
import { usePublishedContent } from '../lib/useCms';
import { conceptPhotos, ConceptCTA, ConceptFooter } from '../concept/InnerCommon';

const FILTERS = ['All','Announcements','Events','Workshops','Achievements'];
const imageSet = [conceptPhotos[0],conceptPhotos[2],conceptPhotos[4],conceptPhotos[6],conceptPhotos[8],conceptPhotos[3]];
function groupOf(value) {
  const text = String(value||'').toLowerCase();
  if (text.includes('achiev')||text.includes('award')||text.includes('contest'))return 'Achievements';
  if (text.includes('workshop')||text.includes('training')||text.includes('lab'))return 'Workshops';
  if (text.includes('announc')||text.includes('update'))return 'Announcements';
  return 'Events';
}
function truncate(text,limit=165) {
  if(!text)return '';
  return text.length>limit ? text.slice(0,limit).trimEnd()+'…' : text;
}

export default function NewsPage() {
  const { items } = usePublishedContent({ page:'news' });
  const [filter,setFilter] = useState('All');
  const [search,setSearch] = useState('');
  const [selected,setSelected] = useState(null);
  const cms = items.filter(item=>['news','announcement','event','achievement'].includes(item.type));

  const stories = useMemo(()=>{
    const published = cms.map((item,index)=>({
      id:item.id,title:item.title,
      description:item.body || item.excerpt || '',
      summary:item.excerpt || truncate(item.body || ''),
      date:[item.payload.date,item.payload.month].filter(Boolean).join(' ') || '',
      category:item.payload.category || item.type,
      image:item.payload.imageUrl || item.payload.image || imageSet[index%imageSet.length],
      featured:!!item.payload.featured || item.sort_order===0,
      demo:false,
    }));
    // Keep the experimental layout testable when the CMS has only a few posts.
    // Sample entries are always marked DEMO and disappear once real posts grow.
    if(published.length >= 4)return published;
    const samples=EVENTS.map((item,index)=>({
      id:item.id,title:item.t,description:item.desc,summary:truncate(item.desc),
      date:[item.mo,item.d].filter(Boolean).join(' '),
      category:item.c,image:imageSet[(index+1)%imageSet.length],
      featured:!published.length && index===0,demo:true,
    }));
    return [...published,...samples.slice(0,Math.max(0,5-published.length))];
  },[cms]);

  const featured = stories.find(item=>item.featured)||stories[0];
  const latest = stories.filter(item=>item.id!==featured?.id);
  const results = latest.filter(item=>(filter==='All'||groupOf(item.category)===filter)
    && (item.title+' '+item.description+' '+item.category).toLowerCase().includes(search.toLowerCase().trim()));

  useEffect(()=>{
    if(!selected)return undefined;
    const esc=event=>{if(event.key==='Escape')setSelected(null);};
    const saved=document.body.style.overflow;
    document.body.style.overflow='hidden';
    document.addEventListener('keydown',esc);
    return()=>{document.body.style.overflow=saved;document.removeEventListener('keydown',esc);};
  },[selected]);

  return <main className="concept-page concept-news">
    <section className="concept-news-hero">
      <div className="concept-wrap">
        <div className="concept-news-hero__copy">
          <span className="concept-kicker">COMMUNITY / IDEAS / PROGRESS</span>
          <h1>News <em>& updates.</em></h1>
          <p>Stories, announcements, events and milestones from the AI Club community.</p>
        </div>
        <div className="concept-news-hero__orbit" aria-hidden="true"><span/><span/><span/></div>
      </div>
    </section>

    <section className="concept-wrap concept-news__body">
      {featured && <div className="concept-news__featured">
        <button type="button" className="concept-news-feature-image" onClick={()=>setSelected(featured)}
          aria-label={'Read featured update: '+featured.title}>
          <img src={featured.image} alt="" loading="eager"/>
          <span>FEATURED {featured.demo ? '· DEMO' : ''}</span>
        </button>
        <article className="concept-news-feature-copy">
          <span className="concept-kicker">{groupOf(featured.category)}{featured.date ? ' / '+featured.date : ''}</span>
          <h2>{featured.title}</h2>
          <p>{truncate(featured.description,240)}</p>
          <button type="button" className="concept-button concept-button--solid" onClick={()=>setSelected(featured)}>
            Read story <ArrowRight size={17}/>
          </button>
        </article>
        <aside className="concept-news-side" aria-label="Recent updates">
          <div className="concept-news-side__head"><span className="concept-kicker">MORE FROM THE CLUB</span><Newspaper size={19}/></div>
          {latest.slice(0,3).map(item=><button type="button" key={item.id} onClick={()=>setSelected(item)} className="concept-news-side__item">
            <img src={item.image} alt="" loading="lazy"/>
            <span><small>{groupOf(item.category)} · {item.date}{item.demo ? ' · Demo' : ''}</small><strong>{item.title}</strong></span>
            <ArrowRight size={15}/>
          </button>)}
          {!latest.length && <p className="concept-news-side__empty">More stories will appear here as they are published.</p>}
        </aside>
      </div>}

      <div className="concept-news-filters">
        <div className="concept-pills" role="group" aria-label="Filter news">
          {FILTERS.map(item=><button type="button" key={item} className={filter===item?'is-active':''} aria-pressed={filter===item} onClick={()=>setFilter(item)}>{item}</button>)}
        </div>
        <label className="concept-news-search"><Search size={18}/><span className="sr-only">Search news</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search club updates"/></label>
      </div>

      <div className="concept-section-head concept-news-list-head">
        <div><span className="concept-kicker">FROM THE CLUB</span><h2>Latest <em>stories.</em></h2></div>
        <span className="concept-results">{results.length} {results.length===1?'update':'updates'}</span>
      </div>

      <div className="concept-news-grid">
        {results.map((item,index)=><article className="concept-news-card" key={item.id}>
          <button type="button" className="concept-news-card__media" onClick={()=>setSelected(item)} aria-label={'Read '+item.title}>
            <img src={item.image} loading={index < 4?'eager':'lazy'} alt=""/>
          </button>
          <div className="concept-news-card__content">
            <div className="concept-news-card__meta"><span>{groupOf(item.category)}{item.demo ? ' · Demo' : ''}</span><time>{item.date}</time></div>
            <h3>{item.title}</h3><p>{truncate(item.summary,130)}</p>
            <button type="button" className="concept-news-card__action" onClick={()=>setSelected(item)}>Read more <ArrowRight size={15}/></button>
          </div>
        </article>)}
      </div>
      {!results.length && <div className="concept-empty">No matching updates. Try another category or search.</div>}
      {stories.some(item => item.demo) && <p className="concept-demo-note">Entries marked Demo are preview content, not official announcements. They disappear as more club news is published.</p>}
    </section>

    <ConceptCTA title="Stay curious. Stay connected." subtitle="Discover the projects, people and experiences shaping our community."/>
    <ConceptFooter/>

    {selected && <div className="concept-story-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setSelected(null);}}>
      <article role="dialog" aria-modal="true" aria-labelledby="concept-story-title" className="concept-story-dialog">
        <button type="button" className="concept-story-dialog__close" onClick={()=>setSelected(null)} aria-label="Close story"><X size={22}/></button>
        <img src={selected.image} alt=""/>
        <div><span className="concept-kicker">{groupOf(selected.category)} · {selected.date}</span>
          <h2 id="concept-story-title">{selected.title}</h2>
          <p>{selected.description}</p>
          {selected.demo && <small>Demonstration content, not an official club announcement.</small>}
          <button type="button" className="concept-button concept-button--outline" onClick={()=>setSelected(null)}>Back to news <ArrowRight size={16}/></button>
        </div>
      </article>
    </div>}
  </main>;
}
