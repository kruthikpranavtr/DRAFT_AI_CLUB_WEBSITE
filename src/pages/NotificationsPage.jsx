import { useCallback,useEffect,useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';
import { Bell,CheckCheck,Inbox,MessageCircle,Megaphone,Newspaper,Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin } from '../../shared/permissions';
import { api } from '../lib/api';
import { notificationDestination,notifyInboxChanged } from '../lib/useNotifications';
import DashboardShell from '../components/DashboardShell';
import './Notifications.css';

const labels = {
  community_post:'Community',community_reply:'Reply',
  site_update:'Website update',news_update:'News',assessment_update:'Assessment',direct_message:'Message',
};
const icons = {
  community_post:MessageCircle,community_reply:MessageCircle,
  site_update:Megaphone,news_update:Newspaper,assessment_update:Bell,direct_message:Bell,
};

export default function NotificationsPage() {
  const {session}=useAuth();
  const navigate=useNavigate();
  const [unreadOnly,setUnreadOnly]=useState(false);
  const [items,setItems]=useState([]);
  const [counts,setCounts]=useState({total:0,unread:0});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [working,setWorking]=useState(false);
  const [title,setTitle]=useState('');
  const [message,setMessage]=useState('');
  const [notice,setNotice]=useState('');

  const refresh=useCallback(async({showLoading=false}={})=>{
    if(showLoading)setLoading(true);
    try {
      const result=await api('/api/notifications?limit=50&unread='+unreadOnly);
      setItems(result.items);
      setCounts({total:result.total,unread:result.unread});
      setError('');
    }catch(cause){setError(cause.message);}
    finally{setLoading(false);}
  },[unreadOnly]);

  useEffect(()=>{
    const timer=window.setTimeout(()=>refresh({showLoading:true}),0);
    const interval=window.setInterval(()=>{if(!document.hidden)refresh();},30000);
    return()=>{clearTimeout(timer);clearInterval(interval);};
  },[refresh]);

  async function markRead(id) {
    try {
      await api('/api/notifications/'+encodeURIComponent(id)+'/read',{method:'POST'});
      notifyInboxChanged();
      setItems(previous=>previous.map(item=>item.id===id?{...item,read:true}:item));
      setCounts(previous=>({...previous,unread:Math.max(0,previous.unread-1)}));
    }catch(cause){setError(cause.message);}
  }

  async function openItem(item) {
    if(!item.read)await markRead(item.id);
    navigate(notificationDestination(item,session.role));
  }

  async function markAllRead() {
    setWorking(true);
    try {
      await api('/api/notifications/read-all',{method:'POST'});
      notifyInboxChanged();
      await refresh();
      setNotice('All notifications marked as read.');
    }catch(cause){setError(cause.message);}
    finally{setWorking(false);}
  }

  async function broadcast(event) {
    event.preventDefault();
    if(working)return;
    setWorking(true);setError('');setNotice('');
    try {
      await api('/api/notifications/broadcast',{
        method:'POST',body:JSON.stringify({title:title.trim(),body:message.trim()}),
      });
      setTitle('');setMessage('');
      setNotice('Your message was sent to the club notification inbox.');
    }catch(cause){setError(cause.message);}
    finally{setWorking(false);}
  }

  return <DashboardShell section="Notifications">
    <div className="club-inbox">
      <header className="dash-page-head">
        <div><span className="portal-eyebrow">AI CLUB UPDATES</span>
          <h1>Notifications</h1>
          <p>Community conversations, replies, club announcements and published website updates appear here.</p>
        </div>
        <div className="club-inbox__count" aria-live="polite"><Bell size={18}/><strong>{counts.unread}</strong><span>unread</span></div>
      </header>
      {error && <div className="portal-banner is-error" role="alert">{error} <button type="button" onClick={()=>refresh({showLoading:true})}>Retry</button></div>}
      {notice && <div className="portal-banner is-success" role="status">{notice}</div>}
      <section className="dash-card club-inbox__list" aria-label="Your notifications">
        <div className="club-inbox__toolbar">
          <div className="club-inbox__filters" role="group" aria-label="Notification filter">
            <button type="button" className={!unreadOnly?'active':''} aria-pressed={!unreadOnly} onClick={()=>setUnreadOnly(false)}>All updates</button>
            <button type="button" className={unreadOnly?'active':''} aria-pressed={unreadOnly} onClick={()=>setUnreadOnly(true)}>Unread ({counts.unread})</button>
          </div>
          <button type="button" className="portal-secondary-button" onClick={markAllRead} disabled={working || !counts.unread}><CheckCheck size={17}/> Mark all read</button>
        </div>
        {loading ? <p className="club-inbox__empty" role="status">Loading notifications...</p>
          : !items.length ? <div className="club-inbox__empty"><Inbox size={30}/><h2>You're all caught up</h2><p>{unreadOnly?'You have no unread notifications.':'New messages and club updates will appear here.'}</p></div>
          : <ol className="club-inbox__entries">{items.map(item=>{
            const Icon=icons[item.type]||Bell;
            return <li key={item.id} className={'club-inbox__entry'+(item.read?'':' is-unread')}>
              <div className="club-inbox__entry-icon"><Icon size={20} aria-hidden="true"/></div>
              <div className="club-inbox__entry-text"><div className="club-inbox__entry-meta"><span>{labels[item.type]||'Update'}</span><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></div>
                <h2>{item.title}</h2><p>{item.body}</p>
                <div className="club-inbox__entry-actions">
                  <button type="button" className="club-inbox__open" onClick={()=>openItem(item)}>View update</button>
                  {!item.read&&<button type="button" onClick={()=>markRead(item.id)}>Mark as read</button>}
                </div>
              </div>
              {!item.read&&<span className="club-inbox__dot" aria-label="Unread"/>}
            </li>;
          })}</ol>}
        {counts.total>50&&!unreadOnly&&<p className="club-inbox__more">Showing 50 most recent updates.</p>}
      </section>
      {isSuperAdmin(session)&&<section className="dash-card club-inbox__broadcast">
        <div><span className="portal-eyebrow">ADMINISTRATOR</span><h2>Send a message to all members</h2>
          <p>Important club messages appear in everyone's notification inbox. This does not send email or device push notifications.</p>
        </div>
        <form onSubmit={broadcast}>
          <label className="portal-field">Message title<input required value={title} minLength={3} maxLength={180} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Workshop schedule updated"/></label>
          <label className="portal-field">Message<textarea required value={message} minLength={1} maxLength={800} rows={4} onChange={e=>setMessage(e.target.value)} placeholder="Share the update with AI Club members..."/></label>
          <button type="submit" className="dash-action" disabled={working}><Send size={16}/> Send notification</button>
        </form>
      </section>}
      <p className="club-inbox__footnote"><Link to="/">Back to public website</Link> · Notifications refresh automatically while this website is open.</p>
    </div>
  </DashboardShell>;
}
