import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp,ArrowDown,MessageSquare,Pin,Lock,ImagePlus,Trash2,ChevronUp,ChevronDown,ExternalLink,Flag,ShieldCheck,Pencil } from 'lucide-react';
import DashboardSheet from './DashboardSheet';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { communityPath,COMMUNITY_TAGS } from '../lib/community';

export function Byline({author,createdAt,editedAt}){
 const {session}=useAuth();
 const identity=<><span className="community-avatar">{author.avatarUrl?<img src={author.avatarUrl} alt=""/>:author.name.split(/\s+/).map(w=>w[0]).join('').slice(0,2)}</span><strong>{author.name}</strong></>;
 return <div className="community-byline">{author.id?<Link to={`/${session.role==='admin'?'admin':'student'}/members/${author.id}`}>{identity}</Link>:<span className="community-former">{identity}</span>}<span aria-hidden="true">·</span><time dateTime={createdAt} title={new Date(createdAt).toLocaleString()}>{new Date(createdAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</time>{editedAt&&<span className="community-edited">edited</span>}</div>;
}
export function VoteControl({type='post',item,disabled,onChange}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function vote(value){
  setBusy(true);setError('');
  try{const result=await api(`/api/community/${type==='post'?'posts':'comments'}/${item.id}/vote`,{method:'PUT',body:JSON.stringify({value:item.myVote===value?0:value})});onChange(result);}
  catch(cause){setError(cause.message);}finally{setBusy(false);}
 }
 return <div className="community-vote-wrap"><div className="community-votes" aria-label={type==='post'?'Post voting':'Comment voting'}>
  <button aria-label={'Upvote '+type} aria-pressed={item.myVote===1} disabled={disabled||busy} onClick={()=>vote(1)} className={item.myVote===1?'is-up':''}><ArrowUp size={17}/></button>
  <span aria-live="polite" aria-label={'Score '+item.score}>{item.score}</span>
  <button aria-label={'Downvote '+type} aria-pressed={item.myVote===-1} disabled={disabled||busy} onClick={()=>vote(-1)} className={item.myVote===-1?'is-down':''}><ArrowDown size={17}/></button>
 </div>{error&&<span className="community-inline-error" role="alert">{error}</span>}</div>;
}
export function ImageGallery({images}){
 const [selected,setSelected]=useState(null);
 if(!images?.length)return null;
 return <><div className={`community-images community-images--${images.length}`}>{images.map((image,index)=><button key={image.id} aria-label={'Open image '+(index+1)+': '+(image.description||'Post attachment')} onClick={()=>setSelected(image)}>
  <img src={image.thumbnailUrl} width={image.width} height={image.height} loading="lazy" alt={image.description||'Post attachment'}/>
 </button>)}</div>{selected&&<DashboardSheet title="Post image" eyebrow="PRIVATE COMMUNITY" onClose={()=>setSelected(null)}><img className="community-full-image" src={selected.url} alt={selected.description||'Post attachment'}/>{selected.description&&<p>{selected.description}</p>}</DashboardSheet>}</>;
}
export function ActionDialog({title,text,reasonRequired=false,confirmLabel='Confirm',onConfirm,onClose}){
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(event){event.preventDefault();setBusy(true);setError('');try{await onConfirm(reason);onClose();}catch(cause){setError(cause.message);}finally{setBusy(false);}}
 return <DashboardSheet title={title} eyebrow="COMMUNITY" busy={busy} onClose={onClose}><form className="community-form" onSubmit={submit}><p>{text}</p>
 {reasonRequired&&<label>Reason<textarea required minLength={3} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} rows={4}/><small>Recorded for review. Do not include private contact details.</small></label>}
 {error&&<p role="alert" className="community-error">{error}</p>}<div className="community-form-actions"><button type="button" className="community-button secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="community-button" disabled={busy||reasonRequired&&reason.trim().length<3}>{busy?'Saving…':confirmLabel}</button></div></form></DashboardSheet>;
}
export function PostCard({post,detail=false,canModerate=false,onChange,onDelete,onEdit,review=false}){
 const {session}=useAuth(),[action,setAction]=useState(null),[notice,setNotice]=useState('');
 const path=communityPath(session);
 const moderation=(name)=>setAction({title:name==='pin'?'Pin announcement':name==='unpin'?'Unpin announcement':name[0].toUpperCase()+name.slice(1)+' discussion',reasonRequired:true,confirmLabel:'Save action',text:'This action is recorded in the moderation audit history.',onConfirm:async reason=>{
  const endpoint=name==='pin'||name==='unpin'?`/api/admin/community/posts/${post.id}/pin`:`/api/admin/community/posts/${post.id}/moderate`;
  await api(endpoint,{method:name==='pin'?'PUT':name==='unpin'?'DELETE':'POST',body:JSON.stringify(name==='pin'||name==='unpin'?{reason}:{reason,action:name})});onChange();
 }});
 return <article className={`community-post ${post.isPinned?'community-post--pinned':''}`}>
  {post.isPinned&&<div className="community-pinned-label"><Pin size={13}/> PINNED ANNOUNCEMENT</div>}
  <div className="community-post-head"><Byline author={post.author} createdAt={post.createdAt} editedAt={post.editedAt}/><span className="community-tag">{post.tag}</span></div>
  {detail?<h1 className="community-post-title">{post.title}</h1>:<h2 className="community-post-title"><Link to={path+'/posts/'+post.id}>{post.title}</Link></h2>}
  <p className={detail?'community-body':'community-body community-body--preview'}>{post.body}</p>
  {post.linkUrl&&<a className="community-external" href={post.linkUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/>{new URL(post.linkUrl).hostname}</a>}
  <ImageGallery images={post.attachments}/>
  {post.isLocked&&<p className="community-lock-note"><Lock size={14}/> This discussion is locked. Reading is still available.</p>}
  {review&&post.status!=='visible'&&<p className="community-lock-note">Moderator review · {post.status} · unavailable to members</p>}
  <footer className="community-post-actions"><VoteControl item={post} disabled={post.isLocked||post.status!=='visible'} onChange={values=>onChange(values)}/>
   {!detail&&<Link className="community-text-action" to={path+'/posts/'+post.id}><MessageSquare size={16}/>{post.commentCount} {post.commentCount===1?'comment':'comments'}</Link>}
   {post.canEdit&&<><button className="community-text-action" onClick={()=>onEdit(post)}><Pencil size={14}/>Edit</button><button className="community-text-action" onClick={()=>setAction({title:'Delete post?',text:'Your post will disappear from the Community. Its images will no longer be available to members.',confirmLabel:'Delete post',onConfirm:async()=>{await api('/api/community/posts/'+post.id,{method:'DELETE'});onDelete?.();onChange();}})}><Trash2 size={14}/>Delete</button></>}
   {post.status==='visible'&&<button className="community-text-action" onClick={()=>setAction({title:'Report post',text:'Explain which Community guideline this post may violate.',reasonRequired:true,confirmLabel:'Submit report',onConfirm:async reason=>{await api('/api/community/reports',{method:'POST',body:JSON.stringify({targetType:'post',targetId:post.id,reason})});setNotice('Report sent to the moderation team.');}})}><Flag size={14}/>Report</button>}
  </footer>
  {canModerate&&<div className="community-moderator-actions"><ShieldCheck size={14}/><span>Moderation</span>{post.status==='visible'?<>
    <button onClick={()=>moderation(post.isPinned?'unpin':'pin')}>{post.isPinned?'Unpin':'Pin announcement'}</button><button onClick={()=>moderation(post.isLocked?'unlock':'lock')}>{post.isLocked?'Unlock':'Lock'}</button><button onClick={()=>moderation('hide')}>Hide</button><button onClick={()=>moderation('remove')}>Remove</button>
   </>:<button onClick={()=>moderation('restore')}>Restore</button>}</div>}
  {notice&&<p role="status" className="community-success">{notice}</p>}
  {action&&<ActionDialog {...action} onClose={()=>setAction(null)}/>}
 </article>;
}
export function PostEditor({post,onClose,onSaved}){
 const [form,setForm]=useState(()=>({title:post?.title||'',body:post?.body||'',tag:post?.tag||'AI',linkUrl:post?.linkUrl||'',attachments:post?.attachments||[]}));
 const [staged,setStaged]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 function field(key,value){setForm(previous=>({...previous,[key]:value}));}
 async function upload(event){
  const files=[...event.target.files];event.target.value='';
  if(files.length+form.attachments.length>4){setError('A post can have up to four images.');return;}
  setBusy(true);setError('');
  try{for(const file of files){
    if(file.size>5*1024*1024)throw new Error('Each image must be 5 MB or smaller.');
    const body=new FormData();body.set('image',file);
    const result=await api('/api/community/uploads',{method:'POST',body});
    setStaged(previous=>[...previous,result.image.id]);
    setForm(previous=>({...previous,attachments:[...previous.attachments,result.image]}));
  }}catch(cause){setError(cause.message);}finally{setBusy(false);}
 }
 async function removeImage(id){
  setBusy(true);setError('');
  try{
   if(staged.includes(id)){await api('/api/community/uploads/'+id,{method:'DELETE'});setStaged(previous=>previous.filter(value=>value!==id));}
   setForm(previous=>({...previous,attachments:previous.attachments.filter(image=>image.id!==id)}));
  }catch(cause){setError(cause.message);}finally{setBusy(false);}
 }
 function move(index,direction){setForm(previous=>{const attachments=[...previous.attachments];[attachments[index],attachments[index+direction]]=[attachments[index+direction],attachments[index]];return {...previous,attachments};});}
 async function close(){
  if(busy)return;setBusy(true);
  await Promise.allSettled(staged.map(id=>api('/api/community/uploads/'+id,{method:'DELETE'})));
  onClose();
 }
 async function submit(event){
  event.preventDefault();setBusy(true);setError('');
  try{
   const payload={...form,attachments:form.attachments.map(({id,description})=>({id,description}))};
   const result=await api('/api/community/posts'+(post?'/'+post.id:''),{method:post?'PATCH':'POST',body:JSON.stringify(payload)});
   onSaved(result.post);onClose();
  }catch(cause){setError(cause.message);}finally{setBusy(false);}
 }
 return <DashboardSheet title={post?'Edit your post':'Start a conversation'} eyebrow="MEMBERS ONLY" busy={busy} onClose={close}><form className="community-form" onSubmit={submit}>
  <label>Title<input required autoFocus maxLength={180} value={form.title} onChange={e=>field('title',e.target.value)} placeholder="What are you exploring?"/></label>
  <label>Topic<select value={form.tag} onChange={e=>field('tag',e.target.value)}>{COMMUNITY_TAGS.map(tag=><option key={tag}>{tag}</option>)}</select></label>
  <label>Post<textarea required maxLength={15000} rows={7} value={form.body} onChange={e=>field('body',e.target.value)} placeholder="Share an idea, ask for help, or show what you built."/></label>
  <label>Project or reference link <span className="community-optional">(optional)</span><input type="url" pattern="https://.*" maxLength={1500} value={form.linkUrl} onChange={e=>field('linkUrl',e.target.value)} placeholder="https://"/></label>
  <div className="community-upload"><label className="community-upload-label"><ImagePlus size={21}/><strong>Add images</strong><span>JPEG, PNG or WebP · up to 4 · 5 MB each</span><input aria-label="Upload post images" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy||form.attachments.length>=4} onChange={upload}/></label><small>Photos stay inside the member Community. Location metadata is removed.</small></div>
  {form.attachments.map((image,index)=><div className="community-attachment-edit" key={image.id}><img src={image.thumbnailUrl} alt={image.description||'Image preview'}/><label>Image {index+1} description<input maxLength={300} value={image.description} onChange={e=>field('attachments',form.attachments.map(item=>item.id===image.id?{...item,description:e.target.value}:item))}/></label><div><button type="button" className="community-icon-action" aria-label={'Move image '+(index+1)+' earlier'} disabled={busy||index===0} onClick={()=>move(index,-1)}><ChevronUp size={16}/></button><button type="button" className="community-icon-action" aria-label={'Move image '+(index+1)+' later'} disabled={busy||index===form.attachments.length-1} onClick={()=>move(index,1)}><ChevronDown size={16}/></button><button type="button" className="community-icon-action" aria-label={'Remove image '+(index+1)} disabled={busy} onClick={()=>removeImage(image.id)}><Trash2 size={16}/></button></div></div>)}
  {error&&<p role="alert" className="community-error">{error}</p>}
  <div className="community-form-actions"><button type="button" disabled={busy} className="community-button secondary" onClick={close}>Cancel</button><button className="community-button" disabled={busy}>{busy?'Working…':post?'Save changes':'Publish post'}</button></div>
 </form></DashboardSheet>;
}
