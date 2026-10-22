import { useCallback,useEffect,useId,useRef,useState } from 'react';
import { Plus } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import DashboardSheet from '../components/DashboardSheet';
import { api } from '../lib/api';
import { PageHead,StateMessage } from './StudentDashboardPage';
import { NEWS_CATEGORIES,LEGACY_NEWS_CATEGORIES,safeNewsUrl } from '../../shared/news';
import './AdminNewsPage.css';

const categories=[...NEWS_CATEGORIES,...LEGACY_NEWS_CATEGORIES];
const blank={title:'',summary:'',body:'',category:'AI News',status:'draft',approval:'approved',featured:false,archived:false,autoArchive:true,sourceUrl:null,expiresAt:null,opportunity:{}};
export default function AdminNewsPage() {
  const [tab,setTab]=useState('Entries');
  const [search,setSearch]=useState('');
  const [approval,setApproval]=useState('');
  const [offset,setOffset]=useState(0);
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [editor,setEditor]=useState(null);
  const [deleting,setDeleting]=useState(null);
  const [loading,setLoading]=useState(true);
  const request=useRef(null);
  const trigger=useRef(null);
  const load=useCallback(async() => {
    request.current?.abort();
    const controller=new AbortController();
    request.current=controller;
    setLoading(true);setError('');
    try {
      const params=new URLSearchParams({search,approval,offset:String(offset),limit:'20'});
      const options={signal:controller.signal};
      const [entries,sources,policies,runs]=await Promise.all([
        api('/api/admin/news?'+params,options),api('/api/admin/news/sources',options),api('/api/admin/news/policies',options),api('/api/admin/news/runs',options),
      ]);
      if (!controller.signal.aborted) setData({entries,sources:sources.items,policies:policies.items,runs:runs.items});
    } catch(cause) { if (!controller.signal.aborted) setError(cause.message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  },[search,approval,offset]);
  useEffect(() => {
    const timer=setTimeout(load,200);
    return () => { clearTimeout(timer);request.current?.abort(); };
  },[load]);
  async function act(path,method,body,success) {
    if (busy) return;
    setBusy(true);setError('');setMessage('');
    try {
      const result=await api(path,{method,...(body===undefined?{}:{body:JSON.stringify(body)})});
      setMessage(typeof success==='function'?success(result):success);
      await load();
    } catch(cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  return <DashboardShell section="News management">
    <PageHead eyebrow="CONTENT MANAGEMENT" title="News management." text="Review collected updates, publish club stories, and control trusted sources."
      action={<button className="dash-action" onClick={event=>{trigger.current=event.currentTarget;setEditor({form:blank});}}><Plus size={17}/> Create manual news</button>}/>
    <div className="news-admin-tabs" role="group" aria-label="News management sections">{['Entries','Sources','Publication policies','Collection history'].map(name=><button key={name} className={tab===name?'dash-action':'portal-secondary-button'} aria-pressed={tab===name} onClick={()=>setTab(name)}>{name}</button>)}</div>
    {message && <div className="portal-banner" role="status">{message}</div>}
    {error && <StateMessage tone="error">{error} <button className="portal-secondary-button" onClick={load}>Retry</button></StateMessage>}
    {loading && <StateMessage>Loading news management…</StateMessage>}
    {data && tab==='Entries' && <>
      <form className="portal-search news-admin-search" onSubmit={event=>event.preventDefault()}><label className="sr-only" htmlFor="news-admin-search">Search news entries</label><input id="news-admin-search" value={search} placeholder="Search titles and summaries" onChange={event=>{setOffset(0);setSearch(event.target.value);}}/><label className="news-admin-filter">Review status <select value={approval} onChange={event=>{setOffset(0);setApproval(event.target.value);}}><option value="">All statuses</option>{['pending','approved','rejected'].map(value=><option key={value}>{value}</option>)}</select></label></form>
      {!loading && !data.entries.items.length && <StateMessage>No matching news entries. Create a manual post or enable a reviewed source.</StateMessage>}
      <div className="news-admin-list">{data.entries.items.map(item=><article key={item.id} className="dash-card news-admin-entry">
        <div><span className="portal-eyebrow">{item.news.category} · {item.news.sourceName || 'Manual club post'}</span><h2>{item.title}</h2><p>{item.excerpt}</p><div className="news-admin-badges"><span className="dash-chip">{item.status}</span><span className="dash-chip">{item.news.approval}</span>{item.news.featured && <span className="dash-chip">Featured</span>}{item.news.archived && <span className="dash-chip">Archived</span>}{item.news.expired && <span className="dash-chip">Registration closed</span>}</div>{safeNewsUrl(item.news.sourceUrl) && <a href={safeNewsUrl(item.news.sourceUrl)} target="_blank" rel="noopener noreferrer">Original source ↗</a>}</div>
        <div className="cms-row-actions"><button disabled={busy} onClick={event=>{trigger.current=event.currentTarget;setEditor({id:item.id,sourceId:item.news.sourceId,form:{...blank,...item.news,title:item.title,summary:item.excerpt,body:item.body,status:item.status}});}}>Review / edit</button><button className="danger" disabled={busy} onClick={event=>{trigger.current=event.currentTarget;setDeleting(item);}}>Delete</button></div>
      </article>)}</div>
      <div className="portal-directory-more"><span>{data.entries.total} entries</span><button className="portal-secondary-button" disabled={loading || offset===0} onClick={()=>setOffset(value=>Math.max(0,value-20))}>Previous</button><button className="portal-secondary-button" disabled={loading || offset+20>=data.entries.total} onClick={()=>setOffset(value=>value+20)}>Next</button></div>
    </>}
    {data && tab==='Sources' && <section className="dash-card dash-section"><div className="dash-section__head"><h2>Configured sources</h2><button className="dash-action" disabled={busy} onClick={()=>act('/api/admin/news/collect','POST',{},result=>`Collection ${result.status}. See collection history for per-source results.`)}>{busy?'Collecting…':'Collect now'}</button></div><p>Source URLs and legal approval are server-controlled. Sources without verified redistribution rights cannot be enabled. Collection respects the six-hour polling interval even when triggered manually.</p>
      {data.sources.map(source=><article key={source.id} className="news-admin-source"><div><h3>{source.name}</h3><p>{source.verified?`${source.license} · reviewed ${source.verifiedAt}`:source.reason}</p>{source.url && <p className="news-admin-url">{source.url}</p>}<a href={source.termsUrl} target="_blank" rel="noopener noreferrer">Terms / review reference ↗</a></div><button className="portal-secondary-button" disabled={busy || !source.verified} onClick={()=>act('/api/admin/news/sources/'+source.id,'PUT',{enabled:!source.enabled},'Source configuration saved.')}>{source.enabled?'Disable':source.verified?'Enable':'Unverified — disabled'}</button></article>)}
    </section>}
    {data && tab==='Publication policies' && <section className="dash-card dash-section"><h2>Publication policies</h2><p>Automatic publication requires an enabled, reviewed source and validated metadata. Opportunities always require administrator review. Manual posts retain their publication controls.</p>{data.policies.map(policy=><div className="news-admin-source" key={policy.category}><strong>{policy.category}</strong><label><input type="checkbox" checked={policy.auto_publish} disabled={busy || !['AI News','Technology News'].includes(policy.category)} onChange={event=>act('/api/admin/news/policies','PUT',{category:policy.category,autoPublish:event.target.checked},'Publication policy saved.')}/> Automatic publication</label></div>)}</section>}
    {data && tab==='Collection history' && <section className="dash-card dash-section"><h2>Collection history</h2>{!data.runs.length && <p>No collection runs yet.</p>}{data.runs.map(run=><article className="news-admin-source" key={run.id}><div><h3>{run.status} · {run.trigger_type}</h3><p>{new Date(run.started_at).toLocaleString()} {run.finished_at?'· Finished':'· In progress'}</p>{run.results.map((result,index)=><p key={result.sourceId || index}>{result.sourceId || 'Collection'}: {result.status || 'failed'} {result.inserted!=null?`· ${result.inserted} inserted · ${result.duplicate} duplicates · ${result.rejected} invalid`:''} {result.error || result.reason || ''}</p>)}</div></article>)}</section>}
    {editor && <NewsEditor entry={editor} returnFocusRef={trigger} onClose={()=>setEditor(null)} onSaved={async()=>{setEditor(null);setMessage('News saved. Publication and moderation rules applied.');await load();}}/>}
    {deleting && <DashboardSheet title="Delete news entry?" eyebrow="CONFIRM DELETION" returnFocusRef={trigger} onClose={()=>setDeleting(null)} busy={busy}><div className="news-admin-confirm"><p>Delete “{deleting.title}”? This cannot be undone. A future source run may collect a deleted article again; reject it instead to keep a moderation record.</p><div className="portal-form-actions"><button className="portal-secondary-button" disabled={busy} onClick={()=>setDeleting(null)}>Cancel</button><button className="dash-action" disabled={busy} onClick={async()=>{await act('/api/admin/news/'+deleting.id,'DELETE',undefined,'News entry deleted.');setDeleting(null);}}>Confirm deletion</button></div></div></DashboardSheet>}
  </DashboardShell>;
}

function NewsEditor({entry,onClose,onSaved,returnFocusRef}) {
  const [form,setForm]=useState(entry.form);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const change=(key,value)=>setForm(current=>({...current,[key]:value}));
  const opportunity=(key,value)=>setForm(current=>({...current,opportunity:{...current.opportunity,[key]:value}}));
  async function save(event) {
    event.preventDefault();setBusy(true);setError('');
    try { await api('/api/admin/news'+(entry.id?'/'+entry.id:''),{method:entry.id?'PUT':'POST',body:JSON.stringify(form)});await onSaved(); }
    catch(cause) { setError(cause.message+(cause.issues?.length?' '+cause.issues.map(issue=>issue.message).join(' '):''));setBusy(false); }
  }
  return <DashboardSheet title={entry.id?'Review news':'Create manual news'} eyebrow="NEWS EDITOR" busy={busy} returnFocusRef={returnFocusRef} onClose={onClose}><form className="news-admin-form" onSubmit={save}>
    <Field label="Title" value={form.title} onChange={value=>change('title',value)} required maxLength={220}/>
    <Field label="Short summary (maximum 600 characters)" value={form.summary} onChange={value=>change('summary',value)} multiline maxLength={600}/>
    {!entry.sourceId && <Field label="Manual club story" value={form.body} onChange={value=>change('body',value)} multiline maxLength={10000}/>}
    <Field label="Category" value={form.category} onChange={value=>change('category',value)} options={categories}/>
    <div className="portal-form-grid"><Field label="Approval" value={form.approval} onChange={value=>change('approval',value)} options={['pending','approved','rejected']}/><Field label="Visibility" value={form.status} onChange={value=>change('status',value)} options={['draft','published','hidden']}/></div>
    <Field label={entry.sourceId?'Original source (immutable attribution)':'Original source URL (optional HTTPS)'} value={form.sourceUrl || ''} onChange={value=>change('sourceUrl',value || null)} type="url" readOnly={Boolean(entry.sourceId)}/>
    <div className="news-admin-checks">{[['featured','Featured'],['archived','Archived'],['autoArchive','Automatically archive after event end / expiry']].map(([key,label])=><label key={key}><input type="checkbox" checked={form[key]} onChange={event=>change(key,event.target.checked)}/>{label}</label>)}</div>
    <DateField label="Expiry (optional)" value={form.expiresAt} onChange={value=>change('expiresAt',value)}/>
    {['Hackathons','Events and Opportunities'].includes(form.category) && <fieldset><legend>Opportunity details — leave unknown values blank</legend>
      {[['name','Event name'],['organizer','Organizer'],['location','Location'],['eligibility','Eligibility'],['teamSize','Team size'],['prizeDetails','Prize details']].map(([key,label])=><Field key={key} label={label} value={form.opportunity[key] || ''} onChange={value=>opportunity(key,value || null)} maxLength={300}/>)}
      <Field label="Format" value={form.opportunity.format || ''} onChange={value=>opportunity('format',value || null)} options={['','online','offline','hybrid']}/>
      {[['registrationOpen','Registration opens'],['registrationDeadline','Registration deadline'],['startDate','Event starts'],['endDate','Event ends'],['lastVerified','Last organizer verification']].map(([key,label])=><DateField key={key} label={label} value={form.opportunity[key]} onChange={value=>opportunity(key,value)}/>)}
      <Field label="Official registration URL (optional HTTPS)" type="url" value={form.opportunity.registrationUrl || ''} onChange={value=>opportunity('registrationUrl',value || null)}/>
      <Field label="Verification status" value={form.opportunity.verificationStatus || 'unknown'} onChange={value=>opportunity('verificationStatus',value)} options={['unknown','unverified','verified']}/>
      <p>Mark verified only after checking the official organizer. Verified entries require a registration URL and timestamp. Dates use your local timezone; stored timestamps use UTC. Turn off auto-archive for an exceptional date override.</p>
    </fieldset>}
    {error && <div role="alert" className="portal-banner is-error">{error}</div>}
    <div className="portal-form-actions"><button className="portal-secondary-button" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="dash-action" disabled={busy}>{busy?'Saving…':'Save news'}</button></div>
  </form></DashboardSheet>;
}
function Field({label,value,onChange,options,multiline,...props}) {
  const id=useId();
  const common={...props,id,value,onChange:event=>onChange(event.target.value)};
  return <div className="portal-field"><label htmlFor={id}>{label}</label>{options?<select {...common}>{options.map(value=><option key={value} value={value}>{value || 'Unknown'}</option>)}</select>:multiline?<textarea {...common} rows={4}/>:<input {...common}/>}</div>;
}
function DateField({label,value,onChange}) {
  const local=value?new Date(Date.parse(value)-new Date(value).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
  return <Field label={label+' (local time)'} type="datetime-local" value={local} onChange={value=>onChange(value?new Date(value).toISOString():null)}/>;
}
