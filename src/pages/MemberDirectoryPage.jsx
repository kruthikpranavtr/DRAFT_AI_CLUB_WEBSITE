import { ArrowRight,Search,UsersRound } from 'lucide-react';
import { useCallback,useEffect,useRef,useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import { api } from '../lib/api';
import { mergeMembers } from '../lib/member-directory';
import { PageHead,StateMessage } from './StudentDashboardPage';

export default function MemberDirectoryPage() {
  const [search,setSearch] = useState('');
  const [items,setItems] = useState([]);
  const [total,setTotal] = useState(0);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [activeSearch,setActiveSearch] = useState('');
  const [nextOffset,setNextOffset] = useState(0);
  const [hasMore,setHasMore] = useState(false);
  const request = useRef(null);

  const load = useCallback(async (query,offset = 0) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setError('');
    if (offset === 0) { setItems([]); setTotal(0); setHasMore(false); setActiveSearch(query); }
    try {
      const data = await api(`/api/members?search=${encodeURIComponent(query)}&limit=24&offset=${offset}`,{ signal:controller.signal });
      if (controller.signal.aborted) return;
      setItems(current => mergeMembers(offset === 0 ? [] : current,data.items));
      setTotal(data.total);
      setNextOffset(data.offset + data.items.length);
      setHasMore(data.offset + data.items.length < data.total && data.items.length > 0);
    } catch (cause) { if (!controller.signal.aborted) setError(cause.message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  },[]);
  useEffect(() => { load(''); return () => request.current?.abort(); },[load]);

  function submit(event) { event.preventDefault(); load(search); }

  return <DashboardShell section="Member directory">
    <PageHead eyebrow="PRIVATE DIRECTORY" title="Meet the members." text={`${total} active student ${total === 1 ? 'profile' : 'profiles'} visible to signed-in members.`}/>
    <form className="portal-search" onSubmit={submit}><Search size={18}/><input aria-label="Search members" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, department, or skill"/><button className="dash-action">Search</button></form>
    {loading && <StateMessage>{items.length ? 'Loading more members…' : 'Loading member profiles…'}</StateMessage>}
    {error && <StateMessage tone="error">{error}</StateMessage>}
    {!loading && !error && !items.length && <StateMessage>No member profiles match this search.</StateMessage>}
    {items.length > 0 && <div className="portal-member-grid">{items.map(member => <MemberCard member={member} key={member.id}/>)}</div>}
    {hasMore && <div className="portal-directory-more"><p role="status">Showing {items.length} of {total} members</p><button className="dash-action" disabled={loading} onClick={() => load(activeSearch,nextOffset)}>{loading ? 'Loading…' : error ? 'Retry loading more' : 'Load more members'}</button></div>}
    {!hasMore && error && !items.length && <button className="dash-action" onClick={() => load(activeSearch)}>Retry search</button>}
  </DashboardShell>;
}

function MemberCard({ member }) {
  return <article className="dash-card portal-member-card">{member.avatarUrl ? <img src={member.avatarUrl} alt=""/> : <span className="portal-member-avatar"><UsersRound size={22}/></span>}<div><small>{member.memberId}</small><h2>{member.name}</h2><p>{[member.department,member.academicYear ? `Year ${member.academicYear}` : ''].filter(Boolean).join(' · ') || 'Profile details not added yet.'}</p><div className="portal-skills">{member.skills.slice(0,4).map(skill => <span key={skill}>{skill}</span>)}</div><Link to={`/student/members/${member.id}`}>View profile <ArrowRight size={14}/></Link></div></article>;
}
