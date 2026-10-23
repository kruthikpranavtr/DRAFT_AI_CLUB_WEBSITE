import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoginForm, PortalLoginLayout } from '../components/PortalAuth';
import { workspacePath } from '../lib/auth-routing';

export default function LoginPage() {
  const { signIn, session, loading } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setStatus(null);
    const result = await signIn(identifier, password, remember);
    setSubmitting(false);
    if (!result.ok) return setStatus({ type: 'error', text: result.message });
    navigate(workspacePath(result.user), { replace: true });
  }

  if (loading) return <div className="dash-auth-loading" role="status">Checking your session...</div>;
  if (session) return <Navigate to={workspacePath(session)} replace />;

  return <PortalLoginLayout eyebrow="AI CLUB WORKSPACE" title={<>Your club</>} story="Profiles, people, and club operations. One secure sign-in for the AI Club community, with access determined by your account." backLabel="Back to website" backTo="/">
    <div className="admin-login__label-row"><span className="admin-login__label">MEMBER PLATFORM</span><span className="admin-demo-badge">SECURE SIGN-IN</span></div>
    <h1>Welcome back.</h1>
    <p className="admin-login__intro">Students use their roll number. Administrators can use their ID or email address.</p>
    {import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === "true" && <aside className="admin-login__demo-accounts" aria-label="Local demo credentials">
      <strong>LOCAL DEMO ACCOUNTS</strong>
      <p>Admin: <code>DEMO-ADMIN</code> / <code>DemoAdmin@2026!</code></p>
      <p>Student: <code>DEMO-STUDENT</code> / <code>DemoStudent@2026!</code></p>
    </aside>}
    <LoginForm {...{ identifier, setIdentifier, password, setPassword, remember, setRemember, showPassword, setShowPassword, status, setStatus, submitting, handleSubmit }} />
    <p className="admin-login__recovery">Need a password reset? Contact your club administrator or faculty coordinator.</p>
  </PortalLoginLayout>;
}
