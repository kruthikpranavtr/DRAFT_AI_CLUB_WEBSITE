import { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, GraduationCap, KeyRound, LockKeyhole, Mail, ShieldCheck, Sparkles, UserCog } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { MOCK_ACCOUNTS, useAuth } from '../context/AuthContext';
import './AdminLoginPage.css';

export default function AdminLoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('student');
  const [email, setEmail] = useState(MOCK_ACCOUNTS.student.email);
  const [password, setPassword] = useState(MOCK_ACCOUNTS.student.password);
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState(null);

  function selectRole(nextRole) {
    const account = MOCK_ACCOUNTS[nextRole];
    setRole(nextRole);
    setEmail(account.email);
    setPassword(account.password);
    setStatus(null);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const result = signIn(role, email, password, remember);
    if (!result.ok) {
      setStatus({ type:'error', text:result.message });
      return;
    }
    navigate(role === 'admin' ? '/admin/dashboard' : '/student/dashboard', { replace:true });
  }

  return (
    <main className="admin-login">
      <section className="admin-login__visual" aria-label="AI Club member access">
        <div className="admin-login__ambient" aria-hidden="true"><span className="admin-node admin-node--one"/><span className="admin-node admin-node--two"/><span className="admin-node admin-node--three"/><span className="admin-node admin-node--four"/><i className="admin-orbit admin-orbit--one"/><i className="admin-orbit admin-orbit--two"/></div>
        <Link to="/" className="admin-brand" aria-label="Return to AI Club home"><img src="/ai-club-emblem.png" alt=""/><span><strong>AI CLUB</strong><small>SRI SHAKTHI</small></span></Link>
        <div className="admin-login__story">
          <div className="admin-login__eyebrow"><Sparkles size={14}/> AI CLUB MEMBER NETWORK</div>
          <h1>One club.<br/><em>One place to begin.</em></h1>
          <p>A shared secure workspace where students take assessments, track their progress and build—while administrators guide the community.</p>
          <div className="admin-login__trust"><span><GraduationCap size={17}/> Student assessment access</span><span><ShieldCheck size={17}/> Protected admin controls</span></div>
        </div>
        <footer>AI CLUB MEMBER SYSTEM <span/> SECURE ACCESS</footer>
      </section>

      <section className="admin-login__form-side">
        <Link to="/" className="admin-login__back"><ArrowLeft size={16}/> Back to website</Link>
        <div className="admin-login__card">
          <div className="admin-login__card-icon"><KeyRound size={24}/></div>
          <div className="admin-login__label-row"><span className="admin-login__label">SECURE PORTAL</span><span className="admin-demo-badge">DEMO ACCOUNT</span></div>
          <h2>Welcome back.</h2>
          <p className="admin-login__intro">Choose a role. Its mock credentials are filled automatically.</p>

          <div className="admin-role-switch" role="group" aria-label="Choose account type">
            <button type="button" className={role === 'student' ? 'active' : ''} onClick={() => selectRole('student')} aria-pressed={role === 'student'}><GraduationCap size={17}/><span>Student</span></button>
            <button type="button" className={role === 'admin' ? 'active' : ''} onClick={() => selectRole('admin')} aria-pressed={role === 'admin'}><UserCog size={17}/><span>Admin</span></button>
          </div>

          <form onSubmit={handleSubmit}>
            <label htmlFor="member-email">{role === 'student' ? 'Student email address' : 'Administrator email address'}</label>
            <div className="admin-field"><Mail size={18}/><input id="member-email" name="email" type="email" autoComplete="username" value={email} onChange={event => { setEmail(event.target.value); setStatus(null); }} required/></div>
            <div className="admin-password-row"><label htmlFor="member-password">Password</label><Link to="/forgot-password">Forgot password?</Link></div>
            <div className="admin-field"><LockKeyhole size={18}/><input id="member-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => { setPassword(event.target.value); setStatus(null); }} required minLength={8}/><button type="button" className="admin-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
            <label className="admin-remember"><input type="checkbox" name="remember" checked={remember} onChange={event => setRemember(event.target.checked)}/><span><i><CheckMark/></i></span>Keep me signed in on this device</label>
            <button type="submit" className="admin-login__submit">Sign in as {role} <ArrowRight size={17}/></button>
            <p className={'admin-login__message' + (status ? ' is-' + status.type : '')} role="status">{status?.text}</p>
          </form>

          <div className="admin-login__security"><ShieldCheck size={15}/><span>Development-only credentials. Replace this mock session with secure server authentication before launch.</span></div>
        </div>
        <p className="admin-login__help">Need access? Contact the AI Club faculty coordinator.</p>
      </section>
    </main>
  );
}

function CheckMark() {
  return <svg viewBox="0 0 12 10" aria-hidden="true"><path d="M1 5.2 4.2 8.5 11 1.5"/></svg>;
}
