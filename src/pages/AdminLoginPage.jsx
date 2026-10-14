import { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, GraduationCap, KeyRound, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AdminLoginPage.css';

export default function AdminLoginPage() {
  const { signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    const result = await signIn(identifier, password, remember);
    setSubmitting(false);
    if (!result.ok) {
      setStatus({ type:'error', text:result.message });
      return;
    }
    if (result.user.role !== 'student') {
      await signOut();
      setStatus({ type:'error', text:'The admin dashboard is no longer available. Please use a student account.' });
      return;
    }
    navigate('/student/dashboard', { replace:true });
  }

  return (
    <main className="admin-login">
      <section className="admin-login__visual" aria-label="AI Club member access">
        <div className="admin-login__ambient" aria-hidden="true"><span className="admin-node admin-node--one"/><span className="admin-node admin-node--two"/><span className="admin-node admin-node--three"/><span className="admin-node admin-node--four"/><i className="admin-orbit admin-orbit--one"/><i className="admin-orbit admin-orbit--two"/></div>
        <Link to="/" className="admin-brand" aria-label="Return to AI Club home"><img src="/ai-club-emblem.png" alt=""/><span><strong>AI CLUB</strong><small>SRI SHAKTHI</small></span></Link>
        <div className="admin-login__story">
          <div className="admin-login__eyebrow"><Sparkles size={14}/> AI CLUB MEMBER NETWORK</div>
          <h1>One club.<br/><em>One place to begin.</em></h1>
          <p>A secure workspace where students take assessments, track their progress and build skills together.</p>
          <div className="admin-login__trust"><span><GraduationCap size={17}/> Student assessment access</span><span><ShieldCheck size={17}/> Protected student progress</span></div>
        </div>
        <footer>AI CLUB MEMBER SYSTEM <span/> SECURE ACCESS</footer>
      </section>

      <section className="admin-login__form-side">
        <Link to="/" className="admin-login__back"><ArrowLeft size={16}/> Back to website</Link>
        <div className="admin-login__card">
          <div className="admin-login__card-icon"><KeyRound size={24}/></div>
          <div className="admin-login__label-row"><span className="admin-login__label">SECURE PORTAL</span><span className="admin-demo-badge">PROTECTED ACCESS</span></div>
          <h2>Welcome back.</h2>
          <p className="admin-login__intro">Enter your student ID or email and password to access your dashboard.</p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="member-identifier">Student ID or email</label>
            <div className="admin-field"><Mail size={18}/><input id="member-identifier" name="identifier" type="text" autoComplete="username" value={identifier} onChange={event => { setIdentifier(event.target.value); setStatus(null); }} required/></div>
            <div className="admin-password-row"><label htmlFor="member-password">Password</label><Link to="/forgot-password">Forgot password?</Link></div>
            <div className="admin-field"><LockKeyhole size={18}/><input id="member-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => { setPassword(event.target.value); setStatus(null); }} required minLength={8}/><button type="button" className="admin-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
            <label className="admin-remember"><input type="checkbox" name="remember" checked={remember} onChange={event => setRemember(event.target.checked)}/><span><i><CheckMark/></i></span>Keep me signed in on this device</label>
            <button type="submit" className="admin-login__submit" disabled={submitting}>{submitting ? 'Verifying…' : 'Sign in to student dashboard'} <ArrowRight size={17}/></button>
            <p className={'admin-login__message' + (status ? ' is-' + status.type : '')} role="status">{status?.text}</p>
          </form>

          <div className="admin-login__security"><ShieldCheck size={15}/><span>Your session is protected by an HTTP-only cookie and server-enforced access controls.</span></div>
        </div>
        <p className="admin-login__help">Need access? Contact the AI Club faculty coordinator.</p>
      </section>
    </main>
  );
}

function CheckMark() {
  return <svg viewBox="0 0 12 10" aria-hidden="true"><path d="M1 5.2 4.2 8.5 11 1.5"/></svg>;
}
