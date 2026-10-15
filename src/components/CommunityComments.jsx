import { useEffect,useState } from 'react';
import { MessageSquare,Flag,Pencil,Trash2,ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { Byline,VoteControl,ActionDialog } from './CommunityComponents';

export function CommentComposer({postId,parentId=null,onSaved,onCancel,label='Add a comment'}){
 const [body,setBody]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(event){
  event.preventDefault();setBusy(true);setError('');
  try{await api('/api/community/posts/'+postId+'/comments',{method:'POST',body:JSON.stringify({body,parentId})});setBody('');onSaved();}
  catch(cause){setError(cause.message);}finally{setBusy(false);}
 }
 return <form className="community-comment-composer" onSubmit={submit}><label>{label}<textarea aria-label={label} required maxLength={5000} rows={3} value={body} onChange={e=>setBody(e.target.value)} placeholder="Keep it thoughtful. Add something to the conversation."/></label>{error&&<p role="alert" className="community-error">{error}</p>}<div className="community-form-actions">{onCancel&&<button type="button" className="community-button secondary" disabled={busy} onClick={onCancel}>Cancel</button>}<button className="community-button" disabled={busy||!body.trim()}>{busy?'Posting…':parentId?'Post reply':'Post comment'}</button></div></form>;
}
export function CommentThread({postId,parentId=null,version,locked,canModerate,onChange}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const query='/api/community/posts/'+postId+'/comments'+(parentId?'?parentId='+parentId:'');
 useEffect(()=>{
  const controller=new AbortController();
  api(query,{signal:controller.signal}).then(result=>{setData(result);setError('');}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);});
  return()=>controller.abort();
 },[query,version]);
 async function more(){
  setBusy(true);try{const result=await api(query+(parentId?'&':'?')+'cursor='+encodeURIComponent(data.nextCursor));setData(previous=>({...result,items:[...new Map([...previous.items,...result.items].map(item=>[item.id,item])).values()]}));}catch(cause){setError(cause.message);}finally{setBusy(false);}
 }
 return <div className={parentId?'community-comment-thread is-nested':'community-comment-thread'}>{error&&<p role="alert" className="community-error">{error}</p>}{!data&&!error&&<p role="status">Loading replies…</p>}
  {data?.items.map(item=><Comment key={item.id} item={item} locked={locked} version={version} canModerate={canModerate} onChange={onChange}/>)}
  {data?.items.length===0&&!parentId&&<p className="community-no-comments">No comments yet. Add the first perspective.</p>}
  {data?.nextCursor&&<button className="community-load-more" disabled={busy} onClick={more}>{busy?'Loading…':'Load more '+(parentId?'replies':'comments')}</button>}
 </div>;
}
function Comment({item,locked,version,canModerate,onChange}){
 const [reply,setReply]=useState(false),[expanded,setExpanded]=useState(false),[editing,setEditing]=useState(false);
 const [body,setBody]=useState(item.body),[vote,setVote]=useState(null),[action,setAction]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const visible=item.status==='visible';
 async function save(event){event.preventDefault();setBusy(true);setError('');try{await api('/api/community/comments/'+item.id,{method:'PATCH',body:JSON.stringify({body})});setEditing(false);onChange();}catch(cause){setError(cause.message);}finally{setBusy(false);}}
 function moderate(name){setAction({title:name[0].toUpperCase()+name.slice(1)+' comment',reasonRequired:true,text:'This action is recorded in the moderation audit history.',onConfirm:async reason=>{await api('/api/admin/community/comments/'+item.id+'/moderate',{method:'POST',body:JSON.stringify({action:name,reason})});onChange();}});}
 return <article className="community-comment"><Byline author={item.author} createdAt={item.createdAt} editedAt={item.editedAt}/>
  {editing?<form className="community-comment-composer" onSubmit={save}><label>Edit comment<textarea required maxLength={5000} rows={3} value={body} onChange={e=>setBody(e.target.value)}/></label><div className="community-form-actions"><button type="button" className="community-button secondary" onClick={()=>setEditing(false)}>Cancel</button><button className="community-button" disabled={busy}>{busy?'Saving…':'Save comment'}</button></div></form>:<p className={visible?'community-body':'community-tombstone'}>{visible?item.body:'This comment is no longer available.'}</p>}
  {error&&<p role="alert" className="community-error">{error}</p>}
  <div className="community-comment-actions">{visible&&<><VoteControl type="comment" item={{...item,...(vote?.version===version?vote:null)}} disabled={locked} onChange={values=>setVote({...values,version})}/>
   {item.depth<2&&!locked&&<button className="community-text-action" onClick={()=>setReply(!reply)}><MessageSquare size={13}/>Reply</button>}
   {item.canEdit&&!locked&&<><button className="community-text-action" onClick={()=>{setBody(item.body);setEditing(true);}}><Pencil size={13}/>Edit</button><button className="community-text-action" onClick={()=>setAction({title:'Delete comment?',text:'Your text will be removed. Existing replies may remain beneath an empty placeholder.',confirmLabel:'Delete comment',onConfirm:async()=>{await api('/api/community/comments/'+item.id,{method:'DELETE'});onChange();}})}><Trash2 size={13}/>Delete</button></>}
   <button className="community-text-action" onClick={()=>setAction({title:'Report comment',text:'Explain which Community guideline this comment may violate.',reasonRequired:true,confirmLabel:'Submit report',onConfirm:async reason=>{await api('/api/community/reports',{method:'POST',body:JSON.stringify({targetType:'comment',targetId:item.id,reason})});setNotice('Report sent to the moderation team.');}})}><Flag size={13}/>Report</button>
  </>}{canModerate&&item.status!=='deleted'&&<><span className="community-moderator-caption"><ShieldCheck size={13}/></span>{visible?<><button className="community-text-action" onClick={()=>moderate('hide')}>Hide</button><button className="community-text-action" onClick={()=>moderate('remove')}>Remove</button></>:<button className="community-text-action" onClick={()=>moderate('restore')}>Restore</button>}</>}</div>
  {reply&&<CommentComposer postId={item.postId} parentId={item.id} label="Write a reply" onCancel={()=>setReply(false)} onSaved={()=>{setReply(false);setExpanded(true);onChange();}}/>}
  {(item.replyCount>0||expanded)&&<button className="community-expand-replies" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'Hide replies':`View ${item.replyCount} ${item.replyCount===1?'reply':'replies'}`}</button>}
  {expanded&&<CommentThread postId={item.postId} parentId={item.id} locked={locked} version={version} canModerate={canModerate} onChange={onChange}/>}
  {notice&&<p role="status" className="community-success">{notice}</p>}
  {action&&<ActionDialog {...action} onClose={()=>setAction(null)}/>}
 </article>;
}
