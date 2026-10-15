import { useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck,ArrowUpRight } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { api } from '../lib/api';
import { ActionDialog,Byline,PostCard } from '../components/CommunityComponents';
import './Community.css';

export default function AdminModerationPage(){
 const [view,setView]=useState('reports'),[status,setStatus]=useState('open'),[version,setVersion]=useState(0);
 const [result,setResult]=useState(null),[error,setError]=useState(null),[action,setAction]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const key=view+':'+status+':'+version,data=result?.key===key?result:null;
 const url='/api/admin/community/'+view+'?status='+status;
 useEffect(()=>{
  const controller=new AbortController();
  api(url,{signal:controller.signal}).then(value=>setResult({...value,key})).catch(cause=>{if(!controller.signal.aborted)setError({key,message:cause.message});});
  return()=>controller.abort();
 },[url,key]);
 function refresh(){setVersion(previous=>previous+1);}
 function switchView(value){setView(value);setStatus(value==='reports'?'open':'hidden');}
 async function more(){setBusy(true);try{const next=await api(url+'&cursor='+encodeURIComponent(data.nextCursor));setResult(previous=>previous?.key===key?{...previous,items:[...previous.items,...next.items],nextCursor:next.nextCursor}:previous);}catch(cause){setError({key,message:cause.message});}finally{setBusy(false);}}
 function moderate(type,id,name){
  setAction({title:name[0].toUpperCase()+name.slice(1)+' '+type,reasonRequired:true,text:'Describe the moderation decision. The action and reason are recorded in the audit history.',onConfirm:async reason=>{
   await api('/api/admin/community/'+(type==='post'?'posts':'comments')+'/'+id+'/moderate',{method:'POST',body:JSON.stringify({action:name,reason})});setNotice('Moderation action saved.');refresh();
  }});
 }
 function resolve(report,state){
  setAction({title:state==='resolved'?'Resolve report':'Dismiss report',text:'Record the outcome. Content visibility is controlled separately.',reasonRequired:true,onConfirm:async reason=>{
   await api('/api/admin/community/reports/'+report.id+'/resolve',{method:'POST',body:JSON.stringify({status:state,reason})});setNotice('Report '+state+'.');refresh();
  }});
 }
 return <DashboardShell section="Moderation"><div className="community-page"><header className="community-heading"><div><span className="portal-eyebrow">COMMUNITY CARE</span><h1>Moderation<span>.</span></h1><p>Review concerns. Make considered, accountable decisions.</p></div><Link className="community-button secondary" to="/admin/community">Open Community<ArrowUpRight size={16}/></Link></header>
  <div className="community-mod-notice"><ShieldCheck size={18}/><p>Private moderator workspace. Every content action requires a reason. Account suspension requires separate student-management permission.</p></div>
  {notice&&<p role="status" className="community-success">{notice}</p>}
  <div className="community-mod-toolbar"><div className="community-sorts" role="group" aria-label="Moderation view">{[['reports','Reports'],['posts','Moderated posts'],['comments','Moderated comments']].map(([value,label])=><button key={value} aria-pressed={view===value} onClick={()=>switchView(value)}>{label}</button>)}</div><label>Status<select aria-label="Moderation status" value={status} onChange={e=>setStatus(e.target.value)}>{(view==='reports'?['open','resolved','dismissed','all']:['hidden','removed']).map(value=><option key={value}>{value}</option>)}</select></label></div>
  {error?.key===key&&<div className="community-state" role="alert"><p>{error.message}</p><button className="community-button secondary" onClick={refresh}>Try again</button></div>}
  {!data&&error?.key!==key&&<div role="status" className="community-state">Loading moderation queue…</div>}
  {data&&<>{data.items.length===0&&<div className="community-state community-empty"><ShieldCheck size={32}/><h2>Nothing to review here.</h2><p>No {status==='all'?'':status+' '}{view==='reports'?'reports':view} match this view.</p></div>}
   {view==='reports'&&data.items.map(report=><article className="community-report" key={report.id}><header><span className="community-tag">{report.targetType} report</span><span className="community-status">{report.status}</span><time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString()}</time></header><h2>{report.target?.title||'Comment review'}</h2><p className="community-report-label">Reported by {report.reporterName}</p><p className="community-report-reason">{report.reason}</p><details><summary>Inspect reported text</summary><p className="community-body">{report.target?.body||'Text no longer available.'}</p></details>{report.resolution&&<p><strong>Resolution:</strong> {report.resolution}</p>}
    <div className="community-report-actions"><Link to={'/admin/community/posts/'+report.postId+'?review=1'}>Review discussion and images<ArrowUpRight size={13}/></Link>
     {report.target&&report.target.status!=='deleted'&&(report.target.status==='visible'?<><button onClick={()=>moderate(report.targetType,report.targetId,'hide')}>Hide content</button><button onClick={()=>moderate(report.targetType,report.targetId,'remove')}>Remove content</button></>:<button onClick={()=>moderate(report.targetType,report.targetId,'restore')}>Restore content</button>)}
     {report.status==='open'&&<><button onClick={()=>resolve(report,'resolved')}>Resolve</button><button onClick={()=>resolve(report,'dismissed')}>Dismiss</button></>}
    </div></article>)}
   {view==='posts'&&data.items.map(post=><PostCard key={post.id} post={post} review canModerate onChange={refresh}/>)}
   {view==='comments'&&data.items.map(comment=><article className="community-report" key={comment.id}><Byline author={comment.author} createdAt={comment.createdAt} editedAt={comment.editedAt}/><p className="community-body">{comment.body}</p><div className="community-report-actions"><Link to={'/admin/community/posts/'+comment.postId+'?review=1'}>Review discussion</Link><button onClick={()=>moderate('comment',comment.id,'restore')}>Restore comment</button>{comment.status==='hidden'&&<button onClick={()=>moderate('comment',comment.id,'remove')}>Remove comment</button>}</div></article>)}
   {data.nextCursor&&<button className="community-load-more" disabled={busy} onClick={more}>{busy?'Loading…':'Load more'}</button>}
  </>}
  {action&&<ActionDialog {...action} onClose={()=>setAction(null)}/>}
 </div></DashboardShell>;
}
