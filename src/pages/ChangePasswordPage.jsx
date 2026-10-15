import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Navigate,useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PortalLoginLayout } from '../components/PortalAuth';
import { workspacePath } from '../lib/auth-routing';
import '../components/Dashboard.css';

export default function ChangePasswordPage() {
  const { session,changePassword } = useAuth();
  const navigate = useNavigate();
  const [currentPassword,setCurrentPassword] = useState('');
  const [newPassword,setNewPassword] = useState('');
  const [confirmPassword,setConfirmPassword] = useState('');
  const [status,setStatus] = useState(null);
  const [submitting,setSubmitting] = useState(false);

  if (!session) return <Navigate to="/login" replace/>;
  if (!session.must_change_password) return <Navigate to={workspacePath(session)} replace/>;

  async function submit(event) {
    event.preventDefault();
    setStatus(null);
    if (newPassword !== confirmPassword) return setStatus({ type:'error',text:'The new passwords do not match.' });
    setSubmitting(true);
    const result = await changePassword(currentPassword,newPassword);
    setSubmitting(false);
    if (!result.ok) return setStatus({ type:'error',text:result.message });
    navigate(workspacePath(result.user),{ replace:true });
  }

  return <PortalLoginLayout eyebrow={session.role === 'admin' ? 'ADMINISTRATOR ACCOUNT' : 'STUDENT ACCOUNT'} title={<>Secure access.<br/>A fresh start.</>} story="Your temporary password is only the beginning. Set a personal password to open your workspace. Every previous session will be revoked." backLabel="Return to sign in" backTo="/login">
    <div className="admin-login__label-row"><span className="admin-login__label">FIRST SIGN-IN</span><span className="admin-demo-badge">PASSWORD REQUIRED</span></div>
    <h1>Make this account yours.</h1>
    <p className="admin-login__intro">Replace your temporary password. Use at least 12 characters and a password you haven’t used before.</p>
    <form onSubmit={submit} className="auth-password-form">
      <PasswordField id="current-password" label="Temporary password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password"/>
      <PasswordField id="new-password" label="New password" value={newPassword} onChange={setNewPassword} autoComplete="new-password"/>
      <PasswordField id="confirm-password" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password"/>
      <button className="admin-login__submit" disabled={submitting}>{submitting ? 'Updating…' : 'Set password and continue'} <ArrowRight size={17}/></button>
      {status && <div className={`portal-banner is-${status.type}`} role="status">{status.text}</div>}
      <div className="admin-login__security">Changing this password invalidates every previous session for the account.</div>
    </form>
  </PortalLoginLayout>;
}

function PasswordField({ id,label,value,onChange,autoComplete }) {
  return <label className="portal-field" htmlFor={id}><span>{label}</span><input id={id} type="password" minLength={12} maxLength={200} autoComplete={autoComplete} value={value} onChange={event => onChange(event.target.value)} required/></label>;
}
