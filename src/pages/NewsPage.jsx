import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Newspaper, Search, X } from 'lucide-react';
import { useNews } from '../lib/useNews';
import { NEWS_CATEGORIES,LEGACY_NEWS_CATEGORIES,newsCategory,safeNewsUrl } from '../../shared/news';
import { conceptPhotos, ConceptCTA, ConceptFooter } from '../concept/InnerCommon';

const FILTERS = ['All',...LEGACY_NEWS_CATEGORIES,...NEWS_CATEGORIES];
const imageSet = [conceptPhotos[0],conceptPhotos[2],conceptPhotos[4],conceptPhotos[6],conceptPhotos[8],conceptPhotos[3]];
function groupOf(value) {
  return newsCategory(value);
}
function truncate(text,limit=165) {
  if(!text)return '';
  return text.length>limit ? text.slice(0,limit).trimEnd()+'…' : text;
}

export default function NewsPage() {
  const [filter,setFilter] = useState('All');
  const [search,setSearch] = useState('');
  const [archived,setArchived] = useState(false);
  const {items,total,loading,error,more,retry}=useNews({filter,search,archived});
  const [selected,setSelected] = useState(null);
  const storyDialog=useRef(null);

  const stories = useMemo(()=>{
    return items.map((item,index)=>({
      id:item.id,title:item.title,
      description:item.body || item.excerpt || '',
      summary:item.excerpt || truncate(item.body || ''),
      date:item.news?.publishedAt ? new Date(item.news.publishedAt).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}) : [item.payload.date,item.payload.month].filter(Boolean).join(' ') || '',
      category:item.news?.category || item.payload.category || item.type,
      image:item.payload.imageUrl || item.payload.image || imageSet[index%imageSet.length],
      featured:item.news?.featured ?? !!item.payload.featured,
      news:item.news,
      demo:false,
    }));
  },[items]);

  const featured = stories.find(item=>item.featured)||stories[0];
  const latest = stories.filter(item=>item.id!==featured?.id);
  const results = latest;

  useEffect(()=>{
    if(!selected)return undefined;
    const previousFocus=document.activeElement;
    const esc=event=>{
      if(event.key==='Escape')setSelected(null);
      if(event.key==='Tab') {
        const controls=[...storyDialog.current.querySelectorAll('a[href],button:not(:disabled)')];
        const first=controls[0],last=controls.at(-1);
        if(event.shiftKey && document.activeElement===first) {event.preventDefault();last?.focus();}
        else if(!event.shiftKey && document.activeElement===last) {event.preventDefault();first?.focus();}
      }
    };
    const saved=document.body.style.overflow;
    document.body.style.overflow='hidden';
    document.addEventListener('keydown',esc);
    storyDialog.current.querySelector('button')?.focus();
    return()=>{document.body.style.overflow=saved;document.removeEventListener('keydown',esc);previousFocus?.focus();};
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
          <NewsAttribution item={featured}/>
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
          {FILTERS.map(item=><button type="button" key={item} className={filter===item?'is-active':''} aria-pressed={filter===item} onClick={()=>{setSelected(null);setFilter(item);}}>{item}</button>)}
        </div>
        <label className="concept-news-search"><Search size={18}/><span className="sr-only">Search news</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search club updates"/></label>
      </div>
      <label className="concept-demo-note"><input type="checkbox" checked={archived} onChange={event=>setArchived(event.target.checked)}/> Show archived/completed opportunities</label>
      {loading && <p role="status" className="concept-empty">Loading news…</p>}
      {error && <div role="alert" className="concept-empty">News could not be loaded. <button type="button" className="concept-button concept-button--outline" onClick={retry}>Try again</button></div>}

      <div className="concept-section-head concept-news-list-head">
        <div><span className="concept-kicker">FROM THE CLUB</span><h2>Latest <em>stories.</em></h2></div>
        <span className="concept-results">{total} {total===1?'update':'updates'}</span>
      </div>

      <div className="concept-news-grid">
        {results.map((item,index)=><article className="concept-news-card" key={item.id}>
          <button type="button" className="concept-news-card__media" onClick={()=>setSelected(item)} aria-label={'Read '+item.title}>
            <img src={item.image} loading={index < 4?'eager':'lazy'} alt=""/>
          </button>
          <div className="concept-news-card__content">
            <div className="concept-news-card__meta"><span>{groupOf(item.category)}{item.demo ? ' · Demo' : ''}</span><time>{item.date}</time></div>
            <h3>{item.title}</h3><p>{truncate(item.summary,130)}</p>
            <NewsAttribution item={item}/>
            <button type="button" className="concept-news-card__action" onClick={()=>setSelected(item)}>Read more <ArrowRight size={15}/></button>
          </div>
        </article>)}
      </div>
      {!stories.length && !loading && !error && <div className="concept-empty">No matching updates. Try another category or search.</div>}
      {items.length<total && <button type="button" className="concept-button concept-button--outline" disabled={loading} onClick={more}>{loading?'Loading…':'Load more updates'}</button>}
      {stories.some(item=>item.news?.sourceId==='arxiv-research') && <p className="concept-demo-note">Thank you to arXiv for use of its open access interoperability. Research metadata: CC0. AI Club is independent and is not endorsed by arXiv. Illustrations are club images, not publisher images.</p>}
      {stories.some(item => item.demo) && <p className="concept-demo-note">Entries marked Demo are preview content, not official announcements. They disappear as more club news is published.</p>}
    </section>

    <ConceptCTA title="Stay curious. Stay connected." subtitle="Discover the projects, people and experiences shaping our community."/>
    <ConceptFooter/>

    {selected && <div className="concept-story-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setSelected(null);}}>
      <article ref={storyDialog} role="dialog" aria-modal="true" aria-labelledby="concept-story-title" className="concept-story-dialog">
        <button type="button" className="concept-story-dialog__close" onClick={()=>setSelected(null)} aria-label="Close story"><X size={22}/></button>
        <img src={selected.image} alt=""/>
        <div><span className="concept-kicker">{groupOf(selected.category)} · {selected.date}</span>
          <h2 id="concept-story-title">{selected.title}</h2>
          <p>{selected.description}</p>
          <NewsAttribution item={selected} detailed/>
          {selected.demo && <small>Demonstration content, not an official club announcement.</small>}
          <button type="button" className="concept-button concept-button--outline" onClick={()=>setSelected(null)}>Back to news <ArrowRight size={16}/></button>
        </div>
      </article>
    </div>}
  </main>;
}

function NewsAttribution({item,detailed=false}) {
  const news=item.news;
  if (!news) return null;
  const original=safeNewsUrl(news.sourceUrl);
  const registration=safeNewsUrl(news.opportunity?.registrationUrl);
  return <div className="concept-demo-note">
    {original && <p><a href={original} target="_blank" rel="noopener noreferrer">Read original at {news.sourceName || new URL(original).hostname} ↗</a>{news.contentType==='research'?' · Research preprint (not necessarily peer reviewed)':''}</p>}
    {news.opportunity?.registrationDeadline && <p>{news.expired?'Registration closed':'Registration deadline'}: {new Date(news.opportunity.registrationDeadline).toLocaleString()} · {news.verified?'Organizer information verified':'Unverified — confirm with organizer'}</p>}
    {news.category==='Hackathons' && !news.opportunity?.registrationDeadline && <p>Registration deadline unknown — confirm with organizer.</p>}
    {news.archived && <p>Archived/completed opportunity</p>}
    {detailed && <>
      {Object.entries({name:'Event',organizer:'Organizer',format:'Format',location:'Location',eligibility:'Eligibility',teamSize:'Team size',prizeDetails:'Prize details'}).map(([key,label])=>news.opportunity?.[key]?<p key={key}>{label}: {news.opportunity[key]}</p>:null)}
      {Object.entries({registrationOpen:'Registration opens',startDate:'Event starts',endDate:'Event ends',lastVerified:'Last organizer verification'}).map(([key,label])=>news.opportunity?.[key]?<p key={key}>{label}: {new Date(news.opportunity[key]).toLocaleString()}</p>:null)}
      {registration && <p><a href={registration} target="_blank" rel="noopener noreferrer">Official registration ↗</a></p>}
      {news.license && <p>{news.license} · {news.attribution}</p>}
    </>}
  </div>;
}
