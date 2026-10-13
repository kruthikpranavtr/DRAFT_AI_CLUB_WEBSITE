import {
  Activity, CheckCircle2, FileImage, FolderOpen, HardDrive, ImagePlus,
  Pencil, Plus, RefreshCw, Save, Trash2, Upload, UserCheck, Users, X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardShell from '../components/DashboardShell';
import { useAuth } from '../context/AuthContext';
import { del, get, post, put } from '../lib/api';

const emptyContent = {
  type:'news',pageKey:'news',sectionKey:'new-entry',title:'',excerpt:'',body:'',
  payload:'{}',status:'draft',sortOrder:0,
};
const emptyUser = {
  memberId:'',email:'',name:'',password:'',role:'student',status:'active',permissions:[],
};
const emptyGallery = {
  categoryId:'',title:'',caption:'',altText:'',fileId:'',status:'draft',sortOrder:0,
};

export default function AdminDashboardPage() {
  const { session } = useAuth();
  const [view,setView] = useState('overview');
  const [notice,setNotice] = useState(null);

  const flash = useCallback((type,text) => {
    setNotice({ type,text });
    window.setTimeout(() => setNotice(null),3500);
  },[]);

  return <DashboardShell role="admin" view={view} onViewChange={setView}>
    {notice && <div className={'cms-toast is-'+notice.type} role="status">{notice.text}</div>}
    {view === 'overview' && <Overview session={session} flash={flash}/>}
    {view === 'content' && <ContentManager mode="all" flash={flash}/>}
    {view === 'pages' && <ContentManager mode="pages" flash={flash}/>}
    {view === 'gallery' && <GalleryManager flash={flash}/>}
    {view === 'files' && <FileManager flash={flash}/>}
    {view === 'users' && <UserManager currentUser={session} flash={flash}/>}
    {view === 'settings' && <SettingsManager flash={flash}/>}
  </DashboardShell>;
}

function Overview({ session,flash }) {
  const [data,setData] = useState(null);
  const load = useCallback(() => get('/api/admin/overview').then(setData).catch(error => flash('error',error.message)),[flash]);
  useEffect(() => { load(); },[load]);
  const stats = data?.stats || {};

  return <>
    <PageHead eyebrow="ADMIN CONTROL" title={'Welcome, '+session.name+'.'} text="Live operational data for the AI Club website and member system." action={<button className="dash-action" onClick={load}><RefreshCw size={15}/>Refresh</button>}/>
    <div className="dash-grid dash-grid--4">
      <Stat icon={Users} value={stats.students ?? '—'} label="Student accounts"/>
      <Stat icon={FolderOpen} value={stats.files ?? '—'} label="Uploaded files"/>
      <Stat icon={FileImage} value={stats.gallery ?? '—'} label="Gallery images"/>
      <Stat icon={CheckCircle2} value={stats.published ?? '—'} label="Published content"/>
    </div>
    <div className="dash-grid dash-grid--2">
      <section className="dash-card dash-section">
        <div className="dash-section__head"><h2>Publishing status</h2><span>LIVE</span></div>
        <div className="cms-summary">
          <div><strong>{stats.published ?? 0}</strong><span>Published</span></div>
          <div><strong>{stats.drafts ?? 0}</strong><span>Drafts</span></div>
          <div><strong>{data?.storageMode === 'object-storage' ? 'S3' : 'LOCAL'}</strong><span>File storage</span></div>
        </div>
      </section>
      <section className="dash-card dash-section">
        <div className="dash-section__head"><h2>Recent activity</h2><span>AUDIT LOG</span></div>
        <div className="dash-list">
          {(data?.recent || []).slice(0,6).map(item => <div className="dash-list-item" key={item.id}>
            <span className="dash-list-item__icon"><Activity size={17}/></span>
            <div><h3>{humanAction(item.action)}</h3><p>{item.actor_name || 'System'} · {formatDate(item.created_at)}</p></div>
            <span>{item.entity_type}</span>
          </div>)}
          {data && !data.recent.length && <Empty text="No activity has been recorded yet."/>}
        </div>
      </section>
    </div>
  </>;
}

function ContentManager({ mode,flash }) {
  const [items,setItems] = useState([]);
  const [editing,setEditing] = useState(null);
  const [query,setQuery] = useState('');
  const load = useCallback(() => get('/api/admin/content').then(data => setItems(data.items)).catch(error => flash('error',error.message)),[flash]);
  useEffect(() => { load(); },[load]);

  const visible = useMemo(() => items.filter(item => {
    if (mode === 'pages' && item.type !== 'page-section') return false;
    if (mode === 'all' && item.type === 'page-section') return false;
    const haystack = [item.title,item.type,item.page_key,item.status].join(' ').toLowerCase();
    return haystack.includes(query.toLowerCase());
  }),[items,mode,query]);

  async function remove(item) {
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
    try { await del('/api/admin/content/'+item.id); flash('success','Content deleted.'); load(); }
    catch (error) { flash('error',error.message); }
  }

  return <>
    <PageHead eyebrow={mode === 'pages' ? 'PAGE BUILDER' : 'CONTENT LIBRARY'} title={mode === 'pages' ? 'Pages and sections.' : 'Website content.'}
      text={mode === 'pages' ? 'Add, order, edit, publish, hide, or remove page sections.' : 'Manage news, announcements, events, projects, and reusable website information.'}
      action={<button className="dash-action" onClick={() => setEditing({ ...emptyContent,type:mode === 'pages' ? 'page-section' : 'news',pageKey:mode === 'pages' ? 'home' : 'news' })}><Plus size={15}/>New {mode === 'pages' ? 'section' : 'content'}</button>}/>
    <Toolbar query={query} setQuery={setQuery} placeholder="Search content, page, or status…"/>
    <section className="dash-card dash-section cms-table-card">
      <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>TITLE</th><th>PAGE / TYPE</th><th>STATUS</th><th>UPDATED</th><th>ACTIONS</th></tr></thead>
        <tbody>{visible.map(item => <tr key={item.id}>
          <td><strong>{item.title}</strong><small>{item.section_key}</small></td>
          <td>{item.page_key}<small>{item.type}</small></td>
          <td><Status value={item.status}/></td>
          <td>{formatDate(item.updated_at)}<small>{item.updated_by_name || 'System'}</small></td>
          <td><div className="cms-row-actions"><button onClick={() => setEditing(toContentForm(item))}><Pencil size={14}/>Edit</button><button className="danger" onClick={() => remove(item)}><Trash2 size={14}/>Delete</button></div></td>
        </tr>)}</tbody></table></div>
      {!visible.length && <Empty text="No matching content entries."/>}
    </section>
    {editing && <ContentDialog value={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null);load();flash('success','Content saved successfully.'); }} flash={flash}/>}
  </>;
}

function ContentDialog({ value,onClose,onSaved,flash }) {
  const [form,setForm] = useState(value);
  const [saving,setSaving] = useState(false);
  const change = event => setForm(current => ({ ...current,[event.target.name]:event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      let payload;
      try { payload = JSON.parse(form.payload || '{}'); }
      catch { throw new Error('Advanced data must be valid JSON.'); }
      const body = { ...form,payload,sortOrder:Number(form.sortOrder) };
      if (form.id) await put('/api/admin/content/'+form.id,body);
      else await post('/api/admin/content',body);
      onSaved();
    } catch (error) { flash('error',error.message); }
    finally { setSaving(false); }
  }

  return <Modal title={form.id ? 'Edit content' : 'Create content'} onClose={onClose}>
    <form className="cms-form" onSubmit={submit}>
      <div className="cms-field-span"><label>Title</label><input name="title" value={form.title} onChange={change} required/></div>
      <div><label>Content type</label><select name="type" value={form.type} onChange={change}><option value="page-section">Page section</option><option value="news">News</option><option value="event">Event</option><option value="announcement">Announcement</option><option value="project">Project</option><option value="achievement">Achievement</option></select></div>
      <div><label>Status</label><select name="status" value={form.status} onChange={change}><option value="draft">Draft</option><option value="published">Published</option><option value="hidden">Hidden</option></select></div>
      <div><label>Page key</label><input name="pageKey" value={form.pageKey} onChange={change} placeholder="home" required/></div>
      <div><label>Section key</label><input name="sectionKey" value={form.sectionKey} onChange={change} placeholder="hero" required/></div>
      <div className="cms-field-span"><label>Heading / excerpt</label><textarea name="excerpt" value={form.excerpt} onChange={change} rows="2"/></div>
      <div className="cms-field-span"><label>Description / body</label><textarea name="body" value={form.body} onChange={change} rows="7"/></div>
      <div><label>Display order</label><input name="sortOrder" type="number" value={form.sortOrder} onChange={change}/></div>
      <div className="cms-field-span"><label>Advanced data (JSON)</label><textarea className="cms-code" name="payload" value={form.payload} onChange={change} rows="5"/></div>
      <FormActions onClose={onClose} saving={saving}/>
    </form>
  </Modal>;
}

function GalleryManager({ flash }) {
  const [items,setItems] = useState([]);
  const [categories,setCategories] = useState([]);
  const [files,setFiles] = useState([]);
  const [editing,setEditing] = useState(null);
  const [categoryName,setCategoryName] = useState('');
  const load = useCallback(async () => {
    try {
      const [gallery,cats,fileData] = await Promise.all([get('/api/admin/gallery'),get('/api/admin/categories'),get('/api/admin/files')]);
      setItems(gallery.items);setCategories(cats.items);setFiles(fileData.items.filter(item => item.kind === 'image'));
    } catch (error) { flash('error',error.message); }
  },[flash]);
  useEffect(() => { load(); },[load]);

  async function addCategory(event) {
    event.preventDefault();
    try {
      const slug = categoryName.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      await post('/api/admin/categories',{ name:categoryName,slug,description:'' });
      setCategoryName('');flash('success','Gallery category created.');load();
    } catch (error) { flash('error',error.message); }
  }

  async function remove(item) {
    if (!window.confirm(`Delete gallery item “${item.title}”?`)) return;
    try { await del('/api/admin/gallery/'+item.id);flash('success','Gallery item deleted.');load(); }
    catch (error) { flash('error',error.message); }
  }

  return <>
    <PageHead eyebrow="MEDIA CURATION" title="Gallery management." text="Create categories, attach uploaded images, write captions and control publishing."
      action={<button className="dash-action" onClick={() => setEditing({ ...emptyGallery })}><ImagePlus size={15}/>Add gallery item</button>}/>
    <section className="dash-card dash-section">
      <div className="dash-section__head"><h2>Categories</h2><span>{categories.length} TOTAL</span></div>
      <form className="cms-inline-form" onSubmit={addCategory}><input value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder="New category name" required/><button className="dash-action"><Plus size={14}/>Add category</button></form>
      <div className="cms-category-row">{categories.map(cat => <span key={cat.id}>{cat.name}<small>{cat.item_count}</small><button aria-label={'Delete '+cat.name} onClick={async () => { if(window.confirm(`Delete category “${cat.name}”? Images will remain uncategorized.`)){await del('/api/admin/categories/'+cat.id);load();}}}><X size={13}/></button></span>)}</div>
    </section>
    <section className="dash-card dash-section cms-gallery-admin">
      <div className="dash-section__head"><h2>Gallery images</h2><span>{items.length} ITEMS</span></div>
      <div className="cms-gallery-grid">{items.map(item => <article key={item.id}>
        <img src={item.public_url} alt={item.alt_text}/>
        <div><Status value={item.status}/><h3>{item.title}</h3><p>{item.category_name || 'Uncategorized'} · {item.caption || 'No caption'}</p>
          <div className="cms-row-actions"><button onClick={() => setEditing(toGalleryForm(item))}><Pencil size={14}/>Edit</button><button className="danger" onClick={() => remove(item)}><Trash2 size={14}/>Delete</button></div>
        </div>
      </article>)}</div>
      {!items.length && <Empty text="No gallery items yet. Upload an image in Files, then add it here."/>}
    </section>
    {editing && <GalleryDialog value={editing} categories={categories} files={files} onClose={() => setEditing(null)} onSaved={() => {setEditing(null);load();flash('success','Gallery item saved.');}} flash={flash}/>}
  </>;
}

function GalleryDialog({ value,categories,files,onClose,onSaved,flash }) {
  const [form,setForm] = useState(value);
  const [saving,setSaving] = useState(false);
  const change = event => setForm(current => ({ ...current,[event.target.name]:event.target.value }));
  async function submit(event) {
    event.preventDefault();setSaving(true);
    try {
      const body = { ...form,categoryId:form.categoryId || null,sortOrder:Number(form.sortOrder) };
      if (form.id) await put('/api/admin/gallery/'+form.id,body); else await post('/api/admin/gallery',body);
      onSaved();
    } catch (error) { flash('error',error.message); } finally { setSaving(false); }
  }
  return <Modal title={form.id ? 'Edit gallery item' : 'Add gallery item'} onClose={onClose}><form className="cms-form" onSubmit={submit}>
    <div className="cms-field-span"><label>Title</label><input name="title" value={form.title} onChange={change} required/></div>
    <div><label>Category</label><select name="categoryId" value={form.categoryId} onChange={change}><option value="">Uncategorized</option>{categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></div>
    <div><label>Image file</label><select name="fileId" value={form.fileId} onChange={change} required><option value="">Choose uploaded image</option>{files.map(file => <option key={file.id} value={file.id}>{file.original_name}</option>)}</select></div>
    <div className="cms-field-span"><label>Accessible alt text</label><input name="altText" value={form.altText} onChange={change} required minLength="3"/></div>
    <div className="cms-field-span"><label>Caption</label><textarea name="caption" value={form.caption} onChange={change} rows="3"/></div>
    <div><label>Status</label><select name="status" value={form.status} onChange={change}><option value="draft">Draft</option><option value="published">Published</option><option value="hidden">Hidden</option></select></div>
    <div><label>Display order</label><input type="number" name="sortOrder" value={form.sortOrder} onChange={change}/></div>
    <FormActions onClose={onClose} saving={saving}/>
  </form></Modal>;
}

function FileManager({ flash }) {
  const [items,setItems] = useState([]);
  const [uploading,setUploading] = useState(false);
  const load = useCallback(() => get('/api/admin/files').then(data => setItems(data.items)).catch(error => flash('error',error.message)),[flash]);
  useEffect(() => { load(); },[load]);

  async function uploadFile(file,replaceId) {
    if (!file) return;
    const data = new FormData();data.append('file',file);
    setUploading(true);
    try {
      if (replaceId) await put('/api/admin/files/'+replaceId,data); else await post('/api/admin/files',data);
      flash('success',replaceId ? 'File replaced successfully.' : 'File uploaded successfully.');load();
    } catch (error) { flash('error',error.message); } finally { setUploading(false); }
  }

  async function remove(item) {
    if (!window.confirm(`Permanently delete “${item.original_name}”?`)) return;
    try { await del('/api/admin/files/'+item.id);flash('success','File deleted.');load(); }
    catch (error) { flash('error',error.message); }
  }

  return <>
    <PageHead eyebrow="ASSET LIBRARY" title="Files and documents." text="Upload, view, download, replace, and safely remove supported assets."
      action={<label className={'dash-action'+(uploading?' is-disabled':'')}><Upload size={15}/>{uploading?'Uploading…':'Upload file'}<input type="file" hidden disabled={uploading} accept="image/*,video/mp4,video/webm,.pdf,.docx,.xlsx,.txt,.csv" onChange={event => uploadFile(event.target.files[0])}/></label>}/>
    <section className="dash-card dash-section cms-table-card">
      <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>FILE</th><th>TYPE</th><th>SIZE</th><th>UPLOADED</th><th>ACTIONS</th></tr></thead><tbody>
        {items.map(item => <tr key={item.id}><td><strong>{item.original_name}</strong><small>{item.kind}</small></td><td>{item.mime_type}</td><td>{formatBytes(item.size)}</td><td>{formatDate(item.created_at)}<small>{item.uploaded_by_name}</small></td>
          <td><div className="cms-row-actions"><a href={'/api/admin/files/'+item.id+'/download'}><HardDrive size={14}/>Download</a><label><RefreshCw size={14}/>Replace<input type="file" hidden onChange={event => uploadFile(event.target.files[0],item.id)}/></label><button className="danger" onClick={() => remove(item)}><Trash2 size={14}/>Delete</button></div></td></tr>)}
      </tbody></table></div>
      {!items.length && <Empty text="No files have been uploaded."/>}
    </section>
  </>;
}

function UserManager({ currentUser,flash }) {
  const [items,setItems] = useState([]);
  const [editing,setEditing] = useState(null);
  const load = useCallback(() => get('/api/admin/users').then(data => setItems(data.items)).catch(error => flash('error',error.message)),[flash]);
  useEffect(() => { load(); },[load]);

  async function changeStatus(user,status) {
    try {
      await put('/api/admin/users/'+user.id,toUserPayload({ ...user,status }));
      flash('success',`${user.name} is now ${status}.`);load();
    } catch (error) { flash('error',error.message); }
  }

  async function remove(user) {
    if (!window.confirm(`Delete account “${user.name}” permanently?`)) return;
    try { await del('/api/admin/users/'+user.id);flash('success','Account deleted.');load(); }
    catch (error) { flash('error',error.message); }
  }

  return <>
    <PageHead eyebrow="ACCESS CONTROL" title="Users and permissions." text="Create student or administrator accounts and control access from the server."
      action={<button className="dash-action" onClick={() => setEditing({ ...emptyUser })}><UserCheck size={15}/>Add user</button>}/>
    <section className="dash-card dash-section cms-table-card">
      <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>USER</th><th>ROLE</th><th>STATUS</th><th>CREATED</th><th>ACTIONS</th></tr></thead><tbody>{items.map(user => <tr key={user.id}>
        <td><strong>{user.name}</strong><small>{user.member_id} · {user.email}</small></td><td><Status value={user.role}/></td>
        <td><select className="cms-compact-select" value={user.status} disabled={user.id === currentUser.id} onChange={event => changeStatus(user,event.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></td>
        <td>{formatDate(user.created_at)}</td><td><div className="cms-row-actions"><button onClick={() => setEditing(toUserForm(user))}><Pencil size={14}/>Edit</button><button className="danger" disabled={user.id === currentUser.id} onClick={() => remove(user)}><Trash2 size={14}/>Delete</button></div></td>
      </tr>)}</tbody></table></div>
    </section>
    {editing && <UserDialog value={editing} onClose={() => setEditing(null)} onSaved={() => {setEditing(null);load();flash('success','User account saved.');}} flash={flash}/>}
  </>;
}

function UserDialog({ value,onClose,onSaved,flash }) {
  const [form,setForm] = useState(value);
  const [saving,setSaving] = useState(false);
  const change = event => setForm(current => ({ ...current,[event.target.name]:event.target.value }));
  async function submit(event) {
    event.preventDefault();setSaving(true);
    try {
      const body = { ...form,permissions:form.role === 'admin' ? ['cms:*','users:*','settings:*'] : [] };
      if (!body.password) delete body.password;
      if (form.id) await put('/api/admin/users/'+form.id,body); else await post('/api/admin/users',body);
      onSaved();
    } catch (error) { flash('error',error.message); } finally { setSaving(false); }
  }
  return <Modal title={form.id ? 'Edit user' : 'Create user'} onClose={onClose}><form className="cms-form" onSubmit={submit}>
    <div className="cms-field-span"><label>Full name</label><input name="name" value={form.name} onChange={change} required/></div>
    <div><label>Member ID</label><input name="memberId" value={form.memberId} onChange={change} required/></div>
    <div><label>Email</label><input type="email" name="email" value={form.email} onChange={change} required/></div>
    <div><label>Role</label><select name="role" value={form.role} onChange={change}><option value="student">Student</option><option value="admin">Administrator</option></select></div>
    <div><label>Status</label><select name="status" value={form.status} onChange={change}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></div>
    <div className="cms-field-span"><label>{form.id ? 'New password (leave blank to keep current)' : 'Temporary password'}</label><input type="password" name="password" value={form.password || ''} onChange={change} required={!form.id} minLength="10"/></div>
    <FormActions onClose={onClose} saving={saving}/>
  </form></Modal>;
}

function SettingsManager({ flash }) {
  const [values,setValues] = useState({});
  const [saving,setSaving] = useState(false);
  const load = useCallback(() => get('/api/admin/settings').then(data => setValues(Object.fromEntries(data.items.map(item => [item.key,item.value])))).catch(error => flash('error',error.message)),[flash]);
  useEffect(() => { load(); },[load]);
  const set = (key,value) => setValues(current => ({ ...current,[key]:value }));

  async function submit(event) {
    event.preventDefault();setSaving(true);
    try {
      await Promise.all(Object.entries(values).map(([key,value]) => put('/api/admin/settings/'+encodeURIComponent(key),{ value,isPublic:true })));
      flash('success','Website settings published.');load();
    } catch (error) { flash('error',error.message); } finally { setSaving(false); }
  }

  return <>
    <PageHead eyebrow="WEBSITE CONFIGURATION" title="Settings and announcements." text="Control public contact details, site-wide announcements, and banners."/>
    <section className="dash-card dash-section"><form className="cms-form" onSubmit={submit}>
      <div className="cms-field-span"><label>Website name</label><input value={values['site.name'] ?? ''} onChange={e => set('site.name',e.target.value)}/></div>
      <div><label>Contact email</label><input type="email" value={values['contact.email'] ?? ''} onChange={e => set('contact.email',e.target.value)}/></div>
      <div><label>Contact phone</label><input value={values['contact.phone'] ?? ''} onChange={e => set('contact.phone',e.target.value)}/></div>
      <Toggle label="Show announcement" checked={Boolean(values['announcement.enabled'])} onChange={v => set('announcement.enabled',v)}/>
      <div className="cms-field-span"><label>Announcement text</label><textarea rows="3" value={values['announcement.text'] ?? ''} onChange={e => set('announcement.text',e.target.value)}/></div>
      <Toggle label="Show promotional banner" checked={Boolean(values['banner.enabled'])} onChange={v => set('banner.enabled',v)}/>
      <div className="cms-field-span"><label>Banner text</label><textarea rows="3" value={values['banner.text'] ?? ''} onChange={e => set('banner.text',e.target.value)}/></div>
      <div className="cms-field-span cms-form-actions"><button className="dash-action" disabled={saving}><Save size={15}/>{saving?'Saving…':'Save settings'}</button></div>
    </form></section>
  </>;
}

function Modal({ title,onClose,children }) {
  return <div className="cms-modal-backdrop" role="presentation" onMouseDown={onClose}><section className="cms-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={e => e.stopPropagation()}>
    <header><h2>{title}</h2><button onClick={onClose} aria-label="Close dialog"><X size={20}/></button></header>{children}
  </section></div>;
}
function FormActions({ onClose,saving }) { return <div className="cms-field-span cms-form-actions"><button type="button" onClick={onClose}>Cancel</button><button className="dash-action" disabled={saving}><Save size={15}/>{saving?'Saving…':'Save changes'}</button></div>; }
function PageHead({ eyebrow,title,text,action }) { return <div className="dash-page-head"><div><span>{eyebrow}</span><h1>{title}</h1></div><div className="cms-page-head-side"><p>{text}</p>{action}</div></div>; }
function Stat({ icon:Icon,value,label }) { return <article className="dash-card dash-stat"><span className="dash-stat__icon"><Icon size={19}/></span><strong>{value}</strong><span>{label}</span></article>; }
function Status({ value }) { return <span className={'dash-chip cms-status is-'+value}>{value}</span>; }
function Empty({ text }) { return <div className="dash-empty">{text}</div>; }
function Toolbar({ query,setQuery,placeholder }) { return <div className="cms-toolbar"><input value={query} onChange={event => setQuery(event.target.value)} placeholder={placeholder}/></div>; }
function Toggle({ label,checked,onChange }) { return <label className="cms-toggle"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}/><span/><b>{label}</b></label>; }
function humanAction(value) { return value.split('.').map(word => word.charAt(0).toUpperCase()+word.slice(1)).join(' · '); }
function formatDate(value) { return value ? new Intl.DateTimeFormat('en-IN',{ dateStyle:'medium',timeStyle:'short' }).format(new Date(value)) : '—'; }
function formatBytes(value) { const units=['B','KB','MB','GB'];let size=Number(value)||0,index=0;while(size>=1024&&index<units.length-1){size/=1024;index++;}return size.toFixed(index?1:0)+' '+units[index]; }
function toContentForm(item) { return { id:item.id,type:item.type,pageKey:item.page_key,sectionKey:item.section_key,title:item.title,excerpt:item.excerpt,body:item.body,payload:JSON.stringify(item.payload || {},null,2),status:item.status,sortOrder:item.sort_order }; }
function toGalleryForm(item) { return { id:item.id,categoryId:item.category_id || '',title:item.title,caption:item.caption,altText:item.alt_text,fileId:item.file_id,status:item.status,sortOrder:item.sort_order }; }
function toUserForm(user) { return { id:user.id,memberId:user.member_id,email:user.email,name:user.name,password:'',role:user.role,status:user.status,permissions:user.permissions || [] }; }
function toUserPayload(user) { return { memberId:user.member_id,email:user.email,name:user.name,role:user.role,status:user.status,permissions:user.permissions || [] }; }
