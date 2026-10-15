import { useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus,Search,ShieldCheck,MessagesSquare,ArrowUpRight,LockKeyhole } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { hasPermission,PERMISSIONS } from '../../shared/permissions';
import { PostCard,PostEditor } from '../components/CommunityComponents';
import { COMMUNITY_TAGS } from '../lib/community';
import './Community.css';

export default function CommunityPage(){
 const {session}=useAuth();
 const [sort,setSort]=useState('new'),[tag,setTag]=useState(''),[draft,setDraft]=useState(''),[query,setQuery]=useState('');
 const [result,setResult]=useState(null),[error,setError]=useState(null),[version,setVersion]=useState(0);
 const [editor,setEditor]=useState(null),[loadingMore,setLoadingMore]=useState(false),[notice,setNotice]=useState('');
 const filter=new URLSearchParams({sort,...(tag?{tag}:{}),...(query?{q:query}:{})}).toString();
 const key=filter+':'+version;
 const data=result?.key===key?result:null;
 const canModerate=hasPermission(session,PERMISSIONS.MODERATE_COMMUNITY);
 useEffect(()=>{
  const controller=new AbortController();
  api('/api/community/posts?'+filter,{signal:controller.signal}).then(value=>setResult({...value,key}))
   .catch(cause=>{if(!controller.signal.aborted)setError({key,message:cause.message});});
  return()=>controller.abort();
 },[filter,key]);
 function refresh(){setVersion(previous=>previous+1);}
 async function loadMore(){
  setLoadingMore(true);
  try{
   const next=await api('/api/community/posts?'+filter+'&cursor='+encodeURIComponent(data.nextCursor));
   setResult(previous=>previous?.key===key?{...previous,nextCursor:next.nextCursor,items:[...new Map([...previous.items,...next.items].map(item=>[item.id,item])).values()]}:previous);
  }catch(cause){setError({key,message:cause.message});}finally{setLoadingMore(false);}
 }
 function update(id,values){
  if(!values){refresh();return;}
  setResult(previous=>previous?{...previous,items:previous.items.map(p=>p.id===id?{...p,...values}:p),pinned:previous.pinned.map(p=>p.id===id?{...p,...values}:p)}:previous);
 }
 return <DashboardShell section="Community"><div className="community-page">
  {import.meta.env.VITE_PHASE2_PREVIEW&&<p className="community-preview-label">ISOLATED QA DEMO · Synthetic accounts and activity</p>}
  <header className="community-heading"><div><span className="portal-eyebrow">THE MEMBER COMMON ROOM</span><h1>Community<span>.</span></h1><p>Share what you know. Build something together.</p></div><button className="community-button" onClick={()=>setEditor({})}><Plus size={17}/>Create post</button></header>
  {notice&&<p className="community-success" role="status">{notice}</p>}
  <div className="community-layout"><div className="community-feed">
   <section className="community-toolbar" aria-label="Filter Community">
    <form className="community-search" role="search" onSubmit={event=>{event.preventDefault();setQuery(draft.trim());}}><Search size={17}/><input aria-label="Search Community" maxLength={100} placeholder="Search conversations…" value={draft} onChange={e=>setDraft(e.target.value)}/><button type="submit">Search</button></form>
    <div className="community-filter-row"><div className="community-sorts" role="group" aria-label="Feed sorting">{[['new','New'],['top','Top'],['popular','Popular']].map(([value,label])=><button key={value} aria-pressed={sort===value} onClick={()=>setSort(value)}>{label}</button>)}</div><label className="community-topic-select"><span>Topic</span><select aria-label="Filter by topic" value={tag} onChange={e=>setTag(e.target.value)}><option value="">All topics</option>{COMMUNITY_TAGS.map(value=><option key={value}>{value}</option>)}</select></label></div>
   </section>
   {sort==='popular'&&<p className="community-filter-note">Top-scoring conversations from the last seven days.</p>}
   {query&&<div className="community-query">Results for “{query}”<button onClick={()=>{setQuery('');setDraft('');}}>Clear search</button></div>}
   {error?.key===key&&<div className="community-state" role="alert"><p>{error.message}</p><button className="community-button secondary" onClick={refresh}>Try again</button></div>}
   {!data&&error?.key!==key&&<div className="community-state" role="status">Loading conversations…</div>}
   {data&&<>
    {data.pinned.length>0&&<section className="community-announcements" aria-label="Pinned announcements">{data.pinned.map(post=><PostCard key={post.id} post={post} canModerate={canModerate} onChange={values=>update(post.id,values)} onEdit={setEditor}/>)}</section>}
    {data.items.map(post=><PostCard key={post.id} post={post} canModerate={canModerate} onChange={values=>update(post.id,values)} onEdit={setEditor}/>)}
    {data.items.length===0&&data.pinned.length===0&&<div className="community-state community-empty"><MessagesSquare size={34}/><h2>{query||tag?'No matching conversations':'Every conversation starts somewhere.'}</h2><p>{query||tag?'Try a different search or topic.':'Ask a question, share a project, or start with an idea.'}</p><button className="community-button secondary" onClick={()=>setEditor({})}>Start a conversation</button></div>}
    {data.nextCursor&&<button className="community-load-more" disabled={loadingMore} onClick={loadMore}>{loadingMore?'Loading…':'Load more conversations'}</button>}
   </>}
  </div><aside className="community-aside">
   <section className="community-welcome"><div className="community-aside-mark"><MessagesSquare size={24}/></div><span className="portal-eyebrow">CURIOUS MINDS, SHARED SPACE</span><h2>Ideas get better<br/>in good company.</h2><p>A private place for AI Club members to ask, explore, and build.</p><div className="community-private"><LockKeyhole size={15}/>Visible to active members only</div></section>
   <section className="community-side-card"><h2>Find your topic</h2><div className="community-topics">{COMMUNITY_TAGS.map(value=><button key={value} aria-pressed={tag===value} onClick={()=>setTag(tag===value?'':value)}><span>#</span>{value}<ArrowUpRight size={13}/></button>)}</div></section>
   <section className="community-side-card"><h2>Make room for everyone.</h2><ol className="community-guidelines"><li>Be constructive and respectful.</li><li>Credit people and their work.</li><li>Keep personal information private.</li><li>Report concerns for moderator review.</li></ol><p className="community-side-footnote">Community guidance · institution-specific policy and appeals details can be added by the owner.</p></section>
   {canModerate&&<Link to="/admin/moderation" className="community-moderation-link"><ShieldCheck size={18}/><span>Moderation console<small>Reports and content review</small></span><ArrowUpRight size={16}/></Link>}
  </aside></div>
  {editor&&<PostEditor post={editor.id?editor:null} onClose={()=>setEditor(null)} onSaved={()=>{setNotice(editor.id?'Your changes are saved.':'Your post is published.');refresh();}}/>}
 </div></DashboardShell>;
}
