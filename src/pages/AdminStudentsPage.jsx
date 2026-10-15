import { Plus,ShieldCheck } from 'lucide-react';
import { useCallback,useEffect,useId,useRef,useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import DashboardSheet from '../components/DashboardSheet';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { hasPermission,PERMISSIONS } from '../../shared/permissions';
import { PageHead,StateMessage } from './StudentDashboardPage';

const emptyForm = { memberId:'',name:'',email:'',department:'',academicYear:'',password:'',status:'active' };

export default function AdminStudentsPage() {
  const { session } = useAuth();
  const canManage = hasPermission(session,PERMISSIONS.MANAGE_STUDENTS);
  const [searchParams,setSearchParams] = useSearchParams();
  const [items,setItems] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [showForm,setShowForm] = useState(canManage && searchParams.get('create') === '1');
  const [editingId,setEditingId] = useState(null);
  const [form,setForm] = useState(emptyForm);
  const [submitting,setSubmitting] = useState(false);
  const [message,setMessage] = useState(null);
  const [resetStudent,setResetStudent] = useState(null);
  const panelTrigger = useRef(null);

  const load = useCallback(async () => {
    if (!canManage) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const data = await api('/api/admin/users');
      setItems(data.items.filter(item => item.role === 'student'));
    } catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  },[canManage]);
  useEffect(() => { load(); },[load]);

  function change(field,value) { setForm(current => ({ ...current,[field]:value })); }
  function closeForm() { setShowForm(false); setEditingId(null); setForm(emptyForm); if (searchParams.has('create')) setSearchParams({}, { replace:true }); }
  function beginCreate() { setResetStudent(null); setEditingId(null); setForm(emptyForm); setShowForm(true); setMessage(null); }
  function beginEdit(item,status = item.status) {
    setResetStudent(null);
    setEditingId(item.id);
    setForm({ ...emptyForm,memberId:item.member_id,name:item.name,email:item.email || '',status,department:item.department || '',academicYear:item.academic_year || '' });
    setShowForm(true); setMessage(null);
  }

  async function passwordResetComplete() {
    setResetStudent(null);
    setMessage({ type:'success',text:'Temporary password reset. All previous sessions were revoked. Share the new temporary password through your approved out-of-band process.' });
    await load();
  }

  async function saveStudent(event) {
    event.preventDefault();
    setSubmitting(true); setMessage(null);
    try {
      const body = {
        memberId:form.memberId,name:form.name,email:form.email || null,
        role:'student',status:form.status,permissions:[],
        ...(editingId ? {} : {
          password:form.password,
          profile:{ department:form.department,academicYear:form.academicYear ? Number(form.academicYear) : null },
        }),
      };
      await api(editingId ? `/api/admin/users/${editingId}` : '/api/admin/users',{ method:editingId ? 'PUT' : 'POST',body:JSON.stringify(body) });
      const edited = Boolean(editingId);
      closeForm();
      setMessage({ type:'success',text:edited ? 'Student account details updated.' : 'Student account created. Share the temporary password only through your approved out-of-band process.' });
      await load();
    } catch (cause) { setMessage({ type:'error',text:cause.message }); }
    finally { setSubmitting(false); }
  }

  return <DashboardShell section="Students">
    <PageHead eyebrow="STUDENT MANAGEMENT" title="Student accounts." text="Maintain identities and manage access. Students sign in with their roll number." action={canManage && <button className="dash-action" disabled={submitting} onClick={event => { panelTrigger.current = event.currentTarget; beginCreate(); }}><Plus size={16}/>Create student</button>}/>
    {!canManage && <StateMessage tone="error">You do not have permission to manage student accounts.</StateMessage>}
    {message && <div className={`portal-banner is-${message.type}`} role="status">{message.text}</div>}
    {canManage && resetStudent && <ResetPasswordForm key={resetStudent.id} student={resetStudent} returnFocusRef={panelTrigger} onCancel={() => setResetStudent(null)} onComplete={passwordResetComplete}/>}
    {canManage && showForm && <DashboardSheet title={editingId ? 'Edit student identity' : 'Create student'} eyebrow={editingId ? 'ADMIN CONTROLLED' : 'NEW ACCOUNT'} onClose={closeForm} busy={submitting} returnFocusRef={panelTrigger}>
      <form onSubmit={saveStudent} autoComplete="off">
        <p className="portal-reset-copy">{editingId ? 'Official identity is administrator-controlled. Suspending or deactivating this account immediately ends its sessions.' : 'The student will set a personal password at first sign-in. Deliver temporary credentials securely outside this platform.'}</p>
        <fieldset className="portal-form-group"><legend>Identity & access</legend><div className="portal-form-grid">
          <AdminField label="Roll number" name="new-student-roll-number" autoComplete="off" value={form.memberId} onChange={value => change('memberId',value)} required/>
          <AdminField label="Official name" name="new-student-name" autoComplete="off" value={form.name} onChange={value => change('name',value)} required/>
          <AdminField label="Email (optional)" name="new-student-email" autoComplete="off" type="email" value={form.email} onChange={value => change('email',value)}/>
          {editingId && <label className="portal-field"><span>Status</span><select value={form.status} onChange={event => change('status',event.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></label>}
        </div></fieldset>
        {!editingId && <><fieldset className="portal-form-group"><legend>Academic details</legend><div className="portal-form-grid"><AdminField label="Department" name="new-student-department" autoComplete="off" value={form.department} onChange={value => change('department',value)}/><label className="portal-field"><span>Year</span><select value={form.academicYear} onChange={event => change('academicYear',event.target.value)}><option value="">Not specified</option>{[1,2,3,4,5,6].map(year => <option value={year} key={year}>Year {year}</option>)}</select></label></div></fieldset><AdminField label="Temporary password" name="new-student-temporary-password" autoComplete="new-password" type="password" value={form.password} onChange={value => change('password',value)} minLength={12} required help="At least 12 characters. Never share in logs or notifications."/></>}
        {message?.type === 'error' && <div className="portal-banner is-error" role="alert">{message.text}</div>}
        <div className="portal-form-actions"><button className="portal-secondary-button" type="button" disabled={submitting} onClick={closeForm}>Cancel</button><button className="dash-action" disabled={submitting}><ShieldCheck size={15}/>{submitting ? 'Saving…' : editingId ? 'Save account' : 'Create account'}</button></div>
      </form>
    </DashboardSheet>}
    {loading && <StateMessage>Loading student accounts…</StateMessage>}
    {error && <StateMessage tone="error">{error}</StateMessage>}
    {canManage && !loading && !error && !items.length && <StateMessage>No student accounts exist yet. Create the first account to begin.</StateMessage>}
    {canManage && !loading && !error && items.length > 0 && <section className="dash-card portal-students">
      <div className="dash-section__head"><h2>Students</h2><span>{items.length} TOTAL</span></div>
      <table className="dash-table" aria-label="Student accounts"><thead><tr><th scope="col">Student</th><th scope="col">Academic details</th><th scope="col">Access</th><th scope="col">Actions</th></tr></thead><tbody>{items.map(item => <tr key={item.id}>
        <td data-label="Student"><strong>{item.name}</strong><small>{item.member_id}</small></td>
        <td data-label="Academic details"><div>{item.department || 'Department not set'}<small>{item.academic_year ? `Year ${item.academic_year}` : 'Year not set'}</small></div></td>
        <td data-label="Access"><div><span className={`dash-chip cms-status is-${item.status}`}>{item.status}</span><small>{item.must_change_password ? 'Password change required' : 'Password secured'}</small></div></td>
        <td data-label="Actions"><div className="cms-row-actions"><button disabled={submitting} onClick={event => { panelTrigger.current = event.currentTarget; beginEdit(item); }}>Edit identity</button><button disabled={submitting || Boolean(resetStudent)} onClick={event => { panelTrigger.current = event.currentTarget; closeForm(); setResetStudent(item); setMessage(null); }}>Reset password</button><button className={item.status === 'active' ? 'danger' : ''} disabled={submitting} onClick={event => { panelTrigger.current = event.currentTarget; beginEdit(item,item.status === 'active' ? 'suspended' : 'active'); }}>{item.status === 'active' ? 'Suspend' : 'Reactivate'}</button></div></td>
      </tr>)}</tbody></table>
    </section>}
  </DashboardShell>;
}

function AdminField({ label,name,value,onChange,type='text',required=false,minLength,help,autoComplete }) { const id = useId(); return <div className="portal-field"><label htmlFor={id}>{label}</label><input id={id} aria-describedby={help ? `${id}-help` : undefined} name={name} autoComplete={autoComplete} type={type} value={value} onChange={event => onChange(event.target.value)} required={required} minLength={minLength}/>{help && <small id={`${id}-help`}>{help}</small>}</div>; }

function ResetPasswordForm({ student,onCancel,onComplete,returnFocusRef }) {
  const [password,setPassword] = useState('');
  const [confirmed,setConfirmed] = useState(false);
  const [submitting,setSubmitting] = useState(false);
  const [error,setError] = useState('');

  async function reset(event) {
    event.preventDefault();
    if (!confirmed || submitting) return;
    setSubmitting(true); setError('');
    try {
      await api(`/api/admin/users/${student.id}/reset-password`,{
        method:'POST',body:JSON.stringify({ temporaryPassword:password }),
      });
      setPassword('');
      await onComplete();
    } catch (cause) {
      setPassword(''); setConfirmed(false); setError(cause.message);
    } finally { setSubmitting(false); }
  }

  return <DashboardSheet title="Reset temporary password" eyebrow={student.member_id} onClose={onCancel} busy={submitting} returnFocusRef={returnFocusRef}><form onSubmit={reset} autoComplete="off" aria-label="Reset student password">
    <p className="portal-reset-copy">Reset access for {student.name}. Every existing session will end, and the student must change this temporary password at their next sign-in.</p>
    <AdminField label="New temporary password" name="reset-student-temporary-password" type="password" autoComplete="new-password" minLength={12} value={password} onChange={setPassword} required help="At least 12 characters. Deliver securely outside this platform."/>
    <label className="portal-reset-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required disabled={submitting}/>I confirm this reset will revoke all sessions for {student.member_id}.</label>
    {error && <div className="portal-banner is-error" role="alert">{error}</div>}
    <div className="portal-form-actions"><button className="portal-secondary-button" type="button" disabled={submitting} onClick={onCancel}>Cancel reset</button><button className="dash-action" disabled={!confirmed || submitting}>{submitting ? 'Resetting…' : 'Confirm password reset'}</button></div>
  </form></DashboardSheet>;
}
