import { useEffect,useState } from 'react';
import { Link,useNavigate,useParams,useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { PostCard,PostEditor } from '../components/CommunityComponents';
import { communityPath } from '../lib/community';
import { CommentComposer,CommentThread } from '../components/CommunityComments';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { hasPermission,PERMISSIONS } from '../../shared/permissions';
import './Community.css';

export default function CommunityPostPage(){
 const {postId}=useParams(),[params]=useSearchParams(),{session}=useAuth(),navigate=useNavigate();
 const [post,setPost]=useState(null),[error,setError]=useState(''),[version,setVersion]=useState(0),[editor,setEditor]=useState(null);
 const canModerate=hasPermission(session,PERMISSIONS.MODERATE_COMMUNITY),review=canModerate&&params.get('review')==='1';
 useEffect(()=>{
  const controller=new AbortController();
  api((review?'/api/admin/community':'/api/community')+'/posts/'+postId,{signal:controller.signal}).then(data=>{setPost(data.post);setError('');}).catch(cause=>{if(!controller.signal.aborted){setError(cause.message);setPost(null);}});
  return()=>controller.abort();
 },[postId,review,version]);
 function refresh(values){if(values)setPost(previous=>({...previous,...values}));else setVersion(previous=>previous+1);}
 return <DashboardShell section="Community"><div className="community-page community-detail"><Link className="community-back" to={communityPath(session)}><ArrowLeft size={16}/>All conversations</Link>
  {error&&<div role="alert" className="community-state"><h1>Conversation unavailable</h1><p>{error}</p><button className="community-button secondary" onClick={()=>refresh()}>Try again</button></div>}
  {!post&&!error&&<div className="community-state" role="status">Loading conversation…</div>}
  {post&&<><PostCard detail post={post} canModerate={canModerate} review={review} onChange={refresh} onDelete={()=>navigate(communityPath(session))} onEdit={setEditor}/>
   {post.status==='visible'&&<section className="community-discussion"><header><span className="portal-eyebrow">ADD YOUR PERSPECTIVE</span><h2>Discussion <span>{post.commentCount}</span></h2></header>
    {!post.isLocked&&<CommentComposer postId={post.id} onSaved={()=>refresh()}/>}
    <CommentThread key={post.id} postId={post.id} version={version} locked={post.isLocked} canModerate={canModerate} onChange={()=>refresh()}/>
   </section>}
  </>}
  {editor&&<PostEditor post={editor} onClose={()=>setEditor(null)} onSaved={()=>refresh()}/>}
 </div></DashboardShell>;
}
